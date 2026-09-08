import { describe, expect, it } from "vitest";
import { findMatches, wrapIndex } from "./findMatches";
import type { OcrRegion } from "./ocrOutcome";

function region(text: string | null): OcrRegion {
  return { text, confidence: text === null ? null : 0.99, polygon: [], char_polygons: [] };
}

describe("findMatches", () => {
  it("returns nothing for an empty query, so an open-but-empty find field marks nothing", () => {
    expect(findMatches([region("anything")], "")).toEqual([]);
  });

  it("finds a match and reports its character offsets", () => {
    expect(findMatches([region("NSURLErrorDomain error -1005")], "error")).toEqual([
      // "Error" inside "NSURLErrorDomain", then the standalone "error".
      { regionIndex: 0, start: 5, end: 10 },
      { regionIndex: 0, start: 17, end: 22 },
    ]);
  });

  it("matches case-insensitively", () => {
    expect(findMatches([region("Try Again")], "AGAIN")).toEqual([
      { regionIndex: 0, start: 4, end: 9 },
    ]);
  });

  it("returns matches in reading order, because regions arrive already sorted (AC21)", () => {
    // The third consumer of the one geometric sort, after Copy fidelity and screen-reader
    // DOM order — find ordering comes out correct for free rather than being re-derived.
    const matches = findMatches(
      [region("first error here"), region("second error here"), region("third error")],
      "error",
    );
    expect(matches.map((m) => m.regionIndex)).toEqual([0, 1, 2]);
  });

  it("skips regions the recogniser failed on, which have nothing to match", () => {
    const matches = findMatches([region(null), region("error"), region(null)], "error");
    expect(matches).toEqual([{ regionIndex: 1, start: 0, end: 5 }]);
  });

  it("counts overlapping occurrences once each rather than at every offset", () => {
    // "aa" in "aaaa" is two matches, not three — a find field that reports three would step
    // through positions the user cannot distinguish.
    expect(findMatches([region("aaaa")], "aa")).toEqual([
      { regionIndex: 0, start: 0, end: 2 },
      { regionIndex: 0, start: 2, end: 4 },
    ]);
  });

  it("treats the query literally, not as a pattern", () => {
    // Nobody typing into a find box expects `.` to match any character, and building a RegExp
    // from user input would need escaping to even be safe.
    expect(findMatches([region("a.c")], ".")).toEqual([{ regionIndex: 0, start: 1, end: 2 }]);
    expect(findMatches([region("abc")], ".")).toEqual([]);
    expect(findMatches([region("cost (5)")], "(")).toEqual([{ regionIndex: 0, start: 5, end: 6 }]);
  });

  it("returns nothing when no region matches", () => {
    expect(findMatches([region("hello")], "zzz")).toEqual([]);
  });
});

describe("wrapIndex", () => {
  it("passes an in-range index through untouched", () => {
    expect(wrapIndex(1, 3)).toBe(1);
  });

  it("wraps past the last match back to the first", () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(4, 3)).toBe(1);
  });

  it("wraps before the first match round to the last", () => {
    // The Previous button hands in `current - 1`, which is -1 at the top of the list.
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(-4, 3)).toBe(2);
  });

  it("returns 0 for an empty match list so callers need no special case", () => {
    expect(wrapIndex(0, 0)).toBe(0);
    expect(wrapIndex(-1, 0)).toBe(0);
  });

  it("reports offsets in code points, so an astral character before a match does not shift it", () => {
    // Code review 2026-09-08. `char_polygons` carries one polygon per Rust `char`, i.e. per
    // Unicode code point; these offsets index into it. An emoji is two UTF-16 code units and one
    // code point, so a code-unit scan would report `start: 5` here and paint the highlight one
    // character to the right of the word it matched — and `charRunPlacement` would return a
    // plausible box rather than declining, so nothing downstream would notice.
    const text = "\u{1F600} cat";
    const [match] = findMatches([region(text)], "cat");

    expect([...text].slice(match.start, match.end).join("")).toBe("cat");
    expect(match.start).toBe(2);
  });
});
