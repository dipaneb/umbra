//! OCR capability (AD-8): image bytes in, recognized text regions + geometry out — either
//! compressed bytes (`extract_text`, format-sniffed) or already-decoded raw RGBA pixels plus
//! dimensions (`extract_text_from_rgba`, Story 4.2 — clipboard-pasted images arrive
//! already-decoded, with no compressed-bytes accessor). Named after the capability, not the
//! Bucket tool, so a future structured-extraction feature (FR29) can reuse or extend this trait
//! shape without a rename.
//!
//! `oar-ocr` is the v1 adapter behind [`OcrEngine`] — callers, commands, and UI depend on the
//! trait only and never import `oar-ocr` directly.

use crate::error::ToolError;
use oar_ocr::domain::tasks::text_detection::TextDetectionConfig;
use oar_ocr::domain::tasks::text_recognition::TextRecognitionConfig;
use oar_ocr::oarocr::OAROCRBuilder;
use oar_ocr::processors::LimitType;
use std::path::PathBuf;

// Same rationale as base64.rs/hash.rs's own MAX_INPUT_BYTES (CWE-400 unbounded allocation from
// an arbitrarily large dropped file). Each tool module owns its own constant rather than
// sharing another module's, per hash.rs's existing convention. `pub` so src-tauri's command
// layer can reuse it for the file-size guard instead of duplicating the value.
pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

/// One point of a text region's bounding polygon, in the coordinate space described by
/// [`OcrOutcome::image_width`]/[`OcrOutcome::image_height`].
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct OcrPoint {
    pub x: f32,
    pub y: f32,
}

/// One text region the detector found.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct OcrRegion {
    /// `None` means the detector found a text region and recognition FAILED on it — never
    /// "was filtered for being uncertain". Recognition's `score_threshold` is 0.0 (see
    /// [`OarOcrEngine::new`]), so nothing is discarded behind our backs. These regions are
    /// kept, not skipped: a detected-but-unreadable box is the strongest "I'm unsure here"
    /// this pipeline produces, and it turns "no text found" on an image visibly full of text
    /// from a lie of omission into a diagnosis.
    pub text: Option<String>,
    pub confidence: Option<f32>,
    /// `TextRegion.bounding_box.points`, verbatim, in `image_width`/`image_height` space.
    ///
    /// Verified against `oar-ocr-core-0.6.3`: `db_bitmap.rs`'s `boxes_from_bitmap` scales
    /// detection points by `dest_width / bitmap_width`, where `dest_*` is
    /// `ImageScaleInfo::src_w`/`src_h` — documented in `processors/types.rs` as "Original
    /// image width/height before resizing" — and clamps to it. So these coordinates are in
    /// the ORIGINAL image's space, not the downscaled space detection actually ran in.
    ///
    /// This is a rotated minimum-area rectangle, not an axis-aligned box: `get_mini_boxes`
    /// returns four corners in order, and on a photo of a document they carry several degrees
    /// of genuine tilt. Consumers that lay text over the image must use the polygon's own
    /// edges rather than its bounding box, or the overlay drifts across a long line.
    pub polygon: Vec<OcrPoint>,
    /// One polygon per character of `text`, in the same coordinate space — or EMPTY when the
    /// characters could not be located confidently.
    ///
    /// **Measured from the pixels, not from the model.** The recogniser's own `word_boxes`
    /// carry positions derived from CTC timestep fractions, and those are wrong by up to
    /// twenty characters mid-line (see `OarOcrEngine::new`). So `measure_char_polygons` crops
    /// the region, thresholds it, and finds the real gaps between glyphs in the column ink
    /// profile — which is what a consumer needs in order to highlight an exact substring.
    ///
    /// Empty when the measurement is not confident: a rotated line, a low-contrast photo,
    /// touching glyphs. A caller that cannot use it treats it as absent either way, and a
    /// non-empty vector is always index-aligned with `text`.
    pub char_polygons: Vec<Vec<OcrPoint>>,
}

/// Result of running OCR over one image.
///
/// Deliberately region-structured rather than a pre-joined string: the adapter already holds
/// every value here, per region, inside its existing loop — the old flat `{ text, confidence }`
/// shape destroyed the pairing and the geometry at the core boundary. The change is subtraction
/// (the adapter stops discarding), not new computation.
///
/// **No whole-text accessor lives here.** Joining regions into one string for a Copy button is
/// presentation, and AD-1 puts presentation in the view.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct OcrOutcome {
    /// Sorted into reading order before leaving core — see `sort_into_reading_order`. Empty
    /// when the detector found nothing at all.
    pub regions: Vec<OcrRegion>,
    /// Dimensions of the image recognition actually ran against, AFTER EXIF orientation is
    /// applied — the space [`OcrRegion::polygon`] coordinates live in.
    pub image_width: u32,
    pub image_height: u32,
}

impl OcrOutcome {
    /// FR26 / Story 4.3's honesty guarantee, anchored to **text** rather than to region count:
    /// an image can yield several regions and still have nothing readable in it. A region whose
    /// `text` is `None` is retained in `regions` precisely so the view can mark it on the image
    /// while this still reports "no text found".
    #[must_use]
    pub fn has_readable_text(&self) -> bool {
        self.regions
            .iter()
            .any(|region| region.text.as_deref().is_some_and(|t| !t.trim().is_empty()))
    }
}

pub trait OcrEngine: Send + Sync {
    fn extract_text(&self, image_bytes: &[u8]) -> Result<OcrOutcome, ToolError>;

    /// Same output as [`Self::extract_text`], but for input that's already decoded to raw RGBA
    /// pixels (row-major, top-to-bottom) rather than compressed image bytes — the shape
    /// clipboard-pasted images arrive in (Story 4.2). `rgba.len()` must equal
    /// `width * height * 4`; a mismatch is a [`ToolError`], not a panic.
    fn extract_text_from_rgba(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
    ) -> Result<OcrOutcome, ToolError>;
}

fn ocr_error(code: &str, message: impl std::fmt::Display) -> ToolError {
    ToolError {
        code: code.to_string(),
        message: message.to_string(),
        position: None,
        context: None,
    }
}

/// AC24. The single most-hit error in this tool — every non-image drop lands here — and until
/// Story 8.7 it rendered the `image` crate's own English prose ("The image format could not be
/// determined"), which is third-party text no French user could ever have read in French.
///
/// **Value-free and non-enumerating, both deliberately.** Value-free is what makes
/// `src/shell/toolError.ts` able to swap in a translated sentence off the code alone: there is
/// no runtime number baked into this string to lose. Non-enumerating is a correctness point,
/// not a style one — `image`'s `default-formats` decodes fifteen formats including TIFF and
/// BMP, while FR23, the registry description and the drop hint have all said "PNG, JPEG, or
/// WebP" since Story 4.1. Naming formats here would re-commit the same under-statement in the
/// one place the user is already being told no.
const UNSUPPORTED_FORMAT_MESSAGE: &str = "That file isn't an image this tool can read.";

/// AC25. A PDF is the predicted wrong-file drop, and it is worth answering by name rather than
/// letting it fall into [`UNSUPPORTED_FORMAT_MESSAGE`] — the user is not confused about what
/// they dropped, only about where it goes.
///
/// **A sentence, not a routing offer** (developer's call, 2026-09-07): a navigation button
/// would land them on an empty PDF view holding nothing, implying a hand-off the app does not
/// have. Carrying the file across is the version worth building, and it belongs to Story 8.8,
/// which will know what the PDF tool's entry state looks like after its own redesign.
const PDF_WRONG_TOOL_MESSAGE: &str = "PDFs open in the PDF tool.";

/// PDF's file signature, per ISO 32000-1 §7.5.2: a conforming file begins with `%PDF-` followed
/// by its version. Checked at byte 0 only — a substring search would misfile any image whose
/// compressed pixel data happens to contain those five bytes.
const PDF_MAGIC: &[u8] = b"%PDF-";

/// AC25's guard. Runs **before** decode is attempted, so a PDF never reaches the `image` crate
/// and can never be reported as an undetermined format.
///
/// Only on the compressed-bytes path. [`OcrEngine::extract_text_from_rgba`] receives pixels
/// that are already decoded, with no container format left to sniff.
fn reject_pdf(image_bytes: &[u8]) -> Result<(), ToolError> {
    if image_bytes.starts_with(PDF_MAGIC) {
        return Err(ocr_error("ocr-pdf-wrong-tool", PDF_WRONG_TOOL_MESSAGE));
    }
    Ok(())
}

/// Whether `header` opens with a container signature this engine can actually decode.
///
/// Code review 2026-09-08: the command layer grants the webview read access to a dropped file
/// so it can render it, and it did so *before* anything validated the file — dropping `id_rsa`
/// or a `.docx` put it on the process's asset allow-list even though extraction failed
/// immediately and the view never rendered it. This is the guard that lets the grant be made
/// only for files the engine would accept.
///
/// It lives here, next to [`reject_pdf`] and sharing [`OcrEngine::extract_text`]'s own
/// `image::guess_format` sniffing, so grant-validation and decode-validation agree **by
/// construction** rather than by two hand-synced format lists drifting apart. Only the leading
/// bytes are needed: every format signature `image` recognises fits well inside 32 bytes (WebP's
/// `RIFF....WEBP` is the longest at 12).
pub fn looks_like_a_supported_image(header: &[u8]) -> bool {
    reject_pdf(header).is_ok() && image::guess_format(header).is_ok()
}

/// Fraction of a region's own height within which two vertical centres count as the same row.
/// Half a line height: comfortably groups a dialog's body text with the sidebar entry beside
/// it, without merging two genuinely stacked lines.
const ROW_BAND_FRACTION: f32 = 0.5;

fn vertical_bounds(polygon: &[OcrPoint]) -> (f32, f32) {
    // Code review 2026-09-08: the fold's identity is (MAX, MIN), so an EMPTY polygon returned
    // (MAX, MIN) unchanged and `polygon_height` then computed (MIN - MAX).abs(), which overflows
    // f32 to +inf. That made `tolerance` infinite in `sort_into_reading_order`, banding every
    // region on the page into one row and re-sorting the whole thing purely left-to-right —
    // breaking Copy fidelity, NFR5 screen-reader order and find ordering in a single step, with
    // no error anywhere. Polygons come straight from the detector's `bounding_box.points` with
    // no filter, so this is near-unreachable; the failure if it is reached is total, and the
    // guard is one line. `measure_char_polygons` already refuses `polygon.len() < 4` for the
    // same reason, and the TypeScript side's `quadPlacement` guards its own empty case.
    if polygon.is_empty() {
        return (0.0, 0.0);
    }
    polygon.iter().fold((f32::MAX, f32::MIN), |(lo, hi), p| {
        (lo.min(p.y), hi.max(p.y))
    })
}

fn vertical_centre(polygon: &[OcrPoint]) -> f32 {
    let (min, max) = vertical_bounds(polygon);
    (min + max) / 2.0
}

fn polygon_height(polygon: &[OcrPoint]) -> f32 {
    let (min, max) = vertical_bounds(polygon);
    (max - min).abs()
}

fn left_edge(polygon: &[OcrPoint]) -> f32 {
    polygon.iter().fold(f32::MAX, |lo, p| lo.min(p.x))
}

/// Sorts regions geometrically into reading order, in core, before they leave it.
///
/// One sort serves three consumers — Copy fidelity, screen-reader DOM order (NFR5), and
/// find-in-image match ordering — which is what moves it from a correctness nicety to
/// load-bearing. `oar-ocr` emits regions in the model's *detection* order, which interleaves
/// silently on any layout that isn't a single column.
///
/// The definition, and its limit, are deliberate: regions whose vertical centres fall within
/// [`ROW_BAND_FRACTION`] of their own height are banded into one row; rows are ordered
/// top-to-bottom; regions within a row are ordered left-to-right. That handles a dialog's
/// button row, a sidebar, and an interleaved layout. **It does not claim to handle a true
/// multi-column magazine spread** — reading all of column one before column two needs layout
/// analysis, which is out of scope here; such a page bands its columns together row by row.
fn sort_into_reading_order(mut regions: Vec<OcrRegion>) -> Vec<OcrRegion> {
    if regions.len() < 2 {
        return regions;
    }
    // Stable sort by vertical centre first, so banding sees regions top-to-bottom and equal
    // centres keep the model's own relative order rather than an arbitrary one.
    regions.sort_by(|a, b| {
        vertical_centre(&a.polygon)
            .partial_cmp(&vertical_centre(&b.polygon))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut rows: Vec<Vec<OcrRegion>> = Vec::new();
    let mut row_centre = f32::NAN;
    for region in regions {
        let centre = vertical_centre(&region.polygon);
        let tolerance = ROW_BAND_FRACTION * polygon_height(&region.polygon);
        match rows.last_mut() {
            Some(row) if (centre - row_centre).abs() <= tolerance => row.push(region),
            _ => {
                row_centre = centre;
                rows.push(vec![region]);
            }
        }
    }

    rows.into_iter()
        .flat_map(|mut row| {
            row.sort_by(|a, b| {
                left_edge(&a.polygon)
                    .partial_cmp(&left_edge(&b.polygon))
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            row
        })
        .collect()
}

/// A line tilted by more than this is not measured: the crop below is axis-aligned, so a
/// slanted line smears its glyphs across every column and the ink profile stops meaning
/// anything. Photographed pages fall here and get an honest whole-region highlight instead.
const MAX_MEASURABLE_TILT_RAD: f32 = 0.035; // ~2 degrees

/// Measures where each character actually is, from the pixels.
///
/// The recogniser's own character positions are CTC timestep fractions and are wrong by up to
/// twenty characters mid-line (see [`OarOcrEngine::new`]). This measures the ink instead:
/// crop the region, threshold it, and read the gaps out of the column profile. For crisp text
/// — a screenshot, the case this tool is pointed at most — the gaps between words are
/// unmistakable, and that is what anchors everything else.
///
/// Returns an empty vector rather than a poor answer whenever the measurement is not
/// confident. A wrong box drawn precisely is worse than an honest imprecise one: the caller
/// bands the whole region instead.
fn measure_char_polygons(
    image: &image::RgbImage,
    polygon: &[OcrPoint],
    text: &str,
) -> Vec<Vec<OcrPoint>> {
    let chars: Vec<char> = text.chars().collect();
    if chars.is_empty() || polygon.len() < 4 {
        return Vec::new();
    }

    // Axis-aligned only. A tilted quad would need a perspective crop, and the fallback is
    // already honest, so this declines rather than approximating twice over.
    let (p0, p1) = (polygon[0], polygon[1]);
    if (p1.y - p0.y).atan2(p1.x - p0.x).abs() > MAX_MEASURABLE_TILT_RAD {
        return Vec::new();
    }

    let x0 = polygon
        .iter()
        .fold(f32::MAX, |m, p| m.min(p.x))
        .floor()
        .max(0.0) as u32;
    let x1 = polygon
        .iter()
        .fold(f32::MIN, |m, p| m.max(p.x))
        .ceil()
        .min(image.width() as f32) as u32;
    let y0 = polygon
        .iter()
        .fold(f32::MAX, |m, p| m.min(p.y))
        .floor()
        .max(0.0) as u32;
    let y1 = polygon
        .iter()
        .fold(f32::MIN, |m, p| m.max(p.y))
        .ceil()
        .min(image.height() as f32) as u32;
    let (w, h) = (x1.saturating_sub(x0), y1.saturating_sub(y0));
    // Fewer columns than characters cannot resolve them, whatever the profile says.
    if h < 4 || (w as usize) < chars.len() {
        return Vec::new();
    }

    let luma: Vec<u8> = (y0..y1)
        .flat_map(|y| {
            (x0..x1).map(move |x| {
                let p = image.get_pixel(x, y).0;
                ((p[0] as u32 * 299 + p[1] as u32 * 587 + p[2] as u32 * 114) / 1000) as u8
            })
        })
        .collect();

    let threshold = otsu_threshold(&luma);
    // Which side of the threshold is ink depends on the image: dark text on light, or light
    // text on dark. The region's own top and bottom rows are padding (the detector unclips
    // every box), so they are background by construction — no guess needed.
    let border_mean = {
        let top: u32 = luma[..w as usize].iter().map(|&v| v as u32).sum();
        let bottom: u32 = luma[luma.len() - w as usize..]
            .iter()
            .map(|&v| v as u32)
            .sum();
        ((top + bottom) / (2 * w)) as u8
    };
    let ink_is_dark = border_mean > threshold;

    let mut profile = vec![0u32; w as usize];
    for (i, &value) in luma.iter().enumerate() {
        let is_ink = if ink_is_dark {
            value < threshold
        } else {
            value > threshold
        };
        if is_ink {
            profile[i % w as usize] += 1;
        }
    }

    // Runs of empty columns. The widest of these are the spaces between words.
    let mut gaps: Vec<(usize, usize)> = Vec::new();
    let mut run: Option<usize> = None;
    for (x, &ink) in profile.iter().enumerate() {
        match (ink == 0, run) {
            (true, None) => run = Some(x),
            (false, Some(start)) => {
                gaps.push((start, x));
                run = None;
            }
            _ => {}
        }
    }
    if let Some(start) = run {
        gaps.push((start, profile.len()));
    }

    // Leading and trailing blank padding are not gaps BETWEEN anything.
    let ink_start = profile.iter().position(|&v| v > 0);
    let ink_end = profile.iter().rposition(|&v| v > 0);
    let (Some(ink_start), Some(ink_end)) = (ink_start, ink_end) else {
        return Vec::new();
    };
    gaps.retain(|&(a, b)| a > ink_start && b <= ink_end);

    // Word runs in the recognised text, as (first_index, last_index_exclusive).
    let mut words: Vec<(usize, usize)> = Vec::new();
    let mut start: Option<usize> = None;
    for (i, ch) in chars.iter().enumerate() {
        match (ch.is_whitespace(), start) {
            (false, None) => start = Some(i),
            (true, Some(s)) => {
                words.push((s, i));
                start = None;
            }
            _ => {}
        }
    }
    if let Some(s) = start {
        words.push((s, chars.len()));
    }
    if words.is_empty() {
        return Vec::new();
    }

    // The N-1 widest gaps are the word separators — not "every gap", since monospaced glyphs
    // are separated by blank columns too. Requiring exactly the right number to exist is the
    // confidence check: a photo or a touching-glyph line simply will not have them.
    let needed = words.len() - 1;
    if gaps.len() < needed {
        return Vec::new();
    }
    gaps.sort_by_key(|&(a, b)| std::cmp::Reverse(b - a));
    let mut separators: Vec<(usize, usize)> = gaps.into_iter().take(needed).collect();
    separators.sort_by_key(|&(a, _)| a);

    // Each word owns the span between the separators either side of it; characters inside a
    // word are distributed evenly across it. That is exact for a monospaced face and within
    // about one character for a proportional one — bounded, unlike the timestep positions.
    let mut spans: Vec<(f32, f32)> = vec![(0.0, 0.0); chars.len()];
    let mut left = ink_start;
    for (wi, &(first, last)) in words.iter().enumerate() {
        let right = separators.get(wi).map_or(ink_end + 1, |&(a, _)| a);
        if right <= left {
            return Vec::new();
        }
        let width = (right - left) as f32 / (last - first) as f32;
        for (n, index) in (first..last).enumerate() {
            let a = left as f32 + width * n as f32;
            spans[index] = (a, a + width);
        }
        if let Some(&(a, b)) = separators.get(wi) {
            // The whitespace characters between this word and the next share the gap.
            let blanks = words.get(wi + 1).map_or(chars.len(), |w| w.0) - last;
            let each = (b - a) as f32 / blanks.max(1) as f32;
            for (n, index) in (last..last + blanks).enumerate() {
                let s = a as f32 + each * n as f32;
                spans[index] = (s, s + each);
            }
            left = b;
        }
    }

    // Code review 2026-09-08: every character starts at (0.0, 0.0) and only two things ever
    // overwrite that — the characters inside a word, and the whitespace in a gap BETWEEN two
    // words. `separators` holds exactly `words.len() - 1` entries, so a line that OPENS or
    // CLOSES with whitespace left those characters as zero-width boxes pinned at the crop's left
    // edge, while the doc comment above promised an index-aligned vector. Length-aligned it was;
    // positionally it lied at both ends. The visible consequence was a find match whose run
    // touched an edge blank: `charRunPlacement` built its quad from a `last` box sitting at x0,
    // giving atan2(0, x0 - first.x) = pi — a highlight drawn rotated 180 degrees and running
    // backwards across the line. Padding gets the space outside the ink, which is where it is.
    let lead = words[0].0;
    if lead > 0 {
        let each = ink_start as f32 / lead as f32;
        for (n, span) in spans[..lead].iter_mut().enumerate() {
            let a = each * n as f32;
            *span = (a, a + each);
        }
    }
    let tail_from = words[words.len() - 1].1;
    if tail_from < chars.len() {
        let a0 = (ink_end + 1) as f32;
        let each = (w as f32 - a0).max(0.0) / (chars.len() - tail_from) as f32;
        for (n, span) in spans[tail_from..].iter_mut().enumerate() {
            let a = a0 + each * n as f32;
            *span = (a, a + each);
        }
    }

    let (top, bottom) = (y0 as f32, y1 as f32);
    spans
        .into_iter()
        .map(|(a, b)| {
            let (a, b) = (x0 as f32 + a, x0 as f32 + b);
            vec![
                OcrPoint { x: a, y: top },
                OcrPoint { x: b, y: top },
                OcrPoint { x: b, y: bottom },
                OcrPoint { x: a, y: bottom },
            ]
        })
        .collect()
}

/// Otsu's method: the threshold maximising between-class variance. Chosen so nothing here is a
/// tuned constant that works on one screenshot and not the next.
fn otsu_threshold(luma: &[u8]) -> u8 {
    let mut histogram = [0u32; 256];
    for &value in luma {
        histogram[value as usize] += 1;
    }
    let total = luma.len() as f64;
    let sum: f64 = histogram
        .iter()
        .enumerate()
        .map(|(i, &c)| i as f64 * c as f64)
        .sum();
    let (mut weight_background, mut sum_background, mut best, mut best_variance) =
        (0.0, 0.0, 0u8, -1.0);
    for (t, &count) in histogram.iter().enumerate() {
        weight_background += count as f64;
        if weight_background == 0.0 {
            continue;
        }
        let weight_foreground = total - weight_background;
        if weight_foreground == 0.0 {
            break;
        }
        sum_background += t as f64 * count as f64;
        let mean_background = sum_background / weight_background;
        let mean_foreground = (sum - sum_background) / weight_foreground;
        let variance =
            weight_background * weight_foreground * (mean_background - mean_foreground).powi(2);
        if variance > best_variance {
            best_variance = variance;
            best = t as u8;
        }
    }
    best
}

/// The `oar-ocr` adapter behind [`OcrEngine`] (AD-8). Constructed from resolved absolute model
/// paths — this module stays filesystem-path-agnostic beyond that (AD-2/AD-15); resolving
/// `resources/models/*` paths at runtime is the Tauri command layer's job (Task 4/6).
pub struct OarOcrEngine {
    inner: oar_ocr::oarocr::OAROCR,
}

impl OarOcrEngine {
    pub fn new(
        text_detection_model_path: impl Into<PathBuf>,
        text_recognition_model_path: impl Into<PathBuf>,
        character_dict_path: impl Into<PathBuf>,
    ) -> Result<Self, ToolError> {
        // Every field below is stated explicitly, and that is not stylistic. Verified against
        // the vendored `oar-ocr-0.6.3` source (`src/oarocr/ocr.rs`): `build()` wraps its whole
        // "general" preset in `if !has_explicit_det_cfg`, so passing a `TextDetectionConfig`
        // AT ALL opts out of every field of it — and `TextDetectionConfig::default()` does not
        // reproduce that preset. Setting only `limit_side_len` would silently take
        // `unclip_ratio` 2.0 -> 1.5, `max_side_len` 4000 -> None, and `limit_type` Max -> None,
        // which `DetResizeForTest` then resolves to `Min` — inverting the resize so the limit
        // pads the SHORT side up instead of capping the long one. A `..Default::default()`
        // struct-update here would reintroduce exactly that bug.
        let detection = TextDetectionConfig {
            // Reproduces today's shipped "general" preset.
            score_threshold: 0.3,
            // Reproduces the preset. Decides which detected boxes survive; tuning it is
            // deliberately deferred behind the quality corpus, since tuning thresholds without
            // a way to measure regression is guessing with extra steps.
            box_threshold: 0.6,
            // Reproduces the preset. How far each box is expanded before cropping; measured to
            // cost ~3% on width and ~35-40% on height against the actual ink.
            unclip_ratio: 2.0,
            // Reproduces the preset.
            max_candidates: 1000,
            // THE ONE DELIBERATE CHANGE, raised from the preset's 960. Every image is
            // downscaled so its longest side is at most this before detection; at 960 a 3024px
            // Retina screenshot was recognised at ~960px, putting 13-point UI text at roughly
            // four pixels tall. Detection cost scales with image *area* while recognition cost
            // scales with the *number of regions*, so this is ~2.8x the pixels for the
            // detection pass only, not for the whole job.
            limit_side_len: Some(1600),
            // Reproduces the preset, and load-bearing: under `Min` the line above would mean
            // the exact opposite of what it says.
            limit_type: Some(LimitType::Max),
            // Reproduces the preset's OOM guard.
            max_side_len: Some(4000),
        };

        // `max_text_length` is genuinely ambiguous in the vendored source — 25 in
        // `TextRecognitionConfig::default()`, 100 in the predictor builder, 128 in the crate's
        // own test fixture — and which one reaches the CTC decoder depends on the construction
        // path. Measured against a real fixture: a 105-character line survives intact today, so
        // the effective bound is not 25. Stated explicitly so it cannot drift; the regression
        // test that proves it is `recovers_a_line_far_longer_than_the_default_max_text_length`.
        let recognition = TextRecognitionConfig {
            // No filtering, and load-bearing rather than incidental: it is what makes
            // `OcrRegion::text: None` genuinely mean "recognition failed" instead of "was
            // quietly dropped for being uncertain", which is what lets the view mark low
            // confidence honestly (FR26).
            score_threshold: 0.0,
            max_text_length: 100,
        };

        let inner = OAROCRBuilder::new(
            text_detection_model_path,
            text_recognition_model_path,
            character_dict_path,
        )
        .text_detection_config(detection)
        .text_recognition_config(recognition)
        // Deliberately NOT configured, each for a stated reason:
        // - `.return_word_box(true)`: it DOES populate one box per character on the bundled
        //   model, and the count always matches the text — but the POSITIONS are unusable.
        //   They are CTC timestep fractions (`decode.rs:514`), a by-product of recognition
        //   rather than a measurement of the ink. Measured against ground truth across line
        //   lengths: max error 86 px on a 40-character line, 166 px at 80, and 322 px — over
        //   twenty characters — at 160, all on a 15.7 px character. A matching count proves
        //   how many boxes there are, never where they are. Cut #4 stands; character geometry
        //   is measured from the pixels instead, in `measure_char_polygons` below.
        // - `.with_text_line_orientation_classification(..)`: needs a THIRD bundled model, on
        //   top of the 6 MB already shipped, to populate `orientation_angle`. Note that is
        //   orientation *classification* (is this line sideways/upside down), not the fine skew
        //   angle — the latter is recoverable from the bounding polygon we already return.
        // - `.ort_session(..)`: no execution provider, so `ort` runs on CPU. The six providers
        //   are compile-time Cargo features, i.e. per-target binaries and a fresh AD-7 network
        //   audit; tracked as its own backlog item rather than smuggled in here.
        .build()
        .map_err(|err| ocr_error("ocr-engine-init-failed", err))?;
        Ok(Self { inner })
    }
}

impl OarOcrEngine {
    fn run_ocr(&self, image: image::RgbImage) -> Result<OcrOutcome, ToolError> {
        let (image_width, image_height) = (image.width(), image.height());
        // Kept for `measure_char_polygons`, which reads the real ink rather than trusting the
        // recogniser's own character positions.
        let source = image.clone();

        let mut results = self
            .inner
            .predict(vec![image])
            .map_err(|err| ocr_error("ocr-extraction-failed", err))?;

        let result = results
            .pop()
            .ok_or_else(|| ocr_error("ocr-extraction-failed", "OCR engine returned no result"))?;

        // Subtraction, not new computation: this loop used to build two parallel vectors, skip
        // every region whose recognition had failed, average one vector and join the other —
        // destroying the pairing and the geometry the adapter already had in hand.
        //
        // `dt_poly`, `rec_poly`, `word_boxes`, `label` and `orientation_angle` deliberately do
        // not cross the boundary: the first two are redundant with `bounding_box` for this use,
        // `word_boxes` is unpopulated, `label` is unused, and `orientation_angle` is always
        // `None` in our configuration.
        let regions = result
            .text_regions
            .iter()
            .map(|region| {
                let text = region.text.as_ref().map(|t| t.to_string());
                let polygon: Vec<OcrPoint> = region
                    .bounding_box
                    .points
                    .iter()
                    .map(|p| OcrPoint { x: p.x, y: p.y })
                    .collect();
                // Measured from the ink, NOT taken from `region.word_boxes` — those carry a
                // correct character count with unusable positions. See `measure_char_polygons`.
                let char_polygons = text
                    .as_deref()
                    .map(|t| measure_char_polygons(&source, &polygon, t))
                    .unwrap_or_default();
                OcrRegion {
                    text,
                    confidence: region.confidence,
                    polygon,
                    char_polygons,
                }
            })
            .collect();

        Ok(OcrOutcome {
            regions: sort_into_reading_order(regions),
            image_width,
            image_height,
        })
    }
}

impl OcrEngine for OarOcrEngine {
    fn extract_text(&self, image_bytes: &[u8]) -> Result<OcrOutcome, ToolError> {
        // AC25: before anything is decoded, so a PDF is answered by name instead of falling
        // into the generic "not an image" sentence below.
        reject_pdf(image_bytes)?;

        // `image::load_from_memory` is `ImageReader::with_guessed_format().decode()`, and
        // `decode()` does NOT apply EXIF orientation — the crate requires reading it and
        // calling `apply_orientation` explicitly. Skipping that (as this module did from Story
        // 4.1 until Story 8.7) means a phone photo taken with the handset held sideways reaches
        // the detector rotated 90 degrees, detection largely fails on rotated text, and the
        // user is told "no text found" about an image visibly full of it — confidently wrong
        // output, which is the exact failure FR26 exists to prevent.
        use image::ImageDecoder;
        let reader = image::ImageReader::new(std::io::Cursor::new(image_bytes))
            .with_guessed_format()
            .map_err(|_| ocr_error("ocr-unsupported-format", UNSUPPORTED_FORMAT_MESSAGE))?;
        let mut decoder = reader
            .into_decoder()
            .map_err(|_| ocr_error("ocr-unsupported-format", UNSUPPORTED_FORMAT_MESSAGE))?;
        // A malformed or absent EXIF block is not a decode failure — treat it as "no
        // transform" rather than rejecting an otherwise-readable image.
        let orientation = decoder
            .orientation()
            .unwrap_or(image::metadata::Orientation::NoTransforms);
        let mut image = image::DynamicImage::from_decoder(decoder)
            .map_err(|_| ocr_error("ocr-unsupported-format", UNSUPPORTED_FORMAT_MESSAGE))?;
        image.apply_orientation(orientation);
        self.run_ocr(image.into_rgb8())
    }

    fn extract_text_from_rgba(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
    ) -> Result<OcrOutcome, ToolError> {
        // `into()` here doesn't decode/re-encode anything: RgbaImage -> DynamicImage -> RgbImage
        // is just alpha-channel dropping over the buffer already in memory (image 0.25.9's
        // `impl From<RgbaImage> for DynamicImage` + `DynamicImage::into_rgb8`), the same
        // conversion `extract_text`'s format-sniffing decode already ends with.
        //
        // No EXIF handling on this path, deliberately: these pixels arrive already decoded from
        // the clipboard and carry no metadata to honour.
        if width == 0 || height == 0 {
            return Err(ocr_error(
                "ocr-malformed-image-buffer",
                format!("image dimensions must be non-zero, got {width}x{height}"),
            ));
        }
        let rgba_image = image::RgbaImage::from_raw(width, height, rgba.to_vec()).ok_or_else(|| {
            ocr_error(
                "ocr-malformed-image-buffer",
                format!(
                    // u128, not u64: width/height are u32, so this product can't overflow u128,
                    // unlike u64 (width as u64 * height as u64 * 4 can overflow for width/height
                    // near u32::MAX) — this is an error-message computation, not a hot path, so
                    // there's no reason to use anything narrower than a type wide enough to never
                    // overflow for any valid input.
                    "RGBA buffer is {} bytes, which does not match {width}x{height}x4 = {} bytes",
                    rgba.len(),
                    width as u128 * height as u128 * 4
                ),
            )
        })?;
        let image: image::DynamicImage = rgba_image.into();
        self.run_ocr(image.into_rgb8())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Bundled models live under `src-tauri/resources/models/` (Task 4), two levels up from
    // this crate's own root — not under this crate's `tests/fixtures/` alongside the sample
    // image, since they're app resources shared with the real Tauri build, not test-only data.
    fn model_path(file: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../src-tauri/resources/models")
            .join(file)
    }

    fn fixture_path(file: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(file)
    }

    fn test_engine() -> OarOcrEngine {
        OarOcrEngine::new(
            model_path("text_detection.onnx"),
            model_path("text_recognition.onnx"),
            model_path("character_dict.txt"),
        )
        .expect("test OCR engine should initialize from the bundled models")
    }

    fn extract(fixture: &str) -> OcrOutcome {
        let engine = test_engine();
        let bytes = std::fs::read(fixture_path(fixture)).unwrap();
        engine.extract_text(&bytes).unwrap()
    }

    // --- the quality corpus's tolerance model --------------------------------------------
    //
    // OCR output is not byte-exact, so equality is the wrong instrument. CONTENT is asserted
    // per expected line, case-insensitively and with whitespace collapsed, against the joined
    // recognised text. ORDER is asserted separately, by a different helper, so a reading-order
    // regression fails distinctly from a recognition regression — one means the sort broke, the
    // other means the model got worse, and a single assertion would conflate them.

    fn normalise(s: &str) -> String {
        s.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase()
    }

    /// Presentation-side join, mirrored here only so tests can assert on recognised content —
    /// core itself deliberately exposes no whole-text accessor (AD-1).
    fn joined(outcome: &OcrOutcome) -> String {
        outcome
            .regions
            .iter()
            .filter_map(|r| r.text.as_deref())
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn assert_contains_lines(outcome: &OcrOutcome, expected: &[&str], fixture: &str) {
        let haystack = normalise(&joined(outcome));
        for line in expected {
            assert!(
                haystack.contains(&normalise(line)),
                "{fixture}: expected to recognise {line:?}\n--- got ---\n{}",
                joined(outcome)
            );
        }
    }

    /// Asserts the recognised lines appear in this relative order, independently of whatever
    /// else was recognised between them.
    fn assert_order(outcome: &OcrOutcome, expected_order: &[&str], fixture: &str) {
        let haystack = normalise(&joined(outcome));
        let mut cursor = 0usize;
        for line in expected_order {
            let needle = normalise(line);
            let found = haystack[cursor..].find(&needle).unwrap_or_else(|| {
                panic!(
                    "{fixture}: {line:?} did not appear after the previous expected line\n\
                     --- got, in reading order ---\n{}",
                    joined(outcome)
                )
            });
            cursor += found + needle.len();
        }
    }

    // --- the reading-order sort, as a pure function ---------------------------------------

    fn region_at(x: f32, y: f32, w: f32, h: f32, text: &str) -> OcrRegion {
        OcrRegion {
            text: Some(text.to_string()),
            confidence: Some(0.9),
            polygon: vec![
                OcrPoint { x, y },
                OcrPoint { x: x + w, y },
                OcrPoint { x: x + w, y: y + h },
                OcrPoint { x, y: y + h },
            ],
            char_polygons: Vec::new(),
        }
    }

    fn texts(regions: &[OcrRegion]) -> Vec<&str> {
        regions.iter().filter_map(|r| r.text.as_deref()).collect()
    }

    #[test]
    fn sorts_a_sidebar_beside_body_text_left_to_right_within_each_row_band() {
        // Detection order is deliberately scrambled here: the model emits whatever it emits.
        let sorted = sort_into_reading_order(vec![
            region_at(1000.0, 230.0, 150.0, 26.0, "status"),
            region_at(60.0, 300.0, 600.0, 26.0, "second body line"),
            region_at(60.0, 225.0, 600.0, 26.0, "first body line"),
            region_at(1000.0, 302.0, 150.0, 26.0, "queue"),
        ]);
        assert_eq!(
            texts(&sorted),
            ["first body line", "status", "second body line", "queue"]
        );
    }

    #[test]
    fn orders_a_button_row_left_to_right_even_when_slightly_misaligned_vertically() {
        // Two buttons whose centres differ by a few pixels are one row, not two.
        let sorted = sort_into_reading_order(vec![
            region_at(440.0, 252.0, 90.0, 26.0, "Try Again"),
            region_at(340.0, 250.0, 76.0, 26.0, "Cancel"),
        ]);
        assert_eq!(texts(&sorted), ["Cancel", "Try Again"]);
    }

    #[test]
    fn keeps_genuinely_stacked_lines_in_separate_rows() {
        // Adjacent lines a full line-height apart must NOT band together, or a single-column
        // document would be reordered left-to-right across its own lines.
        let sorted = sort_into_reading_order(vec![
            region_at(60.0, 130.0, 400.0, 24.0, "third"),
            region_at(60.0, 60.0, 400.0, 24.0, "first"),
            region_at(60.0, 95.0, 400.0, 24.0, "second"),
        ]);
        assert_eq!(texts(&sorted), ["first", "second", "third"]);
    }

    #[test]
    fn sorting_is_a_no_op_for_zero_or_one_region() {
        assert!(sort_into_reading_order(vec![]).is_empty());
        let one = vec![region_at(0.0, 0.0, 10.0, 10.0, "only")];
        assert_eq!(texts(&sort_into_reading_order(one)), ["only"]);
    }

    #[test]
    fn edge_whitespace_is_measured_outside_the_ink_not_pinned_to_the_left_edge() {
        // Code review 2026-09-08. `spans` starts as (0.0, 0.0) for every character, and only two
        // things ever overwrote that: the characters inside a word, and the whitespace in a gap
        // BETWEEN two words. `separators` holds exactly words.len() - 1 entries, so a line that
        // OPENS or CLOSES with whitespace left those characters as zero-width boxes at the
        // crop's left edge — while the function's doc promised an index-aligned vector.
        //
        // The visible consequence was a find match whose run touched an edge blank:
        // `charRunPlacement` built its quad from a `last` box sitting at x0, giving
        // atan2(0, x0 - first.x) = pi — a highlight drawn rotated 180 degrees, running backwards
        // across the line.
        //
        // Two ink bars on white, with deliberate padding either side, and a text that has both a
        // leading and a trailing space.
        // Antialiased edges rather than pure black on pure white: a perfectly bimodal
        // histogram drives Otsu to t=0, and the ink test is `value < threshold`, so nothing
        // reads as ink and the function takes its honest decline path — which would make this
        // test vacuous. Real glyph edges are never bimodal. (The `<` vs `<=` boundary that
        // makes the bimodal case degenerate is recorded in deferred-work.md.)
        let mut image = image::RgbImage::from_pixel(100, 20, image::Rgb([240, 240, 240]));
        let bar = |image: &mut image::RgbImage, x0: u32, x1: u32| {
            for y in 5..15 {
                for x in x0..x1 {
                    let edge = x == x0 || x == x1 - 1;
                    let v = if edge { 120 } else { 25 };
                    image.put_pixel(x, y, image::Rgb([v, v, v]));
                }
            }
        };
        bar(&mut image, 20, 40);
        bar(&mut image, 60, 80);
        let polygon = vec![
            OcrPoint { x: 0.0, y: 0.0 },
            OcrPoint { x: 100.0, y: 0.0 },
            OcrPoint { x: 100.0, y: 20.0 },
            OcrPoint { x: 0.0, y: 20.0 },
        ];
        let text = " ab cd ";
        let polygons = measure_char_polygons(&image, &polygon, text);
        assert_eq!(polygons.len(), text.chars().count());

        let left_of = |q: &Vec<OcrPoint>| q.iter().fold(f32::MAX, |m, p| m.min(p.x));
        let right_of = |q: &Vec<OcrPoint>| q.iter().fold(f32::MIN, |m, p| m.max(p.x));

        // The leading blank owns the padding before the ink — it must have real width, and must
        // not extend into the first word.
        let leading = &polygons[0];
        assert!(
            right_of(leading) > left_of(leading),
            "leading blank is zero-width"
        );
        assert!(
            right_of(leading) <= 21.0,
            "leading blank runs into the first word"
        );

        // The trailing blank owns the padding after the ink, at the RIGHT edge — the bug put it
        // at x0, which is what made the highlight quad point backwards.
        let trailing = &polygons[text.chars().count() - 1];
        assert!(
            right_of(trailing) > left_of(trailing),
            "trailing blank is zero-width"
        );
        assert!(
            left_of(trailing) >= 79.0,
            "trailing blank sits at {}, not after the ink",
            left_of(trailing)
        );
    }

    #[test]
    fn a_degenerate_polygon_does_not_collapse_every_row_into_one() {
        // Code review 2026-09-08. `vertical_bounds` folds from (f32::MAX, f32::MIN), so an EMPTY
        // polygon returned that identity unchanged and `polygon_height` computed
        // (MIN - MAX).abs(), which overflows f32 to +inf — an infinite row-banding tolerance,
        // which swallowed every region on the page into one row and re-sorted the whole thing
        // left-to-right. Copy fidelity, NFR5 screen-reader order and find ordering all break
        // together, with nothing raised anywhere. Three stacked lines are the smallest case that
        // shows it: with the bug they come back as one row, ordered by x.
        let mut degenerate = region_at(0.0, 0.0, 0.0, 0.0, "degenerate");
        degenerate.polygon = Vec::new();
        let sorted = sort_into_reading_order(vec![
            region_at(300.0, 130.0, 100.0, 24.0, "third"),
            region_at(200.0, 95.0, 100.0, 24.0, "second"),
            region_at(100.0, 60.0, 100.0, 24.0, "first"),
            degenerate,
        ]);
        // The degenerate region sorts to the top (its centre is 0), and — the point of the
        // test — the three real lines keep their own reading order behind it.
        let order = texts(&sorted);
        let lines: Vec<&str> = order.into_iter().filter(|t| *t != "degenerate").collect();
        assert_eq!(lines, ["first", "second", "third"]);
    }

    // --- the trait's own contract ----------------------------------------------------------

    #[test]
    fn extracts_known_text_from_a_real_fixture_image() {
        let outcome = extract("hello-umbra.png");

        assert!(
            joined(&outcome).to_uppercase().contains("UMBRA"),
            "expected extracted text to contain \"UMBRA\", got: {:?}",
            joined(&outcome)
        );
        assert!(outcome.has_readable_text());
        assert!(outcome.image_width > 0 && outcome.image_height > 0);
    }

    #[test]
    fn extracts_known_text_from_a_real_fixture_image_via_the_raw_rgba_path() {
        let engine = test_engine();
        let bytes = std::fs::read(fixture_path("hello-umbra.png")).unwrap();
        let decoded = image::load_from_memory(&bytes).unwrap().into_rgba8();
        let (width, height) = decoded.dimensions();

        let outcome = engine
            .extract_text_from_rgba(decoded.as_raw(), width, height)
            .unwrap();

        assert!(
            joined(&outcome).to_uppercase().contains("UMBRA"),
            "expected extracted text to contain \"UMBRA\", got: {:?}",
            joined(&outcome)
        );
        assert!(outcome.has_readable_text());
        assert_eq!((outcome.image_width, outcome.image_height), (width, height));
    }

    #[test]
    fn reports_region_geometry_inside_the_oriented_image_bounds() {
        let outcome = extract("hello-umbra.png");

        assert!(!outcome.regions.is_empty());
        for region in &outcome.regions {
            assert!(
                region.polygon.len() >= 3,
                "a bounding polygon needs at least three points, got {:?}",
                region.polygon
            );
            for point in &region.polygon {
                assert!(
                    point.x >= 0.0 && point.x <= outcome.image_width as f32,
                    "x={} outside 0..={}",
                    point.x,
                    outcome.image_width
                );
                assert!(
                    point.y >= 0.0 && point.y <= outcome.image_height as f32,
                    "y={} outside 0..={}",
                    point.y,
                    outcome.image_height
                );
            }
        }
    }

    #[test]
    fn returns_one_character_polygon_per_character_of_the_recognised_text() {
        // Cut #4 stands: the model's own `word_boxes` carry a correct count with unusable
        // positions. These polygons are measured from the ink instead.
        let outcome = extract("screenshot-error-dialog.png");
        let readable: Vec<_> = outcome
            .regions
            .iter()
            .filter(|r| r.text.is_some())
            .collect();
        assert!(!readable.is_empty());
        for region in readable {
            let text = region.text.as_deref().unwrap();
            assert_eq!(
                region.char_polygons.len(),
                text.chars().count(),
                "character polygons must be index-aligned with the text, for {text:?}"
            );
            for polygon in &region.char_polygons {
                assert!(polygon.len() >= 3);
                for point in polygon {
                    assert!(point.x >= 0.0 && point.x <= outcome.image_width as f32);
                    assert!(point.y >= 0.0 && point.y <= outcome.image_height as f32);
                }
            }
        }
    }

    #[test]
    fn character_polygons_advance_left_to_right_across_a_line() {
        // The property a consumer actually relies on: character n starts no earlier than
        // character n-1, so a substring's extent is the span from its first to its last box.
        let outcome = extract("screenshot-error-dialog.png");
        let region = outcome
            .regions
            .iter()
            .find(|r| r.text.as_deref().is_some_and(|t| t.chars().count() > 12))
            .expect("a long enough region");
        let lefts: Vec<f32> = region
            .char_polygons
            .iter()
            .map(|p| p.iter().fold(f32::MAX, |lo, q| lo.min(q.x)))
            .collect();
        for pair in lefts.windows(2) {
            assert!(
                pair[1] >= pair[0],
                "character boxes went backwards: {lefts:?}"
            );
        }
    }

    #[test]
    fn character_geometry_stays_accurate_however_long_the_line_is() {
        // The defect this guards: the recogniser's own character positions come from CTC
        // timestep fractions, and their error GROWS with position along the line — measured at
        // 86 px on a 40-character line, 166 px at 80 and 322 px (over twenty characters) at
        // 160, against a 15.7 px character. Measuring the ink instead holds at ~3 px, flat.
        //
        // `long-lines.png` renders five monospaced lines of 40/80/120/160/200 characters at a
        // known layout: 15.65 px per character, first character's left edge at x=48.
        const CHAR_WIDTH: f32 = 15.65;
        const FIRST_LEFT: f32 = 48.0;

        let outcome = extract("long-lines.png");
        let measured: Vec<&OcrRegion> = outcome
            .regions
            .iter()
            .filter(|r| !r.char_polygons.is_empty())
            .collect();
        assert!(
            measured.len() >= 4,
            "expected most of the five lines to be measurable, got {}",
            measured.len()
        );

        for region in measured {
            let text = region.text.as_deref().unwrap();
            let mut worst: f32 = 0.0;
            for (index, polygon) in region.char_polygons.iter().enumerate() {
                let left = polygon.iter().fold(f32::MAX, |m, p| m.min(p.x));
                let expected = FIRST_LEFT + CHAR_WIDTH * index as f32;
                worst = worst.max((left - expected).abs());
            }
            assert!(
                worst < CHAR_WIDTH,
                "character positions drifted {worst:.0} px (>{CHAR_WIDTH:.0} px, one character) \
                 on a {}-character line: {text:?}",
                text.chars().count()
            );
        }
    }

    #[test]
    fn declines_to_measure_characters_on_a_photographed_page() {
        // A tilted line cannot be measured from an axis-aligned column profile — the glyphs
        // smear across every column. Returning nothing is the honest answer: the view bands
        // the whole region rather than drawing a precise box in a guessed place.
        let outcome = extract("document-photo.png");

        assert!(outcome.has_readable_text());
        assert!(
            outcome.regions.iter().all(|r| r.char_polygons.is_empty()),
            "a ~3.3 degree tilted page should decline character measurement, not approximate it"
        );
    }

    #[test]
    fn measured_characters_advance_left_to_right_and_stay_inside_their_region() {
        let outcome = extract("screenshot-error-dialog.png");
        let region = outcome
            .regions
            .iter()
            .find(|r| {
                !r.char_polygons.is_empty() && r.text.as_deref().is_some_and(|t| t.len() > 12)
            })
            .expect("a measured region");

        let region_left = region.polygon.iter().fold(f32::MAX, |m, p| m.min(p.x));
        let region_right = region.polygon.iter().fold(f32::MIN, |m, p| m.max(p.x));
        let mut previous = f32::MIN;
        for polygon in &region.char_polygons {
            let left = polygon.iter().fold(f32::MAX, |m, p| m.min(p.x));
            let right = polygon.iter().fold(f32::MIN, |m, p| m.max(p.x));
            assert!(left >= previous - 0.01, "character boxes went backwards");
            assert!(right > left, "a character box must have width");
            assert!(left >= region_left - 0.01 && right <= region_right + 0.01);
            previous = left;
        }
    }

    #[test]
    fn returns_a_tool_error_for_a_malformed_rgba_buffer_length() {
        let engine = test_engine();
        let err = engine
            .extract_text_from_rgba(&[0, 0, 0], 10, 10)
            .unwrap_err();
        assert_eq!(err.code, "ocr-malformed-image-buffer");
    }

    #[test]
    fn returns_a_tool_error_for_zero_width_or_height_without_reaching_the_ocr_engine() {
        let engine = test_engine();
        let err = engine.extract_text_from_rgba(&[], 0, 0).unwrap_err();
        assert_eq!(err.code, "ocr-malformed-image-buffer");
    }

    #[test]
    fn returns_a_tool_error_for_a_mismatched_buffer_near_u32_max_dimensions_without_overflowing() {
        let engine = test_engine();
        let err = engine
            .extract_text_from_rgba(&[0, 0, 0], u32::MAX, u32::MAX)
            .unwrap_err();
        assert_eq!(err.code, "ocr-malformed-image-buffer");
    }

    #[test]
    fn returns_no_text_signal_for_a_blank_image() {
        let engine = test_engine();
        let blank = image::RgbImage::from_pixel(64, 64, image::Rgb([255, 255, 255]));
        let mut bytes: Vec<u8> = Vec::new();
        image::DynamicImage::ImageRgb8(blank)
            .write_to(
                &mut std::io::Cursor::new(&mut bytes),
                image::ImageFormat::Png,
            )
            .unwrap();

        let outcome = engine.extract_text(&bytes).unwrap();

        assert!(!outcome.has_readable_text());
        assert_eq!(joined(&outcome), "");
    }

    #[test]
    fn returns_tool_error_for_undecodable_bytes() {
        let engine = test_engine();
        let err = engine.extract_text(b"not an image").unwrap_err();
        assert_eq!(err.code, "ocr-unsupported-format");
    }

    #[test]
    fn returns_tool_error_not_a_panic_for_a_corrupt_truncated_image() {
        let engine = test_engine();
        let bytes = std::fs::read(fixture_path("hello-umbra.png")).unwrap();
        let truncated = &bytes[..bytes.len() / 2];

        let err = engine.extract_text(truncated).unwrap_err();

        assert_eq!(err.code, "ocr-unsupported-format");
    }

    #[test]
    fn returns_tool_error_not_a_panic_for_a_near_full_length_truncated_image() {
        // A materially different `image`-crate decode path from the half-length case above:
        // the header and most of the data stream survive, so decoding gets much further in
        // before it fails.
        let engine = test_engine();
        let bytes = std::fs::read(fixture_path("hello-umbra.png")).unwrap();
        let truncated = &bytes[..bytes.len() - 8];

        let err = engine.extract_text(truncated).unwrap_err();

        assert_eq!(err.code, "ocr-unsupported-format");
    }

    // --- AC24 / AC25: the two project-authored, translatable sentences ----------------------
    //
    // These assert on OUR prose, deliberately. Everywhere else in this module a test asserts a
    // `code` and never a `message`, precisely so third-party wording can change without
    // breaking us. These two are the inversion of that rule: the whole point of AC24 and AC25
    // is that the sentence is ours and fixed, because `src/shell/toolError.ts` keys a French
    // translation off the code and would otherwise be swapping a French sentence in for an
    // English one it never saw. If someone edits the sentence, the locale files must move with
    // it — that is what these two tests are here to force.

    #[test]
    fn undecodable_bytes_carry_a_project_authored_value_free_sentence() {
        let engine = test_engine();
        let err = engine.extract_text(b"not an image").unwrap_err();

        assert_eq!(err.code, "ocr-unsupported-format");
        assert_eq!(err.message, "That file isn't an image this tool can read.");
    }

    #[test]
    fn rejects_a_pdf_by_magic_bytes_before_attempting_to_decode_it() {
        // A real minimal PDF header plus enough of a body to be recognisable. The bytes after
        // the signature are irrelevant by design: the check runs BEFORE decode, so this never
        // reaches the `image` crate at all.
        let engine = test_engine();
        let pdf = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n";

        let err = engine.extract_text(pdf).unwrap_err();

        assert_eq!(err.code, "ocr-pdf-wrong-tool");
        assert_eq!(err.message, "PDFs open in the PDF tool.");
    }

    #[test]
    fn pdf_detection_is_a_signature_check_not_a_substring_search() {
        // `%PDF-` appearing anywhere other than byte 0 is not a PDF — an image whose pixel
        // data happens to contain those five bytes must still be decoded normally, and an
        // image that merely fails to decode must still read as unsupported-format, not as a
        // misfiled PDF.
        let engine = test_engine();

        let err = engine
            .extract_text(b"not an image, but it mentions %PDF- in passing")
            .unwrap_err();

        assert_eq!(err.code, "ocr-unsupported-format");
    }

    #[test]
    fn a_pdf_reaching_the_rgba_path_is_impossible_so_that_path_is_unguarded() {
        // Documenting the deliberate asymmetry rather than leaving it to be re-derived: the
        // clipboard path takes already-decoded pixels plus dimensions, so there is no
        // container format left to sniff. The guard belongs on the compressed-bytes path only.
        let engine = test_engine();
        let err = engine.extract_text_from_rgba(b"%PDF-", 0, 0).unwrap_err();

        assert_eq!(err.code, "ocr-malformed-image-buffer");
    }

    // --- EXIF orientation -------------------------------------------------------------------

    #[test]
    fn applies_exif_orientation_before_recognition_and_recovers_the_text() {
        // `exif-rotated.jpg` stores its pixels rotated a quarter turn and carries EXIF
        // orientation 6 ("rotate 90 degrees clockwise to display"). Without applying it the
        // detector sees sideways text and recovers little or nothing — which is what this
        // module shipped from Story 4.1 until Story 8.7.
        let outcome = extract("exif-rotated.jpg");

        assert!(
            outcome.has_readable_text(),
            "no text recovered from the EXIF-rotated fixture — orientation was not applied"
        );
        assert_contains_lines(
            &outcome,
            &["Boarding Information", "Seat 14A"],
            "exif-rotated.jpg",
        );
        // The reported dimensions are the ORIENTED ones — the space the polygons live in. The
        // stored JPEG is portrait; applying the quarter turn makes it landscape.
        assert!(
            outcome.image_width > outcome.image_height,
            "expected oriented (landscape) dimensions, got {}x{}",
            outcome.image_width,
            outcome.image_height
        );
    }

    // --- max_text_length ---------------------------------------------------------------------

    #[test]
    fn recovers_a_line_far_longer_than_the_default_max_text_length() {
        // This test lands regardless of its outcome, per the story's own instruction: had a
        // 105-character line come back truncated, that would be a shipping bug worse than the
        // reading-order one. It does not — so the explicit `max_text_length` in
        // `OarOcrEngine::new` is what stops that changing under us. Asserting merely that
        // "something was extracted" would prove nothing here.
        const LONG_LINE: &str = "This is a considerably longer diagnostic line intended to \
             exceed twenty-five characters by a wide margin.";
        assert!(LONG_LINE.len() > 100, "the fixture line must be long");

        let outcome = extract("screenshot-error-dialog.png");

        assert_contains_lines(&outcome, &[LONG_LINE], "screenshot-error-dialog.png");
    }

    // --- the quality regression corpus ---------------------------------------------------------

    #[test]
    fn corpus_retina_error_dialog_recognises_its_content() {
        let outcome = extract("screenshot-error-dialog.png");
        assert_contains_lines(
            &outcome,
            &[
                "Unable to complete the operation",
                "The server returned an unexpected error while syncing",
                "your library. Recent changes have not been uploaded.",
                "NSURLErrorDomain error -1005",
                "Cancel",
                "Try Again",
            ],
            "screenshot-error-dialog.png",
        );
    }

    #[test]
    fn corpus_retina_error_dialog_reads_in_document_order_not_detection_order() {
        // Asserted separately from content so a sort regression is distinguishable from a
        // model one.
        let outcome = extract("screenshot-error-dialog.png");
        assert_order(
            &outcome,
            &[
                "Unable to complete the operation",
                "The server returned an unexpected error while syncing",
                "your library. Recent changes have not been uploaded.",
                "NSURLErrorDomain error -1005",
                "Cancel",
                "Try Again",
            ],
            "screenshot-error-dialog.png",
        );
    }

    #[test]
    fn corpus_retina_error_dialog_bands_the_sidebar_into_the_body_rows() {
        // The specific claim the sort makes about a sidebar: each right-hand entry follows the
        // body line it sits beside, rather than the whole left column being emitted first.
        let outcome = extract("screenshot-error-dialog.png");
        assert_order(
            &outcome,
            &[
                "The server returned an unexpected error while syncing",
                "Status",
                "your library. Recent changes have not been uploaded.",
                "Queue",
            ],
            "screenshot-error-dialog.png",
        );
    }

    #[test]
    fn corpus_document_photo_recognises_its_content() {
        // A photographed page: several degrees of real skew, soft focus, warm cast.
        let outcome = extract("document-photo.png");
        assert_contains_lines(
            &outcome,
            &[
                "Certificate of Completion",
                "Issued to the bearer on the fourteenth day of March,",
                "prescribed course of instruction and assessment.",
                "Verification code 88421-QQ",
            ],
            "document-photo.png",
        );
    }

    #[test]
    fn corpus_document_photo_reads_top_to_bottom_despite_skew() {
        let outcome = extract("document-photo.png");
        assert_order(
            &outcome,
            &[
                "Certificate of Completion",
                "Issued to the bearer on the fourteenth day of March,",
                "in recognition of satisfactory completion of the",
                "prescribed course of instruction and assessment.",
                "Verification code 88421-QQ",
            ],
            "document-photo.png",
        );
    }

    #[test]
    fn corpus_scan_recognises_its_content() {
        let outcome = extract("scan.png");
        assert_contains_lines(
            &outcome,
            &[
                "Account reference 5512-08841-C",
                "Assessment period ending 31 March",
                "Total amount due within thirty days",
            ],
            "scan.png",
        );
    }

    #[test]
    fn corpus_two_column_recognises_both_columns() {
        let outcome = extract("two-column.png");
        assert_contains_lines(
            &outcome,
            &[
                "The northern site reported steady",
                "Sensor drift stayed inside the",
                "Southern coverage was reduced",
                "Costs are itemised overleaf.",
            ],
            "two-column.png",
        );
    }

    #[test]
    fn corpus_two_column_documents_the_sorts_stated_limit_rather_than_hiding_it() {
        // A CHARACTERISATION test, not an aspiration. `sort_into_reading_order` explicitly does
        // not claim to handle a true multi-column spread — reading all of column one before
        // column two needs layout analysis, which is out of scope. What it does instead is band
        // the columns together row by row, so the right column's first line follows the left
        // column's first line. Written down so that if a future change makes columns read
        // properly, this test fails loudly and is UPDATED, rather than the behaviour changing
        // by accident.
        let outcome = extract("two-column.png");
        assert_order(
            &outcome,
            &[
                "The northern site reported steady",
                "Southern coverage was reduced",
                "readings throughout the period.",
                "by weather for eleven days.",
            ],
            "two-column.png",
        );
    }
}
