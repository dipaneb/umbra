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

pub fn format(input: &str, indent: JsonIndent) -> Result<String, ToolError> {
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
    let value: serde_json::Value = serde_json::from_str(input).map_err(map_parse_error)?;
    serde_json::to_string(&value).map_err(map_internal_error)
}

fn map_parse_error(err: serde_json::Error) -> ToolError {
    ToolError {
        code: "json-syntax".to_string(),
        message: err.to_string(),
        position: Some(Position::LineCol {
            line: err.line() as u32,
            column: err.column() as u32,
        }),
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
    fn format_malformed_input_returns_json_syntax_error_with_position() {
        let err = format(r#"{"a":}"#, JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-syntax");
        assert!(matches!(err.position, Some(Position::LineCol { .. })));
        if let Some(Position::LineCol { line, column }) = err.position {
            assert_eq!(line, 1);
            assert_eq!(column, 6);
        }
    }

    #[test]
    fn minify_malformed_input_returns_json_syntax_error_with_position() {
        let err = minify(r#"{"a":}"#).unwrap_err();
        assert_eq!(err.code, "json-syntax");
        assert!(matches!(err.position, Some(Position::LineCol { .. })));
    }

    #[test]
    fn format_empty_string_returns_syntax_error() {
        let err = format("", JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-syntax");
    }

    #[test]
    fn minify_empty_string_returns_syntax_error() {
        let err = minify("").unwrap_err();
        assert_eq!(err.code, "json-syntax");
    }
}
