# Umbra — Step 4.3 Claude Design brief (key-screen mocks)

Paste this whole brief into a new Claude Design session (claude.ai/design). If Claude Design can read
the repo directly, point it at `DESIGN.md` and `EXPERIENCE.md` in
`_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/` first — the tokens below are a condensed
copy of those files, not a replacement. Everything in this brief traces back to those two spines; if a
question comes up that isn't answered here or in them, stop and ask rather than inventing an answer —
that's exactly the anti-pattern this process guards against.

## What this step is actually for

Three things are **explicitly deferred** in both spines, waiting on a real screen mock before they can be
written up as tokens/behavioral rules. Resolving these three is the actual goal of this session — the
screens are the vehicle:

1. **Card internal layout** (icon/title/description arrangement on a grid-home tile) — flagged in
   `DESIGN.md` Components and `EXPERIENCE.md` Component Patterns as a real, unresolved discomfort. The
   developer doesn't love the current card treatment but the root cause was never isolated — is it the
   icon size/placement, title/description hierarchy, or something else?
2. **Update-signal visual escalation** — a passive dot near the nav that must read as: quiet/day-1 (low
   attention) → escalating days 2-4 (rising visual weight) → a **distinct** security-urgent state. Same
   mark, three-plus visibly different weights, one categorically different urgent variant.
3. **Clipboard-suggestion surface highlight** — a sidebar entry that appears at the top of nav when
   clipboard content matches a tool. Needs a "this wasn't always here" visual treatment distinct from a
   normal nav item, without being a popup/interrupt (it must read as *appeared*, not *demanded attention*).

## Brand register (non-negotiable)

Umbra is a **precision instrument, not an indie utility** — professional, sharp, modern. Reference points
named directly by the developer: the iPhone 17 Pro's orange finish, and the single red shutter-button dot
on a Leica camera — a saturated accent used as a restrained, singular touch on an otherwise neutral body,
never a wash, never decorative. This mirrors the product pitch: Umbra is local-first/privacy-first ("your
data never leaves your machine"), so a visually loud UI would undercut the actual credibility claim.

**Orange is a budget of one per screen** — the single active/selected nav item, the single primary action.
If you're reaching for orange twice on one screen, that's wrong; use black instead.

## Tokens (condensed from DESIGN.md)

**Colors — light / dark:**
- bg-base `#F4F5F6` / `#141415` — bg-surface `#FFFFFF` / `#1D1D1F` — bg-surface-raised `#FFFFFF` / `#28282B`
- border-hairline `rgba(16,17,19,.07)` / `rgba(255,255,255,.07)` — hairline only, never a heavier stroke
- text-primary `#18181B` / `#EDEDED` — text-secondary `#5B5F66` / `#9A9DA3` — text-tertiary `#606266` / `#A6A8AB`
- accent-signature (fills/marks) `#FF5E1A` / `#FF6E30` — accent-signature-on-text (orange as text) `#B64A07` (light only; dark's `#FF6E30` already clears AA as text)
- accent-signature-tint (nav active-state bg) `rgba(255,94,26,.12)` / `rgba(255,110,48,.16)`
- accent-default (black, the workhorse) `#18181B` / `#EDEDED`, on-color `#FFFFFF` / `#141415`
- accent-destructive `#CF3130` / `#F2665C` — reserved for high-consequence + hard-to-reverse only (e.g.
  Settings "Clear stored data"), never a default for delete-shaped icons
- accent-neutral-chip `#E4E5E7` / `#2C2C2F` (count badges, drag handles — no semantic weight)
- **Accepted trade-off, don't "fix":** white text on the orange primary button, the orange "New" tag, and
  the dark-mode destructive button all fail WCAG AA contrast. Tested, a near-black alternative passed
  cleanly, developer rejected it on visual-preference grounds anyway. Keep white text on those three.

**Typography:** Geist Sans (UI) + Geist Mono (code/JSON/JWT output — its slashed zero matters here, Umbra's
tools render dense structured text constantly). Scale: display 28px/600, heading 18px/600, body 14px/400,
label 13px/500, caption 12px/400, code 13px/400.

**Shape/spacing:** 4px base unit. Card padding 20px (the one value tested repeatedly, anchors everything
else). Grid gutter / sidebar padding 16px. Corner radius 4px for cards (tested directly against 8/12px,
both rejected as "less professional/industrial"); 2px small, 8px large, full-pill for toggles/tags.

**Elevation rule:** persistent surfaces (cards, sidebar) = **border only, never a shadow** (hairline
7% opacity, deliberately close to imperceptible — a tested, accepted trade-off, not an oversight). Floating
surfaces (modals, popovers, the update-consent dialog) = shadow, never a border. Don't mix the two on one
element; don't apply a drop-shadow to a persistent card — it was tested and rejected because it doesn't
survive dark mode.

**Locked component semantics** (already validated against a PDF-merge screen mock in `DESIGN.md`, reuse
exactly): orange = active nav row + "New" tag + notification dot + the one primary CTA per screen. Black =
settings gear, active tab, toggles, drag-drop zone, secondary links/buttons ("Clear all", "Choose output
folder"). Neutral gray = count badges, drag handles. Red = reserved only for genuinely destructive,
hard-to-reverse actions (Settings "Clear stored data" is the worked example) — a file-remove icon in a
pre-merge queue is NOT destructive enough for red; use black/neutral there.

## Voice (real strings — no lorem, no invented copy)

Precision-instrument register: short, factual, specific. No exclamation marks, no cheerleading.

| Use this | Not this |
|---|---|
| "Clear stored data" | "Reset to default" |
| "JWT signature invalid at segment 2 (payload) — malformed base64." | "Something went wrong." |
| "No text found in this image." | "Oops, nothing here!" |
| "Update available — v1.4.2 (security fix)." | "You're missing out on the latest features! 🎉" |

Update-signal accessible-name sequence to reflect in the visible label too: "Update available" (quiet/
escalating) → "Security update available" (urgent state).

## Real tool roster (for grid-home — use these, not placeholders)

One Tool Registry (id, name, icon) feeds the sidebar, grid-home, and ⌘K palette identically — the same 8
tools everywhere: **JSON Formatter, Base64, UUID & Hash, JWT Inspector, Cron Translator, Bucket (OCR),
PDF Tools, Image Tools.**

---

## Screens to produce (3)

### Screen 1 — Nav shell / Grid-home (the most load-bearing — resolve Card internal layout here)

Sidebar (persistent, retractable) on the left: pinned/recent section, then the full tool list (8 tools
above), each with icon + label. One item shows the active-nav treatment (accent-signature-tint background,
`accent-signature-on-text` label). Settings reached via a gear at the sidebar's bottom.

Main pane: grid-home, one card per tool (8 cards), each showing an icon, tool name, and a short one-line
description pulled from what the tool actually does (e.g. "JSON Formatter — format, minify, and validate,"
"JWT Inspector — decode offline, no network call"). **This is the actual design problem to solve**: propose
a specific icon/title/description arrangement and internal spacing that reads clean at `card` token spec
(4px radius, hairline border, no shadow, 20px padding) — the current arrangement is an acknowledged
discomfort with no isolated root cause yet.

Also show, on this same screen, in a labeled secondary panel/inset (not as a separate screen): the
Update-signal's three visual states side by side (quiet dot / escalating / security-urgent) near wherever
you anchor it in the sidebar or global chrome — the anchor point itself is undecided, propose one.

### Screen 2 — PDF Tools (validates the already-locked button semantics above)

Drag-and-drop zone (black-treatment, per the locked semantics) for adding PDFs to a merge queue. A file
list with each entry showing a black/neutral remove icon (not red — this is the queue that established
"trivially reversible ≠ destructive-red" in DESIGN.md). A "Choose output folder" black link/button. A
"Clear all" black secondary button. One primary orange "Merge PDFs" button — the single orange thing on
this screen besides the active sidebar item. Sidebar present and showing PDF Tools as the active item.

### Screen 3 — Settings (sectioned, Privacy leading)

Sectioned pane: **Privacy** section first — the update-check network carve-out and the clipboard-suggestion
carve-out, each named explicitly with its own toggle (clipboard-suggestion defaults ON, described plainly
rather than buried). **Appearance** section next — dark-mode override control (System / Light / Dark).
Then a **per-tool** section (use JWT Inspector as the example) showing one persisted preference with its
own "Clear stored data" button (a per-item reset). Include, lower in the pane, the all-clear destructive
action using the erase-data phrasing above — this is the one place red/destructive-button treatment
belongs on this screen.

**Also resolve here or on Screen 1**, wherever it reads better: the Clipboard-suggestion surface's
highlighted/pinned visual treatment when a match appears at the top of the sidebar — distinct from a
normal nav item but not a popup/interrupt.

---

## What to bring back

Export/screenshot each screen (light + dark if Claude Design supports both in one pass) and save into
`imports/` in this same workspace (`_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/imports/`),
same pattern as the Step 3.1 imports already there. Then come back to this Claude Code session — the next
step folds your picks for the three deferred questions above back into `DESIGN.md`/`EXPERIENCE.md` as real
tokens/behavioral rules, and promotes the kept screens into `mockups/`.
