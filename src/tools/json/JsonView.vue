<script setup lang="ts">
import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { readClipboardText, writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import type { ToolError } from "../../shell/toolError";

type JsonIndent = "two_spaces" | "four_spaces" | "tab";

const input = ref("");
const output = ref("");
const indent = ref<JsonIndent>("two_spaces");
const error = ref<ToolError | null>(null);

const runLatestWins = createLatestWinsRunner();

const errorLocation = computed(() => {
  const position = error.value?.position;
  if (position?.kind === "LineCol") {
    return `(line ${position.line}, column ${position.column})`;
  }
  return null;
});

async function runTransform(task: () => Promise<string>) {
  error.value = null;
  try {
    const result = await runLatestWins(task);
    if (result !== undefined) {
      output.value = result;
    }
  } catch (err) {
    error.value = err as ToolError;
  }
}

async function onFormat() {
  await runTransform(() =>
    invoke<string>("json_format", { input: input.value, indent: indent.value }),
  );
}

async function onMinify() {
  await runTransform(() => invoke<string>("json_minify", { input: input.value }));
}

async function onPaste() {
  input.value = await readClipboardText();
}

async function onCopy() {
  await writeClipboardText(output.value);
}
</script>

<template>
  <section>
    <h1>JSON</h1>

    <div class="field">
      <label for="json-input">JSON input</label>
      <textarea
        id="json-input"
        v-model="input"
        aria-label="JSON input"
        rows="10"
      />
    </div>

    <fieldset>
      <legend>Indentation</legend>
      <label>
        <input
          v-model="indent"
          type="radio"
          name="json-indent"
          value="two_spaces"
        >
        2 spaces
      </label>
      <label>
        <input
          v-model="indent"
          type="radio"
          name="json-indent"
          value="four_spaces"
        >
        4 spaces
      </label>
      <label>
        <input
          v-model="indent"
          type="radio"
          name="json-indent"
          value="tab"
        >
        Tab
      </label>
    </fieldset>

    <div class="actions">
      <button
        type="button"
        @click="onFormat"
      >
        Format
      </button>
      <button
        type="button"
        @click="onMinify"
      >
        Minify
      </button>
      <button
        type="button"
        @click="onPaste"
      >
        Paste from clipboard
      </button>
    </div>

    <p
      v-if="error"
      role="alert"
    >
      {{ error.message }}<template v-if="errorLocation">
        {{ errorLocation }}
      </template>
    </p>

    <div class="field">
      <label for="json-output">JSON output</label>
      <textarea
        id="json-output"
        aria-label="JSON output"
        readonly
        rows="10"
        :value="output"
      />
    </div>

    <button
      type="button"
      :disabled="output === ''"
      @click="onCopy"
    >
      Copy to clipboard
    </button>
  </section>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  margin-bottom: 1em;
}

textarea {
  font-family: monospace;
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
</style>
