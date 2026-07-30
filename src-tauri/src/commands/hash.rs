use umbra_core::ToolError;
use umbra_core::hash::{HashDigests, compute};

#[tauri::command]
pub async fn hash_compute(input: String) -> Result<HashDigests, ToolError> {
    tauri::async_runtime::spawn_blocking(move || compute(&input))
        .await
        .map_err(map_join_error)?
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
}
