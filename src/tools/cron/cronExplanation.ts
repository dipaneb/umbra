import type { ScheduleDescription } from "./scheduleDescription";

// Mirrors `CronExplanation` in crates/umbra-core/src/cron.rs — keep in sync by hand.
//
// Note what is NOT here any more: core used to also return `description` (an English
// sentence), `description_generic` (a flag saying it had given up) and `fields` (five English
// phrases). All three were presentation formatted in the wrong layer — once a schedule is
// collapsed to "Every weekday, at 9:00 AM" the meaning is gone and no other locale can be
// derived from it. Core now returns `schedule`, the language-neutral meaning, and
// src/tools/cron/locales/ renders it per locale (AD-1).
export interface CronExplanation {
  schedule: ScheduleDescription;
  next_runs: number[]; // epoch seconds — convert to Date via `new Date(seconds * 1000)`
}
