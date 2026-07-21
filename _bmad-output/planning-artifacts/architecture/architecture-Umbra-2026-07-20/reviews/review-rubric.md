# Rubric Walk — ARCHITECTURE-SPINE.md (Umbra, 2026-07-20)

Reviewer: rubric walker (BMad architecture skill, Reviewer Gate)
Target: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md`
Cross-checked against: `prds/prd-Umbra-2026-07-19/prd.md`, `planning-artifacts/epics.md`, `implementation-artifacts/1-1-first-launch-scaffolded-app-opens.md`, and `.memlog.md` in the spine folder.

## Verdict

**Conditional pass — solid reconstruction, but not yet clean.** The sixteen ADs are well-formed, enforceable, and correctly ratify epics.md's binding paraphrases almost everywhere. However, the spine's own "verified-current" corrections are not fully reconciled against the very sources it cites (one genuine self-contradiction, one unresolved divergence with epics.md), and one deliverable it promises in its own frontmatter is missing from disk. These are fixable without re-deriving the spine, but should be closed before this is treated as ratified ground truth for Epic 4+ stories.

## Checklist walk

**1. Fixes real divergence points, misses none.** Mostly yes — core/shell boundary, error shape, tool registry, cross-tool isolation, network surface, OCR seam, cron honesty, persistence ownership, CI cross-platform gate, release signing, localization coupling, OS I/O ownership, IPC byte/path rule, and request supersession are all covered and map cleanly onto epics.md's own "Architecture decisions binding story implementation" section. Gap: no rule for `settings.json` schema evolution across releases (see Finding 4) — a real recurring risk given FR35's cadence, and not listed under Deferred either, so it's simply silent rather than an explicit open question.

**2. Every AD's Rule is enforceable and prevents its stated divergence.** Yes for the CI/type-system-backed ones (AD-2, AD-3, AD-9, AD-11, AD-12). The perf/convention-style ones (AD-4, AD-6, AD-13, AD-14) are enforced by code review rather than automation, which is consistent with the PRD's own NFR6 (self-reviewed PRs), not a spine defect.

**3. Nothing load-bearing hides under Deferred.** Reviewed all 8 Deferred items; each is either a single decision point owned by one future story (no simultaneous-build divergence risk) or an explicitly bounded non-decision (deployment/environment topology, correctly resolved as "no server-side component, nothing further to decide" rather than left silent — this is the one place the checklist specifically warned about, and the spine handles it well).

**4. Named tech is verified-current.** Good faith effort with real correction work (oar-ocr, croner) and dated verification annotations — but see Findings 1 and 2: the create-tauri-app claim contradicts its own cited source, and the oar-ocr correction wasn't propagated to the document it's supposed to keep coherent.

**5. Ratifies rather than contradicts existing reality.** Mostly clean line-by-line against epics.md's AD paraphrases and Story 1.1's acceptance criteria — wording matches almost verbatim throughout. Two exceptions below (Findings 1, 2) are real contradictions, not paraphrase drift.

**6. Every feature-altitude dimension decided/deferred/open.** Deployment & operations is explicitly handled (see #3). Data/IPC, error handling, state, testing, licensing, accessibility, CI, release are all decided. Persistence *migration* (not persistence itself) is the one silent dimension (Finding 4).

**7. Diagrams are valid, non-decorative mermaid.** Both diagrams (`graph LR` paradigm diagram, `flowchart TB` structural diagram) are syntactically valid, non-empty, and encode real dependency/AD relationships rather than being decorative.

**8. No AD is a placeholder/vague/unenforceable.** Confirmed by grep for "should/consider/ideally/might" — zero hits inside any Rule. All 16 ADs use prescriptive, testable language.

## Findings (tiered)

**HIGH — Finding 1: Self-contradictory "verified-current" claim on create-tauri-app.**
The spine's Stack table (line 172) states create-tauri-app was "observed 4.6.x 2026-07-20." The spine's own cited source, `implementation-artifacts/1-1-first-launch-scaffolded-app-opens.md` (line 131), states on the *same date*: "current major is **4.7.x**, and recent releases moved templates to Vite v8 and TypeScript v6." Both claim to be verified 2026-07-20 web checks; they disagree. Since scaffold-tool version drives Story 1.1's actual `pnpm create tauri-app@latest` invocation, this is exactly the kind of divergence point (checklist #1) a spine exists to close, and it fails checklist #4/#5 by contradicting its own cited source rather than ratifying it.

**HIGH — Finding 2: oar-ocr version correction not reconciled with epics.md.**
The spine correctly corrects oar-ocr from the original spine's "0.8.x" (a version that never existed) to "0.2.x" (Stack table, line 169), flagged for re-verification at Epic 4. But `epics.md` — the document this spine exists to keep coherent, and which a Story-4.1 implementer will actually read — still asserts "oar-ocr 0.8.x" in three places: the AD-8 binding paraphrase (line 123), the Stack summary (line 133), and Story 4.1's own acceptance criterion text (line 631, "`oar-ocr` 0.8.x is the adapter behind it"). The spine's note ("re-verify exact API at Epic 4 start") is not the same as flagging that a downstream, already-written acceptance criterion currently cites a non-existent version. This is unresolved divergence between the spine and the level below it, not just a stale historical note.

**MEDIUM — Finding 3: Promised companion doc is missing.**
The spine's frontmatter lists a `companions:` entry — `.../architecture-Umbra-2026-07-20/ARCHITECTURE.md` — and the folder's `.memlog.md` explicitly records the decision: "Deliverables are both ARCHITECTURE-SPINE.md and a repo-facing ARCHITECTURE.md companion, matching what existed before." The file does not exist in the directory (only `ARCHITECTURE-SPINE.md`, `.memlog.md`, and `reviews/` are present). Dangling reference from a frontmatter field that's supposed to be load-bearing for repo consumers.

**MEDIUM — Finding 4: No settings.json schema-evolution rule.**
AD-10 fixes the writer (single Pinia store) and the enumeration/clear UX, but says nothing about what happens to persisted keys across releases as tools are added/renamed through the P2/P3 cadence (FR35 ships roughly weekly Sept–March). Not listed under Deferred either — it's simply silent. Low blast radius today (one dev, one local file, manual "clear all" as an escape hatch) but this is precisely the kind of dimension likely to bite once the school-year cadence is running.

**LOW — Finding 5: `ToolError.code` has no cross-tool namespacing convention.**
AD-3 mandates a single error shape but doesn't require codes to be namespaced (e.g. `<tool>-<reason>`), so nothing prevents two independently-built tools from picking the same or colliding `code` strings. Low risk in practice given AD-6's tool-islands rule keeps each view's error handling scoped to its own commands, but worth a one-line addition since `code` is explicitly the sanctioned mechanism the view depends on (never parsing `message`).

**Minor note (not scored):** frontmatter `binds: [... INV-1-INV-4]` includes INV-4 ("Frozen MVP"), but INV-4 is a scope-management/process invariant with no corresponding architecture rule anywhere in the body — reasonable to leave un-architected, but the binds claim is technically overbroad.
