use crate::{Position, ToolError};
use base64::{
    DecodeError, Engine as _, alphabet,
    engine::{
        DecodePaddingMode,
        general_purpose::{GeneralPurpose, GeneralPurposeConfig, STANDARD, URL_SAFE},
    },
};

// Same rationale and value as json.rs's MAX_INPUT_BYTES (CWE-400 unbounded
// allocation): a pasted Base64 blob (e.g. an embedded data URI) can be very
// large even without going through the file-drop path. Each tool module
// owns its own constant rather than sharing json.rs's, per that file's
// existing convention.
const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

// The premade `STANDARD`/`URL_SAFE` engines require canonical padding and
// reject unpadded input with `DecodeError::InvalidPadding` — but unpadded
// Base64URL is the norm for real-world tokens (e.g. JWT segments), so decode
// uses these custom-configured engines instead, tolerant of either.
const DECODE_CONFIG: GeneralPurposeConfig =
    GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent);
const STANDARD_DECODER: GeneralPurpose = GeneralPurpose::new(&alphabet::STANDARD, DECODE_CONFIG);
const URL_SAFE_DECODER: GeneralPurpose = GeneralPurpose::new(&alphabet::URL_SAFE, DECODE_CONFIG);

fn check_input_size(input: &str) -> Result<(), ToolError> {
    if input.len() > MAX_INPUT_BYTES {
        return Err(ToolError {
            code: "base64-input-too-large".to_string(),
            message: format!(
                "input is {} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit",
                input.len()
            ),
            position: None,
            context: None,
        });
    }
    Ok(())
}

/// Encodes `input`'s UTF-8 bytes as Base64. Infallible: any `&str`'s bytes
/// are valid encoder input.
pub fn encode(input: &str, url_safe: bool) -> String {
    if url_safe {
        URL_SAFE.encode(input.as_bytes())
    } else {
        STANDARD.encode(input.as_bytes())
    }
}

/// Decodes `input` as Base64, auto-detecting standard vs. URL-safe alphabet
/// and tolerating both padded and unpadded input, then validates the
/// decoded bytes are valid UTF-8.
pub fn decode(input: &str) -> Result<String, ToolError> {
    check_input_size(input)?;

    // The standard and URL-safe alphabets share every character except '+'/'/'
    // (standard) vs '-'/'_' (URL-safe); presence of either URL-safe-only
    // character is enough to pick that engine, and pure-alphanumeric input
    // decodes identically either way.
    let url_safe = input.contains('-') || input.contains('_');
    let bytes = if url_safe {
        URL_SAFE_DECODER.decode(input)
    } else {
        STANDARD_DECODER.decode(input)
    }
    .map_err(map_decode_error)?;

    String::from_utf8(bytes).map_err(|err| ToolError {
        code: "base64-not-utf8".to_string(),
        message: err.to_string(),
        position: None,
        context: None,
    })
}

fn map_decode_error(err: DecodeError) -> ToolError {
    let position = match err {
        DecodeError::InvalidByte(offset, _) | DecodeError::InvalidLastSymbol { offset, .. } => {
            Some(Position::ByteOffset {
                offset: offset as u64,
            })
        }
        // `InvalidLength`/`InvalidPadding` have no single meaningful byte
        // location; `message` explains the failure instead.
        DecodeError::InvalidLength(_) | DecodeError::InvalidPadding => None,
    };
    ToolError {
        code: "base64-invalid".to_string(),
        message: err.to_string(),
        position,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_standard_round_trips_through_decode() {
        let encoded = encode("hello world", false);
        assert_eq!(decode(&encoded).unwrap(), "hello world");
    }

    #[test]
    fn encode_url_safe_round_trips_through_decode() {
        let encoded = encode("hello world", true);
        assert_eq!(decode(&encoded).unwrap(), "hello world");
    }

    #[test]
    fn decode_known_good_standard_fixture_with_plus_char() {
        // ">>>" (0x3E * 3) is a hand-verified RFC 4648 style fixture whose
        // standard encoding lands on the '+' alphabet character.
        assert_eq!(decode("Pj4+").unwrap(), ">>>");
    }

    #[test]
    fn decode_known_good_url_safe_fixture_with_dash_char() {
        // Same bytes as above, encoded with the URL-safe alphabet: '+' -> '-'.
        assert_eq!(decode("Pj4-").unwrap(), ">>>");
    }

    #[test]
    fn decode_unpadded_standard_input_succeeds() {
        // "aGVsbG8=" is the well-known padded standard encoding of "hello";
        // stripping the trailing '=' must still decode cleanly.
        assert_eq!(decode("aGVsbG8").unwrap(), "hello");
    }

    #[test]
    fn decode_unpadded_url_safe_input_succeeds() {
        // Encode "hello?" with the URL-safe alphabet, then strip padding.
        let padded = encode("hello?", true);
        let unpadded = padded.trim_end_matches('=');
        assert!(unpadded.contains('_') || unpadded.contains('-'));
        assert_eq!(decode(unpadded).unwrap(), "hello?");
    }

    #[test]
    fn decode_invalid_character_returns_base64_invalid_with_byte_offset() {
        // '!' at index 4 is the first byte outside either alphabet.
        let err = decode("abcd!").unwrap_err();
        assert_eq!(err.code, "base64-invalid");
        assert_eq!(err.position, Some(Position::ByteOffset { offset: 4 }));
    }

    #[test]
    fn decode_non_utf8_bytes_returns_distinct_error_not_lossy_text() {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        // 0xff 0xfe decodes cleanly as Base64 but is not valid UTF-8.
        let encoded = STANDARD.encode([0xffu8, 0xfe]);
        let err = decode(&encoded).unwrap_err();
        assert_eq!(err.code, "base64-not-utf8");
    }

    #[test]
    fn decode_rejects_input_over_max_size() {
        let input = "A".repeat(MAX_INPUT_BYTES + 1);
        let err = decode(&input).unwrap_err();
        assert_eq!(err.code, "base64-input-too-large");
        assert_eq!(err.position, None);
    }
}
