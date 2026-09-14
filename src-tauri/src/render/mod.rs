//! Page rendering (AC43-AC47) — the only place in this codebase's *runtime* source that branches
//! on operating system. (`build.rs` has carried `cfg(target_os = "windows")` since Story 4.1 for
//! the Windows resource embed; it is a build script, not shipped code, and AC44 is scoped to
//! runtime source accordingly.)
//!
//! **Why this lives in `src-tauri` and not `umbra-core`.** AD-11 forbids `umbra-core` any
//! `cfg(target_os)` branch at all, and AD-2 forbids it touching platform APIs. `src-tauri` is
//! explicitly allowed OS-specific code — that is what AD-11's three-runner CI matrix exists to
//! police — so the whole renderer lives here and `crates/umbra-core/src/pdf.rs` keeps every
//! structural operation and gains no rasterize function. Structure code never reaches for a
//! renderer, and rendering never reaches for `lopdf`.
//!
//! **Why there is no bundled rasterizer.** Two of the three target platforms ship a PDF renderer
//! in the OS, reachable through crates already in this tree via Tauri:
//!
//! | Platform | Engine | Crate |
//! | --- | --- | --- |
//! | macOS | Core Graphics — the same engine behind Preview.app | `objc2-core-graphics` |
//! | Windows | `Windows.Data.Pdf`, since Windows 8.1 | `windows` |
//! | Linux | none — no OS-level PDF rendering API exists | — |
//!
//! Linux is not an oversight and not a gap to fill later: there is no system PDF API, and its two
//! de-facto libraries are licence-incompatible with this app (Poppler is GPL, MuPDF is AGPL). It
//! takes [`unsupported`], which is the same path a page that fails to render takes on a platform
//! that *does* have a backend — see AC46. The earlier plan bundled `libpdfium` per platform;
//! that was cut before any of it was built, because it cost ~10 MB per platform and a
//! third-party binary in the supply chain to solve a problem two platforms already solve for
//! free. See the story's Group H for the full reasoning.
//!
//! **The `cfg` switch appears exactly once in runtime source — right here.** `commands/pdf.rs`,
//! the view and the core all call this module's platform-blind functions and never mention an
//! operating system.
//! Adding a platform later is one new file plus three lines below.

use umbra_core::ToolError;

#[cfg(target_os = "macos")]
mod mac;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod unsupported;
// Named `win`, not `windows`: a top-level `mod windows` collides with the `windows` CRATE in the
// extern prelude, and every `use windows::…` inside it becomes an ambiguous path.
#[cfg(target_os = "windows")]
mod win;

#[cfg(target_os = "macos")]
use mac::Backend;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
use unsupported::Backend;
#[cfg(target_os = "windows")]
use win::Backend;

/// AC47(a): the contract all three backends satisfy.
///
/// This exists to be a **compile-time conformance check**, which is the one thing platform-split
/// code cannot get for free: a backend that drifts from this shape fails to build on the platform
/// that compiles it, rather than failing at runtime on a machine nobody is watching. It cannot
/// catch drift on a platform you are *not* compiling — that is what AD-11's three-OS CI matrix is
/// for, and why a typo in `win.rs` is invisible while developing on macOS.
pub(crate) trait PageRenderer {
    /// Whether this build can render at all. A `const`, not a runtime probe: it is fixed at
    /// compile time by which backend was selected, and the view needs it as a fact about the
    /// build rather than a question to ask per document.
    const IS_AVAILABLE: bool;

    /// Renders one 1-indexed page to encoded PNG bytes, fitted inside `max_width` while keeping
    /// the page's aspect ratio.
    fn render_page(pdf: &[u8], page_number: u32, max_width: u32) -> Result<Vec<u8>, ToolError>;
}

/// AC45: previews are bounded in size as well as in number. A thumbnail is small, but four
/// hundred of them are not, and AD-15's IPC ceiling cares about the total.
///
/// **Raised from 320 to 640 on 2026-09-11 (AC55).** The view asks for a preview in *device*
/// pixels, not CSS pixels — a 208px-wide cell on a 2x Retina display needs a 416px image to be
/// sharp, and the old ceiling silently clamped that to 320, which is why the largest size step
/// rendered visibly soft. 640 covers the largest cell at a 3x ratio (208 x 3 = 624) with nothing
/// to spare, which is the point: it is a ceiling, not a target.
pub const MAX_THUMBNAIL_WIDTH: u32 = 640;

/// The other half of the ceiling, and it is not redundant with the width cap.
///
/// Scaling to a target *width* leaves the height derived from the page's aspect ratio, which is
/// not bounded by anything: PDF permits a page up to 14400pt on a side, so a 1pt-wide sliver
/// scaled to 640px wide is 9,216,000px tall — a 23.6 GB bitmap, from a file small enough to email.
/// `vec![0u8; …]` aborts the process on that, which NFR4's "never a crash" does not admit, and no
/// width clamp can catch it because the width was already legal.
///
/// A page that would exceed this is scaled to fit the height instead, so it renders narrower and
/// correct rather than squashed or refused — 16:1 is already far past any real document shape.
// `allow(dead_code)` on Linux only: no backend calls this there (`unsupported.rs` never
// renders anything), but the constant stays compiled and tested on every platform below —
// see `fit_within_thumbnail`'s own comment for why that cross-platform testability matters.
#[cfg_attr(not(any(target_os = "macos", target_os = "windows")), allow(dead_code))]
pub const MAX_THUMBNAIL_HEIGHT: u32 = MAX_THUMBNAIL_WIDTH * 16;

/// Fits a page's drawable size inside `max_width` x [`MAX_THUMBNAIL_HEIGHT`], keeping its aspect
/// ratio, and returns the bitmap size to draw at.
///
/// **One function, both backends** (code review 2026-09-13). The first build wrote this fit
/// inline in `mac.rs` and left `win.rs` scaling to width alone — so the 23.6 GB sliver page
/// documented above was bounded on macOS and unbounded on Windows, and nothing on a macOS
/// developer machine could have said so, because `win.rs` is not compiled here. Sharing the
/// arithmetic is what makes the invariant testable on every platform, in this file's tests, for
/// a backend that only CI compiles.
///
/// Rejects — rather than saturates on — a source that is not a positive finite size. A CropBox
/// of two positive subnormals is syntactically legal PDF and passes a `<= 0.0` check, but the
/// scale it produces is `+inf`, and `inf as usize` saturates to `usize::MAX` before the buffer
/// multiply overflows. NFR4 admits neither the panic nor the allocation.
///
/// `allow(dead_code)` on Linux only (found by real CI, 2026-09-14 — this is exactly the
/// `win.rs` risk stated above, just on the platform with no backend at all rather than the
/// wrong one): `mac.rs`/`win.rs` are the only real callers and neither compiles there, but the
/// function itself is deliberately NOT `cfg`-gated to those platforms — doing so would also
/// remove it from Linux's OWN test binary, defeating the entire point of extracting one shared,
/// platform-neutral fit that every platform's `cargo test` can verify.
#[cfg_attr(not(any(target_os = "macos", target_os = "windows")), allow(dead_code))]
pub(crate) fn fit_within_thumbnail(
    source_width: f64,
    source_height: f64,
    max_width: u32,
) -> Result<(u32, u32), ToolError> {
    let drawable = source_width.is_finite()
        && source_height.is_finite()
        && source_width > 0.0
        && source_height > 0.0;
    if !drawable {
        return Err(render_error("page has no drawable area"));
    }

    // Fit to whichever axis binds first. Scaling to width alone leaves the height derived from
    // an aspect ratio PDF does not bound; taking the smaller of the two scales keeps the aspect
    // ratio exactly and bounds both dimensions.
    let scale =
        (f64::from(max_width) / source_width).min(f64::from(MAX_THUMBNAIL_HEIGHT) / source_height);
    if !scale.is_finite() || scale <= 0.0 {
        return Err(render_error("page has no drawable area"));
    }

    // The clamps are belt-and-braces against rounding: a scale of exactly `max / source` can
    // round `source * scale` to `max + 1` in floating point, and `as u32` on a value already
    // known finite and positive is then exact.
    let width = (source_width * scale)
        .round()
        .clamp(1.0, f64::from(MAX_THUMBNAIL_WIDTH)) as u32;
    let height = (source_height * scale)
        .round()
        .clamp(1.0, f64::from(MAX_THUMBNAIL_HEIGHT)) as u32;
    Ok((width, height))
}

/// Whether this build renders page previews (AC17/AC46).
///
/// The view uses this to choose between thumbnail rows and the text-only rows AC21 keeps as the
/// fallback — a decision it must make *before* requesting anything, so it never renders a row of
/// empty frames waiting on images that are never coming.
pub fn is_available() -> bool {
    Backend::IS_AVAILABLE
}

/// Renders one page to PNG, clamped to [`MAX_THUMBNAIL_WIDTH`].
///
/// Returns a `ToolError` rather than panicking on every failure path, including "this build has
/// no renderer" — NFR4 admits no crash and no silently-wrong result, and a blank frame is a
/// silently-wrong result.
pub fn render_page(pdf: &[u8], page_number: u32, max_width: u32) -> Result<Vec<u8>, ToolError> {
    Backend::render_page(pdf, page_number, max_width.clamp(1, MAX_THUMBNAIL_WIDTH))
}

/// The one error this module raises, so the three backends cannot drift in how they report
/// failure. `pdf-render-unavailable` is deliberately distinct from `pdf-corrupt`: a page that
/// cannot be *drawn* is not a document that cannot be *read*, and collapsing them would tell the
/// user their file is broken when it is not.
pub(crate) fn render_error(message: impl std::fmt::Display) -> ToolError {
    ToolError {
        code: "pdf-render-unavailable".to_string(),
        message: message.to_string(),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Platform-neutral: whatever backend is compiled, asking for a page that cannot exist must
    /// be an error rather than a panic or an empty image. On Linux this is the no-renderer path;
    /// on macOS and Windows it is the bad-page-number path. Both are AC46.
    #[test]
    fn rendering_a_nonexistent_page_is_an_error_not_a_panic() {
        let err = render_page(b"not a pdf", 1, 120).unwrap_err();
        assert_eq!(err.code, "pdf-render-unavailable");
    }

    /// AC46: which platforms have a backend, asserted in the one file allowed to know. Every
    /// other file — `commands/pdf.rs` included — asks `is_available()` rather than restating this
    /// table, so there is exactly one place to change when a platform gains or loses a renderer.
    ///
    /// On a Windows runner this also serves as the *only* local proof that `win.rs` compiled at
    /// all, since nothing else in the suite forces it.
    #[test]
    fn availability_matches_the_platform_that_compiled_this_build() {
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        assert!(
            is_available(),
            "macOS and Windows both ship a PDF renderer in the OS"
        );
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        assert!(
            !is_available(),
            "no OS-level PDF renderer exists here, and Poppler/MuPDF are licence-incompatible"
        );
    }

    /// AC45: a caller cannot talk this module into rendering a wall-sized thumbnail, whatever it
    /// asks for. **Asserted through the public entry point on a real render**, decoding the PNG
    /// that comes back — the first version of this test called `u32::clamp` directly and would
    /// have stayed green with the clamp deleted from `render_page` (code review 2026-09-13).
    /// `cfg`-gated to the platforms with a backend rather than skipped at runtime (AC47b); on the
    /// no-renderer build there is no bitmap whose width could be asserted.
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    #[test]
    fn requested_width_is_clamped_to_the_thumbnail_ceiling() {
        let pdf = fixtures::page_pdf(200, 400);

        let png = render_page(&pdf, 1, u32::MAX).unwrap();
        let decoded = image::load_from_memory(&png).unwrap();

        assert_eq!(
            decoded.width(),
            MAX_THUMBNAIL_WIDTH,
            "an absurd request must clamp, not allocate"
        );
        // 200x400 at 640 wide is 1280 tall: the clamp fed the real fit, not a squash.
        assert_eq!(decoded.height(), MAX_THUMBNAIL_WIDTH * 2);
    }

    #[test]
    fn fit_keeps_the_aspect_ratio_when_width_binds() {
        assert_eq!(fit_within_thumbnail(200.0, 400.0, 100).unwrap(), (100, 200));
    }

    /// The sliver page from `MAX_THUMBNAIL_HEIGHT`'s own doc comment, asserted on the shared
    /// arithmetic so the bound holds for the Windows backend too — not only for the one that
    /// happens to compile on the developer's machine.
    #[test]
    fn fit_bounds_the_height_of_an_extreme_aspect_ratio() {
        let (width, height) = fit_within_thumbnail(1.0, 14400.0, MAX_THUMBNAIL_WIDTH).unwrap();
        assert_eq!(height, MAX_THUMBNAIL_HEIGHT);
        assert!(
            width < height,
            "a sliver must stay a sliver ({width}x{height})"
        );
        assert!(width >= 1, "and must never round to nothing");
    }

    #[test]
    fn fit_rejects_a_source_that_is_not_a_positive_finite_size() {
        for (w, h) in [
            (0.0, 400.0),
            (200.0, 0.0),
            (-200.0, 400.0),
            (f64::NAN, 400.0),
            (f64::INFINITY, 400.0),
            // Two positive subnormals: legal syntax, passes `<= 0.0`, and the scale is `+inf`.
            (f64::from_bits(1), f64::from_bits(1)),
        ] {
            let err = fit_within_thumbnail(w, h, MAX_THUMBNAIL_WIDTH).unwrap_err();
            assert_eq!(err.code, "pdf-render-unavailable", "for {w}x{h}");
        }
    }

    #[test]
    fn fit_never_exceeds_either_ceiling() {
        let (width, height) = fit_within_thumbnail(14400.0, 14400.0, u32::MAX).unwrap();
        assert!(width <= MAX_THUMBNAIL_WIDTH * 16 && height <= MAX_THUMBNAIL_HEIGHT);
        let (width, height) = fit_within_thumbnail(14400.0, 1.0, MAX_THUMBNAIL_WIDTH).unwrap();
        assert_eq!((width, height), (MAX_THUMBNAIL_WIDTH, 1));
    }
}

/// Test-only PDF builder shared by this module's tests and the backends', so every platform is
/// held to the same fixture rather than each testing whatever was convenient.
#[cfg(test)]
pub(crate) mod fixtures {
    /// A one-page PDF built by hand, so no checked-in binary fixture is needed — the same
    /// approach `umbra-core`'s own pdf.rs tests use. The page box is an argument so a test can
    /// state the shape it is actually about.
    pub(crate) fn page_pdf(width: i64, height: i64) -> Vec<u8> {
        use lopdf::{Document, Object, dictionary};

        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), width.into(), height.into()],
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
}
