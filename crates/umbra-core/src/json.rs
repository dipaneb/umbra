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
            // Whitespace between the two values (including a real newline +
            // indentation, for a multi-line document) was already passed
            // straight through to `out` by `run`'s whitespace branch before
            // this ever gets a chance to fire. `insert` (not truncate-then-
            // push) splices the comma in right after the real content
            // without touching any of that trailing whitespace — preserving
            // the document's original line breaks/indentation instead of
            // collapsing everything after the fix onto one line.
            let insert_at = self.out.trim_end().len();
            self.out.insert(insert_at, ',');
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
        let trimmed_len = self.out.trim_end().len();
        // `,` is ASCII (one byte), so checking the raw byte immediately
        // before `trimmed_len` is a safe, valid char-boundary check.
        if trimmed_len > 0 && self.out.as_bytes()[trimmed_len - 1] == b',' {
            // `remove` (not truncate) deletes only the comma itself, leaving
            // any whitespace/newline that followed it — up to the closing
            // bracket — exactly as the original document had it.
            self.out.remove(trimmed_len - 1);
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

// Story 8.1 AC10/AC14: mirrors MAX_INPUT_BYTES's CWE-400 rationale, applied to
// the one new attacker-influenceable-length input Query adds (the expression
// itself isn't bounded by MAX_INPUT_BYTES, which only covers the document).
// Real JSONPath expressions are short, hand-typed strings — this is a
// generous defensive ceiling, not a realistic-use constraint.
const MAX_QUERY_EXPRESSION_LEN: usize = 10_000;

// Story 8.1 AC10/AC14: bounds how many matches `query` returns to the caller.
// An unbounded query (e.g. `$..*` over a 10 MB document) could otherwise
// serialize an enormous match list over Tauri's IPC — the same class of
// unbounded-output risk `MAX_INPUT_BYTES` guards on the input side. `total`
// and `truncated` keep this honest (AD-9-adjacent: never silently drop
// results) rather than quietly capping without saying so.
const MAX_QUERY_MATCHES: usize = 1000;

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct QueryMatch {
    pub path: String,
    pub value: JsonTreeValue,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct QueryResult {
    pub matches: Vec<QueryMatch>,
    pub total: usize,
    pub truncated: bool,
}

// Story 8.1 AC10: JSONPath (RFC 9535) via `serde_json_path`, chosen and
// live-verified per the decision record (see Cargo.toml's comment on the
// dependency). `query_located` (not `query`) is used specifically so each
// match carries its own normalized path — the view surfaces both, matching
// what Explorer's own copy-JSONPath action already established as this
// tool's convention (see `jsonPath.ts`).
pub fn query(input: &str, expression: &str) -> Result<QueryResult, ToolError> {
    if expression.len() > MAX_QUERY_EXPRESSION_LEN {
        return Err(ToolError {
            code: "json-query-expression-too-long".to_string(),
            message: format!(
                "query expression is {} characters, which exceeds the {MAX_QUERY_EXPRESSION_LEN}-character limit",
                expression.len()
            ),
            position: None,
            context: None,
        });
    }
    let value = parse(input)?;
    let path = serde_json_path::JsonPath::parse(expression).map_err(map_query_parse_error)?;
    let located = path.query_located(&value);
    let total = located.len();
    let matches = located
        .iter()
        .take(MAX_QUERY_MATCHES)
        .map(|located_node| QueryMatch {
            path: located_node.location().to_string(),
            value: located_node.node().clone().into(),
        })
        .collect();
    Ok(QueryResult {
        matches,
        total,
        truncated: total > MAX_QUERY_MATCHES,
    })
}

// serde_json_path's `ParseError` carries a 1-indexed character offset into
// the expression string (its own `position()`), not a position in the JSON
// document — kept in `ToolError.position` as an honest `ByteOffset` so the
// data isn't discarded, but the view deliberately does not wire this through
// the same jump-to-document-caret affordance the document-position errors
// use (Format/Validate/Repair), since that offset means something different
// here and would jump the wrong text field.
fn map_query_parse_error(err: serde_json_path::ParseError) -> ToolError {
    ToolError {
        code: "json-query-invalid-expression".to_string(),
        message: err.to_string(),
        position: Some(Position::ByteOffset {
            offset: err.position() as u64,
        }),
        context: None,
    }
}

// Story 8.1 AC11: per-node diff status. `Changed` on a container node means
// "something inside changed," not "this container itself was replaced" —
// see `DiffNode.old_value`'s doc comment for how those two are told apart.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiffStatus {
    Unchanged,
    Added,
    Removed,
    Changed,
}

// Mirrors `JsonTreeValue`'s own shape (Story 1.8) exactly — same variant
// names/tag convention — except `Array`/`Object` hold `DiffNode` children
// instead of plain values, so the diffed status travels with the tree
// instead of needing a second parallel structure the view would have to
// keep in sync by hand.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(tag = "kind", content = "data")]
pub enum DiffValue {
    Null,
    Bool(bool),
    Number(String),
    String(String),
    Array(Vec<DiffNode>),
    Object(Vec<(String, DiffNode)>),
}

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct DiffNode {
    pub status: DiffStatus,
    // The "current" (document B) side — for a container this recursively
    // carries every child's own `DiffNode` (so the view never needs a
    // second lookup structure to find "what does this subtree look like
    // now"), for a leaf it's simply B's value (or, for a `Removed` leaf
    // with no B side at all, A's value — the only value there is to show).
    pub value: DiffValue,
    // Only `Some` for a `Changed` *leaf* — a scalar that changed, or a
    // node whose A/B shapes don't correspond at all (e.g. a key held a
    // string in A and an object in B) and is therefore treated as a full
    // replacement rather than something to recurse into. `None` for a
    // `Changed` *container* whose own value didn't change shape — there
    // the individual added/removed/changed children already carry the
    // detail, so a redundant top-level "old value" would just be a second,
    // easily-stale copy of information the children already own.
    pub old_value: Option<JsonTreeValue>,
}

// Builds a `DiffNode` for `v` where every node in the subtree — `v` itself
// and every descendant — carries the same fixed `status`. Used directly for
// a key/index that exists on only one side (the whole subtree is uniformly
// `Added` or `Removed`, right down to its leaves, so a nested field under a
// newly-added object shows its own `+` too, not just the object's), and as
// the building block for an `Unchanged` leaf/subtree (`diff_values`'s
// `a == b` branch) and for the "new" side of a type-mismatch replacement.
fn mark_all(v: &serde_json::Value, status: DiffStatus) -> DiffNode {
    let value = match v {
        serde_json::Value::Null => DiffValue::Null,
        serde_json::Value::Bool(b) => DiffValue::Bool(*b),
        serde_json::Value::Number(n) => DiffValue::Number(n.to_string()),
        serde_json::Value::String(s) => DiffValue::String(s.clone()),
        serde_json::Value::Array(items) => {
            DiffValue::Array(items.iter().map(|item| mark_all(item, status)).collect())
        }
        serde_json::Value::Object(map) => DiffValue::Object(
            map.iter()
                .map(|(k, v)| (k.clone(), mark_all(v, status)))
                .collect(),
        ),
    };
    DiffNode {
        status,
        value,
        old_value: None,
    }
}

// Story 8.1 AC11: structural diff of two already-parsed documents. Objects
// are compared by key (so re-ordering keys alone is never reported as a
// change — only value differences are semantically meaningful in JSON);
// arrays are compared by index (the simplest correct behavior, and an
// honest one — this does not attempt LCS-style reorder-aware array diffing,
// a substantially bigger feature than this story's scope). No output-size
// cap the way `query`'s `MAX_QUERY_MATCHES` has: unlike an unbounded
// wildcard query against a normal document, a diff's output is inherently
// bounded by roughly the combined size of the two inputs — each already
// capped by `MAX_INPUT_BYTES` via `parse` — so it's the same order of
// magnitude as the single document Explorer's tree already holds in full
// (virtualized rendering, not a data-size cap, is what makes that tractable
// there too).
fn diff_values(a: &serde_json::Value, b: &serde_json::Value) -> DiffNode {
    match (a, b) {
        (serde_json::Value::Object(a_map), serde_json::Value::Object(b_map)) => {
            let mut entries = Vec::new();
            let mut any_change = false;
            // A's key order first (matches JsonTreeValue's own order-preserving
            // convention), then any B-only keys appended in B's order.
            for (k, av) in a_map {
                let child = match b_map.get(k) {
                    Some(bv) => diff_values(av, bv),
                    None => mark_all(av, DiffStatus::Removed),
                };
                any_change |= child.status != DiffStatus::Unchanged;
                entries.push((k.clone(), child));
            }
            for (k, bv) in b_map {
                if !a_map.contains_key(k) {
                    any_change = true;
                    entries.push((k.clone(), mark_all(bv, DiffStatus::Added)));
                }
            }
            DiffNode {
                status: if any_change {
                    DiffStatus::Changed
                } else {
                    DiffStatus::Unchanged
                },
                value: DiffValue::Object(entries),
                old_value: None,
            }
        }
        (serde_json::Value::Array(a_items), serde_json::Value::Array(b_items)) => {
            let mut items = Vec::new();
            let mut any_change = false;
            for i in 0..a_items.len().max(b_items.len()) {
                let child = match (a_items.get(i), b_items.get(i)) {
                    (Some(av), Some(bv)) => diff_values(av, bv),
                    (Some(av), None) => mark_all(av, DiffStatus::Removed),
                    (None, Some(bv)) => mark_all(bv, DiffStatus::Added),
                    (None, None) => unreachable!("i stays within the longer side's bounds"),
                };
                any_change |= child.status != DiffStatus::Unchanged;
                items.push(child);
            }
            DiffNode {
                status: if any_change {
                    DiffStatus::Changed
                } else {
                    DiffStatus::Unchanged
                },
                value: DiffValue::Array(items),
                old_value: None,
            }
        }
        _ if a == b => mark_all(b, DiffStatus::Unchanged),
        // Every other case — differing scalars, or a type mismatch entirely
        // (a string in A where B now has an object, say) — is a full
        // replacement, not a recursive comparison: `mark_all(b, Added)`
        // builds B's real structure (so a newly-substituted object's own
        // fields still show their own `+`), then this overrides the root
        // to `Changed` with A's old value attached for the inline
        // old-\>new display.
        _ => {
            let mut node = mark_all(b, DiffStatus::Added);
            node.status = DiffStatus::Changed;
            node.old_value = Some(JsonTreeValue::from(a.clone()));
            node
        }
    }
}

// Story 8.1 AC11/AC14: each side is parsed independently via the existing
// `parse` (so a malformed document A or B surfaces the exact same rewritten
// `json-*` classified error Validate/Query already show, no separate
// failure mode needed) — `context` is stamped with which side failed since
// `ToolError.position` alone can't say whether a `(line 1, column 6)`
// belongs to document A's textarea or document B's (the same disambiguation
// job `context` already does for JWT's per-segment errors).
pub fn diff(input_a: &str, input_b: &str) -> Result<DiffNode, ToolError> {
    let a = parse(input_a).map_err(|mut err| {
        err.context = Some("document-a".to_string());
        err
    })?;
    let b = parse(input_b).map_err(|mut err| {
        err.context = Some("document-b".to_string());
        err
    })?;
    Ok(diff_values(&a, &b))
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
        // The original separating space is kept (comma spliced in right
        // after "1", not swapped for it) — preserves whatever spacing the
        // document already had instead of tightening it.
        let result = repair("[1 2 3]").unwrap();
        assert_eq!(result.repaired, "[1, 2, 3]");
        assert_eq!(
            change_codes(&result),
            vec!["missing-comma", "missing-comma"]
        );
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_inserts_missing_comma_between_object_entries() {
        let result = repair(r#"{"a":1 "b":2}"#).unwrap();
        assert_eq!(result.repaired, r#"{"a":1, "b":2}"#);
        assert_eq!(change_codes(&result), vec!["missing-comma"]);
    }

    // User-reported (Story 8.1 AC9 follow-up): a missing comma across a real
    // line break used to collapse the whole document onto one line — the
    // fix used to blindly trim *all* trailing whitespace (including the
    // newline + next line's indentation) before inserting the comma. It now
    // splices the comma in right after the real content and leaves
    // everything after it untouched, so the line break survives.
    #[test]
    fn repair_inserts_missing_comma_across_a_line_break_without_collapsing_it() {
        let input = "{\n  \"theme\": \"dark\"\n  \"notifications\": true\n}";
        let result = repair(input).unwrap();
        assert_eq!(
            result.repaired,
            "{\n  \"theme\": \"dark\",\n  \"notifications\": true\n}"
        );
        assert_eq!(change_codes(&result), vec!["missing-comma"]);
        assert!(!result.still_invalid);
    }

    #[test]
    fn repair_removes_trailing_comma_across_a_line_break_without_collapsing_it() {
        let input = "[\n  1,\n  2,\n]";
        let result = repair(input).unwrap();
        assert_eq!(result.repaired, "[\n  1,\n  2\n]");
        assert_eq!(change_codes(&result), vec!["trailing-comma"]);
        assert!(!result.still_invalid);
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

    // Story 8.1 AC10: `query` — JSONPath (RFC 9535) via `serde_json_path`.
    #[test]
    fn query_simple_dot_access_returns_matching_value_and_path() {
        let result = query(r#"{"a":1,"b":2}"#, "$.a").unwrap();
        assert_eq!(result.total, 1);
        assert!(!result.truncated);
        assert_eq!(result.matches.len(), 1);
        assert_eq!(
            result.matches[0].value,
            JsonTreeValue::Number("1".to_string())
        );
        assert_eq!(result.matches[0].path, "$['a']");
    }

    #[test]
    fn query_wildcard_returns_every_top_level_value() {
        let result = query(r#"{"a":1,"b":2,"c":3}"#, "$.*").unwrap();
        assert_eq!(result.total, 3);
        let values: Vec<&JsonTreeValue> = result.matches.iter().map(|m| &m.value).collect();
        assert_eq!(
            values,
            vec![
                &JsonTreeValue::Number("1".to_string()),
                &JsonTreeValue::Number("2".to_string()),
                &JsonTreeValue::Number("3".to_string()),
            ]
        );
    }

    #[test]
    fn query_recursive_descent_finds_nested_keys() {
        let result = query(r#"{"a":{"name":"x","b":{"name":"y"}}}"#, "$..name").unwrap();
        assert_eq!(result.total, 2);
        let values: Vec<&JsonTreeValue> = result.matches.iter().map(|m| &m.value).collect();
        assert_eq!(
            values,
            vec![
                &JsonTreeValue::String("x".to_string()),
                &JsonTreeValue::String("y".to_string()),
            ]
        );
    }

    // RFC 9535's own worked example (section 1.5's bookstore document) — a
    // filter expression with a numeric comparison, checked against the
    // spec's documented expected result rather than an assumption about how
    // the crate behaves.
    #[test]
    fn query_filter_expression_matches_rfc9535_worked_example() {
        let document = r#"{
            "store": {
                "book": [
                    {"category": "reference", "title": "Sayings of the Century", "price": 8.95},
                    {"category": "fiction", "title": "Sword of Honour", "price": 12.99},
                    {"category": "fiction", "title": "Moby Dick", "price": 8.99},
                    {"category": "fiction", "title": "The Lord of the Rings", "price": 22.99}
                ]
            }
        }"#;
        let result = query(document, "$.store.book[?@.price < 10].title").unwrap();
        let values: Vec<&JsonTreeValue> = result.matches.iter().map(|m| &m.value).collect();
        assert_eq!(
            values,
            vec![
                &JsonTreeValue::String("Sayings of the Century".to_string()),
                &JsonTreeValue::String("Moby Dick".to_string()),
            ]
        );
    }

    #[test]
    fn query_with_no_matches_returns_empty_result_not_an_error() {
        let result = query(r#"{"a":1}"#, "$.nonexistent").unwrap();
        assert_eq!(result.total, 0);
        assert!(result.matches.is_empty());
        assert!(!result.truncated);
    }

    #[test]
    fn query_invalid_expression_returns_clear_error_with_position() {
        let err = query(r#"{"a":1}"#, "$.[").unwrap_err();
        assert_eq!(err.code, "json-query-invalid-expression");
        assert!(!err.message.is_empty());
        assert!(matches!(err.position, Some(Position::ByteOffset { .. })));
    }

    #[test]
    fn query_on_malformed_document_surfaces_the_documents_own_parse_error() {
        // Query only makes sense over a valid document (AC10's own "Given
        // valid JSON is loaded"); when the document itself doesn't parse,
        // `query` surfaces exactly the same classified error `parse` would,
        // not a query-specific one — there's no separate failure mode here.
        let err = query(r#"{"a":}"#, "$.a").unwrap_err();
        assert_eq!(err.code, "json-expected-value");
    }

    #[test]
    fn query_rejects_expression_over_max_length() {
        let expression = "$".to_string() + &".a".repeat(MAX_QUERY_EXPRESSION_LEN);
        let err = query(r#"{"a":1}"#, &expression).unwrap_err();
        assert_eq!(err.code, "json-query-expression-too-long");
    }

    #[test]
    fn query_truncates_and_reports_total_when_matches_exceed_the_cap() {
        let mut items = Vec::new();
        for i in 0..(MAX_QUERY_MATCHES + 1) {
            items.push(i.to_string());
        }
        let document = format!("[{}]", items.join(","));
        let result = query(&document, "$[*]").unwrap();
        assert_eq!(result.total, MAX_QUERY_MATCHES + 1);
        assert_eq!(result.matches.len(), MAX_QUERY_MATCHES);
        assert!(result.truncated);
    }

    #[test]
    fn query_succeeds_on_10mb_document() {
        let (input, expected_len) = large_json_fixture(10 * 1024 * 1024);
        let result = query(&input, "$[0].id").unwrap();
        assert_eq!(result.total, 1);
        assert!(!result.truncated);
        assert_eq!(
            result.matches[0].value,
            JsonTreeValue::Number("0".to_string())
        );
        // Sanity-check the fixture itself actually has more than one item,
        // so this test is exercising a real 10 MB array, not a fluke.
        assert!(expected_len > 1);
    }

    // Story 8.1 AC11: `diff` — structural comparison of two documents.
    fn diff_ok(a: &str, b: &str) -> DiffNode {
        diff(a, b).unwrap()
    }

    fn object_entry<'a>(node: &'a DiffNode, key: &str) -> &'a DiffNode {
        match &node.value {
            DiffValue::Object(entries) => &entries.iter().find(|(k, _)| k == key).unwrap().1,
            other => panic!("expected an Object DiffValue, got {other:?}"),
        }
    }

    #[test]
    fn diff_reports_unchanged_for_identical_documents() {
        let result = diff_ok(r#"{"a":1}"#, r#"{"a":1}"#);
        assert_eq!(result.status, DiffStatus::Unchanged);
        let a = object_entry(&result, "a");
        assert_eq!(a.status, DiffStatus::Unchanged);
        assert_eq!(a.value, DiffValue::Number("1".to_string()));
        assert_eq!(a.old_value, None);
    }

    #[test]
    fn diff_detects_an_added_key() {
        let result = diff_ok(r#"{"a":1}"#, r#"{"a":1,"b":2}"#);
        assert_eq!(result.status, DiffStatus::Changed);
        let b = object_entry(&result, "b");
        assert_eq!(b.status, DiffStatus::Added);
        assert_eq!(b.value, DiffValue::Number("2".to_string()));
        assert_eq!(b.old_value, None);
    }

    #[test]
    fn diff_detects_a_removed_key() {
        let result = diff_ok(r#"{"a":1,"b":2}"#, r#"{"a":1}"#);
        assert_eq!(result.status, DiffStatus::Changed);
        let b = object_entry(&result, "b");
        assert_eq!(b.status, DiffStatus::Removed);
        assert_eq!(b.value, DiffValue::Number("2".to_string()));
    }

    #[test]
    fn diff_detects_a_changed_scalar_value_with_old_value_attached() {
        let result = diff_ok(r#"{"age":30}"#, r#"{"age":31}"#);
        let age = object_entry(&result, "age");
        assert_eq!(age.status, DiffStatus::Changed);
        assert_eq!(age.value, DiffValue::Number("31".to_string()));
        assert_eq!(age.old_value, Some(JsonTreeValue::Number("30".to_string())));
    }

    #[test]
    fn diff_does_not_report_a_change_when_only_key_order_differs() {
        let result = diff_ok(r#"{"a":1,"b":2}"#, r#"{"b":2,"a":1}"#);
        assert_eq!(result.status, DiffStatus::Unchanged);
    }

    #[test]
    fn diff_marks_every_descendant_of_a_newly_added_object() {
        let result = diff_ok(r#"{}"#, r#"{"user":{"name":"x","nested":{"y":1}}}"#);
        let user = object_entry(&result, "user");
        assert_eq!(user.status, DiffStatus::Added);
        let name = object_entry(user, "name");
        assert_eq!(name.status, DiffStatus::Added);
        let nested = object_entry(user, "nested");
        assert_eq!(nested.status, DiffStatus::Added);
        let y = object_entry(nested, "y");
        assert_eq!(y.status, DiffStatus::Added);
    }

    #[test]
    fn diff_marks_every_descendant_of_elements_trimmed_off_the_end_of_an_array() {
        // Same-shape array-to-array comparison (not a type mismatch), so the
        // trimmed elements are recursed into via the normal by-index path
        // and end up `Removed` all the way down, not just at the top.
        let result = diff_ok(r#"{"items":[1,{"a":2}]}"#, r#"{"items":[1]}"#);
        let items = object_entry(&result, "items");
        assert_eq!(items.status, DiffStatus::Changed);
        match &items.value {
            DiffValue::Array(elements) => {
                assert_eq!(elements.len(), 2);
                assert_eq!(elements[0].status, DiffStatus::Unchanged);
                assert_eq!(elements[1].status, DiffStatus::Removed);
                let inner_a = object_entry(&elements[1], "a");
                assert_eq!(inner_a.status, DiffStatus::Removed);
            }
            other => panic!("expected an Array DiffValue, got {other:?}"),
        }
    }

    #[test]
    fn diff_treats_a_type_mismatch_as_a_full_replacement_not_a_recursion() {
        let result = diff_ok(r#"{"age":30}"#, r#"{"age":{"years":30}}"#);
        let age = object_entry(&result, "age");
        assert_eq!(age.status, DiffStatus::Changed);
        assert_eq!(age.old_value, Some(JsonTreeValue::Number("30".to_string())));
        // The new side's own structure still gets a real (Added) status per
        // field, not flattened away by the replacement.
        let years = object_entry(age, "years");
        assert_eq!(years.status, DiffStatus::Added);
    }

    #[test]
    fn diff_compares_arrays_by_index() {
        let result = diff_ok(r#"{"a":[1,2,3]}"#, r#"{"a":[1,9,3]}"#);
        let a = object_entry(&result, "a");
        assert_eq!(a.status, DiffStatus::Changed);
        match &a.value {
            DiffValue::Array(items) => {
                assert_eq!(items[0].status, DiffStatus::Unchanged);
                assert_eq!(items[1].status, DiffStatus::Changed);
                assert_eq!(
                    items[1].old_value,
                    Some(JsonTreeValue::Number("2".to_string()))
                );
                assert_eq!(items[2].status, DiffStatus::Unchanged);
            }
            other => panic!("expected an Array DiffValue, got {other:?}"),
        }
    }

    #[test]
    fn diff_marks_trailing_array_elements_added_or_removed() {
        let grew = diff_ok(r#"{"a":[1,2]}"#, r#"{"a":[1,2,3]}"#);
        match &object_entry(&grew, "a").value {
            DiffValue::Array(items) => {
                assert_eq!(items.len(), 3);
                assert_eq!(items[2].status, DiffStatus::Added);
            }
            other => panic!("expected an Array DiffValue, got {other:?}"),
        }

        let shrank = diff_ok(r#"{"a":[1,2,3]}"#, r#"{"a":[1,2]}"#);
        match &object_entry(&shrank, "a").value {
            DiffValue::Array(items) => {
                assert_eq!(items.len(), 3);
                assert_eq!(items[2].status, DiffStatus::Removed);
            }
            other => panic!("expected an Array DiffValue, got {other:?}"),
        }
    }

    #[test]
    fn diff_propagates_changed_status_up_through_ancestors_without_a_full_replacement() {
        let result = diff_ok(r#"{"a":{"b":{"c":1}}}"#, r#"{"a":{"b":{"c":2}}}"#);
        assert_eq!(result.status, DiffStatus::Changed);
        let a = object_entry(&result, "a");
        assert_eq!(a.status, DiffStatus::Changed);
        // A container's own propagated "something inside changed" status
        // must not carry a top-level old_value — that would be a second,
        // easily-stale copy of what the (real) changed descendant already
        // says on its own.
        assert_eq!(a.old_value, None);
        let b = object_entry(a, "b");
        assert_eq!(b.status, DiffStatus::Changed);
        assert_eq!(b.old_value, None);
        let c = object_entry(b, "c");
        assert_eq!(c.status, DiffStatus::Changed);
        assert_eq!(c.old_value, Some(JsonTreeValue::Number("1".to_string())));
    }

    #[test]
    fn diff_surfaces_document_a_parse_error_tagged_with_context() {
        let err = diff(r#"{"a":}"#, r#"{"a":1}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-value");
        assert_eq!(err.context, Some("document-a".to_string()));
    }

    #[test]
    fn diff_surfaces_document_b_parse_error_tagged_with_context_not_a() {
        let err = diff(r#"{"a":1}"#, r#"{"a":}"#).unwrap_err();
        assert_eq!(err.code, "json-expected-value");
        assert_eq!(err.context, Some("document-b".to_string()));
    }

    #[test]
    fn diff_succeeds_on_10mb_documents_with_localized_differences() {
        let (a, expected_len) = large_json_fixture(10 * 1024 * 1024);
        // Flip one field deep in the middle of the document — a realistic
        // "two large exports with a handful of real differences" shape,
        // not a wholesale rewrite.
        let b = a.replacen(r#""active":true"#, r#""active":false"#, 1);
        assert_ne!(
            a, b,
            "fixture must actually contain the string being replaced"
        );
        let result = diff(&a, &b).unwrap();
        assert_eq!(result.status, DiffStatus::Changed);
        assert!(expected_len > 1);
    }
}
