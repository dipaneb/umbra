use crate::{Position, ToolError};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JsonIndent {
    TwoSpaces,
    FourSpaces,
    Tab,
}

impl JsonIndent {
    fn as_bytes(self) -> &'static [u8] {
        match self {
            JsonIndent::TwoSpaces => b"  ",
            JsonIndent::FourSpaces => b"    ",
            JsonIndent::Tab => b"\t",
        }
    }
}

// Upper bound on accepted input length, in bytes. `serde_json::from_str` builds
// an owned `Value` tree (and `format`/`minify` additionally re-serialize it),
// which is memory-proportional to input size with typical multiplier overhead
// versus the raw string — with no cap, a hostile paste of hundreds of MB to a
// few GB can drive uncontrolled allocation and freeze or OOM the process
// (CWE-400). Set well above FR9's 10 MB "must handle comfortably" bar (see the
// 10 MB fixture tests below) so it never turns away a legitimate document,
// while still bounding the worst case.
const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

// Nesting-depth protection (CWE-400 adjacent: a small, deeply-nested payload
// can exhaust the stack even when well under MAX_INPUT_BYTES). serde_json
// enforces a 128-level recursion limit on `from_str::<Value>` by default —
// verified directly: a 100,000-deep nested array is rejected with a clean
// `RecursionLimitExceeded` error, not a stack overflow. This holds as long as
// the `unbounded_depth` feature stays off (see `Cargo.toml`, which enables
// only `preserve_order`); if a future dependency change ever turns that
// feature on, the regression tests below stop passing — as a clean assertion
// failure if the limit is merely raised, or as an aborted test process if
// it's removed outright, but either way CI stops being green instead of
// silently reopening this gap. `format`/`minify`/`parse` all build their
// `Value` tree through this same guarded call before anything else runs, so
// `JsonTreeValue`'s `From<Value>` conversion (below) only ever walks an
// already-bounded tree.

fn check_input_size(input: &str) -> Result<(), ToolError> {
    if input.len() > MAX_INPUT_BYTES {
        return Err(ToolError {
            code: "json-input-too-large".to_string(),
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

pub fn format(input: &str, indent: JsonIndent) -> Result<String, ToolError> {
    check_input_size(input)?;
    let value: serde_json::Value = serde_json::from_str(input).map_err(map_parse_error)?;
    let mut buf = Vec::new();
    // `PrettyFormatter::with_indent` (not `to_string_pretty`, which is fixed at
    // 2 spaces) accepts an arbitrary indent byte sequence — needed for the tab case.
    let formatter = serde_json::ser::PrettyFormatter::with_indent(indent.as_bytes());
    let mut serializer = serde_json::Serializer::with_formatter(&mut buf, formatter);
    value
        .serialize(&mut serializer)
        .map_err(map_internal_error)?;
    String::from_utf8(buf).map_err(map_internal_error)
}

pub fn minify(input: &str) -> Result<String, ToolError> {
    check_input_size(input)?;
    let value: serde_json::Value = serde_json::from_str(input).map_err(map_parse_error)?;
    serde_json::to_string(&value).map_err(map_internal_error)
}

pub fn parse(input: &str) -> Result<serde_json::Value, ToolError> {
    check_input_size(input)?;
    serde_json::from_str(input).map_err(map_parse_error)
}

// Wire type for the JSON tree (Story 1.8): `serde_json::Value::Object` round-trips
// through Tauri's IPC as a plain JS object, and the ECMAScript spec always
// enumerates canonical-integer-string keys ("0", "1", ...) in ascending numeric
// order before any other string keys, regardless of source order. Real payloads
// have numeric-ID-keyed objects, so the tree needs a shape immune to that —
// arrays fully preserve order no matter what the keys look like.
//
// `Number` carries the value's exact source text, not `serde_json::Number`:
// that type round-trips through Tauri's IPC as a native JS number (float64),
// silently losing precision for any integer beyond `Number.MAX_SAFE_INTEGER`
// (e.g. snowflake IDs) — the same category of "native-JS-representation
// silently mangles real payload data" pitfall motivating the `Object` shape
// above, just for numbers instead of keys.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(tag = "kind", content = "data")]
pub enum JsonTreeValue {
    Null,
    Bool(bool),
    Number(String),
    String(String),
    Array(Vec<JsonTreeValue>),
    Object(Vec<(String, JsonTreeValue)>),
}

impl From<serde_json::Value> for JsonTreeValue {
    fn from(value: serde_json::Value) -> Self {
        match value {
            serde_json::Value::Null => JsonTreeValue::Null,
            serde_json::Value::Bool(b) => JsonTreeValue::Bool(b),
            serde_json::Value::Number(n) => JsonTreeValue::Number(n.to_string()),
            serde_json::Value::String(s) => JsonTreeValue::String(s),
            serde_json::Value::Array(a) => {
                JsonTreeValue::Array(a.into_iter().map(Into::into).collect())
            }
            serde_json::Value::Object(m) => {
                JsonTreeValue::Object(m.into_iter().map(|(k, v)| (k, v.into())).collect())
            }
        }
    }
}

// Story 8.1 AC8: name the actual failure instead of passing serde_json's
// generic text through unchanged (the JWT Inspector precedent). serde_json's
// own `ErrorCode` enum (its Display impl, `error.rs`) is `pub(crate)` — not
// reachable as a typed value — so this matches on the fixed, closed set of
// English phrases its `Display` emits, verified directly against the vendored
// serde_json 1.0.151 source rather than assumed. Every phrase here maps to an
// `ErrorCode` variant that is actually reachable from `from_str::<Value>`
// (confirmed by reading `de.rs`); variants only reachable when deserializing
// into a typed struct (`Message`, `Io`) or a numeric-keyed map
// (`ExpectedDoubleQuote`, `ExpectedNumericKey`, `FloatKeyMustBeFinite`) are
// intentionally absent — `parse`/`format`/`minify` only ever target `Value`.
// The `json-syntax` fallback exists purely as a defensive net for a future
// serde_json release adding a new variant; every regression test below
// exercises a real reachable branch, so a classification gap would show up as
// a changed `err.code` assertion failing, not a silent miss.
fn classify_syntax_error(raw: &str) -> Option<(&'static str, &'static str)> {
    if raw.contains("trailing comma") {
        Some((
            "json-trailing-comma",
            "trailing comma before a closing `]` or `}` — remove it",
        ))
    } else if raw.contains("trailing characters") {
        Some((
            "json-trailing-characters",
            "unexpected content after the JSON value ended — check for an extra closing bracket or stray text",
        ))
    } else if raw.contains("EOF while parsing a string") {
        Some((
            "json-unterminated-string",
            "unterminated string — missing a closing `\"`",
        ))
    } else if raw.contains("EOF while parsing a list") {
        Some((
            "json-unclosed-array",
            "unclosed array — missing a closing `]`",
        ))
    } else if raw.contains("EOF while parsing an object") {
        Some((
            "json-unclosed-object",
            "unclosed object — missing a closing `}`",
        ))
    } else if raw.contains("EOF while parsing a value") {
        Some(("json-unexpected-end", "unexpected end of input"))
    } else if raw.contains("expected `:`") {
        Some(("json-expected-colon", "expected `:` after an object key"))
    } else if raw.contains("expected `,` or `]`") {
        Some((
            "json-expected-array-separator",
            "expected `,` between array items, or `]` to close the array",
        ))
    } else if raw.contains("expected `,` or `}`") {
        Some((
            "json-expected-object-separator",
            "expected `,` between object entries, or `}` to close the object",
        ))
    } else if raw.contains("expected ident") || raw.contains("expected value") {
        Some((
            "json-expected-value",
            "expected a value here — a string, number, object, array, true, false, or null",
        ))
    } else if raw.contains("invalid escape") {
        Some((
            "json-invalid-escape",
            "invalid `\\` escape sequence in a string",
        ))
    } else if raw.contains("invalid number") {
        Some(("json-invalid-number", "invalid number literal"))
    } else if raw.contains("number out of range") {
        Some((
            "json-number-out-of-range",
            "number is too large to represent",
        ))
    } else if raw.contains("invalid unicode code point")
        || raw.contains("surrogate")
        || raw.contains("hex escape")
    {
        Some(("json-invalid-unicode", "invalid unicode escape sequence"))
    } else if raw.contains("control character") {
        Some((
            "json-control-character",
            "unescaped control character in a string — escape it as `\\u00XX`",
        ))
    } else if raw.contains("key must be a string") {
        Some((
            "json-key-must-be-string",
            "object keys must be strings wrapped in double quotes",
        ))
    } else if raw.contains("recursion limit exceeded") {
        Some(("json-nesting-too-deep", "document is nested too deeply"))
    } else {
        None
    }
}

fn map_parse_error(err: serde_json::Error) -> ToolError {
    let position = Position::LineCol {
        line: err.line() as u32,
        column: err.column() as u32,
    };
    let raw = err.to_string();
    let (code, message) = match classify_syntax_error(&raw) {
        Some((code, message)) => (code.to_string(), message.to_string()),
        None => ("json-syntax".to_string(), raw),
    };
    ToolError {
        code,
        message,
        position: Some(position),
        context: None,
    }
}

// Handles steps that are fallible in signature only (re-serializing a Value we
// just parsed; the pretty-printer emitting valid UTF-8) — real failures here
// would be exceptional, but this keeps them an Err instead of an unwrap/panic.
fn map_internal_error<E: std::fmt::Display>(err: E) -> ToolError {
    ToolError {
        code: "json-internal".to_string(),
        message: err.to_string(),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_with_two_spaces_produces_expected_output() {
        let result = format(r#"{"a":1,"b":2}"#, JsonIndent::TwoSpaces).unwrap();
        assert_eq!(result, "{\n  \"a\": 1,\n  \"b\": 2\n}");
    }

    #[test]
    fn format_with_four_spaces_produces_expected_output() {
        let result = format(r#"{"a":1,"b":2}"#, JsonIndent::FourSpaces).unwrap();
        assert_eq!(result, "{\n    \"a\": 1,\n    \"b\": 2\n}");
    }

    #[test]
    fn format_with_tab_produces_expected_output() {
        let result = format(r#"{"a":1,"b":2}"#, JsonIndent::Tab).unwrap();
        assert_eq!(result, "{\n\t\"a\": 1,\n\t\"b\": 2\n}");
    }

    #[test]
    fn minify_collapses_multiline_document_to_one_line() {
        let input = "{\n  \"a\": 1,\n  \"b\": [1, 2, 3]\n}";
        let result = minify(input).unwrap();
        assert_eq!(result, r#"{"a":1,"b":[1,2,3]}"#);
    }

    #[test]
    fn format_preserves_key_order_regression() {
        let result = format(r#"{"b":1,"a":2}"#, JsonIndent::TwoSpaces).unwrap();
        assert_eq!(result, "{\n  \"b\": 1,\n  \"a\": 2\n}");
    }

    #[test]
    fn minify_preserves_key_order_regression() {
        let result = minify(r#"{"b":1,"a":2}"#).unwrap();
        assert_eq!(result, r#"{"b":1,"a":2}"#);
    }

    #[test]
    fn format_malformed_input_returns_json_expected_value_error_with_position() {
        let err = format(r#"{"a":}"#, JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-expected-value");
        assert!(
            !err.message.contains("line"),
            "message should not duplicate the structured position field"
        );
        assert!(matches!(err.position, Some(Position::LineCol { .. })));
        if let Some(Position::LineCol { line, column }) = err.position {
            assert_eq!(line, 1);
            assert_eq!(column, 6);
        }
    }

    #[test]
    fn minify_malformed_input_returns_json_expected_value_error_with_position() {
        let err = minify(r#"{"a":}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-value");
        assert!(matches!(err.position, Some(Position::LineCol { .. })));
    }

    #[test]
    fn format_empty_string_returns_unexpected_end_error() {
        let err = format("", JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-unexpected-end");
    }

    #[test]
    fn minify_empty_string_returns_unexpected_end_error() {
        let err = minify("").unwrap_err();
        assert_eq!(err.code, "json-unexpected-end");
    }

    #[test]
    fn parse_valid_object_preserves_key_order() {
        let result = parse(r#"{"b":1,"a":2}"#).unwrap();
        assert_eq!(result, serde_json::json!({"b": 1, "a": 2}));
        assert_eq!(
            result.as_object().unwrap().keys().collect::<Vec<_>>(),
            vec!["b", "a"]
        );
    }

    #[test]
    fn parse_malformed_input_returns_json_expected_value_error_with_position() {
        let err = parse(r#"{"a":}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-value");
        assert!(matches!(err.position, Some(Position::LineCol { .. })));
        if let Some(Position::LineCol { line, column }) = err.position {
            assert_eq!(line, 1);
            assert_eq!(column, 6);
        }
    }

    #[test]
    fn parse_empty_string_returns_unexpected_end_error() {
        let err = parse("").unwrap_err();
        assert_eq!(err.code, "json-unexpected-end");
    }

    // Story 8.1 AC8: one regression per classified serde_json ErrorCode
    // variant that's actually reachable from `from_str::<Value>` (verified
    // against the vendored 1.0.151 source, see `classify_syntax_error`'s doc
    // comment) — locks in both the code and that no location text leaks into
    // `message` (that's `position`'s job, kept separate so the shell doesn't
    // render the location twice).
    #[test]
    fn parse_trailing_comma_in_array_returns_json_trailing_comma() {
        let err = parse("[1,2,]").unwrap_err();
        assert_eq!(err.code, "json-trailing-comma");
        assert!(!err.message.contains("line"));
    }

    #[test]
    fn parse_trailing_comma_in_object_returns_json_trailing_comma() {
        let err = parse(r#"{"a":1,}"#).unwrap_err();
        assert_eq!(err.code, "json-trailing-comma");
    }

    #[test]
    fn parse_trailing_characters_after_value_returns_json_trailing_characters() {
        let err = parse("{}{}").unwrap_err();
        assert_eq!(err.code, "json-trailing-characters");
    }

    #[test]
    fn parse_unterminated_string_returns_json_unterminated_string() {
        let err = parse(r#"{"a": "unterminated}"#).unwrap_err();
        assert_eq!(err.code, "json-unterminated-string");
    }

    #[test]
    fn parse_unclosed_array_returns_json_unclosed_array() {
        let err = parse("[1,2").unwrap_err();
        assert_eq!(err.code, "json-unclosed-array");
    }

    #[test]
    fn parse_unclosed_object_returns_json_unclosed_object() {
        let err = parse(r#"{"a":1"#).unwrap_err();
        assert_eq!(err.code, "json-unclosed-object");
    }

    #[test]
    fn parse_missing_colon_returns_json_expected_colon() {
        let err = parse(r#"{"a" 1}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-colon");
    }

    #[test]
    fn parse_missing_comma_in_array_returns_json_expected_array_separator() {
        let err = parse("[1 2]").unwrap_err();
        assert_eq!(err.code, "json-expected-array-separator");
    }

    #[test]
    fn parse_missing_comma_in_object_returns_json_expected_object_separator() {
        let err = parse(r#"{"a":1 "b":2}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-object-separator");
    }

    #[test]
    fn parse_unquoted_key_returns_json_key_must_be_string() {
        let err = parse("{a:1}").unwrap_err();
        assert_eq!(err.code, "json-key-must-be-string");
    }

    #[test]
    fn parse_single_quoted_value_returns_json_expected_value() {
        let err = parse("{\"a\": 'x'}").unwrap_err();
        assert_eq!(err.code, "json-expected-value");
    }

    #[test]
    fn parse_invalid_escape_returns_json_invalid_escape() {
        let err = parse(r#"{"a": "\q"}"#).unwrap_err();
        assert_eq!(err.code, "json-invalid-escape");
    }

    #[test]
    fn parse_invalid_number_returns_json_invalid_number() {
        let err = parse("[01]").unwrap_err();
        assert_eq!(err.code, "json-invalid-number");
    }

    #[test]
    fn parse_number_out_of_range_returns_json_number_out_of_range() {
        let err = parse("1e999999999999999999999999999999").unwrap_err();
        assert_eq!(err.code, "json-number-out-of-range");
    }

    #[test]
    fn parse_lone_leading_surrogate_returns_json_invalid_unicode() {
        // \uD800 is a leading UTF-16 surrogate with no trailing surrogate
        // pair to follow it — the string ends right after, so serde_json
        // reports `UnexpectedEndOfHexEscape` rather than being able to
        // combine it into a real codepoint.
        let err = parse(r#"{"a": "\uD800"}"#).unwrap_err();
        assert_eq!(err.code, "json-invalid-unicode");
    }

    #[test]
    fn parse_non_hex_unicode_escape_returns_json_invalid_escape() {
        // Not-hex digits after \u fail at the same step as any other
        // malformed escape character — serde_json doesn't distinguish this
        // from e.g. `\q`, so it's `InvalidEscape`, not `InvalidUnicodeCodePoint`.
        let err = parse(r#"{"a": "\uZZZZ"}"#).unwrap_err();
        assert_eq!(err.code, "json-invalid-escape");
    }

    #[test]
    fn parse_control_character_in_string_returns_json_control_character() {
        let err = parse("{\"a\": \"line\nbreak\"}").unwrap_err();
        assert_eq!(err.code, "json-control-character");
    }

    #[test]
    fn json_tree_value_preserves_large_integer_precision_as_exact_text() {
        // Regression: this would catch a reversion to `Number(serde_json::Number)`,
        // which round-trips through Tauri's IPC as a native JS float64 and silently
        // rounds any integer beyond Number.MAX_SAFE_INTEGER (e.g. snowflake IDs).
        let value: serde_json::Value = serde_json::from_str(r#"{"id":9007199254740993}"#).unwrap();
        let tree: JsonTreeValue = value.into();
        assert_eq!(
            tree,
            JsonTreeValue::Object(vec![(
                "id".to_string(),
                JsonTreeValue::Number("9007199254740993".to_string())
            )])
        );
    }

    #[test]
    fn json_tree_value_preserves_source_key_order_not_numeric_order() {
        let value: serde_json::Value =
            serde_json::from_str(r#"{"1":"b","0":"a","name":"x"}"#).unwrap();
        let tree: JsonTreeValue = value.into();
        let serialized = serde_json::to_value(&tree).unwrap();
        let data = serialized.get("data").unwrap().as_array().unwrap();
        let keys: Vec<&str> = data
            .iter()
            .map(|entry| entry.as_array().unwrap()[0].as_str().unwrap())
            .collect();
        assert_eq!(keys, vec!["1", "0", "name"]);
    }

    // Wide, flat array of many small same-shaped objects — the realistic shape for
    // FR9's 10 MB bar (large arrays/log dumps), and deliberately not deeply nested
    // so it stays well clear of the 128-level recursion limit exercised by the
    // `*_rejects_deeply_nested_input` tests below.
    fn large_json_fixture(min_bytes: usize) -> (String, u64) {
        let mut out = String::from("[");
        let mut i: u64 = 0;
        while out.len() < min_bytes {
            if i > 0 {
                out.push(',');
            }
            out.push_str(&format!(
                r#"{{"id":{i},"name":"item-{i}","active":{active},"tags":["a","b","c"]}}"#,
                active = i.is_multiple_of(2)
            ));
            i += 1;
        }
        out.push(']');
        (out, i)
    }

    #[test]
    fn format_succeeds_on_10mb_document() {
        let (input, _) = large_json_fixture(10 * 1024 * 1024);
        let result = format(&input, JsonIndent::TwoSpaces);
        assert!(result.is_ok());
    }

    #[test]
    fn minify_succeeds_on_10mb_document() {
        let (input, _) = large_json_fixture(10 * 1024 * 1024);
        let result = minify(&input);
        assert!(result.is_ok());
    }

    #[test]
    fn parse_succeeds_on_10mb_document() {
        // Expected length comes from the fixture's own item counter, not a
        // re-derived textual scan, so it can't silently drift into a
        // tautology if the fixture shape ever changes.
        let (input, expected_len) = large_json_fixture(10 * 1024 * 1024);
        let result = parse(&input).unwrap();
        assert_eq!(result.as_array().unwrap().len(), expected_len as usize);
    }

    // Regression guards for the CWE-400 unbounded-allocation finding: input
    // over `MAX_INPUT_BYTES` must be rejected before it ever reaches
    // `serde_json::from_str`, regardless of whether its content would
    // otherwise be valid JSON.
    #[test]
    fn format_rejects_input_over_max_size() {
        let input = "1".repeat(MAX_INPUT_BYTES + 1);
        let err = format(&input, JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-input-too-large");
        assert_eq!(err.position, None);
    }

    #[test]
    fn minify_rejects_input_over_max_size() {
        let input = "1".repeat(MAX_INPUT_BYTES + 1);
        let err = minify(&input).unwrap_err();
        assert_eq!(err.code, "json-input-too-large");
        assert_eq!(err.position, None);
    }

    #[test]
    fn parse_rejects_input_over_max_size() {
        let input = "1".repeat(MAX_INPUT_BYTES + 1);
        let err = parse(&input).unwrap_err();
        assert_eq!(err.code, "json-input-too-large");
        assert_eq!(err.position, None);
    }

    // Regression guards for the nesting-depth gap flagged in the Epic 1 retro:
    // a small, deeply-nested payload must be rejected cleanly, not overflow
    // the stack. `depth` produces syntactically well-formed JSON (matched
    // brackets around a single scalar), so any error on it is attributable
    // to depth alone — no need to inspect the message text, which would
    // couple these tests to serde_json's exact wording.
    fn deeply_nested_json_fixture(depth: usize) -> String {
        let mut out = String::with_capacity(depth * 2 + 1);
        out.extend(std::iter::repeat_n('[', depth));
        out.push('1');
        out.extend(std::iter::repeat_n(']', depth));
        out
    }

    #[test]
    fn parse_rejects_deeply_nested_input() {
        let input = deeply_nested_json_fixture(100_000);
        let err = parse(&input).unwrap_err();
        assert_eq!(err.code, "json-nesting-too-deep");
    }

    #[test]
    fn format_rejects_deeply_nested_input() {
        let input = deeply_nested_json_fixture(100_000);
        let err = format(&input, JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-nesting-too-deep");
    }

    #[test]
    fn minify_rejects_deeply_nested_input() {
        let input = deeply_nested_json_fixture(100_000);
        let err = minify(&input).unwrap_err();
        assert_eq!(err.code, "json-nesting-too-deep");
    }

    // Boundary check on the legitimate side: a document nested well within
    // the 128-level limit must still succeed. Without this, a future
    // serde_json release that *lowered* the limit (rejecting real,
    // previously-valid documents) would pass every test above undetected.
    #[test]
    fn parse_succeeds_on_moderately_nested_input() {
        let input = deeply_nested_json_fixture(50);
        assert!(parse(&input).is_ok());
    }
}
