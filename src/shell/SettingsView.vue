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
  void settings.setRestoreEnabled(checked).catch((error: unknown) => {
    console.error("settings: failed to persist restore toggle", error);
  });
}

async function onClearAll(): Promise<void> {
  try {
    await settings.clearAll();
    await refreshEntries();
  } catch (error) {
    console.error("settings: failed to clear persisted settings", error);
  }
}
</script>

<template>
  <section aria-labelledby="settings-heading">
    <h1 id="settings-heading">
      Settings
    </h1>

    <h2>Privacy</h2>
    <p>
      Umbra makes zero network calls except one, explicitly disclosed: the automatic
      check for app updates. Installing an update always requires your explicit
      confirmation first — nothing installs silently. There is no telemetry anywhere
      in the app.
    </p>

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
