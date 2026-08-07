use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::Runtime;
use tauri::ipc::{InvokeBody, Request};
#[cfg(not(any(test, feature = "test-support")))]
use tauri::{Manager, path::BaseDirectory};
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

// Where the bundled OCR models live, split by build config rather than by a fifth
// platform-conditional test hack (previously `ensure_bundled_models_are_discoverable`, which
// hand-copied files into wherever `resource_dir()` resolved — and on Linux that resolves to
// `/usr/lib/{app_name}`, unwritable outside a real install, which is what made every bucket
// test fail there with `EACCES`; confirmed against `tauri-utils`'s own
// `platform::resource_dir_from`). Production always resolves through Tauri's real bundle
// resource lookup; tests always read straight from this crate's own `resources/models/`,
// the exact directory `tauri.conf.json`'s `bundle.resources` ships and the same one
// `umbra-core`'s own OCR tests already use directly — so both suites agree on where the
// bundled models live, on every OS, with no per-platform special-casing.
#[cfg(not(any(test, feature = "test-support")))]
fn models_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, ToolError> {
    app.path()
        .resolve("resources/models", BaseDirectory::Resource)
        .map_err(|err| ToolError {
            code: "bucket-engine-init-failed".to_string(),
            message: format!("failed to resolve bundled models resource directory: {err}"),
            position: None,
            context: None,
        })
}

// `test-support`, not just `test`: this must also activate for `tests/ocr_engine_race.rs`, an
// integration-test binary linking against this crate's ordinarily-compiled rlib — `cfg(test)`
// never applies there (see Cargo.toml's `test-support` feature comment).
#[cfg(any(test, feature = "test-support"))]
fn models_dir<R: Runtime>(_app: &tauri::AppHandle<R>) -> Result<PathBuf, ToolError> {
    Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/models"))
}

fn resolve_model_path<R: Runtime>(
    app: &tauri::AppHandle<R>,
    file: &str,
) -> Result<PathBuf, ToolError> {
    Ok(models_dir(app)?.join(file))
}

// AC3/AD-16, `tests/ocr_engine_race.rs`: counts real invocations of the closure below, i.e. how
// many times engine construction actually ran — `OnceLock` alone guarantees exactly-once but
// doesn't expose a way to observe that from outside, which is what a race test needs to assert.
// Feature-gated, never compiled into a real build.
#[cfg(any(test, feature = "test-support"))]
pub static OCR_ENGINE_INIT_CALLS: std::sync::atomic::AtomicU32 =
    std::sync::atomic::AtomicU32::new(0);

// `pub`: reachable from `tests/ocr_engine_race.rs` (an integration-test binary, external to this
// crate) as well as this module's own unit tests below.
pub fn ocr_engine<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> &'static Result<OarOcrEngine, ToolError> {
    OCR_ENGINE.get_or_init(|| {
        #[cfg(any(test, feature = "test-support"))]
        OCR_ENGINE_INIT_CALLS.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

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

// AD-15: the sanctioned raw-IPC-body exception for clipboard-pasted image bytes — width/height
// travel alongside the raw RGBA body as custom request headers (verified against the installed
// `tauri` 2.11.5 source: `tauri::ipc::Request::headers()` is a plain `http::HeaderMap`).
const IMAGE_WIDTH_HEADER: &str = "x-image-width";
const IMAGE_HEIGHT_HEADER: &str = "x-image-height";

fn malformed_request_error(message: impl std::fmt::Display) -> ToolError {
    ToolError {
        code: "bucket-malformed-request".to_string(),
        message: message.to_string(),
        position: None,
        context: None,
    }
}

fn parse_dimension_header(request: &Request<'_>, name: &str) -> Result<u32, ToolError> {
    request
        .headers()
        .get(name)
        .ok_or_else(|| malformed_request_error(format!("missing required \"{name}\" header")))?
        .to_str()
        .map_err(|_| malformed_request_error(format!("\"{name}\" header is not valid UTF-8")))?
        .parse::<u32>()
        .map_err(|_| malformed_request_error(format!("\"{name}\" header is not a valid u32")))
}

// Extracted synchronously, outside any `async` block: `Request<'_>` borrows from the live IPC
// invocation and cannot be part of a `Send + 'static` future (the type Tauri's async responder
// requires) — see `bucket_extract_text_from_clipboard`'s own doc comment for why the command
// isn't a plain `async fn`. Returning only owned data here is what keeps the future below free
// of that borrow.
fn extract_clipboard_request(request: &Request<'_>) -> Result<(Vec<u8>, u32, u32), ToolError> {
    let rgba = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        InvokeBody::Json(_) => {
            return Err(malformed_request_error(
                "expected a raw-bytes IPC body, got JSON",
            ));
        }
    };
    // Enforced against the buffer already in memory, not via a filesystem `metadata()` call like
    // `check_file_size` below — the raw RGBA bytes are already resident as the IPC request body
    // by the time this command runs, unlike the file-path command's on-disk input. Reusing
    // MAX_INPUT_BYTES as-is is a deliberate choice, not an oversight: uncompressed RGBA is far
    // denser than a compressed file of the same byte count (100MB of raw RGBA tops out around 25
    // megapixels), but that's a reasonable default for FR24's "typical screenshot" scope.
    if rgba.len() > MAX_INPUT_BYTES {
        return Err(ToolError {
            code: "bucket-input-too-large".to_string(),
            message: format!(
                "clipboard image is {} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit",
                rgba.len()
            ),
            position: None,
            context: None,
        });
    }
    let width = parse_dimension_header(request, IMAGE_WIDTH_HEADER)?;
    let height = parse_dimension_header(request, IMAGE_HEIGHT_HEADER)?;
    Ok((rgba.clone(), width, height))
}

// AD-3/AD-15: `<tool>_<verb>_<qualifier>` naming, matching `hash_compute_file`'s `_file`
// qualifier precedent. This is the first command in the codebase taking `tauri::ipc::Request`
// (AD-15's raw-body exception), which forces a shape different from every other async command
// here (including this file's own `bucket_extract_text`): `Request<'_>` borrows from the live
// invocation, so an `async fn` taking it directly would produce a future whose opaque type
// captures that borrow — Tauri's async responder (`respond_async_serialized`) requires
// `Send + 'static`, so that future can never satisfy it, regardless of whether the body actually
// holds the reference across an `.await` (confirmed against the installed `tauri` 2.11.5 macro
// and `ipc::InvokeResolver::respond_async_serialized` source — this is the documented limitation
// behind tauri-apps/tauri#2533). The fix: a plain (non-`async`) fn — `#[tauri::command(async)]`
// opts it into the async response path without requiring `async fn` syntax — that extracts owned
// data from `request` synchronously first, then returns an `impl Future` built only from that
// owned data, so the future's type never mentions `request`'s lifetime at all.
#[tauri::command(async)]
pub fn bucket_extract_text_from_clipboard<R: Runtime>(
    request: Request<'_>,
    app: tauri::AppHandle<R>,
) -> impl std::future::Future<Output = Result<OcrOutcome, ToolError>> + Send + 'static {
    let extraction = extract_clipboard_request(&request);
    async move {
        let (rgba, width, height) = extraction?;
        // AD-4, same as `bucket_extract_text`: OCR inference is CPU-bound and must not run on
        // whatever thread is handling IPC dispatch.
        tauri::async_runtime::spawn_blocking(move || match ocr_engine(&app) {
            Ok(engine) => engine.extract_text_from_rgba(&rgba, width, height),
            Err(err) => Err(err.clone()),
        })
        .await
        .map_err(map_join_error)?
    }
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

        let path = temp_file_path("not-an-image.txt");
        std::fs::write(&path, "just some text, not an image").unwrap();

        let err = bucket_extract_text(path.clone(), app).await.unwrap_err();
        assert_eq!(err.code, "bucket-unsupported-format");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_text_command_returns_tool_error_not_a_panic_for_a_corrupt_truncated_file()
     {
        let app = mock_app_handle();

        let path = temp_file_path("corrupt-truncated.png");
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../crates/umbra-core/tests/fixtures/hello-umbra.png");
        let bytes = std::fs::read(&fixture).unwrap();
        std::fs::write(&path, &bytes[..bytes.len() / 2]).unwrap();

        let err = bucket_extract_text(path.clone(), app).await.unwrap_err();
        assert_eq!(err.code, "bucket-unsupported-format");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_text_command_returns_file_read_error_for_missing_path() {
        let app = mock_app_handle();

        let err = bucket_extract_text("/nonexistent/path/umbra-test".to_string(), app)
            .await
            .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    // AC3/AD-16: proves `OnceLock::get_or_init`'s exactly-once-under-race guarantee — the same
    // mechanism `ocr_engine()` above relies on — holds under a real concurrent race. Deliberately
    // does NOT race the shared production `OCR_ENGINE` static: `cargo test` runs this crate's
    // tests in parallel within one process (no `test-threads=1`/serial config anywhere in this
    // repo), and every other test in this file already calls `ocr_engine(&app)`, so by the time
    // this test runs `OCR_ENGINE` is almost certainly already initialized by another test —
    // racing it directly couldn't reliably exercise the actual not-yet-initialized window. A
    // fresh, test-local `OnceLock` + `Barrier` reproduces the exact same pattern in isolation,
    // deterministically, independent of test execution order or real model-load time. The
    // sibling `tests/ocr_engine_race.rs` integration test (its own fresh process, so
    // `OCR_ENGINE` really is uninitialized there) covers the complementary claim this test
    // can't: that `ocr_engine()` itself, not just the stdlib primitive it's built on, only ever
    // constructs the engine once.
    #[test]
    fn oncelock_get_or_init_runs_exactly_once_under_a_real_thread_race() {
        static TEST_INIT_CALLS: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
        static TEST_LOCK: OnceLock<u32> = OnceLock::new();

        const THREAD_COUNT: usize = 8;
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(THREAD_COUNT));

        let handles: Vec<_> = (0..THREAD_COUNT)
            .map(|_| {
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    TEST_LOCK.get_or_init(|| {
                        TEST_INIT_CALLS.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        42
                    });
                })
            })
            .collect();

        for handle in handles {
            handle.join().unwrap();
        }

        assert_eq!(TEST_INIT_CALLS.load(std::sync::atomic::Ordering::SeqCst), 1);
    }

    // `bucket_extract_text_from_clipboard` takes `tauri::ipc::Request`, which — unlike this
    // file's other commands' plain typed params — has no public constructor outside a real IPC
    // invocation (confirmed against the installed `tauri` 2.11.5 source: `Request`'s fields are
    // private, only built via `CommandArg::from_command`). So it can't be called directly with a
    // mock `AppHandle` the way every other command in this file is tested. This is the first
    // command in the codebase needing the full `tauri::test::get_ipc_response` IPC round trip.
    // That normally collides with `generate_context!()` (only callable once per crate, and
    // `lib.rs` already calls it for the real app — the exact reason `bucket_extract_text`'s own
    // tests above avoid it) — but `mock_context(noop_assets())` sidesteps that collision
    // entirely, since it builds a `Context` by hand instead of invoking the macro.
    mod clipboard_command {
        use super::*;
        use tauri::WebviewWindowBuilder;
        use tauri::http::{HeaderMap, HeaderValue};
        use tauri::ipc::{CallbackFn, InvokeBody};
        use tauri::test::{INVOKE_KEY, get_ipc_response};
        use tauri::webview::InvokeRequest;

        fn rgba_headers(width: u32, height: u32) -> HeaderMap {
            let mut headers = HeaderMap::new();
            headers.insert(
                IMAGE_WIDTH_HEADER,
                HeaderValue::from_str(&width.to_string()).unwrap(),
            );
            headers.insert(
                IMAGE_HEIGHT_HEADER,
                HeaderValue::from_str(&height.to_string()).unwrap(),
            );
            headers
        }

        fn clipboard_request(body: InvokeBody, headers: HeaderMap) -> InvokeRequest {
            InvokeRequest {
                cmd: "bucket_extract_text_from_clipboard".to_string(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: if cfg!(any(windows, target_os = "android")) {
                    "http://tauri.localhost"
                } else {
                    "tauri://localhost"
                }
                .parse()
                .unwrap(),
                body,
                headers,
                invoke_key: INVOKE_KEY.to_string(),
            }
        }

        fn fixture_rgba() -> (Vec<u8>, u32, u32) {
            let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../crates/umbra-core/tests/fixtures/hello-umbra.png");
            let bytes = std::fs::read(fixture).unwrap();
            let decoded = image::load_from_memory(&bytes).unwrap().into_rgba8();
            let (width, height) = decoded.dimensions();
            (decoded.into_raw(), width, height)
        }

        fn mock_app() -> tauri::App<tauri::test::MockRuntime> {
            mock_builder()
                .invoke_handler(tauri::generate_handler![bucket_extract_text_from_clipboard])
                .build(mock_context(noop_assets()))
                .expect("failed to build mock app")
        }

        #[test]
        fn round_trips_a_real_fixture_images_raw_rgba_bytes_end_to_end() {
            let app = mock_app();
            let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
                .build()
                .unwrap();

            let (rgba, width, height) = fixture_rgba();
            let response = get_ipc_response(
                &webview,
                clipboard_request(InvokeBody::Raw(rgba), rgba_headers(width, height)),
            )
            .expect("command should succeed");

            let outcome: OcrOutcome = response.deserialize().unwrap();
            assert!(
                outcome.text.to_uppercase().contains("UMBRA"),
                "expected extracted text to contain \"UMBRA\", got: {:?}",
                outcome.text
            );
        }

        #[test]
        fn rejects_an_oversized_rgba_buffer() {
            let app = mock_app();
            let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
                .build()
                .unwrap();

            let oversized = vec![0u8; MAX_INPUT_BYTES + 4];
            let response = get_ipc_response(
                &webview,
                clipboard_request(InvokeBody::Raw(oversized), rgba_headers(1, 1)),
            )
            .expect_err("command should reject an oversized buffer");

            let err: ToolError = serde_json::from_value(response).unwrap();
            assert_eq!(err.code, "bucket-input-too-large");
        }

        #[test]
        fn rejects_a_malformed_rgba_buffer_length() {
            let app = mock_app();
            let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
                .build()
                .unwrap();

            // 3 bytes can never be a valid 10x10x4 RGBA buffer.
            let response = get_ipc_response(
                &webview,
                clipboard_request(InvokeBody::Raw(vec![0, 0, 0]), rgba_headers(10, 10)),
            )
            .expect_err("command should reject a malformed buffer");

            let err: ToolError = serde_json::from_value(response).unwrap();
            assert_eq!(err.code, "bucket-malformed-image-buffer");
        }

        #[test]
        fn rejects_a_request_missing_the_dimension_headers() {
            let app = mock_app();
            let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
                .build()
                .unwrap();

            let response = get_ipc_response(
                &webview,
                clipboard_request(InvokeBody::Raw(vec![0, 0, 0, 0]), HeaderMap::new()),
            )
            .expect_err("command should reject a request with no dimension headers");

            let err: ToolError = serde_json::from_value(response).unwrap();
            assert_eq!(err.code, "bucket-malformed-request");
        }
    }
}
