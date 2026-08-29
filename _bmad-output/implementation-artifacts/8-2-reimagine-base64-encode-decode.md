---
baseline_commit: b151314
---

# Story 8.2: Reimagine Base64 Encode/Decode

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer,
I want to reconsider Base64 Encode/Decode's feature set through open discovery before redesigning its UI,
so that the redesign reflects a deliberately chosen scope, not a visual reskin of whatever shipped first.

## Acceptance Criteria

**This story ships in two gated tasks (epics.md's own shared Epic 8 shape). Task 1's ACs below are real and testable now. Task 2 (redesign) has no ACs yet — writing them before Task 1's decision record exists would be fiction, per epics.md's explicit instruction — they are added to this story file as a follow-up edit (Task 2a) once Task 1 completes, exactly as Story 8.1 did.**

1. **Given** open scope discovery is run for the Base64 tool (`bmad-party-mode` — the developer has chosen the full roundtable for this story; a second, narrower `bmad-forge-idea` pass may follow), framed explicitly as reconsidering the tool's scope from first principles, **when** discovery concludes, **then** a written decision record exists stating what is kept, cut, and added relative to today's shipped implementation (text ↔ Base64 with standard + URL-safe alphabets and auto-detected alphabet on decode; file → Base64 via window drop; Base64 → saved file via the save dialog; whitespace- and line-wrap-tolerant decode; distinct `base64-not-utf8` vs `base64-invalid` errors carrying a byte-offset position; the 100 MB paste cap and the 10 MB dropped-file cap), with rationale for each call — the existing implementation is reference only, not a decision to preserve by default.
2. **Given** the decision record, **when** it is produced, **then** it states which of FR10–FR12 remain accurate, which are revised, and which are newly added — Epic 8's own preamble makes this revision each story's own output, not predicted in advance.
3. **Given** any idea considered and cut during discovery, **when** the decision record lands, **then** it is captured as a public backlog candidate (FR35) — filed as an individual, max-context GitHub issue per this project's idea-capture convention, not folded into a PRD rewrite and not silently dropped (the same disclosure discipline Story 6.3's own AC established for its FR29 decision).
4. **Given** the chosen scope, **when** the decision record completes, **then** it states which parts of the existing `crates/umbra-core/src/base64.rs` functional core survive as-is (AD-1: core owns every transformation) versus which need new pure functions, **and** whether the `src-tauri/src/commands/base64.rs` wrapper layer (the file-path commands and their size caps) changes — Task 2 builds directly on this split.
5. **Given** Task 1 has not yet produced its decision record, **when** this story starts, **then** Task 2 (redesign, and its own Given/When/Then acceptance criteria) has not begun — no implementation starts before the decision record exists.

## Acceptance Criteria — Task 2 (Redesign)

Written 2026-08-29 via `bmad-party-mode` (same room as Task 1), scoped strictly to
`8-2-base64-decision-record.md`. Numbering continues from Task 1's AC1–5. The room resolved the
decision record's open items first (recorded in "Open items resolved by Task 2a" below); the
CSP question (open item 4) and the exact final `base64-*` code list (open item 5) remain 2b
implementation-discovery items and are called out as such in AC11 / AC13.

6. **Container — single enriched view.** **Given** the redesigned Base64 tool, **when** it
   renders with empty input, **then** exactly three controls are visible — the input panel, an
   Encode ⇄ Decode segmented switch, and the (empty) output panel — with **no tab bar**, no
   `AppTabs` import, and no Encode/Decode/Paste action-button row; **and** all previously
   hardcoded styling (`.drop-hint`'s `#666`/`#ccc`, `p[role="alert"]`'s `#b00020`, every bare
   `<button>`) is replaced with `--color-*` / `--font-code-*` / `--radius-*` / `--spacing-*`
   tokens and `AppButton`, with `src/styles/base.css`'s existing bare-`<textarea>` treatment
   left in place (not re-styled).

7. **Live conversion.** **Given** the tool with a chosen direction, **when** the user types or
   pastes into the input, **then** the output updates automatically (debounced) with no button
   press; **and** switching the Encode ⇄ Decode segmented control re-runs the conversion on the
   current input immediately; **and** the existing single `createLatestWinsRunner()` still
   backs every conversion (encode, decode, data-URI decode, `sniff`) so a slow earlier call can
   never overwrite a newer result (AD-16 — no new runner scope).

8. **Paste removed, Copy downsized.** **Given** the redesigned tool, **when** the user inspects
   the controls, **then** there is no "Paste" button (⌘V into the input works as normal);
   **and** "Copy" is a single icon button on the output panel (24 px hit area, icon ≥ 16 px per
   `JsonTree.vue`'s copy-button floor), disabled when the output is empty, reusing the
   signature-accent "copied" feedback pattern (no separate success colour).

9. **One contextual slot, priority-ordered, never stacked.** **Given** the output panel,
   **when** zero or more of {a conversion error, a detection result, a data-URI offer} apply,
   **then** at most one is shown, directly under the output, in the fixed priority
   **error > detection > data-URI offer**; **and** it renders as a caption-weight line (not a
   tinted card); **and** when a higher-priority item resolves, the next one down (if any)
   appears without layout jump.

10. **Blob detection — honest by construction (AD-9).** **Given** a successful decode, **when**
    the decoded bytes / input structure match a known shape, **then** the contextual slot shows
    exactly one identification from the fixed ordered set — **not-Base64 (rendered as the
    error) → JWT → PNG / PDF / gzip / zip (magic bytes) → valid UTF-8 text → unknown** — first
    match wins; **and** a JWT identification offers a **"Read as JWT"** confirm and is never
    applied silently (the split-by-segment reading only takes effect on confirm); **and** an
    "unknown" result states "decoded N bytes — unrecognized" and asserts nothing more; **and**
    no identification is ever phrased as certain fact (`sniff` returns candidates carrying
    ambiguity, per the decision record's AD-1 split). Regression: a plain-ASCII input that is
    incidentally valid Base64 must land on "valid UTF-8 text", not a false binary guess.

11. **Data URI — build.** **Given** the Encode direction, **when** the user opens the data-URI
    builder and picks a MIME type, **then** the tool shows `data:<mime>;base64,<current encoded
    output>` as a copyable string, updating live with the input; **and** when the current
    conversion originated from a dropped file, the MIME type is pre-selected from that file's
    extension; **and** the build is pure view-side string composition (no new command, no
    async).

12. **Data URI — decode + preview.** **Given** input that starts with `data:`, **when** it is
    decoded, **then** `base64_parse_data_uri` (new `spawn_blocking` command, `Result<T,
    ToolError>`) splits the MIME + payload; **and** for an `image/*` MIME the contextual slot
    renders an inline `<img>` preview of the decoded bytes **before** any save; **and** a "Save
    as file" action writes the decoded bytes via the existing `base64_decode_to_file` /
    `fs_helper` path (AD-15), defaulting the filename extension from the MIME; **and** a
    malformed `data:` prefix produces a distinct `base64-data-uri-malformed` `ToolError`, never
    a crash or a silent pass-through. *2b implementation-discovery: confirm whether
    `tauri.conf.json`'s `security.csp` needs an `img-src ... data:` addition for the preview —
    a one-line addition proceeds in 2b; anything larger comes back to the developer as a
    question.*

13. **Line-wrap on encode.** **Given** the Encode direction, **when** the user picks a wrap
    width from an inline `none / 64 / 76` selector next to the output, **then** the encoded
    output is line-wrapped at that column (wrapping done in `umbra-core`, not Vue, via a new
    `wrap: Option<LineWrap>` parameter on `encode_bytes` / `encode` / `base64_encode` /
    `base64_encode_file`); **and** the default is `none`; **and** the selector is absent in the
    Decode direction; **and** decode remains tolerant of any wrap width on input (unchanged).

14. **Preserved behaviours.** **Given** the redesign, **when** it ships, **then** all of the
    following still work unchanged: registry-dispatched window drop with the view supplying
    only `url_safe` (AD-14, no document-level listeners); Base64 → file via the save dialog;
    standard-vs-URL-safe alphabet **auto-detection on decode**; the 100 MB input cap
    (`MAX_INPUT_BYTES`) and 10 MB dropped-file cap (`MAX_FILE_BYTES`); **and** every existing
    `crates/umbra-core/src/base64.rs` regression test (all 20) and `Base64View.spec.ts` case
    passes without modification to its assertions.

15. **i18n — no English-only strings.** **Given** every new user-facing string (detection
    lines, data-URI labels, wrap-selector labels, the new error messages), **when** the app
    runs in French, **then** each renders translated via ordinary `tools.base64.*` /
    `errors.*` keys with `en` + `fr` entries passing `src/locales/locales.spec.ts`; **and** the
    classified codes `base64-invalid-char`, `base64-not-utf8`, `base64-invalid-length`,
    `base64-invalid-padding`, `base64-data-uri-malformed` are added to
    `src/shell/toolError.ts`'s `TRANSLATABLE_CODES` (offsets/counts ride the structured
    `position` field, never baked into the translatable prose); **and** `base64-input-too-large`
    stays **out** of that set (embeds a byte count in prose), matching `json-input-too-large`.
    *2b implementation-discovery: the exact final code list may shift as `map_decode_error` is
    split — the principle (classification codes translated, value-embedding codes not) is
    fixed; the enumeration is confirmed against the real `DecodeError` variants in 2b.*

16. **Architecture compliance for new surface.** **Given** the new functions and commands,
    **when** they are implemented, **then** `parse_data_uri` and `sniff` are pure functions in
    `crates/umbra-core/src/base64.rs` with their own regression tests, touching no filesystem
    and no IPC (AD-1); **and** `base64_parse_data_uri` and `base64_sniff` are `spawn_blocking`
    commands (AD-4) returning `Result<T, ToolError>` (AD-3), named `base64_<verb>`; **and** the
    view renders only from `ToolError` structure (`code`, `position`), never by parsing
    `message`; **and** no other tool's files and no shared `src/shell/` / `src/stores/` file
    beyond `toolError.ts`'s `TRANSLATABLE_CODES` set are modified (AD-6).

### Open items resolved by Task 2a (2026-08-29)

- **"Build a data URI" is not a separate state group** — it is synchronous view-side string
  composition off the existing encoded output; data-URI *decode* rides the one shared
  latest-wins runner alongside `sniff` and live decode. No new runner scope (AC7, AC11).
- **Detection priority is a fixed ordered list, first-match-wins, exactly one shown** —
  not-Base64 → JWT → PNG/PDF/gzip/zip → UTF-8 text → unknown. No confidence scoring (AC10).
- **Line-wrap is an inline `none/64/76` selector**, Encode-direction only, **default `none`**
  (changing the emitted-output default for existing users is a trap) (AC13).
- **Vertical-slice delivery with a developer render-review after the first slice** is written
  into Task 2b's checklist (Winston's ask — the 8.1 reflexive-copy safeguard).

### Still owned by Task 2b (implementation-discovery, not resolvable in the room)

- Whether the `data:` image preview needs a `tauri.conf.json` `security.csp` `img-src data:`
  addition (AC12).
- The exact final classified `base64-*` code set, confirmed against the real `base64` crate
  `DecodeError` variants once `map_decode_error` is split (AC15).

## Tasks / Subtasks

- [x] **Task 0: Branch setup (AC: all)**
  - [x] Confirm `baseline_commit` (`b151314`) is still `origin/main`'s real tip before branching (Story 8.1 was merged, then releases 0.2.0 / 0.2.1 landed on top — `b151314` is that current tip). Verified: `git rev-parse origin/main` == `b151314d016e6a694439fbeb7d52c5a86e81d8ed`.
  - [x] `git checkout -b feat/story-8-2-reimagine-base64-encode-decode` — branched from `13c6942` (current tip = `origin/main` `b151314` + the `docs(story-8-2)` story-creation commit) rather than literally from `origin/main`, so the story file travels with the implementation branch. This matches Story 8.1's effective base (its story-creation commit was the first commit on its own feat branch). Every subsequent commit lands on this branch.

- [x] **Task 1: Discovery — produce the decision record (AC1–4)** — decision record written and confirmed by the developer 2026-08-29; 3 cut-idea GitHub issues filed ([#113](https://github.com/dipaneb/umbra/issues/113), [#114](https://github.com/dipaneb/umbra/issues/114), [#115](https://github.com/dipaneb/umbra/issues/115), `backlog-candidate` label) — AC1–AC4 all satisfied.
  - [x] Run `bmad-party-mode` framed explicitly as: *open scope discovery for Base64 Encode/Decode — the existing implementation is reference only, not a scope to preserve.* (Installed roster — Mary, John, Sally, Winston, Amelia, Paige; `session` mode; party memory on — resumed Story 8.1's history. `bmad-forge-idea` pass not run — not needed, the room reached a clear decision.)
  - [x] Feed the session the current, real state so it starts from fact, not assumption (all re-confirmed by direct read at session start — `base64.rs` 251 lines, `commands/base64.rs` 183 lines, `Base64View.vue` 261 lines — matched Dev Notes exactly):
    - `crates/umbra-core/src/base64.rs`: `encode`/`encode_bytes` (premade `STANDARD`/`URL_SAFE` engines), `decode`/`decode_bytes` (custom `DecodePaddingMode::Indifferent` engines tolerant of unpadded input; whitespace/line-wrap stripped before decode; alphabet auto-detected by presence of `-`/`_`); `decode` layers a UTF-8 check on top, returning a distinct `base64-not-utf8` error with a byte-offset `Position`; `map_decode_error` maps `DecodeError` → `base64-invalid` with a byte offset where one is meaningful; `MAX_INPUT_BYTES` = 100 MB (CWE-400 guard).
    - `src-tauri/src/commands/base64.rs`: async commands `base64_encode`, `base64_decode`, `base64_encode_file`, `base64_decode_to_file` — all `spawn_blocking` (AD-4); `base64_encode_file` enforces a separate 10 MB `MAX_FILE_BYTES` cap via `metadata` *before* the file is read; `fs_helper` owns the actual read/write (AD-15).
    - `src/tools/base64/Base64View.vue`: input textarea + readonly output textarea; standard/url_safe radio `<fieldset>`; Encode / Decode / Paste / Decode-to-file buttons plus a separate Copy button; inline `ToolError` display with `errorLocation` (LineCol or ByteOffset); one `createLatestWinsRunner()` shared across encode/decode/paste; drop wired via `registry.setDropArgsProvider("base64", …)` + a `watch` on `registry.dropResult` (AD-14 — `DropZone.vue` is the dispatcher, the view only supplies `url_safe`); decode-to-file uses `save()` then `base64_decode_to_file`.
    - Styling is entirely pre-Epic-7: hardcoded `#666` / `#ccc` / `#b00020`, bare `<button>`s (not `AppButton`), local scoped CSS — untouched by any Epic 7 story. (`src/styles/base.css`, added by PR #104, already gives a bare `<textarea>` a token border + focus ring for free — don't re-style what's covered.)
    - i18n keys live under `tools.base64.*` in `src/locales/{en,fr}.json`; `src/locales/locales.spec.ts` runs every message through vue-i18n's real compiler.
  - [x] Ground the session in what Epic 7 locked — read `src/styles/tokens.css`, `base.css`, `src/components/AppButton.vue`, `src/components/AppTabs.vue`, `src/App.vue`, `src/shell/icons.ts` and `src/tools/json/JsonView.vue` (the 8.1 redesign reference) to pin exact token values, component anatomy and the main-pane frame before the design canvas.
  - [x] Produce the written decision record satisfying AC1–AC4: kept / changed / added / cut with rationale, container decision (single enriched view — Option A), FR10–FR12 revision, i18n/`TRANSLATABLE_CODES` finding, AD-1 core split. Saved to `_bmad-output/implementation-artifacts/8-2-base64-decision-record.md`. AC3: 3 cut-idea issues filed on `dipaneb/umbra` (#113 hex view, #114 decode-as-gzip, #115 recursive decode), `backlog-candidate` label, each linking back to the decision record.
  - [x] Record the AD-1 functional-core split satisfying AC4: `encode`/`encode_bytes`/`decode`/`decode_bytes`, the decode engines, alphabet detection, the UTF-8 layer and both size guards all survive unchanged; new pure fns `parse_data_uri` and `sniff` plus a `wrap: Option<LineWrap>` param on `encode_bytes`; `src-tauri/src/commands/base64.rs` changes additively (two new `base64_<verb>` commands, a `wrap` arg on two existing ones).
  - [x] Built a 3-artboard comparison design canvas (single view / tabbed / two-pane) matching Umbra's real token system, published as an Artifact, for the developer to choose the container shape. Developer chose Option A (single enriched view) 2026-08-29.

- [x] **Task 2a: Redesign ACs — write real Given/When/Then** — done 2026-08-29 via `bmad-party-mode` (same room). Open items resolved: data-URI build is not a separate state group; detection is a fixed first-match-wins order; line-wrap is an inline Encode-only selector defaulting to `none`. Two items explicitly handed to 2b as implementation-discovery (CSP for `data:` preview; final `base64-*` code list). AC6–AC16 written into the "Acceptance Criteria — Task 2 (Redesign)" section above. **Awaiting developer confirmation of the AC set before 2b starts.**

- [ ] **Task 2b: Redesign — implementation** — deferred until the developer confirms the AC6–AC16 set. Follow the delivery pattern Story 8.1 established (see Dev Notes). **Vertical-slice order, developer render-review after the first slice** (Winston's ask — the 8.1 reflexive-copy safeguard):
  - [ ] **Slice 1 — tokenize + restructure to the single enriched view (AC6, AC8, AC14).** Replace hardcoded hex (`.drop-hint` `#666`/`#ccc`; `p[role="alert"]` `#b00020`) with `--color-*`; `--font-code-*` for in/out panels; `--radius-*`/`--spacing-*` for layout; bare `<button>`s → `AppButton`; remove the Paste button, downsize Copy to an output-panel icon. **No `AppTabs`.** → verification pass → **stop for the developer's eyes on the first real render** before slice 2.
  - [ ] **Slice 2 — live conversion + segmented direction switch (AC7).** Debounced watch on input; Encode ⇄ Decode segmented control; keep the one shared `createLatestWinsRunner()`.
  - [ ] **Slice 3 — `sniff` + the one contextual slot (AC9, AC10).** Pure `sniff` in `umbra-core::base64` + tests → `base64_sniff` (`spawn_blocking`, `Result<T, ToolError>`) → contextual-slot component with the fixed priority (error > detection > data-URI offer) and the "Read as JWT" confirm.
  - [ ] **Slice 4 — data URI build + decode + preview (AC11, AC12).** `parse_data_uri` in core + tests → `base64_parse_data_uri` → builder (sync string compose) + decode path + inline `<img>` preview + Save-as-file reusing `base64_decode_to_file`. Resolve the CSP `img-src data:` question here (one-liner → proceed; larger → ask).
  - [ ] **Slice 5 — line-wrap on encode (AC13).** `wrap: Option<LineWrap>` on `encode_bytes`/`encode`/`base64_encode`/`base64_encode_file` + tests → inline `none/64/76` selector, Encode-direction only, default `none`.
  - [ ] **Slice 6 — classified error codes + French (AC15).** Split `map_decode_error` into classified `base64-*` codes; add the classification codes to `TRANSLATABLE_CODES`; `en`+`fr` for every new string (`{'{'}` / `{'}'}` escape for literal braces).
  - [ ] Per slice: pure Rust fn + regression tests → `base64_<verb>` command (`spawn_blocking`, `Result<T, ToolError>`, AD-3/AD-4) → Vue → full verification pass (`pnpm lint`, `pnpm test`, `vue-tsc --noEmit`, `pnpm build`, `cargo fmt --check`, `cargo test --workspace`) → visual check in `pnpm tauri dev` → commit, **ask before pushing**.
  - [ ] Preserve unchanged (AC14): registry-dispatched window drop (AD-14), Base64 → file save flow, auto-alphabet-detection on decode, all 20 core tests + `Base64View.spec.ts`, the 100 MB / 10 MB caps.
  - [ ] Full verification pass green, then `bmad-code-review` (different LLM).

## Dev Notes

- **This is the second real instance of Epic 8's "Task 1 decision record gates Task 2" shape — and the first one is now proven.** Story 8.1 (`8-1-reimagine-the-json-formatter-viewer.md`) executed the full pattern end to end: `bmad-party-mode` discovery → `8-1-json-decision-record.md` → Task 2a AC-writing in the same room → per-slice implementation with a developer design-review pass → `bmad-code-review` → done. **Use Story 8.1's story file and decision record as the working template**, not Story 6.3 (still `backlog`, never executed).
- **Current implementation, read in full this drafting session — the discovery session's factual starting point, NOT this story's scope:**
  - `crates/umbra-core/src/base64.rs` (251 lines): see Task 1's "feed the session" bullet for the full breakdown. 20 regression tests already cover round-trips, `+`/`/` vs `-`/`_` alphabet detection, unpadded input, trailing newline, PEM-style line wrapping, invalid-char byte offset, non-UTF-8 offset-after-valid-prefix, and both size-cap rejections. `encode_bytes`/`decode_bytes` (raw `&[u8]` / `Vec<u8>`) are the Story 2.2 file-path additions; `encode`/`decode` (`&str` / UTF-8-validated `String`) are thin wrappers for the text case.
  - `src-tauri/src/commands/base64.rs` (183 lines): the four async commands, plus `MAX_FILE_BYTES` (10 MB, deliberately smaller than core's 100 MB and scoped to this command because a Base64-encoded file's *output* size grows with its input and has to render in a `<textarea>`). `map_join_error` → `base64-internal` on a `spawn_blocking` panic.
  - `src/tools/base64/Base64View.vue` (261 lines) + `src/tools/base64/Base64View.spec.ts` (existing component tests — re-verify and extend, don't duplicate).
  - i18n: `tools.base64.*` in `src/locales/en.json` (block starts ~line 150) and `src/locales/fr.json`; guarded by `src/locales/locales.spec.ts`.
- **FR mapping.** **FR10** — text ↔ Base64 including URL-safe alphabet, auto-detected on decode. **FR11** — file → Base64 and Base64 → downloadable file (this tool was the project's first use of the drop service + save helper, Story 2.2). **FR12** — invalid input produces a clear inline error, never a crash or silent empty output. Epic 8's preamble makes the FR10–FR12 revision this story's own output — do not treat the current wording as fixed.
- **Architecture boundaries Task 1 must scope against and Task 2 must obey:**
  - **AD-1** — every new transformation is a pure function in `umbra-core::base64`; never computed in Vue or `src-tauri`. Core returns machine values, the view renders them.
  - **AD-3** — every command returns `Result<T, ToolError>`; the view renders from `ToolError`'s structure only (`code`, `position`), never by parsing `message`. Commands are `base64_<verb>`.
  - **AD-4** — anything that can exceed ~100 ms CPU runs on the blocking pool via `spawn_blocking` (all four current commands already do).
  - **AD-6** — tools are islands. Do not touch another tool's files. Cross-cutting state lives only in the `settings` / `registry` Pinia stores. (Base64 already declares a `clipboardMatch` on its registry entry for Story 7.8's clipboard-suggestion surface — changing that shape is a shell concern; if the decision record wants it, present it as options with trade-offs, don't decide it silently.)
  - **AD-9 / AD-13 honesty** — Base64 has no natural-language grammar, so no AD-13-style disclosed exception is needed and French rides the existing `vue-i18n` seam like every other tool. But if Task 1 adds any "guess what this blob is / what encoding this is" heuristic, `EXPERIENCE.md`'s honesty bar and AD-9's "never a confident-sounding wrong answer" principle apply — the same reasoning Story 8.1 applied to its Repair tab's preview-then-confirm contract.
  - **AD-14** — window drops dispatch through the shell's one generic dispatcher to the tool's registry-declared handler; the view supplies only tool-specific args (here, `url_safe`). Register no document-level listeners.
  - **AD-15** — files cross IPC as absolute paths; `fs_helper` owns all reads/writes; `umbra-core` never touches the filesystem; byte arrays above ~64 KB never ride the JSON IPC bridge (clipboard-pasted images are the only sanctioned exception).
  - **AD-16** — one latest-wins runner per *independent* piece of state. `Base64View.vue` today shares a single `createLatestWinsRunner()` across encode/decode/paste (they all write the one `output` ref, so that is correct as-is). If Task 2 splits the tool into genuinely independent views/state-groups, scope one runner per group — `CronView.vue`'s two-section split is the cautionary precedent (a tool-wide runner falsely supersedes an unrelated section); `HashView.vue`'s `registry.getLatestWinsRunner(toolId)` is the reference when drop + an in-view invoke both write the same surface.
- **Reusable pattern from Story 8.1 — follow it, don't reinvent:**
  - `src/components/AppTabs.vue` exists now (built in 8.1 as DESIGN.md's Tab component). Reuse it if Task 1's scope yields multiple named views; do not build a second tab component.
  - **Per-slice delivery with a developer design-review pass right after the first real render** caught reflexive-copy mistakes in 8.1: an `AppButton` `primary` (orange) variant applied by copying another tool's shape without checking DESIGN.md reserves that colour for one true signature action; a whole layout row spent on a pick-once setting; generic Paste/Copy buttons that had lost their referent. **Base64's current Encode/Decode/Paste/Copy button cluster and the standard-vs-url_safe radio `<fieldset>` are exactly the shapes to reconsider in Task 1/2, not port forward by default.**
  - **vue-i18n treats a literal `{` / `}` in a message string as interpolation syntax.** Any new locale string that shows Base64/data-URI/alphabet syntax with a literal brace needs the `{'{'}` / `{'}'}` escape. `locales.spec.ts` guards it, but reach for the escape proactively.
  - **Never rely on incidental template whitespace for visual spacing** between adjacent Vue elements — it collapses silently. Give a spaced element its own node with real CSS `margin`.
  - **When tightening a loose test threshold** (e.g. a latency ceiling on a new command), calibrate it against a real `cargo test --workspace` run under parallel contention, not an isolated single-test measurement — 8.1's first attempt at a 2 s ceiling proved flaky and settled at 10 s.
- **Performance.** No Base64-specific performance profile exists (unlike JSON's Story 1.9 10 MB baseline). `base64` crate encode/decode is linear and fast; the practical ceiling is rendering a large output textarea — which is why `base64_encode_file` caps input at 10 MB. Any Task 2 view over large input should be sanity-checked for render cost and must honour the existing 100 MB / 10 MB caps rather than exempting itself.
- **Styling status.** `Base64View.vue` is 100% pre-Epic-7 — Task 2 is the first tokenization pass this tool gets. `base.css` covers a bare `<textarea>`'s border and focus-visible ring; still hardcoded and Task 2's real work: `.drop-hint`'s `#666` / `#ccc`, `p[role="alert"]`'s `#b00020`, and every bare `<button>`.
- **No inter-story dependency.** Epic 8's preamble states 8.1–8.9 are mutually independent once Epic 7 is done; 8.2 runs now because the developer chose it, and it can be created and implemented without waiting on 8.3–8.9.

### Project Structure Notes

- **Likely touched (contingent on Task 1's decision — confirm during Task 2):** `src/tools/base64/Base64View.vue`, `src/tools/base64/Base64View.spec.ts`; `crates/umbra-core/src/base64.rs` and its tests only if Task 1 decides new core transformations are needed; `src-tauri/src/commands/base64.rs` only if the command surface changes; `src/locales/en.json` + `src/locales/fr.json` for any new strings; `src/components/AppTabs.vue` and `src/components/AppButton.vue` as *consumers* (imported, not modified).
- **New:** Task 1's decision-record artifact — `_bmad-output/implementation-artifacts/8-2-base64-decision-record.md`.
- **Out of scope regardless of Task 1's outcome:** any other tool's files (AD-6, tools are islands) and any shared `src/shell/` / `src/stores/` file beyond what Epic 7 already generalized (`tokens.css`, `icons.ts`, `AppTabs.vue`, `AppButton.vue`) — unless the decision record explicitly justifies a shared-infrastructure change, in which case this project's CLAUDE.md governance-check discipline applies: present it as options with trade-offs to the developer, and check it against the project's established governance patterns (branch protection, LICENSE, CI gates, the `type(scope): subject` commit convention) rather than assuming they travel with the change.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8 preamble + shared story shape (231–243, 1318–1337); Story 8.2 charter (1342–1344); Epic 2 Base64 stories 2.1 (504–527) and 2.2 (529–552) as reference-only prior acceptance criteria; FR10–FR12 (49–51, 158–161); Story 6.3, the originally-cited (still unexecuted) pattern precedent (~972–991)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — F3 / FR10–FR11 (57–61), FR12; FR2's "b64" → Base64 alias example (45)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-16.md` — Epic 8's "chartered, not fully spec'd" charter and rationale (§3, §4.3); Base64 explicitly **not** structurally impacted by Epic 7, FR-level behaviour unchanged (§2)]
- [Source: `_bmad-output/implementation-artifacts/8-1-reimagine-the-json-formatter-viewer.md` — the now-proven template: Task 1 AC shape (17–26), Task 2a/2b gating and per-slice delivery (109–241), Review Findings (243–269), and the i18n / template-whitespace / test-threshold lessons in Dev Notes and completion notes]
- [Source: `_bmad-output/implementation-artifacts/8-1-json-decision-record.md` — the decision-record format to mirror: Kept / Added / Cut (backlog) / FR revision / AD-1 core-split / i18n-AD-13 finding / "open items Task 2 still owns"]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1 (45–49), AD-3 (57–61), AD-4 (63–67), AD-5 (69–73), AD-6 (75–79), AD-9 (93–97), AD-13 + its 2026-08-23 amendment (117–150), AD-14 (152–156), AD-15 (158–162), AD-16 + the 2026-08-04 runner-scoping amendment (164–175); Consistency Conventions table (179–184)]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/DESIGN.md` — token frontmatter (6–113); `{typography.code}` / Geist Mono rationale (~154); Do's-and-Don'ts (187–196); the Tab component spec `AppTabs.vue` implements]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/EXPERIENCE.md` — Information Architecture three-views table (16–29); Voice and Tone error-message bar (~50); State Patterns Error row (~71); Accessibility Floor (86–94)]
- [Source: `_bmad-output/implementation-artifacts/7-1-design-tokens-and-icon-system-land-in-the-shell.md` — the token naming convention (`--color-*`, `--font-<role>-*`, `--radius-*`, `--shadow-*`) Task 2 must consume, not reinvent]
- Live-read this drafting session: `crates/umbra-core/src/base64.rs`, `src-tauri/src/commands/base64.rs`, `src/tools/base64/Base64View.vue`, `src/locales/en.json` (base64 block) — full contents, confirming the current feature set and existing CWE-400 guards before discovery reconsiders them.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- 2026-08-28 — Task 0: `git rev-parse origin/main` → `b151314d016e6a694439fbeb7d52c5a86e81d8ed` (confirms `baseline_commit`). `git checkout -b feat/story-8-2-reimagine-base64-encode-decode` from `13c6942`. Re-read `crates/umbra-core/src/base64.rs` (251 lines), `src-tauri/src/commands/base64.rs` (183 lines), `src/tools/base64/Base64View.vue` (261 lines) — all match the story Dev Notes exactly; no drift since the drafting session.
- 2026-08-29 — Task 1: `bmad-party-mode` discovery session (installed roster, `session` mode, party memory resumed Story 8.1). Read `tokens.css` / `base.css` / `AppButton.vue` / `AppTabs.vue` / `App.vue` / `icons.ts` / `JsonView.vue` for the design canvas. Published a 3-container comparison canvas as an Artifact (`6582897f-…`). Developer confirmed: container = Option A; blob detection IN; line-wrap on encode IN; 3 cut ideas → GitHub issues. Decision record written. `TRANSLATABLE_CODES` checked — zero `base64-*` coverage (finding recorded).

### Completion Notes List

- Story context created via `bmad-create-story` (2026-08-28) — comprehensive developer guide for a Task-1-gated Epic 8 charter story. Only Task 1 (discovery) carries real, testable acceptance criteria; Task 2's ACs are deferred to a follow-up edit (Task 2a) once `8-2-base64-decision-record.md` exists, per epics.md's explicit instruction that Task 2 ACs would be fiction before the decision record is made. `baseline_commit` set to `b151314` (origin/main tip: Story 8.1 merged as PR #105, then releases 0.2.0 / 0.2.1). Current Base64 implementation (core, command wrapper, view, i18n) live-read in full so discovery starts from confirmed fact.
- 2026-08-28 — `bmad-dev-story` session started. Task 0 (branch setup) complete. Task 1 (open scope discovery via `bmad-party-mode`) is a facilitated roundtable requiring the developer's cut/keep/add judgement calls — begun interactively, not run autonomously (Story 8.1's decision record shows the same: "Developer confirmed all four open questions").
- 2026-08-29 — Task 1 discovery complete bar the AC3 filing step. Decision record `8-2-base64-decision-record.md` written and confirmed by the developer. **Scope decided:** KEPT — text↔Base64 both alphabets + auto-detect, whitespace-tolerant decode, file↔Base64 (drop + save), distinct `base64-not-utf8`/`base64-invalid` + byte offsets, 100 MB / 10 MB caps, all 20 core tests, drop dispatch / decode-to-file / latest-wins. CHANGED (interaction) — live as-you-type conversion (Encode/Decode buttons removed → segmented direction switch), Paste button cut (divergence from 8.1, recorded), Copy → output-panel icon, one priority-ordered contextual slot (error > detection > data-URI offer, never stacked, caption not card), full tokenization pass. ADDED — (1) data URI build + decode with inline image preview, (2) blob detection "looks like X" (JWT/PNG/PDF/gzip/zip/text/unknown), honest-by-construction per AD-9, one caption line, (3) line-wrap on encode (none/64/76). CONTAINER — single enriched view (Option A); tabs and two-pane rejected; `AppTabs` not used. CUT → 3 backlog GitHub issues (hex/radix view, decode-as-gzip, recursive decode) — drafted, **not yet filed**. AD-1 split — core `encode*`/`decode*`/engines/detection/UTF-8 layer/guards unchanged; new pure `parse_data_uri` + `sniff` + `wrap` param; commands change additively (2 new `base64_<verb>`, `wrap` arg on 2 existing). i18n finding — `TRANSLATABLE_CODES` has zero `base64-*` coverage; classify + translate in Task 2. |

### Change Log

| Date | Change |
| --- | --- |
| 2026-08-28 | Task 0 complete: branched `feat/story-8-2-reimagine-base64-encode-decode` from `13c6942`; `baseline_commit` `b151314` verified against `origin/main`. Story moved `ready-for-dev` → `in-progress` in sprint-status.yaml. Task 1 discovery started. |
| 2026-08-29 | Task 1 complete. `bmad-party-mode` discovery (installed roster); 3-container design canvas published as an Artifact; developer chose the single enriched view. Decision record `8-2-base64-decision-record.md` written (kept/changed/added/cut, container, FR10–FR12 revision, i18n finding, AD-1 split). 3 cut-idea GitHub issues filed: #113 (hex view), #114 (decode-as-gzip), #115 (recursive decode), `backlog-candidate` label. AC1–AC4 satisfied. |
| 2026-08-29 | Task 2a complete. Same `bmad-party-mode` room resolved the decision record's open items and wrote AC6–AC16 (container / live conversion / Paste removed + Copy icon / one contextual slot / honest blob detection / data-URI build + decode + preview / line-wrap on encode / i18n + classified codes / architecture compliance) into the story's "Acceptance Criteria — Task 2 (Redesign)" section. Task 2b re-planned into 6 vertical slices with a developer render-review after slice 1. Awaiting developer sign-off on the AC set before 2b. Nothing committed yet (developer wants one commit covering the record + story file). |

### File List

- `_bmad-output/implementation-artifacts/8-2-reimagine-base64-encode-decode.md` (this story — Task/Dev Agent Record updates)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status `ready-for-dev` → `in-progress`)
- `_bmad-output/implementation-artifacts/8-2-base64-decision-record.md` (NEW — Task 1 deliverable)
