//! PDF capability (AD-1/AD-3): merge, page-range extraction, and text extraction over in-memory
//! bytes only — no filesystem access here (AD-2/AD-15 leave path resolution and reading/writing
//! to the Tauri command layer). `lopdf` is the v1 adapter; see `ARCHITECTURE-SPINE.md`'s Stack
//! table for the version/license/API verification trail this module's implementation follows.

use crate::error::ToolError;
use lopdf::{Dictionary, Document, Object, ObjectId};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

// Same rationale as ocr.rs's/hash.rs's own constants (CWE-400 unbounded allocation from an
// arbitrarily large dropped file). Each input file is capped individually; there is no
// combined-total cap across merge inputs, matching every other multi-file-capable command in
// this codebase.
pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

fn pdf_error(code: &str, message: impl std::fmt::Display) -> ToolError {
    ToolError {
        code: code.to_string(),
        message: message.to_string(),
        position: None,
        context: None,
    }
}

/// AC14: the two codes whose messages used to bake runtime values into their prose
/// (`"got {n}"`, `"page range {s}-{e} is invalid for a {n}-page document"`) instead carry those
/// values HERE, so the sentence itself is fixed and value-free — which is exactly Story 8.6's
/// criterion for a code being eligible for `TRANSLATABLE_CODES` (AC38). Without this, a French
/// user reads English for these two, because there is nothing a translated string could
/// interpolate.
///
/// `ToolError::context` is `Option<String>` and AD-3 makes that shape binding for every tool, so
/// the values are JSON-encoded into it rather than widening the shared contract for one tool.
/// `toolErrorMessage()` parses this and passes it to `t()` as params (AC38's slice).
fn pdf_error_with_context(
    code: &str,
    message: impl std::fmt::Display,
    context: serde_json::Value,
) -> ToolError {
    ToolError {
        code: code.to_string(),
        message: message.to_string(),
        position: None,
        context: Some(context.to_string()),
    }
}

/// AC10: what a document's text layer actually is. Core-owned and returned as one of exactly
/// three states, because the view must not re-derive this — it is the same judgement the honest
/// scan message depends on (AC40), and "no text found" is true and useless for a scan whose text
/// is visibly present as pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextLayer {
    /// The document has pages, at least one of them is readable, and not one readable page
    /// yields non-whitespace text. A scan.
    Scanned,
    /// At least one page yields text — **or no page could be read at all.** The second case is
    /// deliberate (code review 2026-09-13): a document whose fonts `lopdf` cannot decode is not a
    /// scan, and AC40's "This PDF is a scan" sentence would be a false claim about it. The
    /// text-only rows are the honest answer when the evidence is missing rather than negative.
    Partial,
    /// The document has no pages at all. Distinct from `Scanned`: nothing to read versus
    /// nothing readable.
    Empty,
}

/// AC9: one entry per page, always — a page that cannot be read is reported as a page that
/// cannot be read, never as a failure of the whole document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PageText {
    /// 1-indexed, matching `Document::get_pages()`'s own numbering.
    pub page: u32,
    /// `None` when every text chunk on this page failed to decode. The page still appears in
    /// the list; the view degrades that one row rather than the document.
    pub text: Option<String>,
}

/// Loads a PDF from bytes and rejects a still-encrypted result explicitly, rather than letting a
/// later operation (get_pages/extract_text/delete_pages/save) fail confusingly against
/// undecrypted content. `Document::load_mem` always attempts an empty-password decryption
/// automatically; for a real, non-empty password it returns `Ok(Document)` with
/// `is_encrypted() == true` and `encryption_state == None` rather than an `Err` — confirmed
/// against the vendored source (`reader.rs`'s `authenticate_and_setup_encryption`), not assumed
/// from the crate's README example alone.
fn load_document(bytes: &[u8]) -> Result<Document, ToolError> {
    let doc = Document::load_mem(bytes).map_err(|err| pdf_error("pdf-corrupt", err))?;
    if doc.is_encrypted() && doc.encryption_state.is_none() {
        return Err(pdf_error(
            "pdf-encrypted",
            "PDF is encrypted with a password and cannot be processed",
        ));
    }
    Ok(doc)
}

fn save_document(mut doc: Document) -> Result<Vec<u8>, ToolError> {
    let mut buffer = Vec::new();
    doc.save_to(&mut buffer)
        .map_err(|err| pdf_error("pdf-corrupt", err))?;
    Ok(buffer)
}

/// Merges PDFs in the given order (the caller/command layer determines "chosen order" — this
/// function just preserves it). Follows `lopdf`'s own documented merge pattern: renumber each
/// input document's objects into a disjoint ID range, then reconcile a single Catalog/Pages
/// structure from all inputs' object graphs.
pub fn merge_documents(inputs: Vec<Vec<u8>>) -> Result<Vec<u8>, ToolError> {
    if inputs.len() < 2 {
        return Err(pdf_error_with_context(
            "pdf-too-few-files",
            "merge requires at least 2 PDFs",
            serde_json::json!({ "count": inputs.len() }),
        ));
    }

    let mut max_id = 1u32;
    // Keyed by ObjectId, not a plain Vec: each input document's IDs are renumbered into a
    // strictly higher range than the previous one below, so BTreeMap's ascending key order
    // preserves `inputs`' original order without needing a separate index.
    let mut documents_pages: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut documents_objects: BTreeMap<ObjectId, Object> = BTreeMap::new();

    for bytes in inputs {
        let mut doc = load_document(&bytes)?;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        for (_, object_id) in doc.get_pages() {
            let object = doc
                .get_object(object_id)
                .map_err(|err| pdf_error("pdf-corrupt", err))?
                .to_owned();
            documents_pages.insert(object_id, object);
        }
        documents_objects.extend(doc.objects);
    }

    let mut document = Document::with_version("1.5");
    let mut catalog_object: Option<(ObjectId, Object)> = None;
    let mut pages_object: Option<(ObjectId, Object)> = None;

    for (object_id, object) in documents_objects.iter() {
        match object.type_name().unwrap_or(b"") {
            b"Catalog" => {
                catalog_object = Some((
                    catalog_object.map(|(id, _)| id).unwrap_or(*object_id),
                    object.clone(),
                ));
            }
            b"Pages" => {
                if let Ok(dictionary) = object.as_dict() {
                    let mut dictionary = dictionary.clone();
                    if let Some((_, ref old_object)) = pages_object
                        && let Ok(old_dictionary) = old_object.as_dict()
                    {
                        dictionary.extend(old_dictionary);
                    }
                    pages_object = Some((
                        pages_object
                            .as_ref()
                            .map(|(id, _)| *id)
                            .unwrap_or(*object_id),
                        Object::Dictionary(dictionary),
                    ));
                }
            }
            // "Page" objects are collected separately (documents_pages) and reattached below;
            // "Outlines"/"Outline" are dropped — bookmark merging is out of this story's scope.
            b"Page" | b"Outlines" | b"Outline" => {}
            _ => {
                document.objects.insert(*object_id, object.clone());
            }
        }
    }

    let (pages_id, pages_object) = pages_object
        .ok_or_else(|| pdf_error("pdf-corrupt", "one or more input PDFs has no Pages root"))?;
    let (catalog_id, catalog_object) = catalog_object
        .ok_or_else(|| pdf_error("pdf-corrupt", "one or more input PDFs has no Catalog root"))?;

    for (object_id, object) in documents_pages.iter() {
        if let Ok(dictionary) = object.as_dict() {
            let mut dictionary = dictionary.clone();
            dictionary.set("Parent", pages_id);
            document
                .objects
                .insert(*object_id, Object::Dictionary(dictionary));
        }
    }

    if let Ok(dictionary) = pages_object.as_dict() {
        let mut dictionary = dictionary.clone();
        dictionary.set("Count", documents_pages.len() as u32);
        dictionary.set(
            "Kids",
            documents_pages
                .keys()
                .map(|id| Object::Reference(*id))
                .collect::<Vec<_>>(),
        );
        document
            .objects
            .insert(pages_id, Object::Dictionary(dictionary));
    }

    if let Ok(dictionary) = catalog_object.as_dict() {
        let mut dictionary = dictionary.clone();
        dictionary.set("Pages", pages_id);
        dictionary.remove(b"Outlines");
        document
            .objects
            .insert(catalog_id, Object::Dictionary(dictionary));
    }

    document.trailer.set("Root", catalog_id);
    document.max_id = document.objects.len() as u32;
    document.renumber_objects();
    document.adjust_zero_pages();

    save_document(document)
}

/// Produces a new PDF containing exactly pages `start_page..=end_page` (1-indexed, inclusive,
/// matching `Document::get_pages()`'s own numbering). This validation is authoritative here in
/// core, not just a frontend nicety (AD-1) — `Document::delete_pages` silently no-ops on
/// out-of-range page numbers rather than erroring, confirmed against the vendored source, so an
/// out-of-bounds request would otherwise silently produce a wrong-but-successful result instead
/// of the structured error AC2 requires.
pub fn extract_page_range(
    bytes: &[u8],
    start_page: u32,
    end_page: u32,
) -> Result<Vec<u8>, ToolError> {
    let mut doc = load_document(bytes)?;
    let pages = doc.get_pages();
    let total_pages = pages.len() as u32;

    if start_page < 1 || start_page > end_page || end_page > total_pages {
        return Err(invalid_range_error(start_page, end_page, total_pages));
    }

    let pages_to_delete: Vec<u32> = pages
        .keys()
        .copied()
        .filter(|&page_number| page_number < start_page || page_number > end_page)
        .collect();
    doc.delete_pages(&pages_to_delete);

    save_document(doc)
}

/// Extracts all text from the document. Bomb-safe (`extract_text_with_limit`, bounding each
/// page's decompressed content) rather than the bare unbounded `extract_text` this story's Dev
/// Notes originally cited — a small strengthening for NFR4's "never crash" against a malicious
/// or corrupt PDF, using an existing crate API rather than new custom logic. An empty-but-
/// successfully-parsed PDF returns `Ok(String::new())`, not an error — mirrors ocr.rs's "empty
/// text is a legitimate outcome" precedent.
pub fn extract_text(bytes: &[u8]) -> Result<String, ToolError> {
    let doc = load_document(bytes)?;
    let page_numbers: Vec<u32> = doc.get_pages().keys().copied().collect();
    doc.extract_text_with_limit(&page_numbers, MAX_INPUT_BYTES)
        .map_err(|err| pdf_error("pdf-corrupt", err))
}

/// AC14: the shared shape for an out-of-range request, so the sentence stays fixed and the
/// numbers ride in `context` wherever a range is rejected.
fn invalid_range_error(start_page: u32, end_page: u32, total_pages: u32) -> ToolError {
    pdf_error_with_context(
        "pdf-invalid-range",
        "the requested page range does not exist in this document",
        serde_json::json!({
            "startPage": start_page,
            "endPage": end_page,
            "totalPages": total_pages,
        }),
    )
}

/// AC17's open round trip in one parse: the page count (AC8) and the text-layer classification
/// (AC10) from a single `load_document`, rather than parsing up to 100 MB twice for the same two
/// facts (code review 2026-09-13). `page_count` and `classify_text_layer` remain the per-fact
/// entry points; this is the one the open command should call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DocumentSummary {
    pub page_count: u32,
    pub text_layer: TextLayer,
}

pub fn summarise(bytes: &[u8]) -> Result<DocumentSummary, ToolError> {
    let doc = load_document(bytes)?;
    Ok(DocumentSummary {
        page_count: doc.get_pages().len() as u32,
        text_layer: classify_loaded(&doc),
    })
}

/// AC8: how many pages, and nothing else. Deliberately does **not** extract text — the count is
/// the cheapest useful fact about a PDF and the view wants it immediately, while text is a
/// bounded streaming pass (AC9/AC45).
///
/// A document that fails to load returns a `ToolError`, never a count of zero: *"zero pages"* and
/// *"could not read this file"* are different answers and collapsing them would let a corrupt
/// file render as a valid empty document.
pub fn page_count(bytes: &[u8]) -> Result<u32, ToolError> {
    let doc = load_document(bytes)?;
    Ok(doc.get_pages().len() as u32)
}

/// Reads one page's text, joining the chunks that page produced.
///
/// **Called per page on purpose, and this is not the shape the crate suggests.** Verified against
/// vendored 0.45.0 source: `extract_text_chunks_with_limit` `flat_map`s its results, and
/// `extract_text_chunks_from_page`'s own comment says *"each text with different encoding is
/// extracted as separate chunk"* — so passing N page numbers returns a flat `Vec` of chunks with
/// **no page boundaries in it**, not one entry per page. Handing it every page at once would make
/// AC9's per-page guarantee impossible to honour, because there would be no way to tell which
/// chunk belonged to which page.
///
/// A page whose chunks *all* fail yields `None` (unreadable). A partially-decodable page returns
/// what did decode rather than discarding it — some text beats none, and NFR4 asks for no
/// silently-wrong result, not for all-or-nothing.
fn read_page_text(doc: &Document, page: u32) -> Option<String> {
    let mut text = String::new();
    let mut had_ok = false;
    let mut had_error = false;

    for chunk in doc.extract_text_chunks_with_limit(&[page], MAX_INPUT_BYTES) {
        match chunk {
            Ok(chunk) => {
                text.push_str(&chunk);
                had_ok = true;
            }
            Err(_) => had_error = true,
        }
    }

    if had_error && !had_ok {
        return None;
    }
    Some(text)
}

/// AC9: per-page text for the requested pages, bounded by the same bomb-safe decompression cap
/// `extract_text` already applies (`_with_limit`, never the unbounded variant).
///
/// Returns one `PageText` per requested page, in the order requested. An out-of-range page number
/// is rejected up front rather than silently skipped — the caller asked about a page that does not
/// exist, and answering with a shorter list would misalign every index they hold.
pub fn page_texts(bytes: &[u8], page_numbers: &[u32]) -> Result<Vec<PageText>, ToolError> {
    let doc = load_document(bytes)?;
    let total_pages = doc.get_pages().len() as u32;

    for &page in page_numbers {
        if page < 1 || page > total_pages {
            return Err(invalid_range_error(page, page, total_pages));
        }
    }

    Ok(page_numbers
        .iter()
        .map(|&page| PageText {
            page,
            text: read_page_text(&doc, page),
        })
        .collect())
}

/// AC10: the three-way classification the honest scan message (AC40) depends on.
///
/// **Short-circuits on the first page that yields text**, which is what keeps this affordable at
/// document-open time: a text document exits on page one, and only a genuine scan pays the full
/// pass — where the pass is cheap precisely because there is no text to decode.
pub fn classify_text_layer(bytes: &[u8]) -> Result<TextLayer, ToolError> {
    let doc = load_document(bytes)?;
    Ok(classify_loaded(&doc))
}

/// The classification proper, over an already-loaded document (shared with `summarise`).
///
/// **An unreadable page is not evidence of a scan and does not vote either way** — and that has
/// to hold at the end of the loop as well as inside it. The first version fell through to
/// `Scanned` after the loop, so a document whose *every* page failed to decode was reported as a
/// scan; the code review caught it. Only a readable-but-blank page is evidence of a scan, so
/// `Scanned` needs at least one such vote, and a document with no evidence at all reports
/// `Partial` — the state whose view rendering makes no claim.
fn classify_loaded(doc: &Document) -> TextLayer {
    let pages: Vec<u32> = doc.get_pages().keys().copied().collect();

    if pages.is_empty() {
        return TextLayer::Empty;
    }

    let mut any_readable = false;
    for page in pages {
        if let Some(text) = read_page_text(doc, page) {
            if !text.trim().is_empty() {
                return TextLayer::Partial;
            }
            any_readable = true;
        }
    }

    if any_readable {
        TextLayer::Scanned
    } else {
        TextLayer::Partial
    }
}

/// Validates a set of 1-indexed page numbers against the document, rejecting anything out of
/// range or duplicated.
///
/// **This has to happen here, before `delete_pages` is called, and the reason is a crate
/// behaviour rather than a style preference:** `Document::delete_pages` *silently no-ops* on an
/// out-of-range page number rather than erroring — re-verified against vendored 0.45.0
/// (`processor.rs`, still `pages.get(n).and_then(…)`). Core is therefore the only layer that can
/// turn a bad request into an error instead of a wrong-but-successful result.
fn validate_page_selection(selection: &[u32], total_pages: u32) -> Result<(), ToolError> {
    if selection.is_empty() {
        return Err(invalid_range_error(0, 0, total_pages));
    }

    // A set, not a `Vec::contains` loop: a reorder is always every page, so on a large document
    // the quadratic version was the slowest step of the edit (code review 2026-09-13).
    let mut seen: HashSet<u32> = HashSet::with_capacity(selection.len());
    for &page in selection {
        if page < 1 || page > total_pages || !seen.insert(page) {
            return Err(invalid_range_error(page, page, total_pages));
        }
    }
    Ok(())
}

/// AC11: removes the given 1-indexed pages.
///
/// **Deleting every page is rejected.** A zero-page PDF is not a useful output — most readers
/// refuse to open one — so this is an error rather than a document nobody can use.
pub fn delete_pages(bytes: &[u8], page_numbers: &[u32]) -> Result<Vec<u8>, ToolError> {
    let mut doc = load_document(bytes)?;
    let total_pages = doc.get_pages().len() as u32;
    validate_page_selection(page_numbers, total_pages)?;

    if page_numbers.len() as u32 == total_pages {
        // AC38: its own code, not `pdf-invalid-range`. Nothing is out of range here — every page
        // asked for exists — so the range sentence would be a lie, and a single `errors.<code>`
        // lookup cannot carry two sentences. Fixed, value-free and ours, so it translates.
        return Err(pdf_error(
            "pdf-cannot-delete-all-pages",
            "a PDF with no pages cannot be saved",
        ));
    }

    // `Document::delete_pages` walks each deleted page's `/Parent` chain to decrement `/Count`,
    // and that walk has no cycle guard (verified in vendored 0.45.0 `processor.rs`). A hostile
    // document with a `/Parent` cycle loads and validates fine — `get_pages()` follows `/Kids`,
    // never `/Parent` — and would then spin the blocking thread forever, with the view stuck on
    // "working" and every button disabled. Same invariant as `resolve_inherited`'s bound, applied
    // to the crate's walk before handing over (code review 2026-09-13).
    let pages = doc.get_pages();
    for page in page_numbers {
        if let Some(&page_id) = pages.get(page) {
            ensure_parent_chain_terminates(&doc, page_id)?;
        }
    }

    doc.delete_pages(page_numbers);
    save_document(doc)
}

/// How far up a `/Parent` chain any walk in this module will go before calling the document
/// malformed. PDF page trees are shallow in practice (a handful of levels); 64 is far past any
/// real document and far short of anything that would read as a hang.
const PARENT_CHAIN_LIMIT: usize = 64;

/// Rejects a page whose `/Parent` chain does not reach a root within `PARENT_CHAIN_LIMIT` hops.
/// Mirrors the crate's own walk (stop at the first ancestor that is not a dictionary), so a
/// document this accepts is one the crate's unguarded walk also terminates on.
fn ensure_parent_chain_terminates(doc: &Document, page_id: ObjectId) -> Result<(), ToolError> {
    let mut current = page_id;
    for _ in 0..PARENT_CHAIN_LIMIT {
        let Ok(dict) = doc.get_dictionary(current) else {
            return Ok(());
        };
        match dict
            .get(b"Parent")
            .ok()
            .and_then(|parent| parent.as_reference().ok())
        {
            Some(parent) => current = parent,
            None => return Ok(()),
        }
    }
    Err(pdf_error(
        "pdf-corrupt",
        "the page tree's /Parent chain does not terminate",
    ))
}

/// Walks the `/Parent` chain to resolve an inheritable page attribute.
///
/// `/Rotate`, `/Resources`, `/MediaBox` and `/CropBox` are *inheritable* per the PDF spec: a page
/// dictionary may omit them entirely and take the nearest ancestor's value. `lopdf` exposes no
/// helper for this (checked), so the walk is written here.
///
/// The depth guard is not defensive padding — a malformed or hostile PDF can contain a `/Parent`
/// cycle, and NFR4's "never a crash" includes "never an infinite loop".
fn resolve_inherited(doc: &Document, page_id: ObjectId, key: &[u8]) -> Option<Object> {
    let mut current = page_id;
    for _ in 0..PARENT_CHAIN_LIMIT {
        let dict = doc.get_dictionary(current).ok()?;
        if let Ok(value) = dict.get(key) {
            let (_, resolved) = doc.dereference(value).ok()?;
            return Some(resolved.clone());
        }
        current = dict.get(b"Parent").ok()?.as_reference().ok()?;
    }
    None
}

/// Normalises any degree value to one of `0 | 90 | 180 | 270`.
///
/// A `/Rotate` that is not a multiple of 90 is invalid per the PDF spec; rather than propagate
/// nonsense, such a value is treated as 0 — the alternative is emitting a rotation no reader
/// agrees on.
fn normalise_rotation(degrees: i64) -> i64 {
    if degrees % 90 != 0 {
        return 0;
    }
    // `rem_euclid`, not `%`: Rust's `%` keeps the sign of the dividend, so a counter-clockwise
    // turn would land on -90 rather than 270 and be written into the PDF as a negative rotation.
    degrees.rem_euclid(360)
}

/// AC12: rotates the given pages by `quarter_turns` (negative turns counter-clockwise).
///
/// Two details that are easy to get silently wrong, and both are the difference between a correct
/// rotation and a plausible-looking one:
///
/// 1. **Adds to any existing `/Rotate`** rather than replacing it. A page may already carry one —
///    scanned documents very often do — and replacing would silently discard it.
/// 2. **Materialises an inherited `/Rotate` onto the page first.** A page that inherits its
///    rotation from an ancestor `Pages` node has no `/Rotate` of its own, so a naive read sees 0
///    and rotates from the wrong origin. That is exactly the class of document gap #13 describes.
pub fn rotate_pages(
    bytes: &[u8],
    page_numbers: &[u32],
    quarter_turns: i32,
) -> Result<Vec<u8>, ToolError> {
    let mut doc = load_document(bytes)?;
    let pages = doc.get_pages();
    validate_page_selection(page_numbers, pages.len() as u32)?;

    for &page in page_numbers {
        let Some(&page_id) = pages.get(&page) else {
            continue;
        };
        // `as_float`, not `as_i64`: `/Rotate` must be an integer per the spec, but some
        // generators write `90.0`, and Preview/Acrobat honour it. Reading it as 0 would make a
        // quarter-turn silently overwrite the real orientation — the exact failure the doc
        // comment above names, reached through a different type tag (code review 2026-09-13).
        let existing = resolve_inherited(&doc, page_id, b"Rotate")
            .and_then(|object| object.as_float().ok())
            .map(|degrees| degrees.round() as i64)
            .unwrap_or(0);
        let rotation =
            normalise_rotation(normalise_rotation(existing) + i64::from(quarter_turns) * 90);

        let dict = doc
            .get_dictionary_mut(page_id)
            .map_err(|err| pdf_error("pdf-corrupt", err))?;
        dict.set("Rotate", rotation);
    }

    save_document(doc)
}

/// AC13: reorders the document's pages to `new_order`, a permutation of every 1-indexed page
/// number in the desired new sequence.
///
/// The page tree is **flattened** onto the root `Pages` node — the same shape `merge_documents`
/// already produces. Flattening drops intermediate nodes, so the four inheritable attributes are
/// materialised onto each page beforehand; without that step a page that inherited its
/// `/MediaBox` or `/Resources` from a node being removed would render wrongly, which NFR4 counts
/// as a silently-wrong result rather than an acceptable simplification.
pub fn reorder_pages(bytes: &[u8], new_order: &[u32]) -> Result<Vec<u8>, ToolError> {
    let mut doc = load_document(bytes)?;
    let pages = doc.get_pages();
    let total_pages = pages.len() as u32;

    if new_order.len() as u32 != total_pages {
        return Err(invalid_range_error(
            new_order.first().copied().unwrap_or(0),
            new_order.last().copied().unwrap_or(0),
            total_pages,
        ));
    }
    // A permutation, not merely a set of valid page numbers: `validate_page_selection` already
    // rejects duplicates and out-of-range values, and a same-length duplicate-free selection over
    // 1..=total is necessarily a permutation.
    validate_page_selection(new_order, total_pages)?;

    let root_id = doc
        .catalog()
        .and_then(|catalog| catalog.get(b"Pages"))
        .and_then(|object| object.as_reference())
        .map_err(|err| pdf_error("pdf-corrupt", err))?;

    for (_, &page_id) in pages.iter() {
        let inherited: Vec<(&[u8], Object)> = [
            b"Resources".as_slice(),
            b"MediaBox".as_slice(),
            b"CropBox".as_slice(),
            b"Rotate".as_slice(),
        ]
        .into_iter()
        .filter_map(|key| resolve_inherited(&doc, page_id, key).map(|value| (key, value)))
        .collect();

        let dict = doc
            .get_dictionary_mut(page_id)
            .map_err(|err| pdf_error("pdf-corrupt", err))?;
        for (key, value) in inherited {
            if !dict.has(key) {
                dict.set(key.to_vec(), value);
            }
        }
        dict.set("Parent", root_id);
    }

    let kids: Vec<Object> = new_order
        .iter()
        .filter_map(|page| pages.get(page).map(|id| Object::Reference(*id)))
        .collect();

    let mut root: Dictionary = doc
        .get_dictionary(root_id)
        .map_err(|err| pdf_error("pdf-corrupt", err))?
        .clone();
    root.set("Count", total_pages);
    root.set("Kids", kids);
    doc.objects.insert(root_id, Object::Dictionary(root));

    save_document(doc)
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{EncryptionState, EncryptionVersion, Permissions, Stream, dictionary};

    /// Builds a small valid multi-page PDF in-test (one page per string in `pages_text`),
    /// following `lopdf`'s own README-documented document-builder pattern — cheaper to maintain
    /// than a checked-in binary fixture, and the crate that reads PDFs is equally capable of
    /// writing the ones used to test it.
    fn generate_test_document(pages_text: &[&str]) -> Document {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Courier",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! { "F1" => font_id },
        });

        let mut kids = Vec::new();
        for text in pages_text {
            let content = Content {
                operations: vec![
                    Operation::new("BT", vec![]),
                    Operation::new("Tf", vec!["F1".into(), 24.into()]),
                    Operation::new("Td", vec![72.into(), 700.into()]),
                    Operation::new("Tj", vec![Object::string_literal(*text)]),
                    Operation::new("ET", vec![]),
                ],
            };
            let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content_id,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            });
            kids.push(page_id.into());
        }

        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => kids.clone(),
            "Count" => kids.len() as u32,
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages));
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc
    }

    fn document_bytes(doc: &mut Document) -> Vec<u8> {
        let mut buffer = Vec::new();
        doc.save_to(&mut buffer).unwrap();
        buffer
    }

    /// Encrypts a generated document with a real, non-empty password (RC4 V2, the simplest
    /// variant requiring no extra `rand` dependency) so the encrypted-PDF path can be exercised
    /// against a real fixture rather than mocked.
    fn generate_encrypted_document_bytes(pages_text: &[&str]) -> Vec<u8> {
        let mut doc = generate_test_document(pages_text);
        // RC4 key derivation ties into the trailer's file ID (confirmed against lopdf's own
        // `tests/decryption.rs`, which sets this identically) — omitting it fails encryption
        // with `Decryption(MissingFileID)`. Arbitrary fixed bytes are fine; this is a test
        // fixture, not a real document needing a genuinely unique ID.
        doc.trailer.set(
            "ID",
            Object::Array(vec![
                Object::string_literal(vec![1u8; 16]),
                Object::string_literal(vec![2u8; 16]),
            ]),
        );
        let state = EncryptionState::try_from(EncryptionVersion::V2 {
            document: &doc,
            owner_password: "owner-secret",
            user_password: "user-secret",
            key_length: 40,
            permissions: Permissions::PRINTABLE,
        })
        .unwrap();
        doc.encrypt(&state).unwrap();
        document_bytes(&mut doc)
    }

    /// A document whose pages carry NO `/Rotate` of their own but whose `Pages` root does, so the
    /// pages inherit it. AC12's second trap: a naive read of the page dictionary sees no rotation
    /// and rotates from the wrong origin. `generate_test_document` cannot produce this, because
    /// every page it writes is self-contained.
    fn generate_document_with_inherited_rotate(pages_text: &[&str], rotate: i64) -> Vec<u8> {
        let mut doc = generate_test_document(pages_text);
        let root_id = doc
            .catalog()
            .unwrap()
            .get(b"Pages")
            .unwrap()
            .as_reference()
            .unwrap();
        doc.get_dictionary_mut(root_id)
            .unwrap()
            .set("Rotate", rotate);
        document_bytes(&mut doc)
    }

    #[test]
    fn page_count_counts_pages_without_extracting_text() {
        let bytes = document_bytes(&mut generate_test_document(&["One", "Two", "Three"]));
        assert_eq!(page_count(&bytes).unwrap(), 3);
    }

    #[test]
    fn page_count_errors_on_a_corrupt_document_rather_than_returning_zero() {
        // AC8's whole point: "zero pages" and "could not read this file" must not collapse into
        // the same answer, or a corrupt file renders as a valid empty document.
        let err = page_count(b"not a pdf at all").unwrap_err();
        assert_eq!(err.code, "pdf-corrupt");
    }

    #[test]
    fn page_texts_returns_one_entry_per_requested_page_in_order() {
        let bytes = document_bytes(&mut generate_test_document(&["Alpha", "Beta", "Gamma"]));

        let texts = page_texts(&bytes, &[3, 1]).unwrap();
        assert_eq!(texts.len(), 2);
        assert_eq!(texts[0].page, 3);
        assert!(texts[0].text.as_deref().unwrap().contains("Gamma"));
        assert_eq!(texts[1].page, 1);
        assert!(texts[1].text.as_deref().unwrap().contains("Alpha"));
    }

    #[test]
    fn page_texts_rejects_an_out_of_range_page_with_its_values_in_context() {
        let bytes = document_bytes(&mut generate_test_document(&["Only"]));

        let err = page_texts(&bytes, &[2]).unwrap_err();
        assert_eq!(err.code, "pdf-invalid-range");
        // AC14: the numbers ride in `context`, not in the prose — that is what makes the code
        // eligible for TRANSLATABLE_CODES at all (AC38).
        assert!(!err.message.contains('2'), "message must stay value-free");
        let context: serde_json::Value =
            serde_json::from_str(err.context.as_deref().unwrap()).unwrap();
        assert_eq!(context["startPage"], 2);
        assert_eq!(context["totalPages"], 1);
    }

    #[test]
    fn classify_text_layer_reports_partial_for_a_document_with_text() {
        let bytes = document_bytes(&mut generate_test_document(&["Has text"]));
        assert_eq!(classify_text_layer(&bytes).unwrap(), TextLayer::Partial);
    }

    #[test]
    fn classify_text_layer_reports_scanned_when_no_page_yields_text() {
        // Whitespace-only is the interesting case, not the empty string: a scanned page often
        // carries a content stream that decodes to nothing but spacing.
        let bytes = document_bytes(&mut generate_test_document(&["   ", "\t"]));
        assert_eq!(classify_text_layer(&bytes).unwrap(), TextLayer::Scanned);
    }

    #[test]
    fn classify_text_layer_distinguishes_an_empty_document_from_a_scan() {
        // AC10: "nothing to read" and "nothing readable" are different answers, and the honest
        // scan message (AC40) is only correct for the second.
        let bytes = document_bytes(&mut generate_test_document(&[]));
        assert_eq!(classify_text_layer(&bytes).unwrap(), TextLayer::Empty);
    }

    /// Replaces one page's content with a stream `lopdf` refuses to extract from: a `Tf` with no
    /// operands makes `extract_text_chunks_from_page` return `Err` for the whole page (vendored
    /// 0.45.0 `parser_aux.rs`, the `missing font operand` path), which is what `read_page_text`
    /// reports as `None` — "unreadable", as opposed to "readable and blank".
    fn make_page_unreadable(doc: &mut Document, page: u32) {
        let page_id = *doc.get_pages().get(&page).unwrap();
        let content = Content {
            operations: vec![Operation::new("BT", vec![]), Operation::new("Tf", vec![])],
        };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
        doc.get_dictionary_mut(page_id)
            .unwrap()
            .set("Contents", content_id);
    }

    #[test]
    fn classify_text_layer_does_not_call_an_unreadable_document_a_scan() {
        // Code review 2026-09-13: every page unreadable used to fall through to `Scanned`, so a
        // text document with fonts lopdf cannot decode got the "This PDF is a scan" sentence.
        let mut doc = generate_test_document(&["Real text", "More text"]);
        make_page_unreadable(&mut doc, 1);
        make_page_unreadable(&mut doc, 2);
        let bytes = document_bytes(&mut doc);
        assert_eq!(classify_text_layer(&bytes).unwrap(), TextLayer::Partial);
    }

    #[test]
    fn classify_text_layer_lets_a_blank_readable_page_vote_scan_beside_an_unreadable_one() {
        // The abstention is one-sided: an unreadable page casts no vote, but a readable blank
        // page still does, so this document is a scan with one page we could not read.
        let mut doc = generate_test_document(&["   ", "Unreadable"]);
        make_page_unreadable(&mut doc, 2);
        let bytes = document_bytes(&mut doc);
        assert_eq!(classify_text_layer(&bytes).unwrap(), TextLayer::Scanned);
    }

    #[test]
    fn summarise_agrees_with_page_count_and_classify_text_layer_from_one_parse() {
        let bytes = document_bytes(&mut generate_test_document(&["A", "   ", "C"]));
        let summary = summarise(&bytes).unwrap();
        assert_eq!(summary.page_count, page_count(&bytes).unwrap());
        assert_eq!(summary.text_layer, classify_text_layer(&bytes).unwrap());
        assert_eq!(summary.page_count, 3);
        assert_eq!(summary.text_layer, TextLayer::Partial);
    }

    #[test]
    fn summarise_errors_on_a_corrupt_document_like_page_count_does() {
        let err = summarise(b"%PDF-1.5 definitely not a pdf").unwrap_err();
        assert_eq!(err.code, "pdf-corrupt");
    }

    #[test]
    fn delete_pages_removes_exactly_the_requested_pages() {
        let bytes = document_bytes(&mut generate_test_document(&[
            "Keep 1", "Drop 2", "Keep 3", "Drop 4",
        ]));

        let result = delete_pages(&bytes, &[2, 4]).unwrap();
        assert_eq!(page_count(&result).unwrap(), 2);

        let text = extract_text(&result).unwrap();
        assert!(text.contains("Keep 1"));
        assert!(text.contains("Keep 3"));
        assert!(!text.contains("Drop 2"));
        assert!(!text.contains("Drop 4"));
    }

    #[test]
    fn delete_pages_rejects_an_out_of_range_page_rather_than_silently_no_opping() {
        // AC11's reason for validating in core: `Document::delete_pages` silently ignores an
        // out-of-range number, so without this guard the caller gets a successful result for a
        // request that did nothing.
        let bytes = document_bytes(&mut generate_test_document(&["One", "Two"]));

        let err = delete_pages(&bytes, &[3]).unwrap_err();
        assert_eq!(err.code, "pdf-invalid-range");
    }

    /// AC38's slice found this sharing `pdf-invalid-range` with four other failures, and one of
    /// them needs a different sentence: nothing here is out of range — every page asked for
    /// exists — the *operation* is refused. One code cannot carry both sentences, which is the
    /// exclusion `toolError.ts` already records for `ocr-malformed-request`. Split rather than
    /// excluded, so both halves translate.
    #[test]
    fn delete_pages_rejects_deleting_every_page_under_its_own_code() {
        let bytes = document_bytes(&mut generate_test_document(&["One", "Two"]));

        let err = delete_pages(&bytes, &[1, 2]).unwrap_err();
        assert_eq!(err.code, "pdf-cannot-delete-all-pages");
        // Fixed, value-free and ours — the three properties TRANSLATABLE_CODES membership rests
        // on. A number appearing here would put the sentence back out of reach of `t()`.
        assert!(
            !err.message.chars().any(|c| c.is_ascii_digit()),
            "message must stay value-free"
        );
    }

    /// AC38's sentence for this code interpolates `{totalPages}` from `context`. A raise site that
    /// forgot the context would not fail anything Rust-side — it would surface to the user as
    /// "it only goes up to page ." in the app, which is NFR4's "silently wrong" with a period on
    /// the end. Every path that can raise it is exercised here instead.
    #[test]
    fn every_invalid_range_raise_carries_the_context_its_sentence_interpolates() {
        let one_page = document_bytes(&mut generate_test_document(&["Only"]));
        let three_pages = document_bytes(&mut generate_test_document(&["One", "Two", "Three"]));

        let errors = [
            page_texts(&one_page, &[2]).unwrap_err(),
            extract_page_range(&one_page, 1, 9).unwrap_err(),
            delete_pages(&three_pages, &[9]).unwrap_err(),
            delete_pages(&three_pages, &[]).unwrap_err(),
            rotate_pages(&three_pages, &[9], 1).unwrap_err(),
            reorder_pages(&three_pages, &[1, 2]).unwrap_err(),
        ];

        for err in errors {
            assert_eq!(err.code, "pdf-invalid-range");
            let context: serde_json::Value =
                serde_json::from_str(err.context.as_deref().expect("context is required"))
                    .expect("context must be JSON the view can pass to t() as params");
            assert!(
                context["totalPages"].is_u64(),
                "totalPages must be present and numeric, got {context}"
            );
        }
    }

    #[test]
    fn delete_pages_rejects_a_parent_cycle_rather_than_spinning_forever() {
        // Code review 2026-09-13: `lopdf::Document::delete_pages` walks `/Parent` upward with no
        // cycle guard. `get_pages()` never follows `/Parent`, so this document loads and
        // validates cleanly and only the crate's walk would hang. Root `Pages` -> page 1 closes
        // the loop.
        let mut doc = generate_test_document(&["One", "Two"]);
        let page_one = *doc.get_pages().get(&1).unwrap();
        let root_id = doc
            .catalog()
            .unwrap()
            .get(b"Pages")
            .unwrap()
            .as_reference()
            .unwrap();
        doc.get_dictionary_mut(root_id)
            .unwrap()
            .set("Parent", page_one);
        let bytes = document_bytes(&mut doc);

        let err = delete_pages(&bytes, &[1]).unwrap_err();
        assert_eq!(err.code, "pdf-corrupt");
    }

    #[test]
    fn delete_pages_rejects_a_duplicated_page_number() {
        let bytes = document_bytes(&mut generate_test_document(&["One", "Two", "Three"]));

        let err = delete_pages(&bytes, &[2, 2]).unwrap_err();
        assert_eq!(err.code, "pdf-invalid-range");
    }

    #[test]
    fn rotate_pages_writes_a_normalised_rotation() {
        let bytes = document_bytes(&mut generate_test_document(&["One", "Two"]));

        let rotated = rotate_pages(&bytes, &[1], 1).unwrap();
        let doc = Document::load_mem(&rotated).unwrap();
        let pages = doc.get_pages();

        let first = doc.get_dictionary(pages[&1]).unwrap();
        assert_eq!(first.get(b"Rotate").unwrap().as_i64().unwrap(), 90);
        // The unselected page is untouched — rotation applies to the selection, not the document.
        let second = doc.get_dictionary(pages[&2]).unwrap();
        assert!(second.get(b"Rotate").is_err());
    }

    #[test]
    fn rotate_pages_adds_to_an_existing_rotation_rather_than_replacing_it() {
        // AC12's first trap. Replacing would silently discard a rotation the document already
        // carried, which scanned documents very often do.
        let bytes = document_bytes(&mut generate_test_document(&["One"]));
        let once = rotate_pages(&bytes, &[1], 1).unwrap();
        let twice = rotate_pages(&once, &[1], 1).unwrap();

        let doc = Document::load_mem(&twice).unwrap();
        let pages = doc.get_pages();
        assert_eq!(
            doc.get_dictionary(pages[&1])
                .unwrap()
                .get(b"Rotate")
                .unwrap()
                .as_i64()
                .unwrap(),
            180
        );
    }

    #[test]
    fn rotate_pages_materialises_a_rotation_inherited_from_an_ancestor() {
        // AC12's second trap, and the one that is invisible without a purpose-built fixture: the
        // page has no `/Rotate` of its own and inherits 90 from the Pages root. Rotating one more
        // quarter-turn must land on 180, not 90.
        let bytes = generate_document_with_inherited_rotate(&["One"], 90);

        let rotated = rotate_pages(&bytes, &[1], 1).unwrap();
        let doc = Document::load_mem(&rotated).unwrap();
        let pages = doc.get_pages();
        assert_eq!(
            doc.get_dictionary(pages[&1])
                .unwrap()
                .get(b"Rotate")
                .unwrap()
                .as_i64()
                .unwrap(),
            180
        );
    }

    #[test]
    fn rotate_pages_reads_an_existing_rotation_stored_as_a_real() {
        // Code review 2026-09-13: `/Rotate 90.0` is out-of-spec but emitted by some generators
        // and honoured by Preview/Acrobat. Read as 0, one quarter-turn would write 90 — the
        // orientation the page already had — and the user's rotation would appear to do nothing.
        let mut doc = generate_test_document(&["Real rotate"]);
        let page_id = *doc.get_pages().get(&1).unwrap();
        doc.get_dictionary_mut(page_id)
            .unwrap()
            .set("Rotate", Object::Real(90.0));
        let bytes = document_bytes(&mut doc);

        let rotated = rotate_pages(&bytes, &[1], 1).unwrap();
        let doc = Document::load_mem(&rotated).unwrap();
        let page_id = *doc.get_pages().get(&1).unwrap();
        let rotate = doc
            .get_dictionary(page_id)
            .unwrap()
            .get(b"Rotate")
            .unwrap()
            .as_i64()
            .unwrap();
        assert_eq!(rotate, 180);
    }

    #[test]
    fn rotate_pages_wraps_and_accepts_negative_quarter_turns() {
        let bytes = document_bytes(&mut generate_test_document(&["One"]));

        let full_circle = rotate_pages(&bytes, &[1], 4).unwrap();
        let doc = Document::load_mem(&full_circle).unwrap();
        let pages = doc.get_pages();
        assert_eq!(
            doc.get_dictionary(pages[&1])
                .unwrap()
                .get(b"Rotate")
                .unwrap()
                .as_i64()
                .unwrap(),
            0
        );

        let counter = rotate_pages(&bytes, &[1], -1).unwrap();
        let doc = Document::load_mem(&counter).unwrap();
        let pages = doc.get_pages();
        assert_eq!(
            doc.get_dictionary(pages[&1])
                .unwrap()
                .get(b"Rotate")
                .unwrap()
                .as_i64()
                .unwrap(),
            270
        );
    }

    #[test]
    fn reorder_pages_makes_the_new_order_the_documents_real_page_order() {
        // AC13 asserts by POSITION WITHIN EXTRACTED TEXT, not by "the file parses" — the same
        // end-to-end assertion `merge_documents_combines_pages_in_input_order` already uses,
        // because a reordered page tree that merely parses proves nothing about page order.
        let bytes = document_bytes(&mut generate_test_document(&["First", "Second", "Third"]));

        let reordered = reorder_pages(&bytes, &[3, 1, 2]).unwrap();
        assert_eq!(page_count(&reordered).unwrap(), 3);

        let text = extract_text(&reordered).unwrap();
        let third = text.find("Third").expect("Third present");
        let first = text.find("First").expect("First present");
        let second = text.find("Second").expect("Second present");
        assert!(third < first, "expected Third before First");
        assert!(first < second, "expected First before Second");
    }

    #[test]
    fn reorder_pages_preserves_attributes_a_page_inherited_from_a_removed_ancestor() {
        // Flattening the page tree drops intermediate nodes. A page that inherited `/Rotate` from
        // one would silently lose it, which NFR4 counts as a wrong result rather than a
        // simplification — so the inheritable attributes are materialised first.
        let bytes = generate_document_with_inherited_rotate(&["One", "Two"], 90);

        let reordered = reorder_pages(&bytes, &[2, 1]).unwrap();
        let doc = Document::load_mem(&reordered).unwrap();
        let pages = doc.get_pages();
        for page_id in pages.values() {
            assert_eq!(
                doc.get_dictionary(*page_id)
                    .unwrap()
                    .get(b"Rotate")
                    .unwrap()
                    .as_i64()
                    .unwrap(),
                90,
                "inherited rotation must survive the flatten"
            );
        }
    }

    #[test]
    fn reorder_pages_rejects_anything_that_is_not_a_permutation() {
        let bytes = document_bytes(&mut generate_test_document(&["One", "Two", "Three"]));

        // Too short.
        assert_eq!(
            reorder_pages(&bytes, &[1, 2]).unwrap_err().code,
            "pdf-invalid-range"
        );
        // Right length, but repeats a page and omits another.
        assert_eq!(
            reorder_pages(&bytes, &[1, 1, 2]).unwrap_err().code,
            "pdf-invalid-range"
        );
        // Right length, but names a page that does not exist.
        assert_eq!(
            reorder_pages(&bytes, &[1, 2, 4]).unwrap_err().code,
            "pdf-invalid-range"
        );
    }

    #[test]
    fn merge_too_few_files_carries_its_count_in_context_not_in_the_message() {
        // AC14, the merge half. Same criterion as the range error above.
        let err = merge_documents(vec![]).unwrap_err();
        assert_eq!(err.code, "pdf-too-few-files");
        assert!(!err.message.contains('0'), "message must stay value-free");
        let context: serde_json::Value =
            serde_json::from_str(err.context.as_deref().unwrap()).unwrap();
        assert_eq!(context["count"], 0);
    }

    #[test]
    fn every_new_operation_rejects_a_password_protected_pdf() {
        // The encrypted path is a per-operation guarantee, not a property of one entry point —
        // covering the DIMENSION rather than one example of it (Story 8.7's lesson 10).
        let bytes = generate_encrypted_document_bytes(&["Secret"]);

        assert_eq!(page_count(&bytes).unwrap_err().code, "pdf-encrypted");
        assert_eq!(
            classify_text_layer(&bytes).unwrap_err().code,
            "pdf-encrypted"
        );
        assert_eq!(page_texts(&bytes, &[1]).unwrap_err().code, "pdf-encrypted");
        assert_eq!(
            delete_pages(&bytes, &[1]).unwrap_err().code,
            "pdf-encrypted"
        );
        assert_eq!(
            rotate_pages(&bytes, &[1], 1).unwrap_err().code,
            "pdf-encrypted"
        );
        assert_eq!(
            reorder_pages(&bytes, &[1]).unwrap_err().code,
            "pdf-encrypted"
        );
    }

    #[test]
    fn merge_documents_combines_pages_in_input_order() {
        let bytes_a = document_bytes(&mut generate_test_document(&["Page A1", "Page A2"]));
        let bytes_b = document_bytes(&mut generate_test_document(&["Page B1"]));

        let merged_bytes = merge_documents(vec![bytes_a, bytes_b]).unwrap();
        let merged = Document::load_mem(&merged_bytes).unwrap();
        assert_eq!(merged.get_pages().len(), 3);

        let text = extract_text(&merged_bytes).unwrap();
        let pos_a1 = text.find("Page A1").expect("Page A1 present");
        let pos_a2 = text.find("Page A2").expect("Page A2 present");
        let pos_b1 = text.find("Page B1").expect("Page B1 present");
        assert!(pos_a1 < pos_a2, "expected Page A1 before Page A2");
        assert!(pos_a2 < pos_b1, "expected Page A2 before Page B1");
    }

    #[test]
    fn merge_documents_rejects_fewer_than_two_inputs() {
        let bytes_a = document_bytes(&mut generate_test_document(&["Only page"]));

        let err = merge_documents(vec![bytes_a]).unwrap_err();
        assert_eq!(err.code, "pdf-too-few-files");

        let err_empty = merge_documents(vec![]).unwrap_err();
        assert_eq!(err_empty.code, "pdf-too-few-files");
    }

    #[test]
    fn extract_page_range_returns_exactly_the_requested_pages() {
        let bytes = document_bytes(&mut generate_test_document(&[
            "Page 1", "Page 2", "Page 3", "Page 4",
        ]));

        let extracted_bytes = extract_page_range(&bytes, 2, 3).unwrap();
        let extracted = Document::load_mem(&extracted_bytes).unwrap();
        assert_eq!(extracted.get_pages().len(), 2);

        let text = extract_text(&extracted_bytes).unwrap();
        assert!(text.contains("Page 2"));
        assert!(text.contains("Page 3"));
        assert!(!text.contains("Page 1"));
        assert!(!text.contains("Page 4"));
    }

    #[test]
    fn extract_page_range_rejects_start_below_one() {
        let bytes = document_bytes(&mut generate_test_document(&["Page 1", "Page 2"]));
        let err = extract_page_range(&bytes, 0, 1).unwrap_err();
        assert_eq!(err.code, "pdf-invalid-range");
    }

    #[test]
    fn extract_page_range_rejects_start_after_end() {
        let bytes = document_bytes(&mut generate_test_document(&["Page 1", "Page 2", "Page 3"]));
        let err = extract_page_range(&bytes, 3, 2).unwrap_err();
        assert_eq!(err.code, "pdf-invalid-range");
    }

    #[test]
    fn extract_page_range_rejects_end_beyond_total_pages() {
        let bytes = document_bytes(&mut generate_test_document(&["Page 1", "Page 2"]));
        let err = extract_page_range(&bytes, 1, 3).unwrap_err();
        assert_eq!(err.code, "pdf-invalid-range");
    }

    #[test]
    fn extract_text_returns_a_tool_error_not_a_panic_for_undecodable_bytes() {
        let err = extract_text(b"not a pdf").unwrap_err();
        assert_eq!(err.code, "pdf-corrupt");
    }

    #[test]
    fn extract_text_returns_a_tool_error_not_a_panic_for_a_truncated_corrupt_document() {
        let bytes = document_bytes(&mut generate_test_document(&["Some real content here"]));
        let truncated = &bytes[..bytes.len() / 2];

        let err = extract_text(truncated).unwrap_err();
        assert_eq!(err.code, "pdf-corrupt");
    }

    #[test]
    fn extract_text_returns_empty_string_for_a_page_with_no_text_content() {
        let bytes = document_bytes(&mut generate_test_document(&[]));
        let text = extract_text(&bytes).unwrap();
        assert_eq!(text, "");
    }

    #[test]
    fn merge_extract_range_and_extract_text_reject_a_real_password_protected_pdf() {
        let encrypted_bytes = generate_encrypted_document_bytes(&["Secret page"]);

        let extract_err = extract_text(&encrypted_bytes).unwrap_err();
        assert_eq!(extract_err.code, "pdf-encrypted");

        let range_err = extract_page_range(&encrypted_bytes, 1, 1).unwrap_err();
        assert_eq!(range_err.code, "pdf-encrypted");

        let other_bytes = document_bytes(&mut generate_test_document(&["Other page"]));
        let merge_err = merge_documents(vec![encrypted_bytes, other_bytes]).unwrap_err();
        assert_eq!(merge_err.code, "pdf-encrypted");
    }
}
