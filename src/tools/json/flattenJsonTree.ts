import type { JsonTreeValue } from "./jsonTreeValue";

export interface JsonTreeRow {
  path: string;
  depth: number;
  keyLabel: string | null;
  kind: JsonTreeValue["kind"];
  preview: string;
  expandable: boolean;
  expanded: boolean;
}

// Both branches already yield an ordered list of [key, value] pairs straight
// from the wire shape (jsonTreeValue.ts) — no `Object.entries()` here, so no
// exposure to the ECMAScript spec's integer-key reordering rule.
function containerEntries(value: JsonTreeValue): Array<[string | number, JsonTreeValue]> {
  if (value.kind === "Array") return value.data.map((v, i): [number, JsonTreeValue] => [i, v]);
  if (value.kind === "Object") return value.data;
  return [];
}

function previewFor(value: JsonTreeValue, childCount: number): string {
  switch (value.kind) {
    case "Object":
      return childCount === 1 ? "{1 key}" : `{${childCount} keys}`;
    case "Array":
      return childCount === 1 ? "[1 item]" : `[${childCount} items]`;
    case "String":
      return JSON.stringify(value.data);
    case "Number":
      return String(value.data);
    case "Bool":
      return String(value.data);
    case "Null":
      return "null";
  }
}

// `path` is `JSON.stringify(segments)`, not a dotted string like
// `${parent}.${key}`: a real JSON payload's object keys can contain `.`,
// `[`, or `]` characters, so a dotted/bracketed join risks two different
// nodes producing the same path string — corrupting both the
// `expandedPaths` lookup and the virtualizer's row identity. Serializing the
// raw segment array is unique regardless of what characters a key contains.
export function flattenJsonTree(
  root: JsonTreeValue,
  expandedPaths: ReadonlySet<string>,
): JsonTreeRow[] {
  const rows: JsonTreeRow[] = [];

  function visit(
    value: JsonTreeValue,
    segments: Array<string | number>,
    depth: number,
    keyLabel: string | null,
  ) {
    const path = JSON.stringify(segments);
    const entries = containerEntries(value);
    const expandable = entries.length > 0;
    const isExpanded = expandable && expandedPaths.has(path);

    rows.push({
      path,
      depth,
      keyLabel,
      kind: value.kind,
      preview: previewFor(value, entries.length),
      expandable,
      expanded: isExpanded,
    });

    // A collapsed node's descendants are never pushed into `rows` at all —
    // not just filtered out afterward — which is what makes "only visible
    // nodes exist in the DOM" achievable regardless of total document size.
    if (isExpanded) {
      for (const [childKey, childValue] of entries) {
        visit(childValue, [...segments, childKey], depth + 1, String(childKey));
      }
    }
  }

  visit(root, [], 0, null);
  return rows;
}
