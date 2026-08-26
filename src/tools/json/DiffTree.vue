<script setup lang="ts">
import { computed, h, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { PhCaretDown, PhCaretRight } from "@phosphor-icons/vue";
import { defaultExpandedDiffPaths, flattenDiffTree, type DiffTreeRow } from "./flattenDiffTree";
import type { DiffNode } from "./jsonDiff";

const { t } = useI18n();

const props = defineProps<{ root: DiffNode | null }>();

// Story 8.1 AC11/AC13 (DESIGN.md's 2026-08-26 exception): drawn inline per
// this app's "never emoji/dingbat, draw stroke-based SVG on a consistent
// grid" icon convention — Phosphor's own set doesn't ship a diff-specific
// plus/minus/pencil/arrow foursome distinct from its generic
// PhPlus/PhMinus/PhPencilSimple/PhArrowRight, so these mirror those glyphs
// by hand at this row's own 14px size (`currentColor`, so each status's own
// CSS color drives the icon directly, no per-status prop needed). Plain
// functions returning a render call, not `@phosphor-icons/vue` imports —
// their exact stroke width/viewBox is what the design canvas comparison
// mockup already used and the developer already approved, so this
// reproduces that instead of re-deriving the same look from a library glyph.
const diffIconProps = {
  width: "14",
  height: "14",
  viewBox: "0 0 16 16",
  fill: "none",
  "aria-hidden": "true",
};

// Status is otherwise conveyed only by icon shape and CSS color, invisible
// to a screen reader — `role="img"` on the wrapping span (see template)
// gives it an accessible name a native `<span>` can't get from `aria-label`
// alone.
function diffRowStatusLabel(status: DiffTreeRow["status"]): string | undefined {
  switch (status) {
    case "added":
      return t("tools.json.diffRowStatusAdded");
    case "removed":
      return t("tools.json.diffRowStatusRemoved");
    case "changed":
      return t("tools.json.diffRowStatusChanged");
    default:
      return undefined;
  }
}
const PlusIcon = () =>
  h("svg", diffIconProps, [
    h("path", { d: "M8 3v10M3 8h10", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" }),
  ]);
const MinusIcon = () =>
  h("svg", diffIconProps, [
    h("path", { d: "M3 8h10", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" }),
  ]);
const PencilIcon = () =>
  h("svg", diffIconProps, [
    h("path", {
      d: "M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z",
      stroke: "currentColor",
      "stroke-width": "1.3",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }),
  ]);
const ArrowRightIcon = () =>
  h("svg", diffIconProps, [
    h("path", {
      d: "M2 8h11M9 4l4 4-4 4",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  ]);

// Story 8.1 AC11: unlike Explorer's `expanded` (always starts at just the
// root — Story 1.8's own minimal-initial-row-count convention), a diff
// view's whole point is showing what's different, so this defaults to
// every ancestor chain of a non-unchanged node already open. Recomputed
// whenever `root` itself changes identity (a fresh diff result), not
// merged with whatever the user had toggled on the previous one — a
// `watch`, not computed inline inside `rows` below, since resetting
// `expanded` here is a real side effect and `rows` needs to stay pure.
const expanded = ref<Set<string>>(new Set());
watch(
  () => props.root,
  (root) => {
    expanded.value = root ? defaultExpandedDiffPaths(root) : new Set();
  },
  { immediate: true },
);
const rows = computed(() => (props.root === null ? [] : flattenDiffTree(props.root, expanded.value)));

const focusedPath = ref<string>("[]");
const scrollParentRef = ref<HTMLElement | null>(null);

const focusedIndex = computed(() => {
  const byPath = rows.value.findIndex((r) => r.path === focusedPath.value);
  return byPath !== -1 ? byPath : 0;
});

// Same constants/approach as JsonTree.vue's own virtualized rendering —
// deliberately duplicated rather than shared, since `DiffNode`'s shape
// (status-carrying, recursive) is different enough from `JsonTreeValue`
// that unifying the two into one component would need a confusing dual-mode
// prop surface for little real gain.
const ROW_HEIGHT_PX = 24;
const INDENT_EM = 1.2;
const GUIDE_LINE_COLOR = "color-mix(in srgb, var(--color-text-secondary) 25%, transparent)";
const CHEVRON_CENTER_OFFSET_EM = 0.5;

function indentGuideStyle(depth: number) {
  if (depth === 0) return {};
  const offset = CHEVRON_CENTER_OFFSET_EM;
  return {
    backgroundImage:
      `repeating-linear-gradient(to right, transparent 0, transparent calc(${offset}em - 0.5px), ${GUIDE_LINE_COLOR} calc(${offset}em - 0.5px), ${GUIDE_LINE_COLOR} calc(${offset}em + 0.5px), transparent calc(${offset}em + 0.5px), transparent ${INDENT_EM}em)`,
    backgroundSize: `${depth * INDENT_EM}em 100%`,
    backgroundRepeat: "no-repeat",
  };
}

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollParentRef.value,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
    getItemKey: (index: number) => rows.value[index]?.path ?? index,
  })),
);

const renderRows = computed(() =>
  virtualizer.value
    .getVirtualItems()
    .map((virtualRow) => ({ virtualRow, row: rows.value[virtualRow.index] }))
    .filter((entry): entry is { virtualRow: typeof entry.virtualRow; row: DiffTreeRow } =>
      entry.row !== undefined,
    ),
);

function toggle(index: number) {
  const row = rows.value[index];
  if (!row || !row.expandable) return;
  const next = new Set(expanded.value);
  if (next.has(row.path)) {
    next.delete(row.path);
  } else {
    next.add(row.path);
  }
  expanded.value = next;
}

let focusCallCount = 0;

async function focusRow(index: number) {
  focusCallCount += 1;
  const thisCallNumber = focusCallCount;
  const clamped = Math.max(0, Math.min(index, rows.value.length - 1));
  const row = rows.value[clamped];
  if (!row) return;
  focusedPath.value = row.path;
  virtualizer.value.scrollToIndex(clamped);
  await nextTick();
  if (thisCallNumber !== focusCallCount) return;
  const el = scrollParentRef.value?.querySelector<HTMLElement>(`[data-index="${clamped}"]`);
  el?.focus();
}

function nearestAncestorIndex(index: number): number {
  const depth = rows.value[index]?.depth ?? 0;
  for (let i = index - 1; i >= 0; i--) {
    if ((rows.value[i]?.depth ?? 0) < depth) return i;
  }
  return index;
}

async function onKeydown(event: KeyboardEvent, index: number) {
  const row = rows.value[index];
  if (!row) return;

  switch (event.key) {
    case "Enter":
    case " ":
      event.preventDefault();
      toggle(index);
      break;
    case "ArrowRight":
      event.preventDefault();
      if (row.expandable && !row.expanded) {
        toggle(index);
      } else {
        await focusRow(index + 1);
      }
      break;
    case "ArrowLeft":
      event.preventDefault();
      if (row.expandable && row.expanded) {
        toggle(index);
      } else {
        await focusRow(nearestAncestorIndex(index));
      }
      break;
    case "ArrowDown":
      event.preventDefault();
      await focusRow(index + 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      await focusRow(index - 1);
      break;
  }
}
</script>

<template>
  <p
    v-if="root === null"
    role="status"
  >
    {{ t('tools.json.treeUnavailable') }}
  </p>
  <div
    v-else
    ref="scrollParentRef"
    role="tree"
    class="diff-tree-scroll"
  >
    <div
      class="diff-tree-spacer"
      :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }"
    >
      <div
        v-for="{ virtualRow, row } in renderRows"
        :key="String(virtualRow.key)"
        role="treeitem"
        class="diff-tree-row"
        :class="`diff-tree-row-${row.status}`"
        :data-index="virtualRow.index"
        :tabindex="virtualRow.index === focusedIndex ? 0 : -1"
        :aria-level="row.depth + 1"
        :aria-expanded="row.expandable ? (row.expanded ? 'true' : 'false') : undefined"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${ROW_HEIGHT_PX}px`,
          transform: `translateY(${virtualRow.start}px)`,
          paddingLeft: `${row.depth * INDENT_EM}em`,
          ...indentGuideStyle(row.depth),
        }"
        @click="toggle(virtualRow.index)"
        @keydown="onKeydown($event, virtualRow.index)"
        @focus="focusedPath = row.path"
      >
        <span
          class="diff-tree-status-icon"
          :role="row.status === 'unchanged' ? undefined : 'img'"
          :aria-label="diffRowStatusLabel(row.status)"
        >
          <PlusIcon v-if="row.status === 'added'" />
          <MinusIcon v-else-if="row.status === 'removed'" />
          <PencilIcon v-else-if="row.status === 'changed' && row.oldPreview !== null" />
        </span>
        <span class="diff-tree-chevron">
          <component
            :is="row.expanded ? PhCaretDown : PhCaretRight"
            v-if="row.expandable"
            aria-hidden="true"
          />
        </span>
        <span
          v-if="row.keyLabel !== null"
          class="diff-tree-key"
        >"{{ row.keyLabel }}":</span>
        <span
          v-if="row.status === 'changed' && row.oldPreview !== null"
          class="diff-tree-changed-values"
        >
          <span class="diff-tree-old-value">{{ row.oldPreview }}</span>
          <ArrowRightIcon />
          <span class="diff-tree-new-value">{{ row.preview }}</span>
        </span>
        <span
          v-else
          class="diff-tree-preview"
          :class="{ 'diff-tree-summary': row.expandable }"
        >{{ row.preview }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diff-tree-scroll {
  height: 100%;
  overflow-y: auto;
}

.diff-tree-row {
  display: flex;
  gap: 0.4em;
  align-items: center;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  cursor: default;
}

.diff-tree-row:hover {
  background: var(--color-border-hairline);
}

.diff-tree-row:focus {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: -2px;
}

/* Same fixed-width-column reasoning as JsonTree.vue's own chevron: every
   row's key/value starts at the same x position whether or not this
   particular row carries a status icon. */
.diff-tree-status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  flex-shrink: 0;
}

.diff-tree-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.diff-tree-chevron svg {
  width: 0.8em;
  height: 0.8em;
}

.diff-tree-key {
  flex-shrink: 0;
}

.diff-tree-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.diff-tree-summary {
  font-style: italic;
}

.diff-tree-changed-values {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  flex: 1;
}

.diff-tree-changed-values svg {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.diff-tree-old-value {
  text-decoration: line-through;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-accent-destructive);
}

.diff-tree-new-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--color-diff-added);
}

/* Full-row color per status (Story 8.1, DESIGN.md's 2026-08-26 exception —
   the developer explicitly chose this over a value-only/no-new-color
   treatment after comparing both side by side, because it reads instantly
   at a glance). `unchanged` is dimmed so it recedes rather than competing
   with the rows that actually matter. A `changed` *container* (no
   `old_value`, see `flattenDiffTree.ts`) gets primary-weight text instead
   of either color — it's not itself the change, just a branch worth
   following down to one. */
.diff-tree-row-unchanged .diff-tree-key,
.diff-tree-row-unchanged .diff-tree-preview {
  color: var(--color-text-secondary);
}

.diff-tree-row-changed .diff-tree-preview {
  color: var(--color-text-primary);
}

/* A changed row's own key stays muted, matching every other row's key
   styling — only the old/new values (above) carry the red/green signal;
   recoloring the key too would compete with them for attention on the one
   row where two colors are already doing real work. */
.diff-tree-row-changed .diff-tree-key {
  color: var(--color-text-secondary);
}

.diff-tree-row-added .diff-tree-key,
.diff-tree-row-added .diff-tree-preview {
  color: var(--color-diff-added);
  font-weight: 500;
}

.diff-tree-row-added .diff-tree-status-icon {
  color: var(--color-diff-added);
}

.diff-tree-row-removed .diff-tree-key,
.diff-tree-row-removed .diff-tree-preview {
  color: var(--color-accent-destructive);
  text-decoration: line-through;
}

.diff-tree-row-removed .diff-tree-status-icon {
  color: var(--color-accent-destructive);
}

.diff-tree-row-changed .diff-tree-status-icon {
  color: var(--color-text-primary);
}
</style>
