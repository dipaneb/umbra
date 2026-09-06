# Sprint Change Proposal — Story 8.6 post-review re-sync

**Date:** 2026-09-06
**Story:** 8.6 — Reimagine NL ↔ Cron (`feat/story-8-6-reimagine-nl-cron`, uncommitted)
**Triggered by:** `bmad-code-review` (2026-09-06) and the `pnpm tauri dev` render-review that followed it
**Mode:** Batch
**Scope classification:** **Minor** — direct adjustment, no epic or MVP impact
**Status:** **APPROVED by the developer 2026-09-06.** All nine change proposals applied; routed to the Developer agent and executed in the same session. Verification after the edits: `pnpm lint` · `vue-tsc --noEmit` · `pnpm test` 845/845 · `pnpm build` · `cargo fmt --check` · `cargo clippy --workspace --all-targets` (0 warnings) · `cargo test --workspace` 345/345 — all green.

> **Second proposal of the same date.** `sprint-change-proposal-2026-09-06.md` re-synced AC6–AC12 *before* the code review, against what Task 2b had built. This one re-syncs what the code review and render-review then changed. The earlier file is left untouched as the record of what was approved then; this file supersedes it only where they overlap (AC12, AC26).

---

## Section 1 — Issue Summary

Story 8.6's code review applied 21 patches and resolved 3 decision-needed findings. Three of those changes altered behaviour that approved acceptance criteria describe verbatim, and a fourth expanded the story's file footprint. The story file therefore describes a tool that no longer exists in four places.

The changes fall into two distinct categories, worth separating because they have different causes:

**(a) One implementation defect.** The `*` auto-advance (AC11) made the step grammar the tool advertises impossible to type. `*` is simultaneously a complete field value *and* the first character of `*/15`, `*/5`, `*/2`. Advancing focus on the transition to `*` moved the caret mid-token, so the following `/15` overwrote the neighbouring field. `*/15` is named in AC10's own grammar list, in `CronFieldEditor.vue`'s header comment, and in the range hint the UI shows the user. No local signal distinguishes "the user finished" from "the user is still typing", so every candidate workaround (timeout, lookahead) is a heuristic. Removed in favour of plain Tab traversal.

**(b) Three decisions that aged out of their own justification.** In each case the code was correct and the *reason recorded for it* had been invalidated by a later, unrelated change:

| Artifact | Stated rationale | What killed it |
|---|---|---|
| AC12 — always-on per-field breakdown | Decision record, *Added*: "`describe()` shrugs to `fallback_description` … the per-field breakdown **never shrugs**" | AC18 deleted `fallback_description`. The sentence no longer shrugs — it either reads correctly or is suppressed outright (AC14) — so the floor beneath it was restating it, not backing it up |
| `EXPERIENCE.md` Flow 3 | "Typing `*` in a field jumps to the next one, so the whole schedule is still keyboard-only" | The auto-advance it names was removed. **The claim stays true; only its reason died** — five text inputs and Tab satisfy NFR5 perfectly well |
| AD-9 amendment (already corrected during the review) | "The guided builder … cannot emit an invalid or unintended expression" | The Task-2a segmented editor was replaced by free-text boxes at the 2026-09-05 render-review |

**Evidence.** For (a): `CronFieldEditor.vue`'s `advancing` guard read `props.modelValue !== "*" && next === "*"`, which fires on the first keystroke of `*/15`; now covered by a regression test that types the expression one character at a time. For (b), AC12: on the seed `0 9 * * *` three of five breakdown rows read only "chaque jour" / "chaque mois" / "chaque jour de la semaine" beneath a one-liner already reading "Tous les jours, à 9h00" — observed by the developer in the running app.

---

## Section 2 — Impact Analysis

### Epic impact
**None.** Epic 8 completes as planned; Story 8.6 remains its sixth story and 8.7–8.9 are untouched. No epic is invalidated, no new epic is needed, no resequencing. The only epic-document change is one clause inside `epics.md`'s FR20 restatement.

### Story impact
Story 8.6 only. No future story depends on the auto-advance, the always-on breakdown, or the `fieldPhrase` noun prefix. Four ACs need amendment (AC11, AC12, AC24, AC26) plus two supporting sections of the same file (a Dev Notes bullet and a Change Log row).

### Artifact conflicts

| Artifact | Conflict | Status |
|---|---|---|
| `8-6-reimagine-nl-cron.md` AC11 | Describes the removed auto-advance as required behaviour | Provisional amendment already written inline — **validated, see §4** |
| `8-6-reimagine-nl-cron.md` AC12 | Requires the breakdown rows to render alongside the sentence | Provisional amendment already written inline — **validated** |
| `8-6-reimagine-nl-cron.md` AC24 | "helped by the `*` auto-advance in AC11" | **APPLIED** (§4.3) — AC11's amendment mentioned it, but AC24's own text still carried the clause |
| `8-6-reimagine-nl-cron.md` AC26 | Omits `epics.md`, `prd.md`, `tauri.conf.json` | Provisional amendment already written inline — **validated** |
| `8-6-reimagine-nl-cron.md` Dev Notes | Bullet 3 documents auto-advance as a delivered feature | **APPLIED** (§4.4) — annotated, not deleted |
| `8-6-reimagine-nl-cron.md` Change Log | 2026-09-05/06 row records "Added OTP-style auto-advance on `*`" | **APPLIED** (§4.5) — new row added; the old row left intact as history |
| `prd.md` FR20 | "an **always-on** per-field breakdown that never falls back" | **APPLIED** (§4.6) |
| `epics.md` FR20 | "plus an **always-on** per-field breakdown that never falls back" | **APPLIED** (§4.7) |
| `EXPERIENCE.md` Flow 3 (:124) | Justifies keyboard-only via the deleted auto-advance | **APPLIED** (§4.8) — reason restated as Tab traversal |
| `ARCHITECTURE-SPINE.md` | AD-9, AD-16 and the Consistency Conventions Testing row | Already corrected during the code review — **no further change** |

### Technical impact
All code is written, applied and green: `pnpm lint` · `vue-tsc --noEmit` · `pnpm test` 845/845 · `pnpm build` · `cargo fmt --check` · `cargo clippy --workspace --all-targets` · `cargo test --workspace` 345/345. Nothing is committed or pushed. This proposal changes documents only — **no further code change is proposed except the `minimumSystemVersion` value in §3, now applied as `"13.0"`.**

---

## Section 3 — Open decision: the macOS floor value

The code review set `bundle.macOS.minimumSystemVersion` to `"11.0"`, reasoning that `Intl.ListFormat` (introduced by the ES2021 `lib` bump) requires WKWebView/Safari 14.1 = macOS 11, while `tauri.conf.json` declared nothing and Tauri's default is 10.13.

**This checklist pass found that reasoning incomplete.** PRD **NFR3** already states:

> *"macOS 13+ on Apple Silicon is the primary platform: fully tested, signed, notarized, first to get every release."*

So the undeclared 10.13 default was contradicting the PRD's own support statement well before Story 8.6 — `Intl.ListFormat` merely made it load-bearing for one tool. Two defensible values:

| Value | Argument |
|---|---|
| **`"13.0"`** | Matches NFR3's documented, tested floor. The bundle stops claiming support the project does not test, sign or verify. Blocks macOS 11–12 users, for whom the app would probably work but is explicitly untested. |
| **`"11.0"`** | The true technical floor — everything, including the cron tool, functions. Maximally permissive without shipping a page that throws. But the built app then claims support for 11 and 12, which NFR3 says is not tested. |

**Recommendation: `"13.0"`. — DECIDED 2026-09-06: the developer chose `"13.0"`; applied.** NFR3 is the project's own stated contract, and a `minimumSystemVersion` is a support claim, not a capability probe. Declaring the tested floor is the honest option and is consistent with how this story treated every other honesty question. Flagged rather than auto-applied because it narrows the shipping audience; the developer chose `"13.0"` and it is applied.

---

## Section 4 — Detailed Change Proposals

### 4.1 — Story AC11 *(already applied inline; validated here)*

Struck through, followed by a `SUPERSEDED 2026-09-06 (code review, developer's call)` block recording: `*` is both a complete value and the first character of `*/15`; the auto-advance made AC10's own grammar untypeable; replacement is plain Tab traversal; `CronFieldEditor` no longer emits `advance` and `CronView` no longer holds field refs.

**Validation: accurate.** Matches the code at HEAD and the two rewritten tests.

### 4.2 — Story AC12 *(already applied inline; validated here)*

Amended with `AMENDED 2026-09-06 (render-review, developer's call)`: the breakdown renders **only** when the prose sentence is suppressed (prose XOR breakdown); the always-on requirement rested on `fallback_description`, which AC18 deleted; the five phrases stay live on every box's hover title, so the one-shared-source rule is unchanged; `fieldPhrase` no longer repeats the field noun for minute and hour.

**Validation: accurate.**

### 4.3 — Story AC24 *(new)*

```
OLD: … completable with the keyboard alone — helped by the `*` auto-advance in AC11.

NEW: … completable with the keyboard alone. **Amended 2026-09-06:** the original text read
"helped by the `*` auto-advance in AC11"; that mechanism is removed (see AC11), and keyboard
completability now rests on the five field inputs and two copy buttons being ordinary tab
stops with visible focus rings — which `CronView.spec.ts` asserts directly rather than by
appeal to a focus-moving side effect.
```

**Rationale:** NFR5 compliance is unchanged and still verified; only the mechanism cited for it is gone. Leaving the clause would point at a deleted feature as the reason an accessibility requirement is met.

### 4.4 — Story Dev Notes, bullet 3 *(new)*

Append to the existing auto-advance bullet:

```
**Removed 2026-09-06 (code review).** See AC11 — it made `*/15` impossible to type.
Retained here as the record of what was built and why it was reverted.
```

**Rationale:** Dev Notes record what was built. Deleting the bullet would erase the developer request that produced it; annotating it keeps the decision trail intact.

### 4.5 — Story Change Log *(new row)*

```
| 2026-09-06 | **`bmad-code-review` + render-review.** Three parallel review layers over
2a5ddf9..HEAD; AC1–AC26 scored 24 MET / 2 PARTIAL / 0 NOT MET. 21 patches applied, 3
decision-needed resolved, 3 deferred, 2 dismissed. Two high-severity defects fixed:
non-5-field expressions (nickname macros panicked `umbra-core`; 7-field expressions were
described from the wrong five tokens) and ungrammatical French union rendering in the month
/ day-of-month / day-of-week fields. `*` auto-advance removed; breakdown gated behind
sentence suppression. **Supersedes AC11, AC12, AC24, AC26.** Not committed. |
```

### 4.6 — PRD FR20 *(new)*

```
OLD: … (b) an always-on per-field breakdown that never falls back, and (c) …

NEW: … (b) a per-field breakdown that never falls back, shown when the one-line sentence
cannot be rendered (**amended 2026-09-06**: originally "always-on" — the sentence's generic
fallback was deleted during implementation, so the breakdown became a restatement rather
than a floor; the per-field phrases remain available on every field's hover title), and (c) …
```

### 4.7 — epics.md FR20 *(new)*

```
OLD: … plus an always-on per-field breakdown that never falls back, rendered in the user's
locale …

NEW: … plus a per-field breakdown that never falls back, shown when the one-line sentence
cannot be rendered (amended 2026-09-06 — see the PRD's FR20), rendered in the user's locale …
```

### 4.8 — EXPERIENCE.md Flow 3, step 4 *(new)*

```
OLD: … Typing `*` in a field jumps to the next one, so the whole schedule is still
keyboard-only.)

NEW: … The five field inputs are ordinary tab stops, so the whole schedule is still
keyboard-only. (An OTP-style `*` auto-advance was built and then removed at that story's
code review — it made step expressions like `*/15` impossible to type.))
```

**Rationale:** developer's choice of the three options offered. The NFR5 claim is unchanged and still true; the restatement replaces a dead mechanism with the live one, and records why, consistent with how the same line already documents the parser retirement.

### 4.9 — `tauri.conf.json` *(resolved — 13.0 applied)*

```
"macOS": { "minimumSystemVersion": "11.0" }   →   "13.0"      APPLIED — NFR3 alignment chosen
```

---

## Section 5 — Recommended Approach and Handoff

**Path forward: Option 1 — Direct Adjustment.** Effort **Low**, risk **Low**, timeline impact **none**.

- *Option 2, Rollback:* **not viable and not warranted.** The changes fix two high-severity defects and one blocking usability defect. Reverting reinstates a panic and untypeable input.
- *Option 3, PRD MVP review:* **not needed.** The MVP is unaffected. FR19–FR22 were already revised by the earlier pass; FR20 needs one clause corrected, not re-scoped. NFR5 still holds. The only PRD-level question is §3's platform floor, which is a support-matrix decision rather than an MVP one.

**Scope: Minor.** Documentation re-sync plus one config value. Routes to the **Developer agent** for direct implementation — no PO or Architect involvement.

**Success criteria**
1. No approved AC describes behaviour that does not exist at HEAD.
2. No document justifies a live claim by citing a deleted mechanism.
3. AC26 names every non-cron-island file the story actually touches.
4. `tauri.conf.json` declares a `minimumSystemVersion` consistent with NFR3.
5. Full verification stays green after the edits (documents only, so no regression expected).

**Owed before the PR, unchanged by this proposal:** the remainder of the `pnpm tauri dev` render-review (light + dark) covering the corrected French union strings and the new step phrasing, and a native-French read of that wording.
