use umbra_core::ToolError;
use umbra_core::base64::{decode, decode_bytes, encode, encode_bytes};

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
pub async fn base64_encode(input: String, url_safe: bool) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || encode(&input, url_safe))
        .await
        .map_err(map_join_error)?
}

#[tauri::command]
pub async fn base64_decode(input: String) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || decode(&input))
        .await
        .map_err(map_join_error)?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn base64_encode_file(path: String, url_safe: bool) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        // Checked via metadata, before the file is read, so an oversized
        // file is rejected without ever being materialized in memory.
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        encode_bytes(&bytes, url_safe)
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
        let result = base64_encode("hello".to_string(), false).await.unwrap();
        assert_eq!(result, "aGVsbG8=");
    }

    #[tokio::test]
    async fn base64_encode_command_produces_url_safe_output() {
        let result = base64_encode(">>>".to_string(), true).await.unwrap();
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
        assert_eq!(err.code, "base64-invalid");
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
    async fn base64_encode_file_command_reads_and_encodes_a_real_file() {
        let path = temp_file_path("encode.bin");
        std::fs::write(&path, [0xffu8, 0xfe, 0x00, 0x01]).unwrap();

        let result = base64_encode_file(path.clone(), false).await.unwrap();
        assert_eq!(result, "//4AAQ==");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn base64_encode_file_command_returns_file_read_error_for_missing_path() {
        let err = base64_encode_file("/nonexistent/path/umbra-test".to_string(), false)
            .await
            .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn base64_encode_file_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let path = temp_file_path("oversized.bin");
        let over_limit = vec![0u8; (MAX_FILE_BYTES + 1) as usize];
        std::fs::write(&path, &over_limit).unwrap();

        let err = base64_encode_file(path.clone(), false).await.unwrap_err();
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
        assert_eq!(err.code, "base64-invalid");
    }
}
