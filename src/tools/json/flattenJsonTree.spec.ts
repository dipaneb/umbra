import { describe, expect, it } from "vitest";
import { findMatchingPaths, flattenJsonTree } from "./flattenJsonTree";
import type { JsonTreeValue } from "./jsonTreeValue";

function obj(data: Array<[string, JsonTreeValue]>): JsonTreeValue {
  return { kind: "Object", data };
}

function arr(data: JsonTreeValue[]): JsonTreeValue {
  return { kind: "Array", data };
}

const str = (data: string): JsonTreeValue => ({ kind: "String", data });
const num = (data: string): JsonTreeValue => ({ kind: "Number", data });

describe("flattenJsonTree", () => {
  it("shows the root row plus immediate children but not grandchildren when only root is expanded", () => {
    const root = obj([
      ["a", obj([["b", str("deep")]])],
      ["c", str("shallow")],
    ]);

    const rows = flattenJsonTree(root, new Set(["[]"]));

    expect(rows.map((r) => r.keyLabel)).toEqual([null, "a", "c"]);
    expect(rows).toHaveLength(3);
  });

  it("contributes zero rows for descendants of a node absent from expandedPaths", () => {
    const root = obj([["a", obj([["b", str("hidden")]])]]);

    const rows = flattenJsonTree(root, new Set());

    expect(rows).toHaveLength(1);
    expect(rows[0]?.keyLabel).toBeNull();
  });

  it("labels array entries with numeric string keyLabels in source order", () => {
    const root = arr([str("x"), str("y"), str("z")]);

    const rows = flattenJsonTree(root, new Set(["[]"]));

    expect(rows.slice(1).map((r) => r.keyLabel)).toEqual(["0", "1", "2"]);
  });

  it("never re-sorts object entries, even when keys look numeric and are out of numeric order", () => {
    const root = obj([
      ["1", str("b")],
      ["0", str("a")],
      ["name", str("x")],
    ]);

    const rows = flattenJsonTree(root, new Set(["[]"]));

    expect(rows.slice(1).map((r) => r.keyLabel)).toEqual(["1", "0", "name"]);
  });

  it("marks empty objects and arrays as not expandable", () => {
    const rows = flattenJsonTree(obj([]), new Set(["[]"]));
    expect(rows[0]?.expandable).toBe(false);

    const arrRows = flattenJsonTree(arr([]), new Set(["[]"]));
    expect(arrRows[0]?.expandable).toBe(false);
  });

  it("marks scalar leaves as not expandable regardless of expandedPaths", () => {
    const scalars: JsonTreeValue[] = [
      { kind: "Null" },
      { kind: "Bool", data: true },
      num("1"),
      str("x"),
    ];

    for (const scalar of scalars) {
      const rows = flattenJsonTree(scalar, new Set(["[]"]));
      expect(rows[0]?.expandable).toBe(false);
    }
  });

  it("produces distinct paths for sibling keys where one key contains a dot", () => {
    const root = obj([
      ["a", str("first")],
      ["a.b", str("second")],
    ]);

    const rows = flattenJsonTree(root, new Set(["[]"]));
    const paths = rows.slice(1).map((r) => r.path);

    expect(new Set(paths).size).toBe(paths.length);
  });

  it("previews a number's exact source text unchanged, even beyond Number.MAX_SAFE_INTEGER", () => {
    // Regression: this would catch a reversion to carrying Number as a JS
    // `number`, which silently rounds integers beyond 2^53 (e.g. snowflake IDs).
    const rows = flattenJsonTree(num("9007199254740993"), new Set(["[]"]));
    expect(rows[0]?.preview).toBe("9007199254740993");
  });

  it("truncates a long string preview instead of rendering it at full width", () => {
    const longString = "x".repeat(200);
    const rows = flattenJsonTree(str(longString), new Set(["[]"]));
    expect(rows[0]?.preview.length).toBeLessThan(longString.length);
    expect(rows[0]?.preview.endsWith("…")).toBe(true);
  });

  it("carries the row's own JsonTreeValue and a matching JSONPath for copy actions", () => {
    const root = obj([["a", arr([str("x"), str("y")])]]);
    const rows = flattenJsonTree(root, new Set(["[]", '["a"]']));

    const rowA = rows.find((r) => r.keyLabel === "a");
    expect(rowA?.value).toEqual(arr([str("x"), str("y")]));
    expect(rowA?.jsonPath).toBe("$.a");

    const rowY = rows.find((r) => r.keyLabel === "1");
    expect(rowY?.value).toEqual(str("y"));
    expect(rowY?.jsonPath).toBe("$.a[1]");
  });

  it("passing visiblePaths restricts the walk and force-expands every kept ancestor", () => {
    const root = obj([
      ["a", obj([["deep", str("hidden")]])],
      ["b", str("shallow")],
    ]);
    // Simulates a search for "hidden": only the root, "a", and "a.deep"
    // survive — "b" is excluded even though expandedPaths (empty here)
    // would ordinarily leave everything collapsed.
    const visible = new Set(["[]", '["a"]', '["a","deep"]']);

    const rows = flattenJsonTree(root, new Set(), visible);

    expect(rows.map((r) => r.keyLabel)).toEqual([null, "a", "deep"]);
    expect(rows.find((r) => r.keyLabel === "a")?.expanded).toBe(true);
  });
});

describe("findMatchingPaths", () => {
  it("keeps a leaf value match and every ancestor, excluding unrelated siblings", () => {
    const root = obj([
      ["a", obj([["deep", str("hidden")]])],
      ["b", str("shallow")],
    ]);

    const visible = findMatchingPaths(root, "hidden");

    expect(visible).toEqual(new Set(["[]", '["a"]', '["a","deep"]']));
  });

  it("matches a key even when its value doesn't match", () => {
    const root = obj([["needle", str("unrelated")]]);

    const visible = findMatchingPaths(root, "needle");

    expect(visible.has('["needle"]')).toBe(true);
  });

  it("is case-insensitive and matches substrings, not just whole values", () => {
    const root = obj([["name", str("Ada Lovelace")]]);

    expect(findMatchingPaths(root, "ada").has('["name"]')).toBe(true);
    expect(findMatchingPaths(root, "LOVELACE").has('["name"]')).toBe(true);
  });

  it("never matches a container's own collapsed-summary text — only real content", () => {
    const root = obj([["items", arr([str("x"), str("y")])]]);

    // "items" has 2 entries, so its preview text would read "[2 items]" —
    // searching the word that preview is built from must not count as a
    // spurious match against the container's own metadata.
    expect(findMatchingPaths(root, "items").has('["items"]')).toBe(true); // matches via the key "items" itself
    expect(findMatchingPaths(root, "2 items").size).toBe(0); // not via the summary text
  });

  it("returns an empty set when nothing matches", () => {
    const root = obj([["a", str("x")]]);

    expect(findMatchingPaths(root, "nonexistent-zzz").size).toBe(0);
  });
});
