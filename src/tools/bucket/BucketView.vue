<script setup lang="ts">
import { ref, watch } from "vue";
import { useRegistryStore } from "../../stores/registry";
import { writeClipboardText } from "../../shell/clipboard";
import { toToolError, type ToolError } from "../../shell/toolError";
import type { OcrOutcome } from "./ocrOutcome";

type BucketResult = { toolId: string; value: unknown } | { toolId: string; error: ToolError };

const outcome = ref<OcrOutcome | null>(null);
const error = ref<ToolError | null>(null);
// AC2: editable in place, re-seeded from each new `outcome.text` as it arrives; Copy always
// copies this current edited value, not the original `outcome.text`.
const editedText = ref("");

const registry = useRegistryStore();

// AD-14: `DropZone.vue` is the shell's single generic dispatcher — it
// invokes `bucket_extract_text` itself, already routed through
// `registry.getLatestWinsRunner("bucket")` (AD-16) on its own. This view
// only consumes the outcome via `registry.dropResult`; no local
// `createLatestWinsRunner()` here — Story 4.2 adds a second write-trigger
// (clipboard-paste) that must share this same tool-scoped runner, not a
// separate one (ARCHITECTURE-SPINE.md's AD-16 amendment, `HashView.vue` is
// the reference implementation for that shape).
function applyBucketResult(result: BucketResult) {
  if ("error" in result) {
    outcome.value = null;
    error.value = result.error;
  } else {
    error.value = null;
    outcome.value = result.value as OcrOutcome;
    editedText.value = outcome.value.text;
  }
}

watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "bucket") return;
    registry.dropResult = null; // one-shot signal
    applyBucketResult(result);
  },
);

// Story 4.2: paste dispatches through the same registry-declared handler shape as drop
// (`getLatestWinsRunner("bucket")` shared by both, per AD-16's amendment), delivered via its own
// `pasteResult` field rather than repurposing `dropResult` — five other tools depend on
// `dropResult` meaning "a file-drop outcome" exactly.
watch(
  () => registry.pasteResult,
  (result) => {
    if (!result || result.toolId !== "bucket") return;
    registry.pasteResult = null; // one-shot signal
    applyBucketResult(result);
  },
);

async function onCopy() {
  error.value = null;
  try {
    await writeClipboardText(editedText.value);
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section>
    <h1>Bucket</h1>

    <p class="drop-hint">
      Drop a PNG, JPEG, or WebP image anywhere in the window, or paste (⌘V), to extract its text.
    </p>

    <p
      v-if="error"
      role="alert"
    >
      {{ error.message }}
    </p>

    <p
      v-if="outcome && !outcome.text"
      role="status"
    >
      No text was found in this image.
    </p>

    <div
      v-if="outcome && outcome.text"
      class="field"
    >
      <label for="bucket-result">Extracted text</label>
      <textarea
        id="bucket-result"
        v-model="editedText"
        class="result"
        rows="10"
      />
      <button
        type="button"
        @click="onCopy"
      >
        Copy
      </button>
    </div>
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

p[role="alert"] {
  color: #b00020;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}

.result {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0.8em;
}
</style>
