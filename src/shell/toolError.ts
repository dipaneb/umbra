export type ToolErrorPosition =
  | { kind: "LineCol"; line: number; column: number }
  | { kind: "ByteOffset"; offset: number };

export interface ToolError {
  code: string;
  message: string;
  position: ToolErrorPosition | null;
  context: string | null;
}

export function isToolError(value: unknown): value is ToolError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

export function toToolError(err: unknown): ToolError {
  return isToolError(err) ? err : { code: "unknown", message: String(err), position: null, context: null };
}

// AD-1: presentation formatting — including which language an error reads in
// — is view-owned, never computed in umbra-core. Rust's ToolError.message is
// authored in English (crates/umbra-core), so this is the one seam that lets
// the shell show a French error without touching Rust.
//
// Deliberately NOT a blanket translation of all 27 ToolError codes. Most of
// them embed a Rust-side runtime value baked into the message string itself
// (a byte count, a limit, a raw serde_json/base64-crate error) with no
// separate field carrying that value — re-translating the sentence around it
// without the real number would either drop the number or require parsing it
// back out of English prose, which is fragile the moment Rust's wording
// changes. Most cron-* codes stay excluded for that same reason: the pasted-expression
// path's errors carry croner's own dynamic runtime message text (and
// cron-input-too-large embeds a byte count) — there is no free-text NL->cron grammar
// left to make an "English-only parser" argument about (Story 8.6 retired it).
// cron-six-field-unsupported is the one exception: a fixed, value-free, project-authored
// sentence, so it joins the set below.
//
// `translatableCode` intentionally has no signature enforcing full ToolError
// code coverage — an unmapped code safely falls through to `message` below.
type Translate = (key: string, params?: Record<string, unknown>) => string;

// Story 8.1 AC8: `json-*` syntax-classification codes join the set. Each one's
// English message (crates/umbra-core/src/json.rs's `classify_syntax_error`)
// is a fixed, canned sentence with no runtime value baked in — line/column
// stays out of `message` entirely, carried only in the separate structured
// `position` field — so every one of these can translate with a plain
// `t(errors.<code>)` lookup, no params needed. `json-syntax` (the fallback
// for an unclassified error) and `json-input-too-large`/`json-internal`
// (different failure categories, out of AC8's "validation fails" scope) stay
// untranslated, same as before.
//
// Story 8.1 AC10 (Query): `json-query-invalid-expression` and
// `json-query-expression-too-long` are deliberately NOT added here, for the
// same reason `json-syntax`/`json-input-too-large` aren't: neither is a
// fixed canned sentence. The first is `serde_json_path`'s own dynamic parser
// error text (arbitrary English describing whatever the user actually typed
// wrong — there's no finite set of phrasings to pre-author a French sentence
// for, unlike `classify_syntax_error`'s closed set); the second bakes the
// runtime expression length directly into the message string, the exact
// pattern this file's own top comment already flags as unsafe to
// re-translate around.
const TRANSLATABLE_CODES: ReadonlySet<string> = new Set([
  "uuid-count-zero",
  "json-trailing-comma",
  "json-trailing-characters",
  "json-unterminated-string",
  "json-unclosed-array",
  "json-unclosed-object",
  "json-unexpected-end",
  "json-expected-colon",
  "json-expected-array-separator",
  "json-expected-object-separator",
  "json-expected-value",
  "json-invalid-escape",
  "json-invalid-number",
  "json-number-out-of-range",
  "json-invalid-unicode",
  "json-control-character",
  "json-key-must-be-string",
  "json-nesting-too-deep",
  // Story 8.2 slice 6 (AC15): the classified `base64-*` decode codes. Each
  // one's Rust message (crates/umbra-core's `map_decode_error` / `decode` /
  // `parse_data_uri`) is a fixed canned sentence with no runtime value baked
  // in — a byte offset, where one exists, rides the structured `position`
  // field, exactly like the `json-*` codes above. `base64-input-too-large`
  // is deliberately left out (it embeds a byte count in prose), matching
  // `json-input-too-large`.
  "base64-invalid-char",
  "base64-invalid-length",
  "base64-invalid-padding",
  "base64-not-utf8",
  "base64-data-uri-malformed",
  // Story 8.6 AC16: the guided cron builder's one fixed, value-free, our-own sentence — every
  // other cron-* code either carries croner's own dynamic runtime text or embeds a byte count
  // (cron-input-too-large), so this is the sole cron-* addition here.
  "cron-six-field-unsupported",
]);

export function toolErrorMessage(err: ToolError, t: Translate): string {
  if (TRANSLATABLE_CODES.has(err.code)) {
    return t(`errors.${err.code}`);
  }
  return err.message;
}
