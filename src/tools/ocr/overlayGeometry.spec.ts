import { describe, expect, it } from "vitest";
import { FONT_SIZE_RATIO, charRunPlacement, fitScale, spanGeometryFor } from "./overlayGeometry";
import type { OcrRegion } from "./ocrOutcome";

// A deterministic stand-in for real text metrics: every glyph is half the font size wide.
// jsdom has no canvas text measurement, so the view passes a real measurer at runtime and the
// tests pass this — the geometry is what's under test, not the font.
const measure = (text: string, fontSizePx: number) => text.length * fontSizePx * 0.5;
const noMeasure = () => Number.NaN;

function axisAligned(x: number, y: number, w: number, h: number, text: string | null): OcrRegion {
  return {
    text,
    confidence: 0.99,
    polygon: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    char_polygons: [],
  };
}

/** A quad rotated by `deg` about its first corner — what a photographed page actually yields. */
function rotated(x: number, y: number, w: number, h: number, deg: number, text: string): OcrRegion {
  const r = (deg * Math.PI) / 180;
  const [ux, uy] = [Math.cos(r), Math.sin(r)];
  const [nx, ny] = [-Math.sin(r), Math.cos(r)];
  return {
    text,
    confidence: 0.99,
    polygon: [
      { x, y },
      { x: x + ux * w, y: y + uy * w },
      { x: x + ux * w + nx * h, y: y + uy * w + ny * h },
      { x: x + nx * h, y: y + ny * h },
    ],
    char_polygons: [],
  };
}

describe("fitScale", () => {
  it("shrinks an image larger than the pane to fit, preserving one factor for both axes", () => {
    expect(fitScale(2000, 1000, 800, 600)).toBeCloseTo(0.4);
    expect(fitScale(1000, 2000, 800, 600)).toBeCloseTo(0.3);
  });

  it("never upscales an image smaller than the pane (AC35)", () => {
    // Blowing the image up degrades the very pixels the user is meant to check the text
    // against, which is the reason the image is on screen at all.
    expect(fitScale(200, 100, 800, 600)).toBe(1);
    expect(fitScale(799, 599, 800, 600)).toBe(1);
  });

  it("returns 1 for degenerate dimensions rather than dividing by zero", () => {
    expect(fitScale(0, 100, 800, 600)).toBe(1);
    expect(fitScale(100, 100, 0, 600)).toBe(1);
  });
});

describe("spanGeometryFor", () => {
  it("derives font-size from the region's height times the calibration ratio, not its full height", () => {
    // Setting font-size to the full height renders every span ~1.5x too large: measured ink
    // fills only 57-67% of a detected box, because detection expands boxes by unclip_ratio 2.0.
    const g = spanGeometryFor(axisAligned(10, 20, 200, 40, "hello"), 1, measure);
    expect(g.fontSizePx).toBeCloseTo(40 * FONT_SIZE_RATIO);
    expect(g.fontSizePx).toBeLessThan(40);
  });

  it("fits the span's measured width to the region's width via letter-spacing", () => {
    const region = axisAligned(0, 0, 200, 40, "hello"); // 5 chars
    const g = spanGeometryFor(region, 1, measure);
    const natural = measure("hello", g.fontSizePx);
    // letter-spacing is added after every character, including the last.
    expect(natural + g.letterSpacingPx * 5).toBeCloseTo(g.widthPx);
    expect(g.widthPx).toBeCloseTo(200);
  });

  it("applies the single uniform scale factor to both axes", () => {
    const g = spanGeometryFor(axisAligned(100, 50, 200, 40, "hi"), 0.5, measure);
    expect(g.left).toBeCloseTo(50);
    expect(g.widthPx).toBeCloseTo(100);
    expect(g.heightPx).toBeCloseTo(20);
  });

  it("does not rotate an axis-aligned region", () => {
    expect(spanGeometryFor(axisAligned(0, 0, 100, 20, "x"), 1, measure).angleRad).toBeCloseTo(0);
  });

  it("rotates a tilted region by its own top-edge angle", () => {
    // The case that made this necessary: a photographed page measured 3.25 degrees median tilt.
    const g = spanGeometryFor(rotated(100, 100, 650, 35, 3.25, "a photographed line"), 1, measure);
    expect((g.angleRad * 180) / Math.PI).toBeCloseTo(3.25, 4);
    // The region's own edge length, not its bounding box's width, is what the text fits to —
    // an AABB of a tilted quad is wider than the line inside it.
    expect(g.widthPx).toBeCloseTo(650, 3);
    expect(g.heightPx).toBeCloseTo(35, 3);
  });

  it("degenerates to the axis-aligned result at zero tilt, so there is one code path", () => {
    const straight = spanGeometryFor(axisAligned(10, 20, 300, 30, "same"), 1, measure);
    const viaRotation = spanGeometryFor(rotated(10, 20, 300, 30, 0, "same"), 1, measure);
    expect(viaRotation.left).toBeCloseTo(straight.left);
    expect(viaRotation.top).toBeCloseTo(straight.top);
    expect(viaRotation.widthPx).toBeCloseTo(straight.widthPx);
    expect(viaRotation.angleRad).toBeCloseTo(straight.angleRad);
  });

  it("centres the glyph box within the region's band rather than pinning it to the top edge", () => {
    const g = spanGeometryFor(axisAligned(0, 100, 200, 40, "hello"), 1, measure);
    expect(g.top).toBeCloseTo(100 + (40 - 40 * FONT_SIZE_RATIO) / 2);
  });

  it("survives a region with no measurable text without producing NaN", () => {
    // A region the recogniser failed on still needs a box drawn (AC17/AC39).
    const g = spanGeometryFor(axisAligned(0, 0, 100, 20, null), 1, measure);
    expect(g.letterSpacingPx).toBe(0);
    expect(Number.isFinite(g.left)).toBe(true);
    expect(Number.isFinite(g.widthPx)).toBe(true);
  });

  it("falls back to zero letter-spacing when text cannot be measured", () => {
    const g = spanGeometryFor(axisAligned(0, 0, 100, 20, "hello"), 1, noMeasure);
    expect(g.letterSpacingPx).toBe(0);
  });

  it("falls back to the bounding box for a polygon that is not a quadrilateral", () => {
    const triangle: OcrRegion = {
      text: "tri",
      confidence: 0.9,
      polygon: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 30, y: 20 },
      ],
      char_polygons: [],
    };
    const g = spanGeometryFor(triangle, 1, measure);
    expect(g.angleRad).toBe(0);
    expect(g.widthPx).toBeCloseTo(60);
    expect(g.heightPx).toBeCloseTo(20);
  });
});

describe("charRunPlacement", () => {
  /** One box per character, laid out left to right — the shape core returns. */
  function charBoxes(count: number, startX = 10, width = 20, y = 0, height = 30) {
    return Array.from({ length: count }, (_, i) => [
      { x: startX + i * width, y },
      { x: startX + (i + 1) * width, y },
      { x: startX + (i + 1) * width, y: y + height },
      { x: startX + i * width, y: y + height },
    ]);
  }

  it("spans the first matched character's leading edge to the last's trailing edge", () => {
    const p = charRunPlacement(charBoxes(10), 3, 6, 1)!;
    expect(p.left).toBeCloseTo(70);
    expect(p.widthPx).toBeCloseTo(60);
    expect(p.heightPx).toBeCloseTo(30);
  });

  it("is never a sliver when several characters matched", () => {
    // A one-character-wide box where five characters matched is the shape of an indexing bug,
    // and it is what a render review actually caught.
    const p = charRunPlacement(charBoxes(20), 8, 13, 1)!;
    expect(p.widthPx).toBeCloseTo(100);
  });

  it("applies the uniform scale factor", () => {
    const p = charRunPlacement(charBoxes(10), 0, 2, 0.5)!;
    expect(p.left).toBeCloseTo(5);
    expect(p.widthPx).toBeCloseTo(20);
  });

  it("returns null when the run falls outside the boxes it was given", () => {
    // The caller bands the whole region instead of guessing a substring's position.
    expect(charRunPlacement(charBoxes(4), 2, 9, 1)).toBeNull();
    expect(charRunPlacement([], 0, 3, 1)).toBeNull();
  });
});
