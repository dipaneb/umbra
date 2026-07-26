<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { flattenJsonTree } from "./flattenJsonTree";
import type { JsonTreeValue } from "./jsonTreeValue";

const props = defineProps<{ value: JsonTreeValue | null }>();

// Default: root expanded, everything else starts collapsed. "[]" is
// `JSON.stringify([])`, the root's path per flattenJsonTree's encoding. This
// keeps the initial visible-row count minimal even on a huge document.
const expanded = ref<Set<string>>(new Set(["[]"]));
const focusedIndex = ref(0);
const scrollParentRef = ref<HTMLElement | null>(null);

const rows = computed(() =>
  props.value === null ? [] : flattenJsonTree(props.value, expanded.value),
);

// A stale focusedIndex pointing past the end (collapsing an ancestor, or a
// re-parse producing a smaller tree) would leave the keyboard-nav DOM lookup
// unable to find anything to focus.
watch(rows, (newRows) => {
  if (focusedIndex.value >= newRows.length) {
    focusedIndex.value = Math.max(0, newRows.length - 1);
  }
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

async function focusRow(index: number) {
  const clamped = Math.max(0, Math.min(index, rows.value.length - 1));
  focusedIndex.value = clamped;
  virtualizer.value.scrollToIndex(clamped);
  // `scrollToIndex` is not guaranteed to be reflected in the DOM
  // synchronously — the target row may not exist as an element yet on the
  // same tick.
  await nextTick();
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
    Tree unavailable — fix the JSON to see its structure.
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
        v-for="virtualRow in virtualizer.getVirtualItems()"
        :key="String(virtualRow.key)"
        role="treeitem"
        class="json-tree-row"
        :data-index="virtualRow.index"
        :tabindex="virtualRow.index === focusedIndex ? 0 : -1"
        :aria-level="rows[virtualRow.index]!.depth + 1"
        :aria-expanded="
          rows[virtualRow.index]!.expandable
            ? (rows[virtualRow.index]!.expanded ? 'true' : 'false')
            : undefined
        "
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${ROW_HEIGHT_PX}px`,
          transform: `translateY(${virtualRow.start}px)`,
          paddingLeft: `${rows[virtualRow.index]!.depth * 1.2}em`,
        }"
        @click="toggle(virtualRow.index)"
        @keydown="onKeydown($event, virtualRow.index)"
        @focus="focusedIndex = virtualRow.index"
      >
        <span
          v-if="rows[virtualRow.index]!.keyLabel !== null"
          class="json-tree-key"
        >{{ rows[virtualRow.index]!.keyLabel }}:</span>
        <span class="json-tree-preview">{{ rows[virtualRow.index]!.preview }}</span>
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
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}

.json-tree-key {
  color: #6b7280;
}
</style>
