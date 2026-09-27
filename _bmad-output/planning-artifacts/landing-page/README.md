---
title: "Umbra — Landing Page Rebuild Roadmap"
status: draft
created: 2026-08-18
updated: 2026-09-27 (Step 6.8 — complete: PostHog switched to cookieless_mode: "always", a real pre-existing cookie-persistence bug fixed, project dashboard audited via the newly-connected PostHog MCP, Web Vitals/heatmaps kept and disclosed rather than disabled)
---

# Umbra — Landing Page Rebuild Roadmap

> A **meta-plan**, not a BMAD artifact. It sequences the work of rebuilding `umbra-web` now that
> `DESIGN.md` and `EXPERIENCE.md` are locked. Each step names *what* it produces, *why it sits
> there* in the sequence, and *which tool* fits it. Steps run as **separate, scoped sessions** —
> don't let a copywriting session drift into a legal decision, or a build session into a
> positioning debate.
>
> This is the follow-up `brand-ux-product-discovery-roadmap.md` deferred and
> `landing-page-followup-prompt.md` described. Its Step-1 inventory session (2026-08-17/18) walked
> ~60 concept areas across strategy, IA, copy, design, build, SEO, measurement, legal, growth, and
> process; what survived is below, and what was deliberately cut is recorded at the end so it reads
> as *decided*, not *overlooked*.

## Rules of engagement

1. **One step = one fresh conversation.** Tell it to read this file and the named step's brief so
   it inherits the framing instead of starting cold.
2. **Which repo to open matters.** BMAD skills (`bmad-*`) are installed in **`Umbra`** only — run
   those sessions with `Umbra` as the working directory, writing output into
   `_bmad-output/planning-artifacts/landing-page/`. Build and code sessions run in **`umbra-web`**.
   This split is Story 5.4's established pattern, not a new convention.
3. **`DESIGN.md` and `EXPERIENCE.md` are binding.** This is the opposite of
   `brand-ux-product-discovery-roadmap.md`'s rule — that roadmap treated prior docs as historical
   reference because it was redefining them. This one *consumes* them. Don't re-open a colour, a
   type token, or the voice register. Note the two documented WCAG trade-offs in `DESIGN.md` (white
   on orange fills, white on dark-mode red) are **deliberate developer calls** — don't silently
   "fix" them on the web either.
4. **The current site is a historical draft, not a page inventory to preserve.** Read it for tone
   and for what's already banked technically. Assume both the page list and every line of copy may
   change.
5. **Each step produces a durable file**, so the next session reads the previous session's output
   rather than re-deriving it.
6. **Verify library APIs live, never from memory.** `umbra-web` runs Astro 7.x and `@astrojs/sitemap`
   3.x; PostHog's JS SDK moves quickly. Use Context7 for Astro, PostHog, and any package added —
   the same dependency-drift discipline `Umbra`'s own Consistency Conventions table requires.
7. **PRD FR33 makes this a learning unit.** Steps marked 📚 are ones where understanding the
   technique matters as much as the artifact. Don't let an AI shortcut past the learning on those.
8. **Treat GEO/AI-search sources with suspicion.** Nearly every article in this field is published by
   an agency selling GEO services, and the numbers they quote are usually their own. Apply the same
   discipline Step 3.3 of the app roadmap logged ("results treated cautiously — mostly SEO
   listicles"). Prefer sources that argue *against* their own interest — the most credible finding
   in this area as of August 2026 is a deflationary one (see Step 6.13). Re-verify before executing
   any GEO step; this is the fastest-moving area in the roadmap.
9. Check a box when the step's output file exists and you're satisfied with it.

## Autonomy — what this roadmap can and can't hand to an AI

Most of these steps are **elicitation sessions, not tasks.** Running them in a hands-off autonomous
mode doesn't make them faster, it makes them wrong — an agent with no answer to "which of these three
headlines sounds like you" will pick one and move on, and you'll inherit a site written by nobody.
Three categories:

**Physically impossible without you** — an agent cannot do these at all, and a session that claims
otherwise is confabulating. Story 5.4 hit exactly this wall and correctly paused rather than fake it.
- 6.1 domain — Vercel dashboard and DNS records
- 6.8 (part) — PostHog dashboard audit, behind your login
- 7.1 — needs a real browser to fire and confirm the events; `curl` can't
- 7.3 — Search Console, your Google account
- 7.5 (part) — asking the assistants and recording what they say
- 5.3 (part) — screenshots of a desktop app running on your machine
- 5.5 (part) — **the two logo SVGs themselves.** The developer is designing the mark by hand; a
  session reaching this step with no supplied files stops and asks for them rather than generating
  a stand-in. This is distinct from 5.5's placement decisions below, which *are* delegable once the
  files exist.
- 9.2 — posting to Hacker News, Reddit, directories, under your identity. Never autonomous.

**Yours by right — the decision is the deliverable**
- 1.1, 1.4, 1.6 · 2.1, 2.2, 2.3 · all of Phase 3 (copy is taste, and it's your voice) ·
  all of Phase 4 (legal decisions are yours; this roadmap is not legal advice) · 5.1, 5.2, 5.3's
  Epic-7 fork, 5.4, 5.5's placement calls · 6.8's memory-vs-sessionStorage fork

**Genuinely delegable, with your sign-off at the end**
- 1.2 (the scan; the reactions are yours), 1.3, 1.5 · 2.4, 2.5 · 5.6, 5.7 · 6.2–6.7, 6.9–6.14 · 7.2 ·
  8.1, 8.2 · 9.1, 9.3, 9.4 · 10.x

So a realistic execution shape is: **Phases 1–5 as conversations with you in them**, Phase 6 mostly
delegable around three hard stops, and Phases 7–9 back to you. Note also that "auto-accept edits"
governs tool permission prompts, not whether a session asks you substantive questions — a good
session will still stop and ask on every item in the second list above.

## Decisions already locked (don't re-litigate)

| Topic | Decision |
|---|---|
| Primary audience | Developers first; recruiters second, served by a separate signposted page |
| Domain | Free subdomain of the developer's existing personal-name domain |
| Monetisation | None in this rebuild — free product, no pricing/donation surface |
| Email capture | None. "Notify me" intent routes to GitHub Watch/Releases |
| Analytics | PostHog, cookieless |
| Language | **Revised 2026-09-19 (Step 3.2):** French ships alongside English at launch, not deferred. Both locales get full copy in Phase 3; Step 6.5's routing config was already going to support this, it's now load-bearing rather than inert on day one. |
| Effort | Moderate, a few weeks, no hard date |

---

## Phase 0 — Read-in

- [x] **Step 0.1 — Ground the session.** Read `DESIGN.md`, `EXPERIENCE.md`, `prd.md` (§1–2 for
      positioning, FR33/FR34, INV-1/INV-2, §6 success metrics), Story 5.4 (what exists and its
      seven deferred items), and `umbra-web`'s current `src/`. **Why first:** every later step
      cites these; re-deriving them per session wastes the run and invites drift.
      **Output:** none — this is orientation, folded into Step 1.1's session.

---

## Phase 1 — Strategy, and the guard rails

**Goal:** decide what the site argues, to whom, and — critically — which factual claims it is
allowed to make. Nothing visual, nothing written as final copy.

- [x] **Step 1.1 — Positioning & audience brief.** Transcribe the PRD's positioning ("the
      privacy-first toolbox where even the AI is private"; explicitly *not* out-featuring
      DevToys/DevUtils) into a page-level brief: the one-sentence claim, the visitor's job-to-be-done,
      what the page is implicitly arguing against, and the single conversion action.
      **Why here:** every copy and IA decision downstream resolves against this; without it, section
      order becomes taste. **Tool:** `bmad-prfaq` (run from `Umbra`) is an unusually good fit — the
      press-release-then-FAQ format forces the value claim into one paragraph before any feature
      list exists. `bmad-product-brief` is the heavier alternative if the PR/FAQ shape feels wrong.
      **Output:** `landing-strategy.md` §1.

- [x] **Step 1.2 — Reference scan.** 📚 Look hard at 6–10 comparable sites — direct
      (devutils.app, DevToys, DevTools-X) and aspirational-adjacent in the same visual register
      (Raycast, Linear, Warp, Zed). Extract *conventions*, not designs: where the screenshot sits,
      how a download is presented, how much copy is above the fold, how privacy-positioned tools
      handle proof. **Why here:** you're a beginner at this specific genre and pattern-absorption is
      the cheapest possible fix; doing it before IA means Phase 2 starts from a known vocabulary.
      **Tool:** direct browsing, plus landing-page galleries (Land-book, Lapa Ninja, Godly) for
      structural range. `bmad-market-research` if you want it run as a structured comparison rather
      than a browse. Timebox to one session. **Output:** `landing-strategy.md` §2.

- [x] **Step 1.3 — Objection map.** List every reason a visitor bounces, then decide where each is
      answered. Umbra's are concrete and unusually strong material: *is it safe to run an unsigned-
      looking binary from a stranger* (answer: Developer ID signed + Apple notarized), *public repo
      but All Rights Reserved — what may I actually do*, *why should I believe the privacy claim*
      (answer: a per-release `nettop` network trace, Story 5.3), *there's no Windows build*, *what
      happens when it updates*. **Why here:** this is what turns the FAQ page from a dumping ground
      into structure, and it feeds the home page's section order directly.
      **Tool:** a plain working session; `bmad-review-adversarial-general` if you want the
      objections generated against you rather than by you. **Output:** `landing-strategy.md` §3.
      **Correction found while executing:** the "no Windows build" example objection above was
      stale — Windows/Linux packaging shipped 2026-09-16 (#156), but **unsigned**, which is a
      sharper, still-live objection (SmartScreen warnings) that replaces it. See `landing-strategy.md`
      §3 for the full corrected map, the Windows/Linux-minimum-OS-version gap it surfaced for Step
      1.5, and what's still flagged for developer sign-off.

- [x] **Step 1.4 — Success definition & event plan.** Name what "it worked" means and — before any
      code — which events measure it. **Read this constraint carefully:** you chose cookieless
      PostHog, which means no cross-page-load identity. A "landed on home → clicked download on
      /download" funnel is *not* measurable under that choice. Design around it: put a download-click
      event on every page that carries a CTA and measure event counts, not conversion rates. Also
      note PostHog can never see the download itself — that number lives in the GitHub Releases API
      (Phase 7.2). **Why here:** an event plan written after the build is an event plan retrofitted
      badly; and this is where the cookieless trade-off gets priced honestly instead of discovered
      later. **Tool:** working session + Context7 for PostHog's current `persistence` options and
      `capture` API. **Output:** `landing-strategy.md` §4.
      **Correction found while executing:** Context7 surfaced a real `posthog-js` feature this step's
      own wording didn't know about, `cookieless_mode`, distinct from a `persistence` value — and
      clarified that `sessionStorage` (unlike `memory`) actually survives within one visit, so the two
      options Step 6.8 was framed as choosing between aren't as interchangeable as "no cross-page-load
      identity" implied. Also surfaced: adding the new `download_clicked` event makes the site's
      current footer claim ("page-view analytics only") false the moment it ships — Step 6.8's own
      task list already plans to update that disclosure; this step is why. See `landing-strategy.md`
      §4 for the full event table, the corrected persistence framing, and what stays permanently
      unmeasurable under any cookieless option.

- [x] **Step 1.5 — The claim ledger.** 🔸 A table of every factual assertion the site is permitted
      to make, each with its source of truth and who owns updating it: the privacy promise (source:
      `Umbra`'s README `## Privacy` + Story 5.3's executed checklist), the tool list (source:
      `src/stores/registry.ts`), platform support (source: NFR3 + what actually builds), the licence
      (source: NFR7), version/release (source: GitHub Releases). **Why here — this is the guard rail,
      so it precedes all copy:** the privacy claim now lives on three public surfaces (README, in-app
      Settings, this site). Over-stating it here is the one failure in this whole project with real
      consequences, and Story 5.4's own Dev Notes flagged exactly this hazard. Every later copy step
      is checked against this ledger. **Tool:** working session reading the named sources live —
      not from memory, not from this roadmap's summaries. **Output:** `landing-strategy.md` §5.
      **Correction found while executing:** a live `gh api repos/dipaneb/umbra/releases/latest` call
      shows the current *stable* release (`v0.4.0`) ships **macOS-only assets** — Windows/Linux
      packaging (PR #156) exists only in `v0.5.0-alpha.1`, which GitHub's API correctly excludes from
      `/releases/latest` as a pre-release. §3's own objection-map answers assumed Windows/Linux were
      already reachable from the site; at ledger-writing time they weren't. **Developer decided
      (2026-09-18):** build the site now regardless — the download page (Step 6.3) reads live
      per-platform availability from `/releases/latest` rather than waiting for a stable tag with all
      three platforms; each platform starts working the moment its assets land in a stable release,
      no further site change needed. Also corrected: only **one** AI feature ships today (OCR) —
      `prd.md`'s own §1 Overview line naming "natural-language cron" as AI-flavored is stale against
      Story 8.6, which retired NL→cron's parser entirely; developer confirmed this is expected
      (more AI features are planned) and doesn't change §1's "even the AI" wording. See
      `landing-strategy.md` §5 for the full 13-row ledger.

- [x] **Step 1.6 — AI-answer target list.** 📚 Write down the handful of questions you want an LLM
      to name Umbra in answer to — "privacy-first alternative to DevToys", "offline JSON formatter
      for macOS", "developer tools that don't upload my data", "local OCR without a cloud API". This
      is the GEO equivalent of keyword research, and it's a different exercise: you're targeting the
      *question a person asks an assistant*, which is longer, more conversational, and more
      intent-loaded than a search query. **Why in Phase 1:** it shapes what the copy must state
      plainly and what comparisons must exist on the page — decisions made in Phases 2 and 3, not
      retrofittable afterwards. **Sober framing:** the honest strategic read is that for a developer
      tool, your GitHub repo and third-party mentions drive citation far more than your landing page
      does (Steps 9.2 and 9.4). This list mostly tells you what to *say* there too.
      **Tool:** working session. Sanity-check by actually asking ChatGPT/Claude/Perplexity those
      questions today and recording what they answer — that's your baseline for Step 7.5.
      **Output:** `landing-strategy.md` §7.

---

## Phase 2 — Information architecture

**Goal:** what pages exist, what each is for, and what order the home page makes its argument in.
Still no finished prose.

- [x] **Step 2.1 — Page inventory.** Decide the page list from Phase 1's outputs rather than from
      what exists. Candidates on the table: home, download, FAQ, a recruiter/project page (Step 2.2),
      privacy policy, legal notice, a changelog/releases page. Each page must justify itself against
      the audience priority; kill anything that can be a section instead of a page.
      **Why here:** copy can't be written until you know how many pages there are, and the legal
      pages (Phase 4) need slots. **Tool:** working session. **Output:** `landing-ia.md` §1.

- [x] **Step 2.2 — Shape the recruiter-facing page.** 🔸 Left deliberately open. The forks: an
      *engineering write-up* (Rust/Tauri bridge, local ONNX inference, the signed-and-notarized
      release pipeline — maps to the PRD's "Learned" metric, aimed at a technical interviewer); a
      *project story* (the planning corpus, the decisions and their trade-offs, the accepted-not-
      fixed WCAG calls, what got killed and why — shows judgment rather than output); or both as one
      page. **Why its own step:** it's the one page with no precedent to copy and the only one
      serving the secondary audience, so it deserves a dedicated session rather than a footnote in
      2.1. **Tool:** `bmad-brainstorming` or `bmad-forge-idea` (from `Umbra`) to pressure-test the
      framing before committing copy to it. **Output:** `landing-ia.md` §2.
      **Correction found while executing:** neither fork survived as originally framed. Resolved via
      a `bmad-forge-idea` session (working record, not committed to this repo) to a third
      shape — mission line + plain outcome statements + footer attribution, deliberately excluding
      both the WCAG/cron-parser trade-off examples this entry suggests and a jargon-heavy "proof
      dossier" direction that was drafted and killed for overselling ordinary tooling and failing a
      non-technical reader. See `landing-ia.md` §2 for the full decision trail.

- [x] **Step 2.3 — Home-page narrative spine.** 📚 Section-by-section order with a one-line purpose
      for each — the *argument*, in words, before any prose or layout. This is the actual craft of
      landing-page design, more than visuals are. **Why here:** it consumes 1.1's claim, 1.3's
      objections, and 1.2's conventions, and it's what Phase 3 writes into and Phase 5 designs
      around. **Tool:** working session; `bmad-editorial-review-structure` to critique the spine
      once drafted. **Output:** `landing-ia.md` §3.
      **Correction found while executing:** this step's own workflow section changes this step's
      asset requirement — a **video**, not the GIF this bullet's Step 5.3 entry below still names,
      since compressed video is the more Lighthouse-friendly format for the same content, not a
      trade-off against it. See `landing-ia.md` §3 for the full spine, the About-page nav-placement
      decision, and the workflow-section rationale.

- [x] **Step 2.4 — Outlines for every other page.** Same treatment, lighter: purpose, sections,
      what each must and must not claim (per the ledger). **Tool:** working session.
      **Output:** `landing-ia.md` §4.
      **Note:** two forks this step owned outright — the comparison page's one-page-vs-per-competitor
      shape, and whether Download needs a secondary CLI/build-from-source path — were decided with
      reasoning rather than left open, but flagged for developer sign-off in `landing-ia.md` §4 rather
      than locked silently. See that file for the full 16-page outline and the sign-off flags.

- [x] **Step 2.5 — Content model.** Decide what becomes structured data versus hardcoded markup.
      The tool list is the live case: it's currently hardcoded in `index.astro` and **will** drift
      when Epic 8 reworks the tools. Options: an Astro content collection, a shared JSON, or a
      documented manual sync. **Why here:** it shapes the build, and it's the mechanical half of the
      claim ledger. **Tool:** working session + Context7 for Astro 7's content-collections API.
      **Output:** `landing-ia.md` §5.
      **Correction found while executing:** the roadmap's own three options weren't mutually
      exclusive — different pages needed different answers. Decided: a build-time content collection
      for the 9 tool pages + home's feature-tour grid (single source instead of today's confirmed-live
      duplication bug in `index.astro`); a second collection for the 4 comparison pages, with a
      **mandatory** dated-citation field closing the competitor-fact gap Step 2.4 flagged; a hybrid
      live-loader-plus-hand-curated collection for the changelog (a loader can fetch version/date
      mechanically but must not auto-summarize Added/Changed/Fixed from raw release bodies); a plain
      data file (no collection) for the FAQ; and — the step's hardest finding — `registry.ts` is Vue
      code in a *separate repo*, so keeping the tools collection in sync with it is necessarily a
      **documented manual sync**, not an automated one, no matter which option was picked. Also
      surfaced and decided (developer, 2026-09-19, after a pedagogical walkthrough of both options):
      the download page's per-platform live check (ledger row 7) uses a client-side GitHub API fetch,
      not Astro's now-stable Live Content Collections (confirmed via Context7) — the latter would have
      required adding an on-demand-rendering adapter for one page, and the fact being displayed isn't
      one this site needs crawlable. See `landing-ia.md` §5 for the full reasoning and the recommended
      Vercel-deploy-hook fix for cross-repo staleness.

---

## Phase 3 — Copy

**Goal:** every word on the site, written deliberately, checked against the ledger.

- [x] **Step 3.1 — Web voice spec.** 📚 `EXPERIENCE.md` locks an *in-app* voice — precision
      instrument, no exclamation marks, no cheerleading, "an instrument reporting state." Marketing
      copy needs that same register doing a different job: the app reports, the site persuades. That
      translation has never been written down; the current site's tone was improvised.
      **Why here:** it's the rubric every following step is graded against. **Tool:** working
      session deriving from `EXPERIENCE.md`'s Voice and Tone table, extended with web-specific
      Do/Don't pairs. **Output:** `landing-copy.md` §1.
      **Correction found while executing:** the in-app voice's "no exclamation marks, no cheerleading"
      rule extends *uniformly* to persuasive web copy — including the hero — as a tone floor; what
      changes for the web is technique (specificity, benefit-framing), not the tone ceiling. Two forks
      the roadmap hadn't anticipated were decided the same session: (1) hero/home copy is licensed to
      use full persuasive craft inside that restrained tone, not stripped to documentation-plain
      prose; (2) first-person warmth (DevToys/meetsponsors-style) is licensed as a **bounded
      exception** for the solo-developer-transparency line only (About/footer), nowhere else on the
      site. See `landing-copy.md` §1 for the full extended Do/Don't table, including the new
      disclosure-under-pressure register the SmartScreen modal required (state mechanism and reason,
      never a reassuring adjective).

- [x] **Step 3.2 — Home copy.** 📚 Hero headline, subhead, every section, the CTA. Learn the
      techniques explicitly as you go — specificity over adjectives, benefit over feature, naming
      the enemy, one idea per section. Write 3–5 headline candidates and choose deliberately; the
      current "Developer tools that don't phone home" is genuinely good and worth beating rather
      than discarding. **Why here:** needs the spine (2.3) and the voice spec (3.1).
      **Tool:** working session, then `bmad-editorial-review-prose` as a second pass.
      **Output:** `landing-copy.md` §2.
      **Done 2026-09-19, with corrections that reached outside this step's own file:** the hero
      headline direction ended up different per language (French took the literal wedge, English the
      terser three-beat), decided against a design-canvas mockup rather than a character-count table,
      since a visual "funnel" layout constraint the developer wanted was the real test. Bigger than
      the copy itself — this step reopened a locked decision: **French now ships at launch**, not
      deferred (corrected in this file's decisions table and Step 6.5, above). Also caught and fixed
      live: "one keystroke away" (hero and the Workflow section heading) overclaimed ⌘K as a
      systemwide shortcut when it's in-app only (`landing-ia.md` §3, corrected there); Section 5 (Why
      Umbra)'s original three claims got replaced after developer pushback with real, sourced ones
      (`NFR2` cold-launch budget, `NFR5` accessibility baseline) and expanded to four. A new page,
      `/tools`, was added mid-session to fix a real gap (the 4 comparison pages had no path onto the
      site) — see `landing-ia.md` §1/§3. **Not run:** the `bmad-editorial-review-prose` second pass
      this step names as its tool — the developer's own iterative review this session covered similar
      ground line-by-line, but that skill hasn't actually been invoked; flag if you want it run before
      treating this step as fully closed.

- [x] **Step 3.3 — Proof copy.** 🔸 The section that *demonstrates* the privacy claim instead of
      asserting it. You have rare ammunition most privacy-claiming apps don't: a written, executed,
      per-release network-monitor checklist; Apple notarization; a publicly readable repo; a
      consent-gated updater. **Why its own step:** it's the differentiator, and it's the easiest
      place to accidentally overclaim — so it gets written against the ledger deliberately rather
      than in the flow of 3.2. **Tool:** working session, ledger open alongside.
      **Output:** `landing-copy.md` §3.
      **Drafted 2026-09-19; accepted the same day "with reservations" (developer's own phrase) rather
      than through the in-the-room iteration every other Phase 3 step got** — recorded honestly as a
      qualified acceptance, not full sign-off; no specific objection was named, so there's nothing yet
      to act on if a future session revisits it. Two real findings while drafting, not just copy
      polish: the spine's own self-check command (`nettop -p $(pgrep -x umbra)`) silently fails to
      show the update-check call unless the visitor quits and relaunches Umbra *while* it's running —
      fixed in the copy, traced live against `src/App.vue`/`updateSignal.ts` (the update check is
      launch-only, no manual re-check trigger exists anywhere in the app); and the Rust/native-app line
      this section shares with "Why Umbra" (flagged open in Step 3.2) is resolved as two different
      framings of the same fact (architecture here, speed there), not a repeat or a cut. Also surfaced:
      the "native, no client-server architecture" claim isn't a ledger row yet, joining §2's
      already-flagged NFR2/NFR5 gap as something Step 3.6 needs before it can gate this page. See
      `landing-copy.md` §3 for the full draft and reasoning.

- [x] **Step 3.4 — Remaining page copy.** Download, FAQ (structured from 1.3's objection map), the
      recruiter page, changelog framing. **Tool:** working session.
      **Output:** `landing-copy.md` §4.
      **Done 2026-09-19, with a named scope deferral, not a silent gap:** wrote Download (including the
      Windows unsigned-build modal copy), FAQ (7 Q&A pairs), About/recruiter (mission line + 4 outcome
      statements + footer attribution), Changelog framing, and — closed opportunistically since it's
      small — the `/tools` hub page this roadmap didn't have a page for until Step 3.2 added the nav
      link. **Not written:** the 9 `/tools/*` tool pages and the 4 `/compare/*` comparison pages, even
      though later cross-references in `landing-ia.md` §4 and `landing-copy.md` §2 assumed 3.4 would
      cover them — this step's own README line above never named them, and the comparison pages
      specifically need dated competitor research (a Step-1.2-shaped task), not copy against material
      already on hand. Recommended as a follow-up Step 3.4b. See `landing-copy.md` §4 for the full
      reasoning and every drafted page.

- [x] **Step 3.4b — Tool and comparison page copy.** *(New, 2026-09-19 — the follow-up 3.4 itself
      recommended, run the same session at the developer's request.)* The 9 `/tools/*` pages and the 4
      `/compare/*` pages 3.4 deferred. **Tool:** working session, grounded live against
      `src/locales/en.json`/`fr.json` and `src/stores/registry.ts` for the tool pages (not the marketing
      register — these are functional claims); WebFetch/WebSearch against `devutils.com`, `devtoys.app`,
      `github.com/fosslife/devtools-x`, and `gchq.github.io/CyberChef`/`github.com/gchq/CyberChef` for
      the comparison pages, all checked live 2026-09-19 rather than recalled from Step 1.2's reference
      scan (which checked landing-page conventions, not price/platform/tool-count/source/AI facts).
      **Output:** `landing-copy.md` §4b. Every tool page's "what it does" paragraph traces to a real,
      verified feature (JSON's repair/diff/JSONPath/TypeScript-transform tabs, Hash's live-confirmed
      weak-algorithm flagging, JWT's decode-not-verify scope, Cron's guided-grid redesign per Story 8.6,
      OCR's bundled-model claim per ledger row 3) rather than generic tool-category copy. Every
      comparison page's competitor facts are dated and sourced, closing the citation-discipline gap
      `landing-ia.md` §4 flagged; Umbra's own facts trace to ledger rows 1/3/4/5/6/9/12 as usual.
      **Not resolved:** the comparison-page hub-vs-footer placement question (`landing-ia.md` §4, still
      open) and a re-verification owner for the competitor tool-count figures, which will go stale the
      same way Umbra's own claims would without ledger ownership.

- [x] **Step 3.5 — Microcopy and social-proof honesty pass.** CTA labels, link text, fine print,
      the empty-ish states. Includes the specific problem of presenting a product with **no social
      proof yet** — no stars, no testimonials, no download count worth showing — without either
      faking it or looking abandoned. **Tool:** working session.
      **Output:** `landing-copy.md` §5.
      **Done 2026-09-19, and it surfaced three real gaps rather than only polishing existing copy:**
      (1) `notify_me_clicked` has been a defined PostHog event since Step 1.4 with no page ever giving
      it something to click — now placed on the Download page (paired with the platform-unavailable
      line) and in the footer, both as a "Watch on GitHub" link, GitHub's own mechanism name rather
      than a euphemism; (2) **no language switcher existed anywhere**, even though Step 3.2 already
      reversed the roadmap's locked decision to ship French at launch — without one, French pages would
      exist but be practically unreachable from English ones; added to nav (far right, after Download)
      and the footer, labelled with the destination language ("Français" / "English"), not an
      abbreviation; (3) the Proof section's "read it yourself" line had no actual link to the repo —
      fixed, and the same repo URL now also backs the new Watch-on-GitHub links. Also closed: a
      finalized footer (analytics disclosure promoted from a voice-spec example to real copy, a
      licence note, a copyright line), loading/failure/no-JS microcopy for the download page's live
      per-platform check, and a small new 404 page the page inventory had never named. The
      social-proof audit itself found **nothing to fix** — no fabricated stat, star, or testimonial
      had crept into any of §1–§4b's drafted copy — and a real (non-fabricated) GitHub star count was
      considered and deliberately rejected, since a small true number can read worse than no number at
      launch. See `landing-copy.md` §5 for full reasoning; `landing-ia.md` §3/§4 carry the placement
      corrections (nav, footer, Download page, a new 404 addendum).

- [x] **Step 3.6 — Ledger gate.** Read every line of copy against Step 1.5's ledger. Anything not
      traceable to a source either gets a source or gets cut. **Why last in the phase:** it's a gate,
      not a draft pass. **Tool:** working session; `bmad-review-edge-case-hunter` for an adversarial
      read of the privacy and licence wording specifically. **Output:** ledger sign-off recorded in
      `landing-copy.md` §6.
      **Done 2026-09-20, signed off with two pre-launch action items, not a clean pass.** Added three
      ledger rows (`landing-strategy.md` §5, rows 14–16: cold-launch performance, accessibility
      baseline, no-client-server architecture) that `landing-copy.md` §2/§3 had already flagged as
      un-sourced while drafting. Found and corrected live: About's "no browser engine" claim (false for
      a Tauri app, which renders via the OS's own webview — the true, defensible claim is no *bundled*
      browser runtime, unlike Electron), and two instances of an "as-of-every-release" cadence claim
      (About, FAQ) that `landing-strategy.md` §5 had already found, live, doesn't currently hold — the
      nettop-checklist discipline lapsed after `v0.2.0` and neither of the two most recent releases
      carries a published result. **Two related findings deliberately left as copy, not rewritten:**
      the Proof section's self-check prediction hasn't actually been re-verified against three of the
      nine current tools (OCR/PDF/Images, added after the only published check) — carried to Step 8.1
      as a pre-launch action item rather than softened, since the underlying claim follows validly from
      the architecture (row 16), not from a test that needs to exist for the sentence to be honest; and
      a categorical no-network-calls sentence that sits several lines above its own disclosed exception,
      an extraction risk for an LLM lifting a self-contained answer — handed to Step 3.7 as its first
      item rather than pre-empted here. The footer's analytics-disclosure sentence (ledger row 13) is
      confirmed still gated on Step 6.8's not-yet-run PostHog dashboard audit, unchanged from that row's
      own existing flag. See `landing-copy.md` §6 for the full row-by-row traceability table and every
      finding's reasoning.

- [x] **Step 3.6b — SEO pass.** 🔸 **Added 2026-09-19 — the roadmap originally had a GEO pass (3.7)
      with no distinct SEO equivalent, on the unstated assumption the two techniques are close enough
      to merge.** The developer correctly pushed back: SEO and GEO optimize for different consumers of
      the same copy — a traditional crawler ranking a page for a typed keyword phrase, versus an
      assistant lifting a self-contained answer for a conversational question — and the two can
      actively conflict (a heading rewritten for AI-extraction phrasing can be a worse-targeted heading
      for search ranking, and vice versa). Concretely, this pass covers: **title tags and meta
      descriptions** per page (distinct from the on-page H1/headline copy Phase 3 already wrote);
      **header hierarchy** (H1/H2/H3) checked for crawlability, not just visual/voice structure;
      **natural search-query phrasing** worked into body copy where it doesn't fight the voice spec —
      a different register from Step 1.6's conversational AI-query phrasing, even though both are
      "what does a stranger type/ask to find this"; **internal linking** for crawl equity — which pages
      get linked from where, not just "does a link exist" (the FAQ/tool-page/comparison-page links
      Step 3.4 already added are a starting point, not a finished link graph); **image alt text**
      conventions for the product screenshots Phase 5 will add; and **canonical URLs across the EN/FR
      locale pair**, so Step 6.5's i18n routing doesn't create a duplicate-content problem search
      engines penalize. **Why before the GEO pass, not after or merged with it:** SEO's targets (title
      tags, keyword phrasing, link structure) are the more stable, established discipline; GEO is
      newer, faster-moving, and — per this roadmap's own Rule 8 — a field to "treat with suspicion."
      Establishing the stable layer first gives the GEO pass something concrete to check itself against,
      rather than two simultaneous rewrites with no ordering to arbitrate a conflict.
      **Tool:** working session; Context7 if `@astrojs/sitemap`'s or Astro's canonical-URL handling
      needs re-verifying against Step 6.5's routing decision. **Output:** `landing-copy.md` §7.
      **Feeds into Step 6.6** (structured data) — the per-page title/description this step sets is the
      same metadata `SoftwareApplication`/`FAQPage` JSON-LD partly derives from.
      **Renumbers the file section after it:** Step 3.7 (GEO)'s output below shifts from
      `landing-copy.md` §7 to §8, since this step claims §7 — the roadmap's insert-as-3.6b convention
      keeps step *numbers* stable for files that already cite "Step 3.7," but the target file's own
      section count still has to shift to make room.
      **Done 2026-09-20.** Verified live via Context7 (`/withastro/docs`) that Astro has no built-in
      canonical-URL or per-page `hreflang` generation — both need hand-written `<head>` tags in
      `Layout.astro` — and that `@astrojs/sitemap`'s own `i18n` option only produces `hreflang` inside
      `sitemap.xml`, a complementary mechanism, not a substitute; also caught that Astro's own docs
      example uses `fr-CA`, the wrong locale tag for Umbra's (non-Québécois) French. Wrote title tags
      and meta descriptions for all 23 routes, checked against the claim ledger the same way Step 3.6
      checked on-page copy. Assigned explicit H1/H2 levels to every already-drafted heading (none had
      one before this step) and found two real crawlability risks in how the copy implies the UI gets
      built: the Download page's OS tabs and the FAQ's answers could both end up rendered only when a
      visitor interacts with them, hiding two-thirds of Download's content and all of FAQ's answers
      from a crawler — flagged for Step 6.3 to render both fully into the DOM regardless of visual
      collapse state. Found one real internal-linking gap (the four comparison pages are reachable from
      only one FAQ mention) and offered a fix for developer confirmation rather than locking it, since
      it touches Step 2.4's still-open hub-vs-footer question. See `landing-copy.md` §7 for the full
      title/meta table, header-hierarchy assignment, and every finding's reasoning.

- [x] **Step 3.7 — Extractability pass (GEO).** 📚 Re-edit the finished copy so a machine can lift a
      correct, self-contained answer out of it. Concretely: question-shaped headings matching Step
      1.6's target questions; the direct answer in the first sentence under each heading, before the
      elaboration; facts stated in full rather than by pronoun ("Umbra runs entirely offline" beats
      "it does"); a comparison table (Umbra vs. web-based formatters vs. other desktop suites), since
      tables are unusually citable; and visible dates on anything time-sensitive, since recency
      correlates strongly with citation. **Why here and not inside 3.2:** writing for a human and
      structuring for extraction pull in different directions, and doing both at once produces copy
      that reads like an FAQ bot. Write it well first, then make it liftable.
      **New guard rail, added alongside 3.6b:** this pass must not silently undo 3.6b's SEO work — a
      GEO-motivated heading or phrasing rewrite that would break a title tag's keyword target or orphan
      an internal link 3.6b placed gets flagged and decided explicitly, not overwritten by default. Where
      the two genuinely conflict (rare — mostly they reinforce each other, since both reward specific,
      well-structured, factual copy), name the conflict and let the developer pick, per this roadmap's
      own autonomy table. **Guard rail (original):** this pass must not weaken 3.6's sign-off — a claim
      made more quotable is a claim more likely to be
      repeated verbatim by an LLM, which *raises* the cost of overstating it. Re-run the ledger check
      after this pass. **Tool:** working session; `bmad-editorial-review-structure` for the heading
      pass. **Output:** `landing-copy.md` §8 (shifted from §7 by 3.6b's insertion above).
      **Done 2026-09-20.** Fixed the one item Step 3.6 had already flagged as this step's first job: the
      Proof section's categorical "no server for your data to go to" claim now states its one disclosed
      exception (the update check) in the same breath, both languages — previously the exception sat
      several lines below, a real extraction risk. Found and fixed three FAQ answers that opened with an
      unresolved pronoun ("it's...") that loses its subject when an answer gets lifted without its
      question. Found and closed a real coverage gap: none of the FAQ's seven pairs directly answered
      "how do I check this app isn't phoning home," even though the home page's Proof section argues
      exactly that at length — added as FAQ #8. Drafted the Umbra-vs-web-tools-vs-other-desktop-suites
      comparison table this step's own description names, not yet written anywhere (the four existing
      comparison pages are each one named competitor); placement stays open per `landing-ia.md` §4's
      existing flag. Named, rather than silently resolved, the one real conflict between GEO's
      question-heading technique and the site's own structural-rebuttal preference (`landing-strategy.md`
      §2c) — it would apply to Home's Proof section specifically; resolved by leaving Home unchanged,
      since the literal question-shaped version of that exact query now has a home in the new FAQ #8
      instead. Flagged, not applied: a "free, no account" gap on the 9 individual tool pages (real, but
      touches nine already-signed-off pages, so left for developer sign-off rather than added
      unilaterally). **Not run:** `bmad-editorial-review-structure`, this step's own named tool — the
      manual heading-by-heading audit against `landing-strategy.md` §7's query list covered similar
      ground; flag if you want the skill itself run before treating this step as fully closed. See
      `landing-copy.md` §8 for the full query-mapping table, the comparison table in both languages, and
      every finding's reasoning.

- [x] **Step 3.8 — Capability-differentiation pass (long-tail SEO/GEO).** 📚 For each of the 9 tools,
      identify what it can do that a free competitor genuinely can't — not the privacy/verification
      pitch every tool page already carries, but a specific, functional capability (a conversion format,
      a level of detail in the output, a workflow another tool doesn't offer) checked live against the
      same competitor set Step 3.4b already researched. Where a real one exists, give it its own heading
      or micro-FAQ entry on that tool's page, phrased as the exact, narrow query someone with that need
      would type ("convert an API response to a Pydantic model," not "json formatter"). **Why this is a
      different pass from Step 3.6b's natural-search-phrasing work:** that pass inserts high-volume
      synonyms into claims already being made; this one targets queries with almost no competition,
      because the claim being answered doesn't exist anywhere else yet — a small site can rank or get
      cited for a query nobody else is contesting far more easily than for "json formatter" on its own.
      **Guard rail, same discipline as every other claim on this site:** a capability only gets written
      up once it's actually verified — checked live against `src/locales/en.json`/`registry.ts` the way
      Step 3.4b checked every functional claim, never inferred from the tech stack ("it's Rust, so it
      must handle large files better"). If nothing real turns up for a given tool, that tool's page stays
      as drafted rather than getting a manufactured differentiator. **Why here and not later:** this
      needs the tool pages' real copy to audit against (Step 3.4b) and should land before Step 6.3 builds
      those pages, so the finding changes the copy once rather than after the fact.
      **Tool:** working session, live research against `devutils.com`, `devtoys.app`,
      `github.com/fosslife/devtools-x`, and CyberChef, one tool at a time, the same sources and
      verification discipline Step 3.4b already used. **Output:** `landing-copy.md` §9.
      **Done 2026-09-20.** Found and verified six real, checked capability gaps (JSON's repair-with-
      preview, Base64's single-tool auto-detection of decoded content, Hash's verify-against-a-known-
      digest with a paste-offer, JWT's unsigned-token flag, PDF's full page manipulation — the
      strongest of the six, since none of DevUtils/DevToys/CyberChef ship a PDF tool at all and
      DevTools-X's is a viewer only — and Images' AVIF/WebP conversion against DevUtils/DevToys
      specifically). Added a seventh, OCR's selectable-text-on-image overlay plus in-image search,
      framed differently since none of the four competitors ship OCR at all, so there's no "competitor
      lacks X" gap to check it against — added anyway as a real, narrower workflow claim distinct from
      the site's general AI-privacy pitch. **Two tools got no new claim, correctly, not by oversight:**
      UUID (DevToys already shipped v7 support in 2024; no other gap could be confirmed) and Cron
      (see below). **Real methodological catch this session:** search results for the Cron and Images
      research surfaced two impostor sites — `devutility.tools` (not `devutils.com`) and `devtoys.pro`
      ("DevToys Web Pro," an unrelated paid web product, not `devtoys.app`) — each confidently
      attributed to the wrong real competitor by a search summary. Caught before anything was written
      up; the same failure mode `landing-strategy.md` §2's Warp correction and §2c's "public repo ≠
      open source" correction already caught in this project. Cron ended up with no differentiator
      once the impostor-sourced claims were discarded — its page stays exactly as §4b drafted it. See
      `landing-copy.md` §9 for the full per-tool table, every new micro-FAQ pair (EN/FR), and the
      unresolved re-verification-ownership gap this step's new competitor facts share with §4b's.

---

## Phase 4 — Legal & trust surfaces

**Goal:** close the gaps that exist because the site collects analytics and distributes a binary.
Runs after copy because these are copy too — and before build, because two of them change what the
code does.

> Not legal advice. These steps produce your own informed decisions, with sources named. Treat
> anything you're unsure about as a question for someone qualified, not for an AI.

- [x] **Step 4.1 — Privacy policy.** A real page, not a footer sentence. You run PostHog from
      France on an EU-region project, so GDPR applies to *the site* regardless of the app collecting
      nothing. Strategic angle as much as legal: a product whose entire pitch is privacy, without a
      privacy policy, is an own goal a sharp visitor notices. Made much shorter by two decisions
      already taken — cookieless, and no email capture. **Tool:** working session; CNIL's own
      guidance as the primary source for the French context. **Output:** `landing-legal.md` §1.
      **Done 2026-09-20.** Drafted the full EN/FR page copy, grounded live against CNIL's published
      cookie/audience-measurement guidance (fetched this session, not templated) and PostHog's own
      GDPR-compliance docs (Context7) for the one fact `Layout.astro`'s public code can't answer —
      whether IP capture is on for this project. Concluded, against CNIL's exemption criteria, that
      no cookie-consent banner is needed and the legal basis is legitimate interest, not consent —
      an own assessment against published criteria, stated as such, not a claimed CNIL certification
      (PostHog isn't on CNIL's named-tool exemption list). **Two items deliberately left open, not
      guessed:** the IP-capture toggle is a PostHog dashboard setting only Step 6.8's login-gated
      audit can confirm; "Data controller & contact" ships as a placeholder per the developer's own
      decision this session, since `CLAUDE.md`'s privacy rule blocks writing a real name/personal
      email into a committed file, and Step 4.2's legal notice needs the same answer — deciding it
      once, before launch, resolves both pages. See `landing-legal.md` §1 for the full draft,
      sourcing, and every flagged item.

- [x] **Step 4.2 — Legal notice (mentions légales).** France requires a site publisher to identify
      themselves. For a non-commercial personal site the requirements are reduced — notably you can
      generally withhold a home address where the host is identified — but reduced is not none.
      **Why here:** it's a page in the inventory and it needs writing. **Tool:** working session,
      CNIL/service-public guidance. **Output:** `landing-legal.md` §2.
      **Done 2026-09-20, with a correction to this entry's own legal basis.** The article this
      framing and most secondary sources cite, LCEN Article 6-III, was repealed by the SREN law
      (2024-05-23) and replaced by **Article 1-1** — verified live against Légifrance, not assumed
      from memory or from CNIL/service-public (neither names the current article clearly). The
      actual exemption is broader than "withhold a home address": a **non-professional** publisher
      (Article 1-1, II) may keep their entire identity off the public page and disclose only their
      hosting provider's name and address, provided they've given their real identity to the host
      directly. Determined Umbra-web qualifies (free product, no monetisation, one individual,
      About page is a personal portfolio not a commercial offering) — own good-faith assessment,
      not a certified legal conclusion. **Developer decided (2026-09-20):** ship host-only, fully
      anonymous — no name or handle, not even the already-public GitHub `dipaneb`. This also
      corrects `landing-legal.md` §1's assumption that Step 4.2 needed the same open decision as the
      privacy policy's "Data controller & contact" field — it doesn't; LCEN's non-professional
      exemption has no GDPR equivalent, so only the GDPR-side contact placeholder is still open,
      shared by both pages. Vercel's hosting address (440 N Barranca Avenue #4133, Covina, CA 91723)
      sourced live from Vercel's own published privacy policy, not a third-party registry (which
      returned conflicting addresses). One pre-launch action item carried to Step 8.1: confirming
      the Vercel account actually holds the operator's real identity, the exemption's precondition.
      See `landing-legal.md` §2 for the full EN/FR draft and reasoning.

- [x] **Step 4.3 — End-user licence for the binary.** 🔸 Separate from the repo's All Rights
      Reserved. Right now the repo grants no rights and the site says "download this" — technically
      contradictory, and nobody has flagged it in any existing document. A short statement (personal
      use permitted, no redistribution, no reverse engineering, provided as-is with no warranty)
      resolves it. **Why here:** it changes the download page's copy and possibly adds a page.
      Because you took All Rights Reserved rather than an OSS licence, you also got none of the
      warranty-disclaimer boilerplate an OSS licence would have handed you for free.
      **Tool:** working session. **Output:** `landing-legal.md` §3.
      **Done 2026-09-20.** No new placement decision needed — Step 2.1 (`landing-ia.md` §1) already
      researched two real comparables (CleanShot X's full EULA, Titanium Software/OnyX's short
      seven-clause one) and locked a dedicated `/eula` page, short form; this step filled that
      already-decided structure with actual terms, checked against the repo's `LICENSE` (read live)
      and ledger row 9. Seven clauses: License grant, No redistribution, No reverse engineering or
      modification, "As-is"/no warranty, Limitation of liability, Termination, Contact. Deliberately
      left out a governing-law clause — not one of this step's four named points or the outline's
      seven clauses, so flagged as an optional pre-launch addition rather than added unilaterally.
      Shares the same open "Contact" placeholder as Steps 4.1/4.2 rather than opening a fourth one.
      See `landing-legal.md` §3 for the full EN/FR draft and reasoning.

- [x] **Step 4.4 — Third-party asset licence record.** Geist Sans/Mono (OFL 1.1, already verified
      in `DESIGN.md`), Phosphor icons, any imagery. Just needs recording as checked.
      **Tool:** working session. **Output:** `landing-legal.md` §4.
      **Done 2026-09-20.** Re-verified Geist Sans/Mono's OFL 1.1 licence live against the installed
      `@fontsource/geist-sans`/`geist-mono` `5.3.0` packages `Umbra` already depends on (package.json
      `license` field + bundled `LICENSE` file), rather than trusting `DESIGN.md`'s own summary alone.
      Checked Phosphor Icons the same way — `@phosphor-icons/vue` `2.2.1`, MIT, verified from the
      installed package — and connected it to `landing-ia.md` §5's tool-page `icon` frontmatter field,
      which implies reusing the app's own Phosphor set for visual consistency, a link the roadmap
      hadn't made explicit. Both are clear to adopt; neither is wired into `umbra-web` yet, since
      Phase 5/6 haven't run — recorded ahead of the build so that work doesn't re-derive the licence
      question. Imagery: `umbra-web`'s only two current image files are `create-astro`'s own
      MIT-licensed placeholder favicon art (already flagged for replacement at Step 5.6); no other
      imagery exists yet, and everything Phase 5 will add (screenshots, OG card, logo) is the
      developer's own original material, not third-party stock — audited and recorded as "nothing to
      clear," not silently skipped. See `landing-legal.md` §4 for the full record and reasoning.

---

## Phase 5 — Visual design & product imagery

**Goal:** decide how it looks and produce the images. After copy, because layout should serve real
content rather than lorem ipsum.

- [x] **Step 5.1 — Derive web tokens from `DESIGN.md`.** 🔸 Not a copy-paste. The app's ramp is
      14px body / 28px display — far too small for a web hero — and `EXPERIENCE.md` explicitly
      states the app has "no responsive-breakpoint question to resolve," so the web has **no type
      scale, no breakpoint set, and no fluid spacing to inherit.** Produce a web scale that is
      recognisably the same brand: same families, same 4px spacing base, same 4px radius, same
      "orange is a budget of one" rule, different sizes. **Why here:** everything visual consumes it.
      **Tool:** working session against `DESIGN.md`; the `design` skill or Claude Design for quick
      side-by-side scale comparisons. **Output:** `landing-design.md` §1.
      **Done 2026-09-21, and "same families" didn't survive as originally framed.** A fluid type
      scale (`clamp()`, `rem`-based) and a 3-value breakpoint set were derived as the roadmap
      expected — but the developer reopened the "same families" instruction itself, correctly
      pointing out the app's dense-UI typography and a landing page's persuasion job don't actually
      need the same personality. Four rounds of live-licence-verified typeface candidates followed
      (Space Grotesk/Bricolage Grotesque → Unbounded/Syne/Chakra Petch/Big Shoulders → a named
      French foundry, Velvetyne, checked and rejected, plus Fontshare's licence re-cleared and Clash
      Display added → **Hubot Sans** decided), landing on GitHub's own restrained technical/mechanical
      display face for `hero`/`h1`/`h2` only — Geist Sans/Mono keep every other role. Also caught and
      fixed live: every size in the original derivation was already computed in `rem`, but presented
      to the developer in `px` in an early draft — a real WCAG 1.4.4 (resize-text) gap the developer
      flagged from memory and turned out to be correct about; fixed, and a guardrail against
      `Layout.astro` ever overriding `<html>`'s font-size was added for Step 6.2. See
      `landing-design.md` §1 for the full derivation, the four-round typeface trail, and the fluid
      formula; `landing-legal.md` §4 carries the new Hubot Sans licence addendum. **Two proposals
      (the body-size bump, the 3-value breakpoint set) went unaddressed while the typeface fork
      played out — flagged explicitly rather than assumed agreed, and confirmed by the developer the
      same day.** Nothing from this step's own scope is still open.

- [x] **Step 5.2 — Layout & responsive design.** Home page first, then the rest. Roughly half your
      visits will be phones — including a recruiter opening your link on a train.
      **Why here:** consumes 5.1's tokens and 2.3's spine. **Tool:** the `design` skill (a
      multi-artboard canvas: desktop and mobile side by side) or Claude Design, seeded with
      `DESIGN.md` — the same tool and the same seeding pattern that worked for Steps 3.1 and 4.3 of
      the app roadmap. **Output:** mockups + `landing-design.md` §2.
      **Signed off 2026-09-22, with three named opens carried forward rather than a clean pass** — the
      same "accepted with reservations" pattern Step 3.3 used, not silent completion:
      (1) the alternating section background (white bands behind Workflow/Why-Umbra) was this step's
      own addition and was never explicitly confirmed; (2) the mobile nav's expanded/open hamburger
      state still isn't drawn, only its collapsed trigger; (3) Hash's tablet tile lost its "tall"
      treatment in the 3-column reflow (still orange, still gets the ghost glyph, just sized like its
      row instead of spanning two) and that trade-off hasn't had an explicit yes. None of the three
      block Step 5.3 — revisit them whenever, or fold a fix into a later pass.
      **Draft built 2026-09-21.** A three-artboard canvas (desktop
      1440px, tablet 768px, mobile 390px) plus a set of comparison artboards for the feature-tour
      section specifically: [Umbra — Home Layout](https://claude.ai/artifact/7jvUELBG9GkfQ6kvRE4tn1).
      **Feature-tour arrangement resolved 2026-09-22** after four rounds (marquee and a
      vertical-scroll panel rejected; two bento passes rejected — one for only changing decoration on
      a still-rigid grid, one for being too plain once decoration was stripped) — the desktop answer is
      a real asymmetric bento (modeled on two reference grids the developer supplied) combined with a
      search bar that filters/highlights the matching tile, not a static input; mobile keeps its
      already-separate horizontal-scroll-with-search strip. **Three more decisions confirmed the same
      session:** the nav's Download button hides while the hero is in view (the hero already has its
      own); the Proof section's device–✕–server diagram goes horizontal on mobile too, not stacked; and
      the `nettop` terminal self-check is cut entirely on mobile (unusable and irrelevant there, not
      just long). **All of the above merged into the three full-page artboards the same day** — the
      bento+search behavior, the nav visibility toggle, and the mobile Proof changes are real, working
      interactions in the canvas (an `IntersectionObserver` and a live search filter), not just
      described. `Mobile.dc.html`'s total height dropped from 5850px to 4300px as a direct result.
      **Corrected same day:** tablet initially kept its own separate 2-column grid instead of the
      resolved bento — flagged as an oversight, not a decision, and fixed by reflowing the same bento +
      live search to 3 columns for the 768px width. **Also restyled the same day:** the search box
      itself (magnifying-glass icon, elevated shadow, floating-surface radius) so it reads as a search
      bar rather than a plain bordered rectangle. See `landing-design.md` §2 for the full reasoning and
      breakpoint table.

- [x] **Step 5.3 — Product imagery.** 🔸 **The site currently has zero images. A visitor cannot
      see what Umbra looks like without installing it.** For a desktop app with no in-browser trial,
      this is usually the single largest conversion factor. **The Epic 7 fork, decided at this step:**
      the shipped shell still predates the design system, so real captures today would show a UI
      that contradicts the site's own branding. Either (a) ship with the Step 4.3 Claude Design
      mocks, labelled honestly as mockups, and swap in real captures once Epic 7 lands, or (b) hold
      the imagery slot until Epic 7 ships. Decide it here, explicitly, rather than discovering it at
      launch. **Corrected by Step 2.3 (`landing-ia.md` §3):** a demo of the 5-minute flow (⌘K → JSON
      → JWT → cron → Bucket) is not just worth producing, it's decided — home's spine now reserves a
      section for it — and it ships as a **video, not a GIF** (compressed video is smaller and more
      Lighthouse-friendly than an equivalent GIF for the same motion, so this is a format correction,
      not a scope change). Step 6.10 inherits the lazy-load/poster-frame/no-autoplay requirement that
      keeps it out of the performance budget.
      **Tool:** macOS `⌘⇧5` or Shottr/CleanShot for the stills; keep framing restrained, per brand.
      **Output:** image assets + `landing-design.md` §3.
      **Epic-7 fork resolved 2026-09-24, live-verified rather than assumed from this entry's own
      wording:** Epic 7 (all 8 stories, `#78`–`#86`) and Epic 8 (all 9 stories, through `#154`) are
      both fully merged to `main`, ahead of the current tip (`#156`) — checked directly against
      `sprint-status.yaml` and `git log`, not trusted from `sprint-status.yaml`'s own stale `in-progress`
      epic flags (every individual story under both reads `done`). The "shipped shell still predates the
      design system" premise this fork was framed around no longer holds — there's no version of Umbra
      left to wait for. **Decided: real screenshots and video now**, dissolving the mockups-vs-hold
      choice rather than picking a side of it. Video tool corrected to the developer's own choice —
      Screen Studio or OpenScreen, not a plain screen recording. **This entry's own demo-flow wording
      ("⌘K → JSON → JWT → cron → Bucket") is superseded, not just corrected:** the developer proposed a
      scenario-driven flow instead — a Slack screenshot of a broken API log → OCR → the JSON tool's
      repair feature fixes the truncated log → the JWT token inside it decodes cleanly, revealing the
      actual permission bug. **A first version of this plan had the order backwards** (decode a broken
      JWT, then repair it) and doesn't work: `jwt.rs`'s `decode()` hard-errors on invalid-JSON payloads
      and exposes no raw text to copy out, confirmed by reading the source — caught and corrected the
      same session, along with live-verifying the corrected flow (a throwaway `cargo test` against the
      actual `repair()` function, reverted after) rather than shipping an unverified shot list.
      **Explicit developer call: the already-signed-off Workflow copy in `landing-ia.md`
      §3/`landing-copy.md` stays unchanged** — the video and the words next to it knowingly describe
      different things (no cron shown; OCR, clipboard-chaining, JSON repair, and JWT decode shown but
      unnamed in the copy), recorded as an accepted gap. **Done 2026-09-26.** Hero art turned out to
      already be this same Workflow video (the Step 5.2 mockup's own "Product preview" box under the
      headline is `landing-ia.md` §3 row 1's visual requirement — this step's own earlier tracking of
      hero as a separate open decision was the error, corrected in `landing-design.md` §3). The
      Workflow video is recorded, re-encoded (H.264 MP4 fallback + a real AV1 encode beating an
      online converter's VP9 output on both size and VMAF score — not just remuxed), captioned
      per-locale, and staged in `umbra-web/public/videos/`; its accessible text alternative is
      written (EN/FR). All 18 tool-page screenshots (9 tools × light/dark) are captured with real
      output per tool, converted to lossless WebP (3.7MB → 1.0MB, objectively verified against AVIF
      and lossy WebP before picking lossless — see `landing-design.md` §3), and staged in
      `umbra-web/public/images/tools/`. Only remaining flag: these are still full Retina-resolution
      captures; downscaling to the actual `/tools/*` display size is a further, smaller win Step 6.3
      can take once that page layout exists. See `landing-design.md` §3 for the full record and every
      correction made along the way.

- [x] **Step 5.4 — Social share card (OG image).** 🔸 Cheap, high payoff, currently missing: every
      share of this link — Slack, LinkedIn, Discord, a message to a recruiter — renders as a bare
      grey box today. One well-made 1200×630 image fixes it everywhere. **Tool:** designed as an
      artboard alongside 5.2, exported as PNG. **Output:** asset + `landing-design.md` §4.
      **Done 2026-09-26.** Dark card (wordmark + the exact signed-off hero headline, one line in the
      signature orange + a real Step-5.3 screenshot bleeding off the edge), built on a Design-canvas
      Artifact with the actual Hubot Sans/Geist Sans webfonts uploaded as assets (not a Google-Fonts
      stand-in the way Step 5.2's canvas needed), exported at exact 1200×630px via a real headless
      Chrome render rather than an approximate screenshot-tool viewport. No new copy was authored —
      the headline is reused verbatim so the asset inherits Step 3.6's existing ledger sign-off
      rather than needing its own. Deliberately excludes a logo mark (Step 5.5 hasn't run), a
      domain/URL (Step 6.1 hasn't run, and `CLAUDE.md`'s privacy rule bears directly on writing a
      personal-domain candidate into a committed file early), and a French variant (one universal
      card, matching the Step 1.2 reference set). Also closes a gap `landing-copy.md` Part 5 had
      already flagged: wrote the card's `og:image:alt` text, separate from any on-page alt. Asset
      staged (not committed — a separate authorization) at `umbra-web/public/og-image.png`. See
      `landing-design.md` §4 for the full reasoning and the canvas link.

- [x] **Step 5.5 — Logo intake & placement inventory.** 🔴 **Input required from the developer, not
      produced by the session.** The developer is designing the mark themselves — see `DESIGN.md`'s
      Mark section for the locked brief it should satisfy (monogram U, ink-letter-plus-shadow
      concept, "adopted-for-now, not locked with the same permanence" as the rest of the system).
      **Before this step can run, the session needs two files, supplied by the developer:** a
      light-mode SVG and a dark-mode SVG of the finished mark — vector (not PNG/JPEG), transparent
      background, the mark isolated with no card, caption, or padding baked in (unlike the only file
      currently on disk, `ux-designs/ux-umbra-2026-08-15/mockups/step3.3-logo-ink-letter-accent-
      shadow.png`, which is exactly that kind of non-isolated review artifact and is not usable as
      source). **If a session reaches this step and those two SVGs don't exist yet, it stops and asks
      for them — it does not generate a placeholder or redraw one itself.** Once supplied, the
      session's job is placement, not creation: everywhere the mark appears on the site — the
      header/nav (today it's plain text, "Umbra," no mark at all — decide mark-only, wordmark-only,
      or a mark+wordmark lockup, and at what size); the favicon/browser tab; the OG share image
      (5.4 — does it carry the mark, or is a screenshot enough on its own); the footer; a loading or
      empty state if one exists; and, if Step 9.2's distribution work ever creates a GitHub org
      avatar or a social account, that too (flagged here, not designed here). It should also sanity-
      check the supplied SVGs against the small-size constraint worth knowing about: a mark with a
      hard-edged shadow layer can lose legibility at 16×16 favicon size — worth a look before 5.6
      commits to it, and a simplified single-layer variant for tiny sizes is a legitimate outcome if
      it does, not a compromise. **Why its own step:** because the mark is explicitly not locked,
      this step also records what triggers a re-do — feeds Step 10.1's maintenance list.
      **Tool:** working session; the `design` skill only for the placement mock, seeded with the
      developer's own SVGs, not for generating the mark. **Output:** the two supplied SVGs, placed
      into `umbra-web`'s asset tree, + placement decisions in `landing-design.md` §5.
      **Done 2026-09-26.** Developer supplied `Logo 1.svg`/`Logo 2.svg`; light/dark assignment derived
      from the ink-letter color against `DESIGN.md`'s `text-primary`/`text-primary-dark` tokens (not
      guessed) and confirmed by the developer. One real deviation flagged rather than silently
      normalized: the shadow shape uses an identical two-stop gradient in both files instead of each
      mode's own flat `accent-signature` value — developer decided to keep it as originally drawn,
      recorded honestly as "a gradient built from the accent-signature values," the same kind of named
      exception `DESIGN.md` already grants the Base64 icon. A real small-size legibility problem was
      found and verified live (headless-Chrome renders at 16/24/32/48px, pixel-zoomed): the shadow's
      hard offset edge blurs into a smudge at 16×16 favicon size, though the U itself stays legible.
      Developer decided to accept that trade-off rather than add a simplified fallback variant — no
      extra small-size asset for Step 5.6 to produce. Placement decided: nav gets a mark+wordmark
      lockup (Raycast/Linear/Warp/Zed convention, per Step 1.2), footer gets a small mark next to the
      copyright line, favicon uses the full mark at every size. Confirmed umbra-web has no
      loading/empty state that would carry a mark. GitHub org avatar/social icon flagged for Step 9.2,
      not decided now. Assets staged (not committed) at `umbra-web/public/logo-light.svg` /
      `logo-dark.svg`. See `landing-design.md` §5 for the full reasoning and the Step 10.1
      maintenance-list items a future mark redo would touch.

- [x] **Step 5.6 — Favicon & icon asset production.** Derive the technical file set from 5.5's two
      supplied SVGs (light + dark): `favicon.ico` (multi-resolution), `favicon.svg`
      (already present but still Astro's default art), a 180×180 `apple-touch-icon.png` for iOS
      home-screen saves, and — since 5.2 already established roughly half of visits are mobile — a
      minimal web app manifest with its own icon sizes if you want "add to home screen" to look
      intentional rather than showing a browser-generated placeholder. Note `apple-touch-icon` and
      most manifest icon slots don't support per-mode swapping — pick one of the two supplied SVGs
      (light generally reads better against iOS's white default background) for those, and reserve
      the light/dark pair for `favicon.svg`'s `prefers-color-scheme` support and any in-page use.
      **Why after 5.5, not part of it:** 5.5 is sourcing and placement, this is asset export and
      wiring into `Layout.astro`'s `<head>` — mixing them hides whether a step failed because a
      supplied file was missing versus a technical export step went wrong.
      **Tool:** a favicon generator (realfavicongenerator.io or equivalent) fed the 5.5 SVGs, to
      cover the size matrix without hand-exporting each one.
      **Output:** assets in `umbra-web/public/`, wired in Phase 6.
      **Done 2026-09-26, tool substituted for a verifiable reason, not convenience.** Uploading the
      mark to a third-party favicon generator would have meant trusting its rasterizer to reproduce
      the mark's two SVG filters (drop-shadow, inner-shadow) faithfully, with no way to check its work
      — so generated the full size matrix locally instead, from `logo-light.svg`, via headless Chrome
      screenshots at each exact target dimension (16/32/48px for the ICO, 180px for the touch icon,
      192/512px for the manifest) — the same renderer this project already trusted for Step 5.5's own
      legibility check, so the 16px result is pixel-identical to what that step already showed the
      developer. **Real gotcha caught and fixed:** `apple-touch-icon.png` needed the transparent
      background stripped — iOS renders transparency in home-screen icons as solid black, which would
      have put a black square behind the mark; composited onto opaque white instead (confirmed via
      `sips -g hasAlpha`: false), matching this step's own note that the light file "reads better
      against iOS's white default background." **`favicon.ico` is now a genuine multi-resolution ICO
      container** (verified via `file`: "MS Windows icon resource - 3 icons") — the file it replaces
      was actually a single 32×32 PNG wearing an `.ico` extension, not a real multi-size icon.
      **`favicon.svg` is now the real mark, not Astro's scaffold art** — rebuilt as both SVGs' content
      combined in one file, `.u-light`/`.u-dark` groups toggled by `@media (prefers-color-scheme:
      dark)` (the same swap-by-`display`, not swap-by-`fill`, pattern the placement inventory called
      for, since these are multi-layer gradient artworks, not recolorable single paths). Verified both
      branches render correctly — this machine's own dark-mode OS setting made the *unmodified* file's
      default render exercise the dark branch, so the light branch was separately force-rendered to
      confirm it too, catching the kind of "looked right by accident" mistake a single screenshot would
      have missed. `site.webmanifest` added (name/description from `Layout.astro`'s own defaults,
      `theme_color`/`background_color` from `DESIGN.md`'s `accent-signature`/`bg-surface` tokens, not
      invented) with `icon-192.png`/`icon-512.png`, both kept transparent per PWA convention (only the
      Apple slot needed flattening). **Confirmed out of scope, per this step's own boundary with 5.5/
      6.2:** no `Layout.astro` changes — the existing `<link rel="icon" type="image/svg+xml"
      href="/favicon.svg" />` already points at the right filename and needs no edit, and the
      `apple-touch-icon`/manifest `<link>` tags plus nav/footer mark wiring stay Step 6.2's job as the
      roadmap already specified. Assets staged (not committed) at `umbra-web/public/`: `favicon.ico`,
      `favicon.svg` (replaced), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`,
      `site.webmanifest`.

- [x] **Step 5.7 — Dark mode.** Near-free: `DESIGN.md` already ships a full, contrast-verified dark
      palette, so this is `prefers-color-scheme` plus token swaps, not a new design pass. Confirm the
      5.5/5.6 mark assets also have a dark-mode-legible variant (the mark's ink-letter layer is
      `text-primary`, which itself swaps light/dark per `DESIGN.md` — verify the swap holds at
      favicon size too, since OS chrome doesn't always respect `prefers-color-scheme` for favicons).
      **Output:** `landing-design.md` §6.
      **Done 2026-09-26, confirming the "near-free" framing rather than assuming it.** §1 introduced
      zero new colors, so every token in §2's mockup traces to an already-verified `DESIGN.md`
      light/dark pair — no new contrast math needed, including the two named AA trade-offs (white on
      orange/red fills), which carry forward unrelitigated since neither appears in this mockup. One
      real finding the roadmap didn't anticipate: the feature-tour bento grid's solid "black" tile has
      to be built from the semantic `accent-default`/`accent-default-dark` role, not a literal black,
      or it vanishes against the dark-mode page background instead of inverting to near-white — flagged
      concretely for Step 6.2. Favicon legibility re-verified two ways: live in a real Chrome tab
      against this machine's actual (Dark) system state, confirming `favicon.svg`'s embedded media
      query fires correctly outside the headless-render harness Step 5.6 used; and via dated live
      research (not recalled from training data) into current browser support, which surfaced a real,
      previously-unknown gap — **Safari does not evaluate `prefers-color-scheme` in the favicon-
      rendering path specifically** (it does apply it correctly to the same SVG used as ordinary page
      content, so nav/footer are unaffected) — accepted as a known trade-off, the same posture as
      Step 5.5's 16px shadow-smudge finding, and flagged for developer confirmation rather than fixed
      with added complexity. **Not done, on purpose:** physically toggling this machine's system
      Appearance to watch the tab icon change live — changing a system-level setting is outside what
      these tools may do here (and computer-use was also occupied by another session); handed to the
      developer as a 10-second pre-launch check instead of faked. Also corrected a stale assumption in
      Step 5.5's own "feeds into" note: Step 5.6 already solved the light/dark mark-swap problem better
      (one combined SVG with internal groups) than the "two separate files" plan §5 had recorded before
      5.6 ran — Step 6.2 is pointed at reusing that same tested file for the nav/footer marks instead.
      Named, not silently resolved: why the site uses plain `prefers-color-scheme` CSS while the app
      itself deliberately avoids that exact mechanism in favor of `[data-theme]` + a manual override —
      the app's mechanism exists to serve a Settings toggle the site has no equivalent surface for, so
      this is a considered difference, not a missed inheritance. See `landing-design.md` §6 for the
      full token-swap table, the browser-support matrix and its sources, and every finding's reasoning.
      **Phase 5 is now fully closed** — Steps 5.1 through 5.7 all done, nothing left open in this phase.

---

## Phase 6 — Build

**Goal:** implement it. All sessions run in `umbra-web`. Verify every API against Context7.

- [x] **Step 6.1 — Domain migration.** Add the subdomain in Vercel, update `astro.config.mjs`'s
      `site`, confirm canonical URLs / sitemap / `robots.txt.ts` all regenerate against it, and add
      a redirect from `umbra-web-beta.vercel.app` — it's live, indexed, and Story 5.4 records the
      link being handed out. Note that search engines treat a subdomain as a separate property from
      the parent domain; irrelevant at this scale, but you inherit nothing from it.
      **Why first in the phase:** canonical tags, OG image URLs, and structured data all bake
      absolute URLs. Doing this after them means redoing them.
      **Done 2026-09-26.** The Vercel-dashboard/DNS half — the part this roadmap's own autonomy
      table flags as physically impossible for a session to do — turned out to already be live:
      `umbra.dipane.fr` (the developer's own domain, subdomain chosen to avoid a second domain
      purchase) resolves to Vercel via a `vercel-dns` CNAME and serves the identical deployment
      (matching `etag`) as `umbra-web-beta.vercel.app`, over valid HTTPS, confirmed live with `dig`
      and `curl` this session rather than assumed. Did the code half: `astro.config.mjs`'s `site`
      now reads `https://umbra.dipane.fr`; added `vercel.json` with a host-conditioned permanent
      redirect (`umbra-web-beta.vercel.app/*` → `umbra.dipane.fr/*`), syntax verified live via
      Context7 (`/vercel/vercel`) rather than from memory, since `has`/host-matching redirects
      aren't something to guess at. Ran a full `astro build` and confirmed canonical `<link>`,
      `og:url`, `sitemap-index.xml`/`sitemap-0.xml`, and `robots.txt`'s `Sitemap:` line all
      regenerated against the new domain with no other hardcoded beta-URL references left in `src`.
      Astro's native `i18n` config and `@astrojs/sitemap`'s separate `i18n`/`hreflang` option are
      Step 6.5's job, not this one — left untouched here.

- [x] **Step 6.2 — Layout and token implementation.** Rewrite `Layout.astro`'s global CSS from the
      Phase 5.1 tokens, and wire in Step 5.6's favicon/icon assets (`<link rel="icon">`,
      `apple-touch-icon`, manifest reference) — replacing Astro's scaffold defaults, still live in
      `public/favicon.ico`/`.svg` today. Self-host Geist rather than hotlinking (`@fontsource`-style),
      and note the perf trade-off — fonts are the most common way an Astro static site stops being
      fast.
      **Done 2026-09-26, with the self-hosting mechanism corrected from this entry's own assumption.**
      Context7-verified (`/withastro/docs`) that Astro 7 ships a **stable, built-in Fonts API**
      (`fonts` config + `fontProviders.fontsource()` + `<Font>`, stable since v6.0.0, not an
      `experimental` flag) — a better fit than hand-importing `@fontsource` npm packages the way this
      entry's own wording assumed: Astro downloads and self-hosts the files itself, only for the
      weights actually used (Geist Sans 400/500/600, Geist Mono 400, Hubot Sans 700 — 5 files total,
      confirmed in the build log), and auto-generates a metric-matched local-font fallback
      (`size-adjust`/`ascent-override`) to limit layout shift, which a manual `@fontsource` import
      doesn't do for free. Package versions/licences re-verified live via `npm view` (all three at
      `5.3.0`, `OFL-1.1`) against landing-design.md §1's own record before wiring them in. **Real check
      run before trusting the default subset:** landing-copy.md §3's French copy uses "cœur," so the
      Fontsource "latin" subset's unicode-range was actually inspected (not assumed) for both faces —
      Geist Sans ships one unrestricted subset (no `latin-ext` split), and Hubot Sans's "latin" range
      explicitly includes `U+0152-0153` (œ/Œ) — confirming no `latin-ext` subset is needed for either.
      Implemented the full `DESIGN.md` light/dark color set plus landing-design.md §1's type scale
      (fluid `clamp()`), spacing extension, and radius scale as `prefers-color-scheme`-gated CSS custom
      properties — the exact mechanism landing-design.md §6 confirmed is correct for this site (no
      `[data-theme]` override layer needed, unlike the app). The `<html>` font-size guardrail holds (no
      override existed; a comment now guards against adding one). Wired Step 5.6's
      `apple-touch-icon`/manifest `<link>` tags (`favicon.svg`'s own link needed no change, as that
      step already recorded); wired the nav+footer mark from the same combined `favicon.svg` per
      landing-design.md §6's explicit recommendation, rather than the two-separate-files plan §5 had
      originally sketched. **Also mechanically updated** the three pre-rebuild placeholder pages
      (`index.astro`/`download.astro`/`faq.astro`) to reference the new token names instead of the old
      ad-hoc blue-accent scaffold variables — CSS-only, no copy/IA changes, since these pages are still
      the historical draft content Step 6.3 fully replaces. `astro build` is clean; visually sanity-
      checked all three routes in a real Chrome tab (dev mode, this machine's actual dark system
      state) — Hubot Sans hero/h1, Geist Sans body/h3, Geist Mono inline `.dmg` code, correct
      dark-mode surface/border tones, both mark placements rendering — with no console errors. **Not
      verified live, by the same posture Step 5.7 already took:** the light-mode palette wasn't
      confirmed in an actual light-mode render (would require toggling this machine's system
      Appearance); the color values were instead checked directly against `DESIGN.md`'s own hex codes
      rather than only visually assumed. Page content, i18n routing, and the hardcoded `lang="en"`
      stay untouched — Steps 6.3/6.5's jobs, not this one's.

- [x] **Step 6.3 — Pages.** Build the Phase 2 inventory with the Phase 3 copy. Astro's file-based
      routing, one file per route, shared layout.
      **Done 2026-09-26.** Built all 23 English routes from `landing-ia.md`/`landing-copy.md`: Home
      (full spine — Hero, 9-tool grid, Workflow video, Proof, Why Umbra, closing CTA), Download (OS
      tabs, live per-platform check against `/releases/latest`, the Windows unsigned-build modal,
      loading/failure/no-JS states), FAQ (8 Q&A pairs as native `<details>`, stable per-question
      anchors), About, Privacy, Legal notice, EULA, Changelog, the `/tools` hub, all 9 `/tools/*`
      pages (real screenshots from Phase 5's `public/images/tools/*`, mandatory + capability-gap
      micro-FAQs per §4b/§9), all 4 `/compare/*` pages, and `/404`. Nav/footer updated per
      `landing-copy.md` §5 (Tools/About links, full footer link set, Watch-on-GitHub, analytics
      disclosure, licence note, copyright); `download_clicked`/`windows_unsigned_modal_*`/
      `notify_me_clicked` wired via a delegated `data-analytics` handler in `Layout.astro`. **French
      is not wired in** — Step 6.5 (i18n structure) hasn't run yet, so every page ships English-only,
      per this roadmap's own step ordering; the language switcher `landing-copy.md` §5 specifies is
      deliberately not added yet either, since it would point at French routes that don't exist.
      Tool/comparison data stays hardcoded per page, matching the pre-existing `index.astro` pattern —
      Step 6.4's content-collection refactor is what unifies it with `registry.ts`, per this roadmap's
      own sequencing.
      **Two decisions made where the roadmap had explicitly left the question open:** (1) the
      `/tools` hub page carries the "wider comparison" table (Umbra vs. web tools vs. other desktop
      suites) from `landing-copy.md` §8 — `landing-ia.md` §4 left its placement open (per-page section,
      shared component, or hub page), and the tools hub was the closest existing fit; (2) the four
      comparison pages get no dedicated hub — resolved via the footer's "Compare: DevToys · DevUtils ·
      DevTools-X · CyberChef" line plus a same-page cross-link block on each comparison page linking to
      the other three, exactly the fix `landing-copy.md` §7 Part 4 recommended for the under-linking
      gap it found, without forcing the open architectural question either way.
      **Real, unplanned finding, checked live with the developer rather than assumed:** the Workflow
      section's video/poster assets (`public/videos/workflow-demo.*`) show a real Slack workspace, not
      Umbra's own UI — flagged mid-session as a possible accidental-sensitive-content issue; the
      developer confirmed it's intentional staged content (introducing the demo via a problem copied
      from Slack) and that every detail shown is fake. Kept as-is, not reworked.
      **Three real bugs found and fixed while verifying in a real browser, not just via `astro
      build`:** (1) `astro.config.mjs`'s `trailingSlash: "always"` (set at Step 6.1) 404s on every
      internal link without a trailing slash — every `href` sitewide (including the pre-existing nav,
      which had the same latent bug before this step) now carries one; (2) the `.button` class's own
      `display` declaration beat the browser's default `[hidden] { display: none }` in the cascade, so
      JS-hidden Download buttons on the Download page stayed visually visible — fixed with a global
      `[hidden] { display: none !important; }` rule; (3) `title` props were passed as the *full* SEO
      title from `landing-copy.md` §7 (already ending "— Umbra") into a `Layout.astro` that also
      appends "— Umbra" for non-Home pages, doubling the suffix on 17 of the 23 pages — fixed by
      stripping the redundant suffix from each page's `title` prop, and by adding a `rawTitle` escape
      hatch to `Layout.astro` for the two pages (Download, About) whose locked title reads "Umbra"
      mid-string rather than as a suffix. Also caught and fixed, via an automated post-build text scan
      rather than eyeballing: several inline links split across source lines (footer's "Compare" list
      and "Watch on GitHub" line, three legal-page cross-references, the three Download-page
      "not yet available" messages) silently lost their surrounding space — Astro/JSX deletes
      whitespace that touches a tag boundary across a line break rather than collapsing it to one
      space; fixed with explicit `{' '}` markers at each join point.
      **Changelog's per-release entries were hand-curated this session, not left as a stub:** read
      live via `gh api repos/dipaneb/umbra/releases`, categorized into Added/Changed/Fixed for the five
      stable releases with real release notes (`v0.1.4`–`v0.4.0`); the three earliest tags
      (`v0.1.1`–`v0.1.3`, placeholder "see the assets below" bodies) are omitted rather than padded.
      Version/date are still read live at build time (Astro's build-time `fetch`, per Step 2.5's
      hybrid model), with a static fallback baked in for an offline build.
      **Not done, deliberately out of scope for this step:** French copy and the language switcher
      (Step 6.5), the tool/comparison content-collection refactor (Step 6.4), structured data (Step
      6.6), OG/Twitter image wiring (Step 6.7), and the `⟨developer name⟩`/legal-contact placeholders
      that every prior phase already flagged as the developer's own call — all left as clearly marked
      `TODO(developer)` comments in the source rather than guessed at.
      **Correction, same day:** the first pass above was written from `landing-ia.md`/`landing-copy.md`
      alone — it never consulted `landing-design.md` §2's actual Step 5.2 layout mockup (the
      [Home Layout canvas](https://claude.ai/artifact/7jvUELBG9GkfQ6kvRE4tn1)), even though that section
      explicitly names Step 6.3 as its consumer and marks its decisions "confirmed"/"resolved," not
      exploratory. Caught when the developer asked why the build didn't match it. Rebuilt Home's
      layout/interaction layer to match: the hero now carries the Workflow demo video directly under
      the CTA (§3's 2026-09-26 correction — one produced asset, shown in both the hero tease and the
      Workflow section proper); the "9 tools" section is the confirmed asymmetric bento grid (tight
      12px gaps, a black/white role-swapping typographic tile built from `accent-default`/
      `accent-default-on` rather than literal color so it inverts correctly in dark mode, one orange
      Hash tile, oversized ghost-glyph backgrounds) with a real live-filtering search bar (dims/
      grayscales non-matches, outlines matches in the signature accent, matched against
      `data-tool-name` aliases including the mockup's own French terms); the nav's Download button now
      fades out while `#hero` is in view via `IntersectionObserver` and reappears on scroll, matching
      all three artboards; a real mobile hamburger (checkbox-driven, no JS required) replaced the
      no-op nav that shipped first; tablet reflows the same bento to 3 columns with Hash losing its
      "tall" span (still orange, still ghost-glyphed) per the mockup's own carried-forward call; mobile
      swaps to the confirmed horizontal-scroll-with-search strip instead of the bento; Workflow and
      Why-Umbra got the alternating `bg-surface` band treatment; and Proof's self-check terminal block
      is now removed entirely below 768px (a phone can't run `nettop` or install the binary it checks),
      matching the mockup's mobile-only cut. Verified in a real Chrome tab at all three breakpoints
      (desktop 1440px, tablet 820px, mobile 390px, via separate tabs after `resize_window` — resizing
      an already-open tab didn't reliably change its reported viewport in this environment, a tooling
      quirk worth remembering, not a CSS bug). Two more real bugs caught in the process: tile names
      inherited the global link color (orange) since each bento tile is an `<a>` — fixed with an
      explicit `.tile-name { color: var(--text-primary) }` override, `inherit`ed back only on the
      accent/default-role tiles; and the mobile horizontal-scroll strip intercepting vertical scroll
      wheel events at its exact coordinates (a real scroll-container-focus quirk, not a bug — scrolling
      from a point outside the strip works fine). Tablet/mobile-specific visual polish beyond what the
      mockup specifies (exact icon set once Phosphor is wired at Step 6.4, mobile-strip search wiring
      — built anyway here since it was a trivial extension of the same filter, not decided against) is
      still open for a future pass.

- [x] **Step 6.4 — Content model.** Implement 2.5's decision so the tool list has one source.
      **Done 2026-09-27.** Implemented `landing-ia.md` §5 exactly as scoped: `src/content.config.ts`
      defines three build-time collections via Astro 7's `glob()` loader (confirmed live via Context7
      that `z` comes from `astro/zod`, not `astro:content`, and that `.json` entries need an explicit
      `generateId` to strip the extension — matching the docs' own `authors` example). `tools`
      (`src/content/tools/*.json`, one file per tool) replaces the 9 near-duplicate `/tools/*.astro`
      pages with a single `[id].astro` + `getStaticPaths()`, and is now the one place `index.astro`'s
      bento grid, its mobile-strip, and `/tools`'s hub cards all read name/description/search-terms
      text from — closing the exact class of bug Step 2.5 flagged (a hardcoded `index.astro` array
      independently drifting from a tool page's own copy). `aiClaim` ships as a schema field (`true`
      only on `ocr`) per the guard-rail Step 2.5 named, though nothing renders off it yet — no UI
      currently needs to. `comparisons` (`src/content/comparisons/*.json`) replaces the 4 static
      `/compare/*.astro` pages the same way, with `dateChecked` **mandatory** in the Zod schema —
      verified live by deliberately deleting the field from `devtoys.json` and re-running the build,
      which failed with `dateChecked: Required` before the field was restored, confirming the guard
      rail is real and not just documented. `changelog` (`src/content/changelog/*.json`) holds the
      hand-curated Added/Changed/Fixed bullets; the live GitHub Releases fetch stayed a plain
      build-time `fetch()` in `changelog.astro` itself rather than a formal custom loader module —
      a deliberate, documented downscope, since only this one page ever consumes that data and a
      loader's caching/store machinery would add real complexity for zero behavioral gain here.
      **Real gap closed that the original page didn't have:** a live release newer than the newest
      curated entry now renders a "release notes coming soon" placeholder instead of being silently
      dropped — verified live against the real GitHub API, which at build time had exactly one such
      case (`v0.5.0-alpha.1`), correctly excluded by the existing prerelease filter rather than
      triggering the placeholder. FAQ stayed a plain data file (`src/data/faq.ts`), per §5's explicit
      "does not need a collection" call — only the array moved, its two special-cased cross-link
      entries untouched. Privacy/Legal/EULA/About: confirmed untouched, per §5's explicit scope
      boundary. **One deliberate deviation from the roadmap's literal wording, reasoned through
      rather than silently substituted:** §5 says "Markdown file... frontmatter... Markdown body
      holding the page's actual prose," but several tool/comparison FAQ answers and competitor cells
      contain embedded HTML anchors and literal double quotes (e.g. PDF's OCR cross-link, DevUtils'
      quoted privacy claim) that are fragile to hand-author correctly as YAML frontmatter. Used
      `.json` files instead — same one-file-per-entry shape, same `glob()` loader, same Zod
      validation and single-source guarantee the roadmap's reasoning was actually after — with no
      YAML-escaping risk, and no long-form prose body was needed since `directAnswer`/`body` are
      each one sentence, not multi-paragraph articles. Copy itself was not touched or restructured —
      every string was moved verbatim from its original `.astro` file, including each comparison
      page's own already-embedded "checked 2026-09-19" prose mention (left as authored, not
      interpolated from `dateChecked`, since restructuring locked copy wasn't this step's call to
      make). Verified live in a real Chrome tab (home bento incl. the ⌘K live-filter search, tools
      hub, a tool page's FAQ cross-link, a comparison page, changelog) after restarting the dev
      server, which was required once for it to pick up the new `content.config.ts` — a first-run-only
      quirk, not a bug. **Not done, flagged but not built here, cross-repo:** §5's recommended
      one-line addition to `Umbra`'s own `registry.ts` comment, naming this collection as a second
      place a new tool must be added — the developer's call, since it edits `Umbra`'s repo directly.

- [x] **Step 6.5 — i18n structure and French content.** 🔸 **Revised 2026-09-19 during Step 3.2 —
      this entry originally read "structure only, zero French copy gets written in this roadmap."**
      That's now wrong: the developer decided at Step 3.2 that French ships alongside English at
      launch, not deferred (see the corrected "Language" row in the decisions table above). Everything
      below about the Astro config is unchanged and was already written to support this outcome; what
      changes is that `fr` is no longer an inert, unused locale entry — every page Phase 3 writes from
      here needs a French pass, not just English. Configure Astro's native `i18n` config
      (`astro.config.mjs`): `locales: ["en", "fr"]`, `defaultLocale: "en"`, and pick a routing strategy
      now rather than let it default — the real decision is `routing.prefixDefaultLocale`: `false` keeps
      English at `/` with no `/en/` prefix (French would live at `/fr/`) and is the more common choice
      for a site with one dominant language; `true` prefixes everything (`/en/`, `/fr/`) and reads as
      more neutral between locales but changes every current URL. Given 6.1 is already moving the
      domain, `false` avoids stacking a second URL change on top of that one. Also set
      `@astrojs/sitemap`'s own `i18n` option (it's a separate config block from Astro's `i18n`, easy to
      configure one and miss the other) — once set, it generates `hreflang` alternate-link entries per
      page automatically, which is the mechanism search engines use to serve the right locale — now load-
      bearing from day one rather than structurally-correct-but-inert. **Why now and not later:**
      retrofitting routing after launch changes every URL, which is exactly the SEO cost you avoided by
      fixing the domain first — doing both URL shifts in the same pre-launch pass instead of two separate
      ones later. **New consequence of the revision:** Phase 4's legal pages (privacy policy, mentions
      légales) were always going to be French-law-driven in substance (CNIL/GDPR, Step 4.1/4.2) — worth
      a fresh look at whether they should be *authored* in French now too, rather than English copy about
      French law. Not decided here; flagged for whoever runs Phase 4.
      **Tool:** Context7-verified against Astro's current `i18n` reference and `@astrojs/sitemap`'s
      `i18n` option before implementing — both are real, current APIs as of this roadmap's writing,
      but re-check given Astro's fast release cadence (`umbra-web` is on Astro 7.x).
      **Done 2026-09-27.** Configured exactly as this entry specified, Context7-verified live against
      `/withastro/docs` rather than assumed: `astro.config.mjs`'s `i18n` block
      (`locales: ["en", "fr"]`, `defaultLocale: "en"`, `routing.prefixDefaultLocale: false`) and
      `@astrojs/sitemap`'s separate `i18n` option (`{ defaultLocale: "en", locales: { en: "en-US",
      fr: "fr-FR" } }`), applying `landing-copy.md` §7 Part 6's own `fr-FR`-not-`fr-CA` correction.
      With `prefixDefaultLocale: false`, Astro's own docs confirm English page files stay unprefixed at
      `src/pages/*.astro` and French ones live in `src/pages/fr/*.astro` — built 23 French routes this
      way, one per existing English page, for **46 total static pages** (verified via `astro build`,
      which reports exactly 46). Every page's `<head>` now carries a self-referencing `<link
      rel="canonical">` (never cross-language, per `landing-copy.md` §7 Part 6's explicit warning) plus
      `hreflang="en"`/`"fr"`/`"x-default"` alternates, computed generically from the `/fr` prefix rather
      than a per-page lookup table — confirmed in the built HTML and in `@astrojs/sitemap`'s generated
      `xhtml:link` entries.
      **Content model extended to carry French, not left flat:** `src/content/tools/` and
      `src/content/comparisons/` are now locale-scoped subfolders (`en/`, `fr/`) — the existing 9 tool
      and 4 comparison JSON files were moved (`git mv`, history preserved) into `en/`, and a full French
      counterpart was written for each of the 13, keeping the same schema (`content.config.ts`'s `glob`
      pattern changed from `*.json` to `**/*.json`, entry ids now `en/json`/`fr/json` etc.) — the mandatory
      `dateChecked` field Step 6.4 already enforces held for the new French comparison files too, no
      schema relaxation. Every French tool/comparison string traces to the same session's own already-
      drafted copy (`landing-copy.md` §4b/§9's bilingual tool and comparison pages, §7 Part 1's title/
      description table) rather than being freshly translated ad hoc — this step assembled and wired
      already-approved copy, it didn't re-author it. **One naming decision applied consistently:** OCR's
      tool name is "Image en texte" in French (already used throughout `landing-copy.md`'s FR drafts,
      nav, and FAQ), every other tool name stays untranslated (JSON, Base64, UUID, Hash, JWT, Cron, PDF,
      Images) — proper nouns/format names, not translated per the site's own established convention.
      **UI chrome centralized, not duplicated per page:** `src/i18n/ui.ts` (a `ui`/`languages` dictionary,
      Astro's own documented i18n-recipe shape) and `src/i18n/utils.ts` (`getLangFromUrl`,
      `useTranslations`, and a `localizePath`/`delocalizePath` pair simpler than Astro's own recipe's
      route-translation table, since no Umbra route is slug-translated — every page exists at the same
      path in both locales, only the `/fr` prefix differs) hold nav/footer/shared-CTA strings; each
      page's own long-form copy (home, download, faq, about, privacy, legal, eula, changelog, tools hub)
      lives inline in a new shared component (`src/components/{Home,Download,Faq,About,Privacy,Legal,
      Eula,Changelog,ToolsHub,NotFound}.astro`) keyed by a `lang` prop, with thin `src/pages/*.astro` /
      `src/pages/fr/*.astro` route files instantiating each with `lang="en"` / `lang="fr"` — the existing
      English pages were refactored into this shape rather than left as one-off files with a parallel
      French copy hand-maintained separately, so the two locales can't drift out of structural sync.
      `ToolPage.astro`/`ComparePage.astro` (Step 6.4's shared tool/comparison templates) and
      `tools/[id].astro`/`compare/[id].astro` (their `getStaticPaths()`) took a `lang` prop/locale filter
      the same way.
      **Language switcher built to `landing-copy.md` §5's exact spec, correctness-verified, not just
      styled:** nav (far right, after Download) and footer, labelled with the destination language in
      that language ("Français" on English pages, "English" on French ones, never a bare "EN"/"FR"), and
      confirmed in the built output that it preserves the exact current page — `/tools/json/` ↔
      `/fr/tools/json/`, not a bounce to home — the one correctness requirement that step's own copy
      flagged as more than a wording decision.
      **Every already-drafted bilingual page assembled and verified in the built HTML, not just wired in
      principle:** Home (hero headline direction genuinely differs by language per Step 3.2, not a
      translation mismatch; the bento grid's `data-tool-name` search terms read from each locale's own
      collection so the live filter matches French synonyms too), Download (including the injected
      client-side strings — loading/failure text, the `Version {v} · Publiée le {d}` template — via
      Astro's `define:vars`, not hardcoded English left in the script), FAQ (all 8 pairs including the
      Step 3.7-added #8, same `id` slugs in both locales since anchors aren't user-visible copy), About,
      Changelog (frame translated — heading, lede, Added/Changed/Fixed category labels, the GitHub link;
      the curated per-release bullets themselves stay English-sourced from GitHub, per this file's own
      "framing only" scope for this page), Tools hub (including the `README.md`/Step 3.7-drafted
      Umbra-vs-web-tools-vs-desktop-suites comparison table, both languages), and the three Phase-4 legal
      pages — `landing-legal.md` §1/§2's own "Feeds into Step 6.5" notes say their FR drafts are "the
      actual French copy for this route, not a placeholder needing later translation," used verbatim.
      **Video assets were already staged per locale before this step ran** (`public/videos/
      workflow-demo.fr.{mp4,webm,poster.jpg}`, alongside the `.en.` set) — Step 5.3's own captioning
      note ("captioned per-locale (EN/FR)") turned out to already include full French-narrated/captioned
      encodes, not just captions layered on the English video; this step only had to wire the French
      page to the existing `fr` asset trio, not request new ones. Tool screenshots have no locale variant
      (same English-UI captures reused on both locales' tool pages) — an accepted, pre-existing condition
      from Step 5.3, not a gap this step introduced or was asked to close.
      **Verified, not assumed:** `astro build` completes clean at exactly 46 pages (23 × 2 locales);
      spot-checked rendered HTML for canonical/hreflang correctness on the home pair, nav/footer copy and
      hrefs, the language switcher's path-preservation on a deep route, page `<title>` tags against §7
      Part 1's table (home, download, about, 404, tools hub — all match exactly, including the
      Home/other-page `Umbra — {value}` vs. `{value} — Umbra` convention), the FAQ's full 8-question list
      in French, and the tools hub's wider-comparison table headers/rows in French.
      **Not done, deliberately, and not this step's job:** structured data (Step 6.6), OG/Twitter meta
      wiring (Step 6.7), the analytics rework (Step 6.8) — footer's analytics-disclosure sentence is
      translated as already-approved copy, not re-derived; `llms.txt`/AI-crawler `robots.txt` policy
      (Steps 6.13/6.14); and the Privacy/Legal/EULA "Contact" placeholder, still open exactly as Phase 4
      left it (French mirrors the same placeholder, not a guessed value, per `CLAUDE.md`'s privacy rule).
      **One trade-off flagged, not engineered around:** `vercel.json` still only handles the beta-domain
      redirect from Step 6.1 — a French page has its own build-time `src/pages/fr/404.astro` for direct
      navigation, but Vercel's static-hosting default will still serve the *root* `404.html` for any
      genuinely unmatched path (there's no per-locale 404 rewrite rule); low-risk and common practice for
      a site this size, but worth a developer decision later rather than silently engineered around here.
      **Follow-up, same repo, a later session (2026-09-27):** the developer asked how the site picks a
      language for a new visitor — the honest answer was "English by default, no automatic detection,"
      since `Astro.preferredLocale`/`preferredLocaleList` (the native mechanism, Context7-verified against
      `/withastro/docs`) only work on pages rendered on demand, and this site is fully static (no adapter).
      Added, at the developer's request, a client-side root redirect: an inline script (as early as
      possible in `<head>`, only rendered on the bare English home page) checks `navigator.languages[0]`
      and redirects once to `/fr/` via `location.replace` if it's French — but only for a visitor who has
      never used the language switcher; clicking the switcher (either direction) sets a `localStorage` flag
      that permanently suppresses the auto-check, so an explicit choice is never overridden. **Explicitly
      decided one-directional, not symmetric:** asked the developer whether an English-browser visitor
      landing on `/fr/` should be bounced back to `/` the same way — declined, keeping `/fr/` a page that's
      never auto-redirected away from, since reaching it (a shared link, a French search result, the
      switcher) already carries some signal of intent that `/`, the site's one ambiguous default entry
      point, doesn't have. Both changes live in `Layout.astro` and are already committed/pushed
      (`9ae37e9`).

- [x] **Step 6.6 — Structured data (JSON-LD).** `SoftwareApplication` for the app, `FAQPage` for the
      FAQ. Highest effort-to-payoff ratio in the whole SEO block — Google renders FAQ markup as
      expandable results. Deferred by Story 5.4's review; closing it here.
      **Done 2026-09-27, with a correction to this entry's own premise, checked live before writing
      any markup (Rule 8 applied to this step's own claim, not just to GEO research).** Google removed
      `FAQPage` rich results for all non-government/health sites in 2023 and pulled the feature's docs
      entirely in June 2025 — no expandable FAQ snippet is available in Google Search today, regardless
      of markup quality. `SoftwareApplication` rich results also require `aggregateRating` or `review`,
      which this site correctly won't fabricate (Step 3.5's "no fabricated stat, star, or testimonial"
      finding governs here too). **Shipped both schemas anyway** — valid, free, and the same
      machine-readable facts Step 1.6/3.7's GEO work already wants surfaced to LLMs and non-Google
      crawlers — but recorded as a GEO/semantic-extraction play, not the Google-SERP-visual this entry's
      original wording promised. `FAQPage` covers `/faq` (all 8 pairs, built from the exact same
      `answerHtml` the page renders, not re-derived) and each of the 9 `/tools/*` pages' own micro-FAQ.
      `SoftwareApplication` sits on Home: no hardcoded version (ledger row 10 — `downloadUrl` points at
      the same never-versioned `/releases/latest` GitHub URL the Download page's own buttons use), no
      fabricated rating, no `author` (Step 4.2's anonymity decision). See `landing-copy.md` §10 for the
      full reasoning and every field's sourcing.

- [x] **Step 6.7 — OG and Twitter Card meta.** Wire 5.4's image. Also deferred by Story 5.4.
      **Done 2026-09-27.** Wired into `Layout.astro` so every page in both locales inherits it from
      one place: `og:image`/`og:image:width`/`og:image:height`/`og:image:alt` plus
      `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`, `twitter:image`,
      `twitter:image:alt`. The image URL and alt text are exactly `landing-design.md` §4's already-
      produced asset and already-written alt string — no new copy or design decision needed, and no
      per-page/per-locale variant, matching that section's own "one universal card" call. `og-image.png`
      was already committed (Phase 5's imagery commit), so this step is markup-only. `twitter:site`/
      `twitter:creator` deliberately omitted — no X/Twitter handle exists for this anonymous,
      no-name-anywhere site (Step 4.2's decision), and inventing one would be a fabricated identity, not
      a missing-value oversight. Verified by building and grepping the rendered `dist/**/index.html`
      output on Home (EN/FR), a tool page, and Download — all resolve `og-image.png` to the absolute
      production URL and HTML-escape the alt text's embedded quotes correctly.
      **Flagged, not acted on:** `landing-design.md` §4 itself notes the card should be revisited once
      the domain went live (Step 6.1, since done) to consider adding a URL to the composition, and again
      once Step 5.5/5.6's real logo mark is wired in place of the placeholder wordmark text — both are
      image-redesign decisions belonging to Phase 5, not this step's markup-wiring job.

- [x] **Step 6.8 — Analytics rework.** Three things: switch PostHog to cookieless — decide between
      `persistence: 'memory'` (cleanest, no terminal-equipment storage at all, but identity resets
      every page load) and `sessionStorage` (survives navigation within a visit, still no cookie,
      but still counts as storage on the user's device for ePrivacy purposes); implement Step 1.4's
      download-click events; and **audit the PostHog project dashboard**, because Story 5.4's own
      review flagged that `autocapture: false` in code doesn't govern dashboard-level features (web
      vitals, exception capture, rageclick detection) — so the footer's "page-view analytics only"
      claim isn't verified the way the app's privacy claim is. Ten minutes, closes a known gap
      between a published claim and reality. Update the footer disclosure to match whatever's true.
      **Done 2026-09-27, with a real bug found and fixed, not just the planned three tasks.**
      Discovered, live via Context7 (not from memory): with no explicit `persistence`/
      `cookieless_mode` config, posthog-js's own default is `persistence: 'localStorage+cookie'` —
      meaning the site was silently setting a real persistent cookie this whole time, directly
      contradicting Privacy.astro's "No cookies" claim and the roadmap's own locked "cookieless"
      decision. This step's own framing (`memory` vs `sessionStorage`) undersold a third,
      purpose-built option Context7 surfaced: `cookieless_mode: "always"`, which sets no
      cookie/storage at all and computes identity as a server-side hash instead. **Developer decided
      (2026-09-27):** `cookieless_mode: "always"` over either `persistence` option — the strictest
      available, paired with `person_profiles: 'never'` per PostHog's own guidance (`identify()`/
      `alias()` are unused anywhere on this site regardless). Wired into `Layout.astro`.
      **Second real finding:** `cookieless_mode` requires a matching project-level toggle
      ("Cookieless server hash mode" under Settings → Web analytics) or PostHog silently discards
      every event — confirmed off via the newly-connected PostHog MCP (`@posthog/wizard mcp add`,
      registered this session after the interactive wizard failed in a non-TTY shell and the
      developer completed it in a real terminal). Developer enabled it directly in the dashboard
      (confirmed via `project-get`: `cookieless_server_hash_mode: 2`, "Stateful" — the dashboard's
      own toggle offers no Stateless/Stateful choice, docs don't explain the split, so this was
      accepted as PostHog's own default rather than guessed at). Step 1.4's download-click event
      plan (`download_clicked` with `platform`, `windows_unsigned_modal_shown`/`_proceeded`,
      `notify_me_clicked`) turned out to be **already fully implemented** in `Download.astro`,
      `Home.astro`, `ToolPage.astro`, `ComparePage.astro`, and `Layout.astro`'s delegated
      `data-analytics` click handler — nothing new to build there.
      **Dashboard audit (via MCP, `project-get`):** `anonymize_ips: true` and `capture_dead_clicks:
      false` (rageclick — off), both confirmed good; `autocapture_exceptions_opt_in: null` — not
      enabled. Two real gaps matching Story 5.4's own flagged concern: `autocapture_web_vitals_opt_in:
      true` and `heatmaps_opt_in: true` are both on at the project level, real data collection
      `autocapture: false` in code never governed. **Developer decided (2026-09-27):** keep both
      rather than disable them, and disclose them instead. `Privacy.astro`'s "Data collected" list
      gained two new bullets (Core Web Vitals, aggregate click/scroll heatmap data) and its
      "not collected" bullet was corrected (dropped the now-false "no autocapture of clicks" clause,
      kept "no full-session recordings/replay," since heatmap capture is real but isn't a session
      replay). The footer disclosure (`footer.analytics`) was deliberately **not** itemized the same
      way — developer pushback that the drafted itemized version was "way too technical jargon" for
      a footer — and instead simplified to a one-line claim plus a link to the Privacy page for the
      detail, in both languages. Also resolved, as a side effect of the audit: Privacy.astro's
      Step-4.1-flagged "unconfirmed... whether this site's PostHog project stores the IP address"
      line is now a confirmed statement (`anonymize_ips: true`, plus the dashboard's own tooltip
      confirming cookieless mode hashes the IP into the distinct ID and strips it before any further
      processing) — narrower than Step 4.1's own framing, since that step only asked whether IP is
      stored, not how cookieless mode changes the answer.
      **Not done, deliberately flagged rather than silently skipped:** `landing-strategy.md` §5's
      ledger row 13 (the analytics disclosure) still needs updating to match the new footer/Privacy
      wording, from a future `Umbra`-repo session per this roadmap's own repo-split rule — not done
      here since this was a `umbra-web` build session. `session_recording_opt_in: true` and
      `capture_console_log_opt_in: true` are both nominally on at the project level; real behavior
      matches the "no session recording" claim because `disable_session_recording: true` in the SDK
      init overrides them, but left on as a minor hygiene item, not acted on unilaterally.

- [ ] **Step 6.9 — Accessibility pass.** WCAG 2.1 AA, matching `EXPERIENCE.md`'s floor. The palette
      is already contrast-verified, so this is mostly structure, focus order, and labels.
      **Tool:** axe DevTools or `@axe-core/cli`, plus a real VoiceOver pass — the app's own standard.

- [ ] **Step 6.10 — Performance budget.** Set it *before* the images land, not as an audit after.
      Astro static makes this nearly free; fonts and screenshots are how it stops being free.
      **Tool:** Lighthouse.

- [ ] **Step 6.11 — Build gates.** A link checker (`lychee`) and a build check in CI, so a broken
      link fails the build. Story 5.4 explicitly deferred this as "no testing convention exists yet";
      adding it also matches `Umbra`'s own NFR6 posture, which is a defensible-practice signal for
      the secondary audience.

- [ ] **Step 6.12 — Optional: security headers / CSP.** Cheap on Vercel, low practical risk on a
      static brochure site. Genuinely optional; it reads as "this developer knows what a CSP is."

- [ ] **Step 6.13 — `llms.txt` and `llms-full.txt`.** A markdown index at `/llms.txt` giving an AI
      agent a curated map of the site, plus a full-content variant. **Do this for the coding-agent
      reason, not the citation reason** — the evidence as of August 2026 separates the two sharply.
      IDE agents (Cursor, Claude Code, Copilot, Cline, Aider) fetch these routinely when pointed at a
      site, which is a real developer-experience win. But no major LLM provider has committed to
      reading `llms.txt` in production; one study of ~500M AI-bot visits found only 408 fetched it,
      and SE Ranking's citation model got *more* accurate when the variable was removed. Ship it as
      agent documentation, expect nothing from it for AI search, and don't let anyone sell you the
      opposite. **Why here:** trivial to generate from Step 2.5's content model, so it costs almost
      nothing once that exists. **Tool:** generate from the content model at build time rather than
      hand-maintaining a file that will drift. Re-verify the spec's status before implementing.

- [ ] **Step 6.14 — AI-crawler policy in `robots.txt`.** 🔸 `src/pages/robots.txt.ts` currently emits
      a bare `User-agent: * / Allow: /`, which already permits everything — so this step changes
      posture from *default* to *deliberate*, not from closed to open. **Note that the standard 2026
      advice does not apply to you.** The common recommendation — block training crawlers (GPTBot,
      ClaudeBot, Google-Extended, CCBot), allow retrieval crawlers (OAI-SearchBot, Claude-SearchBot,
      PerplexityBot, ChatGPT-User) — is written for publishers protecting monetizable content. You
      have none, and presence in the training substrate is precisely how "recommend a privacy-first
      developer toolbox" comes back with Umbra. **Allow both categories, explicitly and by name**,
      with a comment recording that it's a decision rather than an oversight. One nuance worth
      internalising: allowing AI crawlers on the *marketing site* says nothing about the app, and the
      site's privacy copy should not blur the two — INV-1/INV-2 govern the app, this governs a public
      brochure. **Tool:** edit `robots.txt.ts`; re-verify the current user-agent list before writing
      it, since the roster changes often.

---

## Phase 7 — Measurement & verification

- [ ] **Step 7.1 — Verify analytics end-to-end.** Confirm a pageview *and* a download-click event
      both register in PostHog from the live site. Story 5.4 proved pageviews this way; the click
      event is new and unproven. `curl` can't do this — it needs a real browser.

- [ ] **Step 7.2 — GitHub download counts.** 🔸 The GitHub Releases API exposes per-asset download
      counts. PostHog can never see this — the download is a click to another domain followed by a
      file fetch — so this is the *actual* "did anyone use it" number behind the PRD's "Used"
      metric. Check it manually or with a small script, or — better — bridge it into PostHog itself
      via a small scheduled job using PostHog's server-side capture API, so the number renders
      alongside `$pageview`/`download_clicked` in one dashboard instead of living apart in a script's
      output; PostHog accepts events from outside the browser SDK for exactly this kind of case.
      **Two things worth watching for when this gets built** (re-verify the specifics at execution
      time — the exact APIs involved may well have moved on by then): GitHub's download count is a
      running total, not a delta, so summing it naively into a trend will overcount; and the app's own
      background update-check quietly inflates whichever release asset it touches, which isn't a
      human download and shouldn't be counted as one.

- [ ] **Step 7.3 — Search Console + Bing Webmaster.** Free, and the only way to see whether indexing
      broke after the domain move. Submit the sitemap. **Why after 6.1:** it's per-property, so
      registering before the domain change wastes the setup.

- [ ] **Step 7.4 — Review cadence.** Decide when you'll actually look at the numbers and what you'd
      change based on them. Analytics you never read is worse than none — it's the illusion of
      measurement.

- [ ] **Step 7.5 — AI visibility baseline and referral tracking.** Two halves. *Measured:* AI
      assistants pass a referrer, so filter PostHog for traffic from `chatgpt.com`, `perplexity.ai`,
      `claude.ai`, `gemini.google.com` and friends — this works fine under the cookieless choice,
      since referrer is captured on the pageview itself. *Manual:* re-ask Step 1.6's target questions
      across ChatGPT, Claude, Perplexity, and Google AI Overviews on a set cadence, and record
      whether Umbra is named and what's said about it. Crude, but it's the only direct read on the
      thing you actually care about, and the engines diverge enough that checking one tells you
      little about the others. **Why here:** you need the Step 1.6 pre-launch baseline to compare
      against, or the numbers mean nothing. **Also watch for the failure mode that matters most:**
      an assistant describing Umbra *wrongly* — overstating the privacy claim, calling it open
      source, or inventing a Windows build. That's a correctness problem on your central claim, and
      the fix is on-page clarity (3.7) plus the sources in 9.2/9.4, not a takedown request.

---

## Phase 8 — Pre-launch QA

- [ ] **Step 8.1 — Run one checklist.** Every link resolves (including the GitHub Releases redirect,
      which Story 5.4 verified once and nobody has re-checked); every page has a distinct title and
      description; the download link resolves to a current non-prerelease build; mobile renders;
      contrast passes; analytics fires; the OG card previews correctly (test with a real paste into
      Slack or LinkedIn, not just a validator); the old Vercel URL redirects; every claim traces to
      the ledger. **Tool:** written checklist, executed and recorded — the same pattern Story 5.3
      established for the release network trace, which worked well for this project.
      **Output:** `landing-launch-checklist.md` §1, executed.

- [ ] **Step 8.2 — Code review.** **Tool:** `/code-review`, or `bmad-code-review` from `Umbra` for
      continuity with how Story 5.4's review was run.

---

## Phase 9 — Launch & distribution

**Goal:** the part indie developers most reliably skip. A landing page with no distribution plan
gets exactly the traffic you personally send it.

- [ ] **Step 9.1 — Cross-link GitHub and the site.** Set the repo's homepage field, add a website
      link to `Umbra`'s README (Story 5.4 left this as an open judgment call), and link releases back
      to the changelog page. Free traffic between your two public surfaces, in both directions.

- [ ] **Step 9.2 — Distribution plan.** Where you post, in what order, with what framing: Hacker
      News (Show HN), relevant subreddits, alternativeto.net, privacy-tool directories, "awesome
      macOS/devtools" lists, Product Hunt if you want it. Sequence matters — a weak first post burns
      the strongest venue. **Why after everything else:** you only get one first impression per
      venue, and it should land on the finished site.
      **Output:** `landing-launch-checklist.md` §2.

- [ ] **Step 9.3 — UTM conventions.** Tag the links you post so you can tell Hacker News from GitHub.
      Only worth doing because 9.2 exists. Note the cookieless constraint again: UTMs are captured
      on the landing pageview, so keep the tagged link pointing at a page that carries a CTA.

- [ ] **Step 9.4 — The GitHub repo as the primary agent surface.** 🔸 **Cross-repo — this one touches
      `Umbra`, not `umbra-web`.** An assistant asked to recommend a tool, or an agent asked to
      evaluate one, reaches a GitHub repo far more often than a marketing site — and LLMs lean
      heavily on GitHub, Hacker News, Reddit, and alternativeto for tool questions. So the repo's
      README is doing more GEO work than any on-site tweak in Phase 6, and it should carry the same
      Step 1.6 answers in the same plain, extractable form: what it is, what it runs on, the exact
      privacy claim, the exact licence position, how to install. Also set the repo's topics and
      description, since those are what directory sites and scrapers read.
      **Why this is the real leverage:** Steps 6.13/6.14 are hygiene; this and 9.2 are the ones that
      plausibly move whether an assistant names Umbra. **Guard rail:** the README is a fourth public
      surface making the privacy claim — it goes through Step 1.5's ledger like everything else.

---

## Phase 10 — Steady state

- [ ] **Step 10.1 — Maintenance triggers.** Write down what obliges a site update: a new tool (Epic
      8), a Windows or Linux build (NFR3), a version bump, a change to the privacy claim, and the
      French locale — Step 6.5 ships the routing empty, so name what actually triggers filling it
      in (the PRD's own March 2027 internship-application timeline is the obvious candidate) rather
      than leaving "later" undated. Without this the site quietly becomes wrong, and "wrong" here
      means the privacy claim. **Output:** `landing-launch-checklist.md` §3.

- [ ] **Step 10.2 — Changelog / releases page upkeep.** Renders GitHub releases. Directly feeds the
      PRD's thesis that sustained activity is read as strongly as the code itself — which is what
      the Sept→March P3 cadence is *for*.

- [ ] **Step 10.3 — Post-Epic-7 imagery swap.** If Step 5.3 chose mockups, this is the step that
      replaces them with real captures. Written down so it doesn't become permanent by neglect.

- [ ] **Step 10.4 — Keyword research.** 📚 Deliberately last. Honest read: organic search for
      "developer tools" is dominated by enormous sites and will not send you meaningful traffic
      within a year. It's here because PRD FR33 names SEO as a learning unit and because knowing
      its limits is part of learning it — not because it will move your numbers.
      **Output:** `landing-strategy.md` §6.

---

## Deliberately excluded

Recorded so future sessions read these as decided, not overlooked.

| Excluded | Why |
|---|---|
| Pricing / payments / donations | Developer's call — free product this round. Vercel already preserves the option architecturally; nothing to do to keep it open. |
| European Accessibility Act analysis | Falls away with payments. The substance — WCAG 2.1 AA — is done anyway in Step 6.9. |
| Email capture / newsletter | Developer's call. "Notify me" intent routes to GitHub Watch/Releases as a line of copy. Keeps the privacy policy short. |
| Lifecycle / drip email | Follows from the above. |
| Paid acquisition | Free product, no revenue, no budget. |
| A/B testing | At this traffic volume the results would be statistically meaningless for years. |
| Session recording / heatmaps | **Actively rejected, not just skipped.** The site's own footer publicly promises "page-view analytics only, session recording disabled." Enabling this would make a published claim false. |
| Site error monitoring (Sentry etc.) | Static site, almost no JS; also awkward against the privacy posture. |
| Bilingual launch | English ships; Step 6.5 leaves the door open structurally. |
| Consent banner | Superseded by the cookieless decision, which resolves the concern at the source rather than papering over it. |
| Paid GEO tooling, AI-visibility trackers, GEO agencies | The category is barely two years old, its evidence base is largely vendor-published, and the free manual check in Step 7.5 gives you the same signal at your scale. Revisit only if 7.5 shows AI referrals becoming a real traffic source. |
| Blocking AI training crawlers | Deliberately rejected in Step 6.14 — the standard advice is aimed at publishers protecting monetizable content, which does not describe Umbra. |

---

## Quick-reference checklist

- [x] 1.1 Positioning & audience brief · [x] 1.2 Reference scan · [x] 1.3 Objection map · [x] 1.4
      Success definition & event plan · [x] 1.5 **Claim ledger** · [x] 1.6 AI-answer target list
- [x] 2.1 Page inventory · [x] 2.2 **Recruiter page shape** · [x] 2.3 Home narrative spine · [x] 2.4
      Other page outlines · [x] 2.5 Content model
- [x] 3.1 Web voice spec · [x] 3.2 Home copy · [x] 3.3 **Proof copy** *(accepted with reservations)* ·
      [x] 3.4 Remaining copy *(Download/FAQ/About/Changelog/Tools hub)* · [x] **3.4b Tool & comparison
      page copy** *(new 2026-09-19 — 9 tool pages + 4 dated comparison pages)* · [x] 3.5 Microcopy &
      social-proof honesty *(3 real gaps closed: Notify-me placement, language switcher, Proof's
      unlinked repo reference)* · [x] **3.6 Ledger gate** *(3 overclaims fixed live; 2 findings carried
      to 8.1/3.7 as action items)* · [x] **3.6b SEO pass** *(all 23 routes titled/described; 2
      crawlability risks flagged for 6.3; 1 internal-linking gap offered for sign-off)* · [x] **3.7
      GEO/extractability pass** *(Proof section's exception now same-breath as its claim; FAQ #8 closes
      the verification-question gap; new Umbra-vs-web-tools-vs-desktop-suites table drafted, placement
      open; one real GEO/structural-rebuttal conflict named and left as-is)* · [x] **3.8
      Capability-differentiation pass** *(6 verified gaps found — PDF's strongest, since no competitor
      ships PDF page editing; 2 tools correctly got no new claim; caught 2 impostor-site search results
      before they were written up)*
- [x] 4.1 Privacy policy · [x] 4.2 Legal notice · [x] 4.3 **Binary licence** · [x] 4.4 Asset licences
- [x] 5.1 **Web tokens** · [x] 5.2 **Layout & responsive** *(bento + live search on desktop/tablet,
      horizontal-scroll strip on mobile, nav hides on hero; 3 opens carried forward — alternating
      section background, mobile nav's expanded state, Hash's tablet sizing)* · [x] 5.3 **Product imagery
      (Epic 7 fork)** ·
      [x] 5.4 **OG image** · [x] 5.5 **Logo intake (dev-supplied SVGs) & placement** *(nav lockup,
      footer mark, full mark kept at every favicon size incl. 16×16)* · 5.6 Favicon & icon
      production ·
      5.7 Dark mode
- [x] 6.1 Domain migration · [x] **6.2 Layout impl** *(DESIGN.md colors + landing-design.md §1 type/
      spacing/radius wired as `prefers-color-scheme`-gated tokens; Astro's stable Fonts API self-hosts
      Geist Sans/Mono + Hubot Sans; favicon/apple-touch-icon/manifest + nav/footer mark wired)* ·
      [x] **6.3 Pages** · [x] **6.4 Content model** · [x] **6.5 i18n structure** *(Astro native i18n,
      `prefixDefaultLocale: false`; all 23 routes now ship EN+FR — 46 pages built; locale-scoped tool/
      comparison content collections; shared `lang`-prop page components; canonical/hreflang wiring;
      path-preserving language switcher)* ·
      6.6 JSON-LD · 6.7 OG meta · 6.8 **Analytics rework** · 6.9 Accessibility · 6.10 Perf budget ·
      6.11 Build gates · 6.12 CSP *(optional)* · 6.13 `llms.txt` · 6.14 AI-crawler policy
- [ ] 7.1 Verify analytics · 7.2 **GitHub download counts** · 7.3 Search Console · 7.4 Review
      cadence · 7.5 AI visibility baseline & referrals
- [ ] 8.1 Pre-launch checklist · 8.2 Code review
- [ ] 9.1 GitHub cross-links · 9.2 Distribution plan · 9.3 UTM conventions ·
      9.4 **GitHub repo as agent surface** *(touches `Umbra`)*
- [ ] 10.1 Maintenance triggers · 10.2 Changelog upkeep · 10.3 Post-Epic-7 imagery swap ·
      10.4 Keyword research

**The GEO thread, if you want to run it as one pass:** 1.6 → 3.7 → 3.8 → 6.13/6.14 → 7.5 → 9.4. Ordered by
leverage, that's 9.4 and 9.2 first, 3.7 second, and 6.13/6.14 last — the opposite of the order most
GEO guides push, because they sell on-site work. **The SEO thread is a separate, shorter one, added
2026-09-19 alongside 3.6b:** 3.6b → 6.6 (structured data derives from 3.6b's metadata) → 7.3 (Search
Console/Bing) → 10.4 (keyword research, deliberately last per that step's own honest framing). The two
threads share one step (3.7 now explicitly checks itself against 3.6b, per that step's new guard rail)
but are otherwise independent — don't collapse them back into one pass when executing.
