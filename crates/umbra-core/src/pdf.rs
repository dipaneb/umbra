//! PDF capability (AD-1/AD-3): merge, page-range extraction, and text extraction over in-memory
//! bytes only — no filesystem access here (AD-2/AD-15 leave path resolution and reading/writing
//! to the Tauri command layer). `lopdf` is the v1 adapter; see `ARCHITECTURE-SPINE.md`'s Stack
//! table for the version/license/API verification trail this module's implementation follows.

use crate::error::ToolError;
use lopdf::{Document, Object, ObjectId};
use std::collections::BTreeMap;

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

/// Loads a PDF from bytes and rejects a still-encrypted result explicitly, rather than letting a
/// later operation (get_pages/extract_text/delete_pages/save) fail confusingly against
/// undecrypted content. `Document::load_mem` always attempts an empty-password decryption
/// automatically; for a real, non-empty password it returns `Ok(Document)` with
/// `is_encrypted() == true` and `encryption_state == None` rather than an `Err` — confirmed
/// against the vendored source (`reader.rs`'s `authenticate_and_setup_encryption`), not assumed
/// from the crate's README example alone.
fn load_document(bytes: &[u8]) -> Result<Document, ToolError> {
    let doc = Document::load_mem(bytes).map_err(|err| pdf_error("bucket-pdf-corrupt", err))?;
    if doc.is_encrypted() && doc.encryption_state.is_none() {
        return Err(pdf_error(
            "bucket-pdf-encrypted",
            "PDF is encrypted with a password and cannot be processed",
        ));
    }
    Ok(doc)
}

fn save_document(mut doc: Document) -> Result<Vec<u8>, ToolError> {
    let mut buffer = Vec::new();
    doc.save_to(&mut buffer)
        .map_err(|err| pdf_error("bucket-pdf-corrupt", err))?;
    Ok(buffer)
}

/// Merges PDFs in the given order (the caller/command layer determines "chosen order" — this
/// function just preserves it). Follows `lopdf`'s own documented merge pattern: renumber each
/// input document's objects into a disjoint ID range, then reconcile a single Catalog/Pages
/// structure from all inputs' object graphs.
pub fn merge_documents(inputs: Vec<Vec<u8>>) -> Result<Vec<u8>, ToolError> {
    if inputs.len() < 2 {
        return Err(pdf_error(
            "bucket-pdf-too-few-files",
            format!("merge requires at least 2 PDFs, got {}", inputs.len()),
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
                .map_err(|err| pdf_error("bucket-pdf-corrupt", err))?
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

    let (pages_id, pages_object) = pages_object.ok_or_else(|| {
        pdf_error(
            "bucket-pdf-corrupt",
            "one or more input PDFs has no Pages root",
        )
    })?;
    let (catalog_id, catalog_object) = catalog_object.ok_or_else(|| {
        pdf_error(
            "bucket-pdf-corrupt",
            "one or more input PDFs has no Catalog root",
        )
    })?;

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
        return Err(pdf_error(
            "bucket-pdf-invalid-range",
            format!(
                "page range {start_page}-{end_page} is invalid for a {total_pages}-page document"
            ),
        ));
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
        .map_err(|err| pdf_error("bucket-pdf-corrupt", err))
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
        assert_eq!(err.code, "bucket-pdf-too-few-files");

        let err_empty = merge_documents(vec![]).unwrap_err();
        assert_eq!(err_empty.code, "bucket-pdf-too-few-files");
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
        assert_eq!(err.code, "bucket-pdf-invalid-range");
    }

    #[test]
    fn extract_page_range_rejects_start_after_end() {
        let bytes = document_bytes(&mut generate_test_document(&["Page 1", "Page 2", "Page 3"]));
        let err = extract_page_range(&bytes, 3, 2).unwrap_err();
        assert_eq!(err.code, "bucket-pdf-invalid-range");
    }

    #[test]
    fn extract_page_range_rejects_end_beyond_total_pages() {
        let bytes = document_bytes(&mut generate_test_document(&["Page 1", "Page 2"]));
        let err = extract_page_range(&bytes, 1, 3).unwrap_err();
        assert_eq!(err.code, "bucket-pdf-invalid-range");
    }

    #[test]
    fn extract_text_returns_a_tool_error_not_a_panic_for_undecodable_bytes() {
        let err = extract_text(b"not a pdf").unwrap_err();
        assert_eq!(err.code, "bucket-pdf-corrupt");
    }

    #[test]
    fn extract_text_returns_a_tool_error_not_a_panic_for_a_truncated_corrupt_document() {
        let bytes = document_bytes(&mut generate_test_document(&["Some real content here"]));
        let truncated = &bytes[..bytes.len() / 2];

        let err = extract_text(truncated).unwrap_err();
        assert_eq!(err.code, "bucket-pdf-corrupt");
    }

    #[test]
    fn extract_text_returns_empty_string_for_a_page_with_no_text_content() {
        let bytes = document_bytes(&mut generate_test_document(&[]));
        let text = extract_text(&bytes).unwrap();
        assert_eq!(text, "");
    }

    #[test]
    fn all_three_operations_return_bucket_pdf_encrypted_for_a_real_password_protected_pdf() {
        let encrypted_bytes = generate_encrypted_document_bytes(&["Secret page"]);

        let extract_err = extract_text(&encrypted_bytes).unwrap_err();
        assert_eq!(extract_err.code, "bucket-pdf-encrypted");

        let range_err = extract_page_range(&encrypted_bytes, 1, 1).unwrap_err();
        assert_eq!(range_err.code, "bucket-pdf-encrypted");

        let other_bytes = document_bytes(&mut generate_test_document(&["Other page"]));
        let merge_err = merge_documents(vec![encrypted_bytes, other_bytes]).unwrap_err();
        assert_eq!(merge_err.code, "bucket-pdf-encrypted");
    }
}
