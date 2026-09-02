use crate::ToolError;
use crate::base64::decode_bytes;

// A JWT is a credential carried in an HTTP header — realistic tokens run a few
// hundred to a few thousand bytes. 1 MiB is ~250x the largest plausible token
// and still trivially cheap to base64url-decode and JSON-parse. The guard
// exists for the same CWE-400 unbounded-allocation reason every other tool
// module has one (`base64.rs` / `hash.rs` / `json.rs`), applied to `jwt.rs`
// for the first time in Story 8.5: live as-you-type decoding makes a
// pathological paste a real cost. Named `MAX_TOKEN_BYTES` rather than the
// `MAX_INPUT_BYTES` the other modules use, precisely because the value here is
// 100x smaller — the shared name on a very different magnitude is a maintainer
// trap. `pub` so the tests and the frontend's hand-synced mirror (`JwtView.vue`)
// name one value.
pub const MAX_TOKEN_BYTES: usize = 1_048_576;

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct JwtDecoded {
    pub header: serde_json::Value,
    pub payload: serde_json::Value,
    pub exp: Option<i64>,
    pub iat: Option<i64>,
    pub nbf: Option<i64>,
}

pub fn decode(token: &str) -> Result<JwtDecoded, ToolError> {
    // Byte-length guard first — before any trimming or splitting — so a
    // pathological paste is rejected without allocating the segment vector.
    // Fixed prose that embeds the runtime byte count, so it renders raw via
    // `toolErrorMessage` and stays out of `TRANSLATABLE_CODES`, matching
    // `hash-input-too-large` / `json-input-too-large`.
    if token.len() > MAX_TOKEN_BYTES {
        return Err(ToolError {
            code: "jwt-input-too-large".to_string(),
            message: format!(
                "input is {} bytes, which exceeds the {MAX_TOKEN_BYTES}-byte limit",
                token.len()
            ),
            position: None,
            context: None,
        });
    }

    let segments: Vec<&str> = token.trim().split('.').collect();
    if segments.len() != 3 {
        return Err(ToolError {
            code: "jwt-malformed".to_string(),
            message: format!(
                "expected 3 dot-separated segments (header.payload.signature), found {}",
                segments.len()
            ),
            position: None,
            context: Some("segment: structure".to_string()),
        });
    }

    let header = decode_segment(segments[0], "header", "jwt-invalid-header")?;
    let payload = decode_segment(segments[1], "payload", "jwt-invalid-payload")?;

    Ok(JwtDecoded {
        exp: numeric_claim(&payload, "exp"),
        iat: numeric_claim(&payload, "iat"),
        nbf: numeric_claim(&payload, "nbf"),
        header,
        payload,
    })
}

fn decode_segment(segment: &str, name: &str, code: &str) -> Result<serde_json::Value, ToolError> {
    let bytes = decode_bytes(segment).map_err(|err| ToolError {
        code: code.to_string(),
        message: format!("{name} segment is not valid Base64URL: {}", err.message),
        position: None,
        context: Some(format!("segment: {name}")),
    })?;
    let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|err| ToolError {
        code: code.to_string(),
        message: format!("{name} segment is not valid JSON: {err}"),
        position: None,
        context: Some(format!("segment: {name}")),
    })?;
    // RFC 7519 requires the header and payload to each deserialize to a
    // JSON *object* (§7.2 rule 8) — `serde_json::Value` alone doesn't
    // enforce this, so an input like a bare `"null"` or `[1,2]` segment
    // would otherwise "successfully" decode into a non-object value that
    // breaks every downstream `.get("exp")`-style lookup silently.
    if !value.is_object() {
        return Err(ToolError {
            code: code.to_string(),
            message: format!("{name} segment must decode to a JSON object"),
            position: None,
            context: Some(format!("segment: {name}")),
        });
    }
    Ok(value)
}

fn numeric_claim(payload: &serde_json::Value, key: &str) -> Option<i64> {
    let value = payload.get(key)?;
    value.as_i64().or_else(|| value.as_f64().map(|f| f as i64))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::base64::encode_bytes;
    use serde_json::json;

    fn segment(value: &serde_json::Value) -> String {
        encode_bytes(value.to_string().as_bytes(), true, None).unwrap()
    }

    fn token(header: &serde_json::Value, payload: &serde_json::Value, sig: &str) -> String {
        format!("{}.{}.{}", segment(header), segment(payload), sig)
    }

    #[test]
    fn decode_happy_path_returns_exact_header_payload_and_claims() {
        let header = json!({"alg": "HS256", "typ": "JWT"});
        let payload = json!({
            "exp": 1735689600,
            "iat": 1735686000,
            "nbf": 1735686000,
            "sub": "custom-claim-value"
        });
        let jwt = token(&header, &payload, "sig");

        let decoded = decode(&jwt).unwrap();

        assert_eq!(decoded.header, header);
        assert_eq!(decoded.payload, payload);
        assert_eq!(decoded.exp, Some(1735689600));
        assert_eq!(decoded.iat, Some(1735686000));
        assert_eq!(decoded.nbf, Some(1735686000));
    }

    #[test]
    fn decode_tolerates_float_numeric_date_for_exp() {
        let header = json!({"alg": "HS256", "typ": "JWT"});
        let payload = json!({"exp": 1735689600.0});
        let jwt = token(&header, &payload, "sig");

        let decoded = decode(&jwt).unwrap();

        assert_eq!(decoded.exp, Some(1735689600));
    }

    #[test]
    fn decode_missing_registered_claims_returns_all_none() {
        let header = json!({"alg": "HS256", "typ": "JWT"});
        let payload = json!({"sub": "no-timestamps-here"});
        let jwt = token(&header, &payload, "sig");

        let decoded = decode(&jwt).unwrap();

        assert_eq!(decoded.exp, None);
        assert_eq!(decoded.iat, None);
        assert_eq!(decoded.nbf, None);
    }

    #[test]
    fn decode_trims_surrounding_whitespace_before_splitting_segments() {
        let header = json!({"alg": "HS256", "typ": "JWT"});
        let payload = json!({"sub": "x"});
        let jwt = format!("  {}\n", token(&header, &payload, "sig"));

        let decoded = decode(&jwt).unwrap();

        assert_eq!(decoded.header, header);
        assert_eq!(decoded.payload, payload);
    }

    #[test]
    fn decode_wrong_segment_count_too_few_returns_jwt_malformed() {
        let err = decode("a.b").unwrap_err();
        assert_eq!(err.code, "jwt-malformed");
        assert!(err.message.contains('2'));
    }

    #[test]
    fn decode_wrong_segment_count_too_many_returns_jwt_malformed() {
        let err = decode("a.b.c.d").unwrap_err();
        assert_eq!(err.code, "jwt-malformed");
        assert!(err.message.contains('4'));
    }

    #[test]
    fn decode_invalid_base64url_header_returns_jwt_invalid_header() {
        let payload = json!({"sub": "x"});
        let jwt = format!("not!valid!base64.{}.sig", segment(&payload));

        let err = decode(&jwt).unwrap_err();

        assert_eq!(err.code, "jwt-invalid-header");
        assert_eq!(err.context, Some("segment: header".to_string()));
    }

    #[test]
    fn decode_payload_valid_base64_invalid_json_returns_jwt_invalid_payload() {
        let header = json!({"alg": "HS256", "typ": "JWT"});
        let bad_json_payload = encode_bytes(b"not json bytes {{{", true, None).unwrap();
        let jwt = format!("{}.{}.sig", segment(&header), bad_json_payload);

        let err = decode(&jwt).unwrap_err();

        assert_eq!(err.code, "jwt-invalid-payload");
        assert_eq!(err.context, Some("segment: payload".to_string()));
    }

    #[test]
    fn decode_header_non_object_json_returns_jwt_invalid_header() {
        let non_object_header = encode_bytes(b"null", true, None).unwrap();
        let payload = json!({"sub": "x"});
        let jwt = format!("{}.{}.sig", non_object_header, segment(&payload));

        let err = decode(&jwt).unwrap_err();

        assert_eq!(err.code, "jwt-invalid-header");
        assert_eq!(err.context, Some("segment: header".to_string()));
    }

    #[test]
    fn decode_header_array_json_returns_jwt_invalid_header() {
        let non_object_header = encode_bytes(b"[1,2]", true, None).unwrap();
        let payload = json!({"sub": "x"});
        let jwt = format!("{}.{}.sig", non_object_header, segment(&payload));

        let err = decode(&jwt).unwrap_err();

        assert_eq!(err.code, "jwt-invalid-header");
    }

    #[test]
    fn decode_payload_non_object_json_returns_jwt_invalid_payload() {
        let header = json!({"alg": "HS256", "typ": "JWT"});
        let non_object_payload = encode_bytes(b"null", true, None).unwrap();
        let jwt = format!("{}.{}.sig", segment(&header), non_object_payload);

        let err = decode(&jwt).unwrap_err();

        assert_eq!(err.code, "jwt-invalid-payload");
        assert_eq!(err.context, Some("segment: payload".to_string()));
    }

    #[test]
    fn decode_rejects_input_over_max_size() {
        let err = decode(&"A".repeat(MAX_TOKEN_BYTES + 1)).unwrap_err();

        assert_eq!(err.code, "jwt-input-too-large");
        assert_eq!(err.position, None);
        assert!(err.message.contains(&(MAX_TOKEN_BYTES + 1).to_string()));
    }

    #[test]
    fn decode_accepts_a_token_landing_exactly_on_the_size_cap() {
        // A valid token whose (discarded) signature segment is padded to put
        // the whole string exactly on the cap — proves the guard is
        // exclusive (`>`, not `>=`).
        let header = json!({"alg": "HS256", "typ": "JWT"});
        let payload = json!({"sub": "x"});
        let base = token(&header, &payload, "");
        let jwt = format!("{base}{}", "A".repeat(MAX_TOKEN_BYTES - base.len()));
        assert_eq!(jwt.len(), MAX_TOKEN_BYTES);

        let decoded = decode(&jwt).unwrap();

        assert_eq!(decoded.header, header);
        assert_eq!(decoded.payload, payload);
    }

    #[test]
    fn decode_normal_token_is_unaffected_by_the_size_guard() {
        let header = json!({"alg": "HS256", "typ": "JWT"});
        let payload = json!({"sub": "1234567890", "exp": 1735689600});
        let jwt = token(&header, &payload, "sig");
        assert!(jwt.len() < MAX_TOKEN_BYTES);

        let decoded = decode(&jwt).unwrap();

        assert_eq!(decoded.exp, Some(1735689600));
    }
}
