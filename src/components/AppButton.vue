<script setup lang="ts">
// The three button roles DESIGN.md's `components` block actually names —
// button-primary/button-default/button-destructive — nothing invented
// beyond that. `default` is the workhorse: most buttons in the app,
// including "secondary" actions, use it (DESIGN.md Components, :88-93).
withDefaults(
  defineProps<{
    variant?: "primary" | "default" | "destructive";
    type?: "button" | "submit";
    disabled?: boolean;
  }>(),
  {
    variant: "default",
    type: "button",
    disabled: false,
  },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="app-button"
    :class="variant"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  border: none;
  border-radius: var(--radius-default);
  padding: 0.5em 1.1em;
  font-family: inherit;
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  cursor: pointer;
}

.app-button.default {
  background: var(--color-accent-default);
  color: var(--color-accent-default-on);
}

/* White-on-fill for primary/destructive is a documented, deliberate
   DESIGN.md trade-off (Colors, :139/:141) — not a bug, don't "fix" it to a
   near-black label without that same conversation. */
.app-button.primary {
  background: var(--color-accent-signature);
  color: #ffffff;
}

.app-button.destructive {
  background: var(--color-accent-destructive);
  color: #ffffff;
}

.app-button:hover:not(:disabled) {
  opacity: 0.9;
}

.app-button:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
}

.app-button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
