---
baseline_commit: 9ef652a
---

# Story 1.9: Stay responsive on 10 MB documents

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want huge JSON documents handled without freezing the app,
so that the tool is trustworthy on real-world payloads.

## Acceptance Criteria

1. **Given** a JSON document of at least 10 MB, **when** I format, minify, validate, or render it as a tree, **then** the UI stays responsive throughout with no main-thread block over ~200 ms (FR9), **and** parsing/formatting runs inside async commands on the Rust blocking thread pool (AD-4) — `json_format`, `json_minify`, and `json_parse` all dispatch their CPU work via `tauri::async_runtime::spawn_blocking`, closing the gap Story 1.8's Dev Notes explicitly deferred to this story.
2. **Given** rapid successive edits triggering re-invocations, **when** results return out of order, **then** the latest request wins and older results are dropped on arrival — no stale overwrite (AD-16). This mechanism (`createLatestWinsRunner`) already exists from Stories 1.7–1.8; this story proves it holds with realistic large/distinct payloads racing, not just the empty-input special case already tested.
3. **Given** profiling shows the single-payload tree transfer cannot meet FR9, **when** a fallback is needed, **then** the lazy per-node fetch alternative is raised as a spine amendment (AD-3 contract change) — never implemented as a quiet switch. This story is where that profiling actually happens; do not write any lazy-fetch code without an explicit go-ahead from the user first.

## Tasks / Subtasks

- [x] **Task 1: Dispatch `json_format`/`json_minify`/`json_parse` onto Tauri's blocking thread pool** (AC: 1)
  - [x] In `src-tauri/src/commands/json.rs`, wrap each command's call to the pure `umbra-core` function in `tauri::async_runtime::spawn_blocking`. **Verified this session directly against `docs.rs/tauri/2.9.3` (Context7):** `tauri::async_runtime::spawn_blocking<F, R>(func: F) -> JoinHandle<R>` where `F: FnOnce() -> R + Send + 'static`. Unlike raw `tokio::task::JoinHandle` (which needs `.await??` double-chaining per tokio's own docs), **`tauri::async_runtime::JoinHandle<T>` implements `Future<Output = tauri::Result<T>>`** — its `poll` impl already maps the inner `JoinError` via `Into`, so `.await` yields `Result<T, tauri::Error>` directly. One `map_err` + `?` is enough; do not reach for `tokio::task::JoinError` or import `tokio` into production code — `tokio` in this workspace is a `[dev-dependencies]`-only crate (`src-tauri/Cargo.toml:32`, comment: "the app itself uses Tauri's own runtime, not tokio"), so importing it outside `#[cfg(test)]` would be a build break, not just a style nit.
    ```rust
    use umbra_core::ToolError;
    use umbra_core::json::{JsonIndent, JsonTreeValue, format, minify, parse};

    #[tauri::command]
    pub async fn json_format(input: String, indent: JsonIndent) -> Result<String, ToolError> {
        tauri::async_runtime::spawn_blocking(move || format(&input, indent))
            .await
            .map_err(map_join_error)?
    }

    #[tauri::command]
    pub async fn json_minify(input: String) -> Result<String, ToolError> {
        tauri::async_runtime::spawn_blocking(move || minify(&input))
            .await
            .map_err(map_join_error)?
    }

    #[tauri::command]
    pub async fn json_parse(input: String) -> Result<JsonTreeValue, ToolError> {
        tauri::async_runtime::spawn_blocking(move || parse(&input).map(Into::into))
            .await
            .map_err(map_join_error)?
    }

    fn map_join_error(err: tauri::Error) -> ToolError {
        ToolError {
            code: "json-internal".to_string(),
            message: format!("background task panicked: {err}"),
            position: None,
            context: None,
        }
    }
    ```
    Note the `?` on the last line of each command: `.await.map_err(map_join_error)` produces `Result<Result<T, ToolError>, ToolError>`; `?` unwraps exactly the outer layer (propagating a join failure through `map_join_error`'s `Into`) and leaves the inner `Result<T, ToolError>` — which is already the command's declared return type — as the function's tail expression. No `unwrap`/`expect` anywhere (repo convention, `ARCHITECTURE-SPINE.md` Consistency Conventions table).
  - [x] `umbra-core` itself does **not** change — `format`/`minify`/`parse` stay pure sync functions (AD-1/AD-2); only the `src-tauri` command layer changes. This keeps the story's Rust surface small and consistent with `ARCHITECTURE.md`'s "thin shell owns the async dispatch" framing.
  - [x] The existing `#[tokio::test]` integration tests in `src-tauri/src/commands/json.rs` (`json_format_command_pretty_prints_valid_input`, etc.) should keep passing unchanged — `spawn_blocking`'s internal runtime is independent of whatever runtime `#[tokio::test]` sets up for the test itself, so awaiting it from within a test works the same way it already does for existing tests.

- [x] **Task 2: Prove the 10 MB bar with a real fixture, on both sides of the IPC boundary** (AC: 1, evidence for AC: 3)
  - [x] Add a small, local fixture generator (duplicate it in both test modules below — ~15 lines, not worth a shared `test-util` feature) that builds a **wide, flat JSON array** of many small same-shaped objects until the serialized string reaches at least 10 MB, e.g.:
    ```rust
    fn large_json_fixture(min_bytes: usize) -> String {
        let mut out = String::from("[");
        let mut i: u64 = 0;
        while out.len() < min_bytes {
            if i > 0 {
                out.push(',');
            }
            out.push_str(&format!(
                r#"{{"id":{i},"name":"item-{i}","active":{active},"tags":["a","b","c"]}}"#,
                active = i % 2 == 0
            ));
            i += 1;
        }
        out.push(']');
        out
    }
    ```
    **Deliberately flat, not deeply nested.** `deferred-work.md`'s Story 1.8 entry already flags a *pre-existing, out-of-scope* stack-overflow risk in `parse`/`From<Value>` on deeply nested input — a flat 10 MB array of ~small objects is both the realistic shape for this AC (large arrays/log dumps, not deeply nested trees) and avoids tripping that unrelated gap. Don't "fix" the nesting issue in this story; it isn't one of this story's ACs.
  - [x] In `crates/umbra-core/src/json.rs`'s test module: unit tests that `format`, `minify`, and `parse` all complete correctly (not just fast) on the 10 MB fixture — assert `.is_ok()` and, for `parse`, assert the resulting value's array length matches the generated item count. These run with no Tauri/tokio involved, proving the pure functions themselves aren't the bottleneck.
  - [x] In `src-tauri/src/commands/json.rs`'s test module: `#[tokio::test]` timing regression tests for all three commands against the fixture, e.g.:
    ```rust
    #[tokio::test]
    async fn json_parse_command_handles_10mb_document() {
        let input = large_json_fixture(10 * 1024 * 1024);
        let start = std::time::Instant::now();
        let result = json_parse(input).await;
        let elapsed = start.elapsed();
        assert!(result.is_ok());
        // Generous ceiling, not a tight ~200ms UI-thread assertion — this is a
        // regression/smoke guard against pathological blow-ups, run across three
        // CI OSes (AD-11) with different baseline speeds. The actual UI-thread
        // responsiveness claim (AC1) can only be proven by hand against a real
        // webview — see Task 4 — because Tauri's macOS webview has no WebDriver
        // support (the same limitation Story 1.8's Dev Notes recorded).
        assert!(elapsed.as_secs() < 5, "json_parse took {elapsed:?} on a 10MB document");
    }
    ```
    Do the same for `json_format`/`json_minify`. **Record the actual measured `elapsed` values** (not just pass/fail) in this story's Debug Log / Completion Notes — Task 4 needs real numbers to make an honest AC3 call, not just a boolean "under 5s."

- [x] **Task 3: Regression-test AD-16 latest-wins with realistic, non-trivial payloads** (AC: 2)
  - [x] `createLatestWinsRunner`/AD-16 is already fully wired for all three JSON invocations (`runLatestWins` for Format/Minify/Paste, a dedicated `runTreeParse` for live tree-parsing — both in `src/tools/json/JsonView.vue`, established in Stories 1.7–1.8). **This task adds coverage, it does not add new plumbing.** The only existing out-of-order regression test in `JsonView.spec.ts` is `"discards a stale Paste read that resolves after a newer Paste click"` (uses the file's `deferred<T>()` helper) plus a tree-specific one that only covers the *empty-input* case (`"ends up with a null tree, not a stale value, when input is cleared before a slow parse resolves"`). Neither proves the general "two distinct non-trivial results race, newer wins" case for Format/Minify output or for two different non-null trees.
  - [x] Add to `src/tools/json/JsonView.spec.ts`, following the exact `deferred<T>()` pattern already used for Paste:
    - A test where two `json_format` (or `json_minify`) calls are in flight and the **older** one resolves **after** the newer one — assert `output` ends up as the newer call's result, not overwritten by the stale one landing late.
    - A test where two `json_parse` (live tree) calls race with **two different non-null `JsonTreeValue`s** (not null-vs-value) — assert `JsonTree`'s `value` prop ends up as the newer tree, proving `runTreeParse`'s counter discards the older, distinct tree rather than just the empty-input special case already covered.
  - [x] No production code changes are expected for this task — if either test fails against the current implementation, that's a real regression to investigate, not an assumption to code around.

- [x] **Task 4: Make the AC3 profiling call — and stop if it says fallback** (AC: 3)
  - [x] Read Task 2's measured Rust-side timings first. If `json_parse`'s 10 MB handling comfortably clears a low-hundreds-of-ms budget server-side (leaving headroom for IPC serialization + Vue's reactive update before the ~200ms UI bar), proceed to the manual check below. If it doesn't, **stop here** — do not write any lazy-fetch/per-node-IPC code. Instead, write up the measured numbers (what was slow: parse, `From<Value>` conversion, IPC serialization?) and present them to the user as the AD-3-contract-changing decision AC3 requires — this is a "raise it," not a "silently pick a design," moment.
  - [x] Manually verify with `pnpm tauri dev`: drop or paste a real ≥10 MB `.json` file (generate one with Task 2's fixture shape, or any large real-world array-of-objects payload) into the running app. Confirm the window keeps accepting input (you can still type in another field, drag the window, or interact) while the parse/format/minify runs — same manual-verification precedent Stories 1.7/1.8 used, since Tauri's macOS webview has no WebDriver support for automating this.
  - [x] **Record the outcome explicitly, either way** — this AC has no default: append a short dated note to `ARCHITECTURE-SPINE.md`'s Deferred section, immediately after the existing struck-through "JSON tree IPC transfer strategy" bullet (`_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md:239`), stating that Story 1.9 profiled the single-payload strategy against a 10 MB fixture and it held (with the numbers) — or, if it didn't hold, that a spine amendment is pending. Also state the outcome in this story's Completion Notes.

- [x] **Task 5: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` (this now includes Task 2's 10 MB regression tests, so a first local run may take noticeably longer than prior stories — that's expected, not a hang).
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`.
  - [x] The manual `pnpm tauri dev` check from Task 4 doubles as this task's manual verification — no separate pass needed.

- [x] **Task 6: Close the deferred-work item, commit, and open a PR**
  - [x] Remove (or mark resolved) the `deferred-work.md` entry *"`json_parse` has no `spawn_blocking`..."* under "Deferred from: code review of 1-8-inspect-json-as-a-collapsible-tree" (`_bmad-output/implementation-artifacts/deferred-work.md:31`) — this story is exactly what that entry deferred to.
  - [x] Branch: `feat/story-1-9-<slug>` (repo convention, e.g. `feat/story-1-9-stay-responsive-10mb`).
  - [x] Conventional Commit(s), `perf`/`fix` type scoped to `core`/`json` as size warrants.
  - [x] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

## Dev Notes

### Architecture compliance for this story

- **AD-4 (this story's core deliverable):** "work that can exceed ~100ms CPU runs async on the Rust blocking thread pool." `json_format`/`json_minify`/`json_parse` were deliberately left as plain `async fn` with no `spawn_blocking` through Stories 1.7–1.8 — both stories' own Dev Notes name this story as where that gap closes. Story 1.8's tree-parse work made this more urgent (it fires on every debounced keystroke, not just a button click), but doesn't change what needs to happen: wrap the CPU work, don't change the pure functions. [Source: `ARCHITECTURE-SPINE.md` AD-4; Story 1.8 Dev Notes]
- **AD-16 (verify, don't rebuild):** the latest-wins request-ID mechanism already exists and is already correctly scoped per-invocation-stream (a dedicated `runTreeParse` instance separate from `runLatestWins`, precisely to avoid Format/tree-parse counters colliding — see Story 1.8 Task 6's Dev Notes for the exact bug this separation prevents). This story's job is proving it holds at realistic scale, not re-architecting it. [Source: `ARCHITECTURE-SPINE.md` AD-16]
- **AD-3 (the guardrail on AC3):** if profiling forces a transfer-strategy change, that's a contract change to the wire shape `json_parse` already established (Story 1.8's `JsonTreeValue`) — AD-3-level, not a quiet internal refactor. `ARCHITECTURE-SPINE.md`'s Deferred section already states the fallback is introduced "only as an explicit spine amendment... never as a silent switch" — this story is what actually runs that experiment, so treat a negative result as a stop-and-report, not a green light to redesign unilaterally. [Source: `ARCHITECTURE-SPINE.md` AD-3, Deferred section]
- **AD-1/AD-2 (stay pure):** don't add `spawn_blocking` or any Tauri-aware code inside `umbra-core::json` — `format`/`minify`/`parse` remain plain, synchronous, dependency-clean functions. The thread-pool dispatch belongs entirely to the `src-tauri` command layer, which is the only place with a Tauri async runtime to dispatch onto.
- **No `unwrap`/`expect` in command paths** (Consistency Conventions table) — `map_join_error` turns a background-task panic into a structured `ToolError` (`code: "json-internal"`, reusing the exact code `map_internal_error` already uses for other "should be exceptional" failures in this file) instead of propagating a raw panic or unwrapping the join result.

### Previous Story Intelligence (from Story 1.8)

- **This story was explicitly pre-scoped by Story 1.8.** Its Dev Notes state, verbatim: *"Explicitly out of scope, per the same precedent Story 1.7 set... dispatching `json_parse` onto the Rust blocking thread pool is Story 1.9's job."* Story 1.8's own code-review findings list confirms this as a `[Review][Defer]` item, not a bug — nothing to "fix" retroactively in 1.8's code, just complete the deferred piece here.
- **Manual verification precedent:** Stories 1.7 and 1.8 both used `pnpm tauri dev` + manual interaction as the verification method for claims a headless test can't prove (Tauri's macOS webview has no WebDriver — `tauri-driver` only covers Windows/Linux). AC1's "~200ms main-thread block" claim is exactly this kind of claim; Task 4 follows the same pattern rather than inventing new tooling.
- **Testing convention to continue:** co-locate tests next to source (`*.spec.ts` in TS, `#[cfg(test)] mod tests` in Rust); don't mock this project's own code, only platform/third-party boundaries (`@tauri-apps/api/core`'s `invoke` is already mocked in `JsonView.spec.ts`).
- **`ToolError.code` values already in use in this file:** `"json-syntax"` (parse errors, has `Position::LineCol`), `"json-internal"` (re-serialization/UTF-8 failures, no position). This story's `map_join_error` reuses `"json-internal"` rather than inventing a third code — a background-task panic is the same category of "should be exceptional, not a user-facing validation failure" as the existing `map_internal_error` cases.

### Git Intelligence

- Last 5 commits are all Story 1.7–1.8 work: `9ef652a` (docs: mark 1.8 done), `9426028` (fix: 1.8 code-review findings — touched `crates/umbra-core/src/json.rs`, `src-tauri/src/commands/json.rs`, `src/tools/json/JsonView.vue`), `0d10797` (feat: 1.8 tree view — same three files plus new tree-specific files), `7285cba` (feat: 1.7 format/minify/validate, PR #9), `1fb642f` (feat: 1.6 ⌘K palette). The three files this story touches (`crates/umbra-core/src/json.rs` — test-only additions; `src-tauri/src/commands/json.rs` — the real change; `src/tools/json/JsonView.spec.ts` — new regression tests) are exactly the files modified by both prior JSON stories, confirming this story is an incremental change to established code, not new surface area.
- Baseline commit for this story: `9ef652a` (current `main` tip at story creation time).

### Project Structure Notes

- Modified: `src-tauri/src/commands/json.rs` (`+spawn_blocking` wrapping, `+map_join_error`, `+3` timing regression tests, `+` local fixture helper), `crates/umbra-core/src/json.rs` (`+3` 10 MB correctness tests, `+` local fixture helper — no production code changes), `src/tools/json/JsonView.spec.ts` (`+2` latest-wins regression tests), `_bmad-output/implementation-artifacts/deferred-work.md` (resolve the spawn_blocking entry), `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` (append the profiling outcome to the Deferred section).
- Not touched: `src/tools/json/JsonTree.vue`, `flattenJsonTree.ts`, `jsonTreeValue.ts` (no known perf issue there — collapse-based pruning already bounds visible-row count regardless of document size, per Story 1.8's Dev Notes; if Task 4's manual check finds an actual rendering-side bottleneck, that's new information to report, not something to silently patch), `src-tauri/capabilities/default.json` (no new command, no new plugin), `src/shell/invoke.ts` (used as-is — a new call site, not a change to `createLatestWinsRunner`'s factory).

### Testing Requirements

- Rust: `cargo test --workspace` covering both new `umbra-core` correctness tests (pure functions, no tokio) and new `src-tauri` timing regression tests (`#[tokio::test]`, generous multi-second ceilings — not tight enough to flake across the three-OS CI matrix, AD-11).
- TypeScript: `pnpm test` covering the two new `JsonView.spec.ts` latest-wins regression tests (fake timers already set up file-wide, `deferred<T>()` helper already present — reuse it, don't reinvent).
- `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `pnpm lint`, `pnpm build` all pass locally before the PR (unchanged from prior stories).
- Manual: `pnpm tauri dev` with a real ≥10 MB JSON file — this is not optional decoration, it's the only way to actually evidence AC1's UI-thread claim and make Task 4's AC3 call honestly.
- Out of scope for this story: fixing the pre-existing deep-nesting stack-overflow risk in `parse`/`From<Value>` (deferred-work.md, Story 1.8 entry — orthogonal to a wide/flat 10 MB document); any UI/CSS work on `JsonTree.vue` or the textarea panels; adding a shared cross-crate test-fixture utility (the small generator is cheap enough to duplicate twice).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.9: Stay responsive on 10 MB documents; Story 1.8 (established `json_parse`/`JsonTreeValue`, deferred thread-pool dispatch here); AD-1, AD-2, AD-3, AD-4, AD-16; FR9]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-4 (blocking thread pool rule), AD-16 (latest-wins), Deferred section's "JSON tree IPC transfer strategy" entry (the fallback-as-spine-amendment rule this story's AC3 enforces)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "Performance and responsiveness (AD-4, AD-16)" section, connecting NFR9's 200ms/10MB bar and NFR2's cold-launch bar to the same "nothing expensive on the main thread" rule]
- [Source: `_bmad-output/implementation-artifacts/1-8-inspect-json-as-a-collapsible-tree.md` — Dev Notes explicitly deferring `spawn_blocking` to this story; Review Findings `[Review][Defer]` entry for the same; established `runTreeParse`/`runLatestWins` dual-runner pattern this story must not duplicate]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — the `json_parse` spawn_blocking entry this story resolves; the deep-nesting stack-overflow entry this story deliberately does not touch]
- Live-verified this session by direct file read: `crates/umbra-core/src/json.rs`, `src-tauri/src/commands/json.rs`, `src-tauri/lib.rs`, `src-tauri/Cargo.toml` (confirmed `tokio` is `[dev-dependencies]`-only — no runtime tokio dependency exists), `src/tools/json/JsonView.vue`, `src/tools/json/JsonView.spec.ts`, `src/tools/json/JsonTree.vue`, `src/shell/invoke.ts`, `.github/workflows/ci.yml` (confirmed `cargo test --workspace` runs on all three OS runners with a 20-minute job timeout — informs the "generous, not tight" timing-assertion guidance above).
- Context7 (`docs.rs/tauri/2.9.3` via `/websites/rs_tauri_2_9_3`, verified this session): `tauri::async_runtime::spawn_blocking<F, R>(func: F) -> JoinHandle<R>` signature; `impl<T> Future for JoinHandle<T> { type Output = crate::Result<T>; }` — confirming `.await` on a Tauri `JoinHandle` yields `tauri::Result<T>` directly (single-unwrap), unlike raw `tokio::task::JoinHandle` which needs `.await??`. This is the detail Task 1 is built around; get it wrong and either the code won't compile (using `tokio::task::JoinError` types that don't apply here) or it'll double-`?` against a type that's already flat.

### Review Findings

- [x] [Review][Patch] (resolved decision) Add an automated concurrency test proving `spawn_blocking` keeps the async runtime unblocked — added `spawn_blocking_lets_a_light_command_finish_promptly_alongside_a_heavy_one` [src-tauri/src/commands/json.rs]
- [x] [Review][Patch] (resolved decision) Raise the 5-second CI timing ceiling on the three new 10MB regression tests — raised to 20s [src-tauri/src/commands/json.rs]

- [x] [Review][Patch] `map_join_error`'s panic-handling branch has zero test coverage — added `map_join_error_produces_json_internal_tool_error_on_panic` [src-tauri/src/commands/json.rs]
- [x] [Review][Patch] `parse_succeeds_on_10mb_document`'s expected-length oracle re-derives the count via a fragile substring match instead of reusing the loop counter — `large_json_fixture` now returns `(String, u64)` and the test uses the real counter [crates/umbra-core/src/json.rs]
- [x] [Review][Patch] `map_join_error`'s message hardcodes "background task panicked" even though a `tauri::Error` join failure can also arise from non-panic causes — reworded to "background task failed" [src-tauri/src/commands/json.rs:28]
- [x] [Review][Patch] Completion Notes' Task 1 bullet inaccurately claims "All 9 pre-existing `src-tauri` command tests pass unchanged" — corrected to "6 pre-existing... (9 total after adding the 3 new 10MB regression tests)" [this file, Completion Notes List, Task 1 bullet]

- [x] [Review][Defer] Superseded `spawn_blocking` jobs are never cancelled — a stale Format/Minify/live-parse call still runs its CPU work to completion on the blocking thread pool even after the UI has already discarded its result via latest-wins. Real but pre-existing: the debounce + `createLatestWinsRunner` design was established in Stories 1.7-1.8 and this story's own Dev Notes scope AD-16 work to "verify, don't rebuild" [src/tools/json/JsonView.vue, src-tauri/src/commands/json.rs] — deferred, pre-existing
- [x] [Review][Defer] AC1's own wording lists "format, minify, validate, or render it as a tree" as the operations that must stay responsive, but no `json_validate` command exists anywhere in the codebase (confirmed by search) — this wording is inherited unchanged from the epics/Story 1.7 phrasing and out of scope for this story's actual diff [this file, Acceptance Criteria 1] — deferred, pre-existing

## Change Log

- 2026-07-27: All 6 tasks implemented on `feat/story-1-9-stay-responsive-10mb`, branched from `main` after fast-forwarding it to `origin/main` (Story 1.8's PR #10 had squash-merged since the prior session's `feat/story-1-8` branch head). `json_format`/`json_minify`/`json_parse` dispatch onto Tauri's blocking thread pool (AD-4); 10 MB fixture correctness/timing regression tests added on both sides of the IPC boundary; AD-16 latest-wins regression coverage added for realistic non-trivial payloads. AC3 profiling call made: single-payload transfer strategy holds, no spine amendment needed (outcome recorded in `ARCHITECTURE-SPINE.md`). `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` (30 tests), `pnpm lint`, `pnpm test` (69 tests), and `pnpm build` all pass locally. `pnpm tauri dev` manual verification performed by the user with a real 10 MB fixture confirmed the UI stays responsive.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- 10 MB fixture (10,485,814 bytes, 151,887 items) timing, `cargo test --workspace -- --nocapture` (debug build): `json_parse` 1.39s, `json_minify` 1.66s, `json_format` 1.83s.
- Same fixture, `cargo test --workspace --release -- --nocapture`: `json_parse` 438ms, `json_minify` 531ms, `json_format` 537ms.
- Manual `pnpm tauri dev` verification (dev/debug build) performed by the user with a real 10 MB fixture: window stayed responsive/draggable throughout; observed end-to-end latency ~1-1.5s for paste-to-textarea render, ~1-2s for tree appearance, ~2s for Minify — consistent with the debug-build Rust timings above plus IPC/render overhead, not a main-thread block.

### Completion Notes List

- Task 1: `json_format`/`json_minify`/`json_parse` now dispatch their `umbra-core` calls via `tauri::async_runtime::spawn_blocking`, with a new `map_join_error` mapping a background-task panic to a `"json-internal"` `ToolError`. `umbra-core` itself unchanged (stays pure/sync). All 6 pre-existing `src-tauri` command tests pass unchanged (9 total after adding the 3 new 10MB regression tests).
- Task 2: Added a local `large_json_fixture` generator (duplicated in both test modules per Dev Notes) producing a wide, flat ≥10 MB JSON array. `umbra-core` gained 3 correctness tests (`format`/`minify`/`parse` succeed on the fixture, `parse` asserted against the exact item count). `src-tauri` gained 3 `#[tokio::test]` timing regressions with a generous 5s ceiling; see Debug Log for actual measured numbers.
- Task 3: Added 2 regression tests to `JsonView.spec.ts` proving AD-16 latest-wins holds for realistic non-trivial payloads: two racing `Format` calls (older resolves late, newer output wins) and two racing live-parse calls with distinct non-null trees (older resolves late, newer tree wins). No production code changes were needed — `createLatestWinsRunner`/`runTreeParse` already handled both cases correctly.
- Task 4 (AC3 profiling call): release-build Rust-side handling of the 10 MB fixture (438-537ms) plus a manual `pnpm tauri dev` check (performed by the user, since Tauri's macOS webview has no WebDriver support and this agent has no native-window automation tool) confirmed the UI stays responsive — window remained draggable/interactive throughout every operation, with no observed freeze. The **single-payload transfer strategy holds**; no AD-3 spine amendment/lazy-fetch fallback is needed. Per-operation end-to-end latency (~1-2s in the debug build) reflects real computation + IPC + render cost for a 10 MB document, not a main-thread block — AC1 requires the latter, not sub-200ms total latency. Outcome recorded in `ARCHITECTURE-SPINE.md`'s Deferred section.

### File List

- `src-tauri/src/commands/json.rs` (modified: `spawn_blocking` dispatch, `map_join_error`, 3 new 10 MB timing regression tests, local fixture helper)
- `crates/umbra-core/src/json.rs` (modified: 3 new 10 MB correctness tests, local fixture helper — no production code changes)
- `src/tools/json/JsonView.spec.ts` (modified: 2 new AD-16 latest-wins regression tests)
- `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` (modified: appended Story 1.9 profiling outcome to Deferred section)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified: resolve the spawn_blocking entry)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified: story status tracking)
