use base64::Engine;
use std::fs;
#[tauri::command]
pub fn export_rendered_html(
    workspace_path: String,
    output_path: String,
    html: String,
) -> Result<(), String> {
    let output = crate::path_guard::output_file_in_workspace(&workspace_path, &output_path)?;
    if output.exists() {
        return Err("An HTML export already exists; the existing file was not overwritten".into());
    }
    fs::write(output, html).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn read_export_resource(workspace_path: String, path: String) -> Result<String, String> {
    let root = crate::path_guard::workspace_root(&workspace_path)?;
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    crate::path_guard::ensure_within_workspace(&root, &path)?;
    let mime = match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        _ => return Err("Only image resources can be embedded".into()),
    };
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
        return Err("Image exceeds 20 MiB".into());
    }
    Ok(format!(
        "data:{};base64,{}",
        mime,
        base64::engine::general_purpose::STANDARD
            .encode(fs::read(path).map_err(|e| e.to_string())?)
    ))
}
