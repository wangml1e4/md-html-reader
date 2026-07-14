use crate::path_guard::document_file_in_workspace;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::command;
use time::{macros::format_description, OffsetDateTime};

type HmacSha256 = Hmac<Sha256>;

const MAX_TRANSLATION_CHARS: usize = 5000;
const DEFAULT_OLLAMA_ENDPOINT: &str = "http://localhost:11434/api/generate";
const DEFAULT_OLLAMA_MODEL: &str = "qwen3.5:2b";
const MARKDOWN_TENCENT_SOURCE_LANGUAGE: &str = "auto";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationResult {
    pub original: String,
    pub translated: String,
    pub source_lang: String,
    pub target_lang: String,
    pub service: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownTranslationResult {
    pub output_path: String,
    pub translated_characters: usize,
    pub translated_segments: usize,
}

#[derive(Default)]
struct MarkdownTranslationStats {
    translated_characters: usize,
    translated_segments: usize,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiCompatibleConfig {
    base_url: String,
    model: String,
    api_key: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompatibleResponse {
    choices: Vec<OpenAiCompatibleChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompatibleChoice {
    message: OpenAiCompatibleMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompatibleMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct TencentResponseEnvelope {
    response: TencentResponse,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct TencentResponse {
    target_text: Option<String>,
    error: Option<TencentError>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct TencentError {
    message: String,
}

#[command]
pub fn translate_text(
    service: String,
    text: String,
    openai_config: Option<OpenAiCompatibleConfig>,
) -> Result<TranslationResult, String> {
    let text = validate_translate_request(&service, &text)?.to_string();
    let (source_lang, target_lang) = detect_translation_direction(&text);

    match service.as_str() {
        "ollama" => translate_with_ollama(&text, &source_lang, &target_lang),
        "tencent" => translate_with_tencent(&text, &source_lang, &target_lang),
        "openai-compatible" => translate_with_openai_compatible(
            &text,
            &source_lang,
            &target_lang,
            openai_config.as_ref(),
        ),
        _ => Err("未知翻译服务".to_string()),
    }
}

#[command]
pub fn translate_markdown_to_chinese(
    service: String,
    workspace_path: String,
    file_path: String,
    openai_config: Option<OpenAiCompatibleConfig>,
) -> Result<MarkdownTranslationResult, String> {
    validate_translation_service(&service)?;
    if service == "openai-compatible" {
        validate_openai_compatible_config(openai_config.as_ref())?;
    }
    translate_markdown_file_with(&workspace_path, &file_path, |text| {
        translate_fragment_to_chinese(&service, text, openai_config.as_ref())
    })
}

fn translate_fragment_to_chinese(
    service: &str,
    text: &str,
    openai_config: Option<&OpenAiCompatibleConfig>,
) -> Result<String, String> {
    let text = validate_translate_request(service, text)?;
    match service {
        "ollama" => translate_with_ollama_to_chinese(text),
        "tencent" => translate_with_tencent(text, MARKDOWN_TENCENT_SOURCE_LANGUAGE, "zh")
            .map(|result| result.translated),
        "openai-compatible" => translate_with_openai_compatible_to_chinese(text, openai_config),
        _ => Err("未知翻译服务".to_string()),
    }
}

fn validate_translate_request<'a>(service: &str, text: &'a str) -> Result<&'a str, String> {
    validate_translation_service(service)?;

    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("翻译文本不能为空".to_string());
    }

    if trimmed.chars().count() > MAX_TRANSLATION_CHARS {
        return Err("翻译文本不能超过 5000 字符".to_string());
    }

    Ok(trimmed)
}

fn validate_translation_service(service: &str) -> Result<(), String> {
    if service == "ollama" || service == "tencent" || service == "openai-compatible" {
        Ok(())
    } else {
        Err("未知翻译服务".to_string())
    }
}

fn detect_translation_direction(text: &str) -> (String, String) {
    if text.chars().any(is_cjk) {
        ("zh".to_string(), "en".to_string())
    } else {
        ("en".to_string(), "zh".to_string())
    }
}

fn is_cjk(ch: char) -> bool {
    ('\u{4e00}'..='\u{9fff}').contains(&ch)
        || ('\u{3400}'..='\u{4dbf}').contains(&ch)
        || ('\u{f900}'..='\u{faff}').contains(&ch)
}

fn translate_with_ollama(
    text: &str,
    source_lang: &str,
    target_lang: &str,
) -> Result<TranslationResult, String> {
    let prompt = if source_lang == "zh" {
        format!(
            "Translate the following Chinese text to English. Only output the translation, no explanations:\n\n{}",
            text
        )
    } else {
        format!(
            "将以下英文翻译成中文。只输出翻译结果，不要解释：\n\n{}",
            text
        )
    };

    let translated = request_ollama_translation(&prompt, 512)?;

    Ok(TranslationResult {
        original: text.to_string(),
        translated,
        source_lang: source_lang.to_string(),
        target_lang: target_lang.to_string(),
        service: "ollama".to_string(),
    })
}

fn translate_with_ollama_to_chinese(text: &str) -> Result<String, String> {
    let prompt = format!(
        "将以下 Markdown 文本翻译成中文。只输出译文，不要解释；保留 Markdown 标记和所有形如 __MD_HTML_HOLD_0__ 的占位符不变：\n\n{}",
        text
    );
    request_ollama_translation(&prompt, 4096)
}

fn translate_with_openai_compatible(
    text: &str,
    source_lang: &str,
    target_lang: &str,
    config: Option<&OpenAiCompatibleConfig>,
) -> Result<TranslationResult, String> {
    let instruction = if source_lang == "zh" {
        "Translate the user's Chinese text to English. Return only the translation, with no explanation."
    } else {
        "将用户提供的英文翻译成中文。只输出翻译结果，不要解释。"
    };
    let translated = request_openai_compatible_translation(config, instruction, text, 512)?;

    Ok(TranslationResult {
        original: text.to_string(),
        translated,
        source_lang: source_lang.to_string(),
        target_lang: target_lang.to_string(),
        service: "openai-compatible".to_string(),
    })
}

fn translate_with_openai_compatible_to_chinese(
    text: &str,
    config: Option<&OpenAiCompatibleConfig>,
) -> Result<String, String> {
    request_openai_compatible_translation(
        config,
        "将用户提供的 Markdown 文本翻译成中文。只输出译文，不要解释；保留 Markdown 标记和所有形如 __MD_HTML_HOLD_0__ 的占位符不变。",
        text,
        4096,
    )
}

fn request_openai_compatible_translation(
    config: Option<&OpenAiCompatibleConfig>,
    instruction: &str,
    text: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let config = config.ok_or("OpenAI 兼容服务未配置 API Key".to_string())?;
    let endpoint = openai_compatible_endpoint(&config.base_url)?;
    let model = config.model.trim();
    let api_key = config.api_key.trim();

    if model.is_empty() {
        return Err("OpenAI 兼容服务未配置模型名称".to_string());
    }
    if api_key.is_empty() {
        return Err("OpenAI 兼容服务未配置 API Key".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|_| "OpenAI 兼容服务客户端初始化失败".to_string())?;
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "messages": [
                { "role": "system", "content": instruction },
                { "role": "user", "content": text }
            ],
            "temperature": 0.3,
            "max_tokens": max_tokens,
            "stream": false
        }))
        .send()
        .map_err(|_| "OpenAI 兼容服务请求失败，请检查地址、模型和网络".to_string())?;

    if !response.status().is_success() {
        return Err(format!("OpenAI 兼容服务请求失败: {}", response.status()));
    }

    let body: OpenAiCompatibleResponse = response
        .json()
        .map_err(|_| "OpenAI 兼容服务返回内容无法解析".to_string())?;
    let translated = clean_model_output(
        body.choices
            .into_iter()
            .next()
            .and_then(|choice| choice.message.content)
            .unwrap_or_default(),
    );
    if translated.is_empty() {
        return Err("OpenAI 兼容服务未返回译文".to_string());
    }

    Ok(translated)
}

fn validate_openai_compatible_config(
    config: Option<&OpenAiCompatibleConfig>,
) -> Result<(), String> {
    let config = config.ok_or("OpenAI 兼容服务未配置 API Key".to_string())?;
    openai_compatible_endpoint(&config.base_url)?;
    if config.model.trim().is_empty() {
        return Err("OpenAI 兼容服务未配置模型名称".to_string());
    }
    if config.api_key.trim().is_empty() {
        return Err("OpenAI 兼容服务未配置 API Key".to_string());
    }
    Ok(())
}

fn openai_compatible_endpoint(base_url: &str) -> Result<reqwest::Url, String> {
    let mut endpoint =
        reqwest::Url::parse(base_url.trim()).map_err(|_| "OpenAI 兼容服务地址无效".to_string())?;
    if !matches!(endpoint.scheme(), "http" | "https") || endpoint.host_str().is_none() {
        return Err("OpenAI 兼容服务地址必须是 HTTP(S) URL".to_string());
    }
    if !endpoint.username().is_empty() || endpoint.password().is_some() {
        return Err("OpenAI 兼容服务地址不能包含账号或密码".to_string());
    }
    if endpoint.query().is_some() || endpoint.fragment().is_some() {
        return Err("OpenAI 兼容服务地址不能包含查询参数或片段".to_string());
    }

    let path = endpoint.path().trim_end_matches('/');
    let normalized_path = if path.ends_with("/chat/completions") {
        path.to_string()
    } else {
        format!("{}/chat/completions", path)
    };
    endpoint.set_path(&normalized_path);
    Ok(endpoint)
}

fn request_ollama_translation(prompt: &str, num_predict: u32) -> Result<String, String> {
    let endpoint = env::var("OLLAMA_TRANSLATION_ENDPOINT")
        .unwrap_or_else(|_| DEFAULT_OLLAMA_ENDPOINT.to_string());
    let model =
        env::var("OLLAMA_TRANSLATION_MODEL").unwrap_or_else(|_| DEFAULT_OLLAMA_MODEL.to_string());

    let response = reqwest::blocking::Client::new()
        .post(endpoint)
        .json(&json!({
            "model": model,
            "prompt": prompt,
            "stream": false,
            "think": false,
            "options": {
                "temperature": 0.3,
                "num_predict": num_predict
            }
        }))
        .send()
        .map_err(|_| "本地 Ollama 服务不可用或模型未安装".to_string())?;

    if !response.status().is_success() {
        return Err("本地 Ollama 服务不可用或模型未安装".to_string());
    }

    let body: OllamaResponse = response
        .json()
        .map_err(|_| "Ollama 返回内容无法解析".to_string())?;
    let translated = clean_model_output(body.response.unwrap_or_default());
    if translated.is_empty() {
        return Err("Ollama 未返回译文".to_string());
    }

    Ok(translated)
}

fn translate_with_tencent(
    text: &str,
    source_lang: &str,
    target_lang: &str,
) -> Result<TranslationResult, String> {
    let secret_id = env::var("TENCENT_SECRET_ID").map_err(|_| "腾讯翻译未配置密钥".to_string())?;
    let secret_key =
        env::var("TENCENT_SECRET_KEY").map_err(|_| "腾讯翻译未配置密钥".to_string())?;
    let region = env::var("TENCENT_REGION").unwrap_or_else(|_| "ap-beijing".to_string());
    let timestamp = current_unix_timestamp()?;
    let payload = json!({
        "SourceText": text,
        "Source": source_lang,
        "Target": target_lang,
        "ProjectId": 0
    })
    .to_string();
    let authorization = tencent_authorization(&secret_id, &secret_key, timestamp, &payload)?;

    let response = reqwest::blocking::Client::new()
        .post("https://tmt.tencentcloudapi.com")
        .header("Content-Type", "application/json")
        .header("Host", "tmt.tencentcloudapi.com")
        .header("X-TC-Action", "TextTranslate")
        .header("X-TC-Version", "2018-03-21")
        .header("X-TC-Timestamp", timestamp.to_string())
        .header("X-TC-Region", region)
        .header("Authorization", authorization)
        .body(payload)
        .send()
        .map_err(|e| format!("腾讯翻译请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("腾讯翻译请求失败: {}", response.status()));
    }

    let body: TencentResponseEnvelope = response
        .json()
        .map_err(|_| "腾讯翻译返回内容无法解析".to_string())?;

    if let Some(error) = body.response.error {
        return Err(format!("腾讯翻译错误: {}", error.message));
    }

    let translated = body
        .response
        .target_text
        .ok_or_else(|| "腾讯翻译未返回译文".to_string())?;

    Ok(TranslationResult {
        original: text.to_string(),
        translated,
        source_lang: source_lang.to_string(),
        target_lang: target_lang.to_string(),
        service: "tencent".to_string(),
    })
}

fn translate_markdown_file_with<F>(
    workspace_path: &str,
    file_path: &str,
    mut translate: F,
) -> Result<MarkdownTranslationResult, String>
where
    F: FnMut(&str) -> Result<String, String>,
{
    let source_path = document_file_in_workspace(workspace_path, file_path)?;
    if source_path
        .extension()
        .and_then(|extension| extension.to_str())
        != Some("md")
    {
        return Err("只能翻译 Markdown 文件".to_string());
    }

    let output_path = markdown_translation_output_path(&source_path)?;
    if output_path.exists() {
        return Err("中文翻译副本已存在，未覆盖原有文件".to_string());
    }

    let content =
        fs::read_to_string(&source_path).map_err(|error| format!("读取文件失败: {}", error))?;
    let (translated, stats) = translate_markdown_content(&content, &mut translate)?;
    write_new_translation(&output_path, &translated)?;

    Ok(MarkdownTranslationResult {
        output_path: output_path.to_string_lossy().to_string(),
        translated_characters: stats.translated_characters,
        translated_segments: stats.translated_segments,
    })
}

fn markdown_translation_output_path(source_path: &Path) -> Result<PathBuf, String> {
    let parent = source_path.parent().ok_or("无法获取源文件目录")?;
    let stem = source_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or("文件名无效")?;
    Ok(parent.join(format!("{}.zh.md", stem)))
}

fn write_new_translation(path: &Path, content: &str) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                "中文翻译副本已存在，未覆盖原有文件".to_string()
            } else {
                format!("创建中文翻译副本失败: {}", error)
            }
        })?;

    if let Err(error) = file.write_all(content.as_bytes()) {
        drop(file);
        let _ = fs::remove_file(path);
        return Err(format!("写入中文翻译副本失败: {}", error));
    }

    Ok(())
}

fn translate_markdown_content<F>(
    content: &str,
    translate: &mut F,
) -> Result<(String, MarkdownTranslationStats), String>
where
    F: FnMut(&str) -> Result<String, String>,
{
    let mut output = String::with_capacity(content.len());
    let mut stats = MarkdownTranslationStats::default();
    let mut in_front_matter = starts_with_front_matter(content);
    let mut first_line = true;
    let mut in_fenced_code = false;

    let lines: Vec<_> = content.split_inclusive('\n').collect();
    let mut in_table = false;

    for (index, raw_line) in lines.iter().enumerate() {
        let (line, ending) = split_line_ending(raw_line);
        let trimmed = line.trim();

        if in_front_matter {
            output.push_str(raw_line);
            if !first_line && (trimmed == "---" || trimmed == "...") {
                in_front_matter = false;
            }
            first_line = false;
            continue;
        }
        first_line = false;

        if in_table && !is_table_separator(trimmed) && !has_table_cell_separator(line) {
            in_table = false;
        }

        let is_table_header = !in_table
            && has_table_cell_separator(line)
            && lines
                .get(index + 1)
                .map(|next| is_table_separator(split_line_ending(next).0.trim()))
                .unwrap_or(false);

        if is_fenced_code_line(trimmed) {
            in_fenced_code = !in_fenced_code;
            output.push_str(raw_line);
            continue;
        }
        if in_fenced_code
            || trimmed.is_empty()
            || is_horizontal_rule(trimmed)
            || is_reference_definition(trimmed)
            || trimmed.starts_with("<!--")
            || trimmed.starts_with('<')
        {
            output.push_str(raw_line);
            continue;
        }

        let translated_line = if is_table_separator(trimmed) {
            line.to_string()
        } else if is_table_header || (in_table && has_table_cell_separator(line)) {
            translate_table_line(line, translate, &mut stats)?
        } else {
            let (prefix, text) = split_markdown_prefix(line);
            format!(
                "{}{}",
                prefix,
                translate_text_preserving_whitespace(text, translate, &mut stats)?
            )
        };

        output.push_str(&translated_line);
        output.push_str(ending);
        if is_table_header {
            in_table = true;
        }
    }

    Ok((output, stats))
}

fn starts_with_front_matter(content: &str) -> bool {
    content.starts_with("---\n") || content.starts_with("---\r\n")
}

fn split_line_ending(raw_line: &str) -> (&str, &str) {
    if let Some(line) = raw_line.strip_suffix("\r\n") {
        (line, "\r\n")
    } else if let Some(line) = raw_line.strip_suffix('\n') {
        (line, "\n")
    } else {
        (raw_line, "")
    }
}

fn is_fenced_code_line(line: &str) -> bool {
    line.starts_with("```") || line.starts_with("~~~")
}

fn is_horizontal_rule(line: &str) -> bool {
    let markers: String = line
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect();
    markers.len() >= 3
        && markers
            .chars()
            .all(|character| matches!(character, '-' | '*' | '_'))
}

fn is_reference_definition(line: &str) -> bool {
    line.starts_with('[') && line.contains("]:")
}

fn has_table_cell_separator(line: &str) -> bool {
    split_table_cells(line).len() > 1
}

fn is_table_separator(line: &str) -> bool {
    let cells = split_table_cells(line.trim_matches('|'));
    !cells.is_empty()
        && cells.iter().all(|cell| {
            let cell = cell.trim();
            !cell.is_empty() && cell.chars().all(|character| matches!(character, '-' | ':'))
        })
}

fn split_table_cells(line: &str) -> Vec<&str> {
    let mut cells = Vec::new();
    let mut cell_start = 0;
    let mut code_delimiter_len = 0;
    let mut characters = line.char_indices().peekable();

    while let Some((index, character)) = characters.next() {
        if character == '\\' {
            characters.next();
            continue;
        }

        if character == '`' {
            let mut delimiter_len = 1;
            while let Some((_, '`')) = characters.peek() {
                characters.next();
                delimiter_len += 1;
            }
            if code_delimiter_len == 0 {
                code_delimiter_len = delimiter_len;
            } else if code_delimiter_len == delimiter_len {
                code_delimiter_len = 0;
            }
            continue;
        }

        if character == '|' && code_delimiter_len == 0 {
            cells.push(&line[cell_start..index]);
            cell_start = index + character.len_utf8();
        }
    }

    cells.push(&line[cell_start..]);
    cells
}

fn translate_table_line<F>(
    line: &str,
    translate: &mut F,
    stats: &mut MarkdownTranslationStats,
) -> Result<String, String>
where
    F: FnMut(&str) -> Result<String, String>,
{
    let cells = split_table_cells(line);
    let mut translated = String::with_capacity(line.len());

    for (index, cell) in cells.iter().enumerate() {
        translated.push_str(&translate_text_preserving_whitespace(
            cell, translate, stats,
        )?);
        if index + 1 < cells.len() {
            translated.push('|');
        }
    }

    Ok(translated)
}

fn split_markdown_prefix(line: &str) -> (&str, &str) {
    let bytes = line.as_bytes();
    let mut index = 0;

    while index < bytes.len() && matches!(bytes[index], b' ' | b'\t') {
        index += 1;
    }

    while index < bytes.len() && bytes[index] == b'>' {
        index += 1;
        if index < bytes.len() && bytes[index] == b' ' {
            index += 1;
        }
        while index < bytes.len() && matches!(bytes[index], b' ' | b'\t') {
            index += 1;
        }
    }

    let heading_start = index;
    while index < bytes.len() && bytes[index] == b'#' {
        index += 1;
    }
    if index > heading_start && index < bytes.len() && bytes[index] == b' ' {
        while index < bytes.len() && bytes[index] == b' ' {
            index += 1;
        }
        return (&line[..index], &line[index..]);
    }
    index = heading_start;

    if index + 1 < bytes.len()
        && matches!(bytes[index], b'-' | b'+' | b'*')
        && matches!(bytes[index + 1], b' ' | b'\t')
    {
        index += 2;
    } else {
        let list_start = index;
        while index < bytes.len() && bytes[index].is_ascii_digit() {
            index += 1;
        }
        if index > list_start
            && index + 1 < bytes.len()
            && matches!(bytes[index], b'.' | b')')
            && matches!(bytes[index + 1], b' ' | b'\t')
        {
            index += 2;
        } else {
            index = list_start;
        }
    }

    if index + 3 < bytes.len()
        && bytes[index] == b'['
        && matches!(bytes[index + 1], b' ' | b'x' | b'X')
        && bytes[index + 2] == b']'
        && matches!(bytes[index + 3], b' ' | b'\t')
    {
        index += 4;
    }

    (&line[..index], &line[index..])
}

fn translate_text_preserving_whitespace<F>(
    text: &str,
    translate: &mut F,
    stats: &mut MarkdownTranslationStats,
) -> Result<String, String>
where
    F: FnMut(&str) -> Result<String, String>,
{
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(text.to_string());
    }

    let leading_len = text.len() - text.trim_start().len();
    let trailing_len = text.len() - text.trim_end().len();
    let leading = &text[..leading_len];
    let trailing = &text[text.len() - trailing_len..];
    let translated = translate_inline_markdown(trimmed, translate, stats)?;

    Ok(format!("{}{}{}", leading, translated, trailing))
}

fn translate_inline_markdown<F>(
    text: &str,
    translate: &mut F,
    stats: &mut MarkdownTranslationStats,
) -> Result<String, String>
where
    F: FnMut(&str) -> Result<String, String>,
{
    let (protected_text, protected_values) = protect_inline_markdown(text);
    let without_placeholders = protected_values
        .iter()
        .fold(protected_text.clone(), |value, (placeholder, _)| {
            value.replace(placeholder, "")
        });

    if !without_placeholders
        .chars()
        .any(|character| character.is_alphanumeric())
    {
        return Ok(restore_inline_markdown(protected_text, &protected_values)?);
    }

    let translated = translate_text_in_chunks(&protected_text, translate, stats)?;
    restore_inline_markdown(translated, &protected_values)
}

fn protect_inline_markdown(text: &str) -> (String, Vec<(String, String)>) {
    let mut remaining = text;
    let mut protected_text = String::with_capacity(text.len());
    let mut protected_values = Vec::new();

    while !remaining.is_empty() {
        if remaining.starts_with('`') {
            let tick_count = remaining.bytes().take_while(|byte| *byte == b'`').count();
            let delimiter = "`".repeat(tick_count);
            if let Some(end) = remaining[tick_count..].find(&delimiter) {
                let end = tick_count + end + tick_count;
                push_protected_value(
                    &mut protected_text,
                    &mut protected_values,
                    &remaining[..end],
                );
                remaining = &remaining[end..];
                continue;
            }
        }

        if remaining.starts_with("](") {
            if let Some(end) = remaining[2..].find(')') {
                protected_text.push_str("](");
                push_protected_value(
                    &mut protected_text,
                    &mut protected_values,
                    &remaining[2..2 + end],
                );
                protected_text.push(')');
                remaining = &remaining[3 + end..];
                continue;
            }
        }

        if remaining.starts_with("https://") || remaining.starts_with("http://") {
            let end = remaining
                .find(char::is_whitespace)
                .unwrap_or(remaining.len());
            push_protected_value(
                &mut protected_text,
                &mut protected_values,
                &remaining[..end],
            );
            remaining = &remaining[end..];
            continue;
        }

        let character = remaining.chars().next().expect("remaining is not empty");
        protected_text.push(character);
        remaining = &remaining[character.len_utf8()..];
    }

    (protected_text, protected_values)
}

fn push_protected_value(output: &mut String, values: &mut Vec<(String, String)>, value: &str) {
    let placeholder = format!("__MD_HTML_HOLD_{}__", values.len());
    output.push_str(&placeholder);
    values.push((placeholder, value.to_string()));
}

fn restore_inline_markdown(
    mut translated: String,
    protected_values: &[(String, String)],
) -> Result<String, String> {
    for (placeholder, original) in protected_values {
        if !translated.contains(placeholder) {
            return Err("翻译服务未保留 Markdown 占位符，请重试".to_string());
        }
        translated = translated.replace(placeholder, original);
    }
    Ok(translated)
}

fn translate_text_in_chunks<F>(
    text: &str,
    translate: &mut F,
    stats: &mut MarkdownTranslationStats,
) -> Result<String, String>
where
    F: FnMut(&str) -> Result<String, String>,
{
    let mut translated = String::with_capacity(text.len());
    for chunk in split_translation_chunks(text) {
        let trimmed = chunk.trim();
        if trimmed.is_empty() {
            translated.push_str(chunk);
            continue;
        }

        let leading_len = chunk.len() - chunk.trim_start().len();
        let trailing_len = chunk.len() - chunk.trim_end().len();
        let leading = &chunk[..leading_len];
        let trailing = &chunk[chunk.len() - trailing_len..];
        let translated_chunk = translate(trimmed)?;

        stats.translated_characters += trimmed.chars().count();
        stats.translated_segments += 1;
        translated.push_str(leading);
        translated.push_str(&translated_chunk);
        translated.push_str(trailing);
    }
    Ok(translated)
}

fn split_translation_chunks(text: &str) -> Vec<&str> {
    let mut chunks = Vec::new();
    let mut remaining = text;

    while remaining.chars().count() > MAX_TRANSLATION_CHARS {
        let max_byte_index = remaining
            .char_indices()
            .nth(MAX_TRANSLATION_CHARS)
            .map(|(index, _)| index)
            .unwrap_or(remaining.len());
        let candidate = &remaining[..max_byte_index];
        let split_index = candidate
            .char_indices()
            .rev()
            .find(|(_, character)| character.is_whitespace())
            .map(|(index, character)| index + character.len_utf8())
            .filter(|index| *index > 0)
            .unwrap_or(max_byte_index);

        chunks.push(&remaining[..split_index]);
        remaining = &remaining[split_index..];
    }

    if !remaining.is_empty() {
        chunks.push(remaining);
    }

    chunks
}

fn clean_model_output(output: String) -> String {
    let mut cleaned = output;
    while let (Some(start), Some(end)) = (
        cleaned.to_lowercase().find("<think>"),
        cleaned.to_lowercase().find("</think>"),
    ) {
        let end = end + "</think>".len();
        cleaned.replace_range(start..end, "");
    }
    cleaned.trim().to_string()
}

fn current_unix_timestamp() -> Result<i64, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64)
}

fn tencent_authorization(
    secret_id: &str,
    secret_key: &str,
    timestamp: i64,
    payload: &str,
) -> Result<String, String> {
    let endpoint = "tmt.tencentcloudapi.com";
    let service = "tmt";
    let date = timestamp_to_date(timestamp)?;
    let canonical_headers = format!("content-type:application/json\nhost:{}\n", endpoint);
    let signed_headers = "content-type;host";
    let hashed_payload = sha256_hex(payload.as_bytes());
    let canonical_request = format!(
        "POST\n/\n\n{}\n{}\n{}",
        canonical_headers, signed_headers, hashed_payload
    );
    let algorithm = "TC3-HMAC-SHA256";
    let credential_scope = format!("{}/{}/tc3_request", date, service);
    let string_to_sign = format!(
        "{}\n{}\n{}\n{}",
        algorithm,
        timestamp,
        credential_scope,
        sha256_hex(canonical_request.as_bytes())
    );

    let secret_date = hmac_sha256(format!("TC3{}", secret_key).as_bytes(), date.as_bytes())?;
    let secret_service = hmac_sha256(&secret_date, service.as_bytes())?;
    let secret_signing = hmac_sha256(&secret_service, b"tc3_request")?;
    let signature = hmac_sha256_hex(&secret_signing, string_to_sign.as_bytes())?;

    Ok(format!(
        "{} Credential={}/{}, SignedHeaders={}, Signature={}",
        algorithm, secret_id, credential_scope, signed_headers, signature
    ))
}

fn timestamp_to_date(timestamp: i64) -> Result<String, String> {
    let datetime = OffsetDateTime::from_unix_timestamp(timestamp).map_err(|e| e.to_string())?;
    datetime
        .format(format_description!("[year]-[month]-[day]"))
        .map_err(|e| e.to_string())
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> Result<Vec<u8>, String> {
    let mut mac = HmacSha256::new_from_slice(key).map_err(|e| e.to_string())?;
    mac.update(message);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn hmac_sha256_hex(key: &[u8], message: &[u8]) -> Result<String, String> {
    Ok(bytes_to_hex(&hmac_sha256(key, message)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::net::TcpListener;
    use std::path::PathBuf;
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-translation-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn validate_translate_request_rejects_invalid_inputs() {
        assert!(validate_translate_request("ollama", "hello").is_ok());
        assert!(validate_translate_request("tencent", "你好").is_ok());
        assert!(validate_translate_request("openai-compatible", "hello").is_ok());
        assert!(validate_translate_request("unknown", "hello").is_err());
        assert!(validate_translate_request("ollama", "").is_err());
        assert!(validate_translate_request("ollama", &"a".repeat(5001)).is_err());
    }

    #[test]
    fn openai_compatible_endpoint_accepts_base_or_chat_completion_url() {
        assert_eq!(
            openai_compatible_endpoint("https://api.deepseek.com/v1")
                .unwrap()
                .as_str(),
            "https://api.deepseek.com/v1/chat/completions"
        );
        assert_eq!(
            openai_compatible_endpoint("https://example.com/v1/chat/completions/")
                .unwrap()
                .as_str(),
            "https://example.com/v1/chat/completions"
        );
        assert!(openai_compatible_endpoint("file:///tmp/provider").is_err());
        assert!(openai_compatible_endpoint("https://example.com/v1?key=value").is_err());
    }

    #[test]
    fn openai_compatible_config_requires_endpoint_model_and_api_key() {
        let configured = OpenAiCompatibleConfig {
            base_url: "https://api.deepseek.com/v1".to_string(),
            model: "deepseek-chat".to_string(),
            api_key: "test-key".to_string(),
        };
        assert!(validate_openai_compatible_config(Some(&configured)).is_ok());
        assert!(validate_openai_compatible_config(None).is_err());

        let missing_model = OpenAiCompatibleConfig {
            model: " ".to_string(),
            ..configured
        };
        assert!(validate_openai_compatible_config(Some(&missing_model)).is_err());
    }

    #[test]
    fn openai_compatible_translation_uses_chat_completions_with_bearer_auth() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let request = read_http_request(&mut stream);
            let request_lowercase = request.to_ascii_lowercase();
            assert!(request.starts_with("POST /v1/chat/completions HTTP/1.1"));
            assert!(request_lowercase.contains("authorization: bearer test-api-key"));

            let body_start = request.find("\r\n\r\n").unwrap() + 4;
            let body: serde_json::Value = serde_json::from_str(&request[body_start..]).unwrap();
            assert_eq!(body["model"], "deepseek-chat");
            assert_eq!(body["messages"][1]["content"], "Hello");

            let response_body = r#"{"choices":[{"message":{"content":"你好"}}]}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            stream.write_all(response.as_bytes()).unwrap();
        });

        let config = OpenAiCompatibleConfig {
            base_url: format!("http://{}/v1", address),
            model: "deepseek-chat".to_string(),
            api_key: "test-api-key".to_string(),
        };
        let translated = request_openai_compatible_translation(
            Some(&config),
            "Translate the user's text.",
            "Hello",
            512,
        )
        .unwrap();

        assert_eq!(translated, "你好");
        server.join().unwrap();
    }

    fn read_http_request(stream: &mut std::net::TcpStream) -> String {
        let mut request = Vec::new();
        let mut buffer = [0; 4096];

        loop {
            let bytes_read = stream.read(&mut buffer).unwrap();
            request.extend_from_slice(&buffer[..bytes_read]);
            let Some(headers_end) = request.windows(4).position(|window| window == b"\r\n\r\n")
            else {
                continue;
            };
            let headers_end = headers_end + 4;
            let headers = std::str::from_utf8(&request[..headers_end]).unwrap();
            let content_length = headers
                .lines()
                .find_map(|line| {
                    line.strip_prefix("content-length: ")
                        .or_else(|| line.strip_prefix("Content-Length: "))
                })
                .and_then(|value| value.trim().parse::<usize>().ok())
                .unwrap_or_default();
            if request.len() >= headers_end + content_length {
                return String::from_utf8(request).unwrap();
            }
        }
    }

    #[test]
    fn detect_translation_direction_uses_cjk_characters() {
        assert_eq!(
            detect_translation_direction("你好"),
            ("zh".to_string(), "en".to_string())
        );
        assert_eq!(
            detect_translation_direction("hello"),
            ("en".to_string(), "zh".to_string())
        );
    }

    #[test]
    fn markdown_translation_uses_auto_source_for_tencent() {
        assert_eq!(MARKDOWN_TENCENT_SOURCE_LANGUAGE, "auto");
    }

    #[test]
    fn markdown_translation_preserves_protected_markdown_structure() {
        let source = "---\ntitle: Original title\n---\n\n# Hello\n\nA [guide](https://example.com/path) with `code`.\n\n```rust\nprintln!(\"keep\");\n```\n\n| Name | Description |\n| --- | --- |\n| Alpha | First item |\n";
        let mut translate = |text: &str| Ok(format!("中文({})", text));

        let (translated, stats) = translate_markdown_content(source, &mut translate).unwrap();

        assert!(translated.contains("title: Original title"));
        assert!(translated.contains("# 中文(Hello)"));
        assert!(translated.contains("[guide](https://example.com/path)"));
        assert!(translated.contains("`code`"));
        assert!(translated.contains("println!(\"keep\");"));
        assert!(translated.contains("| 中文(Name) | 中文(Description) |"));
        assert!(translated.contains("| --- | --- |"));
        assert!(stats.translated_segments >= 4);
    }

    #[test]
    fn markdown_translation_does_not_treat_inline_code_pipe_as_a_table() {
        let source = "Run `a | b` safely.\n";
        let mut calls = 0;
        let mut translate = |text: &str| {
            calls += 1;
            Ok(format!("中文({})", text))
        };

        let (translated, stats) = translate_markdown_content(source, &mut translate).unwrap();

        assert_eq!(translated, "中文(Run `a | b` safely.)\n");
        assert_eq!(calls, 1);
        assert_eq!(stats.translated_segments, 1);
    }

    #[test]
    fn markdown_translation_splits_text_larger_than_limit() {
        let source = "a".repeat(MAX_TRANSLATION_CHARS + 200);
        let mut calls = 0;
        let mut translate = |text: &str| {
            calls += 1;
            Ok(text.to_string())
        };

        let (translated, stats) = translate_markdown_content(&source, &mut translate).unwrap();

        assert_eq!(translated, source);
        assert_eq!(calls, 2);
        assert_eq!(stats.translated_segments, 2);
    }

    #[test]
    fn markdown_translation_creates_a_non_overwriting_chinese_copy() {
        let workspace = unique_test_root("copy");
        fs::create_dir_all(&workspace).unwrap();
        let source = workspace.join("guide.md");
        fs::write(&source, "# Hello\n\nBody").unwrap();

        let result = translate_markdown_file_with(
            workspace.to_string_lossy().as_ref(),
            source.to_string_lossy().as_ref(),
            |text| Ok(format!("中文({})", text)),
        )
        .unwrap();

        let output = workspace.join("guide.zh.md");
        assert_eq!(
            result.output_path,
            fs::canonicalize(&workspace)
                .unwrap()
                .join("guide.zh.md")
                .to_string_lossy()
        );
        assert_eq!(fs::read_to_string(&source).unwrap(), "# Hello\n\nBody");
        assert!(fs::read_to_string(&output).unwrap().contains("中文(Hello)"));

        let error = translate_markdown_file_with(
            workspace.to_string_lossy().as_ref(),
            source.to_string_lossy().as_ref(),
            |text| Ok(text.to_string()),
        )
        .unwrap_err();
        assert!(error.contains("已存在"));

        fs::remove_dir_all(workspace).unwrap();
    }

    #[test]
    fn markdown_translation_rejects_files_outside_the_workspace() {
        let workspace = unique_test_root("workspace");
        let outside = unique_test_root("outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();
        let source = outside.join("secret.md");
        fs::write(&source, "Secret").unwrap();

        let error = translate_markdown_file_with(
            workspace.to_string_lossy().as_ref(),
            source.to_string_lossy().as_ref(),
            |text| Ok(text.to_string()),
        )
        .unwrap_err();
        assert!(error.contains("不在已授权工作区内"));

        fs::remove_dir_all(workspace).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn markdown_translation_does_not_write_a_partial_copy_when_a_segment_fails() {
        let workspace = unique_test_root("failure");
        fs::create_dir_all(&workspace).unwrap();
        let source = workspace.join("guide.md");
        fs::write(&source, "# First\n\nSecond paragraph").unwrap();
        let mut calls = 0;

        let error = translate_markdown_file_with(
            workspace.to_string_lossy().as_ref(),
            source.to_string_lossy().as_ref(),
            |_text| {
                calls += 1;
                if calls == 2 {
                    Err("translator unavailable".to_string())
                } else {
                    Ok("中文".to_string())
                }
            },
        )
        .unwrap_err();

        assert_eq!(error, "translator unavailable");
        assert!(!workspace.join("guide.zh.md").exists());
        fs::remove_dir_all(workspace).unwrap();
    }
}
