<script setup lang="ts">
import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { readClipboardText, writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { isToolError, type ToolError } from "../../shell/toolError";
import type { JsonIndent } from "./jsonIndent";

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
  if (position?.kind === "ByteOffset") {
    return `(offset ${position.offset})`;
  }
  return null;
});

function toToolError(err: unknown): ToolError {
  return isToolError(err) ? err : { code: "unknown", message: String(err), position: null, context: null };
}

async function runTransform(task: () => Promise<string>) {
  // Cleared unconditionally, before we know if this call wins the latest-wins
  // race: whichever call turns out to be newest already cleared it when IT
  // started, so a stale error can never linger next to a fresher result.
  error.value = null;
  try {
    const result = await runLatestWins(task);
    if (!result.superseded) {
      output.value = result.value;
    }
  } catch (err) {
    // Also clear output: a failed transform must never leave a *previous*
    // success sitting next to the new error looking like the current result.
    output.value = "";
    error.value = toToolError(err);
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
  error.value = null;
  try {
    const result = await runLatestWins(() => readClipboardText());
    if (!result.superseded) {
      input.value = result.value;
      // A prior Format/Minify result no longer corresponds to this new input.
      output.value = "";
    }
  } catch (err) {
    error.value = toToolError(err);
  }
}

async function onCopy() {
  error.value = null;
  try {
    await writeClipboardText(output.value);
  } catch (err) {
    error.value = toToolError(err);
  }
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
