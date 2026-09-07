# Story 8.7 — The Bucket / OCR: Task 1 Decision Record

**Date:** 2026-09-06
**Method:** `bmad-party-mode` (installed roster — Mary/Business Analyst, John/PM, Sally/UX, Winston/Architect, Amelia/Senior Engineer, Paige/Tech Writer; `session` mode; party memory resumed from the Epic 8 history, Stories 8.1–8.6). Developer's method choice for this story.
**Status:** scope decisions confirmed by the developer 2026-09-06, across three rounds — structural (the split), then a generative design round the developer correctly demanded after the first draft was all debt and no design, then the PDF weighing. Task 2a (real AC7+) not yet written.
**Design canvas:** none yet — owed for Task 2a (the Live Text surface is the first genuinely novel layout in Epic 8 and the container question resolved without needing one).

This record satisfies Story 8.7 AC1–AC6. It reconsiders the Bucket's OCR sub-feature from first principles. Every file listed under the story's *Dev Notes → Shipped implementation* was re-read in full at session start and verified against `d576c3e`; the drift found was in the **Dev Notes themselves**, not the code — see *Verification findings* at the end.

---

## Framing — the answer that ended the container debate in one line (AC1)

The room opened on AC4a expecting a three-way architecture argument: one enriched view, `AppTabs.vue`, or three separate tools. It lasted one round, because the developer answered a question nobody had thought to ask:

> **The Bucket was never a product decision.** Three unrelated tools ended up under one name because an AI scaffolded it that way, and it was left unfixed to keep moving.

That reframes AC4 entirely. This room spent six stories treating `BucketView.vue` as architecture to be respected or overturned with cause. There was no architecture. There was a scaffold nobody deleted, and Story 8.7 is where the debt gets paid.

The second framing input is the job. Asked what they actually point OCR at, the developer answered: error-dialog screenshots, photos/scans of documents, PDF pages whose text won't select — **and, honestly, it's the demo feature.** Asked whether they read the extracted text or copy it and leave: **copy and leave.**

Then, asked whether `OcrOutcome` should grow per-region data, the developer redirected the room a second time:

> *"I don't understand the question, but I was wondering if we can make the text appear like on Apple Photos — select the text directly from the image."*

**Live Text.** That is the redesign. It is a strictly better answer to "copy and leave" than any text pane, because it deletes the step where you re-find, in a transcription, the thing your eyes had already located on the image.

### Why the competitive playbook didn't apply

The sweep (Shottr, CleanShot X, PowerToys Text Extractor, TextSniper, Google Lens, ABBYY, `tesseract.js` front-ends) found near-total convergence on one flow: **global hotkey → drag a region on screen → text on the clipboard.** No file, no drop zone, no result pane, no visible app.

That entire pattern is **already out of bounds** by a standing product decision — `EXPERIENCE.md`, Inspiration & Anti-patterns: *"Killed — menu-bar-resident app + system-wide global hotkey"*, the deliberate-window stance. So the sweep's value here was negative space: it told us what we can't be, which forced the question of what's left. What's left is *you have an image, you want its text* — and Live Text is the best-in-class answer to that narrower job, borrowed from Apple Photos rather than from the screenshot-tool category.

---

## Container shape (AC4a) — **binds Stories 8.8 and 8.9**

**Three separate registry tools.** The `bucket` entry is deleted. `AppTabs.vue` was never seriously in play once the framing landed — tabs are for one tool with multiple jobs; this is three tools.

**This decision binds 8.8 and 8.9.** They do not relitigate it. Their scope changes as a consequence — see *Upstream corrections owed*.

The affirmative argument, which is stronger than "the name is bad":

- **The registry currently lies.** The single `bucket` entry declares `drop: { acceptedMimeTypes: [], handler: "bucket_extract_text" }`, `paste: { handler: "bucket_extract_text_from_clipboard" }` and `clipboardMatch: { test: matchesImage, specificity: 4 }`. All three are **OCR-only**. PDF and Images reach the filesystem exclusively through their own `open()` / `save()` dialogs and never touch drop or paste. Splitting does not *add* behaviour — it makes three declarations that are true of one third of a tool become true of a whole tool.
- **`⌘K` currently lies.** Sixteen aliases on one entry means typing `merge`, `compress`, `webp` or `fusionner` returns a result named **"Bucket"** — and FR2's contract is that `Enter` opens the top result, i.e. the result *is* the answer. "Bucket" is a riddle, and it lands you in a 713-line flat scroll to find the section yourself.
- **The description key proves it.** `tools.bucket.description` currently reads *"Extract text from images, and merge, split, or convert PDFs and images."* That is an inventory, not a description. It exists because one entry had to answer for three tools.

---

## File and registry split (AC4b, AC4c)

**Full split, in Story 8.7.** Not staged.

The staged alternative (8.7 extracts OCR, leaves a `bucket` entry holding PDF + Images for 8.8/8.9) was rejected: it ships a sidebar entry called "Bucket" that now means *"the two things we haven't got to yet"* — worse than today's consistently-meaningless one — and it leaves `drop` / `paste` / `clipboardMatch` on an entry whose route no longer serves OCR, a confusing intermediate state to put on `main`.

**PDF and Images move verbatim.** No tokenisation, no `AppButton`, no redesign, no command rename. They move; they do not improve. 8.8 and 8.9 own their improvement, or the AD-6 boundary means nothing.

**Amelia's move gate, adopted as a testable rule:** *if a moved PDF or Images test needs rewriting, it stopped being a move.* `BucketView.spec.ts` is already partitioned along exactly this seam (root / `"PDF section"` / `"Image section"`, 33 `it()`), so the PDF and Image assertions must survive the split with nothing changed but import paths and mount targets.

### The three tools

| | OCR | PDF | Images |
| --- | --- | --- | --- |
| `id` | `ocr` | `pdf` | `image` |
| `name` | **"Image to Text"** (developer's pick) | provisional — 8.8 renames | provisional — 8.9 renames |
| View | `src/tools/ocr/OcrView.vue` | `src/tools/pdf/PdfView.vue` | `src/tools/image/ImageView.vue` |
| `drop` / `paste` / `clipboardMatch` | **all three** | none | none |
| `icon` | new `IconName` — pick in Task 2a | new — Task 2a | new — Task 2a |

"Image to Text" was chosen over "Text Extractor" and bare "OCR": it names the job rather than the technology, holds the two-word register of "JSON Formatter" / "JWT Inspector" / "Hash Generator", is legible to someone who doesn't know the acronym, and translates honestly ("Image en texte"). `ocr`, `screenshot` and `text` remain aliases — `ocr` is what the developer will actually type.

`src/shell/icons.ts` is a `Record<IconName, Component>`, so a missing entry is a **compile-time** error, not a runtime gap — the three picks are forced, and per DESIGN.md's Base64 note they stay Phosphor pictograms (the `64` glyph remains the one deliberate non-pictogram exception).

### Alias partition

Today's 16 aliases split by tool: `ocr` / `screenshot` / `bucket`(retired) → OCR; `pdf` / `merge` / `fusionner` → PDF; `image` / `convert` / `compress` / `png` / `jpeg` / `webp` / `convertir` / `compresser` → Images; `capture d'écran` → OCR. Final list is Task 2a's, but the partition is not optional — leaving `pdf` on the OCR entry would reintroduce exactly the `⌘K` dishonesty the split exists to fix.

---

## Kept (unchanged, and deliberately so)

| Item | Rationale |
| --- | --- |
| The extraction itself — `OarOcrEngine`, `oar-ocr` 0.6.3 behind the `OcrEngine` trait (AD-8), `image::load_from_memory` decode, the RGBA path's alpha-drop, `MAX_INPUT_BYTES = 100 MB` | The core extraction is correct. Amelia, for the record: *"the core is fine."* Nothing about how text is recognised changes. |
| `oar-ocr` **0.6.3** pin, and the reasoning for it | Settled and **not reopened** — CI toolchain is 1.94.0, every `oar-ocr` ≥ 0.7.4 requires rustc 1.95, so Cargo cannot resolve past 0.6.3. Re-verify when the toolchain crosses 1.95, not on calendar time. No Task 1 budget spent here. |
| `OnceLock`-guarded lazy engine init + `ocr_engine()` + the 8-thread race integration test (`src-tauri/tests/ocr_engine_race.rs`) | AD-16 and NFR2's cold-launch guarantee. Untouched. The `pub` visibility of `commands` / `ocr_engine` stays — see that file's own comment. |
| `#[tauri::command(async)] pub fn` (non-`async`) on the clipboard command, with its `tauri-apps/tauri#2533` comment | Deliberate, documented, **do not "modernise"**. |
| The raw-IPC-body clipboard path (`x-image-width` / `x-image-height`) as the **one** sanctioned AD-15 byte-payload exception | Kept exactly. This record explicitly does **not** add a second — see the asset-protocol decision below, which is a different mechanism. |
| `spawn_blocking` (AD-4) on both commands; `check_file_size` **before** the read | Unchanged. Inference never on the launch path. |
| Empty `text` as a legitimate "no text found" outcome, not an error (FR26, Story 4.3) | The honesty guarantee. Preserved through the shape change below. |
| Zero network surface (AD-7); models bundled, auto-download structurally absent in 0.6.3 | Unchanged. **No new Rust dependency is added by this story**, so the `cargo tree -i reqwest` audit is N/A — same as 8.5. |
| Existing test coverage to preserve: real-fixture extraction (both entry points), oversize rejection *without reading the file*, non-image rejection, corrupt/truncated → `ToolError` not panic, missing path, the `OnceLock` race, clipboard RGBA round-trip + oversize + malformed-length | Behaviours preserved; assertions are rewritten to the new `OcrOutcome` shape, not discarded. |
| `pdf.rs`, `image_convert.rs`, `commands/pdf.rs`, `commands/image.rs`, `imageTargetFormat.ts` | Not 8.7's. Untouched beyond the mechanical move. |

---

## Changed (interaction)

| Change | Detail | Rationale |
| --- | --- | --- |
| **The image is displayed** | Today the OCR path never shows the image — you drop a file, it vanishes, a slab of text appears with no evidence of where it came from. The redesigned view renders the source image as the primary surface. | Prerequisite for everything below, and a fix in its own right: if the extraction is wrong you currently have nothing to check it against. |
| **Live Text — selectable text positioned on the image** | Recognised regions render as transparent, selectable text laid over the image at their real coordinates, scaled from the image's natural size to its rendered size. Drag across a region, `⌘C`, done. | The developer's own direction. Matches "copy and leave" better than any text pane: **partial** selection means you copy the error code, not the whole dialog, without ever re-finding it in a transcription. |
| **The editable `<textarea>` is removed** | Replaced by a single **"Copy all text"** affordance (`useCopyFeedback` pattern) for the whole-image case. No second rendering of the same text on screen. | Developer's call. Two copies of the same text is exactly the redundancy killed in 8.3 (*"100 UUIDs = 200 lines?"*) and 8.5 (the always-on Algorithm line). **This revises FR24** — see below. Trade-off accepted knowingly: you lose in-tool correction of a wrong character. |
| **Low-confidence regions are marked on the image** | No number is ever shown. Regions the model scored below a threshold get a subtle marker (dotted underline or equivalent) **on the image**, where the user can look at the actual pixels and judge. Threshold value and the light/dark treatment → Task 2a. | The evidenced industry pattern is per-region colouring, not a percentage; "87% confident about this screenshot" is unactionable. This is `FR26` / *the Bucket never bluffs* made visual: *"here's your text, and here's where I'm unsure — look for yourself."* Resolves gap #3 by making the field useful rather than deleting it. |
| **A file-picker button** | An `open()` picker in the OCR view, alongside drop and paste. | **Closes a live spec violation.** `EXPERIENCE.md` Flow 2 step 5 *scripts the hiring-panel demo around this button* — *"the file-picker is the flow's stated canonical, keyboard-operable path"* — and it has never existed. `open()` appears four times in `BucketView.vue`: three in PDF, one in Images, zero in OCR. Keyboard-only OCR today requires an image already on the clipboard, which is a precondition, not a path (NFR5). |
| **In-flight state** | An `extracting` ref, a visible in-progress indicator, and an announced status on start and completion. Covers the first-use `OnceLock` model-load cost, which today has zero feedback. | **Closes a second live spec violation.** `EXPERIENCE.md`'s Loading row names OCR *by name*: *"OCR jobs (potentially slow, local ONNX inference) show explicit in-progress state, not a frozen drop zone."* `pdfMerging`, `pdfExtractingPages`, `pdfExtractingText`, `imageEstimating`, `imageConverting` all exist. OCR has none. |
| **Epic-7 tokenisation pass** | The OCR view is **100% pre-Epic-7**: `#666`, `#ccc`, `#b00020`, `border-radius: 6px`, bare `font-family: monospace`, `em`-based spacing, and **zero `AppButton` usage** — every control a plain `<button>`. → `--color-text-secondary`, `--color-border-hairline`, `--color-accent-destructive`, `--radius-*`, `--font-code-*`, `AppButton`. `base.css` already styles bare `<textarea>` / `<input>` — don't re-style what it covers. | Same starting condition as `CronView.vue` (8.6) and `JwtView.vue` (8.5). First slice of Task 2b. |
| **`useCopyFeedback` adopted** | The Copy control gains real confirmation feedback via `src/tools/json/useCopyFeedback.ts`. Today it is a plain `<button>` with a static `common.copy` label and no confirmation at all. | Standard across JsonTree / Base64 / UUID / Hash / JWT / Cron. **This is the 6th consumer** — the hoist question is reopened, see *Open items*. |
| **`bucket-unsupported-format` gets our own sentence** | Currently renders the **`image` crate's** raw English decode error (which is why Story 4.3's corrupt-PNG test asserts on the phrase "unexpected end of file"). Becomes a project-authored, value-free sentence — *"That file isn't an image this tool can read."* (deliberately **not** enumerating formats — see the format-claims row above; the earlier draft of this sentence listed three of the fifteen formats we actually decode, and would have been false) — and **therefore** qualifies for `TRANSLATABLE_CODES` plus an `errors.*` key in both locales. | Paige's finding, below. This is the single most-hit error in the tool. |
| **The resting state becomes a real drop target** | Today the pre-drop state is an `h1` plus one sentence — *"Drop a PNG, JPEG, or WebP image anywhere in the window, or paste (⌘V)…"* — with no target, no picker, nothing to aim at. It becomes a visible bordered drop area with the **file picker inside it** as the keyboard path and the paste hint as the third door: three entrances, one object. It also highlights on drag-enter. | **This is the most-seen state in the app** — it is what you get every time the tool opens — and it has never been designed. For the tool this record agrees is the demo feature. The dashed-border drop language is `HashView`'s existing convention; note 8.5 established the *inverse* rule (the dashed box means drop and must not be borrowed elsewhere) — here it is literal, and this is the one place it belongs. **Drag-enter state is a `DropZone.vue` change** — a shell file, named here so Task 2a's AC set carries it (8.6's AC list was found incomplete twice). Drop remains window-level; the target is an affordance, not a hit area. |
| **The image renders immediately — before extraction finishes** | On drop/paste/pick the image appears in the first frame, straight from the path via `convertFileSrc`. The recognised text resolves onto it a beat later. The `role="status"` start/completion announcements are unchanged. | **This is the in-flight state, and it is not a spinner.** The anxiety gap #2 describes is "did it take my file?" — showing the image answers that instantly, and the ONNX wait then happens against something recognisable instead of a blank pane. It matters most on **first run**, where the `OnceLock` model load makes the slowest moment of the app's life coincide with a user's first-ever use. Free: the image load and the extraction are independent — nothing serialises them. |
| **Regions are sorted into reading order** | `run_ocr` currently emits `lines.join("\n")` in the model's **detection** order, not reading order. Regions are sorted geometrically (top-to-bottom, then left-to-right) before any text is produced. | **A latent shipping bug since Story 4.1**, invisible because the tool never displayed the image beside the text and every fixture assertion is `contains("UMBRA")` — 8.6's lesson 7 exactly (*a sweep that asserts only "it parsed" proves parsability, not correctness*). A two-column screenshot, a dialog with a button row, or a sidebar interleaves silently. **Free once the geometry flows**, and now load-bearing for three separate things — Copy fidelity, screen-reader order (see Accessibility below), and `⌘F` match ordering. |
| **`⌘F` — find in image** | A search input filters the extracted text and highlights the matching regions **on the image**, with a match count. | The Preview / Apple Photos pattern, aimed squarely at the first job named: finding the error code in a dense screenshot. Cheap once regions and coordinates exist. Developer's call; Winston had no objection. |
| **`⌘A` selects all the text on the image** | Select-all inside the image surface means select all recognised text, so `⌘C` yields the whole result without touching the Copy control. | Makes "Copy all text" the *discoverable* route rather than the only one, and gives "copy and leave" a pure keyboard path (NFR5). |
| **"Copy all text" lives on the image, not under it** | A small ghost control pinned to a corner of the image surface, with `useCopyFeedback` confirmation. | Putting it underneath reintroduces a second zone competing with the surface this record just made *the* tool — the same redundancy logic that killed the textarea. |
| **A second drop replaces the first** | No history, no session, no persisted state. | Copy-and-leave: the job ends when you paste. A history would be this tool's first persisted state, for a job that doesn't have one — and replacing is the privacy-correct default (nothing accumulates). |
| **Dropping a PDF stops failing rudely (PDF tier 1)** | A PDF dropped on Image to Text currently fails as `bucket-unsupported-format` carrying the `image` crate's raw English decode error. It is recognised by magic bytes and answered with *"PDFs open in the PDF tool"* — ideally as an offer that opens it. | The developer predicted users will try PDFs, and they are right. **Serving the attempt is not the same as serving the extraction** — this costs a byte check and a sentence, no dependency. See the PDF tiers below. |
| **EXIF orientation is applied before recognition** | `image::load_from_memory` is `ImageReader::with_guessed_format().decode()`, and **`decode()` does not apply EXIF orientation** — the crate exposes `Orientation`, a decoder-level `orientation()` accessor and `apply_orientation()`, all of which must be called explicitly. We never have. Fixed: read the orientation, apply it, then hand pixels to the model. | **A live bug, not a missing feature.** A photo taken with a phone held sideways reaches the detector rotated 90 degrees; detection on rotated text mostly fails, so the user gets *"no text found"* on an image visibly full of text. That is confidently wrong output — precisely what FR26 and *the Bucket never bluffs* exist to prevent — and it lands on **photos of documents**, one of the three uses the developer named. Needs a new fixture carrying real EXIF rotation. |
| **A quality regression corpus** | A small set of real fixtures — a Retina error dialog, a document photo, a two-column layout, a scan — each with expected text asserted properly, with tolerance for OCR's non-byte-exact output. Replaces `contains("UMBRA")` as the only quality signal. | **This story changes `limit_side_len`, adds a reading-order sort, applies EXIF orientation and may touch thresholds — and today there is no way to tell whether any of it made recognition better or worse.** 8.6's lesson seven with a different hat on: proving it ran is not proving it is right. It also turns the model-tier revisit gate from a judgement into a measurement, and it is what lets anyone who is *not* the developer change this pipeline safely. |
| **Format claims stop enumerating** | FR23, the registry description and the drop hint all say *"PNG, JPEG, or WebP"*. `image`'s `default-formats` actually gives us **fifteen** — avif, bmp, dds, exr, ff, gif, hdr, ico, jpeg, png, pnm, qoi, tga, tiff, webp. The copy becomes format-agnostic: *"Drop an image"*, and the failure sentence *"That file isn't an image this tool can read."* | **Developer's call: vague and true beats specific and wrong.** The claim has been under-stating the capability since Story 4.1 — TIFF works today, and scanners produce TIFF, which matters directly for the *scans of documents* use. Enumerating fifteen formats would be a list that drifts every time the `image` crate changes its default features. The chosen sentence is value-free and project-authored, so it still qualifies for `TRANSLATABLE_CODES`. |
| **The three in-file AD-16 comment blocks are rewritten, not carried across** | They explain why OCR has *no* local runner. That reasoning stops being true the moment the picker lands. The **decision** stays correct (one runner); the recorded **rationale** changes. | 8.6's post-review distinction: *"the code is right and the recorded reason is now false"* is its own kind of fix. |

---

## Added

| Addition | Detail | Rationale |
| --- | --- | --- |
| **Per-region geometry in `OcrOutcome`** — the trait change | `OcrOutcome` stops being `{ text: String, confidence: Option<f32> }` and becomes a **list of regions**, each carrying its text, its own confidence, and its bounding polygon (**not** `orientation_angle` — it is always `None` in our configuration; see *The model pipeline*). Both `OcrEngine` methods change return shape. | **Verified against the vendored source** (`oar-ocr-core-0.6.3/src/domain/text_region.rs`), not docs: `TextRegion` has **eight** fields — `bounding_box: BoundingBox { points: Vec<Point { x: f32, y: f32 }> }`, `dt_poly`, `rec_poly`, `text`, `confidence`, `orientation_angle`, `word_boxes`, `label`. `run_ocr` reads **two** and drops the struct. *The coordinates have been there since Story 4.1.* The adapter change is subtraction — stop discarding — not new computation. |
| **Tauri asset protocol, scoped** | `app.security.assetProtocol` enabled with a declared scope; the view loads the image via `convertFileSrc(path)` on the path the shell already publishes as `registry.dropSourcePath`. | Developer's chosen resolution to the image-access fork. See the dedicated section below — this is a **spine amendment**. |
| **Two new error codes, one new translatable message** | `ocr-internal` and `ocr-input-too-large` (new, not renames — see the code section), plus the project-authored `ocr-unsupported-format` message and its `errors.*` key in `en` + `fr`. | Consequence of the split and of Paige's voice finding. |

---

## Cut → backlog (AC3)

**Capture route — developer's decision: split.** The 8.6 precedent. The two cuts with real future weight are filed as individual max-context `backlog-candidate` GitHub issues on `dipaneb/umbra`, each linking back to this record; the rest live in this table and move to the developer's own tracking. **To GitHub: #13 (OCR a scanned PDF), #14 (QR codes) and #15 (hardware-accelerated inference)** — each named explicitly by the developer. Everything else: personal backlog, logged here so nothing is silently dropped.

| # | Idea | Why cut |
| --- | --- | --- |
| 1 | **Region/crop selection before extraction** — drag a rectangle on the loaded image and OCR only that. | Live Text makes it largely moot: you can already select *the text you want* after extraction, which is the job region-select was serving. A genuine follow-up only if extraction cost on huge images becomes the binding constraint. |
| 2 | **Screen-region capture with a global hotkey** — the entire competitive category's core flow. | **Killed by a standing product decision**, not by cost: `EXPERIENCE.md` kills menu-bar residency and system-wide global hotkeys under the deliberate-window stance. Recorded so the rejection is traceable and a future reader doesn't rediscover the whole competitive landscape and assume we missed it. |
| 3 | **Layout-preserving output** (columns, tables → CSV/Markdown) — the ABBYY / Docling / TableFormer direction. | Real, valuable, and an entirely different product: it needs a layout-analysis model on top of det+rec. Sits naturally with **FR29**'s future structured-extraction feature, which AD-8 already reserves trait room for — the per-region geometry this story adds is a genuine prerequisite for it, not an alternative. |
| 4 | **Word-level selection.** `TextRegion.word_boxes` exists but is *"only populated when word-level detection is enabled"* — not enabled in our config. | v1 Live Text selects at line/region granularity. Word-level is a config + verification exercise of its own; region-level already delivers the partial-copy win. |
| 5 | **Multi-page / batch extraction.** | `EXPERIENCE.md`'s Open Questions already parks *"Batch/folder-level Bucket operations"* as round-table KEPT-but-unshaped, with an unresolved serial-vs-bounded-worker-pool concurrency question. Not this story. |
| 6 | **Explicit language selection.** | Moot for now: the bundled dictionary covers English and French characters in one model (see FR25 below). A real question only when a language outside the dict's 6,904 entries is wanted. |
| 7 | **Deskew / preprocessing** (rotate, contrast, threshold before recognition), **and text-line orientation classification**. | The detection polygon describes a rotated line correctly, so tilted lines are *located* — but `orientation_angle` is always `None` for us (it needs `.with_text_line_orientation_classification()` plus a **third bundled model**), so the overlay cannot rotate a span to match a skewed line. Bundling a third model is not this story's cost. Whole-image deskew is an image-processing feature, closer to the Images tool. |
| 8 | **Re-run at higher effort** — a second, larger model tier for a bad result. | The medium tier is documented in `ARCHITECTURE-SPINE.md` as the fallback if tiny proves inadequate. Shipping both means bundling both (~6 MB → substantially more) for a tool whose identity is small-and-offline. Revisit only if the tiny tier demonstrably fails in real use. |
| 9 | **Drag the extracted text out** to another app. | A new OS I/O edge (drag *source*, not drag target) — AD-14 territory, and no `EXPERIENCE.md` primitive covers it. |
| 10 | **"Send to" chaining** (OCR output → JSON Formatter without copy/paste). | Already an `EXPERIENCE.md` Open Question, explicitly parked as needing its own session and sitting in tension with AD-6. Untouched here. |
| 11 | **Runtime type-checking the IPC result shape** (gap #4). | See gap #4 below — deferred as a project-wide convention question, not an OCR one. |
| 12 | **Hoisting `useCopyFeedback` out of `src/tools/json/`** (gap #7). | Reopened this story and **escalated to the developer** rather than declined a sixth time — see *Open items*. |
| **13** | **OCR a scanned PDF page — rasterize the page, then extract (PDF tier 3).** → **GitHub issue.** | The highest-value cut in this record: it is the one job the developer named that *nothing* serves. Cut on cost, not on value — the full cost sheet travels with the issue so nobody re-runs the argument. See *The PDF tiers* below. |
| **18** | **HEIC / HEIF input.** iPhone photos are HEIC by default; `image` 0.25 supports AVIF but **not** HEIC, so an unexported iPhone photo of a document fails as unreadable. -> **Personal backlog.** | Directly hits *photos of documents*, and the fix is `libheif` — a native dependency with its own licensing and cross-platform build story, i.e. the same class of cost as the PDF rasterizer. Recorded so the failure is understood rather than mysterious. |
| **19** | **Detection threshold tuning** — `box_threshold = 0.6`, `unclip_ratio = 2.0`, detection `score_threshold = 0.3`, and the `text_type` presets (`"table"` lowers `box_threshold` to 0.4, plausibly better for logs and tabular screenshots). -> **Personal backlog.** | The same class of finding as `limit_side_len`, one layer down: inherited from the general preset, never examined. `box_threshold` decides which detected boxes survive; `unclip_ratio` decides how much each is expanded before cropping. Deliberately **not** tuned in this story — the quality corpus above is the prerequisite, since tuning thresholds without a way to measure regression is guessing with extra steps. |
| **17** | **A Latin-script-specialised recognition model** — `latin_PP-OCRv5_mobile_rec` or `en_PP-OCRv5_mobile_rec` in place of the multilingual v6 tiny rec. -> **Personal backlog.** | Most of our 6,904-entry dictionary is Chinese, serving a script this app has never claimed to support. A recogniser trained on the scripts we actually serve (English + French) with a far smaller dictionary is a **better-targeted** bet than a bigger tier. But it is v5 not v6, with a different dictionary and extraction path, and needs Story 4.1's whole verification exercise repeated. Filed with the hypothesis attached. |
| **15** | **Hardware-accelerated inference (execution providers / NPUs).** -> **GitHub issue.** | The measured ~3 s baseline is acceptable *once there is feedback*, so this is optimisation, not necessity. Full provider analysis above travels with the issue: the three viable options (CoreML / DirectML / WebGPU), the three ruled out on distribution grounds (CUDA / TensorRT / OpenVINO), the compile-time-feature constraint, and the AD-7 re-audit it triggers. |
| **16** | **Staged detection -> recognition reveal.** Detection and recognition are two sequential ONNX passes, so the detected **boxes could appear on the image first** and the recognised strings fill into them as recognition completes — not a progress indicator but the actual work made visible, every frame corresponding to something that really happened. -> **Personal backlog.** | The best idea of the session and not this story's. `OAROCR::predict()` is **one call**: staging means driving `oar-ocr-core`'s detection and recognition predictors separately — a layer deeper into a pre-1.0 crate than Story 4.1 verified — and the `OcrEngine` trait growing a **two-phase or streaming shape** rather than a single call, a much larger trait change than the one already agreed. Kept off GitHub at the developer's direction: it depends on a pre-1.0 crate's internals and shouldn't read as a roadmap commitment. |
| **14** | **QR / barcode decoding** — read a QR code from a dropped image, as Shottr and CleanShot X both do in the same gesture as text. → **GitHub issue.** | From the user's side it is the same job ("get the data out of this image"), which is exactly why it deserves a real issue rather than a note. Technically it is a different pipeline: a new decoding crate, a fresh AD-7 audit, and a second result shape (a URL or payload) that Live Text's whole image-overlay surface does not apply to. Developer's explicit call: out, but filed properly. |

---

## FR revision (AC2)

Epic 8's preamble makes this revision each story's own output. **Per AC2, every revision below must be propagated to `prd.md` and `epics.md` in this story** — Story 8.6 recorded its FR revision in the decision record only, and clearing the resulting upstream drift took a whole correct-course pass (`sprint-change-proposal-2026-09-06.md`). Not repeating that.

- **FR23** (drop zone accepts PNG/JPEG/WebP plus pasted screenshots, extracts via a local ONNX model, INV-1)
  → **expanded and corrected:** a **third input path**, the file picker, is added and is the *canonical keyboard-operable* one per `EXPERIENCE.md` Flow 2 — drop and paste are alternatives to it, which is what the spine always said and the code never did. **The `PNG/JPEG/WebP` enumeration is dropped**: the decoder has always accepted fifteen formats (TIFF and BMP included), so the FR was under-claiming, and the revised wording is format-agnostic rather than a list that drifts with the `image` crate's default features. Locality and the ONNX/AD-7 posture are unchanged.
- **FR24** (extracted text shown **editable** with one-click copy; typical screenshot under ~3 s on Apple Silicon)
  → **revised:** text is **selectable in place on the image** (Live Text) with one-click "Copy all text" for the whole result. It is **no longer editable in the tool** — the `<textarea>` is removed. The ~3 s performance bar is unchanged and still applies. *This supersedes Story 4.2's AC2 ("editable in place"), which was the only argument ever made for editability and has not been re-argued since.*
- **FR25** (OCR supports English in v1, plus AD-13's coupling rule and its 2026-08-23 French amendment)
  → **revised:** the English-only limitation is **retired**. Verified directly against the bundled `character_dict.txt` this session: all 17 French characters checked — `é è ê ë à â ù û ô î ï ç œ É È À Ç` — are present among its 6,904 entries. The 2026-08-23 AD-13 amendment is operative; FR25's "English in v1" describes a limitation the shipped model does not have. **Stated honestly:** dictionary coverage is not the same as verified recognition *quality* in French; the FR should claim character support, not benchmarked accuracy.
- **FR26** (failed or empty extractions state so explicitly rather than showing a blank result)
  → **expanded, and this is the story's best idea:** honesty stops being only a terminal state and becomes **continuous**. Low-confidence regions are marked *on the image*, so "I'm unsure here" is expressible mid-success, not only as a total failure. The explicit no-text-found state (Story 4.3) is preserved unchanged. **Stated as the reason, not a side effect:** the bundled model is PP-OCRv6 *tiny*, det+rec, printed-text-trained. It will be poor at handwriting, and a photographed handwritten note producing confident nonsense violates FR26 harder than any blank result — the low-confidence marking is the primary defence against that, which is *why* it ships.

---

## AD-1 functional-core split (AC5)

### Survives as-is in `crates/umbra-core/src/ocr.rs`
`MAX_INPUT_BYTES` · `OarOcrEngine` and its `OAROCRBuilder` construction from resolved absolute paths (AD-2/AD-15) · the `image::load_from_memory` decode path · the raw-RGBA path's dimension guard, `from_raw` length check and alpha drop · `ocr_error()` · the module's capability-not-tool naming and its FR29 rationale.

### New core work — **the trait changes** (AC5's explicit question, answered)

**Yes, the `OcrEngine` trait signature changes.** Deliberately, recorded, not incidental.

- `OcrOutcome` becomes region-structured: a list of regions, each with `text`, `confidence`, and bounding-polygon geometry. Exact field names (`orientation_angle` is excluded — always `None`, see *The model pipeline*), and whether a convenience whole-text accessor lives in core or in the view → Task 2a.
- Both trait methods (`extract_text`, `extract_text_from_rgba`) return the new shape.
- `run_ocr` stops collapsing `text_regions` into a `\n`-joined string and a mean confidence. It currently builds two parallel vectors and averages one of them; the pairing and the geometry are destroyed at the core boundary. The change is **subtraction**, not new computation — the adapter already holds every value it needs, per region, inside the existing loop.
- The empty-outcome contract is preserved: **zero regions remains a legitimate "no text found", not an error** (FR26 / Story 4.3). Whatever the new shape, the emptiness check must stay anchored to *text*, exactly as Story 4.3's Task 1 reasoned.

**Also new core work — the pipeline is configured explicitly for the first time.** `OarOcrEngine::new` stops calling bare `.build()`:
- `.text_detection_config(...)` with **`limit_side_len = 1600`** — the value chosen above, written down rather than inherited.
- `.text_recognition_config(...)` with **`max_text_length` set explicitly**, once the empirical long-line test says which value we are actually getting today. The test lands regardless of the outcome; the explicit setting is what stops it drifting again.
- Everything else stays at its inherited default **deliberately and on the record**, rather than by not looking: `score_threshold = 0.0` (no filtering — see finding #5), `return_word_box = false`, no orientation classifier, no execution provider.

**AD-8 forward consequence, accepted explicitly.** AD-8 binds this trait to FR29's future structured-extraction feature — `ocr.rs`'s own module doc says a later feature *"can reuse or extend this trait shape without a rename."* A richer, region-structured outcome is a **better** base for that than a flat string, so this widens the trait *toward* FR29 rather than away from it. Winston's position, on the record: widen it once, deliberately, now — rather than have Story 6.4 widen it under deadline for a feature nobody has specced.

### `src-tauri` command layer owns
Model-path resolution (`models_dir()`, `resolve_model_path()`) · the `OnceLock` engine init · `check_file_size` before the read · `spawn_blocking` (AD-4) · the raw-IPC-body clipboard read and its header parsing · `map_join_error`. **All unchanged in behaviour**; the two commands are renamed (below) and their return type follows the trait.

### View-owned (AD-1 presentation — never core)
Every part of Live Text: loading the image via `convertFileSrc`, the natural-size → rendered-size coordinate scale, absolute positioning of the transparent selectable spans, the low-confidence marker and its threshold, "Copy all text" via `useCopyFeedback`, the file picker, the `extracting` in-flight state and its announcement, the Epic-7 tokenisation, and the empty/error states. **Core never learns a CSS pixel.**

### Explicitly NOT in scope
No new Rust dependency (`crates/umbra-core/Cargo.toml` and `src-tauri/Cargo.toml` gain nothing) · no second byte-payload IPC exception · no `oar-ocr` version change · no change to `pdf.rs` / `image_convert.rs` / their commands beyond the mechanical move · no word-level detection enabled · no layout analysis.

---

## AD-16 runner scoping (AC4d)

**One runner, three doors — and the view calls it directly for the first time.**

Today OCR has **no** local runner: `DropZone.vue` owns `registry.getLatestWinsRunner("bucket")` and the view only consumes `registry.dropResult` / `registry.pasteResult` as one-shot signals (the `HashView.vue` reference shape).

The file picker adds a **third write-trigger**, invoked *from the view* rather than from the shell. AD-16's amended rule is **one runner per independent piece of state**, and drop, paste and pick all write the same extraction outcome — one state group.

Therefore: **not** a new local `createLatestWinsRunner()`. The view calls `registry.getLatestWinsRunner("ocr")` **directly**, so a pick landing after an in-flight drop correctly supersedes it. This is exactly the shape the 2026-08-04 AD-16 amendment named for this tool; Story 4.2 established the same reasoning when paste became the second trigger.

PDF's one local runner and Images' two move with their sections, unexamined — 8.8 and 8.9 re-derive them under AD-16 if their own redesigns change the state groups.

**Story 8.6's stale-snapshot lesson applies and is now cheap.** 8.6's code review found `runExplain` writing a stale snapshot back over keystrokes typed during an in-flight call. The story's Dev Notes flagged this as *"directly relevant to an editable OCR `<textarea>` re-seeded from each arriving `outcome.text`."* **Removing the textarea dissolves that bug class entirely** — there is no user-edited state for a late result to clobber. Recorded because the risk was real and is now structurally gone, not merely unaddressed.

---

## Spine amendment — the asset protocol (developer's decision)

Live Text requires the **view** to have the image. It does not.

`DropZone.vue` receives a *path* from the OS, hands it to the command, and **Rust** reads the bytes; the webview never sees a pixel. `registry.dropSourcePath` gives the view the path string (and `HashView.vue` already consumes that field, so the precedent exists) — but not the bytes. This is not an oversight, it is **AD-15**: files cross IPC as absolute paths, `src-tauri` owns every read, and there is exactly **one** sanctioned byte-payload exception — clipboard RGBA over the raw IPC body — with the spine's own words being *"do not add a second."*

Three routes were presented to the developer with trade-offs, per `CLAUDE.md`'s shared-infrastructure rule:

| Route | Verdict |
| --- | --- |
| **A — enable Tauri's asset protocol, scoped.** `app.security.assetProtocol` + a declared scope; view uses `convertFileSrc(path)`. | **Chosen.** Tauri's own sanctioned mechanism for exactly this — the boring-technology option. Does **not** violate AD-15's letter: no bytes cross IPC. The CSP already permits it — `img-src 'self' asset: http://asset.localhost data:` was configured for Base64's data-URI preview in Story 8.2 — so only the config and the scope are new. |
| B — a second byte-payload command (`ocr_read_image_bytes(path) -> Vec<u8>`, blob URL in the view). | Rejected. Breaks AD-15's explicit "do not add a second", for a *presentation* concern. Also makes every dropped image cross IPC twice — once as a path, once as bytes — 100 MB files included. |
| C — Live Text on the paste path only (retain the RGBA the shell already reads; zero new permissions). | Rejected unanimously by the room before the developer saw it. Two entry points, one behaviour; a feature that silently works on paste and not on drop is the worst option on the table. |

**What this costs, stated plainly:** the webview gains its first real filesystem read edge. That touches **AD-14** (*"the shell owns OS I/O edges exactly once"*) more than AD-15, and it is a **recorded spine amendment owed to `ARCHITECTURE-SPINE.md`** in this story — the 8.6 precedent (AD-9 amendment, AD-13 resolution) is the shape to follow. The scope must be as tight as Tauri's scope syntax allows; the exact scope is Task 2a's, and it is a **security decision, not a config detail**. AD-7's zero-network posture is untouched — the asset protocol is local-only.

---

## Command and error-code renames

**All nine commands are `bucket_*`. All sixteen error codes are `bucket-*`.** `umbra-core` is clean — `ocr.rs`, `pdf.rs`, `image_convert.rs` are correctly named for capabilities. The scaffold's name reached the command layer and the error codes only.

AD-3 requires `<tool>_<verb>`, and there will be no tool called bucket. **But 8.7 renames only its own**, because renaming `bucket_merge_pdfs` → `pdf_merge` would rewrite PDF tests and break the verbatim-move gate. PDF and Images cross the room still called `bucket_*`; 8.8 and 8.9 each rename their own. Temporarily ugly, bounded, and verifiable — accepted on the record.

**Commands:** `bucket_extract_text` → `ocr_extract_text`; `bucket_extract_text_from_clipboard` → `ocr_extract_text_from_clipboard`. Both `generate_handler!` entries and both `use` lines in `src-tauri/src/lib.rs` follow.

**Codes — renamed (OCR-exclusive):** `bucket-engine-init-failed` → `ocr-engine-init-failed` · `bucket-malformed-image-buffer` → `ocr-malformed-image-buffer` · `bucket-malformed-request` → `ocr-malformed-request` · `bucket-ocr-failed` → `ocr-extraction-failed` (not `ocr-ocr-failed`) · `bucket-unsupported-format` → `ocr-unsupported-format`.

**Codes — added, not renamed:** `ocr-internal` and `ocr-input-too-large`. **Verified this session: `bucket-internal` and `bucket-input-too-large` are used by `commands/pdf.rs` and `commands/image.rs` as well as `commands/bucket.rs`.** Renaming them would touch two tools that are supposed to move verbatim. OCR gets its own new codes at its own call sites; the `bucket-*` pair stays live for PDF and Images until their stories retire them. Duplication, deliberately, so the move slice stays mechanically verifiable.

---

## i18n / `TRANSLATABLE_CODES` — gap #9 reframed

**Paige's finding, and it changes what the fix is.**

Gap #9 says a French user gets English error text and implies the fix is adding `bucket-*` codes to `TRANSLATABLE_CODES`. Apply 8.6's own stated criterion — *a fixed, value-free sentence we wrote ourselves* — to each message and almost none qualify:

| Code | Message | Translatable? |
| --- | --- | --- |
| `ocr-engine-init-failed` | `format!("failed to resolve bundled models resource directory: {err}")` | No — wraps a Rust error |
| `ocr-internal` | `format!("background task failed: {err}")` | No — wraps a join error |
| `ocr-unsupported-format` | **the `image` crate's own error text, verbatim** | No, *today* |
| `ocr-extraction-failed` | `oar-ocr`'s own error | No |
| `ocr-input-too-large` | `format!("file is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit")` | No — embeds byte counts (matches `hash-` / `json-` / `jwt-input-too-large`) |
| `ocr-malformed-image-buffer` | embeds byte count and `{width}x{height}x4` | No |
| `ocr-malformed-request` | caller-supplied; header-parse failures | Task 2a — depends on whether the call sites are our sentences |

**So it was never a translation gap. It is a voice gap** — and it lands on the single most-hit error in the tool. A user drops a `.txt` file and gets the `image` crate's English decode error rendered raw. (That error text is load-bearing enough that Story 4.3's corrupt-PNG test asserts on the phrase *"unexpected end of file"* — a test that will need updating.)

The fix is to **write our own sentence** for `ocr-unsupported-format`, at which point it qualifies for `TRANSLATABLE_CODES` *and* needs an `errors.*` key in `en` + `fr`. Different shape of work than the gap describes; smaller in codes touched, larger in value delivered.

*Direct callback: Paige and Mary landed this exact finding in Story 8.1 — rewriting `serde`'s generic error text to meet the JWT Inspector's voice bar. Seven stories apart, different crate, same class of bug.*

**vue-i18n literal-brace trap:** any new string carrying `{` / `}` (a file-extension list, a dimensions string) needs the `{'{'}` / `{'}'}` escape. `src/locales/locales.spec.ts` compiles every message and will catch it, but write it correctly the first time.

**AD-13:** no disclosed exception needed. The FR25 revision above *removes* the English-only claim rather than adding a carve-out — the localisation-ships-as-one-unit rule is satisfied, not excepted.

---

## Known gaps — explicit calls (all ten)

| # | Gap | Call |
| --- | --- | --- |
| 1 | No file-picker button (unmet `EXPERIENCE.md` Flow 3 / Flow 2 step 5, NFR5) | **FOLD IN.** A scripted demo step describing a control that doesn't exist. Non-negotiable. |
| 2 | No in-flight state (unmet `EXPERIENCE.md` Loading row, which names OCR explicitly) | **FOLD IN.** Includes the unannounced first-use `OnceLock` model-load cost. |
| 3 | `OcrOutcome.confidence` plumbed three layers, never rendered | **FOLD IN, transformed.** Not "surface the number" and not "delete it" — keep it *per region* and mark low-confidence regions on the image. The mean was the useless part. |
| 4 | `result.value as OcrOutcome` — unchecked type assertion, two call sites | **DEFER (backlog).** It is a project-wide convention across every tool; fixing it in one tool creates inconsistency, not safety. **Noted honestly:** the assertion now covers a nested region list rather than a flat struct, so the blast radius of a shape mismatch grows. That raises its backlog priority; it does not make it this story's job. |
| 5 | `role="status"` live region never manually screen-reader verified | **FOLD IN** as a Task 2b manual check. It stops being optional — this story *adds* announcements (in-flight start/completion) on top of the unverified one, and NFR5 is checked at PR review. |
| 6 | Corrupt-image truncation tested at one point on one fixture | **FOLD IN (cheap).** Add a near-full-length truncation case — a materially different `image`-crate decode path. A few lines, and the existing test's assertion is being touched anyway by the `ocr-unsupported-format` message rewrite. |
| 7 | No `useCopyFeedback`; adopting it makes this the 6th consumer of a file with a live hoist-candidate comment | **FOLD IN the adoption. ESCALATE the hoist.** Five stories declined the hoist on the reasonable grounds that they weren't shared-infrastructure stories. **This one is** — it already touches `registry.ts`, `icons.ts`, `DropZone.vue` and `tauri.conf.json`. That excuse has expired. Per `CLAUDE.md`, shared-infrastructure choices go to the developer as options, not decided in-room. See *Open items*. |
| 8 | AD-13 / FR25 French-OCR claim | **RESOLVED.** Verified against the bundled dict directly: all 17 French characters present. The amendment is operative, FR25 is stale → revised and propagated (AC2). |
| 9 | `bucket-*` codes absent from `TRANSLATABLE_CODES` | **FOLD IN, reframed** — see above. It is a voice gap, not a translation gap. |
| 10 | `oar-ocr` version drift | **SETTLED, not reopened.** 0.6.3 remains correct; the toolchain has not crossed 1.95. **But** the `epics.md` drift found while checking is a real correction owed — see below. |

---

## Upstream corrections owed (beyond the FR propagation)

1. **`epics.md`'s Epic 8 preamble: *"No ordering dependency between the 9 stories."*** False for 8.7–8.9, and now false in a new way — 8.8 and 8.9 **inherit this record's container decision** and are no longer "reimagine a sub-feature of the Bucket" but "reimagine a tool." Their scope lines need rewriting, not just a caveat on the preamble.
2. **`epics.md`'s `oar-ocr` 0.8.x claims.** Three places, not four (the story's Dev Notes overcounted): `:127` (AD-8 restatement) and `:137` (Stack line) are **live claims and should be corrected to 0.6.3**; `:741` is Story 4.1's own historical AC and gets a **forward pointer**, not a rewrite (the Epic 3 precedent from `sprint-change-proposal-2026-09-06.md` §4.3). `ARCHITECTURE-SPINE.md`'s Stack table is already correct and explains why.
3. **`ARCHITECTURE-SPINE.md`: the asset-protocol amendment** (AD-14/AD-15 scope). **Lands at build time (Task 2b), not now** — following 8.6's precedent, where the AD-9 amendment and AD-13 resolution were approved at Task 1 and written into the spine when the code they describe was actually built. A rule amendment describing behaviour that does not yet exist would make the spine describe an intention rather than the system.
4. **`ARCHITECTURE-SPINE.md` gains the model-tier comparison it never had.** Checked while drafting: the *"medium tier remains the documented fallback"* claim is **not** in the spine — it lives in **Story 4.1's task text** (line 49), which is historical record and gets a forward pointer rather than a rewrite (the Epic 3 precedent). The spine's Deferred entry records *which files* were chosen and never mentions tiers at all. So this is an **addition**, amended the way AD-8 was amended by Story 4.2: record all three tiers with their real sizes (tiny 6.0 MB / small 29.6 MB / medium 132.2 MB), and note that **`small` — not `medium` — is the realistic escalation**, since 132 MB of models is a different product rather than a fallback. **Applied 2026-09-06** to the spine's resolved OCR-model Deferred entry.
5. **Story 8.8 inherits PDF tier 2 in writing** — the `noTextInPdf` message becoming honest about scans is 8.8's, because PDF moves verbatim in 8.7. Recorded here so it is a hand-off, not a hope.
6. **`EXPERIENCE.md` Flow 2 step 5** finally becomes true rather than aspirational — worth a note that the step was unimplemented from Story 4.1 until this story, so a future reader doesn't assume the doc always matched the code.

---

## The model pipeline — six defaults nobody ever chose

**The developer's own catch, and the largest gap in the first draft of this record:** three rounds had gone to where the pixels come from and where the text goes, and none to *what happens in between*. For the app's only AI feature.

`OarOcrEngine::new` calls `OAROCRBuilder::new(det, rec, dict).build()` and **nothing else** — no `.text_detection_config()`, no `.text_recognition_config()`, no `.text_type()`, no `.with_text_line_orientation_classification()`, no `.return_word_box()`, no `.ort_session()`. Every value below was inherited, not decided. All verified against the vendored `oar-ocr` / `oar-ocr-core` 0.6.3 source.

| # | Inherited default | Consequence | Call |
| --- | --- | --- | --- |
| **1** | **`limit_side_len = 960`, `limit_type = "max"`** (the general preset). Every image is downscaled so its longest side is at most 960 px **before detection**. | A 3024 x 1964 Retina screenshot is recognised at ~960 x 623. Thirteen-point UI text reaches the model roughly four pixels tall. **The highest-leverage parameter in the pipeline** — and it silently contradicts the redesign, since Live Text overlays a 3024-px image whose recognition happened three times smaller. Geometry still scales correctly (coordinates are proportional); *accuracy* does not. | **RAISED EXPLICITLY to 1600, no formal measurement** (developer's call). A 3024-px screenshot goes from a 3.1x downscale to 1.9x — 13-point text reaches the model ~7 px tall instead of ~4. **Cost decomposition that made this safe to do by judgement:** detection cost scales with image *area*, recognition cost scales with the *number of regions* — recognition crops each line and normalises it to the rec model's own input height regardless. So 960 -> 1600 is ~2.8x the pixels **for the detection pass only**, not for the whole ~3 s. Tunable at render review, where the on-screen indicator makes any slowdown immediately visible. |
| **2** | **`max_text_length` is ambiguous.** `TextRecognitionConfig::default()` = **25**; the predictor builder in the same crate = **100**; `OAROCRBuilder`'s own test fixture = 128. Which one reaches the CTC decoder depends on the construction path. | If 25 bounds decoding, **long text lines are silently truncated** — and no existing test would catch it, because every fixture assertion is `contains("UMBRA")` on a short fixture. | **EMPIRICAL TEST, not an argument.** A fixture line well over 25 characters, asserting the full string survives. If it truncates, that is a shipping bug more severe than the reading-order one, and setting the value explicitly is the fix. |
| **3** | **`orientation_angle` is always `None`.** Populating it needs `.with_text_line_orientation_classification(model_path)` and a **third bundled model**. | Rotated lines still get correct polygons — they are *located* fine — but the tilt angle is unavailable, so the overlay cannot rotate a span to match a skewed line. | **ACCEPT and record the limitation.** A third bundled model is not this story's cost. *This corrects an earlier claim in this record's own drafting, rather than silently editing it away.* |
| **4** | **`return_word_box = false`**, and the crate's own doc notes word boxes "require word-level detection support in the recognition model" — which PP-OCRv6 tiny may not have. | Word-level selection is unavailable, not merely unconfigured. | **CONFIRMS the word-level cut** (Cut #4) for the right reason: it is not a flag we chose not to flip. |
| **5** | **Recognition `score_threshold = 0.0` — no filtering.** | **Good news, and load-bearing.** `TextRegion.text: None` genuinely means recognition *failed*, not "was quietly dropped for being uncertain." Nothing is discarded behind our backs. | **RECORD IT.** This is what makes the low-confidence marking honest by construction — the view sees everything the model saw, bad guesses included, which is exactly the point. |
| **6** | **No execution provider configured**, so `ort` runs **CPU**. `OrtExecutionProvider::CoreML` exists in the config enum and is unused. | On Apple Silicon — the platform FR24's *"under ~3 s"* bar is explicitly written against — the neural engine is untouched. | **CUT -> GitHub issue** (#15), with the provider analysis below. The developer's measured ~3 s baseline is acceptable *once there is feedback*, which makes acceleration an optimisation rather than a necessity. |

### One standing risk, not a knob

**`ort` is pinned to `2.0.0-rc.12` — a release candidate.** Held by an exact `Cargo.lock` pin because Story 4.1 found that `oar-ocr-core` 0.6.3 declares `ort = "2.0.0-rc.12"` but does not compile against rc.13, which the resolver had picked (rc.13 restructured `CPUExecutionProvider`). So the app's entire inference layer sits on a pre-release, and it cannot move while the rustc-1.95 floor blocks `oar-ocr` past 0.6.3. **Named as a known risk with no action this story** — same posture as the `oar-ocr` pin, and it re-opens on the same trigger (the CI toolchain crossing 1.95).

### Execution providers — the analysis behind cut #15

The developer's push-back on an early framing ("you talk about macOS but there are a lot more execution providers") was correct: this is not a macOS optimisation, it is a **cross-platform hardware-acceleration story we have never configured.** `oar-ocr` exposes six as **compile-time Cargo features** — `coreml`, `cuda`, `directml`, `openvino`, `tensorrt`, `webgpu`. Umbra enables **none**; `oar-ocr = "0.6"` takes default features only (`download-binaries`).

Sorted by the question that actually decides it for a download-and-run desktop app — **does the end user have to install a vendor runtime?**

| Provider | Ships with the OS? | Verdict |
| --- | --- | --- |
| **CoreML** | Yes — macOS, Apple Neural Engine | Viable: the macOS leg |
| **DirectML** | Yes — Windows 10+, any DX12 GPU (AMD/Intel/NVIDIA alike) | Viable: the Windows leg |
| **WebGPU** | Via the system graphics stack (Metal / D3D12 / Vulkan) | Viable, and the **only genuinely cross-platform** one — the only realistic Linux answer, and the only option that doesn't fragment the build |
| **CUDA** | No — NVIDIA drivers + CUDA runtime | Out **on distribution grounds, not performance** |
| **TensorRT** | No — NVIDIA + a separate TensorRT install | Out, same reason, more so |
| **OpenVINO** | No — Intel runtime install | Out, same reason |

Two constraints travel with the issue. **These are compile-time features, not runtime flags** — enabling them means target-specific dependencies (`[target.'cfg(target_os = "macos")'.dependencies]`), i.e. three binaries with three inference stacks, a changed `ort` `download-binaries` payload, binary-size implications, and a **fresh AD-7 network audit** since Story 4.3's cleared dependency graph would change. And **we can only measure on the machine we have** — a CoreML number would be real; a DirectML number would be a guess.

### The three seconds — a feedback problem, not a speed problem

The developer measured it directly: **~3 s today**, and *"three seconds feels slow when you put an image and have no visual feedback of the processing."* That reframes the whole performance thread. Three seconds sits squarely in the band where a person needs to be told something is happening — under a second goes unnoticed, past ten and attention is gone. Three seconds of a frozen window reads as *broken*; three seconds of visible work reads as *working*. Same three seconds.

So the fix is the one already decided under *Changed*: **the image appears in the first frame**, and an indicator runs over it.

**It is deliberately an *indeterminate* indicator, not a progress bar.** ONNX inference reports no progress — no callback, no fraction, nothing to bind a percentage to. A bar filling at a rate we invented would be a fake animation timed to nothing, which is a bluff about our own internals in an app whose whole posture is *the Bucket never bluffs*. The honesty rule applies to how we describe our own work, not only to the results we report.

---

## The model — a first-class decision, made deliberately for the first time

**Raised by the developer, and correctly.** The first draft of this section was a three-line footnote at the end of a table about resize limits, and its deferral was logically broken: it said *"tier is not re-evaluated until finding #1 is measured"* — and finding #1 was then decided **without** measurement, so the gate could never fire. For the app's only AI feature, where the model **is** the product, that was not an answered question. It is now.

### What we ship

**PP-OCRv6 tiny**, detection + recognition, official PaddlePaddle ONNX releases, Apache-2.0 (verified via each repo's `cardData.license` in Story 4.1, and both files verified byte-for-byte against Hugging Face's own LFS hashes before bundling). Detection 1,780,590 bytes; recognition 4,462,639 bytes; plus a 6,904-entry character dictionary extracted from the rec model's `inference.yml`. **6.0 MB on disk.**

### What the alternatives actually cost — checked, not assumed

There are **three** tiers, not two. All three have official PaddlePaddle `_onnx` repos.

| Tier | Detection | Recognition | Bundle | vs. tiny |
| --- | --- | --- | --- | --- |
| **tiny** — shipped | 1,780,590 B | 4,462,639 B | **6.0 MB** | — |
| **small** — *never previously mentioned by anyone* | 9,880,512 B | 21,159,378 B | **29.6 MB** | **≈ 5x** |
| **medium** — *recorded in the spine as our fallback* | 62,032,837 B | 76,554,979 B | **132.2 MB** | **≈ 22x** |

**Two findings follow immediately.**

1. **The recorded fallback is unusable.** `ARCHITECTURE-SPINE.md` names the medium tier as *"the documented fallback if tiny proves inadequate."* That note was written in Story 4.1 without pulling the file sizes. It is **132 MB of models** for a local utility whose entire pitch is small, offline and yours — not a fallback, a different product. **The spine's fallback line should be corrected to name `small`, not `medium`.**
2. **The tier between them was never named.** `small`, at 29.6 MB, is the only alternative that is even a conversation — and it is a 5x model payload increase on an app that currently bundles 6 MB of it.

### The decision: **tiny stays**, and now for a reason

Not because it was already chosen, but because the costs point one way and the room declines to guess about the one thing it cannot measure:

- **Direction of cost is known even though the benefit isn't.** A larger recognition model is slower per region, and this record has just raised `limit_side_len` to 1600, so detection is already doing ~2.8x the pixel work. Stacking a 5x model on a **measured 3-second baseline** is plausibly the difference between three seconds and ten — and ten seconds is the threshold past which a user has disengaged regardless of how good the indicator is.
- **Benefit is unquantified and this record will not invent it.** Nobody here has run `small` on a real screenshot. Claiming it would be "more accurate enough to justify 24 MB and several seconds" would be exactly the kind of unevidenced assertion Mary refused to make about PDF-scan prevalence.
- **The cheaper lever was pulled first.** `limit_side_len` 960 -> 1600 gives the *existing* model roughly four times the pixels to work with, at a fraction of `small`'s cost. If tiny still under-performs after that, the tier question re-opens with a real basis — **and that is the gate, replacing the broken one.**

**Revisit trigger (concrete, so it can actually fire):** if, at `limit_side_len = 1600` and with the reading-order fix in, recognition quality on real screenshots is still unsatisfactory during Task 2b's render reviews, evaluate `PP-OCRv6_small_*` — measuring both accuracy and wall-clock, and weighing the 24 MB against the download size of the app as a whole.

### Languages — and a better bet than "bigger"

The v6 tiny dictionary is **6,904 entries and genuinely multilingual** (the model is tagged `en`/`zh`; every French character verified present — see FR25). "English only" was always a claim about our documentation, never about the model.

But note what that breadth costs: most of those 6,904 entries are **Chinese**, serving a script this app has never claimed to support. And PP-OCRv5 ships **language-specific recognition models** — `latin_PP-OCRv5_mobile_rec`, `en_PP-OCRv5_mobile_rec`, plus Korean, Greek, Arabic, Cyrillic, Devanagari, Thai, Tamil and Telugu variants.

A Latin-script recogniser is trained on the scripts we actually serve, with a dictionary a fraction of the size. **That is a different bet from a bigger tier: not more model, but better-targeted model** — and it is the more interesting one for a tool whose supported languages are English and French. It is also **v5, not v6**, with a different dictionary and a different extraction path, requiring Story 4.1's entire verification exercise repeated. **Cut #17, personal backlog**, filed with the hypothesis attached rather than as a vague idea.

---

## Accessibility — what Live Text owes NFR5

**Paige's finding, and it changes the priority of the reading-order sort.**

This redesign deletes the one unambiguously accessible element in the tool — a labelled `<textarea>` containing the extracted text — and replaces it with transparent spans absolutely positioned over an image. NFR5 is full WCAG 2.1 AA, *behavioural*, the developer's own explicit choice set by this project's portfolio stakes: **"every flow keyboard-drivable, no exceptions."**

The spans are real DOM text, so a screen reader does read them — **in DOM order**, which is whatever order the regions are emitted in, which today is the model's detection order. So the reading-order sort is not only a Copy-correctness fix; **it is an accessibility fix.** Sorted, a screen-reader user gets a two-column screenshot read correctly for the first time. Unsorted, we ship gibberish to exactly the users NFR5 exists for.

One geometric sort now serves three requirements — Copy fidelity, screen-reader order, and `⌘F` match ordering — which is what moves it from "nice correctness win" to load-bearing.

Also owed, and named here so Task 2a's AC set carries them:
- The image needs an accessible name that is **not** the filename, and one that says its text is available.
- The overlay container needs a role that doesn't announce "image" and stop.
- `⌘A` / `⌘C` inside the overlay must work without a pointer — the keyboard path for "copy and leave".
- The in-flight start/completion `role="status"` announcements (gap #2) and the existing no-text-found live region (gap #5, never manually verified) both need a real `pnpm tauri dev` screen-reader pass, not just a passing spec.

---

## The PDF tiers — how the one unserved job gets handled

The developer named "PDF pages with unselectable text" as a real use, and **neither tool serves it**: `bucket_extract_pdf_text` reads only a PDF's embedded text layer (a scan returns `noTextInPdf` — true, and useless, because the text is visibly right there as pixels), and the OCR tool cannot open a PDF at all. Today's honest workaround is *screenshot your own PDF*, inside an app that owns both halves. The three-way split makes that seam **more** visible, not less: it becomes two adjacent sidebar entries that don't talk.

The room's insight, and the reason this doesn't need a big dependency to be improved: **serving the attempt is not the same as serving the extraction.** Three tiers, only the third costs anything.

| Tier | What | Where |
| --- | --- | --- |
| **1** | A PDF dropped on Image to Text stops failing with the `image` crate's raw decode error and instead says *"PDFs open in the PDF tool"* — ideally as an offer that opens it. Magic-byte check plus a sentence. | **Story 8.7.** No dependency. |
| **2** | The PDF tool's `noTextInPdf` — *"no text in this PDF"* — becomes honest: *"This PDF is a scan — its pages are images, so there's no text layer to read."* `lopdf` is already in the tree and can distinguish "no text layer" from "empty document". | **Handed to Story 8.8 in writing.** It is the PDF tool's message, and PDF moves verbatim in 8.7. |
| **3** | Actually rasterize the page and run OCR on it. | **Cut → GitHub issue** (#13 above), with the cost sheet below attached. |

### Tier 3's cost sheet (travels with the issue)

**Against:**
- `pdfium-render` binds to PDFium at **runtime**, not compile time — so the app ships `libpdfium` itself, per platform: macOS arm64, macOS x64, Windows, Linux. Four binaries to source, verify, bundle and keep current.
- It roughly **doubles the bundled payload**. Today: 6.2 MB of ONNX models (1.78 MB detection + 4.46 MB recognition + dictionary). `libpdfium` is comparable or larger, and every user pays it on download whether or not they ever open a scan.
- It is a **second native C++ dependency, and this project has a scar there.** Story 4.1 was *blocked* — not slowed — because `clipper2c-sys`, a transitive `oar-ocr` dependency, would not compile against a broken C++ standard library in the Xcode Command Line Tools, and clearing it needed a user-side reinstall. A second native C++ dependency reopens that class of build fragility.
- **macOS Preview already does Live Text on scanned PDFs** — on the developer's own primary platform, the job is solved by an app one `⌘O` away, for free. *(Counter, recorded because it is fair: "the OS already does it" is precisely the argument AD-8 rejected when it chose ONNX over macOS Vision for NFR3 portability. The distinction is between rebuilding an OS feature for the **core** capability and doing it for an adjacent one at the cost of doubling the bundle.)*
- Rasterization reopens parked questions: at what DPI (a 300 DPI page is ~8.7 megapixels — inside the 100 MB RGBA guard, but real memory per page), and multi-page immediately hits the serial-vs-bounded-worker-pool concurrency question `EXPERIENCE.md`'s Open Questions already parks under batch operations.

**For:**
- It is the only job the developer named that nothing serves.
- The split turns a hidden seam into a visible gap between two adjacent sidebar tools.
- Users will try dropping a PDF — the developer's own prediction, and almost certainly right. *(Tier 1 serves that prediction; tier 3 serves the rarer extraction behind it.)*

**Licence: cleared.** PDFium is BSD-3-Clause (Chromium's licence) — commercial redistribution inside a closed-source app is permitted with attribution, the same class as the Apache-2.0 PaddleOCR models already bundled. **MuPDF would have been disqualifying** (AGPL-or-commercial); PDFium is not.

**No prevalence data exists.** Vendors define the taxonomy (ABBYY's searchable / image-only / true PDF) but nobody publishes what share of PDFs are image-only, and this record declines to invent a number. The developer's own observation is the better instrument: *most PDFs that aren't scanned are already text-selectable*, which means scanned PDFs are defined by **origin** (anything through a physical scanner or a phone scanning app — contracts, small-vendor invoices, administrative forms, archives) rather than by volume. That makes this **rare-but-blocking**, costed by what happens when you hit one, not by how often.

**The sequencing argument that decided it:** ship tier 2's honest message, see how often it actually fires in real use, *then* decide whether to spend a doubled bundle and a second native C++ dependency on tier 3. That is the decision made with data instead of speculation.

---

## Open items Task 2a owns

1. **The asset-protocol scope.** A security decision, not a config detail. How tight can it be while still serving arbitrary user-chosen paths?
2. **`OcrOutcome`'s exact new shape** — field names, whether `dt_poly`/`rec_poly` cross IPC at all (`orientation_angle` does not — always `None`), and whether a whole-text convenience accessor lives in core (AD-1: probably the view's job) or is derived view-side.
3. **The low-confidence threshold and its visual treatment**, in light *and* dark. Note the marker must not rely on hue alone (DESIGN.md's own diff-colour precedent kept icons and strikethrough carrying the signal independently).
4. **Coordinate scaling and zoom behaviour** — what happens to overlay alignment when the image is larger than the pane, and whether the image is scrollable, zoomable, or fit-to-pane.
5. **Selection ergonomics** — whether "Copy all text" is a button or an icon-button, whether selection across non-adjacent regions behaves sanely, and what `⌘A` does inside the overlay.
6. **The three `IconName` picks** and the final alias partition.
7. **Provisional names for the PDF and Images tools** — 8.8/8.9 may rename, but the registry needs values on day one.
8. **`ocr-malformed-request`'s call sites** — are those messages ours (translatable) or wrapped parse errors?
9. **`useCopyFeedback` hoist — developer decision** (see gap #7). Options to present: leave it in `src/tools/json/` with a 6th cross-island import; hoist to a shared location and update five existing consumers; or hoist and leave a re-export shim. This story is the first with a legitimate claim to make the call.
10. **Spec rewrite plan for `BucketView.spec.ts`** — which of the 33 `it()` blocks move verbatim to the PDF/Images specs, which OCR behaviours must stay covered through the shape change, and what the new Live Text surface needs.
11. **The `⌘F` surface** — where the search input lives, the match-highlight treatment in light and dark, match-count copy, and whether `⌘F` is scoped to the image or intercepted app-wide (an `AppTabs`-style shell concern if the latter).
12. **`DropZone.vue` drag-enter state** — the resting drop target should highlight when a drag enters the window. `DropZone.vue` exposes no such state today; this is a **shell** change and must be named in Task 2a's AC set.
13. **Tier 1's PDF response** — a plain message, or an offer that actually routes to the PDF tool? The latter is a tool-to-tool navigation, which brushes AD-6; a `router.push` to another registry route is arguably shell-level, not cross-island state access, but it should be decided rather than assumed.
14. **The image surface's own behaviour** — fit-to-pane vs. scrollable vs. zoomable, and what each does to overlay alignment.
15. **The quality corpus's contents and tolerance model** — which fixtures, what "expected text" means when OCR output is not byte-exact, and whether ordering is asserted separately from content.
16. **Concurrency under latest-wins.** One shared `OAROCR` behind `&self`, and a superseded request still runs to completion — so two inference jobs genuinely overlap. `Sync` is compiler-enforced, so it is *safe*; whether two concurrent ONNX sessions contend badly on CPU is unmeasured. Worth a look once the corpus exists.
17. **Whether the design canvas is built** before Task 2b. The room's view: yes — Live Text is the first genuinely novel layout in Epic 8 and the states (loading, no-text, error, low-confidence, oversized image) are worth seeing before they're built.

---

## Verification findings (AC1's mandatory re-read)

Every claim in the story's *Dev Notes → Shipped implementation* was checked against the working tree at `d576c3e`. **The code matched exactly** — line counts (`ocr.rs` 281, the view 713, the spec 711 with 33 `it()` and three `describe` blocks), the 16 aliases, the 32 i18n keys at `en`/`fr` parity, the `drop`/`paste`/`clipboardMatch` triple, the absent file picker, the absent in-flight state, the `oar-ocr` 0.6.3 pin and the 1.88 `rust-version`.

Two drifts were found **in the Dev Notes themselves**, and are recorded rather than silently corrected:

1. **`TRANSLATABLE_CODES` holds two `cron-*` codes, not one.** The Dev Notes say "and (since 8.6) `cron-six-field-unsupported`"; the set also contains `cron-no-upcoming-runs`. That is precisely the *"code review found a second code that met the criterion and had been missed"* event gap #9 itself cites — the fix landed, the note was written from the pre-fix state. It strengthens gap #9's instruction rather than weakening it.
2. **The `epics.md` `oar-ocr` drift is in three places, not four.** `:127`, `:137`, `:741`. Line 742 is the AD-7 bundled-models line and carries no version number. The remediation split is unchanged.
