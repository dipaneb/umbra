use std::sync::Arc;
use std::sync::Barrier;
use std::sync::atomic::Ordering;

use tauri::test::{mock_builder, mock_context, noop_assets};
use umbra_lib::commands::bucket::{OCR_ENGINE_INIT_CALLS, ocr_engine};

fn mock_app_handle() -> tauri::AppHandle<tauri::test::MockRuntime> {
    mock_builder()
        .build(mock_context(noop_assets()))
        .expect("failed to build mock app")
        .handle()
        .clone()
}

// AC3/AD-16: proves the real `OCR_ENGINE` static's exactly-once-under-race guarantee holds for
// this codebase's actual `ocr_engine()` code path, not just for `std::sync::OnceLock` in the
// abstract (that narrower claim is what `bucket.rs`'s own unit test proves — see its comment for
// why it deliberately avoids racing the shared `OCR_ENGINE` static: `cargo test`'s default
// parallelism means other unit tests in that same process almost certainly initialize it first).
// This file is a separate integration-test binary — Cargo gives every `tests/*.rs` file its own
// process — so `OCR_ENGINE` here is guaranteed genuinely uninitialized when the race starts.
#[test]
fn ocr_engine_initializes_exactly_once_under_a_real_thread_race() {
    let app = mock_app_handle();

    const THREAD_COUNT: usize = 8;
    let barrier = Arc::new(Barrier::new(THREAD_COUNT));

    let handles: Vec<_> = (0..THREAD_COUNT)
        .map(|_| {
            let barrier = Arc::clone(&barrier);
            let app = app.clone();
            std::thread::spawn(move || {
                barrier.wait();
                let _ = ocr_engine(&app);
            })
        })
        .collect();

    for handle in handles {
        handle.join().expect("racing thread panicked");
    }

    assert_eq!(
        OCR_ENGINE_INIT_CALLS.load(Ordering::SeqCst),
        1,
        "ocr_engine()'s init closure should run exactly once under a real concurrent race"
    );
}
