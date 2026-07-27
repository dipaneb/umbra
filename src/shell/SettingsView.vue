<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useSettingsStore } from "../stores/settings";

const settings = useSettingsStore();
const persistedEntries = ref<[string, unknown][]>([]);

async function refreshEntries(): Promise<void> {
  persistedEntries.value = await settings.entries();
}

onMounted(refreshEntries);

function onToggleRestore(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  void settings.setRestoreEnabled(checked);
}

async function onClearAll(): Promise<void> {
  await settings.clearAll();
  await refreshEntries();
}
</script>

<template>
  <section aria-labelledby="settings-heading">
    <h1 id="settings-heading">
      Settings
    </h1>

    <label class="restore-toggle">
      <input
        type="checkbox"
        aria-label="Restore last tool and window position on launch"
        :checked="settings.restoreEnabled"
        @change="onToggleRestore"
      >
      Restore last tool and window position on launch
    </label>

    <h2>Persisted data</h2>
    <ul
      v-if="persistedEntries.length"
      class="entries"
    >
      <li
        v-for="[key, value] in persistedEntries"
        :key="key"
      >
        <code>{{ key }}</code>: {{ JSON.stringify(value) }}
      </li>
    </ul>
    <p v-else>
      Nothing is currently persisted.
    </p>

    <button
      type="button"
      aria-label="Clear all persisted settings"
      @click="onClearAll"
    >
      Clear all
    </button>
  </section>
</template>

<style scoped>
.restore-toggle {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin: 1em 0;
}

.entries {
  list-style: none;
  margin: 0;
  padding: 0;
}

.entries li {
  padding: 0.3em 0;
  font-family: monospace;
}

input:focus-visible,
button:focus-visible {
  outline: 2px solid #396cd8;
  outline-offset: 2px;
}
</style>
