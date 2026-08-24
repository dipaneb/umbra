<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { PhCaretDown, PhCaretRight, PhCaretUp, PhCopySimple, PhLink } from "@phosphor-icons/vue";
import { writeClipboardText } from "../../shell/clipboard";
import { debounce } from "../../shell/debounce";
import { findMatches, flattenJsonTree, highlightSegments, type JsonTreeRow } from "./flattenJsonTree";
import { jsonTreeValueToText } from "./jsonTreeValue";
import type { JsonTreeValue } from "./jsonTreeValue";

const { t } = useI18n();

const props = defineProps<{ value: JsonTreeValue | null }>();
const emit = defineEmits<{ (e: "copy-error", error: unknown): void }>();

async function copyValue(row: JsonTreeRow) {
  try {
    await writeClipboardText(jsonTreeValueToText(row.value));
  } catch (err) {
    emit("copy-error", err);
  }
}

async function copyPath(row: JsonTreeRow) {
  try {
    await writeClipboardText(row.jsonPath);
  } catch (err) {
    emit("copy-error", err);
  }
}

// Default: root expanded, everything else starts collapsed. "[]" is
// `JSON.stringify([])`, the root's path per flattenJsonTree's encoding. This
// keeps the initial visible-row count minimal even on a huge document.
const expanded = ref<Set<string>>(new Set(["[]"]));
// Focus is tracked by row *path*, not raw index: an index would silently
// point at an unrelated row once anything above it collapses/expands and
// shifts every subsequent index. `focusedIndex` (below) is derived from this.
const focusedPath = ref<string>("[]");
const scrollParentRef = ref<HTMLElement | null>(null);

const rows = computed(() => (props.value === null ? [] : flattenJsonTree(props.value, expanded.value)));

const focusedIndex = computed(() => {
  const byPath = rows.value.findIndex((r) => r.path === focusedPath.value);
  // The previously-focused path no longer exists (its subtree collapsed, or
  // the document reshaped) — fall back to the root instead of an
  // out-of-range or otherwise arbitrary index.
  return byPath !== -1 ? byPath : 0;
});

const ROW_HEIGHT_PX = 24;
// Shared between the row's own `padding-left` and the indent-guide-line
// background below — they must stay in lockstep, or the faint vertical
// lines drift away from the chevron column they're meant to align with.
const INDENT_EM = 1.2;

// Faint vertical guide lines through a row's indentation, one per ancestor
// level — without them, deep nesting is legible only by carefully counting
// whitespace. A single `repeating-linear-gradient` background (sized to
// exactly `depth * INDENT_EM`) draws all of a row's guide lines in one
// paint, cheaper than a DOM node per ancestor on a virtualized, possibly
// deep tree.
// `--color-border-hairline` itself is too faint to reuse here — DESIGN.md
// documents its 7% opacity as deliberately tuned for a decorative card
// boundary (~1.2:1 contrast, explicitly "not a WCAG violation" *because* a
// card edge is decorative). A guide line here is functional, not decorative
// — it's how a user traces which closing brace belongs to which node — so
// it derives from `--color-text-secondary` (already visible, already
// theme-aware) at a low but real mixed-in opacity instead.
const GUIDE_LINE_COLOR = "color-mix(in srgb, var(--color-text-secondary) 25%, transparent)";
// `.json-tree-chevron` is a `width: 1em` box with its icon centered inside
// — so a chevron's own visual center sits half an em in from its column's
// left edge (the ancestor's own `padding-left`), not at the edge itself.
// Offsetting the guide line by this same half-em is what makes each line
// land exactly under the chevron whose expand state it's tracing, instead
// of in the empty gap beside it.
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

// Find, not filter (Story 8.1 Task 2, AC7 — revised after a first pass that
// hid non-matching rows read as a DevTools object-preview filter rather than
// the find-in-page/find-in-explorer behavior a search bar is expected to
// have). The tree's own shape is never touched by searching, only by
// navigating to a match. `searchQuery` is what the input actually shows
// (instant); `debouncedQuery` is what drives the tree walk — the same
// 200ms-class debounce `JsonView.vue` already uses for live re-parsing, so a
// keystroke on a large document doesn't force a full re-walk per character.
const searchQuery = ref("");
const debouncedQuery = ref("");
const debouncedSetQuery = debounce((value: string) => {
  debouncedQuery.value = value;
}, 150);
watch(searchQuery, (value) => debouncedSetQuery(value), { immediate: true });
onUnmounted(() => debouncedSetQuery.cancel());

function clearSearch() {
  searchQuery.value = "";
}

const isSearching = computed(() => debouncedQuery.value.trim() !== "");

const matches = computed(() => {
  if (props.value === null || !isSearching.value) return [];
  return findMatches(props.value, debouncedQuery.value);
});

const currentMatchIndex = ref(0);
const currentMatchPath = computed(() => matches.value[currentMatchIndex.value]?.path ?? null);

// Jumps to match `index` (wrapping around at either end, matching standard
// find-bar Next/Previous behavior), expanding whichever of its ancestors
// aren't already open and scrolling it into view. Deliberately does *not*
// move keyboard focus into the tree — focus stays in the search input the
// same way a browser's own Ctrl+F bar keeps focus put, so repeated
// Enter/Shift+Enter keeps cycling matches without the user needing to click
// back into the search box each time.
async function goToMatch(index: number) {
  const total = matches.value.length;
  if (total === 0) return;
  const wrapped = ((index % total) + total) % total;
  currentMatchIndex.value = wrapped;

  const match = matches.value[wrapped];
  if (!match) return;

  let needsExpand = false;
  const next = new Set(expanded.value);
  for (const ancestorPath of match.ancestorPaths) {
    if (!next.has(ancestorPath)) {
      next.add(ancestorPath);
      needsExpand = true;
    }
  }
  if (needsExpand) {
    expanded.value = next;
    await nextTick(); // let `rows`/the virtualizer recompute before scrolling
  }

  const rowIndex = rows.value.findIndex((r) => r.path === match.path);
  if (rowIndex !== -1) virtualizer.value.scrollToIndex(rowIndex, { align: "center" });
}

// A fresh query (or the query being cleared) always re-anchors to the first
// match rather than leaving `currentMatchIndex` pointing at a now-unrelated
// position in the new match list.
watch(matches, (newMatches) => {
  if (newMatches.length > 0) {
    void goToMatch(0);
  } else {
    currentMatchIndex.value = 0;
  }
});

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  void goToMatch(currentMatchIndex.value + (event.shiftKey ? -1 : 1));
}
</script>

<template>
  <p
    v-if="value === null"
    role="status"
  >
    {{ t('tools.json.treeUnavailable') }}
  </p>
  <template v-else>
    <div class="json-tree-search">
      <input
        id="json-tree-search-input"
        v-model="searchQuery"
        type="text"
        :aria-label="t('tools.json.explorerSearchLabel')"
        :placeholder="t('tools.json.explorerSearchPlaceholder')"
        @keydown.escape="clearSearch"
        @keydown="onSearchKeydown"
      >
      <span
        v-if="isSearching"
        class="json-tree-search-status"
      >
        <span
          role="status"
          class="json-tree-match-count"
        >{{
          matches.length === 0
            ? t('tools.json.explorerNoMatches')
            : t('tools.json.explorerMatchPosition', { current: currentMatchIndex + 1, total: matches.length })
        }}</span>
        <button
          type="button"
          class="json-tree-nav-button"
          :disabled="matches.length === 0"
          :aria-label="t('tools.json.explorerPreviousMatch')"
          :title="t('tools.json.explorerPreviousMatch')"
          @click="goToMatch(currentMatchIndex - 1)"
        >
          <PhCaretUp aria-hidden="true" />
        </button>
        <button
          type="button"
          class="json-tree-nav-button"
          :disabled="matches.length === 0"
          :aria-label="t('tools.json.explorerNextMatch')"
          :title="t('tools.json.explorerNextMatch')"
          @click="goToMatch(currentMatchIndex + 1)"
        >
          <PhCaretDown aria-hidden="true" />
        </button>
      </span>
    </div>
    <div
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
            paddingLeft: `${row.depth * INDENT_EM}em`,
            ...indentGuideStyle(row.depth),
          }"
          @click="toggle(virtualRow.index)"
          @keydown="onKeydown($event, virtualRow.index)"
          @focus="focusedPath = row.path"
        >
          <span class="json-tree-chevron">
            <component
              :is="row.expanded ? PhCaretDown : PhCaretRight"
              v-if="row.expandable"
              aria-hidden="true"
            />
          </span>
          <span
            v-if="row.keyLabel !== null"
            class="json-tree-key"
          ><template
            v-for="(seg, i) in highlightSegments(row.keyLabel, debouncedQuery)"
            :key="i"
          ><mark
            v-if="seg.matched"
            class="json-tree-highlight"
            :class="{ 'json-tree-highlight-current': row.path === currentMatchPath }"
          >{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template>:</span>
          <span
            class="json-tree-preview"
            :class="{ 'json-tree-summary': row.expandable }"
          ><template
            v-for="(seg, i) in highlightSegments(row.preview, debouncedQuery)"
            :key="i"
          ><mark
            v-if="seg.matched"
            class="json-tree-highlight"
            :class="{ 'json-tree-highlight-current': row.path === currentMatchPath }"
          >{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template></span>
          <span class="json-tree-row-actions">
            <button
              type="button"
              class="json-tree-copy-button"
              :aria-label="t('tools.json.copyValueAriaLabel')"
              :title="t('tools.json.copyValueAriaLabel')"
              @click.stop="copyValue(row)"
            >
              <PhCopySimple aria-hidden="true" />
            </button>
            <button
              type="button"
              class="json-tree-copy-button"
              :aria-label="t('tools.json.copyPathAriaLabel')"
              :title="t('tools.json.copyPathAriaLabel')"
              @click.stop="copyPath(row)"
            >
              <PhLink aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.json-tree-search {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-2);
}

.json-tree-search input {
  flex: 1;
  max-width: 24em;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
}

/* The input's own focus ring protrudes 4px beyond its border (base.css:
   2px outline + 2px offset) — this needs real clearance from it, not just
   a token-sized gap, or the ring visually overlaps the count/nav buttons
   the moment the input is focused (the actual bug report). */
.json-tree-search-status {
  display: flex;
  align-items: center;
  gap: 0.2em;
  margin-left: 0.75em;
  flex-shrink: 0;
}

.json-tree-match-count {
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  white-space: nowrap;
  margin-right: 0.2em;
}

.json-tree-nav-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.json-tree-nav-button svg {
  width: 14px;
  height: 14px;
}

.json-tree-nav-button:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-bg-base);
}

.json-tree-nav-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.json-tree-nav-button:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.json-tree-scroll {
  height: 100%;
  overflow-y: auto;
}

.json-tree-row {
  display: flex;
  gap: 0.4em;
  align-items: center;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  cursor: default;
}

.json-tree-row:hover {
  background: var(--color-border-hairline);
}

.json-tree-row:focus {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: -2px;
}

/* Two-tier highlight, not a whole-row outline (an earlier pass tried
   outlining the current-match row — developer feedback: the signal should
   live on the matched text itself, distinguishing "one of the matches"
   from "the one you're on", the way a real find bar does). Both tiers stay
   in the same signature hue for restraint (DESIGN.md reserves orange as a
   single accent, not a rainbow) — `-current` is just the fuller-strength
   version of the same tint. */
.json-tree-highlight {
  background: color-mix(in srgb, var(--color-accent-signature) 18%, transparent);
  color: inherit;
  border-radius: 2px;
}

.json-tree-highlight-current {
  background: var(--color-accent-signature);
  color: #ffffff;
  font-weight: 600;
}

/* Fixed-width regardless of expandability, so every row's key/value starts
   at the same x position — a leaf row still reserves the column, just
   leaves it empty, rather than the whole tree jaggedly re-indenting itself
   between expandable and leaf rows at the same depth. */
.json-tree-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.json-tree-chevron svg {
  width: 0.8em;
  height: 0.8em;
}

.json-tree-key {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.json-tree-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  color: var(--color-text-primary);
}

/* The collapsed "{N keys}"/"[N items]" summary is metadata about the node,
   not a value the document actually contains — styled like `.json-tree-key`
   (muted, not the leaf-value color) so it reads as structural information,
   not as if the node's real content were a literal string "{2 keys}". */
.json-tree-summary {
  color: var(--color-text-secondary);
  font-style: italic;
}

.json-tree-row-actions {
  display: flex;
  gap: 0.2em;
  flex-shrink: 0;
  opacity: 0;
}

.json-tree-row:hover .json-tree-row-actions,
.json-tree-row:focus-within .json-tree-row-actions {
  opacity: 1;
}

/* Fixed px, not em: the row's own font-size is `--font-code-size` (13px) —
   sizing the icon relative to that made both the hit target and the glyph
   too small to read at a glance. A copy icon's legibility floor doesn't
   scale down with the surrounding text the way a letterform can. */
.json-tree-copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.json-tree-copy-button svg {
  width: 16px;
  height: 16px;
}

.json-tree-copy-button:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-base);
}

.json-tree-copy-button:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
  opacity: 1;
}
</style>
