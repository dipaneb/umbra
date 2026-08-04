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

// --- Story 3.2: natural-language schedule -> cron expression -------------
//
// AD-9 requires every generated expression to be round-tripped through
// `describe()` before it's ever returned. The only way to make that check a
// genuine safety net (rather than a tautology that can never fail or catch
// anything) is for this parser to build its `expected_description` out of
// the *same* `time_clause`/`day_clause` helpers `describe()` itself calls —
// see Dev Notes on Story 3.2. Do not add a second, independent English
// renderer here.

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ScheduleParseResult {
    pub expression: String,
    pub description: String,
    pub next_runs: Vec<i64>,
}

pub fn parse_schedule(phrase: &str) -> Result<ScheduleParseResult, ToolError> {
    parse_schedule_at(chrono::Local::now(), phrase)
}

fn parse_schedule_at(
    now: chrono::DateTime<chrono::Local>,
    phrase: &str,
) -> Result<ScheduleParseResult, ToolError> {
    let trimmed = phrase.trim();
    if trimmed.is_empty() {
        return Err(ToolError {
            code: "cron-nl-empty-phrase".to_string(),
            message: "Type a schedule in plain English, like \"every weekday at 8:30am\"."
                .to_string(),
            position: None,
            context: None,
        });
    }
    let lower = trimmed.to_lowercase();

    if let Some(result) = try_parse_full(now, &lower) {
        return result;
    }

    // try_parse_full only returns None when no day clause matched at all —
    // run a cheap diagnostic pass for a bare ambiguous time with no day
    // clause (e.g. FR21's own named example, "at 9") before the generic
    // catch-all.
    if let Some(context) = detect_ambiguous_time(&lower) {
        return Err(ambiguous_time_error_with_context(context));
    }

    Err(ToolError {
        code: "cron-nl-unrecognized".to_string(),
        message: unrecognized_message(),
        position: None,
        context: None,
    })
}

fn unrecognized_message() -> String {
    "Couldn't recognize this as a schedule. Umbra's schedule parser understands English phrases \
     only in v1 (e.g. \"every weekday at 8:30am\")."
        .to_string()
}

fn ambiguous_time_error_with_context(context: String) -> ToolError {
    ToolError {
        code: "cron-nl-ambiguous-time".to_string(),
        message: "Couldn't tell whether this time means AM or PM.".to_string(),
        position: None,
        context: Some(context),
    }
}

// Builds an honest-failure error that names what the day clause was
// understood as, per FR21's "shows what it did understand." Used for every
// failure downstream of a recognized day clause so that context is never
// silently dropped, whatever comes after it.
fn day_understood_error(understood_day: &str, detail: &str) -> ToolError {
    ToolError {
        code: "cron-nl-unrecognized".to_string(),
        message: unrecognized_message(),
        position: None,
        context: Some(format!("Understood '{understood_day}', but {detail}")),
    }
}

fn ambiguous_time_error_with_day(understood_day: &str, hour: u32, minute: u32) -> ToolError {
    ambiguous_time_error_with_context(format!(
        "Understood '{understood_day}', at a time of {hour}:{minute:02} — but couldn't tell \
         whether it means AM or PM — say '{hour}am' or '{hour}pm'."
    ))
}

// Attempts the full `<day clause> <time clause>` grammar. `None` means no
// day clause and no bare step-time phrase matched at all (caller runs a
// global diagnostic pass for a more specific honest-failure message in that
// case). Once a day clause IS recognized, this always returns `Some(...)` —
// Ok on success, or an honest failure that names the day clause understood,
// whatever went wrong with the rest of the phrase.
fn try_parse_full(
    now: chrono::DateTime<chrono::Local>,
    lower: &str,
) -> Option<Result<ScheduleParseResult, ToolError>> {
    if let Some((dow, rest)) = parse_day_clause(lower) {
        let mut rest = rest.trim_start();
        if let Some(after_comma) = rest.strip_prefix(',') {
            rest = after_comma.trim_start();
        }
        let understood_day = || {
            day_clause(&FieldSpec::Wildcard, &FieldSpec::Wildcard, &dow)
                .unwrap_or_else(|| "part of a schedule".to_string())
        };

        if let Some(after_at) = rest.strip_prefix("at ") {
            return Some(match parse_time_fixed(after_at.trim_start()) {
                FixedTimeOutcome::Ok(minute, hour) => build_result(now, dow, minute, hour),
                FixedTimeOutcome::AmbiguousNoAmPm(h, m) => {
                    Err(ambiguous_time_error_with_day(&understood_day(), h, m))
                }
                FixedTimeOutcome::NoMatch => Err(day_understood_error(
                    &understood_day(),
                    "the time wasn't recognized.",
                )),
            });
        }

        if let Some(after_every) = rest.strip_prefix("every ") {
            return Some(match parse_time_step(after_every.trim_start()) {
                Some((minute, hour)) => build_result(now, dow, minute, hour),
                None => Err(day_understood_error(
                    &understood_day(),
                    "the step schedule wasn't recognized.",
                )),
            });
        }

        if rest.is_empty() {
            return Some(Err(day_understood_error(
                &understood_day(),
                "no time of day was given.",
            )));
        }

        return Some(Err(day_understood_error(
            &understood_day(),
            "the rest of this schedule wasn't recognized.",
        )));
    }

    // No explicit day clause. A bare step-time phrase ("every 15 minutes",
    // "every 2 hours") implicitly means "every day" — `describe()` renders
    // that combination too (see the `explain_step_minutes_...` test above).
    if let Some(after_every) = starts_with_word(lower, "every") {
        if let Some((minute, hour)) = parse_time_step(after_every.trim_start()) {
            return Some(build_result(now, FieldSpec::Wildcard, minute, hour));
        }
    }

    None
}

fn build_result(
    now: chrono::DateTime<chrono::Local>,
    dow: FieldSpec,
    minute: FieldSpec,
    hour: FieldSpec,
) -> Result<ScheduleParseResult, ToolError> {
    let dom = FieldSpec::Wildcard;
    let month = FieldSpec::Wildcard;

    let expected_description = match (time_clause(&minute, &hour), day_clause(&dom, &month, &dow)) {
        (Some(time), Some(day)) => {
            let mut combined = format!("{day}, {time}");
            capitalize_first(&mut combined);
            combined
        }
        _ => {
            return Err(ToolError {
                code: "cron-nl-unrecognized".to_string(),
                message: unrecognized_message(),
                position: None,
                context: None,
            });
        }
    };

    let expression = format!(
        "{} {} {} {} {}",
        field_to_cron(&minute),
        field_to_cron(&hour),
        field_to_cron(&dom),
        field_to_cron(&month),
        field_to_cron(&dow),
    );

    // Validates the candidate string actually parses via `croner` and reuses
    // the existing "calendrically impossible" guard for free (defense in
    // depth — this grammar never emits a dom/month combination that could
    // trigger it, but propagate rather than swallow if it ever does).
    let explanation = explain_at(now, &expression)?;

    if explanation.description != expected_description {
        return Err(ToolError {
            code: "cron-nl-round-trip-mismatch".to_string(),
            message: "Internal consistency check failed while generating this schedule."
                .to_string(),
            position: None,
            context: None,
        });
    }

    Ok(ScheduleParseResult {
        expression,
        description: explanation.description,
        next_runs: explanation.next_runs,
    })
}

fn field_to_cron(spec: &FieldSpec) -> String {
    match spec {
        FieldSpec::Wildcard => "*".to_string(),
        FieldSpec::Single(n) => n.to_string(),
        FieldSpec::List(values) => values
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(","),
        FieldSpec::Range(a, b) => format!("{a}-{b}"),
        FieldSpec::Step { base, step } => format!("{}/{step}", field_to_cron(base)),
    }
}

// Requires a word boundary (whitespace, comma, or end-of-string) right after
// `word` so e.g. "day" doesn't spuriously match inside a longer token.
fn starts_with_word<'a>(s: &'a str, word: &str) -> Option<&'a str> {
    let rest = s.strip_prefix(word)?;
    if rest.is_empty() || rest.starts_with(|c: char| c.is_whitespace() || c == ',') {
        Some(rest)
    } else {
        None
    }
}

// Parses the day-clause portion of the grammar (Task 3): "every day",
// "every weekday", "every <Weekday>", or an and/comma-joined weekday list.
// `dom`/`month` are always `Wildcard` for every form this grammar supports —
// day-of-month/month phrases are explicitly out of scope for this story.
fn parse_day_clause(s: &str) -> Option<(FieldSpec, &str)> {
    let after_every = starts_with_word(s, "every")?;
    let rest = after_every.trim_start();

    if let Some(r) = starts_with_word(rest, "weekday") {
        return Some((FieldSpec::Range(1, 5), r));
    }
    if let Some(r) = starts_with_word(rest, "day") {
        return Some((FieldSpec::Wildcard, r));
    }

    let (days, rest) = parse_weekday_list(rest)?;
    let dow = if days.len() == 1 {
        FieldSpec::Single(days[0])
    } else {
        FieldSpec::List(days)
    };
    Some((dow, rest))
}

fn parse_weekday_name(s: &str) -> Option<(u32, &str)> {
    const NAMES: [(&str, u32); 7] = [
        ("sunday", 0),
        ("monday", 1),
        ("tuesday", 2),
        ("wednesday", 3),
        ("thursday", 4),
        ("friday", 5),
        ("saturday", 6),
    ];
    for (name, num) in NAMES {
        if let Some(rest) = starts_with_word(s, name) {
            return Some((num, rest));
        }
    }
    None
}

// "<Weekday>" | "<Weekday> and <Weekday>" | "<Weekday>, <Weekday>, and <Weekday>"
// (2+ items) — comma-and-joined, order preserved as typed. Repeats (e.g.
// "Monday and Monday") collapse to one entry rather than producing a
// redundant cron field/description.
fn parse_weekday_list(s: &str) -> Option<(Vec<u32>, &str)> {
    let (first, mut rest) = parse_weekday_name(s.trim_start())?;
    let mut days = vec![first];
    loop {
        let trimmed = rest.trim_start();
        if let Some(after_comma) = trimmed.strip_prefix(',') {
            let after_comma = after_comma.trim_start();
            if let Some(after_and) = starts_with_word(after_comma, "and") {
                let (d, r) = parse_weekday_name(after_and.trim_start())?;
                if !days.contains(&d) {
                    days.push(d);
                }
                rest = r;
                break;
            }
            let (d, r) = parse_weekday_name(after_comma)?;
            if !days.contains(&d) {
                days.push(d);
            }
            rest = r;
            continue;
        }
        if let Some(after_and) = starts_with_word(trimmed, "and") {
            let (d, r) = parse_weekday_name(after_and.trim_start())?;
            if !days.contains(&d) {
                days.push(d);
            }
            rest = r;
            break;
        }
        rest = trimmed;
        break;
    }
    Some((days, rest))
}

enum FixedTimeOutcome {
    Ok(FieldSpec, FieldSpec),  // (minute, hour)
    AmbiguousNoAmPm(u32, u32), // (hour as typed, 1-12; minute as typed)
    NoMatch,
}

// "H am" | "H:MM am" | "H pm" | "H:MM pm" — am/pm mandatory, never inferred
// (`am`/`pm`/`a.m.`/`p.m.`, with or without a space before the marker).
fn parse_time_fixed(s: &str) -> FixedTimeOutcome {
    let Some(((hour, minute), rest)) = parse_hour_minute(s) else {
        return FixedTimeOutcome::NoMatch;
    };
    if hour == 0 || hour > 12 || minute > 59 {
        return FixedTimeOutcome::NoMatch;
    }
    match parse_ampm(rest) {
        Some((is_pm, after)) => {
            if !after.trim().is_empty() {
                return FixedTimeOutcome::NoMatch;
            }
            let hour24 = match (hour, is_pm) {
                (12, false) => 0,
                (12, true) => 12,
                (h, false) => h,
                (h, true) => h + 12,
            };
            FixedTimeOutcome::Ok(FieldSpec::Single(minute), FieldSpec::Single(hour24))
        }
        None if rest.trim().is_empty() => FixedTimeOutcome::AmbiguousNoAmPm(hour, minute),
        None => FixedTimeOutcome::NoMatch,
    }
}

fn parse_hour_minute(s: &str) -> Option<((u32, u32), &str)> {
    let digits_end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
    if digits_end == 0 {
        return None;
    }
    let hour: u32 = s[..digits_end].parse().ok()?;
    let mut rest = &s[digits_end..];
    let mut minute = 0u32;
    if let Some(after_colon) = rest.strip_prefix(':') {
        let minute_end = after_colon
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(after_colon.len());
        if minute_end == 0 {
            return None;
        }
        minute = after_colon[..minute_end].parse().ok()?;
        rest = &after_colon[minute_end..];
    }
    Some(((hour, minute), rest))
}

fn parse_ampm(s: &str) -> Option<(bool, &str)> {
    let s = s.trim_start();
    const MARKERS: [(&str, bool); 4] =
        [("a.m.", false), ("am", false), ("p.m.", true), ("pm", true)];
    for (pat, is_pm) in MARKERS {
        if let Some(rest) = s.strip_prefix(pat) {
            return Some((is_pm, rest));
        }
    }
    None
}

// "every N minutes" -> minute Step{Wildcard,N}, hour Wildcard.
// "every N hours" -> hour Step{Wildcard,N}, minute Single(0).
// `s` is the text *after* the leading "every " has already been consumed.
fn parse_time_step(s: &str) -> Option<(FieldSpec, FieldSpec)> {
    let digits_end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
    if digits_end == 0 {
        return None;
    }
    let n: u32 = s[..digits_end].parse().ok()?;
    if n == 0 {
        return None;
    }
    let rest = s[digits_end..].trim_start();

    if let Some(after) = rest
        .strip_prefix("minutes")
        .or_else(|| rest.strip_prefix("minute"))
    {
        // Minute field range is 0-59 — a step outside that range (e.g. "every
        // 90 minutes") would silently produce a cron expression whose real
        // recurrence doesn't match the phrase (croner accepts */90 without
        // error, but a value never has 90 subtracted from it, so it only
        // ever matches minute 0 — an hourly schedule, not a 90-minute one).
        if after.trim().is_empty() && n <= 59 {
            return Some((
                FieldSpec::Step {
                    base: Box::new(FieldSpec::Wildcard),
                    step: n,
                },
                FieldSpec::Wildcard,
            ));
        }
        return None;
    }
    if let Some(after) = rest
        .strip_prefix("hours")
        .or_else(|| rest.strip_prefix("hour"))
    {
        // Hour field range is 0-23 — same reasoning as the minute branch
        // above (e.g. "every 30 hours" would actually fire daily, not every
        // 30 hours).
        if after.trim().is_empty() && n <= 23 {
            return Some((
                FieldSpec::Single(0),
                FieldSpec::Step {
                    base: Box::new(FieldSpec::Wildcard),
                    step: n,
                },
            ));
        }
        return None;
    }
    None
}

// Scans for an "at <digits>[:mm]" time expression with no trailing am/pm
// marker, anywhere in the phrase — this fires even when no day clause is
// present at all (e.g. the bare phrase "at 9", FR21's own named example).
// Requires a word boundary before "at" (whitespace/comma/start-of-string) so
// this doesn't spuriously fire inside words like "chat"/"format"/"combat" —
// and keeps scanning past a false match so a genuine ambiguity later in the
// phrase is still found.
fn detect_ambiguous_time(lower: &str) -> Option<String> {
    for (idx, _) in lower.match_indices("at ") {
        let at_word_boundary = idx == 0
            || lower[..idx]
                .chars()
                .next_back()
                .is_some_and(|c| c.is_whitespace() || c == ',');
        if !at_word_boundary {
            continue;
        }
        let after = lower[idx + "at ".len()..].trim_start();
        if let FixedTimeOutcome::AmbiguousNoAmPm(hour, minute) = parse_time_fixed(after) {
            return Some(format!(
                "Understood a time of {hour}:{minute:02}, but couldn't tell whether it means AM \
                 or PM — say '{hour}am' or '{hour}pm'."
            ));
        }
    }
    None
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

    // --- Story 3.2: parse_schedule ---------------------------------------

    #[test]
    fn parse_schedule_every_weekday_at_fixed_time_converts() {
        let result = parse_schedule("every weekday at 8:30am").unwrap();
        assert_eq!(result.expression, "30 8 * * 1-5");
        assert_eq!(result.description, "Every weekday, at 8:30 AM");
        assert_eq!(result.next_runs.len(), 3);
    }

    #[test]
    fn parse_schedule_every_single_weekday_at_fixed_time_converts() {
        let result = parse_schedule("every Monday at 9am").unwrap();
        assert_eq!(result.expression, "0 9 * * 1");
        assert_eq!(result.description, "Every Monday, at 9:00 AM");
    }

    #[test]
    fn parse_schedule_every_day_at_pm_time_converts() {
        let result = parse_schedule("every day at 9pm").unwrap();
        assert_eq!(result.expression, "0 21 * * *");
        assert_eq!(result.description, "Every day, at 9:00 PM");
    }

    #[test]
    fn parse_schedule_weekday_list_at_fixed_time_converts() {
        let result = parse_schedule("every Monday, Wednesday, and Friday at 6am").unwrap();
        assert_eq!(result.expression, "0 6 * * 1,3,5");
        assert_eq!(
            result.description,
            "Every Monday, Wednesday, and Friday, at 6:00 AM"
        );
    }

    #[test]
    fn parse_schedule_bare_step_minutes_implies_every_day() {
        let result = parse_schedule("every 15 minutes").unwrap();
        assert_eq!(result.expression, "*/15 * * * *");
        assert_eq!(result.description, "Every day, every 15 minutes");
    }

    #[test]
    fn parse_schedule_bare_step_hours_implies_every_day() {
        let result = parse_schedule("every 2 hours").unwrap();
        assert_eq!(result.expression, "0 */2 * * *");
        assert_eq!(result.description, "Every day, every 2 hours");
    }

    #[test]
    fn parse_schedule_result_expression_re_describes_to_the_same_description() {
        // The test that would actually catch a future regression where the
        // NL parser and `describe()` drift apart (Task 2's core risk).
        let result = parse_schedule("every weekday at 8:30am").unwrap();
        assert_eq!(describe(&result.expression), result.description);
    }

    #[test]
    fn parse_schedule_empty_phrase_returns_cron_nl_empty_phrase() {
        let err = parse_schedule("").unwrap_err();
        assert_eq!(err.code, "cron-nl-empty-phrase");
        assert!(err.context.is_none());
    }

    #[test]
    fn parse_schedule_whitespace_only_phrase_returns_cron_nl_empty_phrase() {
        let err = parse_schedule("   ").unwrap_err();
        assert_eq!(err.code, "cron-nl-empty-phrase");
    }

    #[test]
    fn parse_schedule_ambiguous_time_without_am_pm_names_the_ambiguity() {
        let err = parse_schedule("at 9").unwrap_err();
        assert_eq!(err.code, "cron-nl-ambiguous-time");
        let context = err.context.expect("context should be present");
        assert!(!context.is_empty());
        assert!(!context.contains("* *"));
    }

    #[test]
    fn parse_schedule_non_english_input_returns_cron_nl_unrecognized() {
        let err = parse_schedule("tous les lundis à 9h").unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
        assert!(!err.message.is_empty());
        assert!(!err.message.contains("* *"));
    }

    #[test]
    fn parse_schedule_out_of_scope_vocabulary_returns_cron_nl_unrecognized() {
        let err = parse_schedule("every third Friday of the month").unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
        assert!(!err.message.is_empty());
        assert!(!err.message.contains("* *"));
    }

    #[test]
    fn parse_schedule_garbage_input_returns_cron_nl_unrecognized() {
        let err = parse_schedule("asdfasdf").unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
        assert!(!err.message.is_empty());
        assert!(!err.message.contains("* *"));
    }

    #[test]
    fn parse_schedule_day_clause_without_time_names_what_was_understood() {
        let err = parse_schedule("every weekday").unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
        assert_eq!(
            err.context.as_deref(),
            Some("Understood 'every weekday', but no time of day was given.")
        );
    }

    #[test]
    fn parse_schedule_word_ending_in_at_does_not_trigger_a_fabricated_ambiguous_time() {
        // Regression test: `detect_ambiguous_time` used to do an unanchored
        // substring search for "at ", so "chat 9"/"format 9" would falsely
        // report an understood-but-ambiguous time that was never present.
        for phrase in ["chat 9", "format 9", "combat 9"] {
            let err = parse_schedule(phrase).unwrap_err();
            assert_eq!(
                err.code, "cron-nl-unrecognized",
                "phrase {phrase:?} should be unrecognized, not a fabricated ambiguous time"
            );
        }
    }

    #[test]
    fn parse_schedule_ambiguous_time_still_detected_after_an_earlier_false_match() {
        // A false "at " match earlier in the phrase must not stop the scan
        // from finding a real ambiguous time later on.
        let err = parse_schedule("chat at 9").unwrap_err();
        assert_eq!(err.code, "cron-nl-ambiguous-time");
    }

    #[test]
    fn parse_schedule_step_minutes_out_of_field_range_is_rejected() {
        // Regression test: the minute field only spans 0-59, so "every 90
        // minutes" used to silently generate "*/90 * * * *" — which croner
        // accepts, but which actually only ever matches minute 0, i.e. an
        // hourly schedule, not a 90-minute one.
        let err = parse_schedule("every 90 minutes").unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
    }

    #[test]
    fn parse_schedule_step_hours_out_of_field_range_is_rejected() {
        // Same reasoning as the minutes case above, for the hour field's
        // 0-23 range ("every 30 hours" would actually fire daily).
        let err = parse_schedule("every 30 hours").unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
    }

    #[test]
    fn parse_schedule_step_minutes_at_the_field_boundary_still_converts() {
        let result = parse_schedule("every 59 minutes").unwrap();
        assert_eq!(result.expression, "*/59 * * * *");
    }

    #[test]
    fn parse_schedule_malformed_trailing_time_still_names_the_understood_day() {
        let err = parse_schedule("every weekday at 25:00").unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
        assert_eq!(
            err.context.as_deref(),
            Some("Understood 'every weekday', but the time wasn't recognized.")
        );
    }

    #[test]
    fn parse_schedule_ambiguous_time_after_a_day_clause_names_the_understood_day() {
        let err = parse_schedule("every weekday at 8:30").unwrap_err();
        assert_eq!(err.code, "cron-nl-ambiguous-time");
        let context = err.context.expect("context should be present");
        assert!(context.contains("every weekday"));
        assert!(context.contains("8:30"));
    }

    #[test]
    fn parse_schedule_unrecognized_trailing_text_does_not_falsely_claim_no_time_was_given() {
        // Regression test: trailing text after a recognized day clause that
        // isn't in the "at "/"every " shape used to be silently discarded,
        // producing a false "no time of day was given" even when the
        // trailing text actually contained a time.
        let err = parse_schedule("every weekday sometime at 9am").unwrap_err();
        assert_eq!(err.code, "cron-nl-unrecognized");
        let context = err.context.expect("context should be present");
        assert!(context.contains("every weekday"));
        assert!(!context.contains("no time of day was given"));
    }

    #[test]
    fn parse_schedule_duplicate_weekday_in_list_is_deduplicated() {
        let result = parse_schedule("every Monday and Monday at 9am").unwrap();
        assert_eq!(result.expression, "0 9 * * 1");
        assert_eq!(result.description, "Every Monday, at 9:00 AM");
    }
}
