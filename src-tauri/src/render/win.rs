//! Windows page rendering via `Windows.Data.Pdf` (AC43-AC46).
//!
//! **No new dependency.** The `windows` crate is already in `Cargo.lock` via Tauri; this backend
//! turns on the `Data_Pdf`, `Foundation` and `Storage_Streams` features and adds no crate.
//! `Windows.Data.Pdf` has shipped in the OS since Windows 8.1.
//!
//! **Named `win.rs`, not `windows.rs`, on purpose.** A top-level `mod windows` collides with the
//! `windows` crate in the extern prelude, and every `use windows::…` below would become an
//! ambiguous path.
//!
//! ## This file is not compiled on macOS or Linux, and that is the risk it carries
//!
//! `#[cfg]`-excluded code is not type-checked — a typo here is completely invisible while
//! developing on macOS, with no warning of any kind. **AD-11's three-runner CI matrix is the only
//! thing that checks this file**, which is precisely why that matrix exists and why dropping the
//! Windows runner would be a bad trade. Treat a green local build as saying nothing whatsoever
//! about this module.
//!
//! ## Why this is more code than the macOS backend
//!
//! Core Graphics hands back a bitmap synchronously. `Windows.Data.Pdf` is WinRT: loading and
//! rendering are both `IAsyncOperation`s, and both ends speak `IRandomAccessStream` rather than
//! byte slices. So the shape is: bytes -> in-memory stream -> `PdfDocument` -> render a page into
//! a second in-memory stream -> read that stream back to bytes. `.get()` blocks on each async
//! operation, which is correct here because the whole call already runs on `spawn_blocking`
//! (AD-4) and never on the UI thread.

use umbra_core::ToolError;
use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
use windows::Storage::Streams::{DataReader, DataWriter, InMemoryRandomAccessStream};

use super::{PageRenderer, render_error};

pub(crate) struct Backend;

/// Every WinRT call returns `windows::core::Error`; funnel them all through one conversion so the
/// backend cannot drift in how it reports failure.
fn win_err(context: &str) -> impl Fn(windows::core::Error) -> ToolError + '_ {
    move |err| render_error(format!("{context}: {err}"))
}

impl PageRenderer for Backend {
    const IS_AVAILABLE: bool = true;

    fn render_page(pdf: &[u8], page_number: u32, max_width: u32) -> Result<Vec<u8>, ToolError> {
        let source =
            InMemoryRandomAccessStream::new().map_err(win_err("could not open a stream"))?;

        {
            let writer = DataWriter::CreateDataWriter(
                &source
                    .GetOutputStreamAt(0)
                    .map_err(win_err("could not open the stream for writing"))?,
            )
            .map_err(win_err("could not create a stream writer"))?;
            writer
                .WriteBytes(pdf)
                .map_err(win_err("could not write the PDF into memory"))?;
            writer
                .StoreAsync()
                .map_err(win_err("could not flush the PDF into memory"))?
                .get()
                .map_err(win_err("could not flush the PDF into memory"))?;
            // Detach before drop: a `DataWriter` closes the stream it wraps when it is dropped,
            // which would leave `LoadFromStreamAsync` below reading from a closed stream.
            let _ = writer.DetachStream();
        }

        let document = PdfDocument::LoadFromStreamAsync(&source)
            .map_err(win_err("could not open this PDF for rendering"))?
            .get()
            .map_err(win_err("could not open this PDF for rendering"))?;

        // WinRT indexes pages from 0; every other layer in this app is 1-indexed, matching
        // `lopdf`'s `get_pages()`. The conversion happens here, once, at the boundary.
        let count = document
            .PageCount()
            .map_err(win_err("could not count this PDF's pages"))?;
        if page_number == 0 || page_number > count {
            return Err(render_error(format!("page {page_number} does not exist")));
        }
        let page = document
            .GetPage(page_number - 1)
            .map_err(win_err("could not open that page"))?;

        let options =
            PdfPageRenderOptions::new().map_err(win_err("could not set up page rendering"))?;
        // Width only. Setting both would stretch the page to fit a box; setting one lets the API
        // derive the other from the page's own aspect ratio, which is what the macOS backend's
        // `drawing_transform` does with `preserve_aspect_ratio: true`.
        options
            .SetDestinationWidth(max_width)
            .map_err(win_err("could not set the preview width"))?;

        let target =
            InMemoryRandomAccessStream::new().map_err(win_err("could not open a stream"))?;
        page.RenderWithOptionsAsync(&target, &options)
            .map_err(win_err("could not render that page"))?
            .get()
            .map_err(win_err("could not render that page"))?;

        // `Windows.Data.Pdf` writes PNG by default, which is the format AC45 wants across IPC —
        // so unlike the macOS path there is no separate encode step.
        let size = target
            .Size()
            .map_err(win_err("could not measure the rendered page"))?;
        let size = u32::try_from(size)
            .map_err(|_| render_error("the rendered page was implausibly large"))?;

        let reader = DataReader::CreateDataReader(
            &target
                .GetInputStreamAt(0)
                .map_err(win_err("could not read the rendered page"))?,
        )
        .map_err(win_err("could not read the rendered page"))?;
        reader
            .LoadAsync(size)
            .map_err(win_err("could not read the rendered page"))?
            .get()
            .map_err(win_err("could not read the rendered page"))?;

        let mut png = vec![0u8; size as usize];
        reader
            .ReadBytes(&mut png)
            .map_err(win_err("could not read the rendered page"))?;
        Ok(png)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The same one-page fixture the macOS backend builds, so both platforms are held to the same
    /// assertion rather than each testing whatever was convenient.
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
        let png = Backend::render_page(&one_page_pdf(), 1, 100).unwrap();

        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
        let decoded = image::load_from_memory(&png).unwrap();
        assert_eq!(decoded.width(), 100);
        // 200x400 source at 100 wide is 200 tall — asserting the derived height is what proves
        // the aspect ratio survived.
        assert_eq!(decoded.height(), 200);
    }

    #[test]
    fn a_page_number_past_the_end_is_an_error_not_a_blank_image() {
        let err = Backend::render_page(&one_page_pdf(), 2, 100).unwrap_err();
        assert_eq!(err.code, "pdf-render-unavailable");
    }

    #[test]
    fn page_zero_is_an_error_rather_than_wrapping_to_the_last_page() {
        // WinRT is 0-indexed and this app is 1-indexed, so page 0 is the one input that could
        // silently become "the first page" if the boundary conversion were written carelessly.
        let err = Backend::render_page(&one_page_pdf(), 0, 100).unwrap_err();
        assert_eq!(err.code, "pdf-render-unavailable");
    }

    #[test]
    fn undecodable_bytes_are_an_error_not_a_panic() {
        let err = Backend::render_page(b"definitely not a pdf", 1, 100).unwrap_err();
        assert_eq!(err.code, "pdf-render-unavailable");
    }
}
