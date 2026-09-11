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

use super::{PageRenderer, render_error};

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

        if source_width <= 0.0 || source_height <= 0.0 {
            return Err(render_error(format!(
                "page {page_number} has no drawable area"
            )));
        }

        let scale = f64::from(max_width) / source_width;
        let width = max_width.max(1) as usize;
        let height = ((source_height * scale).round() as usize).max(1);

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

    /// A one-page PDF built by hand, so the test needs no checked-in binary fixture — the same
    /// approach `umbra-core`'s own pdf.rs tests use.
    fn one_page_pdf() -> Vec<u8> {
        use lopdf::{Document, Object, dictionary};

        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 200.into(), 400.into()],
        });
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![page_id.into()],
                "Count" => 1_u32,
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);

        let mut bytes = Vec::new();
        doc.save_to(&mut bytes).unwrap();
        bytes
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
