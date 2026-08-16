# Umbra — Step 3.3 Claude Design brief (pictorial mark / logo)

Paste this into a new Claude Design session (claude.ai/design). If it can read the repo directly, point it
at `DESIGN.md` in `_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/` first — the tokens below
are a condensed copy, not a replacement. This is a fresh design surface (no prior mark exists), but every
color/shape choice below is already locked — this brief is about composing a mark *from* those constraints,
not inventing new ones.

## Brand register (non-negotiable)

Umbra is a **precision instrument, not an indie utility** — professional, sharp, modern. The reference
points named directly by the developer: the iPhone 17 Pro's orange finish, and the single red shutter-button
dot on a Leica camera — a saturated accent as a restrained, singular touch on an otherwise neutral,
industrial body. Never playful, never decorative, never a mascot.

## The name itself — a real concept hook, not decoration

"Umbra" is the astronomical term for the fully-shadowed core of a shadow — the region where an eclipse is
total, where a light source is completely blocked. This isn't incidental to the brand: it's already the
same optics/precision-instrument territory as the Leica reference point (aperture, shutter, light control),
and it gives a pictorial mark somewhere real to come from instead of an arbitrary abstract shape. Three
concept directions worth exploring — generate a few marks across these, don't commit to just one on the
first pass:

1. **An eclipse/crescent form.** A circle with a precise crescent of negative space cut from it (or the
   reverse — a solid crescent) — literally an umbra. Reads as astronomical/precise, not decorative.
2. **An aperture/iris form.** Overlapping blades or arcs suggesting a camera aperture stopping down to a
   point — ties directly to the Leica-dot reference already locked in the brand voice, and to the product's
   actual behavior (Umbra runs entirely local, "closing the aperture" to the network).
3. **A minimal shadow-cast form.** An abstract shape (square, dot) with a single hard-edged shadow offset
   from it in the neutral palette — visually literal without being cute.

Reject any direction that reads as: a ghost/moon mascot, a cute ghoul, anything soft/rounded/friendly. The
concept is optical/precise, not spooky — this is a common wrong turn for a word like "umbra" and should be
explicitly avoided.

## Tokens (condensed from DESIGN.md — apply exactly, don't improvise new values)

- **Color: two-hue system only.** Signature orange `#FF5E1A` (light) / `#FF6E30` (dark) as the sole
  accent — used sparingly, as a mark/fill, not a wash. Otherwise pure neutral: near-black `#18181B` (light
  UI) / near-white `#EDEDED` (dark UI) for the mark's primary ink. **No second chromatic accent** — a muted
  slate-blue was tested during DESIGN.md's development and explicitly rejected; stay a two-hue system.
  **No gradients** — nothing in the locked system uses one, the register is flat/precise, not soft.
- **Shape: sharp over soft.** 4px corner radius was tested directly against 8px and 12px for the product's
  cards and both larger radii were rejected as "less professional/sharp/industrial." Apply the same
  instinct to the mark's geometry: precise, geometric edges over soft/blobby curves. Circles and hard arcs
  (as in an aperture/eclipse) are fine and on-brand; soft "blob" shapes are not.
- **Elevation: flat, no shadow-as-a-crutch.** The product's own elevation rule is border-only for persistent
  surfaces, shadow only for temporary/floating ones — translated to a mark, this means no drop-shadow
  applied to the logo itself to fake depth. If a shadow motif is part of the *concept* (direction 3 above),
  it should be a deliberate flat graphic element, not a rendered soft shadow effect.
- **Small-format legibility is a hard requirement.** The mark needs to work as a macOS app icon and a
  browser favicon (as small as 16-32px), not just at poster size. Test every concept at that scale before
  presenting it — if a concept turns to visual noise that small, it's not viable regardless of how it looks
  large, and it should be dropped or simplified rather than shown as if unresolved.

## What to produce

3-5 distinct pictorial mark concepts (not variations on one idea — genuinely different compositions),
spanning at least two of the three directions above. For each: a large-format version, a small-format
(16-32px equivalent) legibility test, and both light-background and dark-background variants (the mark
needs to work standing alone against both `#F4F5F6` and `#141415`, the product's actual light/dark base
colors — not assumed to always sit on a white card).

## What to bring back

Export/screenshot the concepts and save into `imports/` in this same workspace
(`_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/imports/`), named so they're
distinguishable at a glance, e.g. `step3.3-eclipse-1.png`, `step3.3-aperture-1.png`. Then come back to this
Claude Code session — the next step reviews the concepts against `DESIGN.md`'s tokens, picks or refines a
direction with you, and writes the outcome into `DESIGN.md` (a new Brand & Style / mark section) once
you've settled on one.
