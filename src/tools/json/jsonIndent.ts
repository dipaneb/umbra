// Mirrors `JsonIndent`'s `#[serde(rename_all = "snake_case")]` encoding in
// crates/umbra-core/src/json.rs — keep the two in sync by hand until a
// codegen tool exists to derive one from the other.
export type JsonIndent = "two_spaces" | "four_spaces" | "tab";
