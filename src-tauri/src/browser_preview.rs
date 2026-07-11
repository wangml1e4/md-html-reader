use std::path::PathBuf;
use std::process::Command;
use tauri::command;

use crate::path_guard::document_file_in_workspace;

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
    if file_path
        .extension()
        .and_then(|extension| extension.to_str())
        != Some("html")
    {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-preview-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn validate_html_preview_path_requires_workspace_html_file() {
        let workspace = unique_test_root("workspace");
        let outside = unique_test_root("outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();

        let html = workspace.join("page.html");
        let markdown = workspace.join("note.md");
        let outside_html = outside.join("outside.html");
        fs::write(&html, "<h1>Page</h1>").unwrap();
        fs::write(&markdown, "# Note").unwrap();
        fs::write(&outside_html, "<h1>Outside</h1>").unwrap();

        let workspace = workspace.to_string_lossy().to_string();
        assert!(validate_html_preview_path(&workspace, html.to_string_lossy().as_ref()).is_ok());
        assert!(
            validate_html_preview_path(&workspace, markdown.to_string_lossy().as_ref()).is_err()
        );
        assert!(
            validate_html_preview_path(&workspace, outside_html.to_string_lossy().as_ref())
                .is_err()
        );
    }
}
