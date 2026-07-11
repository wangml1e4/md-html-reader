use std::fs;
use std::path::{Component, Path, PathBuf};

const SUPPORTED_DOCUMENT_EXTENSIONS: [&str; 2] = ["md", "html"];

pub fn workspace_root(workspace_path: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(workspace_path).map_err(|e| format!("工作区路径无效: {}", e))?;

    if !root.is_dir() {
        return Err("工作区路径必须是目录".to_string());
    }

    Ok(root)
}

pub fn document_file_in_workspace(
    workspace_path: &str,
    file_path: &str,
) -> Result<PathBuf, String> {
    let root = workspace_root(workspace_path)?;
    let file = fs::canonicalize(file_path).map_err(|e| format!("文件路径无效: {}", e))?;

    ensure_within_workspace(&root, &file)?;

    if !file.is_file() {
        return Err("文件路径必须指向文件".to_string());
    }

    ensure_supported_document(&file)?;
    Ok(file)
}

pub fn output_file_in_workspace(
    workspace_path: &str,
    output_path: &str,
) -> Result<PathBuf, String> {
    let root = workspace_root(workspace_path)?;
    let output = Path::new(output_path);

    if !output.is_absolute() {
        return Err("输出路径必须是绝对路径".to_string());
    }

    if output
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("输出路径不能包含 '..'".to_string());
    }

    let parent = output.parent().ok_or("无法获取输出目录")?;
    let parent = fs::canonicalize(parent).map_err(|e| format!("输出目录无效: {}", e))?;
    ensure_within_workspace(&root, &parent)?;

    let file_name = output.file_name().ok_or("输出路径缺少文件名")?;
    let resolved = parent.join(file_name);

    if resolved.exists() {
        let existing = fs::canonicalize(&resolved).map_err(|e| format!("输出路径无效: {}", e))?;
        ensure_within_workspace(&root, &existing)?;
        ensure_html_output(&existing)?;
        return Ok(existing);
    }

    ensure_html_output(&resolved)?;
    Ok(resolved)
}

pub fn ensure_within_workspace(root: &Path, path: &Path) -> Result<(), String> {
    if path.starts_with(root) {
        Ok(())
    } else {
        Err("路径不在已授权工作区内".to_string())
    }
}

pub fn is_ignored_name(name: &str) -> bool {
    name.starts_with('.') || name == "node_modules" || name == "target"
}

pub fn is_supported_document_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| SUPPORTED_DOCUMENT_EXTENSIONS.contains(&extension))
        .unwrap_or(false)
}

fn ensure_supported_document(path: &Path) -> Result<(), String> {
    if is_supported_document_path(path) {
        Ok(())
    } else {
        Err("只允许访问 Markdown 或 HTML 文件".to_string())
    }
}

fn ensure_html_output(path: &Path) -> Result<(), String> {
    if path.extension().and_then(|extension| extension.to_str()) == Some("html") {
        Ok(())
    } else {
        Err("导出路径必须是 .html 文件".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-path-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn document_file_must_be_inside_workspace_and_supported() {
        let workspace = unique_test_root("workspace");
        let outside = unique_test_root("outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(workspace.join("note.md"), "# Note").unwrap();
        fs::write(workspace.join("plain.txt"), "plain").unwrap();
        fs::write(outside.join("secret.md"), "secret").unwrap();

        let workspace = workspace.to_string_lossy().to_string();
        assert!(document_file_in_workspace(&workspace, &(workspace.clone() + "/note.md")).is_ok());
        assert!(
            document_file_in_workspace(&workspace, &(workspace.clone() + "/plain.txt")).is_err()
        );
        assert!(document_file_in_workspace(
            &workspace,
            outside.join("secret.md").to_string_lossy().as_ref()
        )
        .is_err());
    }
}
