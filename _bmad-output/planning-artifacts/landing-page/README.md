---
title: "Umbra — Landing Page Rebuild Roadmap"
status: draft
created: 2026-08-18
updated: 2026-08-18
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
| Language | English ships; i18n structure in place for a later French locale |
| Effort | Moderate, a few weeks, no hard date |

---

## Phase 0 — Read-in

- [ ] **Step 0.1 — Ground the session.** Read `DESIGN.md`, `EXPERIENCE.md`, `prd.md` (§1–2 for
      positioning, FR33/FR34, INV-1/INV-2, §6 success metrics), Story 5.4 (what exists and its
      seven deferred items), and `umbra-web`'s current `src/`. **Why first:** every later step
      cites these; re-deriving them per session wastes the run and invites drift.
      **Output:** none — this is orientation, folded into Step 1.1's session.

---

## Phase 1 — Strategy, and the guard rails

**Goal:** decide what the site argues, to whom, and — critically — which factual claims it is
allowed to make. Nothing visual, nothing written as final copy.

- [ ] **Step 1.1 — Positioning & audience brief.** Transcribe the PRD's positioning ("the
      privacy-first toolbox where even the AI is private"; explicitly *not* out-featuring
      DevToys/DevUtils) into a page-level brief: the one-sentence claim, the visitor's job-to-be-done,
      what the page is implicitly arguing against, and the single conversion action.
      **Why here:** every copy and IA decision downstream resolves against this; without it, section
      order becomes taste. **Tool:** `bmad-prfaq` (run from `Umbra`) is an unusually good fit — the
      press-release-then-FAQ format forces the value claim into one paragraph before any feature
      list exists. `bmad-product-brief` is the heavier alternative if the PR/FAQ shape feels wrong.
      **Output:** `landing-strategy.md` §1.

- [ ] **Step 1.2 — Reference scan.** 📚 Look hard at 6–10 comparable sites — direct
      (devutils.app, DevToys, DevTools-X) and aspirational-adjacent in the same visual register
      (Raycast, Linear, Warp, Zed). Extract *conventions*, not designs: where the screenshot sits,
      how a download is presented, how much copy is above the fold, how privacy-positioned tools
      handle proof. **Why here:** you're a beginner at this specific genre and pattern-absorption is
      the cheapest possible fix; doing it before IA means Phase 2 starts from a known vocabulary.
      **Tool:** direct browsing, plus landing-page galleries (Land-book, Lapa Ninja, Godly) for
      structural range. `bmad-market-research` if you want it run as a structured comparison rather
      than a browse. Timebox to one session. **Output:** `landing-strategy.md` §2.

- [ ] **Step 1.3 — Objection map.** List every reason a visitor bounces, then decide where each is
      answered. Umbra's are concrete and unusually strong material: *is it safe to run an unsigned-
      looking binary from a stranger* (answer: Developer ID signed + Apple notarized), *public repo
      but All Rights Reserved — what may I actually do*, *why should I believe the privacy claim*
      (answer: a per-release `nettop` network trace, Story 5.3), *there's no Windows build*, *what
      happens when it updates*. **Why here:** this is what turns the FAQ page from a dumping ground
      into structure, and it feeds the home page's section order directly.
      **Tool:** a plain working session; `bmad-review-adversarial-general` if you want the
      objections generated against you rather than by you. **Output:** `landing-strategy.md` §3.

- [ ] **Step 1.4 — Success definition & event plan.** Name what "it worked" means and — before any
      code — which events measure it. **Read this constraint carefully:** you chose cookieless
      PostHog, which means no cross-page-load identity. A "landed on home → clicked download on
      /download" funnel is *not* measurable under that choice. Design around it: put a download-click
      event on every page that carries a CTA and measure event counts, not conversion rates. Also
      note PostHog can never see the download itself — that number lives in the GitHub Releases API
      (Phase 7.2). **Why here:** an event plan written after the build is an event plan retrofitted
      badly; and this is where the cookieless trade-off gets priced honestly instead of discovered
      later. **Tool:** working session + Context7 for PostHog's current `persistence` options and
      `capture` API. **Output:** `landing-strategy.md` §4.

- [ ] **Step 1.5 — The claim ledger.** 🔸 A table of every factual assertion the site is permitted
      to make, each with its source of truth and who owns updating it: the privacy promise (source:
      `Umbra`'s README `## Privacy` + Story 5.3's executed checklist), the tool list (source:
      `src/stores/registry.ts`), platform support (source: NFR3 + what actually builds), the licence
      (source: NFR7), version/release (source: GitHub Releases). **Why here — this is the guard rail,
      so it precedes all copy:** the privacy claim now lives on three public surfaces (README, in-app
      Settings, this site). Over-stating it here is the one failure in this whole project with real
      consequences, and Story 5.4's own Dev Notes flagged exactly this hazard. Every later copy step
      is checked against this ledger. **Tool:** working session reading the named sources live —
      not from memory, not from this roadmap's summaries. **Output:** `landing-strategy.md` §5.

- [ ] **Step 1.6 — AI-answer target list.** 📚 Write down the handful of questions you want an LLM
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

- [ ] **Step 2.1 — Page inventory.** Decide the page list from Phase 1's outputs rather than from
      what exists. Candidates on the table: home, download, FAQ, a recruiter/project page (Step 2.2),
      privacy policy, legal notice, a changelog/releases page. Each page must justify itself against
      the audience priority; kill anything that can be a section instead of a page.
      **Why here:** copy can't be written until you know how many pages there are, and the legal
      pages (Phase 4) need slots. **Tool:** working session. **Output:** `landing-ia.md` §1.

- [ ] **Step 2.2 — Shape the recruiter-facing page.** 🔸 Left deliberately open. The forks: an
      *engineering write-up* (Rust/Tauri bridge, local ONNX inference, the signed-and-notarized
      release pipeline — maps to the PRD's "Learned" metric, aimed at a technical interviewer); a
      *project story* (the planning corpus, the decisions and their trade-offs, the accepted-not-
      fixed WCAG calls, what got killed and why — shows judgment rather than output); or both as one
      page. **Why its own step:** it's the one page with no precedent to copy and the only one
      serving the secondary audience, so it deserves a dedicated session rather than a footnote in
      2.1. **Tool:** `bmad-brainstorming` or `bmad-forge-idea` (from `Umbra`) to pressure-test the
      framing before committing copy to it. **Output:** `landing-ia.md` §2.

- [ ] **Step 2.3 — Home-page narrative spine.** 📚 Section-by-section order with a one-line purpose
      for each — the *argument*, in words, before any prose or layout. This is the actual craft of
      landing-page design, more than visuals are. **Why here:** it consumes 1.1's claim, 1.3's
      objections, and 1.2's conventions, and it's what Phase 3 writes into and Phase 5 designs
      around. **Tool:** working session; `bmad-editorial-review-structure` to critique the spine
      once drafted. **Output:** `landing-ia.md` §3.

- [ ] **Step 2.4 — Outlines for every other page.** Same treatment, lighter: purpose, sections,
      what each must and must not claim (per the ledger). **Tool:** working session.
      **Output:** `landing-ia.md` §4.

- [ ] **Step 2.5 — Content model.** Decide what becomes structured data versus hardcoded markup.
      The tool list is the live case: it's currently hardcoded in `index.astro` and **will** drift
      when Epic 8 reworks the tools. Options: an Astro content collection, a shared JSON, or a
      documented manual sync. **Why here:** it shapes the build, and it's the mechanical half of the
      claim ledger. **Tool:** working session + Context7 for Astro 7's content-collections API.
      **Output:** `landing-ia.md` §5.

---

## Phase 3 — Copy

**Goal:** every word on the site, written deliberately, checked against the ledger.

- [ ] **Step 3.1 — Web voice spec.** 📚 `EXPERIENCE.md` locks an *in-app* voice — precision
      instrument, no exclamation marks, no cheerleading, "an instrument reporting state." Marketing
      copy needs that same register doing a different job: the app reports, the site persuades. That
      translation has never been written down; the current site's tone was improvised.
      **Why here:** it's the rubric every following step is graded against. **Tool:** working
      session deriving from `EXPERIENCE.md`'s Voice and Tone table, extended with web-specific
      Do/Don't pairs. **Output:** `landing-copy.md` §1.

- [ ] **Step 3.2 — Home copy.** 📚 Hero headline, subhead, every section, the CTA. Learn the
      techniques explicitly as you go — specificity over adjectives, benefit over feature, naming
      the enemy, one idea per section. Write 3–5 headline candidates and choose deliberately; the
      current "Developer tools that don't phone home" is genuinely good and worth beating rather
      than discarding. **Why here:** needs the spine (2.3) and the voice spec (3.1).
      **Tool:** working session, then `bmad-editorial-review-prose` as a second pass.
      **Output:** `landing-copy.md` §2.

- [ ] **Step 3.3 — Proof copy.** 🔸 The section that *demonstrates* the privacy claim instead of
      asserting it. You have rare ammunition most privacy-claiming apps don't: a written, executed,
      per-release network-monitor checklist; Apple notarization; a publicly readable repo; a
      consent-gated updater. **Why its own step:** it's the differentiator, and it's the easiest
      place to accidentally overclaim — so it gets written against the ledger deliberately rather
      than in the flow of 3.2. **Tool:** working session, ledger open alongside.
      **Output:** `landing-copy.md` §3.

- [ ] **Step 3.4 — Remaining page copy.** Download, FAQ (structured from 1.3's objection map), the
      recruiter page, changelog framing. **Tool:** working session.
      **Output:** `landing-copy.md` §4.

- [ ] **Step 3.5 — Microcopy and social-proof honesty pass.** CTA labels, link text, fine print,
      the empty-ish states. Includes the specific problem of presenting a product with **no social
      proof yet** — no stars, no testimonials, no download count worth showing — without either
      faking it or looking abandoned. **Tool:** working session.
      **Output:** `landing-copy.md` §5.

- [ ] **Step 3.6 — Ledger gate.** Read every line of copy against Step 1.5's ledger. Anything not
      traceable to a source either gets a source or gets cut. **Why last in the phase:** it's a gate,
      not a draft pass. **Tool:** working session; `bmad-review-edge-case-hunter` for an adversarial
      read of the privacy and licence wording specifically. **Output:** ledger sign-off recorded in
      `landing-copy.md` §6.

- [ ] **Step 3.7 — Extractability pass (GEO).** 📚 Re-edit the finished copy so a machine can lift a
      correct, self-contained answer out of it. Concretely: question-shaped headings matching Step
      1.6's target questions; the direct answer in the first sentence under each heading, before the
      elaboration; facts stated in full rather than by pronoun ("Umbra runs entirely offline" beats
      "it does"); a comparison table (Umbra vs. web-based formatters vs. other desktop suites), since
      tables are unusually citable; and visible dates on anything time-sensitive, since recency
      correlates strongly with citation. **Why here and not inside 3.2:** writing for a human and
      structuring for extraction pull in different directions, and doing both at once produces copy
      that reads like an FAQ bot. Write it well first, then make it liftable. **Guard rail:** this
      pass must not weaken 3.6's sign-off — a claim made more quotable is a claim more likely to be
      repeated verbatim by an LLM, which *raises* the cost of overstating it. Re-run the ledger check
      after this pass. **Tool:** working session; `bmad-editorial-review-structure` for the heading
      pass. **Output:** `landing-copy.md` §7.

---

## Phase 4 — Legal & trust surfaces

**Goal:** close the gaps that exist because the site collects analytics and distributes a binary.
Runs after copy because these are copy too — and before build, because two of them change what the
code does.

> Not legal advice. These steps produce your own informed decisions, with sources named. Treat
> anything you're unsure about as a question for someone qualified, not for an AI.

- [ ] **Step 4.1 — Privacy policy.** A real page, not a footer sentence. You run PostHog from
      France on an EU-region project, so GDPR applies to *the site* regardless of the app collecting
      nothing. Strategic angle as much as legal: a product whose entire pitch is privacy, without a
      privacy policy, is an own goal a sharp visitor notices. Made much shorter by two decisions
      already taken — cookieless, and no email capture. **Tool:** working session; CNIL's own
      guidance as the primary source for the French context. **Output:** `landing-legal.md` §1.

- [ ] **Step 4.2 — Legal notice (mentions légales).** France requires a site publisher to identify
      themselves. For a non-commercial personal site the requirements are reduced — notably you can
      generally withhold a home address where the host is identified — but reduced is not none.
      **Why here:** it's a page in the inventory and it needs writing. **Tool:** working session,
      CNIL/service-public guidance. **Output:** `landing-legal.md` §2.

- [ ] **Step 4.3 — End-user licence for the binary.** 🔸 Separate from the repo's All Rights
      Reserved. Right now the repo grants no rights and the site says "download this" — technically
      contradictory, and nobody has flagged it in any existing document. A short statement (personal
      use permitted, no redistribution, no reverse engineering, provided as-is with no warranty)
      resolves it. **Why here:** it changes the download page's copy and possibly adds a page.
      Because you took All Rights Reserved rather than an OSS licence, you also got none of the
      warranty-disclaimer boilerplate an OSS licence would have handed you for free.
      **Tool:** working session. **Output:** `landing-legal.md` §3.

- [ ] **Step 4.4 — Third-party asset licence record.** Geist Sans/Mono (OFL 1.1, already verified
      in `DESIGN.md`), Phosphor icons, any imagery. Just needs recording as checked.
      **Tool:** working session. **Output:** `landing-legal.md` §4.

- [ ] **Step 4.5 — Optional: trademark re-check.** "Umbra" already caused one collision — the
      original working title was retired for exactly this reason — and the site is the public,
      commercial-looking surface. A short EUIPO/INPI search. Low cost, non-zero value, entirely
      skippable. **Output:** `landing-legal.md` §5.

---

## Phase 5 — Visual design & product imagery

**Goal:** decide how it looks and produce the images. After copy, because layout should serve real
content rather than lorem ipsum.

- [ ] **Step 5.1 — Derive web tokens from `DESIGN.md`.** 🔸 Not a copy-paste. The app's ramp is
      14px body / 28px display — far too small for a web hero — and `EXPERIENCE.md` explicitly
      states the app has "no responsive-breakpoint question to resolve," so the web has **no type
      scale, no breakpoint set, and no fluid spacing to inherit.** Produce a web scale that is
      recognisably the same brand: same families, same 4px spacing base, same 4px radius, same
      "orange is a budget of one" rule, different sizes. **Why here:** everything visual consumes it.
      **Tool:** working session against `DESIGN.md`; the `design` skill or Claude Design for quick
      side-by-side scale comparisons. **Output:** `landing-design.md` §1.

- [ ] **Step 5.2 — Layout & responsive design.** Home page first, then the rest. Roughly half your
      visits will be phones — including a recruiter opening your link on a train.
      **Why here:** consumes 5.1's tokens and 2.3's spine. **Tool:** the `design` skill (a
      multi-artboard canvas: desktop and mobile side by side) or Claude Design, seeded with
      `DESIGN.md` — the same tool and the same seeding pattern that worked for Steps 3.1 and 4.3 of
      the app roadmap. **Output:** mockups + `landing-design.md` §2.

- [ ] **Step 5.3 — Product imagery.** 🔸 **The site currently has zero images. A visitor cannot
      see what Umbra looks like without installing it.** For a desktop app with no in-browser trial,
      this is usually the single largest conversion factor. **The Epic 7 fork, decided at this step:**
      the shipped shell still predates the design system, so real captures today would show a UI
      that contradicts the site's own branding. Either (a) ship with the Step 4.3 Claude Design
      mocks, labelled honestly as mockups, and swap in real captures once Epic 7 lands, or (b) hold
      the imagery slot until Epic 7 ships. Decide it here, explicitly, rather than discovering it at
      launch. Also decide whether a short demo GIF of the 5-minute flow (⌘K → JSON → JWT → cron →
      Bucket) is worth producing — it is the PRD's own demo spine and would carry the page.
      **Tool:** macOS `⌘⇧5` or Shottr/CleanShot for capture; keep framing restrained, per brand.
      **Output:** image assets + `landing-design.md` §3.

- [ ] **Step 5.4 — Social share card (OG image).** 🔸 Cheap, high payoff, currently missing: every
      share of this link — Slack, LinkedIn, Discord, a message to a recruiter — renders as a bare
      grey box today. One well-made 1200×630 image fixes it everywhere. **Tool:** designed as an
      artboard alongside 5.2, exported as PNG. **Output:** asset + `landing-design.md` §4.

- [ ] **Step 5.5 — Logo intake & placement inventory.** 🔴 **Input required from the developer, not
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

- [ ] **Step 5.6 — Favicon & icon asset production.** Derive the technical file set from 5.5's two
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

- [ ] **Step 5.7 — Dark mode.** Near-free: `DESIGN.md` already ships a full, contrast-verified dark
      palette, so this is `prefers-color-scheme` plus token swaps, not a new design pass. Confirm the
      5.5/5.6 mark assets also have a dark-mode-legible variant (the mark's ink-letter layer is
      `text-primary`, which itself swaps light/dark per `DESIGN.md` — verify the swap holds at
      favicon size too, since OS chrome doesn't always respect `prefers-color-scheme` for favicons).
      **Output:** `landing-design.md` §6.

---

## Phase 6 — Build

**Goal:** implement it. All sessions run in `umbra-web`. Verify every API against Context7.

- [ ] **Step 6.1 — Domain migration.** Add the subdomain in Vercel, update `astro.config.mjs`'s
      `site`, confirm canonical URLs / sitemap / `robots.txt.ts` all regenerate against it, and add
      a redirect from `umbra-web-beta.vercel.app` — it's live, indexed, and Story 5.4 records the
      link being handed out. Note that search engines treat a subdomain as a separate property from
      the parent domain; irrelevant at this scale, but you inherit nothing from it.
      **Why first in the phase:** canonical tags, OG image URLs, and structured data all bake
      absolute URLs. Doing this after them means redoing them.

- [ ] **Step 6.2 — Layout and token implementation.** Rewrite `Layout.astro`'s global CSS from the
      Phase 5.1 tokens, and wire in Step 5.6's favicon/icon assets (`<link rel="icon">`,
      `apple-touch-icon`, manifest reference) — replacing Astro's scaffold defaults, still live in
      `public/favicon.ico`/`.svg` today. Self-host Geist rather than hotlinking (`@fontsource`-style),
      and note the perf trade-off — fonts are the most common way an Astro static site stops being
      fast.

- [ ] **Step 6.3 — Pages.** Build the Phase 2 inventory with the Phase 3 copy. Astro's file-based
      routing, one file per route, shared layout.

- [ ] **Step 6.4 — Content model.** Implement 2.5's decision so the tool list has one source.

- [ ] **Step 6.5 — i18n structure.** 🔸 **Structure only — zero French copy gets written in this
      roadmap.** Configure Astro's native `i18n` config (`astro.config.mjs`): `locales: ["en", "fr"]`,
      `defaultLocale: "en"`, and pick a routing strategy now rather than let it default — the real
      decision is `routing.prefixDefaultLocale`: `false` keeps English at `/` with no `/en/` prefix
      (French would live at `/fr/`) and is the more common choice for a site with one dominant
      language; `true` prefixes everything (`/en/`, `/fr/`) and reads as more neutral between
      locales but changes every current URL. Given 6.1 is already moving the domain, `false` avoids
      stacking a second URL change on top of that one. Also set `@astrojs/sitemap`'s own `i18n`
      option (it's a separate config block from Astro's `i18n`, easy to configure one and miss the
      other) — once set, it generates `hreflang` alternate-link entries per page automatically,
      which is the mechanism search engines use to serve the right locale; with only `en` shipped
      it's inert but structurally correct, so adding `fr` later is a content change, not a
      config change. **Why now and not later:** retrofitting routing after launch changes every
      URL, which is exactly the SEO cost you avoided by fixing the domain first — doing both URL
      shifts in the same pre-launch pass instead of two separate ones later.
      **Tool:** Context7-verified against Astro's current `i18n` reference and `@astrojs/sitemap`'s
      `i18n` option before implementing — both are real, current APIs as of this roadmap's writing,
      but re-check given Astro's fast release cadence (`umbra-web` is on Astro 7.x).

- [ ] **Step 6.6 — Structured data (JSON-LD).** `SoftwareApplication` for the app, `FAQPage` for the
      FAQ. Highest effort-to-payoff ratio in the whole SEO block — Google renders FAQ markup as
      expandable results. Deferred by Story 5.4's review; closing it here.

- [ ] **Step 6.7 — OG and Twitter Card meta.** Wire 5.4's image. Also deferred by Story 5.4.

- [ ] **Step 6.8 — Analytics rework.** Three things: switch PostHog to cookieless — decide between
      `persistence: 'memory'` (cleanest, no terminal-equipment storage at all, but identity resets
      every page load) and `sessionStorage` (survives navigation within a visit, still no cookie,
      but still counts as storage on the user's device for ePrivacy purposes); implement Step 1.4's
      download-click events; and **audit the PostHog project dashboard**, because Story 5.4's own
      review flagged that `autocapture: false` in code doesn't govern dashboard-level features (web
      vitals, exception capture, rageclick detection) — so the footer's "page-view analytics only"
      claim isn't verified the way the app's privacy claim is. Ten minutes, closes a known gap
      between a published claim and reality. Update the footer disclosure to match whatever's true.

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
      metric. Check it manually or with a small script.

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

- [ ] 1.1 Positioning & audience brief · 1.2 Reference scan · 1.3 Objection map · 1.4 Success
      definition & event plan · 1.5 **Claim ledger** · 1.6 AI-answer target list
- [ ] 2.1 Page inventory · 2.2 **Recruiter page shape** · 2.3 Home narrative spine · 2.4 Other page
      outlines · 2.5 Content model
- [ ] 3.1 Web voice spec · 3.2 Home copy · 3.3 **Proof copy** · 3.4 Remaining copy · 3.5 Microcopy &
      social-proof honesty · 3.6 Ledger gate · 3.7 Extractability pass
- [ ] 4.1 Privacy policy · 4.2 Legal notice · 4.3 **Binary licence** · 4.4 Asset licences ·
      4.5 Trademark re-check *(optional)*
- [ ] 5.1 Web tokens · 5.2 Layout & responsive · 5.3 **Product imagery (Epic 7 fork)** ·
      5.4 **OG image** · 5.5 **Logo intake (dev-supplied SVGs) & placement** · 5.6 Favicon & icon
      production ·
      5.7 Dark mode
- [ ] 6.1 Domain migration · 6.2 Layout impl · 6.3 Pages · 6.4 Content model · 6.5 i18n structure ·
      6.6 JSON-LD · 6.7 OG meta · 6.8 **Analytics rework** · 6.9 Accessibility · 6.10 Perf budget ·
      6.11 Build gates · 6.12 CSP *(optional)* · 6.13 `llms.txt` · 6.14 AI-crawler policy
- [ ] 7.1 Verify analytics · 7.2 **GitHub download counts** · 7.3 Search Console · 7.4 Review
      cadence · 7.5 AI visibility baseline & referrals
- [ ] 8.1 Pre-launch checklist · 8.2 Code review
- [ ] 9.1 GitHub cross-links · 9.2 Distribution plan · 9.3 UTM conventions ·
      9.4 **GitHub repo as agent surface** *(touches `Umbra`)*
- [ ] 10.1 Maintenance triggers · 10.2 Changelog upkeep · 10.3 Post-Epic-7 imagery swap ·
      10.4 Keyword research

**The GEO thread, if you want to run it as one pass:** 1.6 → 3.7 → 6.13/6.14 → 7.5 → 9.4. Ordered by
leverage, that's 9.4 and 9.2 first, 3.7 second, and 6.13/6.14 last — the opposite of the order most
GEO guides push, because they sell on-site work.
