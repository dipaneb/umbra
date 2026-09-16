// The app's main window is created with `visible: false` (tauri.conf.json) and the only thing
// that ever shows it is `main.ts`'s `getCurrentWindow().show()`, once the frontend has mounted
// — there is no Rust-side fallback. That means a startup failure on the Rust side (this file's
// concern) is otherwise completely silent on a release Windows build: `main.rs` sets
// `windows_subsystem = "windows"`, so there is no console to write a panic message to, and
// `tauri_plugin_dialog` (registered in `lib.rs`) needs an `AppHandle` that doesn't exist yet on
// this path — `.run()` returning `Err` means `WebviewWindowBuilder::build()` failed before our
// `.setup()` closure (where the handle would come from) ever ran. `fatal()` is `lib.rs`'s
// replacement for `.run(...).expect(...)`, called only when `.run()` itself returns `Err`.
//
// The most likely real-world cause of that `Err` is a missing/broken WebView2 Runtime — Windows
// 10, unlike 11, doesn't guarantee it's preinstalled, and this app's own NSIS installer only
// carries a bootstrapper (`tauri.conf.json`'s `webviewInstallMode`), not the runtime itself. So
// the message distinguishes that specific, actionable case from a generic failure by checking
// `tauri::webview_version()` — a static call that doesn't need a window or handle either.

#[cfg(target_os = "windows")]
pub fn fatal(error: &tauri::Error) {
    use windows::Win32::UI::WindowsAndMessaging::{MB_ICONERROR, MB_OK, MessageBoxW};
    use windows::core::HSTRING;

    let body = if tauri::webview_version().is_err() {
        "Umbra couldn't start because the Microsoft Edge WebView2 Runtime is missing or broken \
         on this computer.\n\n\
         Install it from https://go.microsoft.com/fwlink/p/?LinkId=2124703, then try opening \
         Umbra again."
            .to_string()
    } else {
        format!("Umbra failed to start:\n\n{error}")
    };

    // SAFETY: `MessageBoxW` is a blocking, self-contained Win32 call — no window handle, no
    // Tauri runtime state, nothing shared with the rest of the process to race with.
    let _ = unsafe {
        MessageBoxW(
            None,
            &HSTRING::from(body),
            &HSTRING::from("Umbra"),
            MB_OK | MB_ICONERROR,
        )
    };
}

// macOS/Linux release builds keep a usable stderr (only Windows release builds hide the
// console), so there's no silent-failure gap here to build dialog machinery for.
#[cfg(not(target_os = "windows"))]
pub fn fatal(error: &tauri::Error) {
    eprintln!("Umbra failed to start: {error}");
}
