use tauri::Runtime;
use umbra_core::ToolError;
use umbra_core::pdf::{self, MAX_INPUT_BYTES};

// Same shape as image.rs's/base64.rs's own `check_file_size` — this codebase does not share
// that helper across command files, per those files' own established convention.
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
            // AC18: `pdf-input-too-large` and `pdf-internal` are NEW codes minted here, and the
            // `bucket-input-too-large` / `bucket-internal` pair is deliberately left LIVE and
            // untouched for the Images tool, which raises both from `commands/image.rs`. This is
            // duplication, not migration — 8.7's own precedent — because retiring the shared pair
            // would mean editing a second tool's command file mid-story. **Story 8.9 owns
            // retiring it**, and `commands/image.rs` is not edited by this story.
            code: "pdf-input-too-large".to_string(),
            message: format!("file is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit"),
            position: None,
            context: None,
        });
    }
    Ok(())
}

// AD-15: a merged/page-extracted PDF can easily exceed the ~64KB JSON-IPC ceiling, so these two
// commands take `output_path` (obtained frontend-side via the `save()` dialog) and write
// server-side via `fs_helper::write_file_bytes`, returning `Result<(), ToolError>` — never the
// bytes themselves — mirroring `base64_decode_to_file`'s exact precedent.
#[tauri::command]
pub async fn pdf_merge(paths: Vec<String>, output_path: String) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut inputs = Vec::with_capacity(paths.len());
        for path in &paths {
            // Checked via metadata, before the file is read, so an oversized file is rejected
            // without ever being materialized in memory (same ordering as image.rs's own
            // check_file_size).
            check_file_size(path)?;
            inputs.push(crate::fs_helper::read_file_bytes(path)?);
        }
        let merged = pdf::merge_documents(inputs)?;
        crate::fs_helper::write_file_bytes(&output_path, &merged)
    })
    .await
    .map_err(map_join_error)?
}

#[tauri::command]
pub async fn pdf_extract_pages(
    path: String,
    start_page: u32,
    end_page: u32,
    output_path: String,
) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        let extracted = pdf::extract_page_range(&bytes, start_page, end_page)?;
        crate::fs_helper::write_file_bytes(&output_path, &extracted)
    })
    .await
    .map_err(map_join_error)?
}

// The one exception to the output_path pattern above: extracted text is realistically small
// relative to the 64KB IPC concern, matching `ocr_extract_text`'s own existing precedent of
// returning `OcrOutcome` directly.
#[tauri::command]
pub async fn pdf_extract_text(path: String) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        pdf::extract_text(&bytes)
    })
    .await
    .map_err(map_join_error)?
}

/// AC17: opening a document is one round trip that answers everything the resting surface needs
/// — how many pages, whether there is a text layer to read, and whether this build can render
/// previews at all.
///
/// The renderer flag rides here rather than in a seventh command (AC17's 2026-09-11 amendment):
/// the view needs it to choose between thumbnail rows and AC46's text-only rows, and it cannot
/// change during a session, so a separate call would be a round trip for a constant.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfDocumentInfo {
    pub page_count: u32,
    pub text_layer: pdf::TextLayer,
    pub can_render_previews: bool,
}

#[tauri::command]
pub async fn pdf_open(path: String) -> Result<PdfDocumentInfo, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        // One parse, not two: `page_count` + `classify_text_layer` each loaded the document, so
        // a 100 MB file was parsed twice per open (code review 2026-09-13).
        let summary = pdf::summarise(&bytes)?;
        Ok(PdfDocumentInfo {
            page_count: summary.page_count,
            text_layer: summary.text_layer,
            // AC46: a fact about the build, not about the document — true on macOS and Windows,
            // false wherever `render/unsupported.rs` is compiled. The view reads it once, at
            // open, to choose between thumbnail rows and the text-only rows AC21 keeps.
            can_render_previews: crate::render::is_available(),
        })
    })
    .await
    .map_err(map_join_error)?
}

/// AC33/AC34: one dropped document. `path` is echoed back so the view can pair results to files
/// without relying on array order surviving the round trip.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfDroppedDocument {
    pub path: String,
    pub page_count: u32,
    pub text_layer: pdf::TextLayer,
}

/// AC33: the `pdf` tool's drop handler — the one command in this tool that takes **`paths`**
/// rather than `path`, because it is the one the shell's `multiple: true` branch invokes.
///
/// **A file that will not open fails the whole drop, deliberately.** Dropping five PDFs of which
/// one is encrypted could either queue the four that worked or refuse the lot; queueing four
/// silently is the worse answer, because the merge would then produce a document missing a file
/// the user believed they had included, and NFR4 admits no silently-wrong result. Refusing is
/// recoverable — the user drops again without the bad file — and says which problem it hit.
#[tauri::command]
pub async fn pdf_open_dropped(paths: Vec<String>) -> Result<Vec<PdfDroppedDocument>, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut opened = Vec::with_capacity(paths.len());
        for path in paths {
            check_file_size(&path)?;
            let bytes = crate::fs_helper::read_file_bytes(&path)?;
            let summary = pdf::summarise(&bytes)?;
            opened.push(PdfDroppedDocument {
                page_count: summary.page_count,
                text_layer: summary.text_layer,
                path,
            });
        }
        Ok(opened)
    })
    .await
    .map_err(map_join_error)?
}

/// AC17/AC45: per-page text for a bounded range, never the whole document at once — the fetch
/// policy AC9/AC29 establish, applied to the page list's text labels.
#[tauri::command]
pub async fn pdf_page_text(
    path: String,
    page_numbers: Vec<u32>,
) -> Result<Vec<pdf::PageText>, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        pdf::page_texts(&bytes, &page_numbers)
    })
    .await
    .map_err(map_join_error)?
}

/// Where working copies live: a `pdf-edits` subdirectory of the app's **per-user** cache
/// directory (`~/Library/Caches/<id>`, `%LOCALAPPDATA%\<id>`, `~/.cache/<id>`), so they are easy
/// to find, easy to sweep, and never sit beside the user's own file.
///
/// **Per-user, not the OS temp dir** (code review 2026-09-13). `std::env::temp_dir()` is the
/// shared `/tmp` on Linux, and a directory created there with default permissions left every
/// PDF a user edited readable by every other local account — on the one platform where the tool
/// has no renderer but full editing. Tauri's cache dir is per-user by construction on all three
/// platforms, which closes that without a `cfg(unix)` permissions branch (AC44 keeps its single
/// platform switch). Tauri documents it as *"intended for temporary files that can be deleted"*,
/// which is exactly what a working copy is.
///
/// Test builds resolve to a temp directory instead, `models_dir`-style (`ocr.rs`): the tests
/// must not write into the developer's real cache, and `test-support` extends that to the
/// integration-test binaries, which `cfg(test)` never reaches.
#[cfg(not(any(test, feature = "test-support")))]
fn working_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<std::path::PathBuf, ToolError> {
    // Imported here rather than at the top: `path()` is the only `Manager` method this file
    // uses, and the test build's `working_dir` never calls it, which would leave the import unused.
    use tauri::Manager;
    app.path()
        .app_cache_dir()
        .map(|dir| dir.join("pdf-edits"))
        .map_err(|err| ToolError {
            code: "file-write-error".to_string(),
            message: format!("could not resolve the app cache directory: {err}"),
            position: None,
            context: None,
        })
}

#[cfg(any(test, feature = "test-support"))]
fn working_dir<R: Runtime>(_app: &tauri::AppHandle<R>) -> Result<std::path::PathBuf, ToolError> {
    Ok(std::env::temp_dir().join("umbra-pdf-edits-test"))
}

/// How long a working copy has to sit untouched before it is treated as abandoned. Generous on
/// purpose: the only cost of sweeping late is a file in the temp directory, while the cost of
/// sweeping early is another session's unsaved work.
const WORKING_COPY_STALE_AFTER: std::time::Duration = std::time::Duration::from_secs(24 * 60 * 60);

/// Serialises **every** command that reads or writes the working copy, because its name is
/// per-process and two of them can genuinely overlap: `runDocument` is latest-wins in the view,
/// so a superseded open still runs to completion in Rust. Without this, both calls write the same
/// `…umbra-tmp-{pid}` staging file and one of the two renames loses it, surfacing as
/// `file-write-error: No such file or directory` on a PDF that is perfectly fine — or worse, one
/// document's edited bytes land as the other's working copy. Surfaced by three tests colliding;
/// the app can reach it by opening two documents quickly.
///
/// **Taken by `pdf_begin_edit`, the three page edits, and `pdf_save_copy` alike** (code review
/// 2026-09-13: the first version took it only in `pdf_begin_edit`, which left the guard depending
/// on the view's `working` flag disabling the edit buttons — true today, but a command layer
/// whose safety lives in a UI flag is a latent bug for the next caller).
///
/// One live working copy per process is deliberate, and it is why a lock is the right answer
/// rather than a unique filename per edit: the surface opens one document at a time, and naming
/// each edit separately would leave a 100 MB file behind for every document opened in a session.
static WORKING_COPY_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// Acquires `WORKING_COPY_LOCK`, ignoring poisoning: the guarded data is `()`, and a panicked
/// earlier edit leaves no invariant for the next one to be confused by.
fn working_copy_guard() -> std::sync::MutexGuard<'static, ()> {
    WORKING_COPY_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Removes working copies left behind by sessions that never got to clean up after themselves.
///
/// **This used to be `remove_dir_all` on the whole directory, and that was a data-loss bug.**
/// Nothing stops a second Umbra from running — there is no single-instance plugin — and the
/// directory is shared, so the second instance's `pdf_begin_edit` deleted the first instance's
/// working copy out from under it. The user then loses every unsaved page edit in the first
/// window, and its next save fails with a file-read-error naming a path that no longer exists.
///
/// Age is the discriminator rather than the process id: a live session's copy was written
/// seconds ago, and checking whether a pid is still alive is neither portable nor race-free
/// (pids are reused). Best-effort throughout — a sweep that cannot read the directory is not a
/// reason to refuse the edit the user actually asked for.
fn sweep_stale_working_copies(dir: &std::path::Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let now = std::time::SystemTime::now();
    for entry in entries.flatten() {
        let stale = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age >= WORKING_COPY_STALE_AFTER);
        if stale {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

/// AC52: begins an editing session by taking a working copy of `path`.
///
/// **Every page edit acts on this copy, never on the file the user opened.** That is what makes
/// rotate/delete/reorder feel like editing rather than like exporting, and it means the original
/// on disk is untouched until an explicit save — so an edit is genuinely reversible by closing
/// without saving, which is the premise `DESIGN.md:149` already relies on when it rules that
/// removing pages is "low-stakes and trivially reversible".
///
/// Stale copies from previous sessions are swept here rather than on close: a crash or a force
/// quit never runs a close handler, so cleanup that only happens on the way out is cleanup that
/// eventually stops happening. **By age, never wholesale** — see `sweep_stale_working_copies`.
// Generic over `R: Runtime` for the same reason `ocr_extract_text` is (see its comment): the
// `AppHandle` is what resolves the per-user cache directory, and the mock runtime the tests use
// is a different `R` from the app's `Wry`.
#[tauri::command]
pub async fn pdf_begin_edit<R: Runtime>(
    path: String,
    app: tauri::AppHandle<R>,
) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let _guard = working_copy_guard();
        let dir = working_dir(&app)?;
        std::fs::create_dir_all(&dir).map_err(|err| ToolError {
            code: "file-write-error".to_string(),
            message: format!("{}: {err}", dir.display()),
            position: None,
            context: None,
        })?;

        sweep_stale_working_copies(&dir);

        let working = dir.join(format!("working-{}.pdf", std::process::id()));
        let working = working.to_string_lossy().to_string();
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        crate::fs_helper::write_file_bytes(&working, &bytes)?;
        Ok(working)
    })
    .await
    .map_err(map_join_error)?
}

/// AC52: writes the edited working copy out to a destination the user chose.
///
/// A byte copy rather than a re-save through `lopdf`: the working copy is already exactly what the
/// page list shows, and round-tripping it through the parser again would be a second chance to
/// change something the user did not ask to change.
///
/// **The one command that does not call `check_file_size`, deliberately** (AC19 as amended at the
/// code review, 2026-09-13). The cap exists to bound what the parser is asked to decode, and this
/// command never parses. Applying it here re-checked the app's *own* working copy against the
/// *input* cap — and a `lopdf` re-save can be larger than the original (object streams are
/// written back as individual objects), so an original just under the cap became a document the
/// user had edited, could see, and could not save.
#[tauri::command]
pub async fn pdf_save_copy(path: String, output_path: String) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = working_copy_guard();
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        crate::fs_helper::write_file_bytes(&output_path, &bytes)
    })
    .await
    .map_err(map_join_error)?
}

/// One page's preview: the page it belongs to, and the PNG bytes base64-encoded for the JSON IPC
/// bridge so the view can hand it straight to an `<img src="data:image/png;base64,…">`.
///
/// **Base64, not a raw byte array.** `serde_json` would serialise `Vec<u8>` as an array of
/// numbers — roughly 4x the bytes and a JSON parse per pixel on the frontend — which is precisely
/// the volume problem AC45 is about. A `data:` URI also needs no `capabilities/default.json`
/// change, unlike the asset protocol (AD-15: *do not add a third exception*).
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfPagePreview {
    pub page: u32,
    pub png_base64: String,
}

/// AC45: previews for a bounded range of pages, never the whole document at once.
///
/// **A page that fails to render is omitted rather than failing the batch** — the same shape
/// AC9's per-page text takes, and for the same reason: one unrenderable page in a four-hundred
/// page document must degrade that row to its text label (AC46), not blank the list. The view
/// matches results to rows by `page`, so a short result is unambiguous.
#[tauri::command]
pub async fn pdf_render_pages(
    path: String,
    page_numbers: Vec<u32>,
    max_width: u32,
) -> Result<Vec<PdfPagePreview>, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;

        Ok(page_numbers
            .into_iter()
            .filter_map(|page| {
                crate::render::render_page(&bytes, page, max_width)
                    .ok()
                    // `umbra_core::base64::encode_bytes`, not a new `base64` dependency here:
                    // core already owns this transformation (AD-1) and already depends on the
                    // crate. Standard alphabet, unwrapped — a `data:` URI takes neither
                    // URL-safe encoding nor line breaks.
                    .and_then(|png| {
                        umbra_core::base64::encode_bytes(&png, false, None)
                            .ok()
                            .map(|png_base64| PdfPagePreview { page, png_base64 })
                    })
            })
            .collect())
    })
    .await
    .map_err(map_join_error)?
}

// AD-15: like merge and extract-pages, each of these produces a whole PDF, so it takes an
// `output_path` and writes server-side rather than returning bytes across the JSON IPC bridge.
#[tauri::command]
pub async fn pdf_delete_pages(
    path: String,
    page_numbers: Vec<u32>,
    output_path: String,
) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let _guard = working_copy_guard();
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        let result = pdf::delete_pages(&bytes, &page_numbers)?;
        crate::fs_helper::write_file_bytes(&output_path, &result)
    })
    .await
    .map_err(map_join_error)?
}

#[tauri::command]
pub async fn pdf_rotate_pages(
    path: String,
    page_numbers: Vec<u32>,
    quarter_turns: i32,
    output_path: String,
) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let _guard = working_copy_guard();
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        let result = pdf::rotate_pages(&bytes, &page_numbers, quarter_turns)?;
        crate::fs_helper::write_file_bytes(&output_path, &result)
    })
    .await
    .map_err(map_join_error)?
}

#[tauri::command]
pub async fn pdf_reorder_pages(
    path: String,
    new_order: Vec<u32>,
    output_path: String,
) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let _guard = working_copy_guard();
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        let result = pdf::reorder_pages(&bytes, &new_order)?;
        crate::fs_helper::write_file_bytes(&output_path, &result)
    })
    .await
    .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "pdf-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{
        Document, EncryptionState, EncryptionVersion, Object, Permissions, Stream, dictionary,
    };

    // Minimal valid in-test PDF fixture builder — same rationale as umbra-core's own pdf.rs test
    // module (cheaper to maintain than a checked-in binary fixture). This crate's tests only need
    // "a real file exists and round-trips through the command," not exhaustive core-logic
    // coverage — that's umbra-core's own pdf.rs test module's job (Task 5's division of labor).
    fn generate_test_pdf_bytes(pages_text: &[&str]) -> Vec<u8> {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Courier",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! { "F1" => font_id },
        });

        let mut kids = Vec::new();
        for text in pages_text {
            let content = Content {
                operations: vec![
                    Operation::new("BT", vec![]),
                    Operation::new("Tf", vec!["F1".into(), 24.into()]),
                    Operation::new("Td", vec![72.into(), 700.into()]),
                    Operation::new("Tj", vec![Object::string_literal(*text)]),
                    Operation::new("ET", vec![]),
                ],
            };
            let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content_id,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            });
            kids.push(page_id.into());
        }

        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => kids.clone(),
            "Count" => kids.len() as u32,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages));
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);

        let mut buffer = Vec::new();
        doc.save_to(&mut buffer).unwrap();
        buffer
    }

    /// Same RC4 V2 encryption shape as `umbra_core::pdf`'s own test module — a real, non-empty
    /// password so the encrypted-PDF path is exercised through this command layer too, not just
    /// at the core-function level.
    fn generate_encrypted_test_pdf_bytes(pages_text: &[&str]) -> Vec<u8> {
        let mut doc = Document::load_mem(&generate_test_pdf_bytes(pages_text)).unwrap();
        doc.trailer.set(
            "ID",
            Object::Array(vec![
                Object::string_literal(vec![1u8; 16]),
                Object::string_literal(vec![2u8; 16]),
            ]),
        );
        let state = EncryptionState::try_from(EncryptionVersion::V2 {
            document: &doc,
            owner_password: "owner-secret",
            user_password: "user-secret",
            key_length: 40,
            permissions: Permissions::PRINTABLE,
        })
        .unwrap();
        doc.encrypt(&state).unwrap();
        let mut buffer = Vec::new();
        doc.save_to(&mut buffer).unwrap();
        buffer
    }

    /// The mock runtime handle `pdf_begin_edit` needs to resolve its working directory. Same
    /// construction as `ocr.rs`'s tests; under `cfg(test)` `working_dir` ignores it and answers
    /// with a temp directory, so no test writes into the developer's real cache.
    fn mock_app_handle() -> tauri::AppHandle<tauri::test::MockRuntime> {
        tauri::test::mock_builder()
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("failed to build mock app")
            .handle()
            .clone()
    }

    fn temp_file_path(name: &str) -> String {
        std::env::temp_dir()
            .join(format!("umbra-pdf-cmd-{}-{name}", std::process::id()))
            .to_str()
            .unwrap()
            .to_string()
    }

    #[tokio::test]
    async fn pdf_merge_command_merges_two_real_files_end_to_end() {
        let path_a = temp_file_path("merge-a.pdf");
        let path_b = temp_file_path("merge-b.pdf");
        let output_path = temp_file_path("merge-out.pdf");
        std::fs::write(&path_a, generate_test_pdf_bytes(&["Page A"])).unwrap();
        std::fs::write(&path_b, generate_test_pdf_bytes(&["Page B"])).unwrap();

        pdf_merge(vec![path_a.clone(), path_b.clone()], output_path.clone())
            .await
            .unwrap();

        let merged_bytes = std::fs::read(&output_path).unwrap();
        let merged = Document::load_mem(&merged_bytes).unwrap();
        assert_eq!(merged.get_pages().len(), 2);

        std::fs::remove_file(&path_a).unwrap();
        std::fs::remove_file(&path_b).unwrap();
        std::fs::remove_file(&output_path).unwrap();
    }

    #[tokio::test]
    async fn pdf_merge_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let oversized_path = temp_file_path("merge-oversized.pdf");
        let other_path = temp_file_path("merge-other.pdf");
        let file = std::fs::File::create(&oversized_path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);
        std::fs::write(&other_path, generate_test_pdf_bytes(&["Page"])).unwrap();

        let err = pdf_merge(
            vec![oversized_path.clone(), other_path.clone()],
            temp_file_path("merge-oversized-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "pdf-input-too-large");

        std::fs::remove_file(&oversized_path).unwrap();
        std::fs::remove_file(&other_path).unwrap();
    }

    #[tokio::test]
    async fn pdf_merge_command_returns_file_read_error_for_missing_path() {
        let other_path = temp_file_path("merge-existing.pdf");
        std::fs::write(&other_path, generate_test_pdf_bytes(&["Page"])).unwrap();

        let err = pdf_merge(
            vec![
                "/nonexistent/path/umbra-test.pdf".to_string(),
                other_path.clone(),
            ],
            temp_file_path("merge-missing-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-read-error");

        std::fs::remove_file(&other_path).unwrap();
    }

    #[tokio::test]
    async fn pdf_extract_pages_command_extracts_a_real_range_end_to_end() {
        let path = temp_file_path("extract-pages.pdf");
        let output_path = temp_file_path("extract-pages-out.pdf");
        std::fs::write(
            &path,
            generate_test_pdf_bytes(&["Page 1", "Page 2", "Page 3"]),
        )
        .unwrap();

        pdf_extract_pages(path.clone(), 2, 3, output_path.clone())
            .await
            .unwrap();

        let extracted_bytes = std::fs::read(&output_path).unwrap();
        let extracted = Document::load_mem(&extracted_bytes).unwrap();
        assert_eq!(extracted.get_pages().len(), 2);

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_file(&output_path).unwrap();
    }

    #[tokio::test]
    async fn pdf_extract_pages_command_rejects_an_out_of_bounds_range() {
        let path = temp_file_path("extract-pages-oob.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["Page 1"])).unwrap();

        let err = pdf_extract_pages(
            path.clone(),
            1,
            5,
            temp_file_path("extract-pages-oob-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "pdf-invalid-range");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn pdf_extract_pages_command_returns_file_read_error_for_missing_path() {
        let err = pdf_extract_pages(
            "/nonexistent/path/umbra-test.pdf".to_string(),
            1,
            1,
            temp_file_path("extract-pages-missing-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn pdf_extract_text_command_extracts_real_text_end_to_end() {
        let path = temp_file_path("extract-text.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["Hello Umbra PDF"])).unwrap();

        let text = pdf_extract_text(path.clone()).await.unwrap();
        assert!(text.contains("Hello Umbra PDF"));

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn pdf_extract_text_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let path = temp_file_path("extract-text-oversized.pdf");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        let err = pdf_extract_text(path.clone()).await.unwrap_err();
        assert_eq!(err.code, "pdf-input-too-large");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn pdf_extract_text_command_returns_file_read_error_for_missing_path() {
        let err = pdf_extract_text("/nonexistent/path/umbra-test.pdf".to_string())
            .await
            .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn pdf_extract_text_command_returns_pdf_corrupt_for_undecodable_bytes() {
        let path = temp_file_path("extract-text-corrupt.pdf");
        std::fs::write(&path, b"not a pdf").unwrap();

        let err = pdf_extract_text(path.clone()).await.unwrap_err();
        assert_eq!(err.code, "pdf-corrupt");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn every_command_rejects_a_real_password_protected_pdf() {
        let encrypted_path = temp_file_path("encrypted.pdf");
        let other_path = temp_file_path("encrypted-other.pdf");
        std::fs::write(
            &encrypted_path,
            generate_encrypted_test_pdf_bytes(&["Secret page"]),
        )
        .unwrap();
        std::fs::write(&other_path, generate_test_pdf_bytes(&["Other page"])).unwrap();

        let text_err = pdf_extract_text(encrypted_path.clone()).await.unwrap_err();
        assert_eq!(text_err.code, "pdf-encrypted");

        let range_err = pdf_extract_pages(
            encrypted_path.clone(),
            1,
            1,
            temp_file_path("encrypted-range-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(range_err.code, "pdf-encrypted");

        let merge_err = pdf_merge(
            vec![encrypted_path.clone(), other_path.clone()],
            temp_file_path("encrypted-merge-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(merge_err.code, "pdf-encrypted");

        std::fs::remove_file(&encrypted_path).unwrap();
        std::fs::remove_file(&other_path).unwrap();
    }

    #[tokio::test]
    async fn pdf_open_command_reports_page_count_and_text_layer_end_to_end() {
        let path = temp_file_path("open.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["Has text", "More"])).unwrap();

        let info = pdf_open(path.clone()).await.unwrap();
        assert_eq!(info.page_count, 2);
        assert_eq!(info.text_layer, umbra_core::pdf::TextLayer::Partial);
        // Slice 3 replaced the hardcoded `false` with the real backend capability. Asserted
        // against `render::is_available()` rather than against a literal, deliberately: this
        // test's job is to prove the field is WIRED to the renderer, and duplicating the
        // platform table here would put a second `cfg(target_os)` in runtime source, which AC44
        // forbids. Which platforms have a backend is asserted in `render/mod.rs`'s own tests —
        // the one file allowed to know.
        assert_eq!(info.can_render_previews, crate::render::is_available());

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn pdf_page_text_command_returns_one_entry_per_requested_page() {
        let path = temp_file_path("page-text.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["Alpha", "Beta"])).unwrap();

        let texts = pdf_page_text(path.clone(), vec![2]).await.unwrap();
        assert_eq!(texts.len(), 1);
        assert_eq!(texts[0].page, 2);
        assert!(texts[0].text.as_deref().unwrap().contains("Beta"));

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn pdf_delete_pages_command_writes_the_remaining_pages_end_to_end() {
        let path = temp_file_path("delete.pdf");
        let output_path = temp_file_path("delete-out.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["Keep", "Drop"])).unwrap();

        pdf_delete_pages(path.clone(), vec![2], output_path.clone())
            .await
            .unwrap();

        let bytes = std::fs::read(&output_path).unwrap();
        assert_eq!(Document::load_mem(&bytes).unwrap().get_pages().len(), 1);

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_file(&output_path).unwrap();
    }

    #[tokio::test]
    async fn pdf_rotate_pages_command_writes_the_rotation_end_to_end() {
        let path = temp_file_path("rotate.pdf");
        let output_path = temp_file_path("rotate-out.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["One"])).unwrap();

        pdf_rotate_pages(path.clone(), vec![1], 1, output_path.clone())
            .await
            .unwrap();

        let bytes = std::fs::read(&output_path).unwrap();
        let doc = Document::load_mem(&bytes).unwrap();
        let pages = doc.get_pages();
        assert_eq!(
            doc.get_dictionary(pages[&1])
                .unwrap()
                .get(b"Rotate")
                .unwrap()
                .as_i64()
                .unwrap(),
            90
        );

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_file(&output_path).unwrap();
    }

    #[tokio::test]
    async fn pdf_reorder_pages_command_writes_the_new_order_end_to_end() {
        let path = temp_file_path("reorder.pdf");
        let output_path = temp_file_path("reorder-out.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["First", "Second"])).unwrap();

        pdf_reorder_pages(path.clone(), vec![2, 1], output_path.clone())
            .await
            .unwrap();

        let bytes = std::fs::read(&output_path).unwrap();
        let text = umbra_core::pdf::extract_text(&bytes).unwrap();
        assert!(
            text.find("Second").unwrap() < text.find("First").unwrap(),
            "expected Second before First"
        );

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_file(&output_path).unwrap();
    }

    #[tokio::test]
    async fn pdf_begin_edit_copies_the_original_without_touching_it() {
        let _serialised = EDIT_TESTS.lock().await;
        // AC52: the file the user opened is the one file this tool must never write to — that is
        // what makes an edit reversible by simply closing without saving.
        let path = temp_file_path("begin-edit.pdf");
        let original = generate_test_pdf_bytes(&["One", "Two"]);
        std::fs::write(&path, &original).unwrap();

        let working = pdf_begin_edit(path.clone(), mock_app_handle())
            .await
            .unwrap();

        assert_ne!(working, path, "the working copy must be a different file");
        assert_eq!(std::fs::read(&working).unwrap(), original);
        assert_eq!(std::fs::read(&path).unwrap(), original);

        std::fs::remove_file(&path).unwrap();
    }

    /// These three tests share one real directory, because the thing under test *is* a
    /// process-wide temp directory — so they must not run concurrently with each other. The
    /// production lock serialises the copy itself but not a test's assertions afterwards, which
    /// is a different window.
    /// `tokio::sync::Mutex`, not `std::sync`: each test holds this across an `.await`, which is
    /// precisely what `clippy::await_holding_lock` exists to stop. The production lock stays
    /// `std::sync` because it is taken inside `spawn_blocking`, where there is no await to cross.
    static EDIT_TESTS: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    /// Backdates a file so a test can state "abandoned" rather than wait a day for it to be true.
    fn age_by(path: &std::path::Path, age: std::time::Duration) {
        let file = std::fs::File::options().write(true).open(path).unwrap();
        let when = std::time::SystemTime::now() - age;
        file.set_times(std::fs::FileTimes::new().set_modified(when))
            .unwrap();
    }

    #[tokio::test]
    async fn pdf_begin_edit_sweeps_working_copies_from_earlier_sessions() {
        let _serialised = EDIT_TESTS.lock().await;
        // Swept on the way IN rather than on close: a crash or a force quit never runs a close
        // handler, so cleanup that only happens on the way out eventually stops happening.
        let path = temp_file_path("begin-edit-sweep.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["One"])).unwrap();

        let dir = working_dir(&mock_app_handle()).unwrap();
        std::fs::create_dir_all(&dir).unwrap();
        let stale = dir.join("stale-from-a-previous-run.pdf");
        std::fs::write(&stale, b"leftovers").unwrap();
        age_by(
            &stale,
            WORKING_COPY_STALE_AFTER + std::time::Duration::from_secs(60),
        );

        let _ = pdf_begin_edit(path.clone(), mock_app_handle())
            .await
            .unwrap();

        assert!(
            !stale.exists(),
            "an abandoned working copy must not survive"
        );

        std::fs::remove_file(&path).unwrap();
    }

    /// The counterpart, and the one that matters: this used to be `remove_dir_all` on a shared
    /// directory. Nothing stops a second Umbra from running — there is no single-instance plugin
    /// — so a second window opening a PDF deleted the first window's working copy out from under
    /// it, losing every unsaved page edit and leaving its next save pointing at a path that no
    /// longer exists. Found by the commit security review, not by this suite.
    #[tokio::test]
    async fn pdf_begin_edit_leaves_another_live_session_working_copy_alone() {
        let _serialised = EDIT_TESTS.lock().await;
        let path = temp_file_path("begin-edit-concurrent.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["One"])).unwrap();

        let dir = working_dir(&mock_app_handle()).unwrap();
        std::fs::create_dir_all(&dir).unwrap();
        // Another running instance's copy: a different pid, written moments ago.
        let other = dir.join("working-999999.pdf");
        std::fs::write(&other, b"another session's unsaved edits").unwrap();

        let _ = pdf_begin_edit(path.clone(), mock_app_handle())
            .await
            .unwrap();

        assert!(
            other.exists(),
            "a live session's working copy must survive another session starting an edit"
        );
        assert_eq!(
            std::fs::read(&other).unwrap(),
            b"another session's unsaved edits",
            "and must survive intact, not merely exist"
        );

        std::fs::remove_file(&other).unwrap();
        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn pdf_save_copy_writes_the_working_copy_to_the_chosen_path() {
        let source = temp_file_path("save-copy-src.pdf");
        let destination = temp_file_path("save-copy-dst.pdf");
        let bytes = generate_test_pdf_bytes(&["One"]);
        std::fs::write(&source, &bytes).unwrap();

        pdf_save_copy(source.clone(), destination.clone())
            .await
            .unwrap();

        assert_eq!(std::fs::read(&destination).unwrap(), bytes);

        std::fs::remove_file(&source).unwrap();
        std::fs::remove_file(&destination).unwrap();
    }

    #[tokio::test]
    async fn an_edit_command_can_read_and_write_the_same_path() {
        // The working-copy model has every edit read and write one file. Safe because the command
        // reads it completely before writing, and `write_file_bytes` writes a temp then renames —
        // but it is the kind of thing that is only obviously safe once something asserts it.
        let path = temp_file_path("in-place.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["One", "Two", "Three"])).unwrap();

        pdf_delete_pages(path.clone(), vec![2], path.clone())
            .await
            .unwrap();

        let bytes = std::fs::read(&path).unwrap();
        assert_eq!(Document::load_mem(&bytes).unwrap().get_pages().len(), 2);

        std::fs::remove_file(&path).unwrap();
    }

    /// AC19: the size guard is worthless if a new verb forgets to call it, so this covers the
    /// DIMENSION — every command that parses, not the ones that happened to have coverage
    /// already. The code review (2026-09-13) found it covering 8 of 12 while its name claimed
    /// all; `pdf_open_dropped`, `pdf_render_pages` and `pdf_begin_edit` are now here, and
    /// `pdf_save_copy` is asserted as the one deliberate exemption below. The file is a sparse
    /// 100MB+ placeholder that is never valid PDF, so reaching core at all would fail with
    /// `pdf-corrupt` instead; `pdf-input-too-large` proves the check ran BEFORE the read.
    #[tokio::test]
    async fn every_command_rejects_an_oversize_file_without_reading_it() {
        let _serialised = EDIT_TESTS.lock().await;
        let path = temp_file_path("oversize-all.pdf");
        let out = temp_file_path("oversize-all-out.pdf");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        assert_eq!(
            pdf_open(path.clone()).await.unwrap_err().code,
            "pdf-input-too-large"
        );
        assert_eq!(
            pdf_open_dropped(vec![path.clone()]).await.unwrap_err().code,
            "pdf-input-too-large"
        );
        assert_eq!(
            pdf_render_pages(path.clone(), vec![1], 100)
                .await
                .unwrap_err()
                .code,
            "pdf-input-too-large"
        );
        assert_eq!(
            pdf_begin_edit(path.clone(), mock_app_handle())
                .await
                .unwrap_err()
                .code,
            "pdf-input-too-large"
        );
        assert_eq!(
            pdf_page_text(path.clone(), vec![1]).await.unwrap_err().code,
            "pdf-input-too-large"
        );
        assert_eq!(
            pdf_delete_pages(path.clone(), vec![1], out.clone())
                .await
                .unwrap_err()
                .code,
            "pdf-input-too-large"
        );
        assert_eq!(
            pdf_rotate_pages(path.clone(), vec![1], 1, out.clone())
                .await
                .unwrap_err()
                .code,
            "pdf-input-too-large"
        );
        assert_eq!(
            pdf_reorder_pages(path.clone(), vec![1], out.clone())
                .await
                .unwrap_err()
                .code,
            "pdf-input-too-large"
        );
        assert_eq!(
            pdf_extract_pages(path.clone(), 1, 1, out.clone())
                .await
                .unwrap_err()
                .code,
            "pdf-input-too-large"
        );

        std::fs::remove_file(&path).unwrap();
    }

    /// AC19's one exemption, asserted so it stays deliberate: `pdf_save_copy` never parses, and
    /// the app's own working copy can legitimately exceed the *input* cap after a `lopdf`
    /// re-save. A sparse placeholder over the cap must copy through rather than be refused —
    /// the alternative was a document the user had edited and could not save.
    #[tokio::test]
    async fn pdf_save_copy_is_exempt_from_the_input_size_cap() {
        let source = temp_file_path("oversize-save-copy-src.pdf");
        let destination = temp_file_path("oversize-save-copy-dst.pdf");
        let file = std::fs::File::create(&source).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        pdf_save_copy(source.clone(), destination.clone())
            .await
            .unwrap();

        assert_eq!(
            std::fs::metadata(&destination).unwrap().len(),
            MAX_INPUT_BYTES as u64 + 1
        );

        std::fs::remove_file(&source).unwrap();
        std::fs::remove_file(&destination).unwrap();
    }

    #[tokio::test]
    async fn map_join_error_produces_pdf_internal_tool_error_on_panic() {
        let err = tauri::async_runtime::spawn_blocking(|| {
            panic!("boom");
        })
        .await
        .unwrap_err();

        let tool_err = map_join_error(err);
        assert_eq!(tool_err.code, "pdf-internal");
    }
}
