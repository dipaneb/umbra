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
//
// Reused unchanged for the file-byte path (Story 2.2): this project has no
// stated file-size requirement beyond FR9's JSON-specific 10 MB bar, so
// reusing this already-reviewed threshold for dropped-file bytes is the
// pragmatic default rather than inventing a new number.
const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

// The premade `STANDARD`/`URL_SAFE` engines require canonical padding and
// reject unpadded input with `DecodeError::InvalidPadding` — but unpadded
// Base64URL is the norm for real-world tokens (e.g. JWT segments), so decode
// uses these custom-configured engines instead, tolerant of either.
const DECODE_CONFIG: GeneralPurposeConfig =
    GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent);
const STANDARD_DECODER: GeneralPurpose = GeneralPurpose::new(&alphabet::STANDARD, DECODE_CONFIG);
const URL_SAFE_DECODER: GeneralPurpose = GeneralPurpose::new(&alphabet::URL_SAFE, DECODE_CONFIG);

fn check_size(len: usize) -> Result<(), ToolError> {
    if len > MAX_INPUT_BYTES {
        return Err(ToolError {
            code: "base64-input-too-large".to_string(),
            message: format!(
                "input is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit"
            ),
            position: None,
            context: None,
        });
    }
    Ok(())
}

/// The column at which encoded output is line-wrapped, if at all (Story 8.2
/// AC13). PEM uses 64, RFC 2045 (MIME) uses 76 — the two widths real-world
/// Base64 blobs are wrapped to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LineWrap {
    Col64,
    Col76,
}

fn wrap_encoded(encoded: String, wrap: Option<LineWrap>) -> String {
    let cols = match wrap {
        None => return encoded,
        Some(LineWrap::Col64) => 64,
        Some(LineWrap::Col76) => 76,
    };
    // Base64 output is pure ASCII, so a byte chunk is always valid UTF-8 and
    // a byte index is a column.
    encoded
        .as_bytes()
        .chunks(cols)
        .map(|c| std::str::from_utf8(c).expect("Base64 output is ASCII"))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Encodes `bytes` as Base64, optionally line-wrapped. This is the single
/// encode implementation — `encode` is a thin wrapper for the text case.
pub fn encode_bytes(
    bytes: &[u8],
    url_safe: bool,
    wrap: Option<LineWrap>,
) -> Result<String, ToolError> {
    check_size(bytes.len())?;
    let encoded = if url_safe {
        URL_SAFE.encode(bytes)
    } else {
        STANDARD.encode(bytes)
    };
    Ok(wrap_encoded(encoded, wrap))
}

/// Encodes `input`'s UTF-8 bytes as Base64, optionally line-wrapped.
pub fn encode(input: &str, url_safe: bool, wrap: Option<LineWrap>) -> Result<String, ToolError> {
    encode_bytes(input.as_bytes(), url_safe, wrap)
}

/// Decodes `input` as Base64, auto-detecting standard vs. URL-safe alphabet
/// and tolerating both padded and unpadded input. Returns raw bytes — a
/// decoded file's content is not expected to be UTF-8 text, so no such
/// validation happens here (contrast `decode`, below).
pub fn decode_bytes(input: &str) -> Result<Vec<u8>, ToolError> {
    check_size(input.len())?;

    // Real-world Base64 is routinely wrapped across lines (PEM, MIME,
    // `openssl base64`) or carries a trailing newline from a clipboard copy;
    // strip whitespace before decoding rather than rejecting otherwise-valid
    // input on it.
    let cleaned: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    let cleaned = cleaned.as_str();

    // The standard and URL-safe alphabets share every character except '+'/'/'
    // (standard) vs '-'/'_' (URL-safe); presence of either URL-safe-only
    // character is enough to pick that engine, and pure-alphanumeric input
    // decodes identically either way.
    let url_safe = cleaned.contains('-') || cleaned.contains('_');
    if url_safe {
        URL_SAFE_DECODER.decode(cleaned)
    } else {
        STANDARD_DECODER.decode(cleaned)
    }
    .map_err(map_decode_error)
}

/// Decodes `input` as Base64, then validates the decoded bytes are valid
/// UTF-8 text.
pub fn decode(input: &str) -> Result<String, ToolError> {
    let bytes = decode_bytes(input)?;

    String::from_utf8(bytes).map_err(|err| ToolError {
        code: "base64-not-utf8".to_string(),
        // Canned English; the shell swaps this for a translated
        // `errors.base64-not-utf8` string, the byte offset rides `position`
        // (AC15).
        message: "the decoded bytes are not valid UTF-8 text".to_string(),
        position: Some(Position::ByteOffset {
            offset: err.utf8_error().valid_up_to() as u64,
        }),
        context: None,
    })
}

/// Maps the `base64` crate's `DecodeError` to a **classified** `base64-*`
/// code (Story 8.2 slice 6 / AC15). Each code's message is a fixed canned
/// sentence with no runtime value baked in — a byte offset, where one
/// exists, rides the structured `position` field — so the shell can swap
/// every one for a translated `errors.<code>` string.
fn map_decode_error(err: DecodeError) -> ToolError {
    let (code, message, position) = match err {
        DecodeError::InvalidByte(offset, _) | DecodeError::InvalidLastSymbol { offset, .. } => (
            "base64-invalid-char",
            "invalid Base64 character",
            Some(Position::ByteOffset {
                offset: offset as u64,
            }),
        ),
        DecodeError::InvalidLength(_) => (
            "base64-invalid-length",
            "the Base64 input is not a valid length",
            None,
        ),
        DecodeError::InvalidPadding => (
            "base64-invalid-padding",
            "the Base64 input has invalid '=' padding",
            None,
        ),
    };
    ToolError {
        code: code.to_string(),
        message: message.to_string(),
        position,
        context: None,
    }
}

/// The MIME type and Base64 payload split out of a `data:` URI (Story 8.2,
/// AC12). Pure: `parse_data_uri` only splits — the view builds the preview
/// and the command decodes the payload from these.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct DataUri {
    pub mime: String,
    /// The Base64 text after `;base64,` — may still carry line wrapping;
    /// downstream (`decode_bytes`, the `<img>` tag) tolerates it.
    pub payload: String,
}

/// `str::strip_suffix`, but comparing the suffix ASCII-case-insensitively.
fn strip_suffix_ci<'a>(s: &'a str, suffix: &str) -> Option<&'a str> {
    let split = s.len().checked_sub(suffix.len())?;
    if !s.is_char_boundary(split) {
        return None;
    }
    let (head, tail) = s.split_at(split);
    tail.eq_ignore_ascii_case(suffix).then_some(head)
}

/// Splits `data:[<mediatype>][;base64],<payload>`. Only the `;base64` form is
/// supported (this is a Base64 tool); a missing `data:` scheme, `,` or
/// `;base64` marker is `base64-data-uri-malformed` — never a crash or a
/// silent pass-through (AC12). Pure — no I/O (AD-1 / AC16).
pub fn parse_data_uri(input: &str) -> Result<DataUri, ToolError> {
    // The data-URI path must honour the same CWE-400 ceiling as every other
    // entry point — a pasted `data:` URI is exactly the "embedded data URI"
    // case `MAX_INPUT_BYTES` was sized for, and the image-preview branch never
    // reaches `decode_bytes`/`check_size` on its own (code review P2).
    check_size(input.len())?;
    let malformed = |why: &str| ToolError {
        code: "base64-data-uri-malformed".to_string(),
        message: format!("not a valid base64 data URI ({why})"),
        position: None,
        context: None,
    };
    // RFC 2397 / RFC 3986: the `data:` scheme and the `;base64` extension
    // token are case-insensitive (code review P7).
    let trimmed = input.trim_start();
    let rest = trimmed
        .get(..5)
        .filter(|prefix| prefix.eq_ignore_ascii_case("data:"))
        .map(|_| &trimmed[5..])
        .ok_or_else(|| malformed("missing the 'data:' scheme"))?;
    let (meta, payload) = rest
        .split_once(',')
        .ok_or_else(|| malformed("missing the ',' before the payload"))?;
    let mediatype = strip_suffix_ci(meta, ";base64")
        .ok_or_else(|| malformed("missing the ';base64' marker"))?;
    // RFC 2397: an omitted mediatype defaults to text/plain.
    let mime = if mediatype.is_empty() {
        "text/plain".to_string()
    } else {
        mediatype.to_string()
    };
    Ok(DataUri {
        mime,
        payload: payload.to_string(),
    })
}

/// A best-effort identification of what a Base64 payload *is*, for the
/// view's one contextual line (Story 8.2, AC9/AC10). Every arm is a
/// candidate the view phrases as "looks like …" and never applies silently
/// (AD-9): a `Jwt` is only read as its segments on an explicit confirm, and
/// every binary arm still offers the raw bytes as a file.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Sniff {
    /// `input` is three `.`-separated segments; the first two are Base64URL
    /// of JSON objects and the first carries an `alg` member (RFC 7515
    /// §4.1.1). `header` / `payload` are those two segments decoded and
    /// pretty-printed; the signature is left untouched.
    Jwt {
        header: String,
        payload: String,
    },
    Png {
        byte_len: usize,
    },
    Pdf {
        byte_len: usize,
    },
    Gzip {
        byte_len: usize,
    },
    Zip {
        byte_len: usize,
    },
    /// Decoded bytes are valid UTF-8 and matched nothing more specific — the
    /// view shows them in the output panel and adds no line.
    Text {
        text: String,
    },
    /// Decoded fine, matched nothing. States only the length.
    Unknown {
        byte_len: usize,
    },
}

/// Identifies what `input` decodes to — first match wins, in the fixed order
/// JWT → PNG / PDF / gzip / zip → valid UTF-8 text → unknown (AC10). Input
/// that is not valid Base64 at all propagates the decode `ToolError` so the
/// view renders it in the error slot, which outranks any detection (AC9).
///
/// Pure: no filesystem, no IPC (AD-1 / AC16).
pub fn sniff(input: &str) -> Result<Sniff, ToolError> {
    // JWT is checked on the raw string, before any whole-string decode: a
    // token's `.` separators make it invalid Base64, so a decode-first path
    // would only ever see the error and never the token.
    if let Some(jwt) = sniff_jwt(input) {
        return Ok(jwt);
    }
    let bytes = decode_bytes(input)?;
    Ok(classify_bytes(bytes))
}

fn sniff_jwt(input: &str) -> Option<Sniff> {
    let segments: Vec<&str> = input.trim().split('.').collect();
    // The signature (segment 3) may be empty for an `alg: "none"` token, but
    // the header and payload never are.
    if segments.len() != 3 || segments[0].is_empty() || segments[1].is_empty() {
        return None;
    }
    let header = jwt_segment_object(segments[0])?;
    let payload = jwt_segment_object(segments[1])?;
    // `alg` is mandatory in a JOSE header (RFC 7515 §4.1.1); requiring it
    // keeps three unrelated dot-joined Base64 strings from being read as a
    // token.
    header.get("alg")?;
    // The signature (3rd) segment is empty for an `alg: "none"` token but must
    // otherwise be Base64URL — a "header.payload.<punctuation>" string whose
    // third part is not even Base64 is not a token (code review DN3).
    if !segments[2].is_empty() && decode_bytes(segments[2]).is_err() {
        return None;
    }
    Some(Sniff::Jwt {
        header: serde_json::to_string_pretty(&header).ok()?,
        payload: serde_json::to_string_pretty(&payload).ok()?,
    })
}

fn jwt_segment_object(segment: &str) -> Option<serde_json::Value> {
    let bytes = decode_bytes(segment).ok()?;
    let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    value.is_object().then_some(value)
}

fn classify_bytes(bytes: Vec<u8>) -> Sniff {
    // A magic-byte identification (PNG / PDF / gzip / zip) still outranks a
    // plain-text reading per AC10's order — but only for payloads that are
    // *not* also valid UTF-8. A real file of any of those types carries
    // non-text bytes past its header, so it still classifies correctly; a
    // plain-text note that merely opens with "%PDF" (or the zip/gzip lead
    // bytes) is not hidden behind a false "looks like a file" reading. This
    // is the same incidental-collision principle as AC10's `dGVzdA==` → Text
    // regression (code review P5).
    let bytes = match String::from_utf8(bytes) {
        Ok(text) => return Sniff::Text { text },
        Err(err) => err.into_bytes(),
    };
    let byte_len = bytes.len();
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        Sniff::Png { byte_len }
    } else if bytes.starts_with(b"%PDF") {
        Sniff::Pdf { byte_len }
    } else if bytes.starts_with(&[0x1F, 0x8B]) {
        Sniff::Gzip { byte_len }
    } else if bytes.starts_with(b"PK\x03\x04") || bytes.starts_with(b"PK\x05\x06") {
        Sniff::Zip { byte_len }
    } else {
        Sniff::Unknown { byte_len }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_standard_round_trips_through_decode() {
        let encoded = encode("hello world", false, None).unwrap();
        assert_eq!(decode(&encoded).unwrap(), "hello world");
    }

    #[test]
    fn encode_url_safe_round_trips_through_decode() {
        let encoded = encode("hello world", true, None).unwrap();
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
        // "<=>?" is 4 bytes (not a multiple of 3, so its encoding carries
        // real '=' padding) AND its standard encoding contains '+'
        // (URL-safe: '-'), so the unpadded form still routes through the
        // URL-safe decoder branch. (Using a fixture whose encoding has no
        // '+'/'/' or already has no padding wouldn't actually distinguish
        // this from a premade, non-tolerant decoder — see the earlier
        // "known_good" fixtures, which cover the alphabet-detection case
        // but not padding tolerance together with it.)
        let padded = encode("<=>?", true, None).unwrap();
        assert_eq!(padded, "PD0-Pw==");
        let unpadded = padded.trim_end_matches('=');
        assert_eq!(decode(unpadded).unwrap(), "<=>?");
    }

    #[test]
    fn decode_invalid_character_returns_base64_invalid_char_with_byte_offset() {
        // '!' at index 4 is the first byte outside either alphabet.
        let err = decode("abcd!").unwrap_err();
        assert_eq!(err.code, "base64-invalid-char");
        assert_eq!(err.position, Some(Position::ByteOffset { offset: 4 }));
    }

    #[test]
    fn decode_classifies_an_invalid_length_distinctly_from_an_invalid_char() {
        // A lone symbol can't form even a partial byte quantum.
        let err = decode("a").unwrap_err();
        assert_eq!(err.code, "base64-invalid-length");
        assert_eq!(err.position, None);
        // A '=' mid-string is an invalid character, not a length problem.
        assert_eq!(decode("aG=k").unwrap_err().code, "base64-invalid-char");
    }

    #[test]
    fn decode_non_utf8_bytes_returns_distinct_error_not_lossy_text() {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        // 0xff 0xfe decodes cleanly as Base64 but is not valid UTF-8; both
        // bytes are invalid, so the valid-UTF-8 prefix is empty (offset 0).
        let encoded = STANDARD.encode([0xffu8, 0xfe]);
        let err = decode(&encoded).unwrap_err();
        assert_eq!(err.code, "base64-not-utf8");
        assert_eq!(err.position, Some(Position::ByteOffset { offset: 0 }));
    }

    #[test]
    fn decode_non_utf8_bytes_reports_offset_after_valid_prefix() {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        // "hi" (valid UTF-8, 2 bytes) followed by 0xff (invalid) — the
        // reported offset should land after the valid prefix, not at 0.
        let encoded = STANDARD.encode([b'h', b'i', 0xffu8]);
        let err = decode(&encoded).unwrap_err();
        assert_eq!(err.code, "base64-not-utf8");
        assert_eq!(err.position, Some(Position::ByteOffset { offset: 2 }));
    }

    #[test]
    fn decode_ignores_trailing_newline() {
        // A trailing newline is close to universal when Base64 is copied
        // from a terminal, file, or editor.
        assert_eq!(decode("aGVsbG8=\n").unwrap(), "hello");
    }

    #[test]
    fn decode_ignores_line_wrapped_input() {
        // PEM/MIME-style line wrapping is common for real-world Base64 blobs.
        let encoded = encode("hello world, this is a longer message", false, None).unwrap();
        let wrapped: String = encoded
            .as_bytes()
            .chunks(8)
            .map(|c| std::str::from_utf8(c).unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        assert_eq!(
            decode(&wrapped).unwrap(),
            "hello world, this is a longer message"
        );
    }

    #[test]
    fn decode_rejects_input_over_max_size() {
        let input = "A".repeat(MAX_INPUT_BYTES + 1);
        let err = decode(&input).unwrap_err();
        assert_eq!(err.code, "base64-input-too-large");
        assert_eq!(err.position, None);
    }

    #[test]
    fn encode_bytes_and_decode_bytes_round_trip_non_utf8_bytes() {
        // This is the core case `decode()` could never previously support:
        // arbitrary binary content, as a real dropped file would contain.
        let bytes = [0xffu8, 0xfe, 0x00, 0x01];
        let encoded = encode_bytes(&bytes, false, None).unwrap();
        assert_eq!(decode_bytes(&encoded).unwrap(), bytes);
    }

    #[test]
    fn encode_bytes_rejects_input_over_max_size() {
        let bytes = vec![0u8; MAX_INPUT_BYTES + 1];
        let err = encode_bytes(&bytes, false, None).unwrap_err();
        assert_eq!(err.code, "base64-input-too-large");
        assert_eq!(err.position, None);
    }

    // --- sniff (Story 8.2 slice 3) ---

    fn jwt_like(header: &str, payload: &str) -> String {
        use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
        format!(
            "{}.{}.{}",
            URL_SAFE_NO_PAD.encode(header),
            URL_SAFE_NO_PAD.encode(payload),
            "c2ln"
        )
    }

    #[test]
    fn sniff_identifies_a_jwt_and_pretty_prints_its_first_two_segments() {
        let token = jwt_like(
            r#"{"alg":"HS256","typ":"JWT"}"#,
            r#"{"sub":"42","admin":true}"#,
        );
        match sniff(&token).unwrap() {
            Sniff::Jwt { header, payload } => {
                assert!(header.contains("\"alg\": \"HS256\""));
                assert!(header.contains('\n')); // pretty-printed
                assert!(payload.contains("\"sub\": \"42\""));
            }
            other => panic!("expected Jwt, got {other:?}"),
        }
    }

    #[test]
    fn sniff_accepts_an_alg_none_token_with_an_empty_signature() {
        use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
        let token = format!(
            "{}.{}.",
            URL_SAFE_NO_PAD.encode(r#"{"alg":"none"}"#),
            URL_SAFE_NO_PAD.encode(r#"{"x":1}"#)
        );
        assert!(matches!(sniff(&token).unwrap(), Sniff::Jwt { .. }));
    }

    #[test]
    fn sniff_does_not_call_three_dotted_json_objects_without_alg_a_jwt() {
        // Header decodes to a JSON object but has no `alg` — not a JOSE
        // header. The `.`s then make the whole string invalid Base64.
        let not_a_token = jwt_like(r#"{"typ":"JWT"}"#, r#"{"x":1}"#);
        assert_eq!(sniff(&not_a_token).unwrap_err().code, "base64-invalid-char");
    }

    fn sniff_bytes(bytes: &[u8]) -> Sniff {
        sniff(&encode_bytes(bytes, false, None).unwrap()).unwrap()
    }

    #[test]
    fn sniff_identifies_png_pdf_gzip_and_zip_by_magic_bytes() {
        // Fixtures carry a non-UTF-8 byte past the magic header, as every real
        // file of these types does — a magic-byte arm only wins when the
        // payload isn't also valid text (AC10 amendment, code review P5).
        assert_eq!(
            sniff_bytes(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]),
            Sniff::Png { byte_len: 6 }
        );
        assert_eq!(
            sniff_bytes(b"%PDF-1.7\n%\xE2\xE3\xCF\xD3"),
            Sniff::Pdf { byte_len: 14 }
        );
        assert_eq!(
            sniff_bytes(&[0x1F, 0x8B, 0x08, 0x00]),
            Sniff::Gzip { byte_len: 4 }
        );
        assert_eq!(
            sniff_bytes(b"PK\x03\x04\x14\x00\xFF"),
            Sniff::Zip { byte_len: 7 }
        );
    }

    #[test]
    fn sniff_reads_text_that_merely_starts_with_a_magic_signature_as_text() {
        // A human-readable note opening with the literal characters "%PDF" is
        // text, not a PDF file — the magic-byte check must not hide it
        // (code review P5; same principle as the `dGVzdA==` regression).
        match sniff(&encode_bytes(b"%PDF is a document format from Adobe", false, None).unwrap())
            .unwrap()
        {
            Sniff::Text { text } => assert_eq!(text, "%PDF is a document format from Adobe"),
            other => panic!("expected Text, got {other:?}"),
        }
    }

    #[test]
    fn sniff_classifies_plain_ascii_that_is_incidentally_valid_base64_as_text_not_binary() {
        // Regression (AC10): "dGVzdA==" is valid Base64 for "test"; it must
        // land on Text, never a false binary guess.
        assert_eq!(
            sniff("dGVzdA==").unwrap(),
            Sniff::Text {
                text: "test".to_string()
            }
        );
    }

    #[test]
    fn sniff_rejects_a_jwt_shape_whose_signature_segment_is_not_base64() {
        use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
        // Valid JOSE header + payload, but the 3rd segment is punctuation —
        // not a token (code review DN3). Falls through to a whole-string
        // decode, which fails on the '.'.
        let shaped = format!(
            "{}.{}.!!!!",
            URL_SAFE_NO_PAD.encode(r#"{"alg":"HS256"}"#),
            URL_SAFE_NO_PAD.encode(r#"{"sub":"1"}"#),
        );
        assert_eq!(sniff(&shaped).unwrap_err().code, "base64-invalid-char");
    }

    #[test]
    fn sniff_classifies_non_utf8_non_magic_bytes_as_unknown_with_a_length() {
        let encoded = encode_bytes(&[0x00, 0x01, 0xFF, 0xFE], false, None).unwrap();
        assert_eq!(sniff(&encoded).unwrap(), Sniff::Unknown { byte_len: 4 });
    }

    #[test]
    fn sniff_propagates_the_decode_error_for_input_that_is_not_base64() {
        let err = sniff("not valid base64!!!").unwrap_err();
        assert_eq!(err.code, "base64-invalid-char");
        assert!(err.position.is_some());
    }

    #[test]
    fn sniff_rejects_input_over_max_size_like_decode_does() {
        let err = sniff(&"A".repeat(MAX_INPUT_BYTES + 1)).unwrap_err();
        assert_eq!(err.code, "base64-input-too-large");
    }

    // --- parse_data_uri (Story 8.2 slice 4) ---

    #[test]
    fn parse_data_uri_splits_the_mime_and_payload() {
        assert_eq!(
            parse_data_uri("data:image/png;base64,iVBORw0KGgo=").unwrap(),
            DataUri {
                mime: "image/png".to_string(),
                payload: "iVBORw0KGgo=".to_string(),
            }
        );
    }

    #[test]
    fn parse_data_uri_defaults_an_omitted_mediatype_to_text_plain() {
        assert_eq!(
            parse_data_uri("data:;base64,aGk=").unwrap().mime,
            "text/plain"
        );
    }

    #[test]
    fn parse_data_uri_keeps_extra_media_parameters_on_the_mime() {
        assert_eq!(
            parse_data_uri("data:text/plain;charset=utf-8;base64,aGk=")
                .unwrap()
                .mime,
            "text/plain;charset=utf-8"
        );
    }

    #[test]
    fn parse_data_uri_rejects_a_string_that_is_not_a_data_uri() {
        assert_eq!(
            parse_data_uri("iVBORw0KGgo=").unwrap_err().code,
            "base64-data-uri-malformed"
        );
    }

    #[test]
    fn parse_data_uri_rejects_a_data_uri_with_no_payload_comma() {
        assert_eq!(
            parse_data_uri("data:image/png;base64").unwrap_err().code,
            "base64-data-uri-malformed"
        );
    }

    #[test]
    fn parse_data_uri_rejects_a_data_uri_that_is_not_base64_encoded() {
        // `data:text/plain,hello` is a valid URI but percent-encoded, not
        // Base64 — this is a Base64 tool.
        assert_eq!(
            parse_data_uri("data:text/plain,hello").unwrap_err().code,
            "base64-data-uri-malformed"
        );
    }

    #[test]
    fn parse_data_uri_matches_the_scheme_and_base64_marker_case_insensitively() {
        // RFC 2397 / 3986: both tokens are case-insensitive (code review P7).
        let parsed = parse_data_uri("DATA:image/png;BASE64,iVBORw0KGgo=").unwrap();
        assert_eq!(parsed.mime, "image/png");
        assert_eq!(parsed.payload, "iVBORw0KGgo=");
    }

    #[test]
    fn parse_data_uri_rejects_input_over_max_size() {
        // The data-URI path honours the same CWE-400 ceiling as decode/sniff
        // (code review P2).
        let huge = format!("data:text/plain;base64,{}", "A".repeat(MAX_INPUT_BYTES));
        assert_eq!(
            parse_data_uri(&huge).unwrap_err().code,
            "base64-input-too-large"
        );
    }

    // --- line wrap on encode (Story 8.2 slice 5 / AC13) ---

    #[test]
    fn encode_with_no_wrap_is_a_single_line() {
        let out = encode(&"x".repeat(60), false, None).unwrap();
        assert!(!out.contains('\n'));
    }

    #[test]
    fn encode_wraps_at_64_and_76_columns() {
        // 60 bytes → 80 Base64 chars.
        let src = "x".repeat(60);
        let line_lens = |s: &str| s.split('\n').map(str::len).collect::<Vec<_>>();

        let at64 = encode(&src, false, Some(LineWrap::Col64)).unwrap();
        assert_eq!(line_lens(&at64), [64, 16]);

        let at76 = encode(&src, false, Some(LineWrap::Col76)).unwrap();
        assert_eq!(line_lens(&at76), [76, 4]);
    }

    #[test]
    fn wrapped_encode_round_trips_through_decode_unchanged() {
        let src = "the quick brown fox jumps over the lazy dog, twice over";
        let wrapped = encode(src, false, Some(LineWrap::Col64)).unwrap();
        assert!(wrapped.contains('\n'));
        assert_eq!(decode(&wrapped).unwrap(), src);
    }

    #[test]
    fn line_wrap_deserializes_from_snake_case() {
        assert_eq!(
            serde_json::from_str::<LineWrap>("\"col64\"").unwrap(),
            LineWrap::Col64
        );
        assert_eq!(
            serde_json::from_str::<LineWrap>("\"col76\"").unwrap(),
            LineWrap::Col76
        );
    }
}
