use umbra_core::ToolError;
use umbra_core::hash::{
    ALL_ALGORITHMS, Algorithm, DigestEntry, MAX_INPUT_BYTES, compute, compute_bytes,
};

// A caller can never legitimately request more distinct algorithms than
// exist — a request longer than this is either duplicated or a malformed/
// hostile IPC call bypassing the UI's checkbox ceiling. Rejected before any
// work happens, same CWE-400 family as MAX_INPUT_BYTES.
fn check_algorithm_count(algorithms: &[Algorithm]) -> Result<(), ToolError> {
    if algorithms.len() > ALL_ALGORITHMS.len() {
        return Err(ToolError {
            code: "hash-too-many-algorithms".to_string(),
            message: format!(
                "requested {} algorithms, which exceeds the {} known algorithms",
                algorithms.len(),
                ALL_ALGORITHMS.len()
            ),
            position: None,
            context: None,
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn hash_compute(
    input: String,
    algorithms: Vec<Algorithm>,
) -> Result<Vec<DigestEntry>, ToolError> {
    check_algorithm_count(&algorithms)?;
    tauri::async_runtime::spawn_blocking(move || compute(&input, &algorithms))
        .await
        .map_err(map_join_error)?
}

#[tauri::command]
pub async fn hash_compute_file(
    path: String,
    algorithms: Vec<Algorithm>,
) -> Result<Vec<DigestEntry>, ToolError> {
    check_algorithm_count(&algorithms)?;
    if algorithms.is_empty() {
        // Nothing was asked for — skip the (up to 100 MiB) read entirely.
        return Ok(vec![]);
    }
    tauri::async_runtime::spawn_blocking(move || {
        // Checked via metadata, before the file is read, so an oversized
        // file is rejected without ever being materialized in memory (same
        // ordering as base64.rs's own check_file_size).
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        compute_bytes(&bytes, &algorithms)
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

    fn hex_for(entries: &[DigestEntry], algorithm: Algorithm) -> &str {
        &entries
            .iter()
            .find(|e| e.algorithm == algorithm)
            .unwrap_or_else(|| panic!("missing {algorithm:?} entry"))
            .hex
    }

    #[tokio::test]
    async fn hash_compute_command_returns_known_vectors_for_abc() {
        let entries = hash_compute(
            "abc".to_string(),
            vec![
                Algorithm::Sha256,
                Algorithm::Sha512,
                Algorithm::Sha3_256,
                Algorithm::Md5,
                Algorithm::Sha1,
            ],
        )
        .await
        .unwrap();
        assert_eq!(
            hex_for(&entries, Algorithm::Sha256),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            hex_for(&entries, Algorithm::Sha512),
            "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
        );
        assert_eq!(
            hex_for(&entries, Algorithm::Sha3_256),
            "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"
        );
        assert_eq!(
            hex_for(&entries, Algorithm::Md5),
            "900150983cd24fb0d6963f7d28e17f72"
        );
        assert_eq!(
            hex_for(&entries, Algorithm::Sha1),
            "a9993e364706816aba3e25717850c26c9cd0d89d"
        );
    }

    #[tokio::test]
    async fn hash_compute_command_computes_only_the_requested_algorithms() {
        let entries = hash_compute("abc".to_string(), vec![Algorithm::Sha256])
            .await
            .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].algorithm, Algorithm::Sha256);
    }

    #[tokio::test]
    async fn hash_compute_command_returns_tool_error_over_max_size() {
        let input = "A".repeat(100 * 1024 * 1024 + 1);
        let err = hash_compute(input, vec![Algorithm::Sha256])
            .await
            .unwrap_err();
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

        let entries = hash_compute_file(
            path.clone(),
            vec![Algorithm::Sha256, Algorithm::Sha3_256, Algorithm::Md5],
        )
        .await
        .unwrap();
        assert_eq!(
            hex_for(&entries, Algorithm::Sha256),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            hex_for(&entries, Algorithm::Sha3_256),
            "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"
        );
        assert_eq!(
            hex_for(&entries, Algorithm::Md5),
            "900150983cd24fb0d6963f7d28e17f72"
        );

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn hash_compute_file_command_returns_file_read_error_for_missing_path() {
        let err = hash_compute_file(
            "/nonexistent/path/umbra-test".to_string(),
            vec![Algorithm::Sha256],
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn hash_compute_command_rejects_more_algorithms_than_exist() {
        let over = vec![Algorithm::Sha256; ALL_ALGORITHMS.len() + 1];
        let err = hash_compute("abc".to_string(), over).await.unwrap_err();
        assert_eq!(err.code, "hash-too-many-algorithms");
    }

    #[tokio::test]
    async fn hash_compute_file_command_skips_the_read_when_no_algorithms_are_requested() {
        // A nonexistent path proves the file is never touched — an empty
        // algorithm list returns before check_file_size / the read.
        let entries = hash_compute_file("/nonexistent/path/umbra-test".to_string(), vec![])
            .await
            .unwrap();
        assert_eq!(entries, vec![]);
    }

    #[tokio::test]
    async fn hash_compute_file_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let path = temp_file_path("oversized.bin");
        // Sparse file: reports the right size via metadata().len() without
        // allocating real disk/CPU for MAX_INPUT_BYTES + 1 bytes of content.
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        let err = hash_compute_file(path.clone(), vec![Algorithm::Sha256])
            .await
            .unwrap_err();
        assert_eq!(err.code, "hash-input-too-large");

        std::fs::remove_file(&path).unwrap();
    }
}
