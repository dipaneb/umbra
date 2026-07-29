use umbra_core::ToolError;

// Shared, tool-agnostic infrastructure (AD-15): the first consumer is
// Base64 (Story 2.2), but Story 2.5 (hash files) hits the identical
// read/write failure modes against a different tool, hence the
// `"file-*-error"` codes below are not prefixed `base64-*`.

pub fn read_file_bytes(path: &str) -> Result<Vec<u8>, ToolError> {
    std::fs::read(path).map_err(|err| ToolError {
        code: "file-read-error".to_string(),
        message: err.to_string(),
        position: None,
        context: None,
    })
}

pub fn write_file_bytes(path: &str, bytes: &[u8]) -> Result<(), ToolError> {
    std::fs::write(path, bytes).map_err(|err| ToolError {
        code: "file-write-error".to_string(),
        message: err.to_string(),
        position: None,
        context: None,
    })
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
        let err = read_file_bytes("/nonexistent/path/that/does/not/exist").unwrap_err();
        assert_eq!(err.code, "file-read-error");
        assert_eq!(err.position, None);
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
    fn write_file_bytes_maps_unwritable_path_to_file_write_error() {
        let err = write_file_bytes("/nonexistent-dir-umbra/file.bin", &[1u8]).unwrap_err();
        assert_eq!(err.code, "file-write-error");
        assert_eq!(err.position, None);
    }
}
