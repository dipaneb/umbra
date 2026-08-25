<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { PhCheck, PhCopySimple, PhLink } from "@phosphor-icons/vue";
import AppButton from "../../components/AppButton.vue";
import AppTabs, { type AppTab } from "../../components/AppTabs.vue";
import { writeClipboardText } from "../../shell/clipboard";
import { debounce } from "../../shell/debounce";
import { createLatestWinsRunner } from "../../shell/invoke";
import { isToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import JsonTree from "./JsonTree.vue";
import type { JsonIndent } from "./jsonIndent";
import type { QueryMatch, QueryResult } from "./jsonQuery";
import type { RepairResult } from "./jsonRepair";
import { jsonTreeValueToText } from "./jsonTreeValue";
import type { JsonTreeValue } from "./jsonTreeValue";
import { useCopyFeedback } from "./useCopyFeedback";

const { t } = useI18n();

const jsonInput = ref<HTMLTextAreaElement | null>(null);
const input = ref("");
const indent = ref<JsonIndent>("two_spaces");
const error = ref<ToolError | null>(null);
const treeValue = ref<JsonTreeValue | null>(null);
// Story 8.1 AC8 (Validate tab): the live parse below already re-parses the
// shared input on every debounced keystroke — reusing its result here (rather
// than adding a second parse call/runner) is what AD-16's "genuinely
// independent state group" test actually calls for, since this isn't new
// computation, just a second view over the same one.
const validateError = ref<ToolError | null>(null);

// Repair (AC9): unlike Validate, this is genuinely new computation (a
// char-by-char heuristic scan, not a re-read of the existing parse), so it
// gets its own preview state and its own runner scope below (AD-16/AC14).
const repairResult = ref<RepairResult | null>(null);
const repairError = ref<ToolError | null>(null);

// Query (AC10): also genuinely new computation (a JSONPath parse + evaluate
// over the parsed document), so it gets its own preview state and runner
// scope, same as Repair.
const queryExpression = ref("");
const queryResult = ref<QueryResult | null>(null);
const queryError = ref<ToolError | null>(null);

// Story 8.1 Task 2 (AC6): six tabs replace the old single flat panel; every
// tab reads this one shared `input`. Only Explorer is wired up so far — the
// rest render an honest "not built yet" placeholder rather than fabricating
// functionality (AD-9).
const TAB_IDS = ["explorer", "validate", "repair", "query", "diff", "transform"] as const;
type TabId = (typeof TAB_IDS)[number];
const activeTab = ref<TabId>("explorer");
const tabs = computed<AppTab[]>(() =>
  TAB_IDS.map((id) => ({ id, label: t(`tools.json.tab.${id}`) })),
);

const runLatestWins = createLatestWinsRunner();
// Dedicated to live tree-parsing, separate from the Format/Minify runner
// above: live parsing fires on every debounced keystroke, independently of
// those mutually-exclusive user-triggered actions. Sharing one counter would
// let typing bump the shared request ID and cause an in-flight Format
// click's legitimate result to be misidentified as superseded and dropped.
const runTreeParse = createLatestWinsRunner();

const debouncedParse = debounce((value: string) => {
  void (async () => {
    try {
      // The empty-input check runs *inside* the runTreeParse task, not as an
      // early return before calling it — otherwise clearing the input while a
      // real parse is still in flight would never bump the request counter,
      // and the earlier in-flight result could still land afterwards and
      // overwrite this correct `null` with a stale tree.
      const result = await runTreeParse(() =>
        value.trim() === "" ? Promise.resolve(null) : invoke<JsonTreeValue>("json_parse", { input: value }),
      );
      if (!result.superseded) {
        treeValue.value = result.value;
        validateError.value = null;
      }
    } catch (err) {
      // invalid JSON -> tree unavailable; Validate surfaces the detailed reason
      treeValue.value = null;
      validateError.value = toToolError(err);
    }
  })();
}, 200);

watch(input, (value) => debouncedParse(value), { immediate: true });

// Own runner scope (AD-16): repair is a separate independent state group
// from Format/Minify/Paste and from live tree-parsing — none of those three
// should have their in-flight request treated as superseded by a repair
// preview firing on the same keystroke, or vice versa.
const runRepair = createLatestWinsRunner();

const debouncedRepair = debounce((value: string) => {
  void (async () => {
    try {
      const result = await runRepair(() =>
        value.trim() === "" ? Promise.resolve(null) : invoke<RepairResult>("json_repair", { input: value }),
      );
      if (!result.superseded) {
        repairResult.value = result.value;
        repairError.value = null;
      }
    } catch (err) {
      repairResult.value = null;
      repairError.value = toToolError(err);
    }
  })();
}, 200);

// Only computed while Repair is the active tab — unlike Explorer/Validate,
// nothing else on screen reads this, so there's no reason to run it in the
// background for a tab the user isn't looking at. Watching `[activeTab,
// input]` together (rather than a separate watcher per source) means typing
// while already on Repair re-previews too, not just the initial tab switch.
watch(
  [activeTab, input],
  ([tab, value]) => {
    if (tab === "repair") debouncedRepair(value);
  },
  { immediate: true },
);

// Own runner scope (AD-16): Query is a separate independent state group from
// every other runner in this file, same reasoning as Repair's own scope.
const runQuery = createLatestWinsRunner();

// Deliberately does not gate on the document already being known-valid
// before calling the command: `query`'s Rust implementation parses `input`
// itself first, so a malformed document surfaces exactly the same rewritten,
// already-translated `json-*` error Validate shows (via `toolErrorMessage`
// below) — reusing that existing, tested error path instead of duplicating
// an "is this valid JSON?" check on the client.
const debouncedQueryRun = debounce((value: string, expression: string) => {
  void (async () => {
    try {
      const result = await runQuery(() =>
        value.trim() === "" || expression.trim() === ""
          ? Promise.resolve(null)
          : invoke<QueryResult>("json_query", { input: value, expression }),
      );
      if (!result.superseded) {
        queryResult.value = result.value;
        queryError.value = null;
      }
    } catch (err) {
      queryResult.value = null;
      queryError.value = toToolError(err);
    }
  })();
}, 200);

// Only computed while Query is the active tab, same reasoning as Repair's
// own watcher — nothing else on screen reads this state.
watch(
  [activeTab, input, queryExpression],
  ([tab, value, expression]) => {
    if (tab === "query") debouncedQueryRun(value, expression);
  },
  { immediate: true },
);

// Otherwise a pending timer fires into this component's refs after the user
// has navigated away to a different tool, wasting a debounce cycle and an
// IPC round-trip that nothing will ever read.
onUnmounted(() => {
  debouncedParse.cancel();
  debouncedRepair.cancel();
  debouncedQueryRun.cancel();
  cancelQueryCopyFeedback();
});

function positionText(position: ToolError["position"]): string | null {
  if (position?.kind === "LineCol") {
    return t("common.positionLineCol", { line: position.line, column: position.column });
  }
  if (position?.kind === "ByteOffset") {
    return t("common.positionByteOffset", { offset: position.offset });
  }
  return null;
}

const errorLocation = computed(() => positionText(error.value?.position ?? null));
const validateErrorLocation = computed(() => positionText(validateError.value?.position ?? null));
const repairErrorLocation = computed(() => positionText(repairError.value?.position ?? null));
const queryErrorLocation = computed(() => positionText(queryError.value?.position ?? null));
const isInputEmpty = computed(() => input.value.trim() === "");
const isQueryExpressionEmpty = computed(() => queryExpression.value.trim() === "");

// Moves the caret to a reported line/column so the position text isn't just
// a number the user has to count out by hand against a plain, line-number-
// less textarea — an explicit click, not automatic on every live-validate
// tick, since auto-jumping the caret while the user is still typing would
// fight their own cursor position.
function jumpToPosition(position: ToolError["position"]) {
  if (position?.kind !== "LineCol" || !jsonInput.value) return;
  const lines = input.value.split("\n");
  let offset = 0;
  for (let i = 0; i < position.line - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for the newline consumed between lines
  }
  offset = Math.min(offset + Math.max(0, position.column - 1), input.value.length);
  jsonInput.value.focus();
  jsonInput.value.setSelectionRange(offset, offset);
}

function toToolError(err: unknown): ToolError {
  return isToolError(err) ? err : { code: "unknown", message: String(err), position: null, context: null };
}

// Story 8.1 AC8: hands off to Repair with the same input already in place —
// input is one shared ref across every tab, so "carrying it over" is just
// switching which tab reads it.
function onTryRepair() {
  activeTab.value = "repair";
}

// Story 8.1 Task 2 (AC6): Format/Minify now rewrite `input` in place instead
// of populating a separate output box — with six tabs each deriving their
// own view from one document, a second "output" textarea doesn't compose.
async function runTransform(task: () => Promise<string>) {
  error.value = null;
  try {
    const result = await runLatestWins(task);
    if (!result.superseded) {
      input.value = result.value;
    }
  } catch (err) {
    error.value = toToolError(err);
  }
}

async function onFormat() {
  await runTransform(() =>
    invoke<string>("json_format", { input: input.value, indent: indent.value }),
  );
}

async function onMinify() {
  await runTransform(() => invoke<string>("json_minify", { input: input.value }));
}

function onTreeCopyError(err: unknown) {
  error.value = toToolError(err);
}

// Story 8.1 AC9: the only place `repaired` ever replaces the shared input —
// never automatic, only on this explicit click (AD-9 preview-then-confirm).
function onApplyRepair() {
  if (!repairResult.value) return;
  input.value = repairResult.value.repaired;
}

// Story 8.1 AC10: same clipboard-failure convention Explorer's own
// copy-value/copy-path actions already established (JsonTree.vue's
// `copy-error` emit, caught by `onTreeCopyError` above) — reused directly
// rather than inventing a second error-surfacing path for the same kind of
// failure.
const { isCopied: isQueryMatchCopied, markCopied: markQueryMatchCopied, cancel: cancelQueryCopyFeedback } =
  useCopyFeedback();

function queryMatchValueCopyKey(match: QueryMatch): string {
  return `${match.path}:value`;
}

function queryMatchPathCopyKey(match: QueryMatch): string {
  return `${match.path}:path`;
}

async function copyQueryMatchValue(match: QueryMatch) {
  try {
    await writeClipboardText(jsonTreeValueToText(match.value));
    markQueryMatchCopied(queryMatchValueCopyKey(match));
  } catch (err) {
    error.value = toToolError(err);
  }
}

async function copyQueryMatchPath(match: QueryMatch) {
  try {
    await writeClipboardText(match.path);
    markQueryMatchCopied(queryMatchPathCopyKey(match));
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section>
    <h1>{{ t('tools.json.heading') }}</h1>

    <div class="field">
      <label for="json-input">{{ t('tools.json.inputLabel') }}</label>
      <textarea
        id="json-input"
        ref="jsonInput"
        v-model="input"
        rows="10"
        spellcheck="false"
        autocorrect="off"
      />
    </div>

    <div class="actions">
      <AppButton @click="onFormat">
        {{ t('tools.json.format') }}
      </AppButton>
      <AppButton @click="onMinify">
        {{ t('tools.json.minify') }}
      </AppButton>
      <div class="indent-picker">
        <label for="json-indent">{{ t('tools.json.indentationLegend') }}</label>
        <select
          id="json-indent"
          v-model="indent"
        >
          <option value="two_spaces">
            {{ t('tools.json.indentTwoSpaces') }}
          </option>
          <option value="four_spaces">
            {{ t('tools.json.indentFourSpaces') }}
          </option>
          <option value="tab">
            {{ t('tools.json.indentTab') }}
          </option>
        </select>
      </div>
    </div>

    <!-- Provisional placement: attached to the shared input panel (relevant
         regardless of active tab) rather than gated behind the Validate tab.
         Validate's own slice (AC8) still owns whether this fully moves into
         that tab or a summary stays here with detail there. -->
    <p
      v-if="error"
      role="alert"
    >
      {{ toolErrorMessage(error, t) }}<button
        v-if="errorLocation"
        type="button"
        class="position-link"
        @click="jumpToPosition(error.position)"
      >
        {{ errorLocation }}
      </button>
    </p>

    <AppTabs
      v-model="activeTab"
      :tabs="tabs"
    />

    <div
      v-if="activeTab === 'explorer'"
      :id="`tabpanel-explorer`"
      role="tabpanel"
      aria-labelledby="tab-explorer"
      class="tab-panel"
    >
      <span class="tree-panel-label">{{ t('tools.json.treeViewLabel') }}</span>
      <JsonTree
        :value="treeValue"
        @copy-error="onTreeCopyError"
      />
    </div>
    <div
      v-else-if="activeTab === 'validate'"
      id="tabpanel-validate"
      role="tabpanel"
      aria-labelledby="tab-validate"
      class="tab-panel"
    >
      <p
        v-if="isInputEmpty"
        role="status"
      >
        {{ t('tools.json.validateEmpty') }}
      </p>
      <template v-else-if="validateError">
        <p role="alert">
          {{ toolErrorMessage(validateError, t) }}<button
            v-if="validateErrorLocation"
            type="button"
            class="position-link"
            @click="jumpToPosition(validateError.position)"
          >
            {{ validateErrorLocation }}
          </button>
        </p>
        <AppButton
          class="tab-action-button"
          @click="onTryRepair"
        >
          {{ t('tools.json.tryRepair') }}
        </AppButton>
      </template>
      <p
        v-else
        role="status"
      >
        {{ t('tools.json.validateValid') }}
      </p>
    </div>
    <div
      v-else-if="activeTab === 'repair'"
      id="tabpanel-repair"
      role="tabpanel"
      aria-labelledby="tab-repair"
      class="tab-panel"
    >
      <p
        v-if="isInputEmpty"
        role="status"
      >
        {{ t('tools.json.repairEmpty') }}
      </p>
      <p
        v-else-if="repairError"
        role="alert"
      >
        {{ toolErrorMessage(repairError, t) }}<button
          v-if="repairErrorLocation"
          type="button"
          class="position-link"
          @click="jumpToPosition(repairError.position)"
        >
          {{ repairErrorLocation }}
        </button>
      </p>
      <template v-else-if="repairResult">
        <p
          v-if="repairResult.changes.length === 0 && !repairResult.still_invalid"
          role="status"
        >
          {{ t('tools.json.repairNoChangesNeeded') }}
        </p>
        <p
          v-else-if="repairResult.changes.length === 0"
          role="status"
        >
          {{ t('tools.json.repairNoFixesAvailable') }}
        </p>
        <template v-else>
          <ul class="repair-changes">
            <li
              v-for="(change, index) in repairResult.changes"
              :key="index"
            >
              {{ change.description }}
            </li>
          </ul>
          <p
            v-if="repairResult.still_invalid"
            role="status"
          >
            {{ t('tools.json.repairStillInvalid') }}
          </p>
          <div class="field">
            <label for="repair-preview">{{ t('tools.json.repairPreviewLabel') }}</label>
            <textarea
              id="repair-preview"
              :value="repairResult.repaired"
              rows="10"
              readonly
              spellcheck="false"
            />
          </div>
          <AppButton
            class="tab-action-button"
            @click="onApplyRepair"
          >
            {{ t('tools.json.applyRepair') }}
          </AppButton>
        </template>
      </template>
    </div>
    <div
      v-else-if="activeTab === 'query'"
      id="tabpanel-query"
      role="tabpanel"
      aria-labelledby="tab-query"
      class="tab-panel"
    >
      <div class="field">
        <label for="json-query-expression">{{ t('tools.json.queryExpressionLabel') }}</label>
        <input
          id="json-query-expression"
          v-model="queryExpression"
          type="text"
          class="query-expression-input"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('tools.json.queryExpressionPlaceholder')"
        >
      </div>
      <p
        v-if="isInputEmpty"
        role="status"
      >
        {{ t('tools.json.queryInputEmpty') }}
      </p>
      <p
        v-else-if="isQueryExpressionEmpty"
        role="status"
      >
        {{ t('tools.json.queryExpressionEmpty') }}
      </p>
      <p
        v-else-if="queryError"
        role="alert"
      >
        {{ toolErrorMessage(queryError, t) }}<button
          v-if="queryError.position?.kind === 'LineCol'"
          type="button"
          class="position-link"
          @click="jumpToPosition(queryError.position)"
        >
          {{ queryErrorLocation }}
        </button><span
          v-else-if="queryError.position?.kind === 'ByteOffset'"
          class="query-expression-position"
        >{{ queryErrorLocation }}</span>
      </p>
      <template v-else-if="queryResult">
        <p
          v-if="queryResult.matches.length === 0"
          role="status"
        >
          {{ t('tools.json.queryNoMatches') }}
        </p>
        <template v-else>
          <p
            role="status"
            class="query-match-count"
          >
            <template v-if="queryResult.truncated">
              {{ t('tools.json.queryMatchCountTruncated', { shown: queryResult.matches.length, total: queryResult.total }) }}
            </template>
            <template v-else-if="queryResult.total === 1">
              {{ t('tools.json.queryMatchCountOne') }}
            </template>
            <template v-else>
              {{ t('tools.json.queryMatchCountOther', { count: queryResult.total }) }}
            </template>
          </p>
          <ul class="query-matches">
            <li
              v-for="match in queryResult.matches"
              :key="match.path"
              class="query-match"
            >
              <code class="query-match-path">{{ match.path }}</code>
              <code class="query-match-value">{{ jsonTreeValueToText(match.value) }}</code>
              <span class="query-match-actions">
                <button
                  type="button"
                  class="query-copy-button"
                  :aria-label="isQueryMatchCopied(queryMatchValueCopyKey(match)) ? t('tools.json.copiedValueAriaLabel') : t('tools.json.copyValueAriaLabel')"
                  :title="isQueryMatchCopied(queryMatchValueCopyKey(match)) ? t('tools.json.copiedValueAriaLabel') : t('tools.json.copyValueAriaLabel')"
                  @click="copyQueryMatchValue(match)"
                >
                  <PhCheck
                    v-if="isQueryMatchCopied(queryMatchValueCopyKey(match))"
                    aria-hidden="true"
                    class="query-copy-success"
                  />
                  <PhCopySimple
                    v-else
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  class="query-copy-button"
                  :aria-label="isQueryMatchCopied(queryMatchPathCopyKey(match)) ? t('tools.json.copiedPathAriaLabel') : t('tools.json.copyPathAriaLabel')"
                  :title="isQueryMatchCopied(queryMatchPathCopyKey(match)) ? t('tools.json.copiedPathAriaLabel') : t('tools.json.copyPathAriaLabel')"
                  @click="copyQueryMatchPath(match)"
                >
                  <PhCheck
                    v-if="isQueryMatchCopied(queryMatchPathCopyKey(match))"
                    aria-hidden="true"
                    class="query-copy-success"
                  />
                  <PhLink
                    v-else
                    aria-hidden="true"
                  />
                </button>
              </span>
            </li>
          </ul>
        </template>
      </template>
    </div>
    <div
      v-else
      :id="`tabpanel-${activeTab}`"
      role="tabpanel"
      :aria-labelledby="`tab-${activeTab}`"
      class="tab-panel"
    >
      <p class="coming-soon">
        {{ t('tools.json.comingSoon') }}
      </p>
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
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  /* Deliberately wide, not full-bleed-by-default: pretty-printed JSON's deep
     indentation produces long lines that wrap poorly in a narrow box, so this
     stays generous — but a floor stops it collapsing awkwardly in a narrow
     window, and a ceiling stops it reading as an arbitrary full-width slab
     on a wide display. */
  min-width: 20em;
  max-width: 70em;
  width: 100%;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: 1em;
}

/* A dropdown, not the old three-way radio row: this is a pick-once,
   rarely-revisited setting, not a frequently-toggled choice — and only
   Format actually reads it (Minify ignores indentation entirely), so it
   sits inline next to the buttons rather than owning its own row. */
.indent-picker {
  display: flex;
  align-items: center;
  gap: 0.4em;
  /* Extra breathing room beyond the row's own button-to-button gap, so this
     reads as a separate, adjacent control rather than a third button. */
  margin-left: var(--spacing-2);
}

.indent-picker label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

.indent-picker select {
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-text-primary);
  background: none;
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  padding: 0.3em 0.5em;
}

p[role="alert"] {
  color: var(--color-accent-destructive);
}

/* A real UI element (spacing via margin), not a text-node space relying on
   template whitespace between {{ message }} and this button — that space
   was getting silently collapsed to nothing by Vue's whitespace handling.
   Underline is the only affordance (inherits the alert's color) since this
   is a plain-text-styled action, not a candidate for the signature accent
   DESIGN.md reserves for one true action per screen. */
.position-link {
  margin-left: 0.4em;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.position-link:hover,
.position-link:focus-visible {
  text-decoration-thickness: 2px;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  min-height: 220px;
}

.tree-panel-label {
  font-weight: bold;
}

/* .tab-panel's flex-column default (align-items: stretch) would otherwise
   stretch this to the panel's full width, unlike Format/Minify's row of
   naturally-sized buttons above. Shared by Validate's "Try Repair" and
   Repair's own "Apply repair" — same constraint, same fix. */
.tab-action-button {
  align-self: flex-start;
}

.tab-panel :deep(.json-tree-scroll) {
  height: 320px;
  /* Matches the input textarea's own max-width: on a wide screen, an
     unbounded tree let each row's copy actions drift far to the right of
     the text they act on. */
  max-width: 70em;
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
}

.repair-changes {
  margin: 0;
  padding-left: 1.2em;
}

.repair-changes li {
  padding: 0.15em 0;
}

#repair-preview {
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  min-width: 20em;
  max-width: 70em;
  width: 100%;
  /* Read-only preview, not a second editable document — dimmed so it doesn't
     compete visually with the shared input above it. */
  color: var(--color-text-secondary);
}

.coming-soon {
  color: var(--color-text-secondary);
}

/* JSONPath is structured text, same {typography.code} role as the shared
   input/tree/repair-preview panels (AC13) — not `--font-body-*`. */
.query-expression-input {
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  min-width: 20em;
  max-width: 70em;
  width: 100%;
}

/* Plain text, not `.position-link`: this offset locates a position in the
   query *expression*, not the shared document textarea, so it must not
   share the clickable jump-to-caret affordance those use — that button
   would move the wrong text field's caret. */
.query-expression-position {
  margin-left: 0.4em;
  color: var(--color-text-secondary);
}

.query-match-count {
  color: var(--color-text-secondary);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
}

.query-matches {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
}

.query-match {
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding: 0.3em 0.6em;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
}

.query-match:hover {
  background: var(--color-border-hairline);
}

.query-match-path {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  font-family: inherit;
}

.query-match-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: inherit;
  color: var(--color-text-primary);
}

.query-match-actions {
  display: flex;
  gap: 0.2em;
  flex-shrink: 0;
}

/* Same fixed-px sizing as JsonTree.vue's own copy buttons — a copy icon's
   legibility floor doesn't scale down with the surrounding 13px code font. */
.query-copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.query-copy-button svg {
  width: 16px;
  height: 16px;
}

.query-copy-button:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-base);
}

.query-copy-button:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

/* Same reasoning as JsonTree.vue's `.json-tree-copy-success` — reuses the
   signature accent as the "this happened" color rather than a separate
   green/success hue this app's palette doesn't have. */
.query-copy-success {
  color: var(--color-accent-signature);
}
</style>
