use percent_encoding::percent_decode_str;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{
    http::{header::CONTENT_TYPE, Response, StatusCode},
    AppHandle, Manager, Runtime,
};

#[derive(Default)]
pub struct PreviewProtocolRoots(Mutex<Option<PathBuf>>);

pub fn allow_workspace<R: Runtime>(app: &AppHandle<R>, root: &Path) -> Result<(), String> {
    let roots = app.state::<PreviewProtocolRoots>();
    let mut active_root = roots
        .0
        .lock()
        .map_err(|_| "HTML 预览资源授权状态不可用".to_string())?;
    *active_root = Some(root.to_path_buf());
    Ok(())
}

pub fn handle<R: Runtime>(
    app: &AppHandle<R>,
    request: tauri::http::Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let requested_path = match request_path(request.uri().path()) {
        Some(path) => path,
        None => return error_response(StatusCode::BAD_REQUEST, "无效的 HTML 预览资源路径"),
    };
    let file_path = match fs::canonicalize(&requested_path) {
        Ok(path) => path,
        Err(_) => return error_response(StatusCode::NOT_FOUND, "HTML 预览资源不存在"),
    };
    let roots = app.state::<PreviewProtocolRoots>();
    let active_root = match roots.0.lock() {
        Ok(root) => root.clone(),
        Err(_) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "HTML 预览资源授权状态不可用",
            )
        }
    };

    if !active_root
        .as_ref()
        .is_some_and(|root| file_path.starts_with(root))
    {
        return error_response(StatusCode::FORBIDDEN, "HTML 预览资源不在当前工作区内");
    }

    match fs::read(&file_path) {
        Ok(content) => Response::builder()
            .status(StatusCode::OK)
            .header(CONTENT_TYPE, content_type(&file_path))
            .body(content)
            .unwrap(),
        Err(_) => error_response(StatusCode::FORBIDDEN, "HTML 预览资源无法读取"),
    }
}

fn request_path(path: &str) -> Option<PathBuf> {
    let decoded = percent_decode_str(path).decode_utf8_lossy();
    #[cfg(windows)]
    let decoded = decoded.strip_prefix('/').unwrap_or(decoded.as_ref());
    #[cfg(not(windows))]
    let decoded = decoded.as_ref();
    let path = PathBuf::from(decoded);
    path.is_absolute().then_some(path)
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("html" | "htm") => "text/html",
        Some("xhtml") => "application/xhtml+xml",
        Some("css") => "text/css",
        Some("js" | "mjs") => "text/javascript",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn error_response(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(message.as_bytes().to_vec())
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_hierarchical_absolute_paths() {
        assert_eq!(
            request_path("/tmp/preview%20workspace/page.html"),
            Some(PathBuf::from("/tmp/preview workspace/page.html"))
        );
        assert_eq!(request_path("relative/page.html"), None);
    }

    #[cfg(windows)]
    #[test]
    fn decodes_windows_absolute_paths() {
        assert_eq!(
            request_path("/C%3A/preview%20workspace/page.html"),
            Some(PathBuf::from("C:/preview workspace/page.html"))
        );
    }
}
