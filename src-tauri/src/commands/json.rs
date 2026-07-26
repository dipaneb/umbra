use umbra_core::ToolError;
use umbra_core::json::{JsonIndent, JsonTreeValue, format, minify, parse};

#[tauri::command]
pub async fn json_format(input: String, indent: JsonIndent) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || format(&input, indent))
        .await
        .map_err(map_join_error)?
}

#[tauri::command]
pub async fn json_minify(input: String) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || minify(&input))
        .await
        .map_err(map_join_error)?
}

#[tauri::command]
pub async fn json_parse(input: String) -> Result<JsonTreeValue, ToolError> {
    tauri::async_runtime::spawn_blocking(move || parse(&input).map(Into::into))
        .await
        .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "json-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
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

    // Wide, flat array of many small same-shaped objects — same shape/rationale as
    // umbra-core's fixture (see crates/umbra-core/src/json.rs); duplicated locally
    // per this story's Dev Notes rather than sharing a test-util crate for two ~15
    // line copies.
    fn large_json_fixture(min_bytes: usize) -> String {
        let mut out = String::from("[");
        let mut i: u64 = 0;
        while out.len() < min_bytes {
            if i > 0 {
                out.push(',');
            }
            out.push_str(&format!(
                r#"{{"id":{i},"name":"item-{i}","active":{active},"tags":["a","b","c"]}}"#,
                active = i % 2 == 0
            ));
            i += 1;
        }
        out.push(']');
        out
    }

    // Generous ceilings, not tight ~200ms UI-thread assertions — these are
    // regression/smoke guards against pathological blow-ups, run across three CI
    // OSes (AD-11) with different baseline speeds. The actual UI-thread
    // responsiveness claim (AC1) can only be proven by hand against a real webview
    // (Task 4) since Tauri's macOS webview has no WebDriver support.
    #[tokio::test]
    async fn json_format_command_handles_10mb_document() {
        let input = large_json_fixture(10 * 1024 * 1024);
        let start = std::time::Instant::now();
        let result = json_format(input, JsonIndent::TwoSpaces).await;
        let elapsed = start.elapsed();
        eprintln!("json_format_command_handles_10mb_document: {elapsed:?}");
        assert!(result.is_ok());
        assert!(
            elapsed.as_secs() < 20,
            "json_format took {elapsed:?} on a 10MB document"
        );
    }

    #[tokio::test]
    async fn json_minify_command_handles_10mb_document() {
        let input = large_json_fixture(10 * 1024 * 1024);
        let start = std::time::Instant::now();
        let result = json_minify(input).await;
        let elapsed = start.elapsed();
        eprintln!("json_minify_command_handles_10mb_document: {elapsed:?}");
        assert!(result.is_ok());
        assert!(
            elapsed.as_secs() < 20,
            "json_minify took {elapsed:?} on a 10MB document"
        );
    }

    #[tokio::test]
    async fn json_parse_command_handles_10mb_document() {
        let input = large_json_fixture(10 * 1024 * 1024);
        let start = std::time::Instant::now();
        let result = json_parse(input).await;
        let elapsed = start.elapsed();
        eprintln!("json_parse_command_handles_10mb_document: {elapsed:?}");
        assert!(result.is_ok());
        assert!(
            elapsed.as_secs() < 20,
            "json_parse took {elapsed:?} on a 10MB document"
        );
    }

    #[tokio::test]
    async fn map_join_error_produces_json_internal_tool_error_on_panic() {
        let err = tauri::async_runtime::spawn_blocking(|| {
            panic!("boom");
        })
        .await
        .unwrap_err();

        let tool_err = map_join_error(err);
        assert_eq!(tool_err.code, "json-internal");
    }

    #[tokio::test]
    async fn spawn_blocking_lets_a_light_command_finish_promptly_alongside_a_heavy_one() {
        let input = large_json_fixture(10 * 1024 * 1024);
        let start = std::time::Instant::now();
        let heavy_handle = tokio::spawn(async move { json_parse(input).await });
        tokio::task::yield_now().await;

        let light_result = json_minify("null".to_string()).await;
        let elapsed = start.elapsed();

        assert_eq!(light_result.unwrap(), "null");
        // Regression guard for AD-4: if `spawn_blocking` were removed from
        // `json_parse`, its synchronous parse would run to completion inline
        // on this test's single-threaded runtime before ever yielding,
        // starving the light `json_minify` call above until the heavy parse
        // finished. With `spawn_blocking`, the heavy work dispatches to a
        // separate thread-pool thread and yields immediately, so this light
        // call (and thus `elapsed`) completes fast regardless of the heavy
        // job's progress.
        assert!(
            elapsed.as_millis() < 300,
            "light command took {elapsed:?} while a heavy command was in flight -- \
             is `spawn_blocking` still wrapping the CPU work in json_parse?"
        );

        let heavy_result = heavy_handle.await.unwrap();
        assert!(heavy_result.is_ok());
    }
}
