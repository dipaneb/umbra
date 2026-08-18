// AC1/AC13: starts a cross-platform clipboard-change watcher. Windows (`WM_CLIPBOARDUPDATE`)
// and Linux/X11 (XFixes `SelectionNotify`) get genuine OS push events; macOS and Wayland have
// no such event and fall back to clipboard-rs's own bounded 500ms `changeCount`/poll — all four
// claims confirmed by reading clipboard-rs 0.3.5's actual per-platform source directly (not its
// docs), per ARCHITECTURE-SPINE.md's Dependency version/API drift convention.
use clipboard_rs::{
    Clipboard, ClipboardContext, ClipboardHandler, ClipboardWatcher, ClipboardWatcherContext,
    ContentFormat,
};
use tauri::{AppHandle, Emitter, Runtime};

pub const EVENT_NAME: &str = "clipboard-changed";

// Mirrors `src/shell/clipboard.ts`'s `onClipboardChange` payload shape exactly. Deliberately
// carries only a classification signal, never the raw clipboard content — the frontend re-reads
// text itself via the existing `readClipboardText()`, and never reads image bytes at all until
// the user opens a suggestion (AC12).
#[derive(Clone, serde::Serialize)]
struct ClipboardChangedPayload {
    kind: &'static str,
}

// AC12: `Clipboard::has` is a presence-only check — confirmed directly against the vendored
// source (e.g. macOS's implementation calls `NSPasteboard::availableTypeFromArray`, never
// `get_image`, which is the only method that actually decodes pixel data). Checked as a plain
// function over the `Clipboard` trait object so it's testable without a real watcher/AppHandle.
fn classify(ctx: &dyn Clipboard) -> Option<&'static str> {
    if ctx.has(ContentFormat::Image) {
        Some("image")
    } else if ctx.has(ContentFormat::Text) {
        Some("text")
    } else {
        None
    }
}

struct Handler<R: Runtime> {
    app: AppHandle<R>,
    ctx: ClipboardContext,
}

impl<R: Runtime> ClipboardHandler for Handler<R> {
    fn on_clipboard_change(&mut self) {
        let Some(kind) = classify(&self.ctx) else {
            return;
        };
        // A background watcher thread emitting after the window has started tearing down is a
        // normal shutdown race, not a bug this app can act on — the error is intentionally
        // discarded rather than logged.
        let _ = self.app.emit(EVENT_NAME, ClipboardChangedPayload { kind });
    }
}

// Called once from `tauri::Builder::setup()`. `start_watch()` blocks the calling thread for the
// watcher's whole lifetime (per clipboard-rs's own docs), so it needs its own background thread;
// the app never explicitly stops it, since the watcher's lifetime is meant to match the app's.
pub fn start<R: Runtime>(app: AppHandle<R>) {
    let ctx = match ClipboardContext::new() {
        Ok(ctx) => ctx,
        Err(error) => {
            eprintln!(
                "clipboard_watch: failed to open clipboard context, clipboard suggestions disabled: {error}"
            );
            return;
        }
    };
    let mut watcher = match ClipboardWatcherContext::new() {
        Ok(watcher) => watcher,
        Err(error) => {
            eprintln!(
                "clipboard_watch: failed to start clipboard watcher, clipboard suggestions disabled: {error}"
            );
            return;
        }
    };
    watcher.add_handler(Handler { app, ctx });
    std::thread::spawn(move || watcher.start_watch());
}

#[cfg(test)]
mod tests {
    use super::*;

    // A fake `Clipboard` for exercising `classify()`'s logic without a real OS clipboard
    // (unavailable in CI) — every other `Clipboard` method is unused by `classify()`, so this
    // stub only needs to satisfy the trait's signature, not behave correctly beyond `has()`.
    // `ContentFormat` doesn't derive `PartialEq`, so presence is tracked as two plain flags
    // instead of a `Vec<ContentFormat>` lookup.
    struct FakeClipboard {
        has_text: bool,
        has_image: bool,
    }

    impl Clipboard for FakeClipboard {
        fn available_formats(&self) -> clipboard_rs::common::Result<Vec<String>> {
            Ok(vec![])
        }
        fn has(&self, format: ContentFormat) -> bool {
            match format {
                ContentFormat::Text => self.has_text,
                ContentFormat::Image => self.has_image,
                _ => false,
            }
        }
        fn clear(&self) -> clipboard_rs::common::Result<()> {
            Ok(())
        }
        fn get_buffer(&self, _format: &str) -> clipboard_rs::common::Result<Vec<u8>> {
            Ok(vec![])
        }
        fn get_text(&self) -> clipboard_rs::common::Result<String> {
            Ok(String::new())
        }
        fn get_rich_text(&self) -> clipboard_rs::common::Result<String> {
            Ok(String::new())
        }
        fn get_html(&self) -> clipboard_rs::common::Result<String> {
            Ok(String::new())
        }
        fn get_image(&self) -> clipboard_rs::common::Result<clipboard_rs::RustImageData> {
            Err("not implemented in test fake".into())
        }
        fn get_files(&self) -> clipboard_rs::common::Result<Vec<String>> {
            Ok(vec![])
        }
        fn get(
            &self,
            _formats: &[ContentFormat],
        ) -> clipboard_rs::common::Result<Vec<clipboard_rs::ClipboardContent>> {
            Ok(vec![])
        }
        fn set_buffer(&self, _format: &str, _buffer: Vec<u8>) -> clipboard_rs::common::Result<()> {
            Ok(())
        }
        fn set_text(&self, _text: String) -> clipboard_rs::common::Result<()> {
            Ok(())
        }
        fn set_rich_text(&self, _text: String) -> clipboard_rs::common::Result<()> {
            Ok(())
        }
        fn set_html(&self, _html: String) -> clipboard_rs::common::Result<()> {
            Ok(())
        }
        fn set_image(
            &self,
            _image: clipboard_rs::RustImageData,
        ) -> clipboard_rs::common::Result<()> {
            Ok(())
        }
        fn set_files(&self, _files: Vec<String>) -> clipboard_rs::common::Result<()> {
            Ok(())
        }
        fn set(
            &self,
            _contents: Vec<clipboard_rs::ClipboardContent>,
        ) -> clipboard_rs::common::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn classify_prefers_image_over_text() {
        let clipboard = FakeClipboard {
            has_text: true,
            has_image: true,
        };
        assert_eq!(classify(&clipboard), Some("image"));
    }

    #[test]
    fn classify_returns_text_when_only_text_present() {
        let clipboard = FakeClipboard {
            has_text: true,
            has_image: false,
        };
        assert_eq!(classify(&clipboard), Some("text"));
    }

    #[test]
    fn classify_returns_none_for_unrecognized_formats() {
        // e.g. a files-only clipboard entry (a copied Finder/Explorer file) — no text, no image.
        let clipboard = FakeClipboard {
            has_text: false,
            has_image: false,
        };
        assert_eq!(classify(&clipboard), None);
    }
}
