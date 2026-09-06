use std::str::FromStr;

use croner::Cron;
use croner::errors::CronError;

use crate::ToolError;

// Story 8.6 AC17: a standard 5-field expression is one short line — even the most
// pathological legitimate one (every field a long comma-list) is ~360 bytes, so 1 KB can
// never reject a real expression. `cron.rs` was the only transform-tool module without a
// size guard before this. `pub` so the tests and the frontend's hand-synced mirror
// (`CronView.vue`) name one value.
pub const MAX_INPUT_BYTES: usize = 1024;

// Story 8.6 AC16: a fixed, value-free, project-authored sentence — not `croner`'s own
// runtime text — so it's the one `cron-*` code that safely joins `TRANSLATABLE_CODES`
// (`src/shell/toolError.ts`).
const SIX_FIELD_UNSUPPORTED_MESSAGE: &str = "This tool handles standard 5-field cron expressions. Seconds-precision (6-field) expressions aren't supported yet.";

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct CronExplanation {
    /// The schedule's meaning, language-neutral. The view renders it per locale
    /// (`src/tools/cron/locales/`); this module deliberately produces no prose.
    pub schedule: ScheduleDescription,
    pub next_runs: Vec<i64>, // epoch seconds (unix, i64) — view converts to local datetimes, per AD-1
}

// --- The language-neutral schedule description (Story 8.6, 2026-09-06) ------
//
// The English sentence this module used to return was presentation formatted at the wrong
// layer: once a schedule is collapsed into "Every weekday, at 9:00 AM" the meaning is gone
// and no consumer can render it in another language. Same class of mistake as returning a
// formatted date string instead of a timestamp — and the same one `toolError.ts` already
// documents for the error codes that bake a runtime value into English prose.
//
// So core now emits *meaning*, and the view renders it per locale (AD-1: transformations are
// core, presentation is the view). The seam is drawn by one test: would this be identical for
// an English reader, a French reader and a machine? Parsing, name resolution (`FRI` -> 5),
// `?` -> wildcard, and cron's day-field OR rule all pass that test and stay here. Choosing to
// say "every weekday" instead of "Monday through Friday" does not — that is an English idiom,
// and it lives in the renderer.

/// An inclusive span of values within one field.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct TermRange {
    pub from: u32,
    pub to: u32,
}

/// One field's meaning, normalised: names resolved to numbers, `?` folded into `Every`.
/// Deliberately carries no phrasing and no field identity — the same `Value(5)` is minute 5,
/// the 5th of the month, May, or Friday depending on which slot it sits in.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FieldTerm {
    /// `*` or `?`
    Every,
    /// `9`
    Value { value: u32 },
    /// `1,3,5`
    Values { values: Vec<u32> },
    /// `1-5`
    Range { range: TermRange },
    /// `*/15`, `10-50/5` (`within`), `5/10` (`from`)
    Step {
        step: u32,
        within: Option<TermRange>,
        from: Option<u32>,
    },
    /// A comma list whose parts aren't all bare values: `1-5,10`
    Union { parts: Vec<FieldTerm> },
    /// Syntax `croner` accepts but this grammar doesn't yet model — `L`, `5#3`, `15W`
    /// (Story 8.6 Cut #3). Carries the raw text so a renderer can show it verbatim and
    /// suppress the prose sentence, rather than guessing at a meaning.
    Unsupported { raw: String },
}

impl FieldTerm {
    fn is_unsupported(&self) -> bool {
        match self {
            FieldTerm::Unsupported { .. } => true,
            FieldTerm::Union { parts } => parts.iter().any(FieldTerm::is_unsupported),
            _ => false,
        }
    }
}

/// Which day fields actually constrain the schedule. Derivable from the two terms, but stated
/// once here on purpose: when BOTH day-of-month and day-of-week are restricted, cron fires on
/// either, not both. That rule is obscure enough that leaving each locale's renderer to
/// rediscover it is how one of them silently gets it wrong.
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DayMatch {
    EveryDay,
    DayOfMonthOnly,
    DayOfWeekOnly,
    EitherDayField,
}

/// The whole schedule as meaning — the contract every locale's renderer consumes.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ScheduleDescription {
    pub minute: FieldTerm,
    pub hour: FieldTerm,
    pub day_of_month: FieldTerm,
    pub month: FieldTerm,
    pub day_of_week: FieldTerm,
    pub day_match: DayMatch,
}

impl ScheduleDescription {
    /// True when any field used syntax outside this grammar — the renderer suppresses its
    /// prose sentence in that case and leans on the per-field breakdown.
    pub fn has_unsupported_field(&self) -> bool {
        [
            &self.minute,
            &self.hour,
            &self.day_of_month,
            &self.month,
            &self.day_of_week,
        ]
        .iter()
        .any(|term| term.is_unsupported())
    }
}

fn to_term(kind: FieldKind, raw: &str) -> FieldTerm {
    match parse_field(kind, raw) {
        Some(spec) => spec_to_term(&spec),
        None => FieldTerm::Unsupported {
            raw: raw.to_string(),
        },
    }
}

fn spec_to_term(spec: &FieldSpec) -> FieldTerm {
    match spec {
        FieldSpec::Wildcard => FieldTerm::Every,
        FieldSpec::Single(value) => FieldTerm::Value { value: *value },
        FieldSpec::List(values) => FieldTerm::Values {
            values: values.clone(),
        },
        FieldSpec::Range(from, to) => FieldTerm::Range {
            range: TermRange {
                from: *from,
                to: *to,
            },
        },
        FieldSpec::Step { base, step } => {
            let (within, from) = match &**base {
                FieldSpec::Range(a, b) => (Some(TermRange { from: *a, to: *b }), None),
                FieldSpec::Single(a) => (None, Some(*a)),
                _ => (None, None),
            };
            FieldTerm::Step {
                step: *step,
                within,
                from,
            }
        }
        FieldSpec::Compound(parts) => FieldTerm::Union {
            parts: parts.iter().map(spec_to_term).collect(),
        },
    }
}

fn schedule_description(standard: &[&str]) -> ScheduleDescription {
    let minute = to_term(FieldKind::Minute, standard[0]);
    let hour = to_term(FieldKind::Hour, standard[1]);
    let day_of_month = to_term(FieldKind::DayOfMonth, standard[2]);
    let month = to_term(FieldKind::Month, standard[3]);
    let day_of_week = to_term(FieldKind::DayOfWeek, standard[4]);

    let dom_restricted = day_of_month != FieldTerm::Every;
    let dow_restricted = day_of_week != FieldTerm::Every;
    let day_match = match (dom_restricted, dow_restricted) {
        (false, false) => DayMatch::EveryDay,
        (true, false) => DayMatch::DayOfMonthOnly,
        (false, true) => DayMatch::DayOfWeekOnly,
        (true, true) => DayMatch::EitherDayField,
    };

    ScheduleDescription {
        minute,
        hour,
        day_of_month,
        month,
        day_of_week,
        day_match,
    }
}

pub fn explain(expression: &str) -> Result<CronExplanation, ToolError> {
    explain_at(chrono::Local::now(), expression)
}

// Takes `now` as a parameter (rather than reading `chrono::Local::now()` directly) so this
// function's output is reproducible in tests — this module's output is a stable, controllable
// contract per this file's own tests, and Story 8.6's redesign keeps that contract unchanged.
fn explain_at(
    now: chrono::DateTime<chrono::Local>,
    expression: &str,
) -> Result<CronExplanation, ToolError> {
    // Byte-length guard first — before any trimming or splitting — so a pathological paste
    // is rejected without allocating anything past the length check itself. Fixed prose that
    // embeds the runtime byte count, so it renders raw via `toolErrorMessage` and stays out
    // of `TRANSLATABLE_CODES`, matching `hash-input-too-large` / `json-input-too-large` /
    // `jwt-input-too-large`.
    if expression.len() > MAX_INPUT_BYTES {
        return Err(ToolError {
            code: "cron-input-too-large".to_string(),
            message: format!(
                "input is {} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit",
                expression.len()
            ),
            position: None,
            context: None,
        });
    }

    let trimmed = expression.trim();

    // Story 8.6 AC16: `croner` silently accepts an optional leading seconds field, but this
    // tool's own `describe()` templater discards it while `next_runs` correctly reflects
    // seconds precision — a redesign that "explains a cron expression properly" must not
    // let that mismatch through. Rejected before any parsing, so a 6-field expression never
    // reaches `describe()`/`field_explanations()` (both parse 5-field expressions only).
    if trimmed.split_whitespace().count() == 6 {
        return Err(ToolError {
            code: "cron-six-field-unsupported".to_string(),
            message: SIX_FIELD_UNSUPPORTED_MESSAGE.to_string(),
            position: None,
            context: None,
        });
    }

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
    let standard: Vec<&str> = trimmed.split_whitespace().collect();
    let schedule = schedule_description(&standard);
    Ok(CronExplanation {
        schedule,
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
                if let Ok(value) = candidate.parse::<u32>()
                    && (value < *min || value > *max)
                {
                    return Some(format!(
                        "{name} field: {value} is out of range ({min}-{max})"
                    ));
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
// Which of the five standard fields a value belongs to. Needed because the same raw token
// means different things per field: `6` is a minute, an hour, the 6th of the month, June, or
// Saturday — and `JUN`/`SAT` only parse in their own field.
#[derive(Debug, Clone, Copy, PartialEq)]
enum FieldKind {
    Minute,
    Hour,
    DayOfMonth,
    Month,
    DayOfWeek,
}

// A field value as this templater understands it. Hand-parsed from the raw expression string
// (never from `croner::Cron`'s internal `CronPattern`) so this module's output vocabulary
// stays a project-owned contract — reused by both `describe()`'s sentence rendering and
// `field_explanations()`'s per-field rendering below, so the two English-rendering directions
// never drift apart on what a field shape means.
//
// `Compound` covers a comma list whose parts aren't all bare values (`1-5,0`, `1,10-20/2`) —
// `List` stays a distinct variant because an all-bare list renders far better ("0, 15, and 30")
// than the generic part-joining path.
#[derive(Debug, Clone, PartialEq)]
enum FieldSpec {
    Wildcard,
    Single(u32),
    List(Vec<u32>),
    Range(u32, u32),
    Step { base: Box<FieldSpec>, step: u32 },
    Compound(Vec<FieldSpec>),
}

const MONTH_ABBREVIATIONS: [&str; 12] = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];

const WEEKDAY_ABBREVIATIONS: [&str; 7] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// `croner` accepts three-letter names in the month and day-of-week fields (verified against
// the installed 3.x: `0 0 * * FRI`, `0 0 * jan-mar *` and `0 0 * * SUN,SAT` all parse), and
// they're common in real crontabs — so this templater has to understand them too, or a
// perfectly ordinary expression would render as an unexplained fallback.
fn parse_value(kind: FieldKind, raw: &str) -> Option<u32> {
    if let Ok(value) = raw.parse::<u32>() {
        return Some(value);
    }
    let lowered = raw.to_ascii_lowercase();
    match kind {
        FieldKind::Month => MONTH_ABBREVIATIONS
            .iter()
            .position(|name| *name == lowered)
            .map(|index| index as u32 + 1),
        FieldKind::DayOfWeek => WEEKDAY_ABBREVIATIONS
            .iter()
            .position(|name| *name == lowered)
            .map(|index| index as u32),
        _ => None,
    }
}

fn parse_field(kind: FieldKind, raw: &str) -> Option<FieldSpec> {
    // A comma list is the outermost structure — each part is itself a full term.
    if raw.contains(',') {
        let parts: Option<Vec<FieldSpec>> =
            raw.split(',').map(|part| parse_term(kind, part)).collect();
        let parts = parts?;
        // All bare values collapse to `List`, which reads better than joining parts.
        let bare: Option<Vec<u32>> = parts
            .iter()
            .map(|part| match part {
                FieldSpec::Single(value) => Some(*value),
                _ => None,
            })
            .collect();
        return Some(match bare {
            Some(values) => FieldSpec::List(values),
            None => FieldSpec::Compound(parts),
        });
    }
    parse_term(kind, raw)
}

// One comma-free term: `*`, `?`, a value, a range, or any of those with a `/step` suffix.
fn parse_term(kind: FieldKind, raw: &str) -> Option<FieldSpec> {
    if let Some((base, step)) = raw.split_once('/') {
        let step: u32 = step.parse().ok()?;
        if step == 0 {
            return None;
        }
        return Some(FieldSpec::Step {
            base: Box::new(parse_base(kind, base)?),
            step,
        });
    }
    parse_base(kind, raw)
}

fn parse_base(kind: FieldKind, raw: &str) -> Option<FieldSpec> {
    // `?` means "no specific value" in the day fields — semantically a wildcard here.
    if raw == "*" || raw == "?" {
        return Some(FieldSpec::Wildcard);
    }
    if let Some((low, high)) = raw.split_once('-') {
        return Some(FieldSpec::Range(
            parse_value(kind, low)?,
            parse_value(kind, high)?,
        ));
    }
    parse_value(kind, raw).map(FieldSpec::Single)
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    // Note what this module no longer tests: English sentences. Phrasing moved to the view
    // (`src/tools/cron/locales/`), and so did its corpus — see `locales/en.spec.ts` and
    // `locales/fr.spec.ts`. What stays here is everything that is true regardless of who is
    // reading: parsing, normalisation, cron's own semantics, and the error contract.

    // --- explain(): runs, errors, guards ----------------------------------

    #[test]
    fn explain_returns_three_increasing_runs_that_all_match_the_expression() {
        let result = explain("0 9 * * 1").unwrap();

        assert_eq!(result.next_runs.len(), 3);
        assert!(result.next_runs.windows(2).all(|w| w[0] < w[1]));

        let cron = Cron::from_str("0 9 * * 1").unwrap();
        for &epoch in &result.next_runs {
            let dt = chrono::Local.timestamp_opt(epoch, 0).unwrap();
            assert!(cron.is_time_matching(&dt).unwrap());
        }
    }

    #[test]
    fn explain_trims_surrounding_whitespace() {
        let result = explain("  0 9 * * 1  \n").unwrap();
        assert_eq!(result.schedule.minute, FieldTerm::Value { value: 0 });
        assert_eq!(result.schedule.day_of_week, FieldTerm::Value { value: 1 });
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

    // --- Story 8.6 AC16/AC17: 6-field rejection + the size guard ----------

    #[test]
    fn explain_six_field_expression_returns_cron_six_field_unsupported() {
        // `croner` silently accepts the optional leading seconds field and `next_runs` would
        // correctly reflect it, but nothing downstream models seconds — describing
        // "30 0 9 * * 1" as "at 9:00 AM" when it fires at :30 would be a real lie.
        let err = explain("30 0 9 * * 1").unwrap_err();
        assert_eq!(err.code, "cron-six-field-unsupported");
        assert_eq!(
            err.message,
            "This tool handles standard 5-field cron expressions. Seconds-precision (6-field) expressions aren't supported yet."
        );
        assert!(err.context.is_none());
    }

    #[test]
    fn explain_rejects_input_over_max_bytes() {
        // Padded with trailing whitespace so the *raw* length is 1 byte over the cap — the
        // guard runs before trimming, so this must still be rejected.
        let padded = format!(
            "0 9 * * 1{}",
            " ".repeat(MAX_INPUT_BYTES - "0 9 * * 1".len() + 1)
        );
        assert_eq!(padded.len(), MAX_INPUT_BYTES + 1);
        let err = explain(&padded).unwrap_err();
        assert_eq!(err.code, "cron-input-too-large");
        assert!(err.message.contains(&(MAX_INPUT_BYTES + 1).to_string()));
    }

    #[test]
    fn explain_succeeds_at_exact_max_byte_boundary() {
        let padded = format!(
            "0 9 * * 1{}",
            " ".repeat(MAX_INPUT_BYTES - "0 9 * * 1".len())
        );
        assert_eq!(padded.len(), MAX_INPUT_BYTES);
        let result = explain(&padded).unwrap();
        assert_eq!(result.schedule.hour, FieldTerm::Value { value: 9 });
    }

    #[test]
    fn explain_normal_short_input_is_unaffected_by_the_size_guard() {
        let result = explain("0 9 * * 1").unwrap();
        assert_eq!(result.schedule.minute, FieldTerm::Value { value: 0 });
    }

    // --- Story 8.6: the language-neutral schedule description --------------

    fn schedule_of(expression: &str) -> ScheduleDescription {
        explain(expression).unwrap().schedule
    }

    #[test]
    fn schedule_description_normalises_each_field_to_a_term() {
        let schedule = schedule_of("*/15 9-17 * * 1-5");
        assert_eq!(
            schedule.minute,
            FieldTerm::Step {
                step: 15,
                within: None,
                from: None
            }
        );
        assert_eq!(
            schedule.hour,
            FieldTerm::Range {
                range: TermRange { from: 9, to: 17 }
            }
        );
        assert_eq!(schedule.day_of_month, FieldTerm::Every);
        assert_eq!(schedule.month, FieldTerm::Every);
        assert_eq!(
            schedule.day_of_week,
            FieldTerm::Range {
                range: TermRange { from: 1, to: 5 }
            }
        );
        assert_eq!(schedule.day_match, DayMatch::DayOfWeekOnly);
    }

    #[test]
    fn schedule_description_resolves_names_and_question_marks_before_the_view_sees_them() {
        // Name resolution and `?` are semantics, not phrasing — every locale gets numbers.
        let schedule = schedule_of("0 0 ? JAN,APR FRI");
        assert_eq!(schedule.day_of_month, FieldTerm::Every);
        assert_eq!(schedule.month, FieldTerm::Values { values: vec![1, 4] });
        assert_eq!(schedule.day_of_week, FieldTerm::Value { value: 5 });
    }

    #[test]
    fn schedule_description_carries_the_step_shapes_apart() {
        assert_eq!(
            schedule_of("10-50/5 * * * *").minute,
            FieldTerm::Step {
                step: 5,
                within: Some(TermRange { from: 10, to: 50 }),
                from: None
            }
        );
        assert_eq!(
            schedule_of("5/10 * * * *").minute,
            FieldTerm::Step {
                step: 10,
                within: None,
                from: Some(5)
            }
        );
    }

    #[test]
    fn schedule_description_keeps_a_mixed_list_as_a_union_of_parts() {
        assert_eq!(
            schedule_of("1-5,10 * * * *").minute,
            FieldTerm::Union {
                parts: vec![
                    FieldTerm::Range {
                        range: TermRange { from: 1, to: 5 }
                    },
                    FieldTerm::Value { value: 10 },
                ]
            }
        );
    }

    #[test]
    fn schedule_description_states_crons_day_field_or_rule() {
        assert_eq!(schedule_of("0 9 * * *").day_match, DayMatch::EveryDay);
        assert_eq!(
            schedule_of("0 9 15 * *").day_match,
            DayMatch::DayOfMonthOnly
        );
        assert_eq!(schedule_of("0 9 * * 1").day_match, DayMatch::DayOfWeekOnly);
        // Both restricted: cron fires on either, and the contract says so outright.
        assert_eq!(
            schedule_of("0 9 15 * 1").day_match,
            DayMatch::EitherDayField
        );
    }

    #[test]
    fn schedule_description_preserves_unsupported_syntax_verbatim() {
        let schedule = schedule_of("0 0 L * *");
        assert_eq!(
            schedule.day_of_month,
            FieldTerm::Unsupported {
                raw: "L".to_string()
            }
        );
        assert!(schedule.has_unsupported_field());
        // Every other field still parsed — a renderer can show four good rows and one raw.
        assert_eq!(schedule.minute, FieldTerm::Value { value: 0 });
        assert!(!schedule_of("0 0 1 * *").has_unsupported_field());
    }

    // The whole plain grammar, swept: every shape this module claims to parse, in every
    // field, combined. The assertion is completeness of the *description*, not of any
    // sentence — the sentence's own coverage is asserted per locale, in the view's specs.
    #[test]
    fn schedule_description_is_complete_for_the_whole_plain_grammar() {
        const MINUTES: [&str; 8] = ["*", "0", "5", "0,30", "10-50", "*/15", "10-50/5", "5/10"];
        const HOURS: [&str; 7] = ["*", "0", "9", "9,17", "9-17", "*/2", "9-17/2"];
        const DAYS_OF_MONTH: [&str; 7] = ["*", "?", "1", "15", "1,15", "1-15", "1-28/7"];
        const MONTHS: [&str; 7] = ["*", "6", "1,6", "3-8", "*/3", "JAN", "jan-mar"];
        const DAYS_OF_WEEK: [&str; 8] = ["*", "?", "0", "1-5", "1,3,5", "*/2", "MON", "MON-FRI"];

        let mut checked = 0usize;
        for minute in MINUTES {
            for hour in HOURS {
                for dom in DAYS_OF_MONTH {
                    for month in MONTHS {
                        for dow in DAYS_OF_WEEK {
                            let expression = format!("{minute} {hour} {dom} {month} {dow}");
                            assert!(
                                Cron::from_str(&expression).is_ok(),
                                "{expression:?} should be valid croner syntax"
                            );
                            let standard: Vec<&str> = expression.split_whitespace().collect();
                            let schedule = schedule_description(&standard);
                            assert!(
                                !schedule.has_unsupported_field(),
                                "{expression:?} produced an unsupported field: {schedule:?}"
                            );
                            checked += 1;
                        }
                    }
                }
            }
        }
        assert_eq!(checked, 8 * 7 * 7 * 7 * 8);
    }

    #[test]
    fn schedule_description_serialises_as_a_tagged_union_for_the_view() {
        // The view's hand-synced TypeScript mirror reads `kind` to discriminate.
        let json = serde_json::to_value(schedule_of("*/15 * * * 1-5")).unwrap();
        assert_eq!(json["minute"]["kind"], "step");
        assert_eq!(json["minute"]["step"], 15);
        assert_eq!(json["day_of_week"]["kind"], "range");
        assert_eq!(json["day_of_week"]["range"]["from"], 1);
        assert_eq!(json["day_of_week"]["range"]["to"], 5);
        assert_eq!(json["day_of_month"]["kind"], "every");
        assert_eq!(json["day_match"], "day_of_week_only");
    }
}
