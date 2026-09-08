import type { OcrRegion } from "./ocrOutcome";

export interface FindMatch {
  /** Index into the outcome's `regions` array — already in reading order (AC21). */
  regionIndex: number;
  /**
   * Offsets into that region's text, counted in **Unicode code points** — the same unit
   * `char_polygons` is indexed by, one polygon per Rust `char`.
   *
   * Code review 2026-09-08: these used to be `String.indexOf` results, i.e. UTF-16 code units.
   * Any astral-plane character earlier in a region (an emoji in a screenshot, a rare CJK
   * extension glyph) shifts every later code-unit offset by +1 per surrogate pair relative to
   * the polygon index, so `charRunPlacement` returned a plausible-looking box over the wrong
   * characters rather than declining — not even flagged `approximate`. `realOutcome.spec.ts`
   * could not catch it either: it compares against `[...text].length`, code points, while the
   * consumer indexed with code units.
   */
  start: number;
  end: number;
}

/**
 * AC38: every occurrence of `query` across the recognised regions, in reading order.
 *
 * Match order follows the same geometric sort as everything else, for free: `regions` arrives
 * already sorted by core, so iterating it in order and scanning each region left-to-right
 * yields matches in the order a reader would meet them. That is the third consumer of the one
 * sort — after Copy fidelity and screen-reader DOM order.
 *
 * Matching is case-insensitive and literal: the query is a string the user typed into a find
 * field, never a pattern. Building a `RegExp` from it would make `.` and `(` behave in ways
 * nobody typing into a find box expects, and would need escaping to be safe.
 *
 * Regions whose recognition failed (`text: null`) are skipped — there is nothing to match, and
 * they carry their own marker.
 */
export function findMatches(regions: OcrRegion[], query: string): FindMatch[] {
  // Scanned over ARRAYS of code points rather than over the strings themselves, so the offsets
  // reported are the ones `char_polygons` is indexed by. See `FindMatch.start`.
  //
  // Each code point is folded on its own and compared one-to-one. The cost is exact and worth
  // naming: a code point whose lowercase form is longer than itself (`İ` U+0130 folds to two
  // code points) will not match a plain `i`. That is a missed match, never a misplaced
  // highlight — and a highlight sitting on the wrong characters is the worse failure for a tool
  // whose entire claim is that the text you select is the text that is there.
  const needle = [...query].map((c) => c.toLowerCase());
  if (needle.length === 0) return [];

  const matches: FindMatch[] = [];
  regions.forEach((region, regionIndex) => {
    const text = region.text;
    if (text === null) return;
    const haystack = [...text].map((c) => c.toLowerCase());

    let from = 0;
    while (from + needle.length <= haystack.length) {
      const hit = needle.every((c, k) => haystack[from + k] === c);
      if (!hit) {
        from += 1;
        continue;
      }
      matches.push({ regionIndex, start: from, end: from + needle.length });
      // Advance past this match so overlapping occurrences ("aa" in "aaa") are reported once
      // each rather than at every offset.
      from += needle.length;
    }
  });
  return matches;
}

/**
 * Wraps a match index into range, at both ends.
 *
 * Wrapping rather than clamping: a find bar that goes dead at the last match makes the user
 * wonder whether it broke. Callers pass an already-stepped index (`current + 1`, or whatever a
 * Previous button computed), so one helper serves the buttons, Enter/Shift+Enter and the arrow
 * keys alike. Returns 0 for an empty match list so callers have no special case.
 */
export function wrapIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}
