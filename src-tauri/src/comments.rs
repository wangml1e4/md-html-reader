use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::command;

use crate::path_guard::document_file_in_workspace;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommentAnchor {
    pub quote: String,
    pub offset: usize,
    pub length: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: String,
    #[serde(alias = "file_hash")]
    pub file_hash: String,
    pub anchor: CommentAnchor,
    pub content: String,
    pub status: String,
    #[serde(alias = "created_at")]
    pub created_at: i64,
    #[serde(alias = "updated_at")]
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentFile {
    #[serde(alias = "file_hash")]
    pub file_hash: String,
    #[serde(alias = "file_path")]
    pub file_path: String,
    pub comments: Vec<Comment>,
    pub version: String,
}

#[command]
pub fn calculate_file_hash(workspace_path: String, path: String) -> Result<String, String> {
    let path = document_file_in_workspace(&workspace_path, &path)?;
    let content = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(hash_bytes(&content))
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let result = hasher.finalize();
    format!("{:x}", result)
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

fn calculate_document_id(file_path: &str) -> String {
    let path = PathBuf::from(file_path);
    let stable_path = path.canonicalize().unwrap_or(path);
    hash_bytes(stable_path.to_string_lossy().as_bytes())
}

fn get_comment_file_path(base_path: &str) -> Result<PathBuf, String> {
    let comments_dir = get_comments_dir(base_path)?;
    Ok(comments_dir.join(format!("{}.json", calculate_document_id(base_path))))
}

#[command]
pub fn load_comments(
    workspace_path: String,
    file_hash: String,
    file_path: String,
) -> Result<Vec<Comment>, String> {
    let _content_version = file_hash;
    let file_path = document_file_in_workspace(&workspace_path, &file_path)?;
    let file_path = file_path.to_string_lossy().to_string();
    let comment_path = get_comment_file_path(&file_path)?;

    if !comment_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&comment_path).map_err(|e| e.to_string())?;
    let comment_file: CommentFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    Ok(comment_file.comments)
}

#[command]
pub fn save_comment(
    workspace_path: String,
    file_hash: String,
    file_path: String,
    comment: Comment,
) -> Result<(), String> {
    let file_path = document_file_in_workspace(&workspace_path, &file_path)?;
    let file_path = file_path.to_string_lossy().to_string();
    let comment_path = get_comment_file_path(&file_path)?;

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

    comment_file.file_hash = file_hash;
    comment_file.file_path = file_path;
    comment_file.comments.push(comment);

    let json = serde_json::to_string_pretty(&comment_file).map_err(|e| e.to_string())?;
    fs::write(&comment_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn delete_comment(
    workspace_path: String,
    file_hash: String,
    file_path: String,
    comment_id: String,
) -> Result<(), String> {
    let file_path = document_file_in_workspace(&workspace_path, &file_path)?;
    let file_path = file_path.to_string_lossy().to_string();
    let comment_path = get_comment_file_path(&file_path)?;

    if !comment_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&comment_path).map_err(|e| e.to_string())?;
    let mut comment_file: CommentFile =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    comment_file.file_hash = file_hash;
    comment_file.file_path = file_path;
    comment_file.comments.retain(|c| c.id != comment_id);

    let json = serde_json::to_string_pretty(&comment_file).map_err(|e| e.to_string())?;
    fs::write(&comment_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn update_comment(
    workspace_path: String,
    file_hash: String,
    file_path: String,
    comment: Comment,
) -> Result<(), String> {
    let file_path = document_file_in_workspace(&workspace_path, &file_path)?;
    let file_path = file_path.to_string_lossy().to_string();
    let comment_path = get_comment_file_path(&file_path)?;

    if !comment_path.exists() {
        return Err("评论文件不存在".to_string());
    }

    let content = fs::read_to_string(&comment_path).map_err(|e| e.to_string())?;
    let mut comment_file: CommentFile =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    comment_file.file_hash = file_hash;
    comment_file.file_path = file_path;
    if let Some(existing) = comment_file
        .comments
        .iter_mut()
        .find(|c| c.id == comment.id)
    {
        *existing = comment;
    } else {
        return Err("评论不存在".to_string());
    }

    let json = serde_json::to_string_pretty(&comment_file).map_err(|e| e.to_string())?;
    fs::write(&comment_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-comments-test-{}-{}",
            std::process::id(),
            nanos
        ))
    }

    fn create_test_file(content: &str) -> (PathBuf, PathBuf) {
        let root = unique_test_root();
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("note.md");
        fs::write(&file_path, content).unwrap();
        (root, file_path)
    }

    fn sample_comment(file_hash: &str) -> Comment {
        Comment {
            id: "comment-1".to_string(),
            file_hash: file_hash.to_string(),
            anchor: CommentAnchor {
                quote: "first".to_string(),
                offset: 0,
                length: 5,
            },
            content: "Review note".to_string(),
            status: "open".to_string(),
            created_at: 10,
            updated_at: 10,
        }
    }

    #[test]
    fn comment_deserializes_from_frontend_camel_case() {
        let json = r#"{
            "id": "comment-1",
            "fileHash": "abc123",
            "anchor": { "quote": "hello", "offset": 0, "length": 5 },
            "content": "Review note",
            "status": "open",
            "createdAt": 10,
            "updatedAt": 20
        }"#;

        let comment: Comment = serde_json::from_str(json).unwrap();
        assert_eq!(comment.file_hash, "abc123");
        assert_eq!(comment.created_at, 10);
        assert_eq!(comment.updated_at, 20);

        let serialized = serde_json::to_value(&comment).unwrap();
        assert!(serialized.get("fileHash").is_some());
        assert!(serialized.get("createdAt").is_some());
        assert!(serialized.get("file_hash").is_none());
    }

    #[test]
    fn comment_deserializes_from_legacy_snake_case() {
        let json = r#"{
            "id": "comment-1",
            "file_hash": "abc123",
            "anchor": { "quote": "hello", "offset": 0, "length": 5 },
            "content": "Review note",
            "status": "open",
            "created_at": 10,
            "updated_at": 20
        }"#;

        let comment: Comment = serde_json::from_str(json).unwrap();
        assert_eq!(comment.file_hash, "abc123");
        assert_eq!(comment.created_at, 10);
        assert_eq!(comment.updated_at, 20);
    }

    #[test]
    fn comments_survive_content_hash_changes_for_same_path() {
        let (root, file_path) = create_test_file("first version");
        let root_path = root.to_string_lossy().to_string();
        let file_path = file_path.to_string_lossy().to_string();
        let first_hash = calculate_file_hash(root_path.clone(), file_path.clone()).unwrap();

        save_comment(
            root_path.clone(),
            first_hash.clone(),
            file_path.clone(),
            sample_comment(&first_hash),
        )
        .unwrap();

        fs::write(&file_path, "second version").unwrap();
        let second_hash = calculate_file_hash(root_path.clone(), file_path.clone()).unwrap();
        assert_ne!(first_hash, second_hash);

        let comments =
            load_comments(root_path.clone(), second_hash.clone(), file_path.clone()).unwrap();
        assert_eq!(comments.len(), 1);
        assert_eq!(comments[0].id, "comment-1");

        let mut updated_comment = comments[0].clone();
        updated_comment.file_hash = second_hash.clone();
        updated_comment.content = "Updated review note".to_string();
        updated_comment.updated_at = 20;

        update_comment(
            root_path.clone(),
            second_hash.clone(),
            file_path.clone(),
            updated_comment,
        )
        .unwrap();
        let updated_comments =
            load_comments(root_path.clone(), second_hash.clone(), file_path.clone()).unwrap();
        assert_eq!(updated_comments[0].content, "Updated review note");

        delete_comment(
            root_path.clone(),
            second_hash.clone(),
            file_path.clone(),
            "comment-1".to_string(),
        )
        .unwrap();
        assert!(load_comments(root_path, second_hash, file_path)
            .unwrap()
            .is_empty());

        fs::remove_dir_all(root).unwrap();
    }
}
