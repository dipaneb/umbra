---
title: "Umbra — Sprint Change Proposal"
status: draft
created: 2026-08-16
workflow: bmad-correct-course
roadmap_step: "Phase 5, Step 5.1 (brand-ux-product-discovery-roadmap.md)"
---

# Umbra — Sprint Change Proposal

## 1. Issue Summary

`DESIGN.md` and `EXPERIENCE.md` (locked 2026-08-16, Phases 3–4 of the brand/UX discovery
roadmap) define a target UX — Grid-home as the default main-pane state, a full design-token
system, an active-nav highlight, a passive escalating Update-signal, a sectioned
Privacy-first Settings pane, and a clipboard-suggestion feature — that was authored *after*
Epics 1, 5, and 6 had already shipped their UI with no design system to inherit (plain
scoped CSS, per the architecture spine's own deferred list). This is not a bug or a
misunderstanding; it's the expected consequence of the roadmap's own sequencing (ship MVP
first, design brand after) finally reaching its reconciliation step.

Evidence gathered directly from the shipped code (not assumed from story prose):

- `src/shell/EmptyState.vue` (the `"/"` route) is one line of placeholder text — no tile
  grid exists.
- `src/shell/AppSidebar.vue` has zero `DESIGN.md` tokens (hardcoded `#e0e0e0`/`#396cd8`), no
  active-item highlight (a gap Story 1.5's own deferred-work entry already flagged
  2026-07-24), no collapse, no pinned/recent grouping, no clipboard-suggestion surface.
- `src/shell/SettingsView.vue` is flat with a single "Clear all" action — no per-item reset,
  no Appearance/dark-mode section, no clipboard-suggestion toggle.
- `src/stores/settings.ts` defaults `restoreEnabled` to `true` — `EXPERIENCE.md` documents
  this as a *deliberate, self-flagged* reversal to `false`, explicitly marked as a Step 5.1
  retrofit item in its own text.
- `src/shell/UpdateDialog.vue` auto-opens a blocking modal on every launch when an update
  exists, with no persisted declined-state and no security-severity distinction — the exact
  anti-pattern `EXPERIENCE.md`'s own "Inspiration & Anti-patterns" section names and rejects
  (VS Code's undeduped restart-to-update toast).

## 2. Impact Analysis

**Epic impact.** Epics 1 (shell) and 5 (update flow) are structurally impacted — their
shipped screens don't match the new IA/behavior. Epic 6 (PDF/image tools) carries the same
untokened-UI exposure. Epics 2, 3, 4 (Base64/UUID/hash/JWT, cron, Bucket OCR logic) are
**not** structurally impacted — AD-6 keeps tools as islands; their FR-level behavior stands
unchanged. No epic becomes obsolete.

**Story impact.** Stories 1.5, 1.10, and 5.2 remain accurate historical records of what
shipped *before* the design system existed — per the developer's explicit choice, they are
not amended in place. New stories carry the retrofit and net-new work instead (see Section 4).

**Artifact conflicts.**
- **PRD:** FR5's 2026-08-15 scope-update paragraph never recorded the restore-default flip
  to `false` — only `EXPERIENCE.md` did, and self-flagged it as needing to flow back here.
  Addressed in Section 4's PRD/epics.md diff.
- **Architecture:** AD-5's single-registry pattern already supports Grid-home as a third
  registry-driven view — no conflict. But the Update-signal's target design (persisted
  declined/already-shown state, a `notes`-field severity convention) has no covering AD —
  a genuine architecture gap, closed by Story 7.7 documenting a `shell.updateSignal.*`
  extension to AD-10.
- **UX specs:** this proposal *is* that reconciliation.
- **Other artifacts:** several `deferred-work.md` entries (Story 1.5's missing active-nav
  indicator, Story 1.6's hardcoded light-only palette CSS) are the same gap flagged from a
  different angle — Epic 7's stories close them as a side effect rather than leaving stale
  duplicates.

**Technical impact.** New Tool Registry fields (`description`, `clipboardMatch`); a new
icon-system dependency (chosen and license-checked in Story 7.1); several new `settings`
store keys (`shell.themeOverride`, `shell.sidebarCollapsed`, `shell.pinnedTools`,
`shell.recentTools`, `shell.pinnedToolsVisible`, `shell.recentToolsVisible`,
`shell.clipboardSuggestionMaxCount`, `shell.updateSignal.dismissedVersion`) — all routed
through the existing single-writer `settings` Pinia store (AD-10 unchanged in mechanism,
extended in namespace).

## 3. Recommended Approach

**Rejected options:** Rollback (nothing shipped is *wrong*, it just predates the design
system — no simplification gained) and PRD/MVP scope reduction (the MVP is done; this is a
post-MVP alignment pass, not a scope-achievability question).

**Selected: Direct Adjustment via two new epics**, not by amending shipped stories in place.
Stories 1.5/1.10/5.2 stay `done` as an honest record of what shipped pre-brand — rewriting
their ACs after the fact would revise the record of already-reviewed, already-retro'd work.

- **Epic 7 — shell chrome retrofit** (tokens, dark mode, grid-home, sidebar, pinned/recent,
  settings, update-signal, clipboard-suggestion). Direct, spec-driven implementation —
  `DESIGN.md`/`EXPERIENCE.md` already answer "what should this become."
- **Epic 8 — per-tool reimagination** (one story per registered tool, decision-story shape
  per Story 6.3's precedent: Task 1 brainstorm/discovery gates Task 2 redesign). This
  epic's stories are deliberately **chartered, not fully spec'd** — their real acceptance
  criteria don't exist yet because the scope decisions they depend on haven't been made.
  Sequenced after Epic 7 so each tool redesign lands directly on the finished token
  system/shell instead of needing its own later retrofit.

Effort: Medium–High (Epic 7 is real, scoped implementation work; Epic 8 is open-ended by
design). Risk: Low–Medium (shell-only code; AD-6 keeps tool logic untouched by Epic 7).

## 4. Detailed Change Proposals

### 4.1 PRD / epics.md — FR5 addendum

**`prd.md`, FR5 — append after the existing 2026-08-15 scope-update sentence:**

> **Further update (correct-course pass, 2026-08-16):** the restore-toggle's default flips
> from on to off — `EXPERIENCE.md`'s target IA makes grid-home the default landing surface
> on every launch unless the user explicitly opts in to restoring their last tool. Existing
> installs with an already-persisted value are unaffected; only the fresh-install default
> changes. See Epic 7, Story 7.6.

**`epics.md`, FR5 requirements-inventory line — same addition, condensed:**

> **Further update (2026-08-16):** restore-toggle default flips to off — grid-home is the
> default landing surface. See Epic 7, Story 7.6.

### 4.2 Epic 7 — Rebrand: shell chrome alignment

FRs covered: FR3 (dark-mode tokens + runtime switch), FR5 (sectioned Settings, restore
default), FR31 (update-signal). Sequenced after Epic 6; no dependency on Epic 8.

**Story 7.1 — Design tokens and icon system land in the shell.** Establishes `DESIGN.md`'s
tokens as CSS custom properties (light via `:root`, dark via `prefers-color-scheme`),
bundles Geist Sans/Mono locally (no network font-loading, INV-1), and selects/license-checks
an SVG icon library replacing the registry's raw-emoji `icon` field (candidate: Lucide,
MIT-licensed). `body` adopts base tokens as an end-to-end smoke test; no other shell
component is retrofitted yet.

**Story 7.2 — Dark-mode switching.** Adds `shell.themeOverride` (`system`/`light`/`dark`,
default `system`) to the `settings` store; root `data-theme` attribute drives immediate,
reload-free repaint. A minimal, unstyled toggle ships now purely so 7.3 onward can be built
and tested in both modes — its permanent, styled home is Story 7.6's Settings pane. No new
contrast work — `DESIGN.md`'s pairs are already WCAG AA-verified.

**Story 7.3 — Grid-home replaces the placeholder empty state.** One Card per registered
tool at `"/"`, matching `DESIGN.md`'s resolved Card spec (icon-badge via 7.1's icon system,
bold title, description). Registry gains a `description` field. Responsive grid at
`spacing.4` (16px) gutter. When restore-last-tool is on and a last tool exists, grid-home is
skipped as today. First-launch guided tour (`EXPERIENCE.md` Flow 1) explicitly **not**
covered — left for a future story.

**Story 7.4 — Sidebar active-nav state and token styling.** Sidebar consumes 7.1's tokens
and icons (replacing hardcoded hex/emoji); the open tool gets the `accent-signature-tint`
background plus an `aria-current`-style attribute (closing Story 1.5's deferred-work gap);
neutral hover on inactive items; collapse-to-icons persists via new `shell.sidebarCollapsed`,
retaining full accessible names when collapsed. Provides the anchor point Story 7.7 attaches
the update-signal dot to. Pinned/recent grouping explicitly **not** covered — Story 7.5.

**Story 7.5 — Pin and revisit recent tools.** Manual pin (`shell.pinnedTools: string[]`) and
automatic recency (`shell.recentTools: string[]`, last 5, pinned tools excluded) sections
above the full list (which still shows every tool, AD-5). Two independent Settings toggles
— "Show pinned tools" / "Show recent tools" (default on) — persisted separately from the
data arrays (`shell.pinnedToolsVisible`/`shell.recentToolsVisible`); toggling off only hides
the section, tracking continues untouched underneath so re-enabling shows accurate state.
Both new keys get per-item reset in Story 7.6's Settings.

**Story 7.6 — Settings sectioned, per-item reset, restore-default flip.** Privacy (existing
disclosure) → Appearance (7.2's dark-mode override gets its permanent styled home here, plus
7.5's visibility toggles) → Persisted Data (every `shell.*`/`<tool-id>.*` key, each with its
own reset alongside the existing all-clear, relabeled "Clear stored data"). Fresh installs
default `restoreEnabled` to `false`; already-persisted values on existing installs are
untouched. All new keys route through the single-writer `settings` store (AD-10 unchanged).

**Story 7.7 — Update-signal becomes a passive, escalation-aware dot.** Replaces
`UpdateDialog.vue`'s auto-show-on-mount modal with a dot anchored on the Settings sidebar
item (7.4's anchor point): orange/"Update available" by default, red/"Security update
available" via a documented `latest.json` `notes`-field marker convention (no native
severity field exists — confirmed via Context7). Click/keyboard-activate opens the existing
dialog markup unchanged. "Not Now" persists `shell.updateSignal.dismissedVersion` (AD-10) —
dot stays visible, no re-nagging toast. Failed checks fail closed and quiet, no retry
prompt. This story documents the new `shell.updateSignal.*` namespace as the AD-10 extension
flagged in Section 2.

**Story 7.8 — Clipboard-suggestion surface.** Net-new feature. Detection is fully
deterministic and local (JWT/JSON/Base64 shape rules in `src/shell/`, no AI/ML, no new
dependency) — plus a format-only image-MIME check suggesting the Bucket, with no pixels
processed until the user acts (AD-4, INV-1). Each candidate tool declares an optional
`clipboardMatch: { test, specificity }` on its registry entry — the shell iterates the
registry rather than hardcoding a tool list, so this scales past today's 7 tools without
shell-level edits. When more matches exist than the configured limit, the top N (by
`specificity`) show as individual "Clipboard match" callouts stacked above Pinned, each
independently keyboard-reachable, with a count-aware live-region announcement. One Settings
control — "Clipboard suggestions to show" (`shell.clipboardSuggestionMaxCount`, integer 0–5,
default 3) — both satisfies the INV-1 Privacy-section disclosure requirement and serves as
the disable path (`0`); no detection work runs at all when set to `0`. False-shape matches
open the tool's own existing precise-error state rather than mis-suggesting silently.
Cross-platform clipboard-change-event availability (flagged as an open risk in
`EXPERIENCE.md`) is resolved here, not deferred again.

### 4.3 Epic 8 — Tool-by-tool reimagination (chartered, not fully spec'd)

FRs covered: none newly assigned — each story may revise FR6–FR29 coverage once its Task 1
decision record exists; that revision is this epic's own output, not predicted here.
Sequenced after Epic 7. Nine independent stories (no inter-story dependency beyond Epic 7
being done): 8.1 JSON, 8.2 Base64, 8.3 UUID, 8.4 Hash, 8.5 JWT, 8.6 NL↔Cron, 8.7 Bucket—OCR,
8.8 Bucket—PDF, 8.9 Bucket—Images. Each follows the shared shape: **Task 1 (Discovery)** —
`bmad-party-mode` or `bmad-forge-idea`, framed as open scope discovery with existing
implementation as reference only, producing a written decision record (Story 6.3's
pattern); **Task 2 (Redesign)** — from that record, updated UX/UI consuming Epic 7's tokens
and real Given/When/Then ACs, gated on Task 1's record existing.

## 5. PRD MVP Impact & Action Plan

MVP (F1–F7) is unaffected — already shipped, already demoable. This proposal is entirely
post-MVP alignment work. Sequencing: Epic 6 finishes (6.3/6.4, already in progress) → Epic 7
→ Epic 8. Epic 7 has real internal dependencies (7.1 tokens/icons and 7.2 dark-mode before
7.3–7.8 consume them); Epic 8's 9 stories are mutually independent and can run in any order
or in parallel once Epic 7 lands.

## 6. Implementation Handoff

**Scope classification: Major.** This proposal adds two new epics to a document marked
`final`, introduces a new dependency (icon library) and a new architecture extension
(AD-10's `shell.updateSignal.*` namespace) that isn't written into `ARCHITECTURE.md`/
`ARCHITECTURE-SPINE.md` yet, and revises FR5's PRD text.

**Handoff:**
1. **PM/Architect pass (before story-file creation):** apply Section 4.1's PRD/epics.md
   diff; add Epic 7 and Epic 8 to `epics.md`'s Epic List and body (this document's Section
   4.2/4.3 text is ready to transcribe); write the AD-10 extension and the icon-library
   decision into `ARCHITECTURE.md`/`ARCHITECTURE-SPINE.md` once Story 7.1 actually makes
   the icon-library pick (this proposal names a candidate, not a locked choice).
2. **Developer (`bmad-create-story` / `bmad-dev-story`):** once epics.md carries Epic 7,
   create and implement Stories 7.1–7.8 in order (7.1/7.2 first — everything else consumes
   them). Epic 8 stories can each be created independently once Epic 7 is done; Task 1 of
   each gates Task 2 exactly as Story 6.3 already established the pattern.
3. **sprint-status.yaml:** this proposal's approval triggers adding `epic-7`/`epic-8` and
   their story entries as `backlog` (Section 6.4 of the correct-course checklist) —
   performed automatically on approval, see below.

## Approval

Presented to the developer 2026-08-16, incremental review of every story (7.1–7.8 individual
Given/When/Then ACs; 8.1–8.9 chartered as a set) plus the PRD diff. Awaiting final sign-off.
