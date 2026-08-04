---
baseline_commit: 806bb53
---

# Story 3.3: The phrase corpus as an automated acceptance gate

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer (whose repo is the exhibit and whose honesty bar needs teeth),
I want the canonical phrase corpus running as a test suite that fails the build on regression,
so that FR21 is enforced by CI, not by good intentions.

## Acceptance Criteria

1. **Given** the corpus test suite in `umbra-core` (part of `cargo test -p umbra-core`), **when** it runs, **then** at least 30 must-convert phrases assert their exact expected cron expressions (FR21, AD-9). **Caveat — read before starting:** epics.md's wording ("from the addendum's seed set") refers to `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/addendum.md`, which **does not exist anywhere in this repository** — confirmed by repo-wide search during both this story's creation and Story 3.2's (see Previous Story Intelligence below). There is no seed set to pull from. This story originates the corpus itself, grounded in the grammar actually implemented in `crates/umbra-core/src/cron.rs` by Story 3.2 — not a fictional source document. Do not spend time searching for the addendum again.
2. **Given** the must-honestly-fail set, **when** the suite runs, **then** at least 10 inexpressible or ambiguous phrases (e.g. "every third Friday of the month", "every 90 seconds") assert an honest failure — silent approximations explicitly fail the test (FR21).
3. **Given** the reverse direction, **when** the suite runs, **then** every must-convert phrase's generated expression round-trips: `describe(&expression)` reproduces the exact same description the corpus asserts (FR20 contract, AD-9). **Deliberate reinterpretation, same spirit as AC1's caveat:** epics.md's literal wording is "round-trips cron→English→cron unchanged," but no generic English→cron function exists (nor should one — `parse_schedule` only understands the narrow grammar, not arbitrary English), so a literal third leg back to cron is impossible to write. `describe(&expression) == expected_description` is the actual testable content of that requirement and is what Task 4 below implements.
4. **Given** any corpus regression, **when** CI runs on a PR, **then** the build fails (AD-9) — and the corpus grows with every phrasing bug report as a stated maintenance rule (document this rule in-code, next to the corpus data).

## Tasks / Subtasks

- [ ] **Task 1: Confirm scope before writing anything (AC: all)**
  - [ ] This is a **test-only story**. No new `pub` function, no new `ToolError` code, no new Tauri command, no `CronView.vue` change, no registry change, no `Cargo.toml` change. Everything this story needs — `parse_schedule`, `describe`, all `cron-nl-*` error codes — already exists in `crates/umbra-core/src/cron.rs` after Story 3.2. Re-confirm this by reading that file in full before starting (Task 2 depends on knowing its exact current grammar and existing test coverage).
  - [ ] Confirm AD-11's existing CI wiring already covers this story's gate with zero changes: `.github/workflows/ci.yml`'s `cargo test --workspace` step runs on `ubuntu-latest`, `windows-latest`, and `macos-latest`, all three as required status checks. `cargo test -p umbra-core` (the AC's own wording) is a subset of `cargo test --workspace` — the corpus becomes a required CI gate automatically the moment it exists as `#[test]` functions in `crates/umbra-core/src/cron.rs`. **Do not add a new CI job, workflow step, or separate `cargo test -p umbra-core` invocation** — that would be redundant with what already runs, and no story before this one has needed a story-specific CI change for a plain `#[test]` addition.

- [ ] **Task 2: The must-convert corpus (AC: 1) — ≥30 phrases, every grammar branch covered at least once**
  - [ ] Add a data table (a `const`/`static` array of `(phrase, expected_expression, expected_description)` tuples, or one array per column — either is fine) inside `crates/umbra-core/src/cron.rs`'s existing `#[cfg(test)] mod tests` block. Do not create a new file or module outside `cron.rs` — every other cron test lives in this one file/module, and this corpus is not an exception.
  - [ ] **Cover every branch of Story 3.2's Task 3 grammar at least once** — the grammar is deliberately narrow (see Previous Story Intelligence below for the exact scope boundary), so the corpus is finite and enumerable, not a sample of an open-ended space:
    - Every individual weekday name, fixed time, both AM and PM (7 phrases minimum: one per weekday).
    - `"every day"` and `"every weekday"`, each with a fixed time.
    - A 2-item weekday list (`"and"`-joined, no comma) and a 3+-item weekday list (comma + `"and"`-joined) — both at a fixed time.
    - Bare step-time phrases with no day clause (`"every N minutes"`, `"every N hours"`) — these implicitly mean "every day" per Story 3.2's Completion Notes.
    - A day clause combined with a step-time clause (`"<day clause>, every N minutes"` and `"<day clause> every N minutes"` — comma optional, per Task 3's grammar) — this is a distinct code path through `try_parse_full` from the bare-step fallback above; do not skip it as "redundant" with the bare form.
    - Both minute-step and hour-step forms, including the `step == 1` special-case wording (`"every hour"`, not `"every 1 hours"`).
    - Midnight/noon boundaries (`12am` → hour 0, `12pm` → hour 12 — a classic off-by-12 bug class).
    - The `am`/`pm` marker variants: with and without a leading space, and the dotted `a.m.`/`p.m.` forms — all four are accepted by `parse_ampm` and must each appear at least once.
  - [ ] **Illustrative starter set (31 phrases — adjust freely, but do not drop below 30 or skip a bullet above).** Verify each by hand-tracing `crates/umbra-core/src/cron.rs`'s actual parsing/describing functions before trusting it, the same way Story 3.1/3.2's own illustrative snippets required verification — this list was traced against the code as of this story's creation but is not a substitute for running `cargo test` yourself:

    | Phrase | Expected expression | Expected description |
    | --- | --- | --- |
    | `"every Monday at 9am"` | `0 9 * * 1` | `Every Monday, at 9:00 AM` |
    | `"every Tuesday at 10am"` | `0 10 * * 2` | `Every Tuesday, at 10:00 AM` |
    | `"every Wednesday at 2pm"` | `0 14 * * 3` | `Every Wednesday, at 2:00 PM` |
    | `"every Thursday at 11:30am"` | `30 11 * * 4` | `Every Thursday, at 11:30 AM` |
    | `"every Friday at 5pm"` | `0 17 * * 5` | `Every Friday, at 5:00 PM` |
    | `"every Saturday at 8am"` | `0 8 * * 6` | `Every Saturday, at 8:00 AM` |
    | `"every Sunday at 7pm"` | `0 19 * * 0` | `Every Sunday, at 7:00 PM` |
    | `"every day at 9pm"` | `0 21 * * *` | `Every day, at 9:00 PM` |
    | `"every day at 12am"` | `0 0 * * *` | `Every day, at 12:00 AM` |
    | `"every day at 12pm"` | `0 12 * * *` | `Every day, at 12:00 PM` |
    | `"every weekday at 8:30am"` | `30 8 * * 1-5` | `Every weekday, at 8:30 AM` |
    | `"every weekday at 6:15pm"` | `15 18 * * 1-5` | `Every weekday, at 6:15 PM` |
    | `"every weekday at 12am"` | `0 0 * * 1-5` | `Every weekday, at 12:00 AM` |
    | `"every weekday at 12pm"` | `0 12 * * 1-5` | `Every weekday, at 12:00 PM` |
    | `"every Monday, Wednesday, and Friday at 6am"` | `0 6 * * 1,3,5` | `Every Monday, Wednesday, and Friday, at 6:00 AM` |
    | `"every Tuesday and Thursday at 7:45am"` | `45 7 * * 2,4` | `Every Tuesday and Thursday, at 7:45 AM` |
    | `"every Saturday and Sunday at 10am"` | `0 10 * * 6,0` | `Every Saturday and Sunday, at 10:00 AM` |
    | `"every Monday, Tuesday, Wednesday, and Thursday at 9am"` | `0 9 * * 1,2,3,4` | `Every Monday, Tuesday, Wednesday, and Thursday, at 9:00 AM` |
    | `"every 15 minutes"` | `*/15 * * * *` | `Every day, every 15 minutes` |
    | `"every 2 hours"` | `0 */2 * * *` | `Every day, every 2 hours` |
    | `"every 5 minutes"` | `*/5 * * * *` | `Every day, every 5 minutes` |
    | `"every 30 minutes"` | `*/30 * * * *` | `Every day, every 30 minutes` |
    | `"every 1 hour"` | `0 */1 * * *` | `Every day, every hour` |
    | `"every 59 minutes"` | `*/59 * * * *` | `Every day, every 59 minutes` |
    | `"every weekday, every 15 minutes"` | `*/15 * * * 1-5` | `Every weekday, every 15 minutes` |
    | `"every weekday every 10 minutes"` (no comma) | `*/10 * * * 1-5` | `Every weekday, every 10 minutes` |
    | `"every day, every 30 minutes"` | `*/30 * * * *` | `Every day, every 30 minutes` |
    | `"every Monday every 2 hours"` (no comma — see gotcha below) | `0 */2 * * 1` | `Every Monday, every 2 hours` |
    | `"every Sunday at 3 pm"` (space before marker) | `0 15 * * 0` | `Every Sunday, at 3:00 PM` |
    | `"every Monday at 6 a.m."` (dotted marker) | `0 6 * * 1` | `Every Monday, at 6:00 AM` |
    | `"every Tuesday at 9 p.m."` (dotted marker) | `0 21 * * 2` | `Every Tuesday, at 9:00 PM` |

  - [ ] For each row, the test must assert **both** the exact `expression` and the exact `description` returned by `parse_schedule(phrase)` — not just that the call succeeded. A wrong-but-plausible cron expression with a correct-looking description (or vice versa) is exactly the failure mode AD-9 exists to catch; asserting only one field would let the other silently drift.

- [ ] **Task 3: The must-honestly-fail corpus (AC: 2) — ≥10 phrases, each with its expected `ToolError.code`**
  - [ ] Add a second data table, same location, of `(phrase, expected_code)` pairs (or `(phrase, expected_code, must_not_contain)` if you want a per-row custom leak-check string — a shared default like `"* *"` is enough for most rows).
  - [ ] **Every phrase must be genuinely inexpressible or ambiguous under the grammar** — not just something the current parser happens not to handle. Story 3.2's Task 3 explicitly scoped these vocabulary categories **out of the grammar** (re-read that story's Dev Notes if you need the full reasoning): business-hours compounds (minute-step + hour-range, e.g. "every 5 minutes from 9 to 5" — `describe()` can render this shape from a raw cron string, but Story 3.2 deliberately built no NL parsing for it), day-of-month/month phrases ("on the 1st", "on January 1st"), and any `L`/`W`/`#`-equivalent English ("last Friday of the month", "the 3rd Tuesday"). Phrases from these categories are the corpus's core content, not edge cases.
  - [ ] **Illustrative starter set (13 phrases — includes both examples epics.md names explicitly, which must appear verbatim):**

    | Phrase | Expected `ToolError.code` |
    | --- | --- |
    | `""` (empty) | `cron-nl-empty-phrase` |
    | `"at 9"` (FR21's own named ambiguity example) | `cron-nl-ambiguous-time` |
    | `"every weekday at 8:30"` (day clause + ambiguous time) | `cron-nl-ambiguous-time` |
    | `"tous les lundis à 9h"` (non-English, AC4/FR22) | `cron-nl-unrecognized` |
    | `"every third Friday of the month"` (epics.md's own named example — ordinal, out of grammar) | `cron-nl-unrecognized` |
    | `"every 90 seconds"` (epics.md's own named example — seconds unsupported) | `cron-nl-unrecognized` |
    | `"every 5 minutes from 9 to 5"` (business-hours compound, out of grammar) | `cron-nl-unrecognized` |
    | `"on the 1st"` (day-of-month, out of grammar) | `cron-nl-unrecognized` |
    | `"on January 1st"` (month phrase, out of grammar) | `cron-nl-unrecognized` |
    | `"every 90 minutes"` (step exceeds the 0-59 minute field range — must not silently approximate to hourly) | `cron-nl-unrecognized` |
    | `"every 30 hours"` (step exceeds the 0-23 hour field range — must not silently approximate to daily) | `cron-nl-unrecognized` |
    | `"every weekday"` (day clause with no time) | `cron-nl-unrecognized` |
    | `"asdfasdf"` (garbage) | `cron-nl-unrecognized` |

  - [ ] For each row, assert the exact `code`, that `message` is non-empty, and — reusing the existing convention already established in Story 3.2's tests (e.g. `parse_schedule_non_english_input_returns_cron_nl_unrecognized`) — that neither `message` nor `context` contains a literal cron-looking string (`"* *"` is the existing project convention for this check). This is the concrete test for AC2's "silent approximations... explicitly fail the test" — a `cron-nl-unrecognized`/`cron-nl-ambiguous-time` result structurally carries no `expression` field at all (`ScheduleParseResult` is never constructed on the `Err` path), so the real risk this guards against is a leaked partial expression inside the *message text* of an otherwise-honest failure, not a returned `Ok` with a wrong value.

- [ ] **Task 4: The round-trip test (AC: 3)**
  - [ ] Generalize Story 3.2's existing single-phrase test (`parse_schedule_result_expression_re_describes_to_the_same_description`, currently only covering `"every weekday at 8:30am"`) into a loop over Task 2's full must-convert corpus: for every `(phrase, expected_expression, expected_description)` row, assert `describe(&expected_expression) == expected_description` (or equivalently, re-derive it from the `parse_schedule(phrase)` result already computed in Task 2's test — do not call `parse_schedule` twice per row if Task 2 and Task 4 can share one loop/test function). This is the test that actually catches a future regression where the NL parser and `describe()` drift apart — Task 2's per-row `description` assertion alone would not catch a bug where both sides drifted identically.
  - [ ] You may keep Story 3.2's original single-phrase test as-is (redundant but harmless) or fold it into the corpus loop — either is fine, but don't delete test coverage without replacing it.

- [ ] **Task 5: Document the corpus-growth maintenance rule (AC: 4)**
  - [ ] Add a doc comment directly above the corpus data (not buried in a test function body, since this is a standing process rule future contributors need to see when they open the file) stating: this corpus is the acceptance basis for FR21/AD-9; when a user-reported phrase converts incorrectly or fails to convert when it should, add it to the appropriate table here as a new red test *before* fixing the parser — the corpus is the executable definition of "correct," not a snapshot to update after the fact.
  - [ ] No new CI file/step needed (Task 1) — this AC's "the build fails" clause is satisfied automatically by the corpus living in `#[cfg(test)]`, already covered by AD-11's existing `cargo test --workspace` required check.

- [ ] **Task 6: Full verification pass**
  - [ ] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` — confirm the new corpus tests appear in the output and pass, and confirm the total passed-test count increased by roughly the number of new `#[test]` functions/assertions added (sanity check that the loop-based tests aren't silently no-ops over an empty array).
  - [ ] No frontend changes in this story — `pnpm lint`/`pnpm test`/`pnpm build`/`vue-tsc --noEmit` are not expected to show any diff-related output, but running them costs nothing and confirms nothing else regressed.

- [ ] **Task 7: No manual `pnpm tauri dev` verification needed for this story**
  - [ ] Deliberate scope note, deviating from the "manual verification" task present in every prior story since 1.7: this story adds zero user-facing surface (no new command, no UI change, no new error path a user could trigger that isn't already covered by Story 3.2's own manual verification). The corpus is proven entirely by `cargo test`. Do not add a Task 9-style manual-check placeholder that has nothing concrete for the user to click through — if you find yourself writing one, that's a signal this story's scope crept into something with an actual UI/command surface, which it should not.

- [ ] **Task 8: Commit and open a PR**
  - [ ] Branch: `feat/story-3-3-<slug>`, created from this story's `baseline_commit` (`806bb53`). **Important:** `main` is currently at `28cdaa8` (the epic-2 retrospective commit) — Stories 3.1 and 3.2 are stacked on top of it via still-open PRs (#32, #33), not yet merged. Branch from `806bb53` (this branch's current tip, which already includes both stories' full implementation and code-review patches), not from `main` — same stacking pattern Story 3.2 followed off Story 3.1.
  - [ ] Conventional Commit(s), `test` type scoped to `cron` (this story adds no new production code path, only tests — `test(cron): ...` is more accurate than `feat(cron): ...`).
  - [ ] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

## Dev Notes

- **This is the smallest-scoped cron story in the epic by a wide margin.** Stories 3.1 and 3.2 each touched 5-8 files across `umbra-core`, `src-tauri`, and `src/tools/cron`. This story touches exactly one: `crates/umbra-core/src/cron.rs`, adding only `#[cfg(test)]` content. If a change to any other file starts to feel necessary, stop and re-read epics.md's Story 3.3 ACs — all four are scoped to "the corpus test suite in `umbra-core`," nothing else.
- **AD-9 (the architectural point of this entire story):** the corpus is what turns AD-9's round-trip guarantee from "true because Story 3.2's code happens to enforce it at runtime" into "provably true, continuously, because CI fails if it stops being true." [Source: `ARCHITECTURE-SPINE.md` AD-9; `ARCHITECTURE.md`'s "The AI-honesty bar" section]
- **AD-11 (already covers this story, no changes needed):** `cargo test --workspace` runs as a required status check on `ubuntu-latest`/`windows-latest`/`macos-latest` on every PR — confirmed directly in `.github/workflows/ci.yml:50-51`. Adding `#[test]` functions to `crates/umbra-core/src/cron.rs` makes them part of that gate with zero additional CI configuration. [Source: `ARCHITECTURE-SPINE.md` AD-11; `.github/workflows/ci.yml`]
- **AD-1/AD-2:** trivially satisfied — test code has no production I/O or Tauri dependency to begin with, and this story adds no new production `pub` items.

### Project Structure Notes

- No new files. `crates/umbra-core/src/cron.rs` is the only file this story touches, extending the existing `#[cfg(test)] mod tests` block that Story 3.1/3.2 already established (lines 826-1190 as of this story's `baseline_commit`).
- No `Cargo.toml`/`Cargo.lock` change — no new dev-dependency is needed. A plain array of tuples iterated in a `for` loop is sufficient; this project has no precedent for (and does not need) a table-driven-test crate like `rstest`.
- No conflict with Story 3.1/3.2's structure — this story is purely additive within the same file/module.

### Testing Requirements

- `cargo test --workspace` must show the new corpus tests passing, with the passed-test count visibly higher than the pre-story baseline (Story 3.2 landed at 109 passed for `cargo test --workspace`, per that story's Change Log — this story should add roughly 2-4 new `#[test]` functions, whose bodies each loop over ~13-31 corpus rows via assertions, not ~44 individually-named test functions).
- `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings` — same as every prior story.
- No TypeScript/Vitest changes expected — `pnpm test` should show zero new/changed test files.

### Previous Story Intelligence

- **The addendum does not exist — confirmed twice now.** Story 3.2's own Dev Notes and References record a repo-wide search for "phrase corpus", "must-convert", "must-honestly-fail", and "corpus" that found only planning-doc *references* to `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/addendum.md`, never its content — the file is not present on disk (likely lost in the same data-loss incident that destroyed the original architecture spine, per `ARCHITECTURE-SPINE.md`'s header). Story 3.2 flagged this as "Story 3.3 owns building/sourcing the actual corpus" — that hand-off is this story. Do not re-search for it; treat its absence as an established fact from this point forward.
- **The exact grammar this corpus must exercise, read directly from `crates/umbra-core/src/cron.rs` at this story's `baseline_commit` (not re-derived from epics.md's prose, which pre-dates Story 3.2's code-review patches):**
  - Day clauses: `"every day"`, `"every weekday"` (dow range 1-5, special-cased phrasing), `"every <Weekday>"` (single), `"every <Weekday>, <Weekday>, and <Weekday>"` / `"every <Weekday> and <Weekday>"` (2+ list, comma/and-joined, **order preserved as typed, not sorted**, duplicates silently deduplicated).
  - Time clauses: `"at H[:MM] am/pm"` (AM/PM always mandatory, never inferred — `"at 9"` alone is the canonical ambiguous case), `"every N minutes"` (N ≤ 59), `"every N hours"` (N ≤ 23, renders as `"every hour"` when N=1).
  - Combining: `"<day clause>, at <time>"` / `"<day clause> at <time>"` (comma optional) for fixed times; `"<day clause>, every <time step>"` / `"<day clause> every <time step>"` for step times; a bare `"every N minutes/hours"` with no day clause implicitly means every day.
  - **Explicitly, deliberately out of grammar** (Story 3.2's Task 3, "explicitly out of scope for this story"): business-hours compounds (minute-step + hour-range, e.g. "every 5 minutes from 9 to 5"), day-of-month/month phrases ("on the 1st", "on January 1st"), any `L`/`W`/`#`-equivalent English. These are exactly the shape of phrase this story's must-honestly-fail corpus should draw from — they are permanent grammar boundaries, not gaps to be filled later in this story.
  - Step values outside a field's valid range (minutes > 59, hours > 23) are **rejected as honest failures**, not silently wrapped/truncated — this was Story 3.2's own code-review Patch #2 (previously "every 90 minutes" silently generated a cron expression that actually fired hourly, contradicting its own description). Two of this story's must-honestly-fail corpus rows exist specifically to lock this in as a permanent regression guard, not just a one-off fix.
  - **Undocumented grammar gotcha, discovered while verifying this story's corpus (not previously flagged by Story 3.2): a comma placed directly after a *single* weekday name only continues parsing if a weekday name (optionally after `"and"`) immediately follows.** `parse_weekday_list`'s comma branch (`crates/umbra-core/src/cron.rs`, the loop inside that function) unconditionally calls `parse_weekday_name` on whatever follows the comma and propagates `None` — i.e. fails the *entire* day clause — if that next token isn't a weekday. So `"every Monday, every 2 hours"` fails to parse (`cron-nl-unrecognized`), while the otherwise-equivalent `"every Monday every 2 hours"` (no comma) succeeds, because a non-comma continuation falls through to a permissive catch-all instead. This asymmetry does **not** affect the `"every day"`/`"every weekday"` keyword forms (Task 2 rows using those return immediately from `parse_day_clause` before ever reaching `parse_weekday_list`'s loop) or weekday-list commas followed by another weekday name (e.g. `"Monday, Wednesday, and Friday"` — each comma there is followed by a real weekday name, so it succeeds). It only bites a *single* weekday name followed by `", <non-weekday-word>"`. This is a real, narrow grammar boundary in already-shipped Story 3.2 code, not something this story should fix (test-only scope, Task 1) — but if you add more corpus phrases in this shape, do not use a comma between a lone weekday and a following step-time clause, or hand-trace it first.
  - Story 3.1's `describe()` vocabulary is a superset of what Story 3.2's NL parser can produce (e.g. `describe()` can render a business-hours cron string like `*/5 9-17 * * 1-5` into English, but no NL phrase can generate that combination) — this asymmetry is intentional and is exactly why the business-hours phrase belongs in must-honestly-fail, not must-convert.
- **Story 3.2's existing tests are regression tests for specific code-review findings (false-positive "at" detection, duplicate-weekday dedup, step-range rejection, context-preservation across failure paths), not the formal corpus this story adds.** Do not delete them; do not treat overlapping phrases (e.g. `"every weekday at 8:30am"` appearing in both Story 3.2's tests and this story's corpus) as wasteful duplication — they serve different purposes (pinning a specific past bug vs. being a complete, growing acceptance-basis gate).
- **Branch stacking:** `main` is still at `28cdaa8`; Stories 3.1 (#32) and 3.2 (#33) are open PRs, not yet merged. This story's `baseline_commit` (`806bb53`) is the current tip of `feat/story-3-2-type-a-schedule-get-a-cron-expression`, which already includes both. Branch from there, per Task 8.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.3: The phrase corpus as an automated acceptance gate (lines 663-685); FR21, AD-9; Epic 3 overview]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — FR21 ("Acceptance basis: the canonical phrase corpus in the addendum... maintained as an automated test"), FR20]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-9 (NL→cron honesty bar, this story's central requirement), AD-11 (CI enforcement, already covers this story with no changes)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "The AI-honesty bar (AD-9, AD-13)" section]
- [Source: `_bmad-output/implementation-artifacts/3-2-type-a-schedule-get-a-cron-expression.md` — read in full this session; Task 3's grammar scope (including "explicitly out of scope for this story"), Task 7's provisional phrase set and its explicit hand-off note to this story, all 6 code-review findings, Previous Story Intelligence's addendum-search record]
- [Source: `_bmad-output/implementation-artifacts/3-1-read-a-cron-expression-in-plain-english.md` — `describe()`'s exact vocabulary, referenced indirectly via Story 3.2's Dev Notes]
- Live-verified this session via a direct full read of `crates/umbra-core/src/cron.rs` at `baseline_commit` `806bb53` (1190 lines — every parsing/describing function and all existing tests), `.github/workflows/ci.yml` (confirmed `cargo test --workspace` is a required check on all 3 OS runners, lines 50-51), and `_bmad-output/implementation-artifacts/deferred-work.md` (confirmed the two open cron-related deferred items — `onPasteSchedule`'s stale-state bug and the cross-runner Convert/Paste race — are both `CronView.vue`-only and out of this story's test-only scope).
- Searched (this session, not found, consistent with Story 3.2's own search): `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/addendum.md` and a repo-wide grep for "phrase corpus"/"must-convert"/"must-honestly-fail" — no hits beyond planning-doc references to the addendum.

## Change Log

- 2026-08-04: Story drafted via `bmad-create-story`, auto-discovered from `sprint-status.yaml`'s backlog as the first `backlog`-status story in file order (Epic 3 already `in-progress` since Story 3.1, no epic-status transition needed). Read Story 3.2 in full for its exact grammar scope, existing provisional test coverage, and its explicit hand-off note that Story 3.3 owns building the real corpus. Re-confirmed (rather than re-searched) that the addendum.md source cited by epics.md/FR21 does not exist in this repository, per Story 3.2's own prior search. Read the current `crates/umbra-core/src/cron.rs` directly and hand-traced ~44 candidate phrases against its actual parsing/describing logic to produce a pre-verified illustrative corpus (31 must-convert, 13 must-honestly-fail) covering every grammar branch, rather than leaving corpus construction entirely to the dev agent. Confirmed AD-11's existing CI wiring (`cargo test --workspace` on all 3 OS runners) already gates this story's test suite with zero CI changes needed, keeping this story's scope to a single file. An independent fresh-context validation pass (per `checklist.md`) re-traced every table row against the real code and caught one error in the initial draft — `"every Monday, every 2 hours"` (comma before "every") does not actually parse, because a comma directly after a *single* weekday name requires another weekday name (or "and" + weekday) to follow, unlike the `"weekday"`/`"day"` keyword forms; fixed to the no-comma phrasing (`"every Monday every 2 hours"`, same expected expression/description) and documented the underlying grammar gotcha in Previous Story Intelligence so a dev agent adding further corpus phrases doesn't hit the same trap. All other rows and technical claims (CI wiring, baseline_commit, branch state) were confirmed correct by that pass.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
