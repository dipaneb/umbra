use umbra_core::ToolError;
use umbra_core::cron::{CronExplanation, explain};

#[tauri::command]
pub async fn cron_explain(expression: String) -> Result<CronExplanation, ToolError> {
    tauri::async_runtime::spawn_blocking(move || explain(&expression))
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
        // The command carries the schedule's meaning across IPC; the sentence is the view's
        // job now (src/tools/cron/locales/), so there is no prose to assert here.
        assert_eq!(
            result.schedule.day_of_week,
            umbra_core::cron::FieldTerm::Value { value: 1 }
        );
        assert_eq!(result.next_runs.len(), 3);
    }

    #[tokio::test]
    async fn cron_explain_command_returns_cron_invalid_pattern_for_bad_expression() {
        let err = cron_explain("* * *".to_string()).await.unwrap_err();
        assert_eq!(err.code, "cron-invalid-pattern");
    }
}
