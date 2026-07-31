use umbra_core::ToolError;
use umbra_core::jwt::{JwtDecoded, decode};

#[tauri::command]
pub async fn jwt_decode(token: String) -> Result<JwtDecoded, ToolError> {
    tauri::async_runtime::spawn_blocking(move || decode(&token))
        .await
        .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "jwt-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use umbra_core::base64::encode_bytes;

    fn segment(json: &str) -> String {
        encode_bytes(json.as_bytes(), true).unwrap()
    }

    #[tokio::test]
    async fn jwt_decode_command_returns_decoded_token_on_happy_path() {
        let header = segment(r#"{"alg":"HS256","typ":"JWT"}"#);
        let payload = segment(r#"{"sub":"1234567890","exp":1735689600}"#);
        let token = format!("{header}.{payload}.sig");

        let result = jwt_decode(token).await.unwrap();

        assert_eq!(result.exp, Some(1735689600));
    }

    #[tokio::test]
    async fn jwt_decode_command_returns_jwt_malformed_for_wrong_segment_count() {
        let err = jwt_decode("a.b".to_string()).await.unwrap_err();
        assert_eq!(err.code, "jwt-malformed");
    }

    #[tokio::test]
    async fn jwt_decode_command_returns_jwt_invalid_header_for_bad_header() {
        let payload = segment(r#"{"sub":"1234567890"}"#);
        let token = format!("not!valid!base64.{payload}.sig");

        let err = jwt_decode(token).await.unwrap_err();

        assert_eq!(err.code, "jwt-invalid-header");
    }
}
