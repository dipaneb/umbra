use umbra_core::ToolError;
use umbra_core::image_convert::{self, MAX_INPUT_BYTES, TargetFormat};

// Same shape as pdf.rs's/bucket.rs's own `check_file_size` — this codebase does not share that
// helper across command files, per those files' own established convention.
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

// `target_format` arrives over IPC as a plain string (no serde enum on the umbra-core side to
// keep umbra-core's public API free of IPC-shape concerns) and is parsed here, in the command
// layer — an unrecognized string is a `ToolError`, never a panic or a silent default.
fn parse_target_format(target_format: &str) -> Result<TargetFormat, ToolError> {
    match target_format {
        "png" => Ok(TargetFormat::Png),
        "jpeg" => Ok(TargetFormat::Jpeg),
        "webp" => Ok(TargetFormat::WebP),
        other => Err(ToolError {
            code: "bucket-image-invalid-target-format".to_string(),
            message: format!("unrecognized target format: {other}"),
            position: None,
            context: None,
        }),
    }
}

// AD-15: a converted image can easily exceed the ~64KB JSON-IPC ceiling, so this command takes
// `output_path` (obtained frontend-side via the `save()` dialog) and writes server-side via
// `fs_helper::write_file_bytes`, returning `Result<(), ToolError>` — never the bytes themselves —
// mirroring `bucket_merge_pdfs`'s exact precedent.
#[tauri::command]
pub async fn bucket_convert_image(
    path: String,
    target_format: String,
    quality: u8,
    output_path: String,
) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = parse_target_format(&target_format)?;
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        let converted = image_convert::convert(&bytes, target, quality)?;
        crate::fs_helper::write_file_bytes(&output_path, &converted)
    })
    .await
    .map_err(map_join_error)?
}

// The one exception to the output_path pattern above: an estimated size is a bare `u64`, well
// under AD-15's ~64KB concern — same reasoning `bucket_extract_pdf_text` returning `String`
// already established for "this result is realistically small".
#[tauri::command]
pub async fn bucket_estimate_image_size(
    path: String,
    target_format: String,
    quality: u8,
) -> Result<u64, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = parse_target_format(&target_format)?;
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        image_convert::estimate_size(&bytes, target, quality)
    })
    .await
    .map_err(map_join_error)?
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

    // Minimal valid in-test PNG fixture builder — same rationale as umbra-core's own
    // image_convert.rs test module (cheaper to maintain than a checked-in binary fixture). This
    // crate's tests only need "a real file exists and round-trips through the command," not
    // exhaustive core-logic coverage — that's umbra-core's own image_convert.rs test module's job
    // (Task 5's division of labor).
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

    #[tokio::test]
    async fn bucket_convert_image_command_converts_a_real_file_across_all_target_formats() {
        let path = temp_file_path("convert-source.png");
        std::fs::write(&path, generate_test_png_bytes(16, 16)).unwrap();

        for format in ["png", "jpeg", "webp"] {
            let output_path = temp_file_path(&format!("convert-out.{format}"));

            bucket_convert_image(path.clone(), format.to_string(), 80, output_path.clone())
                .await
                .unwrap();

            let output_bytes = std::fs::read(&output_path).unwrap();
            let decoded = image::load_from_memory(&output_bytes).unwrap();
            assert_eq!(decoded.width(), 16);
            assert_eq!(decoded.height(), 16);

            std::fs::remove_file(&output_path).unwrap();
        }

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_estimate_image_size_command_matches_a_direct_core_call_on_the_same_input() {
        let path = temp_file_path("estimate-source.png");
        let bytes = generate_test_png_bytes(20, 20);
        std::fs::write(&path, &bytes).unwrap();

        let estimated = bucket_estimate_image_size(path.clone(), "jpeg".to_string(), 50)
            .await
            .unwrap();
        let direct = image_convert::estimate_size(&bytes, TargetFormat::Jpeg, 50).unwrap();
        assert_eq!(estimated, direct);

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_convert_image_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let path = temp_file_path("convert-oversized.png");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        let err = bucket_convert_image(
            path.clone(),
            "png".to_string(),
            80,
            temp_file_path("convert-oversized-out.png"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "bucket-input-too-large");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_convert_image_command_returns_file_read_error_for_missing_path() {
        let err = bucket_convert_image(
            "/nonexistent/path/umbra-test.png".to_string(),
            "png".to_string(),
            80,
            temp_file_path("convert-missing-out.png"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn bucket_convert_image_command_rejects_an_invalid_target_format_string() {
        let path = temp_file_path("convert-invalid-format.png");
        std::fs::write(&path, generate_test_png_bytes(8, 8)).unwrap();

        let err = bucket_convert_image(
            path.clone(),
            "gif".to_string(),
            80,
            temp_file_path("convert-invalid-format-out.png"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "bucket-image-invalid-target-format");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_estimate_image_size_command_rejects_an_invalid_target_format_string() {
        let path = temp_file_path("estimate-invalid-format.png");
        std::fs::write(&path, generate_test_png_bytes(8, 8)).unwrap();

        let err = bucket_estimate_image_size(path.clone(), "gif".to_string(), 80)
            .await
            .unwrap_err();
        assert_eq!(err.code, "bucket-image-invalid-target-format");

        std::fs::remove_file(&path).unwrap();
    }
}
