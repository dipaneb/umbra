// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// SCRATCH: Story 1.4 Task 7 proof-of-blocking commit — deliberate clippy
// failure gated to windows only, to be discarded before this PR is closed.
#[cfg(target_os = "windows")]
fn windows_only_clippy_trap() {
    let unused_variable = 42;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
