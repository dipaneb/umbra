import type { OcrPoint, OcrRegion } from "./ocrOutcome";

/**
 * Ratio of a region's perpendicular edge that becomes the span's `font-size`.
 *
 * Measured during Story 8.7's overlay spike: the actual ink inside a detected box fills only
 * **57–67%** of its height on screenshots (86% on a photographed page), because detection
 * expands every box by `unclip_ratio = 2.0` before returning it. Setting `font-size` to the
 * region's full height — which AC34 originally said — renders every span about half again too
 * large, bursting its box and colliding with its neighbours.
 *
 * This only affects apparent glyph size. Horizontal placement, which is what a selection
 * highlight actually rides on, is corrected by measurement in {@link spanGeometryFor}.
 */
export const FONT_SIZE_RATIO = 0.62;

/**
 * The font the overlay spans render in, and the one the measurer must measure with.
 *
 * Exported so the two cannot drift: measuring in one font and rendering in another would make
 * every fitted width wrong by a different amount per glyph, which is worse than not fitting at
 * all because the error would look random rather than systematic.
 */
export const OVERLAY_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';


/** Measures the natural rendered width of `text` at `fontSizePx`, in CSS pixels. */
export type MeasureText = (text: string, fontSizePx: number) => number;

export interface SpanGeometry {
  /** CSS `left`, in rendered-image pixels, of the span's rotation origin. */
  left: number;
  /** CSS `top`, in rendered-image pixels, of the span's rotation origin. */
  top: number;
  fontSizePx: number;
  letterSpacingPx: number;
  /** CSS rotation, in radians, about `transform-origin: 0 0`. */
  angleRad: number;
  /** The region's own width along its top edge, scaled — what the text is fitted to. */
  widthPx: number;
  /** The region's perpendicular height, scaled. */
  heightPx: number;
}

function distance(a: OcrPoint, b: OcrPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export interface QuadPlacement {
  left: number;
  top: number;
  widthPx: number;
  heightPx: number;
  angleRad: number;
}

/**
 * Places a rotated quadrilateral in rendered-image space: its first corner, the length and
 * angle of its top edge, and its perpendicular height.
 *
 * Shared by the text spans and the find-match rectangles so both sit in the same frame by
 * construction rather than by two implementations agreeing.
 */
export function quadPlacement(points: OcrPoint[], scale: number): QuadPlacement {
  if (points.length < 4) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = xs.length ? Math.min(...xs) : 0;
    const minY = ys.length ? Math.min(...ys) : 0;
    return {
      left: minX * scale,
      top: minY * scale,
      widthPx: ((xs.length ? Math.max(...xs) : 0) - minX) * scale,
      heightPx: ((ys.length ? Math.max(...ys) : 0) - minY) * scale,
      angleRad: 0,
    };
  }
  const [p0, p1, , p3] = points;
  return {
    left: p0.x * scale,
    top: p0.y * scale,
    widthPx: distance(p0, p1) * scale,
    heightPx: distance(p0, p3) * scale,
    angleRad: Math.atan2(p1.y - p0.y, p1.x - p0.x),
  };
}

/**
 * The exact placement of characters `[start, end)` of a region, from the per-character polygons
 * core returns — no font metrics, no estimation.
 *
 * Returns `null` when the region carries no usable character polygons, so the caller can fall
 * back to the measured estimate. The run's quad is the first character's leading edge through
 * the last character's trailing edge, which is exact for a rotated line as well as a level one.
 */
export function charRunPlacement(
  charPolygons: OcrPoint[][],
  start: number,
  end: number,
  scale: number,
): QuadPlacement | null {
  const first = charPolygons[start];
  const last = charPolygons[end - 1];
  if (!first || !last || first.length < 4 || last.length < 4) return null;
  return quadPlacement([first[0], last[1], last[2], first[3]], scale);
}

/**
 * AC35: how much to scale an image so it fits the pane, **never upscaling**.
 *
 * One factor for both axes, so the overlay needs exactly one coordinate transform. An image
 * smaller than the pane renders at natural size rather than being blown up — upscaling
 * degrades the pixels the user is meant to be checking the text against, which is the whole
 * point of showing the image.
 */
export function fitScale(
  imageWidth: number,
  imageHeight: number,
  paneWidth: number,
  paneHeight: number,
): number {
  if (imageWidth <= 0 || imageHeight <= 0 || paneWidth <= 0 || paneHeight <= 0) return 1;
  return Math.min(1, paneWidth / imageWidth, paneHeight / imageHeight);
}

/**
 * AC34: places one transparent, selectable span over its region.
 *
 * Uses the region's **own quadrilateral**, not its axis-aligned bounding box. `oar-ocr`'s
 * detector returns a rotated minimum-area rectangle, and a photographed page carries several
 * degrees of real tilt — measured at 3.25° median, which across a 650px line is ~37px of
 * vertical drift against a 35px line height. An axis-aligned span walks clean off the words by
 * the end of the sentence; the spike showed exactly that.
 *
 * So, per region: position at the quad's first corner, take the top edge's length as the target
 * width and its angle as the rotation, take the perpendicular edge as the height basis, and fit
 * the text's *measured* width to the target with `letter-spacing`. At 0° this degenerates
 * exactly to the axis-aligned case, so screenshots are unaffected and there is one code path.
 *
 * A polygon that is not a quadrilateral (never observed from this detector, but the type
 * permits it) falls back to its bounding box with no rotation.
 */
export function spanGeometryFor(
  region: OcrRegion,
  scale: number,
  measure: MeasureText,
): SpanGeometry {
  const text = region.text ?? "";
  const points = region.polygon;

  const { left, top, widthPx, heightPx, angleRad } = quadPlacement(points, scale);
  const fontSizePx = heightPx * FONT_SIZE_RATIO;

  // Nudge the glyph box down the quad's own normal by the vertical slack, so the text sits
  // centred in the band rather than pinned to its top edge.
  const normalX = -Math.sin(angleRad);
  const normalY = Math.cos(angleRad);
  const slack = (heightPx - fontSizePx) / 2;

  return {
    left: left + normalX * slack,
    top: top + normalY * slack,
    fontSizePx,
    letterSpacingPx: fitLetterSpacing(text, fontSizePx, widthPx, measure),
    angleRad,
    widthPx,
    heightPx,
  };
}

/**
 * The per-character adjustment that makes the span's rendered width match the region's.
 *
 * This is what makes a browser-native selection highlight land on the words underneath, and
 * anything highlighting *part* of a region (find-in-image) inherits the same accuracy. It is
 * achievable because the measured ink fills ~97% of a region's width — `unclip_ratio`'s
 * expansion lands almost entirely on height, not on the axis a highlight rides.
 */
function fitLetterSpacing(
  text: string,
  fontSizePx: number,
  targetWidthPx: number,
  measure: MeasureText,
): number {
  if (text.length === 0 || fontSizePx <= 0) return 0;
  const natural = measure(text, fontSizePx);
  if (!Number.isFinite(natural) || natural <= 0) return 0;
  // CSS letter-spacing adds its value after every character, including the last, which is why
  // the divisor is the full length rather than length - 1.
  return (targetWidthPx - natural) / text.length;
}
