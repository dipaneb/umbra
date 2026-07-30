use umbra_core::ToolError;
use umbra_core::uuid::{UuidVersion, generate};

#[tauri::command]
pub async fn uuid_generate(version: UuidVersion, count: u32) -> Result<Vec<String>, ToolError> {
    tauri::async_runtime::spawn_blocking(move || generate(version, count))
        .await
        .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "uuid-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

// This test module deliberately doesn't depend on the `uuid` crate directly
// (src-tauri has no dependency on it — see this story's Dev Notes on AD-1:
// the transformation, and its types, live in umbra-core only). UUID shape is
// checked structurally instead: 36 chars, hyphens at the canonical positions,
// and the version nibble in the expected place.
#[cfg(test)]
mod tests {
    use super::*;

    fn assert_looks_like_uuid(s: &str, expected_version_char: char) {
        assert_eq!(s.len(), 36, "unexpected UUID string length: {s}");
        assert_eq!(s.chars().nth(8), Some('-'));
        assert_eq!(s.chars().nth(13), Some('-'));
        assert_eq!(s.chars().nth(18), Some('-'));
        assert_eq!(s.chars().nth(23), Some('-'));
        assert_eq!(s.chars().nth(14), Some(expected_version_char));
    }

    #[tokio::test]
    async fn uuid_generate_command_returns_one_valid_v4() {
        let result = uuid_generate(UuidVersion::V4, 1).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_looks_like_uuid(&result[0], '4');
    }

    #[tokio::test]
    async fn uuid_generate_command_returns_one_valid_v7() {
        let result = uuid_generate(UuidVersion::V7, 1).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_looks_like_uuid(&result[0], '7');
    }

    #[tokio::test]
    async fn uuid_generate_command_returns_tool_error_for_zero_count() {
        let err = uuid_generate(UuidVersion::V4, 0).await.unwrap_err();
        assert_eq!(err.code, "uuid-count-zero");
    }

    #[tokio::test]
    async fn uuid_generate_command_succeeds_at_1000_count_boundary() {
        let result = uuid_generate(UuidVersion::V7, 1000).await.unwrap();
        assert_eq!(result.len(), 1000);
    }

    #[tokio::test]
    async fn uuid_generate_command_returns_tool_error_over_1000_count() {
        let err = uuid_generate(UuidVersion::V4, 1001).await.unwrap_err();
        assert_eq!(err.code, "uuid-count-too-large");
    }
}
