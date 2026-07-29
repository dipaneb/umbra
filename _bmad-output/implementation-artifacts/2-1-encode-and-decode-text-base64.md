---
baseline_commit: 928588b
---

# Story 2.1: Encode and decode text ↔ Base64

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want to encode and decode text to and from Base64 without leaving my machine,
so that I can handle tokens, payloads, and data URIs I could never paste into a website.

## Acceptance Criteria

1. **Given** text in the input area, **when** I choose Encode, **then** standard Base64 output is produced, with a URL-safe alphabet option (FR10), **and** the transformation lives in `umbra-core::base64` behind async commands returning `Result<T, ToolError>` (AD-1, AD-3).
2. **Given** Base64 text in the input area, **when** I choose Decode, **then** the decoded text is shown, with the alphabet (standard/URL-safe) detected automatically (FR10) — the user never picks an alphabet to decode with.
3. **Given** invalid Base64 input, **when** I decode it, **then** a clear inline error explains what is wrong (with byte offset where applicable, per AD-3's position rules) — never a crash or silent empty output (FR12, NFR4).
4. **Given** the tool is open, **when** I use paste-from-clipboard or copy-to-clipboard, **then** transfer happens in one action via the shell clipboard service (FR4, AD-14).

## Tasks / Subtasks

- [ ] **Task 1: `umbra-core::base64` — the functional core (AC: 1, 2, 3)**
  - [ ] `crates/umbra-core/Cargo.toml`: add `base64 = "0.23"` (unpinned major, matching this project's existing convention for `tauri-plugin-store`/`tauri-plugin-clipboard-manager` — see Library/Framework Requirements below for exact API).
  - [ ] New file `crates/umbra-core/src/base64.rs`:
    - `pub fn encode(input: &str, url_safe: bool) -> String` — encodes the input's UTF-8 bytes using `base64::engine::general_purpose::STANDARD` or `URL_SAFE` (both canonically padded — matches AC1's plain "standard Base64 output") depending on `url_safe`. This cannot fail (any `&str`'s bytes are valid encoder input) — return `String` directly, not `Result`.
    - `pub fn decode(input: &str) -> Result<String, ToolError>` — auto-detects standard vs. URL-safe alphabet (see Library/Framework Requirements for the exact detection rule) using a **custom-configured engine that tolerates both padded and unpadded input** (see below — the premade `STANDARD`/`URL_SAFE` constants reject unpadded input, which would break this story's own headline JWT-segment use case), decodes to bytes, then validates the bytes are valid UTF-8 before returning as `String`. **Both the Base64-decode step and the UTF-8-validation step are error sources that must each map to a distinct, honest `ToolError` — see the anti-pattern warning below.**
  - [ ] Reuse the `check_input_size`-style guard from `crates/umbra-core/src/json.rs` (same rationale: CWE-400 unbounded-allocation protection) — a pasted Base64 blob (e.g. an embedded font or image data URI) can be very large even without going through Story 2.2's file-drop path. Pick your own error code (e.g. `base64-input-too-large`) and reuse `json.rs`'s `MAX_INPUT_BYTES` constant value as a starting point, not a shared import (each tool module owns its own constant, per that file's existing pattern).
  - [ ] Register the module in `crates/umbra-core/src/lib.rs`: add `pub mod base64;` alongside the existing `pub mod json;`.
  - [ ] **Anti-pattern to avoid — this is the single most likely way this story quietly fails FR12:** a decoded Base64 payload can be arbitrary binary (e.g. a JWT signature segment, compressed data, an image). Naively converting decoded bytes to a displayable string via `String::from_utf8_lossy(&bytes)` *silently* substitutes U+FFFD replacement characters for invalid sequences instead of erroring — this satisfies neither "clear inline error" (AC3) nor "never... silent empty output" (FR12), because the user sees mangled-but-present text with no indication anything was wrong. Use `String::from_utf8(bytes)` (fallible) and map its `Err` to a `ToolError` with its own distinct `code` (e.g. `base64-not-utf8`) — do not conflate this with the alphabet-decode error's `code`, since they are different failure causes a user would want to distinguish.

- [ ] **Task 2: Tauri commands — `base64_encode` / `base64_decode` (AC: 1, 2, 3)**
  - [ ] New file `src-tauri/src/commands/base64.rs`, mirroring `src-tauri/src/commands/json.rs`'s exact shape:
    - `#[tauri::command(rename_all = "snake_case")] pub async fn base64_encode(input: String, url_safe: bool) -> Result<String, ToolError>` — wraps `umbra_core::base64::encode` in `tauri::async_runtime::spawn_blocking`, with the same `map_join_error`-style panic/join-error mapping as `json.rs` (copy the pattern, using a `base64-internal` code instead of `json-internal`).
    - `#[tauri::command] pub async fn base64_decode(input: String) -> Result<String, ToolError>` — same `spawn_blocking` wrapping around `umbra_core::base64::decode`.
    - **The `rename_all = "snake_case"` attribute on `base64_encode` is not optional.** Tauri v2's default IPC convention camelCases JS-side argument keys onto the Rust parameter names — `json_format`/`json_minify`/`json_parse` never needed this because every one of their parameters is a single word, so camelCase and snake_case are identical for them. `url_safe` is this codebase's first multi-word command parameter; without the attribute, the frontend would have to call `invoke("base64_encode", { input, urlSafe })` (camelCase key) instead of `{ input, url_safe }` — either works *if consistent*, but the attribute keeps the JS call site's argument name textually identical to the Rust signature, avoiding a silent naming mismatch. Add the same attribute to `base64_encode` only; `base64_decode` has no multi-word parameter so it's unaffected.
  - [ ] Register the module in `src-tauri/src/commands/mod.rs`: add `pub mod base64;` alongside `pub mod json;`.
  - [ ] Register both commands in `src-tauri/src/lib.rs`'s `tauri::generate_handler![...]` list (currently `greet, json_format, json_minify, json_parse`) and the matching `use commands::base64::{base64_encode, base64_decode};` import line.

- [ ] **Task 3: `Base64View.vue` — the tool's UI (AC: 1, 2, 3, 4)**
  - [ ] New file `src/tools/base64/Base64View.vue`. Mirror `src/tools/json/JsonView.vue`'s established shape and conventions exactly — this story is the second tool ever built, and the first real test of whether that pattern generalizes:
    - `input`/`output`/`error` refs, `createLatestWinsRunner()` for request-ordering (reuse `src/shell/invoke.ts`, don't reimplement), `isToolError`/`ToolError` from `src/shell/toolError.ts` for error typing and rendering (the `errorLocation` computed property that branches on `position.kind === "LineCol" | "ByteOffset"` already handles Base64's byte-offset case — reuse it verbatim, don't write a Base64-specific version).
    - `onPaste`/`onCopy` reusing `readClipboardText`/`writeClipboardText` from `src/shell/clipboard.ts` unchanged (AD-14 — do not call `navigator.clipboard` or reimplement clipboard access).
  - [ ] **Interaction model — a genuine ambiguity in the source AC, resolved here; implement as specified rather than re-deriving it.** epics.md's AC2 reads "when I choose Decode (**or rely on auto-detection of decode input**)" — that parenthetical could mean the tool infers Encode-vs-Decode automatically from content instead of a button. This story resolves it as: two explicit buttons, "Encode" and "Decode", matching `JsonView.vue`'s Format/Minify precedent — do not attempt to infer Encode-vs-Decode automatically from input content. Rationale: silently guessing the mode risks treating plain text that happens to look Base64-like as "decode" and producing garbage output with no error shown — a direct violation of FR12's "never a crash or silent empty output". Auto-detection in this story applies *only* to which alphabet a Decode click uses (AC2's "the alphabet ... detected automatically" — handled entirely in the core `decode` function from Task 1), not to which of Encode/Decode the user meant. If this reading is wrong, flag it in review rather than silently building the other interpretation.
  - [ ] A radio/toggle for "Standard" vs. "URL-safe" alphabet, used only by the Encode action (`onEncode` passes it as `base64_encode`'s `url_safe` argument) — matching `JsonView.vue`'s `<fieldset>`/`<label><input type="radio">` pattern for its indent options. Decode has no such control (alphabet is auto-detected per Task 1).
  - [ ] Register the tool in `src/stores/registry.ts` — **this is the only place a new tool registers** (AD-5). As of this story, `registry.ts` no longer holds the entries directly inside `useRegistryStore()`'s `ref([...])` call — a `fix/tool-registry-id-uniqueness-guard` change (merged to `main` the same day this story was written) refactored it to a module-level `const TOOLS: ToolRegistryEntry[] = [...]` array, followed by `assertUniqueToolIds(TOOLS)` called once at module load, with `useRegistryStore` wrapping `ref<ToolRegistryEntry[]>([...TOOLS])` (a copy, not `TOOLS` itself — each store instance needs its own array). **Add the new entry to `TOOLS`, not inside `useRegistryStore`'s `ref()` call.** Entry: `{ id: "base64", name: "Base64", aliases: ["base64", "b64"], route: "/tools/base64", icon: <pick one consistent with the existing "{ }" JSON icon style>, component: () => import("../tools/base64/Base64View.vue") }`. The `"b64"` alias is explicitly required by FR2 ("`⌘K` search... by aliases/synonyms (`"b64"` → Base64)"). `assertUniqueToolIds` will throw at module load if `"base64"` ever collided with an existing id — it won't, but that's the mechanism now guarding against it, so no manual uniqueness check is needed beyond picking a sane id. **Do not** hand-edit `src/router/index.ts` or `src/shell/AppSidebar.vue` — both already generate from this registry entry automatically; touching them directly would violate AD-5 and is very likely dead-weight duplicate code that breaks the single-source-of-truth guarantee Story 1.5/1.6 built.

- [ ] **Task 4: Tests**
  - [ ] `crates/umbra-core/src/base64.rs` unit tests (co-located `#[cfg(test)] mod tests`, matching `json.rs`'s in-file convention): round-trip encode→decode for both alphabets; decode of a known-good standard and known-good URL-safe fixture; **decode of unpadded standard and unpadded URL-safe input succeeds** (the padding-tolerance requirement from Library/Framework Requirements — this is the regression test that would have caught the padding gap if this story's first draft had shipped as originally written); decode error on invalid character (assert `ToolError.code` and `position` is `Some(Position::ByteOffset { offset })` matching the invalid byte's actual index — this is what `error.rs`'s existing `base64-invalid`/`ByteOffset` example test fixture already anticipates, confirm the real implementation's `code` string matches whatever you pick here); decode of valid Base64 that decodes to non-UTF8 bytes returns the distinct not-a-UTF8-string error (the Task 1 anti-pattern case) rather than lossy/mangled output; oversized-input rejection. Between them, the three error-path tests should exercise all three error codes this story introduces (`base64-invalid`, `base64-not-utf8`, `base64-input-too-large`) so none goes uncovered.
  - [ ] `src-tauri/src/commands/base64.rs` command-level tests (mirror `json.rs`'s `#[tokio::test]` block): `base64_encode`/`base64_decode` happy paths for both alphabets, malformed-input error propagation, and a `map_join_error`-equivalent panic-mapping test.
  - [ ] `src/tools/base64/Base64View.spec.ts`: Encode/Decode button actions call the right `invoke()` command with the right args (including `url_safe` for Encode); error rendering for both a byte-offset decode error and a generic error; paste/copy delegate to the mocked `clipboard.ts` functions (reuse the exact `vi.mock` module-factory pattern from `src/shell/clipboard.spec.ts` / `JsonView.spec.ts` — mock `@tauri-apps/api/core`'s `invoke` the same way `JsonView.spec.ts` does, do not invent a new mocking style).
  - [ ] `src/stores/registry.spec.ts` (or wherever registry coverage lives — check for an existing spec before creating a new file) and/or `AppSidebar.spec.ts`/`CommandPalette.spec.ts`: extend existing "N tools registered" assertions to account for the new Base64 entry, and add a palette-search case confirming `"b64"` resolves to it (FR2).

- [ ] **Task 5: Full verification pass**
  - [ ] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [ ] `pnpm lint`, `pnpm test`, `pnpm build`, `vue-tsc --noEmit`.
  - [ ] Manual `pnpm tauri dev` check (same precedent as every prior story back to 1.7): encode text with both alphabets, decode valid Base64 of both alphabets, decode invalid Base64 and confirm the inline error (with offset) renders, paste-from-clipboard and copy-to-clipboard round-trip, confirm the tool appears in the sidebar and is found via `⌘K` searching both "base64" and "b64".

- [ ] **Task 6: Commit and open a PR**
  - [ ] Branch: `feat/story-2-1-<slug>` (repo convention, e.g. `feat/story-2-1-base64-text`).
  - [ ] Conventional Commit(s), `feat` type scoped to `base64`.
  - [ ] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2 (functional core):** all Base64 transformation logic — encode, decode, alphabet detection, UTF-8 validation — lives in `crates/umbra-core/src/base64.rs` as pure functions with zero I/O and zero Tauri dependency. The Tauri commands (Task 2) are a thin `spawn_blocking` wrapper only; do not put decode/encode logic directly in `src-tauri`. [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (ToolError contract):** this is Base64's first story, so it's also the first time a tool other than JSON populates `ToolError.position` with `Position::ByteOffset` instead of `LineCol` — the variant exists in `crates/umbra-core/src/error.rs` specifically for this case (its own test fixture already uses a `"base64-invalid"` code as the illustrative example — see References). Reuse `Position`/`ToolError` unchanged from `umbra-core::error`; do not add a Base64-specific error type. Commands are named `base64_encode`/`base64_decode`, matching the `<tool>_<verb>` convention. [Source: `ARCHITECTURE-SPINE.md` AD-3; `crates/umbra-core/src/error.rs`]
- **AD-4 (async, off the main thread):** wrap both commands in `tauri::async_runtime::spawn_blocking`, matching `json.rs`'s established pattern, even though a typical paste is far smaller than JSON's 10 MB bar — a user can paste an arbitrarily large Base64 blob (e.g. a data URI) directly into the text tool without going through Story 2.2's file-drop path, so the same protection applies. [Source: `ARCHITECTURE-SPINE.md` AD-4; `src-tauri/src/commands/json.rs`]
- **AD-5 (one Tool Registry):** register Base64 exactly once, in `src/stores/registry.ts`. The router and sidebar both already generate from this store (Story 1.5) and need no changes. [Source: `ARCHITECTURE-SPINE.md` AD-5; `src/stores/registry.ts`]
- **AD-14 (shell owns clipboard once):** reuse `src/shell/clipboard.ts` unchanged for paste/copy — this is the second tool to consume it (JSON was the first), so this story is a real test of whether that service generalizes cleanly to a second consumer. [Source: `ARCHITECTURE-SPINE.md` AD-14; `src/shell/clipboard.ts`]
- **Not in scope for this story (explicitly deferred to Story 2.2):** file drop, the shell's window-level drop service, and the save-dialog-plus-write helper (AD-14/AD-15) are all Story 2.2 deliverables ("First use of the shell's window-level drop service and shared file-save helper" per the Epic 2 summary) — do not build drop handling here even though the Base64 tool will eventually need it. [Source: `epics.md` Epic 2 summary, Story 2.2]

### Library/Framework Requirements

- **Crate:** `base64 = "0.23"` (latest stable, verified directly against the crates.io registry API 2026-07-29; license `MIT OR Apache-2.0`, permissive — clears this project's dependency-license-review bar with no further action needed). Not currently a direct dependency anywhere in this workspace — it exists today only as a *transitive* dependency of `tauri`'s own stack (via `wry`, `tauri-codegen`, etc., confirmed via `Cargo.lock`), at older versions (0.21.7/0.22.1) unrelated to this story's new direct `umbra-core` dependency. Cargo resolves these independently; no conflict.
- **API shape (verified via Context7 `/websites/rs_base64_base64`, 2026-07-29):** the crate's API is the `Engine` trait, not free functions (a breaking change from very old `base64` versions — do not write code assuming a bare `base64::encode(...)` function exists, it does not on 0.23):
  ```rust
  use base64::{engine::general_purpose::{STANDARD, URL_SAFE}, Engine as _};

  STANDARD.encode(bytes) -> String
  URL_SAFE.encode(bytes) -> String
  STANDARD.decode(input) -> Result<Vec<u8>, base64::DecodeError>
  URL_SAFE.decode(input) -> Result<Vec<u8>, base64::DecodeError>
  ```
- **Alphabet auto-detection for decode (AC2 — no crate-provided helper for this, implement directly):** the standard alphabet uses `+`/`/`; the URL-safe alphabet uses `-`/`_`; both otherwise share the same alphanumeric characters. Scan the input once: if it contains `-` or `_`, decode with a URL-safe engine; else decode with a standard engine (this also correctly covers pure-alphanumeric input, e.g. short tokens, where either engine produces an identical result since the two alphabets are only distinguished by those four characters).
- **Padding must be tolerant on decode, not just canonical (verified via Context7, 2026-07-29 — do not use the premade `general_purpose::STANDARD`/`URL_SAFE` constants for decoding as-is):** the premade constants require canonical padding (`DecodePaddingMode::RequireCanonical`) and will reject unpadded input with `DecodeError::InvalidPadding` — but unpadded Base64URL is the norm for real-world tokens (this story's own opening example, "handle tokens... I could never paste into a website", e.g. JWT segments, are unpadded). Build two custom decode engines instead, one per alphabet, configured to tolerate either padded or unpadded input:
  ```rust
  use base64::{engine::{GeneralPurpose, GeneralPurposeConfig, DecodePaddingMode}, alphabet, Engine as _};

  const DECODE_CONFIG: GeneralPurposeConfig = GeneralPurposeConfig::new()
      .with_decode_padding_mode(DecodePaddingMode::Indifferent); // accepts canonical padding OR none
  const STANDARD_DECODER: GeneralPurpose = GeneralPurpose::new(&alphabet::STANDARD, DECODE_CONFIG);
  const URL_SAFE_DECODER: GeneralPurpose = GeneralPurpose::new(&alphabet::URL_SAFE, DECODE_CONFIG);
  ```
  Use these two for `decode`'s alphabet-detection branch instead of the premade constants. Keep using the premade padded `STANDARD`/`URL_SAFE` constants for `encode` unchanged — AC1 only asks for "standard Base64 output", and defaulting encode output to canonical padding is the unsurprising choice; the padding-tolerance requirement is specific to decode's real-world-input problem.
- **Frontend `invoke()` call-site convention:** because `base64_encode` uses `rename_all = "snake_case"` (see Task 2), call it as `invoke<string>("base64_encode", { input, url_safe: alphabet === "url_safe" })` — snake_case key, matching the Rust parameter name exactly, not `urlSafe`.
- **Error mapping (`base64::DecodeError` → `ToolError`, verified via Context7, 2026-07-29):**
  ```rust
  pub enum DecodeError {
      InvalidByte(usize, u8),      // -> Position::ByteOffset { offset: usize as u64 } — this is AC3's "byte offset where applicable"
      InvalidLength(usize),
      InvalidLastSymbol(usize, u8), // also carries a usable offset
      InvalidPadding,
  }
  ```
  Map `InvalidByte`/`InvalidLastSymbol`'s `usize` directly into `Position::ByteOffset { offset }`; `InvalidLength`/`InvalidPadding` have no single meaningful byte location — leave `position: None` for those and rely on `message`/`context` to explain. Pick one stable `code` string for all Base64-alphabet-decode failures (e.g. `"base64-invalid"`, matching `error.rs`'s existing test-fixture example) — do not invent a different code per `DecodeError` variant, that granularity isn't asked for by any AC and each tool's existing convention (see `json-syntax` in `json.rs`) is one code per failure *category*, not per underlying library enum variant.

### File Structure Requirements

- **New:** `crates/umbra-core/src/base64.rs` (+ inline `#[cfg(test)]` tests), `src-tauri/src/commands/base64.rs` (+ inline `#[tokio::test]` tests), `src/tools/base64/Base64View.vue` (+ `Base64View.spec.ts`).
- **Modified:** `crates/umbra-core/Cargo.toml` (+`base64` dependency), `crates/umbra-core/src/lib.rs` (+`pub mod base64;`), `src-tauri/src/commands/mod.rs` (+`pub mod base64;`), `src-tauri/src/lib.rs` (+2 commands in `generate_handler!` + import), `src/stores/registry.ts` (+1 tool entry), `Cargo.lock`.
- **Not touched:** `crates/umbra-core/src/json.rs`, `src-tauri/src/commands/json.rs`, `src/tools/json/*` (unrelated to this story — read only, for pattern reference), `src/router/index.ts`, `src/shell/AppSidebar.vue` (both generate from the registry automatically, per AD-5 — see Task 3's explicit warning), `src/shell/clipboard.ts` (consumed unchanged, not modified).

### Testing Requirements

- Rust: `cargo test --workspace` covering the new `crates/umbra-core/src/base64.rs` unit tests and `src-tauri/src/commands/base64.rs` command tests (Task 4). `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings` — unchanged conventions, no `unwrap`/`expect` in command paths.
- TypeScript: `pnpm test` covering the new `Base64View.spec.ts` and the extended registry/sidebar/palette specs (Task 4). Reuse this project's existing `vi.mock` module-factory pattern for any `@tauri-apps/*` boundary — do not mock this project's own code (`clipboard.ts`, `toolError.ts`, `invoke.ts`), only platform packages, matching every prior story's convention.
- `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all pass locally before the PR.
- Manual: `pnpm tauri dev`, per Task 5 — this is the only way to evidence the actual end-to-end encode/decode/error/clipboard/registration behavior, same precedent as every story since 1.7.
- Out of scope for this story's tests: file-drop encoding, save-to-file decoding (Story 2.2's surface entirely).

### Previous Story Intelligence

- **From Story 1.7–1.9 (JSON tool, the only precedent for a real tool's command+UI shape):** `json.rs`'s `spawn_blocking` + `map_join_error` pattern, and `JsonView.vue`'s `createLatestWinsRunner`/`isToolError`/error-rendering pattern, are the direct templates for this story's Tasks 1–3 — copy their shape, don't redesign it. `errorLocation`'s `position.kind === "ByteOffset"` branch in `JsonView.vue` already exists and was written anticipating exactly this story; reuse it as-is in `Base64View.vue` rather than writing a new error-rendering helper.
- **From Story 1.10 (most recent, cross-epic):** confirmed the registry-driven sidebar/router/palette generation (AD-5) holds up cleanly when a second real consumer (Settings) needed to integrate — the same confidence applies here, since adding a tool is exactly the case AD-5 was designed for (unlike Settings, which deliberately opted *out* of the registry). Also reconfirmed this project's `vi.mock` mocking convention and co-located `*.spec.ts` convention, both still current.
- **Deferred-work note surfaced but not actionable here:** the architecture spine's Deferred section flags a `settings.json` schema-migration mechanism as a concern to "revisit before Epic 2 ships beyond the Epic 1 baseline keys" — this story introduces no persisted `base64.*` settings keys, so it doesn't trigger that concern. Flagging for awareness only; no action needed in this story.

### Git Intelligence

- `main`'s tip at story-creation time is `928588b` (this story's `baseline_commit`). The 3 most recent merges — `928588b` (#24, nesting-depth regression test), `602e724` (#23, registry duplicate-id guard), `f09cc50` (#22, Epic 1 retrospective) — all landed the same day this story was written, closing out Epic 1's retrospective action items. Two of those three are directly load-bearing for this story:
  - **#23 already changed `src/stores/registry.ts`** — see Task 3's updated instructions above (module-level `TOOLS` const + `assertUniqueToolIds()` guard, replacing the old inline array-literal-in-`ref()` shape). Confirmed via `git diff` against the prior `main` tip; Task 3's guidance already reflects the merged shape, not the pre-merge one.
  - **#22's retrospective closed both of Epic 1's "before Epic 2 Story 2.1 starts" action items** — the registry-guard item (via #23) and a `settings.json` schema-migration policy decision (documented as an `ARCHITECTURE-SPINE.md` Deferred-section amendment, not new code: migration machinery is deliberately deferred until some future story actually renames/removes/retypes an existing settings key, which no Epic 2 story does). Both were open prerequisites tracked against this exact story; both are resolved, and neither requires any action in this story's own tasks.
- Before this session, `main` also carried `d75c82c`/`e85e4f2`/`e27e878` (security patch, Story 1.10, Story 1.9 perf work) — none of that touches `crates/umbra-core/src/lib.rs`'s module list, `src-tauri/src/commands/mod.rs`, or `src-tauri/src/lib.rs`'s `generate_handler!` list, so this story is still the first change to those three registration points since Story 1.3 originally established them.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.1: Encode and decode text ↔ Base64; FR10, FR12, FR4, AD-1, AD-3, AD-14; Epic 2 summary (Story 2.2 scope boundary)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — FR10 (encode/decode + URL-safe + auto-detect), FR12 (inline error, never crash/silent-empty), FR4 (one-action clipboard)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1/AD-2 (functional core), AD-3 (`ToolError`/`Position::ByteOffset`, this story's first real use of that variant), AD-4 (async/spawn_blocking), AD-5 (Tool Registry), AD-14 (clipboard service)]
- Live-verified this session by direct file read: `src/stores/registry.ts`, `src/router/index.ts`, `src/shell/clipboard.ts`, `src/shell/invoke.ts`, `src/shell/toolError.ts`, `src/tools/json/JsonView.vue`, `src-tauri/src/commands/json.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`, `crates/umbra-core/src/error.rs`, `crates/umbra-core/src/json.rs`, `crates/umbra-core/src/lib.rs`, root/`umbra-core`/`src-tauri` `Cargo.toml`, `Cargo.lock` (confirmed `base64` is present only transitively at 0.21.7/0.22.1, not yet a direct dependency), `src/shell/clipboard.spec.ts` (test-mocking convention).
- Context7 (`/websites/rs_base64_base64`, verified this session, 2026-07-29): `Engine` trait API shape, `general_purpose::STANDARD`/`URL_SAFE` constants, `DecodeError` enum variants and their byte-offset-carrying fields, `DecodePaddingMode`/`GeneralPurposeConfig` for padding-tolerant custom decode engines (the premade constants require canonical padding and would otherwise reject real-world unpadded tokens).
- Context7 (`/websites/tauri_app`, verified this session, 2026-07-29): command argument naming — Tauri v2 defaults to camelCase JS-side argument keys mapped onto Rust parameter names; `#[tauri::command(rename_all = "snake_case")]` is required to keep a multi-word parameter like `url_safe` textually identical on both sides. Confirmed `json_format`/`json_minify`/`json_parse` never needed this only because every one of their parameters is single-word.
- crates.io registry API (verified this session, 2026-07-29, direct API query per this project's stack-verification convention — not a search-engine snippet): `base64` latest stable is `0.23.0`, license `MIT OR Apache-2.0`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
