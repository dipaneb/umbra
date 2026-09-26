---
title: "Umbra — Landing Page Visual Design"
status: draft
created: 2026-09-21
updated: 2026-09-26 (Step 5.7 — complete: dark-mode token-swap audit, bento-tile role-swap finding, favicon prefers-color-scheme browser-support matrix; Phase 5 now fully closed)
---

# Umbra — Landing Page Visual Design

> Phase 5 of `README.md`'s roadmap. Each section is one step's output, written the same session the
> step ran, following the working-file convention `landing-strategy.md`/`landing-ia.md`/
> `landing-copy.md`/`landing-legal.md` already established.

## §1 — Web tokens (Step 5.1)

**Method:** working session against `DESIGN.md`, extended with a live visual comparison (a Claude
design-canvas artifact, three rounds) once the type scale and — after developer pushback — the
display typeface both turned out to be genuinely open decisions rather than copy-paste jobs.
Licensing checked live for every new font candidate (SIL OFL 1.1 in every case that survived), the
same discipline Step 4.4 used for Geist/Phosphor — never taken from memory.

### Why "same families" got reopened

The roadmap's own instruction for this step reads "same families" as a given, and Step 4.4 had
already licence-cleared Geist Sans/Mono specifically for `umbra-web`, treating the question as
settled before this step ever ran. Developer pushback, this session: the app's typography is tuned
for a dense, precise, *scanned* UI (`DESIGN.md`'s own words), while a landing page's job is
persuasion — read once, at leisure, competing for attention — a different job with no obligation to
share a typographic personality. Reopened as a genuine decision rather than left inherited by
default; this is exactly the kind of call the roadmap's own autonomy table flags this step as "yours
by right" for.

### Display typeface — four rounds to Hubot Sans

Every candidate below was checked live against its own licence file or npm registry entry, not
assumed from familiarity:

1. **Round 1 — baseline.** Space Grotesk (SIL OFL 1.1) vs. Bricolage Grotesque (SIL OFL 1.1) against
   a Geist Sans stand-in. **Rejected: Space Grotesk** — read as too safe/generic to justify a second
   typeface at all.
2. **Round 2 — two lanes.** Developer named the actual target: something "fun, creative and SaaS-like"
   *or* something "original and mechanical" — with a concrete reference for the latter, an industrial
   precision-hardware feel (RED cinema cameras: a neutral, engineered body with one loud accent).
   Fun/SaaS lane: Unbounded, Syne. Mechanical lane: Chakra Petch, Big Shoulders. All four SIL OFL 1.1,
   verified live. **Rejected: Chakra Petch** — "has the idea... but feels way too geeky, it should be
   less visible." Diagnosis: it borrows literal sci-fi/HUD visual language (a *costume*), which reads
   as a different thing from "engineered" (visible construction, no genre reference).
3. **Round 3 — checked two more sources by name.** The developer named a "famous French foundry that
   makes free fonts" (**Velvetyne Type Foundry**, Paris, founded 2010 — the first Francophone foundry
   built entirely around libre/open fonts). Its three most technical-leaning releases were checked —
   Terminal Grotesque (self-described "punk and technical," pixel-derived, retrofuturistic), Karrik
   (deliberately brutalist/vernacular, uneven letterforms), Grotesk (heavily geometric, oversized
   spacing) — and **none made the cut**: all three lean rougher/louder than the brief, just in a
   different register than Chakra Petch's sci-fi loudness. Recorded as checked-and-rejected rather
   than silently omitted. Separately, Fontshare's ITF closed-source licence (initially set aside over
   ambiguity) was re-verified directly: self-hosted `@font-face` embedding on a commercial site is
   explicitly permitted, the only restriction being resale/redistribution of the raw font files. This
   reopened Fontshare's catalogue; **Clash Display** was added and rendered (downloaded and
   self-hosted live for the comparison, the same way production would). Read as closer to the
   fun/SaaS pole than the mechanical one, so kept as a documented alternative rather than a finalist.
4. **Decided: Hubot Sans.** GitHub's own display companion to its Mona Sans UI face, built
   specifically as a restrained technical/mechanical voice for headers and pull-quotes in
   developer-tool branding — the first candidate that targeted "engineered, not costumed" by design
   rather than by coincidence.

**Scope of the change:** Hubot Sans replaces Geist Sans in exactly three roles — `hero`, `h1`, `h2`.
Geist Sans stays for `h3`/`body-lead`/`body`/`label`/`caption`; Geist Mono is untouched for `code`.
This is a *display-face* decision, not a brand-wide typeface swap.

**Licence, verified live:** SIL Open Font License 1.1, confirmed against `github/hubot-sans`'s own
`LICENSE` file — identical terms to Geist (free commercial use, no royalty, embeddable). Distribution
confirmed the same `@fontsource`-style route Geist already uses: `@fontsource-variable/hubot-sans`
and `@fontsource/hubot-sans` both exist on the public npm registry at `5.3.0`, `OFL-1.1` (checked
live via `npm view`, not assumed from the family resemblance to Geist's own package naming). Variable
font, 8 static weights available if the variable axis isn't wanted. **This spec uses weight 700**
uniformly across `hero`/`h1`/`h2` — one step below the family's heaviest weight, the same restraint
`DESIGN.md` itself uses (never maxing a family's weight range for headline text) — flagged below as
an easy Step 6.2 tuning point once real copy is set in it.

**Housekeeping:** Hubot Sans is a new third-party asset that postdates Step 4.4's licence record.
Addendum written into `landing-legal.md` §4 the same session, rather than left as a silent gap in an
already-checked step.

### Type scale

Mobile (375px) and desktop (1440px) endpoints; production interpolates between them with CSS
`clamp()`. **Authored in `rem`, not `px`** — see the accessibility note below for why this isn't
optional. `app` column shows the closest `DESIGN.md` token for comparison, where one exists.

| Role | Face | Weight | Line-height | Tracking | Mobile | Desktop | App equivalent |
|---|---|---|---|---|---|---|---|
| `hero` | Hubot Sans | 700 | 1.05 | -0.02em | 2.25rem (36px) | 4rem (64px) | none — new role |
| `h1` | Hubot Sans | 700 | 1.15 | -0.01em | 1.875rem (30px) | 2.75rem (44px) | none — new role |
| `h2` | Hubot Sans | 700 | 1.25 | -0.01em | 1.375rem (22px) | 2rem (32px) | none — new role |
| `h3` | Geist Sans | 600 | 1.3 | normal | 1.125rem (18px) | 1.375rem (22px) | `heading` (18px flat) |
| `body-lead` | Geist Sans | 400 | 1.5 | normal | 1.125rem (18px) | 1.375rem (22px) | none — new role |
| `body` | Geist Sans | 400 | 1.6 | normal | 1rem (16px) | 1.125rem (18px) | `body` (14px flat) |
| `label` | Geist Sans | 500 | 1.4 | normal | 0.8125rem (13px, static) | same | `label` (13px, unchanged) |
| `caption` | Geist Sans | 400 | 1.4 | normal | 0.75rem (12px, static) | same | `caption` (12px, unchanged) |
| `code` | Geist Mono | 400 | 1.6 | normal | 0.875rem (14px, static) | same | `code` (13px) |

`label`/`caption` stay flat and near-identical to their app tokens deliberately: they're small,
functional text (nav, fine print) where matching the app's density *is* the "recognisably the same
brand" signal. `body` is a deliberate bump from the app's 14px — dense UI text is scanned, marketing
prose is read, and 16–18px is the conventional legible range for the latter. `code` gets the same
1px bump for the same reason (inline code in body copy, not a dense JSON/JWT viewport).

### Fluid formula

Each `clamp()` is derived from its mobile/desktop pair over a 375px→1440px reference viewport, not
hand-picked:

```
slope  = (maxPx - minPx) / (1440 - 375)
vw     = slope × 100
rem    = minPx/16 - slope × 375/16
clamp(<minRem>rem, <rem>rem + <vw>vw, <maxRem>rem)
```

```css
--type-hero:       clamp(2.25rem, 1.634rem + 2.629vw, 4rem);
--type-h1:         clamp(1.875rem, 1.567rem + 1.315vw, 2.75rem);
--type-h2:         clamp(1.375rem, 1.155rem + 0.939vw, 2rem);
--type-h3:         clamp(1.125rem, 1.037rem + 0.376vw, 1.375rem);
--type-body-lead:  clamp(1.125rem, 1.037rem + 0.376vw, 1.375rem);
--type-body:       clamp(1rem, 0.956rem + 0.188vw, 1.125rem);
--type-label:      0.8125rem;   /* static */
--type-caption:    0.75rem;     /* static */
--type-code:       0.875rem;    /* static */
```

Line-height stays unitless (already scale-independent) and tracking stays in `em` (already relative
to the element's own font-size) — only the font-size values themselves needed the fluid treatment.

### Accessibility guardrail — `rem`, not `px`

Raised by the developer directly, and correct: WCAG 2.1 Success Criterion 1.4.4 (Resize Text) is
exactly this distinction. A `rem` value inherits from the root `<html>` element's font-size, which
responds to a visitor's browser-level "default font size" preference — distinct from full-page zoom,
which scales everything regardless of unit. A `px` value ignores that preference entirely. Every size
above is authored in `rem` for this reason, not just for the tidiness of round numbers.

**This only holds if nothing overrides it downstream.** Checked live: `umbra-web/src/layouts/
Layout.astro` currently sets no `html { font-size: ... }` at all, so there's no existing anti-pattern
to undo — but it's an easy one to introduce by accident (a common trick, `html { font-size: 62.5% }`,
to make `1rem = 10px` math easier, silently defeats this). **Flagged as a hard constraint for Step
6.2**, not just a preference: the `<html>` element must keep its font-size at the browser default
(effectively `100%`) for any of the above to actually do its job.

### Breakpoints

Structural tokens only — how each is used (nav collapse, grid column counts) is explicitly Step 5.2's
decision, not this one's:

```css
--bp-md: 768px;
--bp-lg: 1024px;
--bp-xl: 1280px;
```

Kept in `px` deliberately, unlike the type scale — `@media` breakpoints are a different accessibility
question (structural layout shifts, not text resizing) and `px`-based media queries are standard,
uncontroversial practice.

### Spacing — extends the existing 4px unit

`DESIGN.md`'s scale (`0-5` through `8`, i.e. 2px–32px) is unchanged and still governs component-level
spacing. New steps below extend it upward for page-level section rhythm, in `rem` for the same
resize-text reason as type:

```css
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-20: 5rem;    /* 80px */
--space-24: 6rem;    /* 96px */
--space-32: 8rem;    /* 128px */

--space-section:     clamp(3rem, 1.944rem + 4.507vw, 6rem);   /* 48px → 96px, section-to-section */
--space-section-lg:  clamp(4rem, 2.592rem + 6.009vw, 8rem);   /* 64px → 128px, hero top/bottom */
```

### Unchanged from the app

Per the roadmap's own instruction, these carry over exactly as `DESIGN.md` locked them — no new
decision made or needed:

- The 4px spacing **unit** itself (only new upper steps were added, above).
- The 4px radius scale (`sm` 2px / `DEFAULT` 4px / `lg` 8px / `full` pill) — no new radius introduced.
- "Orange is a budget of one" — one signature-orange element per screen/section, unchanged.
- Geist Sans for `h3`/`body-lead`/`body`/`label`/`caption`; Geist Mono for `code`.

**Developer sign-off (2026-09-21):** the two open proposals above — the `body` base bump to
16px→18px, and the 3-value breakpoint set — were confirmed explicitly, not left as unobjected
defaults. Nothing from this step's own scope remains open; the items below are deferred to later
steps by design, not unresolved parts of this one.

### Not resolved here, deliberately

- **Hubot Sans's exact hero weight (700 vs. 800)** — cheap to tune once real hero copy is set in it at
  Step 6.2; not worth locking against a placeholder string now.
- **Whether Hubot Sans's width axis is worth engaging** (it ships as a variable font) — default width
  used throughout; not explored, since nothing in the brief called for a condensed/expanded variant.
- **Breakpoint count (3)** — a reasonable guess at what Step 5.2's actual layouts will need; could
  trim to 2 if they turn out simpler than expected.
- **Section-spacing token usage** — `--space-section`/`--space-section-lg` are provided as tools;
  which sections use which is Step 5.2's layout call, not this step's.

### Feeds directly into

- **Step 5.2** (layout & responsive design) consumes the breakpoints and spacing scale directly.
- **Step 6.2** (layout and token implementation) turns every token above into real CSS custom
  properties in `Layout.astro`, self-hosts Hubot Sans the same `@fontsource`-style way Geist already
  is, and must respect the `<html>` font-size guardrail above.
- **`landing-legal.md` §4** — addendum recorded there for Hubot Sans, same session, so Step 6.2
  inherits a closed licence question rather than an open one.

---

## §2 — Layout & responsive design (Step 5.2)

**Status: signed off 2026-09-22, with three named opens carried forward rather than a clean pass** —
the same "accepted with reservations" pattern Step 3.3 used. `README.md`'s own autonomy table lists 5.2
under "yours by right — the decision is the deliverable," the same category as 5.1; this step followed
5.1's own working method exactly (build the artboard, iterate through developer feedback rounds,
including a rejected round or two along the way) before landing. **The three carried-forward opens:**
(1) the alternating section background (white bands behind Workflow/Why-Umbra) was this step's own
addition and was never explicitly confirmed; (2) the mobile nav's expanded/open hamburger state still
isn't drawn, only its collapsed trigger; (3) Hash's tablet tile lost its "tall" treatment in the
3-column reflow — still orange, still gets the ghost glyph, just sized like its row instead of spanning
two — and that trade-off hasn't had an explicit yes. None block Step 5.3.

**Method:** built as a two-artboard canvas (a Design-type Artifact — desktop and mobile side by side,
matching this file's own §1 seeding pattern) rather than described in prose, since layout is the one
Phase-5 output that doesn't survive being written as a spec. Consumes §1's tokens directly (the fluid
type scale's desktop/mobile endpoints, the three breakpoints, the extended spacing scale) and
`landing-ia.md` §3's home spine (nav → hero → feature tour → workflow → proof → why-umbra → closing
CTA → footer) section-for-section, seeded with the actual drafted copy (`landing-copy.md` §2/§3/§5)
rather than lorem ipsum, so the layout is being judged against real line lengths and real section
counts, not placeholder text that hides a wrapping problem. **Canvas:** [Umbra — Home Layout (Step
5.2)](https://claude.ai/artifact/7jvUELBG9GkfQ6kvRE4tn1) — private; share it from the page's own Share
menu if anyone besides the developer needs the link.

### What the three artboards show

All three are full-length static comps (not live, breakpoint-responsive CSS — that's Step 6.2's job),
one per tier:

- **Desktop, 1440px** — the `--bp-xl`/wide-desktop reading. Nav is a single row (wordmark, Tools/FAQ/
  About, Download button, Français far right — `landing-ia.md` §3's exact nav order). Content sits in
  a 1200px-wide centered column (120px side margins at this width). The feature-tour grid runs 3
  columns. Workflow is two-column (copy left, video right). Proof stays a single centered column
  (max-width 800px) at every size — it's prose-and-diagram, not a grid, so it doesn't need the wide
  canvas. Why Umbra runs its 4 statements in one row.
- **Tablet, 768px** — the `--bp-md` lower bound of the 768–1023px tier, added after the developer
  asked to see this tier drawn rather than trusted as an interpolation between the other two. Nav
  still fits as a full row at this width (checked directly, not assumed — content margins narrow to
  40px and the nav's own elements measure well under the available 688px). Feature tour drops to 2
  columns; Why Umbra drops to a 2×2 grid; Workflow already matches the mobile treatment (stacked) at
  this tier, per the table below. Type sizes here aren't hand-picked — they're §1's own fluid `clamp()`
  formula evaluated at a 768px viewport (e.g. hero lands at ~46px, body at ~17px), so this artboard
  is a real point on the same curve the other two anchor, not a fourth independent scale.
- **Mobile, 390px** — the `--bp-md`-and-below reading. Nav collapses to wordmark + Download + a
  hamburger trigger (the trigger's *expanded* state — full-screen overlay vs. a dropdown panel — isn't
  drawn yet, flagged below). Every grid collapses to a single stacked column: feature-tour cards,
  Why-Umbra's four statements, and the proof section's device–✕–server diagram (row at desktop/tablet,
  stacked column on mobile, since "device / ✕ / server" reads fine either direction).

### Decided this step: which breakpoint governs which section

`landing-design.md` §1 supplied three breakpoint tokens (`--bp-md` 768 / `--bp-lg` 1024 / `--bp-xl`
1280) without saying how they'd be used — explicitly deferred to this step. Assigned:

| Section | ≥ `--bp-lg` (1024px) | `--bp-md`–`--bp-lg` (768–1023px) | < `--bp-md` (mobile) |
|---|---|---|---|
| Nav | Full row, all links visible | Full row, all links visible | Wordmark + Download + hamburger |
| Feature tour grid | Bento, 4-col reflow, live search | Bento, 3-col reflow, live search | 1 column, horizontal-scroll strip |
| Workflow | Copy + video, side by side | Stacked (copy above video) | Stacked (copy above video) |
| Why Umbra | 4-column row | 2×2 grid | 1 column, stacked |
| Proof | Single centered column, 800px max-width, diagram as a row, self-check terminal shown | Same, diagram as a row, self-check terminal shown | Diagram as a row (corrected — not stacked), self-check terminal **removed entirely** |

**Drawn, not just proposed.** A third artboard (768px, the tier's lower bound — also the classic iPad-
portrait width) was added after the developer asked to see it directly rather than trust the
interpolation between the other two. Confirmed at that width: the nav still fits as one row (checked,
not assumed), and the type sizes are §1's real fluid `clamp()` values at a 768px viewport, not a
separately hand-picked scale. The tier is a single artboard at its narrow edge, not two — its wide
edge (1023px) is close enough to the desktop artboard's own behavior that a fourth comp would mostly
repeat it.

### Decided this step: section rhythm uses §1's two spacing tokens, not one

`--space-section` (48px→96px) governs the feature-tour, workflow, proof, and why-umbra sections —
`--space-section-lg` (64px→128px) is reserved for the hero and the closing CTA specifically, since
those are the two moments the spine treats as "the page breathing before/after its main argument," not
just another section boundary. This matches §1's own framing of the two tokens ("hero top/bottom" named
explicitly) rather than inventing a new rule.

### Feature-tour arrangement — resolved after four rounds

The 3-equal-columns feature-tour grid this file originally shipped with (§2's first draft, above) drew
a direct complaint: nine roughly-equal cards, unstyled, already read as too long a scroll on mobile
before any real growth in tool count. Explored and rejected in order: **A, an auto-scrolling marquee**
(real, working CSS animation in the canvas, hover-to-pause) — rejected because a moving strip can't
carry a description, and this section's whole job is presenting each tool *with* one. **C, a
category-sidebar-plus-fixed-height-scrollable-panel** — structurally the most scalable option (the
section's height would never grow no matter how many tools ship) but rejected as visually flat. Two
bento rounds were also rejected before the arrangement itself was right: a v2 restyle (custom icons, a
dark textured hero tile) that only changed decoration on top of the same rigid 6-column/3-equal-row
grid — correctly called out as solving a design problem when the actual complaint was structural; and a
v3 masonry-column pass that fixed the rigidity but read as too plain once the decorative treatment was
stripped back to test the structure alone. **Decided: a v4 real asymmetric bento** — tight 12px gaps so
tiles read as one mosaic rather than floating cards, genuinely different tile shapes (two tall tiles,
one wide black tile carrying pure typography as its own graphic, four compact squares, four medium
tiles, one full-width banner), and disciplined color-blocking limited to Umbra's actual two-hue system
(white/black/one orange tile — the same "budget of one" rule `DESIGN.md` already enforces elsewhere,
applied here to the whole section rather than a single accent color inside one card). Modeled directly
on two real reference bento grids the developer supplied (a food-delivery-app product grid, and a
brand/agency grid for a company called Sync) — both share the same three structural traits this v4
adopts: tight edge-to-edge tiles, real aspect-ratio variety, and typography used as a graphic element in
at least one tile, not just as a label.

### Decided (2026-09-22): desktop feature tour is bento + a live-filtering search bar

The winning direction combines the v4 bento grid with the search input the very first draft carried
(then dropped through the restyle rounds) — restored, with a new behavior: **typing in the search bar
filters the grid by highlighting the matching tile(s) and de-emphasizing (dimming/fading) the rest**,
rather than the search box being a static, decorative affordance. This wasn't pushed into the canvas
this round — recorded here as the confirmed direction for Step 6.3 to build; happy to add a live,
working version to the Design canvas (the format supports real state and input events) if it's useful
to see before that step runs.

**This also resolves the desktop A/B choice raised last round:** bento (extended with search) is the
answer, not the command-palette replica. The palette idea isn't wasted, though — flagging it as a
strong candidate for the Workflow section's own visual (spine position 3, "Every tool, one search
away"), which is already pitching the exact `⌘K` mechanism the palette mock demonstrated, once Step 5.3
needs a real visual there instead of the current gray placeholder box.

**Mobile stays the horizontal-scroll-with-search strip** (`Tools-Mobile-HorizScroll.dc.html`),
confirmed unchanged — bento's tight, many-tiles-per-row structure doesn't translate to a 390px viewport
regardless of styling, so mobile keeps its own, already-agreed answer rather than trying to compress the
desktop grid down.

### Confirmed 2026-09-22, merged into the full-page artboards the same day

- **Nav Download button hides while the hero section is in view**, and appears once the visitor scrolls
  past it. Rationale: the hero already carries its own, more prominent Download CTA directly below the
  headline — showing the nav's copy of the same button at the same time is redundant noise, not a
  second chance to convert. Built as real behavior, not described in prose: an `IntersectionObserver` on
  the hero section toggles the nav button's opacity, on all three full-page artboards (the nav is also
  now `position: sticky` on all three, which it needed to be for this to be visible at all — it wasn't
  before). This is genuinely interactive in the canvas (Play mode), not a static illustration of the
  idea.
- **Proof section, mobile only: the device–✕–server diagram is now horizontal** (a row, matching
  desktop/tablet) instead of the stacked-vertical treatment `Mobile.dc.html` shipped with originally.
  Corrects this file's own breakpoint table above (the "Proof" row), which had assumed stacking was the
  natural mobile treatment for "device / ✕ / server" — a row reads fine at 390px too (boxes sized down
  to 145px each to fit), and consistency across all three tiers is simpler to build than a
  breakpoint-specific orientation.
- **Proof section, mobile only: the `nettop` terminal self-check block is removed entirely**, not just
  visually de-emphasized — the "Don't take our word for it" line, the run-this-command instruction, the
  code block, and its disclaimer caption are all gone from `Mobile.dc.html`. A visitor on a phone has no
  terminal to run the command in, and can't install or run the downloaded macOS/Windows/Linux binary
  from a phone in the first place, so the instruction was unusable *and* irrelevant on that surface, not
  merely long. Desktop and tablet keep it unchanged. This cut, combined with the feature-tour rebuild
  below, brought `Mobile.dc.html`'s total height down from 5850px to 4300px — a direct answer to the
  complaint that started this whole round.

### Feature-tour rebuild, merged into the full-page artboards (2026-09-22)

`Desktop.dc.html`'s feature-tour section now **is** the bento grid resolved above, not a separate
comparison artboard — same tight-gap asymmetric layout (two tall tiles, one black typographic tile, one
orange tile, four compact squares, four medium tiles, one wide banner), with the search bar restored and
made genuinely functional: typing filters the grid by dimming and grayscale-fading every tile whose name
(and its `registry.ts` aliases — French terms included, e.g. "décoder" matches Base64) doesn't contain
the query, and outlines the matching tile(s) in the signature orange. This is real, working JavaScript in
the canvas (an `input` listener plus a plain DOM query — no framework magic), not a mockup of the
behavior. `Mobile.dc.html`'s feature-tour section is now the horizontal-scroll-with-search strip,
replacing the old nine-stacked-cards list — real `scroll-snap-x`, swipeable in Play mode.

**Tablet gets the same bento + live search, not the old 2-column grid** — corrected the same day after
the developer flagged that leaving tablet on its own separate treatment (rather than reflowing the same
resolved design) wasn't a real decision, just an oversight from testing one width at a time. Reflowed
from 4 columns to 3 (768px doesn't have room for 4 without cramping the small tiles below a readable
width): JSON stays the tall glyph-textured tile, the black typographic tile stays wide, and **Hash keeps
its orange treatment** even though it can no longer also be tall at this width — preserving the
white/black/orange three-tone discipline mattered more than preserving every tile's exact proportions.
The live search filter is wired the same way as desktop, against the same `data-tool-name` attributes.

**Search box restyled (2026-09-22)** on both desktop and tablet: it was a plain bordered rectangle that
only read as a search field because of its placeholder text. Now it's a distinct elevated box — a
magnifying-glass icon, `--radius-lg` (8px, the same radius `DESIGN.md` reserves for floating surfaces)
instead of the flat tiles' 4px, and a soft shadow — so it reads as a search bar at a glance rather than
blending into the grid below it. It was already positioned outside the grid (its own row, above); this
was a styling gap, not a layout one.

### Decided this step: alternating section background, not used anywhere upstream

Eight sections in a row on one flat `--bg-base` read as an undifferentiated scroll once real copy (not
a wireframe's gray boxes) is in them. The draft alternates `--bg-base` (hero, feature tour, proof,
closing CTA) with `--bg-surface` plus hairline top/bottom borders (workflow, why-umbra) — the same
card-surface color already licensed by `DESIGN.md`'s two-tier elevation rule, reused here as a
section-level device rather than a new color decision. **Flagged, not locked:** nothing in §1 or the
spine asked for this: it's this step's own call, worth an explicit yes/no rather than silent
acceptance.

### Placeholders this draft is knowingly carrying

- **Icons are hand-drawn placeholder SVGs, not the real Phosphor icon set** `landing-legal.md` §4
  already cleared — true of the desktop bento grid's custom line icons (a key for JWT, a clock for Cron,
  and so on) and of the plain text-shorthand badges (`{ }`, `64`, `ID`, `#`, `JWT`, `CRON`, `OCR`, `PDF`,
  `IMG`) still used on `Tablet.dc.html`'s 2-column grid and `Mobile.dc.html`'s horizontal-scroll strip.
  Deliberate either way — Step 5.5/5.6 haven't produced the mark or wired the icon system yet, and
  `DESIGN.md`'s own history records the text-shorthand form as what the app itself shipped before its
  Phosphor migration, so even the plainer version is a precedented placeholder, not an invented one.
- **Video/screenshot blocks (hero, workflow) are gray placeholder cards with a play glyph**, not real
  captures — Step 5.3's Epic-7 fork is still open, and this layout doesn't need to wait on it: the
  boxes are sized and positioned so a real asset drops in without a layout change either way that fork
  resolves.
- **Hubot Sans isn't rendered in this canvas** — it isn't distributed via Google Fonts (only Fontsource/
  npm, per §1's own licensing note), and this Artifact type can only load webfonts from Google Fonts
  live. Archivo 700 stands in for `hero`/`h1`/`h2` in the canvas preview only; §1's actual spec
  (self-hosted Hubot Sans, weight 700) is unchanged and is what Step 6.2 implements. Worth knowing
  before judging the mockup's headline character on its exact typeface.
- **The mobile nav's expanded hamburger state** (full-screen overlay vs. a dropdown panel, and what it
  contains — same links as desktop plus the language switch) isn't drawn — only the collapsed trigger
  is shown.

### Not decided here, deliberately

- **The mobile nav's expanded state** — flagged above.
- **The alternating section background** — flagged above as this step's own new call, not yet
  developer-confirmed.
- **Exact photography/illustration treatment for the device–✕–server diagram** — this draft keeps it
  literal (two bordered boxes and a symbol), matching the copy's own bracketed note that visual
  execution is this step's job; a more illustrated treatment is a legitimate alternative, not
  attempted here.
- **Dark mode** — Step 5.7's job; this draft is light-mode only.
- **The search bar's filter/highlight behavior at the mobile tier** — built and working on desktop and
  tablet; mobile's search bar (in the horizontal-scroll strip) is currently decorative, not wired to
  filter or scroll to a match the way the other two tiers now do.

### Feeds directly into

- **Step 5.3** (product imagery) — the hero and workflow placeholder boxes are sized and positioned
  for the real assets that step produces.
- **Step 5.4** (OG image) — can reuse this canvas's type/color treatment for a consistent look.
- **Step 6.2** (layout and token implementation) — turns this draft's breakpoint/spacing/background
  decisions into real `Layout.astro` CSS, once confirmed.
- **Step 6.3** (pages) — the other 18 pages in the inventory (`landing-ia.md` §1) still need their own
  layout pass; this step only covers home, per its own scope ("home page first, then the rest").

---

## §3 — Product imagery (Step 5.3)

**Status: Epic-7 fork resolved 2026-09-24 — real captures, not mockups. Actual capture is not done —
it's the one part of this step (per `README.md`'s own autonomy table, "5.3 (part)") that requires the
developer's own machine and cannot be produced by a session.**

### The fork dissolved, not just decided

`README.md`'s own text for this step assumed "the shipped shell still predates the design system,"
framing the choice as mockups-now-vs-hold. That premise was checked live, not taken from the roadmap's
wording, and turned out to be stale: **Epic 7 (shell chrome rebrand) and Epic 8 (every individual tool
redesign) are both fully merged to `Umbra`'s `main`**, well before its current tip.

- Epic 7 — all eight stories merged: `#78` (7.1, tokens/icons) → `#79` (7.2, dark mode) → `#80` (7.3,
  grid home) → `#82` (7.4, sidebar active-nav) → `#83` (7.5, pin/revisit) → `#84` (7.6, sectioned
  settings) → `#85` (7.7, update-signal dot) → `#86` (7.8, clipboard-suggestion surface).
- Epic 8 — all nine stories merged, including every tool the Workflow-section demo flow touches:
  8.1 JSON, 8.2 Base64, 8.3 UUID, 8.4 Hash, 8.5 JWT, 8.6 Cron, 8.7 OCR, 8.8 PDF, 8.9 Images (`#154`).
- `sprint-status.yaml` still shows both epics as `in-progress` — but every one of their stories reads
  `done`, and `git log` confirms every PR above is on `main` ahead of the packaging work at `#156`
  (current tip). The `in-progress` flag is almost certainly just an un-flipped epic-status field (each
  epic's own retrospective is marked `optional` and hasn't run) — a documentation lag, not evidence the
  work is unfinished. Read the two facts (story status vs. epic status) as disagreeing, and trusted the
  live `git log` over either.

**Conclusion:** the app running on `main` today already reflects `DESIGN.md`/`EXPERIENCE.md`. There's
no version of Umbra left to wait for before a screenshot stops contradicting the site's own branding.
Shipping Step 5.2's placeholder mockups — even labelled honestly — would be manufacturing a gap that no
longer exists.

### Decided 2026-09-24

- **Real screenshots and video, captured against `main` now** — not the Step 5.2 mockups, and not held
  for a future Epic. Dissolves the roadmap's original (a)/(b) framing; there's no "swap in later"
  half left.
- **Static captures** (hero art, the 9 `/tools/*` page screenshots): macOS `⌘⇧5` or Shottr/CleanShot,
  unchanged from `README.md`'s own tool suggestion — plain stills don't need a specialized tool.
- **The Workflow-section demo video**: developer's explicit choice is **Screen Studio or OpenScreen**,
  not a plain screen recording — both are product-demo-oriented recorders (camera motion/zoom framing
  built for exactly this kind of feature walkthrough), a better fit for a persuasive landing-page asset
  than a raw capture would be. **Corrects this step's own `README.md` tool line**, which only named
  static-capture tools and didn't distinguish the video asset's different job.

### Decided 2026-09-24: the Workflow video's actual shot list — a scenario, not the locked copy's flow

The developer proposed a different demo entirely, live-verified against `src/stores/registry.ts` and
`src/shell/clipboardMatch.ts` before accepting it (not taken on faith): a colleague posts a screenshot
of a broken API log in Slack; OCR pulls the raw text out of it; the JSON tool's repair feature fixes a
truncated log entry; the JWT token inside it decodes cleanly, revealing the actual permission bug —
closing the loop the Slack message opened. Two real, shipped mechanisms get demonstrated instead of
one: `⌘K` search **and** the clipboard-suggestion surface (Story 7.8), chained.

**Explicit developer decision: the locked on-page copy does not change.** `landing-ia.md` §3's Workflow
row and `landing-copy.md`'s EN/FR text — "Press ⌘K from anywhere in Umbra. Format a JSON payload,
decode a JWT, build a cron schedule" — stay exactly as Step 3.6/3.6b/3.7 signed them off. **This is a
known, accepted gap, not an oversight:** the video will not show cron, and will show OCR, clipboard-
chaining, and JSON repair, none of which the headline copy names. Recorded here so a later session
doesn't mistake the mismatch for something that slipped through unnoticed.

**Corrected 2026-09-24, same session — the order above was wrong and never shot.** JWT decode with a
malformed payload doesn't degrade gracefully: `crates/umbra-core/src/jwt.rs`'s `decode_segment` returns
a hard `ToolError` the moment `serde_json::from_slice` fails on the payload, and `JwtView.vue` only ever
renders that error string (`toolErrorMessage`) — no raw decoded text is exposed anywhere in the UI to
copy out. So "decode a broken JWT, then repair what comes out" cannot actually be filmed; the tool just
shows an error and stops. **Fixed by reversing the order:** the malformed JSON is a log blob, not the
JWT's own payload — it gets repaired *first*, and the JWT (already valid) is decoded *after*, pulled
cleanly out of the repaired log.

**Shot list (verified, not just planned — see the two verification notes below):**

1. **Slack message** (not an Umbra screen) — a colleague posts a screenshot of a raw API log, asking
   why their export request is failing. Sets up *why* before the app appears.
2. **`⌘K` opens the first tool** (Image to Text/OCR) — the developer's own addition. Paste the
   screenshot in.
3. **OCR extracts the log text** — a JSON blob, truncated mid-string (exactly what the screenshot
   shows: a log line that got cut off).
4. **Copy the extracted text.** No clipboard suggestion fires here — confirmed live: `isJsonShaped()`
   in `clipboardMatch.ts` calls `JSON.parse` and only matches on success, so genuinely malformed JSON
   can't trigger the JSON suggestion. Not a bug to route around, just a real limit of the surface.
5. **Manually open the JSON tool** (⌘K or the sidebar) and paste the malformed log in.
6. **The Repair tab fixes it.** **Verified, not assumed:** added a throwaway `#[test]` to
   `crates/umbra-core/src/json.rs` calling `repair()` on the exact candidate string below, ran
   `cargo test -p umbra-core`, read the real output, then reverted the file (`git status` confirms
   clean). Result: `still_invalid: false`, changes `["unterminated-string", "unclosed-bracket"]`, and
   the `token` field survives completely intact — this specific case is also covered by an existing
   passing test, `repair_closes_an_unterminated_string`, not just this session's throwaway one.
7. **Copy the `token` field's value out of the repaired tree** (the structured view, not manual text
   selection — the point being made is "now that it's valid, I can grab exactly the field I need") →
   clipboard-suggestion offers the JWT tool (`matchesJwt`, `specificity: 3`) → switch to it.
8. **JWT tool decodes cleanly.** **Verified, not assumed:** decoded the exact token below locally
   (Python, matching the app's own base64url + JSON parsing) — payload is
   `{"sub":"alex@example.com","role":"viewer","scopes":["reports:read"]}`. On screen, this is the
   punchline: the colleague has `viewer`/`reports:read`, not the `reports:export` scope the endpoint
   needs — the log's `requested_scope` field (still visible from step 6) names exactly what's missing.
   Closes the loop the Slack message opened.

**Ready-to-use content — copy these verbatim, don't hand-author variants:**

- **The truncated log text** (paste into the Slack screenshot mockup for step 1, and into OCR/JSON for
  steps 3–6):
  ```
  {"endpoint":"/export","status":403,"user":"alex@example.com","requested_scope":"reports:export","token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbGV4QGV4YW1wbGUuY29tIiwicm9sZSI6InZpZXdlciIsInNjb3BlcyI6WyJyZXBvcnRzOnJlYWQiXX0.c2lnbmF0dXJlLXBsYWNlaG9sZGVy","message":"permission denied: token scope does not include reports:export, only reports:read was gran
  ```
  (Deliberately cut off mid-word on `gran[ted]` — no closing quote, no closing brace. This is the exact
  shape `repair_closes_an_unterminated_string` covers, just with realistic fields ahead of the
  truncation instead of the test's minimal `{"a": "unterminated}`.)
- **The token** (what `token`'s value resolves to once repaired, and what gets pasted into the JWT
  tool at step 7 — same string, already embedded above):
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbGV4QGV4YW1wbGUuY29tIiwicm9sZSI6InZpZXdlciIsInNjb3BlcyI6WyJyZXBvcnRzOnJlYWQiXX0.c2lnbmF0dXJlLXBsYWNlaG9sZGVy
  ```
  Decodes to header `{"alg":"HS256","typ":"JWT"}`, payload
  `{"sub":"alex@example.com","role":"viewer","scopes":["reports:read"]}`. The signature segment
  (`c2lnbmF0dXJlLXBsYWNlaG9sZGVy`) is a plain placeholder — fine, since Step 3.8 already established
  the tool decodes without verifying.
- **The fake Slack message** (text to paste into a real Slack DM-to-self/scratch channel and screenshot
  — higher-fidelity than recreating Slack's UI by hand):
  > **Sam Rivera** 9:41 AM
  > hey — getting a 403 on `/export`, not sure why. here's what our API logged, looks like it got cut
  > off? 🫠
  > *[attach a screenshot of the truncated log text above, rendered as if from a terminal or log
  > viewer]*

  If a real Slack workspace isn't handy, say so and I'll build a small styled mockup (an Artifact) of a
  chat message instead — lower fidelity than the real app's chrome, but no workspace required.

### Video spec — duration, format, quality

**Step 6.10 (performance budget) hasn't run yet**, so nothing below is a locked Lighthouse number —
it's a working target for this asset specifically, sized so it doesn't force 6.10 to claw back budget
later. The single biggest lever is already decided (Step 2.3/6.10): **no autoplay, `preload="none"`
plus a poster image, so the file doesn't load at all until a visitor presses play** — everything below
matters only once that happens.

| | Target | Why |
|---|---|---|
| **Duration** | 20–30s, hard ceiling 40s | 8 real beats at a brisk, cuts-trimmed product-demo pace (Screen Studio/OpenScreen both support this) run ~2–4s each. Longer both drags on-page and inflates file size for no extra persuasion — this is a proof-of-convenience clip, not a tutorial. |
| **Resolution** | Export 1280×720 (720p) | The Workflow section is a two-column layout (copy left, video right, `landing-design.md` §2) — the video's rendered width is well under half the 1200px content column. 720p is sharp at that size on Retina; 1080p/4K roughly doubles/quadruples file size for no visible gain at the actual display size. |
| **Frame rate** | 30fps | UI screen-capture has no fast motion to justify 60fps — halves the file size for equivalent visual quality. |
| **Codec/container** | WebM (VP9 or AV1) as the primary `<source>`, H.264/MP4 as the fallback `<source>` | Standard `<video>` multi-source pattern — every current browser supports MP4/H.264 as a safety net; WebM typically comes in 30–50% smaller for the same visual quality on screen-capture content. |
| **Bitrate/quality** | H.264: CRF ~28–32 (or ~800kbps–1.5Mbps target for 720p30); WebM: equivalent CRF-based encode | Screen-capture/UI content compresses far more forgivingly than live-action video at the same visual quality — no need for live-action bitrates. |
| **Audio** | None — drop the track entirely | Silent, click-to-play demo; an unused audio track is pure dead weight. |
| **Target file size** | ~1–3MB for the full clip at the above spec | A loose sanity check, not a hard gate — if a re-encode lands meaningfully over this, drop resolution or duration before reaching for a lower CRF, since CRF-driven artifacting is more visible on UI/text content than on video generally. |

### Captured and encoded (2026-09-26)

The Workflow-section demo video is done. What actually happened diverges from this section's own
earlier plan in a few named ways, not silently:

- **Recorded with Notch, not Screen Studio/OpenScreen** — the developer's actual tool choice on the
  day; Notch's built-in cursor-follow zoom/pan is why the footage has real motion, which mattered for
  the settings below.
- **Captions shipped burned-in, per locale — not the `<track>`/VTT approach this file recommended.**
  Two separate files (`workflow-demo.en.*`, `workflow-demo.fr.*`) carry hardcoded English/French
  caption text respectively. Developer's explicit call, made with the trade-off known: this is simpler
  and can't silently break (no separate file to go missing), but it means the captions are **not**
  exposed to screen readers or search/AI crawlers the way a real `<track>` would be — the accessibility
  gap below is a direct consequence, not a separate oversight.
- **Resolution and framerate both went up from this file's original 720p/30fps recommendation**,
  for real reasons found by watching the actual footage: 720p text looked blurry at the display size
  that matters, and Notch's zoom/pan is genuine motion that benefits from 60fps (the "no motion, 30fps
  is enough" reasoning earlier in this section was wrong for this specific recording). Landed on:
  **H.264 MP4, 1080p/30fps** as the universal fallback; **AV1-in-WebM, 1080p/60fps** as the primary
  source, accepting that the two sources aren't visually identical (the fallback is choppier during
  zoom/pan) as a deliberate, informed trade-off rather than an inconsistency that slipped through.
- **The online export was re-encoded, not used as-is.** Notch's own export landed at ~17MB regardless
  of codec (H.264 or AV1) — traced to resolution/quality-preset settings, not codec choice. A first
  online-converter pass got it to 8.42MB but had silently changed the codec to VP9 without saying so
  (still named "av1" in the filename). Re-encoded properly instead: installed ffmpeg, verified the
  VP9 file's actual quality with an objective VMAF score against the untouched original (90.34 — a
  genuinely good, largely transparent result, not a red flag) rather than trusting file size alone,
  then produced a real AV1 encode (SVT-AV1, targeting the same ~1.8Mbps) that beat it outright: **5.17MB
  (en) / 5.22MB (fr), VMAF 90.99** — smaller and marginally higher-scoring than the VP9 alternative,
  confirming AV1's efficiency edge held in practice, not just in theory.
- **Files currently sit in `~/Downloads`, not yet staged into `umbra-web`.** Astro's own docs
  (`/withastro/docs`, checked live) confirm video has no processing pipeline the way images do via
  `astro:assets` — `public/` is the correct, documented home for a pre-encoded video file, copied into
  the build untouched. `umbra-web/public/videos/` is the natural spot; not yet moved there.
- **ffmpeg is currently installed** on the developer's machine at their explicit request, deferred
  uninstall until this step formally closes (not yet removed).

### Text alternative, written (2026-09-26)

The actual final cut diverges from this file's own earlier shot list — OCR proved unreliable for
extracting a JWT specifically (a single wrong character corrupts it, the same failure mode found
earlier this step), so the real flow skips OCR entirely: copy a JWT directly from the Slack message →
paste into the JWT tool, decode → copy the payload → clipboard-suggestion offers the JSON tool → paste
→ search "details" → expand a nested field → copy a Base64 value inside it → `⌘K` to the Base64 tool →
paste, decode → reveals the actual error (a missing `project:deploy` permission). Confirmed against the
developer's own description of the final recording before writing this, not the original script.

Sized for `aria-describedby` on a hidden `<figcaption>`, not a short `aria-label` — there's real
informative content here (the actual revealed bug), not just a label. Wiring is Step 6.3's job; this is
the text deliverable:

- **EN:** *Video demonstration: a JWT copied from a Slack message is pasted into Umbra's JWT tool and
  decoded. Its payload is copied and opened in the JSON tool, where a nested "details" field is expanded
  to reveal a Base64-encoded value. That value is decoded in the Base64 tool, revealing the actual
  error: the required permission is "project:deploy," which the current token doesn't include.*
- **FR:** *Démonstration vidéo : un JWT copié depuis un message Slack est collé dans l'outil JWT d'Umbra
  puis décodé. Sa charge utile est copiée et ouverte dans l'outil JSON, où un champ imbriqué « details »
  est déplié pour révéler une valeur encodée en Base64. Cette valeur est décodée dans l'outil Base64,
  révélant l'erreur réelle : la permission requise est « project:deploy », que le jeton actuel ne
  possède pas.*

### Tool-page screenshots, captured (2026-09-26)

All 18 (9 tools × light/dark) done, in `umbra-web/public/images/tools/{tool}-{light,dark}.png`. Each
shows real, meaningful output, not an empty state — per `landing-copy.md`'s alt-text rule
("screenshots describe what's actually shown, factually") and grounded in the same verified
differentiators Step 3.8 already researched, not generic filler:

- **JSON** — a realistic nested API-response payload in the tree/explorer view.
- **Base64** — a short realistic string encoded.
- **UUID** — a batch of 5 generated v4 UUIDs.
- **Hash** — all five algorithms computed for one input, including MD5/SHA-1 (the weak-algorithm
  flag Step 3.8 verified).
- **JWT** — a decoded header + realistic role/permission-shaped payload.
- **Cron** — the guided grid's own real default ("every day at 9:00 AM" + next 3 runs), not blank.
- **Image to Text** — a genuine OCR extraction, not a staged screenshot-of-a-screenshot: a small
  receipt/hours-sign image was synthesized (TextEdit, screenshotted) specifically so the tool had
  real image content to read, and the extracted text is the tool's own actual output.
- **PDF** — the real page-manipulation view (thumbnails, "Read text"/"Merge with…"), loaded from an
  actual 2-page PDF (a synthesized release-notes document, printed to PDF via TextEdit) — not the
  empty drop zone.
- **Images** — a real AVIF conversion result (92.2KB → 20.1KB, −78%), the same conversion-efficiency
  differentiator Step 3.8 verified for this tool, not just the picker UI.

**Format decision closed (2026-09-26).** Converted all 18 to lossless WebP: 3.7MB → 1.0MB total
(−73%), verified objectively rather than assumed — installed `cwebp`/`avifenc` and tested one
representative screenshot (dense JSON text) at three settings before committing to all 18. Lossless
WebP (48KB) actually beat lossy WebP at q90 (61KB): flat UI/text content compresses better losslessly
than a photo-oriented lossy mode, which wastes bits smoothing regions that were already flat. AVIF at
q85 was smaller still (42KB, SSIM 0.9998 against the original — visually indistinguishable) but lossy;
picked lossless WebP anyway since the gap was marginal (~6KB) and these are product screenshots a
technical audience might study closely — zero risk beat a small size win. The original PNGs are
deleted, not kept as a fallback; WebP's browser support is universal enough by 2026 that a `<picture>`
fallback isn't warranted the way the video's H.264 fallback was for AV1. Still open, and reasonable to
leave for Step 6.3: these are still full Retina-resolution captures — downscaling to whatever the
actual `/tools/*` page displays them at is a further, smaller win once that layout exists.

### Practical notes used for the captures

- **Framing:** clean window, no desktop clutter, no incidental file names/paths visible — checked
  before each capture.
- **Staging location:** `umbra-web/public/videos/` for the video (per Astro's own docs, checked live);
  `umbra-web/public/images/tools/` for these stills, same `public/` convention.

### Corrected 2026-09-26: the hero visual was never actually open

**This section previously carried "hero: screenshot vs. video" as unresolved — wrong.** `Desktop.dc.html`
(Step 5.2's own canvas) already places a labelled box directly under the hero headline/CTA: "Product
preview — video, produced at Step 5.3 (Epic 7 fork)." That box *is* `landing-ia.md` §3 row 1's "product
visual ... teased immediately below the fold" requirement — it only reads as a separate thing because it
renders as its own card, not because it's a different beat in the spine. **The Workflow-section video
produced above is that asset.** No separate hero capture was ever needed; this file's own earlier
tracking of it as open was the error, not a real gap.

**Real consequence, not just a correction:** this also changes the lazy-load question. The box sits
~527px down the page (below nav + headline), not at the very top — so a 90%-visibility
`IntersectionObserver` trigger requires the viewport to reach ~905px with zero scroll to fire
immediately. A typical **mobile** viewport (Lighthouse's default, and usually the dominant scored mode)
never reaches that without a real scroll, so the lazy-load plan likely earns genuine protection there.
Desktop is genuinely borderline — a tall enough browser window could satisfy 90% with no scroll at all.
**Hardening option, developer's to take or leave:** gate the autoplay on *both* the intersection ratio
**and** at least one real `scroll` event having fired, which removes the viewport-height uncertainty
entirely — guarantees zero fetch during a standard (non-scrolling) Lighthouse pass regardless of window
size, with no visible change for a real visitor.

### Not resolved here

- Self-hosted vs. third-party-embedded video player — already flagged open in `landing-ia.md` §3; the
  final encode (plain MP4/WebM) stays neutral to either outcome.
- The copy/video mismatch this step's shot list knowingly carries (no cron shown; OCR, clipboard-
  chaining, and JSON repair shown but unnamed in the headline copy) — recorded above as an accepted
  gap, not reopened here. Revisit only if a future session wants the copy to actually describe this
  scenario instead.
- The video's accessible text alternative (poster `alt`/`aria-label`) — flagged above, not yet written.

### Feeds directly into

- **Step 5.4** (OG image) — may reuse a hero capture, or a dedicated composition.
- **Step 6.3** (pages) — wires these files into their actual page slots once they exist.
- **Step 6.10** (performance budget) — the video file size has to fit inside whatever that step sets.

---

## §4 — Social share card / OG image (Step 5.4)

**Status: done 2026-09-26.** A dedicated composition, not a reused hero capture — the hero visual
(§3) is a video, and a video frame makes a weak static share card; a purpose-built 1200×630 image
does the job better for the same effort.

**Method:** Built as a Design-canvas Artifact — one 1200×630 artboard, the same tool §1/§2 used —
seeded with the *real* production fonts rather than a stand-in: Hubot Sans 700 and Geist Sans
400/600 were downloaded as `woff2` files and uploaded as canvas assets, `@font-face`'d to their
real blob URLs. This sidesteps the limitation §2's own canvas hit (Hubot Sans isn't on Google
Fonts, the only live webfont source a Design canvas can link to, so §2 stood in with Archivo) —
uploaded font assets aren't subject to that restriction, so this card renders in the actual brand
typeface, not a substitute. Canvas: [Umbra — OG Share Card (Step
5.4)](https://claude.ai/artifact/AdVHpP6gmwfyPmNWBGovCL) — private.

The exported PNG itself was produced by loading the same markup in a real headless Chrome instance
at 2x scale and downsampling to the exact 1200×630px OG spec — pixel-exact dimensions and real
webfonts, rather than a screenshot tool's approximate viewport crop.

### Composition decided

- **Dark background**, `--bg-base-dark` (`#141415`, `DESIGN.md`) — the app's own dark palette, not
  a new color picked for this one asset.
- **Wordmark, top-left:** an orange square bullet (`--accent-signature-dark`, `#FF6E30`) + "Umbra"
  set in Hubot Sans 700 — §1's display face, used in exactly the headline-scale role it was decided
  for.
- **The signed-off hero headline, reused verbatim:** "Local tools. Local AI. Nothing else."
  (`landing-copy.md` §2, EN) — with only the last line set in the signature orange, spending
  `DESIGN.md`'s "orange is a budget of one" rule on the differentiator phrase specifically.
  **Deliberately no new copy was authored for this card** — reusing an already-ledger-gated string
  means this asset inherits Step 3.6/3.6b/3.7's existing sign-off instead of needing its own claim
  check.
- **A real product screenshot** (`json-dark.webp`, from Step 5.3's capture set), bleeding off the
  card's right/top/bottom edges at a slight rotation inside a shadowed, rounded panel — the
  "wordmark + one strong line + a real screenshot" pattern Step 1.2's reference scan found at
  Raycast and Linear specifically, not a generic gradient-and-icon template.
- **No subhead, no CTA, no URL.** Checked at a realistic small link-preview scale (267×140px,
  roughly what Slack/iMessage/Discord actually render a shared link at) before finalizing — the
  headline and screenshot both stayed legible at that size; a subhead line would not have.

### Deliberately not on the card

- **No logo mark.** Step 5.5 hasn't run and the developer hasn't supplied the two SVGs yet — the
  wordmark is plain Hubot Sans text, the same placeholder status as the nav's current "Umbra" text
  link. Revisit this card once 5.5/5.6 land; flagged here for Step 10.1's maintenance list, the same
  way Step 5.5 itself names what triggers a re-do.
- **No domain/URL text.** The subdomain doesn't exist yet (Step 6.1), and `CLAUDE.md`'s privacy rule
  is directly relevant here: this roadmap's own "Domain" decision names it as a subdomain of the
  developer's personal-name domain, so writing any candidate URL into a committed asset ahead of
  that step actually running would risk exactly what that rule exists to prevent. Not a real loss —
  most of the reference sites' own OG cards (Step 1.2) don't carry a URL either, since the sharing
  platform already shows the domain in its own chrome next to the card.
- **No French-language variant.** Considered and decided against for now: one universal (English)
  card, matching what the Step 1.2 reference set itself does, rather than a locale-aware `og:image`
  that also needs Step 6.5's routing decided and wired before it could work. Revisitable, not
  closed — a French artboard is a small addition to this same canvas later if it turns out to
  matter, not a redo.

### `og:image:alt`, written — closes a gap `landing-copy.md` already flagged

`landing-copy.md` Part 5 named this as a real, commonly-missed requirement: the OG image needs its
own alt text in `<head>` metadata, separate from any on-page `<img>` alt. Written now rather than
left open for Step 6.7:

> Umbra wordmark next to the headline "Local tools. Local AI. Nothing else." beside a screenshot of
> Umbra's JSON tool showing a formatted API-response payload.

One string, reused on both EN and FR pages — the image's own text is English regardless of which
locale links to it, so a translated alt would describe the image less accurately than this one
does, not more.

### Asset

`umbra-web/public/og-image.png` — 1200×630px PNG, ~161KB. **Staged, not committed** — a new file
sits in the working tree, but committing it is a separate authorization this session didn't ask
for, per this project's own standing rule. Wiring it into `<head>` (`og:image`, `twitter:image`,
and the `og:image:alt` text above, on every page) is Step 6.7's job, per the roadmap's existing
split between producing design output and wiring it into the build.

### Feeds directly into

- **Step 5.5/5.6** — once the mark exists, this card gets a mark-bearing revision (flagged above).
- **Step 6.1** — once the domain is live, revisit whether a URL belongs on the card.
- **Step 6.7** — wires `og-image.png` and its `og:image:alt` text into every page's `<head>`.

---

## §5 — Logo intake & placement inventory (Step 5.5)

**Status: done 2026-09-26.** The developer supplied two vector SVGs (`Logo 1.svg`, `Logo 2.svg`,
originally in `~/Downloads`) — the "ink letter, accent shadow" monogram **U** `DESIGN.md`'s Mark
section already named as the working, adopted-for-now mark. Both files checked out on the
mechanical requirements Step 5.5 set: real vector paths (not embedded raster), transparent
background (the only `white` rect in either file lives inside a `clipPath` mask, not a rendered
background), and the mark isolated with no card, caption, or padding baked in — unlike
`step3.3-logo-ink-letter-accent-shadow.png`, the one file already on disk, which is exactly that
kind of non-isolated review artifact and was never usable as source.

### Light/dark identification

Neither file was labelled, so the assignment was derived from the ink-letter color against
`DESIGN.md`'s own tokens rather than guessed:

| File | Ink-letter color | Matches | Assignment |
|---|---|---|---|
| `Logo 1.svg` | `#282828 → #0D0D0D` gradient (near-black) | `text-primary` (`#18181B`) — the light-mode ink token | **Light-mode mark** |
| `Logo 2.svg` | `white → #E6E6E6` gradient (near-white) | `text-primary-dark` (`#EDEDED`) — the dark-mode ink token | **Dark-mode mark** |

Confirmed by the developer. Staged as `umbra-web/public/logo-light.svg` and
`umbra-web/public/logo-dark.svg` respectively — **staged, not committed**, same standing rule as
§4's `og-image.png`.

### Shadow color — a named deviation from the flat token spec, not silently corrected

Both files render the "shadow" shape as a two-stop linear gradient (`#FF6E30 → #FF5E1A`) —
**identical in both files**, rather than each mode using its own flat `accent-signature`
(`#FF5E1A`, light) / `accent-signature-dark` (`#FF6E30`, dark) fill the way every other UI element
in `DESIGN.md`'s token table does. Flagged to the developer rather than assumed correct or quietly
flattened. **Developer decided (2026-09-26):** keep the mark as originally drawn — it was clearly
hand-built (custom drop-shadow and inner-shadow SVG filters, not a default export), so the gradient
reads as a deliberate richness choice from when the mark was made, not a leftover default. Recorded
honestly rather than mis-described: **the shadow uses a gradient built from the two accent-signature
values, not a flat single-token fill.** This is the same kind of named, accepted exception
`DESIGN.md` already documents for the Base64 tool icon — a one-off departure from the flat-token
norm, kept because it has a reason, not silently normalized away.

Contrast math doesn't bind this decision either way: `accent-signature`'s split into a light and a
dark value exists mainly for *text*-contrast reasons (orange-as-text needs a different value than
orange-as-fill), and the shadow is a decorative shape, not text — WCAG's contrast minimums don't
apply to it the way they apply to, say, a button label.

### Small-size legibility check

Step 5.5's own brief flagged this as worth checking before Step 5.6 commits to it: "a mark with a
hard-edged shadow layer can lose legibility at 16×16 favicon size." Verified directly — both SVGs
rendered via headless Chrome at 16px, 24px, 32px, and 48px against their intended background
(`logo-light.svg` on white, `logo-dark.svg` on a dark surface), then the 16px result zoomed 10× with
`image-rendering: pixelated` for a true pixel-level look rather than judging from an
auto-smoothed thumbnail.

**Finding:** at 32px and up, both files render crisply — the U reads clearly and the orange shadow
stays a distinct, legible offset shape. At 16px, the U letterform itself stays fully legible in both
modes, but the shadow's *identity as a shadow* doesn't survive — the hard offset edge softens into a
blurry orange fringe along the lower-right of the strokes. It reads as a smudge rather than the
deliberate cast-shadow concept the mark is built on.

**Developer decided (2026-09-26):** keep the same full two-layer mark at every size, including
16×16, and accept the softened shadow there as a minor trade-off — no simplified single-layer
fallback variant. This means Step 5.6 exports the favicon matrix straight from `logo-light.svg` (per
5.6's own note, the light file is the one used for `apple-touch-icon`/manifest slots that can't
per-mode-swap) with no extra simplified-icon asset to produce.

### Placement decisions

- **Header/nav.** Today's plain-text `.brand` link (`Layout.astro`, "Umbra", no mark at all) becomes
  a **mark + wordmark lockup** — the U icon placed to the left of the existing "Umbra" text. Matches
  the convention Step 1.2's reference scan already found at Raycast, Linear, Warp, and Zed, so the
  nav now visually matches the same register the copy and layout already aim for. Exact icon size and
  spacing is a Step 6.2 implementation detail (align optically with the existing `1.1rem` brand-text
  size), not re-decided here.
- **Footer.** The current footer (`Layout.astro`) is plain legal/trust prose with no brand element at
  all. Adds a **small mark** next to the copyright/attribution line specifically — not scattered
  across the legal paragraphs — so it reads as a quiet, one-time brand signature at the point a
  visitor's eye naturally lands last, without competing with the disclosure text that's the footer's
  actual job. Sized like a favicon (roughly 16–20px), light/dark file matching the page's active mode.
- **Favicon / browser tab.** Confirmed: the mark is the favicon content (obviously — no wordmark fits
  at that size). Per the legibility finding above, both light and dark files carry the full two-layer
  treatment at every exported size; Step 5.6 owns the actual `.ico`/`.png`/manifest export matrix.
- **OG share card (Step 5.4).** `landing-design.md` §4 already recorded this as deliberately excluded
  ("Step 5.5 hasn't run and the developer hasn't supplied the two SVGs yet"). That's now unblocked —
  the card is eligible for a mark-bearing revision — but re-rendering the canvas wasn't done in this
  session; it stays flagged for whoever next touches §4 or runs Step 6.7.
- **Loading or empty state.** Checked: `umbra-web` has no dedicated loading/empty UI that would carry
  a mark. The one asynchronous state on the site — the Download page's live per-platform
  availability check — already has text-only loading/failure/no-JS microcopy drafted at
  `landing-copy.md` §5; no branded spinner or mark-bearing state exists to place this in. Recorded as
  genuinely not-applicable, not skipped.
- **GitHub org avatar / social account.** Flagged, not decided — Step 9.2 (distribution) hasn't run.
  If that step ever creates a GitHub org avatar or a social account, it inherits `logo-light.svg` (or
  a further-cropped variant, since most avatar surfaces are circular and this mark isn't drawn with a
  circular crop in mind) as its source. No action needed until 9.2 actually runs.

### What triggers a re-do — feeds Step 10.1's maintenance list

The mark is "adopted-for-now, not locked with the same permanence" as `DESIGN.md`'s other tokens
(`DESIGN.md`, Mark section). If the developer redraws or finalizes the mark later, every placement
decided in this section needs revisiting, not just the two source files:

- `umbra-web/public/logo-light.svg` / `logo-dark.svg` (this step's assets)
- The nav lockup and footer mark wired at Step 6.2
- The favicon/icon matrix Step 5.6 exports from these files
- The OG card's mark-bearing revision (still open, see above)
- A GitHub org avatar or social-account icon, if Step 9.2 ever creates one

### Asset

`umbra-web/public/logo-light.svg`, `umbra-web/public/logo-dark.svg` — staged, not committed (a
separate authorization this session didn't ask for, per this project's standing rule). Wiring them
into `Layout.astro`'s nav and footer markup is Step 6.2's job, per the roadmap's existing split
between producing design output and wiring it into the build.

### Feeds directly into

- **Step 5.6** — exports the favicon/icon asset matrix from `logo-light.svg`/`logo-dark.svg`, no
  simplified small-size variant needed per the decision above.
- **Step 5.7** — dark-mode swap is already handled by having two separate files rather than one
  token-driven SVG; 5.7 just needs to confirm `Layout.astro` picks the right file per
  `prefers-color-scheme`, including for the favicon (OS chrome doesn't always respect that media
  query for favicons — same open question 5.7's own roadmap entry already names).
- **Step 6.2** — wires the nav lockup, footer mark, and favicon links into `Layout.astro`.
- **Step 6.7** — if the OG card gets its mark-bearing revision, this is where it'd get wired into
  `<head>` alongside the rest of that step's meta work.

---

## §6 — Dark mode (Step 5.7)

**Status: done 2026-09-26.** Confirms the roadmap's own framing — "near-free... a token swap, not a
new design pass" — held under actual verification, and closes the specific favicon-legibility check
5.7's own roadmap entry named. No new Design-canvas mockup was built: §1 introduced zero new colors
(type scale, spacing, and breakpoints only), so there is no new palette to hand a canvas anyway; the
work here is auditing every color §2's mockup used against `DESIGN.md`'s existing dark tokens, plus
live verification of the one asset (the favicon) where "the swap holds" is a real technical question,
not a given.

### Token swap: zero new colors, everything traces to an already-verified `DESIGN.md` pair

| Role (as used in §2's mockup) | Light token | Dark token | Contrast |
|---|---|---|---|
| Page background (hero/feature-tour/proof/closing-CTA bands) | `bg-base` (`#F4F5F6`) | `bg-base-dark` (`#141415`) | n/a — background, not text-bearing |
| Section band (workflow/why-umbra bands + their hairline borders) | `bg-surface` (`#FFFFFF`) | `bg-surface-dark` (`#1D1D1F`) | Same two-tier elevation pair `DESIGN.md` already uses for cards |
| Body/heading text | `text-primary` (`#18181B`) | `text-primary-dark` (`#EDEDED`) | Pre-verified in `DESIGN.md`'s own type-color rules |
| Secondary/caption text | `text-secondary` / `text-tertiary` | `-dark` equivalents | Pre-verified, ≥4.5:1 in both modes per `DESIGN.md` |
| Card/tile border | `border-hairline` (7% black) | `border-hairline-dark` (7% white) | Deliberately low-contrast decorative grouping, same accepted call in both modes |
| Signature orange (search-match outline, "one tile" in the bento grid, mark's shadow) | `accent-signature` (`#FF5E1A`) | `accent-signature-dark` (`#FF6E30`) | Text use: `accent-signature-on-text` (`#B64A07`) in light mode only — dark mode's `accent-signature-dark` already clears AA as text, no separate on-text token needed |

**Two accepted AA trade-offs carry forward unchanged, not re-litigated here:** white text on an
orange fill (3.06:1 light / 2.79:1 dark) and white text on a red fill in dark mode specifically
(3.07:1) both fail WCAG AA and are named, developer-approved exceptions in `DESIGN.md` itself
("visual-preference grounds... don't 'fix' any of these again without that conversation"). Neither
color appears as a fill-with-white-text combination anywhere in §2's home-page mockup, so this step
doesn't newly invoke either trade-off — flagged only so Step 6.2 knows not to "discover" and
re-relitigate them while wiring the CSS.

### Section elevation (the alternating-background call from §2) holds unchanged in dark mode

§2 flagged the `bg-base`/`bg-surface` alternating-band pattern as its own new call, not yet
developer-confirmed. It survives dark mode without adjustment: `DESIGN.md`'s own elevation rule —
"build dark-mode elevation by layering *lighter* surfaces upward... never by going darker toward
black" — is exactly `bg-base-dark` (`#141415`) → `bg-surface-dark` (`#1D1D1F`), the same two tokens
the light-mode bands already use, just their dark pair. No new elevation decision was needed; this
is the "near-free" claim actually paying off.

### A concrete finding the roadmap step didn't anticipate: the bento grid's tiles must swap by *role*, not by literal color

§2's feature-tour bento grid uses a deliberate three-tone discipline — one white tile group, one
solid **black** typographic tile, one orange tile — the "budget of one" rule applied at section
scale. Naively "keeping the black tile black" in dark mode would be wrong: a `#18181B` tile on a
`#141415` page background has almost no separating contrast, and the tile's whole job is to read as
the bold, graphic outlier in the grid. The fix is that the tile was never really "black" — it's
`accent-default` (`#18181B` light / `#EDEDED` dark, with `accent-default-on` / `accent-default-on-dark`
carrying its typography), the same semantic **Default** role `DESIGN.md` already uses for buttons.
Read correctly, the tile **inverts to near-white in dark mode** and keeps its outlier role rather than
staying literally black and vanishing. Concretely, for Step 6.2/6.3: build the bento tiles from
`bg-surface`/`accent-default`/`accent-signature` (the semantic roles), never from hardcoded `#fff`/
`#000`/`#FF5E1A` — the difference only shows up once dark mode is wired in, so it's easy to get wrong
silently if the mockup's literal colors get copied instead of its token names.

### Mark & favicon dark-mode legibility — re-confirmed, with one new live check

Step 5.5 already pixel-verified both `logo-light.svg`/`logo-dark.svg` at 16/24/32/48px and Step 5.6
already confirmed `favicon.svg`'s combined `.u-light`/`.u-dark` groups both render correctly (forcing
each branch independently, since this machine's own dark-mode setting made the unmodified file
default to exercising the dark branch). This step adds one more check that entry's own wording called
for — "the swap holds ... since OS chrome doesn't always respect `prefers-color-scheme` for
favicons" — verified rather than assumed:

- **Live-checked in this session:** with the system in its real, current Dark appearance (confirmed
  via `defaults read -g AppleInterfaceStyle` → `Dark`), navigating a real Chrome tab directly to
  `favicon.svg` renders the `.u-dark` group (the near-white/`#E6E6E6` letterform) — Chrome correctly
  evaluates the embedded media query against the real OS preference, not just in a forced/headless
  render.
- **Researched live (dated 2026-09, not recalled from training data, since this is exactly the kind of
  fast-moving browser-support fact this project's own rules distrust from memory):** Chrome/Edge/
  Chromium and Firefox both respect a `prefers-color-scheme` media query embedded in an SVG favicon.
  The real caveat is timing, not support: **no browser re-paints an already-loaded tab's favicon when
  the OS theme changes underneath it** — the new branch is only picked up on the next navigation/
  reload. **Safari is the one genuine gap:** it renders SVG favicons but does not evaluate media
  queries *specifically in the favicon-rendering path* — it always shows the file's default branch
  (here, `.u-light`, since that's the un-media-queried default) regardless of system theme. This is
  narrower than it sounds: the same source confirms Safari *does* apply the media query correctly to
  an SVG used as ordinary page content (an `<img>` or inline `<svg>`), so this is a favicon-slot-only
  limitation — it does not affect the nav/footer mark placements below, only the browser-tab icon.
- **Not done, and why:** confirming this by physically toggling this machine's system Appearance and
  watching the tab icon change was the obvious next check, but toggling a system-level setting is
  outside what these tools are allowed to do on your behalf (computer-use was also occupied by
  another session at the time). **Recommended as a 10-second manual pre-launch check, not blocking:**
  toggle System Settings → Appearance once with `favicon.svg` open in a tab, reload, and confirm the
  mark visibly changes shade — matching the live-in-Chrome confirmation above, just closing the loop
  on the literal tab-strip pixel rather than the raw SVG document.
- **Decided:** accept Safari's favicon limitation as a known, unfixed trade-off, the same posture
  already taken for the 16px shadow-smudge finding at Step 5.5 — Safari users simply always see the
  light-mode mark in their tab strip. A per-browser workaround exists (omit the SVG `<link>` for
  Safari specifically and let it fall back to a static PNG picked per-mode server-side) but adds real
  complexity for a cosmetic, non-blocking gap; **flagged for the developer to confirm rather than
  silently built**, not implemented here.

### Nav/footer mark mechanism — a correction to §5's own plan, for Step 6.2

§5's "Feeds directly into" note assumed the nav/footer placements would swap via "having two separate
files" (`logo-light.svg` / `logo-dark.svg`), left unresolved for Step 6.2 to wire up. Step 5.6, run
after that note was written, built something better for the favicon specifically: one combined SVG
with internal `.u-light`/`.u-dark` groups and its own embedded media query — already tested, already
correct. **Recommendation, not a re-decision of placement (§5 already owns that):** Step 6.2 should
reuse this same combined file (`favicon.svg`, or a copy under a more page-appropriate name) for the
nav and footer marks too, via an inline `<svg>` or `<img src="/favicon.svg">` — confirmed live-checkable
via the CSS Working Group's own resolution that `prefers-color-scheme` inside an `<img>`-embedded SVG
should be (and, per Chromium/Firefox implementation, is) context-dependent on the containing page, not
context-free the way a favicon is. This avoids maintaining two separate files with two separate
`<img>`/CSS-toggle pairs for what's otherwise the exact same asset problem already solved once.

### Product screenshots (Step 5.3) already exist as light/dark pairs — swap mechanism stays open

The 18 tool-page screenshots (9 tools × light/dark, `umbra-web/public/images/tools/`) and the two
per-locale Workflow video considerations already have both variants captured — nothing new needed
from this step. Which HTML mechanism swaps them (a `<picture>` element with a `prefers-color-scheme`
`media` feature per source, versus two absolutely-positioned `<img>`s toggled by CSS the way the
bento tiles are) is a Step 6.3 implementation choice, not decided here — flagged only so it isn't
mistaken for an open design question.

### App vs. site: a deliberate difference in mechanism, not a missed inheritance

`Umbra`'s own app deliberately avoids `@media (prefers-color-scheme)` in its token CSS
(`src/styles/tokens.css`'s own comment: tokens live only under `[data-theme]` blocks) in favor of a
`[data-theme]` attribute driven by JS (`src/shell/theme.ts`), specifically because Settings offers a
manual light/dark **override** on top of the system default — the media query alone can't express
"user chose dark regardless of OS." The roadmap's own instruction for this step ("this is
`prefers-color-scheme` plus token swaps") is the right, simpler mechanism for the site precisely
because the site has no Settings surface and no persisted-per-visitor override to express — there's
nothing lost by using the plain CSS media query here that the app's extra `[data-theme]` layer exists
to provide. Recorded so this isn't later flagged as an inconsistency between the two codebases; it's
a considered difference, not a gap.

### Not decided here, deliberately

- **Safari's favicon-only light-mode gap** — flagged above for developer sign-off, not silently
  fixed or silently accepted.
- **The literal manual toggle-and-reload check** on this machine — recommended above as a fast
  pre-launch task, not performed here (system-settings changes are outside this session's reach).
- **`<picture>` vs. CSS-toggle for the per-mode product screenshots** — Step 6.3's call.

### Feeds directly into

- **Step 6.2** — implements every token pair above as real `prefers-color-scheme`-gated CSS custom
  properties in `Layout.astro`, builds the bento tiles from semantic role tokens (not literal colors),
  and wires the nav/footer mark from the combined SVG per the recommendation above.
- **Step 6.3** — picks the per-mode mechanism for the tool-page screenshots and the Workflow video.
