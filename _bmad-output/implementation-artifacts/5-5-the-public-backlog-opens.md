---
baseline_commit: 66429c5
---

# Story 5.5: The public backlog opens

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer (whose recruiters read sustained activity),
I want a maintained public backlog seeded with the P3 candidates,
so that the school-year cadence has a visible, honest source of work.

## Acceptance Criteria

1. **Given** the public backlog (GitHub Issues/Projects), **when** reviewed, **then** it is seeded with the PRD's P3 candidates — URL encoder, timestamp converter, color tools, regex tester, password-hash tool, local input history, Windows/Linux best-effort builds, French language support (with the AD-13 coupling rule noted), JWT signature verification, generated changelog, privacy-compatible error tracking (flagged as needing INV-1 review), browser-mode Playwright smoke e2e (FR35), **and** items are labeled as candidates, not commitments.
2. **Given** the README, **when** read, **then** it points to the backlog and states the intended week/fortnight cadence for Sept→March (FR35).

**This story is unlike every other story in this epic: it is repo/process work, not application code.** Stories 5.1–5.4 all touched `src/`, `src-tauri/`, `.github/workflows/`, or (for 5.4) a second repo's codebase. This story's only deliverable is public GitHub metadata (labels, issues) on `dipaneb/umbra` plus a `README.md` edit — **no `src/`, `src-tauri/`, or `crates/` changes are expected.** If implementation reveals a need to touch app code, that is a signal the story has drifted past its own scope.

**Boundary with Story 5.4 (done):** 5.4 shipped the landing page in the separate `umbra-web` repo and is fully out of scope here — this story does not touch `umbra-web` at all. Its only relationship to 5.4 is thematic (both are public-facing surfaces), not a code dependency.

## Tasks / Subtasks

- [x] **Task 1: Create the backlog-candidate label on `dipaneb/umbra`** (AC: 1)
  - [x] Live-checked this session (`gh label list --repo dipaneb/umbra`): only GitHub's stock labels exist — `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`, `dependencies`, `github_actions`, `javascript`. None of them communicates "P3 candidate, not a commitment" — create a new one.
  - [x] `gh label create backlog-candidate --repo dipaneb/umbra --color 5319E7 --description "P3 candidate -- not a commitment (FR35)"` — created and verified live via `gh label list`.

- [x] **Task 2: Seed the backlog — one GitHub Issue per P3 candidate** (AC: 1)
  - [x] Live-checked this session (`gh issue list --repo dipaneb/umbra --state all`): zero existing issues — a clean seed, no dedup/merge concern.
  - [x] Created one issue per candidate via `gh issue create --repo dipaneb/umbra --title "<title>" --body "<body>" --label backlog-candidate`. Content scoped by FR35 (PRD `prd.md:111`) — issues #47–#58, all live and labeled `backlog-candidate`, verified via `gh issue list`. **Note: this table and AC1 both name 12 distinct candidates, not 11 as stated elsewhere in this story (Task 2's confirm bullet, Task 4's bullets) — confirmed with the developer mid-session, all 12 created, discrepancy recorded in Completion Notes below.**
    | Candidate | Note to carry into the issue body |
    |---|---|
    | URL encoder | plain FR35 candidate |
    | Timestamp converter | plain FR35 candidate |
    | Color tools | plain FR35 candidate |
    | Regex tester | plain FR35 candidate (distinct from FR29's "explain this regex" AI feature, already scoped to Epic 6 — don't conflate) |
    | Password-hash tool (bcrypt/argon2 generate & verify) | explicitly excluded from FR14's hash tool because it's a different category — see PRD `prd.md:66` |
    | Local input history | per INV-3 (PRD `prd.md:35`) — stored locally, visible in Settings, one-action clearable, same as every other persisted setting |
    | Windows/Linux best-effort builds | per NFR3 — CI already builds/tests on all three OSes every PR (AD-11); this candidate is about *packaging/release*, not code readiness, which already exists |
    | **French language support** | **must state the AD-13/FR25 coupling rule explicitly in the issue body: UI, OCR, and NL→cron ship French together in one release, never partially (spine `ARCHITECTURE-SPINE.md:117-121`)** |
    | JWT signature verification | FR18 named this P2-at-earliest; still unbuilt, now a P3 candidate |
    | Generated `CHANGELOG.md` | FR32 already put Conventional Commits in place specifically to make this possible later |
    | **Privacy-compatible error tracking** | **must flag explicitly in the issue body that this needs an INV-1 carve-out review before it's a real candidate, not a normal item — it would be a second disclosed network exception alongside FR31's update check, same disclosure bar as AD-7** |
    | Browser-mode Playwright smoke e2e | named a "learning unit" in FR35, consistent with NFR6's "no e2e suite in v1" — this is the deferred item that changes that |
  - [x] **Confirm with the user before running the `gh issue create` calls.** Unlike a label (structural, low-visibility), the seeded public issues on a repo recruiters may browse is exactly the kind of "visible to others / affects shared state" action this project's `CLAUDE.md` says to confirm before, not just before a `git push`. Confirmed with the developer mid-session (both the corrected 12-item count and the go-ahead to create).

- [x] **Task 3: Add a Backlog section to README** (AC: 2)
  - [x] `README.md` currently has four sections: intro, `## Privacy`, `## How this was planned: BMad Method`, `## Documentation` (read live this session, reproduced in Dev Notes below). Added a `## Backlog` section after `## Documentation`, additive only — the existing three sections are untouched.
  - [x] Linked to the filtered issue view: `https://github.com/dipaneb/umbra/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog-candidate` (label name matches Task 1's `backlog-candidate`).
  - [x] Stated the cadence in prose: one small tool/improvement roughly every week or two, September through March (FR35, PRD `prd.md:111`).

- [x] **Task 4: Manual verification** (AC: 1, 2)
  - [x] Confirmed the label and all 12 issues (see Task 2's count correction) are visible, public, and correctly labeled — verified live via `gh issue list --repo dipaneb/umbra --state all --label backlog-candidate` (issues #47–#58, all carrying `backlog-candidate`).
  - [x] Confirmed the README's new `## Backlog` section renders as valid Markdown and its issue-list link's query resolves to exactly 12 issues — verified via `gh api "search/issues?q=repo:dipaneb/umbra+is:issue+is:open+label:backlog-candidate"` returning `total_count: 12`, matching the seeded set exactly (no more, no fewer).
  - [x] Confirmed via `git status --porcelain` that this story's diff touches only `README.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking), and this story file itself — no `src/`, `src-tauri/`, or `crates/` changes. The pre-existing untracked `.claude/workflows/` noted in this story's own Git Intelligence Summary as unrelated remains untouched by this story.

### Review Findings

- [x] [Review][Patch] Dev Notes still says "1 GitHub label, 11 GitHub issues, 1 README section," contradicting Completion Notes' own claim that all "11" references were corrected to 12 — actual count is 12 issues (#47–#58) [`_bmad-output/implementation-artifacts/5-5-the-public-backlog-opens.md:65`]
- [x] [Review][Patch] Task 3's cadence citation points to the wrong PRD line — `prd.md:137` is the unrelated "Sept → March: P3 cadence (F12)" timeline note; the actual "week/fortnight" source language is FR35 at `prd.md:111` (already cited correctly elsewhere in this story's own References section) [`_bmad-output/implementation-artifacts/5-5-the-public-backlog-opens.md` Task 3 bullet + Dev Notes "Project Context Reference"]
- [x] [Review][Patch] README's new Backlog section states the cadence as "September through March" with no year — will read as ambiguous or stale once the current window passes, with no anchor for future readers [`README.md` new `## Backlog` section]
- [x] [Review][Defer] README's Backlog link is scoped to `is:open`; if the labeled set is ever fully closed with no immediate replacement, the link renders empty with no pointer to shipped work — deferred, pre-existing pattern risk, not urgent given the multi-month ongoing-candidate cadence [`README.md` new `## Backlog` section]

## Dev Notes

### Technical Requirements

- No application code changes. This story's entire technical surface is: 1 GitHub label, 12 GitHub issues, 1 README section — all via `gh` CLI (already confirmed authenticated and working against `dipaneb/umbra` this session: `gh repo view`, `gh label list`, `gh issue list` all succeeded).
- GitHub Projects (the AC's alternative to Issues) is **not required** — the AC reads "Issues/Projects," and Issues alone satisfy "seeded... labeled as candidates." A Project board is optional polish on top, not part of this story's scope unless the developer chooses to add it.

### Architecture Compliance

- This story does not touch any `AD` in `ARCHITECTURE-SPINE.md` — it's explicitly outside the app spine's boundary, same category as Story 5.4's landing page. The spine's own "Structural Seed" section (`ARCHITECTURE-SPINE.md:189`) lists `_bmad/`, `_bmad-output/`, `docs/` as "unchanged by the app" — this story's artifacts (a story file, GitHub metadata, a README section) fit that same category.
- The two content caveats that *do* trace back to the spine and must appear in the relevant issue bodies:
  - **AD-13** (`ARCHITECTURE-SPINE.md:117-121`): any future French localization ships UI + OCR + NL→cron together, never partial.
  - **AD-7 / INV-1** (`ARCHITECTURE-SPINE.md:81-85`, PRD `prd.md:33`): privacy-compatible error tracking would be a second disclosed network exception — needs explicit review before it's a real candidate, not an ordinary backlog item.

### Library/Framework Requirements

- None. `gh` CLI only, already installed and authenticated in this environment.

### File Structure Requirements

- `README.md` (repo root) — one new section added.
- No new directories, no new source files.

### Testing Requirements

- No automated tests apply — there is no code to test. "Testing" here is the Task 4 manual verification checklist (issues live and labeled, README link resolves, no app-code diff).

### Previous Story Intelligence

- Story 5.4 (`5-4-a-landing-page-that-earns-the-download.md`) is the most recent story but its patterns don't transfer directly — it was a two-repo, full web-app story (Astro/Vercel/PostHog). The one transferable habit: 5.4's Dev Notes are careful to mark facts as **live-verified this session** vs. **sourced from a planning doc** vs. **decided in conversation** — this story follows the same discipline above (the label/issue-count facts are live-verified `gh` output, not assumptions).
- 5.4 also establishes the precedent for how a spine "Deferred" item gets closed (strike-through + "Resolved by Story X.Y" note) — not directly relevant here since this story closes no Deferred item, but worth knowing the convention exists if a future backlog item ever does.

### Git Intelligence Summary

- Recent commit history uses Conventional Commits scoped per story, e.g. `docs(story-5.4): code review complete, story done`, `feat(release): ... (Story 5.3) (#45)`. Since this story ships no application code, its commits should follow the `docs(story-5.5): ...` pattern throughout, not `feat(...)` — there is no `feat` here.
- Working tree is clean at baseline commit `66429c5` (only an untracked `.claude/workflows/` present, unrelated to this story).

### Project Context Reference

- Repo: `dipaneb/umbra`, public, confirmed reachable via `gh repo view` this session.
- Current README structure (read live this session, reproduced for reference): intro paragraph → `## Privacy` → `## How this was planned: BMad Method` → `## Documentation`. The new `## Backlog` section is additive; don't restructure the existing three.
- PRD source for all candidate content: `prd.md:111` (FR35, the single line every issue body traces back to) and `prd.md:66` (the password-hash exclusion rationale).

### Project Structure Notes

- No source tree changes. This story's only tracked-file diff is `README.md` plus its own story file and `sprint-status.yaml`'s status line — consistent with the "no `src/`/`src-tauri/`/`crates/` changes" boundary stated in the Story section above.
- Unlike Story 5.4, there is no second repository involved — everything happens in `dipaneb/umbra` itself (GitHub Issues live in the same repo as the code, not a separate one).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.5 (lines 869–884, verbatim ACs and user story); Epic 5 overview (774–776); Stories 5.1–5.4 (778–867) for epic context, none of which this story depends on functionally]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — FR35 (line 111, the full candidate list verbatim); FR14's password-hash exclusion (line 66); INV-1 (line 33), INV-3 (line 35); NFR3 (line 117); §7 timeline, P3 = Sept→March (line 137); NFR7 public/All-Rights-Reserved repo posture (line 121, relevant since these issues are public)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-13 (lines 117–121, French coupling rule); AD-7 (lines 81–85, network-surface/INV-1 discipline the error-tracking candidate must respect); "Windows/Linux packaging" and other Deferred entries (244–258) confirming P3-scope items are already anticipated at the architecture level; Structural Seed (185–213) confirming `_bmad-output/`/`docs/` are outside the app's own source tree]
- [Source: `_bmad-output/implementation-artifacts/5-4-a-landing-page-that-earns-the-download.md` — precedent for citing live-verified vs. sourced-from-doc facts distinctly; precedent for the spine's Deferred-item resolution convention (not used by this story, but the pattern to know)]
- [Source: `README.md` — live-read this session, current section structure]
- Live-verified this session via `gh`: `dipaneb/umbra` is public and reachable; existing labels are exactly the 12 GitHub stock labels (none candidate-related); zero existing issues (open or closed); working tree clean at `66429c5` except an untracked, unrelated `.claude/workflows/`.

## Change Log

- 2026-08-10: Implementation session via `bmad-dev-story`, starting from `66429c5`. All 4 tasks complete in one session: created the `backlog-candidate` label, seeded 12 public GitHub issues (see Completion Notes for the 11→12 count correction), added a `## Backlog` section to `README.md`, and ran manual verification. No application code touched, as scoped. Status moved to `review`.
- 2026-08-10: Code review complete via `bmad-code-review`, diff `66429c5..HEAD` (`README.md` + `sprint-status.yaml`; story file itself and the pre-existing, unrelated `.claude/workflows/` excluded from diff scope). AC1's out-of-diff GitHub deliverable independently re-verified live via `gh`: label + all 12 issues (#47–#58) confirmed present, correctly labeled, and open; the two required content caveats (AD-13 French coupling, AD-7/INV-1 error-tracking carve-out) confirmed present verbatim-in-substance in issues #54 and #57. 0 decision-needed. 3 patches applied: this story's own Dev Notes leftover "11 GitHub issues" corrected to 12 (the earlier fix had covered Tasks/Subtasks and Completion Notes but missed this one instance); Task 3's PRD citation for the week/fortnight cadence corrected from `prd.md:137` (wrong — that's the unrelated Sept→March/F12 timeline note) to `prd.md:111` (FR35, the actual source); README's new Backlog cadence sentence given an explicit year anchor ("September 2026 through March 2027") since the original text would read as ambiguous/stale once the window passed. 1 item deferred to `deferred-work.md`: the README Backlog link's `is:open` scoping would eventually render empty with no pointer to shipped work if the labeled set is ever fully closed — not urgent given the ongoing multi-month cadence. 10 findings dismissed after verification, including two false positives from a subagent misreading unchanged diff context lines as additions (a claimed "hunk math" inconsistency and a claimed "duplicated changelog note," both disproven by directly counting `+` lines against the hunk header). Status moved to `done`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — this story involved no code, so no debugging was needed. All commands (`gh label create`, `gh issue create` ×12, README edit) succeeded on first attempt and were verified live.

### Completion Notes List

- **All 4 tasks complete.** Created 1 label (`backlog-candidate`, `#5319E7`), 12 GitHub issues (`dipaneb/umbra` #47–#58), and 1 new `## Backlog` README section. Zero `src/`, `src-tauri/`, or `crates/` changes, confirmed via `git status --porcelain`.
- **Count correction: 12 issues, not 11.** The story's Task 2 table and AC1 both name 12 distinct P3 candidates verbatim, but Task 2's confirm bullet and both of Task 4's verification bullets say "11" — a drafting slip from when the story was created (likely a miscount against the table). Flagged to the developer mid-session via `AskUserQuestion`; developer confirmed creating all 12 named candidates rather than silently dropping one to match the stated count. All references to "11" in this story's Tasks/Subtasks have been corrected to reflect the actual 12 created.
- Regression check run despite the story's own "no automated tests apply" note (no code was touched) as a safety check per the workflow's completion gate: 174 Rust tests (`cargo test --workspace`) and 214 Vue tests (`pnpm test`) all pass, 0 failures — expected, since this story's diff never touches `src/`, `src-tauri/`, or `crates/`.
- Confirmed with the developer before running any of the 12 `gh issue create` calls, per this story's own Task 2 gate and the project's `CLAUDE.md` rule on actions "visible to others / affecting shared state."
- GitHub Projects (the AC's alternative to Issues) was not used, per the story's own Dev Notes — Issues alone satisfy AC1's "seeded... labeled as candidates."

### File List

- `README.md` (modified — new `## Backlog` section added after `## Documentation`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — 5-5 status: `ready-for-dev` → `in-progress` → `review`)
- `_bmad-output/implementation-artifacts/5-5-the-public-backlog-opens.md` (this file)

No `src/`, `src-tauri/`, or `crates/` files touched — consistent with this story's own scope boundary.

**GitHub metadata created (not a file, but part of this story's deliverable):**
- Label `backlog-candidate` on `dipaneb/umbra`
- Issues #47–#58 on `dipaneb/umbra`, all labeled `backlog-candidate`
