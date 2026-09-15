use tauri::Runtime;
use umbra_core::ToolError;
use umbra_core::image_convert::{self, MAX_INPUT_BYTES, ResizeRequest, TargetFormat};

// Same shape as pdf.rs's own `check_file_size` — this codebase does not share that helper
// across command files, per that file's own established convention.
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
            code: "image-input-too-large".to_string(),
            message: format!("file is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit"),
            position: None,
            context: None,
        });
    }
    Ok(())
}

// `target_format` arrives over IPC as a plain string (no serde enum on the umbra-core side to
// keep umbra-core's public API free of IPC-shape concerns) and is parsed here, in the command
// layer — an unrecognized string is a `ToolError`, never a panic or a silent default. `"avif"`
// is accepted here (AC24: an encode target only) — nothing in this file ever passes it to a
// decode path, since the source file is always read as raw bytes and decoded once, inside
// `image_convert::convert`/`probe`, from whatever format the file actually is.
fn parse_target_format(target_format: &str) -> Result<TargetFormat, ToolError> {
    match target_format {
        "png" => Ok(TargetFormat::Png),
        "jpeg" => Ok(TargetFormat::Jpeg),
        "webp" => Ok(TargetFormat::WebP),
        "avif" => Ok(TargetFormat::Avif),
        other => Err(ToolError {
            code: "image-invalid-target-format".to_string(),
            message: format!("unrecognized target format: {other}"),
            position: None,
            context: None,
        }),
    }
}

// AC25: the background-color control is a plain native `<input type="color">`, which always
// gives a well-formed `#rrggbb` string — this is IPC-shape parsing (the same class of job
// `parse_target_format` above does), not a core-layer business rule, so it stays here rather
// than in `image_convert.rs`.
fn parse_hex_color(raw: &str) -> Result<[u8; 3], ToolError> {
    let hex = raw.strip_prefix('#').unwrap_or(raw);
    let invalid = || ToolError {
        code: "image-invalid-background-color".to_string(),
        message: format!("'{raw}' is not a valid #rrggbb color"),
        position: None,
        context: None,
    };
    if hex.len() != 6 || !hex.is_ascii() {
        return Err(invalid());
    }
    let byte =
        |offset: usize| u8::from_str_radix(&hex[offset..offset + 2], 16).map_err(|_| invalid());
    Ok([byte(0)?, byte(2)?, byte(4)?])
}

fn target_extension(target: TargetFormat) -> &'static str {
    match target {
        TargetFormat::Png => "png",
        TargetFormat::Jpeg => "jpg",
        TargetFormat::WebP => "webp",
        TargetFormat::Avif => "avif",
    }
}

fn source_stem(path: &str) -> String {
    std::path::Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.is_empty())
        .unwrap_or("converted")
        .to_string()
}

// AC18: "Convert all" asks once for a destination FOLDER, not a per-file save dialog — so the
// collision policy that a native save dialog would otherwise handle (asking to overwrite) has
// to be decided here instead. An auto-appended numeric suffix, never a silent overwrite and
// never an interrupting per-file prompt for what is meant to be an unattended batch operation.
// Same accepted TOCTOU as every other check-then-act path in this codebase (`check_file_size`
// itself, `pdf.rs`/`ocr.rs`/`base64.rs`'s own reads) — a second process racing to create the
// exact same suffixed name in the same instant is not a threat model this app defends against.
fn unique_output_path(
    output_dir: &str,
    source_path: &str,
    target: TargetFormat,
) -> Result<String, ToolError> {
    let stem = source_stem(source_path);
    let ext = target_extension(target);
    let dir = std::path::Path::new(output_dir);
    let mut candidate = dir.join(format!("{stem}.{ext}"));
    let mut suffix = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{stem} ({suffix}).{ext}"));
        suffix += 1;
    }
    candidate
        .to_str()
        .map(str::to_string)
        .ok_or_else(|| ToolError {
            code: "image-internal".to_string(),
            message: format!("{output_dir}: output path is not valid UTF-8"),
            position: None,
            context: None,
        })
}

/// AC27's Compare needs the webview to actually load both the original file and the freshly
/// written output — arbitrary filesystem paths the app's asset protocol has no standing access
/// to (`tauri.conf.json` declares it with an empty static scope). Same grant mechanism
/// `ocr_grant_asset` already established (Story 4.2/8.7) — allow-only, in-memory, dies with the
/// process — duplicated here rather than shared, matching this codebase's own convention of not
/// sharing per-file command helpers (`check_file_size` above is the same shape). No extra
/// signature validation before granting, unlike `ocr_grant_asset`'s: by the time this runs,
/// `path` has already round-tripped through a successful `image_convert::convert` (so it decoded
/// as a real image) and `output_path` is a file this command just wrote itself — both are
/// already known-good, so there is nothing left to validate.
fn grant_asset_access<R: Runtime>(app: &tauri::AppHandle<R>, path: &str) -> Result<(), ToolError> {
    use tauri::Manager;

    let scope = app.asset_protocol_scope();
    let grant = |p: &std::path::Path| {
        scope.allow_file(p).map_err(|err| ToolError {
            code: "image-asset-grant-failed".to_string(),
            message: format!("{}: {err}", p.display()),
            position: None,
            context: None,
        })
    };

    grant(std::path::Path::new(path))?;
    // macOS resolves `/var`/`/tmp` (where a dragged file commonly lands, e.g. Safari/Preview's
    // TemporaryItems) through a `/private/...` symlink; granting only the literal path can miss
    // the canonicalised form the asset protocol actually checks against. Same fix
    // `ocr_grant_asset` already carries, for the identical reason.
    if let Ok(canonical) = std::fs::canonicalize(path)
        && canonical != std::path::Path::new(path)
    {
        grant(&canonical)?;
    }
    Ok(())
}

/// AC20's IPC shape: one nested object instead of three flat parameters, which also keeps
/// `image_convert` under clippy's argument-count lint without an `#[allow]`. `width`/`height`
/// stay strings all the way from the view's two text fields into `ResizeRequest` (AC22).
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeArgs {
    width: String,
    height: String,
    allow_upscale: bool,
}

/// AC20/AC22: present (the queue's resize is optional — "Resize (optional)" on the design
/// canvas) becomes a real `ResizeRequest`; absent means no resize step runs at all. Either text
/// field blank is treated the same as the whole thing being absent — there is no sensible
/// "resize by one dimension only" reading of AC20's explicit-width-and-height model.
fn build_resize_request(args: Option<ResizeArgs>) -> Option<ResizeRequest> {
    let args = args?;
    if args.width.trim().is_empty() || args.height.trim().is_empty() {
        return None;
    }
    Some(ResizeRequest {
        width: args.width,
        height: args.height,
        allow_upscale: args.allow_upscale,
    })
}

/// AC27: the queue row needs both byte counts and a percentage-saved figure, and Compare needs a
/// loadable path for both images — so this carries all three rather than a bare filename.
/// `output_path` is the FULL path (not just a filename): the view already has `path` for the
/// original and would otherwise have to re-join `output_dir` + filename itself, guessing at a
/// path separator that differs by OS.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageConvertOutcome {
    output_path: String,
    original_bytes: u64,
    converted_bytes: u64,
}

// AD-15: a converted image can easily exceed the ~64KB JSON-IPC ceiling, so this command writes
// server-side via `fs_helper::write_file_bytes` and returns a small outcome — never the bytes
// themselves — mirroring `pdf_merge`'s exact precedent. AC18: `output_dir`, not `output_path` —
// "Convert all" asks once for a destination folder, and this command computes the actual
// collision-safe filename inside it (see `unique_output_path`) rather than trusting the caller
// to have picked one. Generic over `R: Runtime` for the same reason `ocr_extract_text` is: it
// needs a real `AppHandle` to grant asset-protocol access (AC27), and the bare `tauri::AppHandle`
// alias resolves to the concrete `AppHandle<Wry>`, which `MockRuntime` can't stand in for in tests.
#[tauri::command]
pub async fn image_convert<R: Runtime>(
    path: String,
    target_format: String,
    quality: u8,
    output_dir: String,
    resize: Option<ResizeArgs>,
    background: String,
    app: tauri::AppHandle<R>,
) -> Result<ImageConvertOutcome, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = parse_target_format(&target_format)?;
        let background = parse_hex_color(&background)?;
        let resize = build_resize_request(resize);
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        let converted =
            image_convert::convert(&bytes, target, quality, resize.as_ref(), background)?;
        let output_path = unique_output_path(&output_dir, &path, target)?;
        crate::fs_helper::write_file_bytes(&output_path, &converted)?;
        grant_asset_access(&app, &path)?;
        grant_asset_access(&app, &output_path)?;
        Ok(ImageConvertOutcome {
            original_bytes: bytes.len() as u64,
            converted_bytes: converted.len() as u64,
            output_path,
        })
    })
    .await
    .map_err(map_join_error)?
}

// The one exception to the output-path pattern above: an estimated size is a bare `u64`, well
// under AD-15's ~64KB concern — same reasoning `pdf_extract_text` returning `String` already
// established for "this result is realistically small". Signature unchanged by this story's
// resize/background/AVIF additions (Story 8.9's redesigned queue does not surface a live
// per-item estimate — see the story's Dev Agent Record) — `estimate_size` still reuses `convert`
// directly with no resize and the default white background, so it remains exactly what it was:
// the real byte count `convert` would produce for the same format/quality.
#[tauri::command]
pub async fn image_estimate_size(
    path: String,
    target_format: String,
    quality: u8,
) -> Result<u64, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = parse_target_format(&target_format)?;
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        image_convert::estimate_size(&bytes, target, quality, None, [255, 255, 255])
    })
    .await
    .map_err(map_join_error)?
}

/// AC15's per-file outcome: one bad file in a drop must not fail the whole batch, so this never
/// propagates a single file's failure with `?` the way `pdf_open_dropped` does — a deliberate
/// divergence from that precedent, not an oversight. Every path gets an entry; `error` is set
/// instead of the whole command returning `Err`.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageIngestOutcome {
    path: String,
    width: Option<u32>,
    height: Option<u32>,
    error: Option<ToolError>,
}

// Render review 2026-09-15: the queue row shipped with a generic file icon standing in for a
// real thumbnail, and the developer's read on seeing it live was that a bare "Waiting…" chip
// with no picture of the actual file felt broken, not merely plain. Granting asset access at
// INGEST time — not just after conversion, which `image_convert` already did — is what lets the
// view render a real `<img :src="convertFileSrc(item.path)">` the moment a file is queued,
// before the user ever clicks Convert. `open()`'s own picker already adds its selections to the
// asset-protocol scope automatically (confirmed against `@tauri-apps/plugin-dialog`'s own doc
// comment); a drop does not go through that dialog at all, so this is the one path that actually
// needs it — granting for an already-granted picker path is simply a harmless no-op.
fn ingest_one<R: Runtime>(app: &tauri::AppHandle<R>, path: &str) -> ImageIngestOutcome {
    let result = check_file_size(path)
        .and_then(|()| crate::fs_helper::read_file_bytes(path))
        .and_then(|bytes| image_convert::probe(&bytes));
    match result {
        Ok((width, height)) => match grant_asset_access(app, path) {
            Ok(()) => ImageIngestOutcome {
                path: path.to_string(),
                width: Some(width),
                height: Some(height),
                error: None,
            },
            Err(error) => ImageIngestOutcome {
                path: path.to_string(),
                width: None,
                height: None,
                error: Some(error),
            },
        },
        Err(error) => ImageIngestOutcome {
            path: path.to_string(),
            width: None,
            height: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub async fn image_ingest_dropped<R: Runtime>(
    paths: Vec<String>,
    app: tauri::AppHandle<R>,
) -> Result<Vec<ImageIngestOutcome>, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(paths.iter().map(|path| ingest_one(&app, path)).collect())
    })
    .await
    .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "image-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_builder, mock_context, noop_assets};

    // Same pattern `ocr.rs`'s own test module established: `image_convert` needs a real
    // `AppHandle` to grant asset access, and being generic over `R: Runtime` lets a mock one
    // stand in — no IPC/ACL round trip needed, called directly like every other command's tests.
    fn mock_app_handle() -> tauri::AppHandle<tauri::test::MockRuntime> {
        mock_builder()
            .build(mock_context(noop_assets()))
            .expect("failed to build mock app")
            .handle()
            .clone()
    }

    // Minimal valid in-test PNG fixture builder — same rationale as umbra-core's own
    // image_convert.rs test module (cheaper to maintain than a checked-in binary fixture). This
    // crate's tests only need "a real file exists and round-trips through the command," not
    // exhaustive core-logic coverage — that's umbra-core's own image_convert.rs test module's job.
    fn generate_test_png_bytes(width: u32, height: u32) -> Vec<u8> {
        let image = image::ImageBuffer::from_fn(width, height, |x, y| {
            image::Rgb([(x % 256) as u8, (y % 256) as u8, 64u8])
        });
        let mut bytes = Vec::new();
        image::DynamicImage::ImageRgb8(image)
            .write_to(
                &mut std::io::Cursor::new(&mut bytes),
                image::ImageFormat::Png,
            )
            .unwrap();
        bytes
    }

    fn temp_file_path(name: &str) -> String {
        std::env::temp_dir()
            .join(format!("umbra-image-cmd-{}-{name}", std::process::id()))
            .to_str()
            .unwrap()
            .to_string()
    }

    fn temp_dir_path(name: &str) -> String {
        let dir =
            std::env::temp_dir().join(format!("umbra-image-cmd-dir-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.to_str().unwrap().to_string()
    }

    #[tokio::test]
    async fn image_convert_command_converts_a_real_file_across_all_target_formats() {
        let path = temp_file_path("convert-source.png");
        std::fs::write(&path, generate_test_png_bytes(16, 16)).unwrap();
        let output_dir = temp_dir_path("all-formats");

        for format in ["png", "jpeg", "webp", "avif"] {
            let outcome = image_convert(
                path.clone(),
                format.to_string(),
                80,
                output_dir.clone(),
                None,
                "#ffffff".to_string(),
                mock_app_handle(),
            )
            .await
            .unwrap();

            let output_bytes = std::fs::read(&outcome.output_path).unwrap();
            assert_eq!(outcome.converted_bytes, output_bytes.len() as u64);
            assert!(outcome.original_bytes > 0);
            let format_matches = match format {
                "avif" => image::guess_format(&output_bytes).unwrap() == image::ImageFormat::Avif,
                _ => {
                    let decoded = image::load_from_memory(&output_bytes).unwrap();
                    decoded.width() == 16 && decoded.height() == 16
                }
            };
            assert!(
                format_matches,
                "unexpected output for target format {format}"
            );
        }

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir_all(&output_dir).unwrap();
    }

    #[tokio::test]
    async fn image_convert_command_resizes_when_both_fields_are_given() {
        let path = temp_file_path("convert-resize-source.png");
        std::fs::write(&path, generate_test_png_bytes(80, 40)).unwrap();
        let output_dir = temp_dir_path("resize");

        let outcome = image_convert(
            path.clone(),
            "png".to_string(),
            80,
            output_dir.clone(),
            Some(ResizeArgs {
                width: "20".to_string(),
                height: "20".to_string(),
                allow_upscale: true,
            }),
            "#ffffff".to_string(),
            mock_app_handle(),
        )
        .await
        .unwrap();

        let output_bytes = std::fs::read(&outcome.output_path).unwrap();
        let decoded = image::load_from_memory(&output_bytes).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (20, 20));

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir_all(&output_dir).unwrap();
    }

    #[tokio::test]
    async fn image_convert_command_leaves_dimensions_unchanged_when_resize_fields_are_blank() {
        let path = temp_file_path("convert-no-resize-source.png");
        std::fs::write(&path, generate_test_png_bytes(30, 20)).unwrap();
        let output_dir = temp_dir_path("no-resize");

        let outcome = image_convert(
            path.clone(),
            "png".to_string(),
            80,
            output_dir.clone(),
            None,
            "#ffffff".to_string(),
            mock_app_handle(),
        )
        .await
        .unwrap();

        let output_bytes = std::fs::read(&outcome.output_path).unwrap();
        let decoded = image::load_from_memory(&output_bytes).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (30, 20));

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir_all(&output_dir).unwrap();
    }

    #[tokio::test]
    async fn image_convert_command_auto_suffixes_a_colliding_output_name() {
        let path = temp_file_path("convert-collide-source.png");
        std::fs::write(&path, generate_test_png_bytes(8, 8)).unwrap();
        let output_dir = temp_dir_path("collide");

        let first = image_convert(
            path.clone(),
            "png".to_string(),
            80,
            output_dir.clone(),
            None,
            "#ffffff".to_string(),
            mock_app_handle(),
        )
        .await
        .unwrap();
        let second = image_convert(
            path.clone(),
            "png".to_string(),
            80,
            output_dir.clone(),
            None,
            "#ffffff".to_string(),
            mock_app_handle(),
        )
        .await
        .unwrap();

        assert_ne!(first.output_path, second.output_path);
        assert!(
            second.output_path.contains("(2)"),
            "expected an auto-suffixed name, got {}",
            second.output_path
        );

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir_all(&output_dir).unwrap();
    }

    #[tokio::test]
    async fn image_convert_command_rejects_an_invalid_background_color() {
        let path = temp_file_path("convert-bad-color-source.png");
        std::fs::write(&path, generate_test_png_bytes(8, 8)).unwrap();
        let output_dir = temp_dir_path("bad-color");

        let err = image_convert(
            path.clone(),
            "jpeg".to_string(),
            80,
            output_dir.clone(),
            None,
            "not-a-color".to_string(),
            mock_app_handle(),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "image-invalid-background-color");

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir_all(&output_dir).unwrap();
    }

    #[tokio::test]
    async fn image_estimate_size_command_matches_a_direct_core_call_on_the_same_input() {
        let path = temp_file_path("estimate-source.png");
        let bytes = generate_test_png_bytes(20, 20);
        std::fs::write(&path, &bytes).unwrap();

        let estimated = image_estimate_size(path.clone(), "jpeg".to_string(), 50)
            .await
            .unwrap();
        let direct =
            image_convert::estimate_size(&bytes, TargetFormat::Jpeg, 50, None, [255, 255, 255])
                .unwrap();
        assert_eq!(estimated, direct);

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn image_convert_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let path = temp_file_path("convert-oversized.png");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);
        let output_dir = temp_dir_path("oversized");

        let err = image_convert(
            path.clone(),
            "png".to_string(),
            80,
            output_dir.clone(),
            None,
            "#ffffff".to_string(),
            mock_app_handle(),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "image-input-too-large");

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir_all(&output_dir).unwrap();
    }

    #[tokio::test]
    async fn image_convert_command_returns_file_read_error_for_missing_path() {
        let output_dir = temp_dir_path("missing-path");
        let err = image_convert(
            "/nonexistent/path/umbra-test.png".to_string(),
            "png".to_string(),
            80,
            output_dir.clone(),
            None,
            "#ffffff".to_string(),
            mock_app_handle(),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-read-error");

        std::fs::remove_dir_all(&output_dir).unwrap();
    }

    #[tokio::test]
    async fn image_convert_command_rejects_an_invalid_target_format_string() {
        let path = temp_file_path("convert-invalid-format.png");
        std::fs::write(&path, generate_test_png_bytes(8, 8)).unwrap();
        let output_dir = temp_dir_path("invalid-format");

        let err = image_convert(
            path.clone(),
            "gif".to_string(),
            80,
            output_dir.clone(),
            None,
            "#ffffff".to_string(),
            mock_app_handle(),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "image-invalid-target-format");

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir_all(&output_dir).unwrap();
    }

    #[tokio::test]
    async fn image_estimate_size_command_rejects_an_invalid_target_format_string() {
        let path = temp_file_path("estimate-invalid-format.png");
        std::fs::write(&path, generate_test_png_bytes(8, 8)).unwrap();

        let err = image_estimate_size(path.clone(), "gif".to_string(), 80)
            .await
            .unwrap_err();
        assert_eq!(err.code, "image-invalid-target-format");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn image_ingest_dropped_returns_a_per_file_outcome_so_one_bad_file_does_not_fail_the_batch()
     {
        let good_path = temp_file_path("ingest-good.png");
        std::fs::write(&good_path, generate_test_png_bytes(12, 8)).unwrap();
        let bad_path = temp_file_path("ingest-bad.png");
        std::fs::write(&bad_path, b"not an image").unwrap();

        let outcomes =
            image_ingest_dropped(vec![good_path.clone(), bad_path.clone()], mock_app_handle())
                .await
                .unwrap();

        assert_eq!(outcomes.len(), 2);
        assert_eq!(outcomes[0].path, good_path);
        assert_eq!(outcomes[0].width, Some(12));
        assert_eq!(outcomes[0].height, Some(8));
        assert!(outcomes[0].error.is_none());

        assert_eq!(outcomes[1].path, bad_path);
        assert!(outcomes[1].width.is_none());
        assert_eq!(
            outcomes[1].error.as_ref().map(|err| err.code.as_str()),
            Some("image-unsupported-format")
        );

        std::fs::remove_file(&good_path).unwrap();
        std::fs::remove_file(&bad_path).unwrap();
    }

    #[tokio::test]
    async fn image_ingest_dropped_reports_an_oversized_file_without_reading_it() {
        let path = temp_file_path("ingest-oversized.png");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        let outcomes = image_ingest_dropped(vec![path.clone()], mock_app_handle())
            .await
            .unwrap();

        assert_eq!(
            outcomes[0].error.as_ref().map(|err| err.code.as_str()),
            Some("image-input-too-large")
        );

        std::fs::remove_file(&path).unwrap();
    }
}
