---
baseline_commit: 51d890f
---

# Story 1.4: CI guards every pull request

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer (whose repo is an exhibit and whose quality bar needs teeth),
I want CI running the full lint/test/build matrix on every pull request,
so that no change merges without formatting, linting, tests, and a successful build all passing.

## Acceptance Criteria

1. **Given** any pull request, **when** CI runs, **then** `cargo fmt --check`, clippy (`-D warnings`), eslint, `cargo test`, and Vitest all execute (NFR6).
2. **Given** the frontend, **when** CI runs, **then** `pnpm build` (production `vite build`) runs and must succeed — a broken build fails the check.
3. **Given** the cross-platform gate, **when** CI runs, **then** `cargo check` + clippy run on both ubuntu and windows runners as required checks (AD-11, NFR3), **and** the `ort-sys` ONNX Runtime binaries are cached so the matrix stays fast (AD-11).
4. **Given** any of these checks fails, **when** a PR is open, **then** merging is blocked until it passes — the checks are required, not advisory (NFR6).

## Tasks / Subtasks

- [x] Task 1: Preflight (AC: all)
  - [x] Confirm the working tree is clean (`git status`) before starting, per `CLAUDE.md`'s standing rule
  - [x] Live-verify current branch protection: `gh api repos/dipaneb/umbra/branches/main/protection` — as of this story's drafting (2026-07-23) it has `required_pull_request_reviews`, `enforce_admins: true`, `allow_force_pushes: false`, `allow_deletions: false`, and **no `required_status_checks` block at all** (no checks are required yet — that's this story's job, Task 6)

- [x] Task 2: Add ESLint flat config for the Vue + TypeScript frontend (AC: 1)
  - [x] `pnpm add -D eslint eslint-plugin-vue typescript-eslint globals` — no version pins; this repo's convention is "code owns exact pins at lockfile time" (spine Stack table)
  - [x] Create `eslint.config.js` at repo root (flat config — this project's `package.json` already has `"type": "module"`, so no `.mjs` extension needed). Per `eslint-plugin-vue`'s current flat-config docs (verified via Context7, 2026-07-23):
    ```js
    import js from '@eslint/js'
    import eslintPluginVue from 'eslint-plugin-vue'
    import ts from 'typescript-eslint'

    export default ts.config(
      { ignores: ['dist/**', '**/target/**', 'src-tauri/gen/**', 'node_modules/**'] },
      js.configs.recommended,
      ...ts.configs.recommended,
      ...eslintPluginVue.configs['flat/recommended'],
      {
        files: ['**/*.vue'],
        languageOptions: {
          parserOptions: { parser: ts.parser },
        },
      },
    )
    ```
  - [x] Use `ts.configs.recommended` (non-type-checked), **not** `recommendedTypeChecked` — the type-checked variant needs `parserOptions.project` wired to `tsconfig.json` and a slower type-aware lint pass; nothing in this story's ACs asks for type-aware lint rules, and `pnpm build`'s `vue-tsc --noEmit` step already catches real type errors. Keep the lint step fast and separate from type-checking. (Deliberate scope choice — record in Dev Notes if changed.)
  - [x] Add `"lint": "eslint . --max-warnings 0"` to `package.json`'s `scripts` — `--max-warnings 0` makes ESLint warnings fail the check, matching clippy's `-D warnings` zero-tolerance (this story's own premise: "quality bar needs teeth")
  - [x] Run `pnpm lint` locally against the existing scaffold files (`src/App.vue`, `src/main.ts`) — fix anything flagged (untouched since Story 1.2, never linted before) before moving on

- [x] Task 3: Add a working Vitest command (AC: 1)
  - [x] `pnpm add -D vitest`
  - [x] Add a `test` block to the existing `vite.config.ts` (Vitest auto-reads `vite.config.ts` when present — no separate `vitest.config.ts` needed) with `/// <reference types="vitest/config" />` at the top of the file and `test: { passWithNoTests: true }` in the config object
  - [x] **Why `passWithNoTests: true`:** Vitest's default (`passWithNoTests: false`, confirmed via Context7 2026-07-23) fails the run with no test files, and none exist yet — no Vue component has been built (that starts Story 1.5). Setting this now avoids inventing a placeholder test with no real assertion just to satisfy CI. Whichever story adds the first real component test (1.5+) should reconsider removing this flag.
  - [x] Add `"test": "vitest run"` to `package.json`'s `scripts` (non-watch, single run — correct for CI; a local-dev `"test:watch": "vitest"` script is optional and not required by any AC)
  - [x] Run `pnpm test` locally — confirm it exits 0 with "no test files found, passing" rather than erroring

- [x] Task 4: Re-verify the Rust-side commands still pass (AC: 1)
  - [x] `cargo fmt --check` — should be clean (no custom `rustfmt.toml` needed; no AC calls for one)
  - [x] `cargo clippy --workspace --all-targets -- -D warnings` — Story 1.3 verified this clean on 2026-07-23; re-run now in case anything drifted
  - [x] `cargo test --workspace` — must still show `umbra-core`'s 3 passing serialization tests from Story 1.3
  - [x] `cargo check --workspace` — clean
  - [x] No new Rust config is needed for these four — they already work locally; this task only re-confirms before wiring them into CI

- [x] Task 5: Author `.github/workflows/ci.yml` (AC: 1, 2, 3, 4)
  - [x] Path matches the architecture spine's Structural Seed exactly: `.github/workflows/ci.yml` — sits alongside the existing `.github/dependabot.yml`
  - [x] `name: CI`; trigger `on: pull_request` only — this story's ACs are all phrased "given any pull request"; a `push`-to-`main` trigger isn't required by any AC and branch protection already forbids direct pushes to `main` (Story 1.1), so there's nothing a push-trigger would catch that the PR trigger doesn't. Deliberate minimal scope — extend later if wanted, don't add it speculatively now.
  - [x] One job, `ci`, matrixed across **three** runners: `strategy.matrix.os: [ubuntu-latest, windows-latest, macos-latest]`, `runs-on: ${{ matrix.os }}`. This is a deliberate superset of AC3's literal "both ubuntu and windows" — see "Which runner gets the full gate" in Dev Notes for why macOS was added as a third leg rather than kept off.
  - [x] Step order matters — `rust-cache` keys its cache on the active `rustc` version, so it must run *after* the toolchain is installed. Steps split by whether the check compiles/executes code (and can therefore differ per OS via `#[cfg(target_os)]`, since `src-tauri` — unlike `umbra-core` — is allowed platform-specific code) or only reads source text (and structurally cannot differ per OS):
    1. `actions/checkout@v4`
    2. `dtolnay/rust-toolchain@stable` with `components: clippy, rustfmt` (installing `rustfmt` on all three legs even though only one runs `cargo fmt --check` is a harmless simplification — avoids a per-OS component list for negligible cost)
    3. `Swatinem/rust-cache@v2` — this is the AC3 caching mechanism. **Note:** `ort-sys`/ONNX binaries don't exist in the dependency tree yet (that lands in Epic 4 with `oar-ocr`); this step is wired now so caching is already in place and takes effect automatically the moment that dependency is added — it is inert, not broken, until then.
    4. **All three OS legs, unconditional, required** (compile/execute checks — need every OS because `#[cfg(target_os)]`-gated code only compiles, and only runs, on its own platform):
       - `cargo check --workspace`
       - `cargo clippy --workspace --all-targets -- -D warnings`
       - `cargo test --workspace`
    5. **Ubuntu leg only** (`if: runner.os == 'Linux'`) — text-only checks whose result is identical regardless of host OS, so running them on all three legs would catch nothing extra:
       - `pnpm/action-setup@v4` (reads the version from `package.json`'s `packageManager` field — see Task 5's next bullet)
       - `actions/setup-node@v4` with `node-version: 22`, `cache: 'pnpm'`
       - `pnpm install --frozen-lockfile`
       - `cargo fmt --check`
       - `pnpm lint`
       - `pnpm test`
       - `pnpm build` — deliberately on Linux, not macOS: Linux's case-sensitive filesystem catches an import-path casing bug (`import './Foo.vue'` against a file actually named `foo.vue`) that macOS's and Windows's default case-insensitive filesystems silently tolerate
  - [x] Add `"packageManager": "pnpm@11.15.1"` to `package.json` (matches the spine's verified pnpm pin) — `pnpm/action-setup@v4` autodetects the version from this field via corepack, and local installs of pnpm stay pinned to the same version CI uses

- [x] Task 6: Make the new checks required, without touching Story 1.1's existing protections (AC: 4)
  - [x] Open a real PR first and let the workflow run once — read the **exact** check names from the PR's Checks tab. Expect `CI / ci (ubuntu-latest)`, `CI / ci (windows-latest)`, and `CI / ci (macos-latest)` given `name: CI` and job id `ci`, but GitHub's context-string generation for matrix jobs can be subtly finicky — confirm all three literal strings rather than assuming.
  - [x] **Do not** `PUT` the full `.../branches/main/protection` endpoint with a minimal payload — Task 1's live-verified state shows Story 1.1 already set `required_pull_request_reviews`, `enforce_admins: true`, `allow_force_pushes: false`, `allow_deletions: false`; a full `PUT` requires resending every field or it silently clobbers those. **Deviation (see Dev Notes):** the scoped sub-resource `PATCH .../required_status_checks` 404'd ("Required status checks not enabled") because that endpoint only updates an existing config, it cannot create one from scratch, and none existed. Fell back to the full `PUT /branches/main/protection` instead, with every currently-live field resent explicitly (confirmed with the user before applying).
  - [x] This is a live change to shared GitHub repo settings, not a file in the repo — confirm with the user before applying it, same standing caution as any action affecting shared/hard-to-reverse state.
  - [x] After applying, verify: open (or reuse) a PR, confirm the merge button shows the **three** checks (not two — see Dev Notes on the two-vs-three-runner leftover text) as required and pending/passing.

- [x] Task 7: Prove the gate actually blocks — and prove the 3-OS split is real, not decorative (AC: 4)
  - [x] On a scratch commit, introduce one deliberate failure that trips clippy's `-D warnings` (e.g. an unused variable) — push to a throwaway PR and confirm the merge button reports the check as failing and merging is blocked
  - [x] Additionally, if practical, wrap that same deliberate mistake in a `#[cfg(target_os = "windows")]` block inside `src-tauri` — confirm the ubuntu and macos legs stay green while only the windows leg fails. This is the concrete proof that running check/clippy/test on all three OSes is load-bearing (an OS-gated bug is genuinely invisible to the other two legs), not just cautious-sounding
  - [x] Discard the scratch branch/PR; this is a one-time proof, not a permanent fixture

- [x] Task 8: Commit and open a PR
  - [x] Branch: `feat/story-1-4-ci-guards-every-pr` (repo convention: `feat/story-1-N-<slug>` regardless of Conventional Commit type — matches Stories 1.2/1.3's branch names)
  - [x] Commit as a Conventional Commit with the `ci` type (first use of this type in the repo; fits better than `feat` for CI-config-only changes): e.g. `ci(workflow): add CI pipeline gating lint, test, and build on every PR`
  - [x] Push via a PR against `main` (branch protection requires it)

### Review Findings

- [x] [Review][Decision→Patch] `epics.md`'s AC3 text was never updated for the 3-runner reality — `epics.md:314` still reads "cargo check + clippy run on both ubuntu and windows runners," but `.github/workflows/ci.yml` runs all three (ubuntu, windows, macos) as required checks, and both `ARCHITECTURE-SPINE.md`/`ARCHITECTURE.md` were amended to match while this planning artifact's AC text was left stale. **Resolved:** updated `epics.md:314` to read "cargo check, clippy, and cargo test run on ubuntu, windows, and macos runners."
- [x] [Review][Decision] No settings-as-code for branch protection's `required_status_checks` — Task 6 applied it via a live `gh api PUT`, documented only as prose in Dev Notes; nothing in the repo verifies the exact context strings stay correct over time. This exact class of drift is what blocked PR #5's merge (a "CI / " prefix mismatch between the configured required contexts and the actual check-run names) until this review caught and fixed it live. **Resolved:** accept the manual `gh api` process as-is — no new tooling added; rely on future code reviews to catch drift.
- [x] [Review][Decision→Patch] CI's Rust toolchain and runner images are unpinned — `.github/workflows/ci.yml:11,22` used `os: [ubuntu-latest, windows-latest, macos-latest]` and `dtolnay/rust-toolchain@stable`. **Resolved (revised from initial proposal):** pinned only `dtolnay/rust-toolchain@1.94.0` (was floating `@stable`, the actual reproducibility risk — a new clippy lint on a fresh stable release could break every PR with no code change). Deliberately **kept `os: [ubuntu-latest, windows-latest, macos-latest]` unpinned** — AD-11's whole purpose is proving compatibility with the OS versions users are actually running today, so freezing runner images to older `windows-2022`/`macos-15` labels would work against that goal. Dependabot's existing `github-actions` watch can propose future toolchain bumps.
- [x] [Review][Patch] No `timeout-minutes` set on the CI job [.github/workflows/ci.yml:7] — **Fixed:** added `timeout-minutes: 20` at job level.
- [x] [Review][Patch] No `concurrency` group / `cancel-in-progress` on the CI workflow [.github/workflows/ci.yml:1] — **Fixed:** added `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` at workflow level.
- [x] [Review][Defer→Patch] `apt-get install` for Tauri Linux system deps was unpinned and uncached [.github/workflows/ci.yml:21-25] — **Resolved (upgraded from deferred to fixed):** replaced the raw `apt-get update && apt-get install` step with `awalsh128/cache-apt-pkgs-action@v1` (verified via its README), which caches the downloaded packages across runs. Deliberately did not version-pin the individual apt packages — that would conflict with keeping `os: [ubuntu-latest, ...]` unpinned for OS currency (a pinned Debian package version disappears from mirrors as soon as Ubuntu ships a security update). Note: Tauri's own official reference CI workflow (verified via Context7) uses the exact same unpinned/uncached raw `apt-get` pattern this diff originally shipped — this gap is ecosystem-standard, not a Tauri-specific anti-pattern.
- [x] [Review][Patch] All 6 third-party Actions in `.github/workflows/ci.yml` were pinned to mutable tags/branches (`@v4`, `@v1`, `@v2`, `@1.94.0`), not immutable commit SHAs — a tag/branch can be repointed by the maintainer or an attacker who compromises the action's repo, silently swapping in different code on the next CI run. Flagged by an automated post-push security scan. **Fixed:** every `uses:` pinned to its resolved commit SHA with a trailing `# vX` comment (Dependabot's documented convention for keeping SHA-pinned Actions bumpable). Notably `dtolnay/rust-toolchain`'s version refs are branches, not tags — more mutable than a typical tag by convention, making this pin especially worthwhile there.

## Dev Notes

### Which runner gets the full gate — doc discrepancy, resolved with the user 2026-07-23 in two passes

**Pass 1 — how many runners.** `ARCHITECTURE-SPINE.md`'s AD-11 rule text said check+clippy run on `ubuntu-latest` and `windows-latest`, and "one runner additionally runs" fmt/test/eslint/vitest — without naming which of the two. The companion `ARCHITECTURE.md` prose separately said the required checks run "alongside the full **macOS**-based test suite," naming a third OS not present in the spine's own AD-11 rule text or in epics.md's Story 1.4 acceptance criteria (which name only "ubuntu and windows runners," AC3).

An initial cost argument for staying at two runners was raised and corrected: GitHub-hosted macOS runners bill at roughly 10x the Linux-runner multiplier, but only against a private repository's included-minutes quota. Live-verified via `gh api repos/dipaneb/umbra` — `"private": false`. Umbra is public, so Actions minutes are unrestricted and free on every runner OS; cost was never a valid reason to prefer two runners.

**Decision: three runners** (ubuntu, windows, macos). The user's reasoning: this story shouldn't assume the project stays a solo macOS-only effort for its whole lifetime. The current developer's own Mac gives free, instant local coverage of macOS but *none* of Linux or Windows — exactly why AD-11 puts those two in CI. A future contributor developing on Linux or Windows would face the same blind spot in reverse — zero macOS coverage on their PRs — without a third leg. Three runners removes that asymmetry regardless of who ends up developing where.

**Pass 2 — which checks actually need all three runners.** Having three runners doesn't mean every check needs to run on all three. The user asked directly: doesn't `#[cfg(target_os)]` mean some checks are inherently OS-dependent while others (pure text/formatting tools) aren't — so triplicating the OS-agnostic ones would just waste time for no extra safety? Correct, and it surfaced a real gap in the first three-runner draft, which had bundled `cargo test` onto the macOS-only "full gate" leg alongside fmt/eslint/vitest/build:

- **`cargo check`, `clippy`, `cargo test` — all three legs, unconditional.** These compile (and `cargo test` executes) code. `#[cfg(target_os = "...")]`-gated code is only compiled — and only run — on its own OS. `src-tauri`, unlike `umbra-core` (AD-2), is explicitly allowed OS-specific code, so a bug hidden behind an OS-gate would be invisible on the other two legs. This is why `cargo test` moved off the "one runner" bucket entirely — a test-only regression on, say, Windows would never have been caught by check/clippy running there without also running the tests.
- **`cargo fmt --check`, `eslint`, `pnpm test` (Vitest) — once, on ubuntu.** These only parse and analyze source text; they never compile or execute against a target, so their result is identical on every OS. Running them three times would catch nothing extra.
- **`pnpm build` — once, on ubuntu, not macOS.** Genuinely OS-agnostic in principle, but ubuntu specifically has an edge: Linux's case-sensitive filesystem catches an import-path casing bug (`import './Foo.vue'` against a file actually named `foo.vue`) that macOS's and Windows's default case-insensitive filesystems silently tolerate. Picking ubuntu here isn't arbitrary — it's the one OS of the three most likely to catch a real bug the developer's own Mac can't see.

This is the final design in Tasks 5–7 below: three runners for compile/execute checks, one runner (ubuntu) for text-only checks and the build.

### Architecture compliance for this story

- **AD-11 (this story's core deliverable, amended 2026-07-23 alongside this story):** checks split by whether they compile/execute code or only read source text. `cargo check`, clippy, and `cargo test --workspace` run on `ubuntu-latest`, `windows-latest`, and `macos-latest` — all three, as required status checks. `cargo fmt --check`, `pnpm lint` (eslint), and `pnpm test` (Vitest) run once, on `ubuntu-latest` only. `ort-sys` ONNX Runtime binaries are cached in CI from Epic 4 onward. This story is the one that stands this up; every future story's PR runs through it. [Source: `ARCHITECTURE-SPINE.md` AD-11]
- **NFR6:** "GitHub flow with self-reviewed PRs; CI on every PR (fmt, clippy, eslint, tests); Rust unit tests for tool logic; integration tests over Tauri commands; Dependabot/Renovate. No e2e suite in v1." This story closes the "CI on every PR" gap — Dependabot (Story 1.1) has been opening PRs into a repo with nothing to run against them since day one. [Source: `epics.md` — NonFunctional Requirements]
- **NFR3:** cross-platform-cleanliness is what the three-OS compile/execute matrix proves on every PR — a regression gated to one platform (legal in `src-tauri`, forbidden in `umbra-core` per AD-2) is caught here, before it ever reaches the Epic 5 release pipeline. This story's matrix exceeds AC3's literal ubuntu+windows floor for `cargo check`/clippy, and extends the same three-OS coverage to `cargo test` as well (see "Which runner gets the full gate" below) — a strictly stronger reading of AD-11, not a narrower one.
- **This story does not add an automated AD-7 (network-surface) check.** Stories 1.2 and 1.3 both ran that audit manually and explicitly deferred automating it — nothing in this story's four ACs asks for one either. Don't fold it in as a bonus; it's out of scope here.
- **This story retires the "manual audit, no CI yet" caveat** that Stories 1.2 and 1.3 both stated explicitly in their own Testing Requirements ("CI doesn't exist yet — Story 1.4"). After this merges, `cargo check`/`clippy`/`fmt` are enforced automatically; no future story needs to repeat that manual gate.

### Previous Story Intelligence (from Story 1.3)

- **The `rust-toolchain.toml` gap (deferred from Story 1.3's code review, `deferred-work.md`) is not fixed by this story, and doesn't need to be for CI's sake.** `dtolnay/rust-toolchain@stable` in the workflow always provisions a fresh "stable" toolchain in CI independent of any repo-level toolchain file — CI's reproducibility doesn't depend on that pin existing. The gap that remains open is specifically about *local* dev-machine reproducibility, which is unrelated to this story's ACs. Don't silently close it by adding a `rust-toolchain.toml` here — that would be solving a different, undiscussed problem.
- **Manual-audit pattern retiring (see Architecture compliance above)** — Story 1.3's own Dev Notes said "AD-2 gets CI-enforced starting Story 1.4, not before." This is that moment.
- **Convention continuity:** one feature branch per story, Conventional Commit, squash-merged via PR, pushed only (branch protection blocks direct pushes) — same shape Stories 1.1–1.3 established.

### Git Intelligence

- Recent commits (`51d890f` feat(core), `db19f4b` docs(story-1.2), `7db53b6` feat(scaffold), `b08f76c` merge, `9ab7b27` chore(repo)) show every prior commit type/scope pairs was either `feat` or `chore`/`docs` — none used `ci` yet. `ci` is still the correct Conventional Commits type here (CI configuration and scripts) — this story is simply the first to use it.
- Branch naming has stayed `feat/story-1-N-<slug>` regardless of the eventual commit type (Story 1.2's PR carried a `feat(scaffold)` commit on `feat/story-1-2-scaffold-app`; Story 1.3's `feat(core)` commit sits on `feat/story-1-3-workspace-toolerror-contract`) — follow the same branch-name shape for consistency (Task 8).

### Project Structure Notes

- New files this story adds: `.github/workflows/ci.yml`, `eslint.config.js` (repo root). Modified: `vite.config.ts` (adds a `test` block), `package.json` (adds `lint`/`test` scripts, `eslint`/`eslint-plugin-vue`/`typescript-eslint`/`globals`/`vitest` devDependencies, and a `packageManager` field), `pnpm-lock.yaml`.
- Nothing under `crates/umbra-core` or `src-tauri/` changes in this story — it wires existing, already-passing Rust commands into CI; it doesn't add new Rust code.
- `.github/dependabot.yml` (Story 1.1) already watches `npm` at `/`, `cargo` at `/src-tauri`, and `github-actions` at `/` — the new `eslint`/`typescript-eslint`/`vitest` devDependencies and the new `ci.yml` workflow file are automatically in Dependabot's existing scope; no Dependabot config change needed.

### Testing Requirements

- This story's own "testing" is proving the pipeline itself works, not adding product test coverage:
  - Open a real PR; confirm all three matrix legs (`ubuntu-latest`, `windows-latest`, `macos-latest`) run `cargo check` + clippy + `cargo test --workspace` successfully (the last must show `umbra-core`'s existing 3 passing tests on every leg, not just one).
  - Confirm the Linux leg additionally runs `cargo fmt --check`, `pnpm lint`, `pnpm test`, `pnpm build` — all green.
  - Task 7's deliberate-failure checks prove both AC4 (blocking, not advisory) and that the three-OS split is load-bearing, not decorative.
- No new Rust unit tests or Vitest component tests are added by this story — there is no new tool logic (that's Epic 1's later stories) and no Vue component exists yet to test (Story 1.5).

### Latest Technical Specifics (verified 2026-07-23)

- **ESLint flat config for Vue 3 + TypeScript**, verified against `eslint-plugin-vue`'s own current docs via Context7 (`/vuejs/eslint-plugin-vue`): `eslint.config.js` combining `js.configs.recommended`, `...ts.configs.recommended`, `...eslintPluginVue.configs['flat/recommended']`, plus a `.vue`-files override setting `languageOptions.parserOptions.parser` to `typescript-eslint`'s parser so `<script setup lang="ts">` blocks parse correctly. This is current as of `eslint-plugin-vue`'s documented flat-config guide, not a legacy `.eslintrc` pattern.
- **Vitest `passWithNoTests`**, verified via Context7 (`/vitest-dev/vitest`): defaults to `false` — Vitest fails a run with zero test files unless this is explicitly set. Confirms Task 3's approach is required, not optional, given no test files exist yet.
- **Vitest auto-reads `vite.config.ts`** when present (confirmed via Context7, official Vitest config docs) — no separate `vitest.config.ts` file needed for this project; add the `test` block directly to the existing `vite.config.ts` with the `/// <reference types="vitest/config" />` triple-slash directive for type support.
- **`dtolnay/rust-toolchain` + `Swatinem/rust-cache` ordering**, confirmed via web search against both actions' current docs: `rust-cache` keys its cache on the active `rustc` version, so the toolchain-install step must run before it in the job — reflected in Task 5's step ordering.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.4: CI guards every pull request]
- [Source: `_bmad-output/planning-artifacts/epics.md` — "Additional Requirements" §"Architecture decisions binding story implementation", AD-11; NFR3, NFR6]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-11, Structural Seed (`.github/workflows/ci.yml`), Stack table (pnpm 11.x / Node 22+, Tauri/Rust pins)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "Two mechanisms enforce this" (AD-2/AD-11 prose), "alongside the full macOS-based test suite" (the flagged discrepancy)]
- [Source: `_bmad-output/implementation-artifacts/1-3-workspace-structure-and-the-toolerror-contract.md` — Dev Notes ("AD-2 gets CI-enforced starting Story 1.4, not before"); Review Findings and `deferred-work.md`'s `rust-toolchain.toml` gap]
- [Source: `_bmad-output/implementation-artifacts/1-2-first-launch-the-scaffolded-app-opens.md` — manual-audit precedent this story retires; branch/commit convention]
- [Source: `CLAUDE.md` — "Safety: git checkpoint before destructive-capable commands"]
- Live-verified 2026-07-23: `gh api repos/dipaneb/umbra/branches/main/protection` — no `required_status_checks` block exists yet; `package.json` has no `lint`/`test` script and no `eslint`/`vitest` devDependencies; no `.github/workflows/` directory exists (only `.github/dependabot.yml`); `gh api repos/dipaneb/umbra` — `"private": false` (public repo, relevant to the runner-cost point above).
- Context7-verified 2026-07-23: `eslint-plugin-vue` flat-config setup (`/vuejs/eslint-plugin-vue`); Vitest `passWithNoTests` default and `vite.config.ts` auto-read behavior (`/vitest-dev/vitest`).

## Change Log

- 2026-07-23: Story drafted from epics.md Story 1.4, with the ESLint/Vitest scaffolding gap (neither existed in the repo yet, despite the AC assuming both), the ubuntu-vs-macOS "full gate" doc discrepancy, and the branch-protection sub-resource-endpoint caution flagged as critical implementation guidance not present verbatim in the source architecture docs.
- 2026-07-23: The ubuntu-vs-macOS discrepancy was resolved with the user rather than left as a flagged ambiguity — matrix changed from two runners (ubuntu, windows) to three (ubuntu, windows, macos), full gate moved to the macOS leg to match `ARCHITECTURE.md`'s literal wording. An initial cost-based argument for staying at two runners was raised and then corrected: macOS runner cost multipliers only apply to private repos, and Umbra is public (live-verified), so cost was never a valid factor. Tasks 5–6 and the affected Dev Notes updated accordingly.
- 2026-07-23: Second pass on the same decision, prompted by the user questioning whether every check needs all three runners. Split checks by compile/execute (`cargo check`, clippy, `cargo test` — need all three OSes, since `#[cfg(target_os)]`-gated code in `src-tauri` only compiles/runs on its own platform) vs. text-only (`cargo fmt --check`, eslint, Vitest — identical result on every OS, run once). Moved `cargo test` off the macOS-only bucket entirely (it had been bundled with the text-only checks, which would have missed an OS-gated test regression on ubuntu/windows). Moved the one-time `pnpm build` check from macOS to ubuntu specifically, since Linux's case-sensitive filesystem catches import-casing bugs macOS/Windows hide. Both architecture docs (`ARCHITECTURE-SPINE.md` AD-11, `ARCHITECTURE.md`) amended to match. Tasks 5 and 7, Dev Notes, and Testing Requirements updated accordingly.
- 2026-07-24: Implemented. Two real gaps found and fixed beyond the story's draft (see Completion Notes): `@eslint/js` was missing from Task 2's install list; the ubuntu leg needed Tauri's Linux system deps (`apt-get install libwebkit2gtk-4.1-dev` etc.) and `strategy.fail-fast: false`, neither of which the story anticipated. Task 6's scoped `PATCH` sub-resource 404'd because `required_status_checks` didn't exist yet to update; fell back to a full `PUT` with every existing field resent, confirmed with the user first. PR #5 opened (`feat/story-1-4-ci-guards-every-pr` → `main`), all three CI legs green, branch protection applied, Task 7's blocking proof completed and scratch branch discarded. Status → review.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- PR #5: https://github.com/dipaneb/umbra/pull/5 (main implementation)
- CI run (initial, ubuntu `glib-sys` build failure): https://github.com/dipaneb/umbra/actions/runs/30047444180
- CI run (after Linux system-deps fix, all green): https://github.com/dipaneb/umbra/actions/runs/30047640588
- PR #6 (Task 7 proof, closed + branch deleted after verification): windows leg failed (clippy `unused_variables`/`dead_code`), ubuntu+macos legs passed, merge blocked — https://github.com/dipaneb/umbra/actions/runs/30050141500

### Completion Notes List

- **Task 2 gap:** the story's ESLint install command (`eslint eslint-plugin-vue typescript-eslint globals`) omits `@eslint/js`, which the story's own flat-config snippet imports (`import js from '@eslint/js'`). Added it as a devDependency; without it `eslint.config.js` cannot resolve `js.configs.recommended`.
- **Task 2 pre-existing lint debt:** `pnpm lint` against the untouched Story-1.2 scaffold flagged 18 `eslint-plugin-vue` formatting warnings in `App.vue` (auto-fixed via `eslint --fix`, purely mechanical — multi-line attributes, no self-closing on void elements) and 3 `@typescript-eslint` errors on `src/vite-env.d.ts`'s `DefineComponent<{}, {}, any>` shim. That shim is Vue's own official `create-vue` boilerplate for typing `.vue` module imports — rewriting the type was out of scope and riskier than the alternative, so added a targeted `eslint.config.js` override disabling `@typescript-eslint/no-empty-object-type` and `@typescript-eslint/no-explicit-any` for that one generated file only.
- **Task 4 pre-existing fmt debt:** `cargo fmt --check` found drift in `crates/umbra-core/src/error.rs` left over from Story 1.3 (never run through `cargo fmt --check` before this story wired it into CI). Ran `cargo fmt` to fix — mechanical formatting only, no logic change.
- **Task 5 gap — real CI failure, not anticipated by the story:** first CI run failed on all three legs in ~30–50s (too fast to be a real compile error). Root cause: `glib-sys`'s build script failed on `ubuntu-latest` because Tauri's GTK/WebKit bindings need system libraries (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, `xdg-utils`) that aren't preinstalled on the default runner. Windows/macOS were merely cancelled by the matrix's default `fail-fast: true`, not independently failing. Fixed by adding an Ubuntu-only `apt-get install` step (matching Tauri's own official GitHub Actions release-workflow example, confirmed via Context7) and setting `strategy.fail-fast: false` — the latter also turned out to be load-bearing for Task 7's proof, since `fail-fast: true` would have cancelled the ubuntu/macos legs the instant the windows leg failed, defeating the demonstration that the OS split is real. Re-ran: all three legs green (macos 2m6s, ubuntu 3m20s, windows 5m44s).
- **Task 6 deviation — the scoped `PATCH` doesn't work when starting from zero:** `PATCH .../required_status_checks` 404'd with "Required status checks not enabled." That endpoint only updates an *existing* `required_status_checks` config; since Task 1 confirmed none existed, there was nothing to patch. Fell back to the full `PUT /branches/main/protection`, built by resending every field from Task 1's live-verified GET response (`required_pull_request_reviews` with `required_approving_review_count: 0`, `enforce_admins: true`, `allow_force_pushes: false`, `allow_deletions: false`, `restrictions: null`, all other flags `false`) plus the new `required_status_checks: {strict: true, contexts: [...]}`. Confirmed the pivot with the user (via AskUserQuestion) before applying, since it's a materially different, higher-blast-radius mechanism than the one originally approved. Applied successfully; verified via `gh api` response that every pre-existing field is unchanged.
- **Task 6 also caught a two-vs-three-runner leftover in the story text itself:** Task 6's own instructions said "the two confirmed check-name strings," a holdover from an earlier two-runner draft — the design (and this story's own Dev Notes) settled on three runners, all required. Applied all three (`CI / ci (ubuntu-latest)`, `CI / ci (windows-latest)`, `CI / ci (macos-latest)`).
- **Task 7 proof, exactly as designed:** scratch branch off the feature branch (needed so `ci.yml` existed in the PR's head ref — a scratch branch off `main` wouldn't have triggered the workflow at all, since `main` doesn't have the file until this PR merges), one `#[cfg(target_os = "windows")]`-gated function with an unused variable in `src-tauri/src/lib.rs`. Result: windows leg failed (`unused_variables` + `dead_code`, both `-D warnings`), ubuntu and macos legs passed clean (the gated code doesn't even exist in their compiled output), PR merge state was `BLOCKED`. Concrete proof of both AC4 (gate is real, not advisory) and that the three-OS matrix is load-bearing. Scratch PR closed and branch deleted immediately after.
- Story-drafting artifacts (sprint-status.yaml, the two amended architecture docs, this story file) were committed separately as the first commit on the feature branch (`docs(story-1.4): ...`), since `main` is branch-protected and these predated the CI implementation work itself.
- No new Rust unit tests or Vitest component tests were added, per the story's own Testing Requirements — there's no new tool logic and no Vue component exists yet to test.

### File List

- `.github/workflows/ci.yml` (new)
- `eslint.config.js` (new)
- `package.json` (modified — `lint`/`test` scripts, `packageManager` field, new devDependencies: `@eslint/js`, `eslint`, `eslint-plugin-vue`, `globals`, `typescript-eslint`, `vitest`)
- `pnpm-lock.yaml` (modified)
- `vite.config.ts` (modified — `test` block, `passWithNoTests: true`)
- `src/App.vue` (modified — eslint auto-fix, formatting only)
- `crates/umbra-core/src/error.rs` (modified — `cargo fmt` fix, formatting only)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story 1.4 status)
- `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` (modified — AD-11 three-runner amendment, drafted prior to implementation)
- `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` (modified — AD-11 prose amendment, drafted prior to implementation)
- `_bmad-output/implementation-artifacts/1-4-ci-guards-every-pull-request.md` (this file)
