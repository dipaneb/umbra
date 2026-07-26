import { describe, expect, it } from "vitest";
import { flattenJsonTree } from "./flattenJsonTree";
import type { JsonTreeValue } from "./jsonTreeValue";

function obj(data: Array<[string, JsonTreeValue]>): JsonTreeValue {
  return { kind: "Object", data };
}

function arr(data: JsonTreeValue[]): JsonTreeValue {
  return { kind: "Array", data };
}

const str = (data: string): JsonTreeValue => ({ kind: "String", data });
const num = (data: number): JsonTreeValue => ({ kind: "Number", data });

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
      num(1),
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
});
