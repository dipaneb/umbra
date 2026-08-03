mod commands;
mod fs_helper;

use commands::base64::{base64_decode, base64_decode_to_file, base64_encode, base64_encode_file};
use commands::cron::{cron_explain, cron_parse_schedule};
use commands::hash::{hash_compute, hash_compute_file};
use commands::json::{json_format, json_minify, json_parse};
use commands::jwt::jwt_decode;
use commands::uuid::uuid_generate;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            json_format,
            json_minify,
            json_parse,
            base64_encode,
            base64_decode,
            base64_encode_file,
            base64_decode_to_file,
            uuid_generate,
            hash_compute,
            hash_compute_file,
            jwt_decode,
            cron_explain,
            cron_parse_schedule
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
