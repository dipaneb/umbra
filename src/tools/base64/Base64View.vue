<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { readClipboardText, writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import { useRegistryStore } from "../../stores/registry";

const { t } = useI18n();

type Alphabet = "standard" | "url_safe";

const input = ref("");
const output = ref("");
const alphabet = ref<Alphabet>("standard");
const error = ref<ToolError | null>(null);
const decodingToFile = ref(false);

const registry = useRegistryStore();

const runLatestWins = createLatestWinsRunner();

const errorLocation = computed(() => {
  const position = error.value?.position;
  if (position?.kind === "LineCol") {
    return t("common.positionLineCol", { line: position.line, column: position.column });
  }
  if (position?.kind === "ByteOffset") {
    return t("common.positionByteOffset", { offset: position.offset });
  }
  return null;
});

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

// AD-14: `DropZone.vue` is the shell's single generic dispatcher and
// invokes `base64_encode_file` itself; this view only supplies the
// tool-specific `url_safe` argument the dispatcher can't know on its own,
// and consumes the outcome via `registry.dropResult` below.
function dropArgsProvider() {
  return { url_safe: alphabet.value === "url_safe" };
}

onMounted(() => registry.setDropArgsProvider("base64", dropArgsProvider));
onUnmounted(() => registry.setDropArgsProvider("base64", null));

watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "base64") return;
    registry.dropResult = null; // one-shot signal
    if ("error" in result) {
      output.value = "";
      error.value = result.error;
    } else {
      error.value = null;
      output.value = result.value as string;
    }
  },
);

async function onDecodeToFile() {
  error.value = null;
  decodingToFile.value = true;
  try {
    const path = await save();
    if (path === null) return; // user cancelled — not an error
    await invoke("base64_decode_to_file", { input: input.value, path });
  } catch (err) {
    error.value = toToolError(err);
  } finally {
    decodingToFile.value = false;
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
    <h1>{{ t('tools.base64.heading') }}</h1>

    <p class="drop-hint">
      {{ t('tools.base64.dropHint') }}
    </p>

    <div class="field">
      <label for="base64-input">{{ t('tools.base64.inputLabel') }}</label>
      <textarea
        id="base64-input"
        v-model="input"
        rows="10"
      />
    </div>

    <fieldset>
      <legend>{{ t('tools.base64.alphabetLegend') }}</legend>
      <label>
        <input
          v-model="alphabet"
          type="radio"
          name="base64-alphabet"
          value="standard"
        >
        {{ t('tools.base64.alphabetStandard') }}
      </label>
      <label>
        <input
          v-model="alphabet"
          type="radio"
          name="base64-alphabet"
          value="url_safe"
        >
        {{ t('tools.base64.alphabetUrlSafe') }}
      </label>
    </fieldset>

    <div class="actions">
      <button
        type="button"
        @click="onEncode"
      >
        {{ t('tools.base64.encode') }}
      </button>
      <button
        type="button"
        @click="onDecode"
      >
        {{ t('tools.base64.decode') }}
      </button>
      <button
        type="button"
        @click="onPaste"
      >
        {{ t('common.pasteFromClipboard') }}
      </button>
      <button
        type="button"
        :disabled="decodingToFile"
        @click="onDecodeToFile"
      >
        {{ t('tools.base64.decodeToFile') }}
      </button>
    </div>

    <p
      v-if="error"
      role="alert"
    >
      {{ toolErrorMessage(error, t) }}<template v-if="errorLocation">
        {{ errorLocation }}
      </template>
    </p>

    <div class="field">
      <label for="base64-output">{{ t('tools.base64.outputLabel') }}</label>
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
      {{ t('common.copyToClipboard') }}
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
  flex-wrap: wrap;
  gap: 0.6em;
  margin-bottom: 1em;
}

p[role="alert"] {
  color: #b00020;
}
</style>
