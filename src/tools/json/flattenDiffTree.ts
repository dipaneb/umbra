import { i18n } from "../../i18n";
import { previewFor as previewForJsonTreeValue } from "./flattenJsonTree";
import type { DiffNode, DiffStatus, DiffValue } from "./jsonDiff";

export interface DiffTreeRow {
  path: string;
  depth: number;
  keyLabel: string | null;
  status: DiffStatus;
  expandable: boolean;
  expanded: boolean;
  // The "current" (document B) side's display text — for a leaf, its value;
  // for a container, the same collapsed "{N keys}"/"[N items]" summary
  // Explorer's own tree already uses.
  preview: string;
  // Only non-null for a `Changed` row that carries an `old_value` (a
  // changed scalar, or a type-mismatch full replacement) — the document A
  // side's display text, for the inline old→new rendering.
  oldPreview: string | null;
}

// Same shape as flattenJsonTree.ts's own `containerEntries` — both branches
// already yield an ordered list straight from the wire shape, no
// `Object.entries()` and thus no exposure to the ECMAScript integer-key
// reordering rule.
function containerEntries(value: DiffValue): Array<[string | number, DiffNode]> {
  if (value.kind === "Array") return value.data.map((v, i): [number, DiffNode] => [i, v]);
  if (value.kind === "Object") return value.data;
  return [];
}

const MAX_PREVIEW_LEN = 80;

function truncate(text: string): string {
  return text.length > MAX_PREVIEW_LEN ? `${text.slice(0, MAX_PREVIEW_LEN)}…` : text;
}

// Reuses the exact same `tools.json.treeKeysCount*`/`treeItemsCount*` i18n
// keys Explorer's own collapsed-summary text already uses — "{N keys}" means
// the same thing here, no reason for a second set of translated strings.
function previewForDiffValue(value: DiffValue, childCount: number): string {
  const t = i18n.global.t;
  switch (value.kind) {
    case "Object":
      return childCount === 1
        ? t("tools.json.treeKeysCountOne")
        : t("tools.json.treeKeysCountOther", { count: childCount });
    case "Array":
      return childCount === 1
        ? t("tools.json.treeItemsCountOne")
        : t("tools.json.treeItemsCountOther", { count: childCount });
    case "String":
      return truncate(JSON.stringify(value.data));
    case "Number":
      return truncate(value.data);
    case "Bool":
      return String(value.data);
    case "Null":
      return "null";
  }
}

// `path` mirrors flattenJsonTree.ts's own encoding exactly
// (`JSON.stringify(segments)`, not a dotted string) for the same reason: a
// real key can contain `.`/`[`/`]`, so only the raw segment array is safe
// to use as a unique row identity.
export function flattenDiffTree(root: DiffNode, expandedPaths: ReadonlySet<string>): DiffTreeRow[] {
  const rows: DiffTreeRow[] = [];

  function visit(node: DiffNode, segments: Array<string | number>, depth: number, keyLabel: string | null) {
    const path = JSON.stringify(segments);
    const entries = containerEntries(node.value);
    const expandable = entries.length > 0;
    const isExpanded = expandable && expandedPaths.has(path);

    rows.push({
      path,
      depth,
      keyLabel,
      status: node.status,
      expandable,
      expanded: isExpanded,
      preview: previewForDiffValue(node.value, entries.length),
      oldPreview: node.old_value !== null ? previewForJsonTreeValue(node.old_value, 0) : null,
    });

    if (isExpanded) {
      for (const [childKey, childNode] of entries) {
        visit(childNode, [...segments, childKey], depth + 1, String(childKey));
      }
    }
  }

  visit(root, [], 0, null);
  return rows;
}

// A diff view's whole job is showing what's different — defaulting every
// row to collapsed (Explorer's own convention) would bury the few changed
// fields in a document the user has to manually drill down through. Instead
// this expands exactly the ancestor chain of every non-`unchanged` node,
// leaving any subtree that's entirely unchanged collapsed (nothing
// interesting to see there) — computed once from the diff result itself,
// not a user preference to persist.
export function defaultExpandedDiffPaths(root: DiffNode): Set<string> {
  const expanded = new Set<string>();

  function visit(node: DiffNode, segments: Array<string | number>): boolean {
    const path = JSON.stringify(segments);
    const entries = containerEntries(node.value);
    let hasInterestingDescendant = false;
    for (const [childKey, childNode] of entries) {
      if (visit(childNode, [...segments, childKey])) hasInterestingDescendant = true;
    }
    const isInteresting = node.status !== "unchanged" || hasInterestingDescendant;
    if (isInteresting && entries.length > 0) expanded.add(path);
    return isInteresting;
  }

  visit(root, []);
  return expanded;
}
