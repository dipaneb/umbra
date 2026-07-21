# Reconcile Review: Story 1.1 vs. Reconstructed ARCHITECTURE-SPINE.md

**Reviewer step:** BMad architecture Finalize sequence — "reconcile inputs"
**Sources compared:**
- `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md`
- `_bmad-output/implementation-artifacts/1-1-first-launch-scaffolded-app-opens.md`

## Verdict

Mostly consistent. One clear, verified-same-day contradiction on the `create-tauri-app` version, and one soft gap (Vite/TypeScript major-version shift absent from the spine). Everything else the story cites — `ToolError` shape, Cargo workspace layout, directories, LICENSE, CI job structure, repo-root placement, `oar-ocr` correction — is supported by the spine without contradiction.

## Findings

### 1. `create-tauri-app` version — CONTRADICTION (medium severity)
- Spine Stack table: `create-tauri-app — latest stable at scaffold time (observed 4.6.x 2026-07-20)`.
- Story's Latest Tech Notes (also dated verified 2026-07-20): `current major is 4.7.x, and recent releases moved templates to Vite v8 and TypeScript v6`.
- Both claim a 2026-07-20 web check but disagree on the observed major (4.6.x vs 4.7.x). Since the story is explicitly the more concrete/code-level source and its note is more specific (names the Vite/TS shift), the spine's "4.6.x" figure looks stale relative to it. Recommend the spine owner re-verify and either update the observed-version note or drop the specific number entirely (the "no fixed pin by design" language already makes the exact figure non-binding, so this is a citation-accuracy issue, not a design issue).

### 2. Vite v8 / TypeScript v6 — not reflected in spine (minor, informational)
- The story's Latest Tech Notes flags that recent `create-tauri-app` releases moved templates to Vite v8 and TypeScript v6. The spine's Stack table has no Vite or TypeScript row at all (Vue 3.x is listed, but not its build tool or the language version). This isn't a contradiction — the spine's "no fixed pin by design" policy covers it by omission — but worth a spine footnote so a future reader doesn't wonder whether it was missed vs. deliberately deferred.

### 3. `ToolError` struct shape — MATCH
Story Task 3's `ToolError { code, message, position: Option<LineCol|ByteOffset>, context }` and its stated invariant (single error type, all commands return `Result<T, ToolError>`) line up exactly with spine AD-3's definition, field-for-field.

### 4. Cargo workspace layout / directories — MATCH
Story Task 2 (root `Cargo.toml` workspace listing `[src-tauri, crates/umbra-core]`) and the story's trimmed "Project Structure Notes" tree are a strict subset of the spine's Structural Seed, with no path or naming conflicts (`crates/umbra-core/src/error.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `LICENSE` all present in both).

### 5. LICENSE, CI job structure, repo-root placement — MATCH
- LICENSE: story AC8 ("All Rights Reserved license file present") matches spine's `LICENSE # All Rights Reserved (NFR7)` seed entry and the Consistency Conventions' dependency-hygiene/licensing row.
- CI: story Task 4's three-runner split (ubuntu+windows: `cargo check`+clippy `-D warnings`; ubuntu also: fmt check, `cargo test --workspace`, pnpm install/lint/test) is a strict elaboration of spine AD-11 ("cargo check + clippy run on ubuntu-latest and windows-latest as required status checks") and the Testing convention row — no conflict, just more implementation detail than the compressed spine carries.
- Repo root: story Dev Notes ("`_bmad/`, `_bmad-output/`, `docs/` already live here... not a nested subdirectory") agrees exactly with the spine's Structural Seed, which lists `_bmad/, _bmad-output/, docs/` at the top level of `<repo-root>/` alongside `src/`, `src-tauri/`, `crates/`.

### 6. `oar-ocr` version correction — MATCH (already incorporated)
Story's Latest Tech Notes: actual latest is 0.2.2, not 0.8.x. Spine Stack table already reflects this: `oar-ocr ... 0.2.x — corrected 2026-07-20; original spine cited 0.8.x, a version that never existed for this crate.` No gap.

### Not checked (out of scope per instructions)
`croner` version and pnpm/Node version claims were also checked incidentally: pnpm 11.x / Node 22+ matches spine's Stack table exactly. `croner` isn't mentioned in the story's Latest Tech Notes so there's nothing to reconcile there.
