// Hand-synced TypeScript mirror of `crates/umbra-core/src/ocr.rs`'s `OcrOutcome`,
// `OcrRegion` and `OcrPoint`. There is no codegen step: if the Rust shape changes,
// this file must change with it, and `deferred-work.md` tracks the unchecked
// `as OcrOutcome` assertion at the IPC boundary that would otherwise catch a drift.

/** One point of a region's bounding polygon, in `image_width`/`image_height` space. */
export interface OcrPoint {
  x: number;
  y: number;
}

export interface OcrRegion {
  /**
   * `null` means the detector found a text region and recognition FAILED on it —
   * never "was filtered for being uncertain": recognition's `score_threshold` is
   * 0.0, so nothing is discarded behind our backs. These regions are kept so the
   * view can mark them on the image.
   */
  text: string | null;
  confidence: number | null;
  /**
   * A rotated minimum-area rectangle, NOT an axis-aligned box — four corners in
   * order, carrying several degrees of real tilt on a photo of a document. Anything
   * laying text over the image must use the polygon's own edges (top-edge length,
   * perpendicular height, `atan2` of the top edge) rather than its bounding box, or
   * the overlay drifts a full line-height across a long line.
   */
  polygon: OcrPoint[];
  /**
   * One polygon per character of `text`, in the same space — or EMPTY when the model produced
   * no usable set. Core only carries it across when its length matches the character count, so
   * a non-empty array is always index-aligned with `text`.
   *
   * This is what makes a find-match highlight land on the exact characters instead of being
   * estimated from the overlay font's metrics. Estimating is systematically wrong whenever the
   * image's font distributes width differently from the overlay's — a terminal capture is the
   * worst case, where the source is monospace and the estimate drifts by several characters.
   */
  char_polygons: OcrPoint[][];
}

export interface OcrOutcome {
  /** Already sorted into reading order by core, which is what makes DOM order correct. */
  regions: OcrRegion[];
  /**
   * Dimensions AFTER EXIF orientation — the space `polygon` coordinates live in.
   *
   * snake_case, not camelCase: nothing renames these across the IPC boundary. The core
   * structs carry no `#[serde(rename_all = "camelCase")]`, and this codebase's other
   * mirrors keep the Rust spelling for the same reason (`cronExplanation.ts`'s
   * `next_runs`, `scheduleDescription.ts`'s `day_of_month`).
   */
  image_width: number;
  image_height: number;
}
