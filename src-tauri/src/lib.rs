// `pub` (not `mod`): Story 4.3's `tests/ocr_engine_race.rs` integration test needs
// `commands::ocr::ocr_engine` reachable from outside this crate — an integration-test binary
// links against this crate's ordinarily-compiled rlib, so a private `mod` here would be
// unreachable to it regardless of visibility inside `commands/ocr.rs` itself.
mod clipboard_watch;
pub mod commands;
mod fs_helper;
// AC44: the render backends live here. `render/mod.rs` and `startup_error.rs` (the fatal
// startup-error dialog — see its own doc comment) are the only `cfg(target_os)` switches in
// this crate's runtime source. (`build.rs` has carried one since Story 4.1 for the Windows
// resource embed — a build script, not shipped code.) Nothing else branches on OS.
mod render;
mod startup_error;

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
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
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

            // The main window is created with `visible: false` (tauri.conf.json) and the only
            // thing that ever shows it is `main.ts`'s `getCurrentWindow().show()`, once the
            // frontend has mounted — there is no other fallback. If that never happens (e.g. a
            // hung `invoke` in `settings.init()`'s restore path), the window stays invisible
            // forever with no indication anything is wrong: exactly the "hourglass, then
            // nothing" failure this watchdog exists to rule out. Ten seconds is generous enough
            // to clear a cold WebView2 start on slow/old hardware without being a real user-
            // visible delay when nothing is actually wrong (the frontend has almost always
            // already called `show()` well before this fires).
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(10));
                let Some(window) = handle.get_webview_window("main") else {
                    return;
                };
                if window.is_visible().unwrap_or(true) {
                    return;
                }
                let _ = window.show();
            });

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
        ]);

    // Not `.expect(...)`: on a release Windows build there is no console
    // (`windows_subsystem = "windows"` in `main.rs`), so a panic message here is silently
    // discarded and the user sees nothing at all — the same "hourglass, then nothing" failure
    // as an invisible window, just one step earlier. `startup_error::fatal` is what actually
    // gets a message in front of the user; see its doc comment for why `Err` here specifically
    // means window/webview creation itself failed (e.g. WebView2 missing), before `.setup()`
    // — and therefore the clipboard watcher and show-watchdog above — ever ran.
    if let Err(error) = builder.run(tauri::generate_context!()) {
        startup_error::fatal(&error);
        std::process::exit(1);
    }
}
