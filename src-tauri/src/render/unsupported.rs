//! The no-renderer backend (AC46).
//!
//! **This is the *no-renderer* path, not the *Linux* path**, and the distinction is normative
//! rather than pedantic. Linux compiles this backend because no OS-level PDF rendering API exists
//! there and both de-facto libraries are licence-incompatible (Poppler GPL, MuPDF AGPL). But the
//! *behaviour* it defines — say so honestly, fall back to the text-derived page list, never a
//! crash and never a blank frame — is the same behaviour macOS and Windows fall into whenever an
//! individual page fails to draw.
//!
//! Framing it that way is what keeps this code alive: the *contract* it implements — an error
//! from `render::render_page`, never a panic and never an empty image — is what `mod.rs`'s
//! shared tests assert on every platform. This module's own body is compiled and run only where
//! it is the selected backend (the Linux CI runner); on macOS and Windows those same tests
//! exercise their backend's error path instead. One contract, three implementations, one test.

use umbra_core::ToolError;

use super::{PageRenderer, render_error};

pub(crate) struct Backend;

impl PageRenderer for Backend {
    const IS_AVAILABLE: bool = false;

    fn render_page(_pdf: &[u8], _page_number: u32, _max_width: u32) -> Result<Vec<u8>, ToolError> {
        // An error, not an empty `Vec`. An empty image would reach the view as a successfully
        // rendered blank thumbnail, which is exactly the silently-wrong result NFR4 forbids —
        // and the view would have no way to tell it apart from a genuinely blank page.
        Err(render_error(
            "this build has no PDF page renderer; page previews are unavailable",
        ))
    }
}
