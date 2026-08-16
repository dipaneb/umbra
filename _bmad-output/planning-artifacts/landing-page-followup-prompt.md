---
title: "Umbra — Landing Page Follow-up Prompt"
status: draft
created: 2026-08-15
updated: 2026-08-15
---

# Landing page follow-up prompt

> Use this **after** `brand-ux-product-discovery-roadmap.md` in this same folder is done —
> i.e. once `DESIGN.md`/`EXPERIENCE.md` are locked and the app itself reflects the new
> brand. Paste the block below as-is into a fresh AI conversation (a new Claude Code
> session in the `umbra-web` repo, or a chat session — either works, it's a planning
> request, not an execution request). Don't run it earlier: the landing page should
> inherit the finished brand, not get redesigned twice.

---

## The prompt

```
I need a plan for rebuilding the Umbra landing page (repo: umbra-web, an Astro site —
currently three pages: index, download, faq). Don't write any copy or code yet — I want a
roadmap first: a phased, step-by-step plan I can execute afterward, possibly across
several separate conversations.

Important context about me: I'm a developer, but I'm a beginner at everything involved in
conceiving a product landing page — copywriting, information architecture for a marketing
site, SEO, analytics, legal/compliance, growth mechanics, whatever else the field actually
involves that I don't know to ask for. Because of that, I'm deliberately NOT going to hand
you a list of the concerns I want covered. Any list I wrote would just reflect what I
already happen to know about — and the whole point of asking you is to also surface what I
don't know I'm missing. So instead:

Step 1 — before any roadmap: give me a broad inventory of the full set of concept areas
involved in taking a product landing page from zero to launched (structural/IA, written
content, discoverability, measurement, legal, performance, whatever else genuinely
belongs — you decide the list, don't wait for me to name categories). For each one, explain
briefly, in plain terms, what it is and why it typically matters, then give me your read on
whether it looks relevant for a project at Umbra's actual scale (indie, single developer,
free/open desktop app) or whether it's the kind of thing that's overkill here. I will react
to each item — keep, drop, unsure — before we lock anything. Treat this like a working
session, not a one-shot answer: push back if you think I'm dropping something that matters,
and don't self-censor items just because they sound like "big company" concerns — let me be
the one who decides they don't apply, not you deciding it for me by omission.

Step 2 — once we've agreed on the concept areas that matter, produce the phased roadmap:
numbered phases, each step naming what it produces, why it belongs at that point in the
sequence, and which tool or approach fits it (a specific technique, an external tool, or a
request back to me for a decision only I can make).

Before Step 1, read:
- Umbra/_bmad-output/planning-artifacts/[wherever DESIGN.md and EXPERIENCE.md ended up] —
  this is the binding brand and product spec. Treat it as ground truth for anything about
  visual identity, voice, and product scope.
- Umbra/_bmad-output/planning-artifacts/prds/ (the current PRD) for positioning and
  audience.
- umbra-web's current src/pages/*.astro — treat these as a rough historical draft to
  inspect for tone and what's already been attempted, NOT as a page inventory to preserve
  or copy to preserve. Assume both the page list and the copy may change completely.

Ask me clarifying questions any time scope, effort, or timeline is unclear — don't guess
and fill gaps silently, in Step 1 or Step 2. Output the roadmap as a markdown file, not
just chat text, so I can hand pieces of it to other AI conversations later — same
convention as brand-ux-product-discovery-roadmap.md in this repo, which you should also
read for the pattern this whole project's planning docs follow.
```
