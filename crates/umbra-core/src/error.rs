use serde::{Deserialize, Serialize};

/// The shared error contract every tool command returns as `Result<T, ToolError>`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolError {
    /// Stable kebab-case identifier for this error (e.g. `"json-syntax"`). Assigned by each
    /// tool as it's implemented — no enforced enum yet, since no tool exists to assign real
    /// codes until Story 1.7.
    pub code: String,
    /// Human-readable description of what went wrong.
    pub message: String,
    /// Where in the input the error occurred, if the tool can localize it. `None` when the
    /// error has no natural location (e.g. a hash mismatch or a UUID validation failure).
    #[serde(default)]
    pub position: Option<Position>,
    /// Additional free-form detail about the error, if any.
    #[serde(default)]
    pub context: Option<String>,
}

/// A location within the input that produced a `ToolError`.
// `tag = "kind"` flattens the variant name into a sibling `"kind"` field
// (`{"kind":"LineCol","line":1,"column":6}`) instead of serde's default
// `{"LineCol":{...}}` wrapping — this shape is what lets the frontend model
// it as a TS discriminated union (`src/shell/toolError.ts`) keyed on `kind`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum Position {
    /// A line/column location, for text-based formats like JSON.
    LineCol { line: u32, column: u32 },
    /// A raw byte offset, for binary or non-line-oriented formats like Base64.
    ByteOffset { offset: u64 },
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn tool_error_with_line_col_position_serializes_expected_shape() {
        let error = ToolError {
            code: "json-syntax".to_string(),
            message: "unexpected token".to_string(),
            position: Some(Position::LineCol {
                line: 3,
                column: 12,
            }),
            context: Some("while parsing object".to_string()),
        };

        let value = serde_json::to_value(&error).unwrap();

        assert_eq!(
            value,
            json!({
                "code": "json-syntax",
                "message": "unexpected token",
                "position": { "kind": "LineCol", "line": 3, "column": 12 },
                "context": "while parsing object",
            })
        );
    }

    #[test]
    fn tool_error_with_byte_offset_position_serializes_expected_shape() {
        let error = ToolError {
            code: "base64-invalid".to_string(),
            message: "invalid character".to_string(),
            position: Some(Position::ByteOffset { offset: 42 }),
            context: None,
        };

        let value = serde_json::to_value(&error).unwrap();

        assert_eq!(
            value,
            json!({
                "code": "base64-invalid",
                "message": "invalid character",
                "position": { "kind": "ByteOffset", "offset": 42 },
                "context": null,
            })
        );
    }

    #[test]
    fn tool_error_with_no_position_or_context_serializes_explicit_nulls() {
        let error = ToolError {
            code: "generic-error".to_string(),
            message: "something went wrong".to_string(),
            position: None,
            context: None,
        };

        let value = serde_json::to_value(&error).unwrap();

        assert_eq!(
            value,
            json!({
                "code": "generic-error",
                "message": "something went wrong",
                "position": null,
                "context": null,
            })
        );
    }
}
