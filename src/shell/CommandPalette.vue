<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useRegistryStore } from "../stores/registry";
import { searchTools } from "./paletteSearch";

const registry = useRegistryStore();
const router = useRouter();

const listboxId = "command-palette-listbox";

const isOpen = ref(false);
const query = ref("");
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

let previouslyFocused: HTMLElement | null = null;

const results = computed(() => searchTools(registry.tools, query.value));

watch(results, () => {
  activeIndex.value = 0;
});

const activeOptionId = computed(() =>
  results.value[activeIndex.value]
    ? `palette-option-${results.value[activeIndex.value].id}`
    : undefined,
);

async function open() {
  previouslyFocused = document.activeElement as HTMLElement | null;
  query.value = "";
  activeIndex.value = 0;
  isOpen.value = true;
  await nextTick();
  inputRef.value?.focus();
}

function close() {
  isOpen.value = false;
  previouslyFocused?.focus();
}

function moveActive(delta: number) {
  if (results.value.length === 0) return;
  activeIndex.value =
    (activeIndex.value + delta + results.value.length) % results.value.length;
}

async function selectActive() {
  const tool = results.value[activeIndex.value];
  if (tool) {
    await router.push({ name: tool.id });
    close();
  }
}

function onKeydown(event: KeyboardEvent) {
  const isShortcut =
    (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
  if (isShortcut) {
    event.preventDefault();
    open();
    return;
  }
  if (!isOpen.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    moveActive(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveActive(-1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    selectActive();
  } else if (event.key === "Tab") {
    event.preventDefault();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown, true);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <div
    v-if="isOpen"
    class="palette-overlay"
  >
    <div class="palette">
      <input
        ref="inputRef"
        v-model="query"
        aria-label="Search tools"
        placeholder="Search tools by name or alias…"
        role="combobox"
        :aria-expanded="results.length > 0"
        :aria-controls="results.length > 0 ? listboxId : undefined"
        :aria-activedescendant="activeOptionId"
      >
      <ul
        v-if="results.length > 0"
        :id="listboxId"
        role="listbox"
      >
        <li
          v-for="(tool, index) in results"
          :id="`palette-option-${tool.id}`"
          :key="tool.id"
          role="option"
          :aria-selected="index === activeIndex"
          :class="{ active: index === activeIndex }"
        >
          <span aria-hidden="true">{{ tool.icon }}</span>
          {{ tool.name }}
        </li>
      </ul>
      <p
        v-else
        role="status"
      >
        No tools match "{{ query }}".
      </p>
    </div>
  </div>
</template>

<style scoped>
.palette-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  background: rgba(0, 0, 0, 0.4);
}

.palette {
  width: 480px;
  max-width: 90vw;
  max-height: 60vh;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.8em 1em;
  border: none;
  border-bottom: 1px solid #e0e0e0;
  font-size: 1em;
  outline: none;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0.4em 0;
  max-height: calc(60vh - 3em);
  overflow: auto;
}

li {
  padding: 0.6em 1em;
}

li.active {
  background: #396cd8;
  color: #fff;
}

p[role="status"] {
  padding: 1em;
  margin: 0;
  color: #666;
}
</style>
