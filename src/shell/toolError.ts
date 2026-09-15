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
// Deliberately NOT a blanket translation of every ToolError code the
// workspace defines — a count that moves every story, so it is deliberately
// not written here as a number (it read "27" until Story 8.7, by which point
// the real figure was seventy-odd). Most of
// them embed a Rust-side runtime value baked into the message string itself
// (a byte count, a limit, a raw serde_json/base64-crate error) with no
// separate field carrying that value — re-translating the sentence around it
// without the real number would either drop the number or require parsing it
// back out of English prose, which is fragile the moment Rust's wording
// changes. Most cron-* codes stay excluded for that same reason: the pasted-expression
// path's errors carry croner's own dynamic runtime message text (and
// cron-input-too-large embeds a byte count) — there is no free-text NL->cron grammar
// left to make an "English-only parser" argument about (Story 8.6 retired it).
// cron-six-field-unsupported and cron-no-upcoming-runs are the exceptions: both are fixed,
// value-free, project-authored sentences, so they join the set below. (cron-no-upcoming-runs
// was added at Story 8.6's code review — it met this same criterion from the start and was
// excluded by oversight, which left a French user reading an English sentence.)
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
//
// Exported for `toolError.spec.ts`, which asserts every member has an `errors.<code>` key in both
// locales. The set IS this module's decision record, so reading it in a test is not a widening of
// the API so much as making the record checkable.
export const TRANSLATABLE_CODES: ReadonlySet<string> = new Set([
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
  "cron-no-upcoming-runs",
  // Story 8.7 AC24/AC25: the two `ocr-*` codes that meet 8.6's criterion — a fixed, value-free
  // sentence we wrote ourselves. Both messages are authored in
  // `crates/umbra-core/src/ocr.rs` as named constants
  // (`UNSUPPORTED_FORMAT_MESSAGE` / `PDF_WRONG_TOOL_MESSAGE`) with Rust-side tests asserting
  // the exact prose, so the sentence a French user gets here cannot silently diverge from the
  // English one it replaces.
  //
  // `ocr-unsupported-format` is the single most-hit error in the tool — every non-image drop
  // lands there — and until this story it rendered the `image` crate's own English prose.
  "ocr-unsupported-format",
  "ocr-pdf-wrong-tool",
  // Code review 2026-09-08. Both meet the same criterion as the two above — a fixed,
  // value-free sentence we wrote ourselves, with no runtime value baked into the prose.
  //
  // `paste-no-image` is shell-level, not `ocr-*`: `DropZone.vue` raises it when the clipboard
  // holds no image at all, which is a failure of the paste itself rather than of any tool's
  // handling of it. It previously surfaced as the clipboard plugin's own untranslated English.
  // `ocr-asset-grant-failed` is raised by `ocr_grant_asset` when the asset-protocol scope
  // refuses a path; it used to reach the user as an `eprintln!` a packaged `.app` discards,
  // while they got a blank image pane with no explanation.
  "paste-no-image",
  "ocr-asset-grant-failed",
  // Raised view-side by `OcrView.vue`'s `<img> @error` when the source image cannot be
  // rendered at all — a refused asset request, or a file moved between the drop and the paint.
  "ocr-image-unreadable",
  // Story 8.8 AC38: the four `pdf-*` codes that meet 8.6's criterion. `pdf-encrypted` and
  // `pdf-cannot-delete-all-pages` are plain fixed sentences. `pdf-invalid-range` and
  // `pdf-too-few-files` qualify ONLY because AC14 moved their runtime values out of the prose and
  // into the structured `context` field — before that, translating them meant either dropping the
  // numbers or parsing them back out of English. They are the first codes here to translate with
  // params; see `contextParams` below.
  "pdf-encrypted",
  "pdf-invalid-range",
  "pdf-too-few-files",
  "pdf-cannot-delete-all-pages",
]);

// Story 8.9 AC31: every `image-*` code, audited per Story 8.6's own criterion — a fixed,
// value-free sentence we wrote ourselves — the way this file's other tool sections already are.
// None qualify, so none join the set above; this is the "audit, do not assume translatable by
// default" outcome the story's own Dev Notes predicted (gap #6), not an oversight:
//
// - `image-unsupported-format`, `image-encode-failed` — wrap the `image` crate's/an encoder's
//   own error text, the same shape `pdf-corrupt` is excluded for.
// - `image-dimensions-too-large`  — embeds the decoded width/height and pixel count in prose.
// - `image-invalid-quality`       — embeds the offending quality value in prose.
// - `image-invalid-target-format` — embeds the unrecognized format string in prose.
// - `image-invalid-resize-dimension`, `image-invalid-background-color` — each embeds the raw
//   text the user typed into the resize/color field, the same "runtime value baked into the
//   sentence" shape this file's own top comment already flags as unsafe to re-translate around
//   without first moving the value into `context` (the fix `pdf-invalid-range` got at AC14) —
//   not done here, since neither code is a repeat-hit error worth that restructuring yet.
// - `image-input-too-large`, `image-internal` — the same two shapes every other tool's
//   `*-input-too-large`/`*-internal` pair is excluded for (a byte count in prose; a
//   `spawn_blocking` join failure's own runtime text).
// - `image-asset-grant-failed` — embeds the file path and the asset-protocol scope's own error
//   text (`grant_asset_access`, `commands/image.rs`); added to this list at code review
//   2026-09-15 (was missing from the original AC31 pass despite being excluded correctly).

// Story 8.7 AC26: the `ocr-*` codes deliberately NOT in the set above, each with its reason.
// "Not yet done" is not one of them — every exclusion here is a property of the code itself:
//
// - `ocr-engine-init-failed`, `ocr-internal`  — wrap a Rust-side error (ONNX/model-load
//   failure, a `spawn_blocking` join failure) whose text is the underlying library's, not ours.
// - `ocr-extraction-failed`                   — wraps `oar-ocr`'s own error text, same reason.
// - `ocr-input-too-large`                     — embeds a byte count and the limit in prose.
// - `ocr-malformed-image-buffer`              — embeds the buffer length and the w x h x 4
//                                               product it failed to match.
// - `ocr-malformed-request`                   — excluded for a distinct reason worth stating:
//   it carries FOUR different sentences under ONE code (missing header / header not UTF-8 /
//   header not a u32 / a JSON body where raw bytes were expected), and three of them embed the
//   offending header's name. A single `errors.<code>` lookup cannot express that without
//   splitting the code four ways or misreporting three of the four. It is also unreachable by
//   users in any case — it fires only if our own shell sends a malformed IPC request.
//
// The `image-*` codes (renamed from `bucket-image-*` by Story 8.9) are audited below, in that
// story's own comment block.
//
// Story 8.8 AC38: the `pdf-*` codes deliberately NOT in the set above, each with its reason.
//
// - `pdf-corrupt`             — wraps `lopdf`'s own error text at thirteen call sites. There is no
//                               finite set of phrasings to pre-author a French sentence for.
// - `pdf-input-too-large`     — embeds a byte count and the limit in prose, like every other
//                               `*-input-too-large` code in this file.
// - `pdf-internal`            — a `spawn_blocking` join failure; the text is the runtime's.
// - `pdf-render-unavailable`  — excluded for `ocr-malformed-request`'s distinct reason: it carries
//                               ten different sentences under ONE code, spread across three
//                               platform backends (`src-tauri/src/render/`), several of which embed
//                               a page number or an encoder's error. One `errors.<code>` lookup
//                               cannot express that without misreporting nine of the ten.
//
// `pdf-invalid-range` nearly landed in that last category too, and the fix was a split rather than
// an exclusion: it was raised for FIVE distinct failures, four of them "you asked for pages this
// document does not have" but the fifth — deleting every page — a refusal of the operation itself,
// with nothing out of range at all. That fifth became `pdf-cannot-delete-all-pages` (AC38), which
// is why both halves can translate honestly instead of one sentence covering for the other.

/// AC38: `ToolError.context` is a SHARED field carrying a per-tool convention, not a JSON
/// contract — `crates/umbra-core/src/jwt.rs` writes prose into it (`"segment: header"`) and AD-3
/// makes that `Option<String>` shape binding for every tool, so PDF JSON-encodes into it rather
/// than widening the contract for one tool. That means this must tolerate anything: a bare
/// `JSON.parse` would throw on a JWT error and take the whole message down with it, leaving the
/// user an empty error pane — the NFR4 failure the error path exists to prevent. Only a plain
/// object becomes params; everything else is passed over silently.
function contextParams(context: string | null): Record<string, unknown> | undefined {
  if (context === null) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(context);
  } catch {
    return undefined;
  }
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

export function toolErrorMessage(err: ToolError, t: Translate): string {
  if (TRANSLATABLE_CODES.has(err.code)) {
    return t(`errors.${err.code}`, contextParams(err.context));
  }
  return err.message;
}
