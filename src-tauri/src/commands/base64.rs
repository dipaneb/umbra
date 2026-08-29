use umbra_core::ToolError;
use umbra_core::base64::{
    DataUri, LineWrap, Sniff, decode_bytes, encode, encode_bytes, parse_data_uri, sniff,
};

// A dropped file's *encoded* Base64 text is what crosses IPC back to the
// renderer and lands in a plain `<textarea>` — unlike `MAX_INPUT_BYTES`
// (umbra-core's base64.rs, 100MB, sized for pasted text), that output has to
// stay small enough for the UI to render without stalling. Deliberately
// smaller and scoped to this command, not `fs_helper`'s tool-agnostic
// `read_file_bytes` — Story 2.5 (hash files) reads arbitrarily large files
// too, but a hash's output size doesn't depend on its input size the way
// Base64 encoding's does.
const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;

fn check_file_size(path: &str) -> Result<(), ToolError> {
    let len = std::fs::metadata(path)
        .map_err(|err| ToolError {
            code: "file-read-error".to_string(),
            message: format!("{path}: {err}"),
            position: None,
            context: None,
        })?
        .len();
    if len > MAX_FILE_BYTES {
        return Err(ToolError {
            code: "base64-input-too-large".to_string(),
            message: format!(
                "file is {len} bytes, which exceeds the {MAX_FILE_BYTES}-byte limit for Base64 encoding"
            ),
            position: None,
            context: None,
        });
    }
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn base64_encode(
    input: String,
    url_safe: bool,
    wrap: Option<LineWrap>,
) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || encode(&input, url_safe, wrap))
        .await
        .map_err(map_join_error)?
}

#[tauri::command]
pub async fn base64_decode(input: String) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || umbra_core::base64::decode(&input))
        .await
        .map_err(map_join_error)?
}

/// Story 8.2 slice 3: decode + identify what the payload is, for the view's
/// one contextual line (AD-4 `spawn_blocking`, AD-3 `Result<_, ToolError>`).
#[tauri::command]
pub async fn base64_sniff(input: String) -> Result<Sniff, ToolError> {
    tauri::async_runtime::spawn_blocking(move || sniff(&input))
        .await
        .map_err(map_join_error)?
}

/// Story 8.2 slice 4: split a `data:` URI into its MIME type and Base64
/// payload so the view can preview an image or feed the payload to `sniff`
/// (AD-3 / AD-4, AC12).
#[tauri::command]
pub async fn base64_parse_data_uri(input: String) -> Result<DataUri, ToolError> {
    tauri::async_runtime::spawn_blocking(move || parse_data_uri(&input))
        .await
        .map_err(map_join_error)?
}

/// A dropped file's extension → a MIME type for the data-URI builder's
/// pre-selection (AC11). `None` for an unrecognized / missing extension.
fn mime_from_path(path: &str) -> Option<String> {
    let ext = std::path::Path::new(path)
        .extension()?
        .to_str()?
        .to_ascii_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "json" => "application/json",
        "zip" => "application/zip",
        "gz" => "application/gzip",
        "txt" => "text/plain",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" => "text/javascript",
        "wasm" => "application/wasm",
        "woff2" => "font/woff2",
        _ => return None,
    };
    Some(mime.to_string())
}

/// Story 8.2: what a dropped file turns into. A drop carries the current
/// direction — a file dropped while **Encoding** is encoded; one dropped
/// while **Decoding** is read as text for the input box (so the existing
/// live decode/`sniff` pipeline takes over), unless it isn't text at all
/// (a real binary file), which the view explains rather than silently
/// encoding. AD-3 `Result<_, ToolError>`, AD-4 `spawn_blocking`.
#[derive(Debug, serde::Serialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum Ingest {
    /// Encode direction: the file's bytes, Base64-encoded. `mime` is guessed
    /// from the extension for the data-URI builder (AC11); `None` if unknown.
    Encoded { value: String, mime: Option<String> },
    /// Decode direction: the file's UTF-8 contents, for the input box.
    Text { value: String },
    /// Decode direction, but the file isn't UTF-8 text — nothing to decode.
    NotText,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn base64_ingest_file(
    path: String,
    url_safe: bool,
    decode: bool,
    wrap: Option<LineWrap>,
) -> Result<Ingest, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        // Checked via metadata, before the file is read, so an oversized
        // file is rejected without ever being materialized in memory.
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        if !decode {
            return Ok(Ingest::Encoded {
                value: encode_bytes(&bytes, url_safe, wrap)?,
                mime: mime_from_path(&path),
            });
        }
        Ok(match String::from_utf8(bytes) {
            Ok(text) => Ingest::Text { value: text },
            Err(_) => Ingest::NotText,
        })
    })
    .await
    .map_err(map_join_error)?
}

#[tauri::command]
pub async fn base64_decode_to_file(input: String, path: String) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = decode_bytes(&input)?;
        crate::fs_helper::write_file_bytes(&path, &bytes)
    })
    .await
    .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "base64-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn base64_encode_command_produces_standard_output() {
        let result = base64_encode("hello".to_string(), false, None)
            .await
            .unwrap();
        assert_eq!(result, "aGVsbG8=");
    }

    #[tokio::test]
    async fn base64_encode_command_line_wraps_when_asked() {
        let result = base64_encode("x".repeat(60), false, Some(LineWrap::Col64))
            .await
            .unwrap();
        assert_eq!(
            result.split('\n').map(str::len).collect::<Vec<_>>(),
            [64, 16]
        );
    }

    #[tokio::test]
    async fn base64_encode_command_produces_url_safe_output() {
        let result = base64_encode(">>>".to_string(), true, None).await.unwrap();
        assert_eq!(result, "Pj4-");
    }

    #[tokio::test]
    async fn base64_decode_command_decodes_valid_input() {
        let result = base64_decode("aGVsbG8=".to_string()).await.unwrap();
        assert_eq!(result, "hello");
    }

    #[tokio::test]
    async fn base64_decode_command_returns_tool_error_for_malformed_input() {
        let err = base64_decode("not valid base64!!!".to_string())
            .await
            .unwrap_err();
        assert_eq!(err.code, "base64-invalid-char");
    }

    #[tokio::test]
    async fn base64_sniff_command_identifies_decoded_text() {
        // "dGVzdA==" decodes to "test".
        let result = base64_sniff("dGVzdA==".to_string()).await.unwrap();
        assert_eq!(
            result,
            Sniff::Text {
                text: "test".to_string()
            }
        );
    }

    #[tokio::test]
    async fn base64_sniff_command_returns_tool_error_for_non_base64() {
        let err = base64_sniff("not valid base64!!!".to_string())
            .await
            .unwrap_err();
        assert_eq!(err.code, "base64-invalid-char");
    }

    #[tokio::test]
    async fn base64_parse_data_uri_command_splits_mime_and_payload() {
        let result = base64_parse_data_uri("data:image/png;base64,iVBORw0KGgo=".to_string())
            .await
            .unwrap();
        assert_eq!(result.mime, "image/png");
        assert_eq!(result.payload, "iVBORw0KGgo=");
    }

    #[tokio::test]
    async fn base64_parse_data_uri_command_returns_a_malformed_error_for_a_plain_string() {
        let err = base64_parse_data_uri("just some text".to_string())
            .await
            .unwrap_err();
        assert_eq!(err.code, "base64-data-uri-malformed");
    }

    #[tokio::test]
    async fn map_join_error_produces_base64_internal_tool_error_on_panic() {
        let err = tauri::async_runtime::spawn_blocking(|| {
            panic!("boom");
        })
        .await
        .unwrap_err();

        let tool_err = map_join_error(err);
        assert_eq!(tool_err.code, "base64-internal");
    }

    fn temp_file_path(name: &str) -> String {
        std::env::temp_dir()
            .join(format!("umbra-base64-cmd-{}-{name}", std::process::id()))
            .to_str()
            .unwrap()
            .to_string()
    }

    #[tokio::test]
    async fn base64_ingest_file_encodes_a_real_file_in_the_encode_direction() {
        let path = temp_file_path("encode.bin");
        std::fs::write(&path, [0xffu8, 0xfe, 0x00, 0x01]).unwrap();

        let result = base64_ingest_file(path.clone(), false, false, None)
            .await
            .unwrap();
        assert!(matches!(result, Ingest::Encoded { value, .. } if value == "//4AAQ=="));

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn base64_ingest_file_guesses_the_mime_from_the_extension_for_the_builder() {
        let path = temp_file_path("logo.png");
        std::fs::write(&path, [0x89u8, 0x50, 0x4e, 0x47]).unwrap();

        let result = base64_ingest_file(path.clone(), false, false, None)
            .await
            .unwrap();
        assert!(
            matches!(result, Ingest::Encoded { mime, .. } if mime.as_deref() == Some("image/png"))
        );

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn base64_ingest_file_returns_a_text_file_verbatim_in_the_decode_direction() {
        let path = temp_file_path("b64.txt");
        std::fs::write(&path, "aGVsbG8=\n").unwrap();

        let result = base64_ingest_file(path.clone(), false, true, None)
            .await
            .unwrap();
        assert!(matches!(result, Ingest::Text { value } if value == "aGVsbG8=\n"));

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn base64_ingest_file_reports_not_text_for_a_binary_file_in_the_decode_direction() {
        let path = temp_file_path("binary.bin");
        std::fs::write(&path, [0xffu8, 0xfe, 0x00, 0x01]).unwrap();

        let result = base64_ingest_file(path.clone(), false, true, None)
            .await
            .unwrap();
        assert!(matches!(result, Ingest::NotText));

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn base64_ingest_file_returns_file_read_error_for_missing_path() {
        let err = base64_ingest_file(
            "/nonexistent/path/umbra-test".to_string(),
            false,
            false,
            None,
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn base64_ingest_file_rejects_a_file_over_the_size_limit_without_reading_it() {
        let path = temp_file_path("oversized.bin");
        let over_limit = vec![0u8; (MAX_FILE_BYTES + 1) as usize];
        std::fs::write(&path, &over_limit).unwrap();

        let err = base64_ingest_file(path.clone(), false, false, None)
            .await
            .unwrap_err();
        assert_eq!(err.code, "base64-input-too-large");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn base64_decode_to_file_command_writes_decoded_bytes() {
        let path = temp_file_path("decode.bin");

        base64_decode_to_file("//4AAQ==".to_string(), path.clone())
            .await
            .unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), vec![0xff, 0xfe, 0x00, 0x01]);

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn base64_decode_to_file_command_returns_tool_error_for_malformed_input() {
        let path = temp_file_path("decode-invalid.bin");
        let err = base64_decode_to_file("not valid base64!!!".to_string(), path)
            .await
            .unwrap_err();
        assert_eq!(err.code, "base64-invalid-char");
    }
}
