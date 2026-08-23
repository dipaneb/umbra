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
// changes. Every cron-* code is also deliberately excluded: Story's own
// French cron UI states the parser is English-only (tools.cron.englishOnlyNotice),
// so an English cron error next to that notice is expected, not a bug.
//
// `translatableCode` intentionally has no signature enforcing full ToolError
// code coverage — an unmapped code safely falls through to `message` below.
type Translate = (key: string, params?: Record<string, unknown>) => string;

const TRANSLATABLE_CODES: ReadonlySet<string> = new Set(["uuid-count-zero"]);

export function toolErrorMessage(err: ToolError, t: Translate): string {
  if (TRANSLATABLE_CODES.has(err.code)) {
    return t(`errors.${err.code}`);
  }
  return err.message;
}
