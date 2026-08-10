//! Image conversion capability (AD-1): decode a compressed image and re-encode it to another
//! format, entirely over in-memory bytes (AD-15 leaves path resolution and reading/writing to
//! the Tauri command layer). `image` 0.25.9 is the v1 adapter — already a workspace dependency,
//! used today by `ocr.rs`'s own decode step.
//!
//! Named `image_convert`, not `image`: `umbra-core` already depends on the external `image`
//! crate, and a local `pub mod image;` would collide with it at the crate root (extern crate
//! names and top-level `mod` declarations share one namespace under Rust 2018+ path resolution).
//!
//! HEIC was evaluated for this module (Story 6.2's Task 1) and descoped from v1: every real Rust
//! HEIC crate candidate investigated carries a concrete, currently-unresolved blocker (an
//! AGPL/commercial dual license, an unpublished/unconfirmed-license crate, or a GPL/LGPL
//! codec-dependency risk to the CI compile gate). See the story file's Task 1 for the full
//! verification trail.

use crate::error::ToolError;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::codecs::webp::WebPEncoder;

// Same rationale as ocr.rs's/pdf.rs's own constants (CWE-400 unbounded allocation from an
// arbitrarily large dropped file). Single-file cap only, matching every other multi-format
// command in this codebase — no combined-total cap.
pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

// MAX_INPUT_BYTES bounds the *compressed* input only — a small, highly-compressible file (a
// "decompression bomb") can still decode into an unbounded in-memory bitmap. 100 million pixels
// comfortably covers real photos (a 45MP camera is ~45,000,000 px) while bounding worst-case
// decoded memory to a known order of magnitude, the same CWE-400 class MAX_INPUT_BYTES guards.
pub const MAX_DECODED_PIXELS: u64 = 100_000_000;

/// Formats this module can encode to. PNG and WebP are always lossless through this crate —
/// `image` 0.25.9's `WebPEncoder` exposes only `new_lossless` (no quality parameter, confirmed
/// against the vendored crate source, `codecs/webp/encoder.rs`), and `PngEncoder::new` is called
/// with no compression-level argument, so PNG output size is always the encoder's default. JPEG
/// is the only target format among these three that `convert`'s `quality` parameter affects.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetFormat {
    Png,
    Jpeg,
    WebP,
}

fn image_error(code: &str, message: impl std::fmt::Display) -> ToolError {
    ToolError {
        code: code.to_string(),
        message: message.to_string(),
        position: None,
        context: None,
    }
}

/// Composites `image` onto an opaque white background, dropping alpha — standard "flatten"
/// alpha blending (`out = src * alpha + background * (1 - alpha)` per channel), not a raw
/// channel truncation.
fn flatten_onto_white(image: &image::DynamicImage) -> image::RgbImage {
    let rgba = image.to_rgba8();
    image::RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
        let px = rgba.get_pixel(x, y);
        let alpha = f32::from(px[3]) / 255.0;
        let blend = |channel: u8| -> u8 {
            (f32::from(channel) * alpha + 255.0 * (1.0 - alpha)).round() as u8
        };
        image::Rgb([blend(px[0]), blend(px[1]), blend(px[2])])
    })
}

/// Rejects a degenerate (zero-dimension) or oversized (decompression-bomb-scale) decoded image
/// before any encode work runs. Split out from `convert` so the pixel-bound case is testable
/// without actually allocating/decoding a 100-megapixel fixture in a unit test.
fn check_dimensions(width: u32, height: u32) -> Result<(), ToolError> {
    if width == 0 || height == 0 {
        return Err(image_error(
            "bucket-image-unsupported-format",
            "decoded image has zero width or height",
        ));
    }
    let pixel_count = u64::from(width) * u64::from(height);
    if pixel_count > MAX_DECODED_PIXELS {
        return Err(image_error(
            "bucket-image-dimensions-too-large",
            format!(
                "decoded image is {width}x{height} ({pixel_count} pixels), which exceeds the {MAX_DECODED_PIXELS}-pixel limit"
            ),
        ));
    }
    Ok(())
}

/// Decodes `bytes` (format-sniffed, the same `image::load_from_memory` pattern `ocr.rs`'s own
/// `extract_text` already uses) and re-encodes to `target`.
///
/// `quality` (1-100) is validated and applied only for `TargetFormat::Jpeg` — out-of-range values
/// are rejected here, core-layer-authoritative per AD-1, mirroring `pdf.rs::extract_page_range`'s
/// own core-layer range-validation precedent rather than trusting a frontend slider's `min`/`max`.
/// For `Png`/`WebP`, `quality` is accepted but ignored: both encoders are lossless-only through
/// this crate, so an out-of-range value for those targets is not an error.
pub fn convert(bytes: &[u8], target: TargetFormat, quality: u8) -> Result<Vec<u8>, ToolError> {
    let decoded = image::load_from_memory(bytes)
        .map_err(|err| image_error("bucket-image-unsupported-format", err))?;

    check_dimensions(decoded.width(), decoded.height())?;

    let mut buffer = Vec::new();
    match target {
        TargetFormat::Jpeg => {
            if !(1..=100).contains(&quality) {
                return Err(image_error(
                    "bucket-image-invalid-quality",
                    format!("JPEG quality must be between 1 and 100, got {quality}"),
                ));
            }
            // JPEG has no alpha channel. `image`'s own JPEG encoder handles that by truncating
            // any alpha channel via a raw `to_rgb8()` cast rather than compositing it (verified
            // against the vendored `codecs/jpeg/encoder.rs::make_compatible_img`), which leaves
            // whatever raw RGB values sat under transparent pixels — frequently black. Flatten
            // onto white ourselves first so a transparent source converts to a correct-looking
            // JPEG instead of a silently corrupted one. White matches the flattening default most
            // editors/browsers use; a user-configurable background color is deferred (see the
            // story's Review Findings).
            let source = if decoded.has_alpha() {
                image::DynamicImage::ImageRgb8(flatten_onto_white(&decoded))
            } else {
                decoded
            };
            let encoder = JpegEncoder::new_with_quality(&mut buffer, quality);
            source
                .write_with_encoder(encoder)
                .map_err(|err| image_error("bucket-image-encode-failed", err))?;
        }
        TargetFormat::Png => {
            let encoder = PngEncoder::new(&mut buffer);
            decoded
                .write_with_encoder(encoder)
                .map_err(|err| image_error("bucket-image-encode-failed", err))?;
        }
        TargetFormat::WebP => {
            let encoder = WebPEncoder::new_lossless(&mut buffer);
            decoded
                .write_with_encoder(encoder)
                .map_err(|err| image_error("bucket-image-encode-failed", err))?;
        }
    }

    Ok(buffer)
}

/// Returns the exact byte size `convert` would produce for the same inputs. Implemented as a
/// direct reuse of `convert` — the actual encode already runs, so this returns a real byte count
/// rather than inventing a separate size-estimation heuristic that could drift from what
/// `convert` actually produces.
pub fn estimate_size(bytes: &[u8], target: TargetFormat, quality: u8) -> Result<u64, ToolError> {
    Ok(convert(bytes, target, quality)?.len() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

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
    /// instead of a real composite (a raw drop would keep the black; a white-flatten would not).
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

    #[test]
    fn jpeg_target_flattens_a_transparent_source_onto_white_not_the_hidden_rgb_value() {
        let source = source_transparent_black_png_bytes(8, 8);

        let converted = convert(&source, TargetFormat::Jpeg, 90).unwrap();
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
    fn zero_width_or_height_is_rejected_without_a_panic() {
        let err = check_dimensions(0, 10).unwrap_err();
        assert_eq!(err.code, "bucket-image-unsupported-format");

        let err = check_dimensions(10, 0).unwrap_err();
        assert_eq!(err.code, "bucket-image-unsupported-format");
    }

    #[test]
    fn dimensions_exceeding_the_pixel_cap_are_rejected() {
        let err = check_dimensions(20_000, 20_000).unwrap_err();
        assert_eq!(err.code, "bucket-image-dimensions-too-large");
    }

    #[test]
    fn dimensions_within_the_pixel_cap_are_accepted() {
        check_dimensions(1920, 1080).unwrap();
    }

    #[test]
    fn converts_png_to_jpeg_and_decodes_back_to_expected_dimensions() {
        let source = source_png_bytes(32, 16);

        let converted = convert(&source, TargetFormat::Jpeg, 80).unwrap();
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

        let low = convert(&source, TargetFormat::Jpeg, 1).unwrap();
        let high = convert(&source, TargetFormat::Jpeg, 100).unwrap();

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

        let err_zero = convert(&source, TargetFormat::Jpeg, 0).unwrap_err();
        assert_eq!(err_zero.code, "bucket-image-invalid-quality");

        let err_over = convert(&source, TargetFormat::Jpeg, 101).unwrap_err();
        assert_eq!(err_over.code, "bucket-image-invalid-quality");
    }

    #[test]
    fn png_and_webp_targets_ignore_out_of_range_quality_and_succeed() {
        let source = source_png_bytes(8, 8);

        let png = convert(&source, TargetFormat::Png, 0).unwrap();
        assert_eq!(image::guess_format(&png).unwrap(), image::ImageFormat::Png);

        let webp = convert(&source, TargetFormat::WebP, 101).unwrap();
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
        ] {
            let converted = convert(&source, target, quality).unwrap();
            let estimated = estimate_size(&source, target, quality).unwrap();
            assert_eq!(estimated, converted.len() as u64);
        }
    }

    #[test]
    fn returns_tool_error_not_a_panic_for_undecodable_bytes() {
        let err = convert(b"not an image", TargetFormat::Png, 80).unwrap_err();
        assert_eq!(err.code, "bucket-image-unsupported-format");
    }

    #[test]
    fn returns_tool_error_not_a_panic_for_a_truncated_corrupt_image() {
        let source = source_png_bytes(32, 32);
        let truncated = &source[..source.len() / 2];

        let err = convert(truncated, TargetFormat::Png, 80).unwrap_err();
        assert_eq!(err.code, "bucket-image-unsupported-format");
    }
}
