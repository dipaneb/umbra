// Mirrors `CronExplanation` in crates/umbra-core/src/cron.rs — keep in sync by hand.
export interface CronExplanation {
  description: string;
  next_runs: number[]; // epoch seconds — convert to Date via `new Date(seconds * 1000)`
}
