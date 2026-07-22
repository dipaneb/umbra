---
baseline_commit: b08f76c91cdfb45af9711605e53d6552aa0085cd
---

# Story 1.2: First launch — the scaffolded app opens

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer,
I want a Tauri + Vue app scaffolded and launching with a placeholder shell window,
so that there is a real, runnable application to build every tool into.

## Acceptance Criteria

1. **Given** a clean clone of the repo, **when** `pnpm install` then `pnpm tauri dev` is run, **then** a window titled Umbra opens showing a placeholder shell.
2. **Given** a release build, **when** it is launched, **then** it cold-launches in under 2 seconds (NFR2).
3. **Given** the scaffold, **when** inspected, **then** it was generated via `create-tauri-app` — Tauri 2.11.x, Vue 3, Vite, TypeScript `strict`, pnpm (latest stable at scaffold time).
4. **Given** the app's network surface, **when** its manifests and webview capabilities are audited, **then** no dependency whose purpose is network I/O exists in any manifest, and the webview capabilities grant no network scope (AD-7).

## Tasks / Subtasks

- [x] Task 1: Scaffold safely into a throwaway location first — never directly against the repo root (AC: 3)
  - [x] Before running anything, confirm the working tree is clean (`git status`) — it should be, per baseline commit above, but verify
  - [x] `cd` to a scratch directory **outside** the repo (e.g. `mktemp -d`, or `$CLAUDE_JOB_DIR/tmp` if running under an agent job) and run:
    `pnpm dlx create-tauri-app@latest umbra -m pnpm -t vue-ts -y --identifier com.dipaneb.umbra`
  - [x] Do **not** pass `-f`/`--force` and do **not** target the repo root directly as `PROJECTNAME` — see Dev Notes' "Why scratch-scaffold, not in place" for the exact reason this rule exists
  - [x] Confirm the scaffold produced a `umbra/` directory in the scratch location containing `package.json`, `src/`, `src-tauri/`, `index.html`, `vite.config.ts`, `tsconfig.json`, its own `README.md`, `.gitignore`
- [x] Task 2: Merge the scaffold output into the repo root deliberately, file by file (AC: 1, 3)
  - [x] Copy in the generated app files that have no existing counterpart: `package.json`, `pnpm-lock.yaml` (if produced), `src/`, `src-tauri/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vite-env.d.ts` (or equivalent — exact file set depends on the `vue-ts` template's current output; inspect the scratch dir rather than assuming this list is exhaustive)
  - [x] Do **not** copy the scaffold's generated `README.md` over the repo's existing `README.md` (root already has the privacy-promise README from Story 1.1) — discard the scaffold's version after confirming it has no content worth merging (it won't; it's the generic Tauri template README)
  - [x] Diff the scaffold's generated `.gitignore` against the repo's existing one — the repo's `.gitignore` already covers `/target/`, `node_modules/`, `dist/`, `dist-ssr/`, `*.local`; only append entries from the scaffold's version that are genuinely missing, don't overwrite
  - [x] Confirm no other repo-root file was overwritten: `LICENSE`, `CLAUDE.md`, `.github/`, `_bmad/`, `_bmad-output/` must be untouched — `git status` after the copy should show only new files/directories added, nothing modified or deleted
  - [x] Add a top-level `package.json` `"private": true` if not already set by the scaffold (this app is never published to a registry)
- [x] Task 3: Verify the dev and release workflows (AC: 1, 2, 3)
  - [x] Run `pnpm install` at repo root (succeeded — see Debug Log)
  - [x] Run `pnpm tauri dev` — confirmed a window titled "Umbra" opens (verified via macOS System Events: window "Umbra" detected after Vite + `cargo run` debug compile finished)
  - [x] Run a release build (`pnpm tauri build`) and launch the produced app bundle; measured cold-launch time (`open` invocation to window existing, via a single in-process AppleScript poll loop) across 3 runs: 829ms, 447ms, 386ms — consistently well under the 2s budget
  - [x] Confirm window title is exactly "Umbra" in `tauri.conf.json` (scaffold defaulted to lowercase "umbra" for both `productName` and window `title` — corrected both to "Umbra")
- [x] Task 4: Audit the network surface (AC: 4)
  - [x] Inspect `src-tauri/Cargo.toml` and root `package.json`/`pnpm-lock.yaml` (or `Cargo.lock`) — confirm no dependency whose stated purpose is network I/O (HTTP clients, fetch polyfills, analytics SDKs, etc.) was pulled in by the scaffold; the default Tauri 2 scaffold should not include any, but verify rather than assume
  - [x] Inspect `src-tauri/capabilities/*.json` (or `tauri.conf.json`'s inlined capabilities, depending on scaffold layout) — confirm no capability grants any network permission/scope; the default scaffold capability set should be limited to window/core permissions only
  - [x] Record the audit result in this story's Dev Agent Record (what was checked, what was found) — this is the first of many AD-7 audits; future stories that add real network-adjacent plugins (`tauri-plugin-updater` in Epic 5) will need to re-run and document this same check
- [ ] Task 5: Commit the scaffold
  - [ ] Stage and commit as a single Conventional Commit, e.g. `feat(scaffold): add Tauri + Vue app scaffold via create-tauri-app`
  - [ ] Push via a PR (branch protection from Story 1.1 requires it — direct push to `main` will be rejected)

### Review Findings

- [x] [Review][Decision] Webview CSP is explicitly `null` (scaffold default), unaudited by Task 4's AD-7 pass — capabilities and CSP are different security boundaries; capabilities gate Tauri-native-API access, CSP gates what arbitrary JS in the webview can `fetch()`/`XHR` directly. **Resolved:** set an explicit CSP now — `default-src 'self'; connect-src ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost data:` — covering today's `invoke()` IPC usage and future local-image loading (OCR/image tools), verified via Tauri's own docs (`connect-src ipc: http://ipc.localhost` is the documented required allowance for `invoke()` to keep working under a CSP). Re-verified both `pnpm tauri dev` and a release rebuild (`pnpm tauri build`) still open a window titled "Umbra" with the new policy in place — no regression. [src-tauri/tauri.conf.json:21]
- [x] [Review][Patch] `index.html`'s `<title>` still reads "Tauri + Vue + Typescript App" — Dev Agent Record claims "corrected both" title fields but this third instance was missed [index.html:7]
- [x] [Review][Patch] `src-tauri/Cargo.toml` has no `rust-version` field despite `edition = "2024"` requiring rustc ≥1.85 — add an explicit MSRV so an old toolchain fails with a clear message instead of a raw compiler error [src-tauri/Cargo.toml:6]
- [x] [Review][Patch] `pnpm-workspace.yaml`'s `allowBuilds: esbuild: true` has no comment explaining why esbuild specifically needs it, for the next person who edits this file [pnpm-workspace.yaml:2]
- [x] [Review][Patch] Debug Log's AD-7 audit narrative doesn't disclose that it covered dependency manifests and capabilities only — not CSP, and not the placeholder `App.vue`'s live external links (vite.dev/tauri.app/vuejs.org) — clarify the audit's actual scope for future readers [_bmad-output/implementation-artifacts/1-2-first-launch-the-scaffolded-app-opens.md:119]
- [x] [Review][Defer] Architecture spine pairs `edition = "2024"` with "MSRV ≥1.77.2" — internally contradictory, since edition 2024 actually requires rustc ≥1.85. Pre-existing planning-artifact defect, not introduced by this story. [`_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md:160`] — deferred, pre-existing
- [x] [Review][Defer] `bundle.targets: "all"` plus the full Windows/Store icon set (`Square*.png`, `StoreLogo.png`) ship even though macOS is the sole near-term target per NFR3 — stock scaffold default, revisit when Story 5.1 sets up the real release pipeline. [src-tauri/tauri.conf.json:26] — deferred, pre-existing
- [x] [Review][Defer] AD-7 audit method checked `Cargo.toml`'s direct deps only; `cargo tree -i reqwest --target all` shows `reqwest`/`hyper` transitively present via `tauri`/`tauri-plugin-opener` (confirmed absent from the actual `aarch64-apple-darwin` build target, so currently benign) — future AD-7 audits (e.g. Epic 5's updater work) should check `cargo tree` scoped to the real build target, not just `Cargo.toml`. [src-tauri/Cargo.lock] — deferred, pre-existing

## Dev Notes

- **This is the first story that writes application code into a non-empty, git-tracked repo root.** Story 1.1 only added `.github/dependabot.yml` and a GitHub API setting; the repo root otherwise contains `LICENSE`, `README.md`, `CLAUDE.md`, `.gitignore`, `.github/`, `_bmad/`, `_bmad-output/`, `.claude/` — all pre-existing and none of them should be touched by this story except where Task 2 explicitly says so.

### Why scratch-scaffold, not in place — read before running anything

- This exact command — `create-tauri-app` against a non-empty target — previously **destroyed this repo's entire prior planning corpus** (`_bmad/`, `_bmad-output/`, `docs/`) when run with `--force` against the repo root while it wasn't yet a git repo. Testing `--force` in an empty scratch directory made it look like "overwrite conflicting files only"; against a non-empty directory it actually **wipes the directory first, then scaffolds fresh.** The architecture spine (`ARCHITECTURE-SPINE.md` line 22) and this project's `CLAUDE.md` both document the incident directly.
- I confirmed directly (`pnpm dlx create-tauri-app@latest --help`, run 2026-07-22) that the installed/latest version is 4.6.2 — matching the spine's pin — and that its CLI takes `PROJECTNAME` as a required positional arg used for the directory name, with `-f`/`--force` documented literally as "Force create the directory even if it is not empty." This confirms the mechanism: without `-f`, the tool should refuse to touch a non-empty directory; the danger is specifically the force flag against a non-empty target.
- Given the repo root is git-tracked but **not currently clean of prior irreplaceable content** (the planning corpus is real project history, not disposable), the safe procedure is: scaffold into a fresh, guaranteed-empty scratch directory (no force flag needed, because that directory is empty), then **manually copy files into the repo root** — never run the scaffolder with the repo root as its target, forced or not. This sidesteps the entire class of bug rather than trusting a flag's documented behavior a second time.
- Per `CLAUDE.md`'s standing rule, the repo is already committed clean at this story's baseline (`b08f76c`, verify with `git status` before starting) — so even in the worst case this remains a `git reset`/`git checkout` away from undone. But prefer not needing that safety net at all; the scratch-directory approach means the destructive-capable command never runs against real content in the first place.

### Architecture compliance for this story

- **AD-2 note (does not yet apply):** the spine's `crates/umbra-core` workspace split (pure logic crate, no Tauri deps) is Story 1.3's job, not this one. This story's scaffold output can and will look like the stock `create-tauri-app` layout (`src/`, `src-tauri/` only, no `crates/`) — that is expected and correct for AC3; do not attempt to restructure into the spine's Structural Seed here. [Source: `epics.md` Story 1.3 — "Workspace structure and the `ToolError` contract"]
- **AD-7 (this story's core architectural constraint):** zero network surface except the future `tauri-plugin-updater` (not added until Epic 5). Task 4's audit is the enforcement mechanism for AC4. No dependency with network I/O as its purpose should exist yet — the default scaffold shouldn't introduce one, but this must be verified, not assumed. [Source: `epics.md` — "Architecture decisions binding story implementation", AD-7]
- **Stack pins to scaffold against** (verified live against npm/crates.io 2026-07-20, re-confirmed live via `--help` 2026-07-22): Tauri 2.11.5, Vue 3.5.x, pnpm 11.15.1 (this machine already has pnpm 11.15.1 and Node 26.3.0 installed — both satisfy pnpm's Node 22+ requirement), `create-tauri-app` 4.6.2 (unpinned by design — "latest stable at scaffold time" per AC3, and 4.6.2 is confirmed current as of this story). [Source: `ARCHITECTURE-SPINE.md` — Stack table]
- No app identifier convention is specified anywhere in the PRD or architecture docs. `com.dipaneb.umbra` (reverse-DNS of the GitHub owner + app name) is a reasonable default absent any other guidance — this is a low-stakes, easily-changed value, not worth blocking on.
- Window title "Umbra" (AC1) is not automatically guaranteed by the scaffold — `create-tauri-app`'s `PROJECTNAME` arg feeds `package.json`'s name and `Cargo.toml`'s package name, not necessarily the window title verbatim. Verify `tauri.conf.json`'s `productName` and any explicit window `title` config after scaffolding and set both to exactly "Umbra" if the scaffold produced something else (e.g. lowercase `umbra`).

### Project Structure Notes

- Target end state for **this story only**: stock `create-tauri-app` `vue-ts` template layout at repo root (`package.json`, `src/`, `src-tauri/`, config files) sitting alongside the untouched `LICENSE`, `README.md`, `CLAUDE.md`, `.github/`, `_bmad/`, `_bmad-output/`, `.claude/`, `.gitignore`.
- The spine's full Structural Seed (`crates/umbra-core`, `src-tauri/src/commands/`, `src-tauri/resources/models/`, etc.) is **out of scope** — that's Story 1.3. Do not create `crates/` or move any logic out of the scaffold's default `src-tauri/src/main.rs`/`lib.rs` in this story. [Source: `ARCHITECTURE-SPINE.md` — Structural Seed section]
- Expected new top-level entries after this story: `package.json`, `pnpm-lock.yaml`, `src/`, `src-tauri/`, `index.html`, `vite.config.ts`, `tsconfig*.json`, and whatever else the current `vue-ts` template emits — inspect the actual scratch-scaffold output rather than trusting this list as exhaustive, since `create-tauri-app` is explicitly unpinned and its exact template contents can shift between versions.
- Root `.gitignore` already anticipates Rust (`/target/`, `**/target/`) and Node (`node_modules/`, `dist/`, `dist-ssr/`, `*.local`, `*-debug.log*`) build artifacts from Story 1.1's forward-looking setup — likely nothing to add, but diff against the scaffold's own `.gitignore` to confirm rather than assume.
- Dependabot (`.github/dependabot.yml`, from Story 1.1) already targets `cargo` at `/src-tauri` and `npm` at `/` in anticipation of this story's manifests landing exactly there — confirm the scaffold's `Cargo.toml` does land at `src-tauri/Cargo.toml` (it should, for the stock template) so Dependabot's existing config picks it up without modification.

### Testing Requirements

- No `umbra-core` exists yet (Story 1.3), so no Rust unit tests apply to this story — there is no tool logic yet, only scaffold + shell.
- Verification is manual for this story, matching Story 1.1's precedent of manual verification for infrastructure-only stories:
  - AC1: `pnpm install && pnpm tauri dev` from a clean clone — window titled "Umbra" opens.
  - AC2: release build launched, cold-launch timed under 2s across multiple runs (no automated perf gate exists yet — this is a manual check, consistent with NFR1's "manual per-release checklist in v1" pattern for other non-automated NFRs).
  - AC3: inspect `package.json`/`Cargo.toml`/`tsconfig.json` — confirm Tauri 2.11.x, Vue 3, Vite, TypeScript `strict` mode enabled, pnpm as the lockfile/package manager in use.
  - AC4: manual dependency-manifest and capability-file audit per Task 4, findings recorded in Dev Agent Record.
- CI (`cargo check`/clippy/eslint on every PR) does not exist yet — that's Story 1.4. This story's PR merges without an automated CI gate; rely on the manual verification above before opening the PR.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.2: First launch — the scaffolded app opens, and the "Note on Story 1.1's split (2026-07-22)"]
- [Source: `_bmad-output/planning-artifacts/epics.md` — "Additional Requirements" §"Starter template (impacts Epic 1 Stories 1.2–1.3)", and AD-7]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — NFR2 (Performance/cold-launch), NFR1 (Privacy)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — Stack table, Structural Seed, and the data-loss incident note at line 22]
- [Source: `CLAUDE.md` — "Safety: git checkpoint before destructive-capable commands"]
- [Source: `_bmad-output/implementation-artifacts/1-1-a-governed-public-repository.md` — prior story's verified repo state and `.github/dependabot.yml` content, confirming what this story must not disturb]
- Live-verified 2026-07-22: `pnpm dlx create-tauri-app@latest --help` confirms v4.6.2, `PROJECTNAME` positional arg, `-f`/`--force` semantics ("force create the directory even if it is not empty"); this machine's `node --version` = v26.3.0, `pnpm --version` = 11.15.1.

## Change Log

- 2026-07-22: Story drafted from epics.md Story 1.2, with the scratch-scaffold safety procedure derived from the CLAUDE.md incident report and a live `--help` check of `create-tauri-app` 4.6.2.
- 2026-07-22: Implemented all 4 tasks. Scaffolded into scratch dir, merged into repo root, corrected window title and Rust edition, verified dev/release workflows and cold-launch timing, audited network surface. All ACs satisfied. Story moved to review. Left uncommitted at user's request pending `code-review`.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Scaffolded via `pnpm dlx create-tauri-app@latest umbra -m pnpm -t vue-ts -y --identifier com.dipaneb.umbra` in `$CLAUDE_JOB_DIR/tmp` (scratch, outside the repo) — never against the repo root, per Dev Notes' safety procedure. Produced v4.6.2 output confirmed matching spine pins.
- Copied `src/`, `src-tauri/`, `public/`, `.vscode/`, `package.json`, `index.html`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts` from scratch into repo root. Verified via `git status` immediately after: only additions, zero modifications/deletions to `LICENSE`, `README.md`, `CLAUDE.md`, `.github/`, `_bmad/`, `_bmad-output/`.
- Discarded the scaffold's own `README.md` (generic Tauri template boilerplate, no content worth merging).
- Diffed scaffold's `.gitignore` against repo's; appended genuinely-missing entries (`logs`, `*.log`, `yarn-debug.log*`, `yarn-error.log*`, `lerna-debug.log*`, `*.suo`, `*.ntvs*`, `*.njsproj`, `*.sln`, `*.sw?`) rather than overwriting.
- `package.json` already had `"private": true` from the scaffold — no change needed there.
- Corrected `src-tauri/tauri.conf.json`: `productName` and window `title` both defaulted to lowercase `"umbra"` — set both to `"Umbra"` per AC1. There is a third title-bearing field, `index.html`'s `<title>` (the HTML document title, distinct from the native window title) — this was initially missed and left at the generic scaffold value; caught in code review and corrected to `"Umbra"` (see Review Findings).
- Corrected `src-tauri/Cargo.toml`: scaffold defaulted `edition = "2021"`; updated to `edition = "2024"` to match the architecture spine's Stack table pin ("Rust stable, edition 2024"). Installed `rustc 1.94.0`/`cargo 1.94.0` support edition 2024 natively (stabilized since 1.85), so no toolchain gap.
- `pnpm install` initially exited 1 with `ERR_PNPM_IGNORED_BUILDS` (pnpm 11's supply-chain policy blocking `esbuild`'s postinstall script by default). Resolved via `pnpm approve-builds --all`, which wrote `pnpm-workspace.yaml` (`allowBuilds: esbuild: true`). Re-ran `pnpm install` — clean, lockfile-verified, no errors. Both `pnpm-lock.yaml` and `pnpm-workspace.yaml` are new tracked files.
- **AD-7 network-surface audit (AC4):** inspected `package.json` (`vue`, `@tauri-apps/api`, `@tauri-apps/plugin-opener` + standard Vite/TS devDeps) and `src-tauri/Cargo.toml` (`tauri`, `tauri-plugin-opener`, `tauri-build`, `serde`, `serde_json`) — no HTTP client, fetch polyfill, or analytics SDK present. `tauri-plugin-opener`/`@tauri-apps/plugin-opener` is the only non-core dependency; its purpose is invoking the OS's default-app handler for a local path/URL (macOS `open`/Linux `xdg-open` equivalent) — not a network client, and it makes no outbound connection itself. Capability file `src-tauri/capabilities/default.json` grants only `core:default` and `opener:default` — no network permission/scope of any kind. AC4 satisfied by the stock scaffold; no changes needed.
  - **Audit scope, made explicit (per code review):** this pass covered dependency manifests and Tauri capabilities only. It did not cover the webview's CSP (`tauri.conf.json`'s `security.csp`, a separate security boundary — resolved separately, see Review Findings) nor the placeholder `App.vue`'s stock external links (vite.dev/tauri.app/vuejs.org), which are real but intentionally out of scope: AC1 explicitly calls for "a placeholder shell," and this demo content is expected to be replaced once real navigation/tools land.
- **AC1 verification (`pnpm tauri dev`):** ran in foreground (not backgrounded — a backgrounded run got externally killed mid-launch on the first attempt, right after `Running \`target/debug/umbra\`` printed; re-ran foregrounded with a self-controlled poll/cleanup loop). Vite ready in 233ms, `cargo run` debug build finished in 4.05s (incremental, warm cache), then macOS System Events confirmed a window named "Umbra" existed. Process and Vite server killed cleanly afterward (`pkill`), confirmed no leftover `umbra`/`vite` processes.
- **AC2 verification (cold launch):** `pnpm tauri build` produced `src-tauri/target/release/bundle/macos/Umbra.app` (Mach-O arm64). Initial timing attempt using repeated `osascript` polling calls was unreliable (each poll's own process-spawn overhead dominated the measurement, once showing a misleading 2275ms). Switched to a single in-process AppleScript `repeat`/`delay 0.02` loop per run (one `osascript` invocation per measurement, not one per poll) — 3 runs: 829ms, 447ms, 386ms, all comfortably under the 2s NFR2 budget. Noting the measurement caveat here since NFR2 has no automated gate yet (per this story's own Testing Requirements) and a future story may want a cleaner instrumented timing signal instead of an AppleScript proxy.

### Completion Notes List

- All 4 acceptance criteria satisfied. Scaffold generated via `create-tauri-app` 4.6.2 into an isolated scratch directory and merged into the repo root file-by-file — no pre-existing repo content (LICENSE, README, CLAUDE.md, .github/, _bmad/, _bmad-output/) was touched, confirmed via `git status` immediately after the copy.
- Two deviations from the stock scaffold, both intentional and documented in Dev Notes/Debug Log: window title/productName corrected from lowercase "umbra" to "Umbra" (AC1), and Cargo edition bumped from the scaffold's default 2021 to 2024 to match the architecture spine's Stack table pin.
- AC4's network-surface audit found nothing to fix — the stock scaffold's only non-core dependency (`tauri-plugin-opener`) is an OS-open helper, not a network client, and its capability grants no network scope.
- No automated tests were added — this story's own Testing Requirements section states no `umbra-core` exists yet (Story 1.3) so there's no tool logic to unit test, and verification is manual for this infrastructure-only story, consistent with Story 1.1's precedent.
- Per user instruction, this story is intentionally left **uncommitted** — Task 5 (commit + PR) is deferred until after the `code-review` skill runs on this diff.

### File List

- `package.json` (new)
- `pnpm-lock.yaml` (new)
- `pnpm-workspace.yaml` (new — pnpm build-script allowlist, `esbuild: true`, with rationale comment added in code review)
- `index.html` (new — title corrected to "Umbra" in code review)
- `tsconfig.json` (new)
- `tsconfig.node.json` (new)
- `vite.config.ts` (new)
- `.vscode/extensions.json` (new)
- `.gitignore` (modified — appended missing log/editor entries from the scaffold's `.gitignore`, nothing removed)
- `public/tauri.svg`, `public/vite.svg` (new)
- `src/App.vue`, `src/main.ts`, `src/vite-env.d.ts`, `src/assets/vue.svg` (new)
- `src-tauri/Cargo.toml` (new — edition corrected to 2024, `rust-version = "1.85"` added in code review)
- `src-tauri/Cargo.lock` (new)
- `src-tauri/build.rs` (new)
- `src-tauri/.gitignore` (new)
- `src-tauri/tauri.conf.json` (new — productName/title corrected to "Umbra"; CSP set to an explicit policy in code review, previously `null`)
- `src-tauri/capabilities/default.json` (new)
- `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` (new)
- `src-tauri/icons/*` (new — scaffold default icon set, 13 files)
- `_bmad-output/implementation-artifacts/1-2-first-launch-the-scaffolded-app-opens.md` (this story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status tracking)
- `_bmad-output/implementation-artifacts/deferred-work.md` (new — 3 deferred findings from this story's code review)
