use crate::ToolError;
use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct HashDigests {
    pub sha256: String,
    pub sha512: String,
    pub md5: String,
    pub sha1: String,
}

// Same rationale as base64.rs's own MAX_INPUT_BYTES (CWE-400 unbounded
// allocation from arbitrarily large pasted text). Each tool module owns its
// own constant rather than sharing another module's, per that file's
// existing convention.
const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

fn to_hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Computes SHA-256, SHA-512, MD5, and SHA-1 digests of `input` simultaneously.
/// Output is always lowercase hex — case is a presentation concern (AD-1),
/// so core produces exactly one canonical output per algorithm.
pub fn compute(input: &str) -> Result<HashDigests, ToolError> {
    let bytes = input.as_bytes();
    if bytes.len() > MAX_INPUT_BYTES {
        return Err(ToolError {
            code: "hash-input-too-large".to_string(),
            message: format!(
                "input is {} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit",
                bytes.len()
            ),
            position: None,
            context: None,
        });
    }

    Ok(HashDigests {
        sha256: to_hex_lower(&Sha256::digest(bytes)),
        sha512: to_hex_lower(&Sha512::digest(bytes)),
        md5: to_hex_lower(&Md5::digest(bytes)),
        sha1: to_hex_lower(&Sha1::digest(bytes)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Fixtures sourced from Python's stdlib `hashlib` (the RustCrypto crates'
    // own published NIST test vectors for these exact inputs), verified this
    // session — not transcribed from memory.
    #[test]
    fn compute_empty_string_matches_known_vectors() {
        let digests = compute("").unwrap();
        assert_eq!(
            digests.sha256,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            digests.sha512,
            "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
        );
        assert_eq!(digests.md5, "d41d8cd98f00b204e9800998ecf8427e");
        assert_eq!(digests.sha1, "da39a3ee5e6b4b0d3255bfef95601890afd80709");
    }

    #[test]
    fn compute_abc_matches_known_vectors() {
        let digests = compute("abc").unwrap();
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

    #[test]
    fn compute_output_lengths_match_each_algorithms_digest_size() {
        let digests = compute("umbra").unwrap();
        assert_eq!(digests.sha256.len(), 64);
        assert_eq!(digests.sha512.len(), 128);
        assert_eq!(digests.md5.len(), 32);
        assert_eq!(digests.sha1.len(), 40);
    }

    #[test]
    fn compute_output_is_always_lowercase() {
        let digests = compute("UMBRA Mixed CASE input").unwrap();
        for value in [
            &digests.sha256,
            &digests.sha512,
            &digests.md5,
            &digests.sha1,
        ] {
            assert_eq!(value, &value.to_lowercase());
        }
    }

    #[test]
    fn compute_rejects_input_over_max_size() {
        let input = "A".repeat(MAX_INPUT_BYTES + 1);
        let err = compute(&input).unwrap_err();
        assert_eq!(err.code, "hash-input-too-large");
        assert_eq!(err.position, None);
    }

    #[test]
    fn compute_succeeds_at_exact_max_size_boundary() {
        let input = "A".repeat(MAX_INPUT_BYTES);
        assert!(compute(&input).is_ok());
    }
}
