<script setup lang="ts">
// DESIGN.md's Tab component (`{colors.accent-default}` underline for active,
// `{colors.text-secondary}` for inactive — Components, Do's-and-Don'ts) —
// specced since Story 7.1 but unused until Story 8.1's tabbed JSON redesign.
// Standard WAI-ARIA tablist keyboard pattern: ArrowLeft/ArrowRight/Home/End
// move both focus and selection (single-select tabs activate on arrow, not
// just Enter/Space).
export interface AppTab {
  id: string;
  label: string;
}

const props = defineProps<{
  tabs: AppTab[];
  modelValue: string;
}>();

const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

function selectByIndex(index: number) {
  const tab = props.tabs[index];
  if (!tab) return;
  emit("update:modelValue", tab.id);
  document.getElementById(`tab-${tab.id}`)?.focus();
}

function onKeydown(event: KeyboardEvent, index: number) {
  switch (event.key) {
    case "ArrowRight":
      event.preventDefault();
      selectByIndex((index + 1) % props.tabs.length);
      break;
    case "ArrowLeft":
      event.preventDefault();
      selectByIndex((index - 1 + props.tabs.length) % props.tabs.length);
      break;
    case "Home":
      event.preventDefault();
      selectByIndex(0);
      break;
    case "End":
      event.preventDefault();
      selectByIndex(props.tabs.length - 1);
      break;
  }
}
</script>

<template>
  <div
    role="tablist"
    class="app-tabs"
  >
    <button
      v-for="(tab, index) in tabs"
      :id="`tab-${tab.id}`"
      :key="tab.id"
      type="button"
      role="tab"
      class="app-tab"
      :class="{ active: tab.id === modelValue }"
      :aria-selected="tab.id === modelValue"
      :aria-controls="`tabpanel-${tab.id}`"
      :tabindex="tab.id === modelValue ? 0 : -1"
      @click="emit('update:modelValue', tab.id)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.app-tabs {
  display: flex;
  gap: var(--spacing-4);
  border-bottom: 1px solid var(--color-border-hairline);
  margin-bottom: var(--spacing-4);
}

.app-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: var(--spacing-2) var(--spacing-1);
  margin-bottom: -1px;
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.app-tab.active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-accent-default);
}

.app-tab:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
}
</style>
