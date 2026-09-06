<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { PhCheck, PhCopySimple } from "@phosphor-icons/vue";
import { writeClipboardText } from "../../shell/clipboard";
import { debounce } from "../../shell/debounce";
import { createLatestWinsRunner } from "../../shell/invoke";
import { formatDateTime } from "../../shell/locale";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import { useSettingsStore } from "../../stores/settings";
// Per-affordance copy confirmation — the JsonTree / Base64View / HashView /
// JwtView icon-button pattern (imported cross-tool from the JSON tool with its
// existing hoist-candidate comment; the hoist is still not done — fifth
// consumer now).
import { useCopyFeedback } from "../json/useCopyFeedback";
import CronFieldEditor, { type CronFieldKey } from "./CronFieldEditor.vue";
import type { CronExplanation } from "./cronExplanation";
import { cronLocaleFor } from "./describeSchedule";
import { resolveLocale } from "../../shell/locale";
import { fieldTerms, hasUnsupportedField } from "./scheduleDescription";

// Cron field order — fixed, and shared by every array below that's indexed against it
// (fieldValues, fieldPhrases, the v-for over CronFieldEditor).
const FIELD_KEYS: CronFieldKey[] = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

const { t } = useI18n();
const settings = useSettingsStore();

// The grid opens on a sane default — never empty, never `* * * * *` (a
// per-minute firehose). Task 1 decision record + AC7.
const SEED_EXPRESSION = "0 9 * * *";

// Live-recompute debounce — the same 200 ms as Base64View / JsonView /
// HashView / JwtView.
const EXPLAIN_DEBOUNCE_MS = 200;

// Mirrors umbra-core::cron::MAX_INPUT_BYTES. Caught here on the live path before an
// over-cap paste is ever shipped over IPC; umbra-core keeps its own identical guard
// (defense in depth, AC17 — the cap holds end to end even if this one is bypassed).
// Measured as UTF-8 bytes (TextEncoder), the same unit umbra-core's `.len()` guard uses.
const MAX_INPUT_BYTES = 1024;

// The five field boxes are the only input surface (render-review pivot 2026-09-05 — a
// second, whole-string editable input was rejected as duplication). `expression` is a plain
// derived cache of `fieldValues.join(' ')` — the string sent to `cron_explain`, shown
// read-only as the canonical form, and the copy target.
const fieldValues = ref<string[]>(SEED_EXPRESSION.split(" "));
const expression = ref(SEED_EXPRESSION);
const explanation = ref<CronExplanation | null>(null);
const error = ref<ToolError | null>(null);

// The localized field-name labels, by position — mirrors CronFieldEditor.vue's own map
// (both are cron island files; the i18n key per field is config, not rendering logic).
const FIELD_LABEL_KEYS: Record<CronFieldKey, string> = {
  minute: "tools.cron.fieldMinute",
  hour: "tools.cron.fieldHour",
  dayOfMonth: "tools.cron.fieldDayOfMonth",
  month: "tools.cron.fieldMonth",
  dayOfWeek: "tools.cron.fieldDayOfWeek",
};

// Core hands over the schedule's *meaning*; the phrasing happens here, in the user's
// language (src/tools/cron/locales/). Everything below re-derives when the locale changes,
// so switching language in Settings re-renders the prose without another `cron_explain`.
const renderer = computed(() => cronLocaleFor(resolveLocale(settings.locale, navigator.languages)));

// The one-line prose sentence, suppressed when a field used syntax outside the grammar
// (`L`, `5#3`, `15W`) — the breakdown rows carry the explanation in that case.
const sentence = computed(() =>
  explanation.value ? renderer.value.sentence(explanation.value.schedule) : "",
);
const sentenceSuppressed = computed(() =>
  explanation.value ? hasUnsupportedField(explanation.value.schedule) : false,
);

// One shared source (`explanation.schedule`) feeds both each CronFieldEditor's hover title
// and the live panel's visible breakdown rows — never a second renderer.
const fieldPhrases = computed<string[]>(() => {
  if (!explanation.value) return ["", "", "", "", ""];
  const terms = fieldTerms(explanation.value.schedule);
  return FIELD_KEYS.map((key, index) => renderer.value.fieldPhrase(key, terms[index]));
});

// One row per field — `<localized field name>: <localized phrase>`.
const breakdownRows = computed(() =>
  FIELD_KEYS.map((key, index) => ({
    key,
    label: t(FIELD_LABEL_KEYS[key]),
    phrase: fieldPhrases.value[index],
  })),
);
// AC17: set instead of routing through `error` — a calm role="status" limit, not a red
// role="alert" mistake. Cleared as soon as the expression is back under the cap.
const oversize = ref(false);
// AC24: an always-present polite region — a region inserted together with its
// text is not reliably announced, so this one is always in the DOM and is
// cleared then re-set on each completed explain (an identical result still
// re-announces). Errors keep role="alert".
const announcement = ref("");

// One local runner backs the single `cron_explain` call site (AC9). The tool
// has no DropZone.vue write-surface, so `registry.getLatestWinsRunner("cron")`
// would be the wrong (coarser) scope — a plain local runner is right. The old
// four-instance arrangement (runExplain / runPaste / runParse /
// runPasteSchedule) and its documented "known caveat" dissolve with this
// single-state-group design.
const runLatestWins = createLatestWinsRunner();

const { isCopied, markCopied, cancel: cancelCopyFeedback } = useCopyFeedback();

function formatRun(epochSeconds: number): string {
  return formatDateTime(new Date(epochSeconds * 1000), settings);
}

// AC24: clear the always-present polite region, then (next tick) set it so an
// identical result still re-announces. Pass "" to just clear.
async function announce(message: string) {
  announcement.value = "";
  if (message === "") return;
  await nextTick();
  announcement.value = message;
}

// Bumped at the top of every runExplain. The empty branch returns without
// going through runLatestWins, so it can't rely on `superseded` to fence a
// slower in-flight call — this generation check does it for every exit path.
let explainGeneration = 0;

async function runExplain() {
  const generation = ++explainGeneration;
  error.value = null;
  cancelCopyFeedback();
  const value = expression.value;

  if (value.trim() === "") {
    explanation.value = null;
    oversize.value = false;
    void announce("");
    return;
  }

  // AC17: an over-cap expression never reaches IPC — and it is a calm status line, not a
  // red alert. Byte length (TextEncoder), matching umbra-core's guard, so a large
  // non-ASCII paste is caught here too. The panel is cleared, not held: whatever it showed
  // described a different, now-superseded input, and a stale result next to a message the
  // user needs to actually read invites reading the (wrong) output instead of the message
  // (developer correction 2026-09-05 — AC16's literal "hold the last valid state" text
  // is superseded by this call; the same reasoning was extended here to the sibling
  // over-cap case for consistency, per the developer's own stated rationale).
  if (new TextEncoder().encode(value).length > MAX_INPUT_BYTES) {
    oversize.value = true;
    explanation.value = null;
    void announce(t("tools.cron.oversize"));
    return;
  }
  oversize.value = false;

  try {
    const result = await runLatestWins(() =>
      invoke<CronExplanation>("cron_explain", { expression: value }),
    );
    if (result.superseded || generation !== explainGeneration) return;
    explanation.value = result.value;
    // A valid `cron_explain` result is proof `value` is exactly 5 whitespace-separated
    // fields — re-split so a pasted expression's fields land in the boxes and any odd
    // internal spacing normalizes (not a second grammar parse — that happened in core),
    // then re-join so the read-only string shows the same normalized form.
    fieldValues.value = value.trim().split(/\s+/);
    expression.value = fieldValues.value.join(" ");
    void announce(t("tools.cron.resultAnnouncement"));
  } catch (err) {
    if (generation !== explainGeneration) return;
    error.value = toToolError(err);
    // Every error — including cron-six-field-unsupported — clears the panel. See the
    // over-cap comment above for why a stale result is never left on screen. The field
    // boxes themselves are untouched: they're the source of what the user is mid-typing,
    // not something derived from the (failed) explanation.
    explanation.value = null;
    void announce("");
  }
}

const debouncedExplain = debounce(() => void runExplain(), EXPLAIN_DEBOUNCE_MS);

// Every field-box edit is a keystroke — recompose the expression (`join(' ')`) and debounce
// the re-explain, like every other tool's live-recompute input. There is no discrete
// control left in a field box (no segment, no select, no toggle), so there is no immediate
// path to take (superseding AC8's "immediately for a discrete control change" clause).
function onFieldChange(index: number, value: string) {
  fieldValues.value = fieldValues.value.map((current, i) => (i === index ? value : current));
  expression.value = fieldValues.value.join(" ");
  cancelCopyFeedback(); // AC22: clear a "copied" tick on any expression change, not just at recompute
  debouncedExplain();
}

// OTP-style auto-advance: a field emits `advance` when its value first becomes `*`. Move
// focus to the next box (nothing to do on the last field).
const fieldRefs = ref<Array<{ focus: () => void } | null>>([]);
function setFieldRef(el: unknown, index: number) {
  fieldRefs.value[index] = (el as { focus?: () => void } | null)?.focus
    ? (el as { focus: () => void })
    : null;
}
function onFieldAdvance(index: number) {
  fieldRefs.value[index + 1]?.focus();
}

// "…or paste one in to read it back": a whole cron expression pasted into any field box is
// spread across all five (or, for a 6-field paste, sent through as-is so core returns the
// honest cron-six-field-unsupported). Anything that isn't 5 or 6 whitespace-separated
// tokens falls through to a normal single-box paste.
function onGridPaste(event: ClipboardEvent) {
  const parts = (event.clipboardData?.getData("text") ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5 && parts.length !== 6) return;
  event.preventDefault();
  if (parts.length === 5) fieldValues.value = parts;
  expression.value = parts.join(" ");
  debouncedExplain.cancel();
  void runExplain();
}

onMounted(() => {
  void runExplain();
});

onUnmounted(() => {
  debouncedExplain.cancel();
  cancelCopyFeedback();
});

async function onCopyExpression() {
  error.value = null;
  try {
    await writeClipboardText(expression.value);
    // Confirm only after the write resolves — a failed write has its own
    // error-alert path and must not also flash a false confirmation.
    markCopied("expression");
  } catch (err) {
    error.value = toToolError(err);
  }
}

// AC22: the one-line prose is a secondary copy affordance (the expression string is primary).
async function onCopyDescription() {
  if (!explanation.value) return;
  error.value = null;
  try {
    await writeClipboardText(sentence.value);
    markCopied("description");
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section class="cron-view">
    <h1>{{ t('tools.cron.heading') }}</h1>
    <p class="tool-desc">
      {{ t('tools.cron.description') }}
    </p>

    <!-- The five field boxes, one compact row, in cron field order — a whole expression
         pasted into any of them is spread across all five (onGridPaste). -->
    <div
      class="grid"
      @paste="onGridPaste"
    >
      <CronFieldEditor
        v-for="(key, index) in FIELD_KEYS"
        :key="key"
        :ref="(el) => setFieldRef(el, index)"
        :field-key="key"
        :model-value="fieldValues[index]"
        :phrase="fieldPhrases[index]"
        @update:model-value="(value) => onFieldChange(index, value)"
        @advance="onFieldAdvance(index)"
      />
    </div>

    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </p>

    <p
      v-if="error"
      class="alert"
      role="alert"
    >
      {{ toolErrorMessage(error, t) }}
    </p>

    <!-- AC17: a calm limit, not a mistake — role="status", never role="alert". -->
    <p
      v-if="oversize"
      class="oversize"
      role="status"
    >
      {{ t('tools.cron.oversize') }}
    </p>

    <!-- AC23: a successful live-panel result carries role="status". The always-present
         sr-only region above is the reliable announce channel (a role region inserted
         together with its text under-announces); this role here satisfies AC23 on the
         visible panel. `explanation` is only ever non-null on a genuine success — every
         failure path (a real parse error, six-field, over-cap) clears it first. -->
    <div
      v-if="explanation"
      class="panel"
      role="status"
    >
      <!-- The composed expression as the panel's first line, over a hairline rule (chosen
           placement, render-review 2026-09-06). Only visible on a valid expression — during
           an error the panel is gone, so the string is read from the field boxes instead. -->
      <div class="expr-in-panel">
        <code class="expr-code">{{ expression }}</code>
        <button
          type="button"
          class="expr-copy"
          :aria-label="isCopied('expression') ? t('tools.cron.copied') : t('common.copyToClipboard')"
          :title="isCopied('expression') ? t('tools.cron.copied') : t('common.copyToClipboard')"
          @click="onCopyExpression"
        >
          <PhCheck
            v-if="isCopied('expression')"
            class="expr-copy-ok"
            aria-hidden="true"
          />
          <PhCopySimple
            v-else
            aria-hidden="true"
          />
        </button>
      </div>

      <!-- AC14: the prose one-liner is suppressed when it would only be the generic
           "Runs on schedule …" fallback — the breakdown rows below carry the explanation
           in that case. -->
      <div
        v-if="!sentenceSuppressed"
        class="panel-prose-row"
      >
        <p class="panel-prose">
          {{ sentence }}
        </p>
        <!-- AC22: secondary copy affordance — the prose one-liner. -->
        <button
          type="button"
          class="prose-copy"
          :aria-label="isCopied('description') ? t('tools.cron.copied') : t('common.copyToClipboard')"
          :title="isCopied('description') ? t('tools.cron.copied') : t('common.copyToClipboard')"
          @click="onCopyDescription"
        >
          <PhCheck
            v-if="isCopied('description')"
            class="prose-copy-ok"
            aria-hidden="true"
          />
          <PhCopySimple
            v-else
            aria-hidden="true"
          />
        </button>
      </div>

      <!-- AC12/AC15: one row per field — the never-shrugging breakdown, same source
           (`explanation.fields`) each CronFieldEditor's hover title reads. -->
      <ul class="breakdown">
        <li
          v-for="row in breakdownRows"
          :key="row.key"
        >
          <span class="breakdown-label">{{ row.label }}:</span>
          {{ row.phrase }}
        </li>
      </ul>

      <div class="panel-runs">
        <span class="panel-runs-label">{{ t('tools.cron.nextRunsLabel') }}</span>
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
  </section>
</template>

<style scoped>
/* Keep the tool a readable column rather than letting five short fields + a one-line
   expression sprawl the full width of a large monitor (JsonView caps its own content the
   same way). */
.cron-view {
  max-width: 46em;
}

.cron-view h1 {
  font-family: var(--font-heading-family);
  font-size: var(--font-heading-size);
  font-weight: var(--font-heading-weight);
  line-height: var(--font-heading-line-height);
  margin: 0 0 var(--spacing-1);
}

/* The one-line honesty caption — caption type, secondary colour, no border,
   no box (the dashed box was the retired NL section's file-drop-style signal;
   cron has no drop path). */
.tool-desc {
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-5);
}

/* The composed expression — the panel's first line, over a hairline rule. */
.expr-in-panel {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--color-border-hairline);
}

.expr-code {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  white-space: nowrap;
  font-family: var(--font-code-family);
  font-size: calc(var(--font-code-size) * 1.15);
  color: var(--color-text-primary);
}

/* The five field boxes as one compact row — always a single row (never stacked), the
   boxes just get narrower on a small window, like a date picker's day/month/year cells. */
.grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
}

/* ~24px ghost icon-button, no text label (the aria-label carries the name).
   JsonTree / Base64View / HashView / JwtView copy-button pattern. */
.expr-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.expr-copy svg {
  width: 15px;
  height: 15px;
}

.expr-copy:hover {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.expr-copy:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.expr-copy-ok {
  color: var(--color-accent-signature);
}

/* Announce-only live region (AC24) — present at all times, never shown.
   Standard clip pattern (cf. JwtView / HashView `.sr-only`). */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.alert {
  color: var(--color-accent-destructive);
  margin: 0 0 var(--spacing-4);
}

/* AC17: a calm factual line — never a filled box, never role="alert"
   (EXPERIENCE.md instrument voice). */
.oversize {
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-4);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  background: var(--color-bg-surface);
}

.panel-prose-row {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-2);
}

.panel-prose {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-primary);
}

/* ~24px ghost icon-button, same as `.expr-copy` (JsonTree / JwtView pattern). */
.prose-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  align-self: center;
  width: 24px;
  height: 24px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.prose-copy svg {
  width: 15px;
  height: 15px;
}

.prose-copy:hover {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.prose-copy:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.prose-copy-ok {
  color: var(--color-accent-signature);
}

/* AC15: the per-field breakdown — one row per field, "<label>: <phrase>". */
.breakdown {
  list-style: none;
  margin: 0;
  padding: 0;
}

.breakdown li {
  padding: var(--spacing-0-5) 0;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-text-secondary);
}

.breakdown-label {
  color: var(--color-text-primary);
}

.panel-runs {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.panel-runs-label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

.runs {
  list-style: none;
  margin: 0;
  padding: 0;
}

.runs li {
  padding: var(--spacing-0-5) 0;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  color: var(--color-text-primary);
}
</style>
