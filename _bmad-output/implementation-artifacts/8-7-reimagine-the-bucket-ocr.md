---
baseline_commit: d576c3e
---

# Story 8.7: Reimagine the Bucket — OCR

Status: ready-for-dev

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

## Tasks / Subtasks

- [ ] **Task 0: Branch setup (AC: all)**
  - [ ] Confirm `baseline_commit` (`d576c3e`) is still `origin/main`'s real tip before branching (`git rev-parse origin/main` — was `d576c3ebc450d278f000abf112cc2f810e8be400` at story-creation; `HEAD == origin/main == main`, working tree clean apart from the pre-existing untracked `.claude/workflows/`).
  - [ ] `git checkout -b feat/story-8-7-reimagine-the-bucket-ocr` from the story-creation working tree, so the story file + decision record travel with the implementation branch (matches how 8.1–8.6 were branched; the story file is uncommitted at creation, so `git checkout -b` from `main`'s tip carries it and the `sprint-status.yaml` edit onto the new branch). Every subsequent commit lands on that branch.

- [ ] **Task 1: Discovery — produce the decision record (AC1–6)**
  - [ ] Run `bmad-party-mode` (installed roster — Mary, John, Sally, Winston, Amelia, Paige; `session` mode; party memory on, resuming the 8.1–8.6 Epic 8 history) **or** `bmad-forge-idea` for a narrower persona-driven pressure-test — **the developer's choice for this story.** Frame it explicitly as: *open scope discovery for the Bucket's OCR sub-feature — the existing implementation is reference material, not a decision to preserve.*
  - [ ] Feed the session the current, real state so it starts from fact. Re-read every file listed under **Dev Notes → Shipped implementation** at session start and confirm no drift vs. what is written there (Story 8.6's session found a stale corpus count doing exactly this; the check is not ceremony).
  - [ ] Ground the session in what Epic 7 + Stories 8.1–8.6 locked — read `src/styles/tokens.css`, `src/styles/base.css`, `src/components/AppButton.vue`, `src/components/AppTabs.vue`, `src/components/AppPopover.vue` + `appPopoverPlacement.ts`, `src/App.vue`, `src/shell/icons.ts`, `src/shell/debounce.ts`, `src/shell/invoke.ts`, `src/shell/DropZone.vue` + `dropZone.ts`, `src/shell/clipboardMatch.ts`, `src/tools/json/useCopyFeedback.ts`, and `DESIGN.md` + `EXPERIENCE.md`.
  - [ ] **Read the three prior Bucket stories as the record of what was already decided and why** — `4-1-drag-an-image-in-get-its-text.md`, `4-2-paste-a-screenshot-copy-the-text.md`, `4-3-the-bucket-never-bluffs.md`. AC4c's drop/paste shape and AC5's `OnceLock`/trait shape were reasoned there; reopening them is allowed, re-deriving them from scratch is waste.
  - [ ] Run a competitive sweep for evidenced scope candidates — macOS Live Text / Preview's text selection, Windows PowerToys Text Extractor, Google Lens, `tesseract.js` front-ends, Shottr / CleanShot X OCR, ABBYY / Adobe Acrobat OCR, and OCR-to-structured tools (table → CSV/JSON). Candidates to weigh, not commitments: region/crop selection before extraction, per-region confidence display, preserved layout vs. flat text, multi-page/batch, language selection, deskew/preprocess, side-by-side image ↔ text view, re-run at higher effort, drag-out of the extracted text.
  - [ ] Resolve **AC4a–4d** as explicit named decisions. Do not let the container question resolve itself by implementation drift — it binds two unstarted stories.
  - [ ] Resolve **AC2**'s FR23–FR26 verdicts, and if any FR is revised, **write the revision into `prd.md` and `epics.md` in this story**, not only into the decision record (AC2's second half).
  - [ ] Decide each item under **Dev Notes → Known gaps in the shipped OCR path** — every one is in scope for this story by subject matter, and each needs an explicit fold-in / defer / reject call in the record. The two EXPERIENCE.md conflicts (no file-picker button, no in-flight state) are **live spec violations in shipped code**, not new feature ideas.
  - [ ] Produce the written decision record to `_bmad-output/implementation-artifacts/8-7-ocr-decision-record.md`, mirroring `8-1`…`8-6`: **Kept / Changed / Added / Cut (backlog)** with rationale, plus the AC4 coupling decisions, the AC2 FR verdicts, and the AC5 AD-1 core split.
  - [ ] AC3: capture each cut idea — draft a max-context body per idea in the record, then file as `backlog-candidate` GitHub issues on `dipaneb/umbra` linking back to it — **or** take the personal-backlog route if the developer directs it (the 8.3/8.4 precedent), logging the deviation.
  - [ ] Optional: build a container-shape comparison canvas (one enriched view / `AppTabs` / three separate tools), with interaction states, as an Artifact. Given AC4a binds two other stories, this is a stronger canvas candidate than it was for 8.6, where the container was reasoned without one.
  - [ ] Developer confirms the scope decisions and open questions before Task 2 begins.

- [ ] **Task 2a: Redesign ACs — write real Given/When/Then** (after Task 1's record exists; canvas picks in)
  - [ ] In the same discovery room, resolve the decision record's open items and write real AC7+ into a new `## Acceptance Criteria — Task 2 (Redesign)` section above, scoped strictly to `8-7-ocr-decision-record.md` plus the developer's canvas picks and the files AC4 authorises (see Project Structure Notes — the AD-6 island boundary is **wider than usual for this story**, and the AC set must name every non-Bucket file it touches, the way 8.6's AC26 did; 8.6's code review found that AC list incomplete twice, so build it deliberately).
  - [ ] Await the developer's sign-off on the AC set before Task 2b.

- [ ] **Task 2b: Redesign — implementation** (after the AC set is confirmed)
  - [ ] Follow the delivery pattern Stories 8.1–8.6 established: **vertical slices, developer render-review after each slice.** Per slice: pure Rust fn + regression tests → `bucket_<verb>` command (`spawn_blocking`, `Result<T, ToolError>`, AD-3/AD-4, only if the command surface changes) → Vue → full local gate.
  - [ ] First slice is the Epic-7 tokenisation pass + restructure to the chosen container — `BucketView.vue` is **100% pre-Epic-7** (see Dev Notes), the same starting condition `CronView.vue` and `JwtView.vue` were in.
  - [ ] Full local gate before every commit: `pnpm lint` · `pnpm exec vue-tsc --noEmit` · `pnpm test` · `pnpm build` · `cargo fmt --check` · `cargo clippy --workspace --all-targets -- -D warnings` · `cargo test --workspace`.
  - [ ] `pnpm tauri dev` render-review in **both light and dark**, per slice, before calling a slice done.

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

### Debug Log References

### Completion Notes List

### File List

### Change Log

| Date | Change |
| --- | --- |
| 2026-09-06 | Story created (`bmad-create-story`) from `epics.md`'s Epic 8 shared shape, at baseline `d576c3e`. Task 1 ACs written real (AC1–AC6); Task 2 ACs deliberately deferred per the epic's own gate. AC4 added beyond the 8.1–8.6 template to force explicit resolution of the shared-`BucketView.vue` container, split, registry/drop/paste and AD-16 runner questions that 8.7 inherits on behalf of 8.8 and 8.9. AC2 extended with a same-story FR-propagation requirement, from Story 8.6's upstream-drift correct-course. |
