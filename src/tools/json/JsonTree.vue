<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { flattenJsonTree, type JsonTreeRow } from "./flattenJsonTree";
import type { JsonTreeValue } from "./jsonTreeValue";

const { t } = useI18n();

const props = defineProps<{ value: JsonTreeValue | null }>();

// Default: root expanded, everything else starts collapsed. "[]" is
// `JSON.stringify([])`, the root's path per flattenJsonTree's encoding. This
// keeps the initial visible-row count minimal even on a huge document.
const expanded = ref<Set<string>>(new Set(["[]"]));
// Focus is tracked by row *path*, not raw index: an index would silently
// point at an unrelated row once anything above it collapses/expands and
// shifts every subsequent index. `focusedIndex` (below) is derived from this.
const focusedPath = ref<string>("[]");
const scrollParentRef = ref<HTMLElement | null>(null);

const rows = computed(() =>
  props.value === null ? [] : flattenJsonTree(props.value, expanded.value),
);

const focusedIndex = computed(() => {
  const byPath = rows.value.findIndex((r) => r.path === focusedPath.value);
  // The previously-focused path no longer exists (its subtree collapsed, or
  // the document reshaped) — fall back to the root instead of an
  // out-of-range or otherwise arbitrary index.
  return byPath !== -1 ? byPath : 0;
});

const ROW_HEIGHT_PX = 24;

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollParentRef.value,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
    getItemKey: (index: number) => rows.value[index]?.path ?? index,
  })),
);

// Pairs each virtual item with its row data and drops any that resolve to
// `undefined` — the virtualizer's own update cycle can lag one tick behind
// `rows` shrinking (e.g. right after a collapse), so indexing `rows` directly
// in the template is not safe to assert non-null.
const renderRows = computed(() =>
  virtualizer.value
    .getVirtualItems()
    .map((virtualRow) => ({ virtualRow, row: rows.value[virtualRow.index] }))
    .filter((entry): entry is { virtualRow: typeof entry.virtualRow; row: JsonTreeRow } =>
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

// Tags each call so an overlapping, later call (e.g. from held-down arrow
// keys firing faster than a prior call's `await nextTick()` resolves) always
// wins — a stale call's resolution is dropped instead of stealing focus back.
let focusCallCount = 0;

async function focusRow(index: number) {
  focusCallCount += 1;
  const thisCallNumber = focusCallCount;
  const clamped = Math.max(0, Math.min(index, rows.value.length - 1));
  const row = rows.value[clamped];
  if (!row) return;
  focusedPath.value = row.path;
  virtualizer.value.scrollToIndex(clamped);
  // `scrollToIndex` is not guaranteed to be reflected in the DOM
  // synchronously — the target row may not exist as an element yet on the
  // same tick.
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
    v-if="value === null"
    role="status"
  >
    {{ t('tools.json.treeUnavailable') }}
  </p>
  <div
    v-else
    ref="scrollParentRef"
    role="tree"
    class="json-tree-scroll"
  >
    <div
      class="json-tree-spacer"
      :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }"
    >
      <div
        v-for="{ virtualRow, row } in renderRows"
        :key="String(virtualRow.key)"
        role="treeitem"
        class="json-tree-row"
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
          paddingLeft: `${row.depth * 1.2}em`,
        }"
        @click="toggle(virtualRow.index)"
        @keydown="onKeydown($event, virtualRow.index)"
        @focus="focusedPath = row.path"
      >
        <span
          v-if="row.keyLabel !== null"
          class="json-tree-key"
        >{{ row.keyLabel }}:</span>
        <span class="json-tree-preview">{{ row.preview }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.json-tree-scroll {
  height: 100%;
  overflow-y: auto;
}

.json-tree-row {
  display: flex;
  gap: 0.4em;
  align-items: center;
  font-family: monospace;
  cursor: default;
}

.json-tree-row:focus {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: -2px;
}

.json-tree-key {
  color: #6b7280;
}

.json-tree-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
