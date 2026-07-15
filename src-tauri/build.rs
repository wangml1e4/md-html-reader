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
            "test_openai_compatible_connection",
            "fetch_openai_compatible_models",
            "translate_markdown_to_chinese",
            "generate_ai_reading_html",
            "suggest_document_improvements",
            "optimize_document_with_comments",
            "open_html_in_default_browser",
        ]),
    ))
    .expect("failed to build Tauri application")
}
