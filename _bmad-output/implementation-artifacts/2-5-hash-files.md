---
baseline_commit: e391345
---

# Story 2.5: Hash files

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want the same digests for a dropped file,
so that I can verify downloads and artifacts locally.

## Acceptance Criteria

1. **Given** the hash tool is active, **when** I drop a file, **then** the drop service delivers its path, `src-tauri` reads the bytes, and all four digests display as in Story 2.4 (FR15, AD-14/AD-15).
2. **Given** a large file, **when** hashing runs, **then** it executes async on the blocking thread pool with the UI responsive throughout (AD-4), **and** a newer drop supersedes an in-flight computation, latest-wins (AD-16).
3. **Given** an unreadable file, **when** hashing is attempted, **then** a structured inline error is shown (NFR4).

## Tasks / Subtasks

- [x] **Task 1: `umbra-core::hash` — byte-oriented split (AC: 1)**
  - [x] **Refactor, don't duplicate** — same shape as `base64.rs`'s `encode`/`encode_bytes` split (Story 2.2 Task 1). In `crates/umbra-core/src/hash.rs`:
    - Add `pub fn compute_bytes(bytes: &[u8]) -> Result<HashDigests, ToolError>` — move the existing size-check-then-hash-all-four-algorithms body here verbatim, operating on `bytes` directly instead of `input.as_bytes()`.
    - Change `pub fn compute(input: &str) -> Result<HashDigests, ToolError>` to a one-line delegate: `compute_bytes(input.as_bytes())`. This is a pure refactor — behavior for the existing text path is unchanged, so all of Story 2.4's existing tests must still pass unmodified.
    - Make `MAX_INPUT_BYTES` `pub` (currently private to the module) so `src-tauri`'s command layer can reference the same constant for its pre-read file-size check (Task 2) — do not invent a second, duplicate constant.
  - [x] This split was explicitly anticipated in Story 2.4's Dev Notes ("keep `compute(input: &str)`'s signature and `HashDigests` shape reusable for a future `compute_bytes(&[u8])` split... but do not build that split now — YAGNI until 2.5 actually needs it") — this task is that trigger.
  - [x] No new dependency — `sha2`/`sha1`/`md-5` (already added in Story 2.4) hash arbitrary bytes identically regardless of source (pasted text vs. file content); hashing never requires UTF-8 validity, unlike Base64 decode, so there is no non-UTF-8 complication analogous to `base64::decode_bytes`'s.

- [x] **Task 2: Tauri command `hash_compute_file` (AC: 1, 2, 3)**
  - [x] In the existing `src-tauri/src/commands/hash.rs` (extend, don't create a new file), add:
    ```rust
    use umbra_core::ToolError;
    use umbra_core::hash::{HashDigests, MAX_INPUT_BYTES, compute, compute_bytes};

    #[tauri::command]
    pub async fn hash_compute_file(path: String) -> Result<HashDigests, ToolError> {
        tauri::async_runtime::spawn_blocking(move || {
            check_file_size(&path)?;
            let bytes = crate::fs_helper::read_file_bytes(&path)?;
            compute_bytes(&bytes)
        })
        .await
        .map_err(map_join_error)?
    }

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
                code: "hash-input-too-large".to_string(),
                message: format!(
                    "file is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit"
                ),
                position: None,
                context: None,
            });
        }
        Ok(())
    }
    ```
  - [x] **Check file size via `std::fs::metadata` BEFORE reading, not after.** This mirrors `commands/base64.rs::check_file_size`'s exact shape — and deliberately avoids re-introducing a bug Story 2.2's code review already found and fixed once in this codebase: "oversized dropped files are fully read into memory before the size guard runs... a multi-GB dropped file is materialized in RAM before rejection" (Story 2.2 Review Finding). Do not call `fs_helper::read_file_bytes` before `check_file_size`.
  - [x] **Reuse `hash-input-too-large` — do not invent a second code.** Unlike Base64's file-encode command (which layers a *smaller*, IPC-output-driven `MAX_FILE_BYTES = 10MB` cap with its own error path on top of the shared 100MB text cap, because encoded output balloons ~1.33x and has to render in a `<textarea>`), hashing's output is always four small fixed-length hex strings regardless of input size — there is no IPC-ballooning concern here. So this story reuses the **same** `MAX_INPUT_BYTES` (100MB) and the **same** `"hash-input-too-large"` code for both the text path (`compute`, unchanged from Story 2.4) and the file path (`hash_compute_file`, new) — this exactly mirrors how `base64.rs`'s core `check_size` and `commands/base64.rs`'s file-specific `check_file_size` both reuse the single `"base64-input-too-large"` code (verified by reading both files this session). **Do not add a Base64-style separate, smaller file cap** — that constraint was IPC-output-size-driven, and does not apply here.
  - [x] `src-tauri/src/commands/mod.rs`: no change needed — `pub mod hash;` already exists.
  - [x] `src-tauri/src/lib.rs`: change `use commands::hash::hash_compute;` to `use commands::hash::{hash_compute, hash_compute_file};`, and add `hash_compute_file` to the `generate_handler![...]` list, directly after `hash_compute` (line 32).
  - [x] **No `src-tauri/Cargo.toml` or `capabilities/default.json` change needed** — same reasoning as `hash_compute`: `sha2`/`sha1`/`md-5` stay `umbra-core`-only dependencies, and `std::fs` (via `fs_helper`) is not capability-ACL-gated (confirmed by Story 2.2's Task 2, and by `fs_helper.rs` having zero related entries today).

- [x] **Task 3: Tool Registry — populate hash's `drop` field (AC: 1)**
  - [x] `src/stores/registry.ts`: add a `drop` field to the **existing** `hash` entry in `TOOLS` (do not add a new entry — the tool is already registered since Story 2.4):
    ```ts
    drop: { acceptedMimeTypes: [], handler: "hash_compute_file" },
    ```
    Same `acceptedMimeTypes: []` convention as Base64's entry — Tauri's native drop event carries only filesystem paths, never a MIME type, so this field remains presence-means-accepts only (Story 2.2's established limitation, unchanged here).
  - [x] This is the only registry change. No new sidebar/palette/router entries, no tool-count ripple — mirrors Story 2.2's base64 case exactly (adding a `drop` field to an existing entry, not registering a new tool), so unlike Story 2.4, `src/router/index.spec.ts` and `src/shell/CommandPalette.spec.ts` need **no** update this time.

- [x] **Task 4: Fix the shared drop-dispatcher's two gaps this story exposes (AC: 1, 2 — AD-14, AD-16)**
  - [x] **Gap 1 — `registry.dropResult`'s `value` is typed as `string`, but `hash_compute_file` returns a `HashDigests` object, not a string.** `src/stores/registry.ts`'s `dropResult` ref and `src/shell/DropZone.vue`'s `invoke<string>(...)` call were both built for Base64's string-returning handler (Story 2.2) and never generalized. Widen the type so any tool's drop handler can return any JSON-serializable value:
    - `src/stores/registry.ts`: change `const dropResult = ref<{ toolId: string; value: string } | { toolId: string; error: ToolError } | null>(null);` to `const dropResult = ref<{ toolId: string; value: unknown } | { toolId: string; error: ToolError } | null>(null);`.
    - `src/shell/DropZone.vue`: change `invoke<string>(activeTool!.drop!.handler, ...)` to `invoke<unknown>(activeTool!.drop!.handler, ...)`.
    - `src/tools/base64/Base64View.vue`: its drop-consumption watcher does `output.value = result.value;` — now a type error under `unknown` (TypeScript `strict`). Change to `output.value = result.value as string;` (Base64's own drop handler, `base64_encode_file`, is known to return a string — this is the one call site that knows the concrete type, exactly where a narrowing cast belongs).
    - `src/tools/hash/HashView.vue`'s own drop consumer (Task 5) casts to `HashDigests` at its own call site — each tool's view is the one place that knows its own handler's return shape; the shared dispatcher stays deliberately generic.
  - [x] **Gap 2 — the dispatcher has no request-ordering guard, but this story's AC2 explicitly requires drop latest-wins.** Story 2.2 (Base64) never needed this — its AC never mentioned it. Story 2.5's AC2 does: "a newer drop supersedes an in-flight computation, latest-wins (AD-16)." Today `DropZone.vue` `await`s its single `invoke()` call and writes `registry.dropResult` unconditionally on resolution — if two drops fire close together, whichever `invoke()` call resolves *last* wins, regardless of which was dropped last. Fix this once, in the one shared dispatcher (not per-tool) — reuse `createLatestWinsRunner()` from `src/shell/invoke.ts` (the exact same helper `Base64View.vue`/`HashView.vue`/`UuidView.vue` already use locally) instead of hand-rolling a new counter:
    ```ts
    import { createLatestWinsRunner } from "./invoke";
    // ...
    const runLatestWins = createLatestWinsRunner();
    // inside the onDragDropEvent callback, replacing the current try/await/catch:
    try {
      const result = await runLatestWins(() =>
        invoke<unknown>(activeTool!.drop!.handler, { path, ...extraArgs }),
      );
      if (!result.superseded) registry.dropResult = { toolId, value: result.value };
    } catch (err) {
      registry.dropResult = { toolId, error: toToolError(err) };
    }
    ```
    **One shared counter for the single dispatcher, not a per-tool map** — `DropZone.vue` is one window-level listener; a user cannot be dropping onto two different tools' views simultaneously (dropping routes to whichever tool is currently active), so a single global counter correctly resolves AC2 without per-tool bookkeeping. This is a byproduct fix that also closes the same latent gap for Base64 drops — worth knowing, not worth re-scoping around.
  - [x] Neither fix changes the *runtime* JSON payload for existing drop flows (Base64's own tests assign e.g. `registry.dropResult = { toolId: "base64", value: "//4AAQ==" }`, which still satisfies the widened `unknown` type) — only the TypeScript type and, for Gap 2, the internal control flow.

- [x] **Task 5: `HashView.vue` — consume drops (AC: 1, 2, 3)**
  - [x] Import `useRegistryStore` and `watch`. No `dropArgsProvider` registration is needed (unlike Base64's `url_safe`) — `hash_compute_file` takes only `path`, so the dispatcher's default `extraArgs = {}` (when no provider is registered for a tool) is already correct; do not register a no-op provider.
  - [x] Watch `registry.dropResult`, mirroring `Base64View.vue`'s exact pattern:
    ```ts
    const registry = useRegistryStore();

    watch(
      () => registry.dropResult,
      (result) => {
        if (!result || result.toolId !== "hash") return;
        registry.dropResult = null; // one-shot signal
        if ("error" in result) {
          digests.value = null;
          error.value = result.error;
        } else {
          error.value = null;
          digests.value = result.value as HashDigests;
        }
      },
    );
    ```
  - [x] Add a minimal drop-hint affordance in the template, same convention as `Base64View.vue`'s `.drop-hint` paragraph and CSS class (copy that block, change the text to something like "Drop a file anywhere in the window to hash it.").
  - [x] AC3 (unreadable file → structured inline error) needs no new rendering code — `digests`/`error` share the exact same template block (`<p v-if="error" role="alert">{{ error.message }}</p>`) already proven by Story 2.4's `hash-input-too-large` error path; a drop-triggered `file-read-error` or `hash-input-too-large` renders through it identically.

- [x] **Task 6: Tests**
  - [x] `crates/umbra-core/src/hash.rs`: add tests for `compute_bytes` directly — non-empty byte-slice fixture (reuse the `"abc"`/`""` known-vector fixtures as `.as_bytes()`, confirming byte-for-byte equivalence with the existing `compute` tests, not new hardcoded values), an oversized-byte-slice rejection test (`vec![0u8; MAX_INPUT_BYTES + 1]`, mirroring `base64.rs`'s own oversized-bytes test shape), and a boundary-at-exactly-`MAX_INPUT_BYTES` success test. Confirm all of Story 2.4's existing `compute("")`/`compute("abc")`/boundary tests still pass unmodified (pure refactor, AC1).
  - [x] `src-tauri/src/commands/hash.rs`: add `hash_compute_file` tests, mirroring `commands/base64.rs`'s `base64_encode_file` test shapes (same `temp_file_path` helper convention — check if `commands/hash.rs` needs its own copy or if extracting a shared test helper makes sense; this codebase currently duplicates that helper per test module, so follow that existing precedent rather than introducing a new shared test utility):
    - Happy path: write `"abc"` to a temp file, call `hash_compute_file`, assert the returned `HashDigests` matches the exact same known-vector fixture already used in `hash.rs`'s and `commands/hash.rs`'s existing `"abc"` tests (proves the file path produces identical output to the text path for identical bytes).
    - Missing path → `file-read-error` (mirrors `base64_encode_file_command_returns_file_read_error_for_missing_path`).
    - Oversized file → `hash-input-too-large`, **without** actually writing 100MB+1 bytes of real data: create the temp file via `std::fs::File::create` + `set_len(MAX_INPUT_BYTES as u64 + 1)` (a sparse file reporting the right size via `metadata().len()` without allocating real disk/CPU for the content) — faster than `base64.rs`'s oversized-file test, which only had to write 10MB (`MAX_FILE_BYTES`) so didn't need this trick; hashing's 100MB cap makes the sparse-file approach worth using here.
  - [x] `src/shell/dropZone.spec.ts` (extend the existing `describe("DropZone", ...)` block — this file already merges pure-function and component tests per Story 2.2's documented case-insensitive-filesystem deviation, so add here, not a new file):
    - A drop dispatched to the `hash` tool: `registry.dropArgsProviders` has no entry for `hash`, so assert `invoke` is called with `{ path }` only (no extra args) and `registry.dropResult` ends up `{ toolId: "hash", value: <mocked HashDigests object> }`.
    - **Latest-wins regression test (new gap this story closes):** two drops fire before either resolves; make the first `invoke()` call's promise resolve *after* the second's (e.g. via two separate deferred promises, resolving the second one first, then the first) and assert `registry.dropResult` reflects only the **second** (later-dispatched) drop's outcome — this is the test that actually proves AD-16 compliance, not just that the happy path works.
  - [x] `src/tools/hash/HashView.spec.ts` (extend, mirroring `Base64View.spec.ts`'s drop-test section at lines 177–245 — mount with an explicit `Pinia` instance via `createPinia()`/`{ global: { plugins: [pinia] } }`, not the current bare `mount(HashView)`, since these tests manipulate `registry.dropResult` directly):
    - Consuming a successful `registry.dropResult` renders all four digest rows (reuse `SAMPLE_DIGESTS`) and clears the signal.
    - A `registry.dropResult` routed to a different `toolId` (e.g. `"base64"`) is ignored — `rows` stays empty.
    - A `registry.dropResult` error (`file-read-error` or `hash-input-too-large`) renders via the existing `role="alert"` path and clears any prior digests.

- [x] **Task 7: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`, `vue-tsc --noEmit`.

- [ ] **Task 8: Manual verification (deferred to the user)**
  - [ ] `pnpm tauri dev`, per this project's established precedent (Stories 1.10, 2.1, 2.2, 2.3, 2.4 — the dev agent cannot visually drive a native Tauri window): drop a file onto the Hash tool and confirm all four digests display (matching what Story 2.4's text-input path produces for the same content, if convenient to compare); drop a large file and confirm the UI stays responsive during hashing; drop two files in quick succession and confirm the result reflects only the later drop; drop an unreadable/deleted-mid-flight file and confirm a structured inline error; drop onto a tool with no drop support (e.g. JSON) and confirm the existing no-op notice still appears (regression check on Task 4's dispatcher changes); confirm dropping onto Base64 still works end-to-end (regression check on the `dropResult` type widening).

- [x] **Task 9: Commit and open a PR**
  - [x] Branch: `feat/story-2-5-<slug>` (e.g. `feat/story-2-5-hash-files`).
  - [x] Conventional Commit(s), `feat` type scoped to `hash` (consider a separate commit for Task 4's shared `DropZone`/`registry` fixes if that reads more clearly, mirroring Story 2.2's precedent of splitting shared-infra commits from tool-specific ones — use judgment). Kept as a single commit, mirroring Story 2.2's own initial-implementation commit (the split-commit precedent there was actually its post-review fix commit, not its initial one).
  - [x] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4) — [PR #29](https://github.com/dipaneb/umbra/pull/29).

### Review Findings

- [x] [Review][Patch] Cross-mechanism and cross-tool latest-wins races violate AD-16/AC2 [`src/shell/DropZone.vue:12,49-52`, `src/tools/hash/HashView.vue:14,31-44`] — `DropZone.vue` shares one global `runLatestWins` instance across every tool (a drop on tool B falsely supersedes an in-flight drop on tool A), and `HashView.vue` keeps a separate, uncoordinated runner for `onCompute`/`onPaste` — so a manual "Compute" and a file drop, both writing to the same `digests`/`error` state, can resolve out of order with no guaranteed latest-wins. AD-16 exists to prevent "a stale result from a superseded request overwriting a newer one," and AC2 explicitly requires "a newer drop supersedes an in-flight computation." Fix: host one shared, per-toolId `runLatestWins` instance in the registry store (paralleling the existing `dropArgsProviders` pattern from AD-14) and route both `DropZone.vue`'s drop dispatch and `HashView.vue`'s `onCompute`/`onPaste` through it. **Fixed:** added `getLatestWinsRunner(toolId)` to the registry store; `DropZone.vue` and `HashView.vue` now share one per-tool runner. Regression tests added in `registry.spec.ts` and `dropZone.spec.ts`, confirmed to fail against the pre-fix code.
- [x] [Review][Patch] Drop results for a since-unmounted view are neither discarded (per AD-16) nor reliably delivered [`src/tools/hash/HashView.vue:20-31`, `src/shell/DropZone.vue:49-52`] — `HashView.vue`'s `watch(() => registry.dropResult, ...)` has no `{ immediate: true }`; if the user drops a file and navigates away before `hash_compute_file` resolves, the watcher is torn down, `DropZone.vue` still writes the result into the store, and remounting Hash later won't retroactively fire a non-immediate watcher. AD-16 states "results for unmounted views are discarded on arrival" — the current behavior is neither a clean discard nor a delivery; the result silently rots in the store. Fix: at resolve time in `DropZone.vue`, check whether the active route still matches the dispatched `toolId` before writing `dropResult`, discarding otherwise. **Fixed:** `DropZone.vue` now checks `resolveActiveTool(route.path, registry.tools)?.id === toolId` before writing `dropResult` on both the success and error paths. Regression test added in `dropZone.spec.ts`, confirmed to fail against the pre-fix code.
- [x] [Review][Defer] TOCTOU gap between `check_file_size`'s metadata check and the later file read [`src-tauri/src/commands/hash.rs:26-40`] — deferred, pre-existing (copied verbatim from `base64.rs`'s Story 2.2 `check_file_size`; fixing only `hash.rs` would leave `base64.rs` equally exposed — candidate for a shared bounded-read helper in `fs_helper.rs`)
- [x] [Review][Defer] `check_file_size` duplicates `commands/base64.rs`'s function of the same name [`src-tauri/src/commands/hash.rs:26-40`] — deferred, pre-existing (deliberate per the spec's explicit direction to mirror base64's shape; candidate for consolidation alongside the TOCTOU fix above)
- [x] [Review][Defer] `acceptedMimeTypes: []` remains dead configuration [`src/stores/registry.ts:14,78`] — deferred, pre-existing (declared and populated since Story 2.2, never read anywhere; this story just extends the same inert shape)
- [x] [Review][Defer] Multi-file drops silently hash only the first file, no notice the rest were ignored [`src/shell/DropZone.vue:47`] — deferred, pre-existing (Story 2.2 `DropZone`/`routeDrop` behavior, not changed by this diff, though newly more relevant given hashing's "verify a batch of downloads" use case)
- [x] [Review][Defer] Directory drops surface a raw OS error string instead of a friendly message [`src-tauri/src/fs_helper.rs:17-19`] — deferred, pre-existing (`read_file_bytes`/`check_file_size` behavior, not introduced by this diff)
- [x] [Review][Defer] Test temp files leak on assertion failure [`src-tauri/src/commands/hash.rs` test module] — deferred, pre-existing (cleanup runs as a trailing statement in `base64.rs`'s/`fs_helper.rs`'s tests too; this story's new tests mirror the same established convention)
- [x] [Review][Defer] No loading/progress feedback while a dropped file is hashing [`src/tools/hash/HashView.vue`] — deferred, pre-existing (`onCompute`'s manual text-hash path has the same gap; this story extends it to file drops rather than introducing it)
- [x] [Review][Defer] No indication of which input (typed text vs. dropped file) the displayed digests belong to [`src/tools/hash/HashView.vue`] — deferred, pre-existing UX gap, compounded by but distinct from the race above

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2 (functional core):** `compute_bytes` is a pure function in `crates/umbra-core/src/hash.rs` — zero I/O, zero Tauri dependency. File reading itself is explicitly not core's job (AD-15) — it stays in `src-tauri/src/fs_helper.rs`, exactly as Story 2.2 designed it to be reused. [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (ToolError contract):** no new error codes. `hash_compute_file` reuses `hash-input-too-large` (now also file-size-triggered, not just text-size-triggered) and the pre-existing shared, tool-agnostic `file-read-error` (from `fs_helper.rs`, established by Story 2.2 specifically anticipating this story as its second consumer). [Source: `ARCHITECTURE-SPINE.md` AD-3]
- **AD-4 (heavy work off the main thread):** `hash_compute_file`'s `spawn_blocking` wrap is a genuine correctness requirement, same as `hash_compute`'s — hashing a large file with four algorithms can exceed the ~100ms bar. [Source: `ARCHITECTURE-SPINE.md` AD-4]
- **AD-5 (one Tool Registry):** only the existing `hash` entry's `drop` field is populated — no new registry entry. [Source: `ARCHITECTURE-SPINE.md` AD-5]
- **AD-6 (tools are islands):** the `dropArgsProviders`/`dropResult` signals Task 4 touches already live in the `registry` Pinia store (established by Story 2.2's own review-fix round, not a bare module `ref` as originally drafted) — this story's fix widens their type, it doesn't relocate them or add a new cross-tool store. [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **AD-14 (shell owns OS I/O edges exactly once):** `DropZone.vue` remains the single generic dispatcher — it already invokes `activeTool.drop.handler` directly (this codebase's actual, review-settled interaction model, not the "detect-and-route only" model originally drafted in Story 2.2's story file before review). Task 4 fixes that one dispatcher's type-narrowness and ordering guarantee; `HashView.vue` still registers no listener of its own. [Source: `ARCHITECTURE-SPINE.md` AD-14]
- **AD-15 (files cross IPC as paths):** the dropped file's path crosses IPC as a string (unchanged); `fs_helper::read_file_bytes` is the only thing that opens a file handle. [Source: `ARCHITECTURE-SPINE.md` AD-15]
- **AD-16 (slow commands are request-ID'd, latest-wins):** this story is what makes AD-16 actually true for drop-triggered commands — today it only holds for in-tool `invoke` calls via each view's own `createLatestWinsRunner()`. Task 4 closes that gap at the one shared dispatcher. [Source: `ARCHITECTURE-SPINE.md` AD-16]

### Library/Framework requirements

- No new dependencies, Rust or JS. `sha2`/`sha1`/`md-5` (Story 2.4) hash arbitrary bytes regardless of source. `fs_helper::read_file_bytes` (Story 2.2) is reused exactly as that story's own Dev Notes anticipated ("the first consumer is Base64... Story 2.5 (hash files) hits the identical read/write failure modes against a different tool").
- No Context7/registry research needed this session — this story is pure recombination of two already-verified, already-implemented pieces (Story 2.4's hashing, Story 2.2's file-drop infrastructure), not new library surface.

### File Structure Requirements

- **Modified (no new files this story):**
  - `crates/umbra-core/src/hash.rs` (+`compute_bytes`, `compute` becomes a delegate, `MAX_INPUT_BYTES` made `pub`, +tests)
  - `src-tauri/src/commands/hash.rs` (+`hash_compute_file`, +`check_file_size`, +tests)
  - `src-tauri/src/lib.rs` (`use` line updated, +1 `generate_handler!` entry)
  - `src/stores/registry.ts` (hash entry's `drop` field populated; `dropResult`'s `value` type widened `string` → `unknown`)
  - `src/shell/DropZone.vue` (`invoke<string>` → `invoke<unknown>`; wraps its `invoke` call in `createLatestWinsRunner()`)
  - `src/tools/base64/Base64View.vue` (one line: `result.value` → `result.value as string`, forced by the `dropResult` type widening — **this file is in scope for this story even though it's not the Hash tool**, purely as a ripple from Task 4; do not touch any other part of it)
  - `src/tools/hash/HashView.vue` (+drop consumption, +drop-hint paragraph)
  - `src/shell/dropZone.spec.ts`, `src/tools/hash/HashView.spec.ts` (extended)
  - `Cargo.lock` (no dependency change expected, but regenerate if `cargo build` touches it)
- **Not touched:** `src/router/index.ts`, `src/router/index.spec.ts`, `src/shell/AppSidebar.vue`, `src/shell/CommandPalette.vue`/`CommandPalette.spec.ts` (no new registry entry, no tool-count change — unlike Story 2.4, this story only adds a `drop` field to an existing entry, mirroring Story 2.2's base64 case), `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `src-tauri/src/fs_helper.rs` (consumed as-is, not modified — its codes were already written generically for this exact story), `crates/umbra-core/src/base64.rs`, any JSON/UUID tool file.

### Testing Requirements

- Rust: `cargo test --workspace` covering the refactored `hash.rs` (confirm zero regression on Story 2.4's existing tests) plus new `compute_bytes`/`hash_compute_file` tests. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`.
- TypeScript: `pnpm test` covering extended `dropZone.spec.ts` (new hash-drop test + the latest-wins regression test — **the latest-wins test is the most important one in this story**, since it's the only thing that actually proves AC2/AD-16 compliance rather than just that hashing a dropped file works at all) and extended `HashView.spec.ts` (mounted with explicit `Pinia`, matching `Base64View.spec.ts`'s drop-test harness).
- `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all pass locally before the PR — `vue-tsc` is what will actually catch the `Base64View.vue` cast requirement from the `dropResult` type widening if it's missed.
- Manual: `pnpm tauri dev`, per Task 8 — deferred to the user, same precedent as every story since 1.7.

### Previous Story Intelligence

- **From Story 2.4 (immediate predecessor, same core module):** explicitly flagged this exact split as its own deferred item — "Story 2.5 (Hash files) is the very next story and will extend `umbra-core::hash` with file-byte hashing plus a drop handler — keep `compute(input: &str)`'s signature and `HashDigests` shape reusable for a future `compute_bytes(&[u8])` split... but do not build that split now — YAGNI until 2.5 actually needs it." Task 1 is exactly that trigger. Story 2.4 also fixed a dead-code review finding (`Base64View.vue`'s `errorLocation` computed property copied into `UuidView.vue`/`HashView.vue` despite `hash.rs` never returning a `Position`) — irrelevant to this story's new code (no new error-rendering path is added), but a reminder not to copy patterns from views this tool doesn't structurally need.
- **From Story 2.2 (the file-drop/`fs_helper` precedent — read in full this session, not just its Dev Notes):** the *as-drafted* interaction model in that story's own task text ("`DropZone.vue` only detects-and-routes... the active tool's own view invokes its own command") was **overridden during that story's code review** — the user explicitly chose the generic-dispatcher model instead, where `DropZone.vue` itself calls `invoke(activeTool.drop.handler, ...)`. **The actual, current code (verified by reading `DropZone.vue`, `registry.ts` directly this session) already reflects the post-review model** — `dropArgsProviders`/`dropResult` live in the `registry` Pinia store, not a bare `lastDrop` ref. This story's Dev Notes describe the *current* state throughout, not Story 2.2's original draft — do not implement against Story 2.2's task text as if it were still accurate; read `DropZone.vue`/`registry.ts` directly if any doubt arises.
- Story 2.2's review also fixed the exact "size guard runs after the file is already read into memory" bug that Task 2 above proactively avoids by checking `metadata()` first — this is a **repeat-prevention** callout, not new information: the same category of mistake was made once already in this codebase and is now explicit here so it isn't made a second time.
- **Cross-epic:** no story since 2.2 has touched `src/shell/DropZone.vue` or `src/stores/registry.ts`'s drop-related fields — this story is the second to extend that shared infrastructure, exactly as anticipated.

### Git Intelligence

- `main`'s tip at story-creation time is `e391345` (this story's `baseline_commit`), Story 2.4's code-review-fix commit. The commits since Story 2.3's merge (`2febdc0`) are all Story 2.4's own work (`55f08ae` feat, `e33a2c2` docs, `e391345` fix) — no other story or infrastructure change has landed in between, so this story starts from exactly the state Story 2.4's Dev Notes/File List describe.
- No commit since `2febdc0` has touched `src/shell/DropZone.vue`, `src/stores/registry.ts`'s drop fields, or `src-tauri/src/fs_helper.rs` — all three are exactly as Story 2.2 (review-patched) left them; this story is their first consumer since.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.5: Hash files; FR15, AD-14, AD-15, AD-16; Epic 2 summary]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — FR15 (digests of a dropped file), NFR4 (no crash on bad/huge input)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1, AD-2 (functional core), AD-3 (ToolError), AD-4 (async), AD-5 (registry), AD-6 (islands), AD-14 (drop dispatch), AD-15 (files-as-paths), AD-16 (request-ID/latest-wins)]
- Live-verified this session via a direct read-only pass over the actual current code (not just prior story docs): `src/stores/registry.ts`, `src/shell/DropZone.vue`, `src/shell/dropZone.ts`, `src/shell/dropZone.spec.ts`, `src/shell/invoke.ts`, `src-tauri/src/fs_helper.rs`, `src-tauri/src/commands/{hash,base64}.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/mod.rs`, `crates/umbra-core/src/{hash,lib}.rs`, `src/tools/hash/{HashView.vue,HashView.spec.ts,hashDigests.ts}`, `src/tools/base64/{Base64View.vue,Base64View.spec.ts}`. This surfaced two things neither story's own text states: (1) `registry.dropResult`'s `value` field is hardcoded to `string`, which cannot hold a `HashDigests` object as-is; (2) the shared `DropZone.vue` dispatcher has no request-ordering guard at all, despite this story's own AC2 requiring drop latest-wins. Both are addressed in Task 4.

## Change Log

- 2026-07-31: Story drafted via `bmad-create-story`, following Story 2.4's completion. Exhaustive-analysis pass included reading Story 2.2 and Story 2.4 in full (not summaries) plus a live read-only sweep of the actual current `registry.ts`/`DropZone.vue`/`fs_helper.rs`/`hash.rs`/`commands/hash.rs`/`commands/base64.rs` state. This surfaced that Story 2.2's own task text describes an interaction model its code review later overrode — the current code already reflects the post-review generic-dispatcher design, which this story's Dev Notes describe directly from source rather than from the superseded draft. Also surfaced two gaps neither predecessor story's text flags: `registry.dropResult`'s `value: string` type can't hold `HashDigests`, and the shared drop dispatcher has no latest-wins guard despite this story's AC2 requiring one — both are scoped into Task 4 as shared-infrastructure fixes, following Story 2.2's own precedent of extending shared shell code as its next consumer needs it.
- 2026-07-31: Implemented via `bmad-dev-story` (Claude Sonnet 5). Tasks 1-7 completed: `umbra-core::hash::compute_bytes`/`compute` split, the `hash_compute_file` Tauri command, the Tool Registry `drop` field on the existing `hash` entry, the shared `DropZone.vue`/`registry.dropResult` type-widening and latest-wins fixes (also closing the same latent gap for Base64 drops), `HashView.vue` drop consumption, full Rust/TypeScript test coverage, and a full verification pass (fmt/clippy/lint/build/type-check), all green. Task 8 (manual `pnpm tauri dev` check) deferred to the user per established precedent since Story 1.7.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `feat/story-2-4-hash-text` (this branch's prior base) was already squash-merged into `origin/main` as `42478ea` (PR #28) with zero diff against local — created `feat/story-2-5-hash-files` from updated `origin/main` rather than continuing on the stale branch, carrying over the uncommitted sprint-status.yaml/story-file changes from story creation via `git stash push -u` (stash must include untracked files, since the new story file wasn't yet tracked).
- No compile/test failures encountered during implementation — Task 1's refactor was verified against Story 2.4's existing 6 tests before any new test was written (pure-refactor gate), and every subsequent task's Rust/TypeScript checks passed on first run.

### Completion Notes List

- Split `umbra-core::hash::compute` into `compute_bytes(&[u8])` (the single implementation) + `compute(&str)` (a one-line delegate), made `MAX_INPUT_BYTES` `pub`. Verified as a pure refactor: all 6 of Story 2.4's existing tests pass unmodified before any new test was added.
- Implemented Tauri command `hash_compute_file`: `std::fs::metadata`-based size check *before* `fs_helper::read_file_bytes`, reusing the existing `hash-input-too-large` code and the shared `MAX_INPUT_BYTES` cap (no second, smaller file cap — unlike Base64's file-encode command, hash output size doesn't depend on input size).
- Populated the existing `hash` registry entry's `drop` field (`{ acceptedMimeTypes: [], handler: "hash_compute_file" }`) — the only registry change; no new sidebar/palette/router entries, so `router/index.spec.ts` and `CommandPalette.spec.ts` needed no updates (confirmed by the full test run staying green).
- Fixed the two shared drop-dispatcher gaps this story exposed: widened `registry.dropResult`'s `value` type from `string` to `unknown` (with `Base64View.vue`'s own consumer narrowing it back to `string` at its call site, and `HashView.vue`'s narrowing to `HashDigests` at its own), and wrapped `DropZone.vue`'s single `invoke()` call in `createLatestWinsRunner()` so a newer drop's outcome always survives an older, slower-resolving one — this is a byproduct fix that also closes the same latent race for Base64 drops.
- Implemented `HashView.vue`'s drop consumption: watches `registry.dropResult`, no `dropArgsProvider` registered (handler takes only `path`), reuses the existing `digests`/`error` template block for both success and error rendering — no new rendering code needed for AC3.
- Full test suite: 59 core + 36 command Rust tests (3 new `hash_compute_file` tests), 145 TypeScript tests (2 new `dropZone.spec.ts` tests including the latest-wins regression test, 4 new `HashView.spec.ts` drop tests), all passing. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all clean.
- Task 8 (manual `pnpm tauri dev` check) deferred to the user, per established precedent since Story 1.7 — the dev agent cannot visually drive a native Tauri window.

### File List

**Modified:**
- `crates/umbra-core/src/hash.rs` (+`compute_bytes`, `compute` now delegates, `MAX_INPUT_BYTES` made `pub`, +4 tests)
- `src-tauri/src/commands/hash.rs` (+`hash_compute_file`, +`check_file_size`, +3 tests)
- `src-tauri/src/lib.rs` (`use` line updated, +1 `generate_handler!` entry)
- `src/stores/registry.ts` (hash entry's `drop` field populated; `dropResult`'s `value` type widened `string` → `unknown`)
- `src/shell/DropZone.vue` (`invoke<string>` → `invoke<unknown>`; wraps its `invoke` call in `createLatestWinsRunner()`)
- `src/tools/base64/Base64View.vue` (one line: `result.value` → `result.value as string`, ripple from the `dropResult` type widening)
- `src/tools/hash/HashView.vue` (+drop consumption watcher, +drop-hint paragraph and its `.drop-hint` style)
- `src/shell/dropZone.spec.ts` (+2 tests: hash-drop path-only invoke, latest-wins regression)
- `src/tools/hash/HashView.spec.ts` (mount switched to explicit `Pinia`; +4 drop-consumption tests)
- `Cargo.lock` (no dependency change; regenerated by `cargo build`/`cargo test` runs)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions)
