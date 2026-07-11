use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;
use time::{macros::format_description, OffsetDateTime};

type HmacSha256 = Hmac<Sha256>;

const MAX_TRANSLATION_CHARS: usize = 5000;
const DEFAULT_OLLAMA_ENDPOINT: &str = "http://localhost:11434/api/generate";
const DEFAULT_OLLAMA_MODEL: &str = "qwen3.5:2b";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationResult {
    pub original: String,
    pub translated: String,
    pub source_lang: String,
    pub target_lang: String,
    pub service: String,
}

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: Option<String>,
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
pub fn translate_text(service: String, text: String) -> Result<TranslationResult, String> {
    let text = validate_translate_request(&service, &text)?.to_string();
    let (source_lang, target_lang) = detect_translation_direction(&text);

    match service.as_str() {
        "ollama" => translate_with_ollama(&text, &source_lang, &target_lang),
        "tencent" => translate_with_tencent(&text, &source_lang, &target_lang),
        _ => Err("未知翻译服务".to_string()),
    }
}

fn validate_translate_request<'a>(service: &str, text: &'a str) -> Result<&'a str, String> {
    if service != "ollama" && service != "tencent" {
        return Err("未知翻译服务".to_string());
    }

    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("翻译文本不能为空".to_string());
    }

    if trimmed.chars().count() > MAX_TRANSLATION_CHARS {
        return Err("翻译文本不能超过 5000 字符".to_string());
    }

    Ok(trimmed)
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
    let endpoint = env::var("OLLAMA_TRANSLATION_ENDPOINT")
        .unwrap_or_else(|_| DEFAULT_OLLAMA_ENDPOINT.to_string());
    let model =
        env::var("OLLAMA_TRANSLATION_MODEL").unwrap_or_else(|_| DEFAULT_OLLAMA_MODEL.to_string());
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

    let response = reqwest::blocking::Client::new()
        .post(endpoint)
        .json(&json!({
            "model": model,
            "prompt": prompt,
            "stream": false,
            "think": false,
            "options": {
                "temperature": 0.3,
                "num_predict": 512
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

    Ok(TranslationResult {
        original: text.to_string(),
        translated,
        source_lang: source_lang.to_string(),
        target_lang: target_lang.to_string(),
        service: "ollama".to_string(),
    })
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

    #[test]
    fn validate_translate_request_rejects_invalid_inputs() {
        assert!(validate_translate_request("ollama", "hello").is_ok());
        assert!(validate_translate_request("tencent", "你好").is_ok());
        assert!(validate_translate_request("unknown", "hello").is_err());
        assert!(validate_translate_request("ollama", "").is_err());
        assert!(validate_translate_request("ollama", &"a".repeat(5001)).is_err());
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
}
