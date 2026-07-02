use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommentAnchor {
    pub quote: String,
    pub offset: usize,
    pub length: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Comment {
    pub id: String,
    pub file_hash: String,
    pub anchor: CommentAnchor,
    pub content: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommentFile {
    pub file_hash: String,
    pub file_path: String,
    pub comments: Vec<Comment>,
    pub version: String,
}

#[command]
pub fn calculate_file_hash(path: String) -> Result<String, String> {
    let content = fs::read(&path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

fn get_comments_dir(base_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(base_path);
    let parent = path.parent().ok_or("无法获取父目录")?;
    let comments_dir = parent.join(".comments");

    if !comments_dir.exists() {
        fs::create_dir_all(&comments_dir).map_err(|e| e.to_string())?;
    }

    Ok(comments_dir)
}

fn get_comment_file_path(file_hash: &str, base_path: &str) -> Result<PathBuf, String> {
    let comments_dir = get_comments_dir(base_path)?;
    Ok(comments_dir.join(format!("{}.json", file_hash)))
}

#[command]
pub fn load_comments(file_hash: String, file_path: String) -> Result<Vec<Comment>, String> {
    let comment_path = get_comment_file_path(&file_hash, &file_path)?;

    if !comment_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&comment_path).map_err(|e| e.to_string())?;
    let comment_file: CommentFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    Ok(comment_file.comments)
}

#[command]
pub fn save_comment(
    file_hash: String,
    file_path: String,
    comment: Comment,
) -> Result<(), String> {
    let comment_path = get_comment_file_path(&file_hash, &file_path)?;

    let mut comment_file = if comment_path.exists() {
        let content = fs::read_to_string(&comment_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        CommentFile {
            file_hash: file_hash.clone(),
            file_path: file_path.clone(),
            comments: Vec::new(),
            version: "1.0".to_string(),
        }
    };

    comment_file.comments.push(comment);

    let json = serde_json::to_string_pretty(&comment_file).map_err(|e| e.to_string())?;
    fs::write(&comment_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn delete_comment(
    file_hash: String,
    file_path: String,
    comment_id: String,
) -> Result<(), String> {
    let comment_path = get_comment_file_path(&file_hash, &file_path)?;

    if !comment_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&comment_path).map_err(|e| e.to_string())?;
    let mut comment_file: CommentFile =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    comment_file.comments.retain(|c| c.id != comment_id);

    let json = serde_json::to_string_pretty(&comment_file).map_err(|e| e.to_string())?;
    fs::write(&comment_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn update_comment(
    file_hash: String,
    file_path: String,
    comment: Comment,
) -> Result<(), String> {
    let comment_path = get_comment_file_path(&file_hash, &file_path)?;

    if !comment_path.exists() {
        return Err("评论文件不存在".to_string());
    }

    let content = fs::read_to_string(&comment_path).map_err(|e| e.to_string())?;
    let mut comment_file: CommentFile =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(existing) = comment_file.comments.iter_mut().find(|c| c.id == comment.id) {
        *existing = comment;
    } else {
        return Err("评论不存在".to_string());
    }

    let json = serde_json::to_string_pretty(&comment_file).map_err(|e| e.to_string())?;
    fs::write(&comment_path, json).map_err(|e| e.to_string())?;

    Ok(())
}
