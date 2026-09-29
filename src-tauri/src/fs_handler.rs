use encoding_rs::{Encoding, UTF_16BE, UTF_16LE, UTF_8};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::{command, AppHandle, Manager};

use crate::path_guard::{
    document_file_in_workspace, is_ignored_name, is_supported_document_path, workspace_root,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub extension: Option<String>,
    pub title: Option<String>,
    pub children: Option<Vec<FileItem>>,
}


#[command]
pub async fn list_files(app: AppHandle, path: String) -> Result<Vec<FileItem>, String> {
    let root_path = workspace_root(&path)?;
    let scan_path = root_path.clone();
    let files = tauri::async_runtime::spawn_blocking(move || scan_directory(&scan_path))
        .await
        .map_err(|error| format!("扫描工作区失败: {}", error))??;
    app.state::<tauri::Scopes>()
        .allow_directory(&root_path, true)
        .map_err(|error| format!("授权 HTML 预览资源失败: {}", error))?;
    crate::html_preview_protocol::allow_workspace(&app, &root_path)?;
    Ok(files)
}

pub fn list_workspace_files(path: String) -> Result<Vec<FileItem>, String> {
    let root_path = workspace_root(&path)?;
    scan_directory(&root_path)
}

fn scan_directory(path: &Path) -> Result<Vec<FileItem>, String> {
    let mut items = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件和特殊目录
        if is_ignored_name(&name) {
            continue;
        }

        if file_type.is_dir() {
            let children = scan_directory(&path).ok();
            items.push(FileItem {
                name,
                path: path.to_string_lossy().to_string(),
                file_type: "directory".to_string(),
                extension: None,
                title: None,
                children,
            });
        } else if file_type.is_file() {
            let extension = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| format!(".{}", s));

            // 只包含受支持的 Markdown、HTML 和 YAML 文件
            if is_supported_document_path(&path) {
                items.push(FileItem {
                    name,
                    path: path.to_string_lossy().to_string(),
                    file_type: "file".to_string(),
                    extension,
                    title: extract_document_title(&path),
                    children: None,
                });
            }
        }
    }

    // 按类型和名称排序：目录在前，文件在后
    items.sort_by(|a, b| match (&a.file_type[..], &b.file_type[..]) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(items)
}

#[command]
pub fn read_file(workspace_path: String, path: String) -> Result<String, String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    read_document_content(&path)
}

#[command]
pub fn write_file(workspace_path: String, path: String, content: String) -> Result<(), String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    let file = fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    file.lock().map_err(|e| e.to_string())?;
    replace_document_file(&path, &content, &file, None)
}

fn replace_document_file(
    path: &Path,
    content: &str,
    original: &fs::File,
    expected_bytes: Option<&[u8]>,
) -> Result<(), String> {
    use std::io::Write;
    let parent = path.parent().ok_or("无法获取文件所在目录")?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".markdown-reader-")
        .tempfile_in(parent)
        .map_err(|e| e.to_string())?;
    temporary
        .as_file()
        .set_permissions(original.metadata().map_err(|e| e.to_string())?.permissions())
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    {
        use std::os::fd::AsRawFd;
        let result = unsafe {
            libc::fcopyfile(
                original.as_raw_fd(),
                temporary.as_file().as_raw_fd(),
                std::ptr::null_mut(),
                libc::COPYFILE_ACL | libc::COPYFILE_XATTR,
            )
        };
        if result != 0 {
            return Err(format!(
                "保留文件元数据失败: {}",
                std::io::Error::last_os_error()
            ));
        }
    }
    temporary
        .write_all(content.as_bytes())
        .and_then(|_| temporary.as_file().sync_all())
        .map_err(|e| e.to_string())?;
    if let Some(bytes) = expected_bytes {
        if fs::read(path).map_err(|e| e.to_string())? != bytes {
            return Err("文件已被外部程序修改，未覆盖磁盘。请保留当前草稿并重新打开文件核对差异。".into());
        }
    }
    temporary.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}

fn markdown_file_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    let path = Path::new(name);
    let is_single_file_name = path.components().count() == 1
        && path.file_name().and_then(|file_name| file_name.to_str()) == Some(name)
        && !name.contains(['/', '\\']);

    if name.is_empty() || !is_single_file_name || is_ignored_name(name) {
        return Err("文件名无效。请使用工作区根目录下的普通文件名。".to_string());
    }

    if name
        .rsplit_once('.')
        .map(|(_, extension)| extension.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
    {
        Ok(name.to_string())
    } else {
        Ok(format!("{}.md", name))
    }
}

#[command]
pub fn create_markdown_file(workspace_path: String, name: String) -> Result<String, String> {
    let root = workspace_root(&workspace_path)?;
    let file_name = markdown_file_name(&name)?;
    let path = root.join(file_name);

    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| format!("新建 Markdown 文件失败: {}", error))?;

    Ok(path.to_string_lossy().to_string())
}

#[command]
pub fn delete_markdown_file(workspace_path: String, path: String) -> Result<(), String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    let is_markdown = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"));

    if !is_markdown {
        return Err("只允许删除 Markdown 文件".to_string());
    }

    fs::remove_file(&path).map_err(|error| format!("删除 Markdown 文件失败: {}", error))
}

fn extract_document_title(path: &Path) -> Option<String> {
    let content = read_title_sample(path)?;
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("md") => extract_markdown_title(&content),
        Some("html" | "htm" | "xhtml") => extract_html_title(&content),
        _ => None,
    }
}

fn read_title_sample(path: &Path) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut buffer = vec![0; 64 * 1024];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);
    Some(decode_document_bytes(&buffer))
}

pub fn read_document_content(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("读取文件失败: {}", error))?;
    Ok(decode_document_bytes(&bytes))
}

fn decode_document_bytes(bytes: &[u8]) -> String {
    if let Some(content) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(content).into_owned();
    }
    if let Some(content) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        return UTF_16LE.decode_without_bom_handling(content).0.into_owned();
    }
    if let Some(content) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        return UTF_16BE.decode_without_bom_handling(content).0.into_owned();
    }
    if let Ok(content) = std::str::from_utf8(bytes) {
        return content.to_string();
    }

    if looks_like_utf16le(bytes) {
        return UTF_16LE.decode_without_bom_handling(bytes).0.into_owned();
    }
    if looks_like_utf16be(bytes) {
        return UTF_16BE.decode_without_bom_handling(bytes).0.into_owned();
    }

    let encoding = declared_encoding(bytes).unwrap_or(UTF_8);
    encoding.decode(bytes).0.into_owned()
}

fn looks_like_utf16le(bytes: &[u8]) -> bool {
    let pairs = bytes.chunks_exact(2);
    let pair_count = pairs.len();
    pair_count >= 4 && pairs.filter(|pair| pair[1] == 0).count() * 2 >= pair_count
}

fn looks_like_utf16be(bytes: &[u8]) -> bool {
    let pairs = bytes.chunks_exact(2);
    let pair_count = pairs.len();
    pair_count >= 4 && pairs.filter(|pair| pair[0] == 0).count() * 2 >= pair_count
}

fn declared_encoding(bytes: &[u8]) -> Option<&'static Encoding> {
    let sample = String::from_utf8_lossy(&bytes[..bytes.len().min(8 * 1024)]).to_ascii_lowercase();
    let charset_start = sample.find("charset")? + "charset".len();
    let value = sample[charset_start..]
        .trim_start_matches(|character: char| character.is_ascii_whitespace() || character == '=')
        .trim_start_matches(['\'', '"']);
    let label = value
        .chars()
        .take_while(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        .collect::<String>();

    (!label.is_empty())
        .then(|| Encoding::for_label(label.as_bytes()))
        .flatten()
}

fn extract_markdown_title(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let trimmed = line.trim_start();
        let level = trimmed.chars().take_while(|char| *char == '#').count();
        if !(1..=6).contains(&level) {
            return None;
        }

        let title = trimmed[level..].trim();
        if title.is_empty() || !trimmed[level..].starts_with(' ') {
            None
        } else {
            Some(title.trim_end_matches('#').trim().to_string())
        }
    })
}

fn extract_html_title(content: &str) -> Option<String> {
    extract_html_tag_text(content, "title").or_else(|| extract_html_tag_text(content, "h1"))
}

fn extract_html_tag_text(content: &str, tag: &str) -> Option<String> {
    let lower = content.to_lowercase();
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let open_start = lower.find(&open)?;
    let open_end = lower[open_start..].find('>')? + open_start + 1;
    let close_start = lower[open_end..].find(&close)? + open_end;
    let text = content[open_end..close_start].trim();
    if text.is_empty() {
        None
    } else {
        Some(decode_basic_html_entities(text))
    }
}

fn decode_basic_html_entities(text: &str) -> String {
    text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

#[command]
pub fn write_file_checked(
    workspace_path: String,
    path: String,
    content: String,
    expected_content: String,
) -> Result<(), String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    let mut file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    file.lock().map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if decode_document_bytes(&bytes) != expected_content {
        return Err(
            "文件已被外部程序修改，未覆盖磁盘。请保留当前草稿并重新打开文件核对差异。".into(),
        );
    }

    replace_document_file(&path, &content, &file, Some(&bytes))
}
