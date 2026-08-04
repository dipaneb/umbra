use umbra_core::ToolError;
use umbra_core::cron::{CronExplanation, ScheduleParseResult, explain, parse_schedule};

#[tauri::command]
pub async fn cron_explain(expression: String) -> Result<CronExplanation, ToolError> {
    tauri::async_runtime::spawn_blocking(move || explain(&expression))
        .await
        .map_err(map_join_error)?
}

#[tauri::command]
pub async fn cron_parse_schedule(phrase: String) -> Result<ScheduleParseResult, ToolError> {
    tauri::async_runtime::spawn_blocking(move || parse_schedule(&phrase))
        .await
        .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "cron-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn cron_explain_command_returns_explanation_on_happy_path() {
        let result = cron_explain("0 9 * * 1".to_string()).await.unwrap();
        assert_eq!(result.description, "Every Monday, at 9:00 AM");
        assert_eq!(result.next_runs.len(), 3);
    }

    #[tokio::test]
    async fn cron_explain_command_returns_cron_invalid_pattern_for_bad_expression() {
        let err = cron_explain("* * *".to_string()).await.unwrap_err();
        assert_eq!(err.code, "cron-invalid-pattern");
    }

    #[tokio::test]
    async fn cron_parse_schedule_command_returns_result_on_happy_path() {
        let result = cron_parse_schedule("every Monday at 9am".to_string())
            .await
            .unwrap();
        assert_eq!(result.expression, "0 9 * * 1");
        assert_eq!(result.description, "Every Monday, at 9:00 AM");
    }

    #[tokio::test]
    async fn cron_parse_schedule_command_returns_cron_nl_unrecognized_for_bad_phrase() {
        let err = cron_parse_schedule("asdfasdf".to_string())
            .await
            .unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
    }
}
