import { i18n } from "../../i18n";
import { jsonPathFromSegments } from "./jsonPath";
import type { JsonTreeValue } from "./jsonTreeValue";

export interface JsonTreeRow {
  path: string;
  jsonPath: string;
  depth: number;
  keyLabel: string | null;
  kind: JsonTreeValue["kind"];
  preview: string;
  expandable: boolean;
  expanded: boolean;
  value: JsonTreeValue;
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
//
// `visiblePaths`, when given (Explorer's search/filter — Story 8.1 Task 2
// AC7), restricts the walk to exactly that set: a node whose own path isn't
// in it is skipped entirely, subtree included, the same way a collapsed
// node's descendants never get visited. Every node search *does* keep
// (a match, or an ancestor of one) is also force-expanded regardless of
// `expandedPaths` — otherwise a real match could exist but stay invisible
// behind a parent the user never happened to expand. The user's own
// `expanded` set is untouched underneath, so clearing the search returns
// the tree to whatever they'd manually expanded before searching.
export function flattenJsonTree(
  root: JsonTreeValue,
  expandedPaths: ReadonlySet<string>,
  visiblePaths: ReadonlySet<string> | null = null,
): JsonTreeRow[] {
  const rows: JsonTreeRow[] = [];

  function visit(
    value: JsonTreeValue,
    segments: Array<string | number>,
    depth: number,
    keyLabel: string | null,
  ) {
    const path = JSON.stringify(segments);
    if (visiblePaths !== null && !visiblePaths.has(path)) return;

    const entries = containerEntries(value);
    const expandable = entries.length > 0;
    const isExpanded = expandable && (visiblePaths !== null || expandedPaths.has(path));

    rows.push({
      path,
      jsonPath: jsonPathFromSegments(segments),
      depth,
      keyLabel,
      kind: value.kind,
      preview: previewFor(value, entries.length),
      expandable,
      expanded: isExpanded,
      value,
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

// A leaf's own text, compared case-insensitively against the query — never
// a container's `previewFor` count text (`"{2 keys}"` matching a search for
// "keys" would be a false positive against metadata, not real content).
// Strings compare their raw content, not `previewFor`'s `JSON.stringify`'d
// form, so searching `ada` finds `"ada@example.com"` without the user
// having to type a literal quote.
function leafTextMatches(value: JsonTreeValue, query: string): boolean {
  switch (value.kind) {
    case "Null":
      return "null".includes(query);
    case "Bool":
      return String(value.data).includes(query);
    case "Number":
      return value.data.toLowerCase().includes(query);
    case "String":
      return value.data.toLowerCase().includes(query);
    case "Object":
    case "Array":
      return false;
  }
}

// Returns every path that should stay visible under a search: a direct
// match on its own key or leaf value, or an ancestor of one — the set
// `flattenJsonTree`'s `visiblePaths` restricts the walk to. Query matching
// is case-insensitive; an empty/whitespace-only query has no well-defined
// "match" (the caller is expected to treat that as "no filter" instead of
// calling this at all).
export function findMatchingPaths(root: JsonTreeValue, query: string): Set<string> {
  const q = query.trim().toLowerCase();
  const visible = new Set<string>();

  function visit(value: JsonTreeValue, segments: Array<string | number>): boolean {
    const keyLabel = segments.length > 0 ? String(segments[segments.length - 1]) : null;
    const selfMatches = (keyLabel !== null && keyLabel.toLowerCase().includes(q)) || leafTextMatches(value, q);

    let descendantMatches = false;
    for (const [childKey, childValue] of containerEntries(value)) {
      if (visit(childValue, [...segments, childKey])) descendantMatches = true;
    }

    const keep = selfMatches || descendantMatches;
    if (keep) visible.add(JSON.stringify(segments));
    return keep;
  }

  visit(root, []);
  return visible;
}
