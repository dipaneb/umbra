<script setup lang="ts">
// The app's first floating surface. Deliberately minimal (Story 8.3 Task 2a,
// developer's API choice):
//  - uncontrolled: the component owns its open/close state
//  - content is the default slot; the trigger is the #trigger slot
//  - `placement` is a fixed set, CSS-positioned against the trigger — no
//    viewport measurement, no auto-flip, no positioning dependency. If a
//    placement clips in some layout, the consumer picks another.
// A `v-model:open` escape hatch is intentionally not added until a second
// consumer needs it.
import { computed, nextTick, onBeforeUnmount, ref, useId } from "vue";

type Placement =
  | "bottom-start"
  | "bottom"
  | "bottom-end"
  | "top-start"
  | "top"
  | "top-end";

const props = withDefaults(
  defineProps<{
    /** Accessible name for the popover surface (role="dialog"). */
    label: string;
    placement?: Placement;
  }>(),
  { placement: "bottom-start" },
);

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const triggerWrapEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const panelId = useId();

// v-bind this onto the trigger element in the #trigger slot so it carries
// the right ARIA wiring without the consumer hand-repeating it.
const triggerProps = computed(() => ({
  "aria-haspopup": "dialog" as const,
  "aria-expanded": open.value,
  "aria-controls": open.value ? panelId : undefined,
}));

function focusTrigger() {
  triggerWrapEl.value
    ?.querySelector<HTMLElement>('button, a[href], input, [tabindex]')
    ?.focus();
}

function onDocPointerDown(event: PointerEvent) {
  if (!rootEl.value?.contains(event.target as Node)) close(false);
}

function onDocKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close(true);
  }
}

function openPopover() {
  if (open.value) return;
  open.value = true;
  // Capture phase so an outside pointerdown / Escape is caught before other
  // handlers act on it.
  document.addEventListener("pointerdown", onDocPointerDown, true);
  document.addEventListener("keydown", onDocKeydown, true);
  void nextTick(() => panelEl.value?.focus());
}

function close(returnFocus: boolean) {
  if (!open.value) return;
  open.value = false;
  document.removeEventListener("pointerdown", onDocPointerDown, true);
  document.removeEventListener("keydown", onDocKeydown, true);
  if (returnFocus) focusTrigger();
}

function toggle() {
  if (open.value) close(true);
  else openPopover();
}

// Tab moving focus out of the panel dismisses it (a popover, not a modal —
// no focus trap). A click landing outside is already handled by
// onDocPointerDown; this covers keyboard traversal.
function onPanelFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && rootEl.value?.contains(next)) return;
  close(false);
}

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown, true);
  document.removeEventListener("keydown", onDocKeydown, true);
});

defineExpose({ open: openPopover, close: () => close(false), toggle });
</script>

<template>
  <span
    ref="rootEl"
    class="popover-root"
  >
    <span
      ref="triggerWrapEl"
      class="popover-trigger"
    >
      <slot
        name="trigger"
        :toggle="toggle"
        :open="open"
        :close="() => close(true)"
        :trigger-props="triggerProps"
      />
    </span>

    <Transition name="popover">
      <div
        v-if="open"
        :id="panelId"
        ref="panelEl"
        class="popover-panel"
        :data-placement="props.placement"
        role="dialog"
        :aria-label="props.label"
        tabindex="-1"
        @focusout="onPanelFocusOut"
      >
        <slot />
      </div>
    </Transition>
  </span>
</template>

<style scoped>
.popover-root {
  position: relative;
  display: inline-flex;
}

.popover-trigger {
  display: inline-flex;
}

/* Floating surface (DESIGN.md components.floating-surface): raised
   background + shadow, never a plain border. --shadow-floating is a soft
   drop shadow in light and a light rim-glow in dark (a dark blur is
   invisible on a dark page). */
.popover-panel {
  position: absolute;
  z-index: 20;
  /* Size to content — a floor so a tiny menu still has presence, a ceiling
     so a paragraph of explainer text wraps instead of stretching. */
  width: max-content;
  min-width: 6rem;
  max-width: 20rem;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-bg-surface-raised);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-floating);
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  line-height: var(--font-body-line-height);
  color: var(--color-text-primary);
}

.popover-panel:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
}

.popover-panel[data-placement^="bottom"] {
  top: 100%;
  margin-top: var(--spacing-2);
}

.popover-panel[data-placement^="top"] {
  bottom: 100%;
  margin-bottom: var(--spacing-2);
}

.popover-panel[data-placement$="-start"] {
  left: 0;
}

.popover-panel[data-placement$="-end"] {
  right: 0;
}

.popover-panel[data-placement="bottom"],
.popover-panel[data-placement="top"] {
  left: 50%;
  transform: translateX(-50%);
}

/* A plain fade — no slide, so there's no transform to fight the centred
   placements' translateX(-50%), and it stays within DESIGN.md's restraint. */
.popover-enter-active,
.popover-leave-active {
  transition: opacity 120ms ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .popover-enter-active,
  .popover-leave-active {
    transition: none;
  }
}
</style>
