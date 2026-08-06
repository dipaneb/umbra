<script setup lang="ts">
import { ref, watch } from "vue";
import { useRegistryStore } from "../../stores/registry";
import type { ToolError } from "../../shell/toolError";
import type { OcrOutcome } from "./ocrOutcome";

const outcome = ref<OcrOutcome | null>(null);
const error = ref<ToolError | null>(null);

const registry = useRegistryStore();

// AD-14: `DropZone.vue` is the shell's single generic dispatcher — it
// invokes `bucket_extract_text` itself, already routed through
// `registry.getLatestWinsRunner("bucket")` (AD-16) on its own. This view
// only consumes the outcome via `registry.dropResult`; no local
// `createLatestWinsRunner()` here — Story 4.2 adds a second write-trigger
// (clipboard-paste) that must share this same tool-scoped runner, not a
// separate one (ARCHITECTURE-SPINE.md's AD-16 amendment, `HashView.vue` is
// the reference implementation for that shape).
watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "bucket") return;
    registry.dropResult = null; // one-shot signal
    if ("error" in result) {
      outcome.value = null;
      error.value = result.error;
    } else {
      error.value = null;
      outcome.value = result.value as OcrOutcome;
    }
  },
);
</script>

<template>
  <section>
    <h1>Bucket</h1>

    <p class="drop-hint">
      Drop a PNG, JPEG, or WebP image anywhere in the window to extract its text.
    </p>

    <p
      v-if="error"
      role="alert"
    >
      {{ error.message }}
    </p>

    <pre
      v-if="outcome"
      class="result"
    >{{ outcome.text }}</pre>
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

.result {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0.8em;
}
</style>
