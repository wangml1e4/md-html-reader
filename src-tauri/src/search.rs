use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub path: String,
    pub name: String,
    pub directory: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentSearchResult {
    pub file_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// 搜索文件名
#[command]
pub fn search_files(
    workspace_path: String,
    query: String,
) -> Result<Vec<FileSearchResult>, String> {
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    for entry in WalkDir::new(&workspace_path)
        .follow_links(true)
        .max_depth(10)
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // 跳过隐藏文件和特殊目录
        if let Some(file_name) = path.file_name() {
            let name_str = file_name.to_string_lossy();
            if name_str.starts_with('.') || name_str == "node_modules" || name_str == "target" {
                continue;
            }

            // 只搜索 .md 和 .html 文件
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy();
                    if ext_str == "md" || ext_str == "html" {
                        // 文件名匹配
                        if name_str.to_lowercase().contains(&query_lower) {
                            let directory = path
                                .parent()
                                .and_then(|p| p.file_name())
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_else(|| "".to_string());

                            results.push(FileSearchResult {
                                path: path.to_string_lossy().to_string(),
                                name: name_str.to_string(),
                                directory,
                            });
                        }
                    }
                }
            }
        }
    }

    // 按文件名排序
    results.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(results)
}

/// 搜索文件内容
#[command]
pub fn search_content(
    workspace_path: String,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<ContentSearchResult>, String> {
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    let limit = max_results.unwrap_or(100);

    for entry in WalkDir::new(&workspace_path)
        .follow_links(true)
        .max_depth(10)
    {
        if results.len() >= limit {
            break;
        }

        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // 只搜索 .md 和 .html 文件
        if !path.is_file() {
            continue;
        }

        let ext = path.extension().and_then(|s| s.to_str());
        if ext != Some("md") && ext != Some("html") {
            continue;
        }

        // 跳过隐藏文件
        if let Some(file_name) = path.file_name() {
            if file_name.to_string_lossy().starts_with('.') {
                continue;
            }
        }

        // 读取文件内容
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // 逐行搜索
        for (line_num, line) in content.lines().enumerate() {
            if results.len() >= limit {
                break;
            }

            let line_lower = line.to_lowercase();
            if let Some(pos) = line_lower.find(&query_lower) {
                results.push(ContentSearchResult {
                    file_path: path.to_string_lossy().to_string(),
                    file_name: file_name.clone(),
                    line_number: line_num + 1,
                    line_content: line.to_string(),
                    match_start: pos,
                    match_end: pos + query.len(),
                });
            }
        }
    }

    Ok(results)
}

/// 导出 Markdown 为 HTML
#[command]
pub fn export_as_html(
    file_path: String,
    output_path: String,
    css_content: Option<String>,
) -> Result<(), String> {
    use std::path::Path;

    // 验证输出路径安全性
    let output_path_obj = Path::new(&output_path);

    // 检查路径是否包含危险的遍历操作
    if output_path.contains("..") {
        return Err("输出路径不能包含 '..'".to_string());
    }

    // 确保输出路径是绝对路径或在安全目录内
    if !output_path_obj.is_absolute() {
        return Err("输出路径必须是绝对路径".to_string());
    }

    // 可选：限制只能写入特定目录（如用户文档目录）
    // 这里作为示例，可以根据需求调整

    let markdown_content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

    // 简单的 HTML 模板（前端会用 markdown-it 渲染）
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <style>
        body {{
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.6;
        }}
        pre {{
            background: #f6f8fa;
            padding: 1rem;
            border-radius: 6px;
            overflow-x: auto;
        }}
        code {{
            background: #f6f8fa;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: monospace;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 0.5rem;
            text-align: left;
        }}
        th {{
            background: #f6f8fa;
        }}
        {}
    </style>
</head>
<body>
    <div id="content">{}</div>
</body>
</html>"#,
        Path::new(&file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Document"),
        css_content.unwrap_or_default(),
        markdown_to_html(&markdown_content)
    );

    fs::write(&output_path, html).map_err(|e| e.to_string())?;

    Ok(())
}

/// 简单的 Markdown 转 HTML（生产环境应该用前端的 markdown-it）
fn markdown_to_html(markdown: &str) -> String {
    // 这里只做最基本的转换，复杂的转换应该在前端完成
    let mut html = markdown.to_string();

    // 转义 HTML 标签
    html = html
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;");

    // 简单的段落处理
    html = html
        .split("\n\n")
        .map(|para| format!("<p>{}</p>", para.replace('\n', "<br>")))
        .collect::<Vec<_>>()
        .join("\n");

    html
}
