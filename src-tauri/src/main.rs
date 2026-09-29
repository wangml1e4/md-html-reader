// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_config;
mod browser_preview;
mod comments;
mod export;
mod fs_handler;
mod html_preview_protocol;
mod mcp;
mod path_guard;
mod search;
mod translation;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "--mcp") {
        if let Err(error) = mcp::run(&args) {
            eprintln!("{}", error);
            std::process::exit(1);
        }
        return;
    }
    let builder = tauri::Builder::default()
        .manage(html_preview_protocol::PreviewProtocolRoots::default())
        .register_uri_scheme_protocol("preview", |context, request| {
            html_preview_protocol::handle(context.app_handle(), request)
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());

    builder
        .invoke_handler(tauri::generate_handler![
            app_config::load_openai_api_key,
            app_config::save_openai_api_key,
            mcp::mcp_configuration,
            fs_handler::list_files,
            fs_handler::read_file,
            fs_handler::write_file_checked,
            fs_handler::create_markdown_file,
            fs_handler::delete_markdown_file,
            comments::calculate_file_hash,
            comments::load_comments,
            comments::save_comment,
            comments::delete_comment,
            comments::update_comment,
            search::search_files,
            search::search_content,
            export::export_rendered_html,
            export::read_export_resource,
            translation::translate_text,
            translation::test_openai_compatible_connection,
            translation::fetch_openai_compatible_models,
            translation::translate_markdown_to_chinese,
            translation::generate_ai_reading_html,
            translation::suggest_document_improvements,
            translation::optimize_document_with_comments,
            browser_preview::open_html_in_default_browser,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
