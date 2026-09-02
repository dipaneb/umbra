<script setup lang="ts">
// The app's first floating surface. Deliberately minimal (Story 8.3 Task 2a,
// developer's API choice):
//  - uncontrolled: the component owns its open/close state
//  - content is the default slot; the trigger is the #trigger slot
//  - `placement` is a fixed set, CSS-positioned against the trigger — no
//    positioning dependency. Story 8.5 added a light viewport-aware flip: the
//    prop is a *preferred* placement, and `flipPlacement` (pure, in
//    ./appPopoverPlacement.ts) swaps it to the opposite side of an axis on
//    open — and again on window resize while open — if the panel would
//    overflow the viewport there. Still CSS-only, no positioning library; not
//    re-flipped on scroll.
// A `v-model:open` escape hatch is intentionally not added until a second
// consumer needs it.
//
// Story 8.3 code review (2026-08-31):
//  - the #trigger slot exposes the open state as `isOpen` (not `open`) so it
//    can't be confused with the imperative `open()` on the instance;
//  - `close()` on the instance takes `{ returnFocus }` (default true) so a
//    consumer that closes the popover programmatically — e.g. after picking a
//    menu item — restores focus to the trigger instead of dropping it to
//    <body>;
//  - Escape is handled by a listener on the panel, not a capture-phase
//    document listener, so an open popover never swallows Escape app-wide.
import { computed, nextTick, onBeforeUnmount, ref, useId } from "vue";
import { flipPlacement, type Placement } from "./appPopoverPlacement";

const props = withDefaults(
  defineProps<{
    /** Accessible name for the popover surface (role="dialog"). */
    label: string;
    /**
     * Preferred placement. Flipped to the opposite side of an axis on open if
     * the panel would overflow the viewport there and the other side has room.
     */
    placement?: Placement;
  }>(),
  { placement: "bottom-start" },
);

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const triggerWrapEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const panelId = useId();

// The placement actually applied — the prop, or a viewport-aware flip of it
// computed once per open (see resolvePlacement).
const effectivePlacement = ref<Placement>(props.placement);

// v-bind this onto the trigger element in the #trigger slot so it carries
// the right ARIA wiring without the consumer hand-repeating it.
const triggerProps = computed(() => ({
  "aria-haspopup": "dialog" as const,
  "aria-expanded": open.value,
  "aria-controls": open.value ? panelId : undefined,
}));

// Snapshot whether the popover was open at the moment the trigger was
// pressed — captured on `pointerdown`, which fires BEFORE the focus change
// (and therefore before the panel's `focusout` handler). On a WebKit webview
// (Tauri/macOS) `focusout`'s `relatedTarget` is null even when focus is
// moving to the trigger, so `onPanelFocusOut` closes the popover; the trailing
// `click` then runs `toggle()`, sees `open === false`, and reopens — a visible
// flash. This lets `toggle()` know the press was a "close" gesture, not a
// fresh "open".
let wasOpenOnTriggerPointerDown = false;
function onTriggerPointerDown() {
  wasOpenOnTriggerPointerDown = open.value;
}

function focusTrigger() {
  const wrap = triggerWrapEl.value;
  if (!wrap) return;
  // Prefer a natively focusable descendant (every consumer today wires a
  // <button>); fall back to the wrapper itself so focus is never dropped to
  // <body> even for a non-focusable custom trigger.
  const focusable = wrap.querySelector<HTMLElement>(
    "button, a[href], input, select, textarea, [tabindex]",
  );
  (focusable ?? wrap).focus();
}

function onDocPointerDown(event: PointerEvent) {
  if (!rootEl.value?.contains(event.target as Node)) close({ returnFocus: false });
}

// Scoped to the panel (which holds focus while open, directly or via a
// focused descendant) — NOT a capture-phase document listener, so an open
// popover never consumes Escape for the rest of the app.
function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") close({ returnFocus: true });
}

// Measure the trigger + panel against the viewport and swap `data-placement`
// to a non-clipping side if needed. Runs inside the same nextTick as the focus
// call on open (before the browser paints, so there is no visible re-position)
// and again on every window resize while open, so dragging the window edge
// re-flips the open popover instead of leaving it clipped until reopened.
// jsdom returns zero rects → no flip (the six existing consumers keep their
// preferred placement under test).
function resolvePlacement() {
  const trigger = triggerWrapEl.value;
  const panel = panelEl.value;
  if (!trigger || !panel) return;
  const t = trigger.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  effectivePlacement.value = flipPlacement(
    props.placement,
    { left: t.left, right: t.right, top: t.top, bottom: t.bottom },
    { width: p.width, height: p.height },
    {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    },
  );
}

// Coalesce a burst of resize events into one measurement per frame.
let resolveFrame: number | undefined;
function scheduleResolvePlacement() {
  if (resolveFrame !== undefined) return;
  resolveFrame = requestAnimationFrame(() => {
    resolveFrame = undefined;
    resolvePlacement();
  });
}

function cancelScheduledResolve() {
  if (resolveFrame !== undefined) {
    cancelAnimationFrame(resolveFrame);
    resolveFrame = undefined;
  }
}

function openPopover() {
  if (open.value) return;
  // Start from the preferred placement so reopening in a roomy spot doesn't
  // keep a stale flip.
  effectivePlacement.value = props.placement;
  open.value = true;
  // Capture phase so an outside pointerdown is seen before other handlers
  // act on it. pointerdown only — no stopPropagation, no keyboard.
  document.addEventListener("pointerdown", onDocPointerDown, true);
  window.addEventListener("resize", scheduleResolvePlacement);
  void nextTick(() => {
    resolvePlacement();
    panelEl.value?.focus();
  });
}

function close(opts: { returnFocus?: boolean } = {}) {
  if (!open.value) return;
  open.value = false;
  document.removeEventListener("pointerdown", onDocPointerDown, true);
  window.removeEventListener("resize", scheduleResolvePlacement);
  cancelScheduledResolve();
  if (opts.returnFocus) focusTrigger();
}

function toggle() {
  // If the popover was open when this press started, the user's intent is
  // "close" — even if a focusout/outside handler has already closed it as
  // part of the same interaction (WebKit null-relatedTarget path). `close()`
  // is a no-op when already closed, so this just prevents a reopen.
  if (wasOpenOnTriggerPointerDown) {
    wasOpenOnTriggerPointerDown = false;
    close({ returnFocus: true });
    return;
  }
  if (open.value) close({ returnFocus: true });
  else openPopover();
}

// Tab moving focus out of the panel dismisses it (a popover, not a modal —
// no focus trap). A click landing outside is already handled by
// onDocPointerDown; this covers keyboard traversal.
function onPanelFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && rootEl.value?.contains(next)) return;
  close({ returnFocus: false });
}

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown, true);
  window.removeEventListener("resize", scheduleResolvePlacement);
  cancelScheduledResolve();
});

defineExpose({
  open: openPopover,
  close: (opts: { returnFocus?: boolean } = {}) =>
    close({ returnFocus: opts.returnFocus ?? true }),
  toggle,
});
</script>

<template>
  <span
    ref="rootEl"
    class="popover-root"
  >
    <span
      ref="triggerWrapEl"
      class="popover-trigger"
      @pointerdown="onTriggerPointerDown"
    >
      <slot
        name="trigger"
        :toggle="toggle"
        :is-open="open"
        :close="() => close({ returnFocus: true })"
        :trigger-props="triggerProps"
      />
    </span>

    <Transition name="popover">
      <div
        v-if="open"
        :id="panelId"
        ref="panelEl"
        class="popover-panel"
        :data-placement="effectivePlacement"
        role="dialog"
        :aria-label="props.label"
        tabindex="-1"
        @keydown="onPanelKeydown"
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
