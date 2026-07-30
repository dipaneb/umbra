<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, type ToolError } from "../../shell/toolError";
import type { UuidVersion } from "./uuidVersion";

const version = ref<UuidVersion>("v4");
const count = ref(1);
const results = ref<string[]>([]);
const error = ref<ToolError | null>(null);
const clientError = ref<string | null>(null);

const runLatestWins = createLatestWinsRunner();

const errorLocation = computed(() => {
  const position = error.value?.position;
  if (position?.kind === "LineCol") {
    return `(line ${position.line}, column ${position.column})`;
  }
  if (position?.kind === "ByteOffset") {
    return `(offset ${position.offset})`;
  }
  return null;
});

const alertMessage = computed(() => clientError.value ?? error.value?.message ?? null);

// A stale list generated under the previous version no longer "matches the
// selected version" (AC3) until the next Generate click — clear it rather
// than leave it looking current.
watch(version, () => {
  results.value = [];
  error.value = null;
});

async function onGenerate() {
  error.value = null;
  clientError.value = null;

  // Client-side input-shape guard, distinct from the server-side count == 0
  // / count > 1000 business rules: a cleared/non-numeric field produces NaN,
  // and a typed negative number can't serialize into the command's u32
  // parameter — neither should round-trip to `invoke` only to surface a raw
  // IPC error instead of a clean inline message.
  if (!Number.isInteger(count.value) || count.value < 1) {
    clientError.value = "Enter a whole number of at least 1.";
    return;
  }

  try {
    const result = await runLatestWins(() =>
      invoke<string[]>("uuid_generate", { version: version.value, count: count.value }),
    );
    if (!result.superseded) {
      results.value = result.value;
    }
  } catch (err) {
    results.value = [];
    error.value = toToolError(err);
  }
}

async function onCopyOne(uuid: string) {
  error.value = null;
  try {
    await writeClipboardText(uuid);
  } catch (err) {
    error.value = toToolError(err);
  }
}

async function onCopyAll() {
  error.value = null;
  try {
    await writeClipboardText(results.value.join("\n"));
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section>
    <h1>UUID</h1>

    <fieldset>
      <legend>Version</legend>
      <label>
        <input
          v-model="version"
          type="radio"
          name="uuid-version"
          value="v4"
        >
        v4
      </label>
      <label>
        <input
          v-model="version"
          type="radio"
          name="uuid-version"
          value="v7"
        >
        v7
      </label>
    </fieldset>

    <div class="field">
      <label for="uuid-count">Count</label>
      <input
        id="uuid-count"
        v-model.number="count"
        type="number"
        min="1"
      >
    </div>

    <div class="actions">
      <button
        type="button"
        @click="onGenerate"
      >
        Generate
      </button>
      <button
        v-if="results.length > 1"
        type="button"
        @click="onCopyAll"
      >
        Copy all
      </button>
    </div>

    <p
      v-if="alertMessage"
      role="alert"
    >
      {{ alertMessage }}<template v-if="errorLocation">
        {{ errorLocation }}
      </template>
    </p>

    <ul
      v-if="results.length"
      class="results"
    >
      <li
        v-for="(uuid, index) in results"
        :key="index"
      >
        <code>{{ uuid }}</code>
        <button
          type="button"
          @click="onCopyOne(uuid)"
        >
          Copy
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  margin-bottom: 1em;
  max-width: 8em;
}

fieldset {
  margin-bottom: 1em;
}

.actions {
  display: flex;
  gap: 0.6em;
  margin-bottom: 1em;
}

p[role="alert"] {
  color: #b00020;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
}

.results li {
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding: 0.2em 0;
}

.results code {
  font-family: monospace;
}
</style>
