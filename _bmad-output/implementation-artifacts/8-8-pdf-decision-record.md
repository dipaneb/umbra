# Story 8.8 — PDF tool: scope decision record

**Status:** Task 1 complete. **Signed off 2026-09-10**, then **partially reopened and amended the same day** — see §1.2's amendment box and §1.5: the developer challenged the text-only page list and the rasterizer decision was reversed. Upstream propagation applied; cut ideas filed as #141-#148 (#141 since narrowed).
**Date:** 2026-09-10
**Baseline:** `ef25dbe` (Story 8.7, PR #136).
**Method:** `bmad-party-mode`, `session` mode, party memory on, resuming the 8.1–8.7 Epic 8 history (developer's choice, AC1).
**Cut-idea capture route:** GitHub `backlog-candidate` issues on `dipaneb/umbra` (developer's choice, AC3) — the 8.5/8.6/8.7 convention, not the 8.3/8.4 personal-backlog route.

---

## 0. The premise the session almost skipped

The room opened on the inherited obligations — a rename, five error codes, a shared-code trap, a translatable-codes pass, a drop re-decision, a tokenisation pass, a dependency bump. Seven structural items before a word about what the tool should **do**. That is Story 8.7's failure mode exactly, where the developer refused sign-off three times because the session did the debt and skipped the feature.

The developer stopped it with the question nobody in the room had asked: **why does this tool have these three actions?**

**Answer, traced: there is no decision behind them.** `epics.md:216` describes Epic 6 in one line — *"The Bucket becomes a real file workbench: PDF merge/split/extract-text…"*. FR27 restates it as three verbs. Story 6.1 built exactly that. FR28 (Images) has a recorded scope update from Story 6.2; **FR27 has never been touched since the 2026-07-19 planning sweep.**

So the three actions are not a decomposition anyone chose. They are a sentence written before the "Bucket" grouping was even understood to be a scaffolding mistake. **Nothing is being preserved by keeping them**, which is what made the container question genuinely open rather than a reskin argument.

This record therefore leads with scope, and puts the obligations after it.

---

## 1. Container decision (AC1)

### 1.1 The comparator finding that inverted the obvious worry

The developer's concern was scalability: *"is it scalable to having 15 actions in one surface? Websites like iLovePDF go for one action by one action."*

They remembered correctly, and **the reason inverts the conclusion.** iLovePDF and Smallpdf are action-first because they are **server-based**: every action is upload → process → download. iLovePDF's own headline feature is now **"Workflows"** — chain up to four tools *specifically so you stop uploading and downloading between steps*.

Action-first is therefore a consequence of the upload constraint, and their premium feature exists to undo it. **Umbra has no upload.** Adopting that shape means importing a constraint we do not have, then reinventing Workflows to escape it.

Stirling-PDF — the closest scope analogue, self-hosted, same privacy pitch — describes its own surface as *"upload your PDFs once, then rotate, reorder, delete, and split pages in a single workspace without re-uploading between steps."* PDF Arranger's flagship is a page grid you drag. Every named comparator that is **not** constrained by upload is document-first.

### 1.2 The discriminator that answers "how many tools"

The question *"does PDF need many tools?"* has a clean structural answer, and it is not a taste call. **Does the action need to see the page as pixels?**

Every row below verified against vendored `lopdf` source (0.44.0 at baseline, re-confirmed in 0.45.0):

| Available today, zero new dependencies | Requires a rasterizer (= issue [#132](https://github.com/dipaneb/umbra/issues/132)) |
| --- | --- |
| Merge, extract page range, extract text (shipped) | Page **thumbnails** |
| **Page count** — `get_pages().len()` | **Signature** placement |
| **Per-page text** — `extract_text_chunks(&[u32]) -> Vec<Result<String>>` | **Redaction** (must render to verify) |
| **Delete pages** — `delete_pages(&[u32])` | Form filling, annotation |
| **Rotate** — `/Rotate` is an integer in the page dictionary | **Crop** |
| **Reorder** — rewrite the `/Kids` array | PDF → image export |
| Split into N files | Compress / optimise (image recompression) |
| **Extract embedded images** — `get_page_images()` → `PdfImage.content: &[u8]` | |
| Metadata view/strip (`trailer` → `/Info`), bookmarks (`get_toc()`) | |

**`lopdf` does not rasterize.** Confirmed directly: `xobject.rs`'s `image()` / `image_from()` run the *opposite* direction — they embed an image file **into** a PDF as a Stream. There is no page-to-pixels function in the crate.

So the right-hand column is **one dependency decision**, and it is already made: `pdfium-render` binds `libpdfium` at runtime → four platform binaries, roughly doubles the bundle, second native C++ dependency in a project that was *blocked* (not slowed) by `clipper2c-sys` in Story 4.1. That is #132's cost sheet verbatim. **Page thumbnails are #132's dependency wearing a different hat** — tier 3 rasterizes to OCR, thumbnails rasterize to look. One `libpdfium`, two justifications.

> ### ⚠️ AMENDED 2026-09-10, after the developer challenged this section
>
> **The developer rejected the conclusion below, and they were right.** Their objection: *"how can someone select some pages to extract if they don't even remember what each title page matches with each page?"*
>
> **What held:** `lopdf` cannot rasterize. That is verified fact.
>
> **What did not:** the justification built on top of it. This record argued that a 90px thumbnail of body text is an unreadable grey smear, so text labels are the *higher-fidelity* signal. That is true and irrelevant — **thumbnails are not for reading, they are for recognition.** You pattern-match *"the page with the table"*, *"the signature page"*, *"where the section breaks"*. A text label cannot do that. The argument conflated *can you read it* with *is it useful*.
>
> The second flaw: the text list is **sparse**. Page 1 of a contract yields "MASTER SERVICES AGREEMENT"; pages 2–6 yield the middle of a sentence. Heading-bearing pages are a minority, and selection is exactly the flow that needs the others.
>
> Named plainly, because it is the failure mode this project watches for: **a dependency constraint drove a product decision, and the justification was constructed afterwards.** Same move Mary and Winston called out in Story 8.7.
>
> **DECISION REVERSED (developer's call): the rasterizer is taken into Story 8.8.** See §1.5. The two-tool split below still stands for *signature / redaction / annotation / crop* — but page previews move into this story, because they serve the tool's primary job rather than an adjacent one.

**Consequence:** PDF eventually needs **two** tools, and the boundary between them is a dependency, not a whim.

- **Tool 1 — this story.** The structural workbench. Everything in the left column.
- **Tool 2 — future, gated on #132.** The visual PDF tool: signature, redaction, annotation, crop. The developer's signature intuition was right, and it is right for a structural reason — *"it needs its own tool because it's a totally different interface"* is exactly correct, and the interface differs because one side has pixels and the other does not.

### 1.3 The "15 actions" worry, dissolved

The structural set is not fifteen independent verbs. Four of them are **the same gesture**:

> select pages → **delete** / **rotate** / **extract to a new file** / **reorder**

That is one surface with a selection model, not four tools. What remains is **merge** (different input cardinality — many documents in, one out) and the **read-only** operations (text, metadata). Three groupings, not fifteen buttons.

This is also why the shape grows well: adding a verb to a selection model is a verb. Adding a verb to a verb-list IA is a whole new screen — the thing that makes iLovePDF need Workflows.

### 1.4 DECIDED — container

**One `pdf` registry tool. An open-once document surface with a page list and a selection model.** Open (or drop) a PDF once; see its pages; select some; act on them. Merge and extract-text live on the same surface as document-scoped operations.

**[SUPERSEDED 2026-09-10 — see §1.5. The paragraph below is kept as the record of what was decided and why it was reversed.]** ~~**The page list is text-derived, not a preview**~~ — and this record states that plainly rather than letting "page grid" imply thumbnails. Each row is a page number plus its first line of real text, from `extract_text_chunks`. For a text document this is the *higher-fidelity* signal: a 90px-wide thumbnail of dense body text is an unreadable grey smear, whereas *"Page 7 — Schedule B — Fees"* is the thing you were actually looking for.

**Honest degradation, and it is load-bearing:** a scanned PDF has no text layer, so every row returns empty and the list degrades to "Page 1, Page 2, Page 3…". **That degradation is itself the scan diagnosis** — the same call answers *"what is on page 7"*, *"how many pages"*, and *"is this document a scan"*. AC4b hands us tier 2 as a message rewrite; it is not a message rewrite, it is a capability we are building anyway, and the honest sentence falls out of it.

**DEFERRED, deliberately (developer's call): whether the structural work later splits into several sidebar tools.** Build the selection surface, ship it, use it, and revisit the IA with evidence. Recorded as an open question rather than settled, because the arguments are genuinely balanced:

- *For staying one tool:* the sidebar holds 8 entries; five PDF entries would make one file type ~40% of the app's navigation. And moving between separate entries means re-picking the same file — the iLovePDF problem without the iLovePDF excuse.
- *For splitting later:* Story 8.7's precedent is real, and ⌘K aliases make any verb findable regardless of how entries are grouped (aliases are free — `merge`, `split`, `rotate`, `delete`, `fusionner`, `diviser`, `pivoter`, `supprimer`).
- *What would decide it:* whether the selection surface still reads as one job once it carries five or six verbs. That is a render-review observation, not an argument.

---

## 1.5 Page previews — the rasterizer, taken into this story (AMENDED 2026-09-10)

**Developer's decision, after challenging §1.2:** add `pdfium-render` and ship **real page previews** as the selection surface.

### What was verified this session, against the crate rather than #132's prose

| Fact | Value |
| --- | --- |
| Crate / version | `pdfium-render` **0.9.4**, published 2026-09-06 |
| Licence | **MIT OR Apache-2.0** — permissive, compatible with an All-Rights-Reserved app |
| MSRV | **1.61** — far below this project's 1.88 floor; CI runs 1.94.0. **Not toolchain-blocked.** |
| Downloads | ~2.29 M — well established, not a fringe crate |
| Linking model | Binds to Pdfium **at runtime** via `libloading` (`dlopen`), default path |
| Default features | `["pdfium_latest", "image_latest", "thread_safe"]` |
| `build.rs` | **A no-op on the default path.** Its `main()` is two `#[cfg]`-gated calls — `bindings` (bindgen) and `static` — and **neither feature is default**. Pre-generated bindings ship in `src/bindgen/*.rs`. |
| Image interop | `image_025` feature — and this repo already depends on `image` **0.25.9** in both crates. Rendered pages arrive as `image::DynamicImage` the codebase already handles. |
| Binary source | `bblanchon/pdfium-binaries` GitHub releases |

### The cost sheet, corrected

**#132's heaviest argument does not apply, and this record repeated it uncritically before checking.**

That argument was: *"a second native C++ dependency, and this project has a scar there — Story 4.1 was blocked, not slowed, by `clipper2c-sys` failing against a broken C++ standard library in the Xcode Command Line Tools."*

**`pdfium-render` compiles no C++.** On the default path `build.rs` does nothing; the crate is pure Rust and `dlopen`s a prebuilt library at runtime. `clipper2c-sys` was a build-time C++ **compilation** failure. There is no equivalent exposure here. The `static` feature would reintroduce it — **so the static feature is not used.**

**Costs that remain real:**

1. **Bundle size.** `libpdfium` ships alongside the executable, per platform. Today's payload is ~6.2 MB of ONNX models plus the app; this roughly doubles it, and every user pays it on download. **This is the whole cost now, and it is a product decision about *"small, offline, yours"*, not a technical one.**
2. **Four platform binaries** — macOS arm64, macOS x64, Windows, Linux — to source, verify, bundle and keep current.

**Two costs #132 never named, found this session:**

3. **Binary provenance.** The prebuilt libraries come from **`bblanchon/pdfium-binaries`, a community project**, not from Google. Pdfium itself is Google's (BSD-3-Clause, cleared in #132); the *build* we would ship is a third party's. That is a supply-chain link the AD-7 audit and the release checklist must both name, and a checksum-pinned fetch is the minimum bar.
4. **ABI version coupling.** The `pdfium_7881` feature pins the crate to Pdfium release **7881**; the shipped binary must match the feature. Bumping either without the other is a runtime failure, not a compile error — so the pair is pinned and re-verified together, like any other drift-rule dependency.

**And a consequence of runtime binding:** a missing or mismatched library fails **at runtime**. NFR4 (*never a crash, never a silently-wrong result*) requires an honest path for that — the tool degrades to the text-derived list and says why, rather than crashing or rendering blank frames.

### What this changes in the design

- **The page list gains a real thumbnail per row**, alongside the page number. The text-derived label is **kept** — it is genuinely additive (a heading you can read beats a picture of a heading), and it is the fallback when rendering is unavailable per the point above.
- **The `Scanned` classification survives and still matters** — it is what makes `noTextInPdf` honest (§4.2). Previews do not replace it; a scan now *shows* as a scan and *says* so.
- **AD-8's revisit gate has fired.** §6.3 recorded *no port, revisit if a second PDF engine ever arrives.* It has arrived. See §6.4.

### Cut #1 / issue [#141](https://github.com/dipaneb/umbra/issues/141) is narrowed, not closed

Page previews and PDF→image export leave #141 and land in this story. **Signature, redaction, annotation and crop stay cut** — they need the rasterizer *plus* a point-at-the-page editing surface, which is still a genuinely different tool. #141 is updated to say so, and **issue [#132](https://github.com/dipaneb/umbra/issues/132) is no longer dependency-blocked** — its remaining cost is the OCR pipeline work, not the rasterizer.

---

## 1.6 AD-1 / AD-2: where rendering lives (AMENDED 2026-09-10)

**`crates/umbra-core` cannot own rendering.** AD-2 forbids core touching the filesystem, and `dlopen`ing `libpdfium` from a path is exactly that. So:

- **`src-tauri` owns the `Pdfium` handle**, loaded **once**, lazily, off the launch path (AD-4 — NFR2's 2 s cold launch is not negotiable, and this is a native library load).
- **`umbra-core/src/pdf.rs` stays pure** and keeps every structural operation. It does **not** gain a rasterize function.
- **Thumbnails cross IPC as images, not as page objects.** They are small (a ~120px-wide preview), so unlike a merged PDF they fit the JSON bridge — but the **volume** is the concern for a 400-page document, so they are requested per visible range, not all at once (§1.4's fetch policy, now covering pixels as well as text).

### 1.6.1 The AD-8 port question, reopened because its gate fired

§6.3 declined an AD-8-style port for PDF on the stated grounds that *"nothing has ever proposed swapping the PDF engine"*, with an explicit revisit gate: *"if the visual PDF tool is ever built, it introduces a genuine second PDF engine, and that is when the seam becomes real."*

**Two engines now ship in the same story** — `lopdf` for structure, Pdfium for pixels. The seam is real, but it is **not the seam AD-8 describes**: AD-8 abstracts *one* capability behind a swappable port. Here the two engines do **different jobs** and neither substitutes for the other.

**Decision: still no port, but the reason is now different and must be recorded as such** — it is a division of labour, not an abstraction boundary. What *is* owed is that the split is explicit in code: structure operations never reach for Pdfium, and rendering never reaches for `lopdf`. **Revisit gate, replacing the fired one:** if a second *rasterizer* is ever proposed, or if structural operations start needing Pdfium, the port becomes real.

---

## 2. Kept / Changed / Added / Cut

### 2.1 Kept — and why, so the redesign does not re-derive them

| Kept | Why |
| --- | --- |
| `merge_documents`'s algorithm — renumber into disjoint ranges, then reconcile one Catalog/Pages graph; `BTreeMap` keyed by `ObjectId` so ascending key order preserves input order with no separate index | Correct, tested end-to-end by *position within extracted text* rather than "it parsed". Nothing in the redesign touches how merging works, only how it is driven. |
| `extract_page_range`'s **validation in core** | Authoritative there **because** `lopdf`'s `delete_pages` silently no-ops out of range rather than erroring. Re-verified against vendored 0.45.0 source — the no-op semantics are unchanged, so the reason still holds. |
| `extract_text`'s bomb-safe `extract_text_with_limit`, and `Ok("")` for an empty document | Mirrors `ocr.rs`'s "empty text is a legitimate outcome" precedent. The empty-vs-scan distinction is now *added on top* (§4.2), not substituted for. |
| `load_document`'s encryption rejection — `is_encrypted() && encryption_state.is_none()` | Semantics were confirmed against vendored source in Story 6.1, not the README, and re-confirmed in 0.45.0. Do not re-derive. |
| `MAX_INPUT_BYTES = 100 MB` per-file, **no combined-total cap across merge inputs** | A documented, deliberate match to every other multi-file command in the app. Unchanged. |
| `check_file_size()` before the read, file-local rather than shared | This codebase deliberately does not share that helper across command files. Not a DRY violation to fix. |
| `spawn_blocking` (AD-4) and the `output_path`-not-bytes IPC shape (AD-15) | A merged PDF blows the ~64 KB JSON-IPC ceiling. The `extract_text` string return stays the explicitly reasoned exception. |
| `pdfFilters()` as a **function, not a const** | The OS file dialog must show the *current* locale's label; a const captured at component-creation time goes stale if the user switches language without navigating away. Read the in-file comment before touching it. |
| The file picker as an entry path | Drop is **added**, never substituted. Keyboard-only users need the picker (NFR5). |
| Registry `name: "PDF"` | Story 8.7 marked it *provisional — 8.8 renames*. **Explicit call: leave it.** "PDF" is a proper noun that already carries the two-word register's spirit; renaming it to "PDF Tools" or similar adds a word without adding meaning. Recorded as a decision, not an omission. |

### 2.2 Changed

| Changed | From → To | Why |
| --- | --- | --- |
| **Container** | Three stacked `.pdf-flow` blocks in one scroll, each with its own "Choose PDF" button | One open-once document surface with a page list + selection (§1.4) |
| **Page range input** | Typed `startPage` / `endPage` number inputs | Page **selection** on the list. The typed-range flow could not know the page count, so `end > totalPages` round-tripped to Rust to fail. Selection makes that state unreachable. |
| **Commands** | `bucket_merge_pdfs`, `bucket_extract_pdf_pages`, `bucket_extract_pdf_text` | `pdf_merge`, `pdf_extract_pages`, `pdf_extract_text` (+ new verbs). AD-3 requires `<tool>_<verb>` and there is no tool called bucket — 8.7 deleted the registry entry. Assigned, not optional. |
| **Error codes** | `bucket-pdf-*` | `pdf-*` (see §4.1 for the shared-code trap) |
| **`noTextInPdf`** | *"No text was found in this PDF."* | An honest scan message (§4.2) |
| **Path rendering** | Raw absolute filesystem paths in `<li>` and `<p>` | **Basename, with the full path in a `title`** (§5, gap #6) |
| **Buttons** | Zero `AppButton`; every control a plain `<button>` | `AppButton`, with **Merge as the `primary` variant** — `DESIGN.md:183` uses *"Merge PDFs"* as its own worked example of the Primary/Signature button, and this view has never had one. Remove-from-queue uses **Default (black)**, per `DESIGN.md:149`, explicitly **not** destructive red. |
| **Copy affordance** | Static `common.copy` label, no confirmation | `useCopyFeedback` — an import now, not an infrastructure decision; 8.7 hoisted it to `src/shell/`. PDF becomes the 9th consumer. |
| **Styling** | Hardcoded `#b00020`, `#ccc`, `border-radius: 6px`, `font-family: monospace`, `em` spacing — 100% pre-Epic-7 | `tokens.css` variables throughout |
| **Heading hierarchy** | `<h1>` followed directly by three `<h3>`s — **a skipped rank** | Proper hierarchy. *Found during this session's drift check, not previously recorded.* 8.7 promoted the section's `<h2>` to this routed view's `<h1>` and left the inner `<h3>`s, so the document outline has gone `h1 → h3` since the move. An NFR5 defect, and a direct artifact of the verbatim-move decision. |
| **Error state** | One shared `pdfError` ref for all three flows | Errors placed with the operation that raised them. Today an error raised by merge is silently cleared by an unrelated click in extract-text. |
| **AD-16 runner scoping** | One local `runPdf` across three disjoint state groups, justified by an **in-file comment that is now stale** — it reasons against `registry.getLatestWinsRunner("bucket")` and "an in-flight OCR extraction", neither of which exists after 8.7 | **Re-derive from AD-16's rule** (*one runner per independent piece of state*) under the new container. The decision may well survive; the rationale is dead and must be rewritten either way. Third instance of the "rationale died, decision survived" pattern in this story. |
| **`lopdf`** | 0.44.0 | **0.45.0** (§6, with full verification trail) |
| **Success feedback** | Merge and extract-pages write a file and then say *nothing at all* | Explicit confirmation (§5, gap #2) |
| **In-flight state** | A disabled button and nothing else | Rendered in-flight state + an announced status (§5, gap #3) |

### 2.3 Added

| Added | Cost | Note |
| --- | --- | --- |
| **Real page previews (thumbnails)** | `pdfium-render` 0.9.4 — a NEW dependency, see §1.5 | **The selection surface.** Added 2026-09-10 after the developer rejected the text-only list: thumbnails serve *recognition*, which a text label cannot. Runtime-bound, compiles no C++. |
| **Page list with per-page text labels** | `extract_text_chunks` — existing crate, existing pin | The new primitive. Needs a bound: it is a decompress-and-parse per page, so a 400-page document is real work on `spawn_blocking`. Lazy per-visible-row is the expected shape. |
| **Page count** | `get_pages().len()` — one method call | Kills gap #7 outright and makes most of `pdf-invalid-range` unreachable (it becomes an input `max`). The single cheapest missing piece of information in the tool, one call away since Story 6.1 shipped. |
| **Delete pages** | `delete_pages(&[u32])` already exists in the crate | The inverse of extract-range; same core call. |
| **Rotate pages** | Set `/Rotate` (an integer) in the page dictionary via `get_dictionary_mut` | Purely structural — no rendering involved. |
| **Reorder pages** | Rewrite the `/Kids` array | The merge list's existing up/down semantics, applied to pages. |
| **Multi-file drag-and-drop** | Additive shell change (§3) | Developer: *"Definitely multi-file drop. For example the merge action would need several files."* |
| **Carry-the-file-across from Image to Text** | Small, once drop exists | The **third** inherited hand-off (§4.3) |
| **Scan detection** | Falls out of per-page text | Feeds §4.2's honest message |
| **`pdf-encrypted` → `TRANSLATABLE_CODES`; `pdf-too-few-files` / `pdf-invalid-range` rewritten to carry values as params** | Small | §5, gap #8 |

### 2.4 Cut → GitHub `backlog-candidate` issues (AC3)

Full max-context bodies in §8. Each links back to this record.

| # | Cut | One-line reason |
| --- | --- | --- |
| 1 | [**#141**](https://github.com/dipaneb/umbra/issues/141) — **The visual PDF tool** — ~~thumbnails~~, signature, redaction, annotation, crop, ~~PDF→image~~ | **NARROWED 2026-09-10 (§1.5).** Page previews and PDF→image **move into this story** with the rasterizer. Signature/redaction/annotation/crop stay cut — they need the rasterizer **plus** a point-at-the-page editing surface, which is still a different tool. #132 is no longer dependency-blocked. |
| 2 | [**#142**](https://github.com/dipaneb/umbra/issues/142) — Split into N files | Real, cheap, but a different output cardinality (many files out) that the save-dialog flow does not currently express. |
| 3 | [**#143**](https://github.com/dipaneb/umbra/issues/143) — Extract embedded images | Genuinely available (`PdfImage.content`), and interesting because it *feeds the Images tool* — which raises an AD-6 cross-tool question this story should not answer unilaterally. |
| 4 | [**#144**](https://github.com/dipaneb/umbra/issues/144) — Metadata view / strip | A privacy angle this app has a natural claim to, and the strongest candidate to promote next. |
| 5 | [**#145**](https://github.com/dipaneb/umbra/issues/145) — Compress / optimise | Needs image recompression, i.e. decoding embedded streams — closer to the rasterizer side than it looks. |
| 6 | [**#146**](https://github.com/dipaneb/umbra/issues/146) — **Batch processing** — drop N files, apply one action to all | Developer's own idea. `EXPERIENCE.md:178` already parks it with an unresolved serial-vs-bounded-worker-pool concurrency question. |
| 7 | [**#147**](https://github.com/dipaneb/umbra/issues/147) — Merge fidelity — `AcroForm`, `StructTreeRoot`, `ViewerPreferences`, `/Info`, inherited page attributes | Gap #13. A known, *accepted* v1 limitation from Story 6.1, not a fresh finding — but the fidelity bar rises once pages can be rotated and reordered. |
| 8 | [**#148**](https://github.com/dipaneb/umbra/issues/148) — Hoist `.sr-only` to `base.css` | Copy-pasted in **five** tool views today; PDF's announcer makes it six. Exactly where `useCopyFeedback` sat before 8.7 hoisted it. |

---

## 3. Drag-and-drop — the re-decision (AC5)

**This is a re-decision with a documented prior, not the discovery of an oversight.** Story 6.1 declined the AD-14 dispatcher deliberately, wrote down three reasons, and flagged its own ACs so it could not read as a silent reinterpretation. That is the good version of this project's process and this record says so explicitly.

**Where its three reasons stand today:**

1. *"`DropZone.vue`'s handler only ever forwards `routing.paths![0]` — the dispatcher discards everything past index 0."* — **STILL TRUE.** Verified at `DropZone.vue:141`.
2. *"A tool's registry entry declares exactly one fixed drop-handler command name — there's no way for 'drop a PDF' and 'drop an image' while the Bucket is active to route to two different commands."* — **DEAD.** Story 8.7 deleted the `bucket` entry. A `pdf` entry declares one handler that only ever receives PDFs. There is no routing ambiguity left to avoid.
3. *"Split/extract needs a page-range parameter supplied as a distinct step, not inferred from a bare drop event."* — **STILL TRUE, but already solved.** `registry.dropArgsProviders` has existed since Story 2.2 and lets a view supply extra arguments at drop time.

**And 6.1's fallback position has been removed underneath it.** It reasoned that a PDF dropped on the Bucket *"will honestly fail with `bucket-unsupported-format`"* — an acceptable NFR4 outcome. Story 8.7 replaced that with *"PDFs open in the PDF tool."* The app now **actively redirects a drop gesture to a tool that cannot receive one**: a signpost pointing at a door with no handle.

### 3.1 DECIDED — multi-file drop, via an additive registry flag

Developer's call: *"Definitely multi-file drop… the merge action would need several files so obviously."*

**Shape: `drop: { multiple: true }` on the `pdf` entry only.** The dispatcher branches — a tool declaring `multiple` receives `paths`; a tool that does not receives `path`, byte-for-byte as today. Base64, Hash and Image to Text are untouched.

**Story 6.1 named this exact shape itself, while rejecting it** — *"a new `multi: boolean` registry field, changing the dispatcher to forward all paths"* — and its objection was **"out of proportion to what this one story needs."** That is a *scope* objection, not a technical one, and 6.1 was a build-the-feature story. This is the redesign story. The proportion argument reads differently here, and this record says that rather than pretending new physics were found.

### 3.2 The shell cost, stated wider than the story file states it

Story 8.8's Project Structure Notes name the multi-file blast radius as `DropZone.vue`, `dropZone.ts` and its spec. **That is incomplete, and the AC set must not inherit the understatement.**

The shell also **publishes** what it dropped, and that shape is singular:

- `registry.ts:262` — `dropSourcePath = ref<{ toolId: string; path: string } | null>(null)`, with **two live consumers**: `HashView.vue:502` and `OcrView.vue:360`.
- `DropZone.vue:163` — `invoke(activeTool!.drop!.handler, { path, ...extraArgs })`. Every drop-declaring tool's command signature is written against `path`.

Widening either unconditionally reaches `registry.ts` plus two sibling tool islands plus their specs. **The additive branch is what keeps it bounded** — and that is precisely why the flag is the chosen shape rather than a straight widening.

**AD-6 note:** this is a shell change in a story whose island is otherwise narrow. It must be named in Task 2a's *Authorised file surface* table, not absorbed — the same class of boundary stretch 8.7 had to make explicit.

### 3.3 `EXPERIENCE.md:82` — resolved by adoption

The line reads: *"Bucket (OCR) and **PDF** tools accept drag-and-drop of files/screenshots as an alternative to a file picker."* Written 2026-08-15 — **five days after Story 6.1 shipped its picker-only decision**, so the UX spec was authored against an intent the code had already declined, and has been quietly false since.

**Adopting drop makes it true.** The word "Bucket" still needs correcting to "Image to Text" (8.7's rename), which is a separate, small edit owed here.

---

## 4. Inherited obligations (AC4)

### 4.1 AC4a — the `bucket_*` → `pdf_*` rename, and the shared-code trap

**Commands (3):** `bucket_merge_pdfs` → `pdf_merge`, `bucket_extract_pdf_pages` → `pdf_extract_pages`, `bucket_extract_pdf_text` → `pdf_extract_text`. Touches `src-tauri/src/lib.rs:21` (the `use` line) and `:70–72` (`generate_handler!`).

**Error codes.** PDF raises **six** codes, not five — the story's AC4a says "five" and then enumerates four plus two shared, which is six. Verified independently this session:

- PDF-only, renamed: `bucket-pdf-corrupt` → `pdf-corrupt`, `bucket-pdf-encrypted` → `pdf-encrypted`, `bucket-pdf-invalid-range` → `pdf-invalid-range`, `bucket-pdf-too-few-files` → `pdf-too-few-files`.
- **Shared with the Images tool:** `bucket-input-too-large` and `bucket-internal` are raised by **both** `commands/pdf.rs` and `commands/image.rs`. Re-verified by grep across both modules this session.

**DECIDED (developer's call): duplicate, do not migrate.** PDF mints `pdf-input-too-large` and `pdf-internal` at its own call sites. The `bucket-*` pair stays live for the Images tool, and **Story 8.9 owns retiring it.**

**Rationale:** this is exactly 8.7's own precedent — it minted `ocr-internal` / `ocr-input-too-large` rather than renaming across two tools mid-move, and accepted the duplication on the record. Migrating instead would mean editing `commands/image.rs`, explicitly **not** 8.8's, in a story whose island is deliberately narrow.

**Recorded as a decision *for* 8.9, per AC4a's requirement:** the `bucket-` prefix outlives this story **on purpose**, in exactly two codes, in exactly one module. 8.9 inherits a decision, not an ambiguity.

**Consequence for tests:** all 35 existing tests name a `bucket_*` command or a `bucket-pdf-*` code, so the rename touches every one. `PdfView.spec.ts`'s 13 tests were byte-identical to the former `BucketView.spec.ts` — after this story they stop being a move-gate artifact. Expected and fine; stated so it is not mistaken for scope creep at review.

### 4.2 AC4b — PDF tier 2: make the scan case honest

**Inherited in writing from `8-7-ocr-decision-record.md`.** Today's `noTextInPdf` reads *"No text was found in this PDF."* For a scanned page that is **true and useless** — the text is visibly right there as pixels, and the sentence invites the user to conclude the tool is broken.

**DECIDED: adopt the proposed replacement, and build it from the capability rather than as a string swap.**

The proposed sentence is on 8.7's record: *"This PDF is a scan — its pages are images, so there's no text layer to read."*

**The mechanism is already being built for §1.4.** `extract_text_chunks` returns per-page results; a document where every page yields empty text but the document has pages is a scan. A document with zero pages is empty. That is the distinction 8.7 said `lopdf` could make, and it is the same call that populates the page list.

Three outcomes, three sentences — the tool distinguishes them rather than collapsing them:

| Condition | Meaning |
| --- | --- |
| Pages exist, **no page** yields text | A scan — pages are images, no text layer |
| Pages exist, **some** yield text | Normal partial result; show what was found |
| **No pages** | A genuinely empty document |

**Tier 3 (rasterize + OCR) stays cut.** #132's cost sheet was read in full before this session formed a view, per AC4b's instruction. The sequencing argument that decided it still stands and is not reopened: *ship tier 2's honest message, see how often it fires in real use, then decide whether to spend a doubled bundle and a second native C++ dependency.* This story's page list makes that observation easier, not harder — a scan is now visible as a document whose rows are all blank.

### 4.3 AC4c — the third hand-off, **which the story file's AC4 does not list**

**This record adds an obligation the story's AC set missed.** Verified against source, not the party memlog:

`8-7-reimagine-the-bucket-ocr.md:119` (AC25, shipped text):

> *"It is a sentence, not a routing offer — developer's call, 2026-09-07, and the reason is theirs: a button would be a good idea, but it cannot route to somewhere that is not built yet. … **Carrying the file across is the version worth building, and it is handed to Story 8.8**, which will know what the PDF tool's entry state looks like after its own redesign."*

Story 8.8's AC4 lists 4a and 4b. There is no 4c. **This is precisely the failure mode AC4 was written to prevent** — its own preamble says the hand-offs *"are not discovery inputs to be weighed for relevance; they are inherited obligations."* One of them was weighed for relevance by being left out.

**DECIDED: fold in.** A PDF dropped on Image to Text should offer to open it **in the PDF tool with that file already loaded** — not a bare `router.push` that lands the user on an empty view to re-pick the file they just dropped.

The developer's own 2026-09-07 reason for deferring it was that *the destination's entry state does not exist yet*. **After this story it does** — §1.4 gives the PDF tool a defined open-with-a-document state, which is exactly the precondition their reason named.

**Cost:** small once §3's drop work exists — the hand-off needs a path to survive a route change, which is the same publish-before-invoke shape `dropSourcePath` already uses. **AD-6 caveat:** this is a cross-tool hand-off between two islands and must be named in Task 2a's file-surface table, with the mechanism living in the shell rather than either tool reading the other's state.

---

## 5. Every known gap — explicit calls (AC1)

| # | Gap | Call |
| --- | --- | --- |
| 1 | No drag-and-drop; `EXPERIENCE.md:82` says otherwise | **Fold in** — multi-file drop adopted (§3); the spec line becomes true, with "Bucket" → "Image to Text" corrected |
| 2 | No success confirmation after any completed operation (`deferred-work.md:154`, open since 6.2's review) | **Fold in.** Merge and extract-pages write a file and say nothing; the user's only evidence is opening Finder. Assigned to 8.8 by name in `deferred-work.md`. |
| 3 | No in-flight state beyond a disabled button | **Fold in.** `EXPERIENCE.md:70` is a **general rule**, not an OCR exception: start and completion announced to assistive tech, never a blank pane. Merging or text-extracting a large PDF is an unbounded `spawn_blocking` job. Needs a live region — see cut #8 on `.sr-only`. |
| 4 | No `useCopyFeedback` | **Fold in.** An import since 8.7's hoist; PDF becomes the 9th consumer. |
| 5 | Zero design tokens, zero `AppButton` | **Fold in.** `DESIGN.md` binds this tool by name twice — `:183` makes *"Merge PDFs"* the worked example of the Primary button, `:149` makes remove-from-queue explicitly **not** destructive red. Both are already-made design decisions this view has never honoured; do not re-derive them. |
| 6 | Raw absolute filesystem paths rendered in the UI | **Fold in — and this one is pointed.** `CLAUDE.md` makes `/Users/<name>/…` personally-identifying and this repo enforces it on itself with a commit hook, while the product prints it on screen in a public portfolio piece. Basename + `title` tooltip. |
| 7 | Client-side range guard cannot know the page count | **Fold in.** `get_pages().len()`. Becomes an input `max` and a selection bound. |
| 8 | `bucket-pdf-*` absent from `TRANSLATABLE_CODES` | **Fold in, per code, applying 8.6's criterion** (*a fixed, value-free sentence we wrote ourselves*) rather than blanket-adding: `pdf-encrypted` **qualifies** (ours, value-free). `pdf-corrupt` **does not** (wraps `lopdf`'s error text). `pdf-too-few-files` and `pdf-invalid-range` do not qualify *as written* — but unlike 8.7's wrapped library errors these are **our** sentences, so they are **rewritten to carry their values as params**, then qualify. 8.7's reframing applies: this is a **voice** gap before it is a translation gap. |
| 9 | No runtime shape validation on `invoke<string>` results | **Defer.** Project-wide convention (`deferred-work.md:116`); fixing it in one tool creates inconsistency, not safety. 8.7 deferred on identical grounds. |
| 10 | TOCTOU between `check_file_size`'s `fs::metadata` and the later read | **Defer.** Explicitly pre-existing and identical in `pdf.rs` / `ocr.rs` / `base64.rs` — a project-wide pattern, not this tool's bug. Listed so it is not re-discovered as novel. |
| 11 | `lopdf` version drift | **Fold in — upgrade to 0.45.0** (§6) |
| 12 | `pdf.rs` has no AD-8-style port | **Deliberate absence, not a gap** (§6.3) |
| 13 | Merge discards metadata, accessibility structure, inherited page attributes | **Cut → issue #7.** A known *accepted* v1 limitation from 6.1's review, not a fresh finding. But the fidelity bar rises once pages rotate and reorder, and NFR5 sits awkwardly against silently dropping `StructTreeRoot`. Filed with that framing. |
| 14 | `prd.md:154`'s glossary still defines "The Bucket" as a live tool family | **Upstream correction owed** (§7.2) |

**Plus one gap found this session, not in the story's list:** the **skipped heading rank** (`<h1>` → `<h3>`, no `<h2>`) introduced by 8.7's promotion of the section heading. NFR5. Folded in (§2.2).

---

## 6. The AD-1 split and the `lopdf` adapter (AC6)

### 6.1 Where the work lives

| Layer | Owns |
| --- | --- |
| **`crates/umbra-core/src/pdf.rs`** (pure, no filesystem — AD-2/AD-15) | Merge; page-range extraction **and its authoritative validation**; text extraction; **page count**; **per-page text**; **scan-vs-empty classification**; **delete / rotate / reorder** page operations; `MAX_INPUT_BYTES`; every `ToolError` code |
| **`src-tauri/src/commands/pdf.rs`** | `check_file_size()` **before** the read; `spawn_blocking` (AD-4); `fs_helper::read_file_bytes` / `write_file_bytes`; the `output_path`-not-bytes IPC shape (AD-15); `map_join_error` → `pdf-internal` |
| **View (`PdfView.vue` + island sub-modules)** | All locale, path and size **formatting** (AD-1); basename derivation; selection state; the page list's lazy fetch policy; in-flight and success presentation |

**No new IPC byte exception.** The clipboard-RGBA and asset-protocol exceptions are OCR's; AD-15 says do not add a third, and nothing here needs one — the page list carries text and page numbers, not pixels.

### 6.2 `lopdf` 0.45.0 — verified, not assumed

**DECIDED (developer's call, over this record's initial recommendation to defer): take the upgrade.**

The project's *Dependency version/API drift* convention makes verification against **vendored source and a real build** mandatory for any pre-1.0 bump. Performed this session, at 0.45.0:

| Check | Result |
| --- | --- |
| `Document::load_mem(&[u8]) -> Result<Document>` | **Unchanged** (`reader.rs:95`) |
| `get_pages() -> BTreeMap<u32, ObjectId>`, 1-indexed | **Unchanged** (`document.rs:533`) — still `page_iter().enumerate().map(\|(i,p)\| ((i+1) as u32, p))` |
| `delete_pages(&mut self, &[u32])` — **must still silently no-op out of range** | **Unchanged** (`processor.rs:43`). Still `pages.get(page_number).and_then(…)`, so an out-of-range number does nothing and returns no error. **Core's validation ordering therefore keeps its meaning.** |
| `extract_text_with_limit(&[u32], usize) -> Result<String>` | **Unchanged** (`parser_aux.rs:65`) |
| `is_encrypted()` + `encryption_state: Option<EncryptionState>` | **Both present** (`document.rs:268`, `:57`) — `load_document`'s semantics hold |
| `extract_text_chunks(&[u32]) -> Vec<Result<String>>` (new dependency of §1.4) | **Present** (`parser_aux.rs:80`) |
| `get_page_images()` → `PdfImage.content: &[u8]` (cut #3's feasibility) | **Present** (`document.rs:771`, `xobject.rs:14`) |
| **Workspace build** | **Passes** |
| **`cargo test --workspace`** | **373 / 373 passing, zero regressions** |

**The finding worth recording beyond the version number.** `default-features = false` was added in Story 6.1 to work around a *live break*: `lopdf` 0.44.0's `datetime.rs` referenced `BorrowedFormatItem::StringLiteral`, removed upstream in a semver-compatible `time` 0.3.45.

**That reason no longer exists in 0.45.0.** The default feature set changed:

- 0.44.0 → `default = ["chrono", "jiff", "rayon", "time"]`
- 0.45.0 → `default = ["chrono-clock", "rayon"]`

`time` and `jiff` are **no longer default features**, so the break cannot occur. Confirmed empirically by building `umbra-core` **with** default features enabled: it compiles.

**Decision: keep `default-features = false` anyway, for a new and stated reason** — `chrono-clock` and `rayon` remain unused by this crate's date-free, non-`compress()` scope, and compiling what we do not use is the wrong default in a bundled app. **The workaround becomes a hygiene choice.** This is the "rationale died, decision survived" pattern (8.6's lesson 6) — the **third** live instance in this story, after `PdfView.vue`'s stale AD-16 comment and Story 6.1's dead drop reason.

**AD-7:** `lopdf` remains a pure-Rust, MIT, no-network dependency. The bump introduces no transitive network surface; Story 4.3's audit procedure is satisfied by the existing `cargo tree -i reqwest` gate. Also noted: `font_embedding` switched from `ttf-parser` to `skrifa` — not enabled here, no effect.

**Stack table entry owed** in `ARCHITECTURE-SPINE.md`, per the drift convention's own instruction that findings go there and not only into a story's Dev Notes.

### 6.3 No AD-8-style port — a deliberate absence (AC6)

`pdf.rs` calls `lopdf` types directly (`Document`, `Object`, `ObjectId`). OCR sits behind a core-owned `OcrEngine` trait. The story asks whether that asymmetry is a gap.

**DECIDED: it is a correct absence of ceremony, and this is the recorded reason rather than an unexamined inheritance.**

AD-8 exists because OCR's engine **was expected to be swapped** — the spine names model tiers, execution providers and alternative recognisers, and Story 4.1 was built anticipating that. Nothing has ever proposed swapping the PDF engine, and this session did not either: the one thing `lopdf` cannot do (rasterize) would be **added alongside** it as a second dependency, not substituted for it. A port abstracts a seam that does not exist.

**Revisit gate, so this is not a permanent free pass:** if the visual PDF tool (cut #1) is ever built, it introduces a genuine second PDF engine, and *that* is when the seam becomes real. Recorded on [#141](https://github.com/dipaneb/umbra/issues/141).

> **GATE FIRED, same day (2026-09-10).** §1.5 brings Pdfium into this story, so two engines now ship together. **§1.6.1 supersedes this section** — the conclusion (no port) is unchanged, but the *reason* is different: `lopdf` and Pdfium do different jobs and neither substitutes for the other, so this is a division of labour, not an abstraction boundary. A fourth instance of *rationale died, decision survived* — and the first one this story caused itself.

---

## 7. FR27 and upstream propagation (AC2)

### 7.1 FR27 — revised, not merely accurate

Current text (`prd.md:91`), a single unrevised sentence since 2026-07-19:

> **FR27.** PDF: merge multiple PDFs, split/extract page ranges, and extract text — all locally.

**Verdict: REVISED.** It is not *wrong* — those three verbs are genuinely what shipped — but it describes **three verbs and no document**, which is precisely the shape §1.4 replaces. Left as-is, it would describe a tool that no longer exists after Task 2b, which is the drift that cost Story 8.6 a full correct-course pass.

**Proposed replacement, for developer approval:**

> **FR27.** PDF: open a document and work on its pages — merge several PDFs into one, select pages to extract, delete, rotate or reorder them, and read a PDF's text — all locally. The tool states honestly when a PDF is a scan with no text layer to read. **Revised 2026-09-10 (Story 8.8):** the original three-verb wording was inherited from Epic 6's one-line description and never revisited; it described three independent operations, each re-picking the same file. Operations that require rendering a page as pixels — signature, redaction, annotation, crop, thumbnails — are deliberately **out of scope for this tool** and gated behind the rasterizer decision recorded in issue #132.

### 7.2 Propagation — in this story, per AC2

AC2's second half exists because Story 8.6 recorded an FR revision in its decision record only, and the resulting upstream drift needed `sprint-change-proposal-2026-09-06.md` to clear. **Both edits land in this story, not a later one.**

| File | Edit |
| --- | --- |
| `prd.md:91` | FR27 rewritten as §7.1, with dated rationale |
| `prd.md:154` | **Glossary: "The Bucket" is stale.** It still defines the Bucket as *"Umbra's drop-zone tool family: drag a file in, get a useful transformation out (OCR in v0; PDF/image operations in P2)"*. Story 8.7 **deleted** the `bucket` registry entry — the tool family does not exist. This is a **live definitional claim that reads as current**, so it gets corrected, not a forward pointer. (Gap #14. 8.7 corrected the `epics.md` scope lines and the `oar-ocr` figures; this entry was missed.) |
| `epics.md` Epic 6 / Epic 8 | Story 8.8's scope line updated to match what this record decides. **Historical epic/story text keeps a forward pointer rather than a rewrite** — the Epic 3 precedent (`sprint-change-proposal-2026-09-06.md` §4.3): live claims get corrected, records get pointers. |
| `EXPERIENCE.md:82` | "Bucket (OCR)" → "Image to Text"; the drag-and-drop claim becomes true by adoption (§3.3) |
| `ARCHITECTURE-SPINE.md` Stack table | `lopdf` row: 0.44.0 → 0.45.0, with the default-feature finding (§6.2) |

---

## 8. Cut ideas — issue drafts (AC3)

Route confirmed by the developer: individual max-context `backlog-candidate` issues on `dipaneb/umbra`, each linking back to this record. **Filed 2026-09-10 with the developer's explicit go-ahead — [#141](https://github.com/dipaneb/umbra/issues/141), [#142](https://github.com/dipaneb/umbra/issues/142), [#143](https://github.com/dipaneb/umbra/issues/143), [#144](https://github.com/dipaneb/umbra/issues/144), [#145](https://github.com/dipaneb/umbra/issues/145), [#146](https://github.com/dipaneb/umbra/issues/146), [#147](https://github.com/dipaneb/umbra/issues/147), [#148](https://github.com/dipaneb/umbra/issues/148).**

**1. The visual PDF tool — thumbnails, signature, redaction, annotation, crop, PDF→image.**
Filed as **one** issue, not six, because they are one decision: every item needs a page rendered as pixels, and `lopdf` cannot rasterize (`xobject::image()` runs the opposite direction — it embeds an image *into* a PDF). The dependency is `pdfium-render` → `libpdfium` at runtime → four platform binaries, roughly doubling the bundle, second native C++ dependency in a project blocked by `clipper2c-sys` in Story 4.1. **That is issue #132's cost sheet**, and this issue cross-references it rather than restating it: #132 rasterizes to OCR a scan, this rasterizes to show and edit a page. Licence cleared (PDFium is BSD-3-Clause). Would also be the point at which an AD-8-style port for the PDF engine becomes real (§6.3). Body links §1.2's capability table.

**2. Split a PDF into N files.** Structurally free — repeated `extract_page_range`. The real cost is output cardinality: today's save dialog expresses one destination file, and "many files out" needs a directory picker plus a naming scheme, neither of which exists in any tool.

**3. Extract embedded images from a PDF.** Available today: `get_page_images()` → `PdfImage.content: &[u8]`, plus `color_space`, `filters`, `bits_per_component`. The interesting part is that its natural next step is *the Images tool*, which raises an AD-6 cross-tool question (the "Send to" chaining `EXPERIENCE.md:175` already parks as a round-table MAYBE in tension with tools-are-islands). Filed with that framing so it is not mistaken for a simple export button.

**4. PDF metadata — view and strip.** `trailer` → `/Info` is directly reachable. A genuine privacy claim for this app: PDFs routinely carry author names, software fingerprints and timestamps that survive every other tool in this suite. **The strongest candidate to promote next**, and it composes with merge (which currently discards `/Info` anyway — see #7).

**5. Compress / optimise a PDF.** Closer to the rasterizer side than it appears: meaningful compression means recompressing embedded image streams, i.e. decoding them. Filed so the cost is understood rather than assumed cheap.

**6. Batch processing — drop N files, apply one action to all.** The developer's own idea, raised alongside multi-file drop. §3's `drop: { multiple: true }` makes the *gesture* possible; batch makes it *mean* something for non-merge operations. `EXPERIENCE.md:178` already parks "batch/folder-level Bucket operations" as round-table KEPT with an unresolved serial-vs-bounded-worker-pool concurrency question — that question is the reason this is an issue and not scope.

**7. Merge fidelity — preserve `AcroForm`, `StructTreeRoot`, `ViewerPreferences`, `/Info`, and inherited page attributes.** Story 6.1's code review ruled this *"documented as a known v1 limitation, not fixed"*: merging collapses each source `Catalog` into whichever is processed last, and pages are reparented onto a flattened `Pages` root without materialising attributes (`MediaBox`, `Resources`, `Rotate`, `CropBox`) they may inherit from an intermediate node — so such pages can render wrongly after merge. Page content and order are correct. **Why it is filed rather than deferred silently:** the fidelity bar rises once this story lets users rotate and reorder pages, and NFR5's accessibility floor sits awkwardly against silently dropping `StructTreeRoot`.

**8. Hoist `.sr-only` into `base.css`.** The clip pattern is copy-pasted into **five** tool views today — JWT, OCR, Hash, UUID, Cron — each carrying a comment pointing at another view's copy. PDF's in-flight announcer (gap #3) makes it six. Structurally identical to where `useCopyFeedback` sat before Story 8.7 hoisted it, after five consecutive stories declined on "not a shared-infrastructure story."

---

## 9. Drift found in the story file's own Dev Notes

Recorded here because the dev-story workflow's permitted edit surface excludes Dev Notes and AC prose. Neither changes a decision; both would mislead a reader.

1. **Test count.** *Dev Notes → Shipped implementation* says `src-tauri/src/commands/pdf.rs` has **"Eight `#[tokio::test]` integration tests."** There are **12** — which *Testing standards* states correctly, and which the 35-test total (10 + 12 + 13) depends on. The "Eight" is stale.
2. **Error-code count.** **AC4a says "five error codes"** and then enumerates four `bucket-pdf-*` plus "the two shared codes below" — **six**. The enumeration is right; the count word is not.
3. **A missing obligation, not a miscount.** AC4 lists two inherited hand-offs. **There are three** — see §4.3.

---

## 10. Open items Task 2a owns

1. **The page list's fetch policy.** `extract_text_chunks` is a decompress-and-parse per page; a 400-page document is real work. Lazy per-visible-row is the expected shape, but the bound, the placeholder state and the interaction with latest-wins supersession are unspecified.
2. **AD-16 runner scoping under the new container.** Re-derive from *one runner per independent piece of state*. The current single `runPdf` covered three disjoint groups; a selection surface may make them one group, or not. The stale in-file rationale must be rewritten regardless.
3. **Whether the page list needs a design canvas before implementation.** Recommended: its states — a 400-page document loading, an encrypted file, a scan where every row is blank, selection, reorder-in-progress — are the first genuinely new layout primitive since 8.7's Live Text overlay.
4. **Selection interaction model.** Range-select, multi-select, keyboard path (NFR5 admits no exceptions), and how selection maps onto each verb.
5. **Where merge lives on a document-scoped surface.** Merge takes *many documents*; everything else takes *one*. The open-once model has to express that without becoming two tools by accident.
6. **The carry-the-file-across mechanism** (§4.3) — shell-owned, route-surviving, AD-6-clean.
7. **`pdf-too-few-files` / `pdf-invalid-range` param shapes** — values in i18n params, or in `ToolError`'s structured `context` field.
8. **The normative *Authorised file surface* table**, built from a real repo-wide grep sweep, not recollection. 8.7 shipped **seven** files outside its table; 8.6's was found incomplete twice. Must name every non-island file: `DropZone.vue`, `dropZone.ts` + spec, `registry.ts` + spec, `toolError.ts` + spec, both locale JSONs, `lib.rs`, `commands/mod.rs`, and `docs/release-checklist.md` (which documents the PDF section in the AD-7 audit and manual QA steps).

---

## 11. Developer sign-off — GRANTED 2026-09-10

The developer signed off on all of the following, and authorised the upstream propagation and the issue filing in the same turn:

- §1.4 container, and the **deferred** split question
- §2.3's added verbs — delete, rotate, reorder
- §3.1 multi-file drop via `drop: { multiple: true }`, and §3.2's wider shell cost
- §4.1's duplicate-not-migrate call, **recorded as binding on Story 8.9**
- §4.3 — the **third hand-off**, which the story's AC4 does not currently list
- §6.2 `lopdf` 0.45.0 with `default-features = false` kept for a new reason
- §7.1's FR27 rewrite and §7.2's five propagation edits
- §8's eight cut ideas, and the go-ahead to file them as GitHub issues
