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

export interface JsonTreeMatch {
  path: string;
  // Root-to-parent order, one entry per ancestor — what the caller needs to
  // expand for this match to actually become visible before scrolling to it.
  ancestorPaths: string[];
}

// A standard "find" — not a filter (Story 8.1 Task 2, AC7, revised after the
// first pass filtered the tree down to matches, which read as a DevTools
// object-preview filter, not the find-in-page/find-in-explorer behavior a
// search bar is expected to have). Walks the *entire* tree regardless of
// current expand state, in document order, so `matches[i+1]` is always the
// next hit top-to-bottom — the order Next/Previous navigation and Enter/
// Shift+Enter cycle through. The tree's own visible shape (the caller's
// `expanded` set) is untouched by this walk; navigating to a match is what
// expands its ancestors, not searching for one.
export function findMatches(root: JsonTreeValue, query: string): JsonTreeMatch[] {
  const q = query.trim().toLowerCase();
  const matches: JsonTreeMatch[] = [];

  function visit(value: JsonTreeValue, segments: Array<string | number>, ancestorPaths: string[]) {
    const path = JSON.stringify(segments);
    const keyLabel = segments.length > 0 ? String(segments[segments.length - 1]) : null;
    const selfMatches = (keyLabel !== null && keyLabel.toLowerCase().includes(q)) || leafTextMatches(value, q);
    if (selfMatches) matches.push({ path, ancestorPaths });

    const childAncestors = [...ancestorPaths, path];
    for (const [childKey, childValue] of containerEntries(value)) {
      visit(childValue, [...segments, childKey], childAncestors);
    }
  }

  visit(root, [], []);
  return matches;
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

// Splits `text` into alternating matched/unmatched runs for rendering a
// `<mark>` around each hit — a display-layer concern, deliberately decoupled
// from `findMatches`'s own (raw-value) matching: a row's *preview* text can
// be a truncated or `JSON.stringify`-escaped rendering of the real value
// `findMatches` compared against, so highlighting re-scans whatever text is
// actually on screen rather than trying to map raw-value offsets onto it.
// The practical effect is that a match hiding entirely inside a truncated
// tail simply shows no highlight span on that row — its row is still a real,
// navigable match, there just isn't a visible substring left to mark.
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const q = query.trim();
  if (q === "") return [{ text, matched: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const segments: HighlightSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lowerText.indexOf(lowerQuery, i);
    if (idx === -1) {
      segments.push({ text: text.slice(i), matched: false });
      break;
    }
    if (idx > i) segments.push({ text: text.slice(i, idx), matched: false });
    segments.push({ text: text.slice(idx, idx + q.length), matched: true });
    i = idx + q.length;
  }
  return segments;
}
