import { describe, expect, it } from "vitest";
import { LOW_CONFIDENCE_THRESHOLD, isLowConfidence, isUnreadable } from "./lowConfidence";
import type { OcrRegion } from "./ocrOutcome";

function region(text: string | null, confidence: number | null): OcrRegion {
  return { text, confidence, polygon: [], char_polygons: [] };
}

describe("LOW_CONFIDENCE_THRESHOLD", () => {
  it("sits below every correct region measured in the quality corpus", () => {
    // The lowest-scoring correctly-recognised region across the four corpus fixtures.
    // If a future model or config change pushes real text under the threshold, this fails
    // rather than the app quietly marking correct text as doubtful.
    const LOWEST_CORRECT_CORPUS_REGION = 0.9504;
    expect(LOW_CONFIDENCE_THRESHOLD).toBeLessThan(LOWEST_CORRECT_CORPUS_REGION);
  });

  it("sits above every wholly out-of-vocabulary region measured", () => {
    // `⌘` dropped entirely, `⇧` read as 介, `⌥` read as 1, the `⌘⇧⌥⌃` run, and the
    // two-character `⌘V` case — the last of which is why 0.90 was chosen over 0.75 or 0.89.
    const OUT_OF_VOCABULARY_SCORES = [0.0, 0.4961, 0.5203, 0.6451, 0.8909];
    for (const score of OUT_OF_VOCABULARY_SCORES) {
      expect(score).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    }
  });
});

describe("isLowConfidence", () => {
  it("marks a region scoring below the threshold", () => {
    expect(isLowConfidence(region("介", 0.4961))).toBe(true);
    expect(isLowConfidence(region("∞七^", 0.6451))).toBe(true);
  });

  it("does not mark a region scoring at or above the threshold", () => {
    expect(isLowConfidence(region("ok", LOW_CONFIDENCE_THRESHOLD))).toBe(false);
    expect(isLowConfidence(region("Try Again", 0.9752))).toBe(false);
  });

  it("marks the two-character ⌘V case, which is why the threshold is 0.90 and not lower", () => {
    // `⌘V` recognised as `tV` scored 0.8909 — above both the canvas's proposed 0.75 and the
    // 0.89 first considered. It is the case that fixes the threshold's value, so it is pinned.
    expect(isLowConfidence(region("tV", 0.8909))).toBe(true);
  });

  it("cannot see a single wrong character inside an otherwise-correct long line", () => {
    // Not an aspiration — a measured, structural limit. Region confidence is the mean of
    // per-character probabilities, so `"…or paste (8V), to extract its text."` (where ⌘ was
    // read as 8) scored 0.9735 against 0.9763 for the same line without the symbol. Both are
    // far above any usable threshold. Encoded here so nobody later "fixes" the threshold to
    // chase this case and marks a fifth of all correct text instead.
    const CORRUPTED_LONG_LINE = 0.9735;
    const CLEAN_EQUIVALENT_LINE = 0.9763;
    expect(isLowConfidence(region("…paste (8V)…", CORRUPTED_LONG_LINE))).toBe(false);
    expect(isLowConfidence(region("…paste it…", CLEAN_EQUIVALENT_LINE))).toBe(false);
    expect(Math.abs(CLEAN_EQUIVALENT_LINE - CORRUPTED_LONG_LINE)).toBeLessThan(0.01);
  });

  it("does not mark a region that has no confidence score at all", () => {
    // Absence of a score is not evidence of doubt.
    expect(isLowConfidence(region("text", null))).toBe(false);
  });

  it("does not mark an unreadable region as low-confidence — that is a different state", () => {
    // `text: null` gets a dashed outline, not a dotted underline: a different SHAPE, so the
    // two signals stay distinguishable without relying on colour.
    expect(isLowConfidence(region(null, null))).toBe(false);
    expect(isLowConfidence(region(null, 0.1))).toBe(false);
  });
});

describe("isUnreadable", () => {
  it("is true exactly when the detector found a region the recogniser could not read", () => {
    expect(isUnreadable(region(null, null))).toBe(true);
    expect(isUnreadable(region("", 0.0))).toBe(false);
    expect(isUnreadable(region("text", 0.99))).toBe(false);
  });
});
