---
title: "Umbra — Landing Page Strategy"
status: draft
created: 2026-09-17
updated: 2026-09-20 (Step 3.6 — ledger rows 14–16 added to §5, closing the gaps §2/§3 of `landing-copy.md` flagged)
---

# Umbra — Landing Page Strategy

> Companion to `_bmad-output/planning-artifacts/landing-page/README.md`'s Phase 1. Each `§` below
> corresponds to one roadmap step; later steps append their own `§`, they don't rewrite this one.

## §1 — Positioning & audience brief (Step 1.1)

**Method:** Run via `bmad-prfaq`'s press-release forcing exercise (headline → subhead → problem →
solution paragraph), scoped to a page-level positioning brief rather than a full product PRFAQ —
this step's deliverable is the four items below, not a complete press release + customer/internal
FAQ. Headline/subhead wording below is a **positioning claim**, not locked ad copy — Step 3.2 runs
its own dedicated headline brainstorm (3–5 candidates) against it and against the current site's
existing "Developer tools that don't phone home."

### The one-sentence claim

> Umbra is the developer toolbox where nothing you paste, drop, or type ever leaves your machine —
> including its AI feature.

Sharpened from the PRD's own positioning line ("the privacy-first toolbox where even the AI is
private," explicitly **not** "out-features DevToys/DevUtils/DevTools-X"). This is the wedge: the one
narrow, provable, uncopyable claim (verified per-release via Story 5.3's `nettop` check) that leads
the page. It does not compete on feature count or platform breadth.

**Working headline/subhead direction** (confirmed with the developer this session; final wording is
Step 3.2's job):

- Headline: *"Tools that stay on your machine. Even the AI."*
- Subhead: *"The everyday tools you already reach for, one keystroke away, fully offline."*

Rejected direction: leading with convenience/workflow ("the dev-tools app you actually keep open")
instead of privacy. Rejected because it reads as competing with DevToys/DevUtils on completeness —
the one thing the PRD says not to do — and because the privacy/local-AI claim is the one no
competitor can copy, so burying it as a second beat wastes Umbra's rarest asset.

**Structure locked:** privacy leads (headline — the wedge), convenience/workflow follows (subhead —
broadens appeal to any developer, not only privacy-motivated ones, without displacing the wedge).

### The visitor's job-to-be-done

Two audiences share one page-visit motivation, at different intensities:

1. **Privacy-motivated developers/freelancers** (e.g. handling client data or NDA'd work): actively
   distrust pasting anything into an unknown web tool and are evaluating whether Umbra is
   trustworthy enough to replace that habit.
2. **Any developer, privacy-motivated or not**: reaches for the same handful of utility tools
   (JSON, JWT, hashing, UUIDs, cron, OCR) dozens of times a week, and is tired of the ritual of
   re-searching the web for the same tool every time — a workflow/friction complaint, not a privacy
   one. This is the audience the primary/secondary split in the roadmap's locked decisions table
   ("Developers first; recruiters second") is actually pointing at: the page's primary audience is
   *developers broadly*, not narrowly "privacy-conscious developers."

Both groups are doing the same job — "get this small task done without leaving my flow" — for
different reasons. The headline earns audience 1; the subhead earns audience 2.

**Correction carried forward from Step 0.1's read-in:** the app is cross-platform (macOS, Windows,
Linux — NFR3, shipped per the Sept 2026 release-packaging work), not "a native macOS app." Platform
availability is real content for the download page, not hero copy — naming all three OSes in the
subhead was tried and rejected as spec-sheet clutter that doesn't belong in a punchy one-liner.

### What the page implicitly argues against

Not a competitor by name (that's Step 1.3's objection map, done separately) — the *belief* the page
has to quietly dismantle: **"a privacy-respecting, local tool must be less convenient or less
complete than the web tool/app I already use."** The page's whole shape (one keystroke, tools you
already use, nothing new to learn) is the rebuttal, without ever saying "we're as good as X."

### The single conversion action

**Download**, for the visitor's platform. Already locked by the roadmap's decisions table: no
email capture, no pricing/monetisation, nothing else competes for the click. "Notify me" intent
routes to GitHub Watch/Releases as a line of copy, not a form.

### Standing rule raised this step (applies to all later copy phases, not just this brief)

**Landing-page copy should avoid emphasizing a fact that's true today but likely false tomorrow,
especially when the specificity doesn't even strengthen the pitch.** Concrete example that
surfaced this rule: an early headline draft paired "even the AI" with an immediate reveal that the
only AI feature is OCR — since more AI features are on the roadmap, naming the current scope
undercuts the tease rather than earning it, and would read as stale once untrue. The final
headline keeps "Even the AI" without elaborating on scope, for exactly this reason. This does not
license omitting or misstating anything in an exhaustive listing (e.g. the feature-tour section
must still name every real tool) — it targets *emphasis in persuasive copy*, not completeness.
Saved to memory (`landing-page-durable-claims`) since Phase 3's copy sessions run separately from
this one.

**Not re-litigated here, done separately per the roadmap:** competitive reference scan (Step 1.2),
objection map (Step 1.3), success/event plan (Step 1.4), the claim ledger (Step 1.5), AI-answer
target list (Step 1.6).

## §2 — Reference scan (Step 1.2)

**Method:** direct browsing (Claude in Chrome) of live sites on 2026-09-17, not recalled from
training data — deliberately, since one finding below (Warp) shows exactly why that distinction
matters. Seven sites reviewed: three direct competitors (devutils.com, devtoys.app,
fosslife/devtools-x), four aspirational-adjacent (raycast.com, linear.app, warp.dev, zed.dev).
Landing-page galleries (Land-book etc.) were not needed — the seven sites gave enough structural
range on their own. Findings below are conventions extracted across sites, not a site-by-site
design review — the roadmap step deliberately asked for the former, not the latter.

### Site notes

| Site | Category | What it actually is (as of 2026-09-17) |
|---|---|---|
| devutils.com | Direct competitor | macOS-only toolbox, 47+ tools, paid |
| devtoys.app | Direct competitor | OSS, cross-platform, free |
| fosslife/devtools-x | Direct competitor | OSS, cross-platform (Tauri, like Umbra), free — dedicated marketing site (devtools.fosslife.com) is currently **dead**; GitHub README is its only surviving front door |
| raycast.com | Aspirational | macOS launcher, freemium, mature multi-product company |
| linear.app | Aspirational | Web/cloud product-dev tool, not a downloadable binary |
| warp.dev | Aspirational (with caveat) | **Repositioned since it was last relevant as a comparable** — now an enterprise "agentic software factory" platform, "book a demo" as primary CTA, terminal download demoted to a secondary outline button. See finding 7. |
| zed.dev | Aspirational | OSS code editor, cross-platform, closest structural match to what Umbra needs |

### Conventions worth naming

**1. Above-the-fold copy density is a real spectrum, and it correlates with how much trust the
brand already has banked elsewhere.** devutils.com stacks a headline, 3 checkmark bullets, a star
rating, and version/OS text all before any screenshot — a "convince me now" hero. raycast.com and
linear.app do the opposite: one headline, one short subhead, zero bullets, zero proof, CTA deferred
or minimal. zed.dev and devtoys.app sit in between (headline + one subhead line, no bullets).
**Why this matters for Umbra specifically:** §1's locked headline/subhead structure already sits at
the low-copy end of this spectrum. That's fine as a style choice, but Raycast and Linear can afford
an almost-empty hero because they already have name recognition and (Step 3.5's own honesty-pass
problem) *nothing else needs to prove trust that early*. Umbra has no social proof yet and no name
recognition — the low-copy hero is a legitimate choice, but it's not automatically the *safe* choice
the way it is for them. Worth deciding deliberately at Step 3.2, not by default imitation.

**2. The hero screenshot is real and dense, not a sanitized empty state — with one outlier.**
devutils.com shows a busy sidebar with 15+ visible tools; zed.dev shows a real editor mid-task with
actual diagnostics and a populated file tree. devtoys.app is the exception — its hero screenshot is
the "Welcome to DevToys" onboarding screen, not a tool in use, and it reads noticeably flatter next
to the other two. **Direct input to Step 5.3's Epic-7 fork:** once real captures exist, the
convention argues for capturing a tool mid-task (the Bucket with real content, JSON with a real
payload) over an empty launch state.

**3. The screenshot starts immediately below the fold, usually cut off at the initial viewport
edge.** True on devutils.com, linear.app, and zed.dev — the image is already partially visible
before any scroll, functioning as its own scroll-affordance. raycast.com is the outlier, deferring
it a full extra screen behind pure text and a CTA. Given Umbra has no brand equity to spend on that
kind of patience, the majority pattern (tease the screenshot immediately) is the safer default for
Step 2.3's spine.

**4. Every site pairs one unambiguous primary download CTA with a smaller, secondary
technical-install path right next to it.** devutils.com: "Download for macOS" button plus
`brew install devutils` in monospace beside it. zed.dev: "Download now" plus an equally-sized
"Clone source" button. raycast.com: small text links for Homebrew and an older version under the
main button. **This is a gap in the current roadmap** — nothing in Phase 2/3's page outlines
currently plans a secondary CLI/build-from-source path for Umbra's download page. Worth raising at
Step 2.4 or 3.4, not deciding here.

**5. Platform breadth is stated as a small plain-text line under the CTA, never in the headline.**
zed.dev: "Available for macOS, Linux, and Windows" sits quietly under two buttons, in a smaller
weight than anything above it. This directly resolves a tension §1 already flagged and punted on —
the developer tried naming all three OSes in the subhead and rejected it as spec-sheet clutter.
Zed's pattern shows the information doesn't need to compete for space in the persuasive copy at
all; it belongs at the point of action instead. This looks like a genuinely adoptable, low-risk
convention rather than one requiring a judgment call.

**6. None of the three privacy-claiming direct competitors independently verify the claim — they
all just assert it once, in a single sentence, with no proof mechanism.** devutils.com: "DevUtils
works entirely offline! Everything you paste into the app never leaves your machine" — one bullet
among several, no evidence beyond the sentence itself. devtoys.app: "is privacy-focused" — a single
adjective in one sentence, even flatter. Neither offers a network trace, a third-party audit, or
even a screenshot of a traffic monitor. **This is the single most important finding for Step 3.3.**
Umbra's Story 5.3 `nettop` checklist isn't catching up to a category norm — there is no category
norm to catch up to. Nobody here proves the claim; they state it and move on. That should raise,
not lower, how much confidence Step 3.3 puts behind actually showing the check rather than just
asserting the same sentence everyone else already uses for free.

**7. A site's positioning can drift entirely, which is exactly why this step was run as live
browsing rather than recalled from memory.** Warp — one of the four aspirational sites named in the
roadmap on the assumption it was still a terminal-app-for-developers landing page — has repositioned
since. It's now an enterprise "agentic software factory" platform: "book a demo" is the primary CTA,
"request early access" is second, and the terminal download that used to be the whole point is now
a de-emphasized outline button reading "download warp terminal." Had this scan been done from
training-data recall instead of a live fetch, it would have cited Warp's old individual-developer
funnel as a comparable — which no longer exists. The monospace/dot-grid engineering aesthetic is
still a valid texture reference; the page structure is not a useful comparable for a single-download
consumer tool anymore. **Recommend dropping Warp from the comparable set for Steps 2.3/3.2, keeping
it only as a type/texture reference if at all.**

**8. Small aside, not a convention but a live confirmation:** zed.dev served a cookie-consent banner
mid-visit ("Zed uses cookies to improve your experience and for marketing"). That's the exact
friction Umbra's cookieless-PostHog decision was chosen to avoid — the roadmap's own "Deliberately
excluded" table already names this ("Consent banner — superseded by the cookieless decision").
Seeing a real comparable still carrying it is a small, concrete validation of that call, not a new
decision.

### Not yet decided (deliberately — these are Step 2.3/3.2/3.4's job, not this one)

Which of the eight conventions above Umbra actually adopts, and in what form, is not resolved here.
This section's job was pattern-absorption; reacting to the patterns is the developer's, per the
roadmap's own autonomy table.

### §2b — Second pass: wider net (2026-09-17, same session)

Requested explicitly because seven sites read as too narrow a base to react to. Thirteen more sites,
live-browsed, split between developer-named examples and independently chosen ones for range —
big/small, decade-old/modern, consumer/developer/privacy-specialist:

| Site | Category | Why it was chosen |
|---|---|---|
| apple.com | Big tech, non-applicable | Requested; ceiling of brand-confidence minimalism |
| meetsponsors.com | Small, modern SaaS | Requested (as "meet-sponsors"); solo-founder B2C SaaS |
| doctolib.fr | Decade-old, simple, consumer | Requested; mass consumer, non-technical audience |
| calendly.com | Decade-old, SaaS | Requested |
| netflix.com | Decade-old, mass consumer | Requested |
| superwhisper.com | Modern, small, AI/local-processing | Requested; closest audience overlap to Umbra's AI feature |
| wisprflow.ai | Modern, AI/cloud-processing | Requested (as "Whisper Flow"); direct contrast to Superwhisper on where the audio actually goes |
| openai.com | Big AI | Requested |
| huggingface.co | Big AI, dev-adjacent | Requested |
| proton.me | Privacy specialist, mid-size | Added — the category's actual proof-of-privacy benchmark, not yet checked in round 1 |
| signal.org | Privacy specialist, nonprofit | Added — same reason, different business model (nonprofit vs. Proton's freemium) |
| 1password.com | Security specialist | Added — trust-building for a product that also asks you to hand it sensitive data |
| cleanshot.com | Indie macOS utility, paid | Added — closest budget/scale comparable to Umbra of anything checked, aside from the Phase 1 direct competitors |

**The one finding that changes the picture from round 1:** direct dev-tool competitors
(devutils.com, devtoys.app) don't prove their privacy claim — but that's because they're dev tools,
not because nobody in the privacy space bothers. Proton and Signal both build an entire proof
*architecture*, not a sentence:

- Proton dedicates a named, linked section to each pillar — "End-to-end encryption" ("privacy isn't
  a promise, it's mathematically ensured"), "Swiss privacy" (jurisdiction as a trust mechanism),
  "Open source and audited" ("independently audited by security experts so that anyone can inspect
  them") — plus founder credibility (started by scientists from CERN, Tim Berners-Lee involved) and
  institutional legitimacy ("the recommendation of the United Nations").
- Signal's version is a single sharper line: *"Privacy isn't an optional mode — it's just the way
  that Signal works."* — naming the alternative (privacy as a toggle you could switch off) and
  rejecting it outright.
- Both lean on **business-model-as-trust-signal**: Proton's primary shareholder is a nonprofit
  foundation; Signal is a 501c3 that "can never be acquired." The pitch isn't just "we don't sell
  your data," it's "there's no structure here that could ever pressure us to."

**Why this matters more than a "raise your confidence" note:** Proton and Signal's single strongest
lever — open source plus independent audit, "anyone can inspect it" — is **not available to Umbra**.
The repo is public but All Rights Reserved (a decision already locked, not up for re-litigation
here), so Step 3.3 can't reach for "inspect the code yourself" the way both of these do. That closes
off the deepest form of proof in the category. Two things ARE available and currently unused in the
roadmap: (1) the business-model angle — Umbra has no revenue at all, not even freemium, which is
actually a *stronger* version of Signal's "can't be acquired" argument, not a weaker one; (2) naming
and rejecting the objection directly in a sentence, Signal-style, as a copy technique distinct from
Umbra's current plan of only implying the rebuttal structurally. Both are candidates for Step 3.3 to
weigh, not decisions made here.

**Other findings from this pass:**

- **Cross-platform download CTAs split into two real patterns, not one.** superwhisper.com gives Mac
  and Windows equal-weight side-by-side buttons with "Also available for iOS and Android" as a small
  link. wisprflow.ai instead has one primary button (defaults to the visitor's likely platform) with
  "Available on Mac, Windows, iPhone, and Android" as plain text underneath — the same pattern zed.dev
  used in round 1. Umbra ships three desktop platforms with no obvious "primary" one the way a
  mac-first product might default to macOS — worth deciding which of these two shapes fits before
  Step 2.4/6.3 builds the download page.
- **The "no faking it" ceiling got higher, which is reassuring, not discouraging.** wisprflow.ai has
  a dedicated named proof section ("Your voice stays yours"), an FAQ entry titled exactly "Is my
  voice data private?", named individual testimonials with title and company, press logos, and hard
  metrics ($3.08M estimated savings/year, 90% faster output). None of that is realistic for Umbra
  pre-launch — Step 3.5 already named the "no social proof yet" problem — but it's useful to see the
  actual ceiling: Umbra isn't failing to do something achievable at its stage, it's correctly
  choosing not to fake something that takes venture funding and eighteen months to earn honestly.
- **A live, quantified before/after is more convincing than a described one.** wisprflow.ai races a
  "45 wpm" typed sentence against a "220 wpm" spoken one, side by side, animated. This is the same
  instinct behind Umbra's own planned Step 3.7 comparison table (Umbra vs. web tools vs. other
  suites) — direct confirmation that a quantified head-to-head is a real, working technique here, not
  just a GEO-extractability nicety.
- **Consent-banner sightings are now overwhelming, not just anecdotal.** 8 of these 13 sites showed a
  cookie/tracking consent banner before I'd interacted with anything — including Calendly's, which
  explicitly discloses "cursor movement and screen recordings," the exact practice Umbra's own
  roadmap already lists as actively rejected. This isn't a new decision, just much stronger evidence
  the cookieless choice is buying something real.
- **Solo-founder trust framing shows up at the smallest scale too, not just DevToys' scale.**
  meetsponsors.com — a small, one-person-adjacent SaaS product, not a funded company — closes with a
  first-person "Hey, I'm Benjamin" section explaining the product's origin. Combined with DevToys'
  "Made with ❤️ by [names], from Seattle and Paris" from round 1, this is now a pattern across two
  independent small products, not a one-off — worth weighing for Umbra given it's also a solo
  developer with no team to hide the absence of.
- **A functional widget in the hero, where the interaction is simple enough to embed.**
  doctolib.fr's hero *is* a working search box; openai.com's *is* a working chat prompt; huggingface.co
  puts a real, live-filterable model browser beside the marketing copy instead of a screenshot of one.
  Not directly transferable — Umbra is a downloaded desktop app, it can't run in the hero — but it
  names *why* DevUtils/Zed/etc. all fall back to a screenshot instead: a screenshot is the next-best
  thing to "try it right here" when the product can't actually run in a browser tab.
- **Audience-segmentation can be a visible UI control, not just a nav link.** 1password.com puts an
  actual Business/Personal toggle switch above its headline; doctolib.fr does the same with a
  "Vous êtes soignant ?" nav pill for its second audience. Both are more assertive than a plain text
  nav link. Relevant to Step 2.2's recruiter page: the roadmap already plans a "signposted" secondary
  page, and these are two live examples of what "signposted" can mean in practice, from a subtle link
  to a prominent switch.

### Still not decided

Same caveat as round 1: this is pattern-absorption across a now-twenty-site base, not a set of
choices made on the developer's behalf. The business-model-as-trust-signal angle and the "name the
objection directly" copy technique are flagged as the two most consequential new options for Step
3.3 specifically; both need the developer's reaction, not a default.

### §2c — Developer reactions (same session)

**Correction: "public repo" ≠ "open source."** The write-up above imprecisely implied Umbra's
licensing closes off "the open-source lever" as if the code became unreadable. That's wrong, and the
distinction matters enough to get right before Step 1.5 (the claim ledger) locks any wording:

- **Open source** is a specific licensing status — a license (MIT, Apache, GPL, etc.) granting the
  right to view, use, modify, *and redistribute/reuse* the code.
- **All Rights Reserved** (Umbra's actual status, per NFR7) is the default when no such license is
  granted: the copyright holder keeps every exclusive right. A public repo under ARR means anyone
  can **read** the code — a skeptical user or security researcher can genuinely go open the
  networking layer and verify no telemetry calls exist — but nobody has a **legal right to copy,
  fork-and-ship, or reuse it**. The accurate term for "visible but not reusable" is
  **source-available**, not open source.

Net effect on the Step 3.3 gap identified above: Umbra can legitimately claim "the source is public
— verify it yourself" (real, usable proof). It cannot claim "open source" (a licensing claim it
doesn't meet — calling it that would be exactly the kind of overclaim Step 1.5 exists to catch) or
"independently audited" (no formal third-party audit exists). Proton and Signal can make all three
claims; Umbra can make the first only. The underlying finding — Umbra's proof ceiling is lower than
the category's actual benchmark, and Step 3.3 needs a strategy that doesn't depend on the reuse-rights
half of "open source" — still holds; only the label was wrong.

**Decided: download CTA shape.** Single button, not side-by-side platform buttons. Preference stated
directly, and confirmed against a live check of jetbrains.com/pycharm (not in the original list,
checked because it was cited as a good example): one "Download" button in the nav leads to a
dedicated `/download` page with OS tabs (Windows / macOS / Linux) that auto-detect and pre-select the
visitor's platform, plus — for macOS specifically — an architecture dropdown next to the button
(Intel vs. Apple Silicon), a real product screenshot, and version/build metadata beside it. This
matches zed.dev's single-button approach from round 1 and resolves the two-shapes tension §2b raised
(Superwhisper's equal-weight dual buttons vs. Zed/Wispr Flow's single button). **Direction for Step
2.4/6.3:** one "Download" CTA everywhere on the site, always routing to a dedicated download page
that handles the OS/architecture branching there rather than in the nav or hero.

**Decided: structural rebuttal over direct naming, for persuasive copy specifically.** Between
signal.org's move (name the reader's skeptical assumption in words — "an unexpected focus on
privacy" — then answer it in the same sentence) and Umbra's current plan (let the product's shape
imply the rebuttal without ever stating the doubt), the developer prefers the latter: no need to be
"super precise" about naming objections in hero/persuasive copy. **This applies to Phase 3's home
and section copy, not to Step 1.3 or the FAQ** — objections should still be named explicitly there,
since a question-and-answer page is exactly the place direct naming belongs; the preference is
specifically against importing that technique into the hero/narrative copy Phase 3 writes.

**Step 1.2 status: closed out.** Reference scan complete across 20 sites in two rounds; reactions
captured above. Proceeding to Step 1.3 (Objection map) in a fresh session per the roadmap's own
"one step = one fresh conversation" rule.

**Flag for Step 1.3:** the roadmap's own objection list (README.md) includes "there's no Windows
build" — likely stale. Recent commits (`Add Windows and Linux release packaging (NFR3)`, #156)
suggest Windows/Linux builds now ship. Verify against NFR3 before treating that objection as current;
it may be gone, or narrowed to something like "is the newer Windows/Linux build as trustworthy as
macOS's."

## §3 — Objection map (Step 1.3)

**Method:** plain working session, reading current sources live rather than trusting the roadmap's
own 2026-08-18 phrasing of these objections — the §2c flag above turned out to matter: one of the
roadmap's own example objections ("there's no Windows build") is now factually wrong. Verified
against: `NFR3` (`prd.md`), Story 5.1 (macOS signing/notarization, done), Story 5.2 (consent-gated
updater, done), Story 5.3 (executed `nettop` network trace, done, passing), the `LICENSE` file, and
commit `82c9173` / PR #156 (Windows+Linux packaging, shipped **unsigned**). Every answer below cites
its source so Step 1.5's ledger can absorb this table directly rather than re-deriving it.

**Scope note:** this step decides *which objection goes on which page/section*, not final wording —
that's Phase 3. Page names below are the Phase-2 candidates from `README.md` (home, download, FAQ,
privacy policy, legal notice, recruiter page, changelog) — Step 2.1 hasn't run yet, so treat "FAQ"
etc. as a placeholder for "wherever the page inventory lands the FAQ," not a locked URL.

### Trust & safety

| Objection | Answer | Source | Where it lives |
|---|---|---|---|
| "Is it safe to run an unsigned-looking binary from a stranger?" (macOS) | Signed with a Developer ID certificate, notarized by Apple — opens with no Gatekeeper bypass on a fresh Mac. | Story 5.1, done and verified (real `.dmg`, `spctl -a -vv` → `accepted, source=Notarized Developer ID`) | Home proof section (3.3); one-line reassurance on the download page next to the macOS button |
| **"Will Windows Defender/SmartScreen flag this as malware?"** — new objection, not in the roadmap's original list; **Windows-only, corrected below** | Honest disclosure: the Windows build exists but currently ships **unsigned** (PR #156, 2026-09-16); a SmartScreen "Windows protected your PC" prompt is expected, not a sign of malware, and the fix is "More info → Run anyway," not a red flag. Don't paper over this with silence — an unexplained warning is worse for trust than a disclosed one. | PR #156 commit message: "Both new platforms ship unsigned for now; signing options and SignPath Foundation eligibility were researched but are a separate decision" (also in memory `windows-release-groundwork`) | **Decided (§3b): a blocking modal on the Windows download click only**, informative/de-escalating tone (signing costs money, the warning is generic to any unsigned app) — not a passive line under the button. Also a FAQ entry, wherever Q&A content ends up living once Step 2.1 decides the page list. |
| "Will Linux flag/block this as untrusted?" | **No equivalent OS-level gate exists, so no modal is warranted here.** Linux has no centralized "unsigned executable" warning the way Windows/macOS do. Umbra's Linux formats per PR #156 are `.deb`/`.rpm`/`.AppImage`: a directly downloaded `.deb`/`.rpm` installed via `dpkg -i`/`rpm -i` triggers no signature-gate dialog (that check only fires for repo-based installs, which isn't this distribution path); an `.AppImage` has no signature check at all — its only friction is needing `chmod +x` or a file-manager "allow executing" toggle, a usability step, not a trust warning. | Reasoned from how `.deb`/`.rpm`/`.AppImage` installation actually works — not yet empirically confirmed on a real distro; flag as a "verify before shipping" item like the roadmap's own Context7 discipline, since this is exactly the kind of claim that should be checked against real behavior, not asserted from general knowledge. | Download page: a short factual note (`chmod +x` for AppImage) is enough — **no blocking modal for Linux**, unlike Windows |
| "How do I know this doesn't quietly phone home / have hidden telemetry?" | A written, executed, per-release `nettop` network-monitor checklist (not a one-time claim) — zero connections during tool use, exactly one disclosed, consent-gated connection on update-check. Result pasted into every release's version-bump PR going forward. | Story 5.3, done; `v0.1.2` real result: 7 tools exercised, zero outbound connections, one ~20 KiB update-check spike | Home proof section (3.3) — this is the section's central evidence, per §2's finding 6 that no direct competitor does this |
| "The repo is public but 'All Rights Reserved' — isn't that contradictory? What am I actually allowed to do?" | Public ≠ open source. You can **read** the source to verify the privacy claim yourself (a real, usable form of proof); you cannot copy, modify, redistribute, or reuse it without permission — that's what "All Rights Reserved" reserves. Terminology must say **source-available**, never "open source" (§2c's correction). | `LICENSE` (verbatim: "made publicly viewable for portfolio and evaluation purposes only... No permission is granted to... use, copy, modify, merge, publish, distribute, sublicense... without prior written consent") | FAQ (direct naming is fine here, per §2c's developer preference); a short EULA/legal-notice page once Step 4.3 writes it |
| "Is this actually open source? Can it be audited by a third party?" | No to both, stated plainly rather than left ambiguous: source-available, not open source (no license grants reuse rights); no formal third-party audit exists — only the developer's own executed `nettop` checklist. This is Umbra's proof ceiling relative to Proton/Signal (§2b/§2c) — don't overclaim past it. | `LICENSE`; no audit artifact exists anywhere in the repo | FAQ; feeds Step 1.5's ledger directly as a "must not overclaim" line |

### Product maturity & completeness

| Objection | Answer | Source | Where it lives |
|---|---|---|---|
| "Is this a side project that'll be abandoned in six months?" | A public backlog with a stated cadence (one small tool/improvement roughly every 1–2 weeks, Sept 2026 → March 2027), visible via GitHub Issues, plus a real release history. | `README.md` §Backlog; FR35 | Changelog/releases page; a small recency signal on home (matches PRD's "sustained activity read as strongly as the code itself") |
| "It only has a handful of tools — will it cover what I actually need?" | The full current tool list (JSON, Base64, UUID, hash, JWT, cron, OCR/Bucket, PDF, image conversion) plus an explicit, linked, public backlog of what's coming — framed as active growth, not a finished/frozen scope. | `src/stores/registry.ts` (per Step 1.5/2.5's content-model source); `README.md` §Backlog | Home feature-tour section; backlog link in footer or a dedicated section |
| "There's no social proof — no stars shown, no testimonials, no download count. Is anyone using this?" | **No fabricated answer exists for this one, and none should be invented.** This is Step 3.5's honesty-pass problem, not something Step 1.3 can resolve — flagging its placement, not its copy. The mitigating move the reference scan surfaced (§2b) is solo-developer transparency framing ("built and maintained by one person, here's why") rather than manufactured proof. | §2b (`meetsponsors.com`, DevToys "Made with ❤️" pattern) | Recruiter/about-adjacent copy (2.2); explicitly **not** a stat, chart, or number anywhere else on the site |
| "Why trust a solo developer's tool over an established company's (DevUtils, DevToys)?" | Not competing on completeness — the positioning (§1) already routes around this by leading with the one claim no competitor can copy (verifiable local-only + local AI) rather than feature count. | §1 (one-sentence claim); §2c (no direct competitor naming in persuasive copy) | Structural — this is the hero/subhead's whole job, not a single FAQ line |

### Platform & compatibility

| Objection | Answer | Source | Where it lives |
|---|---|---|---|
| ~~"There's no Windows build."~~ **Stale — corrected.** | Windows and Linux builds exist as of PR #156 (2026-09-16): `nsis` (Windows), `deb`/`rpm`/`appimage` (Linux) targets, wired into the tag-triggered release pipeline. Replace this objection with the SmartScreen/unsigned one above and the "best-effort, lightly tested" one below — both are the honest current shape of what used to be a flat "no." | PR #156 / commit `82c9173` | — (superseded, don't ship this as written in the original roadmap) |
| "Is the Windows/Linux build as trustworthy as the macOS one?" | No, and say so rather than imply parity: NFR3 designates macOS/Apple Silicon as primary — fully tested, signed, notarized, first to get every release. Windows/Linux are explicitly **best-effort**: CI-built, lightly tested (no second machine for frequent manual testing), and currently unsigned. | `prd.md` NFR3 (verbatim: "shipped best-effort (CI-built, lightly tested — no second machine for frequent testing)") | Download page, platform-specific note; FAQ |
| "Which build do I need — Intel or Apple Silicon? x64 or ARM Linux?" | Architecture selection happens on the download page itself (auto-detect + dropdown), not asked in the hero. | §2c's decided download-CTA shape (single button → dedicated `/download` page with OS tabs + arch dropdown, jetbrains.com pattern) | Download page only |
| "Will it run on my (older) OS version?" | **Unresolved — flag for Step 1.5, don't answer here.** NFR3 names "macOS 13+" for the primary platform; no equivalent minimum-version statement exists yet for Windows/Linux in any source read this session. The claim ledger needs an owner for this before Phase 3 writes a download-page compatibility line. | `prd.md` NFR3 (macOS 13+ only) | Download page — once Step 1.5 supplies the missing Windows/Linux minimums |

### Update & maintenance behavior

| Objection | Answer | Source | Where it lives |
|---|---|---|---|
| "What happens when it updates — does it install something without asking?" | No. An app-built confirmation dialog presents every update; nothing installs without explicit confirmation, and declining leaves the app running normally. | Story 5.2, done (AC1, AC4) | FAQ; a one-line mention wherever the proof section (3.3) discloses the update-check exception |
| "Doesn't checking for updates itself break the 'zero network calls' promise?" | It's the one disclosed, consent-gated exception — stated as such everywhere the privacy claim appears (README, in-app Settings, and this site per Step 1.5), not hidden inside "zero network calls" language that would otherwise be false. | `README.md` §Privacy; Story 5.2 AC2 (disclosure required on both surfaces) | Proof section (3.3); footer disclosure; FAQ |

### Cost, commitment, and site-privacy (distinct from app-privacy)

| Objection | Answer | Source | Where it lives |
|---|---|---|---|
| "Is this free? What's the catch — will it start charging later?" | Free, no account, no email capture. **Word this as a present-tense fact, not a forever-promise** — the roadmap's own locked decision is scoped to "this rebuild," and §1's standing rule (`landing-page-durable-claims`) already warns against emphasizing specifics likely to go stale. Say "free, no account" — don't say "free forever." | Roadmap decisions table ("Monetisation: None in this rebuild"); §1's durable-claims rule | Download page; hero convenience framing (subhead) |
| "If this site is about privacy, why does it run analytics at all?" | Cookieless PostHog, page-view-only, session recording explicitly disabled — disclosed in the footer and a real privacy policy (not just a footer sentence). | Roadmap decisions table ("Analytics: PostHog, cookieless"); "Deliberately excluded" table ("session recording... actively rejected... published claim") | Footer; privacy policy page (Step 4.1) |

### Secondary audience (recruiters)

| Objection | Answer | Source | Where it lives |
|---|---|---|---|
| "Is this a toy side-project or real engineering discipline?" | The signed/notarized/tag-driven release pipeline, the executed network-monitor checklist, the documented architecture decisions and trade-offs (including the two accepted-not-fixed WCAG calls) — process artifacts a toy project doesn't produce. | Story 5.1, 5.3; `DESIGN.md`'s WCAG trade-off notes | Recruiter page (Step 2.2) — this objection is that page's entire reason to exist |

### Comparison / "why not just use X"

| Objection | Answer | Source | Where it lives |
|---|---|---|---|
| "How is this different from a free web-based JSON formatter?" | The wedge itself: nothing pasted ever leaves the machine — no paste-and-hope with an unknown web service. | §1 one-sentence claim | Hero/positioning generally for the *broad* version of this question — **the narrow, per-tool version ("json online formatter," "jwt decoder online") got a precise home at Step 2.4**: a mandatory micro-FAQ entry on each `/tools/*` page, plus a catch-all FAQ topic (`landing-ia.md` §4). Recorded here because this row is where the gap was first noticed and correctly left open, not resolved. |
| "How is this different from DevToys / DevUtils / DevTools-X?" | Not named or compared in persuasive copy (§2c's developer preference) — but answered directly and by name in the FAQ, and via Step 3.7's planned comparison table (Umbra vs. web tools vs. other desktop suites). | §2c; roadmap Step 3.7 | FAQ; **four dedicated comparison pages** (`/compare/devtoys`, `/compare/devutils`, `/compare/devtools-x`, `/compare/cyberchef` — CyberChef added per §7's baseline finding), decided at Step 2.4 (`landing-ia.md` §4) — **not** hero/home narrative copy |

### §3b — Developer decisions on the unsigned-build disclosure (same session)

**Correction (same session, prompted by the developer questioning it):** the modal below applies to
**Windows only**, not "Windows/Linux" as first drafted. That draft conflated two different mechanisms
— Windows' SmartScreen is a real OS-level gate that blocks unsigned downloads with a dialog; Linux has
no equivalent for a directly downloaded `.deb`/`.rpm`/`.AppImage` (see the objection-map row above).
Applying the same blocking modal to the Linux download button would have manufactured a warning that
doesn't exist on that platform — worse than the original stale "no Windows build" error, since it
would have been a fabrication the developer specifically didn't ask for, not just an outdated fact.

**Decided: placement is a blocking interstitial for Windows, a plain note for Linux.** Clicking
"Download" for Windows opens a modal that states the build is unsigned *before* the file downloads —
not a line of text next to the button that a visitor can miss. This is a deliberate escalation past
the generic "small plain-text line under the CTA" convention §2 found elsewhere (finding 5, zed.dev's
platform-availability line) — that convention fits routine information; an OS-level security warning
the visitor is about to hit is a different category of thing to disclose, and warrants friction the
routine convention doesn't. Linux gets a short factual note instead (e.g. `chmod +x` for the
AppImage) — no modal, since there's no warning dialog to prepare the visitor for. macOS's download
path is unaffected either way — no modal, no note, since there's nothing to disclose (Story 5.1,
signed and notarized).

**Decided: tone is informative and de-escalating, not alarming.** The modal should explain the
*why* — code-signing costs money (an Apple/Microsoft-issued certificate, renewed annually), and that
cost hasn't been justified yet for a free side project with no revenue — and reassure the visitor they
don't need to be scared: the SmartScreen prompt is Windows' generic response to *any* unsigned
binary, not a finding specific to Umbra. Concretely, this means the modal must **not** just say
"unsigned — proceed at your own risk" (reads as a warning label) and should instead read closer to
"this build isn't code-signed because that costs money we haven't spent yet on a free project; the
warning you'll see is standard for any unsigned app, not a red flag about this one — here's how to
open it anyway." Exact wording is Step 3.4's job (download-page copy); this session locks the
*register* the wording must hit, the same way Step 3.1 will lock a register for everything else.

**Decided, with a dependency flagged: yes to a FAQ entry too, if a FAQ page exists.** The developer
agrees a FAQ entry should also cover this — but correctly caught that this step assumed a FAQ page
exists, when Step 2.1 (page inventory) hasn't run yet and could plausibly fold FAQ content into
another page instead of giving it its own URL. Record the *intent* here rather than deciding the
page structure this step doesn't own: wherever objection-driven Q&A content ends up living (a
standalone FAQ, or a section within another page), it should carry a "why is my browser warning me
about this download?" entry restating the modal's explanation in more depth. This is not a new
open question so much as a note to Step 2.1 not to lose this requirement when it decides the page
list.

**Still open, unchanged from above:** the Windows/Linux minimum-OS-version gap for Step 1.5's ledger.

### Feeds directly into

- **Step 2.3** (home-page narrative spine) — every row above marked "home"/"proof section" is a
  candidate section, and the trust/safety and platform rows in particular argue for the proof section
  sitting early, per §2's finding 6 (nobody else in the category proves the claim, so proving it is
  the actual differentiator, not a defensive afterthought).
- **Step 2.4** (FAQ page outline) — every row marked "FAQ" above is a literal FAQ entry candidate.
- **Step 1.5** (claim ledger) — the two flagged gaps above (Windows/Linux minimum versions; the
  "free" durable-claims wording) need ledger ownership before Phase 3 copy can be written against them
  safely.
- **Step 3.3** (proof copy) — the trust/safety table is effectively that step's raw material.

## §4 — Success definition & event plan (Step 1.4)

**Method:** working session, plus Context7 (`/posthog/posthog.com`) queried live this session for
`persistence`'s current option set and the `capture()`/default-properties behavior — not from
training memory, per the roadmap's own Context7 discipline (rule 6). Two queries, one concept each:
persistence/cookieless options, then the capture API and what properties attach to a manual event by
default.

### What "it worked" means

Grounded in `prd.md` §6, not invented here: the only metric that actually names this page is **"Used
(modest)"** — *"landing-page visits and download count trending non-zero after P2 launch"* — with an
explicit counter-metric, *"vanity numbers don't gate anything — the metric exists to honor the
secondary audience, not to chase growth."* That framing is deliberately not a rate. "It worked" is:

1. The page gets visited (`$pageview` count > 0, trending) — already live since Story 5.4.
2. Visits turn into intent to download (a new `download_clicked` count > 0, trending) — not built yet.
3. Intent turns into an actual file leaving GitHub (Step 7.2's Releases-API asset count — the only
   place a real download is ever visible; PostHog cannot see it under any configuration).

No conversion **rate** appears anywhere in this definition, and none should get retrofitted onto it
later — see below for why that's not just caution, it's a hard measurement limit.

### The cookieless constraint, priced honestly — and one correction to how the roadmap framed it

The roadmap (`README.md` Step 1.4) states the trade-off as "no cross-page-load identity," and frames
Step 6.8's fork as a binary between `persistence: 'memory'` and `persistence: 'sessionStorage'`. Both
are real `posthog-js` config values (confirmed via Context7 this session), but the framing slightly
overstates the loss for one of the two options and undersells a third one Step 6.8 hasn't been told
about:

- **`persistence: 'memory'`** — identity resets on *every single page load*, not just every visit.
  Under this choice the roadmap's claim is exactly right: even a same-tab click from `/` to
  `/download` is two different anonymous visitors as far as PostHog is concerned. No funnel of any
  kind survives a navigation.
- **`persistence: 'sessionStorage'`** — identity survives *within one tab, for the duration of that
  visit* (it's cleared on tab close, not on navigation). Under this choice, a same-visit
  `/` → `/download` → `download_clicked` path **is** reconstructible from event sequence, even though
  no cross-visit or cross-device identity ever exists. This is a real, meaningfully different
  capability from `memory` that the roadmap's wording doesn't distinguish — worth Step 6.8 knowing
  explicitly before it decides, not treated as a wash between two options that read as interchangeable.
- **`cookieless_mode: "always"` / `"on_reject"`** — a distinct, purpose-built PostHog feature, not a
  `persistence` value at all, found via Context7 and not previously named anywhere in this roadmap. It
  suppresses cookie/storage writes at the SDK level and computes identity server-side instead,
  contingent on enabling "Cookieless server hash mode" in the PostHog project's own settings (a
  dashboard step, not just code). `identify()`/`alias()` become unusable under it, which is moot for
  Umbra (no accounts, no email capture, per the roadmap's locked decisions), so nothing here rules it
  out — but it's a genuinely different mechanism from picking a `persistence` value and deserves to be
  evaluated as its own option, not folded silently into "memory vs sessionStorage."

**Not deciding this here — flagging it for Step 6.8, whose fork this explicitly is** (per `README.md`'s
autonomy table, "6.8's memory-vs-sessionStorage fork" is listed as the developer's call to make, not an
AI default). This step's job is to design an event plan that is *honest under the worst case*
(`memory`) rather than assume Step 6.8 lands on the more permissive option.

**Design principle that follows, restated from the roadmap's own instruction:** because the event plan
can't assume a funnel survives, it counts *actions*, not *conversions*. Every page carrying a CTA fires
its own `download_clicked`; the numbers are read side by side ("this many pageviews this week, this
many download-clicks this week"), never as a percentage of one over the other. This holds regardless of
which Step 6.8 option gets picked — it just becomes *conservative but still correct* if `sessionStorage`
or `cookieless_mode` later turns out to preserve more than assumed.

### A `posthog-js` mechanic that simplifies the event design

Context7 confirms `autocapture: false` — already set in Story 5.4's `Layout.astro`, deliberately, to
keep the footer's "page-view analytics only" claim true — governs only the *automatic* DOM click/pageview
capture feature. It does **not** strip PostHog's default properties from a manually-fired
`posthog.capture(...)` call. Every event, autocaptured or manual, carries `$pathname`, `$current_url`,
`$host`, `$referrer`, `$referring_domain`, and the UTM set (`$utm_source` etc.) automatically. Practical
effect: a single, consistently-named `download_clicked` event fired from every CTA instance is enough —
segmenting by `$pathname` in the PostHog dashboard already answers "which page did this fire from,"
without hand-rolling a `page` property. This also means Step 7.5's referrer-based AI-assistant filtering
(`chatgpt.com`, `perplexity.ai`, etc.) and Step 9.3's UTM tagging both work against *any* event, not only
`$pageview` — worth knowing before those steps assume otherwise.

### The event list

| Event | Fires when | Properties beyond the automatic set | Status |
|---|---|---|---|
| `$pageview` | Every page load (PostHog default) | — | **Already live** (Story 5.4, `capture_pageview` default-on) — this alone satisfies the "visits" half of PRD §6 |
| `download_clicked` | Any "Download" CTA is clicked — nav, hero, and the dedicated `/download` page's OS-specific buttons (§2c's decided single-CTA shape) | `platform`: `"macos" \| "windows" \| "linux"` (the download page's OS tab/arch selection — without it, PostHog can't tell *which* build people actually want, a real open question given the Windows/Linux best-effort framing in §3) | **New — Step 6.8's job to implement** |
| `windows_unsigned_modal_shown` | §3b's blocking Windows SmartScreen-disclosure modal opens | — | **New** — directly measures how many Windows visitors even reach the disclosure |
| `windows_unsigned_modal_proceeded` | Visitor clicks through the modal to continue the download | — | **New** — paired with the event above, this is the one place in the whole plan that can show a real drop-off caused by a specific, nameable friction point (the unsigned-build warning), not a guess |
| `notify_me_clicked` | The "Notify me" copy (routes to GitHub Watch/Releases, §1) is clicked | — | **New** — kept separate from `download_clicked` because it's a different visitor intent ("tell me later" vs. "give me the file now"); cheap to add, tells its own story if it turns out to fire often |

**Deliberately not added:** FAQ-entry-expand events, scroll-depth, comparison-table-view events, or
any other "while we're at it" instrumentation. PRD §6's own counter-metric — *"vanity numbers don't
gate anything"* — is a standing reason not to add an event without a stated question it answers at
Step 7.4's review. If a future session wants one, it should name the question first.

### What this plan can never answer — stated plainly, since that is this step's actual job

- **Cross-visit conversion** ("visited today, downloaded next Tuesday"). Impossible under *any*
  cookieless option above, including `sessionStorage` — none of them survive a tab close, only a
  long-lived cookie/`localStorage` identity would, and that's exactly what the roadmap's locked
  "cookieless" decision forecloses. Don't let a later dashboard question ("what's our conversion
  rate?") assume this exists.
- **Click → actual file downloaded.** `download_clicked` measures intent, not completion — PostHog has
  no visibility into whether the browser's file download actually completed. Step 7.2's GitHub
  Releases API count is the only ground truth for "downloaded," which is exactly why Step 7.2 exists as
  its own step rather than being folded into this one.
- **A computed attribution rate** ("X% of Hacker News traffic converts"). Step 9.3's UTM tags let you
  filter both `$pageview` and `download_clicked` by `$utm_source`, so you can report *counts* per
  channel — but "rate" needs a stable denominator (a visitor you can count once), which no cookieless
  option provides. Report the two counts side by side; never divide one by the other.

### A claim this step's own event surfaces, flagged for Step 6.8 and Step 1.5

Story 5.4's footer currently discloses **"page-view analytics only"** — true today, and true
specifically *because* `autocapture: false` was set to keep it true. Adding `download_clicked`,
`notify_me_clicked`, and the two modal events makes that sentence false the moment they ship: PostHog
would then also fire custom events, not just page views. Step 6.8's own task list already includes
"update the footer disclosure to match whatever's true" — this step is the reason that line is there,
though the roadmap didn't spell out why when it wrote it. Recording the link explicitly: **Step 6.8
cannot ship this event plan without also rewording the footer** (something closer to "page-view and
download-intent analytics only" — exact wording is Step 3.5's job, not this one), and that reworded
sentence is itself a new claim Step 1.5's ledger needs to own, the same as every other public privacy
statement this project makes.

### Feeds directly into

- **Step 6.8** (analytics rework) — implements every event in the table above, decides the
  `persistence`/`cookieless_mode` fork this step deliberately left open, and must update the footer
  disclosure per the flag immediately above.
- **Step 1.5** (claim ledger) — the reworded footer disclosure line needs a ledger entry and an owner,
  same as every other privacy-adjacent claim this project makes.
- **Step 7.1** (verify analytics end-to-end) — will confirm `download_clicked` fires in a real browser,
  the same way Story 5.4 already proved `$pageview` does.
- **Step 7.2** (GitHub download counts) — the thing `download_clicked` cannot substitute for; named
  here so a future session doesn't quietly treat the PostHog number as "the" download count.
- **Step 7.4** (review cadence) — this plan is inert without it; the events exist to be read, not to
  exist.
- **Step 7.5 / 9.3** (AI-referral tracking, UTM conventions) — both rely on the default-property finding
  above (every event, not just `$pageview`, carries `$referrer`/UTM properties).

## §5 — The claim ledger (Step 1.5)

**Method:** working session, every source below read live this session (2026-09-18), not carried
forward from Step 1.3's citations or this roadmap's own summaries — including one live GitHub API
call, because "what actually builds" (README.md's own instruction for this row) turned out to mean
something narrower than "what the pipeline is capable of producing." That gap is this step's single
most consequential finding; it's flagged first, below the table, not buried at the end.

### The ledger

| # | Claim | Exact permitted scope | Source of truth (live) | Owner / update trigger |
|---|---|---|---|---|
| 1 | **Privacy — network calls.** "Umbra makes zero network calls except one, explicitly disclosed: the automatic check for app updates. Nothing installs without your confirmation. No telemetry." | Exactly this — one disclosed exception, on-launch, unconfirmed-by-the-user *as a check* (only the install step is confirmation-gated, per Story 5.2 AC1). Don't imply the check itself waits for a click. | `README.md` §Privacy (verbatim, matches in-app `en.json`/`fr.json` `privacyNetwork` string exactly); Story 5.3's executed `nettop` result (`v0.1.2`, pass, zero connections across all tools, ~20 KiB update-check spike) | Whoever adds a network-capable dependency or a new carve-out — gated by Story 5.3's own release-checklist procedure (`docs/release-checklist.md`), executed and pasted into every version-bump PR going forward. A ledger re-check is the same trigger as a `docs/release-checklist.md` re-run. |
| 2 | **Privacy — clipboard.** "Umbra reads your clipboard locally to suggest a matching tool. Nothing leaves your device." | In-app-only claim today (Story 7.8's clipboard-suggestion surface) — not currently made anywhere on the site. Listed here so it isn't contradicted if a future copy pass mentions clipboard suggestions. | `en.json`/`fr.json` `privacyClipboard` string; Story 7.8 | Whoever changes the clipboard-suggestion feature's data flow. |
| 3 | **"Even the AI is private."** Singular, not plural — traces to exactly **one** shipped feature. | **OCR (Image to Text) only**, via a bundled ONNX model, zero network calls, confirmed by Story 5.3's `nettop` pass including first-use inference. §1's standing rule (don't name the scope in persuasive copy) already protects this in the hero; this row is the guard rail for the FAQ/proof section, where the claim does get spelled out. | `prd.md` FR23 ("local ONNX OCR model"); NFR1's OCR carve-out language (never materialized — bundling was chosen, AD-7); registry.ts (`ocr` entry, `component: OcrView.vue`) | Whoever ships FR29's "second AI feature" (still an open pick, not built) or any future AI-flavored tool — that's the trigger to widen this claim from singular to plural, not before. |
| 3a | ⚠️ **Correction to a live PRD line — do not copy it.** `prd.md` line 18 still reads *"AI lives inside real tools (OCR in the Bucket, natural-language cron)"* — **stale**. Story 8.6 (2026-09-03, signed off) retired NL→cron's free-text parser entirely in favor of a deterministic, language-neutral guided grid ("impossible to phrase wrong," the story's own words) — there is no NL parsing, no model, no AI framing left in the cron tool at all. `prd.md` §10's glossary correction and Story 8.6 both know this; the §1 Overview paragraph was never reconciled against it. | The site must **not** cite cron as an AI feature anywhere, including the FAQ/proof section that row 3 above governs. | Story 8.6 decision record (`8-6-cron-decision-record.md`); `prd.md` §10 (Glossary, the "Bucket" retirement note, which *is* current) vs. §1 Overview (which isn't) | Flagged here rather than fixed in `prd.md` — that edit isn't this step's job, but a future copy session reading the PRD top-to-bottom will hit the stale line first. Treat row 3 as authoritative over `prd.md` line 18 for site purposes. |
| 4 | **Tool list.** Nine tools, current names: JSON, Base64, UUID, Hash, JWT, Cron, Image to Text, PDF, Images. | The **live registry**, not any prior document — Story 5.3's own exercise list (7 tools: `json base64 uuid hash jwt cron bucket`) is already stale; `bucket` was retired and split into `ocr`/`pdf`/`image` by Story 8.7/8.8 (2026-09-06/10), and the **current** umbra-web `index.astro` (still live, 7-tool "Bucket" copy) is stale in the same way — exactly Rule 4's "historical draft" warning made concrete. | `src/stores/registry.ts` `TOOLS` array, read this session: `json`, `base64`, `uuid`, `hash`, `jwt`, `cron`, `ocr` ("Image to Text"), `pdf` ("PDF"), `image` ("Images") | Whoever adds a registry entry — the registry's own code comment already says as much for the release checklist; Step 2.5's content-model decision is what makes the *site* stop needing a manual sync for this claim specifically. |
| 5 | **Platform support — macOS.** "macOS 13+ (Apple Silicon), signed with a Developer ID certificate, notarized by Apple." Primary platform, fully tested, first to every release. | As stated — unchanged, matches Story 5.1's shipped state. | `prd.md` NFR3 (verbatim, "macOS 13+ on Apple Silicon is the primary platform"); `tauri.conf.json` `bundle.macOS.minimumSystemVersion: "13.0"`; Story 5.1 (signed, notarized, done) | Whoever bumps `minimumSystemVersion` or changes the signing pipeline. |
| 6 | **Platform support — Windows/Linux, best-effort framing.** "CI-built, lightly tested (no second machine for frequent testing), best-effort, currently unsigned (Windows)." | As stated in the objection map (§3) — do **not** claim parity with macOS. | `prd.md` NFR3 (verbatim: "shipped best-effort... no second machine for frequent testing"); PR #156 / commit `82c9173`; memory `windows-release-groundwork` (SignPath Foundation ineligible under current ARR licence — don't imply signing is imminent) | Whoever signs the Windows build or adds a second test machine — either changes this row's wording, not just row 7 below. |
| 7 | ✅ **Decided (2026-09-18): Windows/Linux — the download page resolves against `/releases/latest` live, not a hardcoded platform list.** Checked live via the GitHub Releases API, not assumed from PR #156's existence: `GET /repos/dipaneb/umbra/releases/latest` → **`v0.4.0`**, `prerelease: false`, assets: `Umbra_0.4.0_aarch64.dmg` / `.app.tar.gz` **only — no Windows, no Linux artifact today**. The Windows/Linux build targets exist in **`v0.5.0-alpha.1`**, correctly excluded from `/releases/latest` as a pre-release. **Developer's call: build the site now regardless — "the three OS versions will be available in time," and the download page should point at `latest` so it doesn't need to wait for all three.** This is resolution path (b) below, not (a): no manual release-promotion step, the page self-updates the moment a stable tag ships Windows/Linux assets. | Ship the download page reading per-platform asset availability from the live `/releases/latest` response (Step 6.3's job) — a platform with no asset in the current stable release shows as not-yet-available rather than a dead/broken button, and needs no further site change when that platform's build lands in a future stable tag. §3's Windows/Linux objection-map answers stay valid as *eventual-state* answers; Step 2.4/3.4's copy should read as "when available," not assume day-one parity across all three platforms. | Live `gh api repos/dipaneb/umbra/releases/latest` / `releases/tags/v0.5.0-alpha.1` calls, 2026-09-18; developer decision, same date | **Step 6.3** (download page build) — implements the live per-platform check this row now specifies. No further sign-off needed; this row is closed. |
| 8 | **Windows/Linux minimum OS version.** *(Still unresolved — carried forward from §3, re-checked, still no source.)* | **No claim can be made yet.** Checked `tauri.conf.json` (only `bundle.macOS.minimumSystemVersion` is set — no equivalent key for `nsis`/`deb`/`rpm`/`appimage` targets), `docs/`, `prd.md` NFR3 (silent on Windows/Linux minimums), and the `windows-release-groundwork` memory (signing research only, no OS-version research). Nothing anywhere names a Windows or Linux minimum version. | — (absence confirmed, not just unchecked) | The developer — needs a deliberate research pass (Tauri's own Windows/Linux minimum-supported-OS documentation, verified via Context7 per Rule 6) before Step 2.4/3.4 can write a download-page compatibility line for those two platforms. |
| 9 | **Licence.** "Source-available, not open source. Public repo, All Rights Reserved — read it to verify the privacy claim yourself; no right to copy, modify, redistribute, or reuse without written consent." | Exact terminology matters (§2c) — never "open source," never "independently audited" (no audit exists). | `LICENSE` (verbatim, read this session); `prd.md` NFR7 | Whoever changes the `LICENSE` file — a legal/product decision, not a copy fix, per Phase 4's own framing. |
| 10 | **Version / current release.** Whatever the site states as "the current release" must resolve to the same thing a visitor's download click resolves to. | **Do not hardcode a version string anywhere in site copy or build config.** The gap in row 7 is exactly what a hardcoded or stale-cached version would hide. Query `GET /repos/dipaneb/umbra/releases/latest` (or equivalent) at build time or client-side, and treat its response — not the highest git tag, not `tauri.conf.json`'s `version` field (currently `0.5.0-alpha.1`, a pre-release, and *not* what `/releases/latest` returns) — as ground truth. | GitHub Releases API, `/releases/latest`, confirmed live this session to differ from the highest semver tag (`v0.5.0-alpha.1` vs. the API's `v0.4.0`) | The release pipeline itself (`.github/workflows/release.yml`) — every tag push is a potential change to this row's answer; the site's *mechanism* for reading it (Step 2.5/6.4's content-model job) is what needs to never go stale, not this ledger entry itself. |
| 11 | **Backlog / cadence.** "One small tool or improvement roughly every 1–2 weeks, September 2026 through March 2027," via a public, linked GitHub Issues backlog. | As stated — matches the live README exactly. | `README.md` §Backlog (verbatim); `prd.md` FR35 | The developer's own cadence — re-check if the pace visibly changes (candidate for Step 10.1's maintenance triggers). |
| 12 | **"Free."** Present-tense fact, never "free forever." | "Free, no account" — not "free forever," per §1's durable-claims rule and §3's objection-map answer. | Roadmap `README.md` decisions table ("Monetisation: None in this rebuild") | Whoever revisits monetisation — deliberately excluded from this rebuild's scope (roadmap's "Deliberately excluded" table), so effectively nobody, until that's reopened. |
| 13 | **Site analytics disclosure (distinct from app privacy).** Today: "anonymous page-view analytics only, session recording disabled" (umbra-web's current, live footer, read this session). **Will become false the moment Step 6.8 ships** `download_clicked` / the modal events — §4 already named this; this row is its ledger entry. | Current wording is accurate *today*, for the *current, pre-rebuild* site only — don't carry it forward unchanged into the rebuild's footer once Step 6.8's events exist. | `umbra-web/src/layouts/Layout.astro` footer (read live this session); Step 1.4 (§4)'s event table | Step 6.8 — cannot ship the new events without rewording this row's claim in the same PR, per §4's own flag. |
| 14 | **Performance — cold launch.** "Cold launch measured under 2 seconds." Cite the budget, not the specific historical millisecond figure — the measurement predates several tool additions (Stories 8.7/8.8) and a stale exact number is exactly the overclaim row 1's own compliance-lapse finding warns against. | Say "under 2 seconds," never "386ms" or similar as a current figure. | `prd.md` NFR2 (verbatim: "Cold launch < 2 s"), read live 2026-09-20; Story 1.2 (`1-2-first-launch-the-scaffolded-app-opens.md`, real release-build measurement: 829ms/447ms/386ms across 3 runs); Stories 8.7/8.8 re-verify the budget on each new-tool addition | Whoever adds a tool heavy enough to threaten the budget — Stories 8.7/8.8 already establish this as a per-addition check, not a one-time measurement. Added 2026-09-20 (Step 3.6) — flagged as missing by `landing-copy.md` §2, which drafted the "Why Umbra" claim against NFR2/Story 1.2 live but noted no ledger row existed yet. |
| 15 | **Accessibility baseline.** "Full keyboard operability, visible focus states, and screen-reader-labeled controls, from v1." **Do not** add "WCAG AA contrast" to this claim — NFR5 states a contrast baseline, but `DESIGN.md` documents two accepted exceptions (white on orange fills, white on dark-mode red, per this project's own `CLAUDE.md`), so a blanket contrast claim would overclaim past a known, deliberate exception. | Keyboard + screen-reader labeling only; never bundle in a contrast claim. | `prd.md` NFR5 (verbatim: "visible focus states, labeled controls (VoiceOver-readable), WCAG AA contrast (4.5:1 for text)"); `DESIGN.md`'s documented contrast exceptions | Whoever changes focus/labeling behavior, or resolves either of `DESIGN.md`'s contrast exceptions (at which point the contrast claim could be added). Added 2026-09-20 (Step 3.6) — `landing-copy.md` §2 already made this exact contrast exclusion live while drafting; this row gives it a citable source. |
| 16 | **Architecture — no client-server split.** "A native Rust application with no client-server architecture — nothing for pasted/typed data to route through except the machine it's on." Distinct from row 1 (which covers *what crosses the network*): this row covers *why*, structurally, there's nothing to intercept. | Architectural fact about the app's own design (a Tauri app: Rust backend, no bundled or remote server component for its own operation) — not a claim that the process makes zero network calls (row 1 already scopes that, including the one disclosed exception). | `src-tauri/Cargo.toml` (confirms Tauri 2, read live 2026-09-20); the app's own IPC-based (not HTTP-client-to-server) design | Whoever adds a server component (e.g., a licensing check-in, telemetry backend) — none exists today. Added 2026-09-20 (Step 3.6) — `landing-copy.md` §3 flagged this claim as un-ledgered while drafting the Proof section. |

### Decided: row 7, the Windows/Linux release gap

Resolved by the developer, 2026-09-18: **path (b)**, not (a) — no manual promotion of
`v0.5.0-alpha.1` to stable. The download page (Step 6.3) queries `/releases/latest` live and shows
each platform's actual current availability; Windows and Linux read as not-yet-available today and
start working automatically the moment a stable tag carries their assets, with no further site
change required. §3's Windows/Linux trust answers (SmartScreen modal, best-effort framing, etc.)
stay as-written — they describe the experience *once available*, which is still correct; Step 2.4/3.4
just need to word the download page so a same-day visitor sees "not yet available for your platform,"
not a broken link. Recorded here so Phase 8's pre-launch checklist (Step 8.1, "the download link
resolves to a current non-prerelease build") has a citable reason to check this per-platform, not
just for macOS.

### Not resolved here, deliberately

- **Row 8** (Windows/Linux minimum OS version) stays open — no source exists to cite, and inventing
  one would be exactly the overclaim this step exists to prevent.
- **Which mechanism** keeps rows 4 and 10 in sync with their live sources at build time (a content
  collection, a build-time fetch, a manual-sync discipline) is Step 2.5's job, not this one — this
  ledger names the source of truth, Step 2.5 decides how the site reads it.

### Correction found 2026-09-19, during Step 2.3: row 1's checklist discipline has lapsed

Step 2.3 (home-page narrative spine) drafted a "Verify it yourself" section pointing at "the most
recent nettop result." Before shipping that as wireframe copy, the underlying claim was checked live
against actual merged PRs rather than assumed from `docs/release-checklist.md`'s own description of
the procedure (which states the *policy*, not whether it's been *followed*) — this is the same
distinction row 7 already drew between "the pipeline is capable of producing X" and "X actually
shipped."

**What's true:** `docs/release-checklist.md` is real, detailed, and was genuinely followed for
`v0.1.2` (PR #44, the story that introduced it) and `v0.2.0` (PR #111) — both PRs' bodies contain a
real nettop result, matching this ledger row's existing citation.

**What's not true, checked live via `gh pr list --search "nettop in:body"`:** neither `v0.4.0`
(PR #155, the current stable release per row 7) nor `v0.5.0-alpha.1` (PR #156, Windows/Linux
packaging, 2026-09-16) contains a nettop result — the discipline lapsed after `v0.2.0` and has not
been picked back up for the two most recent releases, including the one the download page currently
points visitors at.

**Consequence for the site:** a "last verified: [date]" line on the home page's proof section cannot
honestly name a current release yet — doing so would be exactly the kind of overclaim this ledger
exists to prevent, the same failure mode as the "every release ships a published trace" wording an
earlier draft of the home spine used before this check caught it. **Action item, not yet assigned to
a step:** re-run the checklist against the current release and record the result in that release's
PR (or a dedicated one) before Step 3.3 (proof copy) or Step 8.1 (pre-launch checklist) can treat this
claim as ship-ready. Until then, the home page's verification link is a placeholder
(`landing-ia.md` §3's revised Section 2), not live copy.

### Feeds directly into

- **Step 3.6** (ledger gate) — every claim Phase 3 writes gets checked against this table by number.
- **Step 2.1/2.4** — row 7's resolution path affects whether the page inventory needs a
  platform-availability state on the download page at all.
- **Step 6.3/6.4** — rows 4 and 10 are the concrete cases Step 2.5's content-model decision has to
  solve; row 7 is a build-time correctness requirement for the download page specifically.
- **Step 8.1** (pre-launch checklist) — row 7's caveat is now a named, citable check item ("download
  link resolves to a current non-prerelease build, on all three platforms, not just macOS").
- **Step 10.1** (maintenance triggers) — rows 1, 5, 6, 9, 11 each name their own update trigger;
  that step can absorb this table's "Owner / update trigger" column directly rather than re-deriving
  it.

## §7 — The AI-answer target list (Step 1.6)

**Method:** working session. Scope confirmed with the developer this session on three axes before
drafting: (1) **today-only** — no question below assumes or hints at FR29's still-unshipped second AI
feature, per §1's durable-claims rule and row 3/3a of the ledger (OCR is the only AI feature that
exists); (2) **developers only** — no recruiter-facing angle, matching the roadmap's locked audience
priority ("Developers first; recruiters second"), since the recruiter page (Step 2.2) already exists
as that audience's dedicated surface; (3) **broader list** — 9 questions rather than a tight 6, to
cover more of the query space this early, with the understanding that not all 9 carry equal weight.

Every question below is checked against §5's ledger — nothing here asks the site to state more than
rows 1–13 permit. These are *conversational, intent-loaded* questions a person would actually ask an
assistant, not SEO keywords — the roadmap's own distinction (README Step 1.6).

### The list

**A. Direct-alternative queries** (the "who competes with X" shape)

1. "What's a privacy-first alternative to DevToys or DevUtils?"
2. "Is there a developer tools app where nothing I paste or drop gets uploaded anywhere?"

**B. Feature + constraint queries** (category plus a hard requirement)

3. "Is there an offline JSON formatter / JWT decoder for macOS that works without internet?"
4. "What's a local OCR tool that doesn't send images to a cloud API?"
5. "Is there a developer utility app for Windows or Linux with no telemetry?"

**C. Verification-minded queries** (skeptical, trust-seeking — Umbra's actual edge per §2's finding 6
and §3's trust table, not a feature comparison)

6. "How can I check whether a desktop app is actually calling out to the internet before I install
   it?"
7. "Is there a developer tool that's verifiably private, not just claiming to be?"

**D. Cost / commitment queries**

8. "Is there a free all-in-one dev-utility app that doesn't require a subscription or account?"
9. "Is there a free JSON/JWT/UUID tool without ads or a paywall?"

### Why these and not others

- No question names a specific competitor by name (DevToys/DevUtils appear only in query 1, as the
  thing a visitor is searching *away from* — matching §2c's developer preference against
  direct-naming in persuasive copy; it's fine here because these are hypothetical *visitor* queries,
  not Umbra's own copy).
- No question asks about "open source" — per row 9 of the ledger, Umbra can't answer that one
  honestly as a "yes." A query that would only surface Umbra by overclaiming isn't a target worth
  writing for.
- Windows/Linux appear once (query 5), phrased around telemetry rather than platform completeness,
  since row 6/7 of the ledger already caution against implying Windows/Linux parity with macOS.

### Sober framing, carried forward from the roadmap

README's own Step 1.6 entry already flags this, worth repeating because it governs where effort
should actually go next: for a developer tool, **the GitHub repo and third-party mentions drive
citation far more than the landing page does** (Steps 9.2/9.4). This list mostly tells you what to
*say* there too — the same 9 questions should be answerable, correctly, from the README (Step 9.4)
and wherever the tool gets discussed externally (Step 9.2), not only from the site's own copy.

### Not done in this session — flagged for the developer directly

The roadmap's own instruction for this step is to **sanity-check the list today** by actually asking
ChatGPT, Claude, and Perplexity these 9 questions and recording what each says — the pre-launch
baseline Step 7.5 later compares against. This isn't done here, deliberately: README's own autonomy
table lists "asking the assistants and recording what they say" under **physically impossible without
you** (the 7.5(part) entry), and the reasoning applies just as much at this step — an answer from
*this* conversation would be contaminated by everything already discussed about Umbra in it, which
defeats the point of a cold baseline. **Recommended next action:** ask these 9 questions yourself,
today, across ChatGPT/Claude/Perplexity (fresh sessions, no prior Umbra context), and record what each
says — even "Umbra isn't mentioned" is useful signal to save for Step 7.5's comparison.

**Update, same day:** the developer pointed out that browser automation (claude-in-chrome) opening a
genuinely fresh chat/search is not subject to the contamination objection above — a new tab has no
memory of this conversation, the same as the developer opening one themselves. The one caveat that
does still apply: the browser session was logged into the developer's own Claude and (partway through)
anonymous-then-blocked on ChatGPT/Perplexity, so results reflect an account-influenced or
rate-limited view, not a fully anonymous stranger's. Run this session — see the baseline snapshot
below. Google AI Overviews was added as a fourth surface at the developer's request, since README's
own Step 7.5 names it alongside the three chat assistants and the original recommendation above had
dropped it.

### Baseline snapshot (2026-09-18)

**Method:** browser automation via claude-in-chrome, one fresh chat/search per question (new tab or
"New chat" for each, not a continued conversation). ChatGPT and Perplexity were used **logged out**
(anonymous); Claude was used **logged into the developer's own account** in a fresh chat each time —
no persistent cross-chat memory feature was active, but this is not a fully anonymous read. Google
searches were also anonymous. Perplexity's anonymous tier hit a login wall after 2 questions; Q3–Q9
are recorded as blocked rather than answered, per instructions not to loop on a blocked surface.

| # | Question (abbreviated) | ChatGPT | Claude | Perplexity | Google AI Overview |
|---|---|---|---|---|---|
| 1 | Privacy-first alternative to DevToys/DevUtils | ✗ (DevToys, Open Dev, offlineutils.com, devutils.sh) | ✗ (CyberChef, Boop, DevHub, IT-Tools) | ✗ (CyberChef, Boop, OfflineTools) | no AI Overview shown |
| 2 | App where nothing pasted/dropped uploads | ✗ (LocalOnly, DevTools, hotnote, Zed) | ✗ (DevToys, DevUtils, CyberChef, IT-Tools) | ✗ (Cog, DevKit, DevDock, offlineutils.com) | no AI Overview shown |
| 3 | Offline JSON formatter / JWT decoder, macOS | ✗ (Wring, DevForge, Hexkit, Bellows, XTool) | ✗ (DevUtils, DevToys, Boop) | blocked: anonymous login wall | no AI Overview shown |
| 4 | Local OCR, no cloud API | ✗ (Tesseract, OCRmyPDF, PaddleOCR, Local OCR Studio) | ✗ (Tesseract, OCRmyPDF, PDF24, macOS Live Text, PaddleOCR/EasyOCR) | blocked: anonymous login wall | no AI Overview shown |
| 5 | Windows/Linux utility app, no telemetry | ✗ (DevToys as "best match") | ✗ (DevToys, CyberChef) | blocked: anonymous login wall | no AI Overview shown |
| 6 | How to check if a desktop app calls home | ✗ (generic advice: 7-Zip, `strings`, VM, firewall) | ✗ (generic advice: VirusTotal, sandboxes, privacy policy) | blocked: anonymous login wall | no AI Overview shown |
| 7 | Verifiably private dev tool, not just claiming | ✗ (Zed) | ✗ (Git, VSCodium, llama.cpp/Ollama) | blocked: anonymous login wall | no AI Overview shown |
| 8 | Free all-in-one dev-utility app, no subscription | ✗ (DevToys, devutils.sh) | ✗ (DevToys, IT-Tools, CyberChef) | blocked: anonymous login wall | no AI Overview shown |
| 9 | Free JSON/JWT/UUID tool, no ads/paywall | ✗ (SkyK DevTools, UtiliForge, FreeDevTool, ToolDock) | ✗ (IT-Tools, CyberChef, DevToys) | blocked: anonymous login wall | no AI Overview shown |

**Notable findings:**

- **Umbra was not mentioned once, across all 25 answered queries.** Expected and unremarkable —
  pre-launch, no landing page live yet, nothing to have been indexed or trained on. This is exactly
  what a baseline is for: the number to compare Step 7.5's later checks against, not a result to react
  to now.
- **DevToys and CyberChef are the two most consistently recommended names**, appearing across both
  ChatGPT and Claude regardless of question phrasing. Any future comparison-table work (Step 3.7) should
  expect these two as the default competitive frame in an AI answer, more so than DevUtils.
- **Google showed no AI Overview for any of the 9 queries** — all nine returned plain organic web
  results only. Whether that's query-shape-specific or a broader pattern is not something one snapshot
  can determine; worth re-checking at Step 7.5.
- **ChatGPT's logged-out answers surfaced several tool names that could not be independently verified
  in this session** (e.g. "Wring," "Hexkit," "Bellows," "SkyK DevTools," "UtiliForge," "ToolDock") —
  plausible-sounding but unfamiliar relative to well-known names like DevToys/Zed/Tesseract that also
  appeared. Not flagged as a problem to fix, just a reminder that an LLM's product recommendations in
  this space mix well-established tools with names that are hard to verify from the answer alone.
- **Perplexity's anonymous tier only allows ~2 queries before requiring sign-in**, which blocked 7 of
  its 9 questions. A logged-in re-run would close this gap but reintroduces the same account-influence
  caveat already noted above for Claude.

### Feeds directly into

- **Step 2.3** (home-page narrative spine) and **Step 3.2/3.4** (copy) — these questions are what the
  copy must answer plainly, and what comparisons (query 1) or proof (queries 6–7) must exist on the
  page.
- **Step 3.7** (extractability pass) — the question-shaped headings that pass calls for should draw
  from this list directly rather than inventing new phrasing.
- **Step 7.5** (AI visibility baseline) — this list *is* the question set that step re-asks on a
  cadence; the developer's own manual baseline check (above) is what that step compares against.
- **Step 9.2/9.4** (distribution plan, GitHub repo as agent surface) — per the sober framing above,
  these questions should be answerable from the README and third-party mentions, not only the site.
