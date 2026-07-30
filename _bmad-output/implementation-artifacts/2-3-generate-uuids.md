---
baseline_commit: 3c2e48b
---

# Story 2.3: Generate UUIDs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want to generate UUIDs v4 and v7, singly or in bulk,
so that I can fill fixtures and IDs without an online generator.

## Acceptance Criteria

1. **Given** the UUID tool, **when** I generate a single UUID (v4 or v7), **then** it appears with one-click copy (FR13).
2. **Given** a bulk count up to 1000, **when** I generate, **then** that many UUIDs render as a copyable list, and the UI stays responsive (FR13, AD-4), **and** a count above 1000 is rejected with an inline message, not clamped silently.
3. **Given** version selection, **when** I switch v4/v7, **then** output matches the selected version (v7 outputs are time-ordered).

## Tasks / Subtasks

- [x] **Task 1: `umbra-core::uuid` — the generation function (AC: 1, 2, 3)**
  - [x] `crates/umbra-core/Cargo.toml`: add `uuid = { version = "1.24", features = ["v4", "v7", "std"] }` — **verified this session directly against the crates.io registry API** (current stable: `1.24.0`, license `Apache-2.0 OR MIT`, permissive — clears this project's dependency-license bar without review). The `std` feature is easy to miss: `v7` silently requires it (the crate is no_std-capable by default, so `std` is opt-in, not implied), and `["v4", "v7"]` alone will fail to compile.
  - [x] **New file `crates/umbra-core/src/uuid.rs`.** Naming note: this module is named `uuid`, same as the external crate it wraps — `crates/umbra-core/src/base64.rs` already does exactly this (`use base64::{...}` inside a module also named `base64`), and it compiles without issue; follow that proven precedent, don't work around a collision that doesn't exist.
  - [x] Define the version selector as a typed enum, not a string, mirroring `JsonIndent` in `crates/umbra-core/src/json.rs` exactly (that's the established pattern for an enum-shaped parameter crossing the Tauri IPC boundary — Tauri deserializes it directly from the JS-side string, no manual parsing needed):
    ```rust
    #[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "snake_case")]
    pub enum UuidVersion { V4, V7 }
    ```
  - [x] `const MAX_COUNT: u32 = 1000;`
  - [x] `pub fn generate(version: UuidVersion, count: u32) -> Result<Vec<String>, ToolError>`:
    - `count == 0` → reject with `ToolError { code: "uuid-count-zero", message: "count must be at least 1", position: None, context: None }`. Not explicitly stated by the ACs, but is the same "explicit error over silent/surprising behavior" principle NFR4 and every prior tool's size guard already establish in this codebase — an empty list back with no explanation would be a worse UX than a one-line rejection. Flag in review if this reading is judged unnecessary.
    - `count > MAX_COUNT` → reject with `ToolError { code: "uuid-count-too-large", message: format!("count is {count}, which exceeds the {MAX_COUNT} limit"), position: None, context: None }` — mirrors `base64.rs`'s `check_size`/`base64-input-too-large` shape exactly (AC2's "rejected with an inline message, not clamped silently").
    - `UuidVersion::V4` branch: `(0..count).map(|_| Uuid::new_v4().to_string()).collect()`.
    - `UuidVersion::V7` branch — **the one genuinely non-obvious part of this story:** do **not** call `Uuid::now_v7()` bare inside the loop. The `uuid` crate's own docs warn that repeated `now_v7()` calls in a tight loop are **not guaranteed monotonic** if the system clock doesn't advance between calls (entirely plausible generating up to 1000 UUIDs in a sub-millisecond loop) — that would silently violate AC3's "v7 outputs are time-ordered" for exactly the bulk case this story has to support. Instead, create one `ContextV7` and reuse it across the whole batch:
      ```rust
      use uuid::{ContextV7, Timestamp, Uuid};

      let context = ContextV7::new();
      (0..count)
          .map(|_| Uuid::new_v7(Timestamp::now(&context)).to_string())
          .collect()
      ```
      This guarantees UUIDs generated within the same millisecond still sort strictly increasing (verified against the `uuid` crate's own docs this session, `/uuid-rs/uuid` via Context7).
  - [x] `crates/umbra-core/src/lib.rs`: add `pub mod uuid;` (insert alphabetically: `base64`, `error`, `json`, `uuid`).

- [x] **Task 2: Tauri command `uuid_generate` (AC: 1, 2, 3)**
  - [x] **New file `src-tauri/src/commands/uuid.rs`.** This tool has no file I/O, so `json.rs` (not `base64.rs`) is the closer template — copy its shape directly:
    ```rust
    use umbra_core::ToolError;
    use umbra_core::uuid::{UuidVersion, generate};

    #[tauri::command]
    pub async fn uuid_generate(version: UuidVersion, count: u32) -> Result<Vec<String>, ToolError> {
        tauri::async_runtime::spawn_blocking(move || generate(version, count))
            .await
            .map_err(map_join_error)?
    }

    fn map_join_error(err: tauri::Error) -> ToolError {
        ToolError {
            code: "uuid-internal".to_string(),
            message: format!("background task failed: {err}"),
            position: None,
            context: None,
        }
    }
    ```
    No `rename_all = "snake_case"` needed — both `version` and `count` are single-word parameter names (contrast `base64_encode`'s `url_safe`). `spawn_blocking` is used here for consistency with every existing command in this codebase (AD-4's own convention, confirmed in Story 2.2's Dev Notes), even though generating 1000 UUIDs is sub-millisecond work well under AD-4's ~100ms bar — don't skip it as a "this one's fast enough" judgment call; matching the established pattern matters more than a micro-optimization here.
  - [x] `src-tauri/src/commands/mod.rs`: add `pub mod uuid;` (insert alphabetically: `base64`, `json`, `uuid`).
  - [x] `src-tauri/src/lib.rs`: add `use commands::uuid::uuid_generate;` and register `uuid_generate` in the `generate_handler![...]` list.
  - [x] **No `src-tauri/Cargo.toml` change needed.** The `uuid` crate dependency lives in `umbra-core` only (AD-1: the transformation is core's job); `src-tauri`'s command file only imports the already-typed `UuidVersion` re-exported through `umbra_core::uuid`, it never constructs `uuid`-crate types directly — same reason `src-tauri` needs no direct dependency for `JsonIndent`.
  - [x] **No `src-tauri/capabilities/default.json` change needed.** Like every existing custom `#[tauri::command]` in this project, `uuid_generate` is not a plugin-provided command, so it isn't subject to the capability ACL (confirmed precedent: `json_format`/`base64_encode` need no capability entries either).

- [x] **Task 3: Tool Registry entry (AC: 1, 2, 3 — AD-5)**
  - [x] `src/stores/registry.ts`: add a new entry to `TOOLS` (insert after the existing `base64` entry):
    ```ts
    {
      id: "uuid",
      name: "UUID",
      aliases: ["uuid", "guid"],
      route: "/tools/uuid",
      icon: "ID",
      component: () => import("../tools/uuid/UuidView.vue"),
    },
    ```
    No `drop` field — this tool has no file-drop behavior (nothing in FR13 involves a dropped file). `"guid"` is included as an alias for the same reason `"b64"` is aliased to Base64 (FR2: aliases/synonyms a user might type in ⌘K).
  - [x] This is the **only** registry change needed — per the store's own header comment, the sidebar, palette index (Story 1.6), and route table (`routes` computed) all generate from this one entry. Do **not** hand-edit `src/router/index.ts`, `src/shell/AppSidebar.vue`, or `src/App.vue` — none of them need to change for a new non-drop tool.

- [x] **Task 4: `UuidView.vue` — the UI (AC: 1, 2, 3)**
  - [x] **New file `src/tools/uuid/UuidView.vue` and `src/tools/uuid/uuidVersion.ts`** (the TS mirror of the Rust enum, same convention as `src/tools/json/jsonIndent.ts`):
    ```ts
    // Mirrors `UuidVersion`'s `#[serde(rename_all = "snake_case")]` encoding in
    // crates/umbra-core/src/uuid.rs — keep the two in sync by hand.
    export type UuidVersion = "v4" | "v7";
    ```
  - [x] State: `version = ref<UuidVersion>("v4")`, `count = ref(1)`, `results = ref<string[]>([])`, `error = ref<ToolError | null>(null)`.
  - [x] `onGenerate()`: uses `createLatestWinsRunner()` (`src/shell/invoke.ts`) exactly as `Base64View.vue`'s `onEncode`/`onDecode` do — clear `error.value` first, `invoke<string[]>("uuid_generate", { version: version.value, count: count.value })`, on success (and not superseded) set `results.value` to the returned array, on failure set `error.value = toToolError(err)` and clear `results.value` (same "a failed transform must never leave a stale success sitting next to the new error" rule `Base64View.vue` already follows).
  - [x] **When `version` changes, clear `results.value` and `error.value`.** Not spelled out verbatim by the ACs, but needed so switching v4↔v7 never leaves a stale list on screen that no longer "matches the selected version" (AC3) until the next click — the same staleness concern `Base64View.vue`'s `onPaste` already handles for its own output field. Flag in review if a different resolution is preferred (e.g. leaving the list until regenerated).
  - [x] **Copy affordance — resolved reading of AC1 vs AC2:** AC1 says a single UUID "appears with one-click copy"; AC2 says a bulk count "render[s] as a copyable list." Render every generated UUID as its own row with an inline "Copy" button (satisfies AC1 identically whether `results.length` is 1 or 1000), **plus** one "Copy all" button — visible whenever `results.length > 1` — that joins the list with `\n` and copies it in one action (satisfies AC2's "copyable list" as a genuine bulk convenience, not just N individual clicks). Both use the existing `writeClipboardText` from `src/shell/clipboard.ts`.
  - [x] **No virtualization.** AD-4 calls for large result sets to render through virtualized views, and this project already has `@tanstack/vue-virtual` in `package.json` (added for Story 1.8's JSON tree). A flat list of up to 1000 short fixed-format strings is a different scale problem than the JSON tree's deeply nested recursive rendering that motivated that decision — 1000 plain `<li>` rows is well within normal DOM comfort and needs no virtualization to stay responsive (AC2's "UI stays responsive" bar). Don't add `@tanstack/vue-virtual` to this view; flag in review if profiling disagrees.
  - [x] Count input: a plain `<input type="number" min="1" v-model.number="count">` with an associated `<label>`. Client-side `min="1"` is a UX nicety only — it does **not** replace the server-side `count == 0` / `count > 1000` checks in `umbra-core::uuid::generate` (AD-1: core owns validation, not the view; matches every existing size-guard precedent in this codebase). Submitting an in-range-but-rejected count (0, or >1000) still round-trips to the command and renders the returned `ToolError` through the existing `role="alert"` pattern (`Base64View.vue`'s error `<p>` — same markup, same `errorLocation` computed logic, though `uuid-count-zero`/`uuid-count-too-large` will always have `position: null` so `errorLocation` renders nothing extra, same as `base64-input-too-large` today).
    - **One client-side guard is still needed, distinct from the business-rule validation above:** `v-model.number` on a cleared or non-numeric field produces `NaN`, and a manually typed negative number produces a value `u32` cannot represent at all. Neither serializes into a meaningful IPC call — sending either would either fail JSON serialization or hit Rust's `u32` *deserialization* before `generate()` ever runs, surfacing a raw, unfriendly Tauri IPC error instead of a clean inline message. Before calling `invoke`, check `Number.isInteger(count.value) && count.value >= 1`; if it fails, set a local inline message directly (no `invoke` call, no `ToolError` round-trip — this is a client-side input-shape guard, not a business rule) and return early.
  - [x] Version selector: two radio buttons (`v4`/`v7`) inside a `<fieldset>`/`<legend>`, same accessible markup pattern as `Base64View.vue`'s alphabet selector (each `<input>` wrapped in its own `<label>` — no bare unlabeled controls).
  - [x] **No paste-from-clipboard control.** FR4 requires paste/copy "where the tool shape allows it" — this tool has no text input to paste into (it only generates and copies output), so only the copy affordances above apply. Don't add a dead paste button.

- [x] **Task 5: Tests**
  - [x] `crates/umbra-core/src/uuid.rs`: `generate(V4, 1)` returns exactly one syntactically valid UUID string; `generate(V7, 1)` likewise; `generate(V4, 1000)` returns 1000 unique strings (uniqueness check is a smoke test, not a collision proof — birthday-paradox risk at n=1000 is astronomically negligible); **`generate(V7, 1000)` returns a list that is already sorted ascending** (`assert!(results.windows(2).all(|w| w[0] <= w[1]))`) — this is the regression test that actually proves the shared-`ContextV7` fix works, not just that the function runs; `generate(_, 0)` returns `uuid-count-zero`; `generate(_, 1000)` succeeds (upper boundary, inclusive); `generate(_, 1001)` returns `uuid-count-too-large` (lower-rejected boundary).
  - [x] `src-tauri/src/commands/uuid.rs`: `#[tokio::test]` command tests mirroring `commands/json.rs`'s style — call `uuid_generate(UuidVersion::V4, 1).await.unwrap()` directly (the enum variant, not a string — same as `json_format_command_pretty_prints_valid_input` calling `JsonIndent::TwoSpaces` directly), assert length and version-appropriate shape; one test asserting the 1000-count boundary succeeds through the command layer, not just the core function.
  - [x] `src/tools/uuid/UuidView.spec.ts` (new, mirroring `Base64View.spec.ts`'s mocking convention — `vi.mock("@tauri-apps/api/core", ...)` for `invoke`, `vi.mock("@tauri-apps/plugin-clipboard-manager", ...)` for `writeText`): generating a single UUID renders one row with a Copy button; generating a bulk count renders that many rows plus a visible "Copy all"; a count over 1000 (mock `invoke` rejecting with a `uuid-count-too-large`-shaped error) renders the inline error via the existing `role="alert"` element; a cleared/empty count field shows the client-side guard message and never calls the mocked `invoke`; switching version clears a previous result; per-row Copy and "Copy all" both call the mocked `writeText` with the expected content.

- [x] **Task 6: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`, `vue-tsc --noEmit`.

- [ ] **Task 7: Manual verification (deferred to the user)**
  - [ ] `pnpm tauri dev`, per this project's established precedent (Stories 1.10, 2.1, 2.2 — the dev agent cannot visually drive a native Tauri window): generate a single v4 UUID and copy it; generate a bulk count (e.g. 500) of v7 UUIDs and confirm the list is visibly sorted/time-ordered and the window stays responsive; attempt a count of 1001 and confirm the inline rejection message, not a silently clamped list; switch v4↔v7 and confirm the prior list clears; use "Copy all" and paste to confirm newline-joined content; confirm the tool appears in the sidebar and is reachable via ⌘K under "uuid" and "guid".

- [x] **Task 8: Commit and open a PR**
  - [x] Branch: `feat/story-2-3-<slug>` (e.g. `feat/story-2-3-uuid-generator`).
  - [x] Conventional Commit(s), `feat` type scoped to `uuid`.
  - [x] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4) — [PR #27](https://github.com/dipaneb/umbra/pull/27).

### Review Findings

- [x] [Review][Patch] Client-side count guard blocks `0` before it can round-trip to the server, contradicting the Dev Notes' explicit requirement that `0` "still round-trips to the command and renders the returned `ToolError`" [src/tools/uuid/UuidView.vue:510] — resolved (user decision, 2026-07-30): relax the guard from `count.value >= 1` to `count.value >= 0`, since `0` is a valid `u32` and the guard's stated purpose (blocking values that "can't serialize into a meaningful IPC call") never applied to it; this satisfies both Dev Notes bullets simultaneously.

- [x] [Review][Patch] Version-switch race silently shows UUIDs from the previously selected version [src/tools/uuid/UuidView.vue:496,516] — `watch(version, …)` clears `results`/`error` on radio change, but `runLatestWins`'s supersede check only keys off a new call to `onGenerate`, not off `version` changing; a Generate click for v4 followed by a version switch to v7 before the response lands lets the stale v4 response repopulate `results.value`, defeating AC3 ("output matches the selected version") for exactly the case the version-clear watcher was meant to cover.

- [x] [Review][Patch] Client-side count guard doesn't reject values above `u32::MAX` [src/tools/uuid/UuidView.vue:510] — the guard only checks `Number.isInteger(count.value) && count.value >= 1`, so a count like `5000000000` (a valid JS integer, invalid `u32`) passes the client guard and is sent to `invoke`, hitting a raw Tauri IPC deserialization failure instead of the clean inline message the guard exists to guarantee (same reasoning the Dev Notes already give for rejecting negatives/`NaN` applies equally here).

- [x] [Review][Patch] `errorLocation`'s `LineCol`/`ByteOffset` branches are dead code [src/tools/uuid/UuidView.vue:480] — copied from `Base64View.vue`, where the equivalent branches are live (`base64.rs` does return `Some(Position::ByteOffset)`), but `crates/umbra-core/src/uuid.rs`'s `generate()` always returns `position: None`, so both branches can never execute for this view.

- [x] [Review][Patch] No uniqueness assertion for v7 bulk output [crates/umbra-core/src/uuid.rs:114] — `generate_v7_bulk_is_already_sorted_ascending` only asserts `w[0] <= w[1]`, which a run of duplicate values would also satisfy; the v4 bulk test explicitly verifies 1000 unique values via `HashSet` but there's no equivalent for v7.

- [x] [Review][Patch] v7 doc comment overstates the monotonicity guarantee's scope [crates/umbra-core/src/uuid.rs:51] — "a shared context keeps output strictly increasing" reads as an unqualified claim; the guarantee is per-batch only (a fresh `ContextV7` with a new randomized counter seed is created on every `generate()` call), so two separate Generate clicks have no ordering guarantee relative to each other. Worth a one-clause caveat so a future reader doesn't assume cross-call ordering.

- [x] [Review][Patch] Stale client-side guard message isn't cleared on version switch [src/tools/uuid/UuidView.vue:496] — `watch(version, …)` clears `results.value` and `error.value` but not `clientError.value`; triggering the "Enter a whole number of at least 1." guard and then flipping the v4/v7 radio leaves the stale message on screen.

- [x] [Review][Defer] `map_join_error` duplicated a third time across command files [src-tauri/src/commands/uuid.rs:11] — deferred, pre-existing (identical boilerplate already exists in `commands/json.rs` and `commands/base64.rs`; this story followed established convention rather than introducing the duplication).

- [x] [Review][Defer] Alert styling (`p[role="alert"] { color: #b00020; }`) duplicated a third time [src/tools/uuid/UuidView.vue:184] — deferred, pre-existing (identical block already exists in `JsonView.vue` and `Base64View.vue`).

- [x] [Review][Defer] Clipboard failures degrade to raw JS error text via `toToolError`'s `"unknown"` fallback [src/tools/uuid/UuidView.vue:528,537] — deferred, pre-existing (`Base64View.vue`'s `onCopy` has the identical gap).

- [x] [Review][Defer] `CommandPalette.spec.ts`'s wrap-around assertion depends on `uuid` being the last entry in `TOOLS` [src/shell/CommandPalette.spec.ts:273] — deferred, pre-existing (the test already depended on array order before this story; nothing documents the ordering as a contract).

- [x] [Review][Defer] No `aria-live`/`role="status"` announcement when a new UUID batch renders [src/tools/uuid/UuidView.vue:608] — deferred, pre-existing (no tool in this codebase announces successful results to assistive tech yet; errors get `role="alert"`, successes don't, app-wide).

- [x] [Review][Defer] No in-flight/loading state on the Generate button [src/tools/uuid/UuidView.vue:584] — deferred, pre-existing (`Base64View.vue`'s `onEncode`/`onDecode` have the same gap; only the file-based `onDecodeToFile` action guards against rapid re-clicks).

- [x] [Review][Defer] Concurrent Copy/Copy all clicks aren't wrapped in a latest-wins runner [src/tools/uuid/UuidView.vue:528,537] — deferred, pre-existing (`Base64View.vue`'s `onCopy` has the identical unguarded pattern).

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2 (functional core):** `generate()` is a pure function in `crates/umbra-core/src/uuid.rs` — zero I/O, zero Tauri dependency, and (per AD-2) no `#[cfg(target_os)]` branches; the `uuid` crate's `v4`/`v7`/`std` features are all platform-neutral (`std`, not any OS-specific feature), so this story introduces no cross-platform risk. [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (ToolError contract):** `uuid-count-zero`, `uuid-count-too-large`, `uuid-internal` are new, tool-scoped kebab-case codes, all with `position: None` (a count-out-of-range error has no line/column/byte-offset location — same reasoning as `base64-input-too-large`). [Source: `ARCHITECTURE-SPINE.md` AD-3]
- **AD-4 (heavy work off the main thread):** `uuid_generate` wraps its work in `spawn_blocking` for consistency with every existing command, even though 1000 UUIDs is far under the ~100ms bar. The "no virtualization needed" call in Task 4 is the AD-4 judgment this story actually has to make (large result sets *should* render virtualized — but 1000 flat short strings isn't the "large" AD-4 was written for; see Task 4's reasoning). [Source: `ARCHITECTURE-SPINE.md` AD-4]
- **AD-5 (one Tool Registry):** exactly one new entry in `src/stores/registry.ts`; nothing else enumerates tools. [Source: `ARCHITECTURE-SPINE.md` AD-5]
- **AD-6 (tools are islands):** this tool reads no other tool's state and introduces no new cross-tool signal (unlike Story 2.2's `dropArgsProviders`/`dropResult`, which existed specifically for drop handling this tool doesn't need). [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **AD-11 (cross-platform CI):** the `uuid` crate's `v4`/`v7`/`std` features have no platform-specific code path, so this story is not expected to behave differently across the three CI runners — no special attention needed beyond the existing gate passing.

### Library/Framework requirements

- **`uuid` (Rust crate), verified this session directly against the crates.io registry API** (not a search-engine snippet, per this project's established stack-verification convention): current stable **1.24.0**, license `Apache-2.0 OR MIT` (permissive, no license review needed). Required features: `v4`, `v7`, `std` — `v7` requires `std` explicitly (the crate supports no_std, so `std` is opt-in, not implied by default).
- **API shape, verified via Context7 (`/uuid-rs/uuid`) this session:**
  - `Uuid::new_v4() -> Uuid` — random UUID, requires the `v4` feature.
  - `Uuid::now_v7() -> Uuid` and `Uuid::new_v7(ts: Timestamp) -> Uuid` — sortable UUID, requires `v7` (+ `std`).
  - **Monotonicity gotcha (the one piece of latest-tech information that actually matters for this story):** the crate's own docs explicitly warn that generating multiple v7 UUIDs in rapid succession via bare `now_v7()` calls "can result in non-monotonic UUIDs if the system clock does not advance between calls and the counter is not incremented." The fix is a single shared `ContextV7` reused across the batch via `Timestamp::now(&context)` + `Uuid::new_v7(ts)` — see Task 1. This is exactly the kind of thing a dev agent without live documentation access would plausibly get wrong (a bare `Uuid::now_v7()` in a `.map()` loop looks correct and compiles fine — it just silently fails AC3 at scale).
- **No JS-side dependency changes.** UUID generation is entirely server-side (Rust); the frontend only calls `invoke` and renders strings — no new npm package needed.

### File Structure Requirements

- **New:** `crates/umbra-core/src/uuid.rs` (+inline unit tests), `src-tauri/src/commands/uuid.rs` (+inline unit tests), `src/tools/uuid/UuidView.vue`, `src/tools/uuid/UuidView.spec.ts`, `src/tools/uuid/uuidVersion.ts`.
- **Modified:** `crates/umbra-core/src/lib.rs` (+`pub mod uuid;`), `crates/umbra-core/Cargo.toml` (+`uuid` dependency), `src-tauri/src/commands/mod.rs` (+`pub mod uuid;`), `src-tauri/src/lib.rs` (+import, +`generate_handler!` entry), `src/stores/registry.ts` (+one new entry), `Cargo.lock`, `pnpm-lock.yaml` (lockfile churn from the new Rust dependency — no manual edits, regenerated by tooling).
- **Not touched:** `src-tauri/Cargo.toml` (no direct `uuid` dependency needed — see Task 2), `src-tauri/capabilities/default.json` (no plugin, no capability entry needed), `src/router/index.ts`, `src/shell/AppSidebar.vue`, `src/App.vue` (all generated from/unaffected by the single registry entry), `src/shell/dropZone.ts`, `src/shell/DropZone.vue` (this tool has no drop behavior), any Base64 or JSON file (unrelated).

### Testing Requirements

- Rust: `cargo test --workspace` covering the new `uuid.rs` core tests (including the v7-monotonicity regression test — see Task 5) and new `commands/uuid.rs` tests. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings` — no `unwrap`/`expect` in command paths, unchanged convention.
- TypeScript: `pnpm test` covering the new `UuidView.spec.ts`, using the same `vi.mock` module-factory convention as `Base64View.spec.ts` for `@tauri-apps/api/core` and `@tauri-apps/plugin-clipboard-manager` — do not mock this project's own `invoke.ts`/`toolError.ts`/`clipboard.ts`, only platform packages.
- `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all pass locally before the PR.
- Manual: `pnpm tauri dev`, per Task 7 — deferred to the user, same precedent as every story since 1.7.

### Previous Story Intelligence

- **From Story 2.2 (immediate predecessor in Epic 2):** established the `spawn_blocking`-for-every-command convention explicitly as a *consistency* choice, not a per-command performance judgment — this story follows that same discipline even though UUID generation is trivially fast (see Task 2). Also reconfirmed (via `fs_helper.rs`'s `file-read-error`/`file-write-error` codes) that shared, tool-agnostic `ToolError.code`s are used when two tools hit the same failure mode — not applicable here, since count validation is UUID-tool-specific, but worth knowing the pattern exists for later Epic 2 stories (2.4/2.5's hash tool will likely reuse Story 2.2's `fs_helper.rs` directly).
- **No file-drop or clipboard-paste-input infrastructure is touched by this story** — unlike 2.1/2.2, this tool has no meaningful "input" to paste, only output to copy. Don't reuse `dropZone.ts`/`DropZone.vue`/`lastDrop`-successor (`registry.dropArgsProviders`/`dropResult`) machinery; none of it applies here.
- **Cross-epic:** this is the first story to add a Rust dependency to `crates/umbra-core/Cargo.toml` since the original scaffold (`serde`, `serde_json`, `base64`) — confirm `Cargo.lock` picks up `uuid` and its transitive deps (`getrandom`, likely `js-sys`/`wasm-bindgen` gated behind cfg(target_arch="wasm32") which won't activate on any of this project's target platforms) cleanly across all three CI runners.

### Git Intelligence

- `main`'s tip at story-creation time is `3c2e48b` (this story's `baseline_commit`), Story 2.2's review-fix commit. Everything since Epic 1 closed (`928588b`) is Story 2.1's and Story 2.2's own work — no other story or infrastructure change has landed in between, so this story starts from exactly the state Story 2.2's Dev Notes/File List describe, with no drift to account for.
- No commit since `928588b` has touched `crates/umbra-core/Cargo.toml`'s dependency list — this story is the first to add a new core dependency since the original three (`serde`, `serde_json`, `base64`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.3: Generate UUIDs; FR13, AD-4, AD-5; Epic 2 summary]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — FR13 (UUID v4/v7, single/bulk to 1000, one-click copy), NFR4 (no crash on bad input, errors shown in-tool)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1 (functional core), AD-2 (core dependency-clean), AD-3 (ToolError), AD-4 (async/virtualization), AD-5 (registry), AD-6 (islands), AD-11 (CI cross-platform), Stack table, Consistency Conventions table]
- Live-verified this session via a dedicated read-only exploration pass: `src/stores/registry.ts`, `crates/umbra-core/src/{lib,base64,error,json}.rs`, `crates/umbra-core/Cargo.toml`, `src-tauri/src/{lib,commands/mod,commands/base64,commands/json}.rs`, `src-tauri/Cargo.toml`, `src/shell/{invoke,clipboard,toolError}.ts`, `src/tools/base64/Base64View.{vue,spec.ts}`, `src/tools/json/jsonIndent.ts`, `package.json` — confirmed no UUID-related code exists anywhere in the repo yet (genuinely greenfield tool), and confirmed the exact `JsonIndent`-style enum-across-IPC pattern and `base64.rs`'s same-name-as-crate module precedent this story reuses.
- Context7 (`/uuid-rs/uuid`, verified this session): `Uuid::new_v4()`/`Uuid::now_v7()`/`Uuid::new_v7(Timestamp)` API shapes, required Cargo features per version (`v4`; `v7`+`std`), and the tight-loop non-monotonicity gotcha for `now_v7()` plus its `ContextV7`-based fix.
- crates.io registry API (verified this session, direct query per this project's convention): `uuid` 1.24.0 (`Apache-2.0 OR MIT`).

## Change Log

- 2026-07-30: Story drafted via `bmad-create-story`, following Story 2.2's completion. Exhaustive-analysis pass included a live read-only sweep of the current registry/core/command-layer state (confirming no UUID code exists yet) and Context7 verification of the `uuid` crate's v4/v7 API — surfacing a non-obvious monotonicity gotcha in bare `now_v7()` calls under bulk generation that directly affects AC3 — plus a direct crates.io registry query for the current stable version and license.
- 2026-07-30: Tasks 1-6 implemented on `feat/story-2-3-uuid-generator`, branched from `origin/main` (`ac054ca`, Story 2.2's PR #26 squash-merge — this story's frontmatter `baseline_commit` `3c2e48b` is the pre-squash commit on Story 2.2's branch, content-identical). Re-verified the `uuid` crate's v7/`ContextV7` API via Context7 (`/uuid-rs/uuid`) and its current version via a direct crates.io query (`1.24.0`) before implementing — both matched the story's Dev Notes exactly. Implemented `generate()` in `crates/umbra-core/src/uuid.rs` per spec, including the shared-`ContextV7` monotonicity fix. Added the `uuid_generate` Tauri command, the registry entry, and `UuidView.vue`/`uuidVersion.ts` per the story's prescribed shapes. Two pre-existing frontend tests (`router/index.spec.ts`, `CommandPalette.spec.ts`) hard-coded the prior 2-tool registry count/wrap-order and were updated to reflect the new 3-tool registry — an expected ripple effect of AD-5's single-registry design, not a scope deviation.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

### Completion Notes List

- **Task 1:** `generate()` implemented exactly per spec, including the shared-`ContextV7` fix for v7 monotonicity. 7 unit tests added (single v4/v7, bulk uniqueness, v7 bulk sortedness regression, zero-count rejection, 1000-boundary success, 1001 rejection) — all pass.
- **Task 2:** `uuid_generate` command wraps `generate` in `spawn_blocking`, matching every existing command. Command tests avoid a direct `uuid`-crate dependency in `src-tauri` (per Dev Notes: the crate lives in `umbra-core` only) by asserting UUID string shape structurally instead of parsing with the crate. 5 tests pass.
- **Task 3:** One registry entry added; no other file touched, per AD-5.
- **Task 4:** `UuidView.vue` implements the version radio group, count input with client-side integer/≥1 guard, per-row Copy buttons, a "Copy all" button (visible when `results.length > 1`), and clears `results`/`error` on version change. No virtualization added, no paste control, per Dev Notes.
- **Task 5:** `UuidView.spec.ts` added (8 tests: single result, bulk result + Copy all visibility, Copy-all hidden for single, rejected-too-large ToolError rendering, client-guard message with no `invoke` call, version-switch clearing, per-row copy, Copy-all newline-joined content).
- **Task 6:** All automated gates pass: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` (80 tests, up from 66), `pnpm lint`, `pnpm test` (131 tests across 18 files, up from 114/17), `pnpm build` (includes `vue-tsc --noEmit`). Two pre-existing tests updated for the new registry count (see Change Log).
- **Outstanding:** Task 7's manual `pnpm tauri dev` walkthrough (single v4 generate+copy, bulk v7 sortedness/responsiveness, 1001-count rejection, version-switch clearing, Copy all + paste, sidebar/⌘K reachability) has not been performed interactively — per this project's established precedent (Stories 1.10, 2.1, 2.2), the dev agent cannot visually drive a native Tauri window, so this is deferred to the user for hands-on verification before/during PR review.

### File List

- New: `crates/umbra-core/src/uuid.rs`
- New: `src-tauri/src/commands/uuid.rs`
- New: `src/tools/uuid/UuidView.vue`
- New: `src/tools/uuid/UuidView.spec.ts`
- New: `src/tools/uuid/uuidVersion.ts`
- Modified: `crates/umbra-core/Cargo.toml`
- Modified: `crates/umbra-core/src/lib.rs`
- Modified: `src-tauri/src/commands/mod.rs`
- Modified: `src-tauri/src/lib.rs`
- Modified: `src/stores/registry.ts`
- Modified: `src/router/index.spec.ts` (registry-length assertion updated: 2 → 3 tools)
- Modified: `src/shell/CommandPalette.spec.ts` (wrap-around assertion updated for the new 3-tool registry order)
- Modified: `Cargo.lock` (lockfile churn from the new `uuid` dependency)
