# Sprint Change Proposal — 2026-09-06

**Trigger story:** Story 8.6 — Reimagine NL ↔ Cron (Task 2b complete, commit `c91c589`)
**Change type:** Requirements drift — implementation diverged from signed-off acceptance criteria through a series of deliberate, developer-approved decisions that were never propagated upstream
**Mode:** Batch
**Scope selected:** all three artifact layers (Story 8.6 ACs, PRD, epics.md)
**Status:** approved and applied 2026-09-06 (see §6)

---

## 1. Issue Summary

Story 8.6 rewrote the cron tool. Two things drifted, in opposite directions, and neither was an accident:

**Downstream drift — Story 8.6's own AC6–AC26.** The ACs were written in Task 2a and signed off on 2026-09-03, before any code existed. Task 2b then delivered in vertical slices with a developer render-review after each, and three of those reviews produced container-level course corrections that the ACs could not have anticipated:

1. The hybrid field editor specified by AC10–AC12 (segmented `Every|Specific` + a name-aware `<select>` + an auto-expanding `▸ Advanced` disclosure) was rejected on sight — *"I know I decided the tool to be like this but now that I see it it's terrible."* Three stacked controls × five fields, with two affordances asking the same question. Replaced by a compact single-row strip of five plain inputs.
2. The editable expression line specified by AC6 and AC7 was cut as duplication once the strip existed. The composed string became a read-only readout inside the results panel.
3. Schedule descriptions were localized, which AC13–AC15 and the Task 1 decision record had both explicitly scoped out (`describe()` was to stay an English-only core templater). This one was a deliberate mid-story scope expansion — *"story 8.6 is the rewrite of the cron tool, no matter the time it takes"* — and it changed the core/view contract.

**Upstream drift — the PRD and epics.md.** Task 1's decision record revised FR19–FR22 and the developer signed that off on 2026-09-03. The revision was recorded *in the decision record only*. `prds/prd-Umbra-2026-07-19/prd.md` and `epics.md` still carry the original text, so both currently describe a natural-language parser and a phrase corpus that no longer exist in the codebase.

**Evidence:**
- `crates/umbra-core/src/cron.rs` at `c91c589` contains no `parse_schedule`, no `MUST_CONVERT`/`MUST_HONESTLY_FAIL`, and no prose generation of any kind.
- `prd.md:79` still cites "the canonical phrase corpus in `crates/umbra-core/src/cron.rs` (Story 3.3)" as FR21's acceptance basis. That corpus is deleted.
- `prd.md:80` still says "English input only in v1." The tool ships English and French descriptions.
- `epics.md:167–170`'s FR→epic coverage map still routes FR19–FR22 to Epic 3 alone.
- Story 8.6's AC6, AC7, AC10, AC11 describe controls that do not exist in the shipped component.

**Why this matters now:** `bmad-code-review` is the next step, and an adversarial review against AC6–AC26 would flag roughly a third of the implementation as non-compliant when in fact every deviation was an approved product decision. Separately, FR21 is cited as a live acceptance bar by FR29, so leaving it stale propagates the error into future work.

---

## 2. Impact Analysis

### Epic impact

| Epic | Impact |
|---|---|
| **Epic 8** (Reimagine the tools) | Story 8.6 is complete in substance. Its ACs need re-sync. No other 8.x story is affected — Epic 8's preamble states 8.1–8.9 are mutually independent. |
| **Epic 3** (Natural language ↔ cron) | **Complete and shipped in August.** Its three stories describe work that has since been superseded. **Recommendation: do not rewrite them.** A completed story is a historical record of what was built at the time; editing its acceptance criteria to match a later decision falsifies that record and makes Epic 3 look like it was always about a builder. Add a forward pointer instead. |
| **Epic 9+ / future** | No dependency on the retired parser. Story 7.8's clipboard-match rationale cites "FR19's cron parser" as a deterministic-first precedent (`epics.md:1270`) — the precedent still holds, the citation needs a word change. |

### Story impact

- **Story 8.6** — AC6–AC26 rewritten (this proposal, §4.1). Task/subtask checkboxes, Dev Agent Record, File List and Change Log are already accurate and need no change.
- **Stories 3.1 / 3.2 / 3.3** — historical; forward pointer only.
- No future story requires re-planning.

### Artifact conflicts

| Artifact | Conflict | Action |
|---|---|---|
| `prd.md` FR19 | Specifies a deterministic NL parser | Rewrite (§4.2) |
| `prd.md` FR20 | Understates what shipped | Expand (§4.2) |
| `prd.md` FR21 | Cites a deleted corpus as the acceptance basis | Retire, preserving the principle (§4.2) |
| `prd.md` FR22 | "English input only in v1" — false | Retire (§4.2) |
| `prd.md` FR29 | Leans on "FR21's honesty bar" | Re-point to the principle (§4.2) |
| `prd.md` §9 decision log | "NL→cron → deterministic parser in v1" | Mark superseded (§4.2) |
| `epics.md` 67–70 | FR restatements | Mirror the PRD (§4.3) |
| `epics.md` 167–170 | FR→epic coverage map | Update (§4.3) |
| `epics.md` 200 / 645 | Epic 3 summary + preamble | Add superseded-by note (§4.3) |
| `epics.md` 647–712 | Stories 3.1–3.3 ACs | Forward pointer only — no rewrite |
| `epics.md` 1270 | "FR19's cron parser" precedent | One-word fix (§4.3) |
| `ARCHITECTURE-SPINE.md` | AD-9, AD-13 | **Already done** in `c91c589` |
| `EXPERIENCE.md` | Flow 3 step 4, NFR5 line | **Already done** in `c91c589` |
| `8-6-cron-decision-record.md` | Localization addendum | **Already done** in `c91c589` |

### Technical impact

**None.** All code is written, tested and committed. This proposal changes documents only. Verification at `c91c589`: `pnpm lint` ✓, `vue-tsc` ✓, `pnpm test` 836/836 ✓, `pnpm build` ✓, `cargo fmt --check` ✓, `cargo clippy --workspace --all-targets` ✓, `cargo test --workspace` 339/339 ✓.

---

## 3. Recommended Approach

**Option 1 — Direct Adjustment.** Effort: Low. Risk: Low.

Update the acceptance criteria and requirement text to describe what was actually built and approved. No code changes, no re-planning, no rollback.

**Options considered and rejected:**

- **Option 2 — Rollback.** Would mean reverting to the hybrid field editor and the English-only templater in order to satisfy ACs that the developer explicitly rejected after seeing them run. This inverts the purpose of the render-review gate: the reviews worked, and the ACs are what turned out to be wrong. **Not viable.**
- **Option 3 — MVP review.** The MVP is unaffected. FR19's *job* ("produce a correct cron expression offline") is delivered more reliably than the original parser managed, FR20's is exceeded, and FR21/FR22 retire because their subject no longer exists — not because scope was cut. No goal is at risk. **Not applicable.**

**Rationale for Option 1:** every deviation here was a deliberate decision made by the developer with the working software in front of them, which is strictly better evidence than the paper specification it replaced. The correct response to "the spec was wrong and we found out by building it" is to fix the spec. The one genuine scope *expansion* — localization — was an explicit, informed call that also closed a real AD-13 gap the decision record had left open.

---

## 4. Detailed Change Proposals

### 4.1 Story 8.6 — replace AC6–AC26

The section header keeps its provenance line and gains an amendment note. Full replacement text:

> Written 2026-09-03 (Task 2a); **amended 2026-09-06 (correct-course) to match what Task 2b actually delivered.** Three container-level decisions during the per-slice render-reviews superseded the original AC6–AC12 (the hybrid field editor and the editable expression line), and a mid-story scope expansion superseded AC13–AC15 (schedule descriptions are localized, so core emits no prose). The original text is preserved in git history at `b6905e7`; the reasoning for each change is in the story's Dev Agent Record and in `8-6-cron-decision-record.md`'s addendum.

**Container, layout, input**

6. **Given** the redesigned `src/tools/cron/CronView.vue`, **when** it renders, **then** it is a **single surface** capped at a readable column width — no `AppTabs.vue`, no `AppButton`, no `primary`-orange control, no natural-language `<textarea>`, no `.english-only-notice`, no `<hr>`. Layout order: `h1` → description caption → the **five-field strip** (Minute · Hour · Day of month · Month · Day of week, one row, cron order) → the **live panel**. The only interactive controls are the five field inputs and two `useCopyFeedback` copy icon-buttons.
7. **Given** the five field boxes, **then** they are the **only input surface** — there is no separate whole-expression `<input>`. The strip is seeded `0 9 * * *` (never empty, never `* * * * *`). Each box holds one field's raw grammar verbatim. **When** a whole cron expression is pasted onto the strip, **then** a 5-token paste is distributed across the boxes and a 6-token paste is sent through as-is so core returns the honest six-field rejection; anything else falls through to a normal single-box paste.
8. **Given** any field box, **when** its value changes, **then** the view recomposes the expression view-side (`fieldValues.join(' ')`) and re-runs `cron_explain` after a **200 ms debounce** (`src/shell/debounce.ts`, `.cancel()` in `onUnmounted`). Every field edit is a keystroke — the strip has no discrete controls, so there is no immediate-recompute path.
9. **Given** the redesigned tool, **when** it is exercised in any way, **then** `cron_parse_schedule` is **never invoked**, no phrase input exists in the DOM, and a **single local `createLatestWinsRunner()`** backs the one `cron_explain` call site (not `registry.getLatestWinsRunner("cron")` — cron has no `DropZone.vue` write-surface).
10. **Given** `src/tools/cron/CronFieldEditor.vue` (a cron island component), **when** one instance renders, **then** it is **one text input plus a label** — no segmented control, no `<select>`, no Advanced disclosure. The input accepts the plain field grammar directly (`*`, `5`, `1,3,5`, `1-5`, `*/15`, `10-50/5`) and its accessible name carries the field's valid range.
11. **Given** a field box, **when** its value first becomes `*` (from something that was not `*`), **then** focus moves to the next box and selects its contents. A box already holding `*` never advances, and the last box is a no-op.
12. **Given** a rendered field box, **when** the live panel has a value, **then** the box surfaces its own breakdown phrase as a hover title and the same phrases render as visible rows in the live panel — one shared source (`CronExplanation.schedule`), never a second renderer.

**Core — the language-neutral contract**

13. **Given** a valid trimmed 5-field expression, **when** `explain_at` runs, **then** it returns `CronExplanation { schedule: ScheduleDescription, next_runs: Vec<i64> }` and **no prose of any kind**. `ScheduleDescription` carries five normalised `FieldTerm`s plus a `DayMatch`; `FieldTerm` is `Every | Value | Values | Range | Step{step, within, from} | Union | Unsupported{raw}`, serialised as a `kind`-tagged union and hand-mirrored in `src/tools/cron/scheduleDescription.ts`.
14. **Given** field syntax outside this grammar (`L`, `5#3`, `15W` — Cut #3), **then** that field is `FieldTerm::Unsupported { raw }`, preserving the raw text. The view suppresses its prose sentence when any field is unsupported and renders the raw value in that field's breakdown row. This replaces the former `description_generic: bool`, which said only that *something* was unrenderable.
15. **Given** the parsing layer, **then** it covers wildcard, `?`, single value, list, range, step (over a wildcard, a range, or a single start), and mixed comma lists, plus `croner`'s month and weekday **names** (`FRI`, `MON-FRI`, `jan-mar`) — all normalised to numbers before the view sees them. `DayMatch` states cron's day-field OR rule (both day fields restricted ⇒ fires on either) once, in the domain layer.
16. **Given** a **6-field** expression, **then** it is rejected with `cron-six-field-unsupported` — a fixed, value-free sentence, the one `cron-*` code in `TRANSLATABLE_CODES`, with `errors.cron-six-field-unsupported` keys in `en.json` and `fr.json`. Rendered `role="alert"`; the panel is **cleared**, not held (superseding this AC's original "hold the last valid state" — a stale result beside a message the user must read invites reading the wrong one).
17. **Given** input over the cap, **then** `crates/umbra-core/src/cron.rs` defines `const MAX_INPUT_BYTES: usize = 1024` with a byte-length guard at the top of `explain_at`, returning `cron-input-too-large` (embeds the cap ⇒ stays **out** of `TRANSLATABLE_CODES`). The view mirrors the ceiling before IPC and renders `role="status"` — calm, not an alert — and clears the panel.
18. **Given** the parser retirement, **then** these are **deleted**: `parse_schedule` · `parse_schedule_at` · `try_parse_full` · `build_result` · `field_to_cron` · the whole day/time clause grammar · `FixedTimeOutcome` · `ScheduleParseResult` · `MUST_CONVERT` · `MUST_HONESTLY_FAIL` · the three corpus gate tests · `cron_parse_schedule` (and its `lib.rs` registration) · all `cron-nl-*` codes. **Additionally deleted 2026-09-06:** the entire English phrasing layer (`describe`, `fallback_description`, the clause and phrase functions, `field_explanations`, `FieldExplanation`), once rendering moved to the view.
19. **Given** the cron→English direction, **then** these are **kept**: `explain` / `explain_at` (the `now` parameter stays the test-reproducibility contract), `map_cron_error` / `find_out_of_range_field` / `FIELD_RANGES`, the `cron-no-upcoming-runs` guard, `cron_explain` (`spawn_blocking`, AD-4), the `cron` registry entry (no `drop` / `clipboardMatch` / `shortcut` — a `clipboardMatch` remains a deferred shell concern, AD-6), and `next_runs` as unix-epoch-seconds `i64` humanised view-side via `formatDateTime`. `croner` stays 3.x on the same entry points — no `Cargo.toml` change, no new crate.

**Localization, i18n, settings, copy, tokenisation, accessibility**

20. **Given** schedule descriptions, **then** they are rendered **view-side, per locale** by `src/tools/cron/locales/{en,fr}.ts`, each a standalone `CronLocale` implementation (`sentence()` + `fieldPhrase()`) — deliberately not a shared framework the locales parameterise. `Intl.ListFormat` and `Intl.PluralRules` supply CLDR list-conjunction and ordinal rules rather than hand-rolled tables. Adding a language is one module plus a row in `describeSchedule.ts`; core does not change. `tools.cron.*` carries the UI labels only (heading, description, the five field names, panel labels, copy affordance); `fr.json` has full parity and the French `description` no longer says "in English."
21. **Given** v1 scope, **then** there are **no persisted `cron.*` settings** — `src/stores/settings.ts` and `SettingsView.vue` untouched. The next-runs count stays hard-coded at 3.
22. **Given** copy affordances, **then** each is a ~24 px ghost icon-button via `useCopyFeedback` (fifth consumer; the hoist is still **not** done). Primary target: the composed expression string. Secondary: the prose one-liner. `markCopied` fires only after the write resolves; `cancelCopyFeedback()` runs in `onUnmounted` **and** on any expression change.
23. **Given** `CronView.vue` was 100 % pre-Epic-7, **then** it is fully tokenised — no `#b00020` / `#666` / `#ccc` / hardcoded radius / bare `monospace`; every margin, gap and padding on `--spacing-*`. A successful live panel carries `role="status"`; errors carry `role="alert"`; an always-present `.sr-only` polite region announces completed explains.
24. **Given** NFR5 (cron is a named step in the keyboard-only demo), **then** every control is a keyboard tab stop with an SR label and a visible focus ring, and both the build-a-schedule and paste-to-read flows complete with the keyboard alone — helped by the `*` auto-advance in AC11.

**Specs and cross-doc**

25. **Given** the rewrite, **then** `CronView.spec.ts` covers: seeded mount (strip state + prose + 5 breakdown rows + 3 runs); field edit → expression recomposes + explain re-runs; debounce timing and `.cancel()` on unmount; no action buttons / phrase input / english-only notice; paste-distribution of a 5-field expression; 6-field → `role="alert"` + translated message + panel cleared; over-cap → `role="status"` + no IPC + panel cleared; invalid value → `role="alert"` + panel cleared; calendrically impossible → `cron-no-upcoming-runs`; success → `role="status"` + the polite announce region; copy-after-resolve and feedback clearing; unsupported syntax → sentence suppressed, breakdown intact; superseded-result discard; `cron_parse_schedule` never invoked. `CronFieldEditor.spec.ts` covers the input, label, range-bearing accessible name, hover-title phrase, the `advance` emit and its guard, and the exposed `focus()`. `locales/en.spec.ts` and `locales/fr.spec.ts` each hold a real-world corpus; the French spec additionally asserts gender agreement, `de+le`/`à+le` contraction, elision, single-marked ordinals, the 24-hour clock and CLDR list joining.
26. **Given** the Task 1 sign-off, **then** the non-Cron-island files this story edits are: `ARCHITECTURE-SPINE.md` (the AD-9 amendment and the AD-13 **resolution** — the 2026-08-23 deferral closes by satisfying the rule's letter, since the descriptions ended up localized), `EXPERIENCE.md` (Flow 3's demo step and the NFR5 keyboard line), `src/shell/toolError.ts` (`cron-six-field-unsupported` into `TRANSLATABLE_CODES`, stale comment rewritten), `src/locales/{en,fr}.json`, and **`tsconfig.json`** (`lib` ES2020 → ES2021, types only, for `Intl.ListFormat`) — the last recorded as one file beyond the original two rather than folded in silently.

### 4.2 PRD — `prds/prd-Umbra-2026-07-19/prd.md`

**FR19** (line 77)

> OLD: **FR19.** Convert a natural-language schedule ("every Monday at 9am") to a standard 5-field cron expression, fully offline (INV-1). **Decided:** v1 uses a deterministic parser (exact, tiny, testable); the small-local-model/hybrid upgrade is v2 (see addendum).
>
> NEW: **FR19.** Build a standard 5-field cron expression through a **language-neutral guided editor** — a row of per-field inputs composing any expression in the plain field grammar (wildcard, value, list, range, step) — fully offline (INV-1). **Revised 2026-09-06 (Story 8.6):** v1 originally specified a deterministic natural-language parser ("every Monday at 9am" → `0 9 * * 1`). That parser is **retired**. Free-text NL→cron cannot be done well deterministically, and doing it well implies a local model this product will not ship in v1; the developer's reframe was that "English → cron" is a *structure* problem ("I forget the field order and whether Sunday is 0 or 7"), not a *language* problem, so it is now solved structurally. A small-model/hybrid free-text upgrade remains a v2 exploration ([dipaneb/umbra#130](https://github.com/dipaneb/umbra/issues/130)) and must reinstate AD-9's round-trip verification if built.

**FR20** (line 78)

> OLD: **FR20.** Convert a cron expression to a plain-English description, including the next 3 upcoming run times.
>
> NEW: **FR20.** Convert a cron expression to a plain-language description, including the next 3 upcoming run times. **Expanded 2026-09-06 (Story 8.6):** the description is now (a) a one-line sentence covering the whole plain field grammar, (b) an always-on per-field breakdown that never falls back, and (c) **rendered in the user's language** — `umbra-core` returns a language-neutral `ScheduleDescription` and the view renders it per locale (English and French ship). Six-field seconds-precision expressions are rejected honestly rather than silently mis-described.

**FR21** (line 79)

> OLD: **FR21.** When the input can't be confidently converted, the tool says so and shows what it _did_ understand — no silently wrong cron. This is the AI-quality bar… Acceptance basis: the canonical phrase corpus in `crates/umbra-core/src/cron.rs` (Story 3.3; must-convert and must-honestly-fail sets), maintained as an automated test.
>
> NEW: **FR21. RETIRED 2026-09-06 (Story 8.6).** With no free-text input there is nothing to honestly fail on; the phrase corpus and its CI gate are deleted (git history preserves them). **The honesty principle survives and arguably strengthens:** the guided editor cannot compose an invalid expression, and the per-field breakdown never shrugs. AD-9's round-trip-before-display mandate remains binding on any future free-text or model-based NL→cron. **Where other requirements cite "FR21's honesty bar" they mean this principle, not the retired corpus gate.**

**FR22** (line 80)

> OLD: **FR22.** English input only in v1 (French is a P3 candidate, coupled with FR25's rule).
>
> NEW: **FR22. RETIRED 2026-09-06 (Story 8.6).** There is no language-specific input any more — the editor's controls are i18n keys and a cron expression has no language. Schedule descriptions render in the user's locale; adding a language is one renderer module. AD-13's cron deferral (2026-08-23) is closed by satisfying the rule's letter.

**FR29** (line 96) — replace the trailing sentence:

> OLD: … FR21's honesty bar applies.
> NEW: … the honesty bar formerly stated as FR21 applies (see FR21's retirement note — the principle outlived its acceptance mechanism).

**§9 decision log** (line 150)

> OLD: - **NL→cron → deterministic parser in v1**; small-local-model/hybrid upgrade in v2. FR21's honesty bar applies to both stages.
> NEW: - **NL→cron → deterministic parser in v1**; small-local-model/hybrid upgrade in v2. ~~FR21's honesty bar applies to both stages.~~ **Superseded 2026-09-06 (Story 8.6):** the deterministic parser is retired in favour of a guided editor; the model/hybrid path stays a v2 exploration (#130) and inherits the honesty principle formerly stated as FR21.

### 4.3 Epics — `epics.md`

- **Lines 67–70** — mirror the four PRD revisions above, one line each, each carrying the "Revised/Retired 2026-09-06 (Story 8.6)" marker.
- **Lines 167–170** (FR→epic coverage map):
  > FR19: Epic 3 (deterministic parser, retired) → **Epic 8 / Story 8.6 — guided editor**
  > FR20: Epic 3 → **Epic 3 + Epic 8 / Story 8.6 (expanded: per-field breakdown, localized)**
  > FR21: ~~Epic 3~~ — **RETIRED (Story 8.6)**
  > FR22: ~~Epic 3~~ — **RETIRED (Story 8.6)**
- **Line 200** (Epic 3 summary) and **line 645** (Epic 3 preamble) — append, without altering the existing text:
  > **Superseded by Story 8.6 (2026-09-06):** the NL→cron parser and phrase corpus described here were retired in the cron revamp. This epic remains the accurate record of what shipped in August 2026; see Story 8.6 for the tool's current shape.
- **Stories 3.1 / 3.2 / 3.3 (lines 647–712)** — **unchanged.** One forward-pointer line under Epic 3's preamble covers all three. Rewriting a completed story's acceptance criteria would misrepresent what was actually built and reviewed at the time.
- **Line 1270** (Story 7.8's precedent citation):
  > OLD: … consistent with this project's established "deterministic first" philosophy (FR19's cron parser) …
  > NEW: … consistent with this project's established "deterministic first" philosophy (the cron tool's deterministic core) …

---

## 5. Implementation Handoff

**Scope classification: Minor.** Documentation-only. No code, no backlog reorganisation, no re-planning, no sprint-status change (Story 8.6 stays `in-progress` until code-review; no epic added, removed or renumbered — checklist item 6.4 is N/A).

| Recipient | Responsibility |
|---|---|
| **Developer agent** (this session) | Apply §4.1, §4.2, §4.3 exactly as approved |
| **Developer (human)** | Approve; then decide on `bmad-code-review` and the eventual push |

**Success criteria**

1. No artifact states that Umbra has a natural-language cron parser or a phrase corpus.
2. Story 8.6's AC6–AC26 describe the software at `c91c589`, so a code review scores the implementation rather than the drift.
3. FR21's honesty *principle* remains findable and correctly cited by FR29 after its acceptance mechanism is gone.
4. Epic 3's historical record stays intact, with a forward pointer rather than a rewrite.
5. No code changes; the verification results at `c91c589` remain valid.

**Not in this proposal** (tracked, not lost):
- `L` / `5#3` / `15W` support — Story 8.6 Cut #3, unchanged.
- `@daily` / `@hourly` macros — Cut #5, unchanged.
- The free-text model path — [#130](https://github.com/dipaneb/umbra/issues/130).
- The `useCopyFeedback` hoist — still deliberately not done (five consumers).

---

## 6. Execution Record

**Approved by the developer 2026-09-06. Applied the same day.**

| Section | Applied |
|---|---|
| §4.1 Story 8.6 AC6–AC26 | ✅ Replaced in full; header carries the amendment note and points at `b6905e7` for the original |
| §4.2 PRD | ✅ FR19 rewritten, FR20 expanded, FR21 + FR22 retired, FR29 re-pointed, §9 decision-log line marked superseded |
| §4.3 epics.md | ✅ FR restatements, FR→epic coverage map, Epic 3 summary + preamble superseded-notes, Story 7.8 precedent citation |

**Two additions beyond §4.3's literal enumeration**, found by the post-apply sweep and applied because leaving them would have violated success criteria 1 and 3:

- `epics.md:86` — epics.md's own copy of **FR29** still said "FR21's honesty bar applies." §4.2 fixed the PRD's copy but §4.3 never listed this one. Re-pointed identically.
- `epics.md:128` — epics.md's restatement of **AD-9** still described the round-trip and corpus as current. `ARCHITECTURE-SPINE.md` got its amendment in `c91c589`, but this mirror was missed. Amended to match.

**Verification sweep.** Every remaining mention of "deterministic parser" / "phrase corpus" / "FR21's honesty bar" across the PRD and epics is now either marked retired/superseded/amended, or sits inside Epic 3's deliberately-preserved historical record (`epics.md:16` — a dated 2026-08-07 audit note; `:199` and `:647` — the Epic 3 summary and preamble, each immediately followed by a superseded block; `:698`/`:701` — Story 3.3, untouched by design).

**No code changed.** The verification results at `c91c589` stand: `pnpm lint` ✓, `vue-tsc` ✓, `pnpm test` 836/836 ✓, `pnpm build` ✓, `cargo fmt --check` ✓, `cargo clippy --workspace --all-targets` ✓, `cargo test --workspace` 339/339 ✓.

**sprint-status.yaml:** unchanged (checklist 6.4 N/A) — no epic added, removed or renumbered; Story 8.6 stays `in-progress` until code-review.

**Next:** `bmad-code-review` on Story 8.6, then mark it done. The story's ACs now describe the software as built, so the review scores the implementation rather than the drift.
