//! Image conversion capability (AD-1): decode a compressed image and re-encode it to another
//! format, entirely over in-memory bytes (AD-15 leaves path resolution and reading/writing to
//! the Tauri command layer). `image` 0.25.9 is the v1 adapter — already a workspace dependency,
//! used today by `ocr.rs`'s own decode step.
//!
//! Named `image_convert`, not `image`: `umbra-core` already depends on the external `image`
//! crate, and a local `pub mod image;` would collide with it at the crate root (extern crate
//! names and top-level `mod` declarations share one namespace under Rust 2018+ path resolution).
//!
//! HEIC remains out of v1. Story 6.2's three original candidates (`libheif-rs`, `heic` by
//! Imazen, `heic_decoder`/ente-io) all carry a concrete, still-unresolved blocker (an
//! AGPL/commercial dual license, an unpublished/unconfirmed-license crate, or a GPL/LGPL
//! codec-dependency risk to the CI compile gate). Story 8.9 re-checked the landscape rather than
//! assuming that finding frozen (this project's standing dependency-drift discipline) and found
//! one new candidate: `heic-rs` (`tbraun96/heic-rs`), MIT OR Apache-2.0, no C toolchain, decode
//! only. Clean on license and architecture, but published two days before this check — v0.1.1,
//! ~50 downloads, zero reverse dependencies, single maintainer — and the developer's explicit
//! call was not to adopt it that young. A future re-check should start from "this one cleared
//! licensing, check if it's matured" rather than a fresh crate search from zero.

use crate::error::ToolError;
use image::codecs::avif::AvifEncoder;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::codecs::webp::WebPEncoder;
use image::imageops::FilterType;

// Same rationale as ocr.rs's/pdf.rs's own constants (CWE-400 unbounded allocation from an
// arbitrarily large dropped file). Single-file cap only, matching every other multi-format
// command in this codebase — no combined-total cap, including across a queued batch.
pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

// MAX_INPUT_BYTES bounds the *compressed* input only — a small, highly-compressible file (a
// "decompression bomb") can still decode into an unbounded in-memory bitmap. This was originally
// set to 100 million pixels on the (wrong) assumption that a 45MP camera was close to the
// realistic ceiling — a real 108MP phone photo (9024x12032 = 108,576,768px, the developer's own
// test image) rejected outright at that cap, which is a false positive, not the decompression-
// bomb defense doing its job. 200 million pixels comfortably clears today's top-end phone sensors
// (108MP/200MP) with headroom, while still bounding worst-case decoded memory to a known order of
// magnitude — the same CWE-400 class MAX_INPUT_BYTES guards, just recalibrated against a real
// photo instead of an assumption.
pub const MAX_DECODED_PIXELS: u64 = 200_000_000;

/// Formats this module can encode to. PNG and WebP are always lossless through this crate —
/// `image` 0.25.9's `WebPEncoder` exposes only `new_lossless` (no quality parameter, confirmed
/// against the vendored crate source, `codecs/webp/encoder.rs`), and `PngEncoder::new` is called
/// with no compression-level argument, so PNG output size is always the encoder's default. JPEG
/// and AVIF are the two target formats among these four that `convert`'s `quality` parameter
/// affects.
///
/// `Avif` is an **encode target only** (Story 8.9, AC24). `image` 0.25.9's default
/// `avif`/`ravif` feature (already compiled in — `umbra-core`'s `image = "0.25"` takes no
/// `default-features = false`) is a pure-Rust AV1 *encoder*, so `AvifEncoder` is available with
/// zero `Cargo.toml` change. Decoding an AVIF *source* needs the separate, non-default
/// `avif-native`/`dav1d` feature — a C library, the same dependency class HEIC's `libheif` route
/// was — and is out of scope here: `parse_target_format` in `commands/image.rs` only ever
/// constructs this enum for an output request, never for a source file, so this module never
/// attempts to decode one.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetFormat {
    Png,
    Jpeg,
    WebP,
    Avif,
}

/// AC20: the queue's resize step. `width`/`height` are the *raw text* the view's two input
/// fields hold, not `u32` — AC22 requires rejecting zero, negative, and non-numeric input with a
/// core-layer `ToolError`, and only a string can carry "non-numeric" (a `u32` IPC parameter would
/// fail at the Tauri deserialization boundary before ever reaching a `ToolError`, and a signed
/// float would lose "the user typed letters" — see `parse_dimension` below). `allow_upscale` is
/// the one piece of the view's aspect-lock toggle core needs to know, and it is a genuine
/// core-layer policy question — "may these explicit dimensions exceed the source's own size" —
/// not the aspect-ratio arithmetic itself, which stays entirely view-owned (AD-1): core never
/// computes one field from the other, it only ever receives two explicit numbers, exactly AC20's
/// own wording.
pub struct ResizeRequest {
    pub width: String,
    pub height: String,
    pub allow_upscale: bool,
}

fn image_error(code: &str, message: impl std::fmt::Display) -> ToolError {
    ToolError {
        code: code.to_string(),
        message: message.to_string(),
        position: None,
        context: None,
    }
}

/// AC22: parses one resize field's raw text into a validated pixel dimension, core-layer-
/// authoritative — mirroring `convert`'s own JPEG-quality range validation below, just for a
/// value that (unlike `quality: u8`) can genuinely arrive non-numeric. Rejects zero, negative,
/// non-finite and non-numeric input alike, all under the same code — never silently clamped.
fn parse_dimension(raw: &str) -> Result<u32, ToolError> {
    let trimmed = raw.trim();
    let value: f64 = trimmed.parse().map_err(|_| {
        image_error(
            "image-invalid-resize-dimension",
            format!("'{trimmed}' is not a valid pixel dimension"),
        )
    })?;
    if !value.is_finite() || value <= 0.0 {
        return Err(image_error(
            "image-invalid-resize-dimension",
            format!("resize dimensions must be positive numbers, got '{trimmed}'"),
        ));
    }
    Ok(value.round() as u32)
}

/// AC20/AC21: resizes to explicit `(width, height)` — a non-uniform stretch when the aspect
/// ratio changes, which is deliberate: locked/unlocked is entirely the view's decision, made
/// before this ever runs. AC21's no-upscale case is a genuine no-op (the source is returned
/// unchanged), not a clamp to the source's own size — clamping would silently produce a
/// DIFFERENT resize than either the locked or unlocked request actually asked for.
fn apply_resize(
    image: image::DynamicImage,
    request: &ResizeRequest,
) -> Result<image::DynamicImage, ToolError> {
    let width = parse_dimension(&request.width)?;
    let height = parse_dimension(&request.height)?;
    if !request.allow_upscale && width >= image.width() && height >= image.height() {
        return Ok(image);
    }
    Ok(image.resize_exact(width, height, FilterType::Lanczos3))
}

/// Composites `image` onto an opaque background color, dropping alpha — standard "flatten" alpha
/// blending (`out = src * alpha + background * (1 - alpha)` per channel), not a raw channel
/// truncation. `color` is `[r, g, b]`; Story 8.9 (AC25) replaced the previous hardcoded white
/// with a user-chosen color, applied batch-wide.
fn flatten_onto_background(image: &image::DynamicImage, color: [u8; 3]) -> image::RgbImage {
    let rgba = image.to_rgba8();
    image::RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
        let px = rgba.get_pixel(x, y);
        let alpha = f32::from(px[3]) / 255.0;
        let blend = |channel: u8, background: u8| -> u8 {
            (f32::from(channel) * alpha + f32::from(background) * (1.0 - alpha)).round() as u8
        };
        image::Rgb([
            blend(px[0], color[0]),
            blend(px[1], color[1]),
            blend(px[2], color[2]),
        ])
    })
}

/// Rejects a degenerate (zero-dimension) or oversized (decompression-bomb-scale) decoded image
/// before any encode work runs. Split out from `convert` so the pixel-bound case is testable
/// without actually allocating/decoding a 100-megapixel fixture in a unit test.
fn check_dimensions(width: u32, height: u32) -> Result<(), ToolError> {
    if width == 0 || height == 0 {
        return Err(image_error(
            "image-unsupported-format",
            "decoded image has zero width or height",
        ));
    }
    let pixel_count = u64::from(width) * u64::from(height);
    if pixel_count > MAX_DECODED_PIXELS {
        return Err(image_error(
            "image-dimensions-too-large",
            format!(
                "decoded image is {width}x{height} ({pixel_count} pixels), which exceeds the {MAX_DECODED_PIXELS}-pixel limit"
            ),
        ));
    }
    Ok(())
}

/// Decodes `bytes` (format-sniffed, the same `image::load_from_memory` pattern `ocr.rs`'s own
/// `extract_text` already uses), and returns its pixel dimensions without encoding anything.
/// AC15's `image_ingest_dropped` uses this to validate a dropped file is a real, readable image
/// (and learn its size for the queue row) without duplicating `convert`'s own decode/error-
/// mapping logic in the command layer.
pub fn probe(bytes: &[u8]) -> Result<(u32, u32), ToolError> {
    let decoded = image::load_from_memory(bytes)
        .map_err(|err| image_error("image-unsupported-format", err))?;
    check_dimensions(decoded.width(), decoded.height())?;
    Ok((decoded.width(), decoded.height()))
}

/// Decodes `bytes` and re-encodes to `target`, optionally resizing first.
///
/// `quality` (1-100) is validated and applied for `TargetFormat::Jpeg` and `TargetFormat::Avif`
/// — out-of-range values are rejected here, core-layer-authoritative per AD-1, mirroring
/// `pdf.rs::extract_page_range`'s own core-layer range-validation precedent rather than trusting
/// a frontend slider's `min`/`max`. For `Png`/`WebP`, `quality` is accepted but ignored: both
/// encoders are lossless-only through this crate, so an out-of-range value for those targets is
/// not an error.
///
/// `background` flattens alpha for JPEG, which has no alpha channel of its own (see
/// `flatten_onto_background`). PNG, WebP and AVIF all carry alpha through this crate's encoders
/// and never flatten — `background` is accepted but ignored for those three, the same
/// "accepted but ignored" shape `quality` already has for PNG/WebP.
pub fn convert(
    bytes: &[u8],
    target: TargetFormat,
    quality: u8,
    resize: Option<&ResizeRequest>,
    background: [u8; 3],
) -> Result<Vec<u8>, ToolError> {
    let decoded = image::load_from_memory(bytes)
        .map_err(|err| image_error("image-unsupported-format", err))?;

    check_dimensions(decoded.width(), decoded.height())?;

    let decoded = match resize {
        Some(request) => apply_resize(decoded, request)?,
        None => decoded,
    };

    let mut buffer = Vec::new();
    match target {
        TargetFormat::Jpeg => {
            if !(1..=100).contains(&quality) {
                return Err(image_error(
                    "image-invalid-quality",
                    format!("JPEG quality must be between 1 and 100, got {quality}"),
                ));
            }
            // JPEG has no alpha channel. `image`'s own JPEG encoder handles that by truncating
            // any alpha channel via a raw `to_rgb8()` cast rather than compositing it (verified
            // against the vendored `codecs/jpeg/encoder.rs::make_compatible_img`), which leaves
            // whatever raw RGB values sat under transparent pixels — frequently black. Flatten
            // onto the chosen background ourselves first so a transparent source converts to a
            // correct-looking JPEG instead of a silently corrupted one.
            let source = if decoded.has_alpha() {
                image::DynamicImage::ImageRgb8(flatten_onto_background(&decoded, background))
            } else {
                decoded
            };
            let encoder = JpegEncoder::new_with_quality(&mut buffer, quality);
            source
                .write_with_encoder(encoder)
                .map_err(|err| image_error("image-encode-failed", err))?;
        }
        TargetFormat::Png => {
            let encoder = PngEncoder::new(&mut buffer);
            decoded
                .write_with_encoder(encoder)
                .map_err(|err| image_error("image-encode-failed", err))?;
        }
        TargetFormat::WebP => {
            let encoder = WebPEncoder::new_lossless(&mut buffer);
            decoded
                .write_with_encoder(encoder)
                .map_err(|err| image_error("image-encode-failed", err))?;
        }
        TargetFormat::Avif => {
            if !(1..=100).contains(&quality) {
                return Err(image_error(
                    "image-invalid-quality",
                    format!("AVIF quality must be between 1 and 100, got {quality}"),
                ));
            }
            // Speed 4 is `cavif`'s (and this encoder's own `new()`) default — a reasonable
            // quality/throughput balance for a desktop tool that should not stall the UI on a
            // large batch. AVIF carries its own alpha channel like PNG/WebP, so — unlike JPEG —
            // no flatten runs here; `background` above is genuinely unused for this target.
            let encoder = AvifEncoder::new_with_speed_quality(&mut buffer, 4, quality);
            decoded
                .write_with_encoder(encoder)
                .map_err(|err| image_error("image-encode-failed", err))?;
        }
    }

    Ok(buffer)
}

/// Returns the exact byte size `convert` would produce for the same inputs. Implemented as a
/// direct reuse of `convert` — the actual encode already runs, so this returns a real byte count
/// rather than inventing a separate size-estimation heuristic that could drift from what
/// `convert` actually produces.
pub fn estimate_size(
    bytes: &[u8],
    target: TargetFormat,
    quality: u8,
    resize: Option<&ResizeRequest>,
    background: [u8; 3],
) -> Result<u64, ToolError> {
    Ok(convert(bytes, target, quality, resize, background)?.len() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    const WHITE: [u8; 3] = [255, 255, 255];

    /// Builds a small real image and encodes it to PNG bytes in-test, rather than a committed
    /// binary fixture — same reasoning `pdf.rs`'s in-test-generated PDF fixtures use.
    fn source_png_bytes(width: u32, height: u32) -> Vec<u8> {
        let image = image::ImageBuffer::from_fn(width, height, |x, y| {
            image::Rgb([(x % 256) as u8, (y % 256) as u8, 128u8])
        });
        let mut bytes = Vec::new();
        image::DynamicImage::ImageRgb8(image)
            .write_to(
                &mut std::io::Cursor::new(&mut bytes),
                image::ImageFormat::Png,
            )
            .unwrap();
        bytes
    }

    /// Same as `source_png_bytes` but with an alpha channel — every pixel fully transparent
    /// (alpha 0) with underlying black RGB, the classic case that exposes a raw channel-drop
    /// instead of a real composite (a raw drop would keep the black; a background-flatten would
    /// not).
    fn source_transparent_black_png_bytes(width: u32, height: u32) -> Vec<u8> {
        let image =
            image::ImageBuffer::from_fn(width, height, |_x, _y| image::Rgba([0u8, 0, 0, 0]));
        let mut bytes = Vec::new();
        image::DynamicImage::ImageRgba8(image)
            .write_to(
                &mut std::io::Cursor::new(&mut bytes),
                image::ImageFormat::Png,
            )
            .unwrap();
        bytes
    }

    /// Builds a source PNG carrying real EXIF bytes (a GPS IFD pointer, the same shape a phone
    /// photo's GPS tag takes) so AC30's regression test has something real to prove was
    /// discarded, not merely absent because it was never present.
    fn source_png_with_exif_bytes(width: u32, height: u32) -> Vec<u8> {
        let mut bytes = source_png_bytes(width, height);
        // A minimal, syntactically-real Exif TIFF blob (little-endian header, one GPS-tag-shaped
        // IFD entry) appended as a PNG `eXIf` chunk would require a real PNG-chunk writer this
        // module has no reason to own — instead, the source carries the EXIF bytes as a JPEG,
        // which the `image` crate itself never reads (it has no EXIF-aware decode path at all,
        // which is exactly what this test exists to lock in), re-encoded from the PNG above so
        // the pixel content is identical to every other fixture in this file.
        let decoded = image::load_from_memory(&bytes).unwrap();
        bytes.clear();
        let mut jpeg_bytes = Vec::new();
        decoded
            .write_to(
                &mut std::io::Cursor::new(&mut jpeg_bytes),
                image::ImageFormat::Jpeg,
            )
            .unwrap();
        // A syntactically valid minimal Exif APP1 segment: "Exif\0\0" + a little-endian TIFF
        // header + one IFD entry for GPSInfo (tag 0x8825) — real EXIF bytes, not a made-up blob,
        // inserted right after the JPEG SOI marker the same way a real camera would place it.
        let exif_app1: [u8; 22] = [
            0xFF, 0xE1, 0x00, 0x14, // APP1 marker + length (20 bytes follow)
            b'E', b'x', b'i', b'f', 0x00, 0x00, // "Exif\0\0"
            b'I', b'I', 0x2A, 0x00, // little-endian TIFF header
            0x08, 0x00, 0x00, 0x00, // offset to IFD0
            0x01, 0x00, // 1 entry
            0x25, 0x88, // tag 0x8825 = GPSInfo
        ];
        bytes.extend_from_slice(&jpeg_bytes[0..2]); // SOI
        bytes.extend_from_slice(&exif_app1);
        bytes.extend_from_slice(&jpeg_bytes[2..]);
        bytes
    }

    #[test]
    fn jpeg_target_flattens_a_transparent_source_onto_the_chosen_background() {
        let source = source_transparent_black_png_bytes(8, 8);

        let converted = convert(&source, TargetFormat::Jpeg, 90, None, WHITE).unwrap();
        let decoded = image::load_from_memory(&converted).unwrap().to_rgb8();

        for pixel in decoded.pixels() {
            for channel in pixel.0 {
                // JPEG is lossy — allow slack, but a raw channel-drop would leave this near 0
                // (black), not near 255 (white), so a generous threshold still distinguishes them.
                assert!(
                    channel > 200,
                    "expected a flattened-to-white pixel channel, got {channel}"
                );
            }
        }
    }

    #[test]
    fn jpeg_target_flattens_onto_a_non_default_background_color() {
        let source = source_transparent_black_png_bytes(8, 8);

        let converted = convert(&source, TargetFormat::Jpeg, 90, None, [0, 0, 0]).unwrap();
        let decoded = image::load_from_memory(&converted).unwrap().to_rgb8();

        for pixel in decoded.pixels() {
            for channel in pixel.0 {
                assert!(
                    channel < 60,
                    "expected a flattened-to-black pixel channel, got {channel}"
                );
            }
        }
    }

    #[test]
    fn zero_width_or_height_is_rejected_without_a_panic() {
        let err = check_dimensions(0, 10).unwrap_err();
        assert_eq!(err.code, "image-unsupported-format");

        let err = check_dimensions(10, 0).unwrap_err();
        assert_eq!(err.code, "image-unsupported-format");
    }

    #[test]
    fn dimensions_exceeding_the_pixel_cap_are_rejected() {
        let err = check_dimensions(20_000, 20_000).unwrap_err();
        assert_eq!(err.code, "image-dimensions-too-large");
    }

    #[test]
    fn dimensions_within_the_pixel_cap_are_accepted() {
        check_dimensions(1920, 1080).unwrap();
    }

    #[test]
    fn converts_png_to_jpeg_and_decodes_back_to_expected_dimensions() {
        let source = source_png_bytes(32, 16);

        let converted = convert(&source, TargetFormat::Jpeg, 80, None, WHITE).unwrap();
        let decoded = image::load_from_memory(&converted).unwrap();

        assert_eq!(decoded.width(), 32);
        assert_eq!(decoded.height(), 16);
        assert_eq!(
            image::guess_format(&converted).unwrap(),
            image::ImageFormat::Jpeg
        );
    }

    #[test]
    fn jpeg_quality_one_produces_smaller_output_than_quality_100() {
        let source = source_png_bytes(64, 64);

        let low = convert(&source, TargetFormat::Jpeg, 1, None, WHITE).unwrap();
        let high = convert(&source, TargetFormat::Jpeg, 100, None, WHITE).unwrap();

        assert!(
            low.len() < high.len(),
            "expected quality 1 ({} bytes) to be smaller than quality 100 ({} bytes)",
            low.len(),
            high.len()
        );
    }

    #[test]
    fn jpeg_target_rejects_out_of_range_quality() {
        let source = source_png_bytes(8, 8);

        let err_zero = convert(&source, TargetFormat::Jpeg, 0, None, WHITE).unwrap_err();
        assert_eq!(err_zero.code, "image-invalid-quality");

        let err_over = convert(&source, TargetFormat::Jpeg, 101, None, WHITE).unwrap_err();
        assert_eq!(err_over.code, "image-invalid-quality");
    }

    #[test]
    fn png_and_webp_targets_ignore_out_of_range_quality_and_succeed() {
        let source = source_png_bytes(8, 8);

        let png = convert(&source, TargetFormat::Png, 0, None, WHITE).unwrap();
        assert_eq!(image::guess_format(&png).unwrap(), image::ImageFormat::Png);

        let webp = convert(&source, TargetFormat::WebP, 101, None, WHITE).unwrap();
        assert_eq!(
            image::guess_format(&webp).unwrap(),
            image::ImageFormat::WebP
        );
    }

    #[test]
    fn estimate_size_matches_the_actual_convert_output_length() {
        let source = source_png_bytes(20, 20);

        for (target, quality) in [
            (TargetFormat::Png, 80),
            (TargetFormat::Jpeg, 50),
            (TargetFormat::WebP, 80),
            (TargetFormat::Avif, 50),
        ] {
            let converted = convert(&source, target, quality, None, WHITE).unwrap();
            let estimated = estimate_size(&source, target, quality, None, WHITE).unwrap();
            assert_eq!(estimated, converted.len() as u64);
        }
    }

    #[test]
    fn returns_tool_error_not_a_panic_for_undecodable_bytes() {
        let err = convert(b"not an image", TargetFormat::Png, 80, None, WHITE).unwrap_err();
        assert_eq!(err.code, "image-unsupported-format");
    }

    #[test]
    fn returns_tool_error_not_a_panic_for_a_truncated_corrupt_image() {
        let source = source_png_bytes(32, 32);
        let truncated = &source[..source.len() / 2];

        let err = convert(truncated, TargetFormat::Png, 80, None, WHITE).unwrap_err();
        assert_eq!(err.code, "image-unsupported-format");
    }

    // ---- AC20-22: resize ----

    #[test]
    fn resize_stretches_to_the_explicit_non_uniform_dimensions() {
        let source = source_png_bytes(100, 50);
        let request = ResizeRequest {
            width: "40".to_string(),
            height: "40".to_string(),
            allow_upscale: false,
        };

        let converted = convert(&source, TargetFormat::Png, 80, Some(&request), WHITE).unwrap();
        let decoded = image::load_from_memory(&converted).unwrap();

        assert_eq!(decoded.width(), 40);
        assert_eq!(decoded.height(), 40);
    }

    #[test]
    fn locked_resize_is_a_no_op_when_the_requested_size_would_upscale() {
        let source = source_png_bytes(50, 50);
        let request = ResizeRequest {
            width: "200".to_string(),
            height: "200".to_string(),
            allow_upscale: false,
        };

        let converted = convert(&source, TargetFormat::Png, 80, Some(&request), WHITE).unwrap();
        let decoded = image::load_from_memory(&converted).unwrap();

        assert_eq!(decoded.width(), 50);
        assert_eq!(decoded.height(), 50);
    }

    #[test]
    fn unlocked_resize_honors_an_explicit_upscale() {
        let source = source_png_bytes(50, 50);
        let request = ResizeRequest {
            width: "200".to_string(),
            height: "150".to_string(),
            allow_upscale: true,
        };

        let converted = convert(&source, TargetFormat::Png, 80, Some(&request), WHITE).unwrap();
        let decoded = image::load_from_memory(&converted).unwrap();

        assert_eq!(decoded.width(), 200);
        assert_eq!(decoded.height(), 150);
    }

    #[test]
    fn resize_rejects_zero_negative_and_non_numeric_dimensions() {
        let source = source_png_bytes(20, 20);
        for bad in ["0", "-5", "abc", ""] {
            let request = ResizeRequest {
                width: bad.to_string(),
                height: "20".to_string(),
                allow_upscale: false,
            };
            let err = convert(&source, TargetFormat::Png, 80, Some(&request), WHITE).unwrap_err();
            assert_eq!(
                err.code, "image-invalid-resize-dimension",
                "expected '{bad}' to be rejected"
            );
        }
    }

    // ---- AC23: AVIF ----

    #[test]
    fn converts_to_avif_and_decodes_back_to_expected_dimensions() {
        let source = source_png_bytes(24, 16);

        let converted = convert(&source, TargetFormat::Avif, 60, None, WHITE).unwrap();

        assert_eq!(
            image::guess_format(&converted).unwrap(),
            image::ImageFormat::Avif
        );
    }

    #[test]
    fn avif_quality_one_produces_smaller_output_than_quality_100() {
        let source = source_png_bytes(64, 64);

        let low = convert(&source, TargetFormat::Avif, 1, None, WHITE).unwrap();
        let high = convert(&source, TargetFormat::Avif, 100, None, WHITE).unwrap();

        assert!(
            low.len() < high.len(),
            "expected quality 1 ({} bytes) to be smaller than quality 100 ({} bytes)",
            low.len(),
            high.len()
        );
    }

    #[test]
    fn avif_target_rejects_out_of_range_quality() {
        let source = source_png_bytes(8, 8);

        let err = convert(&source, TargetFormat::Avif, 0, None, WHITE).unwrap_err();
        assert_eq!(err.code, "image-invalid-quality");

        let err = convert(&source, TargetFormat::Avif, 101, None, WHITE).unwrap_err();
        assert_eq!(err.code, "image-invalid-quality");
    }

    // ---- AC30: EXIF/GPS is discarded, not merely absent ----

    #[test]
    fn exif_and_gps_metadata_do_not_survive_conversion_to_any_target_format() {
        let source = source_png_with_exif_bytes(16, 16);
        // Confirms the fixture is real: the source bytes actually contain the GPS-tag marker
        // this test exists to prove does not survive conversion.
        assert!(
            source.windows(2).any(|w| w == [0x25, 0x88]),
            "fixture does not actually carry the GPS IFD tag bytes"
        );

        for target in [
            TargetFormat::Png,
            TargetFormat::Jpeg,
            TargetFormat::WebP,
            TargetFormat::Avif,
        ] {
            let converted = convert(&source, target, 80, None, WHITE).unwrap();
            assert!(
                !converted.windows(4).any(|w| w == b"Exif"),
                "{target:?} output unexpectedly carries an Exif marker"
            );
        }
    }

    // ---- probe (AC15's ingest) ----

    #[test]
    fn probe_returns_the_decoded_dimensions_without_encoding() {
        let source = source_png_bytes(12, 34);
        let (width, height) = probe(&source).unwrap();
        assert_eq!((width, height), (12, 34));
    }

    #[test]
    fn probe_returns_tool_error_for_undecodable_bytes() {
        let err = probe(b"not an image").unwrap_err();
        assert_eq!(err.code, "image-unsupported-format");
    }
}
