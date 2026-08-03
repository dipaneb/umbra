---
baseline_commit: 50e3fbf
---

# Story 3.2: Type a schedule, get a cron expression

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want to type a schedule in natural language and get a correct cron expression — or an honest refusal,
so that I never deploy a silently wrong schedule.

## Acceptance Criteria

1. **Given** a supported English phrase (e.g. "every weekday at 8:30"), **when** I submit it, **then** the correct 5-field cron expression is produced by a deterministic grammar parser in `umbra-core::cron`, fully offline (FR19, INV-1), **and** before display, the result is round-tripped through Story 3.1's cron→English direction (`describe()`); only a consistent round-trip is shown (AD-9).
2. **Given** a phrase the parser cannot confidently convert (including ambiguity like "at 9" with no am/pm rule), **when** I submit it, **then** the tool states it could not convert, shows what it _did_ understand, and produces no cron expression (FR21) — wrong-but-confident output is treated as a bug, not a limitation.
3. **Given** the round-trip validation disagrees with the parsed intent, **when** the result would display, **then** it is suppressed and surfaced as an honest failure instead (AD-9).
4. **Given** non-English input, **when** submitted, **then** the tool states that v1 supports English input only (FR22).

## Tasks / Subtasks

- [x] **Task 1: Confirm no new dependency is needed (AC: 1)**
  - [x] `FR19`/Epic 3's overview specify a **deterministic grammar parser**, hand-written in `umbra-core::cron` — same as Story 3.1's `describe()` templater, not a third-party NL/date-parsing crate. `ARCHITECTURE-SPINE.md`'s Stack table lists no such crate, and none should be added. Confirm this at the start of the story (re-read Epic 3's AC wording) so no time is spent evaluating parsing libraries.
  - [x] No `Cargo.toml` change is expected for this story. `croner`/`chrono` (added in Story 3.1) are already available for building/validating the candidate cron expression.

- [x] **Task 2: `umbra-core::cron` — reusable field-to-English building blocks (AC: 1, 3)**
  - [x] **Read `crates/umbra-core/src/cron.rs` in full before writing anything** — this story extends that existing file, it does not create a new module. It already defines `FieldSpec` (Wildcard/Single/List/Range/Step), `parse_field`, `time_clause`, `day_clause`, `describe`, `explain_at`, `weekday_name`, `month_name`, `ordinal`, `join_with_and`, `capitalize_first`, `format_time_of_day` — all currently private (`fn`, not `pub`/`pub(crate)`).
  - [x] **The round-trip validation this story must implement only works cleanly if the NL parser and `describe()` share the exact same field→English vocabulary** — do not write a second, independent English-rendering path. Change `time_clause`, `day_clause`, `weekday_name`, `month_name`, and `FieldSpec` (plus whatever else the parser needs to construct field values) from private to `pub(crate)` (or move the new parser code into the same `cron.rs` file, in which case no visibility change is needed at all — this is the simpler option and is recommended, matching this file's existing single-module shape). Do not duplicate `time_clause`/`day_clause`'s logic in a new function — that would let the parser's understanding of "every weekday at 9am" silently drift from `describe()`'s understanding of the same field values, defeating the entire point of AD-9's round-trip.

- [x] **Task 3: `umbra-core::cron` — the NL grammar parser itself (AC: 1, 2, 4)**
  - [x] Define a result type reusing `CronExplanation` rather than inventing a parallel shape:
    ```rust
    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    pub struct ScheduleParseResult {
        pub expression: String,   // the generated 5-field cron expression
        pub description: String,  // == describe(&expression); round-trip-validated before this struct is ever constructed
        pub next_runs: Vec<i64>,  // epoch seconds, computed via the same explain_at() path Story 3.1 already built
    }

    pub fn parse_schedule(phrase: &str) -> Result<ScheduleParseResult, ToolError> {
        parse_schedule_at(chrono::Local::now(), phrase)
    }

    fn parse_schedule_at(now: chrono::DateTime<chrono::Local>, phrase: &str) -> Result<ScheduleParseResult, ToolError> {
        // 1. tokenize + parse `phrase` into FieldSpec values (minute, hour, dom, month, dow)
        //    — or an honest-failure ToolError with a `context` describing what was understood.
        // 2. render the *expected* description directly from those FieldSpec values using the
        //    same time_clause()/day_clause() helpers `describe()` uses (Task 2) — call this
        //    `expected_description`.
        // 3. serialize the FieldSpec values into a 5-field cron expression string.
        // 4. call `explain_at(now, &expression)` (already exists, unchanged) — this both
        //    validates the generated string actually parses via `croner` AND reuses the
        //    existing "calendrically impossible" (`cron-no-upcoming-runs`) guard for free.
        // 5. compare `explain_at`'s returned `description` against `expected_description`
        //    (AC3's literal round-trip check). Equal -> return Ok(ScheduleParseResult).
        //    Not equal -> honest failure (this should not normally happen if step 1's parser
        //    and step 2's renderer are both correct and share the Task 2 helpers — but AD-9
        //    requires handling the mismatch case explicitly, not assuming it can't occur).
        todo!()
    }
    ```
    (Illustrative only, like Story 3.1's own code sketches — validate/adjust against what you actually build in Task 2; the five numbered steps in the doc comment are the part that must survive into the real implementation, not the exact function signatures.)
  - [x] **Grammar vocabulary for v1 — deliberately scoped to what `describe()` can already render** (per Task 2's shared-vocabulary requirement, anything the parser produces that `describe()` can't articulate will always fail the round-trip, so there is no point parsing phrases outside this list):
    - **Day clause**, case-insensitive:
      - `"every day"` → dom/month/dow all wildcard.
      - `"every weekday"` → dow range 1-5 (matches `describe()`'s special-cased "every weekday" phrasing, not the generic range phrasing).
      - `"every <Weekday>"` (e.g. "every Monday") → dow single value (`weekday_name`'s reverse mapping: Sunday=0 or 7 — pick 0, Monday=1, ..., Saturday=6).
      - `"every <Weekday>, <Weekday>, and <Weekday>"` / `"every <Weekday> and <Weekday>"` (comma/and-joined list, 2+ weekdays) → dow list, matching `day_clause`'s `FieldSpec::List` + `join_with_and` branch. Order-preserve as typed; do not sort.
    - **Time clause**, case-insensitive, **AM/PM is mandatory, never inferred**:
      - `"at H am"` / `"at H:MM am"` / `"at H pm"` / `"at H:MM pm"` (`am`/`pm`, `a.m.`/`p.m.`, or no space before am/pm all acceptable) → minute/hour both `FieldSpec::Single`.
      - `"every N minutes"` → minute `Step { base: Wildcard, step: N }`, hour `Wildcard` (matches `time_clause`'s minute-step + hour-wildcard branch).
      - `"every N hours"` → hour `Step { base: Wildcard, step: N }`, minute `Single(0)` (matches `time_clause`'s hour-step + fixed-minute-zero branch, which renders as `"every N hours"` with no `:00` suffix — confirm this by reading `time_clause`'s actual match arms in Task 2, since the `:MM` suffix only appears for non-zero minutes).
    - **Combining:** a full phrase is `<day clause>, at <time clause>` or `<day clause> at <time clause>` (comma optional) for the fixed-time forms, or `<day clause>, every <time clause>` for the step forms — mirror `describe()`'s own `"{day}, {time}"` join order (day clause first) so the two sides can produce byte-identical strings.
    - **Explicitly out of scope for this story** (do not build parsing for these — they're either not needed by any planned demo phrase, or `describe()` itself doesn't cover them cleanly yet): business-hours combos (minute-step + hour-range, e.g. "every 5 minutes from 9 to 5" — `describe()` supports rendering this via `parse_field`, but building NL parsing for a three-part compound phrase is disproportionate scope for this story); day-of-month/month phrases ("on the 1st", "on January 1st"); `L`/`W`/`#` or any cron extended syntax equivalent in English ("last Friday of the month", "the 3rd Tuesday"). If a user types one of these, it must produce Task 3's generic honest-failure path (AC2), never a wrong or partial guess.
  - [x] **Honest-failure paths (AC2, AC4) — each needs a stable `ToolError.code` and a `context` describing what was understood, per FR21's literal "shows what it did understand" wording:**
    - Empty/whitespace-only phrase → `cron-nl-empty-phrase`, `context: None`.
    - A time is present but has no `am`/`pm` marker (FR21's own named example, "at 9") → `cron-nl-ambiguous-time`. `context` should name the ambiguity plainly, e.g. `"Understood a time of 9:00, but couldn't tell whether it means AM or PM — say '9am' or '9pm'."`.
    - Day clause recognized but time clause missing, or vice versa → still falls under the generic "nothing recognized" path below unless you choose to special-case it with a more specific `context` message (recommended, since it's cheap and directly serves FR21 — e.g. `context: Some("Understood 'every Monday', but no time of day was given.".to_string())`).
    - Nothing in the grammar vocabulary recognized at all (including genuinely non-English input, per AC4 — see below) → `cron-nl-unrecognized`. Message text should explicitly state the v1 English-only scope (AC4) as a standing part of this message — **do not attempt real language detection**; no language-identification crate exists in this project's dependency tree and adding one for this purpose would be disproportionate to a single AC. A message like `"Couldn't recognize this as a schedule. Umbra's schedule parser understands English phrases only in v1 (e.g. \"every weekday at 8:30am\")."` satisfies AC4 by stating the scope limitation honestly, without claiming to have detected the phrase's actual language — record this as a deliberate design decision in this story's Completion Notes, since it's a reasonable but non-obvious interpretation of AC4's literal wording.
    - The Task 3 round-trip mismatch case (step 5 above) → `cron-nl-round-trip-mismatch`, `context` can be `None` or a generic "internal consistency check failed" note — this path should be unreachable in practice if Task 2's shared-vocabulary requirement is honored; if you find it triggering during testing, that's a signal the day/time clause building in step 1 and step 2 have drifted apart, not a case to paper over.
    - If `explain_at` on the generated candidate returns `cron-no-upcoming-runs` (a calendrically impossible generated schedule — should not be reachable given this story's day/month vocabulary never touches day-of-month/month, but keep this path passing the error straight through rather than swallowing it, for defense in depth).
    - `position: None` on every new code — same reasoning as every existing `cron-*` code (no natural line/column for a natural-language phrase).

- [x] **Task 4: Tauri command `cron_parse_schedule` (AC: 1, 2, 3, 4)**
  - [x] Extend `src-tauri/src/commands/cron.rs` (do not create a new file) with a command mirroring `cron_explain`'s exact shape:
    ```rust
    use umbra_core::cron::{ScheduleParseResult, parse_schedule};

    #[tauri::command]
    pub async fn cron_parse_schedule(phrase: String) -> Result<ScheduleParseResult, ToolError> {
        tauri::async_runtime::spawn_blocking(move || parse_schedule(&phrase))
            .await
            .map_err(map_join_error)?
    }
    ```
    Reuse the existing `map_join_error` in that file — do not duplicate it.
  - [x] `src-tauri/src/lib.rs`: add `cron_parse_schedule` to the existing `use commands::cron::{...}` line and to `generate_handler![...]`, alongside `cron_explain`.
  - [x] No `commands/mod.rs` change needed (the `cron` module is already registered by Story 3.1).
  - [x] No `capabilities/default.json` change — pure computation, same reasoning as `cron_explain`.

- [x] **Task 5: No Tool Registry change (AC: none directly)**
  - [x] The `cron` tool is already registered (Story 3.1); this story extends the same view (`CronView.vue`), not a second registry entry. Do not touch `src/stores/registry.ts`. Because no new entry is added, **there is no registry-count ripple this story** — `router/index.spec.ts`'s `toHaveLength(6)` and `CommandPalette.spec.ts`'s "Cron" wrap-around assertion (both set by Story 3.1) stay correct unchanged. Confirm this rather than assuming it — re-run those two spec files as part of Task 8 and expect no diff needed.

- [x] **Task 6: `src/tools/cron/CronView.vue` — add the NL → cron section (AC: 1, 2, 3, 4)**
  - [x] Read the current `CronView.vue` in full before editing — it already has one section (cron → English) built in Story 3.1 with `expression`/`explanation`/`error` state and `onExplain`/`onPaste`/`onCopy` handlers using independent `createLatestWinsRunner()` instances. This story adds a **second, independent** section to the same view/file for the opposite direction — it does not replace or restructure the existing section.
  - [x] Extend `src/tools/cron/cronExplanation.ts` (or add a sibling `scheduleParseResult.ts` mirroring the same hand-maintained-mirror convention — either is fine, pick whichever keeps the file cohesive) with:
    ```ts
    // Mirrors `ScheduleParseResult` in crates/umbra-core/src/cron.rs — keep in sync by hand.
    export interface ScheduleParseResult {
      expression: string;
      description: string;
      next_runs: number[]; // epoch seconds — same convention as CronExplanation.next_runs
    }
    ```
  - [x] New state, distinct from the existing cron→English section's state: `phrase = ref("")`, `parseResult = ref<ScheduleParseResult | null>(null)`, `parseError = ref<ToolError | null>(null)`.
  - [x] **This is a third independent write-trigger to this view's state** (alongside the existing Explain and Paste triggers) — give it its own `createLatestWinsRunner()` instance (`runParse`), following exactly the same reasoning already documented in this file's existing comment above `runExplain`/`runPaste`: a shared runner would wrongly mark one action's in-flight result as superseded when the other starts, even though they don't share state. If the NL section also needs its own Paste action (recommended, for symmetry with the existing section and FR4), give that its own runner too rather than reusing `runPaste` from the other section — they operate on different `ref`s (`phrase` vs `expression`).
  - [x] `onParseSchedule()`: `runParse(() => invoke<ScheduleParseResult>("cron_parse_schedule", { phrase: phrase.value }))`; on success set `parseResult.value` and clear `parseError`; on failure clear `parseResult` and set `parseError` — same shape as `onExplain`.
  - [x] Render, on success: the generated `expression` (prominently — it's the actual deliverable per FR19), the `description` (proof of the round-trip), and `next_runs` formatted the same way as the existing section (`new Date(epochSeconds * 1000).toLocaleString()` — reuse the existing `formatRun` helper already defined in this file rather than writing a second copy).
  - [x] Render, on failure: `parseError.value.message` via the same `role="alert"` pattern already used for the existing section's `error`, **and** `parseError.value.context` when present (this is where FR21's "shows what it did understand" surfaces to the user — Task 3's `context` messages are wasted if the view never displays them; confirm the existing section's error rendering doesn't already show `context` and decide whether to add it there too for consistency, or scope that to this story's new section only — either is defensible, but state the choice explicitly in this story's Completion Notes).
  - [x] A copy-to-clipboard action for the generated `expression` (FR4) — this direction's natural "output" is the cron string itself, not the description (opposite of the existing section, where the description is the output). Use the existing `writeClipboardText` import.
  - [x] Keyboard/accessibility (NFR5): label the phrase `<textarea>`/`<input>` distinctly from the existing `cron-expression-input` (e.g. `cron-schedule-phrase-input`), native `<button>` elements throughout — same pattern as the existing section, no new keyboard-handling code.

- [x] **Task 7: Tests (AC: 1, 2, 3, 4)**
  - [x] `crates/umbra-core/src/cron.rs` — **a provisional phrase set, not the canonical corpus.** `epics.md`'s Story 3.3 AC and FR21 both cite "the addendum's canonical phrase corpus" (must-convert ≥30, must-honestly-fail ≥10) as the acceptance basis — that addendum file does not exist anywhere in this repository (confirmed by search during this story's creation; see this story's References section). Story 3.3 is explicitly responsible for building/sourcing the real corpus as an automated gate. For **this** story, write a provisional test set covering the grammar vocabulary from Task 3 — it does not need to hit 30/10, but should cover every branch of that vocabulary at least once:
    - Must-convert (assert exact `expression` **and** exact `description`, not just that `Ok` was returned — a wrong-but-plausible cron is exactly the failure mode AD-9 exists to prevent): `"every weekday at 8:30am"`, `"every Monday at 9am"`, `"every day at 9pm"`, `"every Monday, Wednesday, and Friday at 6am"`, `"every 15 minutes"`, `"every 2 hours"`.
    - Must-honestly-fail (assert the specific `ToolError.code` from Task 3, and that `context`/`message` is non-empty and does not contain a cron expression): `""` (empty) → `cron-nl-empty-phrase`; `"at 9"` (FR21's own named ambiguity example) → `cron-nl-ambiguous-time`; `"tous les lundis à 9h"` (French, exercises AC4) → `cron-nl-unrecognized`; `"every third Friday of the month"` (out-of-scope vocabulary, also happens to be one of Story 3.3's own future must-honestly-fail examples per `epics.md`) → `cron-nl-unrecognized`; `"asdfasdf"` (garbage) → `cron-nl-unrecognized`.
    - At least one explicit round-trip assertion that doesn't just check the final `Ok`/`Err` but re-derives `describe(&result.expression)` in the test itself and asserts it equals `result.description` — this is the test that would actually catch a future regression where the parser and `describe()` drift apart (Task 2's core risk).
  - [x] `src-tauri/src/commands/cron.rs`: thin smoke tests for `cron_parse_schedule`, mirroring `cron_explain`'s existing two tests (one happy path, one honest-failure case).
  - [x] `src/tools/cron/CronView.spec.ts` (extend the existing file — do not create a new spec file): a successful parse renders the expression/description/next-runs; an honest-failure renders the error message and context; paste populates the phrase field (if Task 6 added a dedicated paste action); copy calls `writeClipboardText` with the generated expression; a stale result from a superseded call is discarded (mirror the existing section's equivalent test, applied to the new `runParse` runner).

- [x] **Task 8: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`, `vue-tsc --noEmit`.

- [ ] **Task 9: Manual verification (deferred to the user)**
  - [ ] `pnpm tauri dev`: type "every weekday at 8:30am" (or the PRD's own demo phrase, "every Monday at 9am") in the new section and confirm the correct cron expression, a matching description, and 3 upcoming local-datetime run times render; type "at 9" and confirm an honest, specific inline error naming the AM/PM ambiguity; type a French phrase and confirm an honest error stating English-only v1 scope; confirm copy-to-clipboard copies the generated expression; confirm the existing cron→English section (Story 3.1) still works unaffected side-by-side in the same view.

- [ ] **Task 10: Commit and open a PR**
  - [ ] Branch: `feat/story-3-2-<slug>`, created from this story's `baseline_commit` (`50e3fbf`, this branch's current tip — includes all of Story 3.1's implementation and its code-review patches).
  - [ ] Conventional Commit(s), `feat` type scoped to `cron`.
  - [ ] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2 (functional core):** `parse_schedule`/`parse_schedule_at` are pure functions in `crates/umbra-core/src/cron.rs` — zero I/O, zero Tauri dependency, no `#[cfg(target_os)]` branches. Same narrow exception as Story 3.1 for `chrono::Local::now()` (not filesystem/network/platform-branching I/O in the AD-2 sense). [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (ToolError contract):** new stable codes — `cron-nl-empty-phrase`, `cron-nl-ambiguous-time`, `cron-nl-unrecognized`, `cron-nl-round-trip-mismatch` — all kebab-case literals, `position: None` on every branch (no natural line/col for a natural-language phrase), `context` carries the "what it did understand" detail FR21 requires. [Source: `ARCHITECTURE-SPINE.md` AD-3]
- **AD-4 (heavy work off the main thread):** `cron_parse_schedule` wraps in `spawn_blocking`, matching `cron_explain` and every other command — uniform convention, not a claim this specific operation is slow. [Source: `ARCHITECTURE-SPINE.md` AD-4]
- **AD-5/AD-6:** no registry change (Task 5) — the `cron` tool remains one island, one entry, unchanged since Story 3.1.
- **AD-9 (the central architectural requirement of this story) — every generated cron expression is round-tripped through `describe()` before it is ever returned to the caller, let alone displayed.** This is not optional plumbing; it is literally AC1 and AC3. The safest way to guarantee this holds is what Task 2/Task 3 describe: the NL parser and `describe()` must call the *same* `time_clause`/`day_clause` functions, so there is structurally no way for them to describe the same `FieldSpec` values differently — the round-trip comparison in step 5 of Task 3's sketch then becomes a genuine safety net (catching real bugs in candidate-string serialization) rather than a check that could never fail by construction and could never catch anything either. Do not implement the NL parser's English-rendering independently of `describe()`'s existing helpers, even if it seems faster to write a fresh, simpler renderer for the parser's own use — that reintroduces exactly the drift risk AD-9 exists to prevent. [Source: `ARCHITECTURE-SPINE.md` AD-9; `ARCHITECTURE.md`'s "AI-honesty bar" section; this story's own AC1/AC3]
- **AD-7:** no new dependency, network-clean by construction (no new crate added). [Source: `ARCHITECTURE-SPINE.md` AD-7]
- **AD-14/15/16 — not exercised beyond what Story 3.1 already established.** No file drop, no clipboard-image paste. AD-16's request-ID/latest-wins pattern applies to the new `runParse` (and optional new paste) runner(s), same as Story 3.1's `runExplain`/`runPaste`.

### Library/Framework requirements

- **No new dependency.** `croner`/`chrono`, added in Story 3.1, are sufficient — the parser only needs to construct `FieldSpec` values and a cron string, then hand off to the already-existing `explain_at`/`describe` functions for validation and rendering. Re-confirm this is still true early in implementation (re-read Epic 3's overview and FR19) rather than reaching for a date/NLP crate out of habit — none is pinned in `ARCHITECTURE-SPINE.md`'s Stack table, and INV-4 (frozen MVP feature list) means no new capability is being added here, only a second direction on an already-scoped feature.
- **Reuse, don't reimplement, Story 3.1's field vocabulary.** See Task 2 and the AD-9 note above — this is the single most important implementation constraint in this story, parallel to how Story 3.1's own most important decision was *not* calling `croner::Cron::describe()`. Here the equivalent trap is building a second, parser-owned English renderer instead of reusing `time_clause`/`day_clause`.

### File Structure Requirements

- **New files:** none. This story extends existing files only.
- **Modified:**
  - `crates/umbra-core/src/cron.rs` (+`ScheduleParseResult`, +`parse_schedule`, +`parse_schedule_at`, + new grammar-parsing functions, + new `ToolError` codes, + visibility changes to `time_clause`/`day_clause`/etc. if the new parser code isn't kept in the same file/module scope, + new unit tests)
  - `src-tauri/src/commands/cron.rs` (+`cron_parse_schedule`, reusing existing `map_join_error`, + new tests)
  - `src-tauri/src/lib.rs` (`use` line +1 item, `generate_handler!` +1 entry)
  - `src/tools/cron/CronView.vue` (+ new NL→cron section: state, handlers, template, no removal of the existing section)
  - `src/tools/cron/cronExplanation.ts` (+`ScheduleParseResult` interface, or a new sibling file — dev agent's call, see Task 6)
  - `src/tools/cron/CronView.spec.ts` (+ new test cases for the new section)
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions)
- **Not touched:** `src/stores/registry.ts` (Task 5 — no registry change), `src/router/index.spec.ts`, `src/shell/CommandPalette.spec.ts` (no registry-count ripple — no new entry added), `crates/umbra-core/Cargo.toml`/`Cargo.lock` (no new dependency), `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, any non-cron tool file.

### Testing Requirements

- Rust: `cargo test --workspace` covering the new `cron.rs` unit tests (Task 7's provisional must-convert/must-honestly-fail set, plus the explicit round-trip-consistency test) and `commands/cron.rs`'s new smoke tests. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`.
- TypeScript: `pnpm test` covering `CronView.spec.ts`'s new cases for the NL→cron section. No changes expected to `router/index.spec.ts` or `CommandPalette.spec.ts` (Task 5).
- `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all pass locally before the PR.
- Manual: `pnpm tauri dev`, per Task 9 — deferred to the user, same precedent as every story since 1.7.

### Previous Story Intelligence

- **From Story 3.1 (immediate predecessor, read in full this session):** `describe()`'s exact supported vocabulary is documented verbatim in that story's Completion Notes List and reproduced/narrowed into Task 3's grammar list above — do not re-derive it from scratch or guess at what `describe()` covers; read the actual current `crates/umbra-core/src/cron.rs` (Task 2's first instruction) since Story 3.1's code-review pass added a business-hours phrasing branch (`*/5 9-17 * * 1-5` → `"...from 9:00 AM to 6:00 PM"`) after that story's initial Dev Notes were written — the file's current behavior is the source of truth, not the story doc's prose.
- **Story 3.1's central lesson, directly applicable here:** its own Dev Notes state "Story 3.2's NL→cron generator should therefore only ever need to produce numeric-field cron strings for the round-trip to succeed" (`describe()` does not recognize alpha weekday/month names like `MON`/`JAN` even though `croner` itself accepts them) — Task 3's grammar above only ever emits numeric dow values, consistent with this.
- **Story 3.1's review findings are directly relevant precedent for this story's own eventual review**, since the same reviewer will likely check for the same bug classes: (1) confident-but-wrong output for edge-case input (the calendrically-impossible-schedule finding) — this story's round-trip validation is the direct AD-9 analog Story 3.1 didn't fully have until its review pass added `explain_at`'s `cron-no-upcoming-runs` check; (2) shared-runner races between independent write-triggers (the `runExplain`/`runPaste` finding) — Task 6 explicitly calls for a third independent runner to avoid repeating this exact bug in the new section.
- **No addendum/phrase-corpus file exists in this repository** (searched `_bmad-output/` and `docs/` for "phrase corpus", "must-convert", "must-honestly-fail", "corpus" — the only hits are the planning docs' own *references* to the addendum, never the addendum's actual content). `epics.md`'s frontmatter lists `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/addendum.md` as a source document, but that file is not present on disk. This is very likely a casualty of the data-loss incident documented in `ARCHITECTURE-SPINE.md`'s header (the same incident that destroyed the original architecture spine) — the addendum was apparently never reconstructed the way the spine was. **This is a real content gap, not something this story can close** (Story 3.3 owns building/sourcing the actual corpus as an automated gate) — Task 7's provisional phrase set is this story's stopgap, explicitly flagged as provisional in that task. Flagged to the user as an open question at the end of this story-creation session.

### Git Intelligence

- This branch's tip at story-creation time is `50e3fbf` (this story's `baseline_commit`) — `fix(cron): address code review findings for story 3.1`, i.e. Story 3.1 is fully implemented, reviewed, and patched on this branch already; no rebasing or cherry-picking is needed before starting this story.
- No commit since Story 3.1 landed has touched `crates/umbra-core/src/cron.rs`, `src-tauri/src/commands/cron.rs`, `src/tools/cron/*`, or `src/stores/registry.ts` beyond what Story 3.1 itself changed — no unrelated drift to account for.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.2: Type a schedule, get a cron expression; FR19, FR21, FR22, INV-1, AD-9; Epic 3 overview]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — F6 (FR19-FR22), §2 demo scenario ("every Monday at 9am" → `0 9 * * 1`), §9 resolved questions ("NL→cron → deterministic parser in v1")]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1/AD-2 (functional core), AD-3 (ToolError), AD-4 (async convention), AD-9 (NL-cron honesty bar, this story's central requirement), Consistency Conventions table]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "The AI-honesty bar (AD-9, AD-13)" section, prose rationale for the round-trip requirement]
- [Source: `_bmad-output/implementation-artifacts/3-1-read-a-cron-expression-in-plain-english.md` — read in full this session; `describe()`'s exact vocabulary (Completion Notes List), all 8 code-review findings, Dev Notes' explicit hand-off note to this story]
- Live-verified this session via a direct read-only pass over the actual current code: `crates/umbra-core/src/{cron,error,lib}.rs`, `src-tauri/src/commands/cron.rs`, `src-tauri/src/lib.rs`, `src/stores/registry.ts`, `src/tools/cron/{CronView.vue,cronExplanation.ts}`, `src/shell/{invoke,toolError}.ts`, `_bmad-output/implementation-artifacts/deferred-work.md` (confirmed the only cron-related deferred item is the unrelated 6-field-seconds gap, not applicable to this story).
- Searched (this session, not found): `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/addendum.md` (cited in `epics.md`'s frontmatter, never present on disk) and a repo-wide grep for "phrase corpus"/"must-convert"/"must-honestly-fail" (only planning-doc *references* to the addendum exist, never its content) — see Previous Story Intelligence above.

## Change Log

- 2026-08-03: Story drafted via `bmad-create-story`, auto-discovered from `sprint-status.yaml`'s backlog as the first `backlog`-status story in file order (Epic 3 already `in-progress` since Story 3.1, no epic-status transition needed). Read Story 3.1 in full for its exact `describe()` vocabulary and code-review findings, and the current `crates/umbra-core/src/cron.rs`/`CronView.vue`/`registry.ts` directly rather than relying on Story 3.1's doc prose (which predates that story's own code-review patches). Identified this story's central architectural risk — the NL parser must reuse `describe()`'s field-to-English helpers rather than reimplementing them, or the AD-9 round-trip check becomes either impossible to satisfy or trivially unable to catch real bugs — and scoped Task 3's grammar vocabulary tightly to what `describe()` already renders, mirroring Story 3.1's own conservative-scope precedent. Confirmed no new Rust dependency is needed. Searched for the "addendum" phrase corpus cited by FR21/`epics.md`'s frontmatter as the acceptance basis for this whole feature and confirmed it does not exist anywhere in the repository — flagged as an open question for the user rather than silently invented or silently ignored.
- 2026-08-04: Implemented Tasks 1-8. Hand-written recursive-descent NL grammar parser added to `crates/umbra-core/src/cron.rs` (kept in the same module — no visibility changes needed, per Task 2's recommended simpler option), sharing `time_clause`/`day_clause`/`FieldSpec` directly with `describe()` so the AD-9 round-trip check is a genuine safety net rather than a tautology. Added `cron_parse_schedule` Tauri command and wired it into `lib.rs`. Extended `CronView.vue` with an independent "Schedule to cron" section (own `runParse`/`runPasteSchedule` latest-wins runners, per AD-16). Full verification pass green: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` (100 passed), `pnpm test` (172 passed), `pnpm build` (`vue-tsc --noEmit && vite build`) all clean. `pnpm lint` (repo-wide) fails only on a pre-existing untracked file, `.claude/workflows/scan-of-the-end-of-the-second-epic.js` (present before this session started, unrelated to this story's scope) — eslint scoped to this story's changed files (`CronView.vue`, `cronExplanation.ts`, `CronView.spec.ts`) is clean with `--max-warnings 0`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

None — no failing test or build required iterative debugging; the grammar's hand-traced expected outputs matched actual `cargo test` results on the first run.

### Completion Notes List

- **AC4 interpretation (documented per Task 3's own instruction):** "non-English input" is handled by the same generic `cron-nl-unrecognized` path as any other unrecognized vocabulary (out-of-scope English phrases like "every third Friday of the month" included), rather than attempting real language detection. No language-identification crate exists in this project's dependency tree, and INV-4 (frozen MVP feature list) means none should be added for this. The message states the v1 English-only scope as standing boilerplate on every "nothing recognized" failure, which satisfies AC4 honestly without claiming to have detected the phrase's actual language.
- **Ambiguous-time detection is a global scan, not grammar-gated:** FR21's own named example, the bare phrase `"at 9"`, has no day clause at all. Rather than requiring the full `<day clause> <time clause>` grammar to match before diagnosing ambiguity, `detect_ambiguous_time` scans the whole lowercased phrase for an `"at <digits>"` pattern with no trailing am/pm marker and fires independently of whether a day clause parsed. This is what lets `"at 9"` produce `cron-nl-ambiguous-time` instead of falling into the generic `cron-nl-unrecognized` bucket.
- **Bare step-time phrases ("every 15 minutes", "every 2 hours") implicitly mean "every day":** these are must-convert phrases per Task 7 despite having no day clause. `describe()` already renders `dow: Wildcard` as "every day" for step-time schedules (see the pre-existing `explain_step_minutes_returns_every_n_minutes_description` test), so the parser defaults the day clause to `Wildcard` when a bare `"every N minutes/hours"` phrase is detected (no "weekday"/"day"/weekday-name token immediately follows "every").
- **`context` display decision (Task 6's explicit call):** the new "Schedule to cron" section renders `parseError.context` (via a `<template v-if>` alongside `message`) since Task 3's honest-failure `context` messages are the FR21 payload this story is about. The pre-existing cron→English section's error rendering was left unchanged (it doesn't show `context`) — scoping this to the new section only, since the existing section's own error paths (`cron-*` codes) don't currently populate `context` in a way that would benefit from it, and touching it would be an unrelated change outside this story's scope.
- **Day-clause-only diagnostic:** Task 3 marks the "day clause recognized, but no time given" `context` message as recommended-but-optional. Implemented it (e.g. `"Understood 'every weekday', but no time of day was given."`) since it was cheap and directly serves FR21; covered by a dedicated unit test.
- **Task 9 (manual `pnpm tauri dev` verification) intentionally left unchecked** — same established precedent as every story since 1.7 (confirmed against Story 3.1's own history: its manual-verification checkbox stayed unchecked until the user actually ran the app during that story's code-review pass). Deferred to the user.
- **`pnpm lint` caveat:** the repo-wide `pnpm lint` run fails only on `.claude/workflows/scan-of-the-end-of-the-second-epic.js`, an untracked file already present in the working tree before this story's implementation began (confirmed via the session's initial `git status`) — not part of this story's File List and not modified by this work. `eslint` scoped to this story's three changed frontend files passes with `--max-warnings 0`. Flagged to the user rather than silently deleting or modifying a file outside this story's scope.

### File List

- `crates/umbra-core/src/cron.rs` (modified — `ScheduleParseResult`, `parse_schedule`, `parse_schedule_at`, NL grammar-parsing functions, 4 new `ToolError` codes, unit tests)
- `src-tauri/src/commands/cron.rs` (modified — `cron_parse_schedule` command, 2 new tests)
- `src-tauri/src/lib.rs` (modified — `cron_parse_schedule` registered in `use` and `generate_handler!`)
- `src/tools/cron/CronView.vue` (modified — new "Schedule to cron" section: state, handlers, template, styles; existing section wrapped in `.explain-section` for test scoping, no behavior change)
- `src/tools/cron/cronExplanation.ts` (modified — `ScheduleParseResult` interface added)
- `src/tools/cron/CronView.spec.ts` (modified — 7 new test cases for the new section, `clickScheduleButton`/`parseSchedule` test helpers)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions)
