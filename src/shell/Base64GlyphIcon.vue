<script setup lang="ts">
// The "64" badge that stands in for a Phosphor icon component in
// `resolveIcon` (src/shell/icons.ts) — Base64 keeps the monospace-shorthand
// mark the original DESIGN.md mockups used ({}, 64, #, JWT, …), as a
// deliberate one-off exception to the Story 7.1 Phosphor icon system: the
// literal "64" says *which* encoding in a way no pictogram in the set does.
// See DESIGN.md "Card" note (Story 8.2 amendment).
//
// It's a real font glyph rendered inside an <svg><text>, not hand-drawn
// paths: the browser sets the digits in the app's code face, and the <svg>
// wrapper makes it size and colour exactly like the Phosphor icons beside it
// — `currentColor`, sized by `size` or by a CSS `width`/`height` on the svg
// root (GridHome's `.icon` rule), `flex-shrink: 0` via AppSidebar's `a svg`.
//
// Weight tuning: `font-weight` below is set to visually match the Phosphor
// "regular" / "bold" stroke density at the same box size. Nudge the two
// numbers if the digits read lighter or heavier than the sibling icons.
withDefaults(defineProps<{ size?: string | number; weight?: string }>(), {
  size: "1em",
  weight: "regular",
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    role="img"
    aria-hidden="true"
  >
    <text
      x="12"
      y="12.5"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="var(--font-code-family), ui-monospace, SFMono-Regular, Menlo, monospace"
      font-size="20"
      :font-weight="weight === 'bold' ? 700 : 630"
      letter-spacing="-1"
      fill="currentColor"
    >64</text>
  </svg>
</template>
