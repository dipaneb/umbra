import { describe, expect, it } from "vitest";
import fixture from "./realOutcome.fixture.json";
import { findMatches } from "./findMatches";
import { charRunPlacement } from "./overlayGeometry";
import type { OcrOutcome } from "./ocrOutcome";

// A REAL outcome, captured from `crates/umbra-core` running over a rendered screenshot, rather
// than a hand-written shape. Everything else in this island tests synthetic regions, which
// cannot catch the one failure they are most exposed to: the hand-synced Rust <-> TypeScript
// contract drifting. If `char_polygons` were ever serialised under a different name, or nested
// differently, every synthetic test would still pass and this one would not.
const outcome = fixture as unknown as OcrOutcome;

describe("a real OcrOutcome from the core crate", () => {
  it("deserialises into the shape the TypeScript mirror declares", () => {
    expect(outcome.image_width).toBeGreaterThan(0);
    expect(outcome.image_height).toBeGreaterThan(0);
    for (const region of outcome.regions) {
      expect(Array.isArray(region.polygon)).toBe(true);
      expect(Array.isArray(region.char_polygons)).toBe(true);
      // Code review 2026-09-08: NOT an unconditional length equality. `measure_char_polygons`
      // returns an EMPTY vector by design whenever it is not confident of its measurement —
      // tilt beyond ~2 degrees, fewer columns than characters, gaps it cannot resolve — which is
      // the documented "honest imprecise" fallback that `ocr.rs`'s own
      // `declines_to_measure_characters_on_a_photographed_page` asserts. Requiring every region
      // to be measurable encoded an invariant the Rust side explicitly does not offer, and
      // passed only because this fixture happens to be a clean screenshot: regenerate it from a
      // photo or a tilted capture and the test fails for correct behaviour.
      const charCount = [...(region.text ?? "")].length;
      expect(
        region.char_polygons.length === 0 || region.char_polygons.length === charCount,
      ).toBe(true);
      expect(region.polygon[0]).toHaveProperty("x");
    }
  });

  it("places a find match exactly on its own characters", () => {
    const matches = findMatches(outcome.regions, "match");
    expect(matches.length).toBeGreaterThan(0);

    for (const match of matches) {
      const region = outcome.regions[match.regionIndex];
      const placement = charRunPlacement(region.char_polygons, match.start, match.end, 1);
      expect(placement).not.toBeNull();

      const firstBox = region.char_polygons[match.start];
      const lastBox = region.char_polygons[match.end - 1];
      const trueLeft = Math.min(...firstBox.map((p) => p.x));
      const trueRight = Math.max(...lastBox.map((p) => p.x));

      expect(placement!.left).toBeCloseTo(trueLeft, 1);
      expect(placement!.left + placement!.widthPx).toBeCloseTo(trueRight, 1);
      // And it is a real, non-degenerate box — a one-character-wide sliver where five
      // characters were matched is the shape of an indexing bug.
      expect(placement!.widthPx).toBeGreaterThan(placement!.heightPx * 0.5);
    }
  });
});
