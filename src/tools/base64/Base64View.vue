<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { readClipboardText, writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { isToolError, type ToolError } from "../../shell/toolError";
import { lastDrop } from "../../shell/dropZone";

type Alphabet = "standard" | "url_safe";

const input = ref("");
const output = ref("");
const alphabet = ref<Alphabet>("standard");
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

async function onEncode() {
  await runTransform(() =>
    invoke<string>("base64_encode", { input: input.value, url_safe: alphabet.value === "url_safe" }),
  );
}

async function onDecode() {
  await runTransform(() => invoke<string>("base64_decode", { input: input.value }));
}

async function onFileDropped(path: string) {
  await runTransform(() =>
    invoke<string>("base64_encode_file", { path, url_safe: alphabet.value === "url_safe" }),
  );
}

watch(lastDrop, (drop) => {
  if (!drop || drop.toolId !== "base64") return;
  // Single dropped file only (explicit scope limitation); one-shot signal
  // so a stale drop can't re-trigger if this view remounts.
  onFileDropped(drop.paths[0]);
  lastDrop.value = null;
});

async function onDecodeToFile() {
  const path = await save();
  if (path === null) return; // user cancelled — not an error
  try {
    await invoke("base64_decode_to_file", { input: input.value, path });
  } catch (err) {
    error.value = toToolError(err);
  }
}

async function onPaste() {
  error.value = null;
  try {
    const result = await runLatestWins(() => readClipboardText());
    if (!result.superseded) {
      input.value = result.value;
      // A prior Encode/Decode result no longer corresponds to this new input.
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
    <h1>Base64</h1>

    <p class="drop-hint">
      Drop a file anywhere in the window to Base64-encode it.
    </p>

    <div class="field">
      <label for="base64-input">Text or Base64 input</label>
      <textarea
        id="base64-input"
        v-model="input"
        rows="10"
      />
    </div>

    <fieldset>
      <legend>Alphabet (used by Encode only)</legend>
      <label>
        <input
          v-model="alphabet"
          type="radio"
          name="base64-alphabet"
          value="standard"
        >
        Standard
      </label>
      <label>
        <input
          v-model="alphabet"
          type="radio"
          name="base64-alphabet"
          value="url_safe"
        >
        URL-safe
      </label>
    </fieldset>

    <div class="actions">
      <button
        type="button"
        @click="onEncode"
      >
        Encode
      </button>
      <button
        type="button"
        @click="onDecode"
      >
        Decode
      </button>
      <button
        type="button"
        @click="onPaste"
      >
        Paste from clipboard
      </button>
      <button
        type="button"
        @click="onDecodeToFile"
      >
        Decode to file
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
      <label for="base64-output">Output</label>
      <textarea
        id="base64-output"
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
.drop-hint {
  color: #666;
  font-size: 0.9em;
  border: 1px dashed #ccc;
  border-radius: 6px;
  padding: 0.6em 0.8em;
  margin-bottom: 1em;
}

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
