import type { OcrRegion } from "./ocrOutcome";

export interface FindMatch {
  /** Index into the outcome's `regions` array — already in reading order (AC21). */
  regionIndex: number;
  /** Character offsets into that region's `text`. */
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
  const needle = query.toLowerCase();
  if (needle.length === 0) return [];

  const matches: FindMatch[] = [];
  regions.forEach((region, regionIndex) => {
    const text = region.text;
    if (text === null) return;
    const haystack = text.toLowerCase();

    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      matches.push({ regionIndex, start: at, end: at + needle.length });
      // Advance past this match so overlapping occurrences ("aa" in "aaa") are reported once
      // each rather than at every offset.
      from = at + needle.length;
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
