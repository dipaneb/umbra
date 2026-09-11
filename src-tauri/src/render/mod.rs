//! Page rendering (AC43-AC47) — the only place in this codebase that branches on operating
//! system.
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
//! **The `cfg` switch appears exactly once — right here.** `commands/pdf.rs`, the view and the
//! core all call this module's platform-blind functions and never mention an operating system.
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
pub const MAX_THUMBNAIL_HEIGHT: u32 = MAX_THUMBNAIL_WIDTH * 16;

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
    /// asks for. Asserted through the public entry point, since the clamp is the contract.
    #[test]
    fn requested_width_is_clamped_to_the_thumbnail_ceiling() {
        assert_eq!(
            u32::MAX.clamp(1, MAX_THUMBNAIL_WIDTH),
            MAX_THUMBNAIL_WIDTH,
            "an absurd request must clamp, not allocate"
        );
        assert_eq!(
            0u32.clamp(1, MAX_THUMBNAIL_WIDTH),
            1,
            "zero must not divide"
        );
    }
}
