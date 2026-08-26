// Mirrors `JsonTreeValue`'s `#[serde(tag = "kind", content = "data")]` encoding
// in crates/umbra-core/src/json.rs. Deliberately not a plain-object mirror of
// `serde_json::Value`: both `Array` and `Object` carry their children as an
// ordered array/array-of-tuples, so there is no plain JS object anywhere in
// this type for the JS engine's own key-ordering rules to reorder.
export type JsonTreeValue =
  | { kind: "Null" }
  | { kind: "Bool"; data: boolean }
  | { kind: "Number"; data: string }
  | { kind: "String"; data: string }
  | { kind: "Array"; data: JsonTreeValue[] }
  | { kind: "Object"; data: Array<[string, JsonTreeValue]> };

// Re-serializes a subtree back to compact JSON text — Explorer's "copy value"
// action on a container row (Story 8.1 Task 2, AC7). Numbers reuse their
// exact source text unchanged (never reparsed into a JS number), the same
// precision contract `crates/umbra-core/src/json.rs`'s `JsonTreeValue`
// conversion already guarantees for IPC.
export function jsonTreeValueToText(value: JsonTreeValue): string {
  switch (value.kind) {
    case "Null":
      return "null";
    case "Bool":
      return String(value.data);
    case "Number":
      return value.data;
    case "String":
      return JSON.stringify(value.data);
    case "Array":
      return `[${value.data.map(jsonTreeValueToText).join(",")}]`;
    case "Object":
      return `{${value.data.map(([k, v]) => `${JSON.stringify(k)}:${jsonTreeValueToText(v)}`).join(",")}}`;
  }
}
