---
baseline_commit: d576c3e
---

# Story 8.7: Reimagine the Bucket — OCR

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer,
I want to reconsider the Bucket's OCR sub-feature through open discovery before redesigning its UI,
so that the redesign reflects a deliberately chosen scope, not a visual reskin of whatever shipped first.

## Acceptance Criteria

**This story ships in two gated tasks (epics.md's own shared Epic 8 shape). Task 1's ACs below are real and testable now. Task 2 (redesign) has no ACs yet — writing them before Task 1's decision record exists would be fiction, per epics.md's explicit instruction — they are added to this story file as a follow-up edit (Task 2a) once Task 1 completes, exactly as Stories 8.1–8.6 did.**

1. **Given** open scope discovery is run for the Bucket's **OCR** sub-feature (`bmad-party-mode` or `bmad-forge-idea` — the developer chooses which for this story; a second, narrower pass may follow), framed explicitly as reconsidering the sub-feature's scope from first principles, **when** discovery concludes, **then** a written decision record exists at `_bmad-output/implementation-artifacts/8-7-ocr-decision-record.md` stating what is **kept, changed, added, and cut** relative to today's shipped implementation, with rationale for each call — the existing implementation is reference only, not a decision to preserve by default. Today's shipped implementation, to be reconsidered rather than assumed, is enumerated in Dev Notes below and **must be re-read in full at session start** to confirm no drift.

2. **Given** the decision record, **when** it is produced, **then** it states whether **FR23, FR24, FR25 and FR26** remain accurate, are revised, or are expanded — Epic 8's own preamble makes this revision each story's own output, not predicted in advance. (FR23 — a drop zone accepts PNG/JPEG/WebP plus pasted screenshots and extracts text via a local ONNX model, INV-1; ONNX chosen over macOS Vision for NFR3 portability. FR24 — extracted text shown editable with one-click copy; a typical screenshot completes in under ~3 s on Apple Silicon. FR25 — OCR supports English in v1, plus the AD-13 coupling rule and its 2026-08-23 French amendment. FR26 — failed or empty extractions state so explicitly rather than showing a blank result.) **Any FR revision must be propagated to `prd.md` and `epics.md` in the same story** — Story 8.6 recorded an FR revision in its decision record only, and the resulting upstream drift needed a whole correct-course pass (`sprint-change-proposal-2026-09-06.md`) to clear. Do not repeat that.

3. **Given** any idea considered and cut during discovery, **when** the decision record lands, **then** it is captured as a public backlog candidate (FR35) — filed as an individual, max-context GitHub issue on `dipaneb/umbra` with the `backlog-candidate` label per this project's idea-capture convention (cf. Story 8.5's issues #120–#125, Story 8.6's #130), each linking back to the decision record — **or**, if the developer explicitly directs otherwise (as they did for Stories 8.3, 8.4 and partly 8.6), captured in their own tracked backlog and the deviation logged here and in the record so the ideas are traceable, not silently dropped.

4. **Given** the Bucket is the **first Epic 8 tool that is not a self-contained island**, **when** the decision record completes, **then** it resolves — explicitly, as named decisions, not as side effects — the four coupling questions that no prior Epic 8 story faced. This AC exists because `epics.md`'s Epic 8 preamble asserts "No ordering dependency between the 9 stories"; that is true of 8.1–8.6, each of which owned a private view file, and **false of 8.7–8.9, which share one 713-line `BucketView.vue`**. Story 8.7 is the first of the three and therefore inherits these decisions whether or not it wants them:

   - **4a — Container shape for all three sub-features.** Today `BucketView.vue` is one flat scroll: OCR section → `.pdf-section` → `.image-section`, separated by `border-top` hairlines. The decision record must state the target container (one enriched view / `AppTabs.vue` / three separate registry tools / something else) **and say explicitly whether that decision binds Stories 8.8 and 8.9**. If it does bind them, say so, so 8.8/8.9's own Task 1s inherit rather than relitigate. If 8.7 deliberately defers it, say that too, and name what 8.8 must decide instead. `AppTabs.vue` currently has exactly one consumer (`JsonView.vue`, Story 8.1, which earned tabs on genuine multi-job); five consecutive stories then rejected tabs because each was one job. The Bucket is genuinely three jobs — this is the strongest tabs candidate since 8.1, and equally the strongest "these were never one tool" candidate.
   - **4b — File split.** Whether `BucketView.vue` splits (e.g. `BucketOcr.vue` / `BucketPdf.vue` / `BucketImages.vue` under `src/tools/bucket/`) and, if so, whether 8.7 performs the whole split or only extracts the OCR section. A split is the difference between 8.8/8.9 being independent stories and being merge-conflict partners. `BucketView.spec.ts` (711 lines, 33 `it()`, three `describe` blocks already partitioned as root / `"PDF section"` / `"Image section"`) splits along the same seam.
   - **4c — Registry, drop, paste and clipboard-match ownership (AD-5, AD-14).** The single `bucket` registry entry carries `drop: { acceptedMimeTypes: [], handler: "bucket_extract_text" }`, `paste: { handler: "bucket_extract_text_from_clipboard" }`, `clipboardMatch: { test: matchesImage, specificity: 4 }`, and 16 aliases spanning all three sub-features (`ocr`, `screenshot`, `pdf`, `merge`, `image`, `convert`, `compress`, `png`, `jpeg`, `webp`, plus French). **All three behavioural declarations are OCR-only**; PDF and Images reach the filesystem through their own `open()`/`save()` dialogs and never touch drop or paste. If the tool splits into multiple registry entries, these move to the OCR entry, the alias list partitions, and `⌘K` search results change shape. That is a **shell** change (`DropZone.vue`, `src/shell/clipboardMatch.ts`, `src/stores/registry.ts`), not an island change — the first in Epic 8. If the tool does **not** split, record that the declarations stay put and why.
   - **4d — AD-16 runner scoping under the chosen container.** Today's arrangement is deliberate and documented in-file: OCR has **no local runner** — `DropZone.vue` owns `registry.getLatestWinsRunner("bucket")` and this view only consumes `registry.dropResult` / `registry.pasteResult` one-shot signals (the `HashView.vue` reference shape); PDF has **one** local `createLatestWinsRunner()` (`runPdf`); Images has **two** (`runImageEstimate`, `runImageConvert`, split because a slider-driven live estimate and a save-to-disk convert can overlap). Any container or split change must re-derive this from AD-16's amended rule — *one runner per independent piece of state* — rather than carrying the current shape forward by inertia.

5. **Given** the chosen scope, **when** the decision record completes, **then** it states, for the AD-1 functional-core split that Task 2 builds directly on:
   - what stays in / moves into `crates/umbra-core/src/ocr.rs` (pure, dependency-clean, `oar-ocr` behind the `OcrEngine` trait per **AD-8**, no filesystem access per **AD-2**/**AD-15**),
   - what the `src-tauri` command layer owns (`bucket_extract_text`, `bucket_extract_text_from_clipboard`, `spawn_blocking` per **AD-4**, the `OnceLock` engine init per **AD-16**, model-path resolution, the `check_file_size` guard),
   - what is view-owned formatting (**AD-1**),
   - and **whether the `OcrEngine` trait signature changes.** AD-8 binds this trait to FR29's future second AI feature ("a future structured-extraction feature can reuse or extend this trait shape without a rename" — `ocr.rs`'s own module doc). A trait change here has forward consequences for Story 6.4; a trait change is allowed, but must be a recorded decision, not incidental.

6. **Given** Task 1 has not yet produced its decision record, **when** this story starts, **then** Task 2 (redesign, and its own Given/When/Then acceptance criteria) has not begun — no implementation starts before the decision record exists. **Boundary note from epics.md: Task 1 gates Task 2.**

## Acceptance Criteria — Task 2 (Redesign)

**Written at Task 2a (2026-09-07), scoped strictly to `8-7-ocr-decision-record.md` plus the developer's three opening calls this session (sequencing, the `useCopyFeedback` hoist, the asset-protocol scope). Per the developer's sequencing call, AC7–AC30 — which have no visual dependency — were written first, then the design canvas was built, then AC31–AC42 were written from its picks; one sign-off covers the whole set. Every non-island file this set authorises is enumerated in *Authorised file surface* below; that table is normative, not a summary. Design canvas: <https://claude.ai/code/artifact/cd67d1db-4126-41a6-a9bb-d5c2cb9969f5> — nine artboards, resolving the record's open items #3, #4, #5, #11 and #14.**

### Group A — The split (AC4a–4c executed)

7. **Given** the `bucket` registry entry today declares `drop`, `paste` and `clipboardMatch` — all three OCR-only — under one id spanning three unrelated tools, **when** Task 2b completes, **then** `src/stores/registry.ts` contains **three** entries in place of it: `ocr` (`name: "Image to Text"`), `pdf` and `image`; the `bucket` entry and the `/tools/bucket` route no longer exist; `drop`, `paste` and `clipboardMatch` (`test: matchesImage, specificity: 4`) sit on the `ocr` entry **only**; and the 16 aliases partition as **OCR** — `ocr`, `screenshot`, `text`, `capture d'écran`, `texte` — **PDF** — `pdf`, `merge`, `split`, `fusionner`, `diviser` — **Images** — `image`, `convert`, `compress`, `png`, `jpeg`, `webp`, `convertir`, `compresser`. The retired `bucket` alias is not carried onto any entry. **Verifiable:** typing `merge` in `⌘K` returns a result named for the PDF tool, and typing `ocr` returns "Image to Text" — neither returns "Bucket", because no such tool exists.

8. **Given** `src/tools/bucket/BucketView.vue` is one 713-line flat scroll of three unrelated tools, **when** Task 2b completes, **then** it is deleted and replaced by `src/tools/ocr/OcrView.vue`, `src/tools/pdf/PdfView.vue` and `src/tools/image/ImageView.vue`, each reachable at its own route; `src/tools/bucket/` no longer exists; `ocrOutcome.ts` moves to `src/tools/ocr/` and `imageTargetFormat.ts` to `src/tools/image/`. **PDF and Images move verbatim** — their `<script>` logic, template markup and `<style>` rules are transplanted unchanged, including `pdfFilters()` being a function not a const, the two Images runners, the 200 ms debounced estimate and its `onUnmounted` cancel, and every in-file comment. No tokenisation, no `AppButton`, no command rename, no copy change in the moved sections; 8.8 and 8.9 own their improvement.

9. **Given** Amelia's move gate — *if a moved PDF or Images test needs rewriting, it stopped being a move* — **when** `BucketView.spec.ts`'s 33 `it()` blocks are split, **then** the **13** blocks in `describe("PDF section")` and the **8** in `describe("Image section")` move to `src/tools/pdf/PdfView.spec.ts` and `src/tools/image/ImageView.spec.ts` **with nothing changed but the import path and the mount target** — every assertion string, every mock, every `bucket_*` command name they invoke stays byte-identical. The **12** root-`describe` OCR blocks move to `src/tools/ocr/OcrView.spec.ts` and are rewritten against the new shape (AC28 governs which behaviours must survive that rewrite and which are deliberately retired). A moved PDF/Images assertion that had to change is a failed AC9, not a judgement call.

10. **Given** AD-3 requires `<tool>_<verb>` and there will be no tool called bucket, **when** Task 2b completes, **then** OCR's own command and error names — and only its own — are corrected: commands `bucket_extract_text` → `ocr_extract_text` and `bucket_extract_text_from_clipboard` → `ocr_extract_text_from_clipboard` (both `use` lines and both `generate_handler!` entries in `src-tauri/src/lib.rs` follow); `src-tauri/src/commands/bucket.rs` → `src-tauri/src/commands/ocr.rs`; codes `bucket-engine-init-failed` → `ocr-engine-init-failed`, `bucket-malformed-image-buffer` → `ocr-malformed-image-buffer`, `bucket-malformed-request` → `ocr-malformed-request`, `bucket-ocr-failed` → `ocr-extraction-failed`, `bucket-unsupported-format` → `ocr-unsupported-format`. **`bucket-internal` and `bucket-input-too-large` are NOT renamed** — verified in-session that `commands/pdf.rs` and `commands/image.rs` emit both, so renaming them would rewrite tests in two tools that must move verbatim (AC9). OCR instead emits **new** codes `ocr-internal` and `ocr-input-too-large` at its own call sites; the `bucket-*` pair stays live for PDF and Images until 8.8/8.9 retire it. The nine remaining `bucket_*` PDF/Images commands are untouched.

### Group B — Shell surface

11. **Given** the OCR view must display the source image, and **verified this session** that Tauri 2.11.5's asset protocol consults `app.asset_protocol_scope()` alone and never the capability ACL (`tauri-2.11.5/src/protocol/asset.rs`), **when** Task 2b completes, **then** `src-tauri/tauri.conf.json` declares `app.security.assetProtocol` with `enable: true` and a **statically empty** `scope`, and the Rust side grants access **one file at a time**: on each accepted drop or picker selection the command layer calls `asset_protocol_scope().allow_file(path)` for that path and `forbid_file(...)` for the previously granted one, so the webview can read exactly the file the user just handed it and nothing else. **The `tauri-plugin-persisted-scope` plugin is NOT added** — it writes granted paths to disk across restarts, which contradicts this story's own "a second drop replaces the first, nothing accumulates" decision. `src-tauri/capabilities/default.json` is **not** modified; the CSP line already permits `asset:` / `http://asset.localhost` (Story 8.2) and is not modified either. **Verifiable:** a path never handed to the tool is refused by the protocol, and the grant does not survive a restart.

12. **Given** the paste path has **no file on disk** — `DropZone.vue`'s `dispatchPaste` reads `{ rgba, width, height }` via `readClipboardImage()`, ships the bytes as a raw IPC body and discards them — so `convertFileSrc` has nothing to convert and Live Text would silently work on drop and pick but not on paste, **when** Task 2b completes, **then** the shell **publishes what it has already read**: `src/stores/registry.ts` gains a `pasteSourceImage` signal (`{ toolId, rgba, width, height }`, the same one-shot shape as the existing `dropSourcePath`), `src/shell/DropZone.vue` sets it alongside `pasteResult` on success and clears it on error, and the view renders it via `ImageData` on a canvas. **The view does not read the clipboard itself** — AD-14 gives the shell the OS I/O edge exactly once, `navigator.clipboard` is forbidden, and a second read is racy because the clipboard may have changed during the ~3 s inference. **Verifiable:** pasting a screenshot shows that screenshot, not a blank surface.

13. **Given** `EXPERIENCE.md` Flow 2 step 5 scripts the demo around a file-picker that has never existed, and keyboard-only OCR today requires an image already on the clipboard, **when** Task 2b completes, **then** `OcrView.vue` has an `open()` file picker that is reachable and operable by keyboard alone, and it is a **third** write-trigger on the same extraction state alongside drop and paste. Per AD-16's amended one-runner-per-independent-state rule, the view calls `registry.getLatestWinsRunner("ocr")` **directly** (the first view in the codebase to do so) rather than creating a local runner, so a pick landing after an in-flight drop supersedes it. **Verifiable:** the whole extract-and-copy flow completes with no pointer and nothing pre-placed on the clipboard (NFR5).

14. **Given** the resting state is the most-seen state in the app and is currently a sentence where an affordance should be, **when** Task 2b completes, **then** `src/shell/DropZone.vue` exposes a drag-enter state the active tool's view can consume (a `registry`-published boolean, set on the webview's `dragEnter`/`dragLeave`/`dragOver` payload types and cleared on `drop` and on cancel), so the OCR view's drop target can highlight while a drag is over the window. Drop dispatch itself stays window-level and unchanged — the target is an affordance, not a hit area. `src/shell/dropZone.ts` gains whatever pure routing helper this needs, with `dropZone.spec.ts` coverage. The visual treatment of the highlight is AC31+'s.

15. **Given** `src/tools/json/useCopyFeedback.ts` has carried a hoist-candidate comment since Story 8.1 and five consecutive stories declined the hoist on the grounds that they were not shared-infrastructure stories, and **given** 8.7 is one, **when** Task 2b completes, **then** it moves to `src/shell/useCopyFeedback.ts` (with its spec) — the destination `src/shell/debounce.ts` already establishes: a generic view-level utility in `shell/`, imported by tool islands. All **seven** existing import sites update to the new path (`json/JsonView.vue`, `json/JsonTree.vue`, `base64/Base64View.vue`, `uuid/UuidView.vue`, `hash/HashView.vue`, `jwt/JwtView.vue`, `cron/CronView.vue`), `OcrView.vue` becomes the eighth, **no re-export shim is left behind**, and the hoist-candidate comment is deleted rather than reworded. Behaviour is unchanged: no test in any of those five islands may need an assertion change.

### Group C — The core trait and the command layer (AC5 executed)

16. **Given** `OcrOutcome { text: String, confidence: Option<f32> }` destroys, at the core boundary, per-region data the adapter already holds — `run_ocr` builds two parallel vectors, averages one and joins the other — **when** Task 2b completes, **then** `crates/umbra-core/src/ocr.rs` returns a region-structured outcome from **both** `OcrEngine` methods:

    ```rust
    pub struct OcrOutcome {
        pub regions: Vec<OcrRegion>,
        /// Dimensions of the image recognition actually ran against, AFTER EXIF
        /// orientation is applied (AC18) — the space `OcrRegion` coordinates live in.
        pub image_width: u32,
        pub image_height: u32,
    }
    pub struct OcrRegion {
        /// `None` means the detector found a text region and recognition FAILED on it —
        /// never "was filtered for being uncertain" (recognition `score_threshold` is 0.0,
        /// so nothing is discarded). Kept, not skipped: see AC17.
        pub text: Option<String>,
        pub confidence: Option<f32>,
        /// `TextRegion.bounding_box.points`, verbatim, in `image_width`/`image_height` space.
        pub polygon: Vec<OcrPoint>,
    }
    pub struct OcrPoint { pub x: f32, pub y: f32 }
    ```

    `dt_poly`, `rec_poly`, `word_boxes`, `label` and `orientation_angle` do **not** cross the boundary — the first two are redundant with `bounding_box` for this use, `word_boxes` is unpopulated (`return_word_box = false`), `label` is unused, and `orientation_angle` is always `None` in our configuration. **No whole-text accessor is added to core** (AD-1: joining regions into one string for a Copy button is presentation); the view derives it. `src/tools/ocr/ocrOutcome.ts` is updated as the hand-synced TS mirror of the whole shape. The change is **subtraction** — the adapter stops discarding — not new computation.

17. **Given** the empty-outcome contract is FR26 / Story 4.3's honesty guarantee, **when** the shape changes, **then** "no text found" stays anchored to **text**, not to region count: the state fires when no region carries a `Some(text)` with non-whitespace content. A region whose `text` is `None` is **retained in `regions`** so the view can mark it on the image — which makes "no text found" on an image visibly full of text a diagnosis (*we located writing here and could not read it*) rather than today's lie of omission. `run_ocr`'s current `if let Some(text) = &region.text` skip is removed.

18. **Given** `image::load_from_memory` is `ImageReader::with_guessed_format().decode()` and **`decode()` does not apply EXIF orientation** — the crate requires calling `orientation()` / `apply_orientation()` explicitly, and we never have — so a phone photo taken sideways reaches the detector rotated 90°, detection largely fails, and the user is told "no text found" about an image full of text, **when** Task 2b completes, **then** `extract_text` reads the decoder's EXIF orientation and applies it **before** recognition, and `image_width`/`image_height` (AC16) report the **oriented** dimensions. A new fixture carrying real EXIF rotation is added, and its test asserts the text is recovered — not merely that the call returned `Ok`. The RGBA clipboard path is unaffected (already-decoded pixels carry no EXIF).

19. **Given** `OarOcrEngine::new` calls `OAROCRBuilder::new(det, rec, dict).build()` and nothing else — six inherited defaults, in the app's only AI feature — and **given, verified against the vendored `oar-ocr-0.6.3` source during Task 2b's overlay spike, that `build()` wraps the entire `general` preset in `if !has_explicit_det_cfg`**, so passing a `TextDetectionConfig` **at all** opts out of *every field of it*, and `TextDetectionConfig::default()` does **not** reproduce it — `unclip_ratio` 2.0 → 1.5, `max_side_len` 4000 → `None`, and, most seriously, `limit_type` `Max` → `None`, which `DetResizeForTest` resolves to **`Min`** and thereby *inverts* the resize, so `limit_side_len` stops capping the long side and starts padding the short side up to it (measured: a 1520×920 image upscaled to ≈2645×1600 instead of being left alone) — **when** Task 2b completes, **then** the detection pipeline is configured explicitly for the first time and **states all seven fields, none inherited**: `score_threshold = 0.3`, `box_threshold = 0.6`, `unclip_ratio = 2.0`, `max_candidates = 1000`, `max_side_len = 4000` and `limit_type = Max` — each carrying an in-file comment saying it reproduces today's shipped `general` preset rather than being chosen afresh — plus **`limit_side_len = 1600`**, the one deliberate change (raised from the inherited 960; a 3024 px screenshot goes from a 3.1× downscale to 1.9×). `.text_recognition_config(...)` sets **`max_text_length` explicitly** to the value AC20 establishes. Recognition `score_threshold = 0.0` (nothing filtered, and load-bearing for AC17), `return_word_box = false`, no text-line orientation classifier and no execution provider all remain the shape, each with an in-file comment saying so. **A value that reaches the engine without an in-file comment saying why it holds that value is a failed AC19** — and a `..Default::default()` struct-update in the detection config is a failed AC19 *by construction*, because that is exactly how the preset is silently lost.

20. **Given** `max_text_length` is genuinely ambiguous in the vendored source — `TextRecognitionConfig::default()` says 25, the predictor builder says 100, the crate's own test fixture says 128 — and if 25 bounds CTC decoding then long lines truncate silently while every existing fixture assertion is `contains("UMBRA")` on a short fixture, **when** Task 2b completes, **then** a test extracts a fixture line **well over 25 characters** and asserts the **full string** survives. **This test lands regardless of its outcome.** If it fails, that is a shipping bug more severe than the reading-order one and setting the value explicitly is the fix; if it passes, the explicit setting is what stops it drifting. Asserting "it extracted something" is a failed AC20.

21. **Given** `run_ocr` emits `lines.join("\n")` in the model's **detection** order rather than reading order — a latent bug since Story 4.1, invisible because the tool never showed the image and every assertion is `contains("UMBRA")` — and given one sort serves three requirements (Copy fidelity, screen-reader DOM order under NFR5, and `⌘F` match ordering), **when** Task 2b completes, **then** `regions` are sorted geometrically **in core** before they leave it, to this bounded definition: regions whose vertical centres fall within a tolerance derived from their own height are banded into one row; rows are ordered top-to-bottom; regions within a row are ordered left-to-right. **The stated limit is part of the AC:** this handles a dialog's button row, a sidebar and an interleaved layout; it does **not** claim to handle a true multi-column magazine spread, which needs layout analysis (Cut #3). A fixture with genuinely interleaving regions asserts the **full ordered string**, not `contains`.

22. **Given** one shared `OAROCR` sits behind `&self` and a superseded latest-wins request still runs to completion, so two inference jobs genuinely overlap, **when** Task 2b completes, **then** this is **recorded, not fixed**: `Sync` is compiler-enforced so it is safe, and whether two concurrent ONNX sessions contend badly on CPU is unmeasured. An in-file comment in the command layer states the overlap explicitly, and the question is revisited only if the AC23 corpus shows contention. Adding cancellation is out of scope.

### Group D — Recognition quality

23. **Given** this story raises `limit_side_len`, adds a reading-order sort, applies EXIF orientation and may touch `max_text_length` — and the only quality signal in the codebase today is `contains("UMBRA")` on one short fixture — **when** Task 2b completes, **then** a quality regression corpus exists under `crates/umbra-core/tests/fixtures/`, covering at minimum: a Retina-resolution error dialog, a photo of a document, a two-column or otherwise interleaved layout, and a scan. Each fixture asserts its **expected text**, with an explicit, documented tolerance model — normalise whitespace and case, and assert per-line containment against an expected ordered line list rather than byte equality, since OCR output is not byte-exact. **Ordering is asserted separately from content**, so a reading-order regression fails distinctly from a recognition regression. This corpus is what converts the model-tier revisit gate from a judgement into a measurement, and it is what lets anyone who is not the developer touch this pipeline.

### Group E — Errors, voice and i18n

24. **Given** `ocr-unsupported-format` currently renders the **`image` crate's own raw English decode error** — the single most-hit error in the tool, reached by dropping any non-image — and given the format claim has been *under*-stating the code since Story 4.1 (`image`'s `default-formats` decodes fifteen formats, TIFF and BMP included, while FR23, the registry description and the drop hint all said "PNG, JPEG, or WebP"), **when** Task 2b completes, **then** the code carries a project-authored, value-free, **non-enumerating** sentence — *"That file isn't an image this tool can read."* — it joins `TRANSLATABLE_CODES` in `src/shell/toolError.ts`, and it gains an `errors.ocr-unsupported-format` key in **both** `src/locales/en.json` and `src/locales/fr.json`. Story 4.3's corrupt-PNG test, which currently asserts on the `image` crate's phrase *"unexpected end of file"*, is updated to assert the code rather than third-party prose.

25. **Given** the developer predicted users will try dropping PDFs and today that fails with the `image` crate's raw decode error, **when** Task 2b completes, **then** a PDF is recognised by **magic bytes** (`%PDF-`) before decode is attempted and answered with its own project-authored code and sentence — *"PDFs open in the PDF tool."* — which also joins `TRANSLATABLE_CODES` with keys in both locales. **It is a sentence, not a routing offer** — developer's call, 2026-09-07, and the reason is theirs: *a button would be a good idea, but it cannot route to somewhere that is not built yet.* A navigation button is cheap (`router.push`, no dependency) and would land the user on an empty PDF view to re-pick the file they just dropped — implying a hand-off the app does not have. Carrying the file across is the version worth building, and it is handed to **Story 8.8**, which will know what the PDF tool's entry state looks like after its own redesign. No new Rust dependency: a byte check and a string.

26. **Given** 8.6's stated criterion for `TRANSLATABLE_CODES` — *a fixed, value-free sentence we wrote ourselves* — **when** it is applied to every OCR code, **then** exactly the two codes in AC24 and AC25 are added, and each exclusion is recorded in `toolError.ts`'s own comment with its reason: `ocr-engine-init-failed` and `ocr-internal` wrap a Rust error; `ocr-extraction-failed` wraps `oar-ocr`'s; `ocr-input-too-large` and `ocr-malformed-image-buffer` embed byte counts and dimensions; and **`ocr-malformed-request` is excluded for a distinct reason worth stating** — it carries **four** different sentences (missing header / header not UTF-8 / header not a `u32` / JSON body where raw bytes were expected) under **one** code, so a single `errors.<code>` lookup cannot express it without splitting the code four ways or misreporting three of the four, and it is unreachable by users in any case since it fires only if our own shell sends a malformed IPC request. "Not yet done" is not an acceptable recorded reason for any exclusion.

27. **Given** the `tools.bucket.*` block holds 32 keys serving three tools, **when** Task 2b completes, **then** it is partitioned into `tools.ocr.*`, `tools.pdf.*` and `tools.image.*` in both locales with `en`/`fr` parity preserved (`src/locales/locales.spec.ts` compiles every message and is the gate); the 16 PDF keys and 11 Images keys move **verbatim** under their new prefix, `tools.bucket.description` is replaced by three real descriptions rather than the current inventory sentence, and `dropHint` is rewritten format-agnostically (*"Drop an image"*, not an enumeration). Any new string containing `{` or `}` uses vue-i18n's `{'{'}` / `{'}'}` escape.

### Group F — Icons, tests and the gate

28. **Given** `src/shell/icons.ts` is a `Record<IconName, Component>` so a missing entry is a compile-time error, **when** Task 2b completes, **then** `IconName` drops `"bucket"` and gains `"ocr"`, `"pdf"` and `"image"`, each mapped to a Phosphor pictogram (DESIGN.md's Base64 `64` glyph remains the one deliberate non-pictogram exception), and `src/shell/icons.spec.ts`'s coverage assertion follows. Provisional `name` values ship for the PDF and Images entries on day one — 8.8 and 8.9 may rename them, but the registry cannot hold a placeholder.

29. **Given** existing OCR coverage encodes behaviours that must survive a shape change, **when** `OcrView.spec.ts` and the Rust tests are rewritten, **then** every one of these is still covered: real-fixture end-to-end extraction on **both** entry points; oversize rejection **without reading the file**; non-image rejection; corrupt/truncated input → `ToolError` not panic, **plus a new near-full-length truncation case** (gap #6 — a materially different `image`-crate decode path); missing path → read error; the 8-thread `OnceLock` race (`src-tauri/tests/ocr_engine_race.rs`, renamed with its command module); the clipboard RGBA round-trip, oversize and malformed-length cases; a drop or paste result routed to a different tool being ignored; and the explicit no-text-found state. **Two behaviours are deliberately retired, and only these two:** *"lets the extracted text be edited, and Copy writes the current edited value"* and *"re-seeds the editable field from a new outcome, discarding unsaved edits"* — both describe the `<textarea>` this story removes, and the second describes a stale-snapshot bug class (8.6's lesson 5) that removing it structurally dissolves.

30. **Given** NFR5 is behavioural and checked at PR review, **when** Task 2b completes, **then** a real `pnpm tauri dev` screen-reader pass is performed and recorded in the Dev Agent Record — covering the pre-existing, never-manually-verified no-text-found `role="status"` region (gap #5) **and** the in-flight start/completion announcements this story adds. A passing Vitest spec does not satisfy this AC. The full local gate (`pnpm lint` · `pnpm exec vue-tsc --noEmit` · `pnpm test` · `pnpm build` · `cargo fmt --check` · `cargo clippy --workspace --all-targets -- -D warnings` · `cargo test --workspace`) passes before every commit, and every slice gets a render review in **both** light and dark.

### Authorised file surface (normative — AC7–AC42)

**Built at Task 2a from a repo-wide sweep (`grep -rli bucket`, excluding `_bmad-output/` and vendored trees), not from a recollection of what the split touches. Story 8.6's equivalent list was found incomplete twice — once at correct-course, once at code review — and the sweep found seven files beyond the set named in the story's own Project Structure Notes. Those seven are marked ⚠. A file touched in Task 2b that is not on this list is an AC gap to be raised, not absorbed.**

**New**

| File | Why |
| --- | --- |
| `src/tools/ocr/OcrView.vue`, `OcrView.spec.ts`, `ocrOutcome.ts` | AC8, AC16 — the redesigned tool |
| `src/tools/pdf/PdfView.vue`, `PdfView.spec.ts` | AC8, AC9 — verbatim move |
| `src/tools/image/ImageView.vue`, `ImageView.spec.ts`, `imageTargetFormat.ts` | AC8, AC9 — verbatim move |
| `src/shell/useCopyFeedback.ts` + `useCopyFeedback.spec.ts` | AC15 — the hoist |
| `src-tauri/src/commands/ocr.rs` | AC10 — renamed from `bucket.rs` |
| `crates/umbra-core/tests/fixtures/*` | AC18 (EXIF-rotated), AC20 (long line), AC21 (interleaved), AC23 (corpus) |

**Deleted**

| File | Why |
| --- | --- |
| `src/tools/bucket/` — `BucketView.vue`, `BucketView.spec.ts`, `ocrOutcome.ts`, `imageTargetFormat.ts` | AC8 |
| `src-tauri/src/commands/bucket.rs` | AC10 |
| `src/tools/json/useCopyFeedback.ts` (+ spec) | AC15 — moved, **no shim** |

**Modified — shell and cross-island (the AD-6 boundary this story stretches)**

| File | Why | |
| --- | --- | --- |
| `src/stores/registry.ts` | AC7 three entries; AC12 `pasteSourceImage` | |
| `src/stores/registry.spec.ts` | AC7 — asserts `["base64","bucket","json","jwt"]` and a `bucket` `clipboardMatch`; **breaks on the split** | ⚠ |
| `src/shell/icons.ts` + `icons.spec.ts` | AC28 — `IconName` loses `bucket`, gains three | |
| `src/shell/DropZone.vue` | AC12 publish paste image; AC14 drag-enter state | |
| `src/shell/dropZone.ts` | AC14 routing helper | |
| `src/shell/dropZone.spec.ts` | AC12, AC14 — and its `bucketTool` fixture hard-codes `bucket_extract_text*` and `bucket-malformed-image-buffer`; **breaks on the rename** | ⚠ |
| `src/shell/clipboardMatch.ts` | AC7 — the AC12-era comment names Bucket as the image-eligible tool | |
| `src/shell/toolError.ts` | AC24, AC25 additions; AC26 recorded exclusions | |
| `src/shell/AppSidebar.spec.ts` | AC7 — asserts the clipboard callout reads "Bucket" and links `/tools/bucket`; **breaks on the split** | ⚠ |
| `src/shell/CommandPalette.spec.ts` | AC7 — asserts the palette's 7 entries with "Bucket" active; **breaks on the split** | ⚠ |
| `src/locales/en.json`, `src/locales/fr.json` | AC24, AC25, AC27 | |
| `src/i18n.ts` | AC8 — its `decimal1` comment cites `BucketView.vue`, a file that ceases to exist | ⚠ |
| `src/tools/json/JsonView.vue`, `json/JsonTree.vue`, `base64/Base64View.vue`, `uuid/UuidView.vue`, `hash/HashView.vue`, `jwt/JwtView.vue`, `cron/CronView.vue` | AC15 — one import line each, **no behaviour change** | |

**Modified — Rust**

| File | Why | |
| --- | --- | --- |
| `crates/umbra-core/src/ocr.rs` | AC16, AC17, AC18, AC19, AC20, AC21 | |
| `src-tauri/src/lib.rs` | AC10 `use` + `generate_handler!`; AC11 the per-file scope grant | |
| `src-tauri/src/commands/mod.rs` | AC10 — `pub mod bucket;` → `pub mod ocr;` | ⚠ |
| `src-tauri/tests/ocr_engine_race.rs` | AC10 — imports `commands::bucket::{…}` | ⚠ |
| `src-tauri/Cargo.toml` | AC10 — three comments cite `bucket.rs` / `bucket_extract_text`; **comments only, and stale comments are 8.6's lesson 4** | ⚠ |

**Modified — config and docs**

| File | Why | |
| --- | --- | --- |
| `src-tauri/tauri.conf.json` | AC11 — `assetProtocol` enabled, empty static scope | |
| `docs/release-checklist.md` | AC7 — the AD-7 network-audit procedure and the manual QA step both name a "Bucket" tool that will not exist, and the QA step says "also exercise the PDF section" of a view being deleted | ⚠ |
| `.../ARCHITECTURE-SPINE.md` | The AD-14/AD-15 asset-protocol amendment, **owed at build time not before** (8.6 precedent), now recording AC11's per-file runtime grant rather than a static scope | |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Gaps #3, #5, #6 resolved (`:120`, `:121`, `:122`); gap #4 (`:116`) restated as deferred with **raised** priority, since the unchecked `as OcrOutcome` assertion now covers a nested region list | |

**Explicitly NOT modified — ruled out with a reason, not by omission**

| File | Why not |
| --- | --- |
| `src-tauri/capabilities/default.json` | **Verified**: `tauri-2.11.5/src/protocol/asset.rs` consults the scope only and never the capability ACL. The asset protocol needs no permission entry. |
| `crates/umbra-core/src/pdf.rs`, `image_convert.rs` | Their `bucket-pdf-*` / `bucket-image-*` codes are **deliberately kept** (AC10) — renaming them breaks AC9's verbatim-move gate. 8.8 and 8.9 retire them. |
| `src-tauri/src/commands/pdf.rs`, `commands/image.rs` | Same. They also emit `bucket-internal` / `bucket-input-too-large`, which is why AC10 **adds** `ocr-*` rather than renaming. |
| `src/components/AppTabs.vue` | AC4a resolved to three tools, not tabs. No consumer added. |
| `Cargo.toml` / `Cargo.lock` (dependency lines) | **No new Rust dependency** (AC25's PDF check is a byte comparison). The AD-7 `cargo tree -i reqwest` audit is therefore N/A, as it was for 8.5. |
| `tauri-plugin-persisted-scope` | Not added — AC11. It would persist granted paths to disk, contradicting "nothing accumulates". |

### Group G — The Live Text surface

**Written after the design canvas (2026-09-07), which resolved the decision record's open items #3, #4, #5, #11 and #14. Canvas: nine artboards — resting, drag-enter + in-flight, Live Text, low-confidence in light *and* dark, `⌘F`, no-text-found, error, and an image larger than the pane.**

31. **Given** the resting state is the most-seen state in the app and is today an `h1` plus one sentence with nothing to aim at, **when** Task 2b completes, **then** it is a visible drop target: a dashed-border area (`HashView`'s existing drop language, used here **literally** — 8.5 established that the dashed box means *drop* and must not be borrowed as decoration; this is the one place it belongs), containing an image glyph, the sentence, the **file picker inside it** as the keyboard path, and the paste hint as the third door. It occupies the **same frame** the image will occupy, so nothing jumps on drop.

32. **Given** AC14 exposes a drag-enter state from the shell, **when** a drag enters the window with the OCR view active, **then** the target's border goes **solid** `--color-accent-signature` and its fill takes `--color-accent-signature-tint`, in both themes, reverting on drag-leave, on drop and on cancel.

33. **Given** the ~3 s wait is a feedback problem rather than a speed problem, **when** an extraction starts, **then** the image renders **in the first frame** — before recognition returns — and an **indeterminate** indicator runs over it with a status line. The indicator is a travelling bar, **never a filling one**: ONNX inference reports no progress, and a bar advancing at an invented rate is a bluff about our own internals in an app built on *the Bucket never bluffs*. A `role="status"` announcement fires on start and on completion.

34. **Given** recognised regions carry polygons in `image_width`/`image_height` space (AC16), **when** the result renders, **then** each region becomes a **transparent, selectable** span positioned over the image, scaled by a **single uniform factor** (`renderedWidth / image_width`) applied to both axes. Spans sit in the DOM in the reading order core produced (AC21) — which is what makes a native drag-select from one region through to a later one pick up everything between them. **The extracted text is rendered exactly once**, on the image: no textarea, no second pane, no transcript below.

    **Each span is fitted to its own region using the region's own quadrilateral, not its axis-aligned bounding box.** Measured during Task 2b's spike against real detection output: `oar-ocr`'s `get_mini_boxes` returns a **rotated minimum-area rectangle**, and a photo of a document carries ~3.3° of genuine tilt — which across a 650 px line is ~37 px of vertical drift, a full line-height, enough to walk the span clean off the words by the end of the sentence. So, per region, in render space: the span is positioned at the quad's first point; its **target width** is the length of the quad's top edge; its `font-size` is the length of the perpendicular edge times a **single named calibration constant** — measured ink fills only 57–67 % of box height on screenshots and ~86 % on a document photo, so ≈**0.62** is the starting value, tuned once at a render review, and `font-size` taken as the region's *full* scaled height renders every span about half again too large; its `letter-spacing` is then adjusted so the span's **measured** rendered width matches the target width; and the whole span is rotated by `atan2` of the top edge, `transform-origin` at that same first point. **At 0° this degenerates exactly to the axis-aligned case**, so screenshots are unaffected and there is one code path, not two.

    Width-fitting is what makes a browser-native selection highlight land on the words underneath, and anything that highlights *part* of a region (AC38's match marking) inherits exactly that accuracy. It is achievable, and the spike measured why: ink fills **97 % of the region's width**, median, so `unclip_ratio = 2.0`'s expansion barely touches the axis a selection highlight cares about — the systematic overshoot lands on *height*, which the calibration constant absorbs. A span that is not width-fitted, or that ignores the quad's tilt, produces selection highlights visibly offset from the pixels — the one failure mode that would make Live Text feel broken rather than approximate. Per-word geometry is **not** available to do better: `return_word_box` is `false` (AC19) and enabling it is Cut #4, so region-fitted text is the honest ceiling, and a render review is where its accuracy is judged. **The skew angle used here is not `orientation_angle`** — that is line-*orientation classification*, it needs a third bundled model, and it stays cut (Cut #7); the fine angle is derived from the bounding polygon this story already carries across the core boundary (AC16), at no extra cost and with no new model.

35. **Given** an image can be far larger than the pane, **when** it renders, **then** it is **fit to the pane** — whole image always visible, aspect preserved, **no zoom, no pan, no scroll** — and an image **smaller** than the pane renders at **natural size and is never upscaled**. One scale factor, one coordinate transform: zoom would add a second transform, scroll-position synchronisation and a viewport model, for a job that ends the moment the user pastes. `⌘F` (AC38) is the answer to "now it's too small to find".

36. **Given** FR26's honesty must become continuous rather than terminal, **when** regions render, **then** two markers appear **on the image** and **no confidence number is ever shown**: a region scoring below a single **named threshold constant** — **`LOW_CONFIDENCE_THRESHOLD = 0.90`**, developer's call 2026-09-07, chosen against measurement rather than taste (the design canvas had proposed 0.75, which the measurements showed to be too permissive) — gets a **dotted underline**, and a region whose `text` is `None` — found by the detector, failed by the recogniser — gets a **dashed outline box**. The two signals differ in **shape, not hue**, so they survive a colour-blind viewer and a greyscale screenshot (DESIGN.md's diff-colour precedent: icons and strikethrough carry the signal independently of colour). Both are verified in **light and dark** at a render review. This is honest by construction because recognition's `score_threshold` stays `0.0` (AC19) — the view sees every region the model saw.

    **The threshold's evidence, and the limit it does not cross** (measured at Task 2b, replacing this AC's original unevidenced 0.75): out-of-vocabulary regions score `⌘` **0.0000**, `⇧` **0.4961**, `⌥` **0.5203**, `⌘⇧⌥⌃` **0.6451**, `⌘V` **0.8909**; the 36 correctly-recognised regions across the quality corpus score **0.9504 minimum**, 0.9879 median. So 0.90 marks every out-of-vocabulary region measured — including the two-character `⌘V` case at 0.8909, which both 0.75 and 0.89 would have missed — with **zero false positives** on real text. It sits in a wide gap: 0.25 above the worst garbage region, 0.05 below the lowest correct one.

    **What this marking cannot do, stated because the original rationale over-claimed it.** This AC previously framed low-confidence marking as the primary defence against FR26 "confident nonsense". It is not, and cannot be: region confidence is the **arithmetic mean of per-character probabilities** (`oar-ocr-core-0.6.3/src/processors/decode.rs:236`), so one wrong character in a long line is arithmetically invisible. Measured on the same image, the line *"…or paste (⌘V), to extract its text."* — with `⌘` read as `8` — scored **0.9735** against **0.9763** for the identical line without the symbol. No threshold separates those, since correct regions run down to 0.9504. The corpus already contains an unflagged instance: `Request-Id:4f2a9c1e` recognised as `4f2a9c**l**e` at 0.9531. Catching intra-region substitutions requires **per-character confidence**, which `oar-ocr` computes and averages away before it reaches any public type — filed as backlog candidate [**#135**](https://github.com/dipaneb/umbra/issues/135), not a tuning knob. **The real defence against a confidently-wrong character is architectural, and this story already ships it:** Live Text renders the recognised text *on the pixels*, so the `8` sits directly over a visible `⌘` and the user's eye is one glance from the truth.

37. **Given** the job is copy-and-leave, **when** a result is on screen, **then** **"Copy all text"** is a **24px ghost icon-button** pinned to the image's top-right — the anatomy already used by JsonTree, Base64View, HashView, JwtView and CronView, with `useCopyFeedback` confirmation (AC15) and an `aria-label` carrying the name — **not** a labelled button competing with the surface it sits on, and **not** placed below the image where it would reopen a second zone. **`⌘A` with focus inside the overlay selects every recognised region**, so `⌘C` yields the whole result without touching the control and copy-and-leave has a pure keyboard path (NFR5).

38. **Given** the first job named was finding an error code in a dense screenshot, **when** `⌘F` is pressed with the OCR view active, **then** a find field opens in the **same top-right cluster** as Copy, filtering the recognised text and marking matches **on the image**: a match highlights the **matched substring**, not the whole line — derived from AC34's width-fitted span, so it carries the same accuracy as a selection highlight rather than introducing a second, less honest positioning mechanism. A match takes `--color-accent-signature-tint`, and the **current** match adds a solid 2px `--color-accent-signature` outline so "which one am I on" does not rest on tint alone. A match count is shown; `Enter` / `⇧Enter` step forward and back; `Esc` closes. **The handler is scoped to this view, not intercepted app-wide** — no other tool has a find, and a global interceptor would be shell surface this story does not need to claim. Match order follows the same reading-order sort as everything else (AC21).

39. **Given** AC17 retains regions recognition failed on, **when** no region carries readable text, **then** the no-text-found state says so **and draws the unreadable-region boxes on the image** — turning today's bare sentence into a diagnosis (*we located writing here and could not read it*) rather than a lie of omission on an image visibly full of text. The existing `role="status"` live region is preserved and is covered by AC30's manual screen-reader pass.

40. **Given** an error must explain without removing the way back in, **when** an extraction fails, **then** the message renders in a `role="alert"` region **below the resting drop target, which stays on screen** — the tool does not become a dead end. The message is the project-authored sentence from AC24 or AC25, never a third-party error string.

41. **Given** this redesign deletes the one unambiguously accessible element in the tool — a labelled `<textarea>` — and replaces it with transparent spans over an image, **when** Task 2b completes, **then** NFR5 is met behaviourally: the image carries an accessible name that is **not the filename** and that says its text is available; the overlay container carries a role that does **not** announce "image" and stop; every region span is real, focusable-reachable DOM text in reading order; and `⌘A` / `⌘C` inside the overlay work with no pointer. Verified in AC30's `pnpm tauri dev` screen-reader pass, not by a passing spec.

42. **Given** the OCR view is 100% pre-Epic-7 — `#666`, `#ccc`, `#b00020`, `border-radius: 6px`, bare `font-family: monospace`, `em`-based spacing, and **zero `AppButton` usage** — **when** Task 2b's first slice completes, **then** every hardcoded value is replaced by its token (`--color-text-secondary`, `--color-border-hairline`, `--color-accent-destructive`, `--radius-*`, `--font-code-*`) and every control is an `AppButton` or the app's ghost icon-button pattern. `base.css` already styles bare `<textarea>` / `<input>` — what it covers is not re-styled. Same starting condition and same first slice as `CronView.vue` (8.6) and `JwtView.vue` (8.5).

## Tasks / Subtasks

- [x] **Task 0: Branch setup (AC: all)**
  - [x] Confirm `baseline_commit` (`d576c3e`) is still `origin/main`'s real tip before branching (`git rev-parse origin/main` — was `d576c3ebc450d278f000abf112cc2f810e8be400` at story-creation; `HEAD == origin/main == main`, working tree clean apart from the pre-existing untracked `.claude/workflows/`).
  - [x] `git checkout -b feat/story-8-7-reimagine-the-bucket-ocr` from the story-creation working tree, so the story file + decision record travel with the implementation branch (matches how 8.1–8.6 were branched; the story file is uncommitted at creation, so `git checkout -b` from `main`'s tip carries it and the `sprint-status.yaml` edit onto the new branch). Every subsequent commit lands on that branch.

- [x] **Task 1: Discovery — produce the decision record (AC1–6)**
  - [x] Run `bmad-party-mode` (installed roster — Mary, John, Sally, Winston, Amelia, Paige; `session` mode; party memory on, resuming the 8.1–8.6 Epic 8 history) **or** `bmad-forge-idea` for a narrower persona-driven pressure-test — **the developer's choice for this story.** Frame it explicitly as: *open scope discovery for the Bucket's OCR sub-feature — the existing implementation is reference material, not a decision to preserve.*
  - [x] Feed the session the current, real state so it starts from fact. Re-read every file listed under **Dev Notes → Shipped implementation** at session start and confirm no drift vs. what is written there (Story 8.6's session found a stale corpus count doing exactly this; the check is not ceremony).
  - [x] Ground the session in what Epic 7 + Stories 8.1–8.6 locked — read `src/styles/tokens.css`, `src/styles/base.css`, `src/components/AppButton.vue`, `src/components/AppTabs.vue`, `src/components/AppPopover.vue` + `appPopoverPlacement.ts`, `src/App.vue`, `src/shell/icons.ts`, `src/shell/debounce.ts`, `src/shell/invoke.ts`, `src/shell/DropZone.vue` + `dropZone.ts`, `src/shell/clipboardMatch.ts`, `src/tools/json/useCopyFeedback.ts`, and `DESIGN.md` + `EXPERIENCE.md`.
  - [x] **Read the three prior Bucket stories as the record of what was already decided and why** — `4-1-drag-an-image-in-get-its-text.md`, `4-2-paste-a-screenshot-copy-the-text.md`, `4-3-the-bucket-never-bluffs.md`. AC4c's drop/paste shape and AC5's `OnceLock`/trait shape were reasoned there; reopening them is allowed, re-deriving them from scratch is waste.
  - [x] Run a competitive sweep for evidenced scope candidates — macOS Live Text / Preview's text selection, Windows PowerToys Text Extractor, Google Lens, `tesseract.js` front-ends, Shottr / CleanShot X OCR, ABBYY / Adobe Acrobat OCR, and OCR-to-structured tools (table → CSV/JSON). Candidates to weigh, not commitments: region/crop selection before extraction, per-region confidence display, preserved layout vs. flat text, multi-page/batch, language selection, deskew/preprocess, side-by-side image ↔ text view, re-run at higher effort, drag-out of the extracted text.
  - [x] Resolve **AC4a–4d** as explicit named decisions. Do not let the container question resolve itself by implementation drift — it binds two unstarted stories.
  - [x] Resolve **AC2**'s FR23–FR26 verdicts, and if any FR is revised, **write the revision into `prd.md` and `epics.md` in this story**, not only into the decision record (AC2's second half).
  - [x] Decide each item under **Dev Notes → Known gaps in the shipped OCR path** — every one is in scope for this story by subject matter, and each needs an explicit fold-in / defer / reject call in the record. The two EXPERIENCE.md conflicts (no file-picker button, no in-flight state) are **live spec violations in shipped code**, not new feature ideas.
  - [x] Produce the written decision record to `_bmad-output/implementation-artifacts/8-7-ocr-decision-record.md`, mirroring `8-1`…`8-6`: **Kept / Changed / Added / Cut (backlog)** with rationale, plus the AC4 coupling decisions, the AC2 FR verdicts, and the AC5 AD-1 core split.
  - [x] AC3: capture each cut idea — draft a max-context body per idea in the record, then file as `backlog-candidate` GitHub issues on `dipaneb/umbra` linking back to it — **or** take the personal-backlog route if the developer directs it (the 8.3/8.4 precedent), logging the deviation.
  - [x] Optional: build a container-shape comparison canvas (one enriched view / `AppTabs` / three separate tools), with interaction states, as an Artifact. Given AC4a binds two other stories, this is a stronger canvas candidate than it was for 8.6, where the container was reasoned without one.
  - [x] Developer confirms the scope decisions and open questions before Task 2 begins.

- [x] **Task 2a: Redesign ACs — write real Given/When/Then** (after Task 1's record exists; canvas picks in)
  - [x] In the same discovery room, resolve the decision record's open items and write real AC7+ into a new `## Acceptance Criteria — Task 2 (Redesign)` section above, scoped strictly to `8-7-ocr-decision-record.md` plus the developer's canvas picks and the files AC4 authorises (see Project Structure Notes — the AD-6 island boundary is **wider than usual for this story**, and the AC set must name every non-Bucket file it touches, the way 8.6's AC26 did; 8.6's code review found that AC list incomplete twice, so build it deliberately).
  - [x] Await the developer's sign-off on the AC set before Task 2b.

- [x] **Task 2b: Redesign — implementation** (after the AC set is confirmed)
  - [x] **Overlay spike (throwaway, pre-slice-1).** Developer's call at session open. Answered AC34's width-fit question against real detection output before four slices assumed it; found the AC19 preset trap as a side effect. Code reverted, nothing committed — findings in the Dev Agent Record.
  - [x] Follow the delivery pattern Stories 8.1–8.6 established: **vertical slices, developer render-review after each slice.** Per slice: pure Rust fn + regression tests → command layer (`spawn_blocking`, `Result<T, ToolError>`, AD-3/AD-4, only if the command surface changes) → Vue → full local gate.
  - [x] **Slice order (developer's call, 2026-09-07).** The story's original "first slice is the Epic-7 tokenisation pass + restructure to the chosen container" bullet is **historical** — it predates Task 1's three-way split and contradicts AC9, which requires PDF and Images to move **verbatim**, so tokenising `BucketView.vue` before splitting it would rewrite code the split must transplant unchanged. Tokenisation (AC42) applies to the **OCR view only**, after the split. Agreed order:
    - [x] **Slice 1 — the hoist (AC15).** `useCopyFeedback` to `src/shell/`, 7 import sites, no shim. Zero behaviour change, landed alone so a broken island import can never be confused with a broken shell spec.
    - [x] **Slice 2 — split + verbatim move (AC7–AC10, AC27, AC28).** Registry, routes, icons, both locale files, the four shell specs, the OCR-only command/code renames. App still works; nothing redesigned.
    - [x] **Slice 3 — Rust core (AC16–AC23).** Trait change, EXIF, reading-order sort, the seven-field detection config, `max_text_length`, the quality corpus.
    - [x] **Slice 4 — Live Text view (AC31–AC42)** + asset protocol (AC11) + paste publication (AC12) + the AC42 tokenisation pass.
    - [x] **Slice 5 — errors, i18n, a11y (AC24–AC26, AC30).**
  - [x] **AC42's "when Task 2b's *first slice* completes" is stale text** (developer's call, 2026-09-07): it predates the split decision the same way the bullet above does. Its **substance is unchanged and binding** — the OCR view ships with every hardcoded value tokenised and every control an `AppButton` or the ghost icon-button pattern — but it lands in the Live Text slice, because that slice rewrites the view wholesale and tokenising the doomed `<textarea>` earlier is throwaway work.
  - [x] Full local gate before every commit: `pnpm lint` · `pnpm exec vue-tsc --noEmit` · `pnpm test` · `pnpm build` · `cargo fmt --check` · `cargo clippy --workspace --all-targets -- -D warnings` · `cargo test --workspace`.
  - [x] `pnpm tauri dev` render-review in **both light and dark**, per slice, before calling a slice done.
  - [x] **AC30's manual screen-reader pass** and the **`ARCHITECTURE-SPINE.md` AD-14/AD-15 asset-protocol amendment** both land during Task 2b, not before it.

## Dev Notes

### Shipped implementation — re-read all of this at Task 1 session start (AC1)

Verified against `d576c3e` at story creation.

- **`crates/umbra-core/src/ocr.rs` (281 lines).** `pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024` (100 MB; `pub` so the command layer reuses it rather than duplicating the value — the `hash.rs` per-module convention). `pub struct OcrOutcome { text: String, confidence: Option<f32> }` — `text` is all detected regions concatenated one per line; **empty `text` is a legitimate "no text found" outcome, not an error** (FR26 / Story 4.3), and `confidence: None` doubles as the zero-regions signal. `pub trait OcrEngine: Send + Sync` with **two** methods: `extract_text(&self, image_bytes: &[u8])` (format-sniffed compressed bytes) and `extract_text_from_rgba(&self, rgba: &[u8], width: u32, height: u32)` (already-decoded pixels — the clipboard path added by Story 4.2's AD-8 amendment; a `rgba.len() != width*height*4` mismatch is a `ToolError`, never a panic). `pub struct OarOcrEngine` is the `oar-ocr` v1 adapter behind the trait (**AD-8**: callers, commands and UI depend on the trait only, never on `oar-ocr` directly). Constructed from **resolved absolute model paths** — the module is filesystem-agnostic beyond that (**AD-2**/**AD-15**); path resolution is the command layer's job. Module doc explicitly names FR29 reuse as the reason the module is called `ocr`, not `bucket`.
- **`src-tauri/src/commands/bucket.rs`.** `models_dir()` (two `cfg`-gated variants), `resolve_model_path()`, `pub fn ocr_engine()` (`OnceLock`-guarded lazy init — AD-16's "racing first-use initializations share one init"; a real 8-thread race test exists), `#[tauri::command] pub async fn bucket_extract_text<R: Runtime>(…)` (path in, `check_file_size` guard against `MAX_INPUT_BYTES` **before** reading, then `spawn_blocking`), and `#[tauri::command(async)] pub fn bucket_extract_text_from_clipboard<R: Runtime>(…)` — **a plain non-`async` fn on purpose**, with an in-file comment citing `tauri-apps/tauri#2533`; do not "modernise" it to `async fn`. The clipboard path reads raw RGBA from the **raw IPC body** with `x-image-width` / `x-image-height` headers — the one sanctioned **AD-15** exception — and reuses `MAX_INPUT_BYTES` as-is on uncompressed bytes, with an in-file comment saying that is deliberate. `map_join_error` → `bucket-internal`.
- **`src-tauri/src/lib.rs`.** `use commands::bucket::{bucket_extract_text, bucket_extract_text_from_clipboard};` (line ~13) plus both in `generate_handler!` (lines ~65–66). `commands::bucket::ocr_engine` is deliberately `pub`-reachable for integration tests — see the file's own top comment before changing visibility.
- **`src/tools/bucket/BucketView.vue` (713 lines, 100% pre-Epic-7).** Hardcodes `#666`, `#ccc`, `#b00020`, `border-radius: 6px`, `font-family: monospace`, and `em`-based spacing throughout. **Zero `AppButton` usage — every control is a plain `<button>`.** Three sequential sections in one flat scroll:
  - **OCR (Stories 4.1–4.3):** `outcome` / `error` / `editedText` refs; `applyBucketResult()`; two `watch`es on `registry.dropResult` and `registry.pasteResult`, each a one-shot signal cleared on read; `onCopy()` copies `editedText` (the **edited** value, not `outcome.text` — AC2 of Story 4.2). Template: `h1` → `.drop-hint` `<p>` → `role="alert"` error `<p>` → `role="status"` no-text-found `<p>` → a `.field` with a labelled `<textarea>` + a plain Copy `<button>`.
  - **PDF (Story 6.1):** `pdfError`, one local `runPdf`, merge / extract-pages / extract-text flows, `pdfFilters()` as a **function not a const** (so the OS dialog label follows the current locale — see the in-file comment).
  - **Images (Story 6.2):** `imageError`, **two** local runners, `imagePath` / `imageTargetFormat` / `imageQuality` / `imageEstimatedSize`, a 200 ms `debounce`d live estimate with `.cancel()` in `onUnmounted`, `targetExtension()` / `defaultConvertedFileName()` (the save-dialog filter is scoped to the one real output extension — read that comment before touching it), and a local `formatEstimatedSize()` routed through vue-i18n's `n()` for French `Ko`/`Mo`.
  - **In-file AD-16 reasoning is extensive and load-bearing.** Three separate comment blocks explain why OCR uses the registry-scoped runner via `DropZone.vue` while PDF and Images each scope their own. Read them before changing runner shape (AC4d).
- **`src/tools/bucket/ocrOutcome.ts` (5 lines)** — hand-synced TS mirror of `OcrOutcome`. **`src/tools/bucket/imageTargetFormat.ts` (3 lines)** — `ImageTargetFormat` union; Images-owned, 8.9's business.
- **`src/tools/bucket/BucketView.spec.ts` (711 lines, 33 `it()`).** Three `describe` blocks: root (OCR), `"PDF section"`, `"Image section"` — already partitioned along the AC4b split seam.
- **Registry — `src/stores/registry.ts` (~lines 162–191).** `id: "bucket"`, `name: "Bucket"`, `descriptionKey: "tools.bucket.description"`, `route: "/tools/bucket"`, `icon: "bucket"`, lazy `component`, **16 aliases** spanning all three sub-features (`bucket`, `ocr`, `screenshot`, `pdf`, `merge`, `image`, `convert`, `compress`, `png`, `jpeg`, `webp`, `capture d'écran`, `fusionner`, `convertir`, `compresser`), plus `drop`, `paste` and `clipboardMatch` — **all three OCR-only** (AC4c). **No `shortcut`.**
- **i18n — `tools.bucket.*`, 32 keys, `en` + `fr` parity.** Only **3 are OCR-owned** (`dropHint`, `noTextInImage`, `extractedTextLabel`); 2 are shared (`description`, `heading`); 16 are PDF; 11 are Images. Plus shared `common.copy`. `src/locales/locales.spec.ts` compiles every string.
- **`src/shell/toolError.ts`.** `TRANSLATABLE_CODES` holds `uuid-count-zero`, the `json-*` classification codes, the classified `base64-*` codes, and (since 8.6) `cron-six-field-unsupported`. **No `bucket-*` entry — every `bucket-*` code renders raw, unlocalised.**

### Known gaps in the shipped OCR path — each needs an explicit call in the decision record

These are findings from reading the code and cross-checking it against `EXPERIENCE.md` and `deferred-work.md`. They are listed as **inputs to discovery**, not as pre-decided scope.

1. **No file-picker button in the OCR section — an unmet `EXPERIENCE.md` Flow 3 requirement.** Flow 3 step 4 (`EXPERIENCE.md:125`) states the file-picker is *"the flow's stated canonical, keyboard-operable path"* with drag-and-drop as the alternative. The OCR section has **no `open()` call and no picker button** — only window-level drop and `⌘V` paste. PDF and Images both have pickers. Keyboard-only OCR therefore requires an image already on the clipboard, which is not a picker. Bears directly on **NFR5** ("if a flow can't be completed by keyboard alone, it isn't done", `EXPERIENCE.md:90`) and on the 5-minute demo.
2. **No in-flight state for OCR — an unmet `EXPERIENCE.md` Loading requirement.** `EXPERIENCE.md:70` singles OCR out: *"OCR jobs (potentially slow, local ONNX inference) show explicit in-progress state, not a frozen drop zone. Start and completion are exposed to assistive tech as an announced status."* The OCR section has **no `extracting` ref, no progress indicator, and no announcement** — while `pdfMerging`, `pdfExtractingPages`, `pdfExtractingText`, `imageEstimating` and `imageConverting` all exist. First use also pays the `OnceLock` model-init cost with zero feedback.
3. **`OcrOutcome.confidence` is plumbed through Rust → IPC → TS and never rendered** (`deferred-work.md:122`, open since Story 4.1/4.2). Either surface it or delete it — carrying an unread field across three layers is the status quo.
4. **`result.value as OcrOutcome` is an unchecked type assertion** with no runtime shape validation (`deferred-work.md:116`, `BucketView.vue:32`). Pre-existing convention, two call sites.
5. **The `role="status"` live region has never had manual screen-reader verification** (`deferred-work.md:121`) — it was the first instance of the pattern in the codebase and the check was deferred to a manual `pnpm tauri dev` pass that has not happened.
6. **Corrupt-image truncation tests cover one truncation point on one fixture** (`deferred-work.md:120`) — near-full-length truncation is a materially different `image`-crate decode path and is untested.
7. **No `useCopyFeedback`.** OCR's Copy is a plain `<button>` with a static `common.copy` label and no confirmation. Adopting the pattern makes this the **6th consumer** of `src/tools/json/useCopyFeedback.ts`, which still carries its hoist-candidate comment — five consecutive stories have declined the hoist. Reopen or decline it deliberately.
8. **AD-13 / FR25 French-OCR claim.** The 2026-08-23 AD-13 amendment says the bundled recognition model's `character_dict.txt` already covers French diacritics, so the OCR leg satisfies the coupling rule. `FR25` still reads "OCR supports English in v1". Confirm which is operative and, if FR25 needs revising, apply AC2's propagation rule.
9. **`bucket-*` error codes are not in `TRANSLATABLE_CODES`.** A French user gets English error text. 8.6 added the first `cron-*` code using a stated criterion — *fixed, value-free, project-authored sentence* — and its code review found a second code that met the criterion and had been missed. Apply the same test to each `bucket-*` code.
10. **`oar-ocr` version drift — live-verified at story creation, 2026-09-06.** The Consistency Conventions' **Dependency version/API drift** row makes this check a standing rule. Results, from the crates.io registry API (not docs.rs):

    | Fact | Value |
    | --- | --- |
    | Pinned in `Cargo.lock` | **0.6.3** (Story 4.1, 2026-08-04) |
    | Latest on crates.io | **0.9.2**, published 2026-08-18 |
    | `rust_version` of every release ≥ 0.7.4 | **1.95** |
    | Project `rust-version` (`crates/umbra-core`, `src-tauri`) | **1.88** (bumped 1.85 → 1.88 by Story 6.1's `lopdf`) |
    | CI toolchain (`ci.yml`, `release.yml`) | **1.94.0**, SHA-pinned |

    **Conclusion: the upgrade is still blocked, and 0.6.3 remains the correct pin.** 1.94.0 < 1.95, so Cargo cannot resolve past 0.6.3 — the Stack table's stated gate (*"re-verify at whatever point the toolchain crosses 1.95, not on calendar time"*) has not been crossed. Do **not** spend Task 1 budget re-litigating this; it is settled until the CI toolchain moves. If Task 2 raises the CI toolchain for any other reason, this re-opens, and the re-verification must read the vendored source and record the finding in the **Stack table**, not only in this story's notes.

    **Drift found while checking:** `epics.md` claims `oar-ocr` **0.8.x** in four places — `:127` (AD-8 restatement), `:137` (Stack line), `:741` and `:742` (Story 4.1's own ACs). That figure is from the 2026-07-19 planning sweep, before Story 4.1 discovered the rustc floor and pinned 0.6.3. `ARCHITECTURE-SPINE.md`'s Stack table is correct and explains why; `epics.md`'s mirror was never updated. Story 4.1's ACs are historical record and should get a forward pointer rather than a rewrite (the Epic 3 precedent from `sprint-change-proposal-2026-09-06.md` §4.3); `:127` and `:137` are live claims and should be corrected. Raise with the developer during Task 1 — this is an `epics.md` correction, not an in-scope code change.

### Architecture constraints binding this story

| Rule | What it binds here |
| --- | --- |
| **AD-1** | Core owns the transformation; locale/timezone/case formatting is view-owned. |
| **AD-2 / AD-15** | `umbra-core` never touches the filesystem. Files cross IPC as **absolute paths**; `src-tauri` owns every read/write. The **one** sanctioned byte-payload exception is clipboard image RGBA via the raw IPC body — do not add a second. |
| **AD-3** | `ToolError { code, message, position, context }` is the only error shape. `ToolError.code` is stable kebab-case; commands are `<tool>_<verb>`. |
| **AD-4** | OCR inference runs on the blocking pool (`spawn_blocking`) and never on the launch path — cold launch stays under 2 s (NFR2). |
| **AD-5** | The Tool Registry is the **only** source of tool metadata. Any split into multiple tools is a registry change (AC4c). |
| **AD-6** | Tools are islands; no tool reads another's state. **This story stretches that boundary more than any prior Epic 8 story** — see Project Structure Notes. |
| **AD-7** | Zero network surface except the updater. Models ship bundled with `oar-ocr` auto-download explicitly disabled. Story 4.3 proved this with a network monitor; **any dependency change re-opens that audit.** |
| **AD-8** | OCR sits behind the core-owned `OcrEngine` trait; `oar-ocr` is the swappable v1 adapter. Amended 2026-08-06 for the raw-RGBA path. AC5 governs changing it. |
| **AD-13** | Localization ships as one unit. Amended 2026-08-23 — the OCR leg ships French via the model's character dictionary; see gap #8. |
| **AD-14** | The shell owns OS I/O edges **exactly once**. `DropZone.vue` is the single generic dispatcher; tools never register document-level listeners. `navigator.clipboard` is forbidden — use `src/shell/clipboard.ts`. |
| **AD-16** | Latest-wins supersession; **one runner per independent piece of state**. The `OnceLock` engine init is part of this rule. See AC4d and the amended rule text in `ARCHITECTURE-SPINE.md`. |
| **NFR5** | Every flow keyboard-drivable, no exceptions. Labels, visible focus, WCAG AA 4.5:1, checked at PR review. See gaps #1 and #2. |

### Previous story intelligence (Story 8.6, merged as PR #131 / `d576c3e`)

Nine transferable lessons, in descending order of how much they would cost to relearn:

1. **Propagate FR revisions upstream in the same story.** 8.6 revised FR19–FR22 in its decision record only. `prd.md` and `epics.md` kept describing retired code, and it took a full correct-course pass to clear. **AC2 encodes this as a requirement.**
2. **ACs written before code get invalidated by render-reviews — that is the process working, not failing.** 8.6's AC10–AC12 hybrid field editor was rejected on sight once running (*"I know I decided the tool to be like this but now that I see it it's terrible"*). Expect this; re-sync the ACs rather than defending them, and keep the original text findable in git history.
3. **Name every non-island file the AC set authorises, and keep that list current.** 8.6's AC26 was found incomplete **twice** — once at the correct-course pass, once at code review. This story touches more shell surface than 8.6 did.
4. **A decision's stated rationale can die while the decision stays right.** 8.6's post-review proposal separates "the code is wrong" from "the code is right and the recorded reason is now false." Both need fixing; only the first needs a code change.
5. **A latest-wins runner fences against a newer *request*, not newer *input*.** 8.6's code review found `runExplain` writing a stale snapshot back over keystrokes typed during an in-flight call. Any view that writes derived state back from a request's own snapshot must re-check that the snapshot still matches the live value. Directly relevant to an editable OCR `<textarea>` that is re-seeded from each arriving `outcome.text`.
6. **Guard input shape before indexing.** 8.6 shipped a `pub` core API that panicked on `@daily` because a guard checked "exactly 6 fields" instead of "exactly 5". Contained by `spawn_blocking`, but it surfaced as an untranslated internal error plus a stderr panic.
7. **A sweep that asserts only "it parsed" proves parsability, not correctness.** 8.6's 3136-case sweep would have passed with two struct fields swapped. Prefer at least one true end-to-end assertion per behaviour.
8. **Sub-feature test coverage skews to whatever the first author exercised.** 8.6's French union bug survived because `fr.spec.ts` had exactly one union case, on one field. When adding coverage, cover the *dimension*, not one example of it.
9. **A `lib`/toolchain bump can move the platform floor.** 8.6's `Intl.ListFormat` raised the real macOS floor; `tauri.conf.json` now declares `minimumSystemVersion: "13.0"` (NFR3 alignment, developer's call 2026-09-06). Any new API or dependency here gets the same check.

### Git intelligence

`d576c3e` (Story 8.6) touched 31 files / +4768 / −1590 and is the freshest template for an Epic 8 story's real footprint: the tool island (view, new sub-component, specs, TS mirrors, a `locales/` sub-directory), the core module, the command layer + `lib.rs`, both locale JSONs, `toolError.ts`, `tauri.conf.json`, `tsconfig.json`, **and** four planning artifacts (`ARCHITECTURE-SPINE.md`, `epics.md`, `prd.md`, `EXPERIENCE.md`) plus two sprint-change proposals. Commits are scoped Conventional Commits; PR title format is `Story 8.N: <title> (#NNN)`. Stories 8.1–8.6 each shipped as a single squash-merged PR from `feat/story-8-N-<slug>`.

### Testing standards

- `cargo test -p umbra-core` (unit) + `src-tauri` command integration tests (`#[tokio::test]`, `tauri::test::MockRuntime`, real fixture images) + Vitest component specs. **No e2e suite in v1 (NFR6).**
- Gate, all of which must pass locally before each commit: `pnpm lint` · `pnpm exec vue-tsc --noEmit` · `pnpm test` · `pnpm build` · `cargo fmt --check` · `cargo clippy --workspace --all-targets -- -D warnings` · `cargo test --workspace`.
- No `unwrap`/`expect` in command paths. TypeScript `strict`.
- Existing OCR coverage to preserve or deliberately replace: real-fixture end-to-end extraction, oversize-file rejection **without reading the file**, non-image rejection, corrupt/truncated file → `ToolError` not panic, missing path → read error, the 8-thread `OnceLock` race, and the clipboard RGBA round-trip + oversize + malformed-length cases.
- Baseline at `d576c3e`: 845 Vitest, 345 `cargo test --workspace`.

### Project Structure Notes

- **The AD-6 island boundary is wider for this story than for any prior Epic 8 story, and that is the single most important structural fact here.** Stories 8.1–8.6 each stayed inside `src/tools/<tool>/` plus one core module plus one command module. This story's island — `src/tools/bucket/`, `crates/umbra-core/src/ocr.rs`, `src-tauri/src/commands/bucket.rs` — is shared with two unstarted stories, and its registry entry carries behavioural declarations the **shell** consumes. AC4 exists to make that explicit rather than discovered mid-implementation.
- **Files 8.7 shares with 8.8 (PDF) and 8.9 (Images):** `src/tools/bucket/BucketView.vue`, `src/tools/bucket/BucketView.spec.ts`, the `tools.bucket.*` i18n block in both locale files, and the single `bucket` registry entry. Whatever 8.7 does here, 8.8 and 8.9 inherit. **`epics.md`'s "No ordering dependency between the 9 stories" does not hold for 8.7–8.9** — flag this to the developer during Task 1 as a candidate `epics.md` correction, since a future reader will otherwise take the preamble at face value.
- **Files 8.7 owns outright:** `crates/umbra-core/src/ocr.rs`, `src-tauri/src/commands/bucket.rs`, `src/tools/bucket/ocrOutcome.ts`. **Not 8.7's:** `crates/umbra-core/src/pdf.rs` + `src-tauri/src/commands/pdf.rs` (8.8), `crates/umbra-core/src/image_convert.rs` + `src-tauri/src/commands/image.rs` + `imageTargetFormat.ts` (8.9).
- **Shell files a container/split decision would reach:** `src/stores/registry.ts`, `src/shell/DropZone.vue`, `src/shell/dropZone.ts` + `dropZone.spec.ts`, `src/shell/clipboardMatch.ts`, `src/shell/icons.ts` (a new tool id needs an icon), `src/shell/toolError.ts`. Any of these must be named in Task 2a's AC set before being touched.
- **Naming, if a split happens:** follow `src/tools/<tool>/<Name>View.vue` for a view reachable by route, and the 8.6 precedent (`CronFieldEditor.vue`) for a non-routed island sub-component. Note `dropZone.spec.ts` / `DropZone.vue`'s in-file comment about APFS case-insensitive filename collisions before naming a new spec file.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 8: Tool-by-tool reimagination`] — the shared Epic 8 story shape, the Task 1 → Task 2 gate, and Story 8.7's scope line.
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 4: The Bucket — local OCR`] — Stories 4.1–4.3, the shipped OCR acceptance criteria.
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md`] — FR23 (:84), FR24 (:85), FR25 + AD-13 amendment (:86), FR26 (:87), FR29 (:96), FR35 (:111).
- [Source: `.../architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md`] — AD-1 (:45), AD-2 (:51), AD-3 (:57), AD-4 (:63), AD-5 (:69), AD-6 (:75), AD-7 (:81), AD-8 (:87), AD-13 (:134), AD-14 (:190), AD-15 (:196), AD-16 + its 2026-08-04 and 2026-09-06 amendments (:202), Consistency Conventions (:215), Stack (:229).
- [Source: `.../ux-designs/ux-umbra-2026-08-15/EXPERIENCE.md`] — Loading/OCR in-progress (:70), OCR empty/failed (:73), drag-and-drop primitive (:82), keyboard-only rule (:90), Flow 3 file-picker (:125), OCR honest-failure (:128), deferred "Send to" chaining (:175) and batch Bucket operations (:178).
- [Source: `_bmad-output/implementation-artifacts/8-6-reimagine-nl-cron.md`] — previous story: AC/task shape, Dev Notes depth, Review Findings, Change Log.
- [Source: `_bmad-output/implementation-artifacts/8-6-cron-decision-record.md`] — decision-record format to mirror (Framing → Container shape → Kept / Changed / Added / Cut).
- [Source: `_bmad-output/implementation-artifacts/8-5-jwt-decision-record.md`] — the tightest Kept/Changed/Added table example in the series.
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-06.md`] — how upstream FR drift happened and what it cost (AC2's rationale).
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-06-post-review.md`] — post-code-review re-sync; the "rationale died, decision survived" distinction.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — Bucket/OCR deferrals at :116, :120, :121, :122.
- [Source: `_bmad-output/implementation-artifacts/epic-5-retro-2026-08-10.md`] and `CLAUDE.md` — new shared infrastructure does not inherit governance automatically; present architecture choices as options with trade-offs before executing.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, `bmad-dev-story`).

### Debug Log References

**Task 0 — branch setup, verified 2026-09-06.**
`git fetch origin main` → `origin/main` = `d576c3ebc450d278f000abf112cc2f810e8be400`, identical to the
story's `baseline_commit` (`d576c3e`). Branched `feat/story-8-7-reimagine-the-bucket-ocr` from that
tip, matching the 8.1–8.6 convention. The story file and its `sprint-status.yaml` edit were committed
onto the branch as `936f32f` (`docs(story-8-7): add story file for Reimagine the Bucket OCR`). The
pre-existing untracked `.claude/workflows/` was left untracked, as the story's Task 0 anticipated.

**Task 1 — Dev Notes drift check vs. the working tree (AC1's "must be re-read in full at session
start" requirement).** Every claim under *Dev Notes → Shipped implementation* re-verified at
`d576c3e`. Confirmed exactly as written:

| Claim | Verified |
| --- | --- |
| `crates/umbra-core/src/ocr.rs` 281 lines | ✅ 281 |
| `src/tools/bucket/BucketView.vue` 713 lines | ✅ 713 |
| `BucketView.spec.ts` 711 lines, 33 `it()`, 3 `describe` (root / `"PDF section"` / `"Image section"`) | ✅ all four |
| `ocrOutcome.ts` 5 lines, `imageTargetFormat.ts` 3 lines | ✅ |
| Registry `bucket`: 16 aliases, `drop` + `paste` + `clipboardMatch` all OCR-only, no `shortcut` | ✅ |
| `tools.bucket.*` = 32 keys, `en`/`fr` parity | ✅ 32 / 32, key sets identical |
| No `bucket-*` code in `TRANSLATABLE_CODES` (gap #9) | ✅ — 7 `bucket-*` codes exist in Rust, 0 translated |
| Gap #1 — no `open()` file picker in the OCR section | ✅ — `open()` appears only in the PDF (×3) and Images (×1) flows |
| Gap #2 — no OCR in-flight state | ✅ — no `extracting` ref; `pdfMerging` / `imageEstimating` etc. all exist |
| `oar-ocr` pinned `0.6.3` in `Cargo.lock`; `rust-version` `1.88` in both crates | ✅ — upgrade still blocked, as gap #10 concluded |

**Two drifts found in the Dev Notes themselves** (the story file's own text, not the code — logged here
rather than silently corrected, since Dev Notes is not a section this workflow may edit):

1. **`TRANSLATABLE_CODES` now holds *two* `cron-*` codes, not one.** Dev Notes says "and (since 8.6)
   `cron-six-field-unsupported`"; the set also contains `cron-no-upcoming-runs`. This is precisely the
   "code review found a second code that met the criterion and had been missed" event that gap #9
   itself cites — the fix landed, the Dev Notes sentence was written from the pre-fix state. Does not
   change gap #9's instruction (apply the same criterion to each `bucket-*` code); it strengthens it,
   since the criterion has now demonstrably been under-applied once.
2. **`epics.md`'s `oar-ocr` 0.8.x drift is in *three* places, not four.** Gap #10 lists `:127`, `:137`,
   `:741`, `:742`. Line 742 is the AD-7 bundled-models line and carries no version number; the three
   real hits are `:127` (AD-8 restatement), `:137` (Stack line) and `:741` (Story 4.1 AC). The
   remediation split still holds unchanged — `:127` and `:137` are live claims to correct, `:741` is
   historical record that gets a forward pointer.

### Completion Notes List

- **Task 0 complete.** Branch cut from the verified baseline; story file + sprint-status committed as `936f32f`.
- **Task 1 discovery complete.** Developer chose `bmad-party-mode`. Decision record written to
  `_bmad-output/implementation-artifacts/8-7-ocr-decision-record.md`, satisfying AC1–AC6.

- **The session's premise changed in one line.** Asked whether "Bucket" was a name worth keeping, the
  developer answered that the three-tools-under-one-name grouping was **never a product decision** — an
  AI scaffolded it that way and it was left unfixed to keep moving. AC4a, framed in the story as a
  three-way architecture fork, collapsed to a cleanup in a single round.

- **Then it changed a second time.** Asked whether `OcrOutcome` should carry per-region confidence, the
  developer redirected: *"can we make the text appear like on Apple Photos — select the text directly
  from the image."* That is the redesign. It is a better answer to their own "copy and leave" than any
  text pane, because partial selection removes the step where you re-find, in a transcription, what your
  eyes already located on the image.

- **Decisions taken (all developer-confirmed):** three separate registry tools, binding 8.8/8.9 (AC4a) ·
  full split in this story with PDF and Images moving **verbatim** (AC4b) · `drop`/`paste`/`clipboardMatch`
  move to the OCR entry, aliases partition (AC4c) · one runner, three doors — the view calls
  `registry.getLatestWinsRunner` directly for the first time, since the new file picker is a third
  write-trigger on the same state (AC4d) · **the `OcrEngine` trait changes**, deliberately and recorded,
  to a region-structured outcome (AC5) · Tauri asset protocol enabled with a scope, a recorded spine
  amendment · the editable `<textarea>` is replaced by "Copy all text" · low-confidence regions marked
  on the image, no number shown · tool named **"Image to Text"**.

- **Verification work that changed conclusions** (all checked against source, not docs or notes):
  - `oar-ocr-core-0.6.3`'s `TextRegion` has **eight** fields — `bounding_box` (a polygon), `dt_poly`,
    `rec_poly`, `text`, `confidence`, `orientation_angle`, `word_boxes`, `label`. `run_ocr` reads two and
    discards the struct. **The geometry Live Text needs has been available since Story 4.1.**
  - The bundled `character_dict.txt` contains all 17 checked French characters (`é è ê ë à â ù û ô î ï ç
    œ É È À Ç`) among its 6,904 entries — so the 2026-08-23 AD-13 amendment is operative and **FR25's
    "English in v1" is stale**.
  - **All nine commands are `bucket_*` and all sixteen error codes are `bucket-*`** — but `umbra-core` is
    clean (`ocr.rs` / `pdf.rs` / `image_convert.rs` are named for capabilities). The scaffold's name
    reached only the command layer and the codes.
  - `bucket-internal` and `bucket-input-too-large` are used by `commands/pdf.rs` and `commands/image.rs`
    as well — so they are **added** as `ocr-*` rather than renamed, or the verbatim-move gate breaks.
  - **Gap #9 is misdiagnosed.** Applying 8.6's own criterion (a fixed, value-free sentence we wrote
    ourselves), almost no `bucket-*` message qualifies — nearly every one wraps a third-party error string
    or embeds a byte count. It is a **voice** gap, not a translation gap, and it lands on the most-hit
    error in the tool (drop a non-image → the `image` crate's raw English). Fix: write our own sentence,
    *then* it qualifies.
  - `app.security.assetProtocol` is **not** enabled, but the CSP already permits `asset:` /
    `http://asset.localhost` / `data:` for `img-src` (configured by Story 8.2's data-URI preview), so only
    the config and the scope are new.

- **The developer refused the first sign-off, and was right to.** Their objection: the session had gone
  entirely to structural debt (the split, the renames, the runner scoping, the asset-protocol amendment)
  and the record held exactly **one** design idea — Live Text — which they had supplied themselves. For
  the app's first and only AI feature, with Story 8.1's JSON room as the comparison, that was a real gap.
  The session reopened generatively. What that round produced:

  - **The unserved job.** The developer had named "PDF pages with unselectable text" as a real use, and
    **neither tool serves it** — the PDF tool reads only an embedded text layer, and OCR won't open a PDF.
    Resolved as **three tiers**: tier 1 (a dropped PDF stops failing with the `image` crate's raw error and
    says PDFs open in the PDF tool) lands in 8.7; tier 2 (the PDF tool's "no text in this PDF" becomes
    "this is a scan") is **handed to Story 8.8 in writing**; tier 3 (rasterize and OCR) is cut to a GitHub
    issue carrying the full cost sheet. Paige's framing: *serving the attempt is not the same as serving
    the extraction.*
  - **A latent shipping bug, found by reading `run_ocr`.** It emits `lines.join("\n")` in the model's
    **detection** order, not reading order — so a two-column screenshot interleaves silently, and no test
    catches it because every fixture assertion is `contains("UMBRA")`. Free to fix once the geometry flows.
  - **That bug is also an accessibility bug** (Paige). Live Text replaces a labelled `<textarea>` with
    transparent spans a screen reader reads in **DOM order**. One geometric sort therefore serves three
    requirements — Copy fidelity, screen-reader order, and `⌘F` match ordering — which moves it from a
    correctness nicety to load-bearing under NFR5.
  - **The in-flight state is not a spinner** (Sally). Render the image immediately from the path; let the
    text resolve onto it a beat later. The "did it take my file?" anxiety is answered in the first frame,
    and the `OnceLock` model load — the slowest moment in the app's life, on someone's first ever use —
    happens against something recognisable instead of a blank pane. Free: the two are independent.
  - **The resting state had never been designed** — the most-seen state in the app is currently a sentence
    where an affordance should be. Becomes a real drop target with the picker inside it (needs `DropZone.vue`
    to expose drag-enter state — a named shell change).
  - Also decided: `⌘F` find-in-image **in**; `⌘A` selects all image text; "Copy all text" lives *on* the
    image, not under it; a second drop replaces (no history, no persisted state — the job ends when you
    paste, and nothing accumulating is the privacy-correct default); QR codes **out**, to a real GitHub
    issue; handwriting stated as the *reason* low-confidence marking exists (PP-OCRv6 tiny is
    printed-text-trained; confident nonsense is the FR26 risk), not a happy side effect.

- **The developer refused sign-off a second time, and again correctly:** *"we need to think about the onnx
  runtime, the model used, if it's multilanguage or not, the whole pipeline… AI feature means some new
  thinking."* The record had a front door and a back door and nothing in between. An audit of the vendored
  `oar-ocr` / `oar-ocr-core` 0.6.3 source found that `OarOcrEngine::new` calls
  `OAROCRBuilder::new(det, rec, dict).build()` and **nothing else** — **six inherited defaults nobody in
  this project had ever chosen**, in the app's only AI feature:

  1. **`limit_side_len = 960`** — every image is downscaled so its longest side is ≤ 960 px **before
     detection**. A 3024 × 1964 Retina screenshot is recognised at ~960 × 623; 13-point UI text reaches
     the model ~4 px tall. It silently contradicts Live Text, which overlays a full-resolution image whose
     recognition happened three times smaller. **Raised to 1600** (developer's call: no formal measurement).
     Safe to judge rather than measure because detection cost scales with image *area* while recognition
     cost scales with *region count* — so this is ~2.8× the pixels for the detection pass only.
  2. **`max_text_length` is ambiguous** — 25 in `TextRecognitionConfig::default()`, 100 in the predictor
     builder, 128 in the crate's own test. If 25 bounds CTC decoding, long lines truncate silently and no
     existing test catches it (every fixture asserts `contains("UMBRA")` on a short fixture). **An empirical
     long-line test is mandatory**, then the value is set explicitly.
  3. **`orientation_angle` is always `None`** — it needs a third bundled model. *This corrected a claim
     made earlier in this same session's decision record; the correction is recorded, not edited away.*
  4. **`return_word_box = false`** — confirms the word-level cut for the right reason.
  5. **Recognition `score_threshold = 0.0`** — good news, and load-bearing: nothing is silently filtered,
     so `text: None` means recognition genuinely failed. This is what makes low-confidence marking honest
     by construction rather than a display over a pre-filtered set.
  6. **No execution provider configured** — `ort` runs CPU. Cut to a GitHub issue with the full analysis.

  Plus a standing risk: **`ort` is pinned to `2.0.0-rc.12`, a release candidate**, held there because
  `oar-ocr-core` 0.6.3 declares rc.12 but does not compile against rc.13 (Story 4.1's discovery). Named,
  no action — it re-opens on the same trigger as the `oar-ocr` pin.

- **The three seconds turned out to be a feedback problem, not a speed problem.** The developer measured it:
  *"roughly three seconds, but three seconds feels slow when you put an image and have no visual feedback."*
  Resolved by the already-decided image-appears-immediately behaviour plus an **indeterminate** indicator —
  deliberately not a progress bar, because ONNX inference reports no progress and a bar filling at an
  invented rate would be a bluff about our own internals in an app built on *the Bucket never bluffs*.

- **Execution providers, after the developer correctly pushed back on a too-narrow framing:** six
  compile-time Cargo features exist (`coreml`, `cuda`, `directml`, `openvino`, `tensorrt`, `webgpu`) and
  Umbra enables none. Sorted by *does the end user have to install a vendor runtime* — CoreML (macOS),
  DirectML (Windows 10+, any DX12 GPU) and WebGPU (the only genuinely cross-platform one) are viable;
  CUDA, TensorRT and OpenVINO are out on **distribution** grounds, not performance. Cut to GitHub with the
  compile-time-feature constraint and the AD-7 re-audit it triggers.

- **A final audit round, at the developer's request** (*"you tell me if something is missing"*) — three findings,
  all verified against the vendored `image` 0.25.10 source, and all landing on *photos of documents*:
  1. **EXIF orientation is never applied — a live bug.** `image::load_from_memory` is
     `ImageReader::with_guessed_format().decode()`, and `decode()` does not apply EXIF orientation; the crate
     requires calling `orientation()` / `apply_orientation()` explicitly. So a photo taken with a phone held
     sideways reaches the detector rotated 90°, detection largely fails, and the user gets *"no text found"*
     on an image visibly full of text — confidently wrong output, exactly what FR26 exists to prevent.
     **Folded in**, with a new EXIF-carrying fixture.
  2. **The format claim has been under-stating the code since Story 4.1.** FR23, the registry description and
     the drop hint all say *"PNG, JPEG, or WebP"*; `image`'s `default-formats` actually decodes **fifteen**,
     TIFF and BMP included — and scanners produce TIFF, which matters for the scans use. The error sentence
     drafted earlier in the session (*"PNG, JPEG, and WebP are supported"*) **would have been false**.
     Developer's call: **stop enumerating** — *"Drop an image"* / *"That file isn't an image this tool can
     read."* Vague and true beats specific and wrong, and avoids a list that drifts with the `image` crate's
     default features. FR23 revised accordingly.
  3. **HEIC is not supported** — iPhone photos are HEIC by default, `image` has AVIF but not HEIC, so an
     unexported phone photo fails as unreadable. Cut to personal backlog; the fix is `libheif`, the same class
     of native-dependency cost as the PDF rasterizer.

- **A quality regression corpus is in scope** (developer's call). This story changes `limit_side_len`, adds a
  reading-order sort and applies EXIF orientation — and today the only quality assertion in the codebase is
  `contains("UMBRA")` on one short fixture. A small corpus of real images with properly asserted expected text
  is the only way to know whether any of it helped; it also converts the model-tier revisit gate from a
  judgement into a measurement. **Detection-threshold tuning** (`box_threshold`, `unclip_ratio`, the
  `text_type` presets) is deliberately cut to backlog *behind* the corpus — tuning thresholds without a way to
  measure regression is guessing with extra steps.

- **The model choice is now a first-class section, not a footnote** (developer's third catch). Verified against
  Hugging Face: there are **three** tiers, not two — tiny **6.0 MB** (shipped), small **29.6 MB** (~5×, never
  previously named by anyone), medium **132.2 MB** (~22×). `ARCHITECTURE-SPINE.md` records **medium** as the
  documented fallback; at 132 MB of models for a small offline utility that is not a fallback, and the spine
  line needs correcting to name `small`. **Decision: tiny stays — now for a reason.** The direction of cost is
  known (a 5× model on top of the already-raised resize limit, against a measured 3 s baseline, plausibly
  reaches the ~10 s point where a user disengages) while the benefit is unmeasured, and the cheaper lever
  (960 → 1600, ~4× the pixels for the existing model) was pulled first. A **concrete revisit gate** replaces
  the broken one: if quality is still poor at 1600 with reading order fixed, evaluate `small` during Task 2b's
  render reviews. Also surfaced: PP-OCRv5 ships **language-specific** rec models (`latin_`, `en_`, …) — most of
  our 6,904-entry dictionary is Chinese, serving a script this app has never claimed to support, so a
  Latin-script recogniser is *better-targeted rather than bigger*. Cut #17, personal backlog.

- **AC3 capture route — developer's decision: split** (the 8.6 precedent). The two cuts with real future
  weight are filed as `backlog-candidate` GitHub issues on `dipaneb/umbra`, each carrying its full cost
  sheet: **#132** (OCR a scanned PDF page), **#133** (QR / barcode decoding), **#134** (hardware-accelerated
  inference). The remaining cuts go to the developer's own backlog and are logged in the record's Cut table
  so nothing is silently dropped.

- **Not yet done, deliberately:** the AC2 propagation of the FR23–FR26 revisions into `prd.md` and
  `epics.md`, the `epics.md` corrections, and the filing of the two GitHub issues. All wait on the
  developer's sign-off of the record — AC2 requires the propagation to land *in this story*, not before
  the scope it encodes has been approved. Nothing has been written upstream or pushed anywhere.

- **Task 2a complete (2026-09-07): AC7–AC42 written, awaiting developer sign-off.** Same
  `bmad-party-mode` room, party memory resumed. Three opening calls taken by the developer:
  **sequencing** — write the ~two-thirds of the AC set with no visual dependency first, then build
  the canvas, then the visual ACs, with one sign-off over the whole set; **`useCopyFeedback`** —
  hoist it to `src/shell/` and update all seven existing import sites, no re-export shim (the
  precedent is `src/shell/debounce.ts`: a generic view-level utility in `shell/`, imported by tool
  islands, `BucketView.vue` among them); **asset-protocol scope** — see below.

- **The asset-protocol scope resolved tighter than the record imagined.** Verified against the
  vendored `tauri-2.11.5`: `app.asset_protocol_scope()` returns a `scope::fs::Scope` exposing
  `allow_file()` / `forbid_file()` (`src/scope/mod.rs:29`), and `src/protocol/asset.rs` consults
  **only** that scope — never the capability ACL. So `tauri.conf.json` declares an **empty static
  scope** and Rust grants exactly the one file the user just handed us, revoking the previous one:
  strictly tighter than any `$HOME/**/*` glob. Two consequences recorded rather than assumed:
  `src-tauri/capabilities/default.json` needs **no** change (ruled out with evidence, not by
  omission), and the `tauri-plugin-persisted-scope` plugin — which Tauri's own docs recommend for
  runtime-picked paths — is **deliberately not added**, because it writes granted paths to disk
  across restarts and contradicts this story's own "a second drop replaces the first, nothing
  accumulates" decision.

- **A gap in the signed-off decision record, found in the first round and fixed in the ACs.** The
  record resolved how the **drop** and **picker** paths get pixels into the webview
  (`convertFileSrc` on `registry.dropSourcePath`) and left the **paste** path with no display path
  at all: `DropZone.vue`'s `dispatchPaste` reads `{ rgba, width, height }`, ships the bytes as a raw
  IPC body and discards them — there is no file, so no path, so nothing for `convertFileSrc` to
  convert. That is the exact mirror of route C, which the room rejected unanimously because *"a
  feature that silently works on paste and not on drop is the worst option on the table."* **AC12**
  fixes it the AD-14 way: the shell publishes what it has **already** read (`registry.pasteSourceImage`,
  the same one-shot shape as `dropSourcePath`) and the view builds an `ImageData` canvas from it.
  The view does **not** read the clipboard itself — that would be a second OS I/O edge, and racy,
  since the clipboard can change during the ~3 s inference.

- **Two shape decisions that make FR26 stronger than the record described.** `TextRegion.text` is
  `Option<String>` and `run_ocr` currently **discards** the `None` regions. Keeping them (AC17)
  costs nothing — recognition's `score_threshold` is `0.0`, so nothing was filtered behind our
  backs — and it turns a detected-but-unreadable region into the strongest "I'm unsure here" the
  pipeline produces. It also converts no-text-found on an image visibly full of text from a lie of
  omission into a **diagnosis** (AC39). Second: the reading-order sort lives in **core**, not the
  view (AC21), because it serves three consumers — Copy fidelity, screen-reader DOM order, and `⌘F`
  match ordering — and its definition is **bounded in the AC text**: it handles a dialog button row
  and a sidebar, and explicitly does not claim a true multi-column spread, which is Cut #3.

- **Open items resolved this session, with where each landed:** #1 asset scope → AC11 · #2
  `OcrOutcome` shape → AC16 (`dt_poly` / `rec_poly` / `word_boxes` / `label` / `orientation_angle`
  do not cross the boundary; no whole-text accessor in core, per AD-1) · #3 low-confidence
  threshold and treatment → AC36 · #4 and #14 coordinate scaling and oversized images → AC35 ·
  #5 selection ergonomics → AC37 · #6 icons and aliases → AC7, AC28 · #7 provisional PDF/Images
  names → AC28 · #8 `ocr-malformed-request` → AC26 · #9 the hoist → AC15 · #10 spec split plan →
  AC9, AC29 · #11 the `⌘F` surface → AC38 · #12 drag-enter → AC14, AC32 · #13 PDF tier 1 → AC25 ·
  #15 corpus contents and tolerance → AC23 · #16 concurrency → AC22 (recorded, not fixed) ·
  #17 the canvas → built.

- **`ocr-malformed-request` is excluded from `TRANSLATABLE_CODES` for a reason worth recording.**
  Its four call sites are all our own sentences, so it looks eligible — but one code carries **four**
  different messages (missing header / not UTF-8 / not a `u32` / JSON body where raw bytes were
  expected) and `toolErrorMessage` does a single `errors.<code>` lookup. Translating it means
  splitting the code four ways or misreporting three of the four. It is also unreachable by users:
  it only fires if our own shell sends a malformed IPC request. AC26 requires that reason be written
  into `toolError.ts` rather than left as an omission.

- **The AC set's file list was built from a repo-wide sweep, not from recollection**, because 8.6's
  equivalent list was found incomplete twice. The sweep found **seven files beyond** the set named in
  this story's own Project Structure Notes — four of which contain assertions that **break** on the
  split: `src/stores/registry.spec.ts` (asserts `["base64","bucket","json","jwt"]`),
  `src/shell/dropZone.spec.ts` (a `bucketTool` fixture hard-coding `bucket_extract_text*` and
  `bucket-malformed-image-buffer`), `src/shell/AppSidebar.spec.ts` (asserts the clipboard callout
  reads "Bucket" and links `/tools/bucket`) and `src/shell/CommandPalette.spec.ts` (asserts the
  palette's seven entries with "Bucket" active). The other three are
  `src-tauri/src/commands/mod.rs`, `src-tauri/tests/ocr_engine_race.rs` and
  `docs/release-checklist.md` — the last of which describes a "Bucket" tool, and its PDF section, in
  both the AD-7 network-audit procedure and the manual QA step.

- **Design canvas built** (developer's sequencing call): <https://claude.ai/code/artifact/cd67d1db-4126-41a6-a9bb-d5c2cb9969f5>
  — nine artboards using the real tokens from `src/styles/tokens.css` and the existing Epic 8 view
  vocabulary. The picks it settled are AC31–AC42. The one worth naming here: low confidence and
  unreadable are distinguished by **shape** (dotted underline vs. dashed box), not by hue, so the
  signal survives a colour-blind viewer and a greyscale screenshot — DESIGN.md's own diff-colour
  precedent.

- **Developer decisions taken on the AC set, 2026-09-07.** **AC35 confirmed** — fit-to-pane with no
  zoom or pan, never upscale. **AC25 confirmed as a sentence only**, in the developer's own framing:
  *"a button would be a good idea, but it cannot route to somewhere that is not built yet."* Recorded
  in AC25 itself, since that reason is stronger than the hand-off-quality argument the room made.

- **AC set SIGNED OFF by the developer, 2026-09-07.** AC7–AC42 approved as written, after AC35
  (fit-to-pane, no zoom or pan) and AC25 (sentence only) were confirmed individually. Task 2b is
  unblocked.

- **Task 1 checkbox correction (not a scope change).** Task 1's last three sub-items and its own
  header were still unticked, though the work landed on this branch: AC2's FR23–FR26 propagation
  into `prd.md` / `epics.md` / `ARCHITECTURE-SPINE.md` in `585349b`, and AC3's filed issue URLs in
  `2d5b387`. Verified against those commits this session before ticking, rather than trusted from
  the session log.

- **Still not done, deliberately, and unchanged from Task 1:** nothing has been pushed, and no
  outward-facing action has been taken this session. Task 2b has not begun.

- **Task 2b opened 2026-09-07 with three developer calls, in the same `bmad-party-mode` room.**
  **Slice order** — hoist → split → Rust → Live Text → errors. Rust-first was argued and rejected:
  the trait change is *subtraction* (the adapter already builds the vectors it discards), so moving
  it earlier buys a smaller diff at the price of throwaway `regions.map().join()` shim code in the
  one file the story deletes, and it costs AC9's verbatim-move gate its auditability — a moved PDF
  assertion could no longer be shown to have changed only because of the move. The four shell specs
  that break on the split total ~44 lines of assertion (`registry.spec.ts` 6, `dropZone.spec.ts` one
  fixture object, `AppSidebar.spec.ts` 3, `CommandPalette.spec.ts` 2): the split is broad, not deep.
  **AC42's "first slice" clause** recorded as stale rather than absorbed. **A pre-slice-1 overlay
  spike** — deliberately much cheaper than the one proposed: a throwaway `cargo test -- --nocapture`
  dumping real `TextRegion` geometry, plus a standalone HTML harness. No Tauri, no asset protocol,
  no split, no trait change. All spike code reverted; `ocr.rs` back to 281 lines, nothing committed.

- **The spike's largest finding is not about the overlay at all — AC19 as signed off was a silent
  pipeline regression.** `OAROCRBuilder::build()` (vendored `oar-ocr-0.6.3`, `src/oarocr/ocr.rs:259`)
  wraps the **entire** `general` preset in `if !has_explicit_det_cfg`. Passing a `TextDetectionConfig`
  — which AC19 instructs — opts out of every field of it, and `TextDetectionConfig::default()` does
  not reproduce it: `unclip_ratio` 2.0 → 1.5, `max_side_len` 4000 → `None`, and `limit_type`
  `Max` → `None`, which `DetResizeForTest` resolves to **`Min`**. That inverts the resize — with
  `Min`, `limit_side_len = 1600` pads the *short* side up rather than capping the long one, and a
  1520×920 image was measured being **upscaled to ≈2645×1600**. AC19's own clause "every remaining
  default stays put deliberately" was unsatisfiable: the setter destroys them. Only
  `score_threshold`/`box_threshold` survived, and only by coincidentally matching `Default`.
  **AC19 amended** (developer's call) to state all seven detection fields explicitly, each commented
  as either reproducing today's preset or being the one deliberate change, with `..Default::default()`
  in the detection config named as a failure by construction.

- **AC34's two halves scored very differently against real geometry, and the AC needed both a
  correction and an addition.** Measured over two renders (a 1520×920 Retina error dialog and a
  1520×1120 skewed document photo), comparing each detected region's box against the true ink extent
  inside it:
  - **Width is sound** — ink fills **97 %** of box width (median; min 0.76, max 0.99) across every
    config. `unclip_ratio = 2.0` expands the box, but almost entirely on the *height* axis, so the
    axis a selection highlight cares about is barely affected. AC34's width-fit is achievable and the
    failure mode it names as disqualifying does not occur horizontally.
  - **Height was wrong by ~1.5×** — ink is only **57–67 %** of box height on screenshots (86 % on the
    document photo). AC34's "`font-size` derived from the region's scaled height", taken literally,
    renders every span half again too large; the harness showed text bursting its boxes and colliding
    with neighbours. Fixed with a single named calibration constant, ≈0.62 to start.
  - **Rotation was missing entirely, and it is the one that would have been noticed.** `get_mini_boxes`
    returns a **rotated minimum-area rectangle**, not an axis-aligned box; the document photo measured
    **3.25° median tilt** (max 3.6°). Across a 650 px line that is ~37 px of vertical drift against a
    35 px ink height — the span walks a full line-height off the words by the end of the sentence, and
    the harness showed exactly that. **AC34 amended** to derive each span from the quad's own edges:
    position at point 0, target width = top-edge length, `font-size` = perpendicular-edge length ×
    the constant, `letter-spacing` fitted to measured width, rotation = `atan2` of the top edge. Exact
    for a rotated rectangle, **degenerates to the axis-aligned case at 0°** (screenshot panels were
    pixel-identical), view-side only per AD-1, no core change and no new model.

- **A conflation in the Task 1 record, recorded here rather than edited into it** (developer took the
  amend-AC34-only option, leaving the decision record as the historical artifact it is). Cut #7
  rejected deskew because `orientation_angle` is always `None` without a third bundled model. That
  remains true and Cut #7 remains correct — but `orientation_angle` is line-*orientation
  classification* (is this text sideways / upside down), which is a different quantity from the **fine
  skew angle**, and the fine angle is fully derivable from the bounding polygon AC16 already carries
  across the core boundary. The record cut "we can know the tilt" on grounds that only support cutting
  "we can know the orientation class."

- **Three AC claims came back clean, which is worth as much as the problems found:**
  - **AC16's coordinate space is correct.** `db_bitmap.rs:134-144` scales detection points by
    `dest_width / bitmap_width` where `dest_*` is `ImageScaleInfo.src_w/src_h`, documented in
    `processors/types.rs:112-115` as *"Original image height/width before resizing"*, then clamps to
    it. Confirmed empirically — polygons land on the pixels. Live Text's premise holds.
  - **AC20's test will pass.** A deliberately planted 105-character line came back **complete** under
    all three configs; `max_text_length` does not truncate at 25 on our construction path (the
    predictor builder's 100 is what reaches the decoder when the recognition config is unset). AC20
    said the test lands regardless of outcome — it lands green, so the explicit setting is
    drift-prevention rather than a bug fix, exactly as AC20's second clause anticipated.
  - **The record's `unclip_ratio = 2.0` figure is right.** `oar-ocr-core`'s own default is 1.5; the
    `general` preset overrides it to 2.0, and the preset is what ships. Checked because it looked like
    a drift, and it is not one.

- **One measurement recorded without acting on it.** At `limit_side_len = 1600` a 1520 px-wide image
  is not resized at all (long side already under the cap), where the shipped 960 config downscales it
  by 0.63 — yet recognition confidences were comparable on both spike images, and region counts were
  identical on the dialog (12 and 12). That is a data point for AC23's corpus, **not** a verdict on
  the raise; two synthetic renders are not a quality measurement and this record declines to treat
  them as one.

- **Slice 1 (AC15) complete, gate green, developer render-reviewed.** `useCopyFeedback` moved to
  `src/shell/` via `git mv` (so the diff records a rename with zero content change and the header
  rewrite reads as a separate edit); all seven import sites updated; no shim; the hoist-candidate
  comments in `JwtView`, `UuidView` and `CronView` deleted rather than reworded. **The spec AC15
  says to move with it did not exist** — the composable has been untested since Story 8.1, so its
  *New*-table entry is satisfied by writing one (7 cases) and its *Deleted*-table "(+ spec)" names
  a file that was never there. 845 -> 852 Vitest (the new spec exactly), 345 cargo unchanged, and
  AC15's hardest clause held: no existing assertion in any of the five islands needed a change.

- **Slice 2 (AC7–AC10, AC27, AC28) complete, gate green.** `BucketView.vue` (713 lines) and
  `BucketView.spec.ts` (711 lines, 33 `it()`) are deleted and replaced by three routed tools.
  Block counts land exactly on AC9's: **12 OCR + 13 PDF + 8 Image = 33.**
  - **AC9's verbatim-move gate, verified by diffing the moved blocks against `HEAD`'s** rather
    than asserted: **PDF is ONE changed line** — a comment naming `BucketView.vue`, a file the
    slice deletes — and **zero** assertion, mock or `bucket_*` command-name changes across all 13
    blocks. Six of the eight Image blocks are likewise byte-identical.
  - **The one behavioural deviation from AC9, isolated and raised rather than absorbed.** The two
    remaining Image blocks (`renders an estimate error…` / `renders a convert error…`) each also
    asserted that the Image error left *the OCR section's textarea* untouched, by seeding
    `registry.dropResult` and reading `.result`. After the split there is no OCR section in this
    view to disturb: the isolation those lines guarded is now **structural rather than tested**,
    the same reasoning AC29 uses to retire the two textarea tests. Each test keeps its Image-side
    assertions unchanged; three lines and the now-false "without disturbing OCR/PDF state" title
    fragment were removed. **AC9 says a changed Images assertion is "a failed AC9, not a judgement
    call"**, so this is recorded as a known deviation for the developer's ruling, not absorbed.
  - **An eighth breaking file the Task 2a sweep could not have found.** `src/router/index.spec.ts`
    asserted `expect(registry.tools).toHaveLength(7)` and now fails at 9. It contains **no
    occurrence of the string "bucket"**, so the repo-wide `grep -rli bucket` that built the
    *Authorised file surface* was structurally incapable of catching it — the assertion depends on
    the registry's *cardinality*, not on the retired tool's name. Worth carrying into 8.8/8.9,
    whose splits change the same count: a name-keyed sweep finds name-coupled files only.
  - **A second, smaller AC27 consequence:** `OcrView.spec.ts`'s drop-hint test asserted the old
    `"Drop a PNG, JPEG, or WebP image"` copy. AC27 replaces it with the format-agnostic
    `"Drop an image"`, so the assertion follows (and now also asserts the enumeration is *absent*).
    This is an OCR block, which AC9 explicitly allows to be rewritten.
  - **i18n (AC27):** 32 keys became 35 across `tools.ocr` (5) / `tools.pdf` (18) / `tools.image`
    (12), `en`/`fr` parity preserved and gated by `locales.spec.ts`. The 16 PDF and 11 Images keys
    moved verbatim. `tools.bucket.description`'s inventory sentence became three real ones, and
    `dropHint` was rewritten without an enumeration. **Two structural notes:** the shared
    `extractedTextLabel` served OCR *and* PDF from one block and is now duplicated, one copy per
    owning tool, same value; and `tools.bucket.heading` ("Bucket") simply dies — each view's `<h1>`
    is its own heading, which is why the moved sections' `<h2>` was promoted to `<h1>` (verified
    first that no test anywhere asserts on a heading, so the move gate is untouched).
  - **One style rule deliberately not transplanted, in each moved view.** `.pdf-section` and
    `.image-section` carried `margin-top / padding-top / border-top: 1px solid #ccc` — a
    *separator between the three siblings* of the old flat scroll, not a property of either
    section. On a standalone routed view it paints a stray hairline across the top of the page.
    The classes are kept so the markup stays verbatim and 8.8/8.9 keep their hook; the rule is
    dropped with an in-file comment saying exactly this.
  - **AC10 renames confirmed against the tree before executing**: `bucket-internal` and
    `bucket-input-too-large` really are emitted by `commands/pdf.rs` and `commands/image.rs`, so
    OCR gained **new** `ocr-internal` / `ocr-input-too-large` rather than renaming them. After the
    slice, every remaining `bucket` string in Rust belongs to PDF or Images — verified by grep.
  - Gate: `pnpm lint` clean · `vue-tsc` clean · **852 Vitest** · build clean · `cargo fmt` clean
    (it re-sorted `pub mod ocr;` and the `use` line alphabetically after the rename) ·
    `cargo clippy -D warnings` clean · **345 cargo tests**, unchanged from baseline.

- **Slice 3 (AC16–AC23) complete, gate green.** `OcrOutcome` is region-structured, EXIF
  orientation is applied, regions are sorted into reading order in core, the detection and
  recognition pipelines are configured explicitly, and the quality corpus exists. **361 cargo
  tests** (was 345) and **853 Vitest** (was 852).
  - **AC18's EXIF bug is now proven, not argued.** Building the fixture surfaced the failure
    directly: on the sideways image the pipeline returned four regions reading
    `"omohi bunpo"` at confidence **0.22**, `""`, `"0"`, `"0"` — confident nonsense on a
    boarding pass. With orientation applied, the same bytes return
    `"Boarding Information"` / `"Gate closes fifteen minutes before departure"` /
    `"Reference PNR 7XQ4LM"` / `"Seat 14A window"` at **0.987–0.999**. That is the FR26
    violation the record predicted, reproduced and fixed.
  - **Two fixture-construction findings worth keeping.** `sips` writes its own EXIF APP1, and
    `zune-jpeg` (which `image` delegates metadata to) returned *that* chunk rather than an
    appended one — so the fixture had to be built by walking the JPEG's marker segments,
    dropping the existing `Exif\0\0` APP1, and inserting ours after SOI/APP0. Appending a
    second Exif segment silently does nothing. The fixture also had to be rendered at 2x:
    at 1x the recovered text was too soft to assert on even once correctly oriented.
  - **AC20 lands green, which is the outcome the AC anticipated but could not assume.** A
    planted 105-character line survives intact, so `max_text_length` does not bound CTC
    decoding at 25 on our construction path — the predictor builder's 100 is what reaches the
    decoder when the recognition config is unset. It is now set explicitly at 100, so the
    behaviour is pinned rather than inherited, exactly as AC20's second clause asked.
  - **AC21's sort is a pure function with its own unit tests**, separate from the corpus: a
    sidebar banding case, a button row misaligned by two pixels, a stacked-lines case proving
    adjacent lines are *not* banded, and the degenerate zero/one-region case. `ROW_BAND_FRACTION`
    is a named constant (0.5 of a region's own height).
  - **AC23's corpus asserts content and order through separate helpers**, so a reading-order
    regression fails distinctly from a recognition regression — `assert_contains_lines`
    (whitespace-collapsed, case-folded, per expected line) and `assert_order` (relative order,
    independent of what else was recognised). Five fixtures: `screenshot-error-dialog.png`
    (Retina, dense, carries both the long line and a sidebar), `document-photo.png` (~3.3° skew,
    soft focus), `two-column.png`, `scan.png` (greyscale, softened) and `exif-rotated.jpg`.
  - **The two-column fixture is a CHARACTERISATION test, deliberately.** AC21 states the sort
    does not claim to handle a true multi-column spread, so
    `corpus_two_column_documents_the_sorts_stated_limit_rather_than_hiding_it` asserts the
    *interleaved* order it actually produces — the right column's first line following the left
    column's first line. If a future change makes columns read properly that test fails loudly
    and is updated, rather than the behaviour drifting unnoticed.
  - **The TS mirror follows the codebase, not a guess.** `image_width`/`image_height` are
    snake_case because nothing renames fields across this IPC boundary — no core struct carries
    `#[serde(rename_all = "camelCase")]`, and the existing mirrors keep the Rust spelling
    (`cronExplanation.ts`'s `next_runs`, `scheduleDescription.ts`'s `day_of_month`). Checked
    before writing rather than after a failing test.
  - **AD-1 held at the boundary:** core gained `has_readable_text()` (a predicate, not a
    formatter) and no whole-text accessor. The join lives in `OcrView.vue`, and both the core
    tests and the command-layer tests define their own local `joined()` helper rather than
    pulling one into the library.
  - **AC22 recorded, not fixed**, in `commands/ocr.rs` above `ocr_engine`: one shared `OAROCR`
    behind `&self`, a superseded request still running to completion, `Send + Sync`
    compiler-enforced so it is safe, contention unmeasured, cancellation out of scope because
    `oar-ocr` exposes no token through its single `predict()` call.
  - **One documentation drift found:** the decision record says the EXIF findings were verified
    against "vendored `image` 0.25.10". `Cargo.lock` pins **0.25.9**, which is what was read
    this slice. The finding is unchanged — `decode()` still does not apply orientation in 0.25.9
    — only the version number in the record's prose is wrong.

- **The ⌘ finding — developer-raised, and it corrected AC36's rationale.** The developer
  screenshotted this session's own conversation and found `⌘` recognised as `8` in "⌘V" and as
  `渊` in "⌘K", then asked the right follow-up: how does the symbol's confidence compare to a
  letter's, and is the threshold simply too low?
  - **Why it happens, verified not assumed:** `⌘` (U+2318) is **absent** from the bundled
    `character_dict.txt`; `渊` is present at line 3497. A CTC recogniser is a closed-vocabulary
    classifier — one output class per dictionary entry plus a blank, no "unknown" class — so it
    cannot emit `⌘` and must pick the nearest learned shape. The dictionary is **89.4% CJK
    ideographs and 1.4% ASCII** (6,174 vs 94 of 6,904), so the model has ~6,000 dense boxy
    glyphs to reach for and 94 Latin ones. That is Cut #17's abstract argument appearing as a
    concrete artifact. `⇧ ⌥ ⌃ ⏎ ↵` are absent too; `€ £ § ± →` are present.
  - **The developer's instinct was right and my first answer was incomplete.** Measured in
    isolation, out-of-vocabulary glyphs score nothing like real characters: `⌘` **0.0000**
    (dropped entirely), `⇧` **0.4961**, `⌥` **0.5203**, `⌘V` **0.8909**, `⌘⇧⌥⌃` **0.6451** —
    against **0.989–1.000** for `8 5 K V A Q`. The signal exists, with a huge margin.
  - **But the threshold was not the problem — the granularity is.** Across the 36 correctly
    recognised regions in the quality corpus: min **0.9504**, median 0.9879, max 0.9998. A
    threshold at 0.75, 0.90 or 0.95 produces **0/36** false positives; 0.975 produces 8/36
    (22%) and 0.98 produces 11/36 (31%). The ⌘-corrupted long line scores **0.9735** and the
    identical clean line **0.9763** — the distributions overlap completely, so no threshold
    separates a single bad character from good text.
  - **Root cause, one layer below our own fix.** Region confidence is
    `conf_list.iter().sum::<f32>() / conf_list.len() as f32` (`decode.rs:236`, and again at
    :523 and :623). The per-character probabilities exist and are averaged away before reaching
    any public type — `OAROCRResult` exposes only `TextRegion.confidence`. **This is the same
    class of mistake this story just fixed one layer up**, where `run_ocr` averaged per-region
    confidences and joined the text, destroying the pairing and the geometry. Ours was fixable
    because the data was in our own loop; this one is upstream.
  - **A second, unprompted find:** the corpus already ships an unflagged substitution —
    `Request-Id:4f2a9c1e-…` recognised as `4f2a9c**l**e-…` (digit 1 as letter l) at **0.9531**.
    So this is not a `⌘` curiosity; it is the general single-character-confusion case, occurring
    in text the suite already treats as passing.
  - **Outcome:** threshold set to **0.90** (developer's call, landing exactly where the
    measurements pointed — 0.89 was tried first and reversed once the 0.8909 `⌘V` case made the
    0.0009 margin visible, which is the trade-off being written down doing its job) in a new
    `src/tools/ocr/lowConfidence.ts` with `isLowConfidence` /
    `isUnreadable` and a spec that encodes the measurements as regression guards — including a
    test asserting the intra-region case is NOT caught, so nobody later "fixes" the threshold to
    chase it and marks a fifth of all correct text instead. **AC36's rationale amended**: the
    marking is an honest region-level signal, not the primary defence against confident
    nonsense. 8.6's lesson 4 exactly — the decision survives, the stated reason does not.
  - **Filed as [#135](https://github.com/dipaneb/umbra/issues/135)** (`backlog-candidate`,
    2026-09-07, developer-authorised), carrying the `decode.rs:236` mechanism, the controlled
    0.9735-vs-0.9763 pair, the threshold false-positive table, the isolated-glyph measurements,
    both real-world instances, and the fork-or-go-deeper cost with its `oar-ocr` pin dependency.

- **Slice 4 (AC11–AC14, AC31–AC42) complete, gate green — the Live Text surface.** **917 Vitest**
  (was 862) and 361 cargo, unchanged. `OcrView.vue` is rewritten: the `<textarea>` is gone, the
  recognised text renders exactly once as transparent selectable spans on the image, and the view
  is fully tokenised (AC42's substance, landing in this slice per the developer's call).
  - **AC11's mechanism had to change, and the reason is verified, not assumed.** The AC said to
    call `allow_file(path)` for the new file and `forbid_file(...)` for the previously granted
    one. Read against `tauri-2.11.5/src/scope/fs.rs`: `is_allowed` checks the **forbidden**
    patterns first and returns `false` unconditionally on a match (`:432`), and the `Scope` API
    exposes only *appending* operations — `allow_file` / `forbid_file` / `allow_directory` /
    `forbid_directory` — with **no way to remove a pattern** (`allowed_patterns()` and
    `forbidden_patterns()` return copies, not handles). So forbidding permanently poisons a path
    for the life of the process: **drop A, drop B, drop A again, and A silently stops rendering
    forever.** Comparing two screenshots and going back to the first is an ordinary thing to do,
    and it would present as a blank image with no error attached. Implemented **allow-only**,
    with the cost stated in the code: the webview retains read access to every image opened *this
    session* — in-memory, dead on quit, exactly the files the user chose, but wider than "one file
    at a time". A custom URI scheme serving a single path from Rust is the version that achieves
    the AC's original intent; it needs a CSP entry, which AC11 says is not modified. **Raised for
    a ruling rather than quietly rescoped.**
  - **`src-tauri/Cargo.toml` gained `features = ["protocol-asset"]`** on the existing `tauri`
    dependency. Not a new dependency — `asset_protocol_scope()` is gated behind that feature and
    the config is inert without it — but the *Authorised file surface* listed this file for AC10's
    comment fixes only, so the widening is recorded. `Manager` is imported locally inside
    `grant_asset_access` because this module's top-level import is `#[cfg]`-gated to the non-test
    build (the two `models_dir` variants) and the grant runs in every build.
  - **AC12 wired without a mutable capture.** `dispatchPaste`'s runner now returns
    `{ value, image }` rather than assigning the clipboard image to a captured `let` — which
    TypeScript could not narrow through the closure anyway. The shell publishes the very pixels it
    recognised from; the view builds a canvas from them. No second clipboard read, so no second OS
    I/O edge and no race against a clipboard that changes during the ~3 s inference.
  - **AC14 published as `dragOverToolId`, not a bare boolean.** The AC said boolean; the tagged
    form follows the lesson already written into `dropSourcePath`'s own comment — *an untagged
    shared field is a footgun for a future second consumer*. Redundant today, cheap insurance
    later. The routing rule is a pure `routeDragState` in `dropZone.ts` with its own tests,
    including that a tool declaring no `drop` never highlights: lighting up a target on a view
    that will refuse the file is a lie told a moment before the refusal.
  - **A latent type hole closed in passing.** `dropZone.spec.ts` declared its own loose
    `DragDropCallback` (`{ type: string; paths: string[] }`), which had let an existing test pass
    `{ type: "over", paths: [] }` — a payload Tauri never sends, since `over` and `leave` carry no
    `paths`. Widened to mirror `@tauri-apps/api/webview`'s real union; the impossible payload is
    corrected and the test's assertion is untouched.
  - **The overlay geometry is a pure module, not view code.** `overlayGeometry.ts` implements
    AC34's amended rule — position at the quad's first corner, target width from the top edge,
    `font-size` from the perpendicular edge times `FONT_SIZE_RATIO = 0.62`, `letter-spacing` fitted
    to the *measured* width, rotation from `atan2` of the top edge — plus AC35's `fitScale`
    (never upscale) and AC38's `substringSpan`. Nineteen tests, including that a 3.25° quad
    rotates by its own angle, that the zero-tilt case is byte-identical to the axis-aligned one
    (one code path, not two), and that a missing text measurer degrades to unfitted spans rather
    than `NaN`. `OVERLAY_FONT_STACK` is exported so the measurer and the renderer cannot drift —
    measuring in one font and rendering in another makes every fitted width wrong by a different
    amount per glyph, which looks random rather than systematic and is worse than not fitting.
  - **AC38's match ordering came out free.** `findMatches` iterates `regions` in the order core
    sorted them, so find order is correct without re-deriving anything — the third consumer of the
    one geometric sort, after Copy fidelity and screen-reader DOM order. Matching is literal, not
    regex: nobody typing into a find box expects `.` to match any character, and building a
    `RegExp` from user input would need escaping to be safe.
  - **AC29's two deliberate retirements executed, and only those two.** The old spec's *"lets the
    extracted text be edited…"* and *"re-seeds the editable field…"* are gone with the `<textarea>`
    they described; the second also described the stale-snapshot bug class (8.6's lesson 5) that
    removing the field structurally dissolves. `OcrView.spec.ts` is 30 tests against the new
    surface — the three doors, drag-over, both entry points, reading order in the DOM, the
    diagnosis state, shape-not-hue marking, the picker through the tool-scoped runner, copy,
    find, and the AC41 accessibility contract including that **the image's accessible name is not
    the filename** (asserted against a path containing a personal name).

- **Slice 4 render-review round: the find-match drift, and what it cost to find.** Five rounds
  of developer testing against the Live Text overlay. Four of the fixes were wrong, each in a
  way worth recording; the fifth is a real solution. Write-up published as an artifact:
  <https://claude.ai/code/artifact/0982dd45-c869-483e-a9a5-057adf184d4a>.
  - **The defect.** Find highlights drifted right, proportionally to how far into a line the
    match sat. Short lines exact, long lines off by a word or more.
  - **The cause, finally isolated.** Character geometry came from `oar-ocr`'s
    `return_word_box`. On the bundled model it returns one box per **character** and the count
    matches `text.chars().count()` on every corpus fixture — which is what made it credible.
    But those positions are **CTC timestep fractions** (`decode.rs:514`), recording where the
    recogniser *fired*, not where the ink is. The recogniser squashes each line crop to a fixed
    input width with a fixed timestep count, so beyond a certain line length the positions
    compress. Measured against ground truth: **86 px error on a 40-char line, 166 px at 80,
    322 px — over twenty characters — at 160**, on a 15.7 px character. The 200-char line is
    accurate, which is the trap: at one particular length they happen to be right.
  - **Cut #4 stands, and its reversal is undone.** Discovery cut word-level geometry on the
    grounds the model might not support it. It does support it; the positions are still
    unusable. `return_word_box(true)` is removed with the measurements written into the
    in-file comment, so nobody re-enables it on a matching count again.
  - **The fix: `measure_char_polygons` in `crates/umbra-core/src/ocr.rs`.** Crop the region
    from the image already in hand (no new dependency), threshold by **Otsu** so no constant is
    tuned to one screenshot, decide ink polarity from the region's own top and bottom rows
    (padding by construction, so dark-on-light and light-on-dark both work without a guess),
    build a column-wise ink profile, and take the **N−1 widest gaps** as word separators —
    not every gap, since monospaced glyphs are separated by blank columns too. Characters are
    distributed across each word's own span: exact for a monospaced face, within about one
    character for a proportional one.
  - **Result: error flat at ~3 px (0.19 characters) across 40, 80, 160 and 200-character
    lines** — the plan's acceptance criterion was that it must not grow with index or line
    length, and it does not.
  - **It can decline, and that is the point.** Requiring exactly N−1 word gaps *is* the
    confidence check. A line tilted beyond `MAX_MEASURABLE_TILT_RAD` (~2°) is refused outright
    — an axis-aligned column profile is meaningless on slanted glyphs — as is a crop with fewer
    columns than characters, or one whose gaps don't resolve. A refusal returns nothing and the
    view bands the whole line with a dashed *approximate* mark. Same posture as refusing to
    show an invented progress bar: a wrong box drawn precisely is worse than an honest
    imprecise one.
  - **Four wrong diagnoses, kept because they transfer better than the fix:**
    1. *Font-metric estimation* — real, and fixing it was progress, but not the whole bug.
    2. *A count taken as proof of position* — `boxes.len() == chars().count()` proves how many,
       never where. It read as verification and was arithmetic.
    3. *Ground truth at one length* — the harness only ever saw 45–57 character lines; the
       developer's terminal is 175 columns. The failing regime was never sampled.
    4. *A diagnostic that could not fail* — drawing every character box looked correct, but
       per-character boxes **tile a line edge-to-edge**, so a compressed set covers exactly the
       same pixels as a correct one. The picture could not have shown the defect.
  - **A process cost worth naming:** Vite hot-reloads the Vue side in milliseconds while a Rust
    change needs a full `cargo` rebuild and an app restart, so a fix spanning both can land
    half-applied with no error anywhere. At least one render review was taken against a
    half-applied build, which produced a symptom the code on disk could not generate.
  - **Also fixed in this round, from developer feedback:** controls moved OUT of the image
    (AC37/AC38 revised — pinned inside, the cluster covered whatever text sat under it); the
    current-match highlight made translucent (a solid fill hid the very pixels being checked,
    because unlike JsonTree there is no opaque text drawn on top); match bands widened and the
    non-current border dropped; find bar always visible with ⌘F focusing rather than summoning;
    empty query showing nothing rather than "No matches"; step arrows hidden below two matches;
    `.match` given `transform-origin: 0 0`. New tests: `long-lines.png` fixture, the
    photographed-page decline, and left-to-right monotonicity.

- **SESSION HANDOFF, 2026-09-08 — resume here.**
  - **Done and developer-render-reviewed:** slices 1 (AC15 hoist), 2 (AC7–10/27/28 split),
    3 (AC16–23 core), 4 (AC11–14, AC31–42 Live Text). Branch
    `feat/story-8-7-reimagine-the-bucket-ocr`, **5 commits, all work since them UNCOMMITTED**
    (~56 files). Nothing pushed at any point.
  - **Gate at handoff: 938 Vitest, 366 cargo**, `pnpm lint` / `vue-tsc` / `pnpm build` /
    `cargo fmt --check` / `cargo clippy -D warnings` all clean. Baseline was 845 / 345.
  - **Slice 5 is all that remains**, and it is the last: AC24 (`ocr-unsupported-format` gets a
    project-authored sentence and joins `TRANSLATABLE_CODES` with `en`/`fr` keys; Story 4.3's
    corrupt-PNG test stops asserting on the `image` crate's prose), AC25 (a dropped PDF caught
    by `%PDF-` magic bytes, answered with a sentence not a routing offer), AC26 (every
    `TRANSLATABLE_CODES` exclusion recorded with its reason in `toolError.ts`), AC30 (the
    manual `pnpm tauri dev` screen-reader pass — needs the developer, a passing spec does not
    satisfy it), and the `ARCHITECTURE-SPINE.md` AD-14/AD-15 asset-protocol amendment.
  - **Two open questions carried in, both raised and neither yet ruled on:**
    1. **AC11's asset grant is allow-only.** Verified against `tauri-2.11.5/src/scope/fs.rs`:
       `is_allowed` checks forbidden patterns first (`:432`) and the `Scope` API has no
       pattern-removal, so the AC's `forbid_file` step would permanently poison any file the
       user returns to. Cost of allow-only: the webview keeps read access to every image opened
       *this session* (in-memory, gone on quit). The alternative achieving the AC's original
       intent is a custom URI scheme serving one path, which needs the CSP change AC11 forbids.
    2. **The blur + sweep loading state** on a full-screen paste is still unreviewed.
  - **AC amendments made this story, all developer-approved, all recorded above with evidence:**
    AC19 (must state all seven detection fields — the `general` preset is all-or-nothing),
    AC34 (quad-edge geometry + `FONT_SIZE_RATIO`, not the region's full height),
    AC36 (threshold 0.90 measured, and the rationale corrected — region-level marking cannot
    see an intra-region substitution), AC37/AC38 (controls moved OUT of the image),
    AC42 (tokenisation lands in the Live Text slice, not the first).
  - **Cut #4 stands.** It was reversed mid-story and re-cut on measurement; do not re-enable
    `return_word_box` on the strength of a matching box count. See the ⌘ finding
    (issue [#135](https://github.com/dipaneb/umbra/issues/135)) and the character-geometry
    write-up (artifact `0982dd45-c869-483e-a9a5-057adf184d4a`).
  - **Process note for the next session:** Vite hot-reloads the Vue side in milliseconds while
    a Rust change needs a full `cargo` rebuild and an app restart. A fix spanning both can
    reach a render review half-applied, which cost several rounds here. When a render review
    contradicts a verified measurement, check the build state before re-diagnosing.

- **Slice 5 (AC24–AC26, AC30 + the spine amendment) — 2026-09-08. Code complete; AC30's
  manual pass is the one thing left and it needs the developer.**
  - **AC24.** `crates/umbra-core/src/ocr.rs` now names its own sentence:
    `UNSUPPORTED_FORMAT_MESSAGE = "That file isn't an image this tool can read."`, replacing the
    `image` crate's `"The image format could not be determined"` at all three decode call sites.
    Joined `TRANSLATABLE_CODES` with `errors.ocr-unsupported-format` in both locales.
  - **AC24's second clause is a no-op, and the AC's premise is factually wrong — verified, not
    assumed.** It says Story 4.3's corrupt-PNG test "currently asserts on the `image` crate's
    phrase *unexpected end of file*". It does not, and never did:
    `git grep -l "unexpected end of file" d576c3e` matches only `4-3-the-bucket-never-bluffs.md`
    and `sprint-status.yaml`, and the baseline tests
    (`d576c3e:crates/umbra-core/src/ocr.rs:272`, `d576c3e:src-tauri/src/commands/bucket.rs:316`)
    assert `err.code` only. The phrase was in the *story document*, describing what a user saw —
    it was never a test assertion. Nothing to change; the AC's intent (tests assert codes, not
    third-party prose) already held, and now the prose is ours as well.
  - **AC25.** `PDF_MAGIC = b"%PDF-"` and `reject_pdf()` run **before** any decode is attempted, so
    a dropped PDF is answered by name (`ocr-pdf-wrong-tool`, *"PDFs open in the PDF tool."*)
    rather than as an unreadable image. A signature check at byte 0, not a substring search —
    pinned by a test using bytes that mention `%PDF-` mid-string and must still read as
    unsupported-format. No new Rust dependency: a byte comparison and a string.
    - The guard is on the compressed-bytes path only. `extract_text_from_rgba` receives
      already-decoded clipboard pixels with no container left to sniff — the asymmetry is
      deliberate and is itself pinned by a test, so nobody "fixes" the missing guard later.
    - Code name reasoning: `ocr-pdf-wrong-tool` over `ocr-pdf-not-supported`, because PDFs *are*
      supported — in the PDF tool. The code should not imply a capability gap that does not exist.
  - **AC26.** Every `ocr-*` exclusion is now recorded in `toolError.ts` with its own reason, and
    the reasons are **asserted, not merely commented**: `toolError.spec.ts` has a table test
    proving each of the six excluded codes falls through to its raw message. AC26's stated reason
    for `ocr-malformed-request` was verified against the code before being written down —
    `parse_dimension_header` + `extract_clipboard_request` really do emit four different sentences
    under one code, and three of them interpolate the offending header's name.
  - **The AC24/AC25 English assertions cannot prove AC24, and that was worth catching.** Both
    locale strings are word-for-word the Rust `message`, so an English-only test passes whether or
    not the code ever reached `TRANSLATABLE_CODES`. `OcrView.spec.ts` gained a French-locale block
    that asserts the French sentence renders and the Rust sentence does *not*. Verified
    non-vacuous by temporarily removing `ocr-pdf-wrong-tool` from the set: the test fails with
    `expected 'PDFs open in the PDF tool.' to contain 'outil PDF'`.
    - `src/shell/frenchRender.spec.ts` is normally the single place that flips the locale. Its
      stated reason — don't let a flip invalidate English assertions elsewhere — is honoured here
      (scoped to one block, restored in `afterEach`). Mounting `OcrView` over there would have
      required installing module-level Tauri `core`/`dialog` mocks into a file whose four existing
      tests do not want them, so the flip moved rather than the view.
  - **Spine amendment (AD-14/AD-15) written**, recording the asset protocol as a third OS I/O edge
    and a second non-IPC route for image bytes, the deny-by-default + per-file-runtime-grant
    shape, the verified reason `capabilities/default.json` needs no entry, why
    `tauri-plugin-persisted-scope` is deliberately absent, and — in full — the allow-only
    limitation and its cost. AD-15's rule line gained a cross-reference so a reader of AD-15
    alone cannot miss it.
  - **`deferred-work.md` reconciled.** Gap #3 (near-full-length truncation) and gap #6
    (`confidence` never read) marked resolved with the evidence; gap #4 (`as OcrOutcome`)
    restated as still-deferred with **raised** priority and its reason updated — the assertion now
    covers a nested region list the view indexes into, so a malformed payload can index into
    arrays that are not there rather than merely render a wrong string. Path rot from this
    story's own split fixed in two entries belonging to other stories.
    **Gap #5 (`role="status"` never manually verified) is deliberately left open** — it closes
    only when AC30's pass actually happens.

- **THREE THINGS RAISED, NOT ABSORBED (slice 5).**
  1. **AC2's FR propagation was incomplete, and this is the exact drift AC2 exists to prevent.**
     The decision record states every FR revision "must be propagated to `prd.md` **and**
     `epics.md` in this story". `prd.md` got all four (FR23–FR26). `epics.md`'s FR catalogue at
     `:73–:76` got **none** — it still read *"FR23: Drop zone accepts images (PNG, JPEG, WebP…)"*,
     the very enumeration AC24's premise is built on. Task 1's commit (`585349b`) updated
     epics.md's AD-8 line, Stack table, ordering preamble and story scopes, and missed the FR list
     itself. **Fixed in this slice** — all four lines now carry the revision with a pointer to
     `prd.md`. `epics.md` is **not on the authorised file surface**, so this is flagged rather
     than absorbed: it is AC2's own requirement, not new scope, but the surface table should
     record it.
  2. **`Cargo.lock` gained a transitive crate, so the surface table's "No new Rust dependency" is
     no longer true** — and with it, the basis on which the AD-7 `cargo tree -i reqwest` audit was
     declared N/A. Slice 4's `protocol-asset` feature pulls **`http-range` 0.1.5** (zero
     dependencies of its own, from `tauri` 2.11.5 itself). It parses HTTP Range *header strings*
     so the asset protocol can serve byte ranges of local files; it opens no sockets and is not a
     network-purpose dependency under AD-7. **The audit was run rather than assumed:**
     `cargo tree -i reqwest --workspace` returns `reqwest v0.13.4 └── tauri-plugin-updater` and
     nothing else — the disclosed updater carve-out, unchanged.
  3. **Two stale comments naming the deleted `<textarea>`** (`src/shell/dropZone.ts:33`,
     `src/shell/DropZone.vue:66`) both listed "the OCR view's own editable text-output field"
     among the editable elements ⌘V must not be intercepted over. Both files are on the authorised
     surface; the rot was created by this story. Corrected to name the view's **find field**,
     which is still a real text input and still needs that protection. Also de-rotted
     `toolError.ts`'s "all 27 ToolError codes", which was off by roughly forty-four — replaced
     with a non-numeric phrasing so it cannot rot again.

- **Slice 5 gate: 949 Vitest (was 938), 371 cargo (was 366).** `pnpm lint` · `vue-tsc` ·
  `pnpm build` · `cargo fmt --check` · `cargo clippy -D warnings` all clean. **Nothing pushed,
  nothing committed.**

- **STILL OPEN — all three need the developer, and the story cannot reach `review` without the
  first.**
  1. **AC30's manual `pnpm tauri dev` screen-reader pass has NOT been done.** A passing Vitest
     spec does not satisfy it, by the AC's own words. It must cover the pre-existing,
     never-manually-verified no-text-found `role="status"` region (deferred gap #5) **and** the
     in-flight start/completion announcements this story adds (`aria-live="polite"`, the `.sr-only`
     region at `OcrView.vue:673`). The per-slice light/dark render review for slice 5 is also
     outstanding.
  2. **AC11's allow-only asset grant still needs a ruling** (carried from the previous session,
     now written into the spine as shipped-with-cost rather than left only in this file).
  3. **The blur + sweep loading state on a full-screen paste is still unreviewed** (carried).

- **Render review round 2 (2026-09-08) — three reported bugs, one shared cause, plus a fourth
  found on the way.**
  - **All three reported symptoms came from a single omission:** `resetForNewSource()` was wired
    to the **file picker only**. Drop and paste never called it, so a second image inherited the
    first one's state, and each symptom the developer described is a different consequence of the
    same stale `outcome`:
    - `extracting` is derived as *image present and no outcome and no error*, so a surviving
      outcome kept it **false** — the second image arrived with no blur and no sweep.
    - `naturalSize` reads `outcome.image_width` **first**, and correctly so (those are the
      coordinates the region polygons live in, post-EXIF) — so the second image was drawn into
      the **first one's dimensions**, stretched to a shape it never had.
    - `findQuery` and `currentMatch` survived, so match highlights computed from the old image's
      geometry were painted over the new one, pointing at text that is not there.
    Fixed by calling `resetForNewSource()` from the drop and paste **source** watchers rather
    than by patching the three symptoms separately. **The ordering is safe and was verified, not
    assumed:** `DropZone.vue` publishes `dropSourcePath`/`pasteSourceImage` *before* it invokes
    (`:125`/`:47`) and the result only after the await (`:132`/`:54`), so the source signal always
    precedes the outcome it belongs to and the reset can never wipe a fresh result.
  - **Fourth bug, unreported because it hides — and my fix would have made it worse.** On the
    drop and file-picker paths `naturalSize` had no third fallback, so it was **0x0 until
    recognition returned** ~3 s later. `.surface` is sized from it and clips its overflow, so the
    image *and* the sweep inside it were invisible for the entire wait — an AC33 violation
    ("the image renders in the FIRST frame") that the existing spec missed because it asserted
    `.in-flight` **exists**, never that it has a size. Previously a second drop at least
    inherited the old outcome's dimensions; once the reset was added it would have gone to 0x0
    every time. Fixed with a `loadedSize` ref filled from the `<img>`'s own `naturalWidth`/
    `naturalHeight` on `@load`, ranked **below** the outcome so the oriented dimensions still win
    the moment they exist.
  - **Message placement (the reported error the developer never saw).** `.pane` is `flex: 1`
    inside a full-height column, so the two message paragraphs rendered *after* it sat at the
    bottom edge of the window — hundreds of pixels from the drop target they belonged to. Each
    message moved to the surface it describes: a drop/paste error now renders **inside
    `.drop-target`**, under the controls that offer another go (every such failure clears the
    image, which is what puts the target back on screen); `no-text-found` and the one error that
    keeps its image (a copy failure) render **in the toolbar**, this view's existing status row,
    directly above the image.
  - **Nine regression tests, each proved non-vacuous by reverting the fix it covers.** The three
    reported bugs fail with exactly the developer's description — `expected false to be true`
    (no animation), `expected 'width: 400px; height: 200px;' to contain 'width: 40px'` (old
    dimensions), `to have a length of +0 but got 2` (stale highlights) — and the size bug fails
    with `expected 'width: 0px; height: 0px;'`. They are written as separate tests on purpose:
    one shared cause today, but a future refactor that fixes one by accident should not be able
    to claim the other two.
  - Gate after this round: **958 Vitest** (was 949), 371 cargo unchanged (no Rust touched).
    `pnpm lint` · `vue-tsc` · `pnpm build` clean. **Nothing pushed, nothing committed.**
  - **Still needs the developer:** a re-review of these four fixes in `pnpm tauri dev` (light and
    dark), then AC30's manual screen-reader pass, which remains the last gate on this story.

- **AC30 — manual `pnpm tauri dev` screen-reader pass, 2026-09-08 (VoiceOver, macOS). PARTIAL:
  one real finding, fixed; the rest of the pass still owed.**
  - **Developer's result:** the in-flight and completion announcements work. **The no-text-found
    case announced NOTHING** — the exact gap #5 that has been open and unverified since Story
    4.3, found the first time anyone actually listened to it. The image-replacement fixes and
    the blur + sweep were confirmed good in the same session.
  - **Why a passing spec never caught it, and why AC30 exists.** A live region only speaks when
    an element **already in the accessibility tree** changes its content. The visible no-text
    message is `v-if`-inserted, so the region and its text arrived in the same tick and there
    was nothing for VoiceOver to observe. Every DOM assertion passes — `role="status"` really is
    present, with the right text — and the user hears silence. jsdom has no accessibility tree
    and no screen reader, so no Vitest spec can distinguish the two. **This is the first
    finding in Epic 8 that only a manual pass could produce**, and it is a fair answer to
    whether AC30's requirement was worth writing.
  - **Fixed by making the always-mounted `.sr-only` region the single spoken channel**, carrying
    the result sentence rather than a fixed one. The visible toolbar message lost its
    `role="status"`: with the announcer speaking, a second region would have doubled the
    announcement rather than fixed anything.
  - **A second bug fell out of the same fix.** The old code announced *"Text extracted."*
    unconditionally — including when nothing was extracted. Inaudible, so nobody had heard it,
    but it was the tool bluffing about its own result in the app whose entire claim is that it
    never does. The announcer now says what actually happened, including AC39's stronger
    diagnosis (*regions found but not recognised*) when that is the honest answer.
  - Five tests added. They assert the announcer's **text** — which is what a screen reader
    reads — and deliberately do not claim to prove audibility, since that is precisely the thing
    jsdom cannot check and precisely why this AC requires a human.
  - Gate: **963 Vitest** (was 958), 371 cargo unchanged. `pnpm lint` / `vue-tsc` / `pnpm build`
    clean. **Nothing pushed, nothing committed.**
  - **Still owed on AC30:** the error path (drop a `.txt` or a PDF) has not been heard yet. Its
    visible message keeps `role="alert"`, which is inserted the same way the no-text region was
    — so it is a live candidate for the same failure, and the same fix applies if it is silent.
    Deferred gap #5 stays open in `deferred-work.md` until the pass is complete.

- **AC30 COMPLETE, and AC11 RULED — 2026-09-08. Task 2b closes; every AC is satisfied.**
  - **Second half of the screen-reader pass, after the fix:** the developer confirms both the
    no-text-found state and the PDF error are now announced. `role="alert"` on the error was the
    open risk — inserted the same way the silent `role="status"` region was — and it **does**
    announce, so no further change was needed. Deferred gap #5, open since Story 4.3, is closed
    with a verification rather than an assumption, and its lesson is recorded where the next
    person will hit it: *an inserted live region is not a live region — mount it first, change
    its text second.*
  - **AC11 ruled by the developer: allow-only ships.** The reasoning is written into
    `ARCHITECTURE-SPINE.md` beside the limitation rather than left in this file — the grant list
    is reachable only from our own webview, which has no network scope (AD-7) and a CSP blocking
    external scripts, so exploiting the retained grants presupposes arbitrary JS execution, at
    which point the on-screen image is readable anyway. A custom URI scheme stays the
    construction that achieves the original intent, and is a backlog candidate if the threat
    model changes.
  - Also confirmed at this render review: the image-replacement fixes and the blur + sweep
    loading state (the second carried-in open question — now closed).

### File List

Complete as of slice 5. **Committed** = landed in one of the branch's 5 commits (Task 0/1/2a docs).
Everything else is uncommitted working-tree change from slices 1–5. Two entries are marked ⚠ —
they are **not on the story's Authorised file surface** and are raised in the Completion Notes.

**Story and planning documents**

- `_bmad-output/implementation-artifacts/8-7-ocr-decision-record.md` (new, committed) — Task 1 decision record
- `_bmad-output/implementation-artifacts/8-7-reimagine-the-bucket-ocr.md` (modified) — AC7–AC42, task checkboxes, Dev Agent Record, File List, Change Log
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified, committed) — story status `ready-for-dev` → `in-progress`
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified) — gaps #3 and #6 resolved, gap #4 restated with raised priority, path rot fixed
- `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` (modified) — AD-8/model-tier entry (Task 1, committed); AD-14/AD-15 asset-protocol amendment (slice 5)
- `_bmad-output/planning-artifacts/epics.md` (modified) — AD-8, Stack, ordering preamble, story scopes (Task 1, committed); **FR23–FR26 catalogue propagation (slice 5)** ⚠
- `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` (modified, committed) — FR23–FR26 revisions
- `_bmad-output/party-mode/memories/installed/.memlog.md` (modified, committed) — session memory (party-mode artifact, not story scope)
- Design canvas (published Artifact, not a repo file) — `https://claude.ai/code/artifact/cd67d1db-4126-41a6-a9bb-d5c2cb9969f5`
- Character-geometry write-up (published Artifact, not a repo file) — artifact `0982dd45-c869-483e-a9a5-057adf184d4a`

**New — Vue**

- `src/tools/ocr/OcrView.vue`, `OcrView.spec.ts` — the Live Text surface
- `src/tools/ocr/overlayGeometry.ts` + `.spec.ts` — quad-edge span placement (AC34)
- `src/tools/ocr/findMatches.ts` + `.spec.ts` — find-in-image matching (AC41)
- `src/tools/ocr/lowConfidence.ts` + `.spec.ts` — the measured 0.90 threshold (AC36)
- `src/tools/ocr/realOutcome.fixture.json` + `realOutcome.spec.ts` — real detector output as a fixture
- `src/tools/pdf/PdfView.vue`, `PdfView.spec.ts` — verbatim move (AC9)
- `src/tools/image/ImageView.vue`, `ImageView.spec.ts` — verbatim move (AC9)
- `src/shell/useCopyFeedback.spec.ts` — the spec the composable never had (AC15)

**Renamed / moved**

- `src/tools/bucket/ocrOutcome.ts` → `src/tools/ocr/ocrOutcome.ts`
- `src/tools/bucket/imageTargetFormat.ts` → `src/tools/image/imageTargetFormat.ts`
- `src/tools/json/useCopyFeedback.ts` → `src/shell/useCopyFeedback.ts` (AC15, no shim)
- `src-tauri/src/commands/bucket.rs` → `src-tauri/src/commands/ocr.rs` (AC10)

**Deleted**

- `src/tools/bucket/BucketView.vue`, `src/tools/bucket/BucketView.spec.ts` (AC8)

**Modified — shell and cross-island**

- `src/stores/registry.ts`, `registry.spec.ts` — three entries, alias partition, `pasteSourceImage` (AC7, AC12)
- `src/shell/icons.ts` — `IconName` loses `bucket`, gains `ocr`/`pdf`/`image` (AC28)
- `src/shell/DropZone.vue`, `dropZone.ts`, `dropZone.spec.ts` — paste-image publication (AC12), drag-over state (AC14), stale-`<textarea>` comment fix (slice 5)
- `src/shell/clipboardMatch.ts` — the AC12-era comment naming Bucket (AC7)
- `src/shell/toolError.ts`, `toolError.spec.ts` — AC24/AC25 additions, AC26 recorded exclusions, stale code-count fix (slice 5)
- `src/shell/AppSidebar.spec.ts`, `CommandPalette.spec.ts` — split fallout (AC7)
- `src/router/index.spec.ts` — asserts the registry's count, not the retired name (found by diff, not by the name sweep)
- `src/locales/en.json`, `fr.json` — the 32-key partition (AC27) and the two `errors.ocr-*` keys (AC24, AC25)
- `src/i18n.ts` — `decimal1` comment cited the deleted `BucketView.vue` (AC8)
- `src/tools/json/JsonView.vue`, `json/JsonTree.vue`, `base64/Base64View.vue`, `uuid/UuidView.vue`, `hash/HashView.vue`, `jwt/JwtView.vue`, `cron/CronView.vue` — one import line each (AC15)

**Modified — Rust**

- `crates/umbra-core/src/ocr.rs` — region-structured outcome, EXIF, reading-order sort, detection config, `max_text_length`, `measure_char_polygons`, the quality corpus (AC16–AC23); `UNSUPPORTED_FORMAT_MESSAGE`, `PDF_MAGIC` + `reject_pdf` (AC24, AC25)
- `src-tauri/src/commands/ocr.rs` — AC10 renames, AC11 per-file asset grant, AC22 concurrency note, the dropped-PDF command test (AC25)
- `src-tauri/src/lib.rs` — `use` + `generate_handler!` (AC10)
- `src-tauri/src/commands/mod.rs` — `pub mod bucket;` → `pub mod ocr;` (AC10)
- `src-tauri/tests/ocr_engine_race.rs` — renamed with its command module (AC10)
- `src-tauri/Cargo.toml` — the `protocol-asset` feature (AC11) and three stale `bucket.rs` comments (AC10)
- `Cargo.lock` — one new transitive crate, `http-range` 0.1.5, from `protocol-asset` ⚠
- `crates/umbra-core/tests/fixtures/` (new) — `exif-rotated.jpg`, `long-lines.png`, `two-column.png`, `screenshot-error-dialog.png`, `document-photo.png`, `scan.png` (AC18, AC20, AC21, AC23)

**Modified — config and docs**

- `src-tauri/tauri.conf.json` — `assetProtocol` enabled, empty static scope (AC11)
- `docs/release-checklist.md` — the network-audit procedure and manual QA step split across three tools (AC7)

### Change Log

| Date | Change |
| --- | --- |
| 2026-09-08 | **Story complete — AC30 verified, AC11 ruled, Task 2b closed.** The second half of the VoiceOver pass confirms the no-text state and the PDF error both announce; `role="alert"` was the remaining risk (inserted the same way the silent region was) and it works, so no further change. Deferred gap #5 closed by verification, with its lesson recorded for the next occurrence: an inserted live region is not a live region. **AC11 ruled by the developer — allow-only ships**, with the threat-model reasoning written into `ARCHITECTURE-SPINE.md` rather than left in the story file. The blur + sweep state, the last carried-in open question, confirmed good. Status → review. |
| 2026-09-08 | **AC30's manual VoiceOver pass found the no-text state completely silent — gap #5's first real verification since Story 4.3, and the first Epic 8 finding no spec could have produced.** A live region only speaks when an element already in the accessibility tree changes content; the visible message is `v-if`-inserted, so region and text arrived together and VoiceOver observed nothing, while every DOM assertion passed. Fixed by making the always-mounted `.sr-only` region the single spoken channel and stripping `role="status"` from the visible message so it cannot double-announce. **A second bug fell out of it:** the announcer said *"Text extracted."* unconditionally, including when nothing was — inaudible, so unheard, but a bluff about its own result in the app that must never make one; it now says what actually happened, including AC39's found-but-unreadable diagnosis. Developer also confirmed the image-replacement fixes and the blur + sweep as good. Five tests added, asserting the announcer's text and explicitly not claiming to prove audibility. Gate: **963 Vitest** (was 958). **The error path has not been heard yet** — its `role="alert"` is inserted the same way, so it is a candidate for the same failure. **Nothing pushed, nothing committed.** |
| 2026-09-08 | **Render review round 2 — four bugs in the image-replacement flow.** The developer's three reports (no blur/sweep on a second image, the new image drawn at the previous one's dimensions, stale find highlights over it) all traced to one omission: `resetForNewSource()` was wired to the file picker only, so drop and paste inherited the previous outcome. Fixed at the cause — the drop and paste **source** watchers now reset, which is safe because the shell publishes the source before it invokes and the result only after (verified in `DropZone.vue`, not assumed). A **fourth bug** surfaced while fixing it and would have been made worse by the fix: `naturalSize` had no fallback on the file paths, so `.surface` was **0x0 for the whole ~3 s wait** and its clipped overflow hid both the image and the sweep — an AC33 violation the spec missed by asserting `.in-flight` exists but never that it has a size. Closed with a `loadedSize` ref from the `<img>`'s `@load`, ranked below the outcome so the oriented dimensions still win. **Message placement fixed:** `.pane` is `flex: 1` in a full-height column, so messages rendered after it landed at the window's bottom edge — which is why the developer never saw the error at all. Errors now render inside the drop target; `no-text-found` and copy failures render in the toolbar, above the image. Nine regression tests, **each proved non-vacuous by reverting the fix it covers**, reproducing the developer's descriptions exactly. Gate: **958 Vitest** (was 949), 371 cargo unchanged. **Nothing pushed, nothing committed.** |
| 2026-09-08 | **Slice 5 (AC24–AC26) implemented — the errors and i18n pass.** `ocr-unsupported-format` stops rendering the `image` crate's English prose and carries a project-authored, value-free, non-enumerating sentence; a dropped PDF is caught by `%PDF-` at byte 0 **before** decode and answered by name as `ocr-pdf-wrong-tool` (a sentence, not a routing offer — Story 8.8 owns carrying the file across). Both join `TRANSLATABLE_CODES` with `en`/`fr` keys, and every `ocr-*` exclusion is now recorded in `toolError.ts` **and asserted** by a table test. **AC24's second clause turned out to be premised on a fact that was never true** — no test ever asserted the `image` crate's "unexpected end of file"; verified against the baseline, the phrase lives only in Story 4.3's document. **The English assertions could not prove AC24** (locale string == Rust message), so a scoped French-locale block was added and verified non-vacuous by temporarily deregistering a code. Spine amendment written (AD-14/AD-15 asset protocol, including the allow-only cost in full); `deferred-work.md` reconciled. **Three things raised, not absorbed:** AC2's FR propagation had missed `epics.md`'s FR catalogue entirely (fixed), `Cargo.lock` gained `http-range` 0.1.5 from `protocol-asset` so "no new Rust dependency" is no longer true (AD-7 audit re-run, clean), and two comments still named the deleted `<textarea>`. Gate: **949 Vitest** (was 938), **371 cargo** (was 366). **AC30's manual screen-reader pass is NOT done and needs the developer.** **Nothing pushed, nothing committed.** |
| 2026-09-08 | **Find-match placement fixed by measuring the pixels.** `oar-ocr`'s `return_word_box` positions are CTC timestep fractions and drift up to 20 characters mid-line (86/166/322 px at 40/80/160 characters); the matching box count proved quantity, never position, and Cut #4's reversal is undone with the numbers recorded in-file. Replaced by `measure_char_polygons` — crop, Otsu threshold, column ink profile, N−1 widest gaps as word separators — which holds a **flat ~3 px (0.19 character) error across 40–200 character lines** and *declines* (tilt >2°, too few columns, unresolved gaps) rather than answering badly, leaving the view's honest whole-line band. Also from the render review: controls moved out of the image (AC37/AC38 revised), translucent current-match highlight, always-visible find bar, arrows hidden below two matches. Write-up: artifact 0982dd45. Gate: 938 Vitest, **366 cargo**. **Nothing pushed, nothing committed.** |
| 2026-09-07 | **Slice 4 (AC11–AC14, AC31–AC42) implemented — the Live Text surface.** The `<textarea>` is gone; recognised text renders once, as transparent selectable spans on the image, fully tokenised. Asset protocol enabled with an empty static scope and a per-file runtime grant; paste pixels published by the shell (AC12); drag-over state published as `dragOverToolId` (AC14); file picker calling `registry.getLatestWinsRunner(\"ocr\")` directly (AC13). **AC11's mechanism changed on verified grounds**: `Scope` has no pattern-removal API and `is_allowed` checks forbidden first, so the AC's `forbid_file` step would permanently poison any file the user returns to — allow-only shipped, cost recorded, raised for a ruling. `Cargo.toml` gained the `protocol-asset` feature (not a new dependency, but a widening of the authorised surface). Overlay geometry and find matching landed as pure, separately tested modules (19 + 11 tests). Gate: **917 Vitest** (was 862), 361 cargo. **Nothing pushed, nothing committed.** |
| 2026-09-07 | **AC36 amended after a developer-raised finding.** A screenshot of this session showed `⌘` recognised as `8` and `渊`. Verified: U+2318 is absent from the 6,904-entry dictionary (89.4% CJK, 1.4% ASCII), so a closed-vocabulary CTC recogniser structurally cannot emit it. Measured per-glyph confidence — out-of-vocabulary symbols score 0.00–0.65 against 0.989–1.000 for real characters — which showed the developer's threshold instinct was right, but also that region confidence is a *mean* over per-character probabilities (`decode.rs:236`), so a single bad character in a long line is arithmetically invisible (0.9735 corrupted vs 0.9763 clean, against a corpus minimum of 0.9504 for correct text). Threshold set to **0.90** (developer's call) in a new `src/tools/ocr/lowConfidence.ts` + spec that encodes the measurements as regression guards. AC36's stated rationale corrected: region-level marking is an honest signal, not the primary defence against confident nonsense — Live Text's on-image placement is. Per-character confidence filed as a backlog candidate. |
| 2026-09-07 | **Slice 3 (AC16–AC23) implemented.** `OcrOutcome` becomes region-structured (`regions` + oriented `image_width`/`image_height`; `OcrRegion` keeps `text: Option`, confidence and the rotated bounding polygon), EXIF orientation is applied before recognition, regions are sorted into reading order in core behind a unit-tested pure function, the detection config states all seven fields and the recognition config sets `max_text_length` explicitly, AC22's concurrency overlap is recorded in the command layer, and a five-fixture quality corpus lands with separate content and ordering assertions. **The EXIF bug was reproduced before it was fixed**: the sideways fixture returned \"omohi bunpo\" at 0.22 confidence; oriented, the same bytes return all four lines at 0.987–0.999. AC20's long-line test passes, so `max_text_length` was never truncating at 25 — it is now pinned at 100 rather than inherited. The two-column fixture characterises the sort's stated limit rather than hiding it. TS mirror uses snake_case to match the codebase's existing IPC convention. Gate: 853 Vitest, **361 cargo** (was 345). **Nothing pushed, nothing committed.** |
| 2026-09-07 | **Slices 1 and 2 implemented** (no commit between slices, developer's call). Slice 1: the `useCopyFeedback` hoist to `src/shell/`, 7 import sites, no shim, plus the spec the composable never had — 845 -> 852 Vitest with no existing assertion touched; render-reviewed and approved. Slice 2: the three-way split — `BucketView.vue`/`.spec.ts` deleted, `OcrView` / `PdfView` / `ImageView` created, registry down to three entries with the alias partition, `IconName` losing `bucket` and gaining three pictograms, the 32-key i18n block partitioned into 35 across three prefixes, and AC10's OCR-only command and error-code renames. AC9's verbatim-move gate **verified by diff against HEAD**: PDF changed one comment line and zero assertions; six of eight Image blocks are byte-identical. **Two things raised rather than absorbed** — the two Image blocks asserting cross-section isolation that the split structurally dissolves (AC9 calls a changed Images assertion 'not a judgement call', so it awaits a ruling), and `src/router/index.spec.ts`, an eighth breaking file the name-keyed sweep could not find because it asserts the registry's *count*, not the retired name. Full gate green: 852 Vitest, 345 cargo. **Nothing pushed, nothing committed.** |
| 2026-09-07 | **Task 2b opened; overlay spike run before slice 1.** Slice order set (hoist → split → Rust → Live Text → errors; Rust-first argued and rejected). A throwaway spike against real `TextRegion` geometry — no Tauri, no asset protocol, code reverted — produced two developer-approved AC amendments. **AC19**: `OAROCRBuilder::build()` wraps the whole `general` preset in `if !has_explicit_det_cfg`, so AC19's own `.text_detection_config(...)` instruction silently dropped `unclip_ratio` 2.0→1.5, `max_side_len` 4000→None and `limit_type` Max→Min — the last *inverting* the resize into an upscale (measured 1520×920 → ≈2645×1600). AC19 now states all seven detection fields. **AC34**: ink fills 97 % of box *width* (the width-fit is sound) but only 57–67 % of box *height*, and detection returns rotated min-area quads carrying 3.25° median tilt on a document photo (~37 px drift over a 650 px line). AC34 now derives each span from the quad's own edges with a named calibration constant and an `atan2` rotation, degenerating to the axis-aligned case at 0°. Verified clean: AC16's coordinate space, AC20's no-truncation outcome, and the record's `unclip_ratio = 2.0`. AC42's "first slice" clause logged as stale. **Nothing pushed; no code committed yet.** |
| 2026-09-07 | **Task 2a signed off.** Developer approved AC7–AC42 as written. AC35 confirmed (fit-to-pane, no zoom or pan, never upscale) and AC25 confirmed as a sentence only, on the developer's own reasoning — *a button cannot route to somewhere that is not built yet* — which is now the reason AC25 records, and which hands "carry the dropped file across into the PDF tool" to Story 8.8. Task 1's stale checkboxes corrected after verifying its AC2 propagation (`585349b`) and AC3 issue filing (`2d5b387`) actually landed. **Task 2b not started; nothing pushed.** |
| 2026-09-07 | **Task 2a complete.** AC7–AC42 written into a new `## Acceptance Criteria — Task 2 (Redesign)` section, plus a normative *Authorised file surface* table built from a repo-wide sweep (which found seven files beyond the story's own Project Structure Notes, four carrying assertions that break on the split). Developer's three opening calls: split sequencing (non-visual ACs → canvas → visual ACs), `useCopyFeedback` hoisted to `src/shell/` with all seven import sites updated and no shim, and an asset-protocol scope that is **empty statically** with a per-file runtime grant (verified against vendored `tauri-2.11.5`; `capabilities/default.json` needs no change, `persisted-scope` deliberately not added). One gap found in the signed-off record and closed: the paste path had no image-display route at all (AC12). Nine-artboard design canvas built and published. **Awaiting developer sign-off before Task 2b.** |
| 2026-09-06 | Task 0 complete (`bmad-dev-story`). Baseline `d576c3e` re-verified against `origin/main`; branch `feat/story-8-7-reimagine-the-bucket-ocr` cut; story file + sprint-status committed as `936f32f`. AC1's mandatory drift re-read found the code matching Dev Notes exactly, and two stale claims in the Dev Notes themselves (a second `cron-*` translatable code; the `epics.md` `oar-ocr` drift is 3 places, not 4). |
| 2026-09-06 | Task 1 complete. `bmad-party-mode` discovery session (developer's AC1 method choice). Decision record written to `8-7-ocr-decision-record.md`. Scope: three separate registry tools (binds 8.8/8.9), full split with PDF/Images moving verbatim, **Live Text** — the image displayed with selectable text positioned on it — replacing the editable textarea, low-confidence regions marked on the image, a file picker and an in-flight state closing two live `EXPERIENCE.md` violations, the `OcrEngine` trait widened to region-structured output, and the Tauri asset protocol enabled with a scope (a recorded spine amendment). AC2 propagation and AC3 capture pend developer sign-off. |
| 2026-09-06 | Story created (`bmad-create-story`) from `epics.md`'s Epic 8 shared shape, at baseline `d576c3e`. Task 1 ACs written real (AC1–AC6); Task 2 ACs deliberately deferred per the epic's own gate. AC4 added beyond the 8.1–8.6 template to force explicit resolution of the shared-`BucketView.vue` container, split, registry/drop/paste and AD-16 runner questions that 8.7 inherits on behalf of 8.8 and 8.9. AC2 extended with a same-story FR-propagation requirement, from Story 8.6's upstream-drift correct-course. |
