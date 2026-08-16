# Spine Pair Review — Umbra

## Overall verdict

The pair is genuinely source-extractable on the mechanics that matter most: every `{path.to.token}` reference in EXPERIENCE.md resolves to a real DESIGN.md frontmatter token, and the two files' shared component names ("Card," "Nav item (active state)") match exactly — `.memlog.md` shows this was actively checked and self-corrected during drafting, which is the inheritance-discipline mechanism working as intended. It is not yet a fully clean contract, though: two round-table-native surfaces this pass introduced — the update-signal's escalation states and the clipboard-suggestion highlight — are named and given behavioral rules in EXPERIENCE.md with no matching visual row in DESIGN.md, so a downstream builder has to invent their visual treatment from scratch. Add a handful of medium-severity flow/state coverage gaps and one section-order deviation, and the honest read is **adequate, with real fixable gaps** — reinforced by DESIGN.md being `status: final` while EXPERIENCE.md is still `status: draft`.

## 1. Flow coverage — adequate

Checked all 4 Key Flows against the PRD's FRs/NFRs and the round-table's named decisions (nav/tool-discovery, first-launch, update-consent, settings, clipboard-suggestion, accessibility). Named-protagonist, numbered-steps, climax, and failure-path structure was checked per flow.

### Findings
- **medium** No Key Flow walks a Settings interaction end-to-end (toggling the dark-mode override, disabling clipboard-suggestion, or a per-item reset) — Settings is only entered and glanced at in Flow 1's climax (EXPERIENCE.md ~line 95), never operated. *Fix:* add a 5th flow, or extend Flow 1 with an actual toggle step.
- **medium** Flow 2 ("The 5-minute demo") and Flow 3 ("Update signal, over several days") have no named protagonist — Flow 2 uses "a developer," Flow 3 uses "the developer"/"he" with no name at all (EXPERIENCE.md lines 99, 110) — unlike Flow 1/4's "Amara" and the shape references' consistently named leads (Mira, Sarah, Devon/Mara). *Fix:* name a persona for Flow 2 and Flow 3 for consistency with this spine's own convention.
- **medium** Flow 4 (clipboard-aware suggestion) has no "Failure:" line, unlike Flows 1–3 — no case is addressed for a false-positive clipboard match (text that superficially resembles a JWT/Base64/JSON but isn't) (EXPERIENCE.md lines 120–128). *Fix:* add a Failure: line for mismatched detection.
- **low** FR3's dark-mode toggle behavior has no flow coverage — but this is self-disclosed honestly in EXPERIENCE.md's own closing note ("its Settings-toggle *behavior* isn't given its own row here," line ~153), which downgrades the severity but doesn't close the gap. *Fix:* carry into the next EXPERIENCE.md pass per the doc's own flag.

## 2. Token completeness — strong

Extracted all tokens from DESIGN.md's frontmatter and all `{path.to.token}` references in EXPERIENCE.md's prose: `{colors.accent-signature-tint}`, `{colors.accent-signature-tint-dark}` (Component Patterns, Nav item row), `{colors.accent-signature-on-text}` ×2, and `{colors.text-tertiary}` (Accessibility Floor). All four resolve to tokens actually defined in DESIGN.md's `colors:` block, with no typos. DESIGN.md's own internal `{...}` references (inside `components:` and its prose) were spot-checked too and all resolve cleanly.

### Findings
None.

## 3. Component coverage — thin

Extracted every component name used in either file and cross-checked for a DESIGN.md visual row + EXPERIENCE.md behavioral row, plus name-identity between the two.

### Findings
- **high** "Update-signal" (EXPERIENCE.md Component Patterns, line 56) has no matching DESIGN.md Components row — it only "reuses DESIGN.md's Notification Dot component... as its base mark," but the escalating visual weight over days and the distinct security-urgent state (both load-bearing per Key Flow 3) have no visual spec anywhere in DESIGN.md. *Fix:* add an escalating-badge row to DESIGN.md.Components, or explicitly flag the escalation visuals as deferred the way card internal layout already is.
- **high** "Clipboard-suggestion surface" (EXPERIENCE.md Component Patterns, line 57) is described as "a highlighted/pinned entry" in the sidebar, but no DESIGN.md component defines what "highlighted" means visually, distinct from the existing Nav item active-state tint. *Fix:* add a row, or explicitly reuse/name an existing token.
- **medium** The update-consent dialog (Flow 3: "an explicit consent dialog opens, showing version and notes") is functionally the Floating surface component but has no Component Patterns row of its own — its behavioral rules (Esc-dismiss, focus trap, button set, keyboard operability required by the Accessibility Floor) exist only scattered across Flow 3's prose. *Fix:* add a "Floating surface — update-consent dialog" row.

Positive note: "Card" and "Nav item (active state)" match exactly by name across both files — `.memlog.md`'s own Pass-1 self-check documents this as a deliberate fix during drafting.

## 4. State coverage — adequate

Walked Sidebar, Grid-home, ⌘K palette, Settings, tool screens as a class, the update-signal, and the clipboard-suggestion surface against empty/loading/error/offline/focus-keyboard states.

### Findings
- **medium** The update-signal's own states (quiet/day-1, escalating days 2–4, security-urgent, declined-but-persisting) are never consolidated into the State Patterns table — they exist only inside Key Flow 3's prose (lines 110–118). *Fix:* add explicit State Patterns rows.
- **medium** The clipboard-suggestion surface's states (no-match/hidden, match-shown, replaced-on-next-copy) are likewise only in Component Patterns/Flow 4 prose, not the State Patterns table. *Fix:* add rows.
- **medium** Settings has no error/failure state defined anywhere — e.g. a persisted-settings write failure, or the "Clear stored data" action itself failing. NFR4's "no crash, errors always shown in-tool" rule is stated for tools but never explicitly extended to Settings' own persistence operations. *Fix:* add a Settings error-state row.
- **low** No row for "update-check network failure" (the one disclosed carve-out timing out or failing) despite NFR4 implying every network-touching path needs a defined failure treatment.

## 5. Visual reference coverage — adequate

Listed all files in `mockups/` (8) and `imports/` (3) and checked DESIGN.md links each inline at its relevant section.

### Findings
- **medium** `mockups/accessibility-fixes-before-after.html` exists and was used to make/approve a substantive Colors-section decision (the white-on-orange/red AA-trade-off rollback, per `.memlog.md`'s closing decisions) but is never linked from DESIGN.md — the other 7 mockup files are all linked inline; this is the sole omission. *Fix:* link it from the Colors section near the "accepted trade-off" discussion.
- **low** The 3 `imports/step3.1-*.png` files (early Step 3.1 exploration directions) are superseded by DESIGN.md's own from-scratch `color-themes-1/2.html` exploration and reasonably go unlinked, but they sit unreferenced by either spine file — worth naming, not fixing.

Confirmed as expected, not a gap: EXPERIENCE.md carries no mockup links and no "Composition reference" line in its IA table, consistent with the deliberate deferral the task framing already calls out.

## 6. Bloat & overspecification — strong

### Findings
None. DESIGN.md's repeated trade-off documentation (the white-on-orange/red AA rollback, restated across Colors/Components/Do's-and-Don'ts) is intentional risk-mitigation — explicitly "documented here so it isn't silently 'fixed' again" — not padding. EXPERIENCE.md correctly cites DESIGN.md/PRD by reference rather than restating brand voice, personas, or FRs. Narrative texture in Key Flow climax beats (e.g. Flow 4's "met her where her last action left off") mirrors the shape references' own climax style (Drift's "she picks up her coffee and starts writing") — within the demonstrated norm, not an editorial-voice violation; no editorializing was found outside Key Flows' climax beats.

## 7. Inheritance discipline — strong

### Findings
None. `sources:` in EXPERIENCE.md's frontmatter (`prd.md`, `step-1-1-roundtable-notes.md`) both resolve to real files at their stated paths. Component names are identical across both files everywhere they co-occur. All `{path.to.token}` references cross-check clean against §2. The three coverage gaps in §3 (Update-signal, Clipboard-suggestion surface, consent dialog) are a *coverage* problem, not a *naming-mismatch* problem — no name or token mismatch was found anywhere in either file.

## 8. Shape fit — adequate

### Findings
- **medium** EXPERIENCE.md's section order is Key Flows (line 87) → Inspiration & Anti-patterns (line 130) → Open Questions (line 141). Both shape references (`experience-example-mobile.md`, `experience-example-shadcn.md`) place Inspiration & Anti-patterns immediately before Key Flows, with Key Flows always last. Umbra's file has these two swapped. *Fix:* move Inspiration & Anti-patterns above Key Flows.

DESIGN.md's section order matches the canonical order exactly (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts) — no finding. Inspiration & Anti-patterns is justified: it names real reference products (VS Code, Notion, Chrome, Firefox) and explicit kills (copy-as-image, watch-folder, menu-bar app) sourced from the round-table. "Open Questions," an invented section, earns its place — it's a disciplined parking lot sourced directly from the round-table's MAYBE/KEPT-unshaped items plus an honest self-audit ("Pass-1 self-check gaps found and fixed" / "Remaining, not fixed"), which is exactly the kind of transparency a downstream consumer benefits from, not scope creep.

## Mechanical notes

- No component/token name mismatches found between DESIGN.md and EXPERIENCE.md anywhere.
- Broken/missing cross-ref: `mockups/accessibility-fixes-before-after.html` is unlinked from DESIGN.md (see §5).
- Frontmatter completeness: DESIGN.md carries all required fields (name, description, colors, typography, rounded, spacing, components) plus status/updated. EXPERIENCE.md carries name/status/sources/updated, but `status: draft` sits against DESIGN.md's `status: final` — an asymmetric pair for a review meant to validate them as a settled contract; EXPERIENCE.md's own frontmatter still self-reports as not-yet-final.
- No Mermaid diagrams in either file — n/a.
- Section-order deviation in EXPERIENCE.md (Key Flows before Inspiration & Anti-patterns) — see §8.
