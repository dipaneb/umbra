use std::str::FromStr;

use croner::Cron;
use croner::errors::CronError;

use crate::ToolError;

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct CronExplanation {
    pub description: String,
    pub next_runs: Vec<i64>, // epoch seconds (unix, i64) — view converts to local datetimes, per AD-1
}

pub fn explain(expression: &str) -> Result<CronExplanation, ToolError> {
    explain_at(chrono::Local::now(), expression)
}

// Takes `now` as a parameter (rather than reading `chrono::Local::now()` directly) so this
// function's output is reproducible in tests — Story 3.2/3.3 depend on this module's output
// being a stable, controllable contract, per this story's Dev Notes.
fn explain_at(
    now: chrono::DateTime<chrono::Local>,
    expression: &str,
) -> Result<CronExplanation, ToolError> {
    let trimmed = expression.trim();
    let cron = Cron::from_str(trimmed).map_err(|err| map_cron_error(err, trimmed))?;
    let next_runs: Vec<i64> = cron
        .iter_after(now)
        .take(3)
        .map(|dt| dt.timestamp())
        .collect();
    // A day-of-month/month combination that can never occur (e.g. February 30th) parses
    // successfully but never matches — `iter_after` just ends with no items, rather than
    // erroring (confirmed against croner 3.0.1's source). Silently describing a schedule
    // that will never run would undercut this tool's whole purpose, so treat it as an error.
    if next_runs.is_empty() {
        return Err(ToolError {
            code: "cron-no-upcoming-runs".to_string(),
            message: "This expression has no upcoming occurrences — the date it specifies may never exist (e.g. February 30th).".to_string(),
            position: None,
            context: None,
        });
    }
    let description = describe(trimmed);
    Ok(CronExplanation {
        description,
        next_runs,
    })
}

const FIELD_RANGES: [(&str, u32, u32); 5] = [
    ("minute", 0, 59),
    ("hour", 0, 23),
    ("day of month", 1, 31),
    ("month", 1, 12),
    ("day of week", 0, 7),
];

// Best-effort identification of which field/value made `Cron::from_str` fail with a
// `ComponentError` — croner's own message for this case is a bare literal ("Number out of
// bounds.") with no field name, confirmed against croner 3.0.1's `component.rs`. Re-parses
// the raw expression against the five standard field ranges to name the offending field;
// returns `None` if the expression's shape doesn't match what's expected here (wrong field
// count, non-numeric tokens) rather than guessing.
fn find_out_of_range_field(expression: &str) -> Option<String> {
    let fields: Vec<&str> = expression.split_whitespace().collect();
    let standard: &[&str] = match fields.len() {
        5 => &fields,
        6 => &fields[1..],
        _ => return None,
    };
    for (raw, (name, min, max)) in standard.iter().zip(FIELD_RANGES.iter()) {
        for token in raw.split(',') {
            let base = token.split('/').next().unwrap_or(token);
            let candidates: Vec<&str> = match base.split_once('-') {
                Some((lo, hi)) => vec![lo, hi],
                None if base == "*" => vec![],
                None => vec![base],
            };
            for candidate in candidates {
                if let Ok(value) = candidate.parse::<u32>() {
                    if value < *min || value > *max {
                        return Some(format!(
                            "{name} field: {value} is out of range ({min}-{max})"
                        ));
                    }
                }
            }
        }
    }
    None
}

// `InvalidDate` and `TimeSearchLimitExceeded` originate from `Cron`'s time-search methods
// (`iter_after`/`find_next_occurrence`), not from `Cron::from_str` parsing — confirmed
// against croner 3.0.1's source (`iterator.rs`, `pattern.rs::day_match`). `explain_at` never
// routes those into this function (its `iter_after` call is a plain iterator that silently
// ends instead of surfacing the error — see the `next_runs.is_empty()` check above), so
// those two arms are unreachable from any real `explain_at` call today; kept for exhaustive
// `CronError` coverage in case a future caller uses a different `croner` entry point.
fn map_cron_error(err: CronError, expression: &str) -> ToolError {
    let code = match &err {
        CronError::EmptyPattern => "cron-empty-pattern",
        CronError::InvalidDate => "cron-invalid-date",
        CronError::InvalidTime => "cron-invalid-time",
        CronError::TimeSearchLimitExceeded => "cron-search-limit-exceeded",
        CronError::InvalidPattern(_) => "cron-invalid-pattern",
        CronError::IllegalCharacters(_) => "cron-illegal-characters",
        CronError::ComponentError(_) => "cron-component-error",
    };
    let context = match &err {
        CronError::ComponentError(_) => find_out_of_range_field(expression),
        _ => None,
    };
    ToolError {
        code: code.to_string(),
        message: err.to_string(),
        position: None,
        context,
    }
}

// A field value as this templater understands it. Hand-parsed from the raw
// expression string (never from `croner::Cron`'s internal `CronPattern`) so
// this module's output vocabulary stays a project-owned contract — see
// Dev Notes on why Story 3.2's round-trip depends on that independence.
#[derive(Debug, Clone, PartialEq)]
enum FieldSpec {
    Wildcard,
    Single(u32),
    List(Vec<u32>),
    Range(u32, u32),
    Step { base: Box<FieldSpec>, step: u32 },
}

fn parse_field(raw: &str) -> Option<FieldSpec> {
    if let Some((base, step)) = raw.split_once('/') {
        let step: u32 = step.parse().ok()?;
        let base_spec = if base == "*" {
            FieldSpec::Wildcard
        } else if let Some((lo, hi)) = base.split_once('-') {
            FieldSpec::Range(lo.parse().ok()?, hi.parse().ok()?)
        } else {
            return None;
        };
        return Some(FieldSpec::Step {
            base: Box::new(base_spec),
            step,
        });
    }
    if raw == "*" {
        return Some(FieldSpec::Wildcard);
    }
    if raw.contains(',') {
        let values: Option<Vec<u32>> = raw.split(',').map(|v| v.parse().ok()).collect();
        return values.map(FieldSpec::List);
    }
    if let Some((lo, hi)) = raw.split_once('-') {
        return Some(FieldSpec::Range(lo.parse().ok()?, hi.parse().ok()?));
    }
    raw.parse().ok().map(FieldSpec::Single)
}

// Implements `Cron::describe()`/`describe_lang()` deliberately not being
// used here — see Dev Notes "AD-9" and Task 2 for the full reasoning. This
// templater only recognizes the field syntaxes this project's demo phrase
// and phrase corpus need (wildcard, single value, list, range, step); any
// combination outside that vocabulary falls back to `fallback_description`
// rather than guessing at a description we haven't verified.
fn describe(expression: &str) -> String {
    let fields: Vec<&str> = expression.split_whitespace().collect();
    let standard: Vec<&str> = match fields.len() {
        5 => fields,
        6 => fields[1..].to_vec(),
        _ => return fallback_description(expression),
    };

    let Some(parsed) = standard
        .iter()
        .map(|f| parse_field(f))
        .collect::<Option<Vec<FieldSpec>>>()
    else {
        return fallback_description(expression);
    };
    let [minute, hour, dom, month, dow] = &parsed[..] else {
        return fallback_description(expression);
    };

    match (time_clause(minute, hour), day_clause(dom, month, dow)) {
        (Some(time), Some(day)) => {
            let mut combined = format!("{day}, {time}");
            capitalize_first(&mut combined);
            combined
        }
        _ => fallback_description(expression),
    }
}

fn fallback_description(expression: &str) -> String {
    format!("Runs on schedule \"{expression}\"")
}

fn time_clause(minute: &FieldSpec, hour: &FieldSpec) -> Option<String> {
    match (minute, hour) {
        (FieldSpec::Single(m), FieldSpec::Single(h)) => {
            Some(format!("at {}", format_time_of_day(*h, *m)))
        }
        (FieldSpec::Wildcard, FieldSpec::Wildcard) => Some("every minute".to_string()),
        (FieldSpec::Step { base, step }, FieldSpec::Wildcard) if **base == FieldSpec::Wildcard => {
            Some(if *step == 1 {
                "every minute".to_string()
            } else {
                format!("every {step} minutes")
            })
        }
        (FieldSpec::Single(m), FieldSpec::Step { base, step }) if **base == FieldSpec::Wildcard => {
            if *m == 0 {
                Some(if *step == 1 {
                    "every hour".to_string()
                } else {
                    format!("every {step} hours")
                })
            } else {
                Some(format!("every {step} hours at :{m:02}"))
            }
        }
        (FieldSpec::Step { base, step }, FieldSpec::Range(h1, h2))
            if **base == FieldSpec::Wildcard =>
        {
            let step_phrase = if *step == 1 {
                "minute".to_string()
            } else {
                format!("{step} minutes")
            };
            // An hour range is inclusive of the whole final hour (e.g. `9-17` matches up to
            // 5:59 PM, not stopping at 5:00 PM sharp) — describe the end boundary as one hour
            // later than the last matching hour so the phrase reflects the actual window.
            Some(format!(
                "every {step_phrase}, from {} to {}",
                format_time_of_day(*h1, 0),
                format_time_of_day((*h2 + 1) % 24, 0)
            ))
        }
        _ => None,
    }
}

fn format_time_of_day(hour: u32, minute: u32) -> String {
    let period = if hour < 12 { "AM" } else { "PM" };
    let hour12 = match hour % 12 {
        0 => 12,
        h => h,
    };
    format!("{hour12}:{minute:02} {period}")
}

fn day_clause(dom: &FieldSpec, month: &FieldSpec, dow: &FieldSpec) -> Option<String> {
    match (dom, month, dow) {
        (FieldSpec::Wildcard, FieldSpec::Wildcard, FieldSpec::Wildcard) => {
            Some("every day".to_string())
        }
        (FieldSpec::Wildcard, FieldSpec::Wildcard, FieldSpec::Single(d)) => {
            Some(format!("every {}", weekday_name(*d)?))
        }
        (FieldSpec::Wildcard, FieldSpec::Wildcard, FieldSpec::Range(a, b)) => {
            if (*a, *b) == (1, 5) {
                Some("every weekday".to_string())
            } else {
                Some(format!(
                    "every {} through {}",
                    weekday_name(*a)?,
                    weekday_name(*b)?
                ))
            }
        }
        (FieldSpec::Wildcard, FieldSpec::Wildcard, FieldSpec::List(days)) => {
            let names = days
                .iter()
                .map(|d| weekday_name(*d))
                .collect::<Option<Vec<_>>>()?;
            Some(format!("every {}", join_with_and(&names)))
        }
        (FieldSpec::Single(d), FieldSpec::Wildcard, FieldSpec::Wildcard) => {
            Some(format!("on the {}", ordinal(*d)))
        }
        (FieldSpec::Single(d), FieldSpec::Single(m), FieldSpec::Wildcard) => {
            Some(format!("on {} {}", month_name(*m)?, ordinal(*d)))
        }
        _ => None,
    }
}

fn weekday_name(d: u32) -> Option<&'static str> {
    Some(match d {
        0 | 7 => "Sunday",
        1 => "Monday",
        2 => "Tuesday",
        3 => "Wednesday",
        4 => "Thursday",
        5 => "Friday",
        6 => "Saturday",
        _ => return None,
    })
}

fn month_name(m: u32) -> Option<&'static str> {
    Some(match m {
        1 => "January",
        2 => "February",
        3 => "March",
        4 => "April",
        5 => "May",
        6 => "June",
        7 => "July",
        8 => "August",
        9 => "September",
        10 => "October",
        11 => "November",
        12 => "December",
        _ => return None,
    })
}

fn ordinal(n: u32) -> String {
    let suffix = match (n % 100, n % 10) {
        (11..=13, _) => "th",
        (_, 1) => "st",
        (_, 2) => "nd",
        (_, 3) => "rd",
        _ => "th",
    };
    format!("{n}{suffix}")
}

fn join_with_and(items: &[&str]) -> String {
    match items {
        [] => String::new(),
        [only] => only.to_string(),
        [a, b] => format!("{a} and {b}"),
        _ => {
            let (last, rest) = items.split_last().expect("non-empty checked above");
            format!("{}, and {last}", rest.join(", "))
        }
    }
}

fn capitalize_first(s: &mut str) {
    if let Some(first) = s.get_mut(0..1) {
        first.make_ascii_uppercase();
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    #[test]
    fn explain_fixed_weekday_returns_description_and_three_increasing_matching_runs() {
        let result = explain("0 9 * * 1").unwrap();

        assert_eq!(result.description, "Every Monday, at 9:00 AM");
        assert_eq!(result.next_runs.len(), 3);
        assert!(result.next_runs.windows(2).all(|w| w[0] < w[1]));

        let cron = Cron::from_str("0 9 * * 1").unwrap();
        for &epoch in &result.next_runs {
            let dt = chrono::Local.timestamp_opt(epoch, 0).unwrap();
            assert!(cron.is_time_matching(&dt).unwrap());
        }
    }

    #[test]
    fn explain_every_minute_returns_every_minute_every_day_description() {
        let result = explain("* * * * *").unwrap();
        assert_eq!(result.description, "Every day, every minute");
        assert_eq!(result.next_runs.len(), 3);
    }

    #[test]
    fn explain_every_day_at_midnight_returns_expected_description() {
        let result = explain("0 0 * * *").unwrap();
        assert_eq!(result.description, "Every day, at 12:00 AM");
        assert_eq!(result.next_runs.len(), 3);
    }

    #[test]
    fn explain_step_minutes_returns_every_n_minutes_description() {
        let result = explain("*/15 * * * *").unwrap();
        assert_eq!(result.description, "Every day, every 15 minutes");
        assert_eq!(result.next_runs.len(), 3);
    }

    #[test]
    fn explain_step_minutes_with_hour_range_and_weekday_range_returns_business_hours_description() {
        let result = explain("*/5 9-17 * * 1-5").unwrap();
        assert_eq!(
            result.description,
            "Every weekday, every 5 minutes, from 9:00 AM to 6:00 PM"
        );
        assert_eq!(result.next_runs.len(), 3);
    }

    #[test]
    fn explain_hour_range_ending_at_23_wraps_end_boundary_to_midnight() {
        let result = explain("*/5 18-23 * * *").unwrap();
        assert_eq!(
            result.description,
            "Every day, every 5 minutes, from 6:00 PM to 12:00 AM"
        );
    }

    #[test]
    fn explain_trims_surrounding_whitespace() {
        let result = explain("  0 9 * * 1  \n").unwrap();
        assert_eq!(result.description, "Every Monday, at 9:00 AM");
    }

    #[test]
    fn explain_empty_input_returns_cron_empty_pattern() {
        let err = explain("").unwrap_err();
        assert_eq!(err.code, "cron-empty-pattern");
        assert!(!err.message.is_empty());
    }

    #[test]
    fn explain_whitespace_only_input_returns_cron_empty_pattern() {
        let err = explain("   ").unwrap_err();
        assert_eq!(err.code, "cron-empty-pattern");
    }

    #[test]
    fn explain_too_few_fields_returns_cron_invalid_pattern() {
        let err = explain("* * *").unwrap_err();
        assert_eq!(err.code, "cron-invalid-pattern");
        assert!(!err.message.is_empty());
    }

    #[test]
    fn explain_out_of_range_field_value_returns_cron_component_error_naming_the_field() {
        let err = explain("* 60 * * *").unwrap_err();
        assert_eq!(err.code, "cron-component-error");
        assert!(!err.message.is_empty());
        assert_eq!(
            err.context.as_deref(),
            Some("hour field: 60 is out of range (0-23)")
        );
    }

    #[test]
    fn explain_out_of_range_day_of_month_names_the_field() {
        let err = explain("0 9 40 * *").unwrap_err();
        assert_eq!(
            err.context.as_deref(),
            Some("day of month field: 40 is out of range (1-31)")
        );
    }

    #[test]
    fn explain_illegal_characters_returns_cron_illegal_characters() {
        let err = explain("* * * * ?x?").unwrap_err();
        assert_eq!(err.code, "cron-illegal-characters");
    }

    #[test]
    fn explain_calendrically_impossible_date_returns_cron_no_upcoming_runs() {
        let err = explain("0 0 30 2 *").unwrap_err();
        assert_eq!(err.code, "cron-no-upcoming-runs");
        assert!(!err.message.is_empty());
    }

    #[test]
    fn explain_at_uses_the_provided_now_instead_of_the_system_clock() {
        let now = chrono::Local
            .with_ymd_and_hms(2026, 6, 15, 12, 0, 0)
            .unwrap();
        let result = explain_at(now, "0 9 * * 1").unwrap();

        let cron = Cron::from_str("0 9 * * 1").unwrap();
        let expected: Vec<i64> = cron
            .iter_after(now)
            .take(3)
            .map(|dt| dt.timestamp())
            .collect();
        assert_eq!(result.next_runs, expected);
    }

    #[test]
    fn map_cron_error_covers_every_variant_with_a_stable_code() {
        assert_eq!(
            map_cron_error(CronError::EmptyPattern, "").code,
            "cron-empty-pattern"
        );
        assert_eq!(
            map_cron_error(CronError::InvalidDate, "").code,
            "cron-invalid-date"
        );
        assert_eq!(
            map_cron_error(CronError::InvalidTime, "").code,
            "cron-invalid-time"
        );
        assert_eq!(
            map_cron_error(CronError::TimeSearchLimitExceeded, "").code,
            "cron-search-limit-exceeded"
        );
        assert_eq!(
            map_cron_error(CronError::InvalidPattern("x".to_string()), "").code,
            "cron-invalid-pattern"
        );
        assert_eq!(
            map_cron_error(CronError::IllegalCharacters("x".to_string()), "").code,
            "cron-illegal-characters"
        );
        assert_eq!(
            map_cron_error(CronError::ComponentError("x".to_string()), "* 60 * * *").code,
            "cron-component-error"
        );
    }
}
