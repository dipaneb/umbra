<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { readClipboardText, writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, type ToolError } from "../../shell/toolError";
import type { CronExplanation } from "./cronExplanation";

const expression = ref("");
const explanation = ref<CronExplanation | null>(null);
const error = ref<ToolError | null>(null);

// This tool has exactly one write-trigger to its own state (the Explain
// action) — no drop handler, no re-firing selector — so a local runner is
// correct here, same reasoning JWT's view already established.
const runLatestWins = createLatestWinsRunner();

// Core returns unix-seconds epoch values (never milliseconds), same
// convention JwtView.vue::formatClaim already established.
function formatRun(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString();
}

async function onExplain() {
  error.value = null;
  try {
    const result = await runLatestWins(() =>
      invoke<CronExplanation>("cron_explain", { expression: expression.value }),
    );
    if (!result.superseded) {
      explanation.value = result.value;
    }
  } catch (err) {
    explanation.value = null;
    error.value = toToolError(err);
  }
}

async function onPaste() {
  error.value = null;
  try {
    const result = await runLatestWins(() => readClipboardText());
    if (!result.superseded) {
      expression.value = result.value;
      explanation.value = null;
    }
  } catch (err) {
    error.value = toToolError(err);
  }
}

async function onCopy() {
  if (!explanation.value) return;
  error.value = null;
  try {
    await writeClipboardText(explanation.value.description);
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section>
    <h1>Cron</h1>

    <div class="field">
      <label for="cron-expression-input">Cron expression</label>
      <textarea
        id="cron-expression-input"
        v-model="expression"
        rows="2"
      />
    </div>

    <div class="actions">
      <button
        type="button"
        @click="onExplain"
      >
        Explain
      </button>
      <button
        type="button"
        @click="onPaste"
      >
        Paste from clipboard
      </button>
      <button
        v-if="explanation"
        type="button"
        @click="onCopy"
      >
        Copy description
      </button>
    </div>

    <p
      v-if="error"
      role="alert"
    >
      {{ error.message }}
    </p>

    <div v-if="explanation">
      <p class="description">
        {{ explanation.description }}
      </p>

      <ul class="runs">
        <li
          v-for="(run, index) in explanation.next_runs"
          :key="index"
        >
          {{ formatRun(run) }}
        </li>
      </ul>
    </div>
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

.actions {
  display: flex;
  gap: 0.6em;
  margin-bottom: 1em;
}

p[role="alert"] {
  color: #b00020;
}

.description {
  font-weight: 600;
}

.runs {
  list-style: none;
  margin: 0;
  padding: 0;
}

.runs li {
  padding: 0.2em 0;
}
</style>
