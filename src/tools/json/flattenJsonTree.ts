import { i18n } from "../../i18n";
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

// Long scalar previews are truncated so a single large value (a JWT, a
// base64 blob) can't force one virtualized row far wider than the panel.
const MAX_PREVIEW_LEN = 80;

function truncate(text: string): string {
  return text.length > MAX_PREVIEW_LEN ? `${text.slice(0, MAX_PREVIEW_LEN)}…` : text;
}

// Reads i18n.global directly (a pure module, not a component, so useI18n()
// isn't available) — same pattern updateCheck.ts's getUpdateSeverityLabel()
// uses. This picks an explicit "…CountOne"/"…CountOther" key per value
// rather than relying on vue-i18n's `|`-pipe plural syntax; see i18n.ts's
// comment on why.
function previewFor(value: JsonTreeValue, childCount: number): string {
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
      // Exact source text (see JsonTreeValue's Number variant) — never
      // reparsed into a JS number, so large integers stay precise.
      return value.data;
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
