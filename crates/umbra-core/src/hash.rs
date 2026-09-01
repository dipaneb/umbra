use crate::ToolError;
use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
use sha3::{Sha3_256, Sha3_512};

/// One hash algorithm the tool can compute. The serde rename strings are the
/// wire contract with `src/tools/hash/hashDigests.ts` (hand-synced) and the
/// `hash.*` settings key — keep the three in sync by hand.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum Algorithm {
    #[serde(rename = "sha256")]
    Sha256,
    #[serde(rename = "sha512")]
    Sha512,
    #[serde(rename = "sha3-256")]
    Sha3_256,
    #[serde(rename = "sha3-512")]
    Sha3_512,
    #[serde(rename = "md5")]
    Md5,
    #[serde(rename = "sha1")]
    Sha1,
}

/// Canonical display order. `compute` / `compute_bytes` emit entries in this
/// order regardless of the order (or duplicates) in the requested slice, so
/// the view's result rows never reorder when a checkbox is toggled.
pub const ALL_ALGORITHMS: [Algorithm; 6] = [
    Algorithm::Sha256,
    Algorithm::Sha512,
    Algorithm::Sha3_256,
    Algorithm::Sha3_512,
    Algorithm::Md5,
    Algorithm::Sha1,
];

/// One computed digest: the algorithm and its canonical lowercase-hex string.
/// Case and Base64 are presentation concerns the view applies (AD-1) — core
/// emits exactly one canonical output per algorithm.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct DigestEntry {
    pub algorithm: Algorithm,
    pub hex: String,
}

// Same rationale as base64.rs's own MAX_INPUT_BYTES (CWE-400 unbounded
// allocation from arbitrarily large pasted text). Each tool module owns its
// own constant rather than sharing another module's, per that file's
// existing convention. `pub` so src-tauri's command layer can reuse it for
// the file-size guard (Story 2.5) instead of duplicating the value.
pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

fn to_hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn digest_hex(algorithm: Algorithm, bytes: &[u8]) -> String {
    match algorithm {
        Algorithm::Sha256 => to_hex_lower(&Sha256::digest(bytes)),
        Algorithm::Sha512 => to_hex_lower(&Sha512::digest(bytes)),
        Algorithm::Sha3_256 => to_hex_lower(&Sha3_256::digest(bytes)),
        Algorithm::Sha3_512 => to_hex_lower(&Sha3_512::digest(bytes)),
        Algorithm::Md5 => to_hex_lower(&Md5::digest(bytes)),
        Algorithm::Sha1 => to_hex_lower(&Sha1::digest(bytes)),
    }
}

/// Computes the requested `algorithms` over `bytes`. Output is always
/// lowercase hex; entries come back in `ALL_ALGORITHMS` order (not request
/// order), one per distinct requested algorithm. This is the single hash
/// implementation — `compute` is a thin wrapper over it for the text case.
pub fn compute_bytes(
    bytes: &[u8],
    algorithms: &[Algorithm],
) -> Result<Vec<DigestEntry>, ToolError> {
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

    Ok(ALL_ALGORITHMS
        .iter()
        .filter(|algorithm| algorithms.contains(algorithm))
        .map(|&algorithm| DigestEntry {
            algorithm,
            hex: digest_hex(algorithm, bytes),
        })
        .collect())
}

/// Computes the requested `algorithms` over `input`'s UTF-8 bytes.
pub fn compute(input: &str, algorithms: &[Algorithm]) -> Result<Vec<DigestEntry>, ToolError> {
    compute_bytes(input.as_bytes(), algorithms)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Fixtures sourced from Python's stdlib `hashlib` (the RustCrypto crates'
    // own published NIST test vectors for these exact inputs), verified this
    // session — not transcribed from memory.

    fn hex_of(algorithm: Algorithm, input: &str) -> String {
        let entries = compute(input, &[algorithm]).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].algorithm, algorithm);
        entries[0].hex.clone()
    }

    #[test]
    fn empty_string_matches_known_vectors() {
        assert_eq!(
            hex_of(Algorithm::Sha256, ""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            hex_of(Algorithm::Sha512, ""),
            "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
        );
        assert_eq!(
            hex_of(Algorithm::Sha3_256, ""),
            "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"
        );
        assert_eq!(
            hex_of(Algorithm::Sha3_512, ""),
            "a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26"
        );
        assert_eq!(
            hex_of(Algorithm::Md5, ""),
            "d41d8cd98f00b204e9800998ecf8427e"
        );
        assert_eq!(
            hex_of(Algorithm::Sha1, ""),
            "da39a3ee5e6b4b0d3255bfef95601890afd80709"
        );
    }

    #[test]
    fn abc_matches_known_vectors() {
        assert_eq!(
            hex_of(Algorithm::Sha256, "abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            hex_of(Algorithm::Sha512, "abc"),
            "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
        );
        assert_eq!(
            hex_of(Algorithm::Md5, "abc"),
            "900150983cd24fb0d6963f7d28e17f72"
        );
        assert_eq!(
            hex_of(Algorithm::Sha1, "abc"),
            "a9993e364706816aba3e25717850c26c9cd0d89d"
        );
    }

    #[test]
    fn sha3_matches_published_nist_vectors() {
        // AC9: SHA3-256 / SHA3-512 correctness against the FIPS 202 vectors.
        assert_eq!(
            hex_of(Algorithm::Sha3_256, "abc"),
            "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"
        );
        assert_eq!(
            hex_of(Algorithm::Sha3_512, "abc"),
            "b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0"
        );
    }

    #[test]
    fn output_lengths_match_each_algorithms_digest_size() {
        assert_eq!(hex_of(Algorithm::Sha256, "umbra").len(), 64);
        assert_eq!(hex_of(Algorithm::Sha512, "umbra").len(), 128);
        assert_eq!(hex_of(Algorithm::Sha3_256, "umbra").len(), 64);
        assert_eq!(hex_of(Algorithm::Sha3_512, "umbra").len(), 128);
        assert_eq!(hex_of(Algorithm::Md5, "umbra").len(), 32);
        assert_eq!(hex_of(Algorithm::Sha1, "umbra").len(), 40);
    }

    #[test]
    fn output_is_always_lowercase() {
        let entries = compute("UMBRA Mixed CASE input", &ALL_ALGORITHMS).unwrap();
        for entry in &entries {
            assert_eq!(entry.hex, entry.hex.to_lowercase());
        }
    }

    #[test]
    fn returns_only_the_requested_algorithms_in_canonical_order() {
        // Requested out of order and with a duplicate — the result is still
        // canonical order, deduplicated, one entry per distinct request.
        let entries = compute(
            "abc",
            &[
                Algorithm::Sha1,
                Algorithm::Sha256,
                Algorithm::Sha1,
                Algorithm::Sha3_512,
            ],
        )
        .unwrap();
        let got: Vec<Algorithm> = entries.iter().map(|e| e.algorithm).collect();
        assert_eq!(
            got,
            vec![Algorithm::Sha256, Algorithm::Sha3_512, Algorithm::Sha1]
        );
    }

    #[test]
    fn empty_algorithm_selection_returns_no_entries() {
        assert_eq!(compute("abc", &[]).unwrap(), vec![]);
    }

    #[test]
    fn compute_bytes_matches_compute_for_the_same_utf8_content() {
        assert_eq!(
            compute_bytes("".as_bytes(), &ALL_ALGORITHMS).unwrap(),
            compute("", &ALL_ALGORITHMS).unwrap()
        );
        assert_eq!(
            compute_bytes("abc".as_bytes(), &ALL_ALGORITHMS).unwrap(),
            compute("abc", &ALL_ALGORITHMS).unwrap()
        );
    }

    #[test]
    fn compute_rejects_input_over_max_size() {
        let input = "A".repeat(MAX_INPUT_BYTES + 1);
        let err = compute(&input, &[Algorithm::Sha256]).unwrap_err();
        assert_eq!(err.code, "hash-input-too-large");
        assert_eq!(err.position, None);
    }

    #[test]
    fn compute_succeeds_at_exact_max_size_boundary() {
        let input = "A".repeat(MAX_INPUT_BYTES);
        assert!(compute(&input, &[Algorithm::Sha256]).is_ok());
    }

    #[test]
    fn compute_bytes_rejects_input_over_max_size() {
        let bytes = vec![0u8; MAX_INPUT_BYTES + 1];
        let err = compute_bytes(&bytes, &ALL_ALGORITHMS).unwrap_err();
        assert_eq!(err.code, "hash-input-too-large");
        assert_eq!(err.position, None);
    }

    #[test]
    fn compute_bytes_succeeds_at_exact_max_size_boundary() {
        let bytes = vec![0u8; MAX_INPUT_BYTES];
        assert!(compute_bytes(&bytes, &[Algorithm::Sha256]).is_ok());
    }
}
