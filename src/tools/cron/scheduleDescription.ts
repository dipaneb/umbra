// Mirrors `ScheduleDescription` and friends in crates/umbra-core/src/cron.rs — keep in sync
// by hand. Field names stay snake_case (no `rename_all` on the struct), matching this
// codebase's convention for IPC types; the enums carry a `kind` discriminant because Rust
// serialises them with `#[serde(tag = "kind", rename_all = "snake_case")]`.
//
// This is the language-neutral half of the cron description: core says what a schedule
// *means*, this app says it in the user's language (src/tools/cron/locales/). Nothing in
// here is English.

/** An inclusive span of values within one field. */
export interface TermRange {
  from: number;
  to: number;
}

/** One field's meaning, normalised — names already resolved to numbers, `?` folded into `every`. */
export type FieldTerm =
  | { kind: "every" }
  | { kind: "value"; value: number }
  | { kind: "values"; values: number[] }
  | { kind: "range"; range: TermRange }
  | { kind: "step"; step: number; within: TermRange | null; from: number | null }
  | { kind: "union"; parts: FieldTerm[] }
  // Syntax croner accepts but the grammar doesn't model yet (`L`, `5#3`, `15W`). The raw
  // text is preserved so a renderer can show it verbatim instead of guessing.
  | { kind: "unsupported"; raw: string };

/**
 * Which day fields constrain the schedule. Stated by core rather than re-derived here
 * because of cron's least-obvious rule: when BOTH day-of-month and day-of-week are
 * restricted, the schedule fires on *either*, not both.
 */
export type DayMatch =
  | "every_day"
  | "day_of_month_only"
  | "day_of_week_only"
  | "either_day_field";

export interface ScheduleDescription {
  minute: FieldTerm;
  hour: FieldTerm;
  day_of_month: FieldTerm;
  month: FieldTerm;
  day_of_week: FieldTerm;
  day_match: DayMatch;
}

/** The five standard fields, in cron order — the axis every renderer and the grid share. */
export const CRON_FIELD_KINDS = [
  "minute",
  "hour",
  "dayOfMonth",
  "month",
  "dayOfWeek",
] as const;

export type CronFieldKind = (typeof CRON_FIELD_KINDS)[number];

export function fieldTerms(schedule: ScheduleDescription): FieldTerm[] {
  return [
    schedule.minute,
    schedule.hour,
    schedule.day_of_month,
    schedule.month,
    schedule.day_of_week,
  ];
}

function termIsUnsupported(term: FieldTerm): boolean {
  if (term.kind === "unsupported") return true;
  if (term.kind === "union") return term.parts.some(termIsUnsupported);
  return false;
}

/**
 * True when any field used syntax outside the grammar. Renderers suppress their prose
 * sentence in that case and let the per-field breakdown carry the explanation — the same
 * job the old `description_generic` boolean did, but now it also says which field.
 */
export function hasUnsupportedField(schedule: ScheduleDescription): boolean {
  return fieldTerms(schedule).some(termIsUnsupported);
}
