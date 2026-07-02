use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub extension: Option<String>,
    pub children: Option<Vec<FileItem>>,
}

#[command]
pub fn list_files(path: String) -> Result<Vec<FileItem>, String> {
    let root_path = Path::new(&path);

    if !root_path.exists() {
        return Err("路径不存在".to_string());
    }

    scan_directory(root_path)
}

fn scan_directory(path: &Path) -> Result<Vec<FileItem>, String> {
    let mut items = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件和特殊目录
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        if path.is_dir() {
            let children = scan_directory(&path).ok();
            items.push(FileItem {
                name,
                path: path.to_string_lossy().to_string(),
                file_type: "directory".to_string(),
                extension: None,
                children,
            });
        } else {
            let extension = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| format!(".{}", s));

            // 只包含 .md 和 .html 文件
            if let Some(ref ext) = extension {
                if ext == ".md" || ext == ".html" {
                    items.push(FileItem {
                        name,
                        path: path.to_string_lossy().to_string(),
                        file_type: "file".to_string(),
                        extension,
                        children: None,
                    });
                }
            }
        }
    }

    // 按类型和名称排序：目录在前，文件在后
    items.sort_by(|a, b| {
        match (&a.file_type[..], &b.file_type[..]) {
            ("directory", "file") => std::cmp::Ordering::Less,
            ("file", "directory") => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(items)
}

#[command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

#[command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {}", e))
}
