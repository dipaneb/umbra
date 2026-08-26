// `pub` (not `mod`): Story 4.3's `tests/ocr_engine_race.rs` integration test needs
// `commands::bucket::ocr_engine` reachable from outside this crate — an integration-test binary
// links against this crate's ordinarily-compiled rlib, so a private `mod` here would be
// unreachable to it regardless of visibility inside `commands/bucket.rs` itself.
mod clipboard_watch;
pub mod commands;
mod fs_helper;

use commands::base64::{base64_decode, base64_decode_to_file, base64_encode, base64_encode_file};
use commands::bucket::{bucket_extract_text, bucket_extract_text_from_clipboard};
use commands::cron::{cron_explain, cron_parse_schedule};
use commands::hash::{hash_compute, hash_compute_file};
use commands::image::{bucket_convert_image, bucket_estimate_image_size};
use commands::json::{
    json_diff, json_format, json_minify, json_parse, json_query, json_repair, json_transform,
};
use commands::jwt::jwt_decode;
use commands::pdf::{bucket_extract_pdf_pages, bucket_extract_pdf_text, bucket_merge_pdfs};
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // AC1/AC13: starts once, off the main thread — mirrors `attachThemeListener`'s
        // pre-paint-but-decoupled pattern in `main.ts` (Story 7.2), except this watcher lives
        // in Rust, not JS, so it doesn't touch `main.ts` at all.
        .setup(|app| {
            clipboard_watch::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            json_format,
            json_minify,
            json_parse,
            json_repair,
            json_query,
            json_diff,
            json_transform,
            base64_encode,
            base64_decode,
            base64_encode_file,
            base64_decode_to_file,
            uuid_generate,
            hash_compute,
            hash_compute_file,
            bucket_extract_text,
            bucket_extract_text_from_clipboard,
            jwt_decode,
            cron_explain,
            cron_parse_schedule,
            bucket_merge_pdfs,
            bucket_extract_pdf_pages,
            bucket_extract_pdf_text,
            bucket_convert_image,
            bucket_estimate_image_size
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
