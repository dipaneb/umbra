import { describe, expect, it } from "vitest";
import { defaultExpandedDiffPaths, flattenDiffTree } from "./flattenDiffTree";
import type { DiffNode, DiffValue } from "./jsonDiff";
import type { JsonTreeValue } from "./jsonTreeValue";

function obj(entries: Array<[string, DiffNode]>): DiffValue {
  return { kind: "Object", data: entries };
}

function arr(items: DiffNode[]): DiffValue {
  return { kind: "Array", data: items };
}

const str = (data: string): DiffValue => ({ kind: "String", data });
const num = (data: string): DiffValue => ({ kind: "Number", data });
const jNum = (data: string): JsonTreeValue => ({ kind: "Number", data });

function unchanged(value: DiffValue): DiffNode {
  return { status: "unchanged", value, old_value: null };
}
function added(value: DiffValue): DiffNode {
  return { status: "added", value, old_value: null };
}
function removed(value: DiffValue): DiffNode {
  return { status: "removed", value, old_value: null };
}
function changedLeaf(value: DiffValue, oldValue: JsonTreeValue): DiffNode {
  return { status: "changed", value, old_value: oldValue };
}
function changedContainer(value: DiffValue): DiffNode {
  return { status: "changed", value, old_value: null };
}

describe("flattenDiffTree", () => {
  it("shows the root row plus immediate children but not grandchildren when only root is expanded", () => {
    const root = changedContainer(
      obj([
        ["a", unchanged(str("x"))],
        ["b", changedContainer(obj([["c", added(num("1"))]]))],
      ]),
    );

    const rows = flattenDiffTree(root, new Set(["[]"]));

    expect(rows.map((r) => r.keyLabel)).toEqual([null, "a", "b"]);
  });

  it("contributes zero rows for descendants of a collapsed node", () => {
    const root = changedContainer(obj([["a", changedContainer(obj([["b", added(str("hidden"))]]))]]));

    const rows = flattenDiffTree(root, new Set());

    expect(rows).toHaveLength(1);
  });

  it("reports each row's own status", () => {
    const root = changedContainer(
      obj([
        ["a", unchanged(str("x"))],
        ["b", added(str("y"))],
        ["c", removed(str("z"))],
        ["d", changedLeaf(num("2"), jNum("1"))],
      ]),
    );

    const rows = flattenDiffTree(root, new Set(["[]"]));

    expect(rows.map((r) => r.status)).toEqual(["changed", "unchanged", "added", "removed", "changed"]);
  });

  it("leaves oldPreview null for every row except a changed leaf that carries old_value", () => {
    const root = changedContainer(
      obj([
        ["a", unchanged(str("x"))],
        ["b", changedLeaf(num("2"), jNum("1"))],
        ["c", changedContainer(obj([]))],
      ]),
    );

    const rows = flattenDiffTree(root, new Set(["[]"]));
    const byKey = new Map(rows.map((r) => [r.keyLabel, r]));

    expect(byKey.get("a")?.oldPreview).toBeNull();
    expect(byKey.get("b")?.oldPreview).toBe("1");
    expect(byKey.get("b")?.preview).toBe("2");
    // A changed *container* (no old_value) is not itself a full replacement
    // — nothing to show as "old", only its children carry that detail.
    expect(byKey.get("c")?.oldPreview).toBeNull();
  });

  it("renders a string old_value the same JSON.stringify'd way a leaf's own value would be", () => {
    const root = changedLeaf(str("new"), { kind: "String", data: "old" });

    const rows = flattenDiffTree(root, new Set());

    expect(rows[0]?.oldPreview).toBe('"old"');
    expect(rows[0]?.preview).toBe('"new"');
  });

  it("labels array entries with numeric string keyLabels in source order", () => {
    const root = changedContainer(arr([unchanged(str("x")), added(str("y")), removed(str("z"))]));

    const rows = flattenDiffTree(root, new Set(["[]"]));

    expect(rows.map((r) => r.keyLabel)).toEqual([null, "0", "1", "2"]);
  });
});

describe("defaultExpandedDiffPaths", () => {
  it("expands every ancestor of a changed leaf, leaving an unrelated unchanged sibling collapsed", () => {
    const root = changedContainer(
      obj([
        ["a", changedContainer(obj([["deep", added(str("new"))]]))],
        ["b", unchanged(obj([["shallow", unchanged(str("same"))]]))],
      ]),
    );

    const expanded = defaultExpandedDiffPaths(root);

    expect(expanded.has("[]")).toBe(true); // root
    expect(expanded.has('["a"]')).toBe(true); // leads to a real change
    expect(expanded.has('["b"]')).toBe(false); // fully unchanged subtree
  });

  it("expands nothing when the two documents are identical", () => {
    const root = unchanged(obj([["a", unchanged(str("x"))]]));

    const expanded = defaultExpandedDiffPaths(root);

    expect(expanded.size).toBe(0);
  });

  it("does not add a leaf's own path (only its expandable ancestors)", () => {
    const root = changedContainer(obj([["a", added(str("x"))]]));

    const expanded = defaultExpandedDiffPaths(root);

    expect(expanded.has("[]")).toBe(true);
    expect(expanded.has('["a"]')).toBe(false); // "a" is a leaf, nothing to expand
  });
});
