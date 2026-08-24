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

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

// Splits `text` into alternating matched/unmatched runs for rendering a
// `<mark>` around each hit. `findMatches` below reuses this same function to
// *count* occurrences (not just render them) — one function, one splitting
// rule, so the number of navigable occurrences a row reports can never drift
// from the number of `<mark>`s it actually renders.
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

function countOccurrences(text: string, query: string): number {
  return highlightSegments(text, query).filter((s) => s.matched).length;
}

export interface JsonTreeMatch {
  path: string;
  // Root-to-parent order, one entry per ancestor — what the caller needs to
  // expand for this match to actually become visible before scrolling to it.
  ancestorPaths: string[];
  // Which part of the row this occurrence lives in, and its 0-based index
  // among the occurrences within that part — together with `path`, this is
  // what lets the view mark exactly *one* `<mark>` as "current" instead of
  // every occurrence on a row that happens to hold more than one hit.
  field: "key" | "value";
  occurrenceIndex: number;
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
//
// One entry per *occurrence*, not per row — a row containing "apple apple"
// contributes two matches, not one, matching the two `<mark>`s it actually
// renders. Without this, Next/Previous and the "X of Y" count silently
// collapsed every occurrence on a line into a single step, which is the
// exact bug this was revised to fix.
export function findMatches(root: JsonTreeValue, query: string): JsonTreeMatch[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const matches: JsonTreeMatch[] = [];

  function visit(value: JsonTreeValue, segments: Array<string | number>, ancestorPaths: string[]) {
    const path = JSON.stringify(segments);
    const keyLabel = segments.length > 0 ? String(segments[segments.length - 1]) : null;

    if (keyLabel !== null) {
      const keyOccurrences = countOccurrences(keyLabel, query);
      for (let i = 0; i < keyOccurrences; i++) {
        matches.push({ path, ancestorPaths, field: "key", occurrenceIndex: i });
      }
    }

    const entries = containerEntries(value);
    // Only leaves get "value" matches (`leafTextMatches` already returns
    // `false` for Object/Array) — a container's own preview text is
    // metadata ("{2 keys}"), not real content, same rule `leafTextMatches`
    // has always enforced.
    if (entries.length === 0 && leafTextMatches(value, q)) {
      // Counted against the *displayed* text (post-truncation), not the raw
      // value: that's what `highlightSegments` will actually render, so
      // counting against anything else could report more occurrences than
      // there are visible marks to land on. The one exception is a match
      // hiding entirely inside a truncated tail — `leafTextMatches` (raw
      // text) still says yes, but the truncated preview shows zero; that
      // case falls back to exactly one synthetic occurrence so the row
      // stays a real, navigable match instead of silently vanishing.
      const displayText = previewFor(value, 0);
      const visibleOccurrences = countOccurrences(displayText, query);
      const count = visibleOccurrences > 0 ? visibleOccurrences : 1;
      for (let i = 0; i < count; i++) {
        matches.push({ path, ancestorPaths, field: "value", occurrenceIndex: i });
      }
    }

    const childAncestors = [...ancestorPaths, path];
    for (const [childKey, childValue] of entries) {
      visit(childValue, [...segments, childKey], childAncestors);
    }
  }

  visit(root, [], []);
  return matches;
}
