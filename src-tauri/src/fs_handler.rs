use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::command;

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-fs-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn read_and_write_require_paths_inside_workspace() {
        let workspace = unique_test_root("workspace");
        let outside = unique_test_root("outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();

        let allowed = workspace.join("note.md");
        let blocked = outside.join("secret.md");
        fs::write(&allowed, "allowed").unwrap();
        fs::write(&blocked, "blocked").unwrap();

        let workspace = workspace.to_string_lossy().to_string();
        let allowed = allowed.to_string_lossy().to_string();
        let blocked = blocked.to_string_lossy().to_string();

        assert_eq!(
            read_file(workspace.clone(), allowed.clone()).unwrap(),
            "allowed"
        );
        assert!(read_file(workspace.clone(), blocked.clone()).is_err());

        write_file(workspace.clone(), allowed.clone(), "updated".to_string()).unwrap();
        assert_eq!(fs::read_to_string(&allowed).unwrap(), "updated");
        assert!(write_file(workspace, blocked.clone(), "leaked".to_string()).is_err());
        assert_eq!(fs::read_to_string(blocked).unwrap(), "blocked");
    }

    #[test]
    fn list_files_skips_hidden_special_and_symlink_entries() {
        let workspace = unique_test_root("scan");
        fs::create_dir_all(workspace.join("node_modules")).unwrap();
        fs::create_dir_all(workspace.join(".hidden")).unwrap();
        fs::write(workspace.join("visible.md"), "visible").unwrap();
        fs::write(workspace.join("node_modules").join("dep.md"), "dep").unwrap();
        fs::write(workspace.join(".hidden").join("secret.md"), "secret").unwrap();

        #[cfg(unix)]
        {
            let outside = unique_test_root("outside-link");
            fs::create_dir_all(&outside).unwrap();
            fs::write(outside.join("linked.md"), "linked").unwrap();
            std::os::unix::fs::symlink(outside.join("linked.md"), workspace.join("linked.md"))
                .unwrap();
        }

        let files = list_files(workspace.to_string_lossy().to_string()).unwrap();
        let names: Vec<_> = files.iter().map(|item| item.name.as_str()).collect();

        assert_eq!(names, vec!["visible.md"]);
    }

    #[test]
    fn list_files_extracts_document_titles() {
        let workspace = unique_test_root("titles");
        fs::create_dir_all(&workspace).unwrap();
        fs::write(
            workspace.join("note.md"),
            "intro\n\n# Markdown Title\n\ncontent",
        )
        .unwrap();
        fs::write(
            workspace.join("page.html"),
            "<!doctype html><html><head><title>HTML Title</title></head><body><h1>Fallback</h1></body></html>",
        )
        .unwrap();
        fs::write(
            workspace.join("fallback.html"),
            "<!doctype html><html><body><h1>Heading Fallback</h1></body></html>",
        )
        .unwrap();

        let files = list_files(workspace.to_string_lossy().to_string()).unwrap();
        let markdown = files.iter().find(|item| item.name == "note.md").unwrap();
        let html = files.iter().find(|item| item.name == "page.html").unwrap();
        let fallback = files
            .iter()
            .find(|item| item.name == "fallback.html")
            .unwrap();

        assert_eq!(markdown.title.as_deref(), Some("Markdown Title"));
        assert_eq!(html.title.as_deref(), Some("HTML Title"));
        assert_eq!(fallback.title.as_deref(), Some("Heading Fallback"));
    }
}

#[command]
pub fn list_files(path: String) -> Result<Vec<FileItem>, String> {
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

            // 只包含 .md 和 .html 文件
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
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

#[command]
pub fn write_file(workspace_path: String, path: String, content: String) -> Result<(), String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {}", e))
}

fn extract_document_title(path: &Path) -> Option<String> {
    let content = read_title_sample(path)?;
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("md") => extract_markdown_title(&content),
        Some("html") => extract_html_title(&content),
        _ => None,
    }
}

fn read_title_sample(path: &Path) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut buffer = vec![0; 64 * 1024];
    let bytes_read = file.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);
    String::from_utf8(buffer).ok()
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
