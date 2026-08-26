import type { JsonTreeValue } from "./jsonTreeValue";

// Mirrors `DiffStatus`/`DiffValue`/`DiffNode` in crates/umbra-core/src/json.rs
// — keep in sync by hand, same convention as `jsonRepair.ts`/`jsonQuery.ts`.
export type DiffStatus = "unchanged" | "added" | "removed" | "changed";

export type DiffValue =
  | { kind: "Null" }
  | { kind: "Bool"; data: boolean }
  | { kind: "Number"; data: string }
  | { kind: "String"; data: string }
  | { kind: "Array"; data: DiffNode[] }
  | { kind: "Object"; data: Array<[string, DiffNode]> };

export interface DiffNode {
  status: DiffStatus;
  value: DiffValue;
  old_value: JsonTreeValue | null;
}
