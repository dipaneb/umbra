---
baseline_commit: d428db9
---

# Story 8.4: Reimagine the Hash Generator

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer,
I want to reconsider the Hash Generator's feature set through open discovery before redesigning its UI,
so that the redesign reflects a deliberately chosen scope, not a visual reskin of whatever shipped first.

## Acceptance Criteria

**This story ships in two gated tasks (epics.md's own shared Epic 8 shape). Task 1's ACs below are real and testable now. Task 2 (redesign) has no ACs yet — writing them before Task 1's decision record exists would be fiction, per epics.md's explicit instruction — they are added to this story file as a follow-up edit (Task 2a) once Task 1 completes, exactly as Stories 8.1, 8.2 and 8.3 did.**

1. **Given** open scope discovery is run for the Hash tool (`bmad-party-mode` or `bmad-forge-idea` — the developer chooses which for this story; a second, narrower pass may follow), framed explicitly as reconsidering the tool's scope from first principles, **when** discovery concludes, **then** a written decision record exists stating what is kept, cut, and added relative to today's shipped implementation, with rationale for each call — the existing implementation is reference only, not a decision to preserve by default. Today's shipped implementation, to be reconsidered rather than assumed:
   - **Digests:** SHA-256, SHA-512, MD5, SHA-1 computed **simultaneously** in `crates/umbra-core/src/hash.rs`, one canonical **lowercase-hex** string per algorithm; MD5 and SHA-1 rendered with a **`(legacy)` suffix** (`tools.hash.legacySuffix`, `{algorithm} (legacy)` / `(obsolète)`).
   - **Case:** a `lower` / `UPPERCASE` radio `<fieldset>` that re-renders the existing digests **view-side** via `.toUpperCase()` — never a second `hash_compute` call (AD-1: case is presentation).
   - **Text input:** one `<textarea rows="10">` plus a **Paste-from-clipboard** button (`readClipboardText()`); typing does **not** auto-hash — an explicit **Compute** button (`AppButton variant="primary"`) triggers `invoke("hash_compute", { input })`.
   - **File input:** the shell's window-level **drop service** — `src/stores/registry.ts`'s `hash` entry carries `drop: { acceptedMimeTypes: [], handler: "hash_compute_file" }`; `DropZone.vue` invokes `hash_compute_file` itself (AD-14), and `HashView.vue` only consumes the outcome via `registry.dropResult` (one-shot signal, no `dropArgsProvider` — `hash_compute_file` takes only `path`).
   - **Latest-wins:** **one shared** `registry.getLatestWinsRunner("hash")` across manual Compute, Paste, and an in-flight file drop, so the three participate in a single latest-wins sequence (AD-16).
   - **Size cap:** `MAX_INPUT_BYTES = 100 * 1024 * 1024` (100 MiB), enforced in `umbra-core` for text (`compute` / `compute_bytes`) and via a metadata `check_file_size` **before the file is read** for drops; over-cap → `hash-input-too-large` (`position: None`, byte count embedded in the prose message).
   - **Errors:** `hash-input-too-large`, `hash-internal` (join-panic), `file-read-error` (missing/unreadable dropped file) — all `ToolError`, all rendered raw via `toolErrorMessage`; **none** is in `TRANSLATABLE_CODES`.
   - **Copy:** per-row one-click **Copy** (`<AppButton>`) copying that row's **currently-displayed, case-respecting** string; no "Copied" feedback, no `aria-live`.
   - **Excluded by FR14:** no bcrypt / argon2 (password hashing is a separate P3 backlog tool).
2. **Given** the decision record, **when** it is produced, **then** it states whether **FR14** and **FR15** remain accurate, are revised, or are expanded — Epic 8's own preamble makes this revision each story's own output, not predicted in advance.
3. **Given** any idea considered and cut during discovery, **when** the decision record lands, **then** it is captured as a public backlog candidate (FR35) — filed as an individual, max-context GitHub issue on `dipaneb/umbra` with the `backlog-candidate` label per this project's idea-capture convention (cf. issues #113–#116), each linking back to the decision record — **or**, if the developer explicitly directs otherwise (as they did for Story 8.3), captured in their own tracked backlog and the deviation logged here and in the record so the ideas are traceable, not silently dropped.
4. **Given** the chosen scope, **when** the decision record completes, **then** it states, for the AD-1 functional-core split that Task 2 builds directly on:
   - which parts of `crates/umbra-core/src/hash.rs` (the `HashDigests` struct, `compute` / `compute_bytes` / `to_hex_lower`, `MAX_INPUT_BYTES`, the 9 unit tests) survive as-is versus which need new pure functions;
   - whether `src-tauri/src/commands/hash.rs` changes — either command (`hash_compute`, `hash_compute_file`), `check_file_size`, `map_join_error`, or a new `hash_<verb>` command — and whether `src-tauri/src/lib.rs`'s handler registration changes;
   - whether `src/tools/hash/hashDigests.ts` (the hand-synced TS mirror of the Rust `HashDigests` struct — a comment says keep the two in sync by hand) changes;
   - whether `crates/umbra-core/Cargo.toml`'s hash-crate set (`sha2 = "0.11"`, `sha1 = "0.11"`, `md-5 = "0.11"`) changes, and if so the exact new set, cross-platform-clean (AD-2 / AD-11);
   - whether the `hash` **registry entry** changes — the `drop` shape, a new `clipboardMatch`, or a `shortcut` — noting that any registry-shape change is a **shell concern** (AD-6) to present as options with trade-offs, not decide silently inside this story.
5. **Given** Task 1 has not yet produced its decision record, **when** this story starts, **then** Task 2 (redesign, and its own Given/When/Then acceptance criteria) has not begun — no implementation starts before the decision record exists.

## Acceptance Criteria — Task 2 (Redesign)

_Written in Task 2a (2026-08-31), in the same `bmad-party-mode` room, scoped strictly to
`8-4-hash-decision-record.md` plus the polished design canvas
(`https://claude.ai/code/artifact/c928d06d-a86d-4e32-8ad5-a8764fd3af67` — Default / Verify active /
Smart-detection offer / After "Move it to Verify"). Numbering continues from AC5. Awaiting the
developer's sign-off before Task 2b._

**Task 2a resolution of the decision record's open items:**
- Verify affordance = a **persistent panel under the results** (not a tab, not a mode switch);
  the smart-detection acknowledgement = **a two-ended signal** (a note where the value left + a
  briefly-tinted Verify field where it landed) **plus Undo** — see AC17.
- Smart detector recognises a bare hex string of **32 / 40 / 56 / 64 / 96 / 128** chars; it does
  **not** disambiguate — Verify checks the pasted value against **every selected algorithm**
  (developer's call, 2026-08-31), so a match is never missed and no algorithm guess is needed.
- Case + encoding are **two small segmented controls** (`lower`/`UPPER`, `Hex`/`Base64`); they
  **compose**; each is a **persisted `hash.*` setting** (AD-10, the 8.3 `uuid.*` pattern).
- `Algorithm` enum + an ordered `Vec<DigestEntry { algorithm, hex }>` return; exact serde naming
  and the `sha3` version pin are Task 2b implementation calls against the real code.
- **Digest export to a file — OUT** (developer + room, 2026-08-31: ≤6 digests for one input is
  not a bulk problem; the `SHA256SUMS` job is format-specific, file-only, and normally a pipeline
  task; per-row Copy + Verify cover the GUI need). Stays in the decision record's **Cut**.
- Results-panel source label wording + the `useCopyFeedback` hoist decision → Task 2b.

**AC6 — Enriched single view, fully Epic-7 tokenised.**
**Given** the redesigned Hash tool, **when** `HashView.vue` is rendered, **then** it is a single
enriched view (no `AppTabs.vue`, no mode switch) with the vertical order: input → algorithm
checkboxes → case/encoding controls → results panel → Verify panel; **and** no pre-Epic-7
hardcoded value remains — `#666` / `#ccc` / `#b00020` / `border-radius: 6px` / bare `monospace`
are all replaced by `--color-*` / `--radius-*` / `--spacing-*` / `--font-code-*` tokens
(`#b00020` → `--color-accent-destructive`), and `src/styles/base.css`'s bare-`<textarea>` styling
is not re-declared.

**AC7 — Algorithm selection via checkboxes, persisted.**
**Given** the tool, **when** it first mounts with no stored preference, **then** SHA-256 and
SHA-512 are checked and SHA3-256 / SHA3-512 / MD5 / SHA-1 are unchecked; **when** the user toggles
any algorithm checkbox, **then** the selection is written immediately to a `hash.*` key in the
`settings` Pinia store (added to the store's single-source `DEFAULTS` map so `init()` /
`clearAll()` / `resetKey()` cover it, surfaced in `SettingsView.vue`'s reset list, **no new
Settings section**) and restored on the next mount.

**AC8 — Only selected algorithms are computed; core returns an algorithm-keyed collection.**
**Given** a non-empty input and a selected algorithm subset, **when** a hash runs, **then**
`invoke("hash_compute", { input, algorithms })` is called with exactly the checked algorithms and
`crates/umbra-core/src/hash.rs` computes **only** those; **and** `compute` / `compute_bytes`
return an ordered `Vec<DigestEntry { algorithm: Algorithm, hex: String }>` (an `Algorithm` enum
replacing the `HashDigests { sha256, sha512, md5, sha1 }` struct), one entry per requested
algorithm, in a stable display order; **and** `src/tools/hash/hashDigests.ts` mirrors the new
`Algorithm` union + `DigestEntry` shape by hand. The 9 core unit tests and 10 `HashView.spec.ts`
tests are **rewritten** to the new signature (Story 8.2 AC14 *Amended* discipline — the rewrite
is recorded here, not silent).

**AC9 — SHA-3 is available and correct.**
**Given** SHA3-256 and/or SHA3-512 are checked, **when** a hash runs over a known input, **then**
the returned hex matches the published NIST test vector for that algorithm (asserted in a new core
unit test); **and** `crates/umbra-core/Cargo.toml` gains `sha3 = "0.11"` (RustCrypto, `Digest`
trait), `sha2` / `sha1` / `md-5` `"0.11"` unchanged, `blake2` / `blake3` **not** added; **and**
`cargo test --workspace` passes on all three CI OSes (AD-2 / AD-11).

**AC10 — Live as-you-type hashing replaces the Compute button.**
**Given** the tool, **when** the user edits the input, **then** the hash re-runs on a debounce
(`src/shell/debounce.ts`), and **when** the user changes an algorithm / case / encoding control,
**then** it re-runs immediately (no debounce); **and** there is no "Compute" button; **and** the
input is guarded by a frontend length ceiling before the 100 MiB server check, and the live path
is disabled / coalesced while a hash is in flight (both folded-in deferred-work items);
`debouncedX.cancel()` runs in `onUnmounted`.
*Amended (`bmad-code-review`, 2026-09-01):* the in-flight "disabled" state was missing entirely
until this review added it — added to the algorithm checkboxes and the Case/Encoding controls
only, deliberately **not** the text input itself. Disabling the textarea would block the user
from clearing or continuing to edit their own input while a slow hash computes — exactly the
interaction the coalescing runner (`rerunPending`, at most one trailing rerun queued) exists to
absorb, not something to block on. A regression test (`HashView.spec.ts`) initially added
`:disabled="hashing"` to the textarea too and caught its own bug: a disabled textarea silently
refused `.setValue()`, meaning a user genuinely could not clear the input while hashing.

**AC11 — Case and encoding are composing, view-side, persisted controls.**
**Given** a computed set of digests, **when** the user switches Case (`lower` ⇄ `UPPER`) or
Encoding (`Hex` ⇄ `Base64`), **then** every displayed digest re-renders from the same
core-returned canonical **lowercase-hex** value with **no** new `invoke` call (AD-1); Base64 is
the base64 of the **raw digest bytes** (hex → bytes → `btoa` in the view); the two controls
compose (e.g. `UPPER` + `Base64`); each selection persists as a `hash.*` setting.
*Amended (`bmad-code-review`, 2026-09-01):* Case applies to **Hex only** — uppercasing a Base64
string would corrupt its mixed-case alphabet, so Case is a no-op (and disabled in the UI, so the
control visibly communicates this) while Base64 encoding is active; the chosen Case is retained
and reapplied the moment the user switches back to Hex. "The two controls compose" describes Hex
+ Case only; Base64 output is always the raw digest bytes' Base64, independent of Case.

**AC12 — Per-row Copy is an icon-button with feedback.**
**Given** the results panel, **when** the user clicks a row's Copy control, **then** it is the
~24 px icon-button + `useCopyFeedback` pattern (`JsonTree.vue` / `Base64View.vue` /
`UuidView.vue`), it copies that row's **currently-displayed** string (case- and
encoding-respecting), it shows the signature-accent "copied" state (no separate success colour),
and the feedback clears on a fresh hash, a new drop, or any case / encoding / algorithm change.

**AC13 — MD5 and SHA-1 are labelled "not collision-resistant".**
**Given** the algorithm list and any MD5 / SHA-1 result row, **when** rendered, **then** the label
carries a "not collision-resistant" qualifier (new `tools.hash.*` key, `en` + `fr`, factual
instrument-voice phrasing, no emoji) — the `(legacy)` / `legacySuffix` string is removed.
*Amended (`bmad-code-review`, 2026-09-01):* the qualifier is not literal text appended to every
label — inline, it doubled every row's height and blew out the checkbox row. It lives behind a
`?` help affordance (`WeakHashPopover.vue`, the `AppPopover` + help-dot pattern UuidView
established), shown next to the "Algorithms" legend and on each MD5 / SHA-1 result row, opening
to a heading + the same "not collision-resistant" instrument-voice explanation. Each popover
instance carries a distinct accessible name (the legend's is general; each row's names its own
algorithm) so a screen-reader user can tell them apart.

**AC14 — Successful renders are announced; the source is named.**
**Given** a completed hash, **when** the results panel updates, **then** it carries a
`role="status"` / `aria-live` announcement (errors keep `role="alert"`); **and** the panel names
the source of the digests — "Text input" for typed text, the filename for a dropped file (the
folded-in deferred-work "no input-source label" item).

**AC15 — The file-drop path survives, carrying the selection.**
**Given** the `hash` registry entry, **when** a file is dropped anywhere in the window, **then**
`DropZone.vue` invokes `hash_compute_file` (AD-14 — the view does not re-dispatch) with the
current selected algorithm list supplied by a `registry.setDropArgsProvider("hash", …)` the view
registers on mount and clears on unmount; **and** the view consumes the outcome via
`registry.dropResult` (nulling the one-shot signal); **and** manual hashing, Paste and an
in-flight drop still share the one `registry.getLatestWinsRunner("hash")` (AD-16), unchanged.
`drop.acceptedMimeTypes` stays `[]` (pre-existing dead config, not fixed here); no
`clipboardMatch`, no `shortcut` added.

**AC16 — Verify compares a pasted digest against every selected algorithm.**
**Given** the persistent "Verify against a known hash" panel under the results, **when** it is
empty, **then** the result rows carry no match indicator and the tool behaves as a plain
calculator; **when** the user pastes an expected digest, **then** each selected result row shows
**match** or **does not match** against the current input, checked against **every** selected
algorithm (no algorithm guess), **and** a `role="status"` summary states how many matched
(e.g. "SHA-256 matches; SHA-512 and SHA3-256 do not"); **and** a mismatch is rendered as a flat
factual state — muted `--color-accent-destructive` text with a neutral glyph — **never**
`role="alert"`, **never** a destructive-filled box (EXPERIENCE.md instrument voice). No new
`ToolError` code is introduced.

**AC17 — Smart paste-detection offers, never auto-applies, and acknowledges the move.**
**Given** the input, **when** its content is **exactly** a bare hex string of a recognised digest
length (32 / 40 / 64 / 128 chars, whitespace-trimmed — only lengths a selectable algorithm can
actually produce; 56 / 96 were dropped at code review, see amendment below), **then** a
dismissible caption offers to move it to Verify, naming the likely algorithm(s) by length but not
gating on the guess; **when** the input is anything else, **then** no offer shows; **when** the
user accepts the offer, **then** the string is moved into the Verify field, the input is cleared
and relabelled, **and** the move is acknowledged below the Verify field — a briefly-tinted panel
("Moved here from the input above") with an **Undo** that restores the prior state — **and**
nothing is ever moved without the click (AD-9); **and**, if the user has since edited the input
or Verify already holds unrelated content, the move/undo does not silently overwrite it — a
confirm step gates the overwrite. New `tools.hash.*` keys for the offer text, the acknowledgement
line, Undo, and the overwrite confirmation (`en` + `fr`).
*Amended (`bmad-code-review`, 2026-09-01):* three changes from the original text. (1) The
acknowledgement is **one-ended**, not two-ended — nothing is shown near the input; only the
Verify-panel tint + caption + Undo, deliberately kept below the field so its appearance/
disappearance never shifts the input's layout. (2) The 56 / 96-char hex lengths (and their
28/48-byte Base64 equivalents) were dropped from the detection hints — no selectable algorithm
(SHA-256/512, SHA3-256/512, MD5, SHA-1) produces them, so an offer naming SHA-224/SHA3-224 or
SHA-384/SHA3-384 was a guaranteed dead end (Verify can never match against an algorithm the tool
doesn't compute). (3) Move/Undo gained a confirm step neither the original ACs nor the shipped
Task 2b code first had — see the code-review Change Log.

**AC18 — No new translatable error codes; French rides the existing seam.**
**Given** `src/shell/toolError.ts`, **when** this story ships, **then** `TRANSLATABLE_CODES` is
**unchanged** (no `hash-*` entry); `hash-input-too-large`, `hash-internal` and `file-read-error`
still render raw via `toolErrorMessage`; every new user-facing string (algorithm qualifiers,
encoding labels, Verify label / placeholder / status, "does not match", the smart-detection
offer + acknowledgements, the source label, the results announcement) is a plain `t()` call with
`en` + `fr` entries that compile under `src/locales/locales.spec.ts` (literal braces escaped
`{'{'}` proactively). No AD-13-style disclosed exception is needed.

**AC19 — The 100 MiB cap is preserved end to end.**
**Given** either input path, **when** the input exceeds `MAX_INPUT_BYTES` (100 MiB), **then**
text is rejected in `umbra-core` and a dropped file is rejected by the metadata `check_file_size`
**before** it is read, both surfacing `hash-input-too-large` (`position: None`) rendered inline;
under-cap inputs compute normally.

**AC20 — Scope stays inside the tool's island.**
**Given** the diff for this story, **when** it is reviewed, **then** the only files outside
`src/tools/hash/`, `crates/umbra-core/src/hash.rs` (+ `Cargo.toml`) and `src-tauri/src/commands/
hash.rs` that are touched are `src/stores/registry.ts` (the `dropArgsProvider` wire-up, plus a
`dropSourcePath` field — see amendment), `src/stores/settings.ts` (+ `settings.spec.ts` — new
`hash.*` keys), `src/locales/{en,fr}.json`, `src/shell/DropZone.vue` (+ `dropZone.spec.ts`), and
`src/styles/tokens.css`; `src-tauri/src/lib.rs`'s handler registration is **unchanged** (no new
command); no digest-export command is added; the shared-`fs_helper` TOCTOU fix and the
multi-file-drop behaviour remain **flagged for the developer as separate follow-ups**, not
changed here.
*Amended (`bmad-code-review`, 2026-09-01):* the original text didn't disclose two shared-file
touches the shipped diff makes, caught at code review as a governance gap (CLAUDE.md: new
shared-infrastructure changes must be presented, not silently folded in). Confirmed with the
developer: both stand, disclosed here rather than reverted.
- **`src/shell/DropZone.vue` + `src/stores/registry.ts`'s `dropSourcePath` field.** AC15's
  algorithm-set-change re-hash needs the dropped file's path after the one-shot
  `hash_compute_file` dispatch completes; `DropZone.vue` (the shell's single generic dispatcher,
  AD-14) now forwards it via a new `registry.dropSourcePath` field alongside `dropResult`. Tagged
  with `toolId` (`{ toolId, path } | null`) to match `dropResult`'s shape, so a second future
  consumer can't misread a value meant for a different tool.
- **`src/styles/tokens.css`'s `--color-accent-success` token.** AC16's Verify "match" state is
  this tool's first use of a general success/affirmative color (opposite
  `--color-accent-destructive`'s "does not match"); added by developer direction.
  `DESIGN.md`'s colour table owes a matching entry as a follow-up (that doc is otherwise locked).

## Tasks / Subtasks

- [x] **Task 0: Branch setup (AC: all)**
  - [x] Confirm `baseline_commit` (`d428db9`) is still `origin/main`'s real tip before branching (`git rev-parse origin/main` — was `d428db9a3f29e4d5f66a1abb6e80a81c68f65ea7` at story-creation, HEAD == origin/main, tree clean apart from untracked `.claude/workflows/`). Verified 2026-08-31: `git rev-parse HEAD` == `git rev-parse origin/main` == `d428db9a3f29e4d5f66a1abb6e80a81c68f65ea7`; working tree clean apart from the untracked story file, the `sprint-status.yaml` edit, and the pre-existing untracked `.claude/workflows/`.
  - [x] `git checkout -b feat/story-8-4-reimagine-the-hash-generator` from the story-creation commit (so the story file + decision record travel with the implementation branch — matches how 8.1, 8.2 and 8.3 were branched). Every subsequent commit lands on this branch. Move the story `ready-for-dev` → `in-progress` in `sprint-status.yaml`. Done 2026-08-31: HEAD was already exactly `d428db9` (the story was never committed at creation, unlike 8.3's `bf7762d`), so `git checkout -b` from `main`'s tip is equivalent — the untracked story file and the `sprint-status.yaml` edit rode the working tree onto the new branch. `sprint-status.yaml` `8-4-reimagine-the-hash-generator` `ready-for-dev` → `in-progress`.

- [x] **Task 1: Discovery — produce the decision record (AC1–4)** — done 2026-08-31. `bmad-party-mode` session (installed roster), decision record at `_bmad-output/implementation-artifacts/8-4-hash-decision-record.md`, container-shape design canvas published (`https://claude.ai/code/artifact/c928d06d-a86d-4e32-8ad5-a8764fd3af67`), developer confirmed scope. See Dev Agent Record.
  - [x] Run `bmad-party-mode` (installed roster — Mary, John, Sally, Winston, Amelia, Paige; `session` mode; party memory on, resuming the 8.1/8.2/8.3 history) **or** `bmad-forge-idea` for a narrower persona-driven pressure-test — **the developer's choice for this story**. Frame it explicitly as: *open scope discovery for the Hash Generator — the existing implementation is reference only, not a scope to preserve.* Task 1 is a facilitated session requiring the developer's cut/keep/add judgement — **run interactively, not autonomously** (halt here for the developer's method choice). Developer chose `bmad-party-mode`; ran interactively across the discovery.
  - [x] Feed the session the current, real state so it starts from fact (re-read all five source files + i18n + registry entry at session start and confirm no drift vs. the Dev Notes below): all five source files + i18n + `toolError.ts` + registry entry + `lib.rs` + `Cargo.toml`/`Cargo.lock` re-read in full — **no drift found** vs. the Dev Notes (stated explicitly in the decision record).
    - `crates/umbra-core/src/hash.rs` (152 lines, **9** unit tests): `pub struct HashDigests { sha256, sha512, md5, sha1: String }`; `pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024` (`pub` so the command layer reuses it for the file-size guard — Story 2.5, no duplicated literal); `fn to_hex_lower(&[u8]) -> String`; `pub fn compute_bytes(&[u8]) -> Result<HashDigests, ToolError>` (the **single** implementation — `hash-input-too-large` with the byte count in the message, `position: None`, over cap); `pub fn compute(&str) -> Result<HashDigests, ToolError>` (thin wrapper over `compute_bytes` on `input.as_bytes()`). Digests are **always lowercase hex** — case is a presentation concern, core emits exactly one canonical output per algorithm (AD-1). Crates: `sha2`/`sha1`/`md-5` all `"0.11"` (`Cargo.lock`: `sha2` 0.11.0, `sha1` 0.11.0, `md-5` 0.11.0, `digest` 0.11.3) — RustCrypto, `Digest` trait, `Sha256::digest(bytes)` one-shot API.
    - `src-tauri/src/commands/hash.rs` (125 lines, **6** command tests): `#[tauri::command] pub async fn hash_compute(input: String) -> Result<HashDigests, ToolError>` — `spawn_blocking` (AD-4), `map_join_error` → `hash-internal` on a join panic. `#[tauri::command] pub async fn hash_compute_file(path: String) -> Result<HashDigests, ToolError>` — `spawn_blocking`: `check_file_size(&path)?` (`std::fs::metadata().len()` → `file-read-error` on metadata failure, `hash-input-too-large` if `len > MAX_INPUT_BYTES` — checked **before** any read, so an oversized file is never materialised) → `crate::fs_helper::read_file_bytes(&path)?` → `compute_bytes(&bytes)`. `src-tauri` has **no** direct hash-crate dependency — the transformation and its types live in `umbra-core` only (AD-1). Registered in `src-tauri/src/lib.rs`: `use commands::hash::{hash_compute, hash_compute_file};` + both names in the `generate_handler!` list (lines ~63–64).
    - `src/tools/hash/HashView.vue` (241 lines, **100% pre-Epic-7** — no design tokens anywhere): `input` ref (textarea); `digests` ref `HashDigests | null`; `caseMode` ref `"lower" | "upper"` (radio `<fieldset>`); `error` ref `ToolError | null`. `const ROW_DEFS` — `sha256`/`sha512` (`legacy: false`), `md5`/`sha1` (`legacy: true`); algorithm names are **not** translated (proper nouns, same reasoning as tool names). `registry.getLatestWinsRunner("hash")` — **shared with `DropZone.vue`'s file-drop dispatch** for this same tool, so a manual Compute/Paste and an in-flight file drop are one latest-wins sequence (AD-16). `watch(() => registry.dropResult, …)` — if `result.toolId === "hash"`: null the signal, then set `digests`/`error` from the `value`/`error` branch (AD-14 — DropZone invoked `hash_compute_file`, the view only consumes). `rows` computed — `.toUpperCase()` when `caseMode === "upper"`, a **pure view-side re-render, never a new `hash_compute` call** (AD-1). `onCompute()` — `runLatestWins(() => invoke("hash_compute", { input }))`, set `digests` if `!superseded`; catch → `digests = null; error = toToolError(err)`. `onPaste()` — `runLatestWins(() => readClipboardText())`, set `input` + clear `digests` if `!superseded`. `onCopyOne(value)` — `writeClipboardText(value)`. Template: `<h1>`; a `.drop-hint` `<p>` (`tools.hash.dropHint`); `.field` label + `<textarea rows="10" spellcheck="false" autocorrect="off">`; a case `<fieldset><legend>` + two radios; `.actions` — `<AppButton variant="primary">` Compute + `<AppButton>` Paste (`common.pasteFromClipboard`); `<p role="alert">` (raw `toolErrorMessage(error, t)`); `.results` `<ul>`, one `<li>` per row = `<label>` (legacy suffix via `t('tools.hash.legacySuffix', { algorithm })`) + `<code>` + `<AppButton>` Copy (`common.copy`).
    - `src/tools/hash/hashDigests.ts` (7 lines): `export interface HashDigests { sha256; sha512; md5; sha1: string }` — a **hand-synced** mirror of the Rust struct; line 1 comment says keep the two in sync by hand. (The `uuidVersion.ts` analogue for Story 8.3.)
    - `src/tools/hash/HashView.spec.ts` (227 lines, **10** tests): computes + renders 4 digests, asserting `invoke("hash_compute", { input: "abc" })` (AC1); MD5/SHA-1 rows carry "legacy", SHA-256/512 don't (AC1); case toggle re-renders both extremes with **no** second invoke (AC2); `hash-input-too-large` rejection rendered inline (asserts the raw byte-limit message); per-row Copy copies the **case-respecting** (uppercased) string; Paste populates the textarea and clears prior rows; a successful `registry.dropResult` for `"hash"` fills 4 rows and nulls the signal (AC1); a `dropResult` for a different tool is ignored; a `file-read-error` drop `dropResult` renders inline and clears prior digests (AC3); a `hash-input-too-large` drop `dropResult` renders inline (AC3). Mounts with `createPinia()`; mocks `@tauri-apps/api/core` `invoke` and `@tauri-apps/plugin-clipboard-manager` `readText`/`writeText`.
    - i18n: `tools.hash.*` in `src/locales/{en,fr}.json` — `description`, `heading`, `dropHint`, `inputLabel`, `caseLegend`, `caseLower`, `caseUpper`, `compute`, `legacySuffix` (`{algorithm}` param). Shared keys used: `common.pasteFromClipboard`, `common.copy`. **No `errors.hash-*` keys** — `hash-input-too-large` / `hash-internal` / `file-read-error` all render raw. `src/locales/locales.spec.ts` runs every message through vue-i18n's real compiler.
    - Registry: `src/stores/registry.ts` (~line 115) — `{ id: "hash", name: "Hash", descriptionKey: "tools.hash.description", aliases: ["hash","checksum","sha256","sha512","md5","sha1","digest","hachage","empreinte"], route: "/tools/hash", icon: "hash", component: …, drop: { acceptedMimeTypes: [], handler: "hash_compute_file" } }`. **No `clipboardMatch`**, **no `shortcut`**. `icon: "hash"` → `PhHash` via `src/shell/icons.ts`.
    - `src/shell/toolError.ts` — `TRANSLATABLE_CODES` holds `uuid-count-zero`, every `json-*` classification code, every `base64-*` decode code. **No `hash-*` entry.**
  - [x] Ground the session in what Epic 7 locked — read `src/styles/tokens.css`, `src/styles/base.css`, `src/components/AppButton.vue`, `src/components/AppTabs.vue`, `src/components/AppPopover.vue` (the shared floating surface **built in Story 8.3**), `src/App.vue`, `src/shell/icons.ts`, and both redesign references `src/tools/json/JsonView.vue` (tabs) and `src/tools/base64/Base64View.vue` (single enriched view **with a live file/drop path and a save-to-file path** — the closest structural precedent for Hash) to pin exact token values, component anatomy, and the main-pane frame before any design canvas. `tokens.css`, `AppButton.vue`, `AppTabs.vue`, `AppPopover.vue`, `Base64View.vue` (full) read this session.
  - [x] Run a competitive sweep — CyberChef (its multi-hash "recipe" and the "Analyse hash" op), online multi-hash pages (hashgenerator-style sites), the platform `sha256sum` / `shasum` / `md5sum` CLIs (and their `-c` / `--check` verify mode), `openssl dgst`, browser-devtools `crypto.subtle.digest`, GtkHash / Hashcalc-style desktop tools, and package-manager checksum-verification UX — for evidenced scope candidates. Swept (web search + prior knowledge): hex is the universal default, Base64 the industry-standard second encoding; SHA-3 widely offered, BLAKE2b the standardised BLAKE option, BLAKE3 the fast non-standardised one; `-c`/verify mode is a first-class CLI feature — drove the Verify-mode decision.
  - [x] Produce the written decision record satisfying AC1–AC4 to `_bmad-output/implementation-artifacts/8-4-hash-decision-record.md`, mirroring `8-1-json-decision-record.md` / `8-2-base64-decision-record.md` / `8-3-uuid-decision-record.md`: **Kept / Changed (interaction) / Added / Cut (backlog)** with rationale each; **container shape** decision (single enriched view à la Base64, tabs à la JSON, or something smaller — and whether `AppTabs.vue` is used); **FR14 + FR15 revision**; **AD-1 core-split** (what survives, what needs new pure fns, whether the command surface / `hashDigests.ts` / `Cargo.toml` hash-crate set / registry `drop` entry change); **i18n / `TRANSLATABLE_CODES` finding**; **open items Task 2 still owns**. Written — all sections present. Chosen container: **enriched single view (Option 1) + a smart paste-detection shortcut into a persistent Verify field**; `AppTabs.vue` **not** used.
  - [x] AC3: capture each cut idea against the project's idea backlog — draft an individual max-context body per idea in the decision record, then file as `backlog-candidate` GitHub issues on `dipaneb/umbra` linking back to the record, **unless** the developer directs otherwise (Story 8.3 precedent — personal backlog, deviation logged). **Developer directed otherwise (2026-08-31): nothing filed to GitHub, nothing added to a tracked backlog.** Cut ideas (BLAKE2b/BLAKE3, byte-grouped hex / `0x` prefix, HMAC mode, signature sign/verify tool, digest-export) are documented in the decision record's **Cut** section for traceability only. Deviation logged here and in the record — 8.3 precedent.
  - [x] Optional (8.2 / 8.3 precedent): build a container-shape + affordance comparison canvas matching Umbra's real token system, publish as an Artifact, let the developer choose. Those picks feed Task 2a's ACs. Built + published: "Hash Generator Redesign" (`https://claude.ai/code/artifact/c928d06d-a86d-4e32-8ad5-a8764fd3af67`) — 6 artboards across 3 pages (Option 1 resting + comparing; Option 4 offer + post-"Compare"; Options 2/3 "also considered"). Developer picked Option 1 + smart detection.
  - [x] Developer confirms the scope decisions and open questions before Task 2 begins. Confirmed 2026-08-31: Option 1 container + smart paste-detection that **moves** a bare-hash input into the Verify field **with a visible acknowledgement** (no silent swap); SHA3-256 + SHA3-512 added; user-selects-algorithms via checkboxes (persisted `hash.*`); hex + Base64 encoding; live as-you-type hashing; MD5/SHA-1 relabelled "not collision-resistant"; UI quality bar = the UUID 8.3 redesign, not the exploration wireframes.

- [x] **Task 2a: Redesign ACs — write real Given/When/Then** (Task 1's record exists; canvas picks in) — done 2026-09-01. AC6–AC20 written into the "Acceptance Criteria — Task 2 (Redesign)" section above; polished design canvas published (`https://claude.ai/code/artifact/c928d06d-a86d-4e32-8ad5-a8764fd3af67` — Default / Verify active / Smart-detection offer / After "Move it to Verify"). Developer signed off on the AC set 2026-09-01.
  - [x] In the same discovery room, resolve the decision record's open items and write real AC6+ into the "Acceptance Criteria — Task 2 (Redesign)" section above, scoped strictly to `8-4-hash-decision-record.md` plus the developer's canvas picks. Await the developer's sign-off on the AC set before 2b. Open items resolved and recorded in the AC section's preamble; 15 ACs (AC6–AC20) written; digest-export confirmed **out**; developer signed off 2026-09-01.

- [x] **Task 2b: Redesign — implementation** (after the AC set is confirmed) — implemented 2026-09-01, committed as `c536113`; `bmad-code-review` findings (21 patch items) applied the same session — see Change Log and Review Findings below.
  - [x] Follow the delivery pattern Stories 8.1, 8.2 and 8.3 established: **vertical slices, developer render-review after each slice.** Per slice: pure Rust fn + regression tests → `hash_<verb>` command (`spawn_blocking`, `Result<T, ToolError>`, AD-3/AD-4, only if the command surface changes) → Vue → full verification pass (`pnpm lint`, `pnpm test`, `vue-tsc --noEmit`, `pnpm build`, `cargo fmt --check`, `cargo test --workspace`, `cargo clippy --workspace --all-targets`) → visual check in `pnpm tauri dev` → commit, **ask before pushing**.
  - [x] First slice is the Epic-7 tokenization pass + restructure to the chosen container (the tool is 100% pre-Epic-7 — see Dev Notes).

### Review Findings

_`bmad-code-review` against `main...HEAD` (2026-09-01), three parallel adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor against AC6–AC20) — 36 raw findings, 26 after dedup, 5 dismissed as noise (see below), 6 decision-needed (all resolved live with the developer 2026-09-01), 21 patch (all applied 2026-09-01)._

- [x] [Review][Patch][Decision resolved] Paste-from-clipboard button removed — developer confirmed intentional: amend `8-4-hash-decision-record.md`'s "Kept" section and this story's Change Log to log the cut (button stays removed; native Ctrl+V remains the paste path). [src/tools/hash/HashView.vue, _bmad-output/implementation-artifacts/8-4-hash-decision-record.md]
- [x] [Review][Patch][Decision resolved] Move/Undo can silently discard user data — developer chose: add a lightweight inline confirmation before either overwrite (moving into a non-empty Verify field; Undo overwriting input the user has since edited). [src/tools/hash/HashView.vue:226-253]
- [x] [Review][Patch][Decision resolved] `registry.dropSourcePath` not namespaced by `toolId` — developer chose: change it to `{ toolId: string; path: string } | null` matching `dropResult`'s shape. [src/stores/registry.ts:223-231, src/shell/DropZone.vue:104-113]
- [x] [Review][Patch][Decision resolved] Undisclosed shared-file changes (`DropZone.vue` `dropSourcePath`, `tokens.css` `--color-accent-success`) outside AC20's whitelist — developer chose: accept both, log them retroactively in AC20, the File List, and the Change Log rather than reverting. [_bmad-output/implementation-artifacts/8-4-reimagine-the-hash-generator.md]
- [x] [Review][Patch][Decision resolved] AC17 one-ended move acknowledgement — developer chose: amend AC17's text to describe the shipped one-ended (Verify-panel-only) design rather than implementing an input-side note. [_bmad-output/implementation-artifacts/8-4-reimagine-the-hash-generator.md]
- [x] [Review][Patch][Decision resolved] AC13 qualifier hidden behind a popover — developer chose: amend AC13's text to describe the shipped popover design rather than adding an inline label qualifier. [_bmad-output/implementation-artifacts/8-4-reimagine-the-hash-generator.md]
- [x] [Review][Patch][Decision resolved] AC11 Case silently no-ops under Base64 encoding — developer chose: visually disable the Case segmented control while Base64 encoding is active, so the UI communicates the control is inert (AC11's text may still warrant a follow-up note that Case applies to Hex only). [src/tools/hash/HashView.vue:115-118]
- [x] [Review][Patch] Fast-path early returns bypass the shared latest-wins runner, allowing stale results to overwrite fresh ones [src/tools/hash/HashView.vue:290-336]
- [x] [Review][Patch] Verify's Base64 comparison requires byte-exact padding, producing false "does not match" on unpadded input [src/tools/hash/HashView.vue:129-133]
- [x] [Review][Patch] Paste-detection hints name algorithms the tool cannot select or verify against (SHA-224/SHA3-224, SHA-384/SHA3-384) [src/tools/hash/HashView.vue:162-180]
- [x] [Review][Patch] Multiple `WeakHashPopover` instances share an identical, non-parameterized accessible name [src/tools/hash/WeakHashPopover.vue:23,31]
- [x] [Review][Patch] Smart-detection offer button's `aria-label` doesn't contain its visible label text (WCAG 2.5.3) [src/tools/hash/HashView.vue:451-455]
- [x] [Review][Patch] A second failed file drop doesn't reset `source`/`droppedPath`, so a later algorithm toggle can silently re-hash a stale file [src/tools/hash/HashView.vue:365-391]
- [x] [Review][Patch] AC16 partial-match Verify summary omits which algorithms didn't match, unlike AC16's own example text [src/tools/hash/HashView.vue:148-157]
- [x] [Review][Patch] AC10's promised in-flight "disabled" state was never implemented — only invoke-coalescing exists [src/tools/hash/HashView.vue]
- [x] [Review][Patch] `hash_compute`/`hash_compute_file`'s `algorithms` array has no length cap or dedup, an unbounded-cost gap in the CWE-400 family the size cap is meant to close [src-tauri/src/commands/hash.rs:5-12,15-29]
- [x] [Review][Patch] Dropping a file with every algorithm unchecked still triggers a full (up to 100 MiB) file read before returning an empty result [src-tauri/src/commands/hash.rs:15-29, src/tools/hash/HashView.vue:352-354]
- [x] [Review][Patch] Verify doesn't tolerate a copied `sha256sum`-style "`<hash>  <filename>`" line, producing a false "does not match" [src/tools/hash/HashView.vue:129-133]
- [x] [Review][Patch] Unchecking every algorithm produces a blank results area with no explanatory hint [src/tools/hash/HashView.vue]
- [x] [Review][Patch] Registry `hash` entry's search aliases weren't extended for SHA-3 [src/stores/registry.ts]
- [x] [Review][Patch] Missing regression test for "digests clear when a new failure follows a prior success" — a fix the decision record explicitly commits to closing in Task 2b [src/tools/hash/HashView.spec.ts]
- [x] [Review][Patch] Story tracking file (this file) is out of sync with the diff under review — Task 2b's checkbox and File List/Change Log don't reflect the actual touched files [this file]

_Dismissed as noise (5): `dropZone.spec.ts`'s hash-drop test using an old digest shape — false positive, the test explicitly targets the "no dropArgsProvider registered" path and DropZone treats the payload as opaque `unknown`; `MAX_INPUT_BYTES` duplicated in the frontend — intentional documented defense-in-depth mirror, consistent with the rest of the codebase; `Cargo.lock`'s two `cpufeatures` versions — normal transitive dependency resolution, no actionable fix; an algorithm-toggle-and-text-edit landing in the same reactivity flush — real but requires two simultaneous user inputs in one tick, mild consequence (falls back to the debounce) even if it occurred; un-debounced `pasteDetection` on a very large paste — bounded, linear-time, one-time cost on an edge-case-sized paste only._

## Dev Notes

- **This is the fourth instance of Epic 8's "Task 1 decision record gates Task 2" shape — the first three are proven.** Stories 8.1 (`8-1-reimagine-the-json-formatter-viewer.md`), 8.2 (`8-2-reimagine-base64-encode-decode.md`) and 8.3 (`8-3-reimagine-the-uuid-generator.md`) each executed the full pattern end to end: discovery → decision record → Task 2a AC-writing in the same room → per-slice implementation with a developer render-review pass → `bmad-code-review` → done. **Use Story 8.3's story file + `8-3-uuid-decision-record.md` as the working template** (8.1 and 8.2 are complete references too). 8.3 is the closest analogue for the *format-toggle + persisted `tool.*` setting* pattern; **8.2 is the closest analogue for the *file/drop + save-to-file* pattern** Hash already has.

- **Current implementation, read in full this drafting session — the discovery session's factual starting point, NOT this story's scope:** see Task 1's "feed the session" bullet for the full five-file breakdown. Summary: a small tool — one Vue view (241 lines, entirely pre-Epic-7) with a textarea + Paste, a `lower`/`UPPERCASE` radio, and a Compute button; four digests computed simultaneously by `compute()` / `compute_bytes()` in core (one lowercase-hex string each, 100 MiB cap, `hash-input-too-large`); two thin `spawn_blocking` commands (`hash_compute` for text, `hash_compute_file` for drops); a 9-key i18n block; and a registry `drop` entry.

- **What makes Hash different from UUID (8.3) — carry into discovery framing:**
  1. **Hash already has a file/drop path.** `hash_compute_file` + the `drop` registry entry + the shared `registry.getLatestWinsRunner("hash")` are a real, tested interaction surface (AD-14/AD-16). UUID had none. The redesign must **preserve or deliberately reshape** the drop flow, `registry.dropResult` consumption, and the shared-runner coordination — not accidentally drop them. `Base64View.vue` is the reference for a redesigned single view that keeps a live drop path.
  2. **Hash already touches the filesystem** (read side, via `hash_compute_file` → `fs_helper::read_file_bytes`, AD-15). Any "save digests to a file" addition (8.3-style `.txt`/`.csv` export) would add the **write** side — a new `hash_<verb>` command → `fs_helper::write_file_bytes` (AD-15, atomic temp-then-rename), exactly as `uuid_export` / `base64_decode_to_file` do.
  3. **Hash already has the case toggle** that 8.3 had to *add*. `lower`/`UPPERCASE` view-side re-render is **Kept**, not Added. The open "Added" question is whether more output presentations are wanted (e.g. Base64/`base64url` digest encoding, byte-grouped hex, a `0x` prefix) — all still view-side `String` transforms on core's canonical lowercase hex (AD-1), never new core functions.
  4. **Hash has no bulk / count.** One input → four digests. No "generate N", no virtualization question, no per-row list of arbitrary length (always exactly 4 rows).

- **FR mapping. FR14** — "Compute SHA-256 and SHA-512 of text input, plus MD5 and SHA-1 labeled as legacy, shown simultaneously; hex output with uppercase/lowercase toggle. bcrypt/argon2 excluded (P3 backlog candidate)." **FR15** — "Compute the same digests for a dropped file." Epic 8's preamble makes the FR14/FR15 revision this story's own output — do **not** treat the current wording as fixed. Story 2.4 (`epics.md` ~575, Hash text) and Story 2.5 (`epics.md` ~596, Hash files) are the original, reference-only acceptance criteria.

- **Discrepancies / gotchas found this session — carry into Task 1/2, do not "fix" reflexively:**
  1. **`hash-input-too-large` embeds the byte count in its `message` prose** → it stays **out** of `TRANSLATABLE_CODES` for the same reason `uuid-count-too-large` and `json-input-too-large` do. `hash-internal` and `file-read-error` are also raw. If Task 1 adds a classified failure mode (e.g. an HMAC key-format error, a checksum-mismatch state), decide per the 8.1/8.2 pattern: a code carrying **no** runtime value in its message can join `TRANSLATABLE_CODES` and use `t(errors.<code>)`; one embedding a count/limit/name stays out. Note "checksum mismatch" is arguably a **result state, not an error** — an inline status, not a `role="alert"`.
  2. **`hashDigests.ts` must stay hand-synced** with the Rust `HashDigests` struct. If Task 2 adds an algorithm (SHA-3, BLAKE2/3, CRC32, …) it changes the struct, the `Cargo.toml` crate set, `ROW_DEFS` in the view, *and* this TS mirror — AC4 calls this out. If the digest set becomes dynamic (a user-selected subset), the shape changes more fundamentally — a decision to record, not a silent refactor.
  3. **The registry entry has `drop` but no `clipboardMatch`.** Hash consumes a dropped file; it does not currently sniff the clipboard. If Task 1 proposes "auto-hash whatever's on the clipboard" or a Story 7.8 clipboard-suggestion hook, adding `clipboardMatch` to the registry entry is a **shell concern** (AD-6): present it as options with trade-offs, don't decide it silently inside this story.
  4. **`acceptedMimeTypes: []` is dead configuration** (`deferred-work.md` line 46) — declared on every drop-capable entry, read nowhere. Pre-existing since Story 2.2. Not this story's bug to fix, but if the redesign touches the `drop` shape, note it.
  5. **`deferred-work.md` logs 11 items against the Hash tool** across two reviews (Story 2.5, lines 42–51; Story 2.4, lines 84–90) — several app-wide. Task 2 should **fold the Hash-specific ones in rather than re-deferring** (the 8.3 precedent — folding in `role="status"`, in-flight disable, tokenised alert colour). Re-read that file's two Hash blocks before Task 2b. The relevant ones:
     - **No loading / disabled state on Compute/Paste while a call is in flight** — rapid re-clicks stack concurrent `hash_compute` over up to 100 MiB (line 87). App-wide pattern; 8.3 fixed its equivalent (Generate disabled in-flight).
     - **No frontend size guard on the `<textarea>`** before the 100 MiB server check — a huge paste janks the webview via Vue reactivity alone (line 88).
     - **Per-row Copy gives no success feedback** — no "Copied", no `aria-live` (line 89). 8.3 fixed its equivalent with the `useCopyFeedback` icon-button pattern.
     - **No `role="status"` / `aria-live` on a successful digest render** (implied by line 89's `aria-live` note) — errors get `role="alert"`, success is silent.
     - **No indication which input the digests belong to** — after a drop, `digests.value` is overwritten but the textarea is untouched; no filename/source label (line 51). Compounded by, distinct from, the latest-wins coordination.
     - **No loading/progress feedback while a dropped file is hashing** — a multi-second round trip has no spinner (line 50).
     - **Multi-file drops silently hash only the first file**, no notice (line 47). Pre-existing `DropZone.vue`/`routeDrop` behaviour — a shell concern (AD-6), flag don't silently fix.
     - **`HashView.spec.ts` has no regression test** proving `digests.value` is cleared when a NEW failure follows a prior success (line 90) — the behaviour is correct in `onCompute`'s catch; the coverage gap is easy to close in Task 2b.
     - **TOCTOU gap** between `check_file_size`'s metadata check and the later `read_file_bytes` read (lines 44–45) — a file that grows between the two calls can be read past `MAX_INPUT_BYTES`. Shared verbatim with `base64.rs`; candidate for a shared bounded-read helper in `fs_helper.rs`. **Fixing only `hash.rs` would leave `base64.rs` equally exposed** — a cross-tool infra decision (AD-6 / CLAUDE.md governance), not a quiet in-story patch. Flag for the developer.

- **Architecture boundaries Task 1 must scope against and Task 2 must obey:**
  - **AD-1** — every transformation is a pure function in `umbra-core::hash`; the view renders. **Presentation formatting is view-owned, never core.** Load-bearing here: the likeliest "Added" output candidates — Base64/`base64url` digest encoding, byte-grouped hex, a `0x` prefix, uppercase (already done) — are all *view-side string transforms on core's canonical lowercase-hex output*, **not** new core functions. Core returns the canonical hex; the view formats it. Only genuinely new *digest* logic (a new algorithm, HMAC, a streaming/incremental hash) is new core work.
  - **AD-3** — every command returns `Result<T, ToolError>`; the view renders from `ToolError` structure only (`code`, `position`), never by parsing `message`. Commands are `hash_<verb>`.
  - **AD-4** — anything that can exceed ~100 ms CPU runs on the blocking pool via `spawn_blocking` (both hash commands already do). A large dropped file already hashes off the UI thread; a redesign must not move that work back onto it.
  - **AD-6** — tools are islands. Do not touch another tool's files. Cross-cutting state lives only in the `settings` / `registry` Pinia stores; a new `clipboardMatch` is a registry-shape change (gotcha 3); a shared `fs_helper` bounded-read is cross-tool infra (gotcha 5).
  - **AD-10** — if Task 2 adds a persisted preference (default case, a default output encoding, a default algorithm subset), it is a `hash.*`-namespaced key in the `settings` Pinia store — **Story 8.3 established this exact pattern** with `uuid.formatCase` / `uuid.formatBraces` / `uuid.formatHyphens` (the first non-`shell.` namespace): add each key to the store's single-source `DEFAULTS` map so `init()`, `clearAll()` and `resetKey()` cover it automatically, read on mount, write an immediate `set` + `save` on change (the store's discrete-value setters are **not** debounced — only `writeGeometry` is), and it surfaces in `SettingsView.vue`'s existing "stored data → reset" list with **no new Settings section**.
  - **AD-13 honesty** — Hash has no natural-language grammar and no heuristic "guess", so no AD-13-style disclosed exception is needed and French rides the existing `vue-i18n` seam. Algorithm names (SHA-256, MD5, …) are deliberately **not** translated — proper nouns / standard identifiers.
  - **AD-14** — the shell owns OS I/O edges exactly once. `DropZone.vue` is the single generic drop dispatcher; it invokes `hash_compute_file` and publishes `registry.dropResult`. The view **consumes**, it does not re-dispatch. Keep it that way.
  - **AD-15** — files cross IPC as **paths**; `umbra-core` never touches the filesystem. `hash_compute_file` reads via `crate::fs_helper::read_file_bytes` in `src-tauri`. Any "save digests" addition writes via `crate::fs_helper::write_file_bytes` (atomic temp-then-rename) — never from core.
  - **AD-16** — one `createLatestWinsRunner()` per *independent* piece of state. Today **one shared** `registry.getLatestWinsRunner("hash")` backs manual Compute + Paste + the in-flight file drop, because all three write the same `digests`/`error` surface — this is **correct as-is and is the reference implementation** for "a drop plus an in-view invoke write the same surface" (cited in Story 8.3's Dev Notes). `CronView.vue`'s two-section split is the cautionary precedent the other way (a tool-wide runner falsely supersedes an unrelated section). If Task 2 splits Hash into genuinely independent panels (e.g. a Compute panel and an independent Verify/compare panel), scope **one runner per group**.
  - **AD-2 / AD-11** — `umbra-core` imports no `tauri` crate and has zero `#[cfg(target_os)]`; CI runs `cargo test --workspace` on all three OSes. Any new hash-crate feature/dependency must build clean cross-platform.

- **Dependency note (standing verification discipline — Consistency Conventions table).** The hash crates are pinned in `crates/umbra-core/Cargo.toml`: `sha2 = "0.11"`, `sha1 = "0.11"`, `md-5 = "0.11"` (RustCrypto). `Cargo.lock` resolves `sha2` 0.11.0, `sha1` 0.11.0, `md-5` 0.11.0, `digest` 0.11.3. **Re-verify current via Context7 (`/RustCrypto/hashes`) at discovery start** — the 0.11 line is relatively recent (a `digest` 0.11 major bump from the widespread 0.10). If Task 1 decides to add algorithms:
  - **SHA-3 / Keccak** → `sha3` crate (same RustCrypto `Digest` trait, same one-shot API) — a clean add, one `HashDigests` field + one `ROW_DEFS` entry + the TS mirror + a Cargo dep per algorithm.
  - **BLAKE2** → `blake2`; **BLAKE3** → `blake3` (not RustCrypto-`Digest`-shaped — its own API; verify the interop cost).
  - **CRC32 / Adler-32** → checksums, not cryptographic hashes — a different mental model; decide whether they belong in a "hash" tool at all.
  - **HMAC** → `hmac` crate over any `Digest` — needs a **key input** (text or hex/base64), a genuinely different UI shape, and a `hash-*` error for a malformed key. Record the exact crate set in the decision record's AD-1 split (AC4) and in the Stack table if it changes.

- **Design system (Epic 7, locked — consume, don't reinvent):**
  - Tokens from `src/styles/tokens.css`: `--color-*`, `--font-<role>-*` (`display`/`heading`/`body`/`label`/`caption`/`code`), `--radius-*` (`sm` 2 / default 4 / `lg` 8 / `full`), `--spacing-*` (4px base; `--spacing-0-5` = 2px added at 8.3's code review), `--shadow-*`. `src/styles/base.css` already gives a bare `<input>` / `<textarea>` a token border + focus-visible ring — **don't re-style what it covers.** The Hash view currently hardcodes `#666` / `#ccc` / `#b00020` / `border-radius: 6px` / `font-family: monospace` — all of that is Task 2's tokenisation work: `#b00020` → `var(--color-accent-destructive)` (matching `JsonView.vue` / `Base64View.vue` / `UuidView.vue`), the digest `<code>` → `--font-code-*`, every margin/gap/radius → `--spacing-*` / `--radius-*`, `.drop-hint`'s dashed box → tokens.
  - `AppButton` variants: **`primary`** (orange fill — DESIGN.md's "budget of one": at most one per screen, the single signature action; Story 8.1's lesson is *don't apply it reflexively* — it's a deliberate call, likely "Compute" here but confirm), **`default`** (black workhorse — most buttons), **`destructive`** (red — high-consequence only). The current view already uses `primary` on Compute.
  - **`AppTabs.vue`** exists (built in 8.1). Use it **only** if Task 1 yields multiple genuinely distinct named jobs (e.g. Compute / Verify). 8.1 + 8.2 + 8.3 discipline: **do not add tabs to a single-view tool.**
  - **`AppPopover.vue`** exists (built in Story 8.3 — the app's first floating surface). "Minimal" API: uncontrolled, `#trigger` scoped slot exposing `{ toggle, open, close, triggerProps }`, default slot = panel body, `label` prop for the `role="dialog"` name, `placement` prop (6 fixed CSS values, no positioning lib). Panel-scoped Escape, outside-pointerdown / Tab-out / re-activation dismiss, `close({ returnFocus })`. Reuse it for any `?`-explainer or a compact menu (8.3 uses it twice — a version `?` and a download-format menu). `--shadow-floating`'s dark value is still a `[ASSUMPTION]` rim-glow in DESIGN.md — a light + dark render-review is owed on any new consumer.
  - **Copy affordance:** `JsonTree.vue` / `Base64View.vue` / (post-8.3) `UuidView.vue` all use the ~24 px icon-button + `useCopyFeedback` pattern (signature-accent "copied" state, **no** separate success colour). `useCopyFeedback` lives at `src/tools/json/useCopyFeedback` and is imported cross-tool with a hoist-candidate comment (the hoist to `src/shell/` is deliberately **not** done — island discipline; Task 2's call only if a fourth consumer tips it). The current per-row `<AppButton>` "Copy" is a candidate to restyle to this pattern — and it would fix the "no Copy feedback" deferred-work item.
  - **Voice** (EXPERIENCE.md): precision-instrument register — short, factual, no exclamation marks, no cheerleading. Errors read like an instrument reporting state. A checksum-mismatch result, if added, should read the same way — a plain factual "does not match", not a red alarm.
  - **Icon:** `icon: "hash"` → `PhHash` (a Phosphor pictogram — no change needed).
  - **Accessibility floor:** full WCAG 2.1 AA, every flow keyboard-drivable, every control has an SR label + role, visible focus on every tab stop. A successful digest render should get a `role="status"`/`aria-live` announcement (the deferred-work item); errors already get `role="alert"`.

- **Reusable patterns from 8.1 / 8.2 / 8.3 — follow, don't reinvent:**
  - **Live-conversion pattern** (if Task 1 moves off the explicit Compute button toward as-you-type hashing): `src/shell/debounce.ts`'s `debounce(fn, ms)` (has `.cancel()`), a `watch([...sources], …)` that debounces text edits but re-runs immediately on a discrete control change, `debouncedX.cancel()` in `onUnmounted`. `Base64View.vue` (which went live-conversion in 8.2) and `JsonView.vue` are the references. Note the trade-off against the deferred-work "no frontend size guard on the textarea" item — as-you-type hashing over up to 100 MiB needs a debounce **and** a length ceiling.
  - **`createLatestWinsRunner()`** / `registry.getLatestWinsRunner(toolId)` — returns `runLatestWins(task)` → `{ superseded: false, value } | { superseded: true }`; a stale rejection is swallowed, a stale success dropped. Hash already uses the registry-scoped variant (shared with the drop path) — keep that.
  - **`useCopyFeedback`** (`src/tools/json/useCopyFeedback`) — keyed feedback map, `markCopied(key)` only after the clipboard write resolves, `cancelCopyFeedback()` in `onUnmounted` **and** whenever the underlying value changes (8.3's code review added the "clear on regenerate / format toggle" guard — for Hash, clear on a fresh Compute, a new drop, or a case-toggle).
  - **vue-i18n treats a literal `{` / `}` as interpolation syntax** — any new locale string showing literal braces or `{placeholder}`-looking text needs the `{'{'}` / `{'}'}` escape. `locales.spec.ts` guards it; reach for the escape proactively.
  - **Never rely on incidental template whitespace for spacing** between adjacent Vue elements — it collapses silently; give a spaced element its own node with real CSS `margin`.
  - **When tightening a loose test threshold** (a latency ceiling on a new command), calibrate against a real `cargo test --workspace` run under parallel contention, not an isolated measurement — 8.1's first 2 s ceiling was flaky and settled at 10 s.
  - **New shared UI / shared infra doesn't inherit governance automatically** (CLAUDE.md) — if the redesign proposes a shared `fs_helper` bounded-read (the TOCTOU fix), a new shared component, or any registry-shape change, present it as options with trade-offs and check it against the project's patterns (branch protection, LICENSE, CI gates, the `type(scope): subject` commit convention) rather than assuming they travel with the change.

- **Performance.** No Hash-specific performance profile exists (unlike JSON's Story 1.9 10 MB baseline). RustCrypto digest computation over 100 MiB is well under a second on the blocking pool; the cap exists to bound memory (CWE-400), not CPU. Any Task 2 change raising the cap must be sanity-checked for the webview memory cost of holding the input, and file hashing should stay metadata-guarded-then-read (or move to a streaming/incremental `Digest::update` loop, which would also close the TOCTOU gap — a core-shape decision to record).

- **Styling status.** `HashView.vue` is **100% pre-Epic-7** — Task 2 is the first tokenization pass this tool gets, and it is more extensive than 8.3's (UUID had one hardcoded colour; Hash has `#666`, `#ccc`, `#b00020`, a hardcoded radius, and bare `monospace` across `.drop-hint`, `.field`, `textarea`, `fieldset`, `.actions`, `p[role="alert"]`, `.results`).

- **No inter-story dependency.** Epic 8's preamble states 8.1–8.9 are mutually independent once Epic 7 is done; 8.4 runs now because it is the next `backlog` story in `sprint-status.yaml`, and can be created and implemented without waiting on 8.5–8.9.

### Project Structure Notes

- **Likely touched (contingent on Task 1's decision — confirm during Task 2):** `src/tools/hash/HashView.vue`, `src/tools/hash/HashView.spec.ts`; `crates/umbra-core/src/hash.rs` and its tests only if Task 1 decides new core transformations are needed (new algorithms, HMAC, streaming, a verify/compare primitive); `src/tools/hash/hashDigests.ts` and `crates/umbra-core/Cargo.toml` (hash-crate set) if the digest set changes; `src-tauri/src/commands/hash.rs` (+ `src-tauri/src/lib.rs` handler registration) only if the command surface changes (a new `hash_<verb>`, a "save digests" writer, a streaming read); `src/locales/en.json` + `src/locales/fr.json` for any new strings; `src/shell/toolError.ts`'s `TRANSLATABLE_CODES` only if new classified codes are introduced; `src/stores/settings.ts` (+ `settings.spec.ts`) only if a persisted `hash.*` preference is added (8.3's `uuid.*` pattern); `src/stores/registry.ts` only if the `drop` shape changes or a `clipboardMatch` is added (governance-flagged); `src/components/AppButton.vue` / `AppTabs.vue` / `AppPopover.vue` as *consumers* (imported, not modified).
- **New:** Task 1's decision-record artifact — `_bmad-output/implementation-artifacts/8-4-hash-decision-record.md`.
- **Out of scope regardless of Task 1's outcome:** any other tool's files (AD-6, tools are islands) and any shared `src/shell/` / `src/stores/` / `src-tauri/src/fs_helper.rs` file beyond what Epic 7 + Story 8.3 already generalized — unless the decision record explicitly justifies a shared-infrastructure change, in which case this project's CLAUDE.md governance-check discipline applies: present it as options with trade-offs to the developer, and check it against the project's established governance patterns (branch protection, LICENSE, CI gates, the `type(scope): subject` commit convention) rather than assuming they travel with the change.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8 preamble + shared story shape (~231, ~1318–1337); Story 8.4 charter (~1350–1352); Story 2.4 "Hash text" + Story 2.5 "Hash files" as reference-only prior acceptance criteria (~575–615); FR14 (~56, ~162), FR15 (~57, ~163)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-16.md` — Epic 8's "chartered, not fully spec'd" charter and rationale]
- [Source: `_bmad-output/implementation-artifacts/8-3-reimagine-the-uuid-generator.md` + `8-3-uuid-decision-record.md` — the working template: Task 1 AC shape, Task 2a/2b gating, per-slice delivery with a developer render-review, the `tool.*` persisted-setting pattern, `AppPopover.vue`, the i18n / template-whitespace / test-threshold Dev Notes lessons, and the code-review Change Log]
- [Source: `_bmad-output/implementation-artifacts/8-2-reimagine-base64-encode-decode.md` + `8-2-base64-decision-record.md` — the closest structural precedent: a redesigned single enriched view that keeps a live file/drop path and a save-to-file path]
- [Source: `_bmad-output/implementation-artifacts/8-1-reimagine-the-json-formatter-viewer.md` + `8-1-json-decision-record.md` — the decision-record format to mirror: Kept / Changed / Added / Cut (backlog) / FR revision / AD-1 core-split / i18n-`TRANSLATABLE_CODES` finding / "open items Task 2 still owns"]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — lines 42–51 (Story 2.5 review, 2026-07-31: TOCTOU, `check_file_size` duplication, dead `acceptedMimeTypes`, multi-file drop, temp-file leak, no drop progress, no input-source label) and lines 84–90 (Story 2.4 review, 2026-07-31: no in-flight disable, no textarea size guard, no Copy feedback, missing error-clears-digests regression test)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1 (45–49), AD-2 (51–55), AD-3 (57–61), AD-4 (63–67), AD-6 (75–79), AD-10 (99–103), AD-11 (105–109), AD-13 + 2026-08-23 amendment (117–150), AD-14 (152–157), AD-15 (158–163), AD-16 + 2026-08-04 runner-scoping amendment (164–175); Consistency Conventions table incl. the dependency version/API-drift rule]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/DESIGN.md` — token frontmatter; the four-tier colour system + "budget of one" orange rule; Components incl. `floating-surface`; Do's and Don'ts]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/EXPERIENCE.md` — Information Architecture three-views table; Voice and Tone + error-message quality bar; State Patterns Error / Loading rows; Interaction Primitives — one-click copy-as-text; Accessibility Floor]
- [Source: `_bmad-output/implementation-artifacts/7-1-design-tokens-and-icon-system-land-in-the-shell.md` — the token naming convention (`--color-*`, `--font-<role>-*`, `--radius-*`, `--shadow-*`) and the `@phosphor-icons/vue` + `src/shell/icons.ts` resolver Task 2 must consume]
- [Live-read this drafting session, full contents: `crates/umbra-core/src/hash.rs`, `src-tauri/src/commands/hash.rs`, `src-tauri/src/lib.rs` (hash handler registration), `src/tools/hash/HashView.vue`, `src/tools/hash/hashDigests.ts`, `src/tools/hash/HashView.spec.ts`, the `tools.hash.*` i18n blocks in `src/locales/{en,fr}.json`, `src/shell/toolError.ts`, the `hash` registry entry in `src/stores/registry.ts`, `src/shell/icons.ts`, `crates/umbra-core/Cargo.toml` + `Cargo.lock` (hash-crate versions) — confirming the current implementation before discovery reconsiders it]
- [Source: Context7 `/RustCrypto/hashes` — to be fetched at discovery start to re-verify the `sha2` / `sha1` / `md-5` `0.11` line and check `sha3` / `blake2` availability]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-create-story workflow)

### Debug Log References

- 2026-08-31 — Story context created via `bmad-create-story`. `baseline_commit` `d428db9` verified as `origin/main`'s tip (HEAD == origin/main, working tree clean apart from untracked `.claude/workflows/`). All five Hash source files + i18n + `toolError.ts` + registry entry + `lib.rs` handler registration + `Cargo.toml`/`Cargo.lock` hash-crate versions live-read in full. Discrepancies noted in Dev Notes (`hash-input-too-large` prose count → stays out of `TRANSLATABLE_CODES`; `hashDigests.ts` hand-sync; `drop` entry but no `clipboardMatch`; dead `acceptedMimeTypes: []`; 11 open `deferred-work.md` items across two reviews). No same-epic drift — 8.1/8.2/8.3 are all `done`, epic-8 already `in-progress`, no epic status change. Only Task 1's AC1–5 are real; Task 2 ACs deferred to Task 2a per epics.md.
- 2026-08-31 — `bmad-dev-story` started. Task 0 done: `baseline_commit` `d428db9` re-confirmed as `origin/main`'s tip (`git rev-parse HEAD` == `git rev-parse origin/main` == `d428db9a3f29e4d5f66a1abb6e80a81c68f65ea7`), branched `feat/story-8-4-reimagine-the-hash-generator` from `main`'s tip (story file was uncommitted at creation, so it and the `sprint-status.yaml` edit rode the working tree onto the branch), `sprint-status.yaml` moved `ready-for-dev` → `in-progress`. Halted at Task 1's first subtask per the story's own explicit instruction ("run interactively, not autonomously — halt here for the developer's method choice"): awaiting the developer's choice of `bmad-party-mode` vs `bmad-forge-idea` for the Hash scope-discovery session.
- 2026-08-31 — Task 1 done. Developer chose `bmad-party-mode` (installed roster — Mary, John, Sally, Winston, Amelia, Paige; party memory resumed the 8.1/8.2/8.3 Epic 8 history). Re-read all five Hash source files + i18n + `toolError.ts` + registry entry + `lib.rs` + `Cargo.toml`/`Cargo.lock` — **no drift** vs. the story's Dev Notes (stated in the record). Grounded the room in Epic 7 (`tokens.css`, `AppButton.vue`, `AppTabs.vue`, `AppPopover.vue`) + `Base64View.vue` (full). Competitive sweep via web search + knowledge (CyberChef, GtkHash, `sha256sum -c`, `openssl dgst`, SRI, RustCrypto `sha3`/`blake2`/`blake3`). Context7 `/RustCrypto/hashes` re-verified: `sha2`/`sha1`/`md-5` `0.11` line current, `sha3` a clean `Digest`-trait add. Published a 4-option container design canvas (`https://claude.ai/code/artifact/c928d06d-a86d-4e32-8ad5-a8764fd3af67`, later expanded to 6 artboards / 3 pages with interaction states). Developer decided: **Option 1 enriched single view + smart paste-detection into a persistent Verify field, the input-moved acknowledgement made visible**; **SHA3-256 + SHA3-512 added** (`sha3` crate); **user-selects algorithms via checkboxes** (default SHA-256 + SHA-512, persisted `hash.*`) → `HashDigests` struct reshaped to an `Algorithm`-enum-keyed `Vec<DigestEntry>`, `hash_compute`/`hash_compute_file` signatures gain an algorithm list, `hash_compute_file` gains a `dropArgsProvider`; **hex + Base64 encoding toggle** (view-side); **live as-you-type hashing**; MD5/SHA-1 → "not collision-resistant". AC3 deviation: developer directed nothing filed to GitHub / a tracked backlog (8.3 precedent) — cut ideas (BLAKE2b/BLAKE3, byte-grouped hex, `0x` prefix, HMAC, signature tool, digest-export) recorded in the record's **Cut** section only. Decision record: `8-4-hash-decision-record.md`. Next: Task 2a (write real AC6+, same room, scoped to the record + a polished canvas).

### Completion Notes List

- Story context created via `bmad-create-story` (2026-08-31) — comprehensive developer guide for a Task-1-gated Epic 8 charter story, the fourth instance of the shape 8.1, 8.2 and 8.3 proved end to end. Only Task 1 (discovery) carries real, testable acceptance criteria; Task 2's ACs are deferred to a Task 2a follow-up edit once `8-4-hash-decision-record.md` exists, per epics.md's explicit instruction that Task 2 ACs would be fiction before the decision record is made. `baseline_commit` set to `d428db9` (origin/main tip: Story 8.3 merged as PR #118). Current Hash implementation (core, both command wrappers, view, TS struct mirror, spec, i18n, registry, handler registration) live-read in full so discovery starts from confirmed fact. Distinctive framing vs. 8.3, captured in Dev Notes: Hash already has a file/drop path (AD-14/AD-16 shared runner), already touches the filesystem (AD-15 read side), and already ships the case toggle 8.3 had to add.
- **Task 2a complete (2026-09-01).** AC6–AC20 written into the "Acceptance Criteria — Task 2 (Redesign)" section; the design canvas was re-seeded to **delivery fidelity** (4 artboards: Default / Verify active / Smart-detection offer / After "Move it to Verify" — the acknowledgement moment is two-ended: a note where the value left, a briefly-tinted Verify panel where it landed, plus Undo). Open items resolved in the AC preamble; **digest export confirmed OUT**; `Algorithm` serde naming + the `sha3` patch pin deferred to Task 2b implementation. Developer signed off on the AC set 2026-09-01. **Next: Task 2b** — the per-slice implementation (first slice = Epic-7 tokenisation + restructure to the enriched single view), with a developer render-review after each slice and `pnpm tauri dev` visual checks; commit per slice, ask before pushing.
- **Task 1 complete (2026-08-31).** `bmad-party-mode` discovery → `8-4-hash-decision-record.md` (Kept / Changed / Added / Cut / container / FR14+FR15 revision / AD-1 core-split / i18n-`TRANSLATABLE_CODES` finding / open items). **No drift** found vs. the story's Dev Notes — a rare clean re-verify, stated explicitly in the record. **Chosen scope:** an enriched single view (Option 1 off a published design canvas), with a persistent "Verify against a known hash" field and a smart paste-detection that *moves* a bare-hash input into it with a **visible acknowledgement** (the developer's explicit requirement — never a silent swap, AD-9). **Added:** Verify/compare (mismatch is a `role="status"` result, not an alert); SHA3-256 + SHA3-512 (`sha3 = "0.11"`, a clean RustCrypto `Digest` add); user-selected algorithm set via checkboxes (default SHA-256 + SHA-512, persisted `hash.*` per the 8.3 `uuid.*` pattern); hex + Base64 output encoding (both view-side transforms); live as-you-type hashing (debounced + a length ceiling) replacing the Compute button. **AD-1 core reshape:** `HashDigests { 4 named fields }` → an `Algorithm` enum + ordered `Vec<DigestEntry>`; `hash_compute` / `hash_compute_file` signatures gain the algorithm list; `hash_compute_file` gains a `dropArgsProvider`; `hashDigests.ts` mirrors the new shape; `Cargo.toml` gains `sha3`. **`TRANSLATABLE_CODES` not extended** (no new `umbra-core` error paths; "does not match" is a status phrased via `t()`, not an `errors.*` code). **AC3 deviation logged:** developer directed nothing filed to GitHub / a tracked backlog (8.3 precedent); cut ideas (BLAKE2b/BLAKE3, byte-grouped hex, `0x` prefix, HMAC, a signature tool, digest-export) are in the record's **Cut** section for traceability only. **Cross-tool infra flagged, not folded:** the `check_file_size` TOCTOU + duplication shared with `base64.rs` (a `fs_helper` bounded-read helper is its own governance-checked follow-up); multi-file drop is a shell concern. Design canvas: `https://claude.ai/code/artifact/c928d06d-a86d-4e32-8ad5-a8764fd3af67`. **Next: Task 2a** — write real AC6+ in the same room, scoped to the record + a polished (UUID-8.3-fidelity) canvas, then developer sign-off before 2b.

### File List

- `_bmad-output/implementation-artifacts/8-4-reimagine-the-hash-generator.md` (this story — NEW)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status `backlog` → `ready-for-dev` at creation; `ready-for-dev` → `in-progress` 2026-08-31, Task 0)
- `_bmad-output/implementation-artifacts/8-4-hash-decision-record.md` (Task 1 decision record — NEW, 2026-08-31; amended at code review 2026-09-01 — Paste-button cut logged)
- `_bmad-output/party-mode/memories/installed/.memlog.md` (party-mode memory — 3 Story 8.4 entries appended)
- `crates/umbra-core/src/hash.rs` (`HashDigests` → `Algorithm` enum + `Vec<DigestEntry>`; new tests)
- `crates/umbra-core/Cargo.toml` + `Cargo.lock` (`sha3 = "0.11"` added)
- `src-tauri/src/commands/hash.rs` (both signatures gain an algorithm list; algorithm-count guard + empty-algorithms early return added at code review)
- `src/tools/hash/HashView.vue` (full Task 2b redesign — enriched single view, Verify panel, smart paste-detection)
- `src/tools/hash/HashView.spec.ts` (rewritten for the redesign; new tests added at code review)
- `src/tools/hash/WeakHashPopover.vue` (NEW — AC13's help-affordance popover; `algorithm` prop added at code review for distinct per-row accessible names)
- `src/tools/hash/hashDigests.ts` (hand-synced mirror of the reshaped Rust struct)
- `src/locales/en.json` + `src/locales/fr.json` (`tools.hash.*` — new keys for the redesign, plus code-review additions: `noAlgorithmsHint`, `verifyPartialMatchSummary`, `weakHelp*For`, `overwrite*`)
- `src/stores/settings.ts` + `src/stores/settings.spec.ts` (new `hash.*` persisted keys: `algorithms`, `case`, `encoding`)
- `src/stores/registry.ts` (`dropArgsProvider` wire-up; `sha3` search aliases added at code review; `dropSourcePath` field — see AC20 amendment)
- `src/shell/DropZone.vue` + `src/shell/dropZone.spec.ts` (`dropSourcePath` forwarding — see AC20 amendment; `toolId`-scoped at code review)
- `src/styles/tokens.css` (`--color-accent-success` token — see AC20 amendment)

_Design canvas published as an Artifact (not a repo file): "Hash Generator Redesign" — `https://claude.ai/code/artifact/c928d06d-a86d-4e32-8ad5-a8764fd3af67`._

### Change Log

| Date | Change |
| --- | --- |
| 2026-08-31 | Story created via `bmad-create-story`. Task-1-gated Epic 8 charter story scoped to the Hash Generator (`src/tools/hash/HashView.vue` + `crates/umbra-core/src/hash.rs` + `src-tauri/src/commands/hash.rs` + `hashDigests.ts` + i18n + the `hash` registry `drop` entry). Only Task 1's AC1–5 are real; Task 2 ACs deferred to Task 2a. `baseline_commit` `d428db9` (origin/main tip: Story 8.3 merged as PR #118). `sprint-status.yaml`: `8-4-reimagine-the-hash-generator` `backlog` → `ready-for-dev`. Not committed. |
| 2026-08-31 | `bmad-dev-story` started. Task 0 complete: branched `feat/story-8-4-reimagine-the-hash-generator` from `d428db9` (`origin/main` tip == `baseline_commit`, re-verified), `sprint-status.yaml` `ready-for-dev` → `in-progress`, story `Status` → `in-progress`. Halted at Task 1 for the developer's discovery-method choice (`bmad-party-mode` vs `bmad-forge-idea`). Not committed. |
| 2026-08-31 | Task 1 complete. `bmad-party-mode` scope discovery → `8-4-hash-decision-record.md` (NEW); no drift found vs. the Dev Notes. Container-shape design canvas published as an Artifact (`c928d06d…`). Developer confirmed scope: enriched single view + smart paste-detection into a persistent Verify field (input-moved acknowledgement made visible); Verify/compare mode (mismatch = `role="status"`, not an alert); SHA3-256 + SHA3-512 added (`sha3` crate); user-selected algorithm set via checkboxes (persisted `hash.*`, 8.3 pattern) → `HashDigests` reshaped to an `Algorithm` enum + `Vec<DigestEntry>`, command signatures gain an algorithm list, `hash_compute_file` gains a `dropArgsProvider`; hex + Base64 output encoding (view-side); live as-you-type hashing; MD5/SHA-1 relabelled "not collision-resistant". FR14 revised & expanded, FR15 kept & extended. `TRANSLATABLE_CODES` not extended. AC3 deviation logged (developer: nothing filed to GitHub / a tracked backlog — 8.3 precedent; cut ideas documented in the record's Cut section only). Cross-tool `fs_helper` TOCTOU + multi-file-drop flagged as governance/shell follow-ups, not folded. Story stays `in-progress` (Task 2a next). Not committed. |
| 2026-09-01 | Task 2a complete. AC6–AC20 (15 ACs) written into the "Acceptance Criteria — Task 2 (Redesign)" section, scoped to the decision record + a **polished** design canvas (same URL `c928d06d…`, re-seeded to 4 delivery-fidelity artboards: Default / Verify active / Smart-detection offer / After "Move it to Verify"). Open items resolved: Verify = persistent panel under the results; smart-detection acknowledgement = two-ended (a note where the value left + a tinted Verify panel where it landed) + Undo; detector recognises 32/40/56/64/96/128-hex and does **not** disambiguate (Verify checks every selected algorithm — developer's call); case + encoding = two composing, persisted segmented controls; **digest export confirmed OUT** (room + developer reasoned it: ≤6 digests ≠ a bulk problem; `SHA256SUMS` is a pipeline job). `Algorithm` enum serde naming + `sha3` patch pin → Task 2b. Developer signed off on the AC set 2026-09-01. Story stays `in-progress` (Task 2b — per-slice implementation — next). Not committed. |
| 2026-09-01 | Task 2b complete (`bmad-dev-story`). Full redesign implemented against AC6–AC20: `crates/umbra-core/src/hash.rs`'s `HashDigests` reshaped to an `Algorithm` enum + `Vec<DigestEntry>` (`sha3` crate added); both command signatures gain an algorithm list; `HashView.vue` rebuilt as the enriched single view (Epic-7 tokenised, checkbox algorithm selection, composing Case/Encoding controls, persistent Verify panel, smart paste-detection with move/Undo, live as-you-type hashing); `WeakHashPopover.vue` (NEW) for AC13; `hashDigests.ts`/`settings.ts`/`registry.ts`/i18n updated to match. Committed as `c536113`. Not pushed. |
| 2026-09-01 | `bmad-code-review` against `main...HEAD` (Task 2a docs commit `191200e` + Task 2b implementation commit `c536113`). Three parallel adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor against AC6–AC20) — 36 raw findings, 26 after dedup, 5 dismissed as noise, 6 decision-needed (all resolved live with the developer), 21 patch (all applied). Fixes: the fast-path/latest-wins race in `runHash`/`runHashFile` (HIGH — a slower in-flight hash could silently overwrite a cleared/corrected display); Move/Undo now confirm before overwriting existing Verify content or freshly-typed input; `dropSourcePath` namespaced by `toolId`; Verify's Base64 comparison tolerates missing padding and a copied `sha256sum`-style line; paste-detection hints no longer name unselectable algorithms (56/96-char lengths dropped); `WeakHashPopover` instances get distinct accessible names per algorithm; the smart-detection offer button's `aria-label` now contains its visible label (WCAG 2.5.3); a failed second file drop resets `source`/`droppedPath` instead of leaving a stale re-hash target; AC16's partial-match summary now names non-matches too; AC10's in-flight disabled state implemented (textarea, algorithm checkboxes, Case/Encoding radios); AC11's Case control is now visibly disabled while Base64 is active; `hash_compute`/`hash_compute_file` gained an algorithm-count guard and an early return for an empty algorithm list on file drop; the `hash` registry entry's aliases extended for `sha3`; the missing "digests clear on failure after success" regression test was added. AC11 (Case/Base64 non-composition), AC13 (popover vs. label), AC17 (one-ended acknowledgement), and AC20 (the `DropZone.vue`/`registry.ts`/`tokens.css` shared-file touches) amended to match the shipped, developer-confirmed design; the decision record's "Kept" section amended to log the Paste-button cut. Dismissed as noise: a stale `dropZone.spec.ts` fixture shape (false positive — the test targets the no-`dropArgsProvider` path and the payload is opaque `unknown` there), the intentionally duplicated `MAX_INPUT_BYTES` frontend guard, `Cargo.lock`'s harmless `cpufeatures` version duplication, an extremely-low-likelihood same-flush algorithm-toggle-and-text-edit race, and un-debounced paste-detection on a very-large paste. Not committed yet. |
