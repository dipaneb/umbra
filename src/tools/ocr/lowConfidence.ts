import type { OcrRegion } from "./ocrOutcome";

/**
 * The single named threshold below which a recognised region is marked unsure on the image
 * (AC36). Developer's call, 2026-09-07, chosen against measurement rather than taste — the
 * design canvas had proposed 0.75, which the measurements below showed to be too permissive.
 *
 * What was measured, on this project's own corpus fixtures and a purpose-built glyph sheet:
 *
 * | region                              | confidence |
 * | ----------------------------------- | ---------- |
 * | `⌘` alone (dropped entirely)        |     0.0000 |
 * | `⇧` alone (read as `介`)            |     0.4961 |
 * | `⌥` alone (read as `1`)             |     0.5203 |
 * | `⌘⇧⌥⌃` (read as `∞七^`)             |     0.6451 |
 * | `⌘V` (read as `tV`)                 |     0.8909 |
 * | 36 correct corpus regions           | 0.9504 min, 0.9879 median |
 *
 * So 0.90 catches every out-of-vocabulary region measured — including the two-character `⌘V`
 * case at 0.8909, which 0.75 and 0.89 would both have missed — with **zero** false positives
 * against the 36 correct regions in the corpus. It sits in a wide gap: 0.25 above the worst
 * garbage region, 0.05 below the lowest correct one.
 *
 * ## What this threshold structurally cannot do
 *
 * Region confidence is the arithmetic mean of per-character probabilities
 * (`oar-ocr-core-0.6.3/src/processors/decode.rs:236`), so a single wrong character inside a
 * long line barely moves it. Measured, from the same image: the line
 * `"…or paste (⌘V), to extract its text."` — where `⌘` was read as `8` — scored **0.9735**,
 * against **0.9763** for the identical line without the symbol. A 0.003 difference.
 *
 * No threshold separates those: the lowest CORRECT region in the corpus is 0.9504, well below
 * both. Catching intra-region substitutions needs per-character confidence, which `oar-ocr`
 * computes and then averages away before it reaches any public type. Filed as a backlog
 * candidate — https://github.com/dipaneb/umbra/issues/135 — since it is not a tuning problem.
 *
 * This marking is therefore an honest **region-level** signal — it says "this whole region is
 * doubtful", not "this character is wrong". The defence against a confidently-wrong character
 * inside otherwise-clean text is architectural rather than statistical: Live Text renders the
 * recognised text ON the pixels, so the `8` sits directly over a visible `⌘`.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.9;

/**
 * Whether a region should be marked unsure on the image.
 *
 * A region whose `text` is `null` is NOT low-confidence — it is a different state entirely
 * (detected, and recognition failed outright), carrying its own marker: a dashed outline
 * rather than a dotted underline. The two differ in **shape, not hue**, so the signal survives
 * a colour-blind viewer and a greyscale screenshot.
 *
 * A region with no confidence score at all is not marked: absence of a score is not evidence
 * of doubt, and inventing one would be its own small bluff.
 */
export function isLowConfidence(region: OcrRegion): boolean {
  if (region.text === null) return false;
  if (region.confidence === null) return false;
  return region.confidence < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * Whether a region was found by the detector and failed by the recogniser — the strongest
 * "I'm unsure here" this pipeline produces, and the reason `text: null` regions are retained
 * rather than skipped (AC17).
 */
export function isUnreadable(region: OcrRegion): boolean {
  return region.text === null;
}
