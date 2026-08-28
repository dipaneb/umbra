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

**Deferred.** Written after Task 1, via `bmad-party-mode` (same room as Task 1 — Story 8.1's precedent), scoped strictly to `8-2-base64-decision-record.md`. Real Given/When/Then ACs for the redesign go here then. Writing them now would be fiction, per epics.md's explicit instruction.

## Tasks / Subtasks

- [ ] **Task 0: Branch setup (AC: all)**
  - [ ] Confirm `baseline_commit` (`b151314`) is still `origin/main`'s real tip before branching (Story 8.1 was merged, then releases 0.2.0 / 0.2.1 landed on top — `b151314` is that current tip).
  - [ ] `git checkout -b feat/story-8-2-reimagine-base64-encode-decode origin/main` — every subsequent commit lands on this branch.

- [ ] **Task 1: Discovery — produce the decision record (AC1–4)**
  - [ ] Run `bmad-party-mode` framed explicitly as: *open scope discovery for Base64 Encode/Decode — the existing implementation is reference only, not a scope to preserve.* (A follow-up `bmad-forge-idea` pass to pressure-test a specific direction is the developer's call at execution time.)
  - [ ] Feed the session the current, real state so it starts from fact, not assumption (all confirmed by direct read this drafting session — see Dev Notes):
    - `crates/umbra-core/src/base64.rs`: `encode`/`encode_bytes` (premade `STANDARD`/`URL_SAFE` engines), `decode`/`decode_bytes` (custom `DecodePaddingMode::Indifferent` engines tolerant of unpadded input; whitespace/line-wrap stripped before decode; alphabet auto-detected by presence of `-`/`_`); `decode` layers a UTF-8 check on top, returning a distinct `base64-not-utf8` error with a byte-offset `Position`; `map_decode_error` maps `DecodeError` → `base64-invalid` with a byte offset where one is meaningful; `MAX_INPUT_BYTES` = 100 MB (CWE-400 guard).
    - `src-tauri/src/commands/base64.rs`: async commands `base64_encode`, `base64_decode`, `base64_encode_file`, `base64_decode_to_file` — all `spawn_blocking` (AD-4); `base64_encode_file` enforces a separate 10 MB `MAX_FILE_BYTES` cap via `metadata` *before* the file is read; `fs_helper` owns the actual read/write (AD-15).
    - `src/tools/base64/Base64View.vue`: input textarea + readonly output textarea; standard/url_safe radio `<fieldset>`; Encode / Decode / Paste / Decode-to-file buttons plus a separate Copy button; inline `ToolError` display with `errorLocation` (LineCol or ByteOffset); one `createLatestWinsRunner()` shared across encode/decode/paste; drop wired via `registry.setDropArgsProvider("base64", …)` + a `watch` on `registry.dropResult` (AD-14 — `DropZone.vue` is the dispatcher, the view only supplies `url_safe`); decode-to-file uses `save()` then `base64_decode_to_file`.
    - Styling is entirely pre-Epic-7: hardcoded `#666` / `#ccc` / `#b00020`, bare `<button>`s (not `AppButton`), local scoped CSS — untouched by any Epic 7 story. (`src/styles/base.css`, added by PR #104, already gives a bare `<textarea>` a token border + focus ring for free — don't re-style what's covered.)
    - i18n keys live under `tools.base64.*` in `src/locales/{en,fr}.json`; `src/locales/locales.spec.ts` runs every message through vue-i18n's real compiler.
  - [ ] Ground the session in what Epic 7 locked — `DESIGN.md`/`EXPERIENCE.md`'s precision-instrument register, the `{typography.code}` (Geist Mono) role for the in/out text panels, the Card/token system, `AppButton`, and `src/components/AppTabs.vue` (a **real shipped component** as of Story 8.1, DESIGN.md's Tab spec, full WAI-ARIA tablist keyboard pattern) — so the redesign direction composes with what's already committed, not invented independently.
  - [ ] Produce the written decision record satisfying AC1–3: what's kept/cut/added and why, the FR10–FR12 revision, and a GitHub issue for anything cut. Save to `_bmad-output/implementation-artifacts/8-2-base64-decision-record.md`.
  - [ ] Record the AD-1 functional-core split satisfying AC4: which of `encode`/`encode_bytes`/`decode`/`decode_bytes` and the size guards survive unchanged versus what new pure functions `crates/umbra-core/src/base64.rs` needs, and whether `src-tauri/src/commands/base64.rs` changes.

- [ ] **Task 2a: Redesign ACs — write real Given/When/Then** — deferred until Task 1's decision record exists. Run via `bmad-party-mode` (same room as Task 1). Resolve any open items the decision record leaves to Task 2, then fill in the "Acceptance Criteria — Task 2 (Redesign)" section above.

- [ ] **Task 2b: Redesign — implementation** — deferred until Task 2a. Follow the delivery pattern Story 8.1 established (see Dev Notes):
  - [ ] Per new capability: pure Rust function in `umbra-core::base64` + regression tests → Tauri command named `base64_<verb>` returning `Result<T, ToolError>`, dispatched via `spawn_blocking` (AD-4), wrapped in its own scoped latest-wins runner (AD-16) → Vue panel + i18n strings (escape literal `{`/`}` as `{'{'}` / `{'}'}` for vue-i18n) → full verification pass (`pnpm lint`, `pnpm test`, `vue-tsc --noEmit`, `pnpm build`, `cargo fmt --check`, `cargo test --workspace`) → visual check in `pnpm tauri dev` → commit, **ask before pushing**.
  - [ ] Tokenize `Base64View.vue`: replace the hardcoded hex (`#666`, `#ccc` in `.drop-hint`; `#b00020` in `p[role="alert"]`) with `--color-*` tokens, adopt `--font-code-*` for the in/out panels, `--radius-*` / `--spacing-*` for layout; replace bare `<button>`s with `AppButton`; use `AppTabs` **only if** Task 1's scope actually produces multiple named views (don't add tabs to a single-view tool).
  - [ ] Preserve existing behaviors unless the decision record explicitly retires one: registry-dispatched window drop (AD-14), decode-to-file save flow, auto-alphabet-detection on decode, latest-wins on encode/decode/paste.
  - [ ] Run the standard verification pass green before moving to code review.

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Story context created via `bmad-create-story` (2026-08-28) — comprehensive developer guide for a Task-1-gated Epic 8 charter story. Only Task 1 (discovery) carries real, testable acceptance criteria; Task 2's ACs are deferred to a follow-up edit (Task 2a) once `8-2-base64-decision-record.md` exists, per epics.md's explicit instruction that Task 2 ACs would be fiction before the decision record is made. `baseline_commit` set to `b151314` (origin/main tip: Story 8.1 merged as PR #105, then releases 0.2.0 / 0.2.1). Current Base64 implementation (core, command wrapper, view, i18n) live-read in full so discovery starts from confirmed fact.

### File List
