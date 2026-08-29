---
name: Umbra
description: Local-first desktop utility suite (Tauri + Vue). Precision-instrument register — a professional, sharp, modern tool with one restrained orange accent, not a playful indie app.
status: final
updated: 2026-08-16
colors:
  bg-base: '#F4F5F6'
  bg-base-dark: '#141415'
  bg-surface: '#FFFFFF'
  bg-surface-dark: '#1D1D1F'
  bg-surface-raised: '#FFFFFF'
  bg-surface-raised-dark: '#28282B'
  border-hairline: 'rgba(16,17,19,0.07)'
  border-hairline-dark: 'rgba(255,255,255,0.07)'
  text-primary: '#18181B'
  text-primary-dark: '#EDEDED'
  text-secondary: '#5B5F66'
  text-secondary-dark: '#9A9DA3'
  text-tertiary: '#606266'
  text-tertiary-dark: '#A6A8AB'
  accent-signature: '#FF5E1A'
  accent-signature-on-text: '#B64A07'
  accent-signature-dark: '#FF6E30'
  accent-signature-tint: 'rgba(255,94,26,0.12)'
  accent-signature-tint-dark: 'rgba(255,110,48,0.16)'
  accent-default: '#18181B'
  accent-default-on: '#FFFFFF'
  accent-default-dark: '#EDEDED'
  accent-default-on-dark: '#141415'
  accent-destructive: '#CF3130'
  accent-destructive-dark: '#F2665C'
  accent-neutral-chip: '#E4E5E7'
  accent-neutral-chip-dark: '#2C2C2F'
  # Story 8.1, 2026-08-26 — the system's first third hue, scoped narrowly to
  # the JSON tool's Diff tab row states (added rows, a changed row's new
  # value). See Do's and Don'ts for the deliberate-exception writeup. Not a
  # general "success" color — do not reuse elsewhere without that same
  # conversation.
  diff-added: '#15803D'
  diff-added-dark: '#34D399'
typography:
  display:
    fontFamily: Geist Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  heading:
    fontFamily: Geist Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.3'
  body:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: Geist Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.4'
  caption:
    fontFamily: Geist Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  code:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 2px
  DEFAULT: 4px
  lg: 8px
  full: 9999px
spacing:
  unit: 4px
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  gutter: 16px
  sidebar-padding: 16px
components:
  button-primary:
    background: '{colors.accent-signature}'
    background-dark: '{colors.accent-signature-dark}'
    text: '#FFFFFF'
    radius: '{rounded.DEFAULT}'
  button-default:
    background: '{colors.accent-default}'
    background-dark: '{colors.accent-default-dark}'
    text: '{colors.accent-default-on}'
    text-dark: '{colors.accent-default-on-dark}'
    radius: '{rounded.DEFAULT}'
  button-destructive:
    background: '{colors.accent-destructive}'
    background-dark: '{colors.accent-destructive-dark}'
    text: '#FFFFFF'
    radius: '{rounded.DEFAULT}'
  card:
    background: '{colors.bg-surface}'
    background-dark: '{colors.bg-surface-dark}'
    border: '1px solid {colors.border-hairline}'
    border-dark: '1px solid {colors.border-hairline-dark}'
    radius: '{rounded.DEFAULT}'
    padding: '{spacing.5}'
    shadow: none
  floating-surface:
    background: '{colors.bg-surface-raised}'
    background-dark: '{colors.bg-surface-raised-dark}'
    radius: '{rounded.lg}'
    shadow: '0 1px 2px rgba(16,17,19,.05), 0 3px 8px rgba(16,17,19,.04)'
    shadow-dark: '0 0 0 1px rgba(255,255,255,.05), 0 1px 0 rgba(255,255,255,.04) inset, 0 8px 20px rgba(0,0,0,.45)'
---

## Brand & Style

Umbra is a **precision instrument, not an indie utility.** The register is professional, sharp, and modern — closer to a well-made tool than a friendly app. Early exploration tested a warmer, "friendly little utility" direction and it was deliberately moved away from in favor of this one.

The reference point named directly by the developer: the iPhone 17 Pro's orange finish, and the single red shutter-button dot on a Leica camera. Both use a saturated accent color as a restrained, singular precision touch on an otherwise neutral, industrial-professional body — never as a dominant or decorative color. Umbra's orange works the same way: it marks *the one important thing* in a given area, never a wash, never a background, never used for its own sake.

This visual restraint mirrors the product's actual pitch — Umbra is local-first and privacy-first ("your data never leaves your machine"), and the Settings pane leads with Privacy over General for the same reason (round-table decision, `step-1-1-roundtable-notes.md`). A system that overclaims visually (loud colors, decorative flourishes) would undercut a product whose whole credibility rests on restraint and precision.

**Mark (Step 3.3, adopted-for-now — not locked with the same permanence as the tokens below).** "Ink
letter, accent shadow": a monogram **U**, set in `{colors.text-primary}` (light) / `{colors.text-primary-dark}`
(dark), with a solid `{colors.accent-signature}` / `{colors.accent-signature-dark}` shape cast beneath and
behind it like a hard-edged shadow — literally an umbra cast by the letter. This resolves the concept brief
toward the "minimal shadow-cast" direction, built from the brand's own initial rather than an abstract
shape — orange stays a single accent (the shadow), never competing with the ink letter for attention, same
"budget of one" rule as everywhere else in this system. Geometric, hard-edged letterform, no soft curves —
consistent with the 4px-radius "sharp over soft" instinct applied elsewhere. See
[`mockups/step3.3-logo-ink-letter-accent-shadow.png`](mockups/step3.3-logo-ink-letter-accent-shadow.png)
(light + dark). Developer's own framing: good enough to adopt now, expected to be revisited later — treat
as the working mark, not a final, unquestionable lock the way the color/type/shape tokens below are.

## Colors

Umbra uses a **four-tier semantic system** — a palette that says not just what colors exist, but when *not* to reach for one.

- **Signature — Orange (`{colors.accent-signature}` fills/marks light, `{colors.accent-signature-on-text}` for text-on-light, `{colors.accent-signature-dark}` dark).** The sparse, precision accent. Used for exactly two roles: (1) marking the single "main thing" in an area — the active/selected nav item, the one primary action per screen — and (2) drawing attention to something that needs it — a notification dot, a "New" tag. Never used as a large fill, a background wash, or decoratively. `{colors.accent-signature}` fails WCAG AA 4.5:1 as small text on a light background — always use `{colors.accent-signature-on-text}` (4.84:1 on `{colors.bg-base}`, 5.29:1 on `{colors.bg-surface}`) for orange text, reserve the brighter value for fills, dots, and marks only. In dark mode, `{colors.accent-signature-dark}` itself already clears AA as text (6.60:1 on `{colors.bg-base-dark}`, 6.03:1 on `{colors.bg-surface-dark}`) — no separate on-text variant is needed there. **Known, accepted trade-off — white text on orange fills (the primary button, an orange tag) fails WCAG AA** (verified: 3.06:1 light / 2.79:1 dark against the 4.5:1 requirement; light mode does clear the relaxed 3:1 large-text/UI-component floor, dark mode does not, at 2.79:1). A near-black label (`{colors.text-primary}`) would fix this cleanly (5.79:1 / 6.35:1, tested and confirmed), but was tried and explicitly rejected in favor of white on visual-preference grounds. This is a deliberate developer call, not an oversight — documented here so it isn't silently "fixed" again later without the same conversation. See [`mockups/accessibility-fixes-before-after.html`](mockups/accessibility-fixes-before-after.html) for the before/after comparison (button-primary text, button-destructive dark text, `accent-signature-on-text`, `text-tertiary`/`-dark`) used to make this exact call.
- **Default — Black (`{colors.accent-default}` light, `{colors.accent-default-dark}` dark).** The workhorse. Most buttons, icon buttons, tabs, toggles, and structural interactive elements use this, not orange — reserving orange's visual weight for the signature role above. Named directly against ChatGPT's black-button convention.
- **Destructive — Red (`{colors.accent-destructive}` light, `{colors.accent-destructive-dark}` dark).** Deliberately *less* saturated than the signature orange (62% vs. 100% saturation in light mode, ~14-18° apart in hue) — red should read as serious and controlled, not compete with orange's "look here" role. Verified WCAG AA: 4.65:1 as text on `{colors.bg-base}`, 5.99:1 on `{colors.bg-base-dark}` (red text directly on the page). For a red *fill* carrying white text (the destructive button): light mode's white-on-fill clears AA at 5.08:1, but **dark mode's white-on-fill fails at 3.07:1**. A near-black label (`{colors.accent-default-on-dark}`, 5.99:1) was tested and passes cleanly, but — same call as the orange fills above — white was kept anyway on visual-preference grounds. **Known, accepted trade-off**, not an oversight. Reserved *specifically* for high-consequence, hard-to-reverse actions — the worked example is Settings' "Clear stored data" action (INV-3). It is explicitly **not** applied to every delete-shaped affordance: removing a file from a PDF-merge queue before merging is low-stakes and trivially reversible, and uses the Default (black) treatment instead. The test for red is "would a user be upset if this happened by accident and couldn't be undone," not "does this icon look like a delete icon."
- **Neutral — Gray (`{colors.text-tertiary}` / `{colors.accent-neutral-chip}`).** Unaccented structural elements that carry no semantic weight — drag handles, dividers. `{colors.text-tertiary}` is licensed for real text use (e.g. a count badge's numeral), not restricted to decorative marks — it clears 4.5:1 against every surface in both modes. Content on `{colors.accent-neutral-chip}` uses `{colors.text-secondary}` (5.09:1 light / 5.12:1 dark). A deliberate fifth non-color: most of the interface should read as neutral, so that orange, black-as-CTA, and red each still mean something when they appear.

A second chromatic accent (a muted slate-blue) was tested during exploration and not adopted — Umbra stays a two-hue system (orange + a true neutral achromatic scale), not a multi-color brand palette.

Palette exploration: [`mockups/color-themes-1.html`](mockups/color-themes-1.html) (5 initial directions) → [`mockups/color-themes-2.html`](mockups/color-themes-2.html) (Clean Factory refined, selected).

## Typography

**Geist Sans** (UI text) + **Geist Mono** (code, JSON/JWT output, and any structured data Umbra's tools produce) — both released by Vercel under the SIL Open Font License 1.1, free for commercial use and embeddable in paid software with no royalties or in-app attribution requirement.

Chosen directly against Inter/JetBrains Mono, Inter/IBM Plex Mono, DM Sans/DM Mono, and Space Grotesk/Space Mono ([`mockups/typography-1.html`](mockups/typography-1.html)) — Geist's quieter, lower-contrast grotesque and its mono's slashed zero (keeping `0`/`O` distinct in dense JSON) fit the precision-instrument register better than the alternatives' extra warmth or extra personality.

The `{typography.code}` role is not decorative — Umbra's core tools (JSON Formatter, JWT Inspector, Base64) render structured text output constantly, so the mono face needs to hold up at small size with easily-confused characters (`0`/`O`, `1`/`l`/`I`), which drove the Geist Mono pick over more characterful options like Space Mono. **[ASSUMPTION: the exact size/weight ramp above (`display`/`heading`/`body`/`label`/`caption`/`code`) was synthesized from what read correctly across every render this session, not independently tested as a scale — flagged for review.]**

## Layout & Spacing

**[ASSUMPTION: this whole section was drafted from a standard 4px-base scale, not independently tested — flagged for review.]** `{spacing.unit}` (4px) is the base; every spacing value in the system is a multiple of it. Card internal padding (`{spacing.5}`, 20px) is the one value that was actually exercised across every render this session and never drew a complaint — it anchors the rest of the scale. Grid gutter between tool-grid cards and sidebar section padding are both set to `{spacing.4}` (16px) as a reasonable default consistent with the same 4px system, pending a real screen mock to confirm they read correctly at that density.

## Elevation & Depth

Two tiers, split by a rule rather than a single global technique:

- **Persistent surfaces (cards, sidebar) use a border, never a shadow.** This was tested directly: a shadow-based card looked good in isolation but is conventionally reserved for *floating* UI in this app's reference class (Raycast, Linear — named in the round-table as Umbra's reference class) — Linear's own default depth language for static cards is a hairline border, with shadows kept for popovers/modals/toasts. The practical reason matters more here than the convention alone: **shadows don't read well on a dark background**, and Umbra's dark mode is a co-designed requirement, not an afterthought — a shadow-based card system would need an inconsistent, separately-invented treatment in dark mode. `{components.card.border}` at 7% opacity (`{colors.border-hairline}`) was the tested, settled value — chosen directly against 4%, 6%, 8%, 10%, and 12% alternatives, low enough to separate a card from the page without reading as a heavy stroke. **Trade-off worth naming explicitly:** at 7% opacity this border measures roughly 1.2:1 contrast against its surface — well below any WCAG UI-component threshold. This is not a WCAG violation (a card boundary here is decorative grouping, not a required state indicator like a focus ring), but it means the border is close to imperceptible for low-vision users. This was a deliberate, directly-tested aesthetic choice (four rounds of comparison — [`mockups/shapes-elevation-1.html`](mockups/shapes-elevation-1.html), [`-2.html`](mockups/shapes-elevation-2.html), [`-3.html`](mockups/shapes-elevation-3.html)), not an oversight — flagged here for visibility, not overridden.
- **Floating surfaces (modals, popovers, dropdowns, tooltips) use a shadow.** This is the flip side of the same rule, not a new decision — genuinely temporary/overlaid UI is exactly where a shadow is the conventional signal, and it doesn't have the dark-mode readability problem the same way since floating surfaces typically sit above a scrim. **[ASSUMPTION: `{components.floating-surface.shadow}` / `{components.floating-surface.shadow-dark}` reuse the exact values tested on cards in an earlier, since-rejected round — they were visually validated then, but never independently tested on an actual modal/popover mock. The dark-mode value uses a light rim-glow instead of a drop-shadow, since a dark blur is invisible against a dark page — flagged for review once a real overlay surface is mocked.]**

## Shapes

`{rounded.DEFAULT}` (4px) is the settled corner radius for cards — tested directly against 8px and 12px, both rejected as reading "less professional/sharp/industrial" than 4px. **[ASSUMPTION: `{rounded.sm}` (2px) and `{rounded.lg}` (8px) are extensions of the same 4px logic for smaller/larger components, not independently tested. `{rounded.full}` (9999px) is a standard pill radius for toggles/tags, also untested — flagged for review as more components get designed.]** No component in this system should introduce a radius outside this scale.

## Components

Visual specs for the elements already exercised through this session's renders ([`mockups/key-button-usage-1.html`](mockups/key-button-usage-1.html)), reusing tokens above:

- **Button — Primary/Signature.** `{components.button-primary}`. Orange fill, white text — a known AA trade-off (see Colors), accepted deliberately over the near-black alternative. One per screen, at most — this is the "main CTA," e.g. "Merge PDFs."
- **Button — Default.** `{components.button-default}`. Black fill (near-white in dark mode) — the workhorse for most buttons: settings, secondary actions like "Clear all," icon buttons, drop-zone accents, link-style text actions.
- **Button — Destructive.** `{components.button-destructive}`. Red fill, white text in both modes — dark mode is a known accepted AA trade-off (see Colors), same visual-preference call as the primary button. Reserved per the Colors section's rule — not a default for delete-shaped icons.
- **Card.** `{components.card}`. See Elevation & Depth. Internal layout resolved at Step 4.3's screen mock: icon-badge (small `{rounded.sm}` tag, a real Phosphor SVG icon) top-left, bold title below it, description text below the title — stacked, left-aligned, inside the standard card padding. See [`mockups/step4.3-mockups-light.png`](mockups/step4.3-mockups-light.png) / [`-dark.png`](mockups/step4.3-mockups-dark.png), Screen 01 (Nav shell / Grid-home). *(Amended 2026-08-16, Story 7.1 — the icon-badge originally shipped as monospace-shorthand text (`{}`, `64`, `#`, `JWT`), matching the registry's pre-Story-7.1 `icon` field values. Story 7.1 built a real Phosphor icon system (`@phosphor-icons/vue`) and repurposed the registry's `icon` field to icon-name keys resolved through it, per epics.md's own AC5 — a deliberate, developer-confirmed decision to follow AC5 literally rather than let this section's original text stand uncorrected. The `IconName → Component` resolver (`src/shell/icons.ts`) and the registry's icon-name keys exist as of Story 7.1; no Card component exists yet — Story 7.3 is what actually builds the Card and renders one of these Phosphor SVGs in the top-left `{rounded.sm}` icon-badge slot this section describes. Nothing else about the Card layout has changed.)* *(Amended 2026-08-30, Story 8.2 code-review follow-up — **Base64 is one deliberate exception to the Phosphor set**: it renders the typographic `64` badge from the original mockups above, as an inline SVG (`src/shell/Base64GlyphIcon.vue`) resolved through `icons.ts` exactly like the pictogram entries. Rationale: `PhBinary` — the Story-7.1 migration's pick for the old `64` — reads as base-2, a different encoding; the literal `64` says *which* encoding in a way no pictogram in the set does. Known, accepted trade-off: it is the only non-pictogram mark in the sidebar/grid; the developer chose the added clarity over set uniformity for this tool. Do not extend the text-badge treatment to other tools without the same conversation — the rest of the set stays Phosphor.)*
- **Update-signal.** Resolved at Step 4.3, **simplified from the originally-planned 3-tier escalation to 2 states** (see `EXPERIENCE.md` State Patterns for the full behavioral rationale): routine — `{colors.accent-signature}` dot (orange), accessible name "Update available"; security-urgent — `{colors.accent-destructive}` dot (red), accessible name "Security update available". Anchored on the Settings sidebar item (resolves the "exact anchor TBD" note from `EXPERIENCE.md`). Pure mark, no text, same Notification Dot component as elsewhere — the urgent state is a second color variant of it, not a new component. See mockups above, Screen 01.
- **Clipboard-suggestion highlight.** Resolved at Step 4.3: a bordered/tinted callout pinned above the sidebar's tool list, labeled "Clipboard match," showing the matched tool's icon, name, and a truncated content preview. Distinct from a normal nav item without being a popup/interrupt. See mockups above, Screen 01.
- **Floating surface.** `{components.floating-surface}`. Modals, popovers, dropdowns, tooltips — see Elevation & Depth for the border-vs-shadow rule this exists to serve.
- **Nav item (active state).** Background tint `{colors.accent-signature-tint}` (light) / `{colors.accent-signature-tint-dark}` (dark) — low-opacity, decorative only; the label's real contrast is computed against the surface beneath it (`{colors.bg-surface}`), not the tint. Label text uses `{colors.accent-signature-on-text}`.
- **Tag/Badge — attention ("New").** `{colors.accent-signature}` fill, white text — same accepted AA trade-off as the primary button. **Tag/Badge — neutral (count, e.g. "7 tools").** `{colors.accent-neutral-chip}` fill, `{colors.text-secondary}` text.
- **Notification dot.** `{colors.accent-signature}`, per the "draws attention" role. No text — a pure mark, so no contrast pairing applies.
- **Toggle.** Off state: neutral gray track. On state: `{colors.accent-default}` fill (default/black treatment, consistent with "most things are black, orange is reserved"). **Tab (active state).** `{colors.accent-default}` underline or pill; inactive tabs use `{colors.text-secondary}`.

## Do's and Don'ts

- **Do** treat orange as a budget of one: the single active/selected item and the single primary action per screen. If you're reaching for orange a second time on the same screen, that's a signal to use black instead.
- **Do** use `{colors.accent-signature-on-text}`, never `{colors.accent-signature}`, for any orange text — the brighter value fails WCAG AA as text.
- **Accepted trade-off, not a bug:** white text is used on the primary button, the "New" tag (both orange), and the destructive button in dark mode (red) — all fail WCAG AA (3.06:1 / 2.79:1 / 3.07:1 respectively). A near-black alternative was tested for each, passed AA cleanly in every case, and was rejected in favor of white on visual-preference grounds. Don't "fix" any of these again without that conversation.
- **Do** use a border (`{colors.border-hairline}`) for persistent surfaces and a shadow (`{components.floating-surface.shadow}`) for floating ones — never the reverse, and never both on the same element.
- **Do** build dark-mode elevation by layering *lighter* surfaces upward (`{colors.bg-base-dark}` → `{colors.bg-surface-dark}` → `{colors.bg-surface-raised-dark}`) — never by going darker toward black for "elevated" content.
- **Don't** use red for a delete/remove affordance by default — it's reserved for actions that are both high-consequence and hard to reverse. **One narrow, deliberate exception** (Step 4.3): the Update-signal's security-urgent dot also uses `{colors.accent-destructive}` — not because installing is destructive, but to reuse red's existing "needs serious attention" weight rather than inventing a third hue, matching the Chrome/Firefox security-vs-feature-update color precedent already named in Inspiration & Anti-patterns. Don't extend red to any other non-destructive "pay attention" use beyond this one.
- **Don't** introduce a second chromatic accent color. This was tested (a muted slate-blue) and explicitly not adopted — Umbra is a two-hue system (orange + true neutral), not a multi-color brand. **One narrow, deliberate exception** (Story 8.1, Diff tab, 2026-08-26): the JSON tool's Diff tab compares two documents and renders row-level added/removed/changed state. Three color schemes were mocked up side by side (value-only red, icon-only with no new color, full-row red+green) and the developer explicitly chose full-row color over the no-new-color default, because it reads instantly at a glance — the whole point of a diff view. This both extends `{colors.accent-destructive}` (red) beyond the Update-signal's own prior one exception (full removed *rows*, not just the value) and introduces the system's first third hue: a new muted green, `{colors.diff-added}` (`#15803d` light / `#34d399` dark — not a generic "success" token, scoped to this one feature), used for added rows and a changed row's new value. Icons (`+`/`-`/pencil) and strikethrough still carry the same signal independently of color, so the state doesn't rely on hue alone. **Scoped narrowly to Diff's row states** — don't reach for green, or extend red further, anywhere else in the app without a similarly deliberate, mocked-up, developer-approved conversation.
- **Don't** apply a drop-shadow to a persistent card. It was tested, looked fine in isolation, and was rejected specifically because it doesn't survive the dark-mode requirement.
