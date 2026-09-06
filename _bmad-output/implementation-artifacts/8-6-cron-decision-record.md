# Story 8.6 — NL ↔ Cron: Task 1 Decision Record

**Date:** 2026-09-03
**Method:** `bmad-party-mode` (installed roster — Mary/Business Analyst, John/PM, Sally/UX, Winston/Architect, Amelia/Senior Engineer, Paige/Tech Writer; `session` mode; party memory resumed from the Epic 8 history, Stories 8.1–8.5).
**Status:** scope decisions **signed off by the developer 2026-09-03** — including the AD-9 amendment and AD-13 resolution below going into `ARCHITECTURE-SPINE.md` at build time. Cut #1 filed as GitHub issue [#130](https://github.com/dipaneb/umbra/issues/130). Task 2a (real AC6+) is the next step, in the same room.
**Design canvas:** none yet — the container decision (one bidirectional grid) was reasoned without a comparison canvas. A states/anatomy canvas for the field grid + live panel is a Task 2a candidate, not a Task 1 deliverable.

This record satisfies Story 8.6 AC1–AC5. It reconsiders the NL ↔ Cron tool's scope **from first principles**. The shipped implementation (`crates/umbra-core/src/cron.rs`, `src-tauri/src/commands/cron.rs`, `src-tauri/src/lib.rs` handler registration, `src/tools/cron/CronView.vue`, `src/tools/cron/cronExplanation.ts`, `src/tools/cron/CronView.spec.ts`, the `tools.cron.*` i18n, the `cron` registry entry, `src/shell/toolError.ts`) was read in full at session start.

**One drift correction from that read:** the story file and the `sprint-status.yaml` note both say the phrase corpus is "49 rows". The actual counts are `MUST_CONVERT` **32** + `MUST_HONESTLY_FAIL` **16** = **48**. Both clear their FR21/Story-3.3 floors (≥30 / ≥10) and the gate tests assert `>= 30` / `>= 10`, so there was never a functional issue — a stale count from an earlier draft. Moot from here on: the corpus is retired (below).

---

## Framing — the JTBD answer that shaped everything (AC1)

The developer uses cron in two distinct, known-in-advance situations:

> *"English → cron: I know the schedule I want, I just can't remember the field order and whether Sunday is 0 or 7. cron → English: someone handed me `*/15 9-17 * * 1-5` and I need to know what it does before I touch it."*

The pivotal reframe came from the developer, not the room: **"English → cron" is a *structure* problem, not a *language* problem.** "I forget the field order" is not "understand arbitrary English" — it is "I can't assemble the five fields correctly." A free-text natural-language parser is the wrong tool for that job:

- Doing free-text NL→cron *well* (never shrugging) implies a local model the product will never ship (the developer's own words: *"a 32-gigabyte model in the app doesn't seem like a good idea"*). AD-7 forbids the API alternative.
- The competitive sweep (crontab.guru, `cronstrue`, `cron-parser`, Cronitor, `friendly-cron`, `later.js`, `cron-time-generator`, the `crontab` man page) found **no reference implementation of good free-text NL→cron**. crontab.guru — the tool everyone actually pastes into — does not do NL→cron *at all*; it is cron→English only. Every NL→cron library that exists is a small hand-written grammar over a fixed phrase set, exactly like Umbra's.
- Umbra's deterministic parser was never "bad" by its own design (FR21/AD-9): understand a known set perfectly, round-trip-verify every answer, honestly bail on the rest. The risk was always the **UI over-promising** — a big empty textarea labelled "Schedule, in plain English" that implies you can type anything.

**Decision: retire free-text NL→cron entirely. Replace it with a language-neutral guided builder.** A structured grid of per-field editors that *composes* a valid cron expression — deterministic by construction, impossible to phrase wrong, and localised for free (the controls are i18n keys; a cron expression has no language).

---

## Container shape

**One bidirectional grid. No tabs.** `AppTabs.vue` stays unused.

This is the sixth consecutive Epic 8 redesign to reject tabs — but for a **new** reason. 8.1 (JSON) earned tabs on genuine multi-job; 8.2–8.5 stayed single enriched views because each was one job. Cron *is* two jobs — and the decision is still no tabs, because **both jobs are the same surface entered from different ends**:

- An **expression line** (editable text) at the top — type or paste `*/15 9-17 * * 1-5`.
- A **flat expert grid** of five always-visible per-field editors — Minute, Hour, Day of month, Month, Day of week — each covering the plain field grammar (see *Field grammar* below). Developer chose the flat grid over progressive disclosure: whoever opens this tool is building a cron, so show the power up front.
- **Bidirectional binding:** editing the expression line parses and populates the five field editors; editing a field editor recomposes the expression line.
- A **live panel:** the plain-English one-liner (`describe()`), an **always-on per-field breakdown**, and the **next 3 run times** — all recompute on every change.
- The grid opens **seeded on a sane default** (`0 9 * * *` — "every day, at 9:00 AM"), never empty and never `* * * * *` (a per-minute firehose).

Rejected: two tabs (Build / Explain). The developer's initial lean was two doors ("I know which direction each time"), but the flat-grid choice made the directions converge — paste-to-explain and build-from-scratch land in the same place, so a tab split would be ceremony. One state group also dissolves the AD-16 "known caveat" for free (below).

---

## Kept (unchanged, and deliberately so)

| Item | Rationale |
| --- | --- |
| `umbra-core::cron` — `explain` / `explain_at` (the `now` parameter stays the test-reproducibility contract — do **not** inline `Local::now()`); `CronExplanation { description, next_runs }` **as a base**, extended below | The cron→English direction is correct and stays. `explain_at`'s `croner` parse + `.iter_after(now).take(3)` + `cron-no-upcoming-runs` guard on an empty `next_runs` are all unchanged. |
| The **project-owned `describe()` templater** + `FieldSpec` enum + `parse_field` + `time_clause` / `day_clause` / `weekday_name` / `month_name` / `ordinal` / `join_with_and` / `capitalize_first` / `format_time_of_day` / `fallback_description` | Still produces the nice one-liner ("Every weekday, at 9:00 AM") when the shape is in its vocabulary. **Still deliberately not `croner::Cron::describe()`** — a project-owned contract. The builder reuses `time_clause`/`day_clause` for its live preview. |
| `map_cron_error` (7 `CronError` arms → `cron-*` codes) + `find_out_of_range_field` + `FIELD_RANGES` | The pasted-expression path still needs full `croner` error mapping. `InvalidDate` / `InvalidTime` / `TimeSearchLimitExceeded` stay as unreachable-but-covered arms. |
| `cron-no-upcoming-runs` calendrical-impossibility guard (e.g. `0 0 30 2 *`) | A schedule that will never run is still an error, not a silent description. Unchanged. |
| `src-tauri/src/commands/cron.rs` — **`cron_explain(expression: String)`**, `spawn_blocking` (AD-4), `map_join_error` → `cron-internal` | The one command the redesign keeps. Blocking-pool hop is AD-4 consistency and stays. |
| `src/stores/registry.ts` `cron` entry — `route: "/tools/cron"`, `icon: "cron"`; **no `drop`, no `shortcut`** | Route and icon unchanged. `clipboardMatch` / `aliases` — see *Registry* below (a decision, not silently kept). |
| `src/tools/cron/cronExplanation.ts` — the hand-synced `CronExplanation` interface **as a base** | Kept and extended (a `fields` member, below). Its "keep in sync by hand" discipline stays. |
| `next_runs` as **unix epoch seconds, `i64`, across IPC** (Consistency Conventions — named explicitly for cron next-run times) | Unchanged. Humanising to local datetime stays view-side via `formatDateTime` (`src/shell/locale.ts`) — AD-1. |
| `src/tools/cron/CronView.spec.ts` intent for the cron→English path (explain renders, `role="alert"` on error, stale-output cleared on a later failure, superseded-discard) | Behaviours preserved; the spec is rewritten to the new structure in Task 2b, not discarded. The NL-path tests (`clickScheduleButton` helper, honest-failure-with-context, scoped paste) are removed with the feature. |

---

## Changed (interaction)

| Change | Detail | Rationale |
| --- | --- | --- |
| **Two sections → one bidirectional grid** | The bare `<hr>` and the separate "Schedule to cron" `<h2>` section are gone. One surface: expression line + 5-field grid + live panel. | The container decision above. |
| **Explain button removed** | `describe()` + next-runs recompute live on every expression-line or field edit, debounced (`src/shell/debounce.ts`, `.cancel()` in `onUnmounted`). | The 8.2 / 8.3 / 8.4 / 8.5 direction. `explain` is microseconds; a button was ceremony. |
| **Convert button removed** | There is nothing to "convert" — the grid *is* the composed expression, always current. | Structural consequence of the builder. |
| **Both "Paste from clipboard" buttons removed** | Native `Cmd/Ctrl+V` into the expression line works. | 8.2 / 8.5 precedent ("hell no" to keeping a paste button). |
| **"Copy description" / "Copy expression" → icon-buttons** | ~24 px ghost icon-button via `useCopyFeedback` (`src/tools/json/useCopyFeedback.ts`, cross-tool import with its existing hoist-candidate comment — hoist still **not** done, five consumers now). `markCopied` only after the write resolves; `cancelCopyFeedback()` in `onUnmounted` **and** on any expression change. | Standard pattern across JsonTree / Base64 / UUID / Hash / JWT. Copy target: the expression string (primary); the English description is a secondary copy affordance on the live panel. |
| **Epic-7 tokenisation pass** | `CronView.vue` is 100 % pre-Epic-7. `#b00020` → `--color-accent-destructive`; `#666` → `--color-text-secondary`; `#ccc` → `--color-border-hairline`; `border-radius: 6px` → `--radius-*`; bare `font-family: monospace` → `--font-code-*`; plain `<button>` → removed (no buttons) or `AppButton` where any survive. `base.css` already styles bare `<input>` / `<textarea>` — don't re-style what it covers. | First slice of Task 2b, comparable scope to 8.4 / 8.5's tokenisation passes. |
| **`role="status"` on a successful result** | The live panel's description/breakdown/next-runs output gets a polite announcement. Errors already get `role="alert"`. | Accessibility fold-in candidate flagged in the story Dev Notes — NFR5 (cron is a named step in the keyboard-only demo). |
| **6-field expressions rejected** | `croner` silently accepts an optional leading seconds field; today `describe()` discards it (`6 => fields[1..]`) so `"30 0 9 * * 1"` describes as "at 9:00 AM" but fires at 9:00:30 (`deferred-work.md`, Story 3.1). The redesign rejects 6-field with an honest `cron-*` error ("this tool handles standard 5-field expressions"). | Developer's explicit call. A tool that "explains an expression properly" must not lie about seconds; supporting them is deferred (Cut list). |
| **`onPaste` / `onPasteSchedule` stale-success bug** (`deferred-work.md`, Story 3.2) | Dissolved — there are no paste buttons and no `parseResult`/`explanation` split; one live-recomputed panel can't hold a stale prior success. | Folded in by the redesign, not separately fixed. |

---

## Added

| Addition | Detail | Rationale |
| --- | --- | --- |
| **The guided builder — a flat 5-field grid** | Five per-field editor controls (Minute / Hour / Day of month / Month / Day of week), each covering the **plain field grammar**: every (`*`), single value, list (`1,3,5`), range (`1-5`), step (`*/15`, `10-50/5`), and combinations. Always visible. Seeded on `0 9 * * *`. Bidirectional with the expression line. | The core of the redesign. Deterministic by construction — no invalid expression can be composed. Language-neutral — control labels are `tools.cron.*` i18n keys, works in every shipped locale. |
| **Always-on per-field breakdown** (new `umbra-core` work) | A new pure function parses each of the 5 fields into a structured `FieldExplanation` (field name + a plain-instrument-voice phrase, e.g. *"Hour: 9 through 17"*, *"Day of week: Monday through Friday"*). `CronExplanation` grows `fields: Vec<FieldExplanation>`; the TS mirror grows to match. Rendered as rows under the one-line `describe()` prose. | This is the answer to "decode someone else's gnarly expression". `describe()` shrugs to `fallback_description` for anything outside its ~5 shapes; the per-field breakdown **never shrugs** — every field is individually, mechanically explainable. crontab.guru does exactly this. Honest-by-construction (no guessing). |
| **`MAX_INPUT_BYTES` in `umbra-core::cron`** | A `const` + a byte-length guard at the top of `explain` (and any new field-parse entry point) returning a new `cron-input-too-large` `ToolError`, plus unit tests. Mirrored by a frontend length ceiling on the expression line (defense-in-depth — the Hash 8.4 / JWT 8.5 pattern). Exact byte value → Task 2a (a cron expression is a single short line; even a small cap like a few KB is ~1000× any real expression). | `cron.rs` is currently the **only** transform tool with **no** size cap (JSON / Base64 / Hash have one; JWT added one in 8.5). Live-on-keystroke recompute makes a pathological paste a real cost. Over-cap renders as a calm `role="status"` line, not a red error. |

---

## Cut → backlog (AC3)

**Mixed routing** (developer's call): the custom-model exploration is substantial enough for a public GitHub issue; the rest go to the developer's personal tracked backlog. The deviation from the pure-GitHub route (8.5's #120–125) is logged here and in the story file, so all ideas stay traceable. Each idea has a max-context write-up below to seed its issue / backlog entry.

| # | Idea | Why cut | Route |
| --- | --- | --- | --- |
| 1 | **A purpose-built small NL→cron model, offline, per-language.** Not an LLM — a constrained *semantic-parsing* model (seq2seq or intent+slot), trained on AI-generated `(phrase, cron)` pairs, one per shipped language (English, French, …), running via an in-app Rust inference runtime (ONNX Runtime / `candle` / `burn`). **AD-9 returns as load-bearing:** a model *can* emit a confident wrong cron, so the round-trip-through-`describe()` verification must be reinstated for this path (model → `describe()` → show only if it round-trips → honest-fail otherwise). Real infrastructure: training-data generation, per-language model bundles (tens to ~hundreds of MB each — a visible cost for a tool whose identity is "tiny and offline"), cross-platform inference, model versioning through the updater. FR19 already reserves this as "v2". **The guided builder is its prerequisite, not its alternative** — the builder's grammar *is* the model's labelled training set and its honest-failure fallback UI. | Free-text NL→cron done well needs this; done deterministically it can't be "good enough" for arbitrary phrasing. A v2/future-epic exploration, not this story. | **GitHub [#130](https://github.com/dipaneb/umbra/issues/130)** (`backlog-candidate`, filed 2026-09-03), linking this record. |
| 2 | **6-field / seconds-precision cron support** (`"30 0 9 * * 1"`). Decide: describe the seconds field in prose + the per-field breakdown, and whether the builder gains a seconds editor. | The redesign rejects 6-field honestly for v1 (Changed, above). Supporting it accurately is its own scope. `deferred-work.md` Story 3.1 item, folded here as a tracked cut rather than re-deferred loosely. | Personal backlog. |
| 3 | **`L` (last day of month), `#nth` weekday (`5#3`), `W` (nearest weekday) in the builder grid.** Extends the field editors and the per-field breakdown to `croner`'s full field grammar — true complete parity with what the app's `croner` version accepts. | Developer chose **plain fields only for v1** (every / value / list / range / step). `L` / `#` / `W` are genuinely rare; they roughly double the per-field editor complexity and the breakdown's explainer branches. A deliberate v1 bound on the "complete parity" aspiration, tracked as the known gap. | Personal backlog. |
| 4 | **Free-text NL→cron as a fallback input path** alongside the builder (type if you want, fall back to the grid when the parser shrugs). | Explicitly rejected this session — keeping the parser keeps AD-9 fully load-bearing and carries ~700 lines of grammar + the corpus for a path the builder already covers deterministically. Recorded so the rejection is traceable. | Personal backlog (rejection note). |
| 5 | **`@daily` / `@weekly` / `@monthly` / `@yearly` / `@reboot` macro handling** — recognise them in the pasted-expression path, describe them, and/or offer them as builder presets. | Out of the plain-field-grammar v1 scope. A small, well-defined follow-up (`croner` supports the macros; `describe()` would need a branch). | Personal backlog. |
| 6 | **Timezone-aware next runs** — show the next 3 runs in a chosen timezone, or label them with the offset, rather than always local. | View-side (AD-1), genuinely useful for "will this fire during my colleague's working hours", but a distinct feature. From the competitive sweep (Cronitor does this). | Personal backlog. |
| 7 | **Show more than 3 upcoming runs** / a configurable count. | `next_runs` is `.take(3)` in core today. Making the count configurable is a `cron.*` persisted-setting + a core parameter or a view-side "load more". Minor; not this story. | Personal backlog. |
| 8 | **Schedule diff / compare** — paste two expressions, see how their run sets differ. | A distinct job (cf. the JSON diff tab, the JWT two-token diff cut). Not this redesign. | Personal backlog. |

---

## FR revision (AC2)

Epic 8's preamble makes the FR19–FR22 revision this story's own output. This is the largest FR change in Epic 8.

- **FR19** (was: *"Convert a natural-language schedule to a standard 5-field cron expression, fully offline via a deterministic parser (v1 decision; model/hybrid upgrade is v2)"*)
  → **substantially rewritten:** free-text natural-language input is **retired**. The English→cron direction is now a **language-neutral guided builder** — a flat grid of per-field editors that composes any expression in the plain field grammar (every / value / list / range / step), deterministic by construction, its controls localised via i18n keys. A **model/hybrid free-text NL→cron** remains a v2 exploration (Cut #1) and, if built, must reinstate AD-9's round-trip verification.
- **FR20** (was: *"Convert a cron expression to a plain-English description, including the next 3 upcoming run times"*)
  → **kept and expanded:** the one-line `describe()` prose stays; an **always-on per-field breakdown** is added (never shrugs, unlike the prose fallback); **6-field expressions are rejected** with an honest error rather than silently mis-described; next-3-runs unchanged.
- **FR21** (was: *"When input can't be confidently converted, the tool says so and shows what it did understand — no silently wrong cron. Acceptance basis: the canonical phrase corpus in `crates/umbra-core/src/cron.rs` (Story 3.3; must-convert ≥30, must-honestly-fail ≥10), maintained as an automated test."*)
  → **retired.** With no free-text input, there is nothing to "honestly fail" on. The `MUST_CONVERT` / `MUST_HONESTLY_FAIL` phrase corpus and its three gate tests are **deleted** (git history preserves them; Cut #1 notes their value as future model training/eval data). The *honesty principle* migrates and is arguably stronger: every edit is **re-described live from the expression actually composed**, so a mistake surfaces immediately, and the explain direction's per-field breakdown **never shrugs**. **Corrected 2026-09-06 (code review):** an earlier draft of this line claimed the builder *cannot compose an invalid expression*. It can — the five boxes take raw field text, and `99` in Minute returns `cron-component-error`. The guarantee is honest, immediate reporting, not impossibility. Developer explicitly approved this retirement 2026-09-03.
- **FR22** (was: *"English input only in v1"*)
  → **retired.** There is no language-specific input anymore. The builder is language-neutral; its labels localise for every shipped locale.

---

## AD-1 functional-core split (AC4)

### Survives as-is in `crates/umbra-core/src/cron.rs`
`explain` · `explain_at` (with the `now` test-contract parameter) · `map_cron_error` · `find_out_of_range_field` · `FIELD_RANGES` · the `cron-no-upcoming-runs` guard · `describe` · `fallback_description` · `FieldSpec` · `parse_field` · `time_clause` · `day_clause` · `weekday_name` · `month_name` · `ordinal` · `join_with_and` · `capitalize_first` · `format_time_of_day` · their unit tests.

### New core work
- A **per-field parser + explainer**: `pub fn` taking the trimmed 5-field expression, returning `Vec<FieldExplanation>` (one per field: name + instrument-voice phrase covering `*` / value / list / range / step). Shares parsing shape with `FieldSpec` where sensible; does **not** call `croner`'s internal pattern representation (project-owned, same principle as `describe()`).
- `CronExplanation` grows `fields: Vec<FieldExplanation>` (and a `FieldExplanation` struct — `serde` derive, `snake_case` fields for the TS mirror).
- `explain_at` populates `fields` alongside `description` / `next_runs`.
- **6-field rejection**: a `match fields.len()` arm returning a `cron-*` error (reuse an existing code or add `cron-six-field-unsupported` — Task 2a decides).
- `const MAX_INPUT_BYTES` + a byte-length guard + `cron-input-too-large` `ToolError` + tests (at cap / over cap / normal unaffected).
- Deletions (see below) are also core work.

### Deleted from `crates/umbra-core/src/cron.rs` (~700 lines + associated tests)
`parse_schedule` · `parse_schedule_at` · `try_parse_full` · `build_result` · `field_to_cron` · `parse_day_clause` · `parse_weekday_name` · `parse_weekday_list` · `parse_time_fixed` · `parse_hour_minute` · `parse_ampm` · `parse_time_step` · `detect_ambiguous_time` · `starts_with_word` · `unrecognized_message` · `ambiguous_time_error_*` · `day_understood_error` · `FixedTimeOutcome` · `ScheduleParseResult` · every `parse_schedule_*` unit test · `MUST_CONVERT` · `MUST_HONESTLY_FAIL` · the three corpus gate tests.

### Explicitly NOT new core work
- **No new crate.** `crates/umbra-core/Cargo.toml` gains nothing. `croner` stays 3.x, invoked through the same `Cron::from_str` + `iter_after` entry points — the dependency-drift re-verification (`deferred-work.md` / Consistency Conventions) is **N/A this story**. No network-capable dependency enters the tree; the AD-7 `cargo tree -i reqwest` audit is unaffected.
- **No `croner::Cron::describe()` / `describe_lang()`.** Still project-owned templating — the per-field explainer is new project code, not a delegation.
- **Field *composition* (structured spec → expression string)** is expected to be **view-side JS** — pure string assembly with no correctness risk, immediately validated by the round-trip (compose → send to `cron_explain` → render). Whether any part belongs in core is a small open item for Task 2a; the *parsing* direction (expression → structured, shared with the breakdown) is unambiguously core.

### View-owned (AD-1 presentation — never core)
The 5-field editor controls and their layout; bidirectional binding between the expression line and the field editors; field composition (structured → string); the debounced live recompute; humanising `next_runs` epoch `i64` → local datetime via `formatDateTime`; any relative-time / "next run in…" strings; the `role="status"` announcement; per-field breakdown *rendering*; the Epic-7 tokenisation; removal of all buttons; `useCopyFeedback` copy icons; the frontend length ceiling.

### Command layer
- `cron_explain(expression: String)` — **kept**, the one call site (the composed expression and any pasted expression both route through it).
- `cron_parse_schedule(phrase: String)` — **deleted**. `src-tauri/src/commands/cron.rs` drops it and ~2 of its 4 `#[tokio::test]`s.
- `src-tauri/src/lib.rs` — `use commands::cron::{cron_explain, cron_parse_schedule};` → `use commands::cron::cron_explain;`; the `cron_parse_schedule` line removed from `generate_handler!`.

### `cronExplanation.ts`
- `CronExplanation` interface — **kept**, grows `fields: FieldExplanation[]` (+ a `FieldExplanation` interface), each with the existing "keep in sync by hand" comment.
- `ScheduleParseResult` interface — **deleted**.

### AD-16 (latest-wins scoping)
**One local `createLatestWinsRunner()`** backs the single `cron_explain` call site, driven by the debounced watcher. The current four-instance / two-section arrangement and its documented "known caveat" (separate runner instances racing on shared state within each section — `deferred-work.md`, Story 3.2) both **dissolve** with the single-state-group redesign. **Not** `registry.getLatestWinsRunner("cron")` — cron has no `DropZone.vue` write-surface.

---

## AD-9 amendment (architecture-spine touch — surfaced, not folded)

**AD-9** (`ARCHITECTURE-SPINE.md` ~93–97) reads *"NL→cron never ships an unverified guess"* — every generated expression round-trips through `describe()` by string-equality before display, and the phrase corpus runs as a CI gate. It is cited as **non-negotiable** throughout the current 8.6 story file.

The guided-builder direction **removes AD-9's subject in this tool.** A builder composes an expression from discrete valid field choices — there is no interpretation to verify, no guess to round-trip. The corpus was FR21's teeth for free-text input; with the input gone, so is its purpose.

**Amendment (to record in `ARCHITECTURE-SPINE.md` at build time, per CLAUDE.md's "new shared infra / spine changes are surfaced as decisions" discipline):**

> The free-text NL→cron leg is retired (Story 8.6) in favour of a language-neutral guided builder that is deterministic by construction. AD-9's round-trip-before-display mandate and the phrase-corpus CI gate **remain binding on any future free-text or model-based NL→cron** (a v2 exploration — see Story 8.6's Cut #1). The guided builder needs neither: it cannot emit an invalid or unintended expression, and its output is immediately re-described via `cron_explain` for live user feedback.

This is a genuine spine change and is called out here for the developer's explicit acknowledgement, not treated as an in-story tweak.

---

## AD-13 resolution — the English-only disclosure

**AD-13's 2026-08-23 amendment named this exact revamp** as the point at which the deferred NL→cron localisation would be revisited, and required the English-only limitation stay *disclosed and visible* until then (`tools.cron.englishOnlyNotice`, the "in English" clause in the French `description`).

**The redesign dissolves the constraint rather than satisfying it.** There is no natural-language grammar anymore — the builder's controls are i18n keys, the pasted-expression path is language-neutral, and a cron expression has no language. So:

- The dashed `.english-only-notice` `<p>` is **removed entirely** — nothing to disclose.
- The French `description` loses its "in English" clause (`"Traduire entre l'anglais courant et les expressions cron."` → a straight description of the builder + explainer; final French copy → Task 2a).
- `tools.cron.englishOnlyNotice` is deleted from `en.json` and `fr.json`.

Recorded explicitly (AD-13's amendment requires the disclosure "not be silently dropped or softened"): it is being dropped **because the thing it disclosed no longer exists**, not softened while the limitation persists. To record in `ARCHITECTURE-SPINE.md` alongside the AD-9 amendment.

---

## i18n / `TRANSLATABLE_CODES` finding

- **No `cron-*` code becomes translatable.** The rationale for excluding them (`src/shell/toolError.ts` lines ~36–38 — "the parser is English-only, so an English cron error is expected") is now *even stronger*: `cron-*` errors from the pasted-expression path carry `croner`'s own runtime message text and field-name `context` strings. `cron-input-too-large` embeds a byte count → stays out, matching `hash-input-too-large` / `json-input-too-large` / `jwt-input-too-large`. `TRANSLATABLE_CODES` is **not** extended by this story. If a 6-field expression gets a fixed, value-free `cron-six-field-unsupported` code, whether *it* joins `TRANSLATABLE_CODES` is a Task 2a micro-decision (leaning: yes — it's classified and value-free, the 8.1/8.2 pattern).
- **Locale keys** (`src/locales/{en,fr}.json`, `tools.cron.*`): the current 11 keys are reworked — `heading` stays; `expressionLabel` stays; `explain` / `copyDescription` / `scheduleToCron` / `scheduleLabel` / `schedulePlaceholder` / `convert` / `copyExpression` / `englishOnlyNotice` are removed or replaced. **New:** the five field-editor labels + their option strings (every / value / list / range / step), the per-field-breakdown field names, the live-panel labels, the copy affordances, the 6-field-rejection message, the over-cap `role="status"` line. `fr.json` gets the same keys — the builder is now fully localisable. `src/locales/locales.spec.ts` compiles every message.
- **vue-i18n `{` / `}` trap:** any new string showing a literal cron fragment with braces, or `{placeholder}`-looking help text, needs the `{'{'}` / `{'}'}` escape (a bare cron expression `* * * * *` has no braces, but a step example like `*/15` in help text is fine; an explainer showing `{ }` is not). Reach for it proactively.

---

## Registry / `clipboardMatch` decision (AD-6)

**No `clipboardMatch` is added this story — but the option is recorded, not silently skipped.**

- A `clipboardMatch` predicate that recognises a `* * * * *`-shaped string on the clipboard and suggests the Cron tool is a plausible "Added". But a five-token space-separated string of `*` / digits / `-` / `,` / `/` is **highly ambiguous** against ordinary text and other tools' content — the false-positive risk is real, and specificity/ordering against `matchesJwt` (spec. 3), the JSON matcher, and the classified `base64-*` matcher would need care.
- Adding a predicate means a new `src/shell/clipboardMatch.ts` export — an **AD-6 shell concern**, present-as-options-with-trade-offs per CLAUDE.md, not an in-story tweak.
- **Decision: defer.** Not added now; a candidate for a future shell-scoped story (alongside the `isJwtShaped`-tightening backlog item #125 — same category of work). `aliases` and `shortcut` also unchanged.

---

## EXPERIENCE.md Flow 3 — scripted demo step change (developer approved)

`EXPERIENCE.md` Flow 3 (the five-minute keyboard-only walkthrough) contains a named step:

> `⌘K` "cron" → type *"every Monday at 9am"* → `0 9 * * 1`

**That step no longer exists** — there is no free-text phrase input. Replacement (developer approved 2026-09-03), to edit into `EXPERIENCE.md` at build time:

> `⌘K` "cron" → in the grid, set **Day of week** to *Monday* and **Hour** to *9* → expression line shows `0 9 * * 1`, panel reads *"Every Monday, at 9:00 AM"*, next 3 runs listed.

Arguably a better demo — it shows the builder doing its job and the live panel updating — but it is a change to the locked experience script, surfaced here per governance rather than folded.

---

## Open items Task 2a owns

1. **Exact `MAX_INPUT_BYTES` value** and the exact over-cap `role="status"` copy (a cron expression is one short line — the cap can be small; pick a value and justify it).
2. **6-field rejection**: reuse an existing `cron-*` code or add `cron-six-field-unsupported`; and whether that new code joins `TRANSLATABLE_CODES`.
3. **Field-editor control design** — how "every / value / list / range / step" is offered per field without overwhelming (segmented control? a small mode dropdown + a value input? chips for lists?). A states/anatomy design canvas is the likely vehicle.
4. **Field composition location** — confirm structured-spec → expression-string assembly is view-side JS (leaning yes; immediately round-trip-validated via `cron_explain`), or identify the slice that belongs in core.
5. **Per-field breakdown wording** — the exact instrument-voice phrasing per field shape ("Minute: every 15 minutes" vs "Minute: 0, 15, 30, 45"; range inclusivity; step-from-a-range).
6. **Live-panel layout** — order and prominence of: expression line, one-line `describe()` prose, per-field breakdown rows, next-3-runs. Whether the prose one-liner is hidden when it would only be `fallback_description`.
7. **Seed value** — confirm `0 9 * * *` as the grid's opening state (vs `* * * * *`, vs last-used persisted).
8. **Persisted `cron.*` settings** — whether any exist (e.g. a remembered next-runs count, a 12h/24h next-run display toggle). Leaning: none for v1. If added, the 8.3 `uuid.*` / 8.4 `hash.*` `DEFAULTS`-map pattern, no new Settings section.
9. **Next-runs count** — keep the hard-coded 3, or make it a view-side "show more" / a setting (Cut #7 is the richer version).
10. **Spec rewrite** — `CronView.spec.ts` to the new single-surface structure (Task 2b), but the AC set should name the behaviours that must stay covered (bidirectional binding both ways, live recompute, 6-field rejection, over-cap state, `role="alert"` vs `role="status"`, copy-after-resolve).
11. **The per-field editor component** — a cron-island component under `src/tools/cron/` (AD-6 default), unless Task 2a sees genuine cross-tool reuse (it should not).

---

## Addendum — localized schedule descriptions (2026-09-06, Task 2b)

**Status:** decided and implemented during Task 2b, after the developer reviewed the working
tool. Supersedes this record's original "no `cron-*` code becomes translatable" / English-only
`describe()` position, and the AD-13 resolution above.

### What prompted it

The record above kept `describe()` as an English-only, core-side templater and treated AD-13 as
resolved because the *parser*'s English-only-ness was gone. Reviewing the built tool surfaced
the gap that reasoning left open: the prose one-liner and the five per-field breakdown rows
were still English strings generated in Rust, so a French user got a French UI wrapped around
English prose. AD-13's letter was not met; its disclosure had been removed anyway. The
developer's call: **the cron tool must work in every shipped language, in this story.**

### The decision: serialize meaning, render at the edge

The English sentence was presentation formatted at the wrong layer. Once a schedule is
collapsed into `"Every weekday, at 9:00 AM"` the meaning is destroyed and no other locale can
be derived from it — the same class of error as returning a formatted date string instead of a
timestamp. This codebase already had the correct pattern one module over: `ToolError` carries a
`code`, and `src/shell/toolError.ts` decides what sentence that becomes, per locale.

Four options were weighed:

| | Verdict |
|---|---|
| **A1** — core serializes the raw field AST, view interprets *and* phrases | Rejected: drags well-tested interpretation into TS |
| **A2** — core serializes a normalized semantic description, view phrases only | **Chosen** |
| **B** — a `describe_fr()` per language in Rust, locale passed over IPC | Rejected: puts locale awareness in core (against AD-1), grows the command signature with a presentation concern, N languages = N Rust modules with drift risk |
| **C** — buy `cronstrue` (30+ locales) | Rejected: it produces one sentence; this tool also renders five per-field breakdown rows, which no library provides. Buying would localize ~1/6 of the prose surface and still require the pipeline, leaving two rendering systems side by side in one panel |

The A1/A2 line was drawn by one test: **would this logic be identical for an English reader, a
French reader, and a machine?** Parsing, name resolution (`FRI` → 5), `?` → wildcard, and
cron's day-field OR rule pass — they stay in core. Idiom selection (fusing minute+hour into
"9:09 AM", saying "every weekday" for `1-5`) does *not* — those are English phrasing choices,
and they moved to the view along with the corpus that tested them.

### The contract

`CronExplanation { schedule: ScheduleDescription, next_runs: Vec<i64> }`, where
`ScheduleDescription` carries five normalized `FieldTerm`s (`Every` / `Value` / `Values` /
`Range` / `Step{step, within, from}` / `Union` / `Unsupported{raw}`) plus a `DayMatch`.

Two design notes worth keeping:

- **`Unsupported { raw }` replaced `description_generic: bool`.** The boolean said "something
  somewhere was unrenderable"; the variant says *which field* and *what the raw text was*, in
  that field's own slot. That is what lets the view suppress the sentence while still rendering
  four good breakdown rows and one honest raw one.
- **`day_match` is derivable but stated anyway.** Cron fires on day-of-month OR day-of-week
  when both are restricted. That rule is obscure enough that leaving each locale renderer to
  rediscover it is how one of them silently gets it wrong.

### Consequences

- `umbra-core::cron` produces no prose. ~520 lines of Rust phrasing deleted.
- `src/tools/cron/locales/{en,fr}.ts` are standalone renderers implementing a two-method
  interface. Deliberately **not** a shared framework they parameterize: a frame that fits
  English and French breaks on the first language with different word order, and duplication is
  cheaper than the wrong abstraction at this scale.
- `Intl.ListFormat` and `Intl.PluralRules` (CLDR) supply list conjunction and ordinal
  categories per locale rather than hand-rolled tables. This required bumping `tsconfig.json`'s
  `lib` from ES2020 to ES2021 — types only, `target` unchanged. **A third non-cron-island file
  beyond AC26's two**, recorded here rather than folded in silently.
- Adding language #3 is one renderer module plus a row in `describeSchedule.ts`. No Rust
  change, no IPC change, no architecture decision.
- The English renderer was ported to TypeScript and passed the entire Rust corpus unchanged on
  first run — the migration is provably behaviour-preserving, not merely plausible.

### Follow-ups not taken

- `L`, `5#3`, `15W` still render as `Unsupported` (Story 8.6 Cut #3, unchanged). They are now
  the *only* trigger for sentence suppression.
- `@daily` / `@hourly` macros remain out of scope (Cut #5) — they are not 5-field expressions
  and the field strip cannot represent them.
- French copy was written by a non-native reviewer of this codebase and verified by the
  developer at render-review; a third language would need the same native-reader check.
