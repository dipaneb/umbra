<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import type { UuidVersion } from "./uuidVersion";

const { t, n } = useI18n();

const MAX_COUNT = 4294967295; // u32::MAX — mirrors umbra-core's u32 command parameter

const version = ref<UuidVersion>("v4");
const count = ref(1);
const results = ref<string[]>([]);
const error = ref<ToolError | null>(null);
const clientError = ref<string | null>(null);

const runLatestWins = createLatestWinsRunner();

// uuid.rs's generate() always returns position: None, so there's no
// LineCol/ByteOffset case to render here (unlike JsonView/Base64View).
const alertMessage = computed(() =>
  clientError.value ?? (error.value ? toolErrorMessage(error.value, t) : null),
);

// A stale list generated under the previous version no longer "matches the
// selected version" (AC3) until the next Generate click — clear it rather
// than leave it looking current.
watch(version, () => {
  results.value = [];
  error.value = null;
  clientError.value = null;
});

async function onGenerate() {
  error.value = null;
  clientError.value = null;

  // Client-side input-shape guard, distinct from the server-side count == 0
  // / count > 1000 business rules: a cleared/non-numeric field produces NaN,
  // and a typed negative or over-u32::MAX number can't serialize into the
  // command's u32 parameter — neither should round-trip to `invoke` only to
  // surface a raw IPC error instead of a clean inline message. 0 itself is a
  // valid u32, so it's allowed through to hit the server's own rejection.
  if (!Number.isInteger(count.value) || count.value < 0 || count.value > MAX_COUNT) {
    clientError.value = t("tools.uuid.countOutOfRange", { max: n(MAX_COUNT, "grouped") });
    return;
  }

  const requestedVersion = version.value;
  try {
    const result = await runLatestWins(() =>
      invoke<string[]>("uuid_generate", { version: version.value, count: count.value }),
    );
    if (!result.superseded && version.value === requestedVersion) {
      results.value = result.value;
    }
  } catch (err) {
    if (version.value === requestedVersion) {
      results.value = [];
      error.value = toToolError(err);
    }
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
    <h1>{{ t('tools.uuid.heading') }}</h1>

    <fieldset>
      <legend>{{ t('tools.uuid.versionLegend') }}</legend>
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
      <label for="uuid-count">{{ t('tools.uuid.countLabel') }}</label>
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
        {{ t('tools.uuid.generate') }}
      </button>
      <button
        v-if="results.length > 1"
        type="button"
        @click="onCopyAll"
      >
        {{ t('tools.uuid.copyAll') }}
      </button>
    </div>

    <p
      v-if="alertMessage"
      role="alert"
    >
      {{ alertMessage }}
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
          {{ t('common.copy') }}
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
  /* Was a fixed 8em — tight enough that "Count"/"Nombre" plus the number
     input could crowd. This field only ever holds a label + a number input,
     so a max-width is still useful to keep it from stretching full-width,
     just wide enough to survive French's longer labels. */
  max-width: 16em;
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
