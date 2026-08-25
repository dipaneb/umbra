<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import AppButton from "../../components/AppButton.vue";
import AppTabs, { type AppTab } from "../../components/AppTabs.vue";
import { debounce } from "../../shell/debounce";
import { createLatestWinsRunner } from "../../shell/invoke";
import { isToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import JsonTree from "./JsonTree.vue";
import type { JsonIndent } from "./jsonIndent";
import type { RepairResult } from "./jsonRepair";
import type { JsonTreeValue } from "./jsonTreeValue";

const { t } = useI18n();

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

// Otherwise a pending timer fires into this component's refs after the user
// has navigated away to a different tool, wasting a debounce cycle and an
// IPC round-trip that nothing will ever read.
onUnmounted(() => {
  debouncedParse.cancel();
  debouncedRepair.cancel();
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
const isInputEmpty = computed(() => input.value.trim() === "");

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
</script>

<template>
  <section>
    <h1>{{ t('tools.json.heading') }}</h1>

    <div class="field">
      <label for="json-input">{{ t('tools.json.inputLabel') }}</label>
      <textarea
        id="json-input"
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
      {{ toolErrorMessage(error, t) }}<template v-if="errorLocation">
        {{ errorLocation }}
      </template>
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
          {{ toolErrorMessage(validateError, t) }}<template v-if="validateErrorLocation">
            {{ validateErrorLocation }}
          </template>
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
        {{ toolErrorMessage(repairError, t) }}<template v-if="repairErrorLocation">
          {{ repairErrorLocation }}
        </template>
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
</style>
