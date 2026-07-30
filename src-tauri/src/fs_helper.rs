use umbra_core::ToolError;

// Shared, tool-agnostic infrastructure (AD-15): the first consumer is
// Base64 (Story 2.2), but Story 2.5 (hash files) hits the identical
// read/write failure modes against a different tool, hence the
// `"file-*-error"` codes below are not prefixed `base64-*`.

fn file_error(code: &str, path: &str, err: std::io::Error) -> ToolError {
    ToolError {
        code: code.to_string(),
        message: format!("{path}: {err}"),
        position: None,
        context: None,
    }
}

pub fn read_file_bytes(path: &str) -> Result<Vec<u8>, ToolError> {
    std::fs::read(path).map_err(|err| file_error("file-read-error", path, err))
}

/// Writes `bytes` to `path` via a temp-file-then-rename so a failure partway
/// through the write (disk full, permissions revoked mid-write) can never
/// leave a corrupted partial file at `path` — including when `path` already
/// exists and is being overwritten.
pub fn write_file_bytes(path: &str, bytes: &[u8]) -> Result<(), ToolError> {
    let tmp_path = format!("{path}.umbra-tmp-{}", std::process::id());
    std::fs::write(&tmp_path, bytes).map_err(|err| file_error("file-write-error", path, err))?;
    std::fs::rename(&tmp_path, path).map_err(|err| file_error("file-write-error", path, err))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_file_bytes_reads_written_content() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("umbra-fs-helper-read-{}.bin", std::process::id()));
        let path = path.to_str().unwrap();
        std::fs::write(path, [1u8, 2, 3, 4]).unwrap();

        let bytes = read_file_bytes(path).unwrap();
        assert_eq!(bytes, vec![1, 2, 3, 4]);

        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn read_file_bytes_maps_nonexistent_path_to_file_read_error() {
        let path = "/nonexistent/path/that/does/not/exist";
        let err = read_file_bytes(path).unwrap_err();
        assert_eq!(err.code, "file-read-error");
        assert_eq!(err.position, None);
        assert!(
            err.message.contains(path),
            "message should name the failing path: {}",
            err.message
        );
    }

    #[test]
    fn write_file_bytes_writes_readable_content() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("umbra-fs-helper-write-{}.bin", std::process::id()));
        let path = path.to_str().unwrap();

        write_file_bytes(path, &[5u8, 6, 7]).unwrap();
        assert_eq!(std::fs::read(path).unwrap(), vec![5, 6, 7]);

        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn write_file_bytes_overwrites_an_existing_file_atomically() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!(
            "umbra-fs-helper-overwrite-{}.bin",
            std::process::id()
        ));
        let path = path.to_str().unwrap();

        std::fs::write(path, [0u8, 0, 0]).unwrap();
        write_file_bytes(path, &[9u8, 9]).unwrap();
        assert_eq!(std::fs::read(path).unwrap(), vec![9, 9]);
        // No leftover temp file from the rename step.
        assert!(
            !std::path::Path::new(&format!("{path}.umbra-tmp-{}", std::process::id())).exists()
        );

        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn write_file_bytes_maps_unwritable_path_to_file_write_error() {
        let path = "/nonexistent-dir-umbra/file.bin";
        let err = write_file_bytes(path, &[1u8]).unwrap_err();
        assert_eq!(err.code, "file-write-error");
        assert_eq!(err.position, None);
        assert!(
            err.message.contains(path),
            "message should name the failing path: {}",
            err.message
        );
    }
}
