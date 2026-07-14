fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "list_files",
            "read_file",
            "write_file",
            "calculate_file_hash",
            "load_comments",
            "save_comment",
            "delete_comment",
            "update_comment",
            "search_files",
            "search_content",
            "export_as_html",
            "translate_text",
            "translate_markdown_to_chinese",
            "open_html_in_default_browser",
        ]),
    ))
    .expect("failed to build Tauri application")
}
