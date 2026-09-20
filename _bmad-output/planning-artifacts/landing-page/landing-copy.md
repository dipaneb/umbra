---
title: "Umbra — Landing Page Copy"
status: draft
created: 2026-09-19
updated: 2026-09-20 (Step 3.8 done — capability-differentiation pass, §9)
---

# Umbra — Landing Page Copy

> Companion to `_bmad-output/planning-artifacts/landing-page/README.md`'s Phase 3. Each `§` below
> corresponds to one roadmap step; later steps append their own `§`, they don't rewrite this one —
> same convention as `landing-strategy.md` and `landing-ia.md`.

## §1 — Web voice spec (Step 3.1)

**Method:** derived from `EXPERIENCE.md`'s Voice and Tone table (the in-app register, locked) and
`DESIGN.md`'s Brand & Style section (the register's own stated rationale — "precision instrument, not
an indie utility... professional, sharp, restrained," explicitly moved away from a "friendly little
utility" direction), extended with web-specific Do/Don't pairs against every section/page this
roadmap has already named in `landing-strategy.md` and `landing-ia.md`. Two genuine calibration
forks surfaced while drafting — put to the developer directly rather than defaulted, per `README.md`'s
autonomy table marking all of Phase 3 "yours by right"; both decided the same session (see below).

### Why this step exists, stated plainly (it's the actual job)

`EXPERIENCE.md` locks a voice for an app that **reports state** to someone already using it — an
instrument, not a salesperson. The landing page's job is different in kind, not just in content: it
has to **earn a click from a stranger who owes Umbra nothing yet.** Those are two different rhetorical
jobs. The translation this step has to make explicit: keep every guard rail the in-app voice enforces
(no exclamation marks, no cheerleading, no manufactured enthusiasm, name the actual effect rather than
a softer synonym) while allowing the *structure* of persuasion — specificity, benefit framing, one
idea per section — that an in-app error message or confirmation dialog never needed, because it was
never trying to convince anyone of anything.

### What carries over from `EXPERIENCE.md`, unchanged

| Rule | Source | Web application |
|---|---|---|
| No exclamation marks, no cheerleading, no "Oops!" — errors and confirmations read like an instrument reporting state | `EXPERIENCE.md` Voice and Tone | Applies to every register on the site, including the hero — this is the one rule persuasive copy does **not** get to relax |
| Name the actual effect, don't reach for a softer generic synonym (the "Clear stored data" vs. "Reset to default" discipline) | `EXPERIENCE.md` — the Settings "clear everything" worked example | The site's single CTA verb is **"Download,"** never "Get started," "Try it," or "Get Umbra" — it is literally a file download, and softening the verb would repeat exactly the mistake the in-app example corrected |
| A tool that can't confidently convert input says so and shows what it *did* understand, rather than guessing quietly (the error-message quality bar) | `EXPERIENCE.md` | Extends to the site's own failure/edge states — a platform not yet available, a stale link — state the actual condition, don't paper over it with a friendlier non-answer (see the Do/Don't table below) |
| Professional, sharp, restrained; orange (and by extension any visual/verbal flourish) is "a budget of one" — never a wash, never used for its own sake | `DESIGN.md` Brand & Style | The verbal equivalent: one claim per section (already the spine's shape, `landing-ia.md` §3), no stacking adjectives, no more than one exclamation-adjacent intensifier per page (ideally zero) |

### What's new for the web — marketing craft, inside the same restraint

The in-app voice never needed persuasion technique because the user was already there. The site does.
This section licenses technique, not tone:

- **Specificity over adjectives.** "9 tools, one keystroke away" beats "a powerful all-in-one
  toolkit." This is just the in-app "malformed base64 at segment 2" discipline aimed at a different
  sentence.
- **Benefit over feature — but never past what the claim ledger permits.** "Nothing you paste ever
  leaves your machine" (a benefit) is preferred over "local-only architecture" (a feature description)
  *only* where §5 of `landing-strategy.md`'s ledger actually supports the stronger phrasing.
  Specificity is a voice rule; truth is a ledger rule; this spec doesn't get to trade one for the
  other.
- **One idea per section.** Already the home spine's own shape (`landing-ia.md` §3) — this just names
  it as a voice principle so Phase 3's other pages inherit it too, not only home.
- **Structural rebuttal over direct naming, in persuasive copy only.** Already decided
  (`landing-strategy.md` §2c) — the hero/home narrative implies the rebuttal to "a private tool must be
  less convenient" without ever stating the doubt aloud. **This rule inverts on FAQ and comparison
  pages**, where direct naming and direct answering are the entire point (§2c; `landing-ia.md` §4's FAQ
  topic 7 and the four `/compare/*` pages) — the voice spec has to carry both registers, not average
  them into one.
- **No fabricated urgency or scarcity.** No countdown timers, no "only for early adopters," no
  "limited time." Not because Umbra ever had this problem, but because it's a common persuasive-copy
  reflex worth explicitly rejecting rather than avoiding only by accident — it would also read as
  transparently false for a free product with no launch window.
- **No superlative without a citation.** "The most private developer toolbox" is not a claim this site
  can make (nothing traces it to a ledger row); "nothing you paste ever leaves your machine" is,
  because Story 5.3's `nettop` result backs it. Treat every superlative as a claim-ledger check, not
  just a tone check — this is the same discipline Step 3.6 runs at the end of the phase, stated here
  as a drafting-time habit rather than only a gate.

### Extended Do/Don't table — web-specific pairs, by section/page type

| Section / page type | Do | Don't | Why |
|---|---|---|---|
| Hero / persuasive copy (home sections 1, 3, 5) | "Tools that stay on your machine. Even the AI." | "Say goodbye to privacy worries — forever!" | §1's locked headline direction; no exclamation mark, no forever-promise (durable-claims rule) |
| Feature tour | "9 tools, one keystroke away." | "The ultimate all-in-one toolkit you'll ever need!" | Specificity over adjective-stacking; no unfalsifiable superlative |
| Proof section | "There's no server for your data to go to." | "We take your privacy extremely seriously." | Architectural fact vs. unfalsifiable sentiment — `landing-ia.md` §3's own revision already made this exact fix once |
| Proof section (self-check) | "Run this on your own copy: `nettop -p $(pgrep -x umbra)`." | "Trust us — we've tested it thoroughly." | Independently verifiable instruction vs. self-reported assurance — the same fix `landing-ia.md` §3's second revision made |
| Windows unsigned-build modal | "This build isn't code-signed — that costs money we haven't spent yet on a free project. The warning you'll see next is standard for any unsigned app, not a finding about this one." | "Don't worry, it's totally safe! Just click through." | §3b's locked register: informative and de-escalating, not reassuring-as-sentiment. State mechanism and reason; don't perform reassurance the reader has no basis to believe yet |
| FAQ / direct-answer copy | "No. Umbra is source-available, not open source — you can read the code, you can't redistribute it." | "It's basically open source, just with a few restrictions." | Ledger row 9's exact terminology requirement; direct naming/answering is sanctioned here (§2c) |
| Comparison pages | "DevToys is free and cross-platform; as of [date], it doesn't ship a local OCR feature." | "DevToys can't compete with what Umbra offers." | Dated, falsifiable, non-disparaging — matches `landing-ia.md` §4's citation-discipline flag for these four pages |
| CTA labels | "Download" | "Get Umbra now!!" / "Try it free" | The "name the actual effect" rule — it's a download, not a trial, not a sign-up |
| "Notify me" copy | "Get notified on GitHub when a new release ships." | "Never miss an update! 🔔" | Same CTA discipline; also correctly describes the actual mechanism (GitHub Watch/Releases, §1) rather than implying an email list that doesn't exist |
| Legal / privacy / EULA | "Umbra collects anonymous page-view and download-intent analytics only. No cookies, no session recording." | "We respect your privacy 100%." | Plain factual register, not marketing register — this content type sits outside persuasive copy entirely |
| Platform-unavailable state | "Not yet available for Windows — check back after the next release." | "Coming soon! 🎉" | Same in-app "say what you actually understood" discipline applied to a site edge state |
| Download-page platform notes | "macOS 13+ (Apple Silicon), signed and notarized." / "Windows and Linux builds are best-effort — CI-built, lightly tested." | "Works everywhere!" | Ledger rows 5/6 — no implied cross-platform parity |
| Solo-developer transparency line (About/footer **only** — bounded exception, Fork B) | "Hey — I'm the one developer building and maintaining Umbra." | "The ultimate privacy-first toolbox, built by a passionate team! 🎉" | First-person warmth is licensed *here specifically* (Fork B) because it's what makes the trust signal land (§2b) — it does not license warmth anywhere else on the site, and "team" would also just be false |

### An open register `EXPERIENCE.md` doesn't cover: disclosure-under-pressure

The SmartScreen modal (§3b) is genuinely new territory, not a mechanical carryover. `EXPERIENCE.md`'s
table covers an instrument *reporting a fact* ("JWT signature invalid at segment 2") — it never had to
reassure anyone, because an app already running on the user's machine has nothing left to reassure
them about. The modal does: it's warning a visitor away from a download at the exact moment they
decided to trust Umbra. The resolution this spec adopts: **state the mechanism, state the reason,
state the action — zero reassuring adjectives.** "Standard for any unsigned app, not a finding about
this one" does the reassurance *by being a fact*, not by asserting a feeling ("safe," "fine," "nothing
to worry about"). This is the same move the Proof section makes (an architectural fact instead of an
assurance) applied to a warning instead of a claim — worth naming as one instance of a general pattern
this spec should probably restate explicitly: **wherever this site would be tempted to reassure, give
a fact that does the reassuring instead.**

### Standing rules this spec inherits and encodes as voice rules, not just legal ones

- **The durable-claims rule** (`landing-strategy.md` §1) — don't emphasize a fact true today but likely
  false tomorrow, even where it wouldn't strengthen the pitch. Already a copy rule in that section;
  restated here as a *voice* rule because it governs word choice ("free, no account," never "free
  forever") as much as content choice.
- **Claim-ledger traceability** (`landing-strategy.md` §5) — every specific number, superlative, or
  comparison in copy traces to a numbered ledger row. Step 3.6 checks this mechanically at the end of
  the phase; this spec asks every earlier drafting session to already be writing against it, not
  discover the violation at the gate.
- **No fabricated social proof** (`landing-strategy.md` §3's honesty-pass problem) — as a voice rule,
  not just a content rule: never write a number, a star, or a "loved by developers" sentence that
  isn't backed by something real. The honest alternative this project has available is solo-developer
  transparency framing (§2b's `meetsponsors.com`/DevToys precedent) — see the second open fork below
  for how far that framing is allowed to lean informal.

### Two forks — decided by the developer, 2026-09-19

**Fork A — decided: full persuasive craft, restrained tone.** Hero/home copy is licensed to use real
marketing technique — specificity, benefit-framing, one-idea-per-section — provided it never breaks the
no-exclamation-marks/no-cheerleading floor. This matches §1's own locked headline ("Tools that stay on
your machine. Even the AI.") and the reference-scan's aspirational comparables (Raycast, Linear —
minimal copy, but still doing real persuasive work through word choice and framing, not through plain
documentation prose). The alternative (documentation-plain even in the hero, letting facts alone
persuade with zero framing) was considered and rejected — it would have made the Proof section's
register the *only* register on the site, when Proof's job (prove a claim to a skeptic) and the hero's
job (earn attention from someone who hasn't decided to read yet) are different enough to warrant
different technique under the same tone ceiling.

**Fork B — decided: first-person warmth is licensed specifically for the solo-developer-transparency
line, nowhere else.** §2b's reference scan found two real precedents — DevToys' "Made with ❤️ by
[names], from Seattle and Paris" and meetsponsors.com's first-person "Hey, I'm Benjamin" — and the
developer confirmed this is the one place on the site where that register belongs, because it's what
actually made those two comparables read as trustworthy rather than corporate; a flat "Built and
maintained by one developer" would have been more consistent with the rest of this spec but would have
thrown away the one technique the reference scan found actually works for this specific claim. **This
is a bounded, named exception, not a crack in the no-cheerleading rule generally** — it applies only to
the solo-developer-transparency copy (About page / footer attribution), never to the hero, Proof,
FAQ, comparison pages, or any persuasive claim about the product itself. Exact wording (first-person
greeting vs. a warmer attribution line, whether it borrows DevToys' emoji or not) is Step 3.4/3.5's
job, not locked here — this step only licenses the register for that one spot.

### Not decided here, deliberately

- **Exact copy for any section** — Step 3.2 (home), 3.3 (proof), 3.4 (remaining pages), 3.5
  (microcopy). This step only fixes the rubric those steps get graded against.
- **The comparison-table format question** (`landing-ia.md` §4 — per-page section, shared component,
  or hub page) — a build/reuse decision, not a voice one.

### Feeds directly into

- **Step 3.2–3.5** (all remaining copy) — every draft gets checked against this rubric before Step 3.6
  checks it against the claim ledger; the two gates check different things (register vs. fact) and
  both matter.
- **Step 3.6** (ledger gate) — this spec's traceability rule is the voice-side mirror of that step's
  fact-side check.
- **Step 3.7** (extractability pass) — the "direct answer in the first sentence" GEO technique that
  step introduces has to still read in this voice, not slide into FAQ-bot flatness; worth re-checking
  this spec's Do/Don't table against 3.7's rewrites once they exist.

## §2 — Home copy (Step 3.2)

**Method:** iterative working session with the developer (2026-09-19), drafted against the home spine
(`landing-ia.md` §3) and this file's §1 voice spec, checked live against source (`CommandPalette.vue`,
`src-tauri`, `prd.md`'s NFRs, `DESIGN.md`'s documented WCAG exceptions) rather than assumed. Two
sections revised through several rounds each with direct developer feedback; both revisions are
significant enough to be corrections to *other* steps' outputs, not just this one — recorded below and
cross-referenced from `landing-ia.md` §3 itself. Proof section (spine position 4) deliberately not
drafted here — Step 3.3's job, per the roadmap's own separation.

### Scope correction found this session: French ships at launch, not deferred

**This is the single biggest correction of this step, and it isn't really about copy.** Drafting the
hero surfaced that the developer wants French shipping alongside English at launch — reversing the
roadmap's own locked decision ("English ships; i18n structure in place for a later French locale").
Corrected live in `README.md`'s decisions table and Step 6.5's entry (both now dated 2026-09-19); every
section below is written in both languages as a result, and every remaining Phase 3 step (3.3–3.7)
inherits the same requirement going forward, not just this one.

### Nav

`Umbra` (logo/wordmark) · **Tools** · FAQ · About · **[Download]** (CTA button)

**Correction found this session, not just a copy choice:** drafting the nav surfaced that the 4
comparison pages (`landing-ia.md` §1, row 10) had no path onto the site at all — not nav, not footer,
not linked from home, only a passing FAQ mention. Added a new page, `/tools` (a hub/index listing all 9
tools and linking out to all 4 comparisons), and a matching nav link, **Tools** — corrected in
`landing-ia.md` §1 (new row 11) and §3 (nav bar row) the same session. This closes a real discoverability
gap, not a preference call.

### 1 — Hero (locked, headline direction differs deliberately by language)

The developer ran a live, iterative comparison of headline candidates against a visual "funnel" layout
constraint (each line narrower than the one above, tapering to the CTA) — built as a design-canvas
Artifact (four EN/FR × two-headline-direction mockups at real type size) rather than judged from a
character-count table alone, since French runs longer than English for the same meaning and the taper
reads differently at real size. **Deliberate, not an inconsistency:** the two languages land on
different headline *directions*, not a translation of the same one — French took the literal wedge
statement, English took the terser three-beat version. A future session should not "fix" this into
matching.

**EN:**
> Local tools. Local AI.
> Nothing else.
>
> The tools you reach for every day, all bundled in one app, fully offline.

**FR:**
> Rien de ce que vous collez ne part jamais.
> Pas même pour l'IA.
>
> Les outils que vous utilisez déjà, tout réuni dans une app, et toujours hors ligne.

**Correction found while drafting the subhead:** an early draft used "one keystroke away" for the
convenience line. Checked live against `src/shell/CommandPalette.vue`
(`window.addEventListener("keydown", ...)`) and `src-tauri` (no `global-shortcut` Tauri plugin present)
— ⌘K only fires while Umbra's own window has OS focus. FR2's "global keyboard shortcut" (`prd.md`)
means global *within the app*, not a Spotlight/Raycast-style systemwide launcher; "one keystroke away"
implies the latter and isn't true. Replaced with "all bundled in one app" / "tout réuni dans une app" —
grounded in the actual audience-2 pain point `landing-strategy.md` §1 already names (re-searching the
web for the same tool every time), not the mechanism itself. An intermediate draft ("no menus to dig
through") was tried and rejected by the developer as not a relatable pain point ("nobody complains
about digging through menus") — worth noting as a real miss, not just a stepping-stone.

### 2 — Feature tour

**EN:** **9 tools** — heading only, no subcopy.
**FR:** **9 outils**

No cadence claim ("a new one every 1–2 weeks") — resolved by the developer this session, consistent
with why the same claim shape was already rejected twice elsewhere in this project (the Why Umbra
section below, and the killed changelog-teaser section, `landing-ia.md` §3). Corrected in
`landing-ia.md` §3 itself (the section's own heading and its "not decided" list).

Grid content (card labels/icons) reads live from `registry.ts` per the Step 2.5 content model — not
authored copy; individual `/tools/*` page copy is Step 3.4's job.

### 3 — Workflow ("Every tool, one search away" / "Chaque outil, à une recherche près")

**Correction to the section heading itself**, made and logged in `landing-ia.md` §3 the same session:
the spine's own heading was "One keystroke away" — the identical overclaim just fixed in the hero,
for the identical reason (⌘K is in-app only, not systemwide). Corrected there directly rather than
left as a copy-layer patch.

**EN:** *Press ⌘K from anywhere in Umbra. Format a JSON payload, decode a JWT, build a cron schedule —
the same shortcut, every time, without breaking flow to open a new tool.*

**FR:** *Appuyez sur ⌘K, depuis n'importe où dans Umbra. Mettez en forme un JSON, décodez un JWT,
programmez une tâche cron — le même raccourci, à chaque fois, sans jamais perdre le fil.*

"From anywhere in Umbra" / "depuis n'importe où dans Umbra" is doing double duty: it reads as a
convenience claim, but it's also precisely scoped to *inside the app*, which is the accuracy fix this
section needed. Also corrected in the same pass, in `landing-ia.md` §3: the demo flow's last beat is
"build a cron schedule," not "type a cron phrase" (`prd.md` line 27's own wording) — Story 8.6 retired
cron's free-text NL parser for a deterministic guided grid; the PRD line was already flagged stale by
ledger row 3a, this is where it actually got fixed in copy.

### 4 — Proof

**Not drafted.** Step 3.3's job — the differentiator, and the easiest place to overclaim, per the
roadmap's own separation of this from home copy generally.

### 5 — Why Umbra

**Revised twice from the roadmap's original plan, both times by the developer, both changes real
findings, not preference alone.**

**First revision — the content itself was wrong.** The original plan (`landing-ia.md` §3) named three
statements: free/no-account, the catalog's search+category design, and updates-ask-first. Developer's
objection: this isn't an argument for *choosing Umbra over a competitor* — most direct competitors are
also free with no account, and "has a search bar" isn't a differentiator anyone reacts to. Checked two
real, verifiable, previously-unused facts instead of reaching for adjectives:

- `NFR2` sets a cold-launch budget of under 2 seconds; Story 1.2 measured 386–829ms on a real release
  build, and Stories 8.7/8.8 both re-verify the budget explicitly every time a new tool (OCR, PDF) is
  added, keeping heavy work off the launch path. **Cited as "under 2 seconds," not the specific old
  millisecond figure** — that measurement predates several tool additions, and citing a stale exact
  number as current would repeat the same mistake this project's own ledger already caught once (the
  nettop-compliance lapse, `landing-strategy.md` §5).
- `NFR5` is a real, checkable accessibility baseline: full keyboard operability, visible focus states,
  labeled controls (VoiceOver-readable) — "from v1," not retrofitted.

**Second revision — the accessibility claim as first drafted was false.** A first pass included "WCAG
AA contrast" in the accessibility point. Developer's correction: `DESIGN.md` documents two specific,
accepted contrast exceptions (white on orange fills, white on dark-mode red per this project's own
`CLAUDE.md`) — a blanket "WCAG AA on every tool" claim is exactly the kind of overclaim the ledger
discipline exists to catch. Dropped the contrast claim entirely rather than soften it; the point now
only claims keyboard navigation and screen-reader labeling, which NFR5 backs without exception. The
developer also correctly separated this from the speed/mouse framing an earlier draft used ("built to
be used without a mouse") — accessibility is broader than keyboard-only, and contrast has nothing to
do with mouse use; folding both under one heading was a category error, fixed by making it one
general accessibility point.

**New pattern this section established, worth reusing:** headline vague/emotional (a goal or feeling,
not a technical claim), precise fact moved to the supporting sentence underneath. This is a genuine
addition to §1's voice spec for this specific format (a benefit-strip section), not a contradiction of
its "specificity over adjectives" rule — the specificity still exists, just relocated to the second
line rather than the headline.

**Count: four statements, not three.** `landing-ia.md` §3 originally locked this as a three-statement
strip (the Arc/Linear pattern). The developer explicitly asked to keep "free, no account" as a fourth
rather than force a cut — recorded as a deliberate deviation from that structural precedent, not an
oversight.

**Rust, deliberately included in point 1 despite already being planned for two other places** (the
Proof section's own planned "native-app/Rust line," `landing-ia.md` §3, and the About page's outcome
statements, `landing-ia.md` §2) — developer's explicit call after being shown the overlap; some
repetition of the site's one genuinely distinctive technical fact was judged worth it. Flag forward:
Proof's own copy (Step 3.3) sits immediately before this section in the spine and also plans a Rust
mention — worth deciding there whether to repeat it or vary the framing, now that it's known to
appear here too.

**EN:**
1. **Instant.** — A native Rust app, not a browser tab — cold launch measured under 2 seconds, and
   kept there as new tools are added.
2. **However you work.** — Full keyboard navigation and screen-reader-labeled controls, in every tool.
3. **Always your call.** — Every update is a confirmation, not a background install. Nothing changes
   without you saying so.
4. **No strings attached.** — Download and use it — no sign-up, no trial clock, no plan to pick.

**FR:**
1. **Instantané.** — Une application native en Rust, pas un onglet de navigateur — lancement mesuré à
   moins de 2 secondes, et maintenu à ce niveau à mesure que de nouveaux outils sont ajoutés.
2. **Adapté à chacun.** — Navigation complète au clavier et commandes étiquetées pour les lecteurs
   d'écran, sur chaque outil.
3. **Toujours votre décision.** — Chaque mise à jour est une confirmation, jamais une installation
   silencieuse. Rien ne change sans votre accord.
4. **Sans engagement.** — Téléchargez-le et utilisez-le — pas d'inscription, pas de période d'essai,
   pas de formule à choisir.

**Flagged, not resolved:** point 1's "native app" framing sits one section below Proof's own planned
"native-app/Rust" line (position 4, directly above this one in the spine) — real but minor adjacency
risk, not checked against a finished Proof draft since one doesn't exist yet.

**Dropped entirely, not softened:** "free, no account" as a *differentiator* framing — it isn't one,
most competitors also require no account. It survives only as point 4, framed plainly rather than as
a competitive argument; the objection-map's own routing already sends the fuller "is this free"
question to the Download page, so nothing is lost by not making it carry weight here.

### 6 — Closing CTA

Button: Download / Télécharger — same as hero. Platform-availability line simplified to the single
target-state string only, at the developer's request — the live per-platform fallback (what shows if
Windows/Linux aren't in a stable release yet) is Step 6.3's build-time concern, not a second copy
variant to carry here. If the fallback text is needed later, the voice spec (§1) already has it: "Not
yet available for Windows — check back after the next release," never "Coming soon."

**EN:** *Available for macOS, Windows, and Linux.*
**FR:** *Disponible pour macOS, Windows et Linux.*

### 7 — Footer

Structural links only (FAQ, Privacy, Legal notice, EULA, Changelog, About) — wording for the
attribution line, the analytics disclosure sentence, and the licence note stays Step 3.4/3.5's job, to
avoid locking phrasing against ledger rows those steps own.

### Not decided here, deliberately

- **Proof section copy** (spine position 4) — Step 3.3.
- **Individual `/tools/*` and `/compare/*` page copy**, and the new `/tools` hub page's own copy —
  Step 3.4.
- **Whether Proof (Step 3.3) repeats or varies its own planned Rust mention**, now that Why Umbra
  also has one — flagged above, not resolved.

### Feeds directly into

- **Step 3.3** (proof copy) — inherits the Rust-mention overlap flag above, and writes into a spine
  position now confirmed to sit directly above a section that already names the same fact.
- **Step 3.4** (remaining page copy) — the new `/tools` hub page needs copy; the download page's
  full-availability CTA line and the free/no-account claim both route here per this section's notes.
- **Step 3.6** (ledger gate) — the "under 2 seconds" and keyboard/screen-reader accessibility claims
  in Section 5 aren't on `landing-strategy.md`'s claim ledger yet, unlike everything else this project
  ships as a public claim; worth adding as rows (sourced to NFR2/NFR5) before this gate runs, so a
  later session doesn't have to re-derive where they came from.
- **`landing-ia.md` §1/§3** — carries the nav/Tools-hub-page correction and the Workflow
  heading/demo-flow correction; both already applied there directly, cross-referenced here rather
  than duplicated.

## §3 — Proof copy (Step 3.3)

**Status: accepted 2026-09-19, with reservations — record this honestly, not as full sign-off.** The
developer's own words: *"I'm not completely satisfied but I accept it for now as what it is."* Every
other step in this file and in `landing-strategy.md`/`landing-ia.md` closed with an iterative,
in-the-room reaction that reshaped the draft (§2's headline/layout rounds, the "Why Umbra" content
rewrite); this one got a single pass and a qualified acceptance, not that process. Recording the
distinction rather than letting this entry read like the others is itself the point — `landing-ia.md`
§3 made the same move for the nettop-checklist compliance gap ("a placeholder, not live copy") and the
project's own ledger discipline (`landing-strategy.md` §5) exists precisely so a later step doesn't
mistake "shipped" for "fully vetted." **What's specifically unresolved:** the developer didn't name a
concrete objection when accepting, so nothing here should be read as a fix already applied — if a
future session picks this up expecting notes to work from, there aren't any yet; the honest state is
"good enough to move on from, not good enough to call finished."

**Method:** read live this session, not from summary: `README.md` §Privacy (root of `Umbra`), `LICENSE`,
`docs/release-checklist.md`'s `nettop` procedure (`src/shell/updateSignal.ts`/`App.vue` traced to confirm
the update check fires **launch-only**, no manual "check now" trigger exists anywhere in the app — see
the correction below), and every ledger row and objection-map row the spine's own position-4 description
cites. Checked against `landing-copy.md` §1's Do/Don't table (row: "There's no server for your data to
go to." / "Run this on your own copy: `nettop -p $(pgrep -x umbra)`." — this section exists to execute
that exact pair of examples in full, not just gesture at them).

### Correction found while drafting: the self-check command needs one more instruction to actually work

`landing-ia.md` §3's spine entry names the self-check recipe as `nettop -p $(pgrep -x umbra)`, run
"on their own downloaded copy." Taken completely literally — run this command against an *already
running* Umbra — it will show **zero** connections, which reads as a pass but is actually a false
negative: `docs/release-checklist.md`'s own procedure exists specifically because the update check fires
once, at launch (`src/App.vue`'s `runCheck()` call, the only caller of `checkForUpdate()` anywhere in
`src/`), and `nettop` is a live monitor with no history — it can't show a connection that already
happened before it started capturing. A visitor who launches Umbra, *then* runs the command, sees a
technically-true-but-misleading "nothing here," and never encounters the one call the section is
supposed to disclose. The fix costs one clause, not a rewrite: tell the visitor to **quit and relaunch**
Umbra while the command is already running, the same ordering `docs/release-checklist.md` itself enforces
with its polling loop (simplified here, since a visitor doesn't need millisecond precision the way a
release-verification script does — being already-running when Umbra launches is enough for a human
watching the output). Applied in the draft below.

### Decided this session: the Rust/native-app line varies from "Why Umbra"'s, rather than repeating it

`landing-copy.md` §2 flagged this explicitly and left it open: Proof (this section) and Why Umbra
(spine position 5, directly below) both plan a Rust mention, and the two sections sit back-to-back in
the final spine order. Resolved here by giving each section a different job for the same fact, rather
than either cutting one or repeating the same sentence twice in a row:

- **Why Umbra's** Rust line (already drafted, §2) is about **speed** — cold-launch time, backed by
  NFR2/Story 1.2.
- **This section's** Rust line is about **architecture** — *why there is structurally no server to send
  data to*, not a policy choice that could quietly change. This is the stronger, more specific claim for
  *this* section's job (the privacy argument), and it doesn't overlap with the speed claim in substance,
  only in mentioning the same language once each.

### Decided this session: the macOS signing/notarization line ships here, kept to one sentence

`landing-strategy.md` §3's objection-map table lists "Home proof section (3.3)" as one of two places
the signed/notarized answer lives (alongside a one-line download-page reassurance, Step 3.4's job). This
is a different objection (trust in the binary you're about to run) from the section's lead claim (trust
in the architecture), so it's placed as a short supporting line rather than given equal weight to the
"no server" argument — the section still leads with, and is mostly about, the architectural claim per
the spine's own one-line purpose.

### Decided this session: the self-check is disclosed as macOS-only, not silently macOS-only

`landing-ia.md` §3 already flags that Windows/Linux equivalents don't exist in this project's docs yet
(a real gap for Step 6.3, not this step). The draft below states the limitation in the same voice-spec
register as the "platform-unavailable state" Do/Don't row (`landing-copy.md` §1) — a plain factual
disclosure, not silence and not an apology.

### The draft — EN

> **Verify it yourself**
>
> **There's no server for your data to go to — with one disclosed exception, an automatic check for
> app updates.** Umbra is a native app, not a client talking to a backend. What you paste, drop, or type
> is processed on the machine in front of you, by code running on that machine — there's nothing to
> intercept, because there's nowhere for it to go, except for that one exception: once, at launch, Umbra
> checks GitHub for a newer release, the single network call it ever makes, and nothing installs without
> you confirming it first.
>
> *[Diagram: your machine — ✕ — server. Visual execution is Step 5.2's job; this copy assumes the
> two-box treatment `landing-ia.md` §3 already specified.]*
>
> It's built this way structurally, not by policy: a native Rust application, compiled to a single
> binary, with no client-server architecture underneath it for anything to route through in the first
> place.
>
> The source is public — read it yourself. Umbra's repository is source-available: open the networking
> layer and confirm this isn't just asserted. (Source-available isn't open source — you can view the
> code, not redistribute or reuse it. More on that in the FAQ.)
>
> The macOS build is signed with a Developer ID certificate and notarized by Apple, so it opens with no
> Gatekeeper warning on a clean install.
>
> **Don't take our word for it.** Quit and relaunch Umbra while this is running, on your own downloaded
> copy:
>
> ```
> nettop -p $(pgrep -x umbra)
> ```
>
> You'll see one connection — the update check, at launch — and nothing else, no matter which tool you
> use. (macOS only. Windows and Linux instructions aren't written yet.)

### The draft — FR

> **Vérifiez-le vous-même**
>
> **Il n'y a aucun serveur vers lequel vos données pourraient partir — à une exception près, assumée :
> la vérification automatique des mises à jour.** Umbra est une application native, pas un client qui
> dialogue avec un serveur distant. Ce que vous collez, déposez ou tapez est traité sur la machine devant
> vous, par du code qui tourne sur cette machine — il n'y a rien à intercepter, puisqu'il n'y a nulle
> part où l'envoyer, à l'exception de celle-ci : une fois, au lancement, Umbra vérifie sur GitHub si une
> nouvelle version est disponible — le seul appel réseau qu'il effectue — et rien ne s'installe sans
> votre confirmation.
>
> *[Schéma : votre machine — ✕ — serveur. Exécution visuelle à l'étape 5.2 ; ce texte suppose le
> traitement à deux blocs déjà spécifié dans `landing-ia.md` §3.]*
>
> C'est une contrainte structurelle, pas un choix de politique : une application native en Rust,
> compilée en un seul binaire, sans architecture client-serveur sous-jacente vers laquelle quoi que ce
> soit pourrait transiter.
>
> Le code source est public — vérifiez-le vous-même. Le dépôt d'Umbra est *source-available* : vous
> pouvez ouvrir la couche réseau et constater que ce n'est pas qu'une affirmation. (« Source-available »
> n'est pas « open source » : vous pouvez consulter le code, pas le redistribuer ni le réutiliser — plus
> de détails dans la FAQ.)
>
> La version macOS est signée avec un certificat Developer ID et notarisée par Apple : elle s'ouvre sans
> avertissement Gatekeeper sur une installation neuve.
>
> **Ne nous croyez pas sur parole.** Quittez puis relancez Umbra pendant que cette commande tourne, sur
> votre propre copie téléchargée :
>
> ```
> nettop -p $(pgrep -x umbra)
> ```
>
> Vous ne verrez qu'une connexion — la vérification de mise à jour, au lancement — et rien d'autre, quel
> que soit l'outil utilisé. (macOS uniquement. Les instructions pour Windows et Linux ne sont pas encore
> rédigées.)

### Checked against the ledger, row by row

| Claim in the draft | Ledger row | Note |
|---|---|---|
| "the single network call it ever makes... nothing installs without you confirming it first" | Row 1 | Matches `README.md` §Privacy verbatim in substance; doesn't imply the check itself is confirmation-gated, only the install step, per row 1's own scope note |
| Source-available, not open source, view but not redistribute/reuse | Row 9 | Exact terminology used; no "independently audited" claim made anywhere |
| macOS signed/notarized, no Gatekeeper warning | Row 5 | Matches row 5's exact permitted scope |
| Rust/native/no client-server architecture | Not yet a ledger row — same gap `landing-copy.md` §2 already flagged for its own Rust mention (NFR2/NFR5 claims not yet in the ledger) | Architectural fact (the codebase is a Tauri/Rust desktop app with no server component), not a numeric or comparative claim — lower overclaim risk than §2's claims, but should still be added as a ledger row before Step 3.6 gates this page, for consistency |
| Self-check command and its scope (macOS only) | N/A — a verifiable instruction, not an assertion | Doesn't claim a result, invites the visitor to produce their own — the category of claim §5's ledger exists to police the least |

**Not claimed, deliberately, per row 1's 2026-09-19 correction:** any "last verified on vX.X.X" date or
pointer to a published historical `nettop` result. The compliance gap `landing-strategy.md` §5 found
(the checklist discipline lapsed after `v0.2.0`) is exactly why this section asks the visitor to run
their own check instead of citing a log — consistent with `landing-ia.md` §3's second revision, not a
new decision.

### Not decided here, deliberately

- **Exact heading/subhead typography, diagram execution, and section layout** — Step 5.2's job; this
  draft gives the diagram's content, not its visual form.
- **Windows/Linux self-check equivalents** — still don't exist in this project's docs; flagged again
  here rather than invented, per `landing-ia.md` §3's own open item. Needed before Step 6.3 can ship a
  non-macOS version of this section.
- **A ledger row for the "native, no client-server architecture" claim** — flagged in the table above,
  not added to `landing-strategy.md` §5 itself in this session (that file's own convention is that later
  steps append their own `§`, not edit earlier ones out of turn — worth raising explicitly before
  Step 3.6 runs).
- **Whether the developer wants the Rust/architecture line reworded or cut** given it's the section's
  most technical sentence on a page whose primary audience (per `landing-strategy.md` §1) is "any
  developer," not exclusively a systems-literate one — flagging the readability question rather than
  resolving it unilaterally.

### Feeds directly into

- **Step 3.4** (remaining page copy) — the download page's one-line signing/notarization reassurance
  (objection map, "Where it lives") should stay consistent with, not duplicate at length, this section's
  own signing line.
- **Step 3.6** (ledger gate) — the missing "native, no client-server architecture" ledger row (flagged
  above) should be added to `landing-strategy.md` §5 before this gate runs, alongside §2's already-flagged
  NFR2/NFR5 rows.
- **Step 5.2** (layout) — needs the device–✕–server diagram's visual execution.
- **Step 6.3** (page build) — needs Windows/Linux self-check equivalents researched before this section
  can ship for those platforms; macOS-only as drafted, same status `landing-ia.md` §3 already recorded.

## §4 — Remaining page copy (Step 3.4)

**Scope decided this session, not silently expanded or cut.** `README.md`'s own line for this step
names four things: Download, FAQ, the recruiter page, changelog framing. `landing-ia.md` §4 and this
file's own §2 (in their "feeds into" notes) later assumed 3.4 would also cover the 9 `/tools/*` pages,
the 4 `/compare/*` pages, and the new `/tools` hub page — but those notes were written in passing while
those steps were closing out, not a re-scoping of 3.4 itself. Treating README's own step definition as
authoritative: **this session writes Download, FAQ, About (the recruiter page), Changelog framing, and
the small `/tools` hub page** (cheap enough to close the same session, per §2's flag that it currently
has a nav link and no page at all). **Deliberately not written here:** the 9 tool pages' bodies and the
4 comparison pages. Reason, not just a punt — comparison pages need dated, sourced facts about named
competitors (`landing-ia.md` §4's own citation-discipline flag: "these four pages introduce a citation
discipline the claim ledger doesn't cover"), which is a research task shaped like Step 1.2, not a
copywriting task against material already on hand; folding that into this session would repeat the
exact category error this roadmap's rule 1 exists to prevent ("don't let a copywriting session drift").
The 9 tool pages are lower-risk but still nine full direct-answer-first passages plus micro-FAQs each —
real, separate effort. **Recommended next action:** a dedicated Step 3.4b (or two) for tool pages and
comparison pages respectively, each run as its own session per the roadmap's rule 1. Flagging this
explicitly rather than leaving the checklist read as "3.4 done, everything's written."

**Method:** working session (2026-09-19), drafted against `landing-ia.md` §4's page outlines (Download,
FAQ, Changelog) and §2 (About's three-element structure), this file's §1 voice spec, and checked line by
line against `landing-strategy.md` §5's claim ledger and §3's objection map — the same discipline §2/§3
used. Both languages written together throughout, per §2's standing correction (French ships at launch).

### Download (`/download`)

Structure per `landing-ia.md` §4's outline: OS tabs (auto-detect + pre-select), one panel per platform,
a live per-platform availability state, one EULA-reference sentence. Copy below is written as templates
where a value must be read live rather than hardcoded — ledger row 10's rule, and the same discipline
row 7 already established for this exact page.

**H1 / intro line**

- EN: **Download** — *Available for macOS, Windows, and Linux.*
- FR: **Télécharger** — *Disponible pour macOS, Windows et Linux.*

**EULA reference** (one sentence, linking once — not the footer, not per-button, per `landing-ia.md`
§4's OnyX-precedent placement):

- EN: By downloading, you agree to the [End User License Agreement](/eula).
- FR: En téléchargeant, vous acceptez le [Contrat de licence utilisateur final](/eula).

**macOS panel**

| Element | EN | FR |
|---|---|---|
| Button | Download for macOS | Télécharger pour macOS |
| Reassurance line | Signed and notarized by Apple — opens with no Gatekeeper warning. | Signée et notarisée par Apple — s'ouvre sans avertissement Gatekeeper. |
| Version metadata *(live, never hardcoded — row 10)* | Version `{latest release tag}` · Released `{release date}` | Version `{dernière version}` · Publiée le `{date de publication}` |

Kept to one sentence deliberately, consistent with `landing-copy.md` §3's own instruction not to
duplicate the Proof section's longer signing line — this is the short pointer, Proof is the full case.
**No architecture dropdown** — `landing-ia.md` §4 already corrected this; macOS ships Apple Silicon only.

**Windows panel**

| Element | EN | FR |
|---|---|---|
| Button | Download for Windows | Télécharger pour Windows |
| Best-effort line | Best-effort build: CI-built, lightly tested — not signed yet. | Build fourni à titre best-effort : généré automatiquement, peu testé — pas encore signé. |

Clicking the button opens §3b's blocking modal **before** the file downloads — the modal is the actual
disclosure; the panel's own line is a shorter standing note, same relationship as the macOS pair above.

**The unsigned-build modal** (fires `windows_unsigned_modal_shown` on open, `windows_unsigned_modal_proceeded`
on the primary action — `landing-strategy.md` §4's event table):

- EN — Title: *Before you download.* Body: "This build isn't code-signed — that costs money we haven't
  spent yet on a free project. When you run it, Windows will show a 'Windows protected your PC' warning.
  That's standard for any unsigned app, not a finding about this one. To open it: click **More info**,
  then **Run anyway**." Buttons: **Continue download** / Cancel.
- FR — Titre : *Avant de télécharger.* Texte : « Ce build n'est pas signé numériquement — cela
  représente un coût que nous n'avons pas encore engagé pour un projet gratuit. À l'exécution, Windows
  affichera l'avertissement « Windows a protégé votre ordinateur ». C'est le comportement standard pour
  toute application non signée, pas un signal propre à Umbra. Pour l'ouvrir : cliquez sur **Plus
  d'informations**, puis **Exécuter quand même**. » Boutons : **Continuer le téléchargement** / Annuler.

Matches the voice spec's locked register (`landing-copy.md` §1's Do/Don't row) word for word in
substance: mechanism, reason, action — no reassuring adjective.

**Linux panel**

| Element | EN | FR |
|---|---|---|
| Format note | Available as `.deb`, `.rpm`, or AppImage. | Disponible en `.deb`, `.rpm`, ou AppImage. |
| Button | Download for Linux | Télécharger pour Linux |
| AppImage note | Using the AppImage? Run `chmod +x` on it first, or enable "Allow executing as program" in your file manager's properties. | Vous utilisez l'AppImage ? Exécutez d'abord `chmod +x` dessus, ou activez « Autoriser l'exécution du fichier comme un programme » dans les propriétés de votre gestionnaire de fichiers. |

No modal for Linux — §3b's own finding: no OS-level gate exists for a directly downloaded
`.deb`/`.rpm`/`.AppImage`, so a blocking interstitial here would manufacture a warning that doesn't
exist, the exact mistake §3b caught and corrected once already.

**Per-platform availability state** (ledger row 7 — reads `/releases/latest` live; a platform absent
from the current stable release reads as not-yet-available, never a dead button):

- EN: *Not yet available for {platform} — check back after the next release.*
- FR: *Pas encore disponible pour {plateforme} — repassez après la prochaine version.*

Exact wording already locked in this file's §1 Do/Don't table ("platform-unavailable state" row); reused
here verbatim rather than redrafted, since inventing a second phrasing for the same state would be its
own small inconsistency.

**Not stated anywhere on this page, deliberately:** a Windows/Linux minimum OS version (ledger row 8 —
still no source to cite) and any architecture choice for macOS (no Intel build exists).

### FAQ (`/faq`)

Seven Q&A pairs covering `landing-ia.md` §4's eight candidate topics — topics 2 ("source-available vs.
open source") and 3 ("audit status") are answered as one pair below, since they're the same visitor
question in practice ("is this open source") and splitting them read as artificially thin; every fact
from both topics is still present. Order follows the outline's own topic order. **An eighth pair was
added at Step 3.7** (below, after entry 7) — not one of `landing-ia.md` §4's original candidate topics,
but a real gap that step's extractability audit found: none of the seven answered the verification
question directly, even though it's what the home page's Proof section spends a whole section arguing.

**H1 / intro**

- EN: **FAQ** — *Common questions, answered directly.*
- FR: **FAQ** — *Questions courantes, avec une réponse directe.*

**1 — Windows SmartScreen warning**

- EN — Q: *Why did Windows warn me this file might be dangerous?* A: Windows shows a "Windows protected
  your PC" warning for any app that isn't code-signed — and Umbra's Windows build currently isn't.
  Code-signing needs a certificate that costs money to buy and renew every year, which hasn't been
  justified yet for a free project with no revenue. This isn't a finding about Umbra specifically; it's
  Windows' standard response to any unsigned `.exe`. To open it: click **More info**, then **Run anyway**.
- FR — Q : *Pourquoi Windows m'a-t-il averti que ce fichier pourrait être dangereux ?* R : Windows affiche
  l'avertissement « Windows a protégé votre ordinateur » pour toute application non signée numériquement
  — et le build Windows d'Umbra ne l'est pas encore. La signature de code nécessite un certificat payant,
  à renouveler chaque année, ce qui n'a pas encore été justifié pour un projet gratuit sans revenu. Ce
  n'est pas un signal propre à Umbra ; c'est la réponse standard de Windows à tout `.exe` non signé. Pour
  l'ouvrir : cliquez sur **Plus d'informations**, puis **Exécuter quand même**.

**2 — Open source and audit status**

- EN — Q: *Is Umbra open source?* A: No — Umbra is source-available, not open source. The repository is
  public, so you (or anyone) can read the code and confirm what it does, including the networking layer.
  But the licence is All Rights Reserved: nobody has the right to copy, modify, redistribute, or reuse it
  without written permission. There's also no formal third-party audit — the closest thing is the
  network-monitor check described on the home page's "Verify it yourself" section, which you can run
  yourself against your own downloaded copy.
- FR — Q : *Umbra est-il open source ?* R : Non — Umbra est *source-available*, pas open source. Le dépôt est
  public, donc vous (ou n'importe qui) pouvez lire le code et vérifier ce qu'il fait, y compris la couche
  réseau. Mais la licence est *All Rights Reserved* : personne n'a le droit de copier, modifier,
  redistribuer ou réutiliser le code sans autorisation écrite. Il n'existe pas non plus d'audit formel par
  un tiers — ce qui s'en approche le plus est le contrôle réseau décrit dans la section « Vérifiez-le
  vous-même » de la page d'accueil, que vous pouvez exécuter vous-même sur votre propre copie.

**3 — Windows/Linux trust parity**

- EN — Q: *Are the Windows and Linux builds as trustworthy as the macOS one?* A: Not in the same way —
  Umbra's Windows and Linux builds are best-effort, while macOS is the primary platform: fully tested,
  signed with a Developer ID certificate, and notarized by Apple. Windows and Linux are built by the same
  release pipeline, but not tested on a second machine the way macOS is, and the Windows build isn't
  code-signed yet.
- FR — Q : *Les builds Windows et Linux sont-ils aussi fiables que la version macOS ?* R : Pas de la même
  façon — les builds Windows et Linux d'Umbra sont fournis à titre best-effort, tandis que macOS est la
  plateforme principale : entièrement testée, signée avec un certificat Developer ID, et notarisée par
  Apple. Windows et Linux sont générés par le même pipeline de publication, mais pas testés sur une
  seconde machine comme macOS l'est, et le build Windows n'est pas encore signé.

**4 — Update behavior**

- EN — Q: *Does updating Umbra install anything without asking me?* A: No. Every update shows a
  confirmation dialog before anything installs. If you decline, Umbra keeps running exactly as it was —
  nothing changes without you saying so.
- FR — Q : *La mise à jour d'Umbra installe-t-elle quelque chose sans me demander ?* R : Non. Chaque mise
  à jour affiche une boîte de dialogue de confirmation avant toute installation. Si vous refusez, Umbra
  continue de fonctionner exactement comme avant — rien ne change sans votre accord.

**5 — Update check vs. "zero network calls"**

- EN — Q: *Doesn't checking for updates break the "zero network calls" promise?* A: The update check is
  Umbra's one disclosed exception to that promise. Once, at launch, Umbra checks GitHub for a newer
  release — that's the only network call it ever makes, and it's the same call named in the home page's
  "Verify it yourself" section. Only the install step itself waits for your confirmation; the check runs
  automatically.
- FR — Q : *La vérification des mises à jour ne contredit-elle pas la promesse « zéro appel réseau » ?*
  R : La vérification des mises à jour est l'unique exception assumée à cette promesse. Une fois, au
  lancement, Umbra vérifie sur GitHub si une nouvelle version existe — c'est le seul appel réseau qu'il
  effectue, le même que celui décrit dans la section « Vérifiez-le vous-même » de la page d'accueil.
  Seule l'étape d'installation attend votre confirmation ; la vérification, elle, se fait automatiquement.

**6 — Comparison to named competitors**

- EN — Q: *How is Umbra different from DevToys, DevUtils, or DevTools-X?* A: The short version: Umbra
  leads with one narrow claim none of them make the same way — a per-release check showing zero network
  calls, not just a sentence asserting privacy. The full, sourced comparisons live on their own pages:
  [DevToys](/compare/devtoys), [DevUtils](/compare/devutils), [DevTools-X](/compare/devtools-x),
  [CyberChef](/compare/cyberchef).
- FR — Q : *En quoi Umbra diffère-t-il de DevToys, DevUtils ou DevTools-X ?* R : En bref : Umbra met en
  avant une revendication précise qu'aucun des trois ne fait de la même façon — une vérification à chaque
  version montrant zéro appel réseau, pas seulement une phrase affirmant le respect de la vie privée. Les
  comparaisons complètes et sourcées sont disponibles sur leurs propres pages :
  [DevToys](/compare/devtoys), [DevUtils](/compare/devutils), [DevTools-X](/compare/devtools-x),
  [CyberChef](/compare/cyberchef).

**7 — Free online tools (catch-all)**

- EN — Q: *Why not just use a free online JSON formatter or JWT decoder instead?* A: Because anything you
  paste into a web tool leaves your machine, even briefly — you're trusting a server you don't control
  and can't inspect. Umbra runs entirely on your device: nothing you paste, drop, or type is ever sent
  anywhere. Each tool has its own page with more on this for that specific format: [JSON](/tools/json),
  [Base64](/tools/base64), [UUID](/tools/uuid), [Hash](/tools/hash), [JWT](/tools/jwt),
  [Cron](/tools/cron), [Image to Text](/tools/ocr), [PDF](/tools/pdf), [Images](/tools/image).
- FR — Q : *Pourquoi ne pas simplement utiliser un formateur JSON ou un décodeur JWT gratuit en ligne ?*
  R : Parce que tout ce que vous collez dans un outil web quitte votre machine, même brièvement — vous
  faites confiance à un serveur que vous ne contrôlez pas et ne pouvez pas inspecter. Umbra fonctionne
  entièrement sur votre appareil : rien de ce que vous collez, déposez ou tapez n'est jamais envoyé
  ailleurs. Chaque outil a sa propre page avec plus de détails pour ce format précis :
  [JSON](/tools/json), [Base64](/tools/base64), [UUID](/tools/uuid), [Hash](/tools/hash),
  [JWT](/tools/jwt), [Cron](/tools/cron), [Image to Text](/tools/ocr), [PDF](/tools/pdf),
  [Images](/tools/image).

**8 — Verifying the privacy claim yourself** *(added at Step 3.7 — closes a real extractability gap, not
a copy-polish addition; see §8 for why)*

- EN — Q: *Is there a way to check that Umbra actually isn't sending my data anywhere, rather than just
  trusting what it says?* A: Yes — run a network monitor while Umbra is running and watch what it
  actually does, on your own downloaded copy, instead of taking the claim on faith. On macOS: quit and
  relaunch Umbra while `nettop -p $(pgrep -x umbra)` is already running in a terminal. You'll see exactly
  one connection — the update check, at launch — and nothing else, no matter which tool you use. (macOS
  only; Windows and Linux instructions don't exist yet.) The full reasoning is on the home page's
  "Verify it yourself" section.
- FR — Q : *Existe-t-il un moyen de vérifier qu'Umbra n'envoie vraiment aucune donnée nulle part, plutôt
  que de simplement croire ce qu'il affirme ?* R : Oui — exécutez un moniteur réseau pendant qu'Umbra
  tourne, sur votre propre copie téléchargée, et observez ce qu'il fait réellement plutôt que de le
  croire sur parole. Sur macOS : quittez puis relancez Umbra pendant que `nettop -p $(pgrep -x umbra)`
  tourne déjà dans un terminal. Vous ne verrez qu'une seule connexion — la vérification de mise à jour,
  au lancement — et rien d'autre, quel que soit l'outil utilisé. (macOS uniquement ; les instructions
  pour Windows et Linux n'existent pas encore.) Le raisonnement complet se trouve dans la section
  « Vérifiez-le vous-même » de la page d'accueil.

**Note, not a content gap:** entries 6 and 7 link to pages this session didn't write (comparison pages,
tool pages). The FAQ answers stand on their own without those pages existing yet; the links are inert
until Step 3.4b ships them, same as any other forward reference this roadmap already carries (e.g. §3's
Windows/Linux self-check placeholder).

### About (`/about` — the recruiter page)

Structure locked at `landing-ia.md` §2: mission line, 4–5 outcome statements, footer attribution. No
section headers, no audit/process vocabulary, no personal bio — restated as plain outcomes per that
step's own resolution (see §2 for why the two other forks were rejected).

**Mission line**

- EN: Umbra is a small, local-first toolbox for the tools developers reach for every day — built to run
  entirely on your machine, with nothing else assumed.
- FR: Umbra est une petite boîte à outils locale pour les outils que les développeurs utilisent au
  quotidien — conçue pour fonctionner entièrement sur votre machine, sans rien présupposer d'autre.

**Outcome statements (four, ledger rows 1, 3, 5, 6)** — headline as a plain outcome, one supporting
sentence with the actual fact underneath, the same headline/support split `landing-copy.md` §2's "Why
Umbra" section established:

1. EN: **It's fast because there's no browser bundled inside it.** A native Rust core drives the app
   directly — unlike an Electron-style app, it doesn't ship its own copy of Chromium — so it opens and
   responds like a small program should.
   FR: **Il est rapide parce qu'aucun navigateur n'est embarqué à l'intérieur.** Un cœur natif en Rust
   fait tourner l'application directement — contrairement à une application de type Electron, elle
   n'embarque pas sa propre copie de Chromium — pour s'ouvrir et répondre comme un vrai petit programme.
2. EN: **The Mac build is checked by Apple before you ever see it.** Signed with a Developer ID
   certificate and notarized by Apple.
   FR: **La version macOS est vérifiée par Apple avant même que vous la voyiez.** Signée avec un
   certificat Developer ID et notarisée par Apple.
3. EN: **Nothing you use it for is sent anywhere.** The app makes no network calls except one,
   disclosed — the check for a new version — and you can confirm it yourself with a network monitor
   while it runs.
   FR: **Rien de ce que vous en faites n'est envoyé où que ce soit.** Sauf pour une exception assumée —
   la vérification d'une nouvelle version — l'application ne fait aucun appel réseau, et vous pouvez le
   vérifier vous-même avec un moniteur réseau pendant qu'elle tourne.
4. EN: **Windows and Linux are labeled honestly, not oversold.** They work, but they're tested less than
   the macOS build, and that's said plainly rather than implied otherwise.
   FR: **Windows et Linux sont présentés honnêtement, sans enjoliver.** Ils fonctionnent, mais sont moins
   testés que la version macOS, et cela est dit clairement plutôt que sous-entendu.

Kept to four, not five — the OCR/local-AI fact (ledger row 3) was drafted as a fifth and cut: it's
already the hero's headline claim and gets a full page of its own reasoning in Proof (§3); repeating it
a third time on a page whose whole point is *plain, non-repetitive* facts read as padding rather than a
new outcome. Flag for a future session if the developer wants it back.

**Footer attribution** (site-wide, per `landing-ia.md` §2 — wired once into `Layout.astro`, not
page-specific content; Fork B licenses first-person warmth here specifically):

- EN: Hey — I'm ⟨developer name⟩, the one person building and maintaining Umbra.
- FR: Bonjour — je suis ⟨nom du développeur⟩, seul aux commandes du développement et de la maintenance
  d'Umbra.

**Decided: greeting, no emoji.** Fork B's two precedents (DevToys' "❤️," meetsponsors.com's plain "Hey,
I'm Benjamin") left both the emoji and the exact register open. Chose the plain first-person greeting
without an emoji — closer to meetsponsors.com's version — since an emoji sits closer to the "cheerleading"
floor §1's voice spec holds everywhere else on the site, and this section only needed the warmth of
first-person address to do its job, not a visual flourish too.

**Privacy-rule flag, not a copy gap:** `⟨developer name⟩` is a literal placeholder, per `CLAUDE.md`'s
rule against writing a real name into a file this session could commit. Filling it in is the
developer's own decision at build time (Step 6.2/6.3), not guessed at here — same handling
`landing-ia.md` §4 already used for the legal notice's publisher-identity field.

### Changelog (`/changelog`) — framing only

Per-version entries are live-sourced and curated (Step 2.5's content model) — not authored copy. This
step's job is the page's static frame and the curation voice, not the entries themselves.

**H1 / intro**

- EN: **Changelog** — *What's shipped, pulled straight from GitHub releases.*
- FR: **Journal des modifications** — *Ce qui a été livré, directement depuis les releases GitHub.*

**Cadence line** (ledger row 11 — calendar-scoped, never restated as an indefinite promise, per §1's
durable-claims rule):

- EN: One small tool or improvement roughly every one to two weeks, September 2026 through March 2027.
- FR: Un petit outil ou une amélioration environ toutes les une à deux semaines, de septembre 2026 à
  mars 2027.

**Per-entry template** (the format a curated entry follows, not real content):

```
v{version} — {date}
Added: {…}
Changed: {…}
Fixed: {…}
```

**Curation voice rule:** a category with nothing in it is omitted entirely, never shown as "None" — the
same "say the actual condition, don't pad it" discipline §1's voice spec already applies to platform-
unavailable states. Entries are categorized summaries of the release body, not a raw dump (`landing-ia.md`
§4's own instruction) — one clause, present tense, no marketing framing ("Added JSON schema validation,"
not "Now with powerful new schema validation!").

**Link to full detail:** EN: *Full release notes on GitHub.* FR: *Notes de version complètes sur
GitHub.* — pointing at the repo's Releases page, per Step 9.1's planned cross-link.

### `/tools` hub page — small enough to close this session

Flagged by `landing-copy.md` §2 as a real gap (nav link with no destination) rather than a page this
step was originally asked to write — closing it here since it's a single intro line plus a
content-model-driven grid, not new drafting effort on the scale of the 9 individual tool pages.

**H1 / intro**

- EN: **Tools** — *Nine everyday developer tools, bundled into one local app. Press ⌘K from anywhere in
  Umbra to jump straight to any of them.*
- FR: **Outils** — *Neuf outils du quotidien, réunis dans une seule application locale. Appuyez sur ⌘K
  depuis n'importe où dans Umbra pour accéder directement à l'un d'eux.*

Grid content (names, icons, links to each `/tools/*` page) reads live from the same content-model
collection the home feature-tour grid uses (Step 2.5) — not authored here. Comparison-page links, per
`landing-ia.md` §4's open hub-question, are **not** placed on this page — `/tools` is the tool index,
`/compare/*`'s own hub-vs-footer placement is still open and shouldn't be resolved by accident here.

### Checked against the ledger and objection map

| Claim in this section's copy | Ledger row / objection-map source | Note |
|---|---|---|
| macOS signed/notarized | Row 5 | Matches Proof's own (§3) wording in substance, shortened |
| Windows/Linux best-effort, unsigned | Row 6 | No parity implied anywhere in Download, FAQ, or About |
| Per-platform live availability, no dead buttons | Row 7 | "Not yet available" string reused verbatim from §1's Do/Don't table |
| Version metadata as a live field, never hardcoded | Row 10 | Written as `{template}` values, not a literal string |
| Source-available, not open source; no audit | Row 9 | FAQ #2, exact terminology |
| Update confirmation / update-check exception | Row 1 | FAQ #4/#5, matches `README.md` §Privacy and Story 5.2 AC1/AC4 |
| Backlog cadence, calendar-scoped | Row 11 | Changelog framing, exact phrasing from the ledger row itself |
| Windows SmartScreen disclosure register | `landing-strategy.md` §3b | Modal and FAQ #1 both use "mechanism, reason, action" — no reassuring adjective |
| Solo-developer transparency framing | `landing-strategy.md` §2b; this file's §1 Fork B | About footer attribution only — nowhere else |

**Not claimed anywhere in this section:** a Windows/Linux minimum OS version (row 8, still no source); a
fifth About outcome statement repeating the OCR/AI claim (cut, see above); any specific competitor fact
without a date (deferred to Step 3.4b, per the scope note at the top of this section).

### Not decided here, deliberately

- **The 9 `/tools/*` pages and 4 `/compare/*` pages** — scoped out above, recommended as Step 3.4b.
- **Whether the comparison-page hub link sits in the footer or as its own index page** — still open per
  `landing-ia.md` §4; not resolved by this session's `/tools` hub copy.
- **`⟨developer name⟩`'s actual value** — the developer's own call, filled in at build time, not guessed
  at here (`CLAUDE.md`'s privacy rule).
- **Exact legal wording for Privacy, Legal notice, and EULA** — Phase 4's job, unchanged from
  `landing-ia.md` §4.
- **Microcopy pass** (CTA labels beyond what's fixed above, the social-proof honesty framing) — Step 3.5.

### Feeds directly into

- **Step 3.4b** (recommended, not yet run) — the 9 tool pages and 4 comparison pages this session
  scoped out; the FAQ's #6/#7 links and the `/tools` hub's grid are already wired to expect them.
- **Step 3.5** (microcopy pass) — the changelog's curation-voice rule and the FAQ's link text are
  candidates for that pass's own review, not finished microcopy.
- **Step 3.6** (ledger gate) — this section's own ledger-check table above is a head start on that
  step's job for these five pages specifically.
- **Step 6.2/6.3** (layout, page build) — `⟨developer name⟩`'s real value gets filled in here, once,
  not re-decided per page; the Windows modal's copy is this step's literal implementation spec.
- **Step 9.1** (GitHub cross-links) — the changelog's "full release notes on GitHub" link is that step's
  confirmed target.

## §4b — Tool and comparison page copy (Step 3.4b)

**Fulfills the deferral §4 flagged, same session, developer-requested.** Two things ground this pass
that weren't available a session ago: the actual tool descriptions and features straight from
`src/locales/en.json`/`fr.json` and `src/stores/registry.ts` (read live this session, not assumed —
this project's own standing discipline), and live-fetched, dated competitor facts for the four named
comparisons (`devutils.com`, `devtoys.app`, `github.com/fosslife/devtools-x`,
`gchq.github.io/CyberChef` / `github.com/gchq/CyberChef`, all checked 2026-09-19), closing the
citation gap `landing-ia.md` §4 flagged ("these four pages introduce a citation discipline the claim
ledger doesn't cover").

### The 9 tool pages (`/tools/*`)

Shared template per `landing-ia.md` §4: opening sentence (direct-answer-first, full noun phrasing, no
pronoun), one "what it does" paragraph grounded in real shipped features (not the marketing register —
this is functional copy), a mandatory "why not a free online tool" micro-FAQ entry plus one more
tool-specific pair, CTA to `/download`. H1s are the exact `registry.ts` names (ledger row 4).

**JSON** (`/tools/json`)
- EN: *Umbra's JSON tool formats, validates, and explores JSON entirely offline — nothing you paste
  here is ever sent anywhere.* Paste any JSON to format it with your choice of indentation, or minify
  it to one line. Explore the result as a collapsible tree with search, run a JSONPath query against
  it, diff two documents side by side, or generate a matching TypeScript interface — all without the
  payload leaving your machine.
- FR: *L'outil JSON d'Umbra formate, valide et explore du JSON entièrement hors ligne — rien de ce que
  vous y collez n'est jamais envoyé où que ce soit.* Collez n'importe quel JSON pour le formater avec
  l'indentation de votre choix, ou le minifier en une seule ligne. Explorez le résultat sous forme
  d'arbre repliable avec recherche, exécutez une requête JSONPath, comparez deux documents côte à côte,
  ou générez l'interface TypeScript correspondante — sans que la donnée ne quitte jamais votre machine.
- Micro-FAQ (EN/FR): *Why not just use a free online JSON formatter?* Because pasting a payload into a
  web tool means it left your machine, even if only for a second — and you have no way to verify what
  that server did with it. Umbra's JSON tool never sends anything anywhere. / *Pourquoi ne pas
  simplement utiliser un formateur JSON gratuit en ligne ?* Parce que coller une donnée dans un outil
  web signifie qu'elle a quitté votre machine, ne serait-ce qu'un instant — et vous n'avez aucun moyen
  de vérifier ce que ce serveur en a fait. — *Can it fix invalid JSON, not just flag it?* Yes — the
  Repair tab suggests fixes for common mistakes and shows a preview before you apply them; if a document
  is too broken to fix automatically, it says so rather than guessing. / *Peut-il corriger du JSON
  invalide, pas seulement le signaler ?* Oui — l'onglet Réparer propose des corrections et affiche un
  aperçu avant de les appliquer ; si un document est trop abîmé, l'outil le dit plutôt que de deviner.

**Base64** (`/tools/base64`)
- EN: *Umbra's Base64 tool encodes and decodes text or files entirely offline — nothing you drop or
  paste ever leaves your machine.* Paste text to encode or decode it, with a URL-safe alphabet option,
  or drop a file directly onto the window to Base64-encode it. Decoding recognizes what it finds — a
  JWT, an image, a binary file — and shows it accordingly instead of just dumping raw bytes.
- FR: *L'outil Base64 d'Umbra encode et décode du texte ou des fichiers entièrement hors ligne — rien de
  ce que vous déposez ou collez ne quitte jamais votre machine.* Collez du texte pour l'encoder ou le
  décoder, avec une option d'alphabet compatible URL, ou déposez un fichier directement dans la fenêtre
  pour l'encoder en Base64. Le décodage reconnaît ce qu'il trouve — un JWT, une image, un binaire — et
  l'affiche en conséquence plutôt que d'afficher des octets bruts.
- Micro-FAQ: *Why not use a free online Base64 decoder?* You can't verify what a server does with what
  you send it; Umbra decodes and encodes locally, including files dropped directly onto the window. /
  *Pourquoi ne pas utiliser un décodeur en ligne ?* Vous ne pouvez pas vérifier ce qu'un serveur fait de
  ce que vous lui envoyez ; Umbra décode et encode localement. — *Does it detect what I've decoded?*
  Yes — a JWT, an image, or a recognizable binary format is shown accordingly, not just as raw bytes. /
  *Détecte-t-il ce que j'ai décodé ?* Oui — un JWT, une image, ou un format reconnaissable est affiché
  en conséquence, pas comme de simples octets bruts.

**UUID** (`/tools/uuid`)
- EN: *Umbra's UUID tool generates v4 or v7 identifiers, one at a time or in bulk, entirely offline.*
  Generate random (v4) or time-ordered (v7) UUIDs, formatted with your choice of case, hyphens, and
  braces. Generate in bulk and copy or download the full list as a file.
- FR: *L'outil UUID d'Umbra génère des identifiants v4 ou v7, un par un ou en série, entièrement hors
  ligne.* Générez des UUID aléatoires (v4) ou triables par date de création (v7), avec la casse, les
  tirets et les accolades de votre choix. Générez-en en série et copiez ou téléchargez la liste complète.
- Micro-FAQ: *Why not generate UUIDs with a free online tool?* A UUID generator has no reason to ever
  touch a network — there's nothing to send. Umbra's generates locally and instantly, in bulk if needed.
  / *Pourquoi ne pas en générer avec un outil en ligne ?* Un générateur d'UUID n'a aucune raison de
  passer par un réseau — il n'y a rien à envoyer. — *What's the difference between v4 and v7?* v4 is
  random; v7 is time-ordered, which makes it sort naturally by creation time — a better choice for a
  database key. / *Quelle est la différence entre v4 et v7 ?* La v4 est aléatoire ; la v7 est triable
  par date de création — un meilleur choix comme clé de base de données.

**Hash** (`/tools/hash`)
- EN: *Umbra's Hash tool computes SHA-2, SHA-3, MD5, and SHA-1 digests of text or a file, entirely
  offline.* Type or paste text, or drop a file anywhere in the window, and get its digest across every
  supported algorithm at once, in your choice of case. Weaker algorithms (MD5, SHA-1) are flagged as
  such, not presented as equally safe.
- FR: *L'outil Hash d'Umbra calcule les empreintes SHA-2, SHA-3, MD5 et SHA-1 d'un texte ou d'un fichier,
  entièrement hors ligne.* Tapez ou collez du texte, ou déposez un fichier n'importe où dans la fenêtre,
  et obtenez son empreinte pour tous les algorithmes pris en charge à la fois. Les algorithmes plus
  faibles (MD5, SHA-1) sont signalés comme tels.
- Micro-FAQ: *Why not hash a file with a free online tool?* That means uploading the file to check its
  own checksum — the exact exposure hashing is often used to avoid. Umbra hashes locally, files
  included. / *Pourquoi ne pas utiliser un outil en ligne ?* Cela revient à téléverser le fichier pour
  vérifier sa propre empreinte. — *Which algorithm should I use?* SHA-2 or SHA-3 for anything
  security-sensitive; MD5 and SHA-1 are included for compatibility, flagged as weak rather than listed
  without comment. / *Quel algorithme utiliser ?* SHA-2 ou SHA-3 pour tout ce qui touche à la sécurité ;
  MD5 et SHA-1 sont signalés comme faibles.

**JWT** (`/tools/jwt`)
- EN: *Umbra's JWT tool decodes a token's header and payload entirely offline — it never sends the
  token anywhere, and it doesn't verify signatures.* Paste a token to see its header and payload laid
  out clearly, with expiry and issued-at claims translated into plain language ("expires in 3 days,"
  not a raw timestamp). It reads the token; it doesn't check whether it's genuine — stated plainly in
  the tool itself.
- FR: *L'outil JWT d'Umbra décode l'en-tête et la charge utile d'un jeton entièrement hors ligne — il ne
  l'envoie jamais nulle part, et ne vérifie pas les signatures.* Collez un jeton pour voir son en-tête et
  sa charge utile clairement présentés, avec les revendications d'expiration traduites en langage clair.
  L'outil lit le jeton, il ne vérifie pas s'il est authentique — précisé dans l'outil lui-même.
- Micro-FAQ: *Why not decode a JWT with a free online tool?* A JWT often carries real session or
  identity data — Umbra decodes entirely on your machine and never transmits it. / *Pourquoi ne pas
  utiliser un outil en ligne ?* Un JWT transporte souvent de vraies données de session ou d'identité. —
  *Does it verify the signature?* No, and it says so — verifying requires the signing key, which this
  tool never asks for. / *Vérifie-t-il la signature ?* Non — cela nécessiterait la clé de signature, que
  l'outil ne demande jamais.

**Cron** (`/tools/cron`) — **must not frame as AI or natural-language** (ledger row 3a)
- EN: *Umbra's Cron tool builds a standard 5-field cron expression field by field, or reads one back
  when you paste it in — entirely offline.* Set the minute, hour, day-of-month, month, and day-of-week
  fields individually with a guided grid, or paste an existing expression to see it explained in plain
  language and previewed against its next three run times. There's no free-text guessing on either
  side — every field is picked from a fixed set of valid values.
- FR: *L'outil Cron d'Umbra compose une expression cron standard à 5 champs, champ par champ, ou relit
  une expression que vous collez — entièrement hors ligne.* Réglez individuellement les champs à l'aide
  d'une grille guidée, ou collez une expression existante pour la voir expliquée en langage clair et
  prévisualisée avec ses trois prochaines exécutions. Aucune saisie libre à deviner : chaque champ est
  choisi parmi un ensemble fixe de valeurs valides.
- Micro-FAQ: *Why not use a free online cron generator?* A cron expression alone reveals nothing
  sensitive, so the privacy case is weaker here than elsewhere in Umbra — but it's still one tool fewer
  to leave the app for. / *Pourquoi ne pas utiliser un générateur en ligne ?* Une expression cron seule
  ne révèle rien de sensible — mais c'est un outil de moins pour lequel quitter l'application. — *Does it
  understand phrases like "every day at 5pm"?* No, deliberately — Umbra used to parse free-text phrases
  into cron expressions; that parser was retired for a guided grid that can't be phrased wrong. Paste an
  existing expression instead and Cron reads it back in plain language. / *Comprend-il des phrases comme
  « tous les jours à 17h » ?* Non, volontairement — Umbra analysait autrefois des phrases en langage
  libre ; cet analyseur a été retiré au profit d'une grille guidée impossible à mal formuler.

**Image to Text** (`/tools/ocr`) — **the only tool page allowed the "even the AI is private" claim**
(ledger row 3)
- EN: *Umbra's Image to Text tool pulls text out of a screenshot, photo, or scan using a bundled AI
  model that runs entirely on your machine — the image never leaves it, not even for this.* Drop an
  image anywhere in the window, or paste one with ⌘V, and Umbra recognizes and extracts its text —
  selectable directly on the image, or copied as plain text in one action. If nothing readable is
  found, it says so plainly.
- FR: *L'outil Image en texte d'Umbra extrait le texte d'une capture d'écran, d'une photo ou d'un scan
  à l'aide d'un modèle d'IA embarqué qui s'exécute entièrement sur votre machine — l'image n'en sort
  jamais, pas même pour ça.* Déposez une image n'importe où dans la fenêtre, ou collez-en une avec ⌘V,
  et Umbra reconnaît et extrait son texte — sélectionnable directement sur l'image, ou copié en un
  geste. Si rien de lisible n'est trouvé, l'outil le dit clairement.
- Micro-FAQ: *Why not use a free online OCR tool?* An online OCR tool means uploading your image —
  screenshots and photos often contain exactly what you'd least want on a stranger's server. Umbra's
  model is bundled with the app; nothing is uploaded, even for this. / *Pourquoi ne pas utiliser un
  outil en ligne ?* Cela implique de téléverser votre image, qui contient souvent des informations
  sensibles. — *Is this the AI feature the site mentions?* Yes — the only one that ships today: a local
  OCR model with no network call involved. / *Est-ce la fonctionnalité IA mentionnée sur le site ?*
  Oui — la seule à ce jour : un modèle d'OCR local, sans aucun appel réseau.

**PDF** (`/tools/pdf`)
- EN: *Umbra's PDF tool merges, reorders, rotates, deletes, and reads the text out of PDF pages —
  entirely offline.* Drop one or several PDFs onto the window to merge them in the order you choose, or
  open one to select, rotate, delete, or reorder individual pages before saving a copy. Reading a
  scanned PDF's text is called out honestly: a scan is a page of images, not text, so there's nothing to
  extract.
- FR: *L'outil PDF d'Umbra fusionne, réorganise, pivote, supprime et lit le texte des pages PDF —
  entièrement hors ligne.* Déposez un ou plusieurs PDF pour les fusionner dans l'ordre choisi, ou
  ouvrez-en un pour sélectionner, pivoter, supprimer ou réorganiser des pages avant d'enregistrer une
  copie. La lecture d'un PDF scanné est signalée honnêtement : un scan est une image, pas du texte.
- Micro-FAQ: *Why not merge or edit a PDF with a free online tool?* A PDF is often exactly the kind of
  document — a contract, an ID scan — you don't want passing through a third-party server. / *Pourquoi
  ne pas utiliser un outil en ligne ?* Un PDF est souvent le type de document qu'on préfère ne pas voir
  transiter par un serveur tiers. — *Can it read text from a scanned PDF?* Not directly — a scanned page
  is an image, not text; the Image to Text tool's OCR can pull text out of the scan itself. / *Peut-il
  lire le texte d'un PDF scanné ?* Pas directement — l'OCR de l'outil Image en texte peut l'extraire du
  scan.

**Images** (`/tools/image`)
- EN: *Umbra's Images tool converts, resizes, and compresses PNG, JPEG, WebP, and AVIF files — entirely
  offline.* Drop one or several images to convert them to your target format, resize them with a locked
  aspect ratio, and adjust quality with a live before/after comparison — including a background color
  for formats without transparency. Batch conversions show progress per file, not one spinner for the
  whole queue.
- FR: *L'outil Images d'Umbra convertit, redimensionne et compresse des fichiers PNG, JPEG, WebP et
  AVIF — entièrement hors ligne.* Déposez une ou plusieurs images pour les convertir, les redimensionner
  en conservant les proportions, et ajuster la qualité grâce à une comparaison avant/après en direct.
  Les conversions par lot affichent la progression fichier par fichier.
- Micro-FAQ: *Why not convert images with a free online converter?* An image can carry as much personal
  information as a document; uploading it just to change a file extension means trusting a server with
  all of that. / *Pourquoi ne pas utiliser un convertisseur en ligne ?* Une image peut porter autant
  d'informations personnelles qu'un document. — *Can I convert several images at once?* Yes — drop as
  many as you like; each file's progress is shown individually. / *Puis-je en convertir plusieurs à la
  fois ?* Oui — la progression de chaque fichier est affichée individuellement.

**Grounded in, not invented:** every functional claim above traces to `src/locales/en.json`/`fr.json`'s
own `tools.*.description` strings and feature keys (repair, JSONPath query, diff, TypeScript transform,
weak-algorithm flagging confirmed live in `HashView.vue`/`WeakHashPopover.vue`, JWT's stated
decode-not-verify scope, Cron's guided-grid redesign per Story 8.6) and `registry.ts`'s `drop`/`paste`
declarations — not the marketing register `landing-copy.md` §1 licenses for persuasive copy, since a
"what it does" paragraph is a functional claim, closer to Proof's register than the hero's.

### The 4 comparison pages (`/compare/*`)

**Method for the competitor half:** live-fetched 2026-09-19 — `devutils.com`, `devtoys.app`,
`github.com/fosslife/devtools-x`, `gchq.github.io/CyberChef` and `github.com/gchq/CyberChef` — not
recalled from `landing-strategy.md` §2's reference scan (2026-09-17), which checked landing-page
*conventions*, not the specific price/platform/tool-count/source/AI facts this page's mini-matrix needs.
Every competitor fact below is dated to this check; anything not confirmed live is worded as absence of
evidence ("none found as of 2026-09-19"), never as a claim about what the competitor *doesn't* do — the
same falsifiable, non-disparaging register `landing-copy.md` §1's Do/Don't table already specifies for
this exact page type. Umbra's own facts trace to ledger rows as usual (row 12 price, rows 5/6 platforms,
row 4 tool count, row 9 source, row 1 privacy — worded as "a documented, repeatable check you can run
yourself," never "every release publishes a result," per the ledger's own 2026-09-19 lapse correction —
and row 3 for the AI feature).

**Devtoys** (`/compare/devtoys`)

- EN intro: *DevToys is the closest free, open-source comparison to Umbra. Here's how the two compare,
  checked 2026-09-19.*
- FR intro: *DevToys est la comparaison gratuite et open source la plus proche d'Umbra. Voici comment
  les deux se comparent, vérifié le 19/09/2026.*

| | Umbra | DevToys |
|---|---|---|
| Price | Free, no account | Free |
| Platforms | macOS (signed, notarized), Windows & Linux (best-effort) | Windows, macOS, Linux |
| Tools | 9 | 30 default tools, plus community tools |
| Source | Source-available (public, All Rights Reserved) | Open source (GitHub) |
| Privacy verification | A documented, repeatable network-monitor check you can run yourself | States "privacy-focused"; no published verification mechanism found as of 2026-09-19 |
| Local AI feature | Yes — offline OCR (Image to Text) | None found as of 2026-09-19 |

- EN: DevToys has more tools today and is genuinely open source — you can read, modify, and
  redistribute the code under its licence, which Umbra's source-available status doesn't grant. Where
  the two differ is verification: DevToys states it's privacy-focused; Umbra publishes a specific,
  repeatable check — a network monitor, run yourself, described on the home page — that shows what
  actually happens, tool by tool. Umbra also ships a local AI feature, offline text recognition, that
  DevToys doesn't have as of this writing.
- FR: DevToys propose plus d'outils aujourd'hui et est réellement open source — vous pouvez lire,
  modifier et redistribuer le code sous sa licence, ce que le statut *source-available* d'Umbra n'accorde
  pas. La différence se joue sur la vérification : DevToys se dit « privacy-focused » ; Umbra publie une
  vérification précise et reproductible — un contrôle réseau, à exécuter soi-même, décrit sur la page
  d'accueil — qui montre ce qui se passe réellement, outil par outil. Umbra propose aussi une
  fonctionnalité d'IA locale, la reconnaissance de texte hors ligne, qu'DevToys n'a pas à ce jour.

**DevUtils** (`/compare/devutils`)

- EN intro: *DevUtils is the established, paid, macOS-only alternative to Umbra. Here's how the two
  compare, checked 2026-09-19.*
- FR intro: *DevUtils est l'alternative payante et établie, réservée à macOS. Voici comment les deux se
  comparent, vérifié le 19/09/2026.*

| | Umbra | DevUtils |
|---|---|---|
| Price | Free, no account | Paid (perpetual/team licences; exact price not published on its own site as of 2026-09-19) |
| Platforms | macOS (signed, notarized), Windows & Linux (best-effort) | macOS only (10.13+, Intel & Apple Silicon) |
| Tools | 9 | 47+ |
| Source | Source-available (public, All Rights Reserved) | Proprietary — source not published |
| Privacy verification | A documented, repeatable network-monitor check you can run yourself | States "everything you paste into the app never leaves your machine"; no published verification mechanism found as of 2026-09-19 |
| Local AI feature | Yes — offline OCR (Image to Text) | None found as of 2026-09-19 |

- EN: DevUtils has far more tools and years of polish on a single platform — if you're macOS-only and
  don't mind paying, it's a mature, well-regarded choice. It makes almost the same "never leaves your
  machine" claim Umbra does — but asserts it once, in a sentence, rather than publishing a way to check
  it. Umbra is free, runs on three platforms instead of one, and ships a local AI feature DevUtils
  doesn't have as of this writing.
- FR: DevUtils propose bien plus d'outils, avec des années de finition sur une seule plateforme — si vous
  êtes exclusivement sur macOS et que payer ne vous dérange pas, c'est un choix mature et reconnu. Il
  affirme presque la même promesse qu'Umbra ("ne quitte jamais votre machine") — mais l'affirme une fois,
  dans une phrase, sans publier de moyen de la vérifier. Umbra est gratuit, fonctionne sur trois
  plateformes au lieu d'une, et propose une fonctionnalité d'IA locale que DevUtils n'a pas à ce jour.

**DevTools-X** (`/compare/devtools-x`)

- EN intro: *DevTools-X is the closest structural match to Umbra — also built on Tauri, also
  cross-platform, also free. Here's how the two compare, checked 2026-09-19.*
- FR intro: *DevTools-X est le plus proche d'Umbra sur le plan technique — lui aussi construit sur
  Tauri, multiplateforme et gratuit. Voici comment les deux se comparent, vérifié le 19/09/2026.*

| | Umbra | DevTools-X |
|---|---|---|
| Price | Free, no account | Free |
| Platforms | macOS (signed, notarized), Windows & Linux (best-effort) | Windows, macOS, Linux |
| Tools | 9 | ~41 |
| Source | Source-available (public, All Rights Reserved) | Open source (MIT licence) |
| Privacy verification | A documented, repeatable network-monitor check you can run yourself | No published verification mechanism found as of 2026-09-19; its own marketing site is currently offline, so GitHub is its only public front door |
| Local AI feature | Yes — offline OCR (Image to Text) | None found as of 2026-09-19 |

- EN: DevTools-X is built the same way Umbra is — a Tauri app, not an Electron one — and has more tools
  today under a genuinely open MIT licence you can fork and modify. Its own marketing site is currently
  down, so its GitHub repository is the only place to actually evaluate it. Umbra ships signed,
  notarized macOS builds, a documented privacy self-check, and a local AI feature DevTools-X doesn't
  have as of this writing.
- FR: DevTools-X est construit de la même façon qu'Umbra — une application Tauri, pas Electron — et
  propose plus d'outils aujourd'hui sous une licence MIT réellement ouverte, modifiable et redistribuable.
  Son site vitrine est actuellement hors service, seul son dépôt GitHub permet donc de l'évaluer. Umbra
  propose des builds macOS signés et notarisés, une auto-vérification documentée de la confidentialité,
  et une fonctionnalité d'IA locale que DevTools-X n'a pas à ce jour.

**CyberChef** (`/compare/cyberchef`)

- EN intro: *CyberChef is different in kind, not just in features — a browser-based tool from GCHQ (UK)
  rather than a native desktop app. Here's how the two compare, checked 2026-09-19.*
- FR intro: *CyberChef est différent par nature, pas seulement par ses fonctionnalités — un outil web du
  GCHQ (Royaume-Uni), pas une application native. Voici comment les deux se comparent, vérifié le
  19/09/2026.*

| | Umbra | CyberChef |
|---|---|---|
| Price | Free, no account | Free |
| Platforms | Native app: macOS (signed, notarized), Windows & Linux (best-effort) | Runs in any browser; a downloadable offline ZIP exists but doesn't auto-update |
| Tools | 9, purpose-built (JSON, JWT, hashing, OCR, PDF, images…) | Hundreds of operations, aimed more at encoding/encryption/data analysis than everyday dev-utility tasks |
| Source | Source-available (public, All Rights Reserved) | Open source (Apache 2.0, Crown Copyright) |
| Privacy verification | A documented, repeatable network-monitor check you can run yourself | Runs entirely client-side for most operations — a real, verifiable architecture on its own terms; three operations (map tiles, DNS lookups, an HTTP-request operation) call out to the network by design, per its own documentation |
| Local AI feature | Yes — offline OCR (Image to Text) | None found as of 2026-09-19 |

- EN: CyberChef isn't really a competitor in the everyday-toolbox sense — it's a much broader,
  encoding/encryption/forensics-oriented tool that happens to also run entirely in your browser, with no
  server involved for most operations, which is a genuinely strong, verifiable privacy architecture on
  its own terms. A handful of its operations call out to the network by design, disclosed in its own
  documentation — the same "name the one exception" discipline Umbra applies to its own update check.
  Umbra is a native app built for the smaller set of tools a developer reaches for daily, with a
  one-keystroke workflow CyberChef's browser-tab format doesn't offer.
- FR: CyberChef n'est pas vraiment un concurrent au sens d'une boîte à outils du quotidien — c'est un
  outil bien plus large, orienté encodage/chiffrement/analyse forensique, qui s'exécute aussi entièrement
  dans le navigateur, sans serveur pour la plupart de ses opérations — une architecture de confidentialité
  réellement vérifiable en soi. Une poignée de ses opérations sortent vers le réseau par conception,
  documentées comme telles — la même discipline qu'Umbra applique à sa propre vérification de mise à
  jour. Umbra est une application native conçue pour le plus petit ensemble d'outils qu'un développeur
  utilise au quotidien, avec un flux de travail à un seul raccourci que le format navigateur de
  CyberChef n'offre pas.

**Shared across all four pages:** Download CTA at the bottom, same button/copy as everywhere else on the
site. No multi-column matrix spanning all four competitors at once — `landing-ia.md` §4 left that as an
open question (per-page section vs. shared component vs. hub page); each page above ships its own
2-column table, which satisfies the per-page requirement regardless of how that open question resolves.

### Sources (competitor facts, dated 2026-09-19)

- [devutils.com](https://devutils.com) — price/licensing framing, macOS-only, 47+ tools, privacy wording
- [devtoys.app](https://devtoys.app) — free/open-source framing, 30 default tools, cross-platform
- [github.com/fosslife/devtools-x](https://github.com/fosslife/devtools-x) — MIT licence, ~41 features,
  cross-platform, dead marketing site confirmed (§2c)
- [gchq.github.io/CyberChef](https://gchq.github.io/CyberChef/) and
  [github.com/gchq/CyberChef](https://github.com/gchq/CyberChef) — client-side architecture, Apache 2.0,
  the three network-calling operations

### Not decided here, deliberately

- **Exact placement of the comparison-page hub link** (footer vs. its own index page) — still open per
  `landing-ia.md` §4, not resolved by writing the four pages' own content.
- **Whether "47+ tools" / "~41 features" need periodic re-verification** — these are the kind of
  competitor facts that go stale exactly like Umbra's own claims do; no owner assigned yet, unlike the
  ledger's own rows which all have one.
- **Product screenshots for the 9 tool pages** — Epic-7 asset dependency, same status as home's and the
  Proof section's imagery (Step 5.3).

### Feeds directly into

- **Step 3.5** (microcopy pass) — CTA labels and link text on these 13 pages are candidates for that
  review, not finished microcopy.
- **Step 3.6** (ledger gate) — Umbra's own claims on these pages check against the ledger the normal way;
  the competitor-fact table above is this step's answer to that gate's own flagged gap (no ledger
  mechanism exists for competitor claims).
- **Step 3.6b / 3.7** (SEO / GEO passes) — 13 more pages needing title tags, meta descriptions, and
  question-shaped headings; the tool pages' micro-FAQs and the comparison pages' dated tables are
  already close to both passes' target shape, not starting from plain prose.
- **Step 5.2/5.3** (layout, product imagery) — 9 more screenshot slots, same Epic-7 dependency as home.
- **Step 6.3/6.4** (page build, content model) — implements all 13 pages from the shared templates
  above; the comparison pages' competitor facts need their own re-verification cadence before Step 6.4
  can treat them as build-time content rather than hand-maintained prose.

## §5 — Microcopy and social-proof honesty pass (Step 3.5)

**Method:** working session (2026-09-19), reading back line by line through every CTA, link, and
fine-print string already drafted in §1–§4b, checked against `landing-ia.md`'s nav/footer chrome and
`landing-strategy.md` §4's event table. That cross-check is what surfaced this pass's real work:
`notify_me_clicked` has been a defined PostHog event since Step 1.4, and nothing written since has
given it anything to click. The three items below are the same shape — not wording polish, but
microcopy the site genuinely can't ship without, closed here rather than surfacing at Step 8.1's
pre-launch checklist or, worse, after launch.

### Three gaps found this pass, not just polish

**1 — "Notify me" had an event and a voice-spec example, but no page.** `landing-strategy.md` §1 names
the intent ("routes to GitHub Watch/Releases as a line of copy"), §4 gives it an event
(`notify_me_clicked`), and this file's §1 Do/Don't table gives it example wording — but no page drafted
since (§2's home spine, §4's Download/FAQ/About/Changelog, §4b's tool/comparison pages) actually places
it. A visitor who hits the Download page's "not yet available for Windows" wall today has no next
action offered at all.

**Decided: two placements, not one — a contextual pairing and a persistent one.** The highest-intent
moment is exactly where the wall is (Download page, next to the platform-unavailable line) — that's
where "tell me later" actually occurs to someone. A second, sitewide instance belongs in the footer,
for a visitor who wants it before ever reaching Download. Both use the same mechanism-naming register
`landing-copy.md` §1's voice spec already requires ("Get notified on GitHub" / "Never miss an update!
🔔" — name the real GitHub feature, not a euphemism for a mailing list that doesn't exist): GitHub's own
feature for this is **Watch**, so both instances say exactly that rather than a vaguer "notify me."

- Download page, paired with the existing platform-unavailable line (`landing-copy.md` §4):
  - EN: *Not yet available for {platform} — check back after the next release, or
    [watch the repo on GitHub](https://github.com/dipaneb/umbra) to get notified.*
  - FR: *Pas encore disponible pour {plateforme} — repassez après la prochaine version, ou
    [suivez le dépôt sur GitHub](https://github.com/dipaneb/umbra) pour être averti.*
- Footer, sitewide:
  - EN: *[Watch on GitHub](https://github.com/dipaneb/umbra) to get notified about new releases.*
  - FR: *[Suivez Umbra sur GitHub](https://github.com/dipaneb/umbra) pour être averti des nouvelles
    versions.*

Both fire `notify_me_clicked` on click, per `landing-strategy.md` §4's event table — that event now has
a concrete trigger location for Step 6.8 to wire, where before this pass it didn't.

**2 — No language switcher exists anywhere, on a site now shipping two full locales.** Step 3.2
reversed the roadmap's own locked decision — French now ships alongside English at launch, not
deferred (`README.md`'s decisions table, corrected 2026-09-19) — but nothing written since gives a
visitor a way to move between `/` and `/fr/` once Step 6.5's routing (`prefixDefaultLocale: false`)
lands. Without this, French content would exist on the site but be practically unreachable from an
English page, and vice versa — every French page becomes an orphan only a direct link or a search
engine could find. This is the most consequential single gap this pass found, because unlike the other
two it isn't a missing convenience, it's a missing path to half the site's content.

**Decided: nav (far right, after Download) plus a footer repeat, same always-reachable pattern this
project already uses for About** (`landing-ia.md` §3: "footer + nav is not redundant, it's the standard
'always reachable' pattern"). Placed after Download, not before it, so a low-priority utility control
doesn't compete with the page's one real CTA — the same restraint `DESIGN.md`'s "orange is a budget of
one" rule applies to color, applied here to nav weight instead.

**Decided: the label names the destination language, in that language — not "EN/FR."** On an English
page the link reads "Français"; on a French page, "English." This is the accessible convention (a
screen reader announcing a bare "FR" is ambiguous about what it does) and it's also a live pattern
already in this project's own reference scan — doctolib.fr, one of §2b's twenty checked sites, does
exactly this for its own bilingual nav. No abbreviation, no flag icon (a flag represents a country, not
a language, and Umbra's French isn't country-scoped).

- On `/*` (English pages): link text **Français** → the same page's French equivalent.
- On `/fr/*` (French pages): link text **English** → the same page's English equivalent.

**Correctness requirement, not a copy decision — flagged for whoever builds this (Step 6.3/6.5):** the
switch must preserve the current page (`/tools/json` ↔ `/fr/tools/json`), never bounce to home. A
switcher that always lands on `/` after a visitor was three pages deep would be worse than not having
one — it throws away exactly the context they were in.

**3 — The Proof section's central instruction has nothing to click.** `landing-copy.md` §3's draft
reads: *"The source is public — read it yourself."* — prose, not a link. The section's entire argument
is that a skeptical reader can go verify the claim themselves; making them search for the URL is
friction the claim shouldn't carry, and it's the same page that later says "more on that in the FAQ"
without linking the FAQ either.

**Decided: link both phrases to their actual targets, using the repo URL already cited throughout
`landing-strategy.md`'s own ledger** (`gh api repos/dipaneb/umbra/releases/latest`, etc.) — not a new
piece of information, just made clickable where it was previously only implied.

- EN: *The source is public — [read it yourself](https://github.com/dipaneb/umbra). Umbra's repository
  is source-available: open the networking layer and confirm this isn't just asserted.
  (Source-available isn't open source — you can view the code, not redistribute or reuse it. More on
  that [in the FAQ](/faq#open-source-and-audit-status).)*
- FR: *Le code source est public — [vérifiez-le vous-même](https://github.com/dipaneb/umbra). Le dépôt
  d'Umbra est source-available : vous pouvez ouvrir la couche réseau et constater que ce n'est pas
  qu'une affirmation. (« Source-available » n'est pas « open source » : vous pouvez consulter le code,
  pas le redistribuer ni le réutiliser — plus de détails [dans la FAQ](/faq#open-source-et-audit).)*

The same repo URL now does triple duty — Proof's link, the footer's Watch link, and gap 1's Download-page
link — which is a simplification, not three separate decisions: one URL, three entry points to it.

### CTA & link-text reference table

Consolidated across every page drafted so far, to check for drift rather than assume consistency.
**Finding: no inconsistency turned up** — every download action across nav, hero, closing CTA, and the
three Download-page panels already uses the plain verb "Download" (never "Get Umbra," "Try it," or "Get
started"), matching `landing-copy.md` §1's locked CTA rule. The table below is the reference going
forward, plus the three additions this pass makes.

| Label (EN / FR) | Where it appears | Action |
|---|---|---|
| Download / Télécharger | Nav, hero, closing CTA, each Download-page panel | Primary conversion action — never varied |
| Download for macOS/Windows/Linux / Télécharger pour macOS/Windows/Linux | Download page panels | Same verb, platform appended — not a different verb per platform |
| Watch on GitHub / Suivre sur GitHub *(new, this pass)* | Footer (sitewide), Download page (per-platform-unavailable pairing) | Names GitHub's actual "Watch" feature, not a generic "notify me" |
| Français / English *(new, this pass)* | Nav (far right), footer | Names the destination language, not an abbreviation |
| Continue download / Continuer le téléchargement | Windows unsigned-build modal | The modal's own primary action — distinct from the plain "Download" verb, since it's a second confirmation, not a first click |
| read it yourself / vérifiez-le vous-même *(now linked, this pass)* | Proof section | Links to the repo — previously unlinked prose |
| in the FAQ / dans la FAQ *(now linked, this pass)* | Proof section | Links to the FAQ's open-source/audit entry specifically, not the FAQ's top |
| Full release notes on GitHub / Notes de version complètes sur GitHub | Changelog | Links to the repo's Releases page — distinct from the new Watch link, which is about future releases, not past ones |

### Fine print — the footer, finalized

Consolidating every footer element decided across §2–§4 plus this pass's three additions, in the order
they'd read:

1. Nav-style links: FAQ · Privacy · Legal notice · EULA · Changelog · About.
2. Attribution line (unchanged from §4): *"Hey — I'm ⟨developer name⟩, the one person building and
   maintaining Umbra."* / *"Bonjour — je suis ⟨nom du développeur⟩..."*
3. **Analytics disclosure — promoted from a Do/Don't example to final copy this pass.**
   `landing-copy.md` §1's Do/Don't table gave this as an illustration of register, not finished text;
   locking it here since it's exactly what ledger row 13 requires and nothing since has superseded it:
   - EN: *Umbra collects anonymous page-view and download-intent analytics only. No cookies, no
     session recording.*
   - FR: *Umbra collecte uniquement des données d'analyse anonymes de pages vues et d'intention de
     téléchargement. Aucun cookie, aucun enregistrement de session.*
4. Licence note (ledger row 9, restated briefly — the full version lives on the FAQ and in Proof):
   - EN: *Source-available, not open source. See the [EULA](/eula).*
   - FR: *Source-available, pas open source. Voir le [CLUF](/eula).*
5. **Watch-on-GitHub link** *(new, this pass — gap 1 above)*.
6. **Language switch link** *(new, this pass — gap 2 above)*.
7. **Copyright line** *(new, this pass — plain boilerplate, distinct register from the warm attribution
   line above it; both can coexist since they're doing different jobs)*: **© 2026 Umbra.** — no
   "all rights reserved" repeated here, since the EULA and `/legal` already carry that specific legal
   meaning and restating it in the footer would be a second, unowned copy of a Phase-4 claim. Same in
   FR (a bare copyright line doesn't need translation).

### Empty-ish states

- **Download page — loading, fetch-failure, and no-JS.** The per-platform availability check
  (`landing-ia.md` §4, ledger row 7) is a client-side fetch against `/releases/latest`; nothing decided
  so far said what a visitor sees before it resolves, if it fails, or if JavaScript never ran at all.
  Same principle in all three: state the actual condition, per `landing-copy.md` §1's "platform-
  unavailable state" rule, never a spinner with no fallback and never silence.
  - Loading (brief): EN *Checking the latest release…* / FR *Vérification de la dernière version…*
  - Fetch failure: EN *Couldn't check the latest release just now — [see it directly on
    GitHub](https://github.com/dipaneb/umbra/releases).* / FR *Impossible de vérifier la dernière
    version pour le moment — [consultez-la directement sur
    GitHub](https://github.com/dipaneb/umbra/releases).*
  - `<noscript>` fallback (same link, since a fetch never runs without JS): EN *JavaScript is needed to
    show live platform availability — [see releases directly on
    GitHub](https://github.com/dipaneb/umbra/releases).* / FR *JavaScript est nécessaire pour afficher
    la disponibilité en direct — [consultez les versions directement sur
    GitHub](https://github.com/dipaneb/umbra/releases).*
- **Platform-unavailable state** — already decided (`landing-copy.md` §1/§4), now paired with the
  Watch-on-GitHub link per gap 1 above; not a new state, cross-referenced here for completeness.
- **404 (not found).** No page in the inventory covers this — a small addendum, not a new step, since
  it's cheap and every site serves one whether planned or not (`landing-ia.md` §4 records the addition).
  - EN — H1: *Page not found.* Body: *That page doesn't exist, or it moved.* Links: **Home** ·
    **Download** — the two destinations a lost visitor is most likely to actually want, not a full nav
    repeat.
  - FR — H1 : *Page introuvable.* Texte : *Cette page n'existe pas, ou a été déplacée.* Liens :
    **Accueil** · **Télécharger**.
  - Deliberately not styled as an apology or a joke (no "Oops!", no "404: lost in the sourceyverse") —
    same "state the actual condition" discipline as everything else on the site, per `landing-copy.md`
    §1's voice spec; a 404 page is still a site surface, not an exemption from the tone floor.

### Social-proof honesty — an audit, not a rewrite

**Checked, not assumed: every page drafted in §1–§4b for an accidentally fabricated number, star, or
testimonial.** None found. This is worth stating as a completed check rather than an implicit
assumption — `landing-copy.md` §1 already names "no fabricated social proof" as a voice rule, and this
pass is where that rule gets verified against the actual drafted text rather than just declared.

**Why nothing further gets added here, restated as one place rather than scattered across three
files:** the "isn't abandoned" signal already exists — Changelog's cadence line (ledger row 11, "one
small tool or improvement roughly every 1–2 weeks, Sept 2026 → March 2027") — and the "why trust a solo
developer" signal already exists — About's four honest outcome statements plus the footer's first-person
attribution (Fork B, this file's §1). Home's explicit exclusion of any stats/testimonials section
(`landing-ia.md` §3) stands unchanged; this pass doesn't reopen it, it confirms nothing downstream
quietly reintroduced what that decision excluded.

**Considered and rejected: a real (not fabricated) GitHub star count.** Unlike a testimonial or a
made-up number, a live star count would be technically honest — but for a pre-launch solo project it's
almost certainly a small or zero number, and a small true number can read worse than no number at all,
inviting exactly the comparison ("only 3 stars") the page is otherwise structured to avoid. §2's finding
1 already flagged that Umbra's low-copy hero is a legitimate choice but not automatically the *safe* one
Raycast/Linear get for free from existing brand recognition — the honest version of that same point
applies here: Umbra doesn't get to skip proving it isn't abandoned the way an established brand would,
but it does that work through the Changelog/About pairing already built, not through a number that
would currently undercut rather than support the point.

### Checked against the ledger / decided elsewhere

| Item this pass adds | Ledger row / prior decision | Note |
|---|---|---|
| Analytics disclosure sentence | Row 13 | Promoted from Do/Don't example to final copy; no wording change from the example itself |
| Licence note | Row 9 | Restates "source-available, not open source" — same terminology already locked |
| Watch-on-GitHub copy | `landing-strategy.md` §1/§4 (`notify_me_clicked`) | No new claim — a mechanism, not an assertion |
| Language switcher | Not a ledger claim | Structural/UI microcopy, no factual content to check |
| 404 copy | Not a ledger claim | Same |
| Copyright line | Not a ledger claim, but adjacent to Phase 4 | Deliberately doesn't restate "all rights reserved" — that's `/eula`'s and `/legal`'s claim to own, not the footer's |

### Not decided here, deliberately

- **Visual treatment of the language switcher and the 404 page** — Step 5.2's job; this only fixes
  what the text says.
- **Exact loading-UI mechanics** (a skeleton, a spinner, or just the text string appearing/disappearing)
  for the download page's live fetch — Step 6.3's build call; this pass only fixes the fallback copy
  for the failure and no-JS cases, and the loading string for the in-between one.
- **Whether "Watch on GitHub" should also appear in the nav**, not just footer and the Download-page
  pairing — two placements were decided as enough; flag if the developer wants a third, more prominent
  one.
- **The `/faq#open-source-and-audit-status` anchor's exact slug** — assumes Step 6.3 gives FAQ entries
  stable per-question anchors; if it doesn't, the Proof section's FAQ link needs to point at `/faq`
  plainly instead.

### Feeds directly into

- **Step 3.6** (ledger gate) — the finalized analytics-disclosure and licence-note sentences should be
  checked against ledger rows 13 and 9 the normal way, even though this pass already did an informal
  version of that check above.
- **Step 5.2** (layout) — needs to place the language switcher, the new footer Watch-on-GitHub link,
  and the 404 page, none of which existed in any layout mock before this pass.
- **Step 6.3** (page build) — implements the download page's loading/failure/no-JS states and the 404
  route; both are new build requirements this pass introduced, not already-scoped work.
- **Step 6.5** (i18n structure) — the language switcher is the literal UI for that step's routing
  decision (`prefixDefaultLocale: false`); the path-preservation requirement flagged above is a
  correctness constraint on that step's implementation, not just this one's copy.
- **Step 6.8** (analytics rework) — `notify_me_clicked` now has two concrete trigger locations (footer,
  Download-page pairing) to wire, where before this pass the event existed with nothing calling it.
- **Step 9.1** (GitHub cross-links) — the new Proof-section and footer links to the repo are the site's
  half of that reciprocal link; Step 9.1's own job is the repo's homepage field pointing back.

## §6 — Ledger gate (Step 3.6)

**Status: signed off, with two pre-launch action items carried to Step 8.1 — not a clean pass.** Every
claim in §1–§5 was checked against `landing-strategy.md` §5's ledger; three genuine overclaims were
found and corrected live in §4 (below); two more are real but were left as copy, with the underlying
gap named as a required pre-launch check instead — because the gap is in the developer's own release
*process*, not in the wording, and rewriting persuasive copy to route around a process gap would hide
the gap rather than close it. This follows the same distinction Step 2.3 already drew for the same
underlying issue (the nettop-checklist lapse): fix what's wrong in the sentence, name what's wrong in
the practice, and don't let the first stand in for the second.

**Method:** every numbered ledger row (1–13, 3a, and three new rows this step adds) checked against
every sentence in §1–§5 that makes a specific, falsifiable claim — not a re-read of each section's own
already-published self-check tables (§3, §4, §4b, §5 each already ran an informal version of this),
but a second, independent pass looking specifically for what those tables *wouldn't* have caught: claims
that individually cite a correct ledger row but, read across pages, imply more than any single row
grants. Per the roadmap's own tool suggestion for this step, the adversarial half of this pass
(`bmad-review-edge-case-hunter`) was run scoped narrowly to privacy and licence wording — the two claim
categories this project's own `CLAUDE.md` and `landing-strategy.md` §2b/§2c single out as the ones with
real consequences if overstated. Two live-codebase checks were also run rather than assumed: `registry.ts`
still lists the same 9 tools ledger row 4 names (unchanged since Step 1.5), and `src-tauri/Cargo.toml`
confirms Tauri 2 — the source for new ledger row 16 below.

### New ledger rows added this step

Two gaps §2 and §3 each flagged while drafting — "add this before Step 3.6 gates the page" — were still
open. Closing them here, not deferring them again, since leaving a *known* gap in the ledger and then
running the gate anyway would defeat the gate's purpose:

- **Ledger row 14 — cold-launch performance** (sources: `prd.md` NFR2, Story 1.2's measured 386–829ms),
  backing §2's "Why Umbra" point 1 and §4's About outcome 1.
- **Ledger row 15 — accessibility baseline** (source: `prd.md` NFR5, explicitly excluding the WCAG AA
  contrast clause NFR5 also states, because `DESIGN.md` documents two accepted exceptions), backing §2's
  "Why Umbra" point 2.
- **Ledger row 16 — no client-server architecture** (source: `src-tauri/Cargo.toml`, confirming Tauri),
  backing §3's Proof-section architecture claim.

Full row text is in `landing-strategy.md` §5. All three claims were already being made in drafted copy
before this step ran; nothing new is licensed to be said as a result of adding them — this only supplies
the source the roadmap's own rule ("gets a source or gets cut") requires.

### Three overclaims found and corrected live

**1 — About outcome 1 claimed Umbra has "no browser engine," which is false for a Tauri app.** Tauri
renders its UI in the OS's own webview (WKWebView/WebView2/WebKitGTK) — that *is* a browser engine, just
not a bundled one. The true, defensible distinction (and the one that actually explains why the app is
fast and small) is that Umbra doesn't ship its own copy of a browser runtime the way an Electron app
bundles Chromium. Corrected in §4 above to "no browser bundled inside it... doesn't ship its own copy of
Chromium" — same rhetorical job (fast because it isn't secretly a website), now a claim that survives
scrutiny from a reader who knows what Tauri actually is.

**2 — About outcome 3 and FAQ #2 both stated an ongoing developer practice ("checked before every
release," "per-release network check") that isn't currently true.** `landing-strategy.md` §5 already
found, live, that neither `v0.4.0` (PR #155) nor `v0.5.0-alpha.1` (PR #156) carries a pasted `nettop`
result — the checklist discipline lapsed after `v0.2.0`. Stating a per-release cadence as settled fact
is exactly the overclaim this gate exists to catch, and it's a worse one than most: because Umbra's repo
is source-available (ledger row 9), a skeptical reader can open the same PR history the developer
themselves would check and find the claim doesn't hold — the site's own transparency mechanism becomes
the thing that catches it in a lie. Corrected in §4 above: both now describe the check as something the
*visitor* can run against their own copy, not something the developer currently repeats every release —
this is also more consistent with the Proof section's own "don't take our word for it" framing, which
never claimed an ongoing developer-side cadence in the first place.

### Two related findings left as copy, named as pre-launch action items instead

**3 — The Proof section's self-check invites a specific, falsifiable prediction** ("you'll see one
connection... and nothing else, no matter which tool you use") **that has not actually been re-verified
against three of Umbra's nine current tools.** Story 5.3's only pasted result (`v0.1.2`) covers 7 tools;
OCR, PDF, and Images (ledger row 4's own history — added by Stories 8.7/8.8, after `v0.1.2`) were never
part of a published check, and — per finding 2 above — no check has been published for any release
since `v0.2.0` at all. This claim is left as drafted, not rewritten, because it follows from the
architecture claim (`landing-strategy.md` §5 row 16: no client-server split exists for *any* tool to
route through) rather than from an empirical test — so it's a legitimate prediction, not a fabricated
one. But a prediction the site invites a skeptic to go disprove needs to actually hold before the site
that makes it goes live. **Action item, carried to Step 8.1's pre-launch checklist:** re-run
`docs/release-checklist.md`'s `nettop` procedure against the current release, covering all 9 tools
including OCR/PDF/Images, and record the result in that release's PR, before this page ships. This is the
same unresolved item `landing-strategy.md` §5 already named without assigning it a step; Step 3.6 is
where it gets one.

**4 — The categorical claim "Umbra is a native app, not a client talking to a backend" sits several
lines above its own disclosed exception** (the GitHub update check), with no same-sentence qualifier
tying the two together. This is a live risk given this project's own GEO ambitions (Step 3.7): an
assistant doing extractive summarization could lift the categorical sentence alone and describe Umbra as
making literally zero network calls, with no disclosed exception — precisely the "assistant describing
Umbra wrongly" failure mode Step 7.5 names as the one worth watching for. **Not fixed here** — Step 3.7
is the step that re-edits copy for exactly this property (the direct answer and its scope in the same
breath, not spread across paragraphs), and 3.7's own guard rail requires it to check itself against this
gate rather than the reverse. Flagging as 3.7's first item, not rewriting ahead of it.

### Not a finding, but worth recording: the footer's analytics disclosure depends on work this gate can't verify yet

The finalized footer sentence (§5, "anonymous page-view and download-intent analytics only... no session
recording") is only as true as Step 6.8's still-unrun PostHog dashboard audit makes it — ledger row 13
already names this dependency explicitly, and Story 5.4's own review already flagged that
`autocapture: false` in code doesn't govern dashboard-level features (web vitals, exception capture,
rageclick). This isn't a new gap this step found; it's an already-tracked one this gate confirms is
still open and still gating final sign-off on that one sentence specifically — everything else in the
footer passes.

### Ledger traceability — every row, where it's cited

| Row | Claim | Cited in |
|---|---|---|
| 1 | Zero network calls except the disclosed update check | §3 (Proof), §4 (FAQ #4/#5, About #3), §4b (comparison tables) |
| 2 | Clipboard suggestion (in-app only) | Not cited anywhere on the site — correctly; no page mentions clipboard suggestions |
| 3 / 3a | OCR is the only AI feature; cron is never AI-framed | §4 (FAQ #7 links), §4b (OCR page, Cron page's explicit non-AI framing), §4b comparison tables |
| 4 | Nine current tools, exact names | §2 (feature tour, content-model-driven), §4 (FAQ #7 links), §4b (all 9 tool pages) |
| 5 | macOS signed/notarized | §3 (Proof), §4 (Download panel, FAQ #3, About #2) |
| 6 | Windows/Linux best-effort, no parity implied | §4 (Download panel, FAQ #1/#3, About #4) |
| 7 | Live `/releases/latest` check, no dead buttons | §4 (Download page's per-platform state) |
| 8 | No Windows/Linux minimum OS version | Correctly absent everywhere — no page states one |
| 9 | Source-available, not open source, no audit | §3 (Proof), §4 (FAQ #2, footer licence note), §4b (comparison tables' Source row) |
| 10 | Version never hardcoded | §4 (Download panel, written as `{template}` values) |
| 11 | Backlog cadence, calendar-scoped | §4 (Changelog framing) |
| 12 | "Free," present-tense only | §4 (Download intro), §4b (comparison tables' Price row) |
| 13 | Site analytics disclosure | §5 (footer) — **gated on Step 6.8's dashboard audit**, see above |
| 14 *(new)* | Cold launch under 2 seconds | §2 (Why Umbra #1), §4 (About #1) |
| 15 *(new)* | Keyboard/screen-reader accessibility, no contrast claim | §2 (Why Umbra #2) |
| 16 *(new)* | No client-server architecture | §3 (Proof) |

**Not on the ledger and not required to be:** the four comparison pages' competitor facts (`landing-ia.md`
§4's own citation-discipline mechanism — dated, sourced inline — covers these; the ledger governs Umbra's
own claims, not third-party ones, per §4b's own note) and all structural/UI microcopy with no factual
content (language switcher, 404 page, CTA verbs).

### Not decided here, deliberately

- **Whether to re-verify the four comparison pages' "47+ tools" / "~41 features" style competitor
  figures on a cadence** — `landing-copy.md` §4b already flagged this has no owner, unlike every ledger
  row; still true, still not this step's job to assign.
- **Exact wording once Step 3.7's extractability pass restructures the Proof section** — finding 4 above
  is handed to that step, not resolved here.

### Feeds directly into

- **Step 3.7** (extractability pass) — inherits finding 4 above as its first concrete item, and must
  check its own rewrites against this gate per its own stated guard rail.
- **Step 8.1** (pre-launch checklist) — inherits finding 3 above (re-run the nettop check against all 9
  tools) and the Step 6.8 dependency on row 13's footer sentence, both as named, citable check items.
- **Step 6.8** (analytics rework) — unchanged obligation, restated: cannot ship without confirming row
  13's footer sentence against the dashboard audit.
- **`landing-strategy.md` §5** — now carries rows 14–16, closing the two gaps §2 and §3 of this file
  flagged while drafting.

## §7 — SEO pass (Step 3.6b)

**Scope, restated from `README.md`'s own definition for this step, because the boundary matters more
here than in any other Phase 3 step:** title tags, meta descriptions, header *hierarchy* (semantic
levels — `<h1>`/`<h2>`/`<h3>` — not the wording inside headings already locked in §2–§4b), natural
search-query phrasing worked into existing body copy, internal linking for crawl equity, image alt-text
conventions, and canonical/hreflang wiring across the EN/FR pair. **Not in scope:** rewriting any
already-approved heading text, hero copy, or persuasive register — that's Phase 3's earlier steps, and
this pass doesn't reopen it. Where this step needs a genuinely new string that didn't exist before (a
few page `<title>`s and the four comparison pages' missing H1s), those are flagged explicitly below as
new copy, not silently authored as if already signed off — consistent with Phase 3 being "yours by
right" in `README.md`'s autonomy table.

**Why this is a separate pass from Step 3.7 (GEO), restated from the roadmap's own reasoning:** a
crawler ranking a page for a typed query and an assistant lifting a self-contained answer are different
consumers of the same copy, and the two techniques can pull in different directions (a heading rewritten
for AI-extraction phrasing can be a worse-targeted heading for search ranking). This pass establishes
the more stable, established discipline (titles, headers, links, canonical URLs) first, so 3.7 has
something concrete to check its own rewrites against, per that step's own guard rail.

**Method:** working session, `landing-ia.md` §1/§4 (the 23-route inventory: home, download, FAQ, about,
privacy, legal, EULA, changelog, tools hub, 9 tool pages, 4 comparison pages, 404) and `landing-copy.md`
§1–§5/§4b (every already-drafted heading and claim) read against each other, checked against
`landing-strategy.md` §5's claim ledger the same way §3.6 did — a title tag or meta description is still
a public claim, even at 60 characters. Astro's and `@astrojs/sitemap`'s current canonical-URL and
`hreflang` mechanics were verified live via Context7 (`/withastro/docs`) rather than assumed, per Rule 6
— two real gaps in this roadmap's own prior wording turned up as a result (see the canonical/hreflang
section below).

### Part 1 — Title tags and meta descriptions

**Convention:** `{Page-specific value} — Umbra` for every page except Home (`Umbra — {value}`, since
Home *is* the brand). Titles target ~50–60 characters; every EN title below (checked by character count
this session) lands under that ceiling, the longest being the JSON page at 50. Meta descriptions target
~150–155 characters, written direct-answer-first
(serves both a search snippet and, incidentally, Step 3.7's extractability goal, though that's not this
step's job to optimize for). **No exclamation marks, no cheerleading adjective** — `landing-copy.md` §1's
voice-spec floor applies here too; a meta description is public-facing copy like any other. Every claim
below traces to a ledger row exactly as strictly as on-page copy did at Step 3.6 — nothing here gets a
pass for being short.

**Deliberately kept vague on tool count and AI scope, on Home specifically** — consistent with §1's
"durable-claims" rule (`landing-strategy.md` §1): a title tag is one of the most persistent, hardest-to-
update public surfaces on the whole site (search engines cache it independently of the live page, often
for a long time), so it's exactly the wrong place to bake in a number or a scope statement likely to
need revision.

| Page | EN title | EN meta description | FR title | FR meta description |
|---|---|---|---|---|
| Home `/` | Umbra — Local, Offline Developer Tools | JSON, JWT, hashing, cron, and more — everyday developer tools that run entirely on your machine. Free, no account, no cloud. | Umbra — Outils de développement locaux et hors ligne | JSON, JWT, hachage, cron, et plus — des outils du quotidien qui fonctionnent entièrement sur votre machine. Gratuit, sans compte, sans cloud. |
| Download `/download` | Download Umbra — macOS, Windows & Linux | Download Umbra free for macOS, Windows, or Linux. Signed and notarized on macOS; Windows and Linux builds are best-effort. | Télécharger Umbra — macOS, Windows et Linux | Téléchargez Umbra gratuitement pour macOS, Windows ou Linux. Version macOS signée et notarisée ; Windows et Linux fournis en best-effort. |
| FAQ `/faq` | FAQ — Umbra | Is Umbra open source? Is it safe on Windows? Does it phone home? Direct answers to the most common questions. | FAQ — Umbra | Umbra est-il open source ? Est-il sûr sous Windows ? Envoie-t-il des données ? Réponses directes aux questions les plus fréquentes. |
| About `/about` | About Umbra — Built by One Developer | Umbra is built and maintained by a single developer. Here's what that means for speed, privacy, and testing. | À propos d'Umbra — Développé par une seule personne | Umbra est développé et maintenu par une seule personne. Voici ce que cela signifie pour la rapidité, la confidentialité et les tests. |
| Privacy `/privacy` | Privacy Policy — Umbra | What the Umbra website collects and doesn't: cookieless analytics, no session recording, no email capture. | Politique de confidentialité — Umbra | Ce que le site Umbra collecte et ne collecte pas : analyse sans cookies, sans enregistrement de session, sans collecte d'e-mails. |
| Legal notice `/legal` | Legal Notice — Umbra | Publisher identity, hosting provider, and intellectual-property status for the Umbra website, per French law. | Mentions légales — Umbra | Identité de l'éditeur, hébergeur et statut de propriété intellectuelle du site Umbra, conformément au droit français. |
| EULA `/eula` | End User License Agreement — Umbra | The terms for using the downloaded Umbra binary: personal use, no redistribution, no reverse engineering, as-is. | Contrat de licence utilisateur final — Umbra | Les conditions d'utilisation du binaire Umbra téléchargé : usage personnel, sans redistribution, sans ingénierie inverse. |
| Changelog `/changelog` | Changelog — Umbra | What's shipped in Umbra, release by release, pulled directly from GitHub — added, changed, fixed. | Journal des modifications — Umbra | Ce qui a été livré dans Umbra, version par version, directement depuis GitHub — ajouts, changements, corrections. |
| Tools hub `/tools` | Tools — Umbra | Nine everyday developer tools — JSON, Base64, UUID, Hash, JWT, Cron, Image to Text, PDF, Images — in one offline app. | Outils — Umbra | Neuf outils du quotidien — JSON, Base64, UUID, Hash, JWT, Cron, Image en texte, PDF, Images — réunis dans une application hors ligne. |
| JSON `/tools/json` | JSON Formatter, Validator & Diff — Offline — Umbra | Format, validate, explore, diff, and repair JSON entirely offline. No payload ever leaves your machine. | Formateur et validateur JSON — Hors ligne — Umbra | Formatez, validez, explorez, comparez et réparez du JSON entièrement hors ligne. Aucune donnée ne quitte votre machine. |
| Base64 `/tools/base64` | Base64 Encoder & Decoder — Offline — Umbra | Encode or decode text and files to Base64 entirely offline, including drag-and-drop. Nothing you paste ever leaves your machine. | Encodeur et décodeur Base64 — Hors ligne — Umbra | Encodez ou décodez du texte et des fichiers en Base64 entièrement hors ligne. Rien de ce que vous déposez ne quitte votre machine. |
| UUID `/tools/uuid` | UUID Generator (v4 & v7) — Offline — Umbra | Generate random (v4) or time-ordered (v7) UUIDs, one at a time or in bulk, entirely offline. | Générateur d'UUID (v4 et v7) — Hors ligne — Umbra | Générez des UUID aléatoires (v4) ou triables par date (v7), un par un ou en série, entièrement hors ligne. |
| Hash `/tools/hash` | Hash Generator — SHA-2, SHA-3, MD5, SHA-1 — Umbra | Compute SHA-2, SHA-3, MD5, or SHA-1 hashes of text or files entirely offline. Weak algorithms are flagged, not hidden. | Générateur de hachage — SHA-2, SHA-3, MD5, SHA-1 — Umbra | Calculez des empreintes SHA-2, SHA-3, MD5 ou SHA-1 de texte ou de fichiers hors ligne. Les algorithmes faibles sont signalés. |
| JWT `/tools/jwt` | JWT Decoder — Offline, No Server — Umbra | Decode a JWT's header and payload entirely offline — it never leaves your machine, and this tool doesn't verify signatures. | Décodeur JWT — Hors ligne, sans serveur — Umbra | Décodez l'en-tête et la charge utile d'un JWT entièrement hors ligne — sans jamais l'envoyer, et sans vérification de signature. |
| Cron `/tools/cron` | Cron Expression Builder — Offline — Umbra | Build a standard 5-field cron expression with a guided grid, or paste one to see it explained in plain language. | Générateur d'expression cron — Hors ligne — Umbra | Composez une expression cron à 5 champs avec une grille guidée, ou collez-en une pour la voir expliquée en langage clair. |
| OCR `/tools/ocr` | Image to Text (Local AI OCR) — Umbra | Extract text from a screenshot, photo, or scan with a bundled AI model that runs entirely on your machine. | Image en texte (OCR par IA locale) — Umbra | Extrayez le texte d'une capture, d'une photo ou d'un scan grâce à un modèle d'IA embarqué qui s'exécute sur votre machine. |
| PDF `/tools/pdf` | PDF Merge, Rotate & Reorder — Offline — Umbra | Merge, reorder, rotate, delete, and read text from PDF pages entirely offline. | Fusionner et modifier un PDF — Hors ligne — Umbra | Fusionnez, réorganisez, pivotez et lisez le texte de pages PDF entièrement hors ligne. |
| Images `/tools/image` | Image Converter (PNG, JPEG, WebP, AVIF) — Umbra | Convert, resize, and compress PNG, JPEG, WebP, and AVIF images entirely offline, with live before/after comparison. | Convertisseur d'images (PNG, JPEG, WebP, AVIF) — Umbra | Convertissez, redimensionnez et compressez des images PNG, JPEG, WebP et AVIF hors ligne, avec comparaison avant/après. |
| DevToys `/compare/devtoys` | Umbra vs. DevToys — Compared — Umbra | How Umbra compares to DevToys on price, platforms, tools, source, and privacy verification. Checked 2026-09-19. | Umbra vs. DevToys — Comparatif — Umbra | Comment Umbra se compare à DevToys : prix, plateformes, outils, code source, vérification de la confidentialité. |
| DevUtils `/compare/devutils` | Umbra vs. DevUtils — Compared — Umbra | How Umbra compares to DevUtils on price, platforms, tools, source, and privacy verification. Checked 2026-09-19. | Umbra vs. DevUtils — Comparatif — Umbra | Comment Umbra se compare à DevUtils : prix, plateformes, outils, code source, vérification de la confidentialité. |
| DevTools-X `/compare/devtools-x` | Umbra vs. DevTools-X — Compared — Umbra | How Umbra compares to DevTools-X, the other Tauri-based dev-tools app, on tools, licence, and privacy. | Umbra vs. DevTools-X — Comparatif — Umbra | Comment Umbra se compare à DevTools-X, l'autre application Tauri, sur les outils, la licence et la confidentialité. |
| CyberChef `/compare/cyberchef` | Umbra vs. CyberChef — Compared — Umbra | How Umbra's native toolbox compares to CyberChef, GCHQ's browser-based encoding tool. Checked 2026-09-19. | Umbra vs. CyberChef — Comparatif — Umbra | Comment la boîte à outils native d'Umbra se compare à CyberChef, l'outil web du GCHQ. |
| 404 | Page Not Found — Umbra | *(no meta description — `<meta name="robots" content="noindex">` instead; see Part 2)* | Page introuvable — Umbra | *(idem)* |

**Checked against the ledger:** every specific figure above (algorithm names, "free, no account,"
"signed and notarized," "best-effort," "bundled AI model") traces to the same rows §3.6 already verified
(4, 5, 6, 9, 12, 16) or to the tool pages' own already-grounded functional copy (§4b). Nothing new is
claimed; these are compressions of already-approved sentences, not new assertions. The one new *fact*
introduced at this length is the dated "Checked 2026-09-19" in each comparison-page description — already
established practice on those pages (§4b), just extended into the meta tag.

### Part 2 — Header hierarchy

**Finding, not a page-by-page audit only: none of the copy drafted in §1–§5 encodes semantic heading
levels — every section heading exists as bold prose or a blockquote in a planning document, not marked
`<h1>`/`<h2>`/`<h3>`.** That's correct for this file's own purpose (it's copy, not markup), but it means
Step 6.2/6.3 has no explicit instruction to build against unless this step supplies one — so that's this
section's actual deliverable: an explicit level for every heading already named elsewhere, plus the
handful of pages that never got an H1 at all.

**The rule, stated once:** exactly one `<h1>` per page. Every already-locked section heading (Feature
tour, Workflow, Proof, Why Umbra on Home; each FAQ question; each page's own section headers) is an
`<h2>`, never a second `<h1>`. A third level (`<h3>`) is used only where a page has a genuine two-level
structure — most of this site doesn't.

| Page | H1 | H2s | Notes |
|---|---|---|---|
| Home | The hero headline itself ("Local tools. Local AI. Nothing else." / FR equivalent) | "9 tools" · "Every tool, one search away" · "Verify it yourself" · "Why Umbra" | The Proof section's "There's no server for your data to go to" is a bolded lead sentence *within* the "Verify it yourself" H2, not its own heading — it doesn't need to be independently navigable, and demoting it avoids a needless H3 level. The four "Why Umbra" statements (Instant / However you work / Always your call / No strings attached) are the same case: bold lead-ins inside one H2 section, not four H3s — they're one-line taglines in a benefit strip, not standalone subsections with their own body content. |
| Download | "Download" | (OS panel labels: see the tabs finding below — not headings) | |
| FAQ | "FAQ" | Each of the 7 questions | Flat list, no intermediate grouping — every question is a direct H2, not nested under a topic H2. Matches `FAQPage` JSON-LD's own expectation of a flat Q&A list (feeds Step 6.6). |
| About | **New: the mission line itself becomes the H1** — no separate "About" heading exists or is needed | *(none — the page's own locked design, `landing-ia.md` §2, explicitly has "no section headers"; the four outcome statements stay bold lead-ins in flowing prose, the same treatment as Home's "Why Umbra")* | Reuses already-approved copy as the H1 rather than inventing new text — the mission line was already written to state "what Umbra is" in one sentence, which is exactly an H1's job. |
| Privacy | "Privacy Policy" | One H2 per named section (What this page covers · Data collected · What's not collected · Legal basis & your rights · Data controller & contact · Changes to this policy) | H1 text is new (Phase 4 hasn't written page prose yet) but matches the title-tag convention above; not a claim, just a label. |
| Legal notice | "Legal Notice" | Publisher identity · Hosting provider · Contact · Intellectual-property notice | Same status as Privacy — label only, Phase 4 still owns the body. |
| EULA | "End User License Agreement" | License grant · No redistribution · No reverse engineering or modification · "As-is," no warranty · Limitation of liability · Termination · Contact | Same. |
| Changelog | "Changelog" | Each version entry (`v{version} — {date}`) | The per-entry template already looks like a natural H2 (`landing-copy.md` §4) — confirming that here rather than leaving it as prose formatting. |
| Tools hub | "Tools" | *(none required — see the finding below)* | |
| Each of the 9 tool pages | The tool's exact `registry.ts` name (already locked, `landing-ia.md` §4) — e.g. plain **"JSON"**, not "JSON Formatter" | The mandatory micro-FAQ question(s) | **New, worth stating explicitly so it doesn't read as an inconsistency:** the `<title>` tag above ("JSON Formatter, Validator & Diff — Offline — Umbra") is deliberately more keyword-rich than the H1 ("JSON"). A title tag and an H1 serve different jobs — one is a search-result snippet competing against other results, the other is on-page consistency with the app's own naming (and the content model's `registry.ts`-sourced convention, `landing-ia.md` §4/§5) — and they don't need to match verbatim. |
| Each of the 4 comparison pages | **New: "Umbra vs. {Competitor}"** (e.g. "Umbra vs. DevToys") | The existing intro line becomes body copy under this H1, not replaced; "Comparison" section content stays as drafted | No H1 currently exists for these four pages — the intro sentence (§4b) was written as prose, not a heading. Flagging as new copy per this section's own scope note, not unilaterally locking it — the string itself makes no claim (it just names both products), so it doesn't need a ledger check, but it's still new user-facing text a developer should see before it ships. |
| 404 | "Page not found." (already drafted, §5) | *(none)* | Also needs `<meta name="robots" content="noindex, follow">` — a 404 should never be indexed, and this wasn't specified anywhere before now. |

**Two crawlability findings that are about markup mechanics, not heading levels — worth flagging here
since they'd otherwise silently undermine everything above:**

1. **Download page's OS tabs risk hiding two-thirds of the page from a crawler.** If the macOS/
   Windows/Linux panels are implemented as a typical tabbed UI where only the active panel's content
   exists in the DOM (conditionally rendered, not just visually hidden), a crawler that doesn't execute
   the tab-click interaction — and even one that does typically only sees whichever platform the page
   auto-selected for it — will only ever index one platform's copy. Given two of the three panels
   (Windows, Linux) carry real content this page needs indexed (the unsigned-build disclosure, the
   `chmod +x` note), **recommend all three panels render into the DOM unconditionally, toggled by CSS/
   `hidden` attribute rather than removed from the tree** — this is also the more accessible
   implementation (NFR5), since assistive tech generally handles `hidden`/ARIA-tab patterns over
   conditionally-mounted content more predictably. Flagged for Step 6.3.
2. **FAQ's answers need the same treatment if built as a collapsible accordion.** If each answer is
   collapsed by default via conditional rendering (not just `display: none`/`<details>`), a crawler may
   index only the questions, not the answers — and Step 6.6's planned `FAQPage` JSON-LD needs the
   visible page content to actually match the marked-up Q&A pairs, which a not-in-the-DOM answer breaks.
   **Recommend native `<details>`/`<summary>` elements** — content stays in the DOM and crawlable,
   collapse/expand is free accessibility (keyboard- and screen-reader-operable without extra ARIA wiring,
   feeding NFR5 the same way finding 1 does), and it removes a JS dependency for something that doesn't
   need one. Flagged for Step 6.3.

**Tools hub's card grid deliberately gets no headings.** Each of the 9 cards names a tool already
getting its own proper H1 on its own page — repeating 9 near-duplicate headings on the hub page dilutes
that page's own H1/nothing-else structure for no real gain (a hub page ranks for "Umbra tools list"-type
queries regardless of whether its card labels are headings or styled link text). Not a rule to import
elsewhere — the FAQ's flat list above genuinely needs H2s per question, since those *are* the page's
whole content, where the hub's cards are navigation to content that lives elsewhere.

### Part 3 — Natural search-query phrasing

**Distinct from Step 1.6's target list, restated because the two are easy to conflate:** §7's nine
questions are conversational, intent-loaded, assistant-facing phrasing ("is there an offline JSON
formatter... that works without internet"). A search-engine query for the same need is typically
shorter and more fragment-like ("json formatter offline," "json validator"). Most of the already-drafted
tool-page copy already reads close to natural phrasing because it was written direct-answer-first — this
section only recommends specific, additive term insertions where a real, high-volume synonym is
currently absent, checked against the voice spec (precision, not keyword-stuffing) before recommending
any of them:

| Page | Missing term | Why it matters | Suggested insertion point |
|---|---|---|---|
| Cron | "crontab" | A large share of the actual query volume for this tool category uses `crontab`, not "cron expression" — Unix/Linux users specifically search this term. | The micro-FAQ's "why not use a free online cron generator" answer, as a parenthetical synonym: "…a standard 5-field cron expression (the same syntax `crontab` uses)…" |
| Hash | "checksum" | "Checksum generator" is a common alternate query for the exact same function this page already describes; the page currently never uses the word. | The opening sentence or the micro-FAQ: "computes SHA-2, SHA-3, MD5, and SHA-1 digests — the same checksums a file's integrity is usually verified against." |
| UUID | "GUID" | Windows/.NET-ecosystem developers commonly search "GUID generator," not "UUID generator," for the identical concept. | A one-clause parenthetical in the opening sentence: "generates v4 or v7 identifiers (also called GUIDs)…" |

**Not recommended as insertions, deliberately:** any change to JSON, Base64, JWT, PDF, or Images page
copy — each of those already surfaces its dominant query terms naturally ("formats," "validates,"
"encodes," "decodes," "merges," "convert," "resize," "compress"), and forcing a synonym in without a
real gap would be padding, not precision. **Not recommended anywhere:** keyword-stuffing a term
unnaturally into a sentence just to raise its density — every insertion above reads as a normal
clarifying aside, not a bolted-on phrase, consistent with `landing-copy.md` §1's "specificity over
adjectives" rule extending to search terms as much as marketing ones.

### Part 4 — Internal linking for crawl equity

**Already well-linked, confirmed rather than re-decided:** Home's feature-tour grid links to all 9 tool
pages; the Tools hub links to all 9 tool pages (its whole purpose); FAQ topic 8 links to all 9 tool
pages; nav and footer both carry About, FAQ, Download, and (once built) the language switch, per §3/§5's
already-locked placements.

**Two real gaps found, both about pages that currently sit at the edge of the link graph:**

1. **The four comparison pages are under-linked relative to how much they're meant to carry.** Today
   their only inbound links are the FAQ's topic 7 (naming all four) and whatever the still-open
   hub-vs-footer question (`landing-ia.md` §4) eventually resolves to. Each targets a real, distinct,
   high-intent query ("Umbra vs. DevToys"), and none of the four currently link to each other or to
   anything besides the Download CTA at their own foot — they're four islands connected to the rest of
   the site by a single FAQ mention. **Recommendation, offered for confirmation rather than declared
   decided (this is the open question `landing-ia.md` §4 already flagged, and this step's own mandate —
   crawl equity — is a real reason to close it now):** add one footer line, "Compare: DevToys ·
   DevUtils · DevTools-X · CyberChef" (four inline links, no new hub page required), and a short
   cross-link block at the foot of each comparison page ("See how Umbra compares to the other three")
   linking to the remaining three. This resolves the internal-linking gap without forcing the
   per-page-section-vs-shared-component-vs-hub-page architectural question `landing-ia.md` §4 left open
   — it works under any of those three outcomes.
2. **No tool page currently links to another tool page, even where the content already implies one
   should.** The PDF page's micro-FAQ answer to "can it read text from a scanned PDF?" already *says*
   "the Image to Text tool's OCR can pull text out of the scan itself" (`landing-copy.md` §4b) but this
   is plain prose, not a hyperlink — a real, relevant, already-written cross-link opportunity sitting
   unused. **Recommendation:** turn that mention into an actual link to `/tools/ocr`. More generally,
   **each tool page should also link back to `/tools`** (the hub), which currently only receives links,
   never sends one — a small, low-effort addition that gives every tool page an escape hatch back to the
   full catalog, not just forward to Download.

**Orphan check — none found among launch-relevant pages.** Every page in the 23-route inventory has at
least one inbound internal link once the two additions above are made: Privacy/Legal/EULA/Changelog via
the footer, About via nav *and* footer, the two gaps above being the only pages that were thin rather
than unreachable. The 404 route is correctly *not* internally linked from anywhere — an error page
shouldn't have inbound links pointing at it on purpose.

### Part 5 — Image alt-text conventions

No product screenshots exist yet (Step 5.3's Epic-7 fork is still open) — this section sets the
convention Step 5.2/5.3 build against, so alt text doesn't get improvised per-image later.

- **Screenshots describe what's actually shown, factually** — matching the voice spec's "name the actual
  effect" rule (`landing-copy.md` §1) and the reference-scan finding that a real capture should show a
  tool mid-task with real content (`landing-strategy.md` §2, finding 2). Convention: `alt="Umbra's {tool
  name} tool showing {the specific real state captured}"` — e.g. `alt="Umbra's JSON tool showing a
  formatted payload in the collapsible tree view"`, never a generic `alt="screenshot"` or a keyword-
  stuffed string that reads as written for a search engine instead of a person.
- **Decorative images get `alt=""` (empty, not omitted).** Any purely visual element (a background
  texture, a repeated icon with no informational content beyond what adjacent text already says) should
  use an empty `alt` attribute so screen readers skip it — an NFR5 accessibility requirement, not just an
  SEO nicety, and the same "state the actual condition" discipline applied to what should say *nothing*.
- **The OG/social-share image (Step 5.4) needs its own `og:image:alt` tag**, separate from any on-page
  alt text for the same or a similar image — a detail sites commonly miss because it lives in `<head>`
  metadata, not next to the visible `<img>`.
- **The workflow section's video (Step 5.3, `landing-ia.md` §3) needs an accessible text alternative**,
  not just a poster-frame image's alt text — NFR5's "fully drivable without the mouse" baseline extends
  to "a screen-reader user can understand what the video demonstrates," which a poster image's alt text
  alone doesn't satisfy if the video conveys information the poster frame doesn't. Flagged for whoever
  implements Step 5.3/6.10's lazy-load/poster/no-autoplay treatment.
- **The logo/wordmark (Step 5.5, not yet supplied) gets `alt="Umbra"` where it stands alone** (e.g. the
  favicon-adjacent mark if used without accompanying text) — but where the header/nav already shows the
  word "Umbra" as adjacent text, the mark's alt text should be empty (`alt=""`) rather than repeating
  "Umbra logo," so a screen reader doesn't announce the same word twice in the same breath.

### Part 6 — Canonical URLs and hreflang across the EN/FR pair

**Verified live via Context7 (`/withastro/docs`), not assumed — two things this roadmap's own prior
wording (`README.md` Step 6.5) didn't spell out at the mechanism level:**

1. **Astro does not auto-generate a canonical `<link>` tag or per-page `hreflang` `<link>` tags.**
   Astro's own documented pattern for a canonical URL is `new URL(Astro.url.pathname, Astro.site)`,
   written by hand into a page or layout's `<head>` — there is no config option that does this
   automatically, for i18n or otherwise.
2. **`@astrojs/sitemap`'s `i18n` option (Step 6.5 already plans to set this) generates `hreflang`
   information only inside `sitemap.xml`** (as `xhtml:link` entries per URL), not in each page's own
   `<head>`. This is a real, valid signal search engines read — but it's a different, complementary
   mechanism to a per-page `<link rel="alternate" hreflang="...">` tag, not a substitute for one. Best
   practice (independent of Astro specifically) is both together, or at minimum a canonical tag on every
   page plus one of the two hreflang mechanisms.

**Concrete spec for Step 6.2/6.5's implementation, building on what Step 6.5 already decided
(`locales: ["en", "fr"]`, `defaultLocale: "en"`, `prefixDefaultLocale: false`):**

- `@astrojs/sitemap`'s `i18n` option: `{ defaultLocale: "en", locales: { en: "en-US", fr: "fr-FR" } }`.
  **Correction to watch for when implementing:** Astro's own current docs example happens to use
  `fr-CA` (Québécois French) — Umbra's French isn't regionally scoped, so the correct tag here is plain
  `fr-FR` (or unqualified `fr`, per the `hreflang` spec's own convention for a language with no
  region-specific variant), not a copy-pasted `fr-CA` from the example.
- In `Layout.astro`'s `<head>`, on every page: a canonical tag via `new URL(Astro.url.pathname,
  Astro.site)` — **each locale's own page is self-canonical; the EN and FR versions of a page must
  never canonicalize to each other.** They're genuinely different content in a different language, not
  duplicates — canonicalizing cross-language would tell search engines to drop the French version from
  the index entirely, the opposite of French shipping as a first-class locale (the Step 3.2 decision
  this whole rebuild now depends on).
- Also in `Layout.astro`'s `<head>`, on every page: `<link rel="alternate" hreflang="en" href="...">` /
  `hreflang="fr"` / `hreflang="x-default"` (pointing at the English URL, since `defaultLocale: "en"` with
  `prefixDefaultLocale: false` makes English the fallback) — built from `getRelativeLocaleUrl` (Astro's
  own documented `astro:i18n` helper) combined with `Astro.site` for the absolute URLs `hreflang`
  requires. This needs each page to know its own translated-URL counterpart, which the content model
  (Step 2.5's per-locale collection files) already makes mechanical rather than hand-maintained — flagged
  for Step 6.4 to wire alongside the collections it's already building, not a new data source.
- **Sequencing note, not a change needed now:** Legal notice's publisher-identity field and a few other
  Phase-4 pages are still placeholders. A `hreflang` pair pointing at a French legal page with no real
  content yet isn't a bug (empty prose ≠ a broken link), but worth remembering once those pages get
  written — a `hreflang` entry pointing at a 404 would be a real, if minor, crawl-error signal.

### Not decided here, deliberately

- **Whether the comparison-page cross-linking recommendation (Part 4, finding 1) is adopted as worded**
  — offered for confirmation, not locked, since it touches the open hub-vs-footer question
  `landing-ia.md` §4 already flagged as the developer's call.
- **The four comparison pages' new H1 text** (Part 2) — flagged as new copy needing the same sign-off
  any other Phase-3 string gets, not unilaterally finalized by virtue of appearing in an SEO pass.
- **Exact FAQ-entry anchor slugs** for the `hreflang`/canonical scheme to reference — `landing-copy.md`
  §5 already flagged this as contingent on how Step 6.3 builds FAQ anchors; unchanged here.
- **Structured-data (JSON-LD) implementation itself** — Step 6.6's job; this step supplies the
  per-page title/description metadata that schema partly derives from, per `README.md`'s own note that
  3.6b "feeds into" 6.6.

### Feeds directly into

- **Step 3.7** (GEO/extractability pass) — inherits this step's title/meta/header work as the stable
  layer to check itself against, per its own guard rail; must not silently undo any of it.
- **Step 6.2** (layout implementation) — the canonical/`hreflang` `<head>` wiring (Part 6) and the
  tabbed-download-page/FAQ-accordion DOM findings (Part 2) are direct build instructions.
- **Step 6.3** (page build) — the two crawlability findings (Download's OS tabs, FAQ's accordion) and
  the two new H1s (comparison pages) all land here.
- **Step 6.4** (content model) — the `hreflang` counterpart-URL lookup rides on the same per-locale
  collection files this step already builds; no new source of truth introduced.
- **Step 6.5** (i18n structure) — Part 6 supplies the exact `@astrojs/sitemap` `i18n` config value
  (with the `fr-FR`-not-`fr-CA` correction) that step's own entry left unspecified at the value level.
- **Step 6.6** (structured data) — the per-page titles/descriptions above are direct `SoftwareApplication`/
  `FAQPage` JSON-LD input, per `README.md`'s own note for this step.
- **Step 8.1** (pre-launch checklist) — "every page has a distinct title and description" (already named
  in that step's own checklist item) is now a concrete table to check against, not an abstract
  requirement.

## §8 — Extractability pass (GEO) (Step 3.7)

**Scope, per `README.md`'s own definition and its two guard rails:** re-edit already-finished copy so a
machine can lift a correct, self-contained answer — question-shaped headings matching §7's (of
`landing-strategy.md`) 9 target questions, the direct answer in the first sentence before elaboration,
facts stated in full rather than by pronoun, a comparison table, and visible dates on time-sensitive
material. **Not in scope:** anything that would undo §7's (of this file) SEO work — no title tag, no
locked H1/H2 wording, no internal link §7 placed gets touched — or weaken §6's ledger sign-off; every new
or changed sentence below is re-checked against the ledger the same way §6 checked everything else.
Where the two techniques (GEO vs. the site's own voice-spec/structural-rebuttal preference) genuinely
conflict, the conflict is named and left to the developer, per this step's own guard rail — one real
case turned up, see below, and it's resolved in favor of *not* changing anything.

**Method:** every already-drafted heading and answer in §2–§5/§4b read against `landing-strategy.md`
§7's 9-question target list and the extractability technique itself (direct answer, full noun phrasing,
one self-contained unit). Most of the site was already written close to this shape by design — §4b's
tool pages and micro-FAQs, §4's FAQ, §4b's comparison tables were all drafted direct-answer-first from
the start, and their own sections already say as much. This pass's actual, net-new work is: (1) the one
inherited item §6 flagged as this step's first job (the Proof section's categorical claim and its
exception, now fixed above in §3); (2) a pronoun audit across the FAQ, since a question's subject is
easy to lose when only the answer gets lifted (three fixes applied above in §4, plus one genuine
coverage gap closed with a new eighth FAQ entry); (3) the comparison table `README.md`'s own step
description names explicitly (Umbra vs. web-based tools vs. other desktop suites) — not yet drafted
anywhere, since the four existing comparison tables are each 2-column and per-named-competitor; (4) an
explicit query-to-content mapping, which is itself worth keeping as a record, not just a drafting aid;
and (5) naming the one real GEO/voice-spec conflict rather than resolving it by default. **Not run this
session:** `bmad-editorial-review-structure`, the tool the roadmap names for the heading pass — the
manual audit above covers similar ground (every heading in §2–§5/§4b was read against the target-question
list one by one), but the dedicated skill wasn't separately invoked. Flag if you want it run before
treating this step as fully closed, the same honest-status pattern §3.2 and §3 already used for their own
un-run tools.

### Query-to-content mapping — `landing-strategy.md` §7's 9 questions against the site as drafted

| # | Target question | Where it's answered | Coverage |
|---|---|---|---|
| 1 | Privacy-first alternative to DevToys/DevUtils | FAQ #6 (direct naming, §2c-sanctioned); the 4 `/compare/*` pages | Covered |
| 2 | Nothing pasted/dropped uploaded, anywhere | Home hero (structural, §1/§2c); FAQ #7 ("why not a free online tool") | Covered |
| 3 | Offline JSON formatter / JWT decoder for macOS | `/tools/json`, `/tools/jwt` — direct-answer-first opening sentences | Covered |
| 4 | Local OCR, no cloud API | `/tools/ocr` — direct-answer-first opening sentence | Covered |
| 5 | Windows/Linux utility, no telemetry | FAQ #1/#3 (trust/best-effort framing) + Download page + Home Proof (row 1) — compound, no single dedicated pair | Covered, distributed |
| 6 | How to check a desktop app is calling home | **Gap, closed this pass** — new FAQ #8, above | Closed |
| 7 | Verifiably private, not just claiming to be | New FAQ #8 (above) + comparison tables' "Privacy verification" row (§4b, already contrasts Umbra's runnable check against competitors' unverified assertions) | Covered, mostly by the same fix as #6 |
| 8 | Free all-in-one dev-utility app, no subscription/account | Download page intro; comparison tables' Price row | Covered |
| 9 | Free JSON/JWT/UUID tool, no ads/paywall | Site-wide via ledger row 12 (Download page, comparison tables) — **not restated on the individual tool pages themselves** | Partial — see the flag below |

**Flag, not fixed here: query 9 has no self-contained answer on the page it would actually land a
visitor on.** A visitor (or assistant) reaching `/tools/json` directly — the natural landing page for
"free JSON tool, no ads" — finds no sentence on that page stating Umbra is free. The fact exists
site-wide (ledger row 12) and on Download/comparison pages, but GEO's whole premise is that an assistant
often lifts one page's content in isolation, not the whole site's. **Recommended, not applied:** a short
"free, no account" clause added to each of the 9 tool pages' opening sentence or micro-FAQ — one clause
each, already licensed by ledger row 12, no new claim. Not applied unilaterally in this pass because it
touches nine already-signed-off pages' copy at once, the same restraint §4 used when it scoped the tool
pages themselves out to a dedicated session rather than write them inline. Flag for developer
confirmation before a future session applies it.

### The comparison table `README.md` names for this step

The four `/compare/*` pages (§4b) each answer "Umbra vs. [one named desktop competitor]." They don't
answer the two other shapes of the same underlying question this step's own instruction names —
Umbra vs. the *category* of free web-based tool, and Umbra vs. desktop toolboxes as a class rather than
one named product. `landing-ia.md` §4 already flagged this exact table as planned-but-not-yet-drafted,
with its placement (a Home section, a shared component across the four comparison pages, or its own hub
page) left open pending Step 2.5/a future session. **This pass drafts the content; placement stays open,
per that existing flag — not decided here.**

**EN:**

*A wider comparison — not just the three named desktop competitors, but the two other categories the
same decision usually comes down to.*

| | Umbra | Web-based tools (an online JSON formatter, JWT decoder, etc.) | Other desktop toolboxes (DevToys, DevUtils, DevTools-X) |
|---|---|---|---|
| Where your data goes | Stays on your machine. One disclosed exception: an automatic check for app updates, at launch. | Sent to a server you don't control, even if only for a second. | Local, for the tools that are — check each one; "desktop" doesn't guarantee offline-only. |
| How you can verify that | A documented, repeatable network-monitor check you run yourself. | No way to verify — you're trusting the server operator. | States the claim in a sentence; no published verification mechanism found for DevToys, DevUtils, or DevTools-X as of 2026-09-19 (see the individual comparison pages). |
| Works without an internet connection | Yes — a native app, no server dependency. | No — needs a live connection to the tool's own server. | Yes, once installed. |
| Cost | Free, no account. | Usually free, often ad-supported. | Free (DevToys, DevTools-X) or paid (DevUtils). |
| Local AI feature | Yes — offline OCR (Image to Text), a bundled model, nothing uploaded. | N/A. | None found, across DevToys, DevUtils, or DevTools-X, as of 2026-09-19. |

**FR:**

*Une comparaison plus large — pas seulement les trois concurrents natifs nommés, mais les deux autres
catégories auxquelles ce choix se ramène le plus souvent.*

| | Umbra | Outils web (formateur JSON en ligne, décodeur JWT en ligne, etc.) | Autres suites de bureau (DevToys, DevUtils, DevTools-X) |
|---|---|---|---|
| Où vont vos données | Restent sur votre machine. Une exception assumée : la vérification automatique des mises à jour, au lancement. | Envoyées à un serveur que vous ne contrôlez pas, ne serait-ce que brièvement. | Locales, pour les outils qui le sont — à vérifier au cas par cas ; « de bureau » ne garantit pas le hors ligne. |
| Comment le vérifier | Un contrôle réseau documenté et reproductible, que vous exécutez vous-même. | Aucun moyen de vérifier — vous faites confiance à l'opérateur du serveur. | Affirmé en une phrase ; aucun mécanisme de vérification publié trouvé pour DevToys, DevUtils ou DevTools-X au 19/09/2026 (voir les pages de comparaison individuelles). |
| Fonctionne sans connexion internet | Oui — une application native, sans dépendance à un serveur. | Non — nécessite une connexion active au serveur de l'outil. | Oui, une fois installé. |
| Coût | Gratuit, sans compte. | Généralement gratuit, souvent financé par la publicité. | Gratuit (DevToys, DevTools-X) ou payant (DevUtils). |
| Fonctionnalité d'IA locale | Oui — OCR hors ligne (Image en texte), modèle embarqué, rien n'est téléversé. | Non applicable. | Aucune trouvée, chez DevToys, DevUtils ou DevTools-X, au 19/09/2026. |

**Checked against the ledger:** every Umbra-column cell traces to a row already established (1, 5, 6, 7,
9, 12, 16) or to §4b's own already-approved tool-page copy (the OCR cell). Every competitor-column cell
uses the same falsifiable, non-disparaging, dated register §4b's four pages already established ("no
published verification mechanism found... as of [date]," never a claim about what a competitor
*doesn't* do). No new fact is asserted about any named competitor beyond what §4b's own sourced research
already found.

### The one real GEO/voice-spec conflict — named, not silently resolved

GEO's question-shaped-heading technique and this project's own decided preference for **structural
rebuttal over direct naming in persuasive copy** (`landing-strategy.md` §2c, encoded as a voice rule in
this file's §1) pull in different directions on exactly one section: Home's Proof section, "Verify it
yourself." The literal question-shaped version of that section's content — something like "How can I
check whether Umbra actually calls home?" — is almost verbatim `landing-strategy.md` §7's query 6, and
would be the single strongest heading-to-query match anywhere on the site. But phrasing it that way
states the reader's skeptical doubt directly, in the hero/home register §2c specifically decided
against — the same rule that already keeps DevToys/DevUtils unnamed in persuasive copy and confines
direct objection-naming to the FAQ and comparison pages.

**Resolved in favor of no change to Home, not a compromise:** the literal, question-shaped, fully
self-contained version of this exact query now exists anyway — as the new FAQ #8 above — without
touching Home's register at all. This is the same split the project has used everywhere else (structural
on Home, direct on FAQ/tool pages/comparison pages, per §2c and this file's §1), applied to the one place
GEO's own technique would otherwise have pushed against it. Nothing on Home needed to change for query 6
to get a real, citable answer.

### Visible dates — checked, no new work needed

The four comparison pages and the new table above already carry an explicit "checked 2026-09-19" date on
every competitor fact (§4b's own established discipline, extended above). Two things worth confirming
explicitly rather than assuming: **Home's own claims are deliberately not dated** ("under 2 seconds," "9
tools," the Proof section's self-check) — correct, not an oversight. Dating a claim that's re-verified
per-release (row 14) or that reads live from the content model (row 4) would either go stale immediately
or duplicate a mechanism (build-time freshness) that already exists; GEO's "visible dates" technique is
about *time-sensitive facts a page states as fixed text*, and the site's actual recency signal for "is
this maintained" already lives in one place built for exactly that job — the Changelog's dated entries
(ledger row 11) — not scattered across every claim on every page.

### Re-checked against the ledger, this step's own new/changed sentences

| Sentence changed or added | Ledger row | Note |
|---|---|---|
| Proof section's opening paragraph (EN/FR, §3) | Row 1 | Same claim as before, now stated with its exception in the same breath — no new fact |
| FAQ #2/#3/#5 pronoun fixes (§4) | Rows 9, 6, 1 | Wording only, no claim changed |
| New FAQ #8 (§4) | Row 1 | Restates the Proof section's own already-approved claim in Q&A form |
| New comparison table (above) | Rows 1, 5, 6, 7, 9, 12, 16 | Every Umbra cell already-approved; every competitor cell uses §4b's own already-established citation register |

**No overclaim found or introduced.** This pass adds a table and a FAQ entry and tightens a handful of
sentences; it doesn't license any new assertion the ledger didn't already permit before this step ran.

### Not decided here, deliberately

- **The comparison table's placement** — Home section, shared component across the four `/compare/*`
  pages, or its own hub page — stays open, per `landing-ia.md` §4's existing flag; this step only
  supplies the content.
- **The nine tool pages' "free, no account" gap** (query 9, flagged above) — recommended, not applied;
  touches nine already-signed-off pages, so it needs the same sign-off any other Phase 3 addition gets.
- **`bmad-editorial-review-structure`** — not run this session; flag if wanted before closing this step
  out fully.

### Feeds directly into

- **Step 3.6 (re-run)** — the re-check table above is a head start, not a substitute for a full re-run
  once this step's changes are considered final.
- **Step 5.2 / 6.3** — needs the new comparison table's placement decided and built once that's resolved;
  needs the new FAQ #8 laid out like the other seven.
- **Step 6.6** (structured data) — the FAQ's `FAQPage` JSON-LD now covers eight Q&A pairs, not seven.
- **Step 7.5** (AI visibility baseline) — the query-to-content mapping table above is the direct answer
  to "does the site actually say this yet" for each of `landing-strategy.md` §7's 9 questions, useful
  context when that step re-asks them post-launch.
- **Step 8.1** (pre-launch checklist) — "every claim traces to the ledger" (already a checklist item)
  now includes this step's own additions per the re-check table above.

## §9 — Capability-differentiation pass (long-tail SEO/GEO) (Step 3.8)

**Method:** for each of the 9 tools, checked `src/stores/registry.ts` and `src/locales/en.json` live
(same sources §4b used) against the same four competitors §4b already researched —
`devutils.com`, `devtoys.app` (the open-source desktop app, GitHub `DevToys-app/DevToys` — see the
correction below), `github.com/fosslife/devtools-x`, and `gchq.github.io/CyberChef` — via WebFetch and
WebSearch, checked live 2026-09-20. Per the roadmap's own guard rail, a capability only gets written up
once actually verified; three of the nine tools turned up nothing solid enough to write, and are
recorded as such below rather than papered over with a manufactured claim.

### Correction found while researching: two impostor sites, caught before they contaminated anything

Search results for the Cron tool surfaced **`devutility.tools`**, a page whose name is close enough to
`devutils.com` that a search summary treated a feature ("shows the next 5 run times") as if it were
DevUtils' own — and separately, **`devtoys.pro`** ("DevToys Web Pro"), an unrelated paid web product
that turned up repeatedly claiming AVIF/WebP image conversion and a cron next-runs preview, as if it
were `devtoys.app`, the actual open-source desktop app this roadmap named. Neither impostor is
affiliated with the real competitor as far as this session found. This is the same failure mode
`landing-strategy.md` §2's Warp correction and §2c's "public repo ≠ open source" correction already
caught in this project — an AI-search result asserting something confidently, sourced from the wrong
page — and it's exactly why this step re-verified against the named sources directly (GitHub repos,
the vendor's own domain) rather than trusting a search summary. **Practical consequence:** every claim
below that touches Cron or Images was checked twice against the *correct* domain/repo before being
written; nothing sourced from `devutility.tools` or `devtoys.pro` appears anywhere in this section.

### The table

| Tool | Capability found | Checked against | Verdict |
|---|---|---|---|
| JSON | Repair tab fixes common mistakes and shows a preview before applying — already drafted in §4b's micro-FAQ, not yet framed as a competitor gap | `devutils.com` (format/validate only), `devtoys.app` (Formatters: format/validate only, no repair tool anywhere in its 30-tool list), `github.com/fosslife/devtools-x` (Formatter/Minifier only), CyberChef (no repair operation documented) | **Add** — none found, 2026-09-20 |
| Base64 | One tool auto-detects what a decoded value is (a JWT, an image, an unrecognized binary) and displays it accordingly; a data-URI builder is the same tool, not a separate one | All four split "Base64 text" and "Base64 image" into two separate encode/decode tools — the user has to already know which one to open | **Add** — none found, 2026-09-20 |
| UUID | — | `devutils.com` supports v1/v3/v4/v5, no v7 found; `devtoys.app` added v7 support in 2024 (confirmed, GitHub issue #1238 + release notes) | **No differentiator found** — v7 isn't a gap against DevToys specifically, and bulk-generate-and-download-as-file couldn't be confirmed present or absent for any of the four. Page stays as drafted. |
| Hash | The Verify field states a match/mismatch per algorithm against a pasted expected digest, and a hash-shaped clipboard paste is offered a one-click move into Verify | `devutils.com` and `github.com/fosslife/devtools-x` generate only, no comparison feature described anywhere found; `devtoys.app` has an "Output Comparer" field with a long-standing, still-open bug report (GitHub issue #396, filed 2022) that it doesn't actually indicate a match — worded here as "an open bug report exists," not "the feature is broken today," since this session couldn't confirm current behavior first-hand | **Add** — checked 2026-09-20 |
| JWT | Flags a token as unsigned or using an unreadable algorithm ("anyone can create or alter it") — distinct from, and in addition to, §4b's already-drafted relative-expiry copy | No equivalent warning found in any of the four tools' descriptions | **Add** — none found, 2026-09-20 |
| Cron | — | See the correction above — no reliable, source-confirmed feature gap could be established for any of the three real competitor cron tools (`devutils.com`'s Cron Job Parser, `devtoys.app`'s Cron Parser, DevTools-X's Cron Editor) once the impostor-site results were discarded | **No differentiator found** — page stays as drafted |
| OCR | Recognized text is selectable directly on top of the image (not just dumped as a separate text box), plus a find-in-image search with match navigation | None of the four ship an OCR tool at all — this makes the *general* "even the AI is private" claim (row 3) the real differentiator, and a narrower functional claim isn't meaningfully checkable against a competitor set with no comparable feature to check against | **Add anyway, framed as its own long-tail query** — the capability is real (verified in `en.json`'s `overlayLabel`/`find`/`nextMatch` keys) even though it isn't a "competitor lacks X" claim in the usual sense |
| PDF | Merges, reorders, rotates, deletes, and extracts a page range — non-destructively (edits apply to an in-memory copy; the original file on disk is untouched until you explicitly save) | `devutils.com` and `devtoys.app` have no PDF tool at all; `github.com/fosslife/devtools-x` has a PDF *Reader* only (viewing, no page editing) | **Add** — strongest gap of the nine, checked 2026-09-20 |
| Images | Converts to WebP and AVIF, not just PNG/JPEG | `devutils.com` has no general image-format converter (only Base64 image encode/decode); `devtoys.app`'s image tool ships as a "PNG/JPEG Compressor" — AVIF/WebP support is an open GitHub feature request (Discussion #360), not shipped, as of 2026-09-20; `github.com/fosslife/devtools-x`'s Image Compressor/Converter exists but its supported output formats could not be confirmed either way — **not claimed as a gap against DevTools-X specifically** | **Add, DevUtils/DevToys only** — checked 2026-09-20 |

### New headings / micro-FAQ entries (append to each tool page, additive to §4b — doesn't replace anything there)

**JSON** (`/tools/json`) — new micro-FAQ pair, phrased as the narrow query rather than restated as a
generic feature:
- EN: *Is there a JSON formatter that fixes broken JSON, not just formats valid JSON?* Most free JSON
  formatters — including the ones built into DevUtils and DevToys — validate and flag an error; they
  don't offer to fix it. Umbra's Repair tab suggests fixes for common mistakes (a missing comma, an
  unquoted key) and shows a preview before you apply anything.
- FR: *Existe-t-il un formateur JSON qui corrige le JSON invalide, pas seulement qui le formate ?* La
  plupart des formateurs JSON gratuits — y compris ceux de DevUtils et DevToys — valident et signalent
  une erreur, sans proposer de la corriger. L'onglet Réparer d'Umbra propose des corrections pour les
  erreurs courantes et affiche un aperçu avant de les appliquer.

**Base64** (`/tools/base64`) — new micro-FAQ pair:
- EN: *Is there a Base64 decoder that tells me what I just decoded?* Most free Base64 tools split text
  and image decoding into two separate tools, so you have to already know which one to open. Umbra
  decodes into one tool and shows you what it found — a JWT, an image, or an unrecognized binary —
  rather than making you guess first.
- FR: *Existe-t-il un décodeur Base64 qui identifie ce qu'il vient de décoder ?* La plupart des outils
  Base64 gratuits séparent le décodage de texte et d'image en deux outils distincts — il faut donc
  déjà savoir lequel ouvrir. Umbra décode dans un seul outil et affiche ce qu'il a trouvé — un JWT, une
  image, ou un binaire non reconnu — plutôt que de vous laisser deviner.

**Hash** (`/tools/hash`) — new micro-FAQ pair:
- EN: *Can it tell me if a file matches a published checksum, not just compute one?* Yes — paste the
  expected digest into Verify and Umbra states a match or mismatch against every algorithm you've
  selected; if you paste a hash-looking value into the main input by mistake, it offers to move it into
  Verify for you.
- FR: *Peut-il me dire si un fichier correspond à une empreinte publiée, pas seulement la calculer ?*
  Oui — collez l'empreinte attendue dans Vérifier et Umbra indique une correspondance ou non pour
  chaque algorithme sélectionné ; si vous collez une empreinte par erreur dans le champ principal,
  l'outil propose de la déplacer vers Vérifier.

**JWT** (`/tools/jwt`) — new micro-FAQ pair, in addition to the "does it verify the signature" pair
§4b already drafted:
- EN: *Can it warn me if a token isn't signed?* Yes — Umbra flags a token as unsigned or using an
  unreadable algorithm, which means anyone could have created or altered it, before you read anything
  else on the page.
- FR: *Peut-il m'avertir si un jeton n'est pas signé ?* Oui — Umbra signale un jeton non signé ou dont
  l'algorithme est illisible, ce qui signifie que n'importe qui aurait pu le créer ou le modifier.

**Image to Text** (`/tools/ocr`) — new micro-FAQ pair:
- EN: *Can I select the text directly on a screenshot, not just copy a text dump?* Yes — recognized
  text stays selectable right on top of the image itself, and you can search within it with match
  navigation, rather than working from a separate plain-text box that's lost its layout.
- FR: *Puis-je sélectionner le texte directement sur une capture d'écran, pas seulement copier un bloc
  de texte ?* Oui — le texte reconnu reste sélectionnable directement sur l'image, et vous pouvez y
  rechercher avec navigation entre les résultats, plutôt que de travailler depuis un simple bloc de
  texte qui a perdu sa mise en page.

**PDF** (`/tools/pdf`) — new micro-FAQ pair:
- EN: *Is there a free tool to merge, rotate, or delete PDF pages without uploading them anywhere?*
  Umbra's is one of the few that does — none of DevUtils, DevToys, or CyberChef ship any PDF tool at
  all, and DevTools-X's is a viewer only. Umbra merges, reorders, rotates, deletes, and extracts pages,
  and never touches the file on disk until you explicitly save a copy.
- FR: *Existe-t-il un outil gratuit pour fusionner, pivoter ou supprimer des pages PDF sans les
  téléverser ?* Celui d'Umbra en fait partie — ni DevUtils, ni DevToys, ni CyberChef ne proposent
  d'outil PDF, et celui de DevTools-X n'est qu'une visionneuse. Umbra fusionne, réorganise, pivote,
  supprime et extrait des pages, sans jamais modifier le fichier sur le disque avant un enregistrement
  explicite.

**Images** (`/tools/image`) — new micro-FAQ pair:
- EN: *Can it convert images to AVIF or WebP, not just PNG and JPEG?* Yes — DevUtils has no general
  image converter, and DevToys' image tool is currently PNG/JPEG only (AVIF/WebP support is an open
  feature request as of this writing). Umbra converts to PNG, JPEG, WebP, or AVIF today.
- FR: *Peut-il convertir des images en AVIF ou WebP, pas seulement en PNG et JPEG ?* Oui — DevUtils n'a
  pas de convertisseur d'images généraliste, et l'outil de DevToys est aujourd'hui limité à PNG/JPEG
  (le support AVIF/WebP est une demande de fonctionnalité encore ouverte). Umbra convertit dès
  aujourd'hui vers PNG, JPEG, WebP ou AVIF.

**UUID and Cron get no new heading** — the guard rail this step's own README entry states applies:
"if nothing real turns up for a given tool, that tool's page stays as drafted rather than getting a
manufactured differentiator." Both pages ship exactly as §4b left them.

### Not decided here, deliberately

- **Re-verification owner for every competitor fact above** — same open gap §4b already flagged for
  its own comparison-page facts ("47+ tools," "~41 features"); this step adds seven more dated facts
  (the DevToys bug report, the GitHub feature-request status, DevUtils' UUID version list) with the
  same no-owner-yet status.
- **DevTools-X's Image Compressor's exact output-format list** — genuinely unconfirmed, not silently
  assumed either way; a future session with direct access to the app (rather than search/fetch) could
  close this in minutes.
- **Whether OCR's micro-FAQ entry duplicates ground the site's general "even the AI is private" claim
  already covers** — added anyway since the capability is real and the query is narrower/different in
  kind (a workflow detail, not a privacy claim), but flagged in case a future editorial pass finds it
  redundant.

### Feeds directly into

- **Step 3.6 (re-run)** — seven new sentences across six tool pages need the same ledger check every
  other Phase 3 addition gets; none of them touch a numbered ledger row directly (these are competitor
  comparisons, the same un-ledgered category §4b's comparison pages already established), but the
  "none found as of [date]" register needs the same scrutiny §4b's table got.
- **Step 6.3** (page build) — seven new micro-FAQ pairs to add to the six tool-page templates; no new
  pages, no routing changes.
- **Step 6.6** (structured data) — six tool pages' `FAQPage`/micro-FAQ JSON-LD gains one more Q&A pair
  each (except UUID, Cron, and — net two, not one, for JWT).
- **Step 8.1** (pre-launch checklist) — the "not decided here" re-verification gaps above join the
  existing unowned competitor-fact list from §4b, not a new category of risk.
