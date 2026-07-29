use umbra_core::ToolError;
use umbra_core::base64::{decode, encode};

#[tauri::command(rename_all = "snake_case")]
pub async fn base64_encode(input: String, url_safe: bool) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || encode(&input, url_safe))
        .await
        .map_err(map_join_error)
}

#[tauri::command]
pub async fn base64_decode(input: String) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || decode(&input))
        .await
        .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "base64-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn base64_encode_command_produces_standard_output() {
        let result = base64_encode("hello".to_string(), false).await.unwrap();
        assert_eq!(result, "aGVsbG8=");
    }

    #[tokio::test]
    async fn base64_encode_command_produces_url_safe_output() {
        let result = base64_encode(">>>".to_string(), true).await.unwrap();
        assert_eq!(result, "Pj4-");
    }

    #[tokio::test]
    async fn base64_decode_command_decodes_valid_input() {
        let result = base64_decode("aGVsbG8=".to_string()).await.unwrap();
        assert_eq!(result, "hello");
    }

    #[tokio::test]
    async fn base64_decode_command_returns_tool_error_for_malformed_input() {
        let err = base64_decode("not valid base64!!!".to_string())
            .await
            .unwrap_err();
        assert_eq!(err.code, "base64-invalid");
    }

    #[tokio::test]
    async fn map_join_error_produces_base64_internal_tool_error_on_panic() {
        let err = tauri::async_runtime::spawn_blocking(|| {
            panic!("boom");
        })
        .await
        .unwrap_err();

        let tool_err = map_join_error(err);
        assert_eq!(tool_err.code, "base64-internal");
    }
}
