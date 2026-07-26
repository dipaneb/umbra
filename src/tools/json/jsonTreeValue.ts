// Mirrors `JsonTreeValue`'s `#[serde(tag = "kind", content = "data")]` encoding
// in crates/umbra-core/src/json.rs. Deliberately not a plain-object mirror of
// `serde_json::Value`: both `Array` and `Object` carry their children as an
// ordered array/array-of-tuples, so there is no plain JS object anywhere in
// this type for the JS engine's own key-ordering rules to reorder.
export type JsonTreeValue =
  | { kind: "Null" }
  | { kind: "Bool"; data: boolean }
  | { kind: "Number"; data: number }
  | { kind: "String"; data: string }
  | { kind: "Array"; data: JsonTreeValue[] }
  | { kind: "Object"; data: Array<[string, JsonTreeValue]> };
