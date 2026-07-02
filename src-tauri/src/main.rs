// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fs_handler;
mod comments;
mod search;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
