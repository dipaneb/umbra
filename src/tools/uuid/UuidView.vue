<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { PhCheck, PhCopySimple } from "@phosphor-icons/vue";
import AppButton from "../../components/AppButton.vue";
import AppPopover from "../../components/AppPopover.vue";
import { writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
// Story 8.3 slice 2 (AC13): reuse JSON's per-button "copied" feedback
// composable — same signature-accent confirm the JSON tree / Base64 output
// copy buttons use. It sits in src/tools/json/; a third consumer (JSON,
// Base64, now UUID) is exactly what would justify hoisting it to src/shell/,
// but that hoist is left to a dedicated refactor so this story stays an
// island (AD-6) — the cross-tool import is deliberate, not accidental.
import { useCopyFeedback } from "../json/useCopyFeedback";
import { useSettingsStore } from "../../stores/settings";
import type { UuidVersion } from "./uuidVersion";

const { t, n } = useI18n();
const settings = useSettingsStore();

const MAX_COUNT = 4294967295; // u32::MAX — mirrors umbra-core's u32 command parameter

const version = ref<UuidVersion>("v4");
const count = ref(1);
const results = ref<string[]>([]);
const error = ref<ToolError | null>(null);
const clientError = ref<string | null>(null);
// AC15 (deferred-work fold-in): a disabled Generate while a batch is in
// flight so rapid clicks can't stack `spawn_blocking` tasks server-side —
// `runLatestWins` only papers over the *result* race, not the wasted work.
const generating = ref(false);

const runLatestWins = createLatestWinsRunner();

// Per-row copy feedback (AC13). Keyed by row index — several copy buttons
// are on screen at once and only the one actually clicked should confirm.
const { isCopied, markCopied, cancel: cancelCopyFeedback } = useCopyFeedback();
const isRowCopied = (index: number) => isCopied(String(index));
onUnmounted(cancelCopyFeedback);

// uuid.rs's generate() always returns position: None, so there's no
// LineCol/ByteOffset case to render here (unlike JsonView/Base64View).
const alertMessage = computed(() =>
  clientError.value ?? (error.value ? toolErrorMessage(error.value, t) : null),
);

// AC15: a successful batch render is announced to assistive tech via the
// role="status" region below — errors already get role="alert". Manual
// one/other selection, matching the JSON tool's `treeItemsCountOther`
// convention (the codebase doesn't use vue-i18n's `|` plural syntax).
const resultCountLabel = computed(() =>
  results.value.length === 1
    ? t("tools.uuid.resultCountOne")
    : t("tools.uuid.resultCountOther", { count: results.value.length }),
);

// AC11 / AC12: the format toggles are pure view-side string transforms over
// umbra-core's canonical lowercase-hyphenated output — no core function, no
// re-generation. Order: case → hyphens → braces. Persisted per uuid.*
// setting (AC18), so `settings.*` is the source of truth, not a local ref.
function applyFormat(canonical: string): string {
  let s = settings.uuidFormatCase === "upper" ? canonical.toUpperCase() : canonical;
  if (!settings.uuidFormatHyphens) s = s.replace(/-/g, "");
  if (settings.uuidFormatBraces) s = `{${s}}`;
  return s;
}

// Everything downstream — the rendered list, per-row Copy, Copy all,
// Download — reads this, so they all emit the formatted strings.
const formattedResults = computed(() => results.value.map(applyFormat));

// AC14: bulk download. The format is picked from a small menu on the
// Download action (a Popover), so the save dialog is already pre-named with
// the right extension and a single matching filter — the user never edits
// the extension by hand.
type DownloadFormat = "txt" | "csv" | "json";

const DOWNLOAD_FORMATS: readonly DownloadFormat[] = ["txt", "csv", "json"];
const downloading = ref(false);
const downloadMenu = ref<{ close: () => void } | null>(null);

function buildExport(format: DownloadFormat): string {
  const rows = formattedResults.value;
  if (format === "json") return `${JSON.stringify(rows, null, 2)}\n`;
  if (format === "csv") {
    // RFC 4180: a single `uuid` column, header row, CRLF, every field quoted
    // (a formatted value can contain a comma-free string today, but quoting
    // unconditionally is the safe, spec-clean choice).
    const escaped = rows.map((r) => `"${r.replace(/"/g, '""')}"`);
    return `${["uuid", ...escaped].join("\r\n")}\r\n`;
  }
  return `${rows.join("\n")}\n`;
}

async function onDownload(format: DownloadFormat) {
  downloadMenu.value?.close();
  if (downloading.value) return;
  error.value = null;
  downloading.value = true;
  try {
    const path = await save({
      defaultPath: `uuids.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (path === null) return; // user cancelled — not an error
    await invoke("uuid_export", { content: buildExport(format), path });
  } catch (err) {
    error.value = toToolError(err);
  } finally {
    downloading.value = false;
  }
}

// A stale list generated under the previous version no longer "matches the
// selected version" (AC3) until the next Generate click — clear it rather
// than leave it looking current.
watch(version, () => {
  results.value = [];
  error.value = null;
  clientError.value = null;
});

async function onGenerate() {
  error.value = null;
  clientError.value = null;

  // Client-side input-shape guard, distinct from the server-side count == 0
  // / count > 1000 business rules: a cleared/non-numeric field produces NaN,
  // and a typed negative or over-u32::MAX number can't serialize into the
  // command's u32 parameter — neither should round-trip to `invoke` only to
  // surface a raw IPC error instead of a clean inline message. 0 itself is a
  // valid u32, so it's allowed through to hit the server's own rejection.
  if (!Number.isInteger(count.value) || count.value < 0 || count.value > MAX_COUNT) {
    clientError.value = t("tools.uuid.countOutOfRange", { max: n(MAX_COUNT, "grouped") });
    return;
  }

  const requestedVersion = version.value;
  generating.value = true;
  try {
    const result = await runLatestWins(() =>
      invoke<string[]>("uuid_generate", { version: version.value, count: count.value }),
    );
    if (!result.superseded && version.value === requestedVersion) {
      results.value = result.value;
    }
  } catch (err) {
    if (version.value === requestedVersion) {
      results.value = [];
      error.value = toToolError(err);
    }
  } finally {
    generating.value = false;
  }
}

async function onCopyOne(uuid: string, index: number) {
  error.value = null;
  try {
    await writeClipboardText(uuid);
    // Confirm only after the write actually succeeds — a failed write has
    // its own error-alert path and must not also flash a false confirmation.
    markCopied(String(index));
  } catch (err) {
    error.value = toToolError(err);
  }
}

async function onCopyAll() {
  error.value = null;
  try {
    await writeClipboardText(formattedResults.value.join("\n"));
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section class="uuid-view">
    <h1>{{ t('tools.uuid.heading') }}</h1>
    <p class="tool-desc">
      {{ t('tools.uuid.description') }}
    </p>

    <!-- AC6: enriched toolbar — version, count and Generate on one strip
         above the results panel. Wraps on a narrow main pane. -->
    <div class="toolbar">
      <fieldset class="version-field">
        <legend class="version-legend">
          {{ t('tools.uuid.versionLegend') }}
          <!-- AC9: the ? sits on the fieldset legend (the question is
               comparative, not per-option) and opens the reusable Popover
               with the v4-vs-v7 explainer — 8.3 ships the inline taglines
               and this. -->
          <AppPopover
            :label="t('tools.uuid.versionHelpLabel')"
            placement="bottom-start"
          >
            <template #trigger="{ toggle, triggerProps }">
              <button
                type="button"
                class="help-dot"
                v-bind="triggerProps"
                :aria-label="t('tools.uuid.versionHelpTrigger')"
                @click="toggle"
              >
                ?
              </button>
            </template>
            <h4 class="popover-heading">
              {{ t('tools.uuid.versionHelpHeading') }}
            </h4>
            <dl class="version-help">
              <dt>v4</dt>
              <dd>{{ t('tools.uuid.versionHelpV4') }}</dd>
              <dt>v7</dt>
              <dd>{{ t('tools.uuid.versionHelpV7') }}</dd>
            </dl>
          </AppPopover>
        </legend>
        <!-- A grouped two-option control on a neutral track. The raised
             "card" style is applied straight to the active <label> (no
             sliding thumb), so each cell simply sizes to its own text —
             it grows with the label in any language, nothing pins its
             width. The native radios stay in the DOM, visually collapsed
             (never display:none — that would drop them from the tab order
             and the a11y tree). -->
        <div class="segmented">
          <label :class="{ active: version === 'v4' }">
            <input
              v-model="version"
              type="radio"
              name="uuid-version"
              value="v4"
            >
            <span class="seg-name">v4</span>
            <span class="seg-tagline">·&nbsp;{{ t('tools.uuid.taglineV4') }}</span>
          </label>
          <label :class="{ active: version === 'v7' }">
            <input
              v-model="version"
              type="radio"
              name="uuid-version"
              value="v7"
            >
            <span class="seg-name">v7</span>
            <span class="seg-tagline">·&nbsp;{{ t('tools.uuid.taglineV7') }}</span>
          </label>
        </div>
      </fieldset>

      <div class="count-field">
        <label for="uuid-count">{{ t('tools.uuid.countLabel') }}</label>
        <input
          id="uuid-count"
          v-model.number="count"
          type="number"
          min="1"
        >
      </div>

      <AppButton
        variant="primary"
        :disabled="generating"
        @click="onGenerate"
      >
        {{ t('tools.uuid.generate') }}
      </AppButton>
    </div>

    <p
      v-if="alertMessage"
      class="alert"
      role="alert"
    >
      {{ alertMessage }}
    </p>

    <div
      v-if="results.length"
      class="results"
    >
      <div class="results-head">
        <span
          class="results-count"
          role="status"
          aria-live="polite"
        >{{ resultCountLabel }}</span>

        <!-- AC11: output-format controls live on the results-panel header
             (they transform what's already generated, not the generation).
             Case is mutually exclusive; braces + no-hyphens are independent
             booleans that compose with case and each other. -->
        <div
          class="format-controls"
          role="group"
          :aria-label="t('tools.uuid.formatGroupLabel')"
        >
          <div
            class="case-toggle"
            role="radiogroup"
            :aria-label="t('tools.uuid.formatCaseLabel')"
          >
            <label :class="{ active: settings.uuidFormatCase === 'lower' }">
              <input
                type="radio"
                name="uuid-format-case"
                :checked="settings.uuidFormatCase === 'lower'"
                :aria-label="t('tools.uuid.formatCaseLower')"
                @change="settings.setUuidFormat({ case: 'lower' })"
              >
              abc
            </label>
            <label :class="{ active: settings.uuidFormatCase === 'upper' }">
              <input
                type="radio"
                name="uuid-format-case"
                :checked="settings.uuidFormatCase === 'upper'"
                :aria-label="t('tools.uuid.formatCaseUpper')"
                @change="settings.setUuidFormat({ case: 'upper' })"
              >
              ABC
            </label>
          </div>

          <button
            type="button"
            class="fmt-chip"
            :class="{ on: settings.uuidFormatBraces }"
            :aria-pressed="settings.uuidFormatBraces"
            :aria-label="t('tools.uuid.formatBracesLabel')"
            @click="settings.setUuidFormat({ braces: !settings.uuidFormatBraces })"
          >
            { }
          </button>

          <button
            type="button"
            class="fmt-chip"
            :class="{ on: !settings.uuidFormatHyphens }"
            :aria-pressed="!settings.uuidFormatHyphens"
            @click="settings.setUuidFormat({ hyphens: !settings.uuidFormatHyphens })"
          >
            {{ t('tools.uuid.formatNoHyphens') }}
          </button>
        </div>

        <span class="head-actions">
          <AppPopover
            ref="downloadMenu"
            :label="t('tools.uuid.downloadMenuLabel')"
            placement="bottom-end"
          >
            <template #trigger="{ toggle, triggerProps }">
              <button
                type="button"
                class="head-action"
                v-bind="triggerProps"
                :disabled="downloading"
                @click="toggle"
              >
                {{ t('tools.uuid.download') }}
              </button>
            </template>
            <ul class="download-menu">
              <li
                v-for="fmt in DOWNLOAD_FORMATS"
                :key="fmt"
              >
                <button
                  type="button"
                  class="download-menu-item"
                  @click="onDownload(fmt)"
                >
                  .{{ fmt }}
                </button>
              </li>
            </ul>
          </AppPopover>
          <button
            v-if="results.length > 1"
            type="button"
            class="head-action"
            @click="onCopyAll"
          >
            {{ t('tools.uuid.copyAll') }}
          </button>
        </span>
      </div>
      <ul class="results-list">
        <li
          v-for="(uuid, index) in formattedResults"
          :key="index"
        >
          <code>{{ uuid }}</code>
          <button
            type="button"
            class="row-copy"
            :aria-label="isRowCopied(index) ? t('tools.uuid.copied') : t('common.copyToClipboard')"
            :title="isRowCopied(index) ? t('tools.uuid.copied') : t('common.copyToClipboard')"
            @click="onCopyOne(uuid, index)"
          >
            <PhCheck
              v-if="isRowCopied(index)"
              aria-hidden="true"
              class="row-copy-ok"
            />
            <PhCopySimple
              v-else
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
h1 {
  font-family: var(--font-heading-family);
  font-size: var(--font-heading-size);
  font-weight: var(--font-heading-weight);
  line-height: var(--font-heading-line-height);
  margin: 0 0 var(--spacing-1);
}

.tool-desc {
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-5);
}

/* AC6: the enriched toolbar. align-items:flex-end so the Generate button and
   the count input sit on the same baseline as the segmented control. */
.toolbar {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-4);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-4);
}

.version-field {
  border: none;
  padding: 0;
  margin: 0;
  /* A fieldset defaults to min-inline-size:auto, which refuses to shrink and
     breaks the toolbar's flex-wrap on a narrow pane. */
  min-inline-size: 0;
}

.version-legend {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: 0;
  margin-bottom: var(--spacing-1);
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

.help-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-full);
  background: none;
  color: var(--color-text-secondary);
  font-size: 10px;
  font-weight: var(--font-label-weight);
  line-height: 1;
  cursor: pointer;
}

.help-dot:hover {
  color: var(--color-text-primary);
  border-color: var(--color-text-secondary);
}

.help-dot:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.popover-heading {
  margin: 0 0 var(--spacing-2);
  font-family: var(--font-heading-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-heading-weight);
  color: var(--color-text-primary);
}

.version-help {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--spacing-1) var(--spacing-3);
  margin: 0;
}

.version-help dt {
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  color: var(--color-text-secondary);
}

.version-help dd {
  margin: 0;
  color: var(--color-text-secondary);
}

.segmented {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  background: var(--color-accent-neutral-chip);
  border-radius: var(--radius-lg);
}

.segmented label {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35em;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    border-color 140ms ease;
}

/* The raised "card" is the active label itself — its bounds are just its
   own text plus padding, so it grows with the label in any language. */
.segmented label.active {
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
  border-color: var(--color-border-hairline);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.segmented label:focus-within {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
}

.segmented input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.seg-tagline {
  font-size: var(--font-caption-size);
  font-weight: var(--font-caption-weight);
  color: var(--color-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .segmented label {
    transition: none;
  }
}

.count-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.count-field label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

/* base.css already gives the bare number input its token border + focus
   ring — only the width is set here so "Count"/"Nombre" plus the spinner
   doesn't stretch across the toolbar. */
.count-field input {
  inline-size: 8em;
}

.alert {
  color: var(--color-accent-destructive);
  margin: 0 0 var(--spacing-4);
}

/* AC6: a bordered results panel with a header (count + Copy all) over the
   list. Persistent surface → hairline border, no shadow (DESIGN.md). */
.results {
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  background: var(--color-bg-surface);
  overflow: hidden;
}

.results-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-2) var(--spacing-3);
  flex-wrap: wrap;
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: 1px solid var(--color-border-hairline);
}

.results-count {
  margin-right: auto;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
}

/* AC11: format controls — a compact case segmented control + two toggle
   chips, sitting between the count and Copy all. */
.format-controls {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
}

.case-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--color-accent-neutral-chip);
  border-radius: var(--radius-default);
}

.case-toggle label {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-family: var(--font-label-family);
  font-size: var(--font-caption-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.case-toggle label.active {
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.case-toggle label:focus-within {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.case-toggle input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.fmt-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-full);
  background: none;
  font-family: var(--font-label-family);
  font-size: var(--font-caption-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.fmt-chip.on {
  background: var(--color-accent-signature-tint);
  border-color: var(--color-accent-signature);
  color: var(--color-text-primary);
}

.fmt-chip:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.head-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* Secondary panel actions — plain underlined text, not a filled button:
   DESIGN.md's "budget of one" keeps the single filled accent for Generate.
   Mirrors Base64View's `.offer-action`. */
.head-action {
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font-label-family);
  font-size: var(--font-caption-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.head-action:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.head-action:disabled {
  opacity: 0.6;
  cursor: default;
}

.head-action:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* The Download format menu, inside the Popover surface. */
.download-menu {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.download-menu-item {
  display: block;
  width: 100%;
  padding: 4px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  font-family: var(--font-code-family);
  font-size: var(--font-body-size);
  line-height: 1.3;
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
}

.download-menu-item:hover {
  background: var(--color-accent-neutral-chip);
}

.download-menu-item:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: -2px;
}

.results-list {
  list-style: none;
  margin: 0;
  padding: var(--spacing-1) 0;
}

.results-list li {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-1) var(--spacing-3);
}

/* Zebra striping: on a wide pane the per-row Copy button sits far from its
   UUID; an alternating row tint gives an always-on horizontal band tying
   each value to its button. --color-bg-base is the page ground, one step
   off the panel's --color-bg-surface — subtle in both themes. */
.results-list li:nth-child(odd) {
  background: var(--color-bg-base);
}

/* AC7: the result strings adopt {typography.code}. */
.results-list code {
  flex: 1;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  line-height: var(--font-code-line-height);
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}

/* AC13: per-row copy is the JsonTree.vue / Base64View.vue icon-button —
   fixed px (a copy icon's legibility floor doesn't scale with the code
   font), signature-accent confirm, no separate success colour. */
.row-copy {
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

.row-copy svg {
  width: 15px;
  height: 15px;
}

/* --color-accent-neutral-chip, not --color-bg-base: the latter is the tint
   the zebra stripe already uses, so on an odd row a bg-base hover would be
   invisible. The chip grey reads against both the striped and plain rows. */
.row-copy:hover {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.row-copy:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

/* Reuses the signature accent as the "this happened" colour — this app's
   palette has no separate success hue (same call JsonTree.vue and
   Base64View.vue make). */
.row-copy-ok {
  color: var(--color-accent-signature);
}
</style>
