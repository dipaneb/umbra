import type { JsonTreeValue } from "./jsonTreeValue";

// Mirrors `QueryMatch`/`QueryResult` in crates/umbra-core/src/json.rs — keep
// in sync by hand. Field names stay snake_case (no `rename_all` on the Rust
// side), matching this codebase's existing convention for IPC types (e.g.
// `RepairResult.still_invalid`).
export interface QueryMatch {
  path: string;
  value: JsonTreeValue;
}

export interface QueryResult {
  matches: QueryMatch[];
  total: number;
  truncated: boolean;
}
