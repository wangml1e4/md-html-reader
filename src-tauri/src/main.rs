// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod browser_preview;
mod comments;
mod fs_handler;
mod path_guard;
mod search;
mod translation;

fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());

    builder
        .invoke_handler(tauri::generate_handler![
            fs_handler::list_files,
            fs_handler::read_file,
            fs_handler::write_file,
            comments::calculate_file_hash,
            comments::load_comments,
            comments::save_comment,
            comments::delete_comment,
            comments::update_comment,
            search::search_files,
            search::search_content,
            search::export_as_html,
            translation::translate_text,
            browser_preview::open_html_in_default_browser,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod e2e_tests {
    use super::{comments, fs_handler, search};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "md-html-reader-e2e-test-{}-{}",
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn core_file_comment_search_export_path_works() {
        let root = unique_test_root();
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("note.md");
        fs::write(&file_path, "# Note\n\nOriginal keyword").unwrap();

        let root = root.to_string_lossy().to_string();
        let file_path = file_path.to_string_lossy().to_string();

        let files = fs_handler::list_files(root.clone()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "note.md");

        let content = fs_handler::read_file(root.clone(), file_path.clone()).unwrap();
        assert!(content.contains("Original keyword"));

        let first_hash = comments::calculate_file_hash(root.clone(), file_path.clone()).unwrap();
        comments::save_comment(
            root.clone(),
            first_hash.clone(),
            file_path.clone(),
            comments::Comment {
                id: "comment-1".to_string(),
                file_hash: first_hash.clone(),
                anchor: comments::CommentAnchor {
                    quote: "Original keyword".to_string(),
                    offset: 8,
                    length: 16,
                },
                content: "Review note".to_string(),
                status: "open".to_string(),
                created_at: 10,
                updated_at: 10,
            },
        )
        .unwrap();

        fs_handler::write_file(
            root.clone(),
            file_path.clone(),
            "# Note\n\nEdited keyword".to_string(),
        )
        .unwrap();
        let second_hash = comments::calculate_file_hash(root.clone(), file_path.clone()).unwrap();
        assert_ne!(first_hash, second_hash);

        let loaded_comments =
            comments::load_comments(root.clone(), second_hash.clone(), file_path.clone()).unwrap();
        assert_eq!(loaded_comments.len(), 1);
        assert_eq!(loaded_comments[0].id, "comment-1");

        let file_results = search::search_files(root.clone(), "note".to_string()).unwrap();
        assert_eq!(file_results.len(), 1);
        assert_eq!(file_results[0].name, "note.md");

        let content_results =
            search::search_content(root.clone(), "keyword".to_string(), Some(10)).unwrap();
        assert_eq!(content_results.len(), 1);
        assert_eq!(content_results[0].file_name, "note.md");
        assert!(content_results[0].line_content.contains("Edited keyword"));

        let output_path = PathBuf::from(&root).join("note.html");
        let output_path = output_path.to_string_lossy().to_string();
        search::export_as_html(root.clone(), file_path, output_path.clone(), None).unwrap();
        let exported = fs::read_to_string(output_path).unwrap();
        assert!(exported.contains("Edited keyword"));

        fs::remove_dir_all(root).unwrap();
    }
}
