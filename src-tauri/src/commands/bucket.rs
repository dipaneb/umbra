use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::{Manager, Runtime, path::BaseDirectory};
use umbra_core::ToolError;
use umbra_core::ocr::{MAX_INPUT_BYTES, OarOcrEngine, OcrEngine, OcrOutcome};

// AD-4/AD-16: the OCR engine must not construct at launch, only lazily on first use, and only
// once for the process lifetime (v1 scope: no progress events, no cancellation, no retry after
// a failed init — a failed init almost certainly means a packaging defect, not a transient
// condition). `OnceLock`, not `std::cell::OnceCell`: this is read from multiple concurrent async
// command invocations on different blocking-thread-pool threads, so it needs a `Sync` primitive.
// `get_or_try_init` (which would let the init closure return a `Result` directly) is still
// unstable (`once_cell_try`) — caching a `Result` inside a plain `OnceLock` is the stable
// equivalent.
static OCR_ENGINE: OnceLock<Result<OarOcrEngine, ToolError>> = OnceLock::new();

fn resolve_model_path<R: Runtime>(
    app: &tauri::AppHandle<R>,
    file: &str,
) -> Result<PathBuf, ToolError> {
    app.path()
        .resolve(format!("resources/models/{file}"), BaseDirectory::Resource)
        .map_err(|err| ToolError {
            code: "bucket-engine-init-failed".to_string(),
            message: format!("failed to resolve bundled model resource {file}: {err}"),
            position: None,
            context: None,
        })
}

fn ocr_engine<R: Runtime>(app: &tauri::AppHandle<R>) -> &'static Result<OarOcrEngine, ToolError> {
    OCR_ENGINE.get_or_init(|| {
        let text_detection_model_path = resolve_model_path(app, "text_detection.onnx")?;
        let text_recognition_model_path = resolve_model_path(app, "text_recognition.onnx")?;
        let character_dict_path = resolve_model_path(app, "character_dict.txt")?;
        OarOcrEngine::new(
            text_detection_model_path,
            text_recognition_model_path,
            character_dict_path,
        )
    })
}

// Generic over `R: Runtime` (not the bare `tauri::AppHandle` alias, which resolves to the
// concrete `AppHandle<Wry>`) — this is Tauri's own documented pattern for a command to remain
// testable against `MockRuntime` via `tauri::test`'s mock IPC round trip, confirmed directly
// against `tauri-docs`. Wry is still what the real app actually builds and runs with; nothing
// about production behavior changes.
#[tauri::command]
pub async fn bucket_extract_text<R: Runtime>(
    path: String,
    app: tauri::AppHandle<R>,
) -> Result<OcrOutcome, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        // Checked via metadata, before the file is read, so an oversized file is rejected
        // without ever being materialized in memory (same ordering as hash.rs's own
        // check_file_size).
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        match ocr_engine(&app) {
            Ok(engine) => engine.extract_text(&bytes),
            Err(err) => Err(err.clone()),
        }
    })
    .await
    .map_err(map_join_error)?
}

fn check_file_size(path: &str) -> Result<(), ToolError> {
    let len = std::fs::metadata(path)
        .map_err(|err| ToolError {
            code: "file-read-error".to_string(),
            message: format!("{path}: {err}"),
            position: None,
            context: None,
        })?
        .len();
    if len > MAX_INPUT_BYTES as u64 {
        return Err(ToolError {
            code: "bucket-input-too-large".to_string(),
            message: format!("file is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit"),
            position: None,
            context: None,
        });
    }
    Ok(())
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "bucket-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::Manager;
    use tauri::test::{mock_builder, mock_context, noop_assets};

    // This is the first command in the codebase needing a real `AppHandle`, so its tests are
    // the first that can't call the command directly the way hash.rs's/base64.rs's own tests
    // do. Making `bucket_extract_text` generic over `R: Runtime` (Tauri's own documented
    // pattern for testable commands — the bare `tauri::AppHandle` alias resolves to the
    // concrete `AppHandle<Wry>`, which doesn't implement the traits `MockRuntime` needs) means
    // it can still be called directly with a mock `AppHandle`, exactly like every other
    // command's own tests — no IPC/ACL round trip needed. (An earlier version of this test
    // routed through `tauri::test::get_ipc_response` for full IPC-layer fidelity, but that
    // requires a real `Context` with capabilities loaded — `tauri::generate_context!()`, the
    // macro that provides one, embeds crate-level symbols and can only be invoked once per
    // crate; `lib.rs` already calls it for the real app, so calling it again here collides.
    // Calling the command directly sidesteps that entirely and matches this codebase's
    // established test pattern anyway.)
    fn mock_app_handle() -> tauri::AppHandle<tauri::test::MockRuntime> {
        mock_builder()
            .build(mock_context(noop_assets()))
            .expect("failed to build mock app")
            .handle()
            .clone()
    }

    // `resource_dir()` resolves relative to the *running test binary's* own location, not
    // `src-tauri/target/debug/umbra` (verified empirically: the dev-mode "cargo output
    // directory" fast path in `tauri-utils`'s `platform::resource_dir` looks for a
    // `.cargo-lock` file next to the executable, which exists at `target/debug/.cargo-lock`
    // but not at `target/debug/deps/`, where test binaries actually run from — so on macOS it
    // falls through to the non-dev branch, `exe_dir.join("../Resources").canonicalize()`,
    // confirmed by reading `tauri-utils`'s own `platform::resource_dir_from` directly. That
    // `canonicalize()` call errors if the directory doesn't exist yet — a chicken-and-egg
    // resolved by pre-creating the same `../Resources` guess by hand before asking the real API
    // to resolve it. Windows always returns `exe_dir` unconditionally (no existence check) and
    // Linux's own fallback returns a plain path even when nothing exists there yet, so neither
    // needs this pre-step — confirmed against the same source, not assumed.
    fn ensure_bundled_models_are_discoverable(app: &tauri::AppHandle<tauri::test::MockRuntime>) {
        #[cfg(target_os = "macos")]
        {
            let exe_dir = std::env::current_exe()
                .unwrap()
                .parent()
                .unwrap()
                .to_path_buf();
            std::fs::create_dir_all(exe_dir.join("../Resources")).unwrap();
        }

        let resource_dir = app
            .path()
            .resource_dir()
            .expect("resource_dir should resolve");
        let dest = resource_dir.join("resources/models");
        std::fs::create_dir_all(&dest).unwrap();
        let src = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/models");
        for file in [
            "text_detection.onnx",
            "text_recognition.onnx",
            "character_dict.txt",
        ] {
            if !dest.join(file).exists() {
                std::fs::copy(src.join(file), dest.join(file)).unwrap();
            }
        }
    }

    fn temp_file_path(name: &str) -> String {
        std::env::temp_dir()
            .join(format!("umbra-bucket-cmd-{}-{name}", std::process::id()))
            .to_str()
            .unwrap()
            .to_string()
    }

    #[tokio::test]
    async fn bucket_extract_text_command_reads_a_real_fixture_image_end_to_end() {
        let app = mock_app_handle();
        ensure_bundled_models_are_discoverable(&app);

        let path = temp_file_path("hello-umbra.png");
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../crates/umbra-core/tests/fixtures/hello-umbra.png");
        std::fs::copy(&fixture, &path).unwrap();

        let outcome = bucket_extract_text(path.clone(), app).await.unwrap();
        assert!(
            outcome.text.to_uppercase().contains("UMBRA"),
            "expected extracted text to contain \"UMBRA\", got: {:?}",
            outcome.text
        );

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_text_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let app = mock_app_handle();
        ensure_bundled_models_are_discoverable(&app);

        let path = temp_file_path("oversized.bin");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        let err = bucket_extract_text(path.clone(), app).await.unwrap_err();
        assert_eq!(err.code, "bucket-input-too-large");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_text_command_rejects_a_non_image_file() {
        let app = mock_app_handle();
        ensure_bundled_models_are_discoverable(&app);

        let path = temp_file_path("not-an-image.txt");
        std::fs::write(&path, "just some text, not an image").unwrap();

        let err = bucket_extract_text(path.clone(), app).await.unwrap_err();
        assert_eq!(err.code, "bucket-unsupported-format");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_text_command_returns_file_read_error_for_missing_path() {
        let app = mock_app_handle();
        ensure_bundled_models_are_discoverable(&app);

        let err = bucket_extract_text("/nonexistent/path/umbra-test".to_string(), app)
            .await
            .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }
}
