<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { readClipboardText, writeClipboardText } from "../../shell/clipboard";
import { toToolError, type ToolError } from "../../shell/toolError";
import { useRegistryStore } from "../../stores/registry";
import type { HashDigests } from "./hashDigests";

type CaseMode = "lower" | "upper";

const ROW_DEFS: { key: keyof HashDigests; label: string; legacy: boolean }[] = [
  { key: "sha256", label: "SHA-256", legacy: false },
  { key: "sha512", label: "SHA-512", legacy: false },
  { key: "md5", label: "MD5", legacy: true },
  { key: "sha1", label: "SHA-1", legacy: true },
];

const input = ref("");
const digests = ref<HashDigests | null>(null);
const caseMode = ref<CaseMode>("lower");
const error = ref<ToolError | null>(null);

const registry = useRegistryStore();
// AD-16: shared with `DropZone.vue`'s file-drop dispatch for this same
// "hash" tool, so a manual Compute/Paste and an in-flight file drop
// participate in one latest-wins sequence instead of two uncoordinated ones.
const runLatestWins = registry.getLatestWinsRunner("hash");

// AD-14: `DropZone.vue` is the shell's single generic dispatcher and
// invokes `hash_compute_file` itself; this view only consumes the outcome
// via `registry.dropResult` — no `dropArgsProvider` is needed since
// `hash_compute_file` takes only `path`.
watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "hash") return;
    registry.dropResult = null; // one-shot signal
    if ("error" in result) {
      digests.value = null;
      error.value = result.error;
    } else {
      error.value = null;
      digests.value = result.value as HashDigests;
    }
  },
);

// A pure view-side re-render, never a new `hash_compute` call — `compute()`
// always returns lowercase hex (AD-1: case is presentation, not core logic).
const rows = computed(() => {
  const current = digests.value;
  if (!current) return [];
  return ROW_DEFS.map((def) => ({
    ...def,
    value: caseMode.value === "upper" ? current[def.key].toUpperCase() : current[def.key],
  }));
});

async function onCompute() {
  error.value = null;
  try {
    const result = await runLatestWins(() => invoke<HashDigests>("hash_compute", { input: input.value }));
    if (!result.superseded) {
      digests.value = result.value;
    }
  } catch (err) {
    digests.value = null;
    error.value = toToolError(err);
  }
}

async function onPaste() {
  error.value = null;
  try {
    const result = await runLatestWins(() => readClipboardText());
    if (!result.superseded) {
      input.value = result.value;
      digests.value = null;
    }
  } catch (err) {
    error.value = toToolError(err);
  }
}

async function onCopyOne(value: string) {
  error.value = null;
  try {
    await writeClipboardText(value);
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section>
    <h1>Hash</h1>

    <p class="drop-hint">
      Drop a file anywhere in the window to hash it.
    </p>

    <div class="field">
      <label for="hash-input">Text input</label>
      <textarea
        id="hash-input"
        v-model="input"
        rows="10"
      />
    </div>

    <fieldset>
      <legend>Case</legend>
      <label>
        <input
          v-model="caseMode"
          type="radio"
          name="hash-case"
          value="lower"
        >
        lowercase
      </label>
      <label>
        <input
          v-model="caseMode"
          type="radio"
          name="hash-case"
          value="upper"
        >
        UPPERCASE
      </label>
    </fieldset>

    <div class="actions">
      <button
        type="button"
        @click="onCompute"
      >
        Compute
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
      {{ error.message }}
    </p>

    <ul
      v-if="rows.length"
      class="results"
    >
      <li
        v-for="row in rows"
        :key="row.key"
      >
        <label>{{ row.label }}<span v-if="row.legacy"> (legacy)</span></label>
        <code>{{ row.value }}</code>
        <button
          type="button"
          @click="onCopyOne(row.value)"
        >
          Copy
        </button>
      </li>
    </ul>
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

.results {
  list-style: none;
  margin: 0;
  padding: 0;
}

.results li {
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding: 0.4em 0;
}

.results label {
  min-width: 6em;
  font-weight: 600;
}

.results code {
  font-family: monospace;
  word-break: break-all;
}
</style>
