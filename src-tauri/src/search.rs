use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use pulldown_cmark::{html, Event, Options, Parser};
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
    include_markdown_source: bool,
) -> Result<(), String> {
    let file_path = document_file_in_workspace(&workspace_path, &file_path)?;
    let output_path = output_file_in_workspace(&workspace_path, &output_path)?;
    if output_path.exists() {
        return Err("HTML 输出文件已存在，未覆盖原有文件".to_string());
    }
    let markdown_content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

    let title = file_path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Markdown 阅读版");
    let document_html = format!(
        r#"<article class="document-body">{}</article>"#,
        markdown_to_html(&markdown_content)
    );
    let html = reading_html_document(
        title,
        &document_html,
        include_markdown_source.then_some(markdown_content.as_str()),
        &css_content.unwrap_or_default(),
    );

    fs::write(&output_path, html).map_err(|e| e.to_string())?;

    Ok(())
}

/// 将 Markdown 内容渲染为 HTML。
pub(crate) fn markdown_to_html(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);

    // 阅读版只渲染 Markdown 语义，不把文档内嵌的原始 HTML 当成可执行页面内容。
    let parser = Parser::new_ext(markdown, options).map(|event| match event {
        Event::Html(value) | Event::InlineHtml(value) => Event::Text(value),
        event => event,
    });
    let mut output = String::new();
    html::push_html(&mut output, parser);
    output
}

pub(crate) fn reading_html_document(
    title: &str,
    reading_content: &str,
    markdown_source: Option<&str>,
    additional_styles: &str,
) -> String {
    let source_attributes = markdown_source.map_or_else(String::new, |source| {
        format!(
            r#" data-markdown-source="{}""#,
            utf8_percent_encode(source, NON_ALPHANUMERIC)
        )
    });
    let controls = markdown_source.map_or_else(String::new, |_| {
        r#"<nav class="reader-controls" aria-label="阅读视图">
        <button id="show-reading" class="is-active" type="button">阅读模式</button>
        <button id="show-source" type="button">分屏查看</button>
      </nav>"#
            .to_string()
    });
    let source_panel = markdown_source.map_or_else(String::new, |_| {
        r#"<aside class="source-pane" aria-label="Markdown 源文">
        <h2>Markdown 源文</h2>
        <pre id="markdown-source"></pre>
      </aside>"#
            .to_string()
    });
    let source_script = if markdown_source.is_some() {
        r#"
      const source = document.getElementById('markdown-source');
      try {
        source.textContent = decodeURIComponent(document.body.dataset.markdownSource || '');
      } catch (_) {
        source.textContent = 'Markdown 源文加载失败。';
      }

      const readingButton = document.getElementById('show-reading');
      const sourceButton = document.getElementById('show-source');
      const compactScreen = () => window.innerWidth <= 900;
      const setView = (requestedView) => {
        const view = requestedView === 'split' && compactScreen() ? 'source' : requestedView;
        layout.dataset.view = view;
        readingButton.classList.toggle('is-active', view === 'reading');
        sourceButton.classList.toggle('is-active', view !== 'reading');
        readingButton.textContent = compactScreen() ? '阅读内容' : '阅读模式';
        sourceButton.textContent = compactScreen() ? 'Markdown' : '分屏查看';
      };
      readingButton.addEventListener('click', () => setView('reading'));
      sourceButton.addEventListener('click', () => setView('split'));
      window.addEventListener('resize', () => {
        if (compactScreen() && layout.dataset.view === 'split') setView('source');
        else if (!compactScreen() && layout.dataset.view === 'source') setView('split');
        else setView(layout.dataset.view);
      });
      setView('reading');
    "#
    } else {
        ""
    };

    format!(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{}</title>
  <style>
    :root {{ color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; }}
    * {{ box-sizing: border-box; }}
    html {{ scroll-behavior: smooth; }}
    body {{ margin: 0; color: #1d1d1f; background: #f5f5f7; line-height: 1.8; }}
    button {{ font: inherit; }}
    .reader-header {{ display: flex; align-items: end; justify-content: space-between; gap: 24px; width: min(calc(100% - 48px), 1180px); margin: 0 auto; padding: 40px 0 24px; }}
    .reader-header p {{ margin: 0 0 8px; color: #6e6e73; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }}
    .reader-header h1 {{ margin: 0; font-size: clamp(28px, 5vw, 48px); letter-spacing: -.035em; line-height: 1.12; }}
    .reader-controls {{ display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }}
    .reader-controls button {{ border: 1px solid #d2d2d7; border-radius: 999px; padding: 8px 13px; color: #424245; background: #fff; cursor: pointer; }}
    .reader-controls button.is-active {{ border-color: #0071e3; color: #fff; background: #0071e3; }}
    .reader-layout {{ width: min(calc(100% - 48px), 780px); margin: 0 auto 72px; }}
    .reader-layout[data-view="split"] {{ display: grid; grid-template-columns: minmax(300px, 2fr) minmax(0, 3fr); gap: 24px; width: min(calc(100% - 48px), 1440px); align-items: start; }}
    .source-pane {{ display: none; position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow: auto; padding: 24px; border: 1px solid #d2d2d7; border-radius: 20px; background: #161617; color: #f5f5f7; box-shadow: 0 12px 32px rgba(0, 0, 0, .12); }}
    .reader-layout[data-view="split"] .source-pane, .reader-layout[data-view="source"] .source-pane {{ display: block; }}
    .source-pane h2 {{ margin: 0 0 16px; font-size: 15px; }}
    .source-pane pre {{ margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.65 "SF Mono", Menlo, monospace; }}
    .reading-content {{ min-width: 0; padding: 42px 48px; border: 1px solid rgba(0,0,0,.07); border-radius: 24px; background: rgba(255,255,255,.92); box-shadow: 0 16px 42px rgba(0,0,0,.07); }}
    .document-outline {{ display: none; margin: 0 0 34px; padding: 18px 20px; border-radius: 14px; background: #f5f5f7; }}
    .document-outline.is-visible {{ display: block; }}
    .document-outline strong {{ display: block; margin-bottom: 8px; font-size: 14px; }}
    .document-outline a {{ display: block; color: #0066cc; font-size: 14px; line-height: 1.7; text-decoration: none; }}
    .document-outline a[data-level="3"] {{ padding-left: 14px; }}
    .document-body > :first-child {{ margin-top: 0; }}
    .document-body h1, .document-body h2, .document-body h3 {{ scroll-margin-top: 24px; line-height: 1.22; letter-spacing: -.025em; }}
    .document-body h1 {{ margin-top: 1.6em; font-size: 34px; }}
    .document-body h2 {{ margin-top: 1.8em; font-size: 26px; }}
    .document-body h3 {{ margin-top: 1.6em; font-size: 20px; }}
    .document-body p, .document-body li {{ font-size: 17px; }}
    .document-body a {{ color: #0066cc; }}
    .document-body img {{ display: block; max-width: 100%; height: auto; margin: 1.6em auto; border-radius: 14px; }}
    .document-body pre {{ overflow-x: auto; padding: 18px; border-radius: 14px; background: #1d1d1f; color: #f5f5f7; }}
    .document-body code {{ font-family: "SF Mono", Menlo, monospace; }}
    .document-body :not(pre) > code {{ padding: 2px 6px; border-radius: 6px; background: #f0f2f5; }}
    .document-body blockquote {{ margin: 1.5em 0; padding: 8px 20px; border-left: 4px solid #0071e3; border-radius: 0 12px 12px 0; color: #515154; background: #f3f8ff; }}
    .document-body table {{ display: block; width: 100%; overflow-x: auto; border-collapse: collapse; }}
    .document-body th, .document-body td {{ min-width: 120px; padding: 12px; border: 1px solid #d2d2d7; text-align: left; }}
    .document-body th {{ background: #f5f5f7; }}
    {}
    @media (max-width: 900px) {{
      .reader-header {{ align-items: start; flex-direction: column; width: min(calc(100% - 28px), 780px); padding: 28px 0 18px; }}
      .reader-layout, .reader-layout[data-view="split"] {{ display: block; width: min(calc(100% - 28px), 780px); }}
      .reader-layout[data-view="source"] .reading-content {{ display: none; }}
      .reader-layout[data-view="source"] .source-pane {{ position: static; max-height: none; }}
      .reading-content {{ padding: 30px 24px; border-radius: 18px; }}
    }}
  </style>
</head>
<body{}>
  <header class="reader-header">
    <div><p>Markdown 阅读版</p><h1>{}</h1></div>
    {}
  </header>
  <main id="reader-layout" class="reader-layout" data-view="reading">
    {}
    <section class="reading-content"><nav id="document-outline" class="document-outline" aria-label="文章目录"></nav>{}</section>
  </main>
  <script>
    (() => {{
      const layout = document.getElementById('reader-layout');
      const outline = document.getElementById('document-outline');
      const headings = document.querySelectorAll('.document-body h2, .document-body h3');
      if (headings.length) {{
        const title = document.createElement('strong');
        title.textContent = '文章目录';
        outline.append(title);
        headings.forEach((heading, index) => {{
          if (!heading.id) heading.id = `section-${{index + 1}}`;
          const link = document.createElement('a');
          link.href = `#${{heading.id}}`;
          link.textContent = heading.textContent || `第 ${{index + 1}} 节`;
          link.dataset.level = heading.tagName === 'H3' ? '3' : '2';
          outline.append(link);
        }});
        outline.classList.add('is-visible');
      }};
      {}
    }})();
  </script>
</body>
</html>"#,
        escape_html(title),
        additional_styles,
        source_attributes,
        escape_html(title),
        controls,
        source_panel,
        reading_content,
        source_script,
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
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

        export_as_html(workspace.clone(), note.clone(), output.clone(), None, false).unwrap();
        let exported = fs::read_to_string(output).unwrap();
        assert!(exported.contains("<h1>Note</h1>"));
        assert!(exported.contains("<li>item</li>"));
        assert!(!exported.contains("data-markdown-source"));
        assert!(!exported.contains("show-source"));

        assert!(export_as_html(
            workspace.clone(),
            outside_note,
            workspace.clone() + "/blocked.html",
            None,
            false,
        )
        .is_err());
        assert!(export_as_html(workspace, note, outside_output, None, false).is_err());
    }

    #[test]
    fn export_does_not_overwrite_existing_html() {
        let workspace = unique_test_root("export-existing-workspace");
        fs::create_dir_all(&workspace).unwrap();
        let note = workspace.join("note.md");
        let output = workspace.join("note.html");
        fs::write(&note, "# Note").unwrap();
        fs::write(&output, "existing html").unwrap();

        let result = export_as_html(
            workspace.to_string_lossy().to_string(),
            note.to_string_lossy().to_string(),
            output.to_string_lossy().to_string(),
            None,
            false,
        );

        assert_eq!(result.unwrap_err(), "HTML 输出文件已存在，未覆盖原有文件");
        assert_eq!(fs::read_to_string(&output).unwrap(), "existing html");
        fs::remove_dir_all(workspace).unwrap();
    }

    #[test]
    fn export_can_embed_markdown_for_safe_split_reading() {
        let workspace = unique_test_root("export-split-reading");
        fs::create_dir_all(&workspace).unwrap();
        let note = workspace.join("note.md");
        let output = workspace.join("note.html");
        let markdown = "# Note\n\n## Guide\n\n![Hero](assets/hero.png)\n\n<script>window.pwned = true</script>";
        fs::write(&note, markdown).unwrap();

        export_as_html(
            workspace.to_string_lossy().to_string(),
            note.to_string_lossy().to_string(),
            output.to_string_lossy().to_string(),
            None,
            true,
        )
        .unwrap();

        let exported = fs::read_to_string(&output).unwrap();
        assert!(exported.contains("data-view=\"reading\""));
        assert!(exported.contains("data-markdown-source=\""));
        assert!(exported.contains("show-source"));
        assert!(exported.contains("document-outline"));
        assert!(exported.contains("src=\"assets/hero.png\""));
        assert!(exported.contains("&lt;script&gt;window.pwned = true&lt;/script&gt;"));
        assert!(!exported.contains("<script>window.pwned = true</script>"));

        let encoded = exported
            .split("data-markdown-source=\"")
            .nth(1)
            .and_then(|value| value.split('\"').next())
            .unwrap();
        assert_eq!(
            percent_encoding::percent_decode_str(encoded)
                .decode_utf8()
                .unwrap(),
            markdown
        );
        fs::remove_dir_all(workspace).unwrap();
    }
}
