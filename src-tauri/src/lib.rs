// `pub` (not `mod`): Story 4.3's `tests/ocr_engine_race.rs` integration test needs
// `commands::ocr::ocr_engine` reachable from outside this crate — an integration-test binary
// links against this crate's ordinarily-compiled rlib, so a private `mod` here would be
// unreachable to it regardless of visibility inside `commands/ocr.rs` itself.
mod clipboard_watch;
pub mod commands;
mod fs_helper;
// AC44: the render backends live here, and `render/mod.rs` holds the only `cfg(target_os)`
// switch in this crate's runtime source. (`build.rs` has carried one since Story 4.1 for the
// Windows resource embed — a build script, not shipped code.) Nothing else branches on OS.
mod render;

use commands::base64::{
    base64_decode, base64_decode_to_file, base64_encode, base64_ingest_file, base64_parse_data_uri,
    base64_sniff,
};
use commands::cron::cron_explain;
use commands::hash::{hash_compute, hash_compute_file};
use commands::image::{image_convert, image_estimate_size, image_ingest_dropped};
use commands::json::{
    json_diff, json_format, json_minify, json_parse, json_query, json_repair, json_transform,
};
use commands::jwt::jwt_decode;
use commands::ocr::{ocr_extract_text, ocr_extract_text_from_clipboard, ocr_grant_asset};
use commands::pdf::{
    pdf_begin_edit, pdf_delete_pages, pdf_extract_pages, pdf_extract_text, pdf_merge, pdf_open,
    pdf_open_dropped, pdf_page_text, pdf_render_pages, pdf_reorder_pages, pdf_rotate_pages,
    pdf_save_copy,
};
use commands::uuid::{uuid_export, uuid_generate};

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
            base64_sniff,
            base64_parse_data_uri,
            base64_ingest_file,
            base64_decode_to_file,
            uuid_generate,
            uuid_export,
            hash_compute,
            hash_compute_file,
            ocr_extract_text,
            ocr_extract_text_from_clipboard,
            ocr_grant_asset,
            jwt_decode,
            cron_explain,
            pdf_merge,
            pdf_extract_pages,
            pdf_extract_text,
            pdf_open,
            pdf_open_dropped,
            pdf_page_text,
            pdf_render_pages,
            pdf_begin_edit,
            pdf_save_copy,
            pdf_delete_pages,
            pdf_rotate_pages,
            pdf_reorder_pages,
            image_convert,
            image_estimate_size,
            image_ingest_dropped
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
