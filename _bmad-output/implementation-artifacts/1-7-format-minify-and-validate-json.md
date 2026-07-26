---
baseline_commit: a0c3d2e
---

# Story 1.7: Format, minify, and validate JSON

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want to paste JSON and format or minify it with my preferred indentation, with precise errors,
so that I can clean real payloads without any data leaving my machine.

## Acceptance Criteria

1. **Given** JSON text in the input area, **when** I choose Format or Minify, **then** output is pretty-printed per the selected indentation (2 spaces, 4 spaces, or tabs) or minified to one line (FR6), **and** the transformation lives in `umbra-core::json`, exposed as async commands `json_format` / `json_minify` returning `Result<T, ToolError>` (AD-1, AD-3).
2. **Given** invalid JSON (malformed, huge, or binary garbage), **when** I format or validate it, **then** the first error is shown with line/column position and a human-readable message, rendered from the `ToolError` structure — the view never string-matches messages (FR7, AD-3), **and** the app never crashes or shows silent empty output (NFR4, FR12 pattern).
3. **Given** the tool is open, **when** I click paste-from-clipboard or copy-to-clipboard, **then** input/output transfers in one action via the shell clipboard service backed by the Tauri clipboard plugin — `navigator.clipboard` is not used (FR4, AD-14).
4. **Given** any command invocation from this tool, **when** it executes, **then** it goes through the shared invoke helper carrying a request ID with latest-wins supersession — this story establishes the helper (AD-16).

## Tasks / Subtasks

- [x] **Task 1: Wire `umbra-core` into `src-tauri` and fix `serde_json`'s feature set** (AC: 1) — foundational plumbing every later subtask depends on
  - [x] **`umbra-core` is not yet a dependency of `src-tauri`.** Verified by reading both `Cargo.toml` files: the workspace (`Cargo.toml` at repo root) lists both members, but `src-tauri/Cargo.toml`'s `[dependencies]` has never referenced the crate — nothing has needed it until this story. Add:
    ```toml
    umbra-core = { path = "../crates/umbra-core" }
    ```
  - [x] **`serde_json` in `crates/umbra-core/Cargo.toml` is currently a `[dev-dependencies]`-only entry** — fine for `error.rs`'s tests, but `json.rs` (Task 2) needs it at runtime. Move it to `[dependencies]` **and add the `preserve_order` feature**:
    ```toml
    [dependencies]
    serde = { version = "1", features = ["derive"] }
    serde_json = { version = "1", features = ["preserve_order"] }
    ```
    **Why `preserve_order` is not optional:** without it, `serde_json::Value`'s object type is a `BTreeMap`, which silently **alphabetizes every object's keys** on parse. A formatter/minifier that reorders a real payload's keys is a correctness bug, not a style nit — `{"b": 1, "a": 2}` must format back with `b` before `a`. With the feature on, `Value`'s map becomes an `indexmap` that preserves insertion (i.e. source) order. Cargo unifies features for a single resolved `serde_json` version across the whole build, so enabling it here is sufficient — no need to also touch `src-tauri/Cargo.toml`'s separate `serde_json = "1"` entry, though it's harmless if you do.
  - [x] Run `cargo check --workspace` after this task to confirm the new dependency edge resolves before writing any code that uses it.

- [x] **Task 2: Implement `umbra-core::json` — pure format/minify/validate logic** (AC: 1, 2)
  - [x] Create `crates/umbra-core/src/json.rs`. Add `pub mod json;` to `crates/umbra-core/src/lib.rs` (it currently only has `pub mod error;` + re-exports — this is the crate's first tool module, matching the Structural Seed comment `src/json.rs # Epic 1`).
  - [x] Define the indentation choice as a serde-tagged enum crossing IPC as a plain string — do not invent a different encoding (e.g. a raw indent-width integer) since "tabs" isn't a width:
    ```rust
    #[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "snake_case")]
    pub enum JsonIndent {
        TwoSpaces,
        FourSpaces,
        Tab,
    }

    impl JsonIndent {
        fn as_bytes(self) -> &'static [u8] {
            match self {
                JsonIndent::TwoSpaces => b"  ",
                JsonIndent::FourSpaces => b"    ",
                JsonIndent::Tab => b"\t",
            }
        }
    }
    ```
    This serializes as the strings `"two_spaces"` / `"four_spaces"` / `"tab"` — the frontend TS type in Task 6 must match exactly.
  - [x] Implement `format` and `minify` using `serde_json::Value` (not a custom AST — there's no requirement to preserve comments/trailing commas, and `Value` + `preserve_order` already gives correct round-tripping) and `serde_json::ser::PrettyFormatter::with_indent`, which accepts an arbitrary indent byte sequence — exactly what's needed for the tab case, which `serde_json::to_string_pretty`'s fixed 2-space default cannot do:
    ```rust
    use crate::{Position, ToolError};
    use serde::Serialize;

    pub fn format(input: &str, indent: JsonIndent) -> Result<String, ToolError> {
        let value: serde_json::Value = serde_json::from_str(input).map_err(map_parse_error)?;
        let mut buf = Vec::new();
        let formatter = serde_json::ser::PrettyFormatter::with_indent(indent.as_bytes());
        let mut serializer = serde_json::Serializer::with_formatter(&mut buf, formatter);
        value.serialize(&mut serializer).map_err(map_internal_error)?;
        String::from_utf8(buf).map_err(map_internal_error)
    }

    pub fn minify(input: &str) -> Result<String, ToolError> {
        let value: serde_json::Value = serde_json::from_str(input).map_err(map_parse_error)?;
        serde_json::to_string(&value).map_err(map_internal_error)
    }

    fn map_parse_error(err: serde_json::Error) -> ToolError {
        ToolError {
            code: "json-syntax".to_string(),
            message: err.to_string(),
            position: Some(Position::LineCol {
                line: err.line() as u32,
                column: err.column() as u32,
            }),
            context: None,
        }
    }

    fn map_internal_error<E: std::fmt::Display>(err: E) -> ToolError {
        ToolError {
            code: "json-internal".to_string(),
            message: err.to_string(),
            position: None,
            context: None,
        }
    }
    ```
    `"json-syntax"` is not an arbitrary choice — it's the exact code `error.rs`'s own doctest/unit-test fixture already uses as its worked example (see `error.rs` line ~39 and its module doc comment: *"no enforced enum yet, since no tool exists to assign real codes until Story 1.7"*). Reuse it; don't invent a synonym like `"json-parse-error"`.
  - [x] **No `unwrap`/`expect`** anywhere in `json.rs` (spine Consistency Conventions: "No `unwrap`/`expect` in command paths" — apply this to core logic generally, not just the literal `#[tauri::command]` bodies). `map_internal_error` exists so the two theoretically-fallible-but-practically-infallible steps (re-serializing a `Value` that was just parsed; the pretty-printer emitting valid UTF-8) fail safely instead of panicking, even though a real failure here would be exceptional.
  - [x] `serde_json::from_str` on malformed, huge, or binary-garbage-as-text input never panics — it returns `Err` through the normal `Result` path already covered by `map_parse_error`. No special-case handling is needed for NFR4; don't add any (a Tauri `String` argument is already guaranteed valid UTF-8 by the IPC bridge — "binary garbage" here means garbled/non-JSON *text*, not raw non-UTF-8 bytes).
  - [x] Unit tests in `#[cfg(test)] mod tests` (co-located, matching `error.rs`'s convention):
    - `format` with each of the three `JsonIndent` variants produces the expected pretty-printed string (assert exact output, not just "no panic").
    - `minify` collapses a multi-line document to one line with no extraneous whitespace.
    - **Key-order preservation regression test** — this is the test that catches a forgotten `preserve_order` feature flag: format/minify `{"b": 1, "a": 2}"` and assert `b` still precedes `a` in the output. Without this test, a future dependency bump or Cargo.toml edit could silently drop the feature and no other test would catch it.
    - Malformed input (e.g. `{"a":}`) returns `Err(ToolError)` with `code == "json-syntax"` and `position == Some(Position::LineCol { .. })` matching the actual malformed location.
    - Empty string input returns a syntax error (not a panic, not `Ok("")`).

- [x] **Task 3: Expose `json_format` / `json_minify` as async Tauri commands** (AC: 1) — this story's first use of the spine's `src-tauri/src/commands/` seed, which doesn't exist yet
  - [x] Create `src-tauri/src/commands/mod.rs` with `pub mod json;` and `src-tauri/src/commands/json.rs`:
    ```rust
    use umbra_core::json::{format, minify, JsonIndent};
    use umbra_core::ToolError;

    #[tauri::command]
    pub async fn json_format(input: String, indent: JsonIndent) -> Result<String, ToolError> {
        format(&input, indent)
    }

    #[tauri::command]
    pub async fn json_minify(input: String) -> Result<String, ToolError> {
        minify(&input)
    }
    ```
    Command names follow AD-3's `<tool>_<verb>` convention exactly — don't rename to e.g. `format_json`.
  - [x] In `src-tauri/src/lib.rs`: add `mod commands;` and register both commands in `invoke_handler(tauri::generate_handler![...])` alongside the existing `greet`. **Do not remove `greet` or the `tauri-plugin-opener` plugin** — no AC in this story calls for scaffold cleanup, and touching unrelated scaffold code is out of scope (it can be removed in a later story if it's ever actually in the way; it currently isn't).
  - [x] `ToolError` already derives `Serialize`/`Deserialize` (see `error.rs`) — this is what lets a command's `Err(ToolError)` reach the frontend as a structured object rather than a stringified message: Tauri serializes the `Err` payload to JSON, and the JS `invoke()` promise rejects with that deserialized object. This is exactly what AC2's "the view never string-matches messages" depends on, and it's why AD-3 mandated `ToolError` derive `Serialize` from the start (Story 1.3) even before any command existed to use it.
  - [x] Add a small integration test proving the command layer, not just the core layer, wires correctly — e.g. in `src-tauri/src/commands/json.rs`'s own `#[cfg(test)]` module, call `json_format`/`json_minify` directly with `futures::executor::block_on` or `#[tokio::test]` (add `tokio = { version = "1", features = ["macros", "rt"] }` as a dev-dependency if needed) and assert the same behavior as the core unit tests. This is the first Tauri command in the codebase — NFR6 calls for "integration tests over Tauri commands" as a standing project convention, and this story is what establishes it.

- [x] **Task 4: Add the shell clipboard service** (AC: 3) — AD-14's "one clipboard service wraps the Tauri clipboard plugin" doesn't exist yet; this is its first consumer and first implementation
  - [x] Add the Rust plugin to `src-tauri/Cargo.toml`: `tauri-plugin-clipboard-manager = "2"` (matches the version already recorded in `ARCHITECTURE-SPINE.md`'s Stack table: "2.x (2.3.2 observed 2026-07-20)"). Register it in `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_clipboard_manager::init())`.
  - [x] Add the JS package to `package.json` dependencies: `@tauri-apps/plugin-clipboard-manager` (same version line as the Rust crate per the architecture's Stack table).
  - [x] Add the required permission(s) to `src-tauri/capabilities/default.json`'s `"permissions"` array (currently `["core:default", "opener:default"]`) — add the clipboard read/write permission identifiers. **Verify the exact identifier strings** (expected shape: `clipboard-manager:allow-read-text`, `clipboard-manager:allow-write-text`, or a bundled `clipboard-manager:default`) against the schema Tauri generates at `src-tauri/gen/schemas/desktop-schema.json` after adding the dependency and running `pnpm tauri dev` once — this file is auto-generated per installed plugin and is the authoritative source for exact permission names, more reliable than guessing from memory.
  - [x] Create `src/shell/clipboard.ts` — a thin wrapper, not a new abstraction layer:
    ```ts
    import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

    export async function readClipboardText(): Promise<string> {
      return readText();
    }

    export async function writeClipboardText(text: string): Promise<void> {
      return writeText(text);
    }
    ```
    Every tool imports from `src/shell/clipboard.ts`, never from `@tauri-apps/plugin-clipboard-manager` directly and never `navigator.clipboard` (AD-14 explicitly forbids the latter — it would bypass the service and reintroduce per-tool implementations). **Verify the plugin's exact export names** (`readText`/`writeText`) against the installed package's TypeScript definitions once added — a doc lookup for this plugin's specific API didn't return plugin-specific pages this session, so confirm directly against `node_modules/@tauri-apps/plugin-clipboard-manager`'s `.d.ts` before wiring `JsonView.vue` to it.
  - [x] Unit test `src/shell/clipboard.spec.ts` mocking the plugin module boundary (`vi.mock("@tauri-apps/plugin-clipboard-manager", ...)`) — this is mocking a third-party plugin at the IPC boundary (unavoidable in `jsdom`, which has no real OS clipboard), not one of our own stores/services, so it doesn't conflict with the project's established no-mocking-our-own-code convention.

- [x] **Task 5: Establish the shared invoke helper** (AC: 4) — AD-16's "one shared frontend invoke helper... request ID and latest-wins supersession." This is a load-bearing piece of infrastructure every future tool story (Base64, hash, JWT, cron, OCR, PDF) will reuse — keep it generic, not JSON-specific.
  - [x] Create `src/shell/invoke.ts` as a **pure, dependency-free higher-order function** (same philosophy as Story 1.6's `paletteSearch.ts`: no Tauri import inside it, so it's trivially unit-testable with fake async tasks and reusable for any slow async call, not just `@tauri-apps/api/core`'s `invoke`):
    ```ts
    export function createLatestWinsRunner() {
      let latestRequestId = 0;

      return async function runLatestWins<T>(task: () => Promise<T>): Promise<T | undefined> {
        const requestId = ++latestRequestId;
        try {
          const result = await task();
          return requestId === latestRequestId ? result : undefined;
        } catch (error) {
          if (requestId === latestRequestId) throw error;
          return undefined; // a superseded request's rejection is discarded too, not just its success
        }
      };
    }
    ```
  - [x] Each tool view calls `const runLatestWins = createLatestWinsRunner()` once in `setup()` (one runner instance per component, matching Story 1.6's "local component state, not a global store" pattern for concerns nothing else needs to share) and wraps every slow `invoke()` call with it:
    ```ts
    import { invoke } from "@tauri-apps/api/core";
    // ...
    const result = await runLatestWins(() => invoke<string>("json_format", { input, indent }));
    if (result !== undefined) output.value = result;
    ```
    If a second call starts before the first resolves, the first's resolved value (or thrown error) is silently discarded — only the outcome of the most recent call the runner instance has seen is ever surfaced to the caller.
  - [x] Unit test `src/shell/invoke.spec.ts` — pure function tests, no Tauri/component involved: a slower first call resolving after a faster second call must have its result discarded (assert the caller only ever observes the second call's value); a rejected stale call must not throw past the wrapper; the single, only in-flight call still resolves/rejects normally when nothing supersedes it.

- [x] **Task 6: Build the JSON tool view** (AC: 1, 2, 3, 4) — replaces the `JsonView.vue` placeholder from Story 1.5
  - [x] Define a small shared TS type for the error shape this view renders — `ToolError`'s Rust definition (`{ code, message, position, context }`, with `position` as `{ kind: "LineCol", line, column } | { kind: "ByteOffset", offset } | null`) needs a matching TS interface. Since this is the first tool to render a `ToolError` at all, put it somewhere shared for future tools to reuse (e.g. `src/shell/toolError.ts`) rather than declaring it inline in `JsonView.vue` — but don't build a shared `<ErrorDisplay>` *component* yet; that's premature until a second tool actually needs identical rendering (Epic 2 territory, not this story).
  - [x] `JsonView.vue` state: `input`/`output` (`ref<string>`), `indent` (`ref<JsonIndent>`, default `"two_spaces"`), `error` (`ref<ToolError | null>`), one `runLatestWins` instance from Task 5.
  - [x] Layout: labeled input `<textarea>` (`aria-label="JSON input"`), an indentation choice as a labeled `<fieldset>`/`<legend>` of three radio options (2 spaces / 4 spaces / Tab) bound to `indent`, "Format" and "Minify" buttons, a "Paste from clipboard" button wired to `readClipboardText()` (writes into `input`), a labeled read-only output `<textarea>` (`aria-label="JSON output"`), and a "Copy to clipboard" button wired to `writeClipboardText(output.value)` (disable while `output` is empty).
  - [x] Error rendering (AC2): on a rejected `runLatestWins` call, set `error.value` to the caught `ToolError` object (never a string) and render `error.message` plus, when `error.position?.kind === "LineCol"`, `(line {n}, column {n})` — read structured fields only, never regex/string-match `error.message` to extract position. Render this in a `<p role="alert">` so it's announced (NFR5), and clear `error.value` at the start of each new Format/Minify invocation so a previous error doesn't linger next to a fresh (possibly successful) result.
  - [x] Accessibility (NFR5, matching Story 1.5/1.6's bar): every control has a visible label or `aria-label`, buttons are real `<button type="button">` elements (focusable, keyboard-activatable by default — no `<div>`-as-button), the radio group has a `<legend>`, and the error region uses `role="alert"` for the same reason Story 1.6's empty-state palette result used `role="status"`.
  - [x] No new styling/component framework (spine Deferred list, unchanged since Story 1.5/1.6) — plain scoped CSS in `JsonView.vue`, consistent with `AppSidebar.vue`/`CommandPalette.vue`.
  - [x] Test `src/tools/json/JsonView.spec.ts` — mount the real component (no mocking of `runLatestWins`/`clipboard.ts`'s *logic*, but do mock the two Tauri-boundary modules it ultimately calls through — `@tauri-apps/api/core`'s `invoke` and `src/shell/clipboard.ts`'s underlying plugin — since there's no real Tauri backend in Vitest/jsdom): Format produces the expected output for a valid input across all three indent choices; Minify collapses to one line; an `invoke` rejection with a `ToolError`-shaped payload renders the message and line/column, not a raw string; Paste populates the input field; Copy is called with the current output text.

- [x] **Task 7: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace -- -D warnings`, `cargo test --workspace` (covers both `umbra-core`'s new `json.rs` tests and `src-tauri`'s new command integration test).
  - [x] `pnpm lint`, `pnpm test`, `pnpm build` — all must pass locally before opening the PR, per the convention every story has followed since CI went live (Story 1.4).
  - [x] Manually run `pnpm tauri dev` at least once after Task 4's capability changes — capability/permission mistakes for a newly added plugin are a runtime failure (command silently denied), not a compile-time one; confirm paste/copy actually work in a live window, not just through mocked tests.

- [x] **Task 8: Commit and open a PR**
  - [x] Branch: `feat/story-1-7-json-format-minify-validate` (repo convention: `feat/story-1-N-<slug>`).
  - [x] Conventional Commit(s), `feat` type. This story spans two scopes (`core` for `umbra-core::json`, `shell`/`json` for the Tauri command + Vue view + clipboard/invoke infrastructure) — either one well-scoped commit per concern or a single commit with a scope covering the whole story is acceptable; match whichever granularity Story 1.5/1.6 used for a comparably-sized change.
  - [x] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4). PR #9: https://github.com/dipaneb/umbra/pull/9

### Review Findings

**Decision needed:**

- [x] [Review][Decision] Is a dedicated "Validate" UI action required, or is Format-as-validate sufficient? — AC2 reads "when I format or validate it," implying a distinct action, but Task 6 only specifies Format/Minify/Paste/Copy buttons; validation is currently only reachable as a side effect of clicking Format. [src/tools/json/JsonView.vue] — Resolved: Format-as-validate is intentional; clicking Format already surfaces syntax errors the same way a dedicated Validate action would. No code change needed.

**Patch:**

- [x] [Review][Patch] Clear output/error state on transform failure and on paste, so Copy can never send stale output that doesn't match the current input/error [src/tools/json/JsonView.vue:29-56]
- [x] [Review][Patch] Wrap Paste/Copy clipboard calls in try/catch and surface rejections via error state instead of letting them become unhandled promise rejections [src/tools/json/JsonView.vue:50-56]
- [x] [Review][Patch] Route Paste's `readClipboardText()` call through `runLatestWins` to close the rapid-double-click race with a stale clipboard read [src/tools/json/JsonView.vue:50-52]
- [x] [Review][Patch] Validate the shape of a `runTransform` rejection before assigning it to `error.value`, so a non-`ToolError` rejection doesn't render a blank alert [src/tools/json/JsonView.vue:35-36]
- [x] [Review][Patch] Replace `createLatestWinsRunner()`'s `T | undefined` return with a discriminated result so "superseded" can't be confused with a legitimate `undefined` resolution [src/shell/invoke.ts:8-16]
- [x] [Review][Patch] Handle the `ByteOffset` variant in `errorLocation` instead of silently dropping it [src/tools/json/JsonView.vue:17-23]
- [x] [Review][Patch] Move the hand-duplicated `JsonIndent` TS union into a shared file (matching `ToolError`'s existing pattern in `src/shell/toolError.ts`) so it doesn't silently drift from the Rust enum [src/tools/json/JsonView.vue:8]
- [x] [Review][Patch] Remove the redundant `aria-label` duplicating each textarea's existing `<label for>` text [src/tools/json/JsonView.vue:64-70,135-140]

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2:** `format`/`minify` are pure functions in `umbra-core::json` — no I/O, no Tauri import, no `#[cfg(target_os)]`. Locale/timezone formatting doesn't apply to JSON (unlike JWT's timestamp claims in Epic 2), so there's nothing view-owned to carve out here beyond the indent-selection UI itself. [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (this story's first real exercise of the contract):** commands are named `<tool>_<verb>` (`json_format`, `json_minify`), return `Result<T, ToolError>`, and `ToolError`'s existing `Serialize` derive (from Story 1.3) is what makes structured — not stringified — error delivery to the frontend possible. This story is the first consumer of `error.rs`'s `Position::LineCol` variant for a real error path (previously only exercised by its own unit tests). [Source: `ARCHITECTURE-SPINE.md` AD-3; `crates/umbra-core/src/error.rs`]
- **AD-4 — explicitly partial in this story:** "work that can exceed ~100ms CPU runs async on the Rust blocking thread pool" is Story 1.9's job ("parsing/formatting runs inside async commands on the Rust blocking thread pool" is literally Story 1.9's AC1), not this one's. `json_format`/`json_minify` here are plain `async fn`s that call the sync core functions directly with no `spawn_blocking` — that's intentional, not an oversight. Don't add thread-pool dispatch in this story; the command signatures are already forward-compatible with Story 1.9 adding it inside the function bodies without any signature change.
- **AD-5:** unaffected — the JSON tool is already registered in `src/stores/registry.ts` since Story 1.5. This story doesn't touch the registry.
- **AD-6:** the JSON tool's `input`/`output`/`error`/`indent` state is local component `ref`s, not a Pinia store — nothing outside this tool needs to read them, matching the same reasoning Story 1.6 applied to the palette's local state.
- **AD-14 (this story's other core deliverable, alongside AD-16):** "one clipboard service wraps the Tauri clipboard plugin — `navigator.clipboard` is forbidden." Task 4 is that service's first implementation. Also unaffected here: drop-zone dispatch and the ⌘K handler (already built, Story 1.6) — this story adds no new document-level listeners.
- **AD-15:** not applicable — this story has no file I/O; JSON text moves in/out via the textarea and clipboard only, no dropped/saved files (that starts in Epic 2, FR11).
- **AD-16 (this story's other core deliverable):** "one shared frontend invoke helper wraps slow commands with a request ID and latest-wins supersession... results for unmounted views are discarded on arrival." Task 5's `createLatestWinsRunner()` is that helper, established here for the first time and intended for reuse by every subsequent tool story. Getting its contract right matters beyond this story.
- **NFR4 (robustness):** malformed/huge/garbage JSON input must never crash the app — covered by `serde_json::from_str`'s normal `Err` path (Task 2), never a special case.
- **NFR5 (accessibility):** labels, visible focus, WCAG AA contrast checked at PR review — Task 6 applies the same bar Story 1.5/1.6 already established (no new a11y-lint plugin exists in the repo; this is verified by tests + manual check, not lint).
- **NFR6 (repo as exhibit):** this story is the first to need a Rust command *integration* test (Task 3) alongside `umbra-core` unit tests — establishing that layer of the testing pyramid the PRD/spine already named but nothing had populated yet.

### Previous Story Intelligence (from Story 1.6)

- **Testing convention to continue:** co-locate `*.spec.ts` next to source; don't mock the project's own stores/components — Story 1.6 seeded the real `registry` store rather than mocking `useRegistryStore`. This story's one necessary deviation: `@tauri-apps/plugin-clipboard-manager` and `@tauri-apps/api/core`'s `invoke` genuinely must be mocked in Vitest, since there is no real Tauri IPC bridge in `jsdom` — that's a third-party/platform boundary, not "our own code," so it doesn't violate the convention's spirit.
- **`src/shell/` is the established home for shell-owned, cross-tool infrastructure** (empty state, sidebar, command palette so far) — `clipboard.ts` and `invoke.ts` belong there too, continuing that pattern rather than living inside `src/tools/json/`.
- **No styling/component framework exists** (unchanged since Story 1.5) — plain scoped CSS again.
- **`eslint.config.js` already has a `languageOptions.globals: globals.browser` block scoped to `files: ['src/**']`** (fixed during Story 1.6's code review) — no further eslint config changes should be needed for this story's browser-API usage (`navigator`/`window` are *not* used here per AD-14, but standard DOM types like `HTMLTextAreaElement` if referenced are already covered).
- **Branch/commit conventions** (`feat/story-1-N-<slug>`, Conventional Commits) have been consistent since Story 1.5 — Task 8 follows the same shape.

### Git Intelligence

- Recent commits (`a0c3d2e`, `12d509c`, `f3ba974`, `7548be0`, `bccda3e`) are all Story 1.6 work — frontend-only (`src/shell/CommandPalette.vue` and its tests, an eslint config fix). **No Rust command, plugin, or `umbra-core` consumer has been written since Story 1.3's `error.rs`** — this story's Rust-side work (Tasks 1–3) is genuinely greenfield, not an extension of an established pattern. Read `error.rs` and both `Cargo.toml` files directly (as this story's analysis did) rather than assuming any wiring already exists.
- `d2acea8` ("feat(core): add umbra-core workspace crate with ToolError contract") is the last time `crates/umbra-core` changed at all — confirms `json.rs` is net-new, not a modification of existing tool logic.

### Project Structure Notes

- New files: `crates/umbra-core/src/json.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/json.rs`, `src/shell/clipboard.ts` (+ `.spec.ts`), `src/shell/invoke.ts` (+ `.spec.ts`), `src/shell/toolError.ts`.
- Modified: `crates/umbra-core/src/lib.rs` (+`pub mod json;`), `crates/umbra-core/Cargo.toml` (`serde_json` → runtime dep + `preserve_order`), `src-tauri/Cargo.toml` (+`umbra-core` path dep, +`tauri-plugin-clipboard-manager`), `src-tauri/src/lib.rs` (+`mod commands;`, +clipboard plugin registration, +2 commands in `invoke_handler`), `src-tauri/capabilities/default.json` (+clipboard permissions), `package.json` (+`@tauri-apps/plugin-clipboard-manager`), `src/tools/json/JsonView.vue` (placeholder → real implementation).
- Not touched: `src/stores/registry.ts` (JSON already registered since Story 1.5), `src/router/`, `src/shell/AppSidebar.vue`, `src/shell/CommandPalette.vue`.
- This story is the first to span all three architecture layers in one piece of work (`umbra-core` → `src-tauri` commands → `src` view) — every prior story touched only one or two.

### Testing Requirements

- Rust: `cargo test -p umbra-core` (new `json.rs` suite, including the key-order regression test) + a new `src-tauri` command-level integration test (Task 3).
- TypeScript: `clipboard.spec.ts`, `invoke.spec.ts` (pure-function/mocked-boundary tests), `JsonView.spec.ts` (component test mocking only the Tauri IPC boundary).
- `cargo fmt --check`, `cargo clippy --workspace -- -D warnings`, `cargo test --workspace`, `pnpm lint`, `pnpm test`, `pnpm build` all pass locally before the PR, per the standing convention since Story 1.4's CI went live.
- Out of scope for this story's tests (belongs to later stories): tree-view rendering (1.8), 10MB-scale performance/thread-pool profiling and out-of-order request stress-testing (1.9) — Task 5's `invoke.spec.ts` only needs to prove the latest-wins *logic* with small, fast fake tasks, not real large-payload timing.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.7: Format, minify, and validate JSON; Story 1.8/1.9 boundaries; "Architecture decisions binding story implementation": AD-1, AD-3, AD-4, AD-14, AD-16; FR6, FR7, NFR4]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1 through AD-4, AD-14, AD-16, Consistency Conventions (error/data shapes, no unwrap/expect), Stack table (`tauri-plugin-clipboard-manager` 2.x / `@tauri-apps/plugin-clipboard-manager` 2.3.2), Structural Seed (`crates/umbra-core/src/json.rs`, `src-tauri/src/commands/`)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "The `ToolError` contract (AD-3)"; "Where OS-level things happen (AD-14, AD-15)"]
- [Source: `_bmad-output/implementation-artifacts/1-6-find-tools-instantly-with-cmd-k.md` — testing conventions (co-located specs, real-store seeding, mock only platform boundaries), `src/shell/` as the shell-infrastructure home, branch/commit conventions]
- Live-verified 2026-07-25 by direct file read: `crates/umbra-core/src/error.rs` and `lib.rs` (only `error` module exists; `ToolError`/`Position` already `Serialize`/`Deserialize`; `"json-syntax"` already used as the doc-comment/test-fixture example code, reserved for this story); `crates/umbra-core/Cargo.toml` (`serde_json` currently dev-only, no `preserve_order`); `src-tauri/Cargo.toml` (no `umbra-core` dependency yet, no clipboard plugin); `src-tauri/src/lib.rs` (only the scaffold `greet` command, no `commands` module); `src-tauri/capabilities/default.json` (only `core:default`/`opener:default` permissions); `package.json` (no clipboard-manager package); `src/tools/json/JsonView.vue` (unchanged placeholder from Story 1.5).
- A Context7 documentation lookup for `tauri-plugin-clipboard-manager`'s exact API/permission strings was attempted this session but did not return plugin-specific pages (the indexed Tauri docs sources returned only generic overview content for this query). The Rust crate name, JS package name, and version bracket are cross-confirmed against `ARCHITECTURE-SPINE.md`'s Stack table, but the exact JS export names (`readText`/`writeText`) and capability permission identifiers should be double-checked against the installed package's type definitions and the auto-generated `src-tauri/gen/schemas/desktop-schema.json` (Task 4).

## Change Log

- 2026-07-25: All 8 tasks implemented on `feat/story-1-7-json-format-minify-validate`, branched from an updated `main` (Story 1.6's PR #8 had squash-merged since this branch's local history; `main` was fast-forwarded before branching). `cargo fmt --check`, `cargo clippy --workspace -- -D warnings`, `cargo test --workspace` (17 tests), `pnpm lint`, `pnpm test` (33 tests), and `pnpm build` all pass locally. `pnpm tauri dev` launched successfully with the new clipboard capability resolving without ACL errors — see Completion Notes for the scope of what was and wasn't manually verified.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `cargo test --workspace` — 17 tests (13 in `umbra-core` incl. key-order regression tests, 4 command integration tests in `umbra`), all passing.
- `cargo clippy --workspace -- -D warnings` — clean.
- `cargo fmt --check` — clean after one `cargo fmt` pass (two files had formatting diffs).
- `pnpm test` — 7 test files, 33 tests, all passing.
- `pnpm lint` — clean (`--max-warnings 0`) after auto-fixing two Vue template whitespace warnings in `JsonView.vue`.
- `pnpm build` — `vue-tsc --noEmit && vite build` succeeds.
- `pnpm tauri dev` — launched successfully; `src-tauri/gen/schemas/capabilities.json` confirms `clipboard-manager:allow-read-text` and `clipboard-manager:allow-write-text` both resolve as valid permission identifiers.

### Completion Notes List

- Task 1: `umbra-core` wired into `src-tauri` as a path dependency; `serde_json` moved from `[dev-dependencies]` to `[dependencies]` in `crates/umbra-core/Cargo.toml` with the `preserve_order` feature enabled. `cargo check --workspace` confirmed the dependency edge before any consuming code was written.
- Task 2: `crates/umbra-core/src/json.rs` implements `format`/`minify` over `serde_json::Value` with `PrettyFormatter::with_indent` for the tab case. 10 unit tests cover all three indent variants, minify collapsing, key-order preservation regression (for both format and minify), malformed-input `json-syntax` errors with `Position::LineCol`, and empty-string input.
- Task 3: `src-tauri/src/commands/{mod,json}.rs` exposes `json_format`/`json_minify` as async Tauri commands per AD-3's `<tool>_<verb>` naming. 4 `#[tokio::test]` integration tests exercise the command layer directly (added `tokio` as a dev-dependency for this). `greet` and `tauri-plugin-opener` left untouched per story scope.
- Task 4: Added `tauri-plugin-clipboard-manager` (Rust, resolved to 2.3.2) and `@tauri-apps/plugin-clipboard-manager` (JS, installed at matching 2.3.2). The plugin ships with an **empty** default permission set (clipboard access is opt-in by design, not bundled like `opener:default`) — confirmed by reading the crate's `permissions/default.toml` and `permissions/autogenerated/commands/{read_text,write_text}.toml` directly, and cross-verified at runtime via the generated `capabilities.json`. Added `clipboard-manager:allow-read-text` / `clipboard-manager:allow-write-text` explicitly. `readText`/`writeText` export names confirmed against the installed package's `dist-js/index.d.ts` — matched the story's assumption exactly, no correction needed.
- Task 5: `src/shell/invoke.ts`'s `createLatestWinsRunner()` implemented exactly as specified — pure, dependency-free, one runner instance per component. 4 unit tests use hand-rolled deferred promises to precisely control resolution order, proving both a resolved and a rejected stale call are silently discarded while a non-superseded call still surfaces normally (success and failure paths both covered).
- Task 6: `src/shell/toolError.ts` holds the shared `ToolError`/`ToolErrorPosition` TS types (no shared error-display component yet, per story guidance). `JsonView.vue` wires `input`/`output`/`indent`/`error` local refs, all four controls (Format, Minify, Paste, Copy), a `role="alert"` error region rendering only structured fields (`error.message` + line/column when present — no string-matching), and clears `error` at the start of every new Format/Minify click so a stale error can't linger next to a fresh result. 8 component tests mock only the Tauri IPC boundary (`@tauri-apps/api/core`'s `invoke` and `@tauri-apps/plugin-clipboard-manager`), matching the project's no-mocking-our-own-code convention.
- Task 7: Full verification pass green across both toolchains (see Debug Log References). One scope note on the manual `pnpm tauri dev` check: I confirmed the app launches cleanly and the clipboard capability permissions resolve without ACL/runtime errors (the specific failure mode this subtask exists to catch), but I could not interactively click Paste/Copy inside the live native window myself — my available browser-automation tooling only reaches Chrome tabs, and a plain Chrome tab has no Tauri IPC bridge injected, so it can't stand in for the native webview. Confidence that paste/copy *behavior* is correct rests on the 8 `JsonView.spec.ts` tests, which mount the real component and exercise the real `clipboard.ts`/`invoke.ts` code paths against a mocked IPC boundary. Recommend a quick manual click-through before merging.

### File List

- `crates/umbra-core/src/json.rs` (new)
- `src-tauri/src/commands/mod.rs` (new)
- `src-tauri/src/commands/json.rs` (new)
- `src/shell/clipboard.ts` (new)
- `src/shell/clipboard.spec.ts` (new)
- `src/shell/invoke.ts` (new)
- `src/shell/invoke.spec.ts` (new)
- `src/shell/toolError.ts` (new)
- `src/tools/json/JsonView.spec.ts` (new)
- `crates/umbra-core/src/lib.rs` (modified — `+pub mod json;`)
- `crates/umbra-core/Cargo.toml` (modified — `serde_json` moved to `[dependencies]` with `preserve_order`; added a WHY comment on the feature)
- `crates/umbra-core/src/error.rs` (modified — added a WHY comment on `Position`'s `#[serde(tag = "kind")]`; no behavior change, pre-existing file from Story 1.3)
- `src-tauri/Cargo.toml` (modified — `+umbra-core`, `+tauri-plugin-clipboard-manager`, `+[dev-dependencies] tokio`; added a WHY comment on the `tokio` dev-dependency)
- `src-tauri/src/lib.rs` (modified — `+mod commands;`, `+clipboard_manager` plugin registration, `+json_format`/`json_minify` in `invoke_handler`)
- `src-tauri/capabilities/default.json` (modified — `+clipboard-manager:allow-read-text`, `+clipboard-manager:allow-write-text`)
- `package.json` (modified — `+@tauri-apps/plugin-clipboard-manager`)
- `pnpm-lock.yaml` (modified — lockfile update from `pnpm add`)
- `Cargo.lock` (modified — lockfile update from new Rust dependencies)
- `src/tools/json/JsonView.vue` (modified — placeholder replaced with real implementation; added a WHY comment on the error-clearing timing in `runTransform`; code review pass: clears stale output/error on failed transform and on Paste, wraps Paste/Copy in try/catch, routes Paste through `runLatestWins`, validates rejection shape via `isToolError`, renders `ByteOffset` positions, imports `JsonIndent` from shared location, drops redundant `aria-label`s)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status tracking)
- `src/tools/json/jsonIndent.ts` (new — code review pass: `JsonIndent` extracted from `JsonView.vue` into its own shared file)
- `src/shell/toolError.spec.ts` (new — code review pass: unit tests for the new `isToolError` type guard)
- `src/shell/toolError.ts` (modified — code review pass: added `isToolError` type guard)
- `src/shell/invoke.ts` (modified — code review pass: `runLatestWins` now returns a discriminated `LatestWinsResult<T>` instead of `T | undefined`, so a superseded call can't be confused with a legitimate `undefined` resolution)
- `src/shell/invoke.spec.ts` (modified — code review pass: updated assertions for the new discriminated return shape; added a regression test for the `undefined`-resolution ambiguity)
- `src/tools/json/JsonView.spec.ts` (modified — code review pass: updated selectors to use element `id`s instead of the removed `aria-label`s; added 8 tests covering stale-output clearing, clipboard error handling, the Paste latest-wins race, non-`ToolError` rejections, and `ByteOffset` rendering)
