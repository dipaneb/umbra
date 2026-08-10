use umbra_core::ToolError;
use umbra_core::pdf::{self, MAX_INPUT_BYTES};

// Same shape as bucket.rs's/base64.rs's own `check_file_size` — this codebase does not share
// that helper across command files, per those files' own established convention.
fn check_file_size(path: &str) -> Result<(), ToolError> {
    let len = std::fs::metadata(path)
        .map_err(|err| ToolError {
            code: "file-read-error".to_string(),
            message: format!("{path}: {err}"),
            position: None,
            context: None,
        })?
        .len();
    if len > MAX_INPUT_BYTES as u64 {
        return Err(ToolError {
            code: "bucket-input-too-large".to_string(),
            message: format!("file is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit"),
            position: None,
            context: None,
        });
    }
    Ok(())
}

// AD-15: a merged/page-extracted PDF can easily exceed the ~64KB JSON-IPC ceiling, so these two
// commands take `output_path` (obtained frontend-side via the `save()` dialog) and write
// server-side via `fs_helper::write_file_bytes`, returning `Result<(), ToolError>` — never the
// bytes themselves — mirroring `base64_decode_to_file`'s exact precedent.
#[tauri::command]
pub async fn bucket_merge_pdfs(paths: Vec<String>, output_path: String) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut inputs = Vec::with_capacity(paths.len());
        for path in &paths {
            // Checked via metadata, before the file is read, so an oversized file is rejected
            // without ever being materialized in memory (same ordering as bucket.rs's own
            // check_file_size).
            check_file_size(path)?;
            inputs.push(crate::fs_helper::read_file_bytes(path)?);
        }
        let merged = pdf::merge_documents(inputs)?;
        crate::fs_helper::write_file_bytes(&output_path, &merged)
    })
    .await
    .map_err(map_join_error)?
}

#[tauri::command]
pub async fn bucket_extract_pdf_pages(
    path: String,
    start_page: u32,
    end_page: u32,
    output_path: String,
) -> Result<(), ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        let extracted = pdf::extract_page_range(&bytes, start_page, end_page)?;
        crate::fs_helper::write_file_bytes(&output_path, &extracted)
    })
    .await
    .map_err(map_join_error)?
}

// The one exception to the output_path pattern above: extracted text is realistically small
// relative to the 64KB IPC concern, matching `bucket_extract_text`'s own existing precedent of
// returning `OcrOutcome` directly.
#[tauri::command]
pub async fn bucket_extract_pdf_text(path: String) -> Result<String, ToolError> {
    tauri::async_runtime::spawn_blocking(move || {
        check_file_size(&path)?;
        let bytes = crate::fs_helper::read_file_bytes(&path)?;
        pdf::extract_text(&bytes)
    })
    .await
    .map_err(map_join_error)?
}

fn map_join_error(err: tauri::Error) -> ToolError {
    ToolError {
        code: "bucket-internal".to_string(),
        message: format!("background task failed: {err}"),
        position: None,
        context: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{Document, Object, Stream, dictionary};

    // Minimal valid in-test PDF fixture builder — same rationale as umbra-core's own pdf.rs test
    // module (cheaper to maintain than a checked-in binary fixture). This crate's tests only need
    // "a real file exists and round-trips through the command," not exhaustive core-logic
    // coverage — that's umbra-core's own pdf.rs test module's job (Task 5's division of labor).
    fn generate_test_pdf_bytes(pages_text: &[&str]) -> Vec<u8> {
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

        let mut buffer = Vec::new();
        doc.save_to(&mut buffer).unwrap();
        buffer
    }

    fn temp_file_path(name: &str) -> String {
        std::env::temp_dir()
            .join(format!("umbra-pdf-cmd-{}-{name}", std::process::id()))
            .to_str()
            .unwrap()
            .to_string()
    }

    #[tokio::test]
    async fn bucket_merge_pdfs_command_merges_two_real_files_end_to_end() {
        let path_a = temp_file_path("merge-a.pdf");
        let path_b = temp_file_path("merge-b.pdf");
        let output_path = temp_file_path("merge-out.pdf");
        std::fs::write(&path_a, generate_test_pdf_bytes(&["Page A"])).unwrap();
        std::fs::write(&path_b, generate_test_pdf_bytes(&["Page B"])).unwrap();

        bucket_merge_pdfs(vec![path_a.clone(), path_b.clone()], output_path.clone())
            .await
            .unwrap();

        let merged_bytes = std::fs::read(&output_path).unwrap();
        let merged = Document::load_mem(&merged_bytes).unwrap();
        assert_eq!(merged.get_pages().len(), 2);

        std::fs::remove_file(&path_a).unwrap();
        std::fs::remove_file(&path_b).unwrap();
        std::fs::remove_file(&output_path).unwrap();
    }

    #[tokio::test]
    async fn bucket_merge_pdfs_command_rejects_a_file_over_the_size_limit_without_reading_it() {
        let oversized_path = temp_file_path("merge-oversized.pdf");
        let other_path = temp_file_path("merge-other.pdf");
        let file = std::fs::File::create(&oversized_path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);
        std::fs::write(&other_path, generate_test_pdf_bytes(&["Page"])).unwrap();

        let err = bucket_merge_pdfs(
            vec![oversized_path.clone(), other_path.clone()],
            temp_file_path("merge-oversized-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "bucket-input-too-large");

        std::fs::remove_file(&oversized_path).unwrap();
        std::fs::remove_file(&other_path).unwrap();
    }

    #[tokio::test]
    async fn bucket_merge_pdfs_command_returns_file_read_error_for_missing_path() {
        let other_path = temp_file_path("merge-existing.pdf");
        std::fs::write(&other_path, generate_test_pdf_bytes(&["Page"])).unwrap();

        let err = bucket_merge_pdfs(
            vec![
                "/nonexistent/path/umbra-test.pdf".to_string(),
                other_path.clone(),
            ],
            temp_file_path("merge-missing-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-read-error");

        std::fs::remove_file(&other_path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_pdf_pages_command_extracts_a_real_range_end_to_end() {
        let path = temp_file_path("extract-pages.pdf");
        let output_path = temp_file_path("extract-pages-out.pdf");
        std::fs::write(
            &path,
            generate_test_pdf_bytes(&["Page 1", "Page 2", "Page 3"]),
        )
        .unwrap();

        bucket_extract_pdf_pages(path.clone(), 2, 3, output_path.clone())
            .await
            .unwrap();

        let extracted_bytes = std::fs::read(&output_path).unwrap();
        let extracted = Document::load_mem(&extracted_bytes).unwrap();
        assert_eq!(extracted.get_pages().len(), 2);

        std::fs::remove_file(&path).unwrap();
        std::fs::remove_file(&output_path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_pdf_pages_command_rejects_an_out_of_bounds_range() {
        let path = temp_file_path("extract-pages-oob.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["Page 1"])).unwrap();

        let err = bucket_extract_pdf_pages(
            path.clone(),
            1,
            5,
            temp_file_path("extract-pages-oob-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "bucket-pdf-invalid-range");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_pdf_pages_command_returns_file_read_error_for_missing_path() {
        let err = bucket_extract_pdf_pages(
            "/nonexistent/path/umbra-test.pdf".to_string(),
            1,
            1,
            temp_file_path("extract-pages-missing-out.pdf"),
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn bucket_extract_pdf_text_command_extracts_real_text_end_to_end() {
        let path = temp_file_path("extract-text.pdf");
        std::fs::write(&path, generate_test_pdf_bytes(&["Hello Umbra PDF"])).unwrap();

        let text = bucket_extract_pdf_text(path.clone()).await.unwrap();
        assert!(text.contains("Hello Umbra PDF"));

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_pdf_text_command_rejects_a_file_over_the_size_limit_without_reading_it()
    {
        let path = temp_file_path("extract-text-oversized.pdf");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INPUT_BYTES as u64 + 1).unwrap();
        drop(file);

        let err = bucket_extract_pdf_text(path.clone()).await.unwrap_err();
        assert_eq!(err.code, "bucket-input-too-large");

        std::fs::remove_file(&path).unwrap();
    }

    #[tokio::test]
    async fn bucket_extract_pdf_text_command_returns_file_read_error_for_missing_path() {
        let err = bucket_extract_pdf_text("/nonexistent/path/umbra-test.pdf".to_string())
            .await
            .unwrap_err();
        assert_eq!(err.code, "file-read-error");
    }

    #[tokio::test]
    async fn map_join_error_produces_bucket_internal_tool_error_on_panic() {
        let err = tauri::async_runtime::spawn_blocking(|| {
            panic!("boom");
        })
        .await
        .unwrap_err();

        let tool_err = map_join_error(err);
        assert_eq!(tool_err.code, "bucket-internal");
    }
}
