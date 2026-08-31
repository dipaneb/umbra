use umbra_core::ToolError;
use umbra_core::uuid::{UuidVersion, generate};

#[tauri::command]
pub async fn uuid_generate(version: UuidVersion, count: u32) -> Result<Vec<String>, ToolError> {
    tauri::async_runtime::spawn_blocking(move || generate(version, count))
        .await
        .map_err(map_join_error)?
}

/// Story 8.3 (AC14): write an already-built export blob (`.txt` / `.csv` /
/// `.json` — the serialisation is view-side, AD-1) to a user-chosen path.
/// The only work that must cross into Rust is the filesystem write, routed
/// through the shared atomic helper (AD-15). AD-3 `Result<_, ToolError>`,
/// AD-4 `spawn_blocking`.
#[tauri::command]
pub async fn uuid_export(content: String, path: String) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::fs_helper::write_file_bytes(&path, content.as_bytes())
    })
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

    #[tokio::test]
    async fn uuid_export_command_writes_the_blob_verbatim() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("umbra-uuid-export-{}.txt", std::process::id()));
        let path = path.to_str().unwrap().to_string();
        let blob = "550e8400-e29b-41d4-a716-446655440000\n9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d\n";

        uuid_export(blob.to_string(), path.clone()).await.unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), blob);
        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn uuid_export_command_maps_an_unwritable_path_to_file_write_error() {
        let err = uuid_export(
            "x".to_string(),
            "/nonexistent-dir-umbra/uuids.txt".to_string(),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-write-error");
    }
}
