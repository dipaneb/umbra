# Story 8.9 — Images tool: scope decision record

Session: `bmad-party-mode`, installed roster (Mary/Paige/John/Sally/Winston/Amelia), session mode, Epic 8 party memory resumed. 2026-09-14.

## 0. The premise the session almost skipped

The room opened by asking the developer a JTBD question framed around their *own* usage of the tool. The developer rejected the framing outright, and correctly: scoping a tool from one developer's personal habits is exactly the mistake this story exists to avoid repeating a ninth time. Their instruction was explicit — research the real landscape (freelance dev, backend dev, frontend dev, corporate dev, WordPress dev, student, "etc.") and the competitive market, brainstorm broadly including adjacent media (vector, video), *then* decide what ships here, what's backlog, and what's dropped outright. This is the same shape as 8.6's "are we even sure this should exist" redirect and 8.8's container challenge — the room defaulting to a narrow, comfortable framing until the developer widened it.

One real miss during that research pass, on the record rather than smoothed over: the persona sweep covered freelance/backend/frontend/corporate/WordPress/student and stopped there, missing desktop, mobile, and game development — categories the developer's own "etc." was explicitly leaving room for, and a startling omission for a story redesigning a tool inside a **desktop app**. Corrected mid-session; see §5 and §2.4.

## 1. Persona and market research

Real web research, not invented personas — sources inline.

- **Frontend dev.** Two tool categories dominate: **responsive image sets** (one source → several widths in WebP/AVIF with generated `srcset`/`<picture>` markup — [JohnFraney's generator](https://johnfraney.ca/tools/responsive-image-generator/), [ToolsAid](https://toolsaid.com/responsive-image-generator), [MiniPx's "4 sizes × 4 formats" pattern](https://minipx.com/responsive-image-generator/)) and **favicon/app-icon generation** (one image → 40+ platform files: ICO, Apple Touch, Android adaptive, PWA manifest — [appicon.ikit.app](https://appicon.ikit.app/) covers iOS/Android/watchOS/macOS/PWA in one pass, [RealFaviconGenerator](https://realfavicongenerator.net/)).
- **Backend dev.** Bulk pipelines: normalize a folder to one format, generate thumbnails at scale, no per-file interaction.
- **WordPress dev.** [ShortPixel / Smush / Imagify / EWWW](https://stackharbor.com/en/knowledge-base/wp-image-optimization-plugins-compared/) all do exactly this tool's job — convert + compress with a quality control — at *media-library* scale, with a visible before/after (Imagify) and originals preserved for restore.
- **Corporate / freelance dev.** Brand-asset kits (one logo → a dozen named platform-size presets) and batch watermarking — a genuinely popular, crowded tool category ([BatchTool](https://batchtool.com/tools/watermark), [PixelTools](https://pixeltools.io/watermark), [BulkPicTools](https://bulkpictools.com/tools/watermark/image-watermark)).
- **Student.** Already served by today's tool — "compress this so the upload doesn't reject it" is a single-file, single-format job.
- **Desktop / mobile dev** (found late — see §0): substantially covered by the app-icon-kit candidate above, which already spans macOS/.icns and iOS/Android in one generator.
- **Game dev** (found late — see §0): **not served by anything considered.** DDS/KTX2 GPU-compressed textures, power-of-two sizing, mipmaps, texture atlases are a different technical universe from PNG/JPEG/WebP/AVIF. See §2.5.

**Market comparators, directly relevant to what this tool does today:** [Squoosh](https://apify.com/eunit/sqoosh-image-compressor) (single-file only in the web app — no batch, no folder queue), [ImageOptim](https://www.imagecrush.io/blog/best-image-optimizers-for-mac) (batches well, no modern-format support), [TinyPNG](https://www.imageoptimizer.org/blog/free-image-compressor-comparison-2026) (small batches). **Every one of them treats resize as core.** Ours has none — not a slider, not a dimension field. FR28 never mentioned it. This is the single biggest gap found, bigger than batch itself.

**Two free technical findings, verified against real sources rather than assumed:**

1. **AVIF is reachable as an output format, encode-only — checked against the crate's own feature graph, not assumed from Story 8.7's OCR-side note.** `image` 0.25.9's `default-formats` feature (already on by default in `umbra-core`'s `image = "0.25"`, no `default-features = false`) includes `avif`, which pulls in `ravif`/`rgb` — a pure-Rust AV1 **encoder**. So `AvifEncoder::new_with_speed_quality` is available today with zero `Cargo.toml` changes, and — unlike PNG/WebP — it takes a real `quality` parameter (1-100), the same shape as JPEG's. **Decoding an AVIF file (using it as a *source*) is a separate, non-default feature, `avif-native`, which pulls in `dav1d` — a C library**, not a pure-Rust one. That is a genuinely new native dependency, the same class of decision HEIC's `libheif` route was (§6.2), and is **not** part of this story's "near-free" finding. AVIF saves roughly 50% over JPEG per current market data, and is the more relevant modern format than lossless-only WebP — but the free part is *encoding to* AVIF only.
2. **EXIF/GPS metadata is already stripped today, and nobody knew it.** Verified directly against the vendored `image-0.25.9` source rather than assumed: `image::load_from_memory`'s decode path never populates an EXIF field on `DynamicImage` (zero matches for `exif` in `dynimage.rs`/`image.rs`), and both `JpegEncoder` and the WebP encoder default `exif: Vec::new()` — populated only via an explicit `set_exif_metadata()` call that `image_convert.rs`'s `convert()` never makes. A phone photo's GPS coordinates (accurate to ~5 meters by default, per current privacy research) simply do not survive the decode→re-encode round-trip. This is the same shape as 8.7's `score_threshold=0.0` "nothing filtered behind our backs" find and PDF's OS-native-renderer discovery — a real capability the app already has, unverified, untested, and unclaimed. **Becomes a claim to state and a test to add, not a mechanism to build** (§6.3).

## 2. Kept / Changed / Added / Cut / Dropped

### 2.1 Kept
- `convert`/`estimate_size`'s reuse relationship (`estimate_size` calls `convert` directly, so the two can never drift) — extends unchanged to every new target format.
- PNG and WebP staying lossless-only through this crate (`image` 0.25.9's own encoder limitation — no scope change proposed or requested).
- `ToolError { code, message, position, context }` as the only error shape; AD-15's output-path pattern for writes (reshaped, not replaced — see §2.2).
- The single-file happy path as a (now smaller) subset of the new multi-file model, not a separately maintained mode.

### 2.2 Changed
- **Single file → a queue of N files**, drag-and-drop or picker. Every write-trigger (`estimate`, `convert`) becomes an operation over a list: per-item pending/converting/done/error, one item's failure does not sink the batch (AD-16 re-derivation owed at Task 2a — see §6.4).
- **Output side.** A `save()` dialog per file is unusable at scale — becomes "pick a destination folder, we write into it," not N native save dialogs.
- **Estimate display.** A bare byte count → a **visual before/after**, matching the market's own convention (Imagify's whole pitch is exactly this).
- **JPEG's alpha-flatten background.** Hardcoded white since Story 6.2, deferred twice since — becomes a **user-chosen color**, developer's own reason on record: *"people often prefer black to white."*
- Registry `name`: `"Image"` (provisional since Story 8.7) → **`"Images"`** — matches the epic/story title, reads as a proper noun the way `"PDF"` does rather than a placeholder that never got named.
- `bucket_*` commands and `bucket-image-*`/shared `bucket-*` codes → `image_*` / `image-*` (AC4a, §4.1).

### 2.3 Added
- **Resize** (real gap, §1) — new core capability, entirely absent today.
- **AVIF** as a target format (near-free — §1, existing dependency).
- **Drag-and-drop, multi-file** (AC5, §3).
- **JPEG background color selector** (§2.2).
- **Visual before/after preview.**
- **EXIF/GPS stripping stated as a claim and locked in by a regression test** — mechanism already exists (§1, §6.3); this adds the test and the honest UI statement, not new core logic.

### 2.4 Cut → GitHub `backlog-candidate` issues (AC3)

Route: **GitHub issues on `dipaneb/umbra`, all four**, developer's explicit choice this story (unlike 8.3/8.4/8.6's personal-backlog route). Draft bodies in §8. **Filed 2026-09-14 — [#150](https://github.com/dipaneb/umbra/issues/150), [#151](https://github.com/dipaneb/umbra/issues/151), [#152](https://github.com/dipaneb/umbra/issues/152), [#153](https://github.com/dipaneb/umbra/issues/153).**

1. **A dedicated vector/SVG optimization tool.** [#150](https://github.com/dipaneb/umbra/issues/150) Real, feasible technical path found — live Rust crates doing SVGO's actual job (`oxvg_optimiser`, `svgo-rs`), no heavy new dependency. But it is a different asset type solving a different job (markup cleanup, not photographic compression) — the same shape that split "Bucket" into three tools in Story 8.7 rather than growing one. Recommendation: its own future tool, not a tab on this one.
2. **Batch watermarking** (text/logo compositing over N images) — real, popular market category, but a bigger feature than "convert/compress": new compositing logic, font/logo handling, positioning UI. Bigger than this story's remaining budget. [#151](https://github.com/dipaneb/umbra/issues/151)
3. **Favicon / app-icon kit generator** (one source image → the full named-preset set across platforms) — well-scoped, technically straightforward once resize exists, but a distinct feature with its own preset table, not a natural extension of convert-and-compress. [#152](https://github.com/dipaneb/umbra/issues/152)
4. **Whole-image deskew** — inherited from Story 8.7's own discovery (`8-7-ocr-decision-record.md:147`, cut item #7: *"Whole-image deskew is an image-processing feature, closer to the Images tool."*), never picked up since. Surfaced explicitly per AC3's own instruction rather than re-derived from scratch, and finally given a real home. [#153](https://github.com/dipaneb/umbra/issues/153)

### 2.5 Dropped — not backlog, not deferred

Distinct from §2.4: these are not "maybe later," they are considered and declined, with the reasoning on record so nobody re-derives the argument from scratch in a future story.

- **Video, in any form** — including the narrow "extract one frame as a thumbnail" version that would need only a decode, not a transcoder. Real video work needs an FFmpeg-class native dependency; this project's own PDF story just spent two sessions costing *one* native rasterizer (`pdfium-render`) before finding the OS already provided it for free. Video is a categorically heavier dependency/licensing/CI-compile-gate argument than anything this app has taken on, and does not fit the "one small tool per fortnight" cadence (FR35). Developer's explicit call: not even a backlog line.
- **Game-dev texture formats** (DDS/KTX2, power-of-two sizing, mipmaps, texture atlases) — a real, distinct persona need surfaced in §0's correction, and a genuinely different technical domain from anything PNG/JPEG/WebP/AVIF touches. Developer's explicit call: fully out.

## 3. Drag-and-drop — the first decision (AC5)

Unlike PDF's AC5 (Story 8.8, reopening Story 6.1's deliberate 2026 decline), Images has never been asked this question — no prior "declined, here's why" document exists. **Decided: yes, and multi-file** (developer: *"multi of course and drag-and-drop too of course"*), reusing the additive shape Story 8.8 already built (`registry.ts`'s `drop: { multiple: true }`, `DropZone.vue`/`dropZone.ts`'s `paths?: string[]` handler shape) rather than inventing a second one. Full cost — the state-model rebuild this implies — belongs to §6.4 and Task 2a, not this record.

## 4. Inherited obligations (AC4)

### 4.1 AC4a — the `bucket_*` → `image_*` rename, and the shared-code retirement

No developer discussion needed — fully specified by the story's own Dev Notes, confirmed against live source at session start with zero drift:

- **Commands (2):** `bucket_convert_image` → `image_convert`, `bucket_estimate_image_size` → `image_estimate_size`. Touches `src-tauri/src/lib.rs:19` (`use`) and `:90–91` (`generate_handler!`).
- **Core codes (4), `image_convert.rs`:** `bucket-image-unsupported-format`, `bucket-image-dimensions-too-large`, `bucket-image-invalid-quality`, `bucket-image-encode-failed` → `image-*` equivalents.
- **Command-layer code (1):** `bucket-image-invalid-target-format` → `image-invalid-target-format`.
- **Shared codes retired, not renamed:** `bucket-input-too-large` and `bucket-internal` in `commands/image.rs` are the last live users — PDF already minted its own `pdf-input-too-large`/`pdf-internal` and does not depend on these. This story owns `commands/image.rs` outright (unlike 8.8, which could only duplicate), so **retiring the pair outright** (replacing with `image-input-too-large`/`image-internal`) is the honest option finally available, per `8-8-pdf-decision-record.md §4.1`'s explicit hand-off.
- **Three stale comments fixed** (`commands/image.rs:4, 46, 66`) — see the story file's own AC4a table; line 4 (naming a deleted `bucket.rs`) was found independently this story, not previously recorded anywhere.
- **Consequence for tests:** all 27 existing tests name a `bucket_*`/`bucket-*` identifier — expected, not scope creep, per the same rule 8.7/8.8 stated.

### 4.2 AC4b — the registry's provisional `name`

**Decided: `"Images"`**, not `"Image"`. Paige's reasoning, unopposed across two rounds: `"PDF"` earned its kept name by already reading as a proper noun; `"Image"` reads like an unfinished placeholder, while `"Images"` matches the epic/story title and reads as a name rather than a category label.

## 5. Every known gap — explicit calls

Resolving the story's Dev Notes gap list against established Epic 8 precedent (not re-litigated with the developer where the pattern is already settled project-wide):

1. **No drag-and-drop** — resolved, §3.
2. **No success confirmation after Convert** — folds in, matching PDF's own in-flight-announcer fix (8.8): an `role="status"` announcement on completion, not just disabled buttons.
3. **In-flight state only for estimate, not Convert** — same fix as #2; `EXPERIENCE.md:70`'s general Loading rule applies without exception.
4. **Zero design-token adoption** — full Epic-7 tokenization, standard for every Epic 8 redesign.
5. **Raw absolute path rendered in UI** — basename + `title` tooltip, the same fix Story 8.8 already applied for PDF (`CLAUDE.md` privacy rule).
6. **`bucket-image-*`/shared codes absent from `TRANSLATABLE_CODES`** — apply Story 8.6's own criterion per code (*"a fixed, value-free sentence we wrote ourselves"*), not a blanket add. Given gap #12 below, expect most Images errors to remain third-party-message wrappers exactly like 8.7's OCR voice-gap finding — audit at Task 2b, do not assume translatable-by-default.
7. **JPEG alpha-flatten background hardcoded** — resolved, §2.2/§2.3 (becomes user-configurable).
8. **HEIC descoped** — re-examined, §6.2.
9. **AD-16 two-runner split unexamined** — must be re-derived, §6.4.
10. **No runtime shape validation on `invoke<number>` results** — pre-existing project-wide convention, deferred again on the same grounds 8.7/8.8 used (fixing one tool creates inconsistency, not safety).
11. **TOCTOU between `check_file_size` and the later read** — pre-existing, identical in `pdf.rs`/`ocr.rs`/`base64.rs`, not this tool's bug. Listed so it is not re-discovered as novel.
12. **Single-file-at-a-time** — resolved, §2.2/§3 (the story's own biggest change).

## 6. The AD-1 split (AC6)

### 6.1 Core/command/view ownership under the new scope

- **Core (`image_convert.rs`):** gains a resize path (the `image` crate's own resize functions — no new dependency) and a background-color parameter replacing the hardcoded white in `flatten_onto_white` (renamed to reflect the parameter, exact shape a Task 2a decision). AVIF added to `TargetFormat` as an **encode target only** (`AvifEncoder::new_with_speed_quality`, quality-aware like JPEG — §1); accepting AVIF as a decode *source* is not in this story, since it needs the non-default `avif-native`/`dav1d` C dependency, not the free `avif`/`ravif` one. Stays filesystem-free (AD-2/AD-15) — a batch of N files is still N independent `convert` calls from the command layer's perspective, not a new core batching primitive.
- **Command layer (`commands/image.rs`):** unchanged responsibilities — `check_file_size` before read, `spawn_blocking`, `fs_helper` read/write — but now invoked per queue item, and the write side gains a destination-folder path instead of a single `output_path` (exact IPC shape a Task 2a decision).
- **View-owned (AD-1):** the queue/state model itself, `formatEstimatedSize` (unchanged), the before/after visual, and the color-picker UI.

### 6.2 HEIC — re-examined, not adopted

Live-rechecked this session, not assumed frozen at Story 6.2's 2026-08-10 finding (the project's own standing dependency-drift discipline). Result: **the landscape moved, but not far enough to act on yet.**

- All three of Story 6.2's original candidates (`libheif-rs`, `heic` by Imazen, `heic_decoder`/ente-io) remain blocked exactly as before.
- **A new candidate exists: `heic-rs`** (`tbraun96/heic-rs`), verified against the crates.io API directly rather than its README: `MIT OR Apache-2.0`, no C toolchain, no `libheif`, `#![forbid(unsafe_code)]`, MSRV 1.85 (comfortably under this project's 1.88 floor and CI's pinned 1.94.0), 9,588 lines of Rust, grid-tile decode support (the mechanism real iPhone photos above 512px need), CI on every push. Decode-only — exactly the shape Story 6.2 itself said would be acceptable if the landscape ever cleared (source-format only, never an export target).
- **Not adopted this story.** Published 2026-09-12 — two days before this session — v0.1.1, 50 total downloads, zero reverse dependencies, single maintainer. Clean on license and architecture; unproven on maturity, a risk axis nothing else in this project's dependency history has scored this low on. **Developer's explicit call: don't include it while the crate is two days old.**
- **Recorded so this isn't re-discovered from zero a third time:** a code comment in `image_convert.rs` should name `heic-rs` specifically (crate, version checked, date, reason held back) the same way the current comment names the three blocked candidates — a future story's re-check starts from "this one cleared licensing, check if it's matured" rather than repeating the whole crate search.

### 6.3 EXIF/GPS — a claim, not a mechanism

Per §1's finding: today's `convert()` already discards all EXIF/GPS metadata as a side effect of the `image` crate's decode/encode round-trip — verified against `image-0.25.9`'s vendored source, not assumed. This story's job is a regression test (source image carrying real EXIF/GPS bytes → converted output has none, across all three target formats) and a stated, honest UI claim — not new stripping logic.

### 6.4 AD-16 runner scoping — re-derive at Task 2a, not here

Today's two independent runners (`runImageEstimate`, `runImageConvert`) were already flagged by Story 8.7's own record as *unexamined, not endorsed*. The multi-file queue (§2.2) very likely invalidates the current split outright — "one runner per independent piece of state" under a queue model probably means per-item state plus one aggregate, not two flat runners — but the exact shape needs the queue's own design work, which is Task 2a's job, not this record's.

## 7. FR28 and upstream propagation (AC2)

**FR28 is revised, not merely accurate — same finding shape as Stories 8.6/8.7/8.8's own FR revisions.** Current text (`prd.md:92`, `epics.md:82`): *"Images: convert between common formats (PNG/JPEG/WebP/HEIC) and compress with a quality slider showing estimated output size."* This described a single-file, no-resize, no-drop tool with HEIC as an open question — none of which matches the scope this record settles on.

**Revised FR28 (propagated into `prd.md` and `epics.md` in this same story, per AC2 and the Story 8.6 lesson — do not defer this to a follow-up correct-course pass):**

> **FR28.** Images: drag-and-drop or pick one or more images, convert between PNG/JPEG/WebP/AVIF, resize, and compress with a quality slider showing a visual before/after — all locally, batch-capable. A user-chosen background color replaces JPEG's hardcoded white alpha-flatten. EXIF/GPS metadata does not survive conversion (verified, tested, and disclosed as a privacy property of the tool, not merely an accident of implementation). HEIC stays out of v1 — re-examined this story; a promising MIT/Apache-2.0 pure-Rust decoder now exists but is two days old as of this check and not yet adopted (see `8-9-images-decision-record.md §6.2`).

## 8. Cut ideas — issue drafts (AC3)

Route: GitHub `backlog-candidate` issues on `dipaneb/umbra`, all four, developer's explicit go-ahead. Filed this session — see the story file's Change Log for issue numbers/links.

**1. A dedicated vector/SVG optimization tool.**
Real Rust crates exist doing SVGO's actual job — `oxvg_optimiser`, `svgo-rs` — with no heavy new native dependency, unlike every raster-format story this epic has run. But SVG is a different asset class solving a different problem (markup/precision cleanup, not photographic compression), the same shape of distinction that split "Bucket" into OCR/PDF/Images rather than growing one tool wider (Story 8.7). Recommendation: a future, separate registry tool, not a tab on Images. Needs its own Task-1-style discovery — real optimization plugin selection (which SVGO passes to keep), the removed-vs-preserved precision trade-off, and whether preview-before-apply (this app's honesty bar, per AD-9) is needed given SVGO transforms can occasionally break rendering.

**2. Batch watermarking (text/logo, N images at once).**
A large, real, popular market category (BatchTool, PixelTools, BulkPicTools, among many) — but a materially bigger feature than "convert and compress": new compositing logic, font or logo asset handling, position/opacity controls, and its own preview model. Bigger than this story's remaining scope; a real future story in its own right, likely sharing the multi-file queue infrastructure this story builds.

**3. Favicon / app-icon kit generator.**
One source image → the full platform-specific icon set (ICO, Apple Touch, Android adaptive/maskable, PWA manifest, macOS `.iconset`) in one pass — well-precedented in the market ([appicon.ikit.app](https://appicon.ikit.app/), [RealFaviconGenerator](https://realfavicongenerator.net/)), and technically straightforward once this story's resize capability exists. A distinct feature (a fixed preset table + multi-file output, not a single conversion) rather than a natural default-scope extension.

**4. Whole-image deskew.**
Inherited, not new — Story 8.7's own decision record (`8-7-ocr-decision-record.md:147`, cut item #7) named this as belonging to the Images tool and it has sat unpicked for two stories. Surfaced explicitly per this story's own AC3 instruction rather than re-derived. A real image-processing feature (rotate to correct a skewed scan/photo) distinct from OCR's per-line orientation handling — its own crate/algorithm investigation, not a trivial follow-on.

## 9. Open items Task 2a owns

1. **The queue/state model itself** — per-item status shape, partial-failure UI, and the AD-16 re-derivation (§6.4).
2. **The destination-folder write mechanism** — replacing per-file `save()` with a folder picker plus a naming scheme (same open shape PDF's own "split into N files" cut idea named and left unresolved).
3. **RESOLVED (Task 2a, design canvas + developer sign-off):** background-color picker = **Option A**, a plain native `<input type="color">`, white by default.
4. **RESOLVED (Task 2a, design canvas + developer sign-off):** before/after visual = **Option B**, a slider/wipe comparison — the app's first drag-to-compare interaction primitive, so it ships with a keyboard-operable equivalent and the byte-count/percentage figures always visible without opening it (AC27/AC27a).
5. **RESOLVED (Task 2a, design canvas + developer sign-off):** `image_convert.rs`'s resize API = **Option B**, explicit `(width, height)` pixel dimensions with a view-side aspect-lock (locked = no-upscale, unlocked = honors the exact typed values including upscale) — one setting for the whole queue, no per-item override (AC20-22).
6. **The `heic-rs` re-check comment's exact wording and location** (§6.2), so a future story's re-check is a targeted lookup, not a fresh crate search.
7. **The normative *Authorised file surface* table**, built from a real repo-wide grep sweep (8.7's own lesson — its equivalent list was found incomplete twice). Must at minimum name: `DropZone.vue`/`dropZone.ts` + spec, `registry.ts` + spec, `toolError.ts` + spec, both locale JSONs, `lib.rs`, and any docs referencing the Images tool's current behavior.

## 10. Developer sign-off

Granted 2026-09-14, item by item across the session:

- §1's research redirect and the persona/market findings (with the mobile/desktop/gaming miss corrected mid-session, §0).
- §2's Kept/Changed/Added/Cut/Dropped shape in full.
- §3 — drag-and-drop, multi-file, adopted.
- §4's inherited obligations and the `"Images"` name.
- §6.2 — HEIC re-examined, real candidate found, **not adopted** given the crate's two-day age.
- §6.3's JPEG-background color-selector addition, with the developer's own stated reason on record.
- §7's FR28 revision, propagated in this story.
- §8's four cut ideas, routed to GitHub issues.

Task 2a (real Given/When/Then ACs) is next, same session per this epic's established pattern.
