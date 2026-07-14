use pulldown_cmark::{html, Options, Parser};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::command;
use walkdir::WalkDir;

use crate::fs_handler::read_document_content;
use crate::path_guard::{
    document_file_in_workspace, ensure_within_workspace, is_ignored_name,
    is_supported_document_path, output_file_in_workspace, workspace_root,
};

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
    let workspace_root = workspace_root(&workspace_path)?;
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    for entry in WalkDir::new(&workspace_root)
        .follow_links(false)
        .max_depth(10)
        .into_iter()
        .filter_entry(|entry| should_include_entry(entry.path(), &workspace_root))
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !entry.file_type().is_file() || !is_supported_document_path(path) {
            continue;
        }

        if let Some(file_name) = path.file_name() {
            let name_str = file_name.to_string_lossy();
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
    let workspace_root = workspace_root(&workspace_path)?;
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    let limit = max_results.unwrap_or(100);

    for entry in WalkDir::new(&workspace_root)
        .follow_links(false)
        .max_depth(10)
        .into_iter()
        .filter_entry(|entry| should_include_entry(entry.path(), &workspace_root))
    {
        if results.len() >= limit {
            break;
        }

        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // 只搜索受支持的 Markdown 和 HTML 文件
        if !entry.file_type().is_file() || !is_supported_document_path(path) {
            continue;
        }

        // 读取文件内容
        let content = match read_document_content(path) {
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

            if let Some((match_start, match_end)) = find_utf16_match_range(line, &query_lower) {
                results.push(ContentSearchResult {
                    file_path: path.to_string_lossy().to_string(),
                    file_name: file_name.clone(),
                    line_number: line_num + 1,
                    line_content: line.to_string(),
                    match_start,
                    match_end,
                });
            }
        }
    }

    Ok(results)
}

/// 返回与 JavaScript 字符串切片一致的 UTF-16 偏移。
fn find_utf16_match_range(line: &str, query_lower: &str) -> Option<(usize, usize)> {
    if query_lower.is_empty() {
        return None;
    }

    let mut line_lower = String::new();
    let mut source_ranges = Vec::new();
    let mut source_start = 0;

    for character in line.chars() {
        let source_end = source_start + character.len_utf16();
        for lowered in character.to_lowercase() {
            let folded_start = line_lower.len();
            line_lower.push(lowered);
            source_ranges.push((folded_start, line_lower.len(), source_start, source_end));
        }
        source_start = source_end;
    }

    let folded_start = line_lower.find(query_lower)?;
    let folded_end = folded_start + query_lower.len();
    let match_start = source_ranges
        .iter()
        .find(|(start, end, _, _)| folded_start >= *start && folded_start < *end)?
        .2;
    let match_end = source_ranges
        .iter()
        .rev()
        .find(|(start, end, _, _)| folded_end > *start && folded_end <= *end)?
        .3;

    Some((match_start, match_end))
}

/// 导出 Markdown 为 HTML
#[command]
pub fn export_as_html(
    workspace_path: String,
    file_path: String,
    output_path: String,
    css_content: Option<String>,
) -> Result<(), String> {
    let file_path = document_file_in_workspace(&workspace_path, &file_path)?;
    let output_path = output_file_in_workspace(&workspace_path, &output_path)?;
    let markdown_content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

    // 用后端 Markdown 渲染结果填充导出模板。
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
        file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Document"),
        css_content.unwrap_or_default(),
        markdown_to_html(&markdown_content)
    );

    fs::write(&output_path, html).map_err(|e| e.to_string())?;

    Ok(())
}

/// 将 Markdown 内容渲染为 HTML。
fn markdown_to_html(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);

    let parser = Parser::new_ext(markdown, options);
    let mut output = String::new();
    html::push_html(&mut output, parser);
    output
}

fn should_include_entry(path: &Path, workspace_root: &Path) -> bool {
    if path == workspace_root {
        return true;
    }

    if let Err(_) = ensure_within_workspace(workspace_root, path) {
        return false;
    }

    path.file_name()
        .and_then(|file_name| file_name.to_str())
        .map(|name| !is_ignored_name(name))
        .unwrap_or(false)
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
            "md-html-reader-search-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn search_skips_hidden_special_and_symlink_entries() {
        let workspace = unique_test_root("workspace");
        fs::create_dir_all(workspace.join("node_modules")).unwrap();
        fs::create_dir_all(workspace.join("target")).unwrap();
        fs::create_dir_all(workspace.join(".hidden")).unwrap();
        fs::write(workspace.join("visible.md"), "visible token").unwrap();
        fs::write(
            workspace.join("node_modules").join("dep.md"),
            "secret token",
        )
        .unwrap();
        fs::write(workspace.join("target").join("build.md"), "secret token").unwrap();
        fs::write(workspace.join(".hidden").join("secret.md"), "secret token").unwrap();

        #[cfg(unix)]
        {
            let outside = unique_test_root("outside-link");
            fs::create_dir_all(&outside).unwrap();
            fs::write(outside.join("linked.md"), "secret token").unwrap();
            std::os::unix::fs::symlink(outside.join("linked.md"), workspace.join("linked.md"))
                .unwrap();
        }

        let workspace = workspace.to_string_lossy().to_string();

        let content_results =
            search_content(workspace.clone(), "token".to_string(), Some(20)).unwrap();
        assert_eq!(content_results.len(), 1);
        assert_eq!(content_results[0].file_name, "visible.md");

        let file_results = search_files(workspace, "md".to_string()).unwrap();
        assert_eq!(file_results.len(), 1);
        assert_eq!(file_results[0].name, "visible.md");
    }

    #[test]
    fn content_search_returns_utf16_offsets_for_frontend_highlighting() {
        let workspace = unique_test_root("unicode-offsets");
        fs::create_dir_all(&workspace).unwrap();
        fs::write(workspace.join("unicode.md"), "😀前缀 Keyword 后缀").unwrap();

        let results = search_content(
            workspace.to_string_lossy().to_string(),
            "keyword".to_string(),
            Some(10),
        )
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_start, 5);
        assert_eq!(results[0].match_end, 12);
    }

    #[test]
    fn content_search_maps_lowercase_expansion_back_to_source_character() {
        let workspace = unique_test_root("lowercase-expansion");
        fs::create_dir_all(&workspace).unwrap();
        fs::write(workspace.join("unicode.md"), "İstanbul").unwrap();

        let results = search_content(
            workspace.to_string_lossy().to_string(),
            "i".to_string(),
            Some(10),
        )
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_start, 0);
        assert_eq!(results[0].match_end, 1);
    }

    #[test]
    fn export_requires_workspace_paths_and_renders_markdown() {
        let workspace = unique_test_root("export-workspace");
        let outside = unique_test_root("export-outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();

        let note = workspace.join("note.md");
        let output = workspace.join("note.html");
        let outside_note = outside.join("outside.md");
        let outside_output = outside.join("outside.html");
        fs::write(&note, "# Note\n\n- item").unwrap();
        fs::write(&outside_note, "# Outside").unwrap();

        let workspace = workspace.to_string_lossy().to_string();
        let note = note.to_string_lossy().to_string();
        let output = output.to_string_lossy().to_string();
        let outside_note = outside_note.to_string_lossy().to_string();
        let outside_output = outside_output.to_string_lossy().to_string();

        export_as_html(workspace.clone(), note.clone(), output.clone(), None).unwrap();
        let exported = fs::read_to_string(output).unwrap();
        assert!(exported.contains("<h1>Note</h1>"));
        assert!(exported.contains("<li>item</li>"));

        assert!(export_as_html(
            workspace.clone(),
            outside_note,
            workspace.clone() + "/blocked.html",
            None
        )
        .is_err());
        assert!(export_as_html(workspace, note, outside_output, None).is_err());
    }
}
