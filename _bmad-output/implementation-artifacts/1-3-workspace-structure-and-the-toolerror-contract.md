---
baseline_commit: db19f4bc
---

# Story 1.3: Workspace structure and the `ToolError` contract

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer,
I want the scaffold restructured into the architecture spine's workspace with the shared error type defined,
so that tool logic stays pure and every command speaks one error language.

## Acceptance Criteria

1. **Given** the repository layout, **when** inspected, **then** it matches the spine's Structural Seed — `crates/umbra-core` (pure-logic workspace crate), `src-tauri` (command shell), `src/` (Vue views).
2. **Given** `umbra-core`, **when** its manifest and sources are reviewed, **then** it imports no Tauri crate and contains no `#[cfg(target_os)]` branches (AD-2).
3. **Given** the shared error type, **when** `umbra-core` is built, **then** it defines `ToolError { code, message, position, context }` — `code` a stable kebab-case enum, `position` an optional line/column or byte offset — with at least one unit test proving its serialization (AD-3).

## Tasks / Subtasks

- [x] Task 1: Convert the repo into a Cargo workspace matching the spine's Structural Seed (AC: 1)
  - [x] Confirm the working tree is clean (`git status`) before starting, per `CLAUDE.md`'s standing rule
  - [x] Create a root-level `Cargo.toml` as a **virtual workspace manifest** (no `[package]` section): `[workspace]` with `members = ["src-tauri", "crates/umbra-core"]` and `resolver = "3"` — see Dev Notes' "Workspace resolver — do not skip this" for why the resolver must be set explicitly
  - [x] Do not restructure `src-tauri/Cargo.toml`'s existing `[package]` section (`edition = "2024"`, `rust-version = "1.85"`) — becoming a workspace member requires no changes there
  - [x] Delete `src-tauri/Cargo.lock` — the workspace now owns one lockfile at the repo root, regenerated there on the next build
  - [x] Run `cargo check --workspace` from the repo root and confirm it succeeds before moving on
- [x] Task 2: Scaffold `crates/umbra-core` as a pure-logic library crate (AC: 1, 2)
  - [x] `cargo new --lib crates/umbra-core --name umbra-core`
  - [x] Set `edition = "2024"` in its `[package]` to match `src-tauri` and the spine's Stack pin (`cargo new` defaults to a lower edition)
  - [x] Add `serde = { version = "1", features = ["derive"] }` as a normal dependency (needed for `#[derive(Serialize, Deserialize)]`); add `serde_json = "1"` as a **dev-dependency only** — the crate's own logic never needs to call `serde_json` directly (Tauri's IPC layer does that downstream), only this story's serialization test does
  - [x] Confirm `crates/umbra-core/Cargo.toml` has no `tauri`/`tauri-*` dependency anywhere (AD-2)
- [x] Task 3: Define the `ToolError` contract in `crates/umbra-core/src/error.rs` (AC: 3)
  - [x] Define `ToolError { code: String, message: String, position: Option<Position>, context: Option<String> }` — `code` stays a plain `String` at the Rust type level (a stable kebab-case *value* convention, not a Rust enum type — matches both `ARCHITECTURE-SPINE.md` and `ARCHITECTURE.md`'s code snippets exactly). Do not invent a `ToolErrorCode` enum or placeholder code values — no tool exists yet to assign real ones (that starts at Story 1.7)
  - [x] Define `Position` as an internally-tagged enum: `#[serde(tag = "kind")] enum Position { LineCol { line: u32, column: u32 }, ByteOffset { offset: u64 } }` — **read the callout below before implementing `ByteOffset`**
  - [x] Derive `Debug, Clone, Serialize, Deserialize` on both `ToolError` and `Position`
  - [x] Re-export both from `crates/umbra-core/src/lib.rs` (`pub mod error; pub use error::{Position, ToolError};`)
  - [x] **`ByteOffset` must be a struct variant, not the tuple variant shown in the docs — read this first:** both `ARCHITECTURE-SPINE.md` and `ARCHITECTURE.md` literally write `ByteOffset(u64)` as a tuple variant. Under serde's internally-tagged representation (`#[serde(tag = "kind")]`), a newtype variant wrapping a bare primitive (`u64`) **fails at runtime** — serde can only merge the `kind` tag into content that serializes as a map/struct, and a raw number isn't one (a well-known, pre-existing serde limitation, not a typo to "fix" quietly). Implement `ByteOffset { offset: u64 }` instead — same wire shape the architecture intends (`{"kind": "ByteOffset", "offset": ...}`), and it actually compiles/serializes. Record this in Completion Notes as a deliberate, documented deviation from the docs' literal Rust syntax (same class as Story 1.2's deferred edition/MSRV note) — do not silently match the docs' tuple syntax and leave it broken.
- [x] Task 4: Prove the serialization contract with unit tests (AC: 3)
  - [x] Add `#[cfg(test)] mod tests` in `error.rs` with a test that serializes a `ToolError` carrying `Position::LineCol { line, column }` via `serde_json::to_value(...)` and asserts the exact JSON shape, including the `"kind": "LineCol"` tag
  - [x] Add a second test doing the same for `Position::ByteOffset { offset }` — this is the test that would catch a regression back to the broken tuple-variant form from Task 3; keep both
  - [x] Add a third test for `position: None, context: None` confirming both `Option` fields serialize as explicit `null` (default serde behavior — do not add `#[serde(skip_serializing_if = "Option::is_none")]`; not required by any AC, and the future Vue error renderer works fine with explicit nulls)
  - [x] Run `cargo test -p umbra-core` and confirm all tests pass
- [x] Task 5: Verify AD-2 compliance and check for workspace-conversion regressions (AC: 2)
  - [x] `grep tauri crates/umbra-core/Cargo.toml` — confirm no match
  - [x] `grep -rn "cfg(target_os" crates/umbra-core/src/` — confirm no match
  - [x] `cargo check --workspace` and `cargo clippy --workspace -- -D warnings` — confirm both are clean (CI doesn't enforce this yet — that's Story 1.4 — so this is a manual audit now, same pattern Story 1.2 used for its AD-7 check)
  - [x] Re-run `pnpm tauri dev` from the repo root and confirm the "Umbra" window still opens — converting `src-tauri` into a workspace member moves Cargo's build output from `src-tauri/target/` to the workspace-root `/target/`, which is exactly the kind of change that can silently break the dev workflow Story 1.2 verified; re-check it, don't assume it still works
  - [x] Record the audit result (what was checked, what was found) in Dev Agent Record, consistent with Story 1.2's AD-7 audit precedent
- [x] Task 6: Commit and open a PR (repo convention from Stories 1.1/1.2 — branch protection requires it)
  - [x] Stage and commit as a Conventional Commit, e.g. `feat(core): add umbra-core workspace crate with ToolError contract`
  - [x] Push via a PR against `main`

### Review Findings

- [x] [Review][Patch] Regenerated root `Cargo.lock` resolves 27 transitive deps to older versions than the deleted `src-tauri/Cargo.lock` (e.g. `zbus` 5.18.0→5.13.2, `icu_*` 2.2.0→2.1.x, `darling` 0.23.0→0.21.3) and drops 3 packages entirely (`bs58`, `tinyvec`, `tinyvec_macros`) [Cargo.lock] — **verified not a defect**: ran `cargo update` (forces a fresh crates.io index fetch) and it changed 0 packages. `src-tauri/Cargo.toml` already pinned `rust-version = "1.85"` before this story; cargo 1.94.0 does MSRV-aware resolution, so these are the correct latest-versions-compatible-with-1.85, not stale-cache drift. No code change made.
- [x] [Review][Patch] `ToolError`/`Position` derive `Deserialize` but it's untested and has a live gap: JSON omitting `position`/`context` keys (vs. sending explicit `null`) fails to deserialize because the `Option` fields lack `#[serde(default)]` [crates/umbra-core/src/error.rs:5-10] — fixed: added `#[serde(default)]` to both fields.
- [x] [Review][Patch] `crates/umbra-core/Cargo.toml` declares no `rust-version`, while `src-tauri/Cargo.toml` pins `rust-version = "1.85"` — asymmetric MSRV across workspace members (editions already match at 2024) [crates/umbra-core/Cargo.toml] — fixed: added `rust-version = "1.85"`.
- [x] [Review][Patch] No rustdoc on `ToolError`/`Position` or their fields — no explanation of `code`'s kebab-case convention, `context`'s purpose, or when `position: None` applies vs. `LineCol`/`ByteOffset`, despite this being the wire contract every future tool builds against [crates/umbra-core/src/error.rs] — fixed: added `///` doc comments to both types and all fields.
- [x] [Review][Patch] Neither `ToolError` nor `Position` derives `PartialEq`, though every field is trivially comparable — forces tests/callers to round-trip through JSON to assert equality [crates/umbra-core/src/error.rs:3-16] — fixed: added `PartialEq` to both derives.
- [x] [Review][Patch] `crates/umbra-core/Cargo.toml` has no `publish = false` — an internal workspace-only crate is one accidental `cargo publish --workspace` away from being pushed, currently prevented only incidentally by missing metadata [crates/umbra-core/Cargo.toml] — fixed: added `publish = false`.
- [x] [Review][Patch] `crates/umbra-core/.gitignore` (`/target`) is redundant — the root `.gitignore` already covers `/target/` and `**/target/` [crates/umbra-core/.gitignore] — fixed: file deleted.
- [x] [Review][Defer] `resolver = "3"` has no accompanying `rust-toolchain.toml` pin, so an older cargo/rustc would fail to parse the manifest [Cargo.toml] — deferred, pre-existing project-wide toolchain-reproducibility gap, not introduced by this story

Post-patch verification: `cargo check --workspace`, `cargo test -p umbra-core` (3/3 pass), and `cargo clippy --workspace -- -D warnings` all clean.

## Dev Notes

### Workspace resolver — do not skip this

The new root `Cargo.toml` is a **virtual manifest** (a `[workspace]` table with no `[package]` section). Cargo normally infers the feature resolver version (`"1"` legacy vs. `"2"`/`"3"` per-target) from the *root package's* edition — but a virtual manifest has no root package to infer from, so it silently falls back to the legacy resolver `"1"` unless `resolver` is set explicitly in `[workspace]`. Both workspace members (`src-tauri`, `umbra-core`) use `edition = "2024"`, which pairs with resolver `"3"` (edition 2021 → `"2"`, edition 2024 → `"3"`) — set `resolver = "3"` explicitly in the new root `Cargo.toml` or feature unification across the workspace will silently use outdated behavior. [Source: Cargo reference on virtual manifests and edition-to-resolver mapping]

### Architecture compliance for this story

- **AD-1/AD-2 (this story's core deliverable):** `crates/umbra-core` must be dependency-clean — no `tauri`/`tauri-*` crate, no `#[cfg(target_os)]` branch anywhere. This is the crate every future tool's pure logic lands in (`json.rs`, `base64.rs`, `hash.rs`, `jwt.rs`, `uuid.rs`, `cron.rs`, `ocr.rs`, `pdf.rs`, `image.rs` per the spine's Structural Seed) — get the foundation right now, since AD-2 gets CI-enforced starting Story 1.4, not before. [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (the other core deliverable):** the `ToolError`/`Position` shapes are the exact wire contract every future command (`json_format`, `base64_encode`, etc.) will return as `Result<T, ToolError>`. Whatever field names and JSON shape this story ships are what Stories 1.7+ (JSON line/col errors), 2.1 (Base64 byte-offset errors), and 2.6 (JWT segment errors) build against — get this right once, since changing it later means touching every tool. [Source: `ARCHITECTURE-SPINE.md` AD-3; `epics.md` Story 2.1's "with byte offset where applicable, per AD-3's position rules"]
- **No command changes in this story.** The existing placeholder `greet` command in `src-tauri/src/lib.rs` returns a plain `String`, not `Result<T, ToolError>` — that's fine and out of scope here; no real tool command exists yet to wire up to `ToolError`. This story only establishes the crate and the type; wiring `ToolError` into an actual command starts at Story 1.7 (`json_format`/`json_minify`). Do not add speculative helper constructors, `Display`/`std::error::Error` impls, or a `ToolErrorCode` enum beyond what the three ACs require — that's scope creep this story doesn't need.
- **This is the first story to add a root-level `Cargo.toml`.** Nothing at the repo root currently defines a Rust workspace (verified: no `Cargo.toml` exists above `src-tauri/`) — Story 1.2 deliberately scoped the spine's workspace restructure out ("Story 1.3's job, not this one" per its own Dev Notes).

### Project Structure Notes

- Target end state: repo root gains `Cargo.toml` (workspace, virtual manifest) and `crates/umbra-core/` (`Cargo.toml`, `src/lib.rs`, `src/error.rs`). `src-tauri/` keeps its existing content unchanged except losing `Cargo.lock` (superseded by the workspace-root lockfile). `src/` (Vue) is untouched by this story — it already satisfies the spine's third Structural Seed component and needs no change for these ACs.
- Do not create `crates/umbra-core/src/json.rs`, `base64.rs`, `hash.rs`, `jwt.rs`, `cron.rs`, `ocr.rs`, `pdf.rs`, `image.rs`, or `uuid.rs` yet — the spine's Structural Seed lists these as the crate's eventual shape across Epics 1–6, not this story's scope. This story delivers only `error.rs` plus `lib.rs`'s re-export. [Source: `ARCHITECTURE-SPINE.md` — Structural Seed]
- Current repo root before this story (verified): `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `src/`, `src-tauri/`, plus the pre-existing `LICENSE`, `README.md`, `CLAUDE.md`, `.github/`, `_bmad/`, `_bmad-output/`, `.claude/`. No root `Cargo.toml` exists yet. `src-tauri/Cargo.toml` currently declares its own standalone `[package]` (name `umbra`, edition 2024, rust-version 1.85) with deps `tauri`, `tauri-plugin-opener`, `serde`, `serde_json`, and build-dep `tauri-build` — none of this needs to change other than the file becoming a workspace member.
- `pnpm-workspace.yaml` (the JS/pnpm workspace config) is unrelated to this story — do not touch it. This story's "workspace" is the Cargo/Rust one only.

### Previous Story Intelligence (from Story 1.2)

- **Root cause of the original data-loss incident (recap, still binding):** an unforced `create-tauri-app --force` run against a non-empty repo root previously destroyed the entire planning corpus. This story doesn't run any scaffolding CLI, so that specific risk doesn't apply directly — but `CLAUDE.md`'s standing rule (commit-before-uncertain-destructive-command) still governs: confirm `git status` is clean before starting, per Task 1.
- **Manual-audit pattern established:** Story 1.2 handled AD-7 verification (no automated CI gate existed yet) via a manual dependency/capability audit, documented findings directly in Dev Agent Record, and flagged scope explicitly (what was and wasn't checked). This story's AD-2 verification (Task 5) follows the same pattern, since Story 1.4's CI enforcement doesn't exist yet.
- **Code review caught things the dev pass missed** (webview CSP, a stray `index.html` title, missing MSRV) — several were structural/config details easy to overlook after a file-copy-heavy story. This story's risk profile is different (a Cargo workspace conversion, not a file merge) but the lesson generalizes: re-verify the dev workflow (`pnpm tauri dev`) actually still works after changing `Cargo.toml`/lockfile structure, don't assume it from the diff alone (Task 5's regression check exists for this reason).
- **Pre-existing architecture defect precedent:** Story 1.2 found the spine's `edition = "2024"` paired with "MSRV ≥1.77.2" is internally contradictory (edition 2024 actually needs rustc ≥1.85) and recorded it as a deferred, pre-existing planning-artifact defect rather than silently working around it uncommented. This story's `ByteOffset` tuple-vs-struct-variant issue (Task 3) is the same category of finding — documented as a deviation, not fixed quietly.

### Git Intelligence

- Recent commits (`db19f4b` docs, `7db53b6` feat(scaffold), `b08f76c` merge, `9ab7b27` chore(dependabot), `edf2f18` docs) show the established convention: one feature branch per story, Conventional Commit prefixed by type/scope (`feat(scaffold): ...`), squash-merged via PR. Follow the same shape: `feat(core): add umbra-core workspace crate with ToolError contract`.
- `7db53b6` is the only prior commit that touched `src-tauri/` or added Rust code — its diff is the baseline this story builds on (confirmed via the file inventory above; no other commit since has touched `src-tauri/` or added a `Cargo.toml`).

### Testing Requirements

- `cargo test -p umbra-core` must pass with the three serialization tests from Task 4 (all `ToolError`/`Position` shape combinations: `LineCol`, `ByteOffset`, `None`).
- `cargo check --workspace` and `cargo clippy --workspace -- -D warnings` must both be clean — no CI exists yet to enforce this (Story 1.4), so it's a manual gate for this story, same as Story 1.2's manual AD-7 audit.
- No Vitest/frontend tests apply — this story touches no `src/` (Vue) code.
- Manual regression check: `pnpm tauri dev` must still open a window titled "Umbra" after the workspace conversion (Task 5) — this is not automated (no e2e suite in v1 per NFR6), verify by hand and record the result.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.3: Workspace structure and the `ToolError` contract]
- [Source: `_bmad-output/planning-artifacts/epics.md` — "Additional Requirements" §"Architecture decisions binding story implementation", AD-1, AD-2, AD-3]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1, AD-2, AD-3, Structural Seed, Stack table]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "The `ToolError` contract (AD-3)" code snippet]
- [Source: `_bmad-output/implementation-artifacts/1-2-first-launch-the-scaffolded-app-opens.md` — "AD-2 note (does not yet apply)" scoping this restructure to Story 1.3; current verified repo/dependency state]
- [Source: `CLAUDE.md` — "Safety: git checkpoint before destructive-capable commands"]
- Live-verified 2026-07-23: no root `Cargo.toml` exists; `src-tauri/Cargo.toml` is a standalone package (name `umbra`, edition 2024, rust-version 1.85); `src-tauri/src/lib.rs` contains only the scaffold's placeholder `greet` command.

## Change Log

- 2026-07-23: Story drafted from epics.md Story 1.3, with the Cargo workspace resolver gotcha and the `ByteOffset` internally-tagged-enum serde limitation flagged as critical implementation guidance not present in the source architecture docs.
- 2026-07-23: Tasks 1-5 implemented on branch `feat/story-1-3-workspace-toolerror-contract` — Cargo workspace conversion, `umbra-core` crate, `ToolError`/`Position` contract with 3 passing serialization tests, AD-2 and dev-workflow regression audits all clean. Task 6 (commit/PR) deferred pending explicit user go-ahead; nothing committed yet.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- **Cargo workspace resolver claim, verified via context7 (`/rust-lang/cargo`, Cargo's own docs):** confirmed a virtual workspace manifest has no root package to infer the resolver version from, so `resolver` must be set explicitly — `"3"` pairs with `edition = "2024"` (both workspace members use it). Matches Dev Notes' "Workspace resolver — do not skip this" exactly.
- **Serde internally-tagged enum limitation, verified via context7 (`/websites/serde_rs`, serde's own docs):** confirmed `#[serde(tag = "...")]` internally-tagged representation "works for struct variants, newtype variants containing structs or maps, and unit variants, but not for enums containing tuple variants" — a newtype wrapping a bare `u64` has no struct/map content to merge the tag into, so `ByteOffset(u64)` (the docs' literal tuple-variant syntax) would fail. Confirms Task 3's struct-variant `ByteOffset { offset: u64 }` implementation is required, not optional — and the 3 unit tests in Task 4 (all passing) prove it serializes correctly.
- **Toolchain check:** `cargo 1.94.0` / `rustc 1.94.0` — well above the resolver-3 minimum (1.84+) and edition-2024 minimum (1.85+).
- **`cargo new --lib crates/umbra-core --name umbra-core` already defaulted to `edition = "2024"`** on this Cargo version — Dev Notes' "cargo new defaults to a lower edition" caveat did not apply here; verified the generated manifest directly rather than assuming the caveat held.
- **Task 1's ordering note:** Task 1's last subtask (`cargo check --workspace` succeeds) cannot literally pass until `crates/umbra-core` exists, since the workspace manifest declares it as a member before Task 2 creates it. Ran the check after Task 2 instead (confirmed it fails with a clear "failed to load manifest" error beforehand, as expected) — functionally equivalent, no scope change, just resequenced two adjacent tasks' final checkpoint.
- **Task 5 AD-2/regression audit:** `grep tauri crates/umbra-core/Cargo.toml` → no match. `grep -rn "cfg(target_os" crates/umbra-core/src/` → no match. `cargo check --workspace` → clean. `cargo clippy --workspace -- -D warnings` → clean, no warnings. `pnpm tauri dev` re-run in the background with output redirected to a log file; polled via a single in-process AppleScript `repeat`/`delay` loop against System Events (same method Story 1.2 used) — window "Umbra" detected after 29s (Vite + `cargo build` from the new workspace-root `target/`). Confirmed via `stat` that `target/` (workspace root) was freshly modified by this run while `src-tauri/target/` was stale (last modified during Story 1.2, before this story's changes) — build output correctly moved to the workspace root as expected, no dev-workflow regression. Dev process cleaned up afterward (`pkill`), no leftover `umbra`/`vite` processes.

### Completion Notes List

- All 3 acceptance criteria satisfied. Repo root now has a virtual-workspace `Cargo.toml` (`members = ["src-tauri", "crates/umbra-core"]`, `resolver = "3"`); `crates/umbra-core` is a dependency-clean pure-logic crate (no `tauri`/`tauri-*`, no `#[cfg(target_os)]`) defining the `ToolError`/`Position` wire contract with 3 passing serialization unit tests.
- **One deliberate, documented deviation from the architecture docs' literal Rust syntax (flagged in Task 3, same class as Story 1.2's deferred edition/MSRV note):** `Position::ByteOffset` is implemented as the struct variant `ByteOffset { offset: u64 }` rather than the tuple variant `ByteOffset(u64)` shown verbatim in both `ARCHITECTURE-SPINE.md` and `ARCHITECTURE.md`. Under serde's internally-tagged representation (`#[serde(tag = "kind")]`), a newtype variant wrapping a bare primitive cannot merge the tag into non-map/struct content and fails at runtime — a pre-existing, well-known serde limitation, confirmed against serde's own current docs via context7 (see Debug Log). The wire shape is unchanged from what the architecture intends (`{"kind": "ByteOffset", "offset": ...}`); only the Rust-level variant syntax differs from the docs' snippet.
- `src-tauri/Cargo.toml`'s `[package]` section was left untouched other than becoming a workspace member, as instructed — no edition/rust-version changes needed there.
- No command changes made — the existing placeholder `greet` command in `src-tauri/src/lib.rs` is unmodified, per Dev Notes' explicit "no command changes in this story" scoping. `crates/umbra-core/src/lib.rs`'s scaffold-default `add`/test placeholder was replaced with the story's required re-export only (`pub mod error; pub use error::{Position, ToolError};`), since Dev Notes states this story delivers only `error.rs` plus `lib.rs`'s re-export.
- Task 6 was initially left unchecked and undone per explicit user instruction (commit deferred until the user gave the go-ahead). Code review ran against the uncommitted working tree in the interim and applied 6 patch-severity fixes directly (see Review Findings) plus 1 deferred item recorded in `deferred-work.md`. User confirmed the review and gave the go-ahead to finalize — Task 6 completed: committed on `feat/story-1-3-workspace-toolerror-contract` and pushed via PR (see PR link in final summary).

### File List

- `Cargo.toml` (new — root virtual workspace manifest)
- `Cargo.lock` (new — workspace-root lockfile, generated by `cargo check`/`cargo test`/`cargo clippy`)
- `src-tauri/Cargo.lock` (deleted — superseded by the workspace-root lockfile)
- `crates/umbra-core/Cargo.toml` (new)
- `crates/umbra-core/src/lib.rs` (new — re-exports `Position`, `ToolError`)
- `crates/umbra-core/src/error.rs` (new — `ToolError`/`Position` definitions plus 3 unit tests)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — code review's one deferred finding appended)
