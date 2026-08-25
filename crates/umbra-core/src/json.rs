use crate::{Position, ToolError};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JsonIndent {
    TwoSpaces,
    FourSpaces,
    Tab,
}

impl JsonIndent {
    fn as_bytes(self) -> &'static [u8] {
        match self {
            JsonIndent::TwoSpaces => b"  ",
            JsonIndent::FourSpaces => b"    ",
            JsonIndent::Tab => b"\t",
        }
    }
}

// Upper bound on accepted input length, in bytes. `serde_json::from_str` builds
// an owned `Value` tree (and `format`/`minify` additionally re-serialize it),
// which is memory-proportional to input size with typical multiplier overhead
// versus the raw string — with no cap, a hostile paste of hundreds of MB to a
// few GB can drive uncontrolled allocation and freeze or OOM the process
// (CWE-400). Set well above FR9's 10 MB "must handle comfortably" bar (see the
// 10 MB fixture tests below) so it never turns away a legitimate document,
// while still bounding the worst case.
const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

// Nesting-depth protection (CWE-400 adjacent: a small, deeply-nested payload
// can exhaust the stack even when well under MAX_INPUT_BYTES). serde_json
// enforces a 128-level recursion limit on `from_str::<Value>` by default —
// verified directly: a 100,000-deep nested array is rejected with a clean
// `RecursionLimitExceeded` error, not a stack overflow. This holds as long as
// the `unbounded_depth` feature stays off (see `Cargo.toml`, which enables
// only `preserve_order`); if a future dependency change ever turns that
// feature on, the regression tests below stop passing — as a clean assertion
// failure if the limit is merely raised, or as an aborted test process if
// it's removed outright, but either way CI stops being green instead of
// silently reopening this gap. `format`/`minify`/`parse` all build their
// `Value` tree through this same guarded call before anything else runs, so
// `JsonTreeValue`'s `From<Value>` conversion (below) only ever walks an
// already-bounded tree.

fn check_input_size(input: &str) -> Result<(), ToolError> {
    if input.len() > MAX_INPUT_BYTES {
        return Err(ToolError {
            code: "json-input-too-large".to_string(),
            message: format!(
                "input is {} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit",
                input.len()
            ),
            position: None,
            context: None,
        });
    }
    Ok(())
}

pub fn format(input: &str, indent: JsonIndent) -> Result<String, ToolError> {
    check_input_size(input)?;
    let value: serde_json::Value = serde_json::from_str(input).map_err(map_parse_error)?;
    let mut buf = Vec::new();
    // `PrettyFormatter::with_indent` (not `to_string_pretty`, which is fixed at
    // 2 spaces) accepts an arbitrary indent byte sequence — needed for the tab case.
    let formatter = serde_json::ser::PrettyFormatter::with_indent(indent.as_bytes());
    let mut serializer = serde_json::Serializer::with_formatter(&mut buf, formatter);
    value
        .serialize(&mut serializer)
        .map_err(map_internal_error)?;
    String::from_utf8(buf).map_err(map_internal_error)
}

pub fn minify(input: &str) -> Result<String, ToolError> {
    check_input_size(input)?;
    let value: serde_json::Value = serde_json::from_str(input).map_err(map_parse_error)?;
    serde_json::to_string(&value).map_err(map_internal_error)
}

pub fn parse(input: &str) -> Result<serde_json::Value, ToolError> {
    check_input_size(input)?;
    serde_json::from_str(input).map_err(map_parse_error)
}

// Story 8.1 AC9/Repair: one change entry per heuristic fix `repair` applied.
// `position` is `None` for a fix with no single natural location (closing an
// unclosed bracket happens at EOF, not at the bracket itself — the bracket's
// own opening position is already visible to the user in the shared input).
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct RepairChange {
    pub code: String,
    pub description: String,
    pub position: Option<Position>,
}

// AD-9/`EXPERIENCE.md` honesty bar: `repair` only ever *proposes* — it never
// mutates the caller's input itself. `still_invalid` is the honest signal
// that lets the view say "heuristics couldn't fully fix this" instead of
// presenting a broken result as if it were a confident fix; the view is the
// one place that turns `repaired` into new input, and only on an explicit
// user confirm (never automatically from this function completing).
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct RepairResult {
    pub repaired: String,
    pub changes: Vec<RepairChange>,
    pub still_invalid: bool,
}

// Single-pass heuristic scanner covering exactly the five categories AC9
// names (trailing/missing commas, single quotes, unquoted keys, JS-style
// comments, unclosed brackets) — not a general-purpose lenient JSON parser.
// It does not track full object/array grammar (key vs. value position), so
// it can't catch every malformed document; `still_invalid` on the result is
// what keeps that limitation honest rather than silent.
struct RepairScanner {
    chars: Vec<char>,
    i: usize,
    out: String,
    changes: Vec<RepairChange>,
    stack: Vec<char>,
    line: u32,
    col: u32,
    // Set once the most recently scanned token could end a JSON value (a
    // string, number, keyword literal, or closing bracket) — cleared by `,`
    // and `:`. A value-starting token encountered while this is still true
    // means nothing separated it from the previous one.
    after_value: bool,
}

impl RepairScanner {
    fn new(input: &str) -> Self {
        RepairScanner {
            chars: input.chars().collect(),
            i: 0,
            out: String::with_capacity(input.len()),
            changes: Vec::new(),
            stack: Vec::new(),
            line: 1,
            col: 1,
            after_value: false,
        }
    }

    fn len(&self) -> usize {
        self.chars.len()
    }

    fn cur(&self) -> char {
        self.chars[self.i]
    }

    fn peek(&self, offset: usize) -> Option<char> {
        self.chars.get(self.i + offset).copied()
    }

    fn bump(&mut self) -> char {
        let c = self.chars[self.i];
        if c == '\n' {
            self.line += 1;
            self.col = 1;
        } else {
            self.col += 1;
        }
        self.i += 1;
        c
    }

    fn push_change(&mut self, code: &str, description: String, line: u32, column: u32) {
        self.changes.push(RepairChange {
            code: code.to_string(),
            description,
            position: Some(Position::LineCol { line, column }),
        });
    }

    fn maybe_insert_missing_comma(&mut self) {
        if self.after_value && matches!(self.stack.last(), Some('{') | Some('[')) {
            // Whitespace between the two values was already passed straight
            // through to `out` by `run`'s whitespace branch before this ever
            // gets a chance to fire — trim it back off first so the fix
            // reads as a clean `,`, not a stray space sitting in front of it.
            let trimmed_len = self.out.trim_end().len();
            self.out.truncate(trimmed_len);
            self.out.push(',');
            self.push_change(
                "missing-comma",
                "Inserted a missing comma between items".to_string(),
                self.line,
                self.col,
            );
        }
    }

    fn skip_line_comment(&mut self) {
        let (start_line, start_col) = (self.line, self.col);
        while self.i < self.len() && self.cur() != '\n' {
            self.bump();
        }
        self.push_change(
            "js-comment",
            "Removed a // comment (not valid in JSON)".to_string(),
            start_line,
            start_col,
        );
    }

    fn skip_block_comment(&mut self) {
        let (start_line, start_col) = (self.line, self.col);
        self.bump(); // '/'
        self.bump(); // '*'
        while self.i < self.len() && !(self.cur() == '*' && self.peek(1) == Some('/')) {
            self.bump();
        }
        if self.i < self.len() {
            self.bump(); // '*'
            self.bump(); // '/'
        }
        self.push_change(
            "js-comment",
            "Removed a /* */ comment (not valid in JSON)".to_string(),
            start_line,
            start_col,
        );
    }

    fn scan_string(&mut self, quote: char) {
        self.maybe_insert_missing_comma();
        let (start_line, start_col) = (self.line, self.col);
        if quote == '\'' {
            self.push_change(
                "single-quoted-string",
                "Converted a single-quoted string to double-quoted".to_string(),
                start_line,
                start_col,
            );
        }
        self.bump(); // opening quote
        self.out.push('"');
        let mut closed = false;
        while self.i < self.len() {
            let c = self.cur();
            if c == '\\' && self.peek(1).is_some() {
                let ch = self.bump();
                self.out.push(ch);
                let ch = self.bump();
                self.out.push(ch);
                continue;
            }
            if c == quote {
                self.bump();
                self.out.push('"');
                closed = true;
                break;
            }
            if quote == '\'' && c == '"' {
                self.bump();
                self.out.push('\\');
                self.out.push('"');
                continue;
            }
            let ch = self.bump();
            self.out.push(ch);
        }
        if !closed {
            self.out.push('"');
            self.push_change(
                "unterminated-string",
                "Closed a string that was missing its closing quote".to_string(),
                start_line,
                start_col,
            );
        }
        self.after_value = true;
    }

    fn strip_trailing_comma(&mut self) {
        let new_len = {
            let trimmed = self.out.trim_end();
            trimmed.ends_with(',').then(|| trimmed.len() - 1)
        };
        if let Some(new_len) = new_len {
            self.out.truncate(new_len);
            self.push_change(
                "trailing-comma",
                "Removed a trailing comma before a closing bracket".to_string(),
                self.line,
                self.col,
            );
        }
    }

    fn scan_word(&mut self) {
        self.maybe_insert_missing_comma();
        let (start_line, start_col) = (self.line, self.col);
        let start = self.i;
        while self.i < self.len()
            && (self.cur().is_alphanumeric() || self.cur() == '_' || self.cur() == '$')
        {
            self.bump();
        }
        let word: String = self.chars[start..self.i].iter().collect();

        // Peeking ahead (skipping whitespace) for a following `:` is what
        // distinguishes an unquoted object *key* from a bare `true`/`false`/
        // `null` literal or unrecognized garbage passed through unchanged.
        let mut j = self.i;
        while j < self.chars.len() && self.chars[j].is_whitespace() {
            j += 1;
        }
        let is_key = self.chars.get(j) == Some(&':');

        if is_key && word != "true" && word != "false" && word != "null" {
            self.out.push('"');
            self.out.push_str(&word);
            self.out.push('"');
            self.push_change(
                "unquoted-key",
                format!("Quoted the unquoted key `{word}`"),
                start_line,
                start_col,
            );
            self.after_value = false;
        } else {
            self.out.push_str(&word);
            self.after_value = true;
        }
    }

    fn scan_number(&mut self) {
        self.maybe_insert_missing_comma();
        let start = self.i;
        if self.cur() == '-' {
            self.bump();
        }
        while self.i < self.len() && self.cur().is_ascii_digit() {
            self.bump();
        }
        if self.i < self.len() && self.cur() == '.' {
            self.bump();
            while self.i < self.len() && self.cur().is_ascii_digit() {
                self.bump();
            }
        }
        if self.i < self.len() && (self.cur() == 'e' || self.cur() == 'E') {
            self.bump();
            if self.i < self.len() && (self.cur() == '+' || self.cur() == '-') {
                self.bump();
            }
            while self.i < self.len() && self.cur().is_ascii_digit() {
                self.bump();
            }
        }
        let num: String = self.chars[start..self.i].iter().collect();
        self.out.push_str(&num);
        self.after_value = true;
    }

    fn run(&mut self) {
        while self.i < self.len() {
            let c = self.cur();

            if c.is_whitespace() {
                let ch = self.bump();
                self.out.push(ch);
                continue;
            }
            if c == '/' && self.peek(1) == Some('/') {
                self.skip_line_comment();
                continue;
            }
            if c == '/' && self.peek(1) == Some('*') {
                self.skip_block_comment();
                continue;
            }
            if c == '"' || c == '\'' {
                self.scan_string(c);
                continue;
            }
            if c == '{' || c == '[' {
                self.maybe_insert_missing_comma();
                self.stack.push(c);
                let ch = self.bump();
                self.out.push(ch);
                self.after_value = false;
                continue;
            }
            if c == '}' || c == ']' {
                self.strip_trailing_comma();
                self.stack.pop();
                let ch = self.bump();
                self.out.push(ch);
                self.after_value = true;
                continue;
            }
            if c == ',' {
                let ch = self.bump();
                self.out.push(ch);
                self.after_value = false;
                continue;
            }
            if c == ':' {
                let ch = self.bump();
                self.out.push(ch);
                self.after_value = false;
                continue;
            }
            if c.is_alphabetic() || c == '_' || c == '$' {
                self.scan_word();
                continue;
            }
            if c.is_ascii_digit() || c == '-' {
                self.scan_number();
                continue;
            }
            // Unrecognized character (stray punctuation etc.) — passed
            // through as-is; `repair` only targets the five documented
            // categories (AC9), not arbitrary garbage.
            let ch = self.bump();
            self.out.push(ch);
        }
    }

    fn finish(mut self) -> (String, Vec<RepairChange>) {
        while let Some(open) = self.stack.pop() {
            let close = if open == '{' { '}' } else { ']' };
            self.out.push(close);
            self.changes.push(RepairChange {
                code: "unclosed-bracket".to_string(),
                description: format!("Closed an unclosed `{open}`"),
                position: None,
            });
        }
        (self.out, self.changes)
    }
}

pub fn repair(input: &str) -> Result<RepairResult, ToolError> {
    check_input_size(input)?;
    let mut scanner = RepairScanner::new(input);
    scanner.run();
    let (repaired, changes) = scanner.finish();
    let still_invalid = parse(&repaired).is_err();
    Ok(RepairResult {
        repaired,
        changes,
        still_invalid,
    })
}

// Wire type for the JSON tree (Story 1.8): `serde_json::Value::Object` round-trips
// through Tauri's IPC as a plain JS object, and the ECMAScript spec always
// enumerates canonical-integer-string keys ("0", "1", ...) in ascending numeric
// order before any other string keys, regardless of source order. Real payloads
// have numeric-ID-keyed objects, so the tree needs a shape immune to that —
// arrays fully preserve order no matter what the keys look like.
//
// `Number` carries the value's exact source text, not `serde_json::Number`:
// that type round-trips through Tauri's IPC as a native JS number (float64),
// silently losing precision for any integer beyond `Number.MAX_SAFE_INTEGER`
// (e.g. snowflake IDs) — the same category of "native-JS-representation
// silently mangles real payload data" pitfall motivating the `Object` shape
// above, just for numbers instead of keys.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(tag = "kind", content = "data")]
pub enum JsonTreeValue {
    Null,
    Bool(bool),
    Number(String),
    String(String),
    Array(Vec<JsonTreeValue>),
    Object(Vec<(String, JsonTreeValue)>),
}

impl From<serde_json::Value> for JsonTreeValue {
    fn from(value: serde_json::Value) -> Self {
        match value {
            serde_json::Value::Null => JsonTreeValue::Null,
            serde_json::Value::Bool(b) => JsonTreeValue::Bool(b),
            serde_json::Value::Number(n) => JsonTreeValue::Number(n.to_string()),
            serde_json::Value::String(s) => JsonTreeValue::String(s),
            serde_json::Value::Array(a) => {
                JsonTreeValue::Array(a.into_iter().map(Into::into).collect())
            }
            serde_json::Value::Object(m) => {
                JsonTreeValue::Object(m.into_iter().map(|(k, v)| (k, v.into())).collect())
            }
        }
    }
}

// Story 8.1 AC8: name the actual failure instead of passing serde_json's
// generic text through unchanged (the JWT Inspector precedent). serde_json's
// own `ErrorCode` enum (its Display impl, `error.rs`) is `pub(crate)` — not
// reachable as a typed value — so this matches on the fixed, closed set of
// English phrases its `Display` emits, verified directly against the vendored
// serde_json 1.0.151 source rather than assumed. Every phrase here maps to an
// `ErrorCode` variant that is actually reachable from `from_str::<Value>`
// (confirmed by reading `de.rs`); variants only reachable when deserializing
// into a typed struct (`Message`, `Io`) or a numeric-keyed map
// (`ExpectedDoubleQuote`, `ExpectedNumericKey`, `FloatKeyMustBeFinite`) are
// intentionally absent — `parse`/`format`/`minify` only ever target `Value`.
// The `json-syntax` fallback exists purely as a defensive net for a future
// serde_json release adding a new variant; every regression test below
// exercises a real reachable branch, so a classification gap would show up as
// a changed `err.code` assertion failing, not a silent miss.
fn classify_syntax_error(raw: &str) -> Option<(&'static str, &'static str)> {
    if raw.contains("trailing comma") {
        Some((
            "json-trailing-comma",
            "trailing comma before a closing `]` or `}` — remove it",
        ))
    } else if raw.contains("trailing characters") {
        Some((
            "json-trailing-characters",
            "unexpected content after the JSON value ended — check for an extra closing bracket or stray text",
        ))
    } else if raw.contains("EOF while parsing a string") {
        Some((
            "json-unterminated-string",
            "unterminated string — missing a closing `\"`",
        ))
    } else if raw.contains("EOF while parsing a list") {
        Some((
            "json-unclosed-array",
            "unclosed array — missing a closing `]`",
        ))
    } else if raw.contains("EOF while parsing an object") {
        Some((
            "json-unclosed-object",
            "unclosed object — missing a closing `}`",
        ))
    } else if raw.contains("EOF while parsing a value") {
        Some(("json-unexpected-end", "unexpected end of input"))
    } else if raw.contains("expected `:`") {
        Some(("json-expected-colon", "expected `:` after an object key"))
    } else if raw.contains("expected `,` or `]`") {
        Some((
            "json-expected-array-separator",
            "expected `,` between array items, or `]` to close the array",
        ))
    } else if raw.contains("expected `,` or `}`") {
        Some((
            "json-expected-object-separator",
            "expected `,` between object entries, or `}` to close the object",
        ))
    } else if raw.contains("expected ident") || raw.contains("expected value") {
        Some((
            "json-expected-value",
            "expected a value here — a string, number, object, array, true, false, or null",
        ))
    } else if raw.contains("invalid escape") {
        Some((
            "json-invalid-escape",
            "invalid `\\` escape sequence in a string",
        ))
    } else if raw.contains("invalid number") {
        Some(("json-invalid-number", "invalid number literal"))
    } else if raw.contains("number out of range") {
        Some((
            "json-number-out-of-range",
            "number is too large to represent",
        ))
    } else if raw.contains("invalid unicode code point")
        || raw.contains("surrogate")
        || raw.contains("hex escape")
    {
        Some(("json-invalid-unicode", "invalid unicode escape sequence"))
    } else if raw.contains("control character") {
        Some((
            "json-control-character",
            "unescaped control character in a string — escape it as `\\u00XX`",
        ))
    } else if raw.contains("key must be a string") {
        Some((
            "json-key-must-be-string",
            "object keys must be strings wrapped in double quotes",
        ))
    } else if raw.contains("recursion limit exceeded") {
        Some(("json-nesting-too-deep", "document is nested too deeply"))
    } else {
        None
    }
}

fn map_parse_error(err: serde_json::Error) -> ToolError {
    let position = Position::LineCol {
        line: err.line() as u32,
        column: err.column() as u32,
    };
    let raw = err.to_string();
    let (code, message) = match classify_syntax_error(&raw) {
        Some((code, message)) => (code.to_string(), message.to_string()),
        None => ("json-syntax".to_string(), raw),
    };
    ToolError {
        code,
        message,
        position: Some(position),
        context: None,
    }
}

// Handles steps that are fallible in signature only (re-serializing a Value we
// just parsed; the pretty-printer emitting valid UTF-8) — real failures here
// would be exceptional, but this keeps them an Err instead of an unwrap/panic.
fn map_internal_error<E: std::fmt::Display>(err: E) -> ToolError {
    ToolError {
        code: "json-internal".to_string(),
        message: err.to_string(),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_with_two_spaces_produces_expected_output() {
        let result = format(r#"{"a":1,"b":2}"#, JsonIndent::TwoSpaces).unwrap();
        assert_eq!(result, "{\n  \"a\": 1,\n  \"b\": 2\n}");
    }

    #[test]
    fn format_with_four_spaces_produces_expected_output() {
        let result = format(r#"{"a":1,"b":2}"#, JsonIndent::FourSpaces).unwrap();
        assert_eq!(result, "{\n    \"a\": 1,\n    \"b\": 2\n}");
    }

    #[test]
    fn format_with_tab_produces_expected_output() {
        let result = format(r#"{"a":1,"b":2}"#, JsonIndent::Tab).unwrap();
        assert_eq!(result, "{\n\t\"a\": 1,\n\t\"b\": 2\n}");
    }

    #[test]
    fn minify_collapses_multiline_document_to_one_line() {
        let input = "{\n  \"a\": 1,\n  \"b\": [1, 2, 3]\n}";
        let result = minify(input).unwrap();
        assert_eq!(result, r#"{"a":1,"b":[1,2,3]}"#);
    }

    #[test]
    fn format_preserves_key_order_regression() {
        let result = format(r#"{"b":1,"a":2}"#, JsonIndent::TwoSpaces).unwrap();
        assert_eq!(result, "{\n  \"b\": 1,\n  \"a\": 2\n}");
    }

    #[test]
    fn minify_preserves_key_order_regression() {
        let result = minify(r#"{"b":1,"a":2}"#).unwrap();
        assert_eq!(result, r#"{"b":1,"a":2}"#);
    }

    #[test]
    fn format_malformed_input_returns_json_expected_value_error_with_position() {
        let err = format(r#"{"a":}"#, JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-expected-value");
        assert!(
            !err.message.contains("line"),
            "message should not duplicate the structured position field"
        );
        assert!(matches!(err.position, Some(Position::LineCol { .. })));
        if let Some(Position::LineCol { line, column }) = err.position {
            assert_eq!(line, 1);
            assert_eq!(column, 6);
        }
    }

    #[test]
    fn minify_malformed_input_returns_json_expected_value_error_with_position() {
        let err = minify(r#"{"a":}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-value");
        assert!(matches!(err.position, Some(Position::LineCol { .. })));
    }

    #[test]
    fn format_empty_string_returns_unexpected_end_error() {
        let err = format("", JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-unexpected-end");
    }

    #[test]
    fn minify_empty_string_returns_unexpected_end_error() {
        let err = minify("").unwrap_err();
        assert_eq!(err.code, "json-unexpected-end");
    }

    #[test]
    fn parse_valid_object_preserves_key_order() {
        let result = parse(r#"{"b":1,"a":2}"#).unwrap();
        assert_eq!(result, serde_json::json!({"b": 1, "a": 2}));
        assert_eq!(
            result.as_object().unwrap().keys().collect::<Vec<_>>(),
            vec!["b", "a"]
        );
    }

    #[test]
    fn parse_malformed_input_returns_json_expected_value_error_with_position() {
        let err = parse(r#"{"a":}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-value");
        assert!(matches!(err.position, Some(Position::LineCol { .. })));
        if let Some(Position::LineCol { line, column }) = err.position {
            assert_eq!(line, 1);
            assert_eq!(column, 6);
        }
    }

    #[test]
    fn parse_empty_string_returns_unexpected_end_error() {
        let err = parse("").unwrap_err();
        assert_eq!(err.code, "json-unexpected-end");
    }

    // Story 8.1 AC8: one regression per classified serde_json ErrorCode
    // variant that's actually reachable from `from_str::<Value>` (verified
    // against the vendored 1.0.151 source, see `classify_syntax_error`'s doc
    // comment) — locks in both the code and that no location text leaks into
    // `message` (that's `position`'s job, kept separate so the shell doesn't
    // render the location twice).
    #[test]
    fn parse_trailing_comma_in_array_returns_json_trailing_comma() {
        let err = parse("[1,2,]").unwrap_err();
        assert_eq!(err.code, "json-trailing-comma");
        assert!(!err.message.contains("line"));
    }

    #[test]
    fn parse_trailing_comma_in_object_returns_json_trailing_comma() {
        let err = parse(r#"{"a":1,}"#).unwrap_err();
        assert_eq!(err.code, "json-trailing-comma");
    }

    #[test]
    fn parse_trailing_characters_after_value_returns_json_trailing_characters() {
        let err = parse("{}{}").unwrap_err();
        assert_eq!(err.code, "json-trailing-characters");
    }

    #[test]
    fn parse_unterminated_string_returns_json_unterminated_string() {
        let err = parse(r#"{"a": "unterminated}"#).unwrap_err();
        assert_eq!(err.code, "json-unterminated-string");
    }

    #[test]
    fn parse_unclosed_array_returns_json_unclosed_array() {
        let err = parse("[1,2").unwrap_err();
        assert_eq!(err.code, "json-unclosed-array");
    }

    #[test]
    fn parse_unclosed_object_returns_json_unclosed_object() {
        let err = parse(r#"{"a":1"#).unwrap_err();
        assert_eq!(err.code, "json-unclosed-object");
    }

    #[test]
    fn parse_missing_colon_returns_json_expected_colon() {
        let err = parse(r#"{"a" 1}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-colon");
    }

    #[test]
    fn parse_missing_comma_in_array_returns_json_expected_array_separator() {
        let err = parse("[1 2]").unwrap_err();
        assert_eq!(err.code, "json-expected-array-separator");
    }

    #[test]
    fn parse_missing_comma_in_object_returns_json_expected_object_separator() {
        let err = parse(r#"{"a":1 "b":2}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-object-separator");
    }

    #[test]
    fn parse_unquoted_key_returns_json_key_must_be_string() {
        let err = parse("{a:1}").unwrap_err();
        assert_eq!(err.code, "json-key-must-be-string");
    }

    #[test]
    fn parse_single_quoted_value_returns_json_expected_value() {
        let err = parse("{\"a\": 'x'}").unwrap_err();
        assert_eq!(err.code, "json-expected-value");
    }

    #[test]
    fn parse_invalid_escape_returns_json_invalid_escape() {
        let err = parse(r#"{"a": "\q"}"#).unwrap_err();
        assert_eq!(err.code, "json-invalid-escape");
    }

    #[test]
    fn parse_invalid_number_returns_json_invalid_number() {
        let err = parse("[01]").unwrap_err();
        assert_eq!(err.code, "json-invalid-number");
    }

    #[test]
    fn parse_number_out_of_range_returns_json_number_out_of_range() {
        let err = parse("1e999999999999999999999999999999").unwrap_err();
        assert_eq!(err.code, "json-number-out-of-range");
    }

    #[test]
    fn parse_lone_leading_surrogate_returns_json_invalid_unicode() {
        // \uD800 is a leading UTF-16 surrogate with no trailing surrogate
        // pair to follow it — the string ends right after, so serde_json
        // reports `UnexpectedEndOfHexEscape` rather than being able to
        // combine it into a real codepoint.
        let err = parse(r#"{"a": "\uD800"}"#).unwrap_err();
        assert_eq!(err.code, "json-invalid-unicode");
    }

    #[test]
    fn parse_non_hex_unicode_escape_returns_json_invalid_escape() {
        // Not-hex digits after \u fail at the same step as any other
        // malformed escape character — serde_json doesn't distinguish this
        // from e.g. `\q`, so it's `InvalidEscape`, not `InvalidUnicodeCodePoint`.
        let err = parse(r#"{"a": "\uZZZZ"}"#).unwrap_err();
        assert_eq!(err.code, "json-invalid-escape");
    }

    #[test]
    fn parse_control_character_in_string_returns_json_control_character() {
        let err = parse("{\"a\": \"line\nbreak\"}").unwrap_err();
        assert_eq!(err.code, "json-control-character");
    }

    #[test]
    fn json_tree_value_preserves_large_integer_precision_as_exact_text() {
        // Regression: this would catch a reversion to `Number(serde_json::Number)`,
        // which round-trips through Tauri's IPC as a native JS float64 and silently
        // rounds any integer beyond Number.MAX_SAFE_INTEGER (e.g. snowflake IDs).
        let value: serde_json::Value = serde_json::from_str(r#"{"id":9007199254740993}"#).unwrap();
        let tree: JsonTreeValue = value.into();
        assert_eq!(
            tree,
            JsonTreeValue::Object(vec![(
                "id".to_string(),
                JsonTreeValue::Number("9007199254740993".to_string())
            )])
        );
    }

    #[test]
    fn json_tree_value_preserves_source_key_order_not_numeric_order() {
        let value: serde_json::Value =
            serde_json::from_str(r#"{"1":"b","0":"a","name":"x"}"#).unwrap();
        let tree: JsonTreeValue = value.into();
        let serialized = serde_json::to_value(&tree).unwrap();
        let data = serialized.get("data").unwrap().as_array().unwrap();
        let keys: Vec<&str> = data
            .iter()
            .map(|entry| entry.as_array().unwrap()[0].as_str().unwrap())
            .collect();
        assert_eq!(keys, vec!["1", "0", "name"]);
    }

    // Wide, flat array of many small same-shaped objects — the realistic shape for
    // FR9's 10 MB bar (large arrays/log dumps), and deliberately not deeply nested
    // so it stays well clear of the 128-level recursion limit exercised by the
    // `*_rejects_deeply_nested_input` tests below.
    fn large_json_fixture(min_bytes: usize) -> (String, u64) {
        let mut out = String::from("[");
        let mut i: u64 = 0;
        while out.len() < min_bytes {
            if i > 0 {
                out.push(',');
            }
            out.push_str(&format!(
                r#"{{"id":{i},"name":"item-{i}","active":{active},"tags":["a","b","c"]}}"#,
                active = i.is_multiple_of(2)
            ));
            i += 1;
        }
        out.push(']');
        (out, i)
    }

    #[test]
    fn format_succeeds_on_10mb_document() {
        let (input, _) = large_json_fixture(10 * 1024 * 1024);
        let result = format(&input, JsonIndent::TwoSpaces);
        assert!(result.is_ok());
    }

    #[test]
    fn minify_succeeds_on_10mb_document() {
        let (input, _) = large_json_fixture(10 * 1024 * 1024);
        let result = minify(&input);
        assert!(result.is_ok());
    }

    #[test]
    fn parse_succeeds_on_10mb_document() {
        // Expected length comes from the fixture's own item counter, not a
        // re-derived textual scan, so it can't silently drift into a
        // tautology if the fixture shape ever changes.
        let (input, expected_len) = large_json_fixture(10 * 1024 * 1024);
        let result = parse(&input).unwrap();
        assert_eq!(result.as_array().unwrap().len(), expected_len as usize);
    }

    // Regression guards for the CWE-400 unbounded-allocation finding: input
    // over `MAX_INPUT_BYTES` must be rejected before it ever reaches
    // `serde_json::from_str`, regardless of whether its content would
    // otherwise be valid JSON.
    #[test]
    fn format_rejects_input_over_max_size() {
        let input = "1".repeat(MAX_INPUT_BYTES + 1);
        let err = format(&input, JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-input-too-large");
        assert_eq!(err.position, None);
    }

    #[test]
    fn minify_rejects_input_over_max_size() {
        let input = "1".repeat(MAX_INPUT_BYTES + 1);
        let err = minify(&input).unwrap_err();
        assert_eq!(err.code, "json-input-too-large");
        assert_eq!(err.position, None);
    }

    #[test]
    fn parse_rejects_input_over_max_size() {
        let input = "1".repeat(MAX_INPUT_BYTES + 1);
        let err = parse(&input).unwrap_err();
        assert_eq!(err.code, "json-input-too-large");
        assert_eq!(err.position, None);
    }

    // Regression guards for the nesting-depth gap flagged in the Epic 1 retro:
    // a small, deeply-nested payload must be rejected cleanly, not overflow
    // the stack. `depth` produces syntactically well-formed JSON (matched
    // brackets around a single scalar), so any error on it is attributable
    // to depth alone — no need to inspect the message text, which would
    // couple these tests to serde_json's exact wording.
    fn deeply_nested_json_fixture(depth: usize) -> String {
        let mut out = String::with_capacity(depth * 2 + 1);
        out.extend(std::iter::repeat_n('[', depth));
        out.push('1');
        out.extend(std::iter::repeat_n(']', depth));
        out
    }

    #[test]
    fn parse_rejects_deeply_nested_input() {
        let input = deeply_nested_json_fixture(100_000);
        let err = parse(&input).unwrap_err();
        assert_eq!(err.code, "json-nesting-too-deep");
    }

    #[test]
    fn format_rejects_deeply_nested_input() {
        let input = deeply_nested_json_fixture(100_000);
        let err = format(&input, JsonIndent::TwoSpaces).unwrap_err();
        assert_eq!(err.code, "json-nesting-too-deep");
    }

    #[test]
    fn minify_rejects_deeply_nested_input() {
        let input = deeply_nested_json_fixture(100_000);
        let err = minify(&input).unwrap_err();
        assert_eq!(err.code, "json-nesting-too-deep");
    }

    // Boundary check on the legitimate side: a document nested well within
    // the 128-level limit must still succeed. Without this, a future
    // serde_json release that *lowered* the limit (rejecting real,
    // previously-valid documents) would pass every test above undetected.
    #[test]
    fn parse_succeeds_on_moderately_nested_input() {
        let input = deeply_nested_json_fixture(50);
        assert!(parse(&input).is_ok());
    }

    // Story 8.1 AC9: `repair` — one test per documented heuristic category,
    // plus the honesty-bar (`still_invalid`) and no-op-on-valid-input cases.
    fn change_codes(result: &RepairResult) -> Vec<&str> {
        result.changes.iter().map(|c| c.code.as_str()).collect()
    }

    #[test]
    fn repair_leaves_already_valid_json_unchanged() {
        let result = repair(r#"{"a":1,"b":[1,2,3]}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a":1,"b":[1,2,3]}"#);
        assert!(result.changes.is_empty());
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_converts_single_quoted_strings_to_double_quoted() {
        let result = repair(r#"{'a': 'x'}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a": "x"}"#);
        assert_eq!(
            change_codes(&result),
            vec!["single-quoted-string", "single-quoted-string"]
        );
        assert!(!result.still_invalid);
        assert!(parse(&result.repaired).is_ok());
    }

    #[test]
    fn repair_preserves_a_real_double_quote_inside_a_repaired_single_quoted_string() {
        let result = repair(r#"{"a": 'she said "hi"'}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a": "she said \"hi\""}"#);
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_quotes_unquoted_object_keys() {
        let result = repair(r#"{a: 1, b: 2}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a": 1, "b": 2}"#);
        assert_eq!(change_codes(&result), vec!["unquoted-key", "unquoted-key"]);
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_does_not_quote_true_false_null_literals_as_keys() {
        let result = repair(r#"[true, false, null]"#).unwrap();
        assert_eq!(result.repaired, r#"[true, false, null]"#);
        assert!(result.changes.is_empty());
    }

    #[test]
    fn repair_removes_trailing_comma_in_array() {
        let result = repair("[1,2,]").unwrap();
        assert_eq!(result.repaired, "[1,2]");
        assert_eq!(change_codes(&result), vec!["trailing-comma"]);
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_removes_trailing_comma_in_object() {
        let result = repair(r#"{"a":1,}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a":1}"#);
        assert_eq!(change_codes(&result), vec!["trailing-comma"]);
    }

    #[test]
    fn repair_inserts_missing_comma_between_array_items() {
        let result = repair("[1 2 3]").unwrap();
        assert_eq!(result.repaired, "[1,2,3]");
        assert_eq!(
            change_codes(&result),
            vec!["missing-comma", "missing-comma"]
        );
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_inserts_missing_comma_between_object_entries() {
        let result = repair(r#"{"a":1 "b":2}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a":1,"b":2}"#);
        assert_eq!(change_codes(&result), vec!["missing-comma"]);
    }

    #[test]
    fn repair_removes_js_line_comment() {
        let result = repair("{\n  \"a\": 1 // trailing note\n}").unwrap();
        assert_eq!(result.repaired, "{\n  \"a\": 1 \n}");
        assert_eq!(change_codes(&result), vec!["js-comment"]);
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_removes_js_block_comment() {
        let result = repair(r#"{/* note */"a":1}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a":1}"#);
        assert_eq!(change_codes(&result), vec!["js-comment"]);
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_closes_unclosed_array() {
        let result = repair("[1,2").unwrap();
        assert_eq!(result.repaired, "[1,2]");
        assert_eq!(change_codes(&result), vec!["unclosed-bracket"]);
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_closes_unclosed_object() {
        let result = repair(r#"{"a":1"#).unwrap();
        assert_eq!(result.repaired, r#"{"a":1}"#);
        assert_eq!(change_codes(&result), vec!["unclosed-bracket"]);
    }

    #[test]
    fn repair_closes_nested_unclosed_brackets_innermost_first() {
        let result = repair(r#"{"a":[1,2"#).unwrap();
        assert_eq!(result.repaired, r#"{"a":[1,2]}"#);
        assert_eq!(
            change_codes(&result),
            vec!["unclosed-bracket", "unclosed-bracket"]
        );
    }

    #[test]
    fn repair_closes_an_unterminated_string() {
        // No closing quote anywhere before EOF, so the trailing `}` is
        // consumed as string *content*, not a structural token — the outer
        // `{` is therefore also still open and needs its own closing brace.
        let result = repair(r#"{"a": "unterminated}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a": "unterminated}"}"#);
        assert_eq!(
            change_codes(&result),
            vec!["unterminated-string", "unclosed-bracket"]
        );
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_combines_every_heuristic_category_in_one_document() {
        let input = "{\n  a: 'x', // comment\n  \"b\": [1 2,]\n";
        let result = repair(input).unwrap();
        assert!(
            !result.still_invalid,
            "repaired output should parse cleanly: {}",
            result.repaired
        );
        assert!(parse(&result.repaired).unwrap().is_object());
        let codes = change_codes(&result);
        assert!(codes.contains(&"unquoted-key"));
        assert!(codes.contains(&"single-quoted-string"));
        assert!(codes.contains(&"js-comment"));
        assert!(codes.contains(&"missing-comma"));
        assert!(codes.contains(&"trailing-comma"));
        assert!(codes.contains(&"unclosed-bracket"));
    }

    #[test]
    fn repair_reports_still_invalid_when_heuristics_cannot_fully_fix_input() {
        // Not one of AC9's five categories (a bare, un-keyed comma-separated
        // pair at the top level) — `repair` must not pretend this is fixed.
        let result = repair("1, 2").unwrap();
        assert!(result.still_invalid);
    }

    #[test]
    fn repair_rejects_input_over_max_size() {
        let input = "1".repeat(MAX_INPUT_BYTES + 1);
        let err = repair(&input).unwrap_err();
        assert_eq!(err.code, "json-input-too-large");
    }

    #[test]
    fn repair_succeeds_on_10mb_document() {
        let (input, _) = large_json_fixture(10 * 1024 * 1024);
        let result = repair(&input);
        assert!(result.is_ok());
        assert!(!result.unwrap().still_invalid);
    }
}
