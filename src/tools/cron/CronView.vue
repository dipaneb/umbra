<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { readClipboardText, writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, type ToolError } from "../../shell/toolError";
import type { CronExplanation, ScheduleParseResult } from "./cronExplanation";

const expression = ref("");
const explanation = ref<CronExplanation | null>(null);
const error = ref<ToolError | null>(null);

const phrase = ref("");
const parseResult = ref<ScheduleParseResult | null>(null);
const parseError = ref<ToolError | null>(null);

// Explain and Paste are independent write-triggers to this view's state — a
// shared runner would wrongly mark one action's in-flight result as
// "superseded" just because the other action started, even though they
// don't race on the same state. Each gets its own runner instance, mirroring
// the per-action-not-shared pattern the registry store uses per-tool.
const runExplain = createLatestWinsRunner();
const runPaste = createLatestWinsRunner();

// A third, independent write-trigger to this view's state (the NL->cron
// section operates on `phrase`/`parseResult`, not `expression`/`explanation`)
// — same reasoning as runExplain/runPaste above, so it gets its own runners
// rather than reusing theirs.
const runParse = createLatestWinsRunner();
const runPasteSchedule = createLatestWinsRunner();

// Core returns unix-seconds epoch values (never milliseconds), same
// convention JwtView.vue::formatClaim already established.
function formatRun(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString();
}

async function onExplain() {
  error.value = null;
  try {
    const result = await runExplain(() =>
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
    const result = await runPaste(() => readClipboardText());
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

async function onParseSchedule() {
  parseError.value = null;
  try {
    const result = await runParse(() =>
      invoke<ScheduleParseResult>("cron_parse_schedule", { phrase: phrase.value }),
    );
    if (!result.superseded) {
      parseResult.value = result.value;
    }
  } catch (err) {
    parseResult.value = null;
    parseError.value = toToolError(err);
  }
}

async function onPasteSchedule() {
  parseError.value = null;
  try {
    const result = await runPasteSchedule(() => readClipboardText());
    if (!result.superseded) {
      phrase.value = result.value;
      parseResult.value = null;
    }
  } catch (err) {
    parseError.value = toToolError(err);
  }
}

async function onCopySchedule() {
  if (!parseResult.value) return;
  parseError.value = null;
  try {
    await writeClipboardText(parseResult.value.expression);
  } catch (err) {
    parseError.value = toToolError(err);
  }
}
</script>

<template>
  <section>
    <h1>Cron</h1>

    <div class="explain-section">
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
    </div>

    <hr>

    <div class="schedule-section">
      <h2>Schedule to cron</h2>

      <div class="field">
        <label for="cron-schedule-phrase-input">Schedule, in plain English</label>
        <textarea
          id="cron-schedule-phrase-input"
          v-model="phrase"
          rows="2"
        />
      </div>

      <div class="actions">
        <button
          type="button"
          @click="onParseSchedule"
        >
          Convert
        </button>
        <button
          type="button"
          @click="onPasteSchedule"
        >
          Paste from clipboard
        </button>
        <button
          v-if="parseResult"
          type="button"
          @click="onCopySchedule"
        >
          Copy expression
        </button>
      </div>

      <p
        v-if="parseError"
        role="alert"
      >
        {{ parseError.message }}
        <template v-if="parseError.context">
          {{ parseError.context }}
        </template>
      </p>

      <div v-if="parseResult">
        <p class="expression">
          {{ parseResult.expression }}
        </p>
        <p class="description">
          {{ parseResult.description }}
        </p>

        <ul class="runs">
          <li
            v-for="(run, index) in parseResult.next_runs"
            :key="index"
          >
            {{ formatRun(run) }}
          </li>
        </ul>
      </div>
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

.expression {
  font-family: monospace;
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
