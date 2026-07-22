---
baseline_commit: edf2f186c5a3a6183bc49e66d42ba5b1659b1f57
---

# Story 1.1: A governed, public repository

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer (the builder, whose repo is itself an exhibit),
I want the public repository set up with its license, README, commit conventions, and dependency automation,
so that every later story lands in a portfolio-ready, self-governing home before any application code exists.

## Acceptance Criteria

1. **Given** the repository is public, **when** its root is reviewed, **then** an All Rights Reserved license file is present (NFR7), **and** a README states the privacy promise and how the project is planned.
2. **Given** the repository's commit history, **when** inspected, **then** it follows Conventional Commits from the first commit, so a changelog can be generated later (FR32 groundwork).
3. **Given** the dependency surface, **when** the repo is configured, **then** Dependabot or Renovate is active, delivering dependency updates as reviewable pull requests (NFR6).
4. **Given** the collaboration model, **when** work proceeds, **then** changes land through self-reviewed pull requests against a protected default branch — no direct pushes (NFR6); the CI those PRs must pass is built in Story 1.4.

## Tasks / Subtasks

- [x] Task 1: Verify license and README already satisfy AC1 (AC: 1)
  - [x] Confirm `LICENSE` at repo root reads "All Rights Reserved" with no reuse grant (NFR7) — **already present, do not regenerate**
  - [x] Confirm `README.md` states the privacy promise as its opening line and describes the BMad planning process — **already present, do not regenerate**
  - [x] If either file is missing or altered, restore per the exact content in Dev Notes below — do not invent new license text
- [x] Task 2: Confirm Conventional Commits discipline holds (AC: 2)
  - [x] Run `git log --format='%s'` and confirm every existing commit subject matches a Conventional Commits type (`feat|fix|docs|chore|refactor|test|ci|build|perf|style`) — both existing commits already comply
  - [x] Make this story's own commit(s) Conventional-Commits-compliant (e.g. `chore(repo): add dependabot config and branch protection`)
  - [x] No tooling (commitlint/husky) is required by this story — NFR6's CI list (fmt, clippy, eslint, tests) does not include a commit-message linter; do not add one speculatively
- [x] Task 3: Add Dependabot configuration (AC: 3)
  - [x] Create `.github/dependabot.yml` with the exact content in Dev Notes — covers `npm` (root, for the future pnpm workspace), `cargo` (`/src-tauri`, matching Tauri's convention for where `Cargo.toml` lands), and `github-actions` (`.github/workflows`, for the future CI from Story 1.4)
  - [x] These ecosystems have no manifests yet (app scaffold is Story 1.2, CI workflow is Story 1.4) — this is expected; Dependabot reports "no dependencies found" for an ecosystem until its manifest exists, it does not error
- [x] Task 4: Configure branch protection on `main` (AC: 4)
  - [x] Apply the branch protection ruleset via `gh api` exactly as specified in Dev Notes (no direct pushes, PR required, 0 required approvals so self-review is sufficient, admins included)
  - [x] Do NOT require status checks yet — Story 1.4 adds the CI workflow and must re-PUT the full protection payload (all fields from Dev Notes, not just `required_status_checks`) to add the required check names at that time — this endpoint has no partial-update method
  - [x] Verify with `gh api repos/dipaneb/umbra/branches/main/protection` and confirm it no longer returns 404

### Review Findings

- [x] [Review][Decision] AC4 branch protection has no checked-in reproduction artifact — Resolved: no script needed; the exact `gh api` command documented in this story's Dev Notes is sufficient per this project's convention for one-time repo settings.
- [x] [Review][Patch] Dependabot `cargo` directory will silently miss the future Tauri manifest [.github/dependabot.yml:8-11]
- [x] [Review][Patch] Dev Notes tell Story 1.4 to "PATCH" a branch-protection endpoint that only supports full-replace PUT [1-1-a-governed-public-repository.md:39,118,169]
- [x] [Review][Patch] Task 2 checkbox and Change Log claim a commit was made that doesn't exist yet in git history [1-1-a-governed-public-repository.md:32,148,201]
- [x] [Review][Patch] Dev Agent Record's File List omits sprint-status.yaml and the story file itself [1-1-a-governed-public-repository.md:172-174]
- [x] [Review][Patch] "Self-reviewed PRs" rationale for `required_approving_review_count: 0` is imprecise and has no note for a future second contributor [1-1-a-governed-public-repository.md:120]
- [x] [Review][Patch] Redundant inline comment on sprint-status.yaml's last_updated line duplicates structurally-tracked info [sprint-status.yaml:44]
- [x] [Review][Patch] `dismiss_stale_reviews: false` set without rationale, breaking the story's field-by-field justification pattern [1-1-a-governed-public-repository.md:104,157]

## Dev Notes

- This is the first story of Epic 1 and the first story implemented overall — there is no application code yet (scaffold arrives in Story 1.2). Scope here is strictly repo governance: license, README, commit hygiene, dependency automation, branch protection.
- **Verified current repo state (do not re-derive, do not redo already-done work):**
  - Remote: `git@github.com:dipaneb/umbra.git`, GitHub repo `dipaneb/umbra`, **already public**, default branch `main`.
  - `LICENSE` (root) already contains:
    ```
    All Rights Reserved

    Copyright (c) 2026 dipaneb

    This source code is made publicly viewable for portfolio and evaluation
    purposes only. No permission is granted to any person to use, copy,
    modify, merge, publish, distribute, sublicense, and/or sell copies of
    this software, or to permit persons to whom the software is furnished
    to do so, in whole or in part, without the prior written consent of
    the copyright holder.

    All rights not expressly granted herein are reserved.
    ```
    This satisfies NFR7 and AC1's license clause exactly. Do not touch it.
  - `README.md` (root) already opens with "A privacy-first developer toolbox for macOS — your data never leaves your machine" (the privacy promise) and has a "How this was planned: BMad Method" section describing the planning process. This satisfies AC1's README clause. Do not touch it.
  - Commit history so far (`git log`, oldest first): `chore: initial commit`, `docs: add BMad planning artifacts and process documentation` — both already Conventional-Commits-compliant.
  - `.github/` directory **does not exist yet** — no dependabot config, no workflows.
  - Branch protection on `main` **is not configured** (`gh api repos/dipaneb/umbra/branches/main/protection` currently returns `404 Branch not protected`) — this is the main gap this story closes.
  - `gh` CLI is authenticated with admin permissions on this repo (verified via `gh api repos/dipaneb/umbra`).
- **What this story actually adds:** `.github/dependabot.yml`, plus a branch protection rule on `main` applied via the GitHub API (a repository *setting*, not a file — there is nothing to commit for this part beyond the story/process notes).

### `.github/dependabot.yml` — exact content to create

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "cargo"
    directory: "/src-tauri"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

Three ecosystems are declared now even though their manifests (`package.json`/`pnpm-lock.yaml`, `Cargo.toml`, `.github/workflows/*.yml`) don't exist until Stories 1.2–1.4 — this is intentional, front-loading governance per this story's purpose. Dependabot silently finds nothing to update for an ecosystem with no manifest; it does not fail the config. `cargo`'s `directory` is set to `/src-tauri` ahead of time, matching where Tauri's scaffold (Story 1.2) will place `Cargo.toml` — not repo root. `github-actions`'s `directory` is the repo root regardless (unlike npm/cargo it always scans `.github/workflows` regardless of the directory value, but root is the documented default).

### Branch protection — exact command to run

Apply via a JSON payload (nested objects aren't reliably expressible with repeated `-f`/`-F` flags on this endpoint, so use `--input`):

```bash
cat > /tmp/branch-protection.json <<'EOF'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false
}
EOF
gh api --method PUT repos/dipaneb/umbra/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input /tmp/branch-protection.json
```

Rationale for each field:
- `required_status_checks: null` — no CI exists yet (Story 1.4 builds it); do not fabricate check names that don't exist, that would make every PR permanently unmergeable. Story 1.4 must re-PUT the full protection payload (every field here, not just `required_status_checks`) to add its check names once CI exists — this endpoint has no partial-update (PATCH) method; a PUT with only `required_status_checks` set would silently reset every other field below to its default.
- `enforce_admins: true` — the developer's own GitHub account is a repo admin; without this, admin pushes would bypass protection entirely and AC4's "no direct pushes" would be unenforced for the one person who actually pushes.
- `required_pull_request_reviews.required_approving_review_count: 0` — no reviewer approval is required at all (GitHub doesn't count the author's own approval toward this count regardless of the setting); this still enforces AC4's "no direct pushes" via the PR-required gate, just without a review checkpoint, matching AC4's "self-reviewed pull requests" (this is a solo project). Revisit if a second contributor ever joins this repo.
- `dismiss_stale_reviews: false` — moot while `required_approving_review_count: 0` means no reviews are required in the first place, but left explicit rather than relying on the API default.
- `restrictions: null` — no push-access restriction list needed; there's only one contributor.
- `allow_force_pushes: false`, `allow_deletions: false` — standard protected-branch hygiene, not explicitly in the AC text but implied by "protected default branch"; prevents history rewrites on `main`.

This is a **shared, repo-wide GitHub setting change** (not a local git operation) — flag it to the user before running rather than executing silently, per this project's standing caution around irreversible/shared-state actions.

### Project Structure Notes

- Matches the architecture spine's Structural Seed exactly: `LICENSE` at root, `.github/dependabot.yml` under `.github/`. [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — Structural Seed section]
- No conflicts detected — this story only adds one new file (`dependabot.yml`) and one GitHub setting; it touches nothing else in the tree.
- `.github/workflows/ci.yml` is explicitly **out of scope** here — it's Story 1.4's deliverable. Do not create a placeholder workflow file in this story.

### Testing Requirements

- No automated test suite applies to repo-governance config (no code to unit test). Verify manually:
  - `git log --format='%s'` — every subject line matches Conventional Commits format.
  - `cat .github/dependabot.yml` — valid YAML, matches the content above exactly.
  - `gh api repos/dipaneb/umbra/branches/main/protection` — returns 200 with the fields set above, not 404.
  - Attempt a direct push to `main` from a local clone (or trust the API confirmation above) — should be rejected once protection is live.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.1: A governed, public repository, and the "Note on Story 1.1's split (2026-07-22)"]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — NFR6 (Repo as exhibit), NFR7 (License)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — Structural Seed, Consistency Conventions table ("Commits & releases", "Dependency hygiene")]

## Change Log

- 2026-07-22: Verified existing LICENSE/README/commit history satisfy AC1/AC2; added `.github/dependabot.yml` (AC3); applied branch protection to `main` via GitHub API (AC4). Story moved to review.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Verified `LICENSE` and `README.md` already satisfied AC1 (both pre-existing from prior commits) — no changes made to either.
- Verified pre-existing commit history (`chore: initial commit`, `docs: add BMad planning artifacts and process documentation`) already complies with Conventional Commits.
- Created `.github/dependabot.yml` (npm, cargo, github-actions ecosystems, weekly) per Dev Notes' exact content; parsed with a YAML loader to confirm validity.
- Confirmed with user before making a shared GitHub repo-setting change (branch protection is not a local file edit).
- Applied branch protection to `main` via `gh api --method PUT repos/dipaneb/umbra/branches/main/protection` with the exact payload from Dev Notes (enforce_admins: true, required_approving_review_count: 0, no required status checks yet, force-push/deletion disabled).
- Verified via `gh api repos/dipaneb/umbra/branches/main/protection` (GET) — returns 200 with the expected settings, no longer 404.

### Completion Notes List

- AC1 (license/README) and AC2 (Conventional Commits) were already satisfied by prior commits; verified, not re-implemented.
- AC3 satisfied by adding `.github/dependabot.yml` covering npm/cargo/github-actions ecosystems ahead of their manifests existing (intentional per story — Dependabot silently finds nothing until Stories 1.2/1.4 add those manifests).
- AC4 satisfied by applying branch protection to `main` (PR required, 0 required approvals for self-review, admins enforced, no force-push/deletion). Required status checks deliberately left null — Story 1.4 must re-PUT the full protection payload once CI exists (this endpoint has no partial-update method).
- No automated tests apply to this story (pure repo-governance config); verification was manual per the story's Testing Requirements section.

### File List

- `.github/dependabot.yml` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-1-a-governed-public-repository.md` (new)
