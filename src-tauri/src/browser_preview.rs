use std::path::PathBuf;
use std::process::Command;
use tauri::command;

use crate::path_guard::{document_file_in_workspace, is_html_document_path};

#[command]
pub fn open_html_in_default_browser(
    workspace_path: String,
    file_path: String,
) -> Result<(), String> {
    let file_path = validate_html_preview_path(&workspace_path, &file_path)?;
    open_path_with_default_browser(&file_path)
}

fn validate_html_preview_path(workspace_path: &str, file_path: &str) -> Result<PathBuf, String> {
    let file_path = document_file_in_workspace(workspace_path, file_path)?;
    if !is_html_document_path(&file_path) {
        return Err("只能预览 HTML 文件".to_string());
    }

    Ok(file_path)
}

fn open_path_with_default_browser(path: &PathBuf) -> Result<(), String> {
    let status = open_command(path)
        .status()
        .map_err(|e| format!("打开默认浏览器失败: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("打开默认浏览器失败".to_string())
    }
}

#[cfg(target_os = "macos")]
fn open_command(path: &PathBuf) -> Command {
    let mut command = Command::new("open");
    command.arg(path);
    command
}

#[cfg(target_os = "windows")]
fn open_command(path: &PathBuf) -> Command {
    let mut command = Command::new("cmd");
    command.args(["/C", "start", "", &path.to_string_lossy()]);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_command(path: &PathBuf) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(path);
    command
}
