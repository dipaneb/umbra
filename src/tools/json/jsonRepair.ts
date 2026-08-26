import type { ToolErrorPosition } from "../../shell/toolError";

// Mirrors `RepairChange`/`RepairResult` in crates/umbra-core/src/json.rs —
// keep in sync by hand. Field names stay snake_case (no `rename_all` on the
// Rust side), matching this codebase's existing convention for IPC types
// (e.g. `ScheduleParseResult.next_runs`).
export interface RepairChange {
  code: string;
  description: string;
  position: ToolErrorPosition | null;
}

export interface RepairResult {
  repaired: string;
  changes: RepairChange[];
  still_invalid: boolean;
}
