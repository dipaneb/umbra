//! OCR capability (AD-8): image bytes in, recognized text + confidence out — either compressed
//! bytes (`extract_text`, format-sniffed) or already-decoded raw RGBA pixels plus dimensions
//! (`extract_text_from_rgba`, Story 4.2 — clipboard-pasted images arrive already-decoded, with
//! no compressed-bytes accessor). Named after the capability, not the Bucket tool, so a future
//! structured-extraction feature (FR29) can reuse or extend this trait shape without a rename.
//!
//! `oar-ocr` is the v1 adapter behind [`OcrEngine`] — callers, commands, and UI depend on the
//! trait only and never import `oar-ocr` directly.

use crate::error::ToolError;
use oar_ocr::oarocr::OAROCRBuilder;
use std::path::PathBuf;

// Same rationale as base64.rs/hash.rs's own MAX_INPUT_BYTES (CWE-400 unbounded allocation from
// an arbitrarily large dropped file). Each tool module owns its own constant rather than
// sharing another module's, per hash.rs's existing convention. `pub` so src-tauri's command
// layer can reuse it for the file-size guard instead of duplicating the value.
pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

/// Result of running OCR over one image.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct OcrOutcome {
    /// All detected text regions concatenated in the order the model returns them, one per
    /// line. Empty when no text was detected — that's a legitimate "no text found" outcome,
    /// not an error (surfaced explicitly by Story 4.3, not this one).
    pub text: String,
    /// Mean confidence across regions that had a confidence score. `None` when zero regions
    /// were found, doubling as this trait's "no text" signal.
    pub confidence: Option<f32>,
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
        let inner = OAROCRBuilder::new(
            text_detection_model_path,
            text_recognition_model_path,
            character_dict_path,
        )
        .build()
        .map_err(|err| ocr_error("bucket-engine-init-failed", err))?;
        Ok(Self { inner })
    }
}

impl OarOcrEngine {
    fn run_ocr(&self, image: image::RgbImage) -> Result<OcrOutcome, ToolError> {
        let mut results = self
            .inner
            .predict(vec![image])
            .map_err(|err| ocr_error("bucket-ocr-failed", err))?;

        let result = results
            .pop()
            .ok_or_else(|| ocr_error("bucket-ocr-failed", "OCR engine returned no result"))?;

        let mut lines = Vec::new();
        let mut confidences = Vec::new();
        for region in &result.text_regions {
            if let Some(text) = &region.text {
                lines.push(text.to_string());
            }
            if let Some(confidence) = region.confidence {
                confidences.push(confidence);
            }
        }

        let confidence = if confidences.is_empty() {
            None
        } else {
            Some(confidences.iter().sum::<f32>() / confidences.len() as f32)
        };

        Ok(OcrOutcome {
            text: lines.join("\n"),
            confidence,
        })
    }
}

impl OcrEngine for OarOcrEngine {
    fn extract_text(&self, image_bytes: &[u8]) -> Result<OcrOutcome, ToolError> {
        let image = image::load_from_memory(image_bytes)
            .map_err(|err| ocr_error("bucket-unsupported-format", err))?
            .into_rgb8();
        self.run_ocr(image)
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
        let rgba_image = image::RgbaImage::from_raw(width, height, rgba.to_vec()).ok_or_else(|| {
            ocr_error(
                "bucket-malformed-image-buffer",
                format!(
                    "RGBA buffer is {} bytes, which does not match {width}x{height}x4 = {} bytes",
                    rgba.len(),
                    width as u64 * height as u64 * 4
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

    #[test]
    fn extracts_known_text_from_a_real_fixture_image() {
        let engine = test_engine();
        let bytes = std::fs::read(fixture_path("hello-umbra.png")).unwrap();

        let outcome = engine.extract_text(&bytes).unwrap();

        assert!(
            outcome.text.to_uppercase().contains("UMBRA"),
            "expected extracted text to contain \"UMBRA\", got: {:?}",
            outcome.text
        );
        assert!(outcome.confidence.is_some());
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
            outcome.text.to_uppercase().contains("UMBRA"),
            "expected extracted text to contain \"UMBRA\", got: {:?}",
            outcome.text
        );
        assert!(outcome.confidence.is_some());
    }

    #[test]
    fn returns_a_tool_error_for_a_malformed_rgba_buffer_length() {
        let engine = test_engine();
        let err = engine
            .extract_text_from_rgba(&[0, 0, 0], 10, 10)
            .unwrap_err();
        assert_eq!(err.code, "bucket-malformed-image-buffer");
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

        assert_eq!(outcome.text, "");
        assert_eq!(outcome.confidence, None);
    }

    #[test]
    fn returns_tool_error_for_undecodable_bytes() {
        let engine = test_engine();
        let err = engine.extract_text(b"not an image").unwrap_err();
        assert_eq!(err.code, "bucket-unsupported-format");
    }
}
