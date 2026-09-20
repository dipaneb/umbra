---
title: "Umbra — Landing Page Information Architecture"
status: draft
created: 2026-09-18
updated: 2026-09-19 (corrections from Step 3.2: nav/Tools hub page, Workflow heading/demo-flow, Feature-tour cadence; corrections from Step 3.5: language switcher, footer GitHub link, download-page loading/error states, 404 route)
---

# Umbra — Landing Page Information Architecture

> Companion to `_bmad-output/planning-artifacts/landing-page/README.md`'s Phase 2 and
> `landing-strategy.md`'s Phase 1. Each `§` below corresponds to one roadmap step; later steps
> append their own `§`, they don't rewrite this one.

## §1 — Page inventory (Step 2.1)

**Method:** working session. Candidates taken from `README.md`'s own Step 2.1 entry (home, download,
FAQ, recruiter/project page, privacy policy, legal notice, changelog/releases page), each tested
against `landing-strategy.md`'s Phase 1 outputs (the audience-priority split, the objection map's
"where it lives" column, and the claim ledger) rather than against what currently exists in
`umbra-web/src/pages/` (`index.astro`, `download.astro`, `faq.astro` — three pages today, per Rule 4:
historical draft, not a page list to preserve). Three of the seven candidates forked into genuine
either/or decisions; those were put to the developer directly (this session, 2026-09-18) rather than
decided by default, per `README.md`'s own autonomy table marking Step 2.1 "yours by right — the
decision is the deliverable." One fork (the EULA) was decided against live research into two real
comparable sites rather than a guess — see below.

### The decided page list

| # | Page | Path (working) | Status | Why it's a page, not a section |
|---|---|---|---|---|
| 1 | **Home** | `/` | Exists (rebuilt in Phase 3/5/6) | The hero, the wedge claim, and the proof section — the page every other page supports. |
| 2 | **Download** | `/download` | Exists (rebuilt) | The single conversion action (§1 of `landing-strategy.md`); becomes the live per-platform resolver against `/releases/latest` (ledger row 7). |
| 3 | **FAQ** | `/faq` | Exists (rebuilt) | Absorbs nearly every row of the objection map (§3) marked "FAQ" — the ARR/source-available clarification, the open-source/audit question, the SmartScreen disclosure detail, the update-confirmation question, the DevToys/DevUtils comparison. Keeping these off the home page matters: §2's finding 1 already flags that Umbra's low-copy hero has no room to carry reference-depth answers, and stacking them there would undo the very choice §1 made. |
| 4 | **Recruiter / project page** (working name: "About" — developer's naming preference, 2026-09-18) | *TBD — Step 2.2's job* | New | Existence already locked by the roadmap's own decisions table ("Developers first; recruiters second, served by a separate signposted page") — not re-litigated here. Its shape (engineering write-up vs. project story vs. both) and its path are deliberately left to Step 2.2, per `README.md`. **Correction (this session):** an earlier draft of this table rejected a separate "About" page as redundant with this one — that framing was backwards; "About" is simply this page's more natural name, not a second page. |
| 5 | **Privacy policy** | `/privacy` | New | Required by Step 4.1: PostHog runs on an EU-region project, so GDPR applies to the site regardless of what the app itself collects. Can't be a footer sentence — a product whose entire pitch is privacy needs a real page here, or a sharp visitor notices the gap (Step 4.1's own framing). |
| 6 | **Legal notice (mentions légales)** | `/legal` | New | **Decided (this session): separate from Privacy policy.** France treats site-publisher identification (Step 4.2) and GDPR data processing disclosure (Step 4.1) as two distinct legal obligations; kept as two short, single-purpose pages rather than one combined "Legal" page with two sections. |
| 7 | **EULA (binary license)** | `/eula` | New | **Decided (this session, after live research): dedicated page**, not a Download-page section. See below — both real comparables checked put it on its own page. Distinct from the repo's `LICENSE` (All Rights Reserved, governs the *source*) — this governs what a person may do with the *compiled binary* they downloaded, closing the contradiction Step 4.3 flagged ("download this" next to a repo that grants zero rights). |
| 8 | **Changelog / releases** | `/changelog` | New | **Decided (this session): included as a dedicated page**, styled like a language/framework release-notes page (grouped by version, notable changes summarized — not a raw API dump), not folded into a home-page snippet. Justification below. |
| 9 | **Individual tool pages** (9: `/tools/json`, `/tools/base64`, `/tools/uuid`, `/tools/hash`, `/tools/jwt`, `/tools/cron`, `/tools/ocr`, `/tools/pdf`, `/tools/image`) | `/tools/*` | New (added 2026-09-18, second pass) | Targets §7's exact query shape ("offline JSON formatter for macOS," "local OCR without cloud API") with real, distinct content per page, not padding. Precedented at both a small comparable (devutils.com's `/demo/#toolname`) and established ones (Raycast's 11 `/core-features/*` pages, Linear's 15 feature pages) — not a small-indie-only pattern. |
| 11 | **Tools hub / index** | `/tools` | New (added 2026-09-19, Step 3.2) | **Added to close a real gap found while drafting home copy, not a preference call.** Before this, the 4 comparison pages (row 10) had no path to them anywhere on the site — not nav, not footer, not linked from home — only a passing FAQ mention. This page is both nav's missing "see all the tools" destination and the comparison pages' actual home: a table-of-contents page listing all 9 tools (row 9) and linking out to all 4 comparisons (row 10). Distinct from `/tools/json` etc. the same way an index differs from its children. |
| 10 | **Comparison pages** (Umbra vs. DevToys / DevUtils / DevTools-X / CyberChef) | `/compare/devtoys`, `/compare/devutils`, `/compare/devtools-x`, `/compare/cyberchef` | New (added 2026-09-18, second pass) | **Resolved at Step 2.4 (§4): four separate per-competitor pages, not one combined page** — the developer's call, following the devutils.com/Raycast precedent over the maintenance-lighter single-page draft. Step 3.7's planned multi-column matrix isn't cancelled by this; how it fits alongside four dedicated pages is still open, flagged in §4. |

**Not added as a page:** a secondary CLI/build-from-source install path (§2 finding 4's flagged gap)
— this is Download-page *content*, not a page of its own; raised here only so Step 2.4/3.4 doesn't
lose it.

### §1b — Second pass: SEO/GEO-driven additions (2026-09-18, same session)

Requested by the developer after reviewing the first-pass list as too minimal, and specifically after
flagging that the first pass's SEO reasoning leaned on `devutils.com` — the smallest, least
resourced of the comparables checked so far — as if it were representative. Re-checked against two
comparables already trusted elsewhere in this roadmap as "aspirational-adjacent" (Step 1.2's own
category): **raycast.com** (11 individual `/core-features/*` pages, a `raycast-vs-alfred` comparison
page, FAQ, blog) and **linear.app** (15 individual feature pages, a comparison-adjacent `/switch`
page, no FAQ, no blog). The individual-page and comparison-page pattern holds at established-company
scale, not just small-indie scale — strengthens rather than changes the decision below.

**Added: 9 individual tool pages** (row 9) and **1 comparison page** (row 10) — both targeting real,
distinct search/answer intent (§7's target-question list) rather than padding for word count. Two
candidates considered and **not added this round** (developer did not select them):

- **A demo/walkthrough page** — a deeper version of Step 5.3's planned GIF as its own page. Not
  rejected outright, just not included in this pass; revisit if Step 5.3's imagery work makes a
  strong enough case for it later.
- **A blog** — the highest-cost, highest-risk of the four candidates raised: even `devutils.com`, more
  mature and monetized than Umbra, doesn't have one, and an abandoned blog would read as the exact
  "is this dead" signal the changelog page (row 8) exists to counter. Not added.

**On content structure (not a new page decision):** the developer independently arrived at the same
technique Step 3.7 ("Extractability pass") already specifies — question-shaped headings with the
direct answer in the first sentence, so an AI assistant can lift a self-contained answer. Confirmed
this is already planned, not a gap; the one refinement from this session is that it now explicitly
applies to the new tool pages (row 9) too, not only the FAQ — each tool page is itself a natural
Q&A candidate ("Does the JSON formatter work offline? Yes —").

### Why the changelog page survives the "kill anything that can be a section instead of a page" test

`README.md`'s own instruction for this step is explicit: every candidate must justify itself against
the audience priority, and anything that can be a section instead of a page should be cut. The
changelog is the one candidate genuinely on that line, so it's worth stating the case rather than
just asserting it:

- **The objection map (§3) asks for more than a snippet can carry.** The "is this a side project
  that'll be abandoned in six months?" objection is answered with "a public backlog... plus a real
  release history" — a *history*, not a single recency line. A home-page snippet ("last updated 3
  days ago") answers "is this alive right now" but not "has this been sustained," which is the
  actual claim Umbra needs to make (PRD's own thesis: sustained activity is read as strongly as the
  code itself).
- **It's referenced as a page, not a concept, in three later steps**, which would all need rework if
  it collapsed into a section: Step 7.2 wants downloadable-asset counts bridged in "so the number
  renders alongside `$pageview`/`download_clicked` in one dashboard" — implying a place on-site those
  numbers could also surface; Step 9.1 explicitly plans to "link releases back to the changelog
  page"; Step 10.2 is titled "Changelog / releases page upkeep" and is scoped as steady-state
  maintenance of a page, not a sentence.
- **Developer's framing (this session):** styled like a language/framework changelog — e.g. how
  release-notes pages for programming languages or frameworks read, one entry per version with
  notable changes — not a bare re-rendering of the GitHub Releases API response. This is a build
  detail for Step 6.3/6.4 to execute against, recorded here so it isn't lost between now and then.

### The EULA placement decision — real comparables, not a guess

The developer asked for real examples before deciding. Two were checked live (2026-09-18, not
recalled from training data, matching this roadmap's own verification discipline):

- **CleanShot X** (`cleanshot.com`) — closest *paid/commercial* comparable already named in the
  reference scan (`landing-strategy.md` §2b). Its EULA lives at its own URL, `/eula`, linked from the
  footer in a "License" group alongside Pricing, License Manager, and Buy-seats links. It's a full,
  16-section legal document — proportionate to CleanShot having purchases, subscriptions, and
  third-party services to cover, none of which apply to Umbra.
- **Titanium Software / OnyX** (`titanium-software.fr`) — free, single-developer macOS utility
  distributed outside the App Store, no company entity, no purchases: the closer analog to Umbra's
  actual situation. Its license agreement also lives on its own page (`/en/license.html`), but stays
  short — roughly 550–600 words across seven lettered clauses (license grant, "as-is," liability
  disclaimer). It's linked once, from an intro sentence on the apps-listing page, not from the
  footer or a download button.

Both real examples put it on a dedicated page; neither folds it into the download flow. Given
Umbra's own EULA content is meant to stay short (Step 4.3's own framing: "a short statement"), the
OnyX precedent is the closer match on substance — short content, still its own page. Decided:
dedicated `/eula` page, short.

Sources: [CleanShot X EULA](https://cleanshot.com/eula), [Titanium Software License Agreement](https://www.titanium-software.fr/en/license.html), [Titanium Software Apps page](https://www.titanium-software.fr/en/applications.html).

### Not decided here, deliberately

- **Nav vs. footer placement** for each page (which appear in the header nav vs. only the footer) is
  Step 2.3/5.2's job — this step decided *existence*, not layout.
- **Exact paths** above are working slugs, not locked URLs — consistent with the two that already
  exist (`/download`, `/faq`) but open to revision at Step 6.1 (domain migration) or 6.3 (page build)
  if a better convention surfaces.
- **Recruiter page's path and shape** — entirely Step 2.2's job, flagged in the table above, not
  guessed at here.

### Feeds directly into

- **Step 2.2** (recruiter page shape) — page #4's existence is confirmed; only its shape is still
  open.
- **Step 2.3** (home-page narrative spine) — knows now that FAQ absorbs reference-depth material, so
  home can stay low-copy per §2's finding 1 without losing that content.

## §2 — Shape of the recruiter-facing page (Step 2.2)

**Method:** run as a `bmad-forge-idea` pressure-test session (2026-09-18/19) rather than decided by
default — this step is marked in `README.md`'s autonomy table as "yours by right — the decision is
the deliverable," and README's own tool recommendation for this step is exactly this skill. The
session produced a full record — locked decisions, rejected directions, the personas that argued each
turn, a wax-seal outcome mark — but that record was a working artifact, not committed to this repo;
what survives here is this section's own summary below, which is the durable one. One independent
general-purpose subagent was consulted mid-session,
deliberately briefed on the page's purpose and constraints but not on the direction the session had
already converged toward, so it could propose a genuinely separate structure rather than restate the
developer's own words back.

### The decided shape

| Element | Content | Source |
|---|---|---|
| **Page name / path** | "About" (developer's own naming, `/about`) | Confirmed this session, resolving `landing-ia.md` §1 row 4's "path TBD" |
| **1. Mission line** | One sentence, plain, product voice: what Umbra is. No "I am X, I built Y." | — |
| **2. Outcome statements (4–5)** | Real, ledger-checked facts stated as plain benefits, not process or audit language: the Rust/Tauri stack (fast, lightweight, no Electron); macOS signed and notarized by Apple; the per-release network-check practice (nothing calls home, one disclosed update-check exception); the local-AI/OCR claim (bundled model, nothing uploaded); Windows/Linux best-effort framing, stated honestly | Ledger rows 1, 3, 5, 6 (`landing-strategy.md` §5) |
| **3. Footer attribution** | "Built by ⟨name⟩" — site-wide footer, not page-specific content | — |

No section headers, no "proof"/"evidence" framing, no CI/CD or release-pipeline vocabulary, no feature
list, no licensing section, no personal bio, no WCAG-trade-off or retired-cron-parser examples.

### Why this shape, not the other two forks

`README.md`'s original fork was engineering write-up vs. project story vs. both. What survived is
closer to neither, arrived at through two rejected directions:

1. **"Project story" (proves judgment) was the initial pick**, then refined once the developer
   clarified it further this session: not a personal narrative, not the WCAG/cron-parser trade-off
   examples README itself suggested — a deliberate, explicit exclusion, even though both are real,
   available, and exactly the kind of material the objection map (`landing-strategy.md` §3, "is this a
   toy project or real discipline") asked for. Recorded as a developer call, not re-litigated.
2. **A categorized "proof dossier" direction** (verifiable-privacy / release-engineering /
   licensing-as-decision sections, styled like an audit report) — partly built from the independent
   subagent's proposal — was drafted and then explicitly killed. Two reasons, both the developer's own:
   presenting Umbra's fairly ordinary CI/CD pipeline as a discipline signal reads as overselling to the
   technical reader who'd recognize it as boilerplate, and the jargon (tag-triggered CI/CD, a network
   monitoring checklist, "notarization" unexplained) fails a **non-technical reader who lands on this
   page too** — a constraint this session surfaced and that the original two-fork framing didn't
   account for. Both the categorized-sections structure and its narrative-pipeline alternative were
   killed together.
3. **What survived** keeps the real facts from both rejected directions but restates every one of them
   as a plain outcome ("the macOS version is checked and verified by Apple before it reaches you," not
   "signed with a Developer ID certificate and notarized"). This still answers the objection map's "toy
   or discipline" question — a reader gets specific, checkable facts, not adjectives — without the
   audit-report register that made the dossier direction fail its own audience test.

An illustrative sketch (mission line + five outcome statements + footer credit) was written and
confirmed as **structure-correct** in-session — not final copy. Exact wording belongs to Step 3.1 (web
voice spec) and Step 3.4 (remaining page copy), run as their own sessions per the roadmap's "one step =
one fresh conversation" rule.

### Not decided here, deliberately

- **Exact wording of the mission line and outcome statements** — Step 3.1/3.4's job; the in-session
  sketch proved the shape, not the sentences.
- **Which specific facts fill the 4–5 outcome-statement slots**, beyond "checked against the ledger" —
  a copy-writing choice, not a structural one.
- **How this page is reached** (nav link label, footer-only, or a more assertive audience-segmentation
  device per `landing-strategy.md` §2b's finding on 1Password/Doctolib-style toggles) — Step 2.3/5.2's
  job.
- **Footer attribution's exact wording and whether a real name is used** — a Step 3.5 (microcopy) and
  privacy-rule question (see `CLAUDE.md`'s "never commit real personal information" rule for this
  repo), not decided in this session.

### Feeds directly into

- **Step 2.4** (outlines for every other page) — this page's outline is now fully specified: three
  elements, ledger rows 1/3/5/6 as its factual basis, `/about` as its path.
- **Step 2.3 / 5.2** — nav/footer placement for this page, still open per above.
- **Step 3.1 / 3.4** — write the actual mission line and outcome statements against this structure and
  the confirmed register (plain, product-voice, dual-readable).
- **Step 6.2** (layout implementation) — the footer attribution is site-wide, not page-specific; needs
  wiring into `Layout.astro`'s footer alongside the other footer content Step 6.8 already touches.
- **Step 2.4** (outlines for every other page) — has a confirmed list of pages beyond home to outline:
  download, FAQ, About/recruiter, privacy, legal notice, EULA, changelog, 9 individual tool pages, and
  the comparison page(s) (whose one-page-vs-per-competitor scope is explicitly this step's call, not
  decided here — resolved at Step 2.4 as four per-competitor pages, see §4 and §1's row 10).
- **Step 2.5** (content model) — three consumers of a live-source content model now, not one: the
  changelog (GitHub Releases data), the individual tool pages (each one derived from its
  `registry.ts` entry, the same source row 4 of the claim ledger already names), and the comparison
  page (competitor facts, which have no live source and need their own citation discipline).
- **Step 3.7** (extractability pass) — now scoped to the FAQ *and* the 9 individual tool pages, not
  FAQ alone; each tool page should carry a direct-answer-first structure against its own §7 query.
- **Step 1.5** (claim ledger) — 9 new pages each making a "this tool does X, locally, offline" claim
  need to trace to `registry.ts` the same way row 4 already requires: a maintenance surface Step 6.4
  needs to keep in sync, not a one-time write.
- **Phase 4** (legal & trust surfaces) — privacy policy, legal notice, and EULA now each have a
  confirmed, separate page to be written into (Steps 4.1–4.3).
- **Step 6.3/6.4** (page build, content model) — eight pages to build; the changelog and EULA both
  need the "read live, don't hardcode" discipline the claim ledger (row 10) already established for
  version numbers.
- **Step 9.1** (GitHub cross-links) — the changelog page is the confirmed link target for "link
  releases back to the changelog page."
- **Step 10.2** (changelog upkeep) — has a confirmed page to maintain, not a concept to eventually
  build.

## §3 — Home-page narrative spine (Step 2.3)

**Method:** working session. Drafted against every Phase 1/2 output rather than from taste: §1's
locked headline/subhead and single conversion action, §2's eight reference-scan conventions (proof
early, screenshot teased immediately, single CTA), §3's objection map ("where it lives" column),
§4's event plan (CTA instrumentation points), §5's claim ledger (what each section is permitted to
say), §7's target-question list, and this file's own §1 (page inventory — FAQ/tool pages/comparison
page absorb reference-depth content, so home stays a tour, not a reference) and §2 (About page's
existence and content, still needing a placement decision this step owned). Two genuine forks —
the About page's nav prominence, and whether to reserve narrative real estate for a workflow demo
before its asset exists — were put to the developer directly rather than defaulted, per `README.md`'s
autonomy table marking this step "yours by right."

### The decided spine — validated by the developer 2026-09-19

**Revision note:** the table below is the spine's fourth and final iteration. A low-res wireframe
was built to review it section-by-section (a `design`-type Artifact, not a project file — its content
is captured here in words, which is this roadmap's durable record). Three rounds of developer
feedback reshaped it — two sections rebuilt, then the whole order reconsidered — before sign-off; see
the subsections below the table for the full trail.

| # | Section | One-line purpose |
|---|---|---|
| — | **Nav bar** (chrome, not a narrative beat, but its contents are decided here) | Logo/wordmark, quiet text links to **Tools** (added 2026-09-19 during Step 3.2 — this file's §1, row 11: links to the new `/tools` hub page, which is also the comparison pages' only path onto the site) / FAQ / **About** (decided below — full nav weight, not footer-only or a segmentation device), the Download CTA button that fires `download_clicked` from every page, and — **added at Step 3.5, a real gap this step found** — a small language-switch link at the far right, after Download, so it doesn't compete for weight with the primary CTA. See `landing-copy.md` §5 for the exact microcopy and reasoning; this file only records the placement. |
| 1 | **Hero** | State the wedge claim (§1's headline) and the convenience claim (§1's subhead) in one glance; a single Download CTA; the product visual (screenshot or the new video, once it exists) teased immediately below the fold, not deferred a full scroll — §2's convention 3, since Umbra has no brand equity to spend on Raycast-style patience. |
| 2 | **Feature tour — "9 tools"** ⟲ *moved up from 3, see below; heading revised 2026-09-19 during Step 3.2* | A scannable grid of the 9 current tools (ledger row 4, read live from `registry.ts` per Step 2.5), each card linking to its own `/tools/*` page rather than explaining itself in full here — this is what keeps home low-copy while the depth lives elsewhere (this file's §1). **Resolved (2026-09-19):** the heading's open cadence question is settled — plain **"9 tools,"** no "a new one every 1–2 weeks." Developer's call, and it matches the reasoning that already killed the same claim shape twice elsewhere in this project (the "Why Umbra" section, the rejected changelog-teaser section): a claim whose truth depends on staying visibly active is a bad permanent dependency for a section meant to last. |
| 3 | **Workflow — "Every tool, one search away"** ⟲ *moved up from 4; heading corrected 2026-09-19 during Step 3.2* | Make the convenience half of the pitch (§1's job-to-be-done #2) as tangible as the proof section makes the privacy half: a short video of the PRD's own demo spine (FR2's `⌘K` command palette → format JSON → decode a JWT → build a cron schedule) — the exact flow `prd.md` line 27 already names as the project's scope anchor, so this section has zero new content to invent. **Correction:** this section's heading was "One keystroke away" — dropped for the same reason Step 3.2 dropped it from the hero subhead. Checked live against `src/shell/CommandPalette.vue` (`window.addEventListener("keydown", ...)`, no `global-shortcut` Tauri plugin in `src-tauri`): ⌘K only fires while Umbra's own window has OS focus. FR2's "global keyboard shortcut" means global *within the app*, not a Spotlight/Raycast-style systemwide launcher — "one keystroke away" implies the latter and isn't true. "Every tool, one search away" names the real mechanism (search by name/alias, per FR2) without the false implication. Also corrected in the same pass: the demo flow's last beat is "build a cron schedule," not "type a cron phrase" — Story 8.6 retired cron's free-text NL parser for a deterministic guided grid (ledger row 3a already flags `prd.md` line 27 itself as stale on this point); copy describing a text field a visitor won't find would be its own small trust gap. |
| 4 | **Proof — "Verify it yourself"** ⟲ *moved down from 2, content revised twice, see below* | Lead with an **architectural** claim anyone can grasp instantly — "there's no server for your data to go to," next to a plain device/server diagram — not a raw `nettop` command line, which only a developer could parse. A native-app/Rust line and the corrected term **source-available** (never "open source" — no license grants reuse/redistribution) follow. Closes with a literal, runnable self-check (`nettop -p $(pgrep -x umbra)`) the visitor runs on their *own* downloaded copy — not a link to the developer's own markdown checklist, which is self-reported and proves nothing to a skeptical reader. macOS-only as drafted; Windows/Linux equivalents don't exist yet. Now positioned as the closing trust argument, after the product has already shown itself, not the opening one. |
| 5 | **Why Umbra** | Three short, evergreen benefit statements (Free/no account · the search+category catalog design · updates ask first) — a last recap right before the closing CTA, after Catalog/Workflow/Proof have each made their own case in depth. No longer overlaps Proof's content (Proof's update-check line was removed in its rewrite), so this item is the only place that fact is stated now. |
| 6 | **Closing CTA** | A second, low-friction Download moment for a visitor who read the whole page without clicking nav/hero — button only, no new headline, with the platform-availability line underneath per §2's convention 5 (a small plain-text line, not part of persuasive copy), reading live per ledger row 7's per-platform logic once Windows/Linux land in a stable release. |
| 7 | **Footer** | Houses everything that would otherwise force home to carry reference depth: links to FAQ, Privacy, Legal notice, EULA, Changelog, and **About** (also linked, alongside the nav — footer + nav is not redundant, it's the standard "always reachable" pattern); attribution line; the site-analytics disclosure sentence (ledger row 13, reworded once Step 6.8 ships the new events); the source-available/licence note (ledger row 9); a copyright line. **Added at Step 3.5, two more real gaps that step found:** a "Watch on GitHub" link (the repo, `notify_me_clicked`'s trigger, and a fix for the Proof section's own unlinked "read it yourself") and the same language-switch link the nav carries, repeated here per the always-reachable pattern above. Exact wording in `landing-copy.md` §5. No comparison-table content and no DevToys/DevUtils naming here — that's `/compare` and the FAQ's job, not home's, per §3's "not hero/home narrative copy" rule. |

**Deliberately absent from home:** any social-proof section (stats, testimonials, download counts) —
explicitly reserved as a non-home, non-fabricated gap per the objection map (§3: "explicitly not a
stat, chart, or number anywhere else on the site"); any direct DevToys/DevUtils/DevTools-X naming or
comparison (§2c/§3: FAQ and `/compare` only); any "why trust a solo developer" section — that
argument is structural (the hero/subhead's whole job per §1), not a section of its own; any
Windows-unsigned/SmartScreen disclosure — that's the download page and FAQ's job (§3b), not home's;
a changelog/"recent activity" teaser — considered and rejected, see below.

### Revised twice: the Proof section, and why it moved

**First revision — the evidence.** A first pass showed the section's primary evidence as a
`$ nettop -x -l 0` terminal block, repeating "0 connections" once per tool. Developer feedback, twice:
nobody looking at a raw CLI command would read it as evidence of anything, technical or not — and a
second pass still didn't explain *how* that content would actually get maintained. Both problems
traced to the same root cause: the section led with a **procedure** (a test result) instead of a
**fact** (an architectural property).

Live-checked comparables (Apple's iMessage privacy copy, 1Password's security page, Signal's own
homepage) all make their core trust claim the same way: **"even we can't see it"** — an argument about
what the system *can* do, not a report of what a test *found*. Umbra's version is one step stronger,
since none of those three products lack a server; they merely lock themselves out of one. Umbra has no
server at all. Revised copy leads with that: *"There's no server for your data to go to"* next to a
plain two-box diagram (device — ✕ — server), legible without knowing what `nettop` is.

**Second revision — the secondary evidence.** The first fix still pointed a skeptical reader at "the
most recent result, last verified vX.X.X" — implicitly, a link to `docs/release-checklist.md` or its
recorded PR result. Developer's sharper objection: a markdown file the developer wrote themselves is
**self-reported**, not independent evidence — it doesn't actually prove anything to someone who doesn't
already trust the developer's word, which is the exact problem the section exists to solve. The fix
isn't a better link, it's a different kind of claim: **"don't take our word for it — check your own
copy,"** followed by a literal, copyable command (`nettop -p $(pgrep -x umbra)`) the visitor runs
*themselves*, on *their own* downloaded binary. This needs zero trust in anyone's reporting, past or
present, which is categorically stronger than any published log could be. Shipped as macOS-only in the
wireframe, with an explicit flag that Windows/Linux equivalents don't exist yet in this project's docs
and are needed before this section can ship for those platforms.

**The compliance-gap finding still stands, separately.** While checking the first version's "last
verified: vX.X.X" claim against real PRs (`gh pr list --search "nettop in:body"`), the nettop discipline
turned out to have lapsed after `v0.2.0` — neither `v0.4.0` (current stable) nor `v0.5.0-alpha.1` has a
recorded result. That finding is preserved in `landing-strategy.md` §5's 2026-09-19 correction under
ledger row 1, and is still a real pre-launch action item — it just no longer gates the home page's
Proof section directly, since that section's argument no longer depends on a published historical log.

**Order revision — why Proof moved from position 2 to position 4.** After the content rewrite, the
developer questioned the *placement*, not just the copy: opening the page with "let me prove I'm not
spying on you," right after the hero and before showing anything the product actually does, risks
reading as defensive in tone. Weighed against the original placement's rationale (§2 finding 6 — proof
is Umbra's real differentiator, so don't bury it) with no research settling it either way, a reordered
mock was built for direct comparison: Hero → Catalog → Workflow → Proof → Why Umbra → CTA. The
developer validated this order — the product now makes its full case (what it is, how fast it is)
before being asked to trust it, with Proof and Why Umbra landing back-to-back as the closing argument
right before the CTA.

### Rejected then replaced: "Recent activity" → "Why Umbra"

A second draft added a changelog-teaser section (dated shipping entries, modeled on zed.dev's "latest
from Zed") to answer the objection map's "will this be abandoned" question with evidence instead of a
promise. The developer rejected it for a reason specific to this project: it's a solo student project
built to learn, not a company, and the developer may stop working on it — a section whose entire
credibility depends on staying visibly active would read as dead the moment that happens, which is a
bad permanent dependency for a page meant to last.

Requested: something "more product and marketing oriented," floated as either a top-3-features
section or a before/after contrast — explicitly asked to be checked against **real big-SaaS landing
pages**, not just the dev-tool/indie comparables already used throughout this roadmap. Live-checked:
superhuman.com, hey.com, arc.net, linear.app (its mid-page section specifically, not the whole site).
No real "before/after" table pattern turned up among these; a **3-statement benefit strip** did,
independently, at both Arc ("Space for the different sides of you" / "Your perfect setup" / "The
comfort of privacy") and Linear ("Purpose-built" / "Powered by agents" / "Designed for speed") — bold
phrase, one sentence, no icons, no maintenance dependency. Adopted that shape. The three statements
chosen (free/no-account, the catalog's search+category design, updates-ask-first) deliberately avoid
re-covering ground Proof (privacy/architecture) and Workflow (speed) already own, and avoid restating
the "why trust a solo developer" argument this roadmap already keeps structural rather than explicit
(§1) — none of the three depend on the project's pace of future development to stay true.

### Decided: About page gets a full-weight nav link, not footer-only or a segmentation device

Between a footer-only link, a plain nav-bar link at the same weight as FAQ/Download, or an assertive
segmentation device (1Password's Business/Personal toggle, Doctolib's "Vous êtes soignant ?" pill —
`landing-strategy.md` §2b), the developer chose the plain nav-bar link. This resolves the question
`landing-ia.md` §2 explicitly deferred to this step ("how this page is reached... still open"). It's
a middle path: more visible than a footer-only link (which would under-serve a real secondary
audience the roadmap's own decisions table names — "recruiters second," not "recruiters hidden"),
but without the assertiveness of a segmentation device, which would imply two equally-weighted
audiences when the roadmap is explicit that developers are primary and recruiters are a distant
second. A plain link costs nothing in hero real estate and doesn't overstate the secondary
audience's priority.

### Decided: the workflow section ships, as video, before its asset exists

The developer confirmed a video belongs on the landing page (asked with one condition — that it not
cost the Lighthouse performance score) and asked what "one keystroke away" referred to: it's FR2's
global `⌘K` command-palette shortcut, and the section's content is literally `prd.md`'s own "5-minute
demo" scope anchor (line 27) — summon the palette, format JSON, decode a JWT, type a cron phrase —
not new copy to invent. Two things follow from this, both flagged forward rather than decided here,
since they're build-time, not narrative:

- **Video over GIF is the more performance-friendly choice, not a trade-off against one.** A
  compressed H.264/WebM video is typically far smaller than an equivalent-quality animated GIF for
  the same motion, and unlike a GIF it supports lazy-loading, a poster frame, and muted/no-autoplay —
  the concrete mechanisms that keep this section from hurting the Lighthouse budget Step 6.10 sets.
  This is a **correction to `README.md`'s Step 5.3 wording**, which named "a short demo GIF" — the
  format should be video, not GIF, for the developer's own stated reason (performance), and Step 5.3
  should produce it as such.
- **The section ships as a placeholder in the spine now and a real asset once Step 5.3 runs** — same
  pattern as every other section here that depends on an Epic-7/Step-5.3 capture. Step 6.10
  (performance budget) inherits the specific requirement: lazy-load, poster image, no autoplay, no
  sound-on-load.

### Not decided here, deliberately

- **Exact wording** of every section's copy — Phase 3's job (3.2 home copy, 3.3 proof copy), this
  step only fixes the order and each section's one-line purpose.
- **Visual layout and responsive behavior** of any section — Step 5.2's job. Section 2's wireframe
  treatment (search box, category pills, card grid) is explicitly not final — the developer signed off
  on the *structural decision* (search + categories over a flat grid), not the visual execution.
- **Whether the workflow video is self-hosted or embedded via a third-party player** (which changes
  the performance-budget mechanics materially) — Step 5.3/6.10's job, once the asset exists.
- **The feature-tour grid's exact visual treatment** (icons, card size, order of the 9 tools) —
  Step 5.2.
- ~~Section 2's cadence claim~~ **Resolved 2026-09-19 (Step 3.2)** — plain "9 tools," no cadence
  wording. See the table above.
- **Windows/Linux equivalents for Proof's self-check recipe** — the shipped wireframe only has the
  macOS `nettop` command; no equivalent steps exist yet in this project's docs for the other two
  platforms. Needed before Step 6.3 builds this section for non-macOS visitors.
- **When the nettop checklist gets re-run and recorded** against a current release, closing the gap
  `landing-strategy.md` §5 found — no longer gates the home page's Proof section (which now points
  visitors at a self-run check, not a published log), but is still an open, real action item for the
  release process itself.

### Feeds directly into

- **Step 2.4** (outlines for every other page) — home's spine is now fixed, so the remaining page
  outlines can cross-reference it (e.g. the FAQ knows it's the depth-absorber for proof/objection
  content home only teases).
- **Step 3.1/3.2** (voice spec, home copy) — write directly against this section order; Proof and
  Why Umbra are the closing argument, back to back, and should read as a pair.
- **Step 5.2** (layout) — consumes this order directly; the "screenshot/video teased immediately
  below the fold" instruction (§2 convention 3) is a layout constraint, not just a copy one.
- **Step 5.3** (product imagery) — gains a corrected asset requirement (video, not GIF, for the
  workflow section) and a second consumer beyond the Epic-7 fork already named there.
- **Step 6.3** (page build) — Proof's self-check recipe needs Windows/Linux equivalents researched
  and written before it can ship for those platforms; macOS-only as currently specified.
- **Step 6.10** (performance budget) — inherits the lazy-load/poster-frame/no-autoplay requirement
  for the workflow section, to be set *before* the video lands, per that step's own existing framing.
- **Step 2.5** (content model) — the feature-tour section and the workflow section's demo flow both
  read from `registry.ts` (ledger row 4); no new source of truth introduced here.
- **Step 8.1** (pre-launch checklist) — the nettop compliance gap (`landing-strategy.md` §5) is still
  a real item to close before launch, independent of the home page's own copy.

## §4 — Outlines for every other page (Step 2.4)

**Method:** working session. Scope is the pages `landing-ia.md` §1 confirmed but §2/§3 haven't
already fully specified — Home (§3) and About (§2, three elements + ledger rows 1/3/5/6 + `/about`,
already locked) are out of scope here. That's 19 pages after this step's own comparison-page decision
below turned 1 page into 4: Download, FAQ, Privacy, Legal notice, EULA, Changelog, 9 tool pages, and
4 per-competitor comparison pages. For each, this step names purpose, sections, and
what it must/must not claim, checked line-by-line against `landing-strategy.md` §3's objection map
("where it lives" column), §5's claim ledger (by row number), and §7's target-question list — the
same three sources §3 drafted home against. Lighter treatment than §2/§3 per `README.md`'s own
instruction for this step ("same treatment, lighter").

Two genuine forks turned up that `README.md`/`landing-ia.md` §1 didn't resolve in advance. Both are
decided below with reasoning, per this step's "genuinely delegable, with your sign-off at the end"
listing in `README.md`'s autonomy table — not left as open questions, but flagged for confirmation
rather than treated as silently locked the way §2's forks were after live research settled them.

### Download (`/download`)

| Section | Content |
|---|---|
| OS tabs | macOS / Windows / Linux, auto-detect + pre-select the visitor's platform (§2c's decided shape) |
| macOS panel | Single Download button — **no architecture dropdown** (corrected below), one-line signed-and-notarized reassurance, version/build metadata read live |
| Windows panel | Download button → §3b's blocking unsigned-build modal fires before the file downloads (`windows_unsigned_modal_shown`/`_proceeded`, §4's event table); best-effort framing line (ledger row 6) |
| Linux panel | Format note (`.deb`/`.rpm`/`.AppImage`), Download button, a short factual `chmod +x` note for AppImage — no modal, per §3/§3b's Linux-has-no-equivalent-gate finding |
| Per-platform availability | Reads `/releases/latest` live (ledger row 7); a platform absent from the current stable release reads "not yet available for [platform]," never a dead or broken button. **Added at Step 3.5:** paired with a "Watch on GitHub" link at the exact moment a visitor hits that wall — the same link the footer carries, see `landing-copy.md` §5. |
| EULA reference | One intro sentence linking to `/eula` — the OnyX precedent this file's §1 already chose (not a footer link, not per-button) |
| **Loading / fetch-failure / no-JS states** *(added at Step 3.5 — a real gap: this page's whole per-platform mechanism is a client-side fetch, and nothing had decided what a visitor sees before it resolves, if it fails, or if it never runs at all)* | Copy decided in `landing-copy.md` §5: a brief loading string while `/releases/latest` resolves, a fallback line pointing straight at the GitHub Releases page if the fetch fails, and a `<noscript>` fallback with the same link for a visitor with JavaScript disabled. |

**Must claim:** row 5 (macOS specifics), row 6 (Windows/Linux best-effort, unsigned), row 7 (live
per-platform resolution, no manual promotion), row 10 (never hardcode a version string).
**Must not claim:** platform parity across the three OSes; a Windows/Linux minimum OS version (row 8
is still unresolved — omit the line entirely rather than guess).

**Correction (caught by the developer, verified live): no architecture dropdown for macOS.** The
first draft of this outline gave macOS an "Intel vs. Apple Silicon" dropdown, copied from §2c's
jetbrains.com/pycharm research note without checking whether Umbra actually ships both. It doesn't:
`.github/workflows/release.yml` builds macOS with `--target aarch64-apple-darwin` only, and the live
`v0.4.0` release's assets (`Umbra_0.4.0_aarch64.dmg`, `.app.tar.gz`) confirm it — no `x86_64` artifact
exists. Ledger row 5 already said as much ("macOS 13+ (**Apple Silicon**)"); this outline
contradicted its own cited source. A single Download button is correct for macOS; an architecture
choice only applies if Umbra ever ships an Intel build, which isn't planned.

**Decided: no secondary CLI/build-from-source path.** §2 finding 4 named this as a gap other
comparables fill (`brew install devutils`, Zed's "Clone source" button) that nothing in the roadmap
had picked up. It doesn't transfer to Umbra: the repo is All Rights Reserved (ledger row 9) — a
visitor building from source without the developer's written consent isn't actually licensed the way
it is for devutils.com's or zed.dev's OSS repos, and offering that path here would contradict the
`/eula` this same page links to. This closes §2's flagged gap by explaining why the convention doesn't
apply, rather than adopting it by default imitation.

### FAQ (`/faq`)

**These are candidate topics, not a locked seven-question list.** They're every objection-map row
whose "where it lives" column (`landing-strategy.md` §3) names FAQ, pulled at the topic level rather
than as finished question sentences — the FAQ can ship with fewer of these (if one turns out better
answered elsewhere) or more (if Step 3.4 finds another objection worth surfacing directly). Exact
question wording, ordering, and final count are Step 3.4's job, not fixed here.

| # | Topic | What it needs to establish | Guard rail |
|---|---|---|---|
| 1 | Windows unsigned-build disclosure (SmartScreen) | Restates §3b's modal explanation in more depth, per §3b's own "if a FAQ page exists" note | Same informative, de-escalating register as the modal — not a bare "proceed at your own risk" |
| 2 | Source-available vs. open source (the ARR clarification) | What a visitor may and may not do with the public repo | Say **source-available**, never "open source" (ledger row 9) |
| 3 | Open-source/audit status | No to both, stated plainly | No audit claim — no audit artifact exists anywhere (ledger row 9) |
| 4 | Windows/Linux trust parity with macOS | Best-effort framing | Don't imply parity (ledger row 6) |
| 5 | Update behavior | Confirmation dialog; nothing installs without consent | Story 5.2 AC1/AC4 |
| 6 | Update-check vs. "zero network calls" | The one disclosed, consent-gated exception | State it as *the* exception, not omit it (ledger row 1) |
| 7 | Comparison to named competitors | Answered directly by name, linking out to the relevant comparison page(s) (see below) | Direct naming is sanctioned here specifically (§2c) — not a pattern to reuse in hero/home copy |
| 8 | Why not just use a free online/web-based tool instead? | The wedge claim (§1): nothing pasted or dropped ever leaves the device — a paste-and-hope web tool can't make that guarantee | General/catch-all only — links out to each `/tools/*` page's own tool-specific version (see below) rather than repeating it here |

**Must not claim anywhere on this page:** that "every release ships a published network-trace
result" — the ledger's 2026-09-19 correction (`landing-strategy.md` §5) found the checklist discipline
lapsed after `v0.2.0`. Topic 6 above should read as an architectural/procedural fact ("the check runs
each release, and update-checking is the one disclosed exception"), not a pointer to a specific
published log — the same fix the home Proof section already made.

### Privacy policy (`/privacy`)

Sections: **What this page covers** (the site only — links out to the README/in-app-Settings privacy
disclosure for the app's separate, zero-network-calls claim, row 1) · **Data collected** (the full §4
event list: `$pageview`, `download_clicked` with its `platform` property, the two modal events,
`notify_me_clicked`, plus PostHog's automatic properties) · **What's not collected** (no cookies, no
session recording, no third-party ad trackers, no accounts/email) · **Legal basis & your rights**
(GDPR — exact wording is Step 4.1's own CNIL-sourced research, not written here) · **Data controller &
contact** · **Changes to this policy**.

**Must claim:** the same fact ledger row 13's reworded footer disclosure states — this page is the
long-form version of that one sentence and must stay in sync with it, not drift into separate wording.
**Must not claim:** anything about the app's own privacy behavior — that's a different public surface
(row 1) with a different source of truth; blurring the two repeats the exact mistake Step 6.14 already
warned against for AI-crawler policy ("allowing crawlers on the site says nothing about the app").

### Legal notice (`/legal`)

Sections: **Publisher identity** · **Hosting provider** (Vercel) · **Contact** · **Intellectual-property
notice** (source-available status, cross-referencing both `/eula` and the repo `LICENSE`).

**Resolved at Step 4.2, more fully than this entry anticipated:** not just a home address —
`landing-legal.md` §2 found the current governing provision (LCEN Article 1-1, II, replacing the
repealed Article 6-III this entry's "requirements" phrasing was implicitly citing) lets a
non-professional publisher, which Umbra-web qualifies as, withhold their **entire identity**,
disclosing only the hosting provider (Vercel). Developer decided (2026-09-20): host-only, fully
anonymous — no name or handle. "Publisher identity" above ships with no placeholder to fill; see
`landing-legal.md` §2 for the full page and reasoning. The `CLAUDE.md` privacy-rule flag this entry
raised turned out moot for this section specifically (no personal detail is written to this page at
all) — it still applies to this page's **Contact** section, which is a separate, still-open GDPR
requirement, not an LCEN one.

### EULA (`/eula`)

Sections, short — ~7 clauses, per the OnyX precedent §1 already researched: **License grant**
(personal, non-commercial use) · **No redistribution** · **No reverse engineering or modification** ·
**"As-is," no warranty** · **Limitation of liability** · **Termination** · **Contact**.

**Must claim:** exactly Step 4.3's four points — personal use permitted, no redistribution, no reverse
engineering, provided as-is with no warranty.
**Must not claim:** any right to the source code itself — that's the repo `LICENSE` (All Rights
Reserved), a separate document this page cross-references rather than duplicates or contradicts.
**Linked:** once, from an intro sentence on the Download page — not the footer, not per-button (the
OnyX pattern, already decided in this file's §1).

### Changelog (`/changelog`)

Sections: per-version entries — version number, date, categorized changes (Added / Changed / Fixed),
sourced live from the GitHub Releases API and curated into a summary rather than a raw body dump
(Step 2.1's styling decision, "like a language/framework release-notes page").

**Must claim:** the backlog/cadence line (ledger row 11) only in its actual calendar-scoped form —
"September 2026 → March 2027," never restated as an indefinite promise. Same durable-claims discipline
as everywhere else on the site (`landing-strategy.md` §1's standing rule).
**Must not claim, structurally:** this is the one page whose entire credibility argument (sustained
activity) degrades automatically if entries stop appearing — worth naming here so Step 10.2
(changelog upkeep) inherits the stakes, not just the maintenance task.
**Open, not this step's job:** how curated per-version summaries stay in sync with raw release bodies
is Step 2.5's content-model decision.

### Comparison pages (`/compare/devtoys`, `/compare/devutils`, `/compare/devtools-x`, `/compare/cyberchef`)

**Decided (developer's call, overriding this session's earlier draft): separate per-competitor pages,
not one combined page.** The first draft of this outline proposed one combined `/compare` page,
reasoning from Step 3.7's single-table plan and the maintenance-burden logic that already killed a
blog idea (`landing-ia.md` §1b). The developer weighed that against the actual precedents this roadmap
already checked — `devutils.com`'s `/devutils_vs_cyberchef/` and `raycast.com`'s `/raycast-vs-alfred`,
both dedicated 1-vs-1 pages — and preferred the precedent: **four pages**, one per named competitor
(DevToys, DevUtils, DevTools-X, and CyberChef — the fourth name still carried forward from §7's
AI-baseline finding, not yet separately confirmed). Each page targets its own comparison query
("Umbra vs. DevToys," etc.) directly, which a combined page can't do as precisely for SEO/GEO purposes.

**The multi-column comparison table isn't cancelled — it's still an open feature, just not this
step's page-count decision.** The developer's own framing: separate pages "doesn't mean the comparison
table can't also be a feature." Step 3.7's planned matrix (Umbra vs. web-based formatters vs. other
desktop suites, all in one table) can still exist — as a section embedded on each per-competitor page
(a 2-column excerpt: Umbra vs. that one competitor), as a shared component reused across all four, or
as its own separate hub/index page linking out to the four detail pages. **Which of these is left open
here, flagged for Step 2.5 (content model) or a future session**, since it's a build/reuse decision
more than a page-existence one.

Per-page sections (shared template, mirroring the 9 tool pages' approach): **Intro line** (direct
naming sanctioned here, per §2c) · **Comparison content** (price, platforms, privacy/offline behavior,
tool count, source status, AI feature — as a mini-matrix, a narrative paragraph, or both, per the
open question above; Umbra's facts trace to specific ledger rows the way every other page's claims do)
· **Download CTA**.

**Must not claim:** anything false, stale, or unverified about the named competitor on each page —
these four pages introduce a citation discipline the claim ledger doesn't cover (competitor facts, not
Umbra facts), and it applies per page now, not once.
**Flag for Step 3.6** (ledger gate): that step's own pass checks Umbra's claims against the ledger by
number — it has no mechanism for checking competitor claims, and will silently skip these four pages'
content unless told to check each against a dated source instead.
**Linked from:** the footer (see the flag below — not currently in §3's locked footer list; with four
pages now instead of one, the footer link plausibly wants to point at a hub/index rather than four
separate entries — another argument for the open hub-page question above) and the FAQ's
comparison-to-named-competitors topic (#7 above).

### Online/web-tool comparison — distributed across the tool pages, not a fifth page

Raised by the developer after the four named-competitor pages were decided: those four answer "Umbra
vs. [desktop competitor]," but there's a separate query shape — "json online formatter," "jwt decoder
online" — searching for (or asking an assistant about) a *category* of free web tool, not a named
product. This is §7's own query 3 ("offline JSON formatter / JWT decoder... without internet") and the
objection map's already-flagged-but-never-placed row (`landing-strategy.md` §3, line 424: "How is this
different from a free web-based JSON formatter?" → "where it lives: Hero/positioning generally, not a
single answer point") — a real gap, correctly left structural back at Step 1.3 for the *broad* version
of the question, but never given a home for the *narrow*, per-tool version either.

**Decided: no fifth generic comparison page — the developer's own diagnosis.** A category has no
single product name to compare against, so a page titled "Umbra vs. online tools" would target a query
shape one page can't actually rank or answer well for nine different tool-specific phrasings at once.
Split instead:

- **The precise query lands on the precise tool page.** Every one of the 9 `/tools/*` pages below now
  carries a **mandatory** micro-FAQ entry — not just one of the "tool-specific pairs" already planned,
  a required one — answering "why not just use the free online version?" for that exact tool. A page
  named `/tools/json` is the natural home for "json formatter online" in a way a generic comparison
  page never would be.
- **The broad, non-tool-specific version** ("a dev-tools app where nothing I paste gets uploaded
  anywhere," §7 query 2) stays answered structurally on Home, per §1's wedge claim and §2c's preference
  for structural rebuttal over direct naming in persuasive copy — no new page needed for it.
- **A short catch-all bridges the two** — FAQ topic 8, added above — for a visitor who lands on `/faq`
  first rather than a specific tool page; it links out to each tool page rather than repeating the
  tool-specific answer.

### The 9 individual tool pages (`/tools/*`)

Shared template — content model (ledger row 4) drives all nine, so one outline covers all of them:

| Element | Content |
|---|---|
| H1 | Tool name, exactly as `registry.ts` names it (ledger row 4) |
| Opening sentence | Direct-answer-first, per §1b/Step 3.7's extractability technique — states the offline/local claim in full every time, never by pronoun ("Umbra's JSON formatter runs entirely offline," not "it does") |
| What it does | One functional paragraph, no implementation detail likely to drift |
| Visual | A screenshot of the tool in use — same Epic-7 asset dependency as home's imagery (Step 5.3) |
| Micro-FAQ | **One mandatory entry**: "why not just use the free online version?" (see above) · plus 1–2 more tool-specific Q&A pairs targeting §7-style query phrasing (e.g. "Does the JSON formatter work offline? Yes —") |
| CTA | Download button → `/download`, `download_clicked` fires with `$pathname` auto-captured (§4) |

Per-tool guard rails (current names, ledger row 4):

| Tool | Page | Guard rail |
|---|---|---|
| JSON | `/tools/json` | — |
| Base64 | `/tools/base64` | — |
| UUID | `/tools/uuid` | — |
| Hash | `/tools/hash` | — |
| JWT | `/tools/jwt` | — |
| Cron | `/tools/cron` | **Must not frame as AI or natural-language.** Ledger row 3a: Story 8.6 retired the NL→cron parser entirely. This is the single page most likely to accidentally reintroduce the stale `prd.md` line-18 framing. |
| Image to Text (OCR) | `/tools/ocr` | **The only tool page allowed to make the "even the AI is private" claim** (ledger row 3) — bundled ONNX model, zero network calls including first-use inference. |
| PDF | `/tools/pdf` | — |
| Images | `/tools/image` | — |

**Must not claim, across all nine:** fabricated usage stats or social proof of any kind — the
site-wide rule the objection map already sets (`landing-strategy.md` §3: "explicitly not a stat,
chart, or number anywhere else on the site") applies here as much as on home.

### Flags for the developer's sign-off (this step's own forks, not decided elsewhere)

1. **Comparison pages: four separate pages — decided.** CyberChef as the fourth compared name is
   still just carried forward from §7's baseline finding, not separately confirmed; and whether the
   Step 3.7 matrix becomes a per-page section, a shared component, or its own hub page is still open
   (see above) — flagging that sub-question, not the four-pages decision itself.
2. **Download page: no secondary CLI/build-from-source path** — decided against, for a licence reason
   (ARR forecloses it) rather than a design preference; confirm this reasoning holds.
3. **Footer link list needs updating for two reasons now, not one.** `landing-ia.md` §3's
   already-signed-off home spine names the footer's links as "FAQ, Privacy, Legal notice, EULA,
   Changelog, and About" — the comparison pages aren't in that list at all, and now that there are four
   of them instead of one `/compare`, the footer plausibly wants a hub link rather than four separate
   entries (tied to the open question above). The FAQ link into the comparison content (topic 7 above)
   works regardless of how this resolves.
4. **Legal notice's publisher-identity field** is a placeholder pending a real decision at Step
   4.2/3.4 — per `CLAUDE.md`'s privacy rule, nothing real was guessed at here.
5. **404 (not found) route — added at Step 3.5, not part of this step's original page list.** Not a
   marketing page in the sense the rest of this section's pages are (it doesn't need to justify itself
   against the audience the way §1's page-inventory test requires), but it's the one route every site
   inevitably serves and this roadmap had never named it. Cheap enough to close as a small addendum
   rather than open a dedicated step for it. Copy decided at `landing-copy.md` §5; visual layout is
   Step 5.2's job like every other page here.

### Not decided here, deliberately

- **Exact copy** for every page above — Phase 3's job (3.2 covers home/About already; 3.4 covers
  "remaining page copy," which is everything in this section).
- **Exact legal wording** for Privacy, Legal notice, and EULA — Phase 4's own CNIL/service-public
  research, not written here.
- **Visual layout** of any page — Step 5.2.
- **The comparison pages' actual data points and their citations** — Step 3.4 writes them, Step 3.6
  needs to check them against a source the way it checks Umbra's own claims against the ledger (see
  the flag above).
- **Whether the Step 3.7 multi-column matrix becomes a per-page section, a shared component across the
  four comparison pages, or its own hub page** — flagged above, not resolved here.
- **How changelog summaries and tool-page content stay in sync with their live sources** — Step 2.5's
  content-model job, named here as a dependency, not solved here.

### Feeds directly into

- **Step 2.5** (content model) — three new consumers beyond what §1/§2 already named: the changelog's
  curated-summary sync, the four comparison pages' competitor-fact sourcing (no live API exists for
  this one, unlike everything else in the ledger), and the 9 tool pages' shared template reading from
  `registry.ts`.
- **Step 3.4** (remaining page copy) — every page outlined above is that step's direct input list;
  the FAQ's topics are a starting point to pare down or extend, not a fixed seven.
- **Step 3.6** (ledger gate) — inherits the four comparison pages' citation gap flagged above; needs a
  parallel discipline for competitor facts, not just Umbra's own ledger-numbered claims.
- **Step 3.7** (extractability pass) — the tool pages' micro-FAQ pattern and the FAQ's own
  question-shaped headings both draw on §7's target-question list directly.
- **Step 4.1–4.3** (privacy policy, legal notice, EULA) — each has a section skeleton now; the legal
  research and exact wording remain that phase's job.
- **Step 5.2** (layout) — 19 page outlines to lay out, including the shared tool-page and
  comparison-page templates.
- **Step 5.3** (product imagery) — the 9 tool pages add 9 more screenshot slots to the same Epic-7
  fork already governing home's imagery.
- **Step 6.3/6.4** (page build, content model) — implements all 19 outlines; the tool-page and
  comparison-page templates and the changelog's live-source discipline are the build patterns worth
  reusing rather than hand-building each page.
- **Step 9.1** (GitHub cross-links) — the changelog page (outlined above) is the confirmed link
  target already named in §1/§2.

## §5 — Content model (Step 2.5)

**Method:** working session in `Umbra`, reading `umbra-web`'s actual current source live (not assumed
from this roadmap's own description of it) — `src/pages/index.astro`, `download.astro`,
`astro.config.mjs`, `package.json` — plus `Umbra`'s own `src/stores/registry.ts` and
`src/locales/en.json`, since those are the claim ledger's named sources of truth (row 4) that this
step has to decide *how the site reads*. Context7 (`/withastro/docs`) queried live this session for
Astro 7's current content-collections API — build-time loaders (`glob`, `file`, custom), and Live
Content Collections specifically — per Rule 6, since training data is a real risk here: Astro's content
config file moved from `src/content/config.ts` to `src/content.config.ts` in the Astro 6 upgrade, and
Live Content Collections graduated from an experimental flag to stable in the same release. Getting
either wrong from memory would have shipped a config Astro 7 actively errors on.

### The problem this step exists to solve, confirmed live

`index.astro` hardcodes a 7-entry `tools` array inline in the page's frontmatter — including `Bucket`,
a name Story 8.7 retired three stories ago in favor of `ocr`/`pdf`/`image` (ledger row 4). This is
Rule 4's "historical draft" warning made concrete, not a hypothetical: **the current live site is
already stale**, today, independent of anything this roadmap does next. `download.astro` has the
opposite problem — no hardcoded data to go stale, because it does almost nothing: one static link to
GitHub's own `/releases/latest` *page* (not the API), no per-platform branching, no version display.
Neither file reads from anything resembling a shared source.

**The harder finding: there is no shared source to read from, mechanically.** `registry.ts` is not
data — it's a Vue/Pinia store module, in a *different git repository*, whose entries embed
`component: () => import("../tools/json/JsonView.vue")`, live Vue component references `umbra-web`
has no reason to ever import (it has no Vue runtime, and shouldn't gain one for a static marketing
site). §1's row 4 names `registry.ts` as the tool list's "source of truth," which is correct for *what
tools exist and what they're named* — but it cannot be the site's literal data source the way a
same-repo content collection or a published API could be. Every decision below routes around that
constraint rather than papering over it.

### Decided: a local content collection is the tool-page/home-grid source, manually kept in sync with `registry.ts`

One `src/content.config.ts` collection (`tools`), Astro's `glob()` loader over
`src/content/tools/*.md` — one Markdown file per tool, frontmatter (`id`, `name`, `route`, `icon`,
`order`, `aiClaim: boolean`) validated by a Zod schema, Markdown body holding the page's actual prose
(opening direct-answer sentence, the "what it does" paragraph, the micro-FAQ entries `landing-ia.md`
§4 specifies). **Both** the home page's feature-tour grid and each `/tools/[id].astro` page
(`getCollection('tools')` / `getStaticPaths()`, Astro's standard collection-to-route pattern) read
this one collection — today's actual bug (`index.astro`'s array and any future tool-page content
independently hardcoded, silently drifting apart from each other) becomes structurally impossible,
not just less likely.

**Why a collection over a shared JSON file (the roadmap's other named option):** the prose body is the
real content on each `/tools/*` page, not the frontmatter — a bare JSON file would still need long
strings for the opening sentence, the "what it does" paragraph, and each micro-FAQ answer, which is
worse to author and diff than Markdown. The Zod schema is the concrete win a plain JSON import
doesn't give: a tool entry missing `route` or shipping a typo'd `icon` token fails the build, not a
future page render. This also directly enforces the `/tools/cron` and `/tools/ocr` guard rails
`landing-ia.md` §4 already named (no AI framing for cron; only OCR may make the "even the AI" claim,
ledger row 3) — the `aiClaim` field makes that a schema-checked fact per tool rather than a convention
an editor has to remember by hand on every future tool page.

**What this does *not* solve, stated plainly because it's this step's most consequential finding:**
keeping the `tools` collection in sync with `registry.ts` across the repo boundary is **necessarily a
documented manual sync**, not an automated one — there is no API, no published package, nothing
`umbra-web`'s build could fetch even if it wanted to, short of standing up new shared infrastructure
this roadmap's own `CLAUDE.md` process rule says not to reach for by default. Concretely recommended,
not built here: extend `registry.ts`'s own existing code comment (line 76 area, "Adding an entry also
means updating `docs/release-checklist.md`'s exercise list") to also name `umbra-web`'s
`src/content/tools/` collection — the same discipline the comment already establishes for one
cross-cutting consequence of adding a tool, applied to a second one. This is a one-line edit to
`registry.ts`, not a Step 2.5 deliverable; flagged for whoever implements Step 6.4.

### Decided: comparison pages get their own collection, with a mandatory dated citation field

`landing-ia.md` §4 already flagged this page group as a citation gap Step 3.6's ledger-gate pass has
no mechanism for (competitor facts, not Umbra facts). A second collection, `comparisons`
(`src/content/comparisons/*.md`, one file per competitor: `devtoys`, `devutils`, `devtools-x`,
`cyberchef`), with a **required, not optional**, `dateChecked` field in its Zod schema — a comparison
entry without a dated source simply fails validation. This is the same "visible dates on anything
time-sensitive" discipline §7 already specifies for extractability, applied here to close the specific
gap §4 named rather than leaving it as a future Step 3.6 problem. No live source exists for this
collection and none is being invented — it's 100% hand-authored and hand-re-verified, the same
live-browsing discipline `landing-strategy.md` §2's reference scan already modeled (don't trust
training-data recall of what a competitor's site currently says). **Maintenance trigger, flagged for
Step 10.1:** re-check each `comparisons` entry when its `dateChecked` is more than a few months stale,
or immediately if a competitor's own site is known to have changed.

### Decided: the changelog is a hybrid — mechanical facts from a live loader, curated prose by hand

The GitHub Releases API (`GET /repos/dipaneb/umbra/releases`) is public and genuinely fetchable at
build time — Astro 7's custom build-time loader API (confirmed via Context7 this session: a `load()`
function that populates the collection's data store, the same shape the docs' own remote-feed example
uses) is the right mechanism for the *mechanical* facts: version, date, prerelease flag, asset list.
This automatically satisfies ledger row 10 ("never hardcode a version string") for the changelog page
and anywhere else on the site that just needs to *display* the current version, without a live check on
every page load.

**What a loader must not attempt:** auto-generating the Added/Changed/Fixed categorized summary Step
2.1/2.4 already specified ("curated into a summary... not a raw body dump"). A raw GitHub release body
is unstructured prose the developer wrote for a different audience (release notes for someone already
tracking the repo) — mechanically re-bucketing its lines into Added/Changed/Fixed risks silently
miscategorizing a fix as a feature, which is exactly the kind of unforced, uncaught claim error this
whole roadmap's methodology exists to prevent (the same reasoning `landing-strategy.md` §5 already
applied to why a self-reported nettop log isn't good enough evidence — a plausible-looking automated
summary is still self-reported, just by a script instead of a person). **Decided:** a second, small,
hand-authored collection (`src/content/changelog/*.md`, one file per version, curated bullets in the
frontmatter or body) supplies the summary text; the changelog page cross-references it against the
live-loaded release list by version tag. A release present in the live fetch with no matching curated
entry yet renders a plain "release notes coming soon" placeholder rather than blocking the build —
curation lag becomes a visible gap to fill, not a broken deploy.

**The staleness this doesn't solve:** build-time data is fresh "as of the last deploy," and nothing
about a tag push to `Umbra` currently triggers a rebuild of the separate `umbra-web` project — the two
repos' CI is entirely disconnected today. Given the ~1–2 week release cadence (ledger row 11), a
changelog that only updates when someone happens to redeploy the site by hand could visibly lag by
that same window. **Recommended, not built here:** a small addition to `Umbra`'s own tag-triggered
`.github/workflows/release.yml` (confirmed this session: currently `push: tags: 'v*'` only, no
`workflow_dispatch`) — an added step that fires a Vercel Deploy Hook URL for `umbra-web` on a
successful release, closing the loop without asking the developer to remember a second, separate
action every release. This is a cross-repo CI change, flagged for Step 6.1/9.1, not authored in this
session.

### Decided (developer, 2026-09-19): the download page's per-platform check uses a client-side fetch

This is the one piece of content on the entire site where "as of the last deploy" genuinely isn't good
enough — ledger row 7's decided resolution is explicit that Windows/Linux must "start working
automatically the moment a stable tag carries their assets, with no further site change required,"
which a build-time collection cannot honor between deploys. Two real mechanisms exist, both confirmed
available and both currently unused by `umbra-web` (no adapter is installed today — `package.json`
lists only `astro` and `@astrojs/sitemap`, plain `output: 'static'`) — presented to the developer as a
trade-off table rather than defaulted, then decided directly:

| | Client-side fetch (decided) | Astro Live Content Collection (not used) |
|---|---|---|
| **What it is** | A small script in the shipped page calls `GET api.github.com/repos/dipaneb/umbra/releases/latest` directly from the visitor's browser and renders each platform's button once the response lands. | A `src/live.config.ts` collection with a custom loader hitting the same endpoint, queried via `getLiveEntry()` with `export const prerender = false` on just the download route — confirmed via Context7 this session as stable (not experimental) in Astro 7. |
| **Architecture cost** | None — the whole site stays `output: 'static'`, exactly as today. | Requires adding an on-demand-rendering adapter (e.g. `@astrojs/vercel`) and accepting one server-rendered route in an otherwise fully static site — a real, if small, architecture change for one page. |
| **Rate-limit exposure** | Each visitor's own browser IP absorbs GitHub's unauthenticated 60/hr limit — effectively never hit for a single page load, and scales with visitor count rather than against a single shared budget. | The server (or a shared edge function) makes the call on every request; at this site's traffic it's very unlikely to matter, but it's a shared budget rather than a per-visitor one. |
| **No-JS / crawler behavior** | Needs a sensible loading/fallback state (macOS — always available per row 5 — can render immediately; Windows/Linux show "checking…" until the fetch resolves). Not server-rendered, so a crawler sees the fallback state, not the live one. | Real HTML reflects current availability for any visitor or crawler, JS or not. |

**Reasoning the decision rests on:** the fact being displayed (which platforms currently have a
downloadable asset) isn't one of §7's target questions and isn't SEO-load-bearing the way a page's
core claim is — a crawler doesn't need this specific detail server-rendered. Keeping the whole site in
one rendering mode is the simpler thing for a developer new to both Astro and this kind of
download-flow architecture to reason about, and it keeps Step 6.10's performance budget in a single
predictable shape instead of two. **Verify before building (Step 6.3):** GitHub's REST API is expected
to permit unauthenticated cross-origin browser requests on public read endpoints, but this session did
not independently confirm that against GitHub's own API docs — the same "verify, don't assume"
discipline this roadmap applies everywhere else. If that turns out false, Live Content Collections is
the documented fallback, not a dead end — the trade-off table above stays valid either way.

### Decided: FAQ does not need a collection

Proportionate to what's actually repeating: the tool pages and comparison pages each generate *many
routes* from one shape, which is what makes a collection earn its schema/loader overhead. The FAQ is
one page rendering an ordered list of entries — a plain local data file (a `.ts`/`.json`/`.yaml`
array of `{question, answer}` imported directly into `faq.astro`) does the same job with no
`content.config.ts` entry, no loader, no generated route table. Not deciding this as a collection is
itself the decision worth recording, so a future session doesn't add one by default imitation of the
tool/comparison pattern above.

### Decided: Privacy, Legal notice, EULA, and About need no content model at all

Four one-off pages, each with a single, hand-written body and nothing that repeats across multiple
URLs — plain `.astro` files, the same shape `faq.astro`/`download.astro` already use today. Stated
explicitly so this step's scope doesn't overreach into pages that have no structured-data question to
answer.

### Not decided here, deliberately

- **The Zod schema fields themselves** (beyond the guard-rail-relevant ones named above, `aiClaim` and
  `dateChecked`) — Step 6.4's implementation job, not this one.
- **Whether the Vercel Deploy Hook recommendation gets built**, and its exact CI YAML — flagged for
  Step 6.1/9.1, not authored in this session.
- **Confirming GitHub REST API's CORS behavior for browser-origin requests** — flagged for Step 6.3 to
  verify live before implementing the decided client-side fetch.
- **The multi-column comparison matrix's placement** (per-page section, shared component, or hub page)
  — `landing-ia.md` §4 already left this open; this step's `comparisons` collection design works under
  any of those three outcomes, so it isn't re-litigated here.

### Feeds directly into

- **Step 6.3/6.4** (page build, content model implementation) — this section *is* Step 6.4's spec: two
  build-time collections (`tools`, `comparisons`), one hybrid live-loader-plus-curated collection
  (`changelog`), one plain data file (`faq`), a decided client-side fetch (`download`), and four pages
  needing no model at all.
- **Step 6.1** (domain migration) / **Step 9.1** (GitHub cross-links) — the recommended Vercel Deploy
  Hook is cross-repo CI work that plausibly belongs in whichever of these two steps ends up touching
  `Umbra`'s release workflow.
- **Step 6.10** (performance budget) — the decided client-side fetch keeps the whole site in one
  rendering mode (`output: 'static'`), so this step's budget doesn't need to account for a second,
  server-rendered mode.
- **Step 3.4/3.6** — the `comparisons` collection's mandatory `dateChecked` field gives Step 3.6's
  ledger-gate pass a concrete mechanism for the competitor-fact citation gap `landing-ia.md` §4 flagged
  and had no answer for.
- **`registry.ts`'s own code comment** (`Umbra`, not `umbra-web`) — recommended one-line extension,
  flagged for whoever implements Step 6.4, not made in this session.
