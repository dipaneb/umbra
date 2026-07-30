---
baseline_commit: 610aa97
---

# Story 2.4: Hash text

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want simultaneous digests of my text input,
so that I can produce checksums without pasting content into a website.

## Acceptance Criteria

1. **Given** text input, **when** digests are computed, **then** SHA-256, SHA-512, MD5, and SHA-1 all display simultaneously, computed in `umbra-core::hash` (FR14, AD-1), **and** MD5 and SHA-1 are visibly labeled as legacy.
2. **Given** hex output, **when** I toggle uppercase/lowercase, **then** all displayed digests re-render in the chosen case, each with one-click copy (FR14).
3. **Given** the tool's scope, **when** reviewed, **then** no bcrypt/argon2 options are present — password hashing is a separate P3 backlog tool, not this one (FR14).

## Tasks / Subtasks

- [x] **Task 1: `umbra-core::hash` — the digest function (AC: 1, 2)**
  - [x] `crates/umbra-core/Cargo.toml`: add three new dependencies, all **verified this session directly against the crates.io registry API** (current stable, all three released in lockstep): `sha2 = "0.11"` (license `MIT OR Apache-2.0`), `sha1 = "0.11"` (license `MIT OR Apache-2.0`), `md-5 = "0.11"` (license `MIT OR Apache-2.0`). **Correction to this story's own drafted guidance, found by empirical build test this session:** a bare `md_5 = "0.11"` dependency key does **not** resolve on this Cargo version (1.94.0) — `cargo build` fails with "no matching package found: md_5", and `cargo add md-5@0.11` independently confirms the correct bare key is `md-5` (with a dash, matching the registry name exactly). Rust's dash→underscore extern-name conversion would normally make that import `md_5`, but the `md-5` crate's own `Cargo.toml` sets `[lib] name = "md5"`, so the **import namespace in code is `md5`** (no underscore at all) — i.e. write `md-5 = "0.11"` in `Cargo.toml` but `use md5::{Md5, Digest};` in Rust. Verified by actually compiling, not by documentation alone.
  - [x] **New file `crates/umbra-core/src/hash.rs`.** All four hashers share the RustCrypto `Digest` trait's one-shot API — verified via Context7 this session:
    ```rust
    use sha2::{Digest, Sha256, Sha512};
    use md5::Md5;
    use sha1::Sha1;

    let digest_bytes = Sha256::digest(input.as_bytes()); // -> impl Deref<Target = [u8]>
    ```
    Only one `Digest` import is needed even though `Sha256`/`Sha512`/`Md5`/`Sha1` come from three different crates — all three crates re-export the identical `digest::Digest` trait, and Rust resolves trait methods by the trait item itself, not the import path used to bring it into scope.
  - [x] Define the output struct (crosses IPC as a plain object, no enum — contrast `UuidVersion`, there is no per-tool "kind" selector here):
    ```rust
    #[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
    pub struct HashDigests {
        pub sha256: String,
        pub sha512: String,
        pub md5: String,
        pub sha1: String,
    }
    ```
  - [x] `const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;` — mirrors `base64.rs`'s own `MAX_INPUT_BYTES` constant and its CWE-400 rationale (unbounded allocation from arbitrarily large pasted text). Not spelled out verbatim by the ACs (unlike Story 2.1/2.2's Base64 tool, this story's epic entry doesn't mention a size limit), but this codebase's established convention is that **every tool accepting arbitrary pasted text defines its own size cap** (`json.rs`, `base64.rs` both do), per NFR4's "no user input... crashes the app" bar. Each tool module owns its own constant rather than sharing another module's, per `base64.rs`'s existing convention. Flag in review if this reading is judged unnecessary.
  - [x] `pub fn compute(input: &str) -> Result<HashDigests, ToolError>`:
    - Size check first, same shape as `base64.rs::check_size`: `input.as_bytes().len() > MAX_INPUT_BYTES` → `ToolError { code: "hash-input-too-large", message: format!("input is {len} bytes, which exceeds the {MAX_INPUT_BYTES}-byte limit"), position: None, context: None }`.
    - Otherwise hash the same `input.as_bytes()` with all four algorithms and hex-encode each digest **lowercase** — case is a presentation concern (AD-1: "case toggles for display... view-owned, never computed in core"), so core has exactly one canonical output per algorithm, never an uppercase variant. No `hex` crate needed (not currently a dependency, and this codebase prefers no new dependency where a few lines suffice): `bytes.iter().map(|b| format!("{b:02x}")).collect()`.
    - This function cannot otherwise fail — unlike `base64::decode`, there is no "invalid input" case for hashing arbitrary bytes, so `hash-input-too-large` is the *only* error code this module ever produces.
  - [x] `crates/umbra-core/src/lib.rs`: add `pub mod hash;` (insert alphabetically: `base64`, `error`, `hash`, `json`, `uuid`).

- [x] **Task 2: Tauri command `hash_compute` (AC: 1, 2)**
  - [x] **New file `src-tauri/src/commands/hash.rs`.** Same shape as `commands/uuid.rs` (no file I/O, single input, single `spawn_blocking`-wrapped call):
    ```rust
    use umbra_core::ToolError;
    use umbra_core::hash::{HashDigests, compute};

    #[tauri::command]
    pub async fn hash_compute(input: String) -> Result<HashDigests, ToolError> {
        tauri::async_runtime::spawn_blocking(move || compute(&input))
            .await
            .map_err(map_join_error)?
    }

    fn map_join_error(err: tauri::Error) -> ToolError {
        ToolError {
            code: "hash-internal".to_string(),
            message: format!("background task failed: {err}"),
            position: None,
            context: None,
        }
    }
    ```
    Unlike `uuid_generate` (where `spawn_blocking` is a pure consistency choice on genuinely sub-millisecond work), this one is a **real correctness requirement**: hashing up to 100 MB of text with four algorithms can plausibly exceed AD-4's ~100 ms CPU bar, so this must stay off the main thread, not just match convention.
  - [x] `src-tauri/src/commands/mod.rs`: add `pub mod hash;` (insert alphabetically: `base64`, `hash`, `json`, `uuid`).
  - [x] `src-tauri/src/lib.rs`: add `use commands::hash::hash_compute;` and register `hash_compute` in the `generate_handler![...]` list.
  - [x] **No `src-tauri/Cargo.toml` change needed.** Same reasoning as `uuid_generate`: `sha2`/`sha1`/`md-5` are `umbra-core`-only dependencies (AD-1); `src-tauri`'s command file only calls `umbra_core::hash::compute` and re-exports its already-typed `HashDigests`, never constructing hasher types directly.
  - [x] **No `src-tauri/capabilities/default.json` change needed** — not a plugin-provided command, same precedent as every existing custom `#[tauri::command]` in this project.

- [x] **Task 3: Tool Registry entry (AC: 1, 2, 3 — AD-5)**
  - [x] `src/stores/registry.ts`: add a new entry to `TOOLS` (insert after the existing `uuid` entry):
    ```ts
    {
      id: "hash",
      name: "Hash",
      aliases: ["hash", "checksum", "sha256", "md5", "digest"],
      route: "/tools/hash",
      icon: "#",
      component: () => import("../tools/hash/HashView.vue"),
    },
    ```
    No `drop` field — this story is text-only (Story 2.5 adds file hashing and its drop handler on top of this same `umbra-core::hash::compute`-adjacent logic). This is the **only** registry change needed — sidebar, ⌘K palette, and route table all regenerate from this one entry; do not hand-edit `src/router/index.ts`, `src/shell/AppSidebar.vue`, or `src/App.vue`.

- [x] **Task 4: `HashView.vue` — the UI (AC: 1, 2, 3)**
  - [x] **New file `src/tools/hash/HashView.vue`** and **`src/tools/hash/hashDigests.ts`** (TS mirror of the Rust struct, same convention as `uuidVersion.ts`/`jsonIndent.ts`):
    ```ts
    // Mirrors `HashDigests` in crates/umbra-core/src/hash.rs — keep in sync by hand.
    export interface HashDigests {
      sha256: string;
      sha512: string;
      md5: string;
      sha1: string;
    }
    ```
  - [x] State: `input = ref("")`, `digests = ref<HashDigests | null>(null)`, `caseMode = ref<"lower" | "upper">("lower")`, `error = ref<ToolError | null>(null)`. Use `createLatestWinsRunner()` (`src/shell/invoke.ts`) exactly as `Base64View.vue`/`UuidView.vue` do around the `hash_compute` call — clear `error.value` first, on success (not superseded) set `digests.value`, on failure clear `digests.value` and set `error.value = toToolError(err)` (the established "a failed transform must never leave a stale success sitting next to the new error" rule).
  - [x] **Uppercase/lowercase toggle is a pure view-side re-render — it must never call `invoke` again.** This is the one place a developer following `UuidView.vue`'s pattern (where switching `version` *does* need a new server call) could over-apply that precedent. `hash_compute` always returns lowercase hex; a computed property (or inline `.toUpperCase()`) derives the displayed strings from `digests.value` and `caseMode.value` without touching the network/IPC boundary at all — this is exactly what AD-1 means by "case toggles for display... view-owned." Use a `<fieldset>`/radio pair for the toggle, same accessible markup as `UuidView.vue`'s version selector (each `<input>` in its own `<label>`).
  - [x] **Do not copy `Base64View.vue`'s `errorLocation` computed property (`LineCol`/`ByteOffset` branches) into this view.** `hash.rs::compute` only ever returns `position: None` (its one error, `hash-input-too-large`, has no meaningful location) — Story 2.3 copied that dead code into `UuidView.vue` for the same reason and it was flagged as a review finding; don't repeat it here. Just render `error.message` directly.
  - [x] Four result rows (SHA-256, SHA-512, MD5, SHA-1, in that display order — matches the ACs' enumeration order), each with its own "Copy" button via `writeClipboardText` (`src/shell/clipboard.ts`), same per-row-copy shape as `UuidView.vue`'s result list. **Visibly label the MD5 and SHA-1 rows "(legacy)"** (AC1) — e.g. in the row's `<label>`/heading text, not just a tooltip, since NFR5 requires labels to be screen-reader visible, not decorative-only.
  - [x] **No bcrypt/argon2 UI element anywhere in this view** (AC3) — this is a scope boundary, not an oversight to fix later; don't add a "password hashing" mode or options for one.
  - [x] Paste-from-clipboard button wired to `input.value` via `readClipboardText()` (`src/shell/clipboard.ts`), same shape as `Base64View.vue`'s `onPaste` — FR4 applies here (this tool has a real text input, unlike Story 2.3's UUID tool which had none). Clear `digests.value`/`error.value` on paste, same staleness rule as `Base64View.vue`.
  - [x] Explicit "Compute" button triggers `hash_compute` (matches this codebase's established click-to-transform pattern — `Base64View.vue`'s Encode/Decode, `UuidView.vue`'s Generate — never compute-on-every-keystroke, which would spam `invoke` calls per character).

- [x] **Task 5: Tests**
  - [x] `crates/umbra-core/src/hash.rs`: unit tests for `compute()` — **source exact expected digest strings from the `sha2`/`sha1`/`md-5` crates' own published test vectors (their READMEs/test suites use standard NIST vectors), not from memory** to avoid a hardcoded-but-wrong fixture; assert each output is lowercase hex of the correct length (SHA-256: 64 chars, SHA-512: 128, MD5: 32, SHA-1: 40); assert `compute("")` and `compute("abc")` (or another crate-verified fixture) produce the documented digests for all four algorithms simultaneously from one call; `compute()` on input over `MAX_INPUT_BYTES` returns `hash-input-too-large`; boundary at exactly `MAX_INPUT_BYTES` succeeds.
  - [x] `src-tauri/src/commands/hash.rs`: `#[tokio::test]` command tests mirroring `commands/uuid.rs`'s style — call `hash_compute("abc".to_string()).await.unwrap()` directly and assert the returned `HashDigests` fields against the same crate-verified fixture used in the core tests; one test for the oversized-input rejection through the command layer.
  - [x] `src/tools/hash/HashView.spec.ts` (new, mirroring `UuidView.spec.ts`'s `vi.mock` conventions for `@tauri-apps/api/core` and `@tauri-apps/plugin-clipboard-manager`): computing digests renders all four rows with the mocked response values; MD5 and SHA-1 rows show a "legacy" label; toggling uppercase/lowercase re-renders the same digests in the new case **without a second call to the mocked `invoke`** (this is the test that actually proves the view-owned-formatting requirement above, not just that the UI looks right); a rejected `hash-input-too-large` error renders via the existing `role="alert"` pattern; per-row Copy calls the mocked `writeText` with that row's currently-displayed (case-respecting) string; paste-from-clipboard populates the input and clears a prior result.

- [x] **Task 6: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`, `vue-tsc --noEmit`.

- [ ] **Task 7: Manual verification (deferred to the user)**
  - [ ] `pnpm tauri dev`, per this project's established precedent (Stories 1.10, 2.1, 2.2, 2.3 — the dev agent cannot visually drive a native Tauri window): paste text and compute; confirm all four digests display simultaneously with MD5/SHA-1 visibly marked legacy; toggle uppercase/lowercase and confirm all four re-render instantly (no network/loading flicker, since no `invoke` call happens); copy a couple of individual digests and confirm clipboard content; confirm the tool appears in the sidebar and is reachable via ⌘K under "hash"/"checksum"/"sha256"/"md5".

- [ ] **Task 8: Commit and open a PR**
  - [ ] Branch: `feat/story-2-4-<slug>` (e.g. `feat/story-2-4-hash-text`).
  - [ ] Conventional Commit(s), `feat` type scoped to `hash`.
  - [ ] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2 (functional core):** `compute()` is a pure function in `crates/umbra-core/src/hash.rs` — zero I/O, zero Tauri dependency, no `#[cfg(target_os)]` branches. The uppercase/lowercase case toggle is explicitly view-owned per AD-1 ("presentation formatting... case toggles for display... never computed in core") — see Task 4's warning about not re-invoking `hash_compute` on toggle. `sha2`/`sha1`/`md_5`'s required features are all platform-neutral, so this story introduces no cross-platform risk (AD-11). [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (ToolError contract):** two new tool-scoped kebab-case codes — `hash-input-too-large` (the only real business-rule error) and `hash-internal` (background-task-join fallback, matching every other command's `<tool>-internal` pattern) — both with `position: None` (no error this module produces has a meaningful location). [Source: `ARCHITECTURE-SPINE.md` AD-3]
- **AD-4 (heavy work off the main thread):** unlike `uuid_generate`'s `spawn_blocking` (a consistency choice on trivially fast work), this command's `spawn_blocking` is load-bearing — hashing up to 100 MB with four algorithms can genuinely exceed the ~100 ms bar. [Source: `ARCHITECTURE-SPINE.md` AD-4]
- **AD-5 (one Tool Registry):** exactly one new entry in `src/stores/registry.ts`; nothing else enumerates tools. [Source: `ARCHITECTURE-SPINE.md` AD-5]
- **AD-6 (tools are islands):** this tool reads no other tool's state; no new cross-cutting signal needed (no drop handling in this story, unlike Story 2.2/2.5). [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **AD-11 (cross-platform CI):** `sha2`/`sha1`/`md_5` have no platform-specific code paths — no special CI attention expected beyond the existing gate passing. [Source: `ARCHITECTURE-SPINE.md` AD-11]

### Library/Framework requirements

- **`sha2` / `sha1` / `md-5` (Rust crates), verified this session directly against the crates.io registry API** (not a search-engine snippet, per this project's established stack-verification convention): all three currently at stable **0.11.0** (released in lockstep as part of the RustCrypto hashes workspace), license `MIT OR Apache-2.0` (permissive, no license review needed).
- **API shape, verified via Context7 (`/rustcrypto/hashes`) this session:** all three share the RustCrypto `digest::Digest` trait's one-shot API — `Sha256::digest(bytes)`, `Sha512::digest(bytes)`, `Md5::digest(bytes)`, `Sha1::digest(bytes)`, each returning a fixed-size byte array-like type. One `use sha2::Digest;` (or any one of the three crates' re-export) brings the trait into scope for all four types — they share the identical trait item, so no separate import is needed per crate.
- **Naming gotcha (the one piece of latest-tech information that actually matters for this story):** the MD5 crate's registry/package name is `md-5`, its documented Cargo.toml dependency key is `md_5`, and its **import namespace in Rust code is `md5`** (`use md5::{Md5, Digest};`). This three-way name mismatch (`md-5` on crates.io, `md_5` in `Cargo.toml`, `md5` in `use` statements) is exactly the kind of thing a dev agent without live documentation access would plausibly get wrong — see Task 1.
- **No JS-side dependency changes.** Hashing is entirely server-side (Rust); the frontend only calls `invoke` once and renders/case-transforms strings client-side — no new npm package needed.

### File Structure Requirements

- **New:** `crates/umbra-core/src/hash.rs` (+inline unit tests), `src-tauri/src/commands/hash.rs` (+inline unit tests), `src/tools/hash/HashView.vue`, `src/tools/hash/HashView.spec.ts`, `src/tools/hash/hashDigests.ts`.
- **Modified:** `crates/umbra-core/Cargo.toml` (+3 dependencies: `sha2`, `sha1`, `md_5`), `crates/umbra-core/src/lib.rs` (+`pub mod hash;`, insert alphabetically: `base64`, `error`, `hash`, `json`, `uuid`), `src-tauri/src/commands/mod.rs` (+`pub mod hash;`, insert alphabetically: `base64`, `hash`, `json`, `uuid`), `src-tauri/src/lib.rs` (+import, +`generate_handler!` entry), `src/stores/registry.ts` (+one new entry), `Cargo.lock`, `pnpm-lock.yaml` (lockfile churn from the three new Rust dependencies — no manual edits, regenerated by tooling).
- **Expected ripple (same pattern as Story 2.3's registry-count bump):** `src/router/index.spec.ts` and `src/shell/CommandPalette.spec.ts` likely hard-code the current tool count/order (3 tools after Story 2.3) and will need updating to 4 — this is AD-5's single-registry design working as intended, not a scope deviation.
- **Not touched:** `src-tauri/Cargo.toml` (no direct dependency needed — see Task 2), `src-tauri/capabilities/default.json` (no plugin, no capability entry needed), `src/router/index.ts`, `src/shell/AppSidebar.vue`, `src/App.vue` (all generated from/unaffected by the single registry entry), `src/shell/dropZone.ts`, `src/shell/DropZone.vue` (this story has no drop behavior — Story 2.5 adds it), any Base64/JSON/UUID tool file.
- Story 2.5 (Hash files) is the very next story and will extend `umbra-core::hash` with file-byte hashing plus a drop handler — keep `compute(input: &str)`'s signature and `HashDigests` shape reusable for a future `compute_bytes(&[u8])` split (mirroring how `base64.rs` factors `encode`/`encode_bytes`), but do not build that split now — YAGNI until 2.5 actually needs it.

### Testing Requirements

- Rust: `cargo test --workspace` covering the new `hash.rs` core tests (fixture-based digest correctness for all four algorithms from one `compute()` call, output length/lowercase assertions, size-cap boundary tests) and new `commands/hash.rs` tests. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings` — no `unwrap`/`expect` in command paths, unchanged convention.
- TypeScript: `pnpm test` covering the new `HashView.spec.ts`, using the same `vi.mock` module-factory convention as `UuidView.spec.ts`/`Base64View.spec.ts` for `@tauri-apps/api/core` and `@tauri-apps/plugin-clipboard-manager` — do not mock this project's own `invoke.ts`/`toolError.ts`/`clipboard.ts`, only platform packages. The case-toggle test asserting **no second `invoke` call** is the most important test in this story — it's the one that actually proves AD-1 compliance rather than just visual correctness.
- `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all pass locally before the PR.
- Manual: `pnpm tauri dev`, per Task 7 — deferred to the user, same precedent as every story since 1.7.

### Previous Story Intelligence

- **From Story 2.3 (immediate predecessor in Epic 2):** two mistakes made there and fixed only in code review are worth avoiding up front this time: (1) `UuidView.vue` copied `Base64View.vue`'s `errorLocation` computed property wholesale even though `uuid.rs` never returns a `Position` — pure dead code, flagged in review. `hash.rs` has the same "always `position: None`" shape, so `HashView.vue` must not copy that computed property either (see Task 4). (2) A version-switch race let a stale in-flight response repopulate `results` after the user had already changed the selector; this story has no equivalent server-round-trip-per-selector-change (the case toggle is deliberately client-only, precisely to avoid needing that same latest-wins-vs-selector-change guard), but if `input` editing while a `hash_compute` call is in flight becomes a concern, `runLatestWins` already covers stale *response* ordering — no new mechanism needed.
- **Confirms the `spawn_blocking`-for-every-command convention** is a *consistency* choice for most commands (established in Story 2.2, reconfirmed in Story 2.3) but is a genuine *correctness* requirement here given the 100 MB input ceiling — see Architecture compliance above.
- **Cross-epic:** this is the second story to add Rust dependencies to `crates/umbra-core/Cargo.toml` since the original scaffold (Story 2.3 added `uuid`) — confirm `Cargo.lock` picks up `sha2`/`sha1`/`md_5` and any transitive deps cleanly across all three CI runners; none of the three has any platform-gated feature, so no special risk expected.

### Git Intelligence

- `main`'s tip at story-creation time is `610aa97` (this story's `baseline_commit`), the code-review-fix commit for Story 2.3 (`fix(uuid): resolve code review findings for Story 2.3`). Everything since Story 2.2's merge (`ac054ca`) is Story 2.3's own work (`76ea757` feat, `5bd3650` docs, `610aa97` fix) — no other story or infrastructure change has landed in between, so this story starts from exactly the state Story 2.3's Dev Notes/File List describe, with no drift to account for.
- No commit since `ac054ca` has touched `crates/umbra-core/Cargo.toml`'s dependency list except Story 2.3's own `uuid` addition — this story is the second to add new core dependencies since the original three (`serde`, `serde_json`, `base64`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.4: Hash text; FR14, AD-1; Epic 2 summary]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — FR14 (SHA-256/512 + legacy MD5/SHA-1, hex case toggle, bcrypt/argon2 explicitly excluded), NFR4 (no crash on bad/huge input)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1 (functional core, view-owned formatting), AD-2 (core dependency-clean), AD-3 (ToolError), AD-4 (async/off-main-thread), AD-5 (registry), AD-6 (islands), AD-11 (CI cross-platform), Stack table, Consistency Conventions table]
- Live-verified this session via a read-only pass over: `src/stores/registry.ts`, `crates/umbra-core/src/{lib,base64,error,uuid}.rs`, `crates/umbra-core/Cargo.toml`, `src-tauri/src/{lib,commands/mod,commands/base64,commands/uuid}.rs`, `src-tauri/Cargo.toml`, `src/shell/{invoke,clipboard,toolError}.ts`, `src/tools/base64/Base64View.vue`, `src/tools/uuid/UuidView.vue` — confirmed no hash-related code exists anywhere yet (genuinely greenfield tool), and confirmed the exact per-tool-owns-its-constant / `spawn_blocking`-for-every-command / registry-single-entry precedents this story reuses.
- crates.io registry API (verified this session, direct query per this project's convention): `sha2` 0.11.0, `sha1` 0.11.0, `md-5` 0.11.0 — all `MIT OR Apache-2.0` (permissive, no license review needed).
- Context7 (`/rustcrypto/hashes`, verified this session): `Digest` trait one-shot API (`Sha256::digest(bytes)` etc.), the shared-`Digest`-import-across-crates behavior, and the `md-5` package-name-vs-`md_5`-Cargo-key-vs-`md5`-import-namespace naming quirk.

## Change Log

- 2026-07-31: Story drafted via `bmad-create-story`, following Story 2.3's completion. Exhaustive-analysis pass included a live read-only sweep of the current registry/core/command-layer state (confirming no hash-related code exists yet), a crates.io registry query confirming `sha2`/`sha1`/`md-5` are all at stable 0.11.0, and Context7 verification of the RustCrypto `Digest` trait API — surfacing a three-way package/Cargo-key/import-namespace naming mismatch for the MD5 crate that directly affects Task 1's dependency declaration. Story 2.3's code-review findings (dead `errorLocation` branches, view-owned-formatting discipline) were folded in as explicit anti-pattern warnings for this story's UI task.
- 2026-07-31: Implemented via `bmad-dev-story` (Claude Sonnet 5). Tasks 1-6 completed: `umbra-core::hash::compute()`, the `hash_compute` Tauri command, the Tool Registry entry, `HashView.vue`, full Rust/TypeScript test coverage, and a full verification pass (fmt/clippy/lint/build/type-check), all green. Corrected Task 1's drafted `md_5 = "0.11"` dependency-key guidance to `md-5 = "0.11"` after it failed to compile — the doc snippet it was based on was imprecise about Cargo's actual key-resolution behavior; the corrected form was verified by a clean `cargo build`. Fixed the anticipated ripple in `router/index.spec.ts` and `CommandPalette.spec.ts` (registry tool count 3→4). Task 7 (manual `pnpm tauri dev` check) deferred to the user per established precedent.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `cargo build` initially failed with a bare `md_5 = "0.11"` dependency key ("no matching package found: md_5"), contradicting this story's own Task 1 guidance (drafted from Context7 docs, not verified by compiling). `cargo add md-5@0.11` confirmed the correct bare key is `md-5` (dash, matching the registry name); the `md-5` crate's own `[lib] name = "md5"` is what makes `use md5::{Md5, Digest};` the correct import, not a dash/underscore key convention. Fixed and verified by a clean `cargo build`; see the corrected note in Task 1.
- `origin/main` had advanced past this branch's prior base (Story 2.3's PR #27 squash-merged as `2febdc0`, vs. this repo's local `feat/story-2-3-uuid-generator` tip `610aa97`) — created `feat/story-2-4-hash-text` from updated `origin/main` rather than continuing on the old branch, carrying over the uncommitted sprint-status.yaml/story-file changes from story creation (verified identical base content first).
- Ripple confirmed and fixed as anticipated in Dev Notes: `src/router/index.spec.ts` (registry tool count 3→4) and `src/shell/CommandPalette.spec.ts` (ArrowUp-wrap assertion expected "UUID", now the last registry entry is "Hash").

### Completion Notes List

- Implemented `umbra-core::hash::compute()` — SHA-256/SHA-512/MD5/SHA-1 computed simultaneously from one call, lowercase hex output only (case is view-owned per AD-1), single `hash-input-too-large` error code at the same 100 MB cap convention as `base64.rs`/`json.rs`.
- Implemented Tauri command `hash_compute`, `spawn_blocking`-wrapped as a genuine correctness requirement (not just consistency) given the 100 MB input ceiling across four algorithms.
- Added one Tool Registry entry (`src/stores/registry.ts`) — sidebar, ⌘K palette, and router all regenerate from it.
- Implemented `HashView.vue`: paste/compute/four labeled result rows (MD5 and SHA-1 marked "(legacy)")/per-row copy/lowercase-uppercase toggle. The case toggle is a pure computed re-render with no second `invoke` call — verified by an explicit test asserting `invokeMock` is called exactly once across a toggle round-trip. Deliberately did not copy `Base64View.vue`'s `errorLocation` computed property, since `hash.rs` never returns a `Position` (Story 2.3's code-review finding, avoided here proactively).
- Full test suite: 56 core + 33 command Rust tests, 139 TypeScript tests (including 6 new `HashView.spec.ts` tests), all passing. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all clean.
- Test vector fixtures (SHA-256/512, MD5, SHA-1 of `""` and `"abc"`) were computed via Python's stdlib `hashlib` this session rather than transcribed from memory, to avoid a hardcoded-but-wrong fixture silently passing.
- Task 7 (manual `pnpm tauri dev` check) deferred to the user, per established precedent since Story 1.7 — the dev agent cannot visually drive a native Tauri window.

### File List

**New:**
- `crates/umbra-core/src/hash.rs`
- `src-tauri/src/commands/hash.rs`
- `src/tools/hash/HashView.vue`
- `src/tools/hash/HashView.spec.ts`
- `src/tools/hash/hashDigests.ts`

**Modified:**
- `crates/umbra-core/Cargo.toml` (+3 dependencies: `sha2`, `sha1`, `md-5`)
- `crates/umbra-core/src/lib.rs` (+`pub mod hash;`)
- `src-tauri/src/commands/mod.rs` (+`pub mod hash;`)
- `src-tauri/src/lib.rs` (+import, +`generate_handler!` entry)
- `src/stores/registry.ts` (+one new entry)
- `src/router/index.spec.ts` (tool count 3→4)
- `src/shell/CommandPalette.spec.ts` (ArrowUp-wrap assertion updated to the new last entry, "Hash")
- `Cargo.lock` (lockfile churn from the three new Rust dependencies)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions)
