use umbra_core::ToolError;
use umbra_core::hash::{HashDigests, MAX_INPUT_BYTES, compute, compute_bytes};

#[tauri::command]
pub async fn hash_compute(input: String) -> Result<HashDigests, ToolError> {
    tauri::async_runtime::spawn_blocking(move || compute(&input))
        .await
        .map_err(map_join_error)?
}

#[tauri::command]
pub async fn hash_compute_file(path: String) -> Result<HashDigests, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        // Checked via metadata, before the file is read, so an oversized
        // file is rejected without ever being materialized in memory (same
        // ordering as base64.rs's own check_file_size).
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        compute_bytes(&bytes)
    })
    .await
    .map_err(map_join_error)?
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
            code: "hash-input-too-large".to_string(),
            message: format!("file is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit"),
            position: None,
            context: None,
        });
    }
    Ok(())
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "hash-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hash_compute_command_returns_known_vectors_for_abc() {
        let digests = hash_compute("abc".to_string()).await.unwrap();
        assert_eq!(
            digests.sha256,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            digests.sha512,
            "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
        );
        assert_eq!(digests.md5, "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(digests.sha1, "a9993e364706816aba3e25717850c26c9cd0d89d");
    }

    #[tokio::test]
    async fn hash_compute_command_returns_tool_error_over_max_size() {
        let input = "A".repeat(100 * 1024 * 1024 + 1);
        let err = hash_compute(input).await.unwrap_err();
        assert_eq!(err.code, "hash-input-too-large");
    }

    fn temp_file_path(name: &str) -> String {
        std::env::temp_dir()
            .join(format!("umbra-hash-cmd-{}-{name}", std::process::id()))
            .to_str()
            .unwrap()
            .to_string()
    }

    #[tokio::test]
    async fn hash_compute_file_command_reads_and_hashes_a_real_file() {
        let path = temp_file_path("abc.bin");
        std::fs::write(&path, "abc").unwrap();

        let digests = hash_compute_file(path.clone()).await.unwrap();
        assert_eq!(
            digests.sha256,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(digests.md5, "900150983cd24fb0d6963f7d28e17f72");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn hash_compute_file_command_returns_file_read_error_for_missing_path() {
        let err = hash_compute_file("/nonexistent/path/umbra-test".to_string())
            .await
            .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn hash_compute_file_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let path = temp_file_path("oversized.bin");
        // Sparse file: reports the right size via metadata().len() without
        // allocating real disk/CPU for MAX_INPUT_BYTES + 1 bytes of content.
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        let err = hash_compute_file(path.clone()).await.unwrap_err();
        assert_eq!(err.code, "hash-input-too-large");

        std::fs::remove_file(&path).unwrap();
    }
}
