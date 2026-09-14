//! macOS page rendering via Core Graphics (AC43-AC46).
//!
//! **No new dependency.** `objc2-core-graphics` is already compiled into this tree by Tauri; this
//! backend turns on a few of its features and adds no crate. Core Graphics' PDF API is also the
//! engine behind Preview.app, so a thumbnail rendered here is pixel-identical to what the user
//! sees when they double-click the same file in Finder — which is a fidelity argument for the OS
//! API, not merely a cost one.
//!
//! **No filesystem access.** The document is built from the bytes the command layer already read
//! (`CGDataProvider::with_cf_data`), never from a path — so this module never becomes a second
//! place that opens files, and AD-15's "paths cross IPC, `src-tauri` owns the I/O" stays true.

use objc2_core_foundation::{CFData, CGPoint, CGRect, CGSize};
use objc2_core_graphics::{
    CGBitmapContextCreate, CGColorSpace, CGContext, CGDataProvider, CGImageAlphaInfo,
    CGImageByteOrderInfo, CGPDFBox, CGPDFDocument, CGPDFPage,
};
use umbra_core::ToolError;

use super::{PageRenderer, fit_within_thumbnail, render_error};

pub(crate) struct Backend;

impl PageRenderer for Backend {
    const IS_AVAILABLE: bool = true;

    fn render_page(pdf: &[u8], page_number: u32, max_width: u32) -> Result<Vec<u8>, ToolError> {
        let data = CFData::from_bytes(pdf);
        let provider = CGDataProvider::with_cf_data(Some(&data))
            .ok_or_else(|| render_error("could not read this PDF's bytes for rendering"))?;
        let document = CGPDFDocument::with_provider(Some(&provider))
            .ok_or_else(|| render_error("could not open this PDF for rendering"))?;

        // Core Graphics numbers pages from 1, the same as `lopdf`'s `get_pages()`, so the page
        // number crosses from core to here unchanged. It returns NULL rather than erroring for an
        // out-of-range page — the same silent-no-op shape `delete_pages` has, and handled the
        // same way: turn it into an error rather than let it become a blank frame.
        let page = CGPDFDocument::page(Some(&document), page_number as usize)
            .ok_or_else(|| render_error(format!("page {page_number} does not exist")))?;

        // CropBox, not MediaBox: MediaBox is the physical sheet, CropBox is the region a reader
        // actually displays. Using MediaBox would render the printer's margins into the thumbnail
        // for any document that sets a crop, which is most scanned ones.
        let crop = CGPDFPage::box_rect(Some(&page), CGPDFBox::CropBox);
        // The page's own `/Rotate` is applied by Core Graphics via the drawing transform below;
        // it is read here only to work out which way round the *output* bitmap should be, since a
        // quarter-turn swaps width and height.
        let rotation = CGPDFPage::rotation_angle(Some(&page));
        let quarter_turned = rotation.rem_euclid(360) % 180 != 0;
        let (source_width, source_height) = if quarter_turned {
            (crop.size.height, crop.size.width)
        } else {
            (crop.size.width, crop.size.height)
        };

        // The fit — both axes bounded, aspect kept, non-finite sizes refused — is the shared
        // `fit_within_thumbnail`, so this backend and the Windows one cannot drift on the one
        // invariant that decides whether a sliver page allocates gigabytes. Both results are at
        // most 640 x 10240, so the buffer arithmetic below cannot overflow.
        let (width, height) = fit_within_thumbnail(source_width, source_height, max_width)
            .map_err(|_| render_error(format!("page {page_number} has no drawable area")))?;
        let width = width as usize;
        let height = height as usize;

        // Four bytes per pixel, RGBA. `NoneSkipLast` rather than a premultiplied-alpha format:
        // the canvas is filled opaque white below, so there is no transparency to premultiply,
        // and skipping alpha avoids a colour-correctness trap where premultiplied values would
        // have to be divided back out before PNG encoding.
        let bytes_per_row = width * 4;
        let mut buffer = vec![0u8; bytes_per_row * height];
        let color_space = CGColorSpace::new_device_rgb()
            .ok_or_else(|| render_error("could not create a colour space for rendering"))?;

        let context = unsafe {
            CGBitmapContextCreate(
                buffer.as_mut_ptr().cast(),
                width,
                height,
                8,
                bytes_per_row,
                Some(&color_space),
                // `CGImageByteOrderInfo::OrderDefault`, not `CGBitmapInfo::ByteOrderDefault`:
                // the latter is deprecated upstream in favour of the byte-order enum, and both
                // are the same value — host byte order, which is what the `image` crate expects
                // when it reads the buffer back as RGBA.
                CGImageByteOrderInfo::OrderDefault.0 | CGImageAlphaInfo::NoneSkipLast.0,
            )
        }
        .ok_or_else(|| render_error("could not create a bitmap for rendering"))?;

        let target = CGRect::new(
            CGPoint::new(0.0, 0.0),
            CGSize::new(width as f64, height as f64),
        );

        // A PDF page is transparent where nothing is drawn. Without this fill, a page's white
        // background would come out as whatever the zeroed buffer holds — black — and every
        // thumbnail of an ordinary document would render inverted.
        CGContext::set_rgb_fill_color(Some(&context), 1.0, 1.0, 1.0, 1.0);
        CGContext::fill_rect(Some(&context), target);

        // `drawing_transform` does the fitting AND the page's own rotation in one step. Doing it
        // by hand means reimplementing CropBox-to-target fitting plus a rotation matrix, and
        // getting the flip wrong is the classic upside-down-thumbnail bug — Core Graphics' origin
        // is bottom-left, a PDF page's is top-left.
        let transform =
            CGPDFPage::drawing_transform(Some(&page), CGPDFBox::CropBox, target, 0, true);
        CGContext::concat_ctm(Some(&context), transform);
        CGContext::draw_pdf_page(Some(&context), Some(&page));
        CGContext::flush(Some(&context));

        encode_png(&buffer, width as u32, height as u32)
    }
}

/// Encodes the RGBA buffer as PNG using the `image` crate already in this tree.
///
/// AC45 requires an encoded image across IPC rather than raw RGBA: a 320×450 thumbnail is
/// ~576 KB raw and a small fraction of that as PNG, and the constraint is the *volume* of four
/// hundred of them, not any single one.
fn encode_png(buffer: &[u8], width: u32, height: u32) -> Result<Vec<u8>, ToolError> {
    let image = image::RgbaImage::from_raw(width, height, buffer.to_vec())
        .ok_or_else(|| render_error("rendered bitmap had an unexpected size"))?;

    let mut png = Vec::new();
    image::DynamicImage::ImageRgba8(image)
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|err| render_error(format!("could not encode the page preview: {err}")))?;
    Ok(png)
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::render::fixtures::page_pdf;

    /// The shared one-page fixture (`render::fixtures`), so every platform is held to the same
    /// document rather than each testing whatever was convenient.
    fn one_page_pdf() -> Vec<u8> {
        page_pdf(200, 400)
    }

    /// A page 1pt wide and 14400pt tall — PDF's own maximum dimension — is a legal document and
    /// a 23.6 GB bitmap under a width-only scale, which aborts the process rather than returning
    /// an error. NFR4 does not admit that, and no width clamp catches it, because the width was
    /// already legal. Verified against the old arithmetic before the fix: 640 x 9,216,000.
    #[test]
    fn an_extreme_aspect_ratio_is_bounded_rather_than_allocating_gigabytes() {
        let pdf = page_pdf(1, 14400);

        let png = Backend::render_page(&pdf, 1, crate::render::MAX_THUMBNAIL_WIDTH).unwrap();
        let image = image::load_from_memory(&png).unwrap();

        assert!(
            image.height() <= crate::render::MAX_THUMBNAIL_HEIGHT,
            "height must be bounded, got {}",
            image.height()
        );
        // Bounded by *fitting*, not by cropping or squashing: the sliver stays a sliver.
        assert!(
            image.width() < image.height(),
            "a 1:14400 page must not come back wider than it is tall ({}x{})",
            image.width(),
            image.height()
        );
    }

    #[test]
    fn renders_a_page_to_a_png_at_the_requested_width() {
        let pdf = one_page_pdf();

        let png = Backend::render_page(&pdf, 1, 100).unwrap();

        // A real PNG, not merely a non-empty Vec: the magic number is what proves the encode
        // step ran rather than some other bytes reaching the caller.
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");

        let decoded = image::load_from_memory(&png).unwrap();
        assert_eq!(decoded.width(), 100);
        // The source page is 200x400, so a 100-wide thumbnail is 200 tall. Asserting the derived
        // height is what proves the aspect ratio survived; asserting only the width would pass
        // for a squashed image.
        assert_eq!(decoded.height(), 200);
    }

    #[test]
    fn a_page_number_past_the_end_is_an_error_not_a_blank_image() {
        let pdf = one_page_pdf();

        let err = Backend::render_page(&pdf, 2, 100).unwrap_err();
        assert_eq!(err.code, "pdf-render-unavailable");
    }

    #[test]
    fn undecodable_bytes_are_an_error_not_a_panic() {
        let err = Backend::render_page(b"definitely not a pdf", 1, 100).unwrap_err();
        assert_eq!(err.code, "pdf-render-unavailable");
    }

    #[test]
    fn a_rendered_page_is_not_uniformly_black() {
        // The regression this guards is specific and easy to ship: a PDF page is transparent
        // where nothing is drawn, so without the explicit white fill every thumbnail of an
        // ordinary document comes out inverted against the zeroed buffer. A blank page must
        // render white.
        let pdf = one_page_pdf();

        let png = Backend::render_page(&pdf, 1, 40).unwrap();
        let decoded = image::load_from_memory(&png).unwrap().to_rgba8();

        let centre = decoded.get_pixel(decoded.width() / 2, decoded.height() / 2);
        assert_eq!(
            [centre[0], centre[1], centre[2]],
            [255, 255, 255],
            "a blank page must render white, not black"
        );
    }
}
