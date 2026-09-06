<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

// Story 8.6 (Task 2b render-review pivot, 2026-09-05): a cron island component — no
// cross-tool reuse. One instance per standard field, laid out by CronView as a compact
// single row in cron field order (minute, hour, day of month, month, day of week). The
// original hybrid (segmented Every/Specific + a name <select> + an Advanced raw-grammar
// disclosure) tested badly in the render-review — three controls per field, five times
// over, with a mode toggle nobody could explain. This is the whole thing now: one text
// input that takes the raw field grammar directly (`*`, `5`, `1,3,5`, `1-5`, `*/15`,
// `10-50/5`), a label, and the live panel's per-field breakdown doing the "what does 1
// mean" work instead of a picker.
export type CronFieldKey = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

const props = defineProps<{
  fieldKey: CronFieldKey;
  // The single source of truth for this field — a bare value (`5`), `*`, a list (`1,3,5`),
  // a range (`1-5`), or a step (`*/15`). Shown verbatim; never transformed here.
  modelValue: string;
  // This field's breakdown phrase (from `CronExplanation.schedule`) — surfaced as a
  // hover title so the strip stays visually quiet; the live panel renders the visible rows.
  phrase: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();

const inputRef = ref<HTMLInputElement | null>(null);

const LABEL_KEYS: Record<CronFieldKey, string> = {
  minute: "tools.cron.fieldMinute",
  hour: "tools.cron.fieldHour",
  dayOfMonth: "tools.cron.fieldDayOfMonth",
  month: "tools.cron.fieldMonth",
  dayOfWeek: "tools.cron.fieldDayOfWeek",
};

// A soft cue only — the real validation is the round-trip through `cron_explain` (a bad
// value comes back as an error, exactly as if it were typed in the expression line).
const RANGE_HINT: Record<CronFieldKey, string> = {
  minute: "0-59",
  hour: "0-23",
  dayOfMonth: "1-31",
  month: "1-12",
  dayOfWeek: "0-7",
};

const label = computed(() => t(LABEL_KEYS[props.fieldKey]));
const rangeHint = computed(() => RANGE_HINT[props.fieldKey]);
const ariaLabel = computed(() => `${label.value} (${rangeHint.value})`);
const title = computed(() =>
  props.phrase ? `${label.value} — ${props.phrase}` : ariaLabel.value,
);

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}

// Exposed for tests and for any future caller that needs to place the cursor in a specific
// field. The `*` auto-advance that used to drive it was removed at code review (2026-09-06):
// `*` is both a complete field value and the first character of `*/15`, so advancing on the
// transition made every step expression impossible to type. Traversal is plain Tab.
function focus() {
  inputRef.value?.focus();
  inputRef.value?.select();
}

defineExpose({ focus });
</script>

<template>
  <div class="cron-field">
    <input
      ref="inputRef"
      class="field-input"
      type="text"
      spellcheck="false"
      autocorrect="off"
      autocapitalize="off"
      :aria-label="ariaLabel"
      :title="title"
      :value="modelValue"
      @input="onInput"
    >
    <span class="field-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.cron-field {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-1);
  min-width: 0;
}

/* base.css already gives the bare <input type="text"> its token border, background and
   focus-visible ring — only the code face, full-cell width and centre alignment (the
   date-picker-cell look) are set here. */
.field-input {
  width: 100%;
  min-width: 0;
  text-align: center;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  line-height: var(--font-code-line-height);
}

.field-label {
  text-align: center;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
}
</style>
