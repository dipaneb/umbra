---
title: "Umbra — Brand, UX & Product Discovery Roadmap"
status: draft
created: 2026-08-14
updated: 2026-08-14
---

# Umbra — Brand, UX & Product Discovery Roadmap

> This is a **meta-plan**, not a BMAD artifact itself. It sequences the work needed to
> give Umbra a deliberate brand/UI and to fill the product-discovery gaps left by the
> v1 sprint (global layout, update-flow UX, exact tool scope, dark mode). Each step below
> names _what_ to produce, _why now and not earlier/later_, and _which tool_ (a BMAD skill,
> or an external tool) fits that step's nature. Steps are meant to run as **separate,
> scoped sessions** — don't let one step's conversation drift into the next step's
> decisions.

## Rules of engagement (read this before starting any step)

1. **One step = one fresh conversation**, with the right tool for that step. Don't
   resolve a product-scope question inside a visual-design session or vice versa. For a
   step that names a `bmad-*` skill: open a new Claude Code conversation with this repo as
   the working directory, then either type the slash command directly (e.g.
   `/bmad-party-mode`) or just describe the step's intent in natural language — either
   triggers it, but typing the command is the more reliable of the two. If unsure which
   command exists, `/bmad-help` lists what's installed. Tell the session to read this file
   and follow the named step's brief, so it inherits the framing (existing docs =
   reference only, etc.) instead of starting cold. For a step that names an external tool
   (Claude Design, a gallery site, Canva): no skill involved, just go use it directly and
   bring the result back for the next step if needed.
2. **Existing docs are historical reference, not ground truth.** `prd.md`, `epics.md`,
   `ARCHITECTURE.md`, and the shipped stories under `implementation-artifacts/` should be
   _inspected_ for context (what's already built, what constraints already exist) but
   **not** treated as decisions to preserve. Say so explicitly at the start of any BMAD
   skill session: _"here are the existing brief/PRD, they're prior-run reference, we're
   redefining scope, don't assume they're binding."_
3. **Decisions flow one direction: broad discovery → formalize into specs → brand tokens
   → screens.** Phase 1 is where wide, even wild, options get raised and reacted to — the
   grid-homepage-instead-of-a-sidebar kind of idea. Later phases narrow and lock what
   Phase 1 surfaced; they don't reopen the exploration.
4. **Each step produces a durable file**, not just chat text. That's what makes this
   reusable across AI conversations — the _next_ session reads the _previous_ session's
   output file instead of re-deriving it from memory.
5. Check a box when a step's output file exists and you're satisfied with it. Half-open
   items are fine to revisit — this is discovery, not a one-shot form.

---

## Phase 0 — Before you start

- [ ] Skim (don't re-litigate) `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md`
      and `_bmad-output/planning-artifacts/epics.md` once, so you know what's already
      shipped (6 epics, Stories 1.1–6.2) and won't accidentally re-ask questions already
      answered (e.g. the update _mechanism_ is built — Story 5.2 — this roadmap is about
      its UX, not re-deciding whether Umbra self-updates).

---

## Phase 1 — Open discovery: play the whole room

**Goal:** this is deliberately _not_ a narrow competitive-pattern comparison. It's a
wide-open conversation about scope, screens, and flows — the kind that would happen
between a client, a PM, a designer, and a developer in one room — where the AI plays
multiple stakeholder roles and you react as the client. This is where ideas like "no
sidebar at all, just a tool grid on a home screen" or "the app reads clipboard content and
suggests the right tool automatically" belong, alongside the patterns you haven't thought
of yet because you don't know they exist.

- [x] **Step 1.1 — Round-table discovery.** Tool: `bmad-party-mode` skill, convening the
      installed personas: **Mary** (analyst — brings market/competitive grounding into the
      room only when it's useful ammunition for a point, not as a standalone research
      exercise), **John** (PM — pushes on scope, what's in/out, why), **Sally** (UX
      designer — pushes on screens, flows, the "what does this feel like to use" angle).
      Optionally pull in **Winston** (architect) for a reality-check pass if an idea's
      feasibility is in doubt (e.g. "does clipboard-content detection even work
      cross-platform without background permissions Umbra doesn't want to ask for").
      Brief the party explicitly: this is open scope discovery for Umbra v2 — global
      layout, navigation model, tool discovery/switching, dark mode, update-flow UX,
      settings — nothing is fixed, existing docs are reference only, play devil's advocate,
      surface options I haven't considered, and let me react like a client would.
      **Output:** a session transcript/notes file capturing every option raised and your
      reactions to each (kept, killed, maybe) — this is the raw material Phase 2 formalizes.
- [ ] **Step 1.2 — Optional: pure divergent ideation first.** Tool: `bmad-brainstorming`
      skill, if Step 1.1 ever feels like it's converging too fast on obvious answers. Use
      before 1.1 (to arrive at the round-table with more raw material) or as a targeted
      follow-up on one specific stuck question.
- [ ] **Step 1.3 — Pressure-test the strongest candidates.** Tool: `bmad-forge-idea` skill,
      run once per idea that survived Step 1.1 and feels like a real commitment (not a
      minor UI detail) — e.g. "ditch the sidebar for a tool-grid home screen" or
      "clipboard-aware tool suggestion." Persona-driven interrogation until it either
      hardens into something you'd commit to, or dies cheaply before it costs you a Phase 4
      screen design.

---

## Phase 2 — Formalize: transcribe, don't re-discover

**Goal:** turn Phase 1's decisions into the durable spec documents — this step should be
mostly transcription of what was already decided, not a second discovery pass. If you find
yourself re-litigating a decision here, that's a sign Phase 1 wasn't actually finished on
that point — go back, don't paper over it.

- [x] **Checkpoint — decide the format.** Before running this phase, look at what Phase 1
      produced. If the round-table converged cleanly, a full `bmad-product-brief` +
      `bmad-prd` rewrite may be more ceremony than the situation needs — a lighter
      "decisions log" derived straight from the Step 1.1 transcript might suffice instead,
      with the formal brief/PRD update kept for the points that are genuinely load-bearing
      (things later BMAD sessions or Claude Code need to be told, not just you remembering
      them). No cost in trying both on a couple of sections and comparing which reads
      better before committing to one for the whole document.
- [ ] **Step 2.1 — Refresh the product brief.** Tool: `bmad-product-brief` skill, update
      intent, if the checkpoint above says a full rewrite is warranted. Feed it the Step 1.1
      transcript as primary input, not a blank-slate interview — it's confirming and
      structuring decisions already made, catching only genuine gaps.
- [x] **Step 2.2 — Update the PRD.** Tool: `bmad-prd` skill, update intent, same approach:
      transcribe the round-table's scope/layout/update-flow/dark-mode decisions into PRD
      sections, diffed explicitly against the existing `prd.md` so it's clear what changed.
      **Done 2026-08-15, via direct hand-edit rather than the skill** — the checkpoint above
      resolved to "lighter decisions log," so this took the form of dated scope-update
      paragraphs on FR3/FR5/FR31 in `prd.md`, mirrored in `epics.md`, following the same
      precedent Story 6.2 set for the HEIC descope. Not yet committed to git. Twelve
      MAYBE/KEPT-but-not-yet-built items from the round-table were filed as GitHub issues
      #65-76 on `dipaneb/umbra` per the process decided in `step-1-1-roundtable-notes.md`'s
      "Idea-capture process" topic, rather than folded into the PRD.

---

## Phase 3 — Brand identity foundation

**Goal:** lock the visual identity tokens (palette, type, spacing, shape) once — so every
future feature and every future AI session inherits the same look without re-deciding it.
Do this _before_ full screen design (Phase 4), because screens consume tokens, they
don't produce them.

- [x] **Step 3.1 — Fast visual exploration (throwaway).** Tool: **Claude Design**
      (`claude.ai/design`, Pro/Max/Team/Enterprise research preview as of April 2026) —
      this fits better than a generic Artifact here because it explicitly supports reading
      a codebase to bootstrap a design system, and it's built for exactly this
      chat-to-prototype loop, including handing sketched flows straight to a Claude Code
      session for implementation. Generate 3-5 quick color/type direction mockups informed
      by Phase 1/2's decisions. Optionally browse a reference gallery first (Land-book, Lapa
      Ninja, Godly, Mobbin) for concrete screenshots to seed prompts with. v0 remains a
      reasonable alternative if you specifically want raw React/Tailwind output at this
      stage rather than Claude Design's own format.
- [x] **Step 3.2 — Lock DESIGN.md.** Tool: `bmad-ux` skill (Create intent, DESIGN.md only
      — tell it explicitly you're not doing EXPERIENCE.md yet). It has its own HTML
      color-theme and design-direction renderers; feed it Step 3.1's mockups as additional
      creative input if useful, but let the skill run its own elicitation — its instructions
      require it to _never volunteer_ colors/patterns, only ever present options for you to
      pick. Output: `DESIGN.md` — the single file every future session (including Claude
      Design, which can ingest a team's design system) should be told to read before
      touching a color or a spacing value.
- [x] **Step 3.3 — Logo (parallel, after 3.2's palette exists).** External. Two viable
      paths, don't feel obligated to pick the harder one: - _Wordmark-only_: common in this app category (Raycast, Linear, Warp don't have
      pictorial logos) — check whether this came up naturally in Phase 1. If Umbra's
      typography from DESIGN.md is distinctive enough, a styled wordmark may be the
      entire logo — cheapest and most defensible option. - _Pictorial mark_: if you want one, timing is after DESIGN.md so the mark's colors
      derive from the locked palette instead of the other way around. Resource: a short
      "minimal wordmark/icon logo for indie/SaaS" tutorial search on YouTube rather than a
      specific video (they date fast); tool: Claude Design or Canva, or an AI logo
      generator (Looka, Brandmark) for a fast first pass, refined by hand or with a Claude
      session reviewing 2-3 exported options against DESIGN.md's tokens.
      **Done 2026-08-16, adopted-for-now.** Phase 1 had no real logo discussion, so
      direction was decided fresh: developer chose pictorial mark over the wordmark-only
      recommendation. Web search compared Looka/Brandmark/Claude Design for this category
      (results treated cautiously — mostly SEO listicles) before settling on Claude Design
      for continuity with Step 4.3. Assembled a brief tying "umbra" 's actual astronomical
      meaning (the core of an eclipse) to the already-locked Leica/aperture reference
      point. Developer brought back one settled concept — "Ink letter, accent shadow," a
      monogram U with an orange shadow cast beneath it — written into `DESIGN.md`'s Brand
      & Style as a new Mark paragraph, explicitly flagged as revisitable rather than
      locked with the same permanence as the rest of the document.

---

## Phase 4 — UX & screens

**Goal:** define how the app behaves and looks, screen by screen, now that scope (Phase 2)
and visual identity (Phase 3) are both settled.

- [x] **Step 4.1 — EXPERIENCE.md.** Tool: `bmad-ux` skill, Update intent (same run as
      Step 3.2, or a fresh session referencing the now-final `DESIGN.md`). Information
      architecture, key flows (first launch, update-consent flow, tool discovery/switching
      per whatever Phase 1 landed on, settings) with named-protagonist journeys, state
      patterns, accessibility floor. Cross-references `DESIGN.md` tokens by name rather than
      duplicating them.
- [x] **Step 4.2 — Wireframes.** Tool: `bmad-ux`'s built-in Excalidraw renderer (invoked
      from within the Step 4.1 session) for the IA diagram and the trickiest flows.
      **Done 2026-08-16**, same workspace (`ux-umbra-2026-08-15/`), Update intent. Pure
      structural transcription of `EXPERIENCE.md` (no new IA/flow decisions) — the IA
      diagram plus 4 flow wireframes (first launch, update-consent, tool
      discovery/switching, settings), promoted to `wireframes/` and linked inline from
      `EXPERIENCE.md`'s Information Architecture section and each Key Flow. Mock coverage
      confirmed sufficient; Reviewer Gate skipped (no new decisions to validate).
- [x] **Step 4.3 — App key-screen mocks.** Tool: **Claude Design** for 2-3 flagship
      in-app screens (the nav shell/home, one tool screen, settings), seeded with
      `DESIGN.md` so output stays on-brand. This is also the natural point to use the
      PM-style hand-off Claude Design is built for: sketch the flow there, then hand it to a
      Claude Code session to actually wire it into the Vue/Tauri app. `bmad-ux`'s own HTML
      mock renderer remains a lighter-weight fallback if you'd rather stay inside one
      toolchain.
      **Done 2026-08-16.** Design-handoff mode: assembled a Claude Design brief
      (`.working/step4.3-claude-design-brief.md`), developer ran it and saved 3 screens
      (Nav shell/Grid-home, PDF Tools, Settings), light+dark, to `imports/` →
      `mockups/`. Resolved Card internal layout and the Clipboard-suggestion highlight
      cleanly. The Update-signal escalation question only got a partial answer, so — per
      developer's choice over requesting a follow-up render — `EXPERIENCE.md`'s originally
      planned 3-tier escalation was simplified to 2 real states (routine orange /
      security-urgent red), rewritten across Component Patterns, State Patterns, Flow 3,
      and Inspiration & Anti-patterns; `DESIGN.md` got one narrow, explicitly-scoped
      exception to its red-is-destructive-only rule. The mock's sidebar
      Pinned/Recent/All-Tools 3-way split was deliberately **not** promoted into the IA
      spine — kept illustrative-only, developer's call.

> `umbra-web` (the landing page) is deliberately **out of scope** for this roadmap —
> copywriting, page inventory, and SEO are their own project with their own discovery
> process. `landing-page-followup-prompt.md` in this same folder was the standalone prompt
> handed to an AI once Phases 1-5 here were done, so the landing page would inherit the
> finished brand/product instead of getting redesigned twice. **That follow-up ran
> 2026-08-17/18 and produced [`landing-page/README.md`](landing-page/README.md)** — the
> landing-page rebuild's own phased roadmap, same convention as this file.

---

## Phase 5 — Reconcile with what's already shipped

- [x] **Step 5.1 — Correct course.** Tool: `bmad-correct-course` skill. Compare the new
      `DESIGN.md`/`EXPERIENCE.md`/PRD updates against the 6 already-shipped epics (e.g. the
      existing sidebar from Story 1.5, the settings screen from Story 1.10) to see what's
      already compliant and what needs a retrofit story. Output: either amended stories or
      a new "rebrand / UX alignment" epic, not a silent divergence between spec and app.
      **Done 2026-08-16.** Ground-truthed against the actual shipped code (not just story
      prose) — found `EmptyState.vue`, `AppSidebar.vue`, `SettingsView.vue`, and
      `UpdateDialog.vue` all predate the design system, plus a self-flagged conflict in
      `EXPERIENCE.md` itself (restore-last-tool default). Resolved as two new epics rather
      than amending shipped stories in place, developer's explicit call to preserve
      Stories 1.5/1.10/5.2 as an honest record: **Epic 7** (8 stories, shell chrome —
      tokens, dark mode, grid-home, sidebar, pinned/recent, settings, update-signal,
      clipboard-suggestion) and **Epic 8** (9 chartered stories, one per registered tool,
      each gated on a Story-6.3-style discovery record before redesign). PRD FR5 got a
      dated addendum recording the restore-default flip. Full detail in
      `sprint-change-proposal-2026-08-16.md`; both epics and `sprint-status.yaml` updated.

---

## Quick-reference checklist

- [x] 1.1 Round-table discovery (party-mode: Mary/John/Sally, +Winston if needed)
- [ ] 1.2 Optional divergent brainstorming
- [ ] 1.3 Pressure-test the strongest candidate ideas
- [x] 2.0 Checkpoint: full brief/PRD rewrite vs. lighter decisions log — decided: lighter
- [ ] 2.1 Product brief refresh (if warranted) — not warranted, skipped (no brief exists)
- [x] 2.2 PRD update (layout, update-flow UX, dark mode spec, settings)
- [x] 3.1 Fast visual exploration (Claude Design, throwaway)
- [x] 3.2 DESIGN.md locked
- [x] 3.3 Logo (wordmark or mark)
- [x] 4.1 EXPERIENCE.md
- [x] 4.2 Wireframes (IA + key flows)
- [x] 4.3 App key-screen mocks (Claude Design)
- [x] 5.1 Correct-course reconciliation with shipped epics — Epics 7 & 8 added, see `sprint-change-proposal-2026-08-16.md`

> Landing page (`umbra-web`) is handled separately — see
> [`landing-page/README.md`](landing-page/README.md) (produced 2026-08-17/18 via
> `landing-page-followup-prompt.md`).
