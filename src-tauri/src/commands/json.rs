use umbra_core::ToolError;
use umbra_core::json::{JsonIndent, JsonTreeValue, format, minify, parse};

#[tauri::command]
pub async fn json_format(input: String, indent: JsonIndent) -> Result<String, ToolError> {
    format(&input, indent)
}

#[tauri::command]
pub async fn json_minify(input: String) -> Result<String, ToolError> {
    minify(&input)
}

#[tauri::command]
pub async fn json_parse(input: String) -> Result<JsonTreeValue, ToolError> {
    parse(&input).map(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn json_format_command_pretty_prints_valid_input() {
        let result = json_format(r#"{"a":1,"b":2}"#.to_string(), JsonIndent::TwoSpaces)
            .await
            .unwrap();
        assert_eq!(result, "{\n  \"a\": 1,\n  \"b\": 2\n}");
    }

    #[tokio::test]
    async fn json_format_command_returns_tool_error_for_malformed_input() {
        let err = json_format(r#"{"a":}"#.to_string(), JsonIndent::TwoSpaces)
            .await
            .unwrap_err();
        assert_eq!(err.code, "json-syntax");
    }

    #[tokio::test]
    async fn json_minify_command_collapses_valid_input() {
        let result = json_minify("{\n  \"a\": 1,\n  \"b\": 2\n}".to_string())
            .await
            .unwrap();
        assert_eq!(result, r#"{"a":1,"b":2}"#);
    }

    #[tokio::test]
    async fn json_minify_command_returns_tool_error_for_malformed_input() {
        let err = json_minify(r#"{"a":}"#.to_string()).await.unwrap_err();
        assert_eq!(err.code, "json-syntax");
    }

    #[tokio::test]
    async fn json_parse_command_returns_tree_value_for_valid_input() {
        let result = json_parse(r#"{"a":1,"b":[true,null]}"#.to_string())
            .await
            .unwrap();
        assert_eq!(
            result,
            JsonTreeValue::Object(vec![
                ("a".to_string(), JsonTreeValue::Number("1".to_string())),
                (
                    "b".to_string(),
                    JsonTreeValue::Array(vec![JsonTreeValue::Bool(true), JsonTreeValue::Null])
                ),
            ])
        );
    }

    #[tokio::test]
    async fn json_parse_command_returns_tool_error_for_malformed_input() {
        let err = json_parse(r#"{"a":}"#.to_string()).await.unwrap_err();
        assert_eq!(err.code, "json-syntax");
    }
}
