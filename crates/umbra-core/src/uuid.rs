use crate::ToolError;
use uuid::{ContextV7, Timestamp, Uuid};

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UuidVersion {
    V4,
    V7,
}

const MAX_COUNT: u32 = 1000;

/// Generates `count` UUIDs of the given `version`.
///
/// v7 UUIDs are generated against a single shared `ContextV7` for the whole
/// batch rather than via bare `Uuid::now_v7()` calls: the `uuid` crate warns
/// that repeated `now_v7()` calls are not guaranteed monotonic if the system
/// clock doesn't advance between calls, which a sub-millisecond bulk loop
/// would hit routinely — a shared context keeps output strictly increasing.
pub fn generate(version: UuidVersion, count: u32) -> Result<Vec<String>, ToolError> {
    if count == 0 {
        return Err(ToolError {
            code: "uuid-count-zero".to_string(),
            message: "count must be at least 1".to_string(),
            position: None,
            context: None,
        });
    }
    if count > MAX_COUNT {
        return Err(ToolError {
            code: "uuid-count-too-large".to_string(),
            message: format!("count is {count}, which exceeds the {MAX_COUNT} limit"),
            position: None,
            context: None,
        });
    }

    Ok(match version {
        UuidVersion::V4 => (0..count).map(|_| Uuid::new_v4().to_string()).collect(),
        UuidVersion::V7 => {
            let context = ContextV7::new();
            (0..count)
                .map(|_| Uuid::new_v7(Timestamp::now(&context)).to_string())
                .collect()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_v4_single_returns_one_valid_uuid() {
        let results = generate(UuidVersion::V4, 1).unwrap();
        assert_eq!(results.len(), 1);
        assert!(Uuid::parse_str(&results[0]).is_ok());
    }

    #[test]
    fn generate_v7_single_returns_one_valid_uuid() {
        let results = generate(UuidVersion::V7, 1).unwrap();
        assert_eq!(results.len(), 1);
        assert!(Uuid::parse_str(&results[0]).is_ok());
    }

    #[test]
    fn generate_v4_bulk_returns_unique_strings() {
        let results = generate(UuidVersion::V4, 1000).unwrap();
        assert_eq!(results.len(), 1000);
        let unique: std::collections::HashSet<_> = results.iter().collect();
        assert_eq!(unique.len(), 1000);
    }

    #[test]
    fn generate_v7_bulk_is_already_sorted_ascending() {
        // This is the regression test that actually proves the shared-ContextV7
        // fix works, not just that the function runs.
        let results = generate(UuidVersion::V7, 1000).unwrap();
        assert_eq!(results.len(), 1000);
        assert!(results.windows(2).all(|w| w[0] <= w[1]));
    }

    #[test]
    fn generate_rejects_zero_count() {
        let err = generate(UuidVersion::V4, 0).unwrap_err();
        assert_eq!(err.code, "uuid-count-zero");
        assert_eq!(err.position, None);
    }

    #[test]
    fn generate_succeeds_at_upper_boundary_1000() {
        let results = generate(UuidVersion::V7, 1000).unwrap();
        assert_eq!(results.len(), 1000);
    }

    #[test]
    fn generate_rejects_count_over_1000() {
        let err = generate(UuidVersion::V4, 1001).unwrap_err();
        assert_eq!(err.code, "uuid-count-too-large");
        assert_eq!(err.position, None);
    }
}
