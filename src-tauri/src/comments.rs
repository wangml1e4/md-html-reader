use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
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

fn read_comment_file(
    base_path: &str,
    file_hash: &str,
) -> Result<(PathBuf, Vec<PathBuf>, CommentFile), String> {
    let current_path = get_comment_file_path(base_path)?;
    let file_name = Path::new(base_path).file_name().ok_or("无法获取文件名")?;
    let comments_dir = current_path.parent().ok_or("无法获取评论目录")?;
    let mut sources = Vec::new();

    for entry in fs::read_dir(comments_dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().is_none_or(|extension| extension != "json") {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(error) if path == current_path => return Err(error.to_string()),
            Err(_) => continue,
        };
        let comment_file: CommentFile = match serde_json::from_str(&content) {
            Ok(comment_file) => comment_file,
            Err(error) if path == current_path => return Err(error.to_string()),
            Err(_) => continue,
        };
        if path == current_path || Path::new(&comment_file.file_path).file_name() == Some(file_name)
        {
            sources.push((path, comment_file));
        }
    }

    sources.sort_by_key(|(path, _)| path != &current_path);
    let mut comments: Vec<Comment> = Vec::new();
    let mut old_paths = Vec::new();
    for (path, source) in sources {
        if path != current_path {
            old_paths.push(path);
        }
        for comment in source.comments {
            if let Some(existing) = comments
                .iter_mut()
                .find(|existing| existing.id == comment.id)
            {
                if comment.updated_at > existing.updated_at {
                    *existing = comment;
                }
            } else {
                comments.push(comment);
            }
        }
    }

    Ok((
        current_path,
        old_paths,
        CommentFile {
            file_hash: file_hash.to_string(),
            file_path: base_path.to_string(),
            comments,
            version: "1.0".to_string(),
        },
    ))
}

fn write_comment_file(
    path: &Path,
    old_paths: Vec<PathBuf>,
    comment_file: &CommentFile,
) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(comment_file).map_err(|e| e.to_string())?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let temporary = path.with_extension(format!("{}.{}.tmp", std::process::id(), nanos));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|e| e.to_string())?;
    file.write_all(&json)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(&temporary, path).map_err(|e| e.to_string())?;
    for old_path in old_paths {
        fs::remove_file(old_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub fn load_comments(
    workspace_path: String,
    file_hash: String,
    file_path: String,
) -> Result<Vec<Comment>, String> {
    let file_path = document_file_in_workspace(&workspace_path, &file_path)?;
    let file_path = file_path.to_string_lossy().to_string();
    let (_, _, comment_file) = read_comment_file(&file_path, &file_hash)?;

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
    let (comment_path, old_paths, mut comment_file) = read_comment_file(&file_path, &file_hash)?;

    comment_file.file_hash = file_hash;
    comment_file.file_path = file_path;
    comment_file.comments.push(comment);

    write_comment_file(&comment_path, old_paths, &comment_file)?;

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
    let (comment_path, old_paths, mut comment_file) = read_comment_file(&file_path, &file_hash)?;
    if comment_file.comments.is_empty() {
        return Ok(());
    }

    comment_file.file_hash = file_hash;
    comment_file.file_path = file_path;
    comment_file.comments.retain(|c| c.id != comment_id);

    write_comment_file(&comment_path, old_paths, &comment_file)?;

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
    let (comment_path, old_paths, mut comment_file) = read_comment_file(&file_path, &file_hash)?;
    if comment_file.comments.is_empty() {
        return Err("评论文件不存在".to_string());
    }

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

    write_comment_file(&comment_path, old_paths, &comment_file)?;

    Ok(())
}
