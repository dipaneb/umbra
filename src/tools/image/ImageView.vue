<script setup lang="ts">
// Story 8.9's redesign (AC8-AC34): a multi-file queue replacing the single-file flow Story 8.7
// moved here verbatim. Drag-and-drop and the native picker are two arrival routes into ONE
// queue model (AC16) — both funnel through `addOutcomes`. Every write (`image_convert`) is
// dispatched per item, each carrying its OWN `createLatestWinsRunner` (AD-16, AC19): "one runner
// per action-type" here means every runner drives the same convert action, but each is scoped to
// its own item's reactive slot, so reconverting item A can never supersede item B's in-flight
// result, and reconverting A a second time correctly supersedes A's own first attempt.
import { computed, nextTick, onUnmounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { PhImage, PhLink, PhLinkSimpleBreak, PhWarningCircle, PhX } from "@phosphor-icons/vue";
import AppButton from "../../components/AppButton.vue";
import { useRegistryStore } from "../../stores/registry";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import type { ImageTargetFormat } from "./imageTargetFormat";

const { t, n } = useI18n();
const registry = useRegistryStore();

// AC20: "Convert to" and quality/resize/background are all batch-wide — one setting applied to
// every queued file (AC6/AC25), not a per-item override. `resizeWidth`/`resizeHeight` are kept as
// raw text (not numbers) end to end, matching what the core layer actually validates (AC22:
// zero/negative/non-numeric all rejected there, not clamped here) — this view never re-implements
// that check, it just doesn't invent a numeric type the invalid cases can't fit through.
const targetFormat = ref<ImageTargetFormat>("jpeg");
const quality = ref(80);

// Render review feedback (2026-09-15): after dragging the slider with the mouse, the arrow keys
// stopped nudging it — WebKit (this app's webview) does not reliably hand a `<input type="range">`
// real DOM focus on a pointer-drag the way it does on a plain click, so the keyboard handler
// never sees the keydown at all. Focusing it explicitly on pointerdown is what makes "drag once,
// then fine-tune with the arrow keys" actually work, rather than requiring a Tab away and back.
function onSliderPointerDown(event: PointerEvent) {
  (event.currentTarget as HTMLInputElement).focus();
}
const resizeWidth = ref("");
const resizeHeight = ref("");
const aspectLocked = ref(true);
const backgroundColor = ref("#ffffff");

// AC20: locked editing recomputes the other field from "the source's" aspect ratio. A queue can
// hold several differently-shaped images, so there is no single source to derive that ratio from
// in general — the first successfully-ingested item's own natural size (learned for free from
// `image_ingest_dropped`'s probe) is used as the reference. This is a display convenience only:
// the actual no-upscale decision (AC21) is always re-evaluated per item, against that item's own
// real dimensions, at the core layer — a reference chosen here for the FIELDS cannot make that
// per-item decision wrong for a differently-shaped file.
const aspectReference = ref<{ width: number; height: number } | null>(null);
// Code review 2026-09-15: which queue item currently backs `aspectReference`, so `removeItem` can
// tell whether the item being removed is the one to recompute the reference away from.
let aspectReferenceSourceId: number | null = null;

function onResizeWidthInput() {
  if (!aspectLocked.value || !aspectReference.value) return;
  const width = Number(resizeWidth.value);
  if (!Number.isFinite(width) || width <= 0) return;
  const { width: refW, height: refH } = aspectReference.value;
  resizeHeight.value = String(Math.round((width * refH) / refW));
}

function onResizeHeightInput() {
  if (!aspectLocked.value || !aspectReference.value) return;
  const height = Number(resizeHeight.value);
  if (!Number.isFinite(height) || height <= 0) return;
  const { width: refW, height: refH } = aspectReference.value;
  resizeWidth.value = String(Math.round((height * refW) / refH));
}

// AC26: PNG/WebP carry alpha themselves and never flatten — same conditional-visibility pattern
// the quality slider already uses. AVIF also carries its own alpha through this crate's encoder
// (verified against the `image` crate's AVIF encoder, which accepts RGBA directly) and is
// therefore extended into that same "never flattens" group here — a considered correction to
// AC26's literal PNG/WebP-only wording, flagged in this story's Dev Agent Record rather than
// silently diverging from the written AC (this workflow's edit permissions don't extend to the
// Acceptance Criteria section itself).
const showBackgroundControl = computed(() => targetFormat.value === "jpeg");
// AC23: quality applies to JPEG and AVIF; PNG/WebP ignore it (unchanged from the shipped tool).
const showQualityControl = computed(() => targetFormat.value === "jpeg" || targetFormat.value === "avif");

function imageFilters() {
  // AC24: AVIF is an output format only — never offered as a source filter, so the boundary is
  // honest rather than discovered later as a rejected file.
  return [{ name: t("tools.image.imageFilterName"), extensions: ["png", "jpg", "jpeg", "webp"] }];
}

// ---- queue model (AC16/AC17) ----

interface QueueItem {
  id: number;
  path: string;
  status: "pending" | "converting" | "done" | "error";
  error: ToolError | null;
  /** The item's own natural dimensions, learned for free from ingest's `probe()` — kept on the
   *  item (not just folded into `aspectReference`) so `removeItem` can recompute the aspect-lock
   *  reference from whatever remains in the queue once its current source item is removed. */
  width: number | null;
  height: number | null;
  outputPath: string | null;
  originalBytes: number | null;
  convertedBytes: number | null;
  runner: ReturnType<typeof createLatestWinsRunner>;
  /** Render review feedback (2026-09-15): a generic file icon read as "broken" next to a real
   *  photo the user just picked — a real thumbnail confirms it's the right file at a glance and
   *  makes the queue feel alive while a batch sits "Waiting…". Sources from `item.path` itself
   *  (the command layer grants asset access at ingest time now, not only after conversion), and
   *  falls back to the icon on a load error rather than an empty box. */
  thumbnailFailed: boolean;
}

let nextItemId = 0;
const queue = ref<QueueItem[]>([]);
const announcement = ref("");
// Code review 2026-09-15: a picker/drop-ingest failure used to only ever reach the sr-only
// `announcement` region, leaving sighted users with zero visible feedback when a pick or drop
// failed outright (before any queue item exists to show its own error). Mirrors PdfView.vue's own
// visible `role="alert"` pattern for the same class of top-level failure.
const topLevelError = ref<ToolError | null>(null);

interface IngestOutcome {
  path: string;
  width: number | null;
  height: number | null;
  error: ToolError | null;
}

/** AC16: the one shared code path both the picker and a drop funnel into. */
function addOutcomes(outcomes: IngestOutcome[]) {
  const known = new Set(queue.value.map((item) => item.path));
  for (const outcome of outcomes) {
    if (known.has(outcome.path)) continue;
    known.add(outcome.path);
    const id = (nextItemId += 1);
    if (aspectReference.value === null && outcome.width && outcome.height) {
      aspectReference.value = { width: outcome.width, height: outcome.height };
      aspectReferenceSourceId = id;
    }
    queue.value.push(
      reactive({
        id,
        path: outcome.path,
        status: outcome.error ? "error" : "pending",
        error: outcome.error,
        width: outcome.width,
        height: outcome.height,
        outputPath: null,
        originalBytes: null,
        convertedBytes: null,
        runner: createLatestWinsRunner(),
        thumbnailFailed: false,
      }),
    );
  }
}

async function onChooseImages() {
  try {
    const picked = await open({ multiple: true, filters: imageFilters() });
    if (picked === null) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    const outcomes = await invoke<IngestOutcome[]>("image_ingest_dropped", { paths });
    topLevelError.value = null;
    addOutcomes(outcomes);
  } catch (err) {
    // A picker/ingest-call failure (not a per-file outcome — those are always `Ok` entries)
    // has nowhere else to land; a single line above the queue is enough for what should be rare.
    const error = toToolError(err);
    topLevelError.value = error;
    announcement.value = toolErrorMessage(error, t);
  }
}

// AC5/AC14: the shell publishes drag-over state and dispatches the registered drop handler
// itself (AD-14); this view only decides whether it is the one being hovered and consumes the
// per-file outcome the shell already fetched — the same shape OcrView/HashView/PdfView use.
const isDragOver = computed(() => registry.dragOverToolId === "image");

watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "image") return;
    registry.dropResult = null;
    if ("error" in result) {
      topLevelError.value = result.error;
      announcement.value = toolErrorMessage(result.error, t);
      return;
    }
    topLevelError.value = null;
    addOutcomes(result.value as IngestOutcome[]);
  },
);

function removeItem(item: QueueItem) {
  queue.value = queue.value.filter((entry) => entry.id !== item.id);
  if (compareItem.value?.id === item.id) closeCompare();
  // Code review 2026-09-15: `aspectReference` used to be set once and never revisited, so
  // removing the item that supplied it left the resize fields' aspect-lock math deriving from a
  // file no longer in the queue. Recompute from whatever remains (or clear it) whenever the
  // removed item is the one currently backing the reference.
  if (item.id === aspectReferenceSourceId) {
    const next = queue.value.find((entry) => entry.width && entry.height);
    aspectReference.value = next ? { width: next.width!, height: next.height! } : null;
    aspectReferenceSourceId = next?.id ?? null;
  }
}

// ---- conversion (AC17/AC18/AC19/AC28/AC29) ----

const converting = ref(false);

// Render review feedback (2026-09-15): a Retry click on a single failed item was opening the
// native folder picker again, with nothing to explain why — confusing, since the developer's
// mental model of "Retry" is "try that again," not "pick a location, then try that again."
// AC18 asks for the destination folder to be asked "once" in the first place; read literally as
// once per QUEUE SESSION rather than once per click, so the first successful pick is remembered
// here and reused silently for every later conversion or retry, and the dialog only reappears if
// nothing has been chosen yet.
const lastOutputDir = ref<string | null>(null);
// Code review 2026-09-15: `resolveOutputDir` only short-circuited on the already-resolved
// `lastOutputDir`, so two near-simultaneous callers (e.g. "Convert all" awaiting the first folder
// dialog, plus an unguarded `retryItem` click) could both see it as unset and open the native
// folder picker twice. This tracks the in-flight promise so a concurrent caller awaits the same
// pick instead of starting a second one.
let pendingOutputDir: Promise<string | null> | null = null;

async function resolveOutputDir(): Promise<string | null> {
  if (lastOutputDir.value) return lastOutputDir.value;
  if (pendingOutputDir) return pendingOutputDir;
  pendingOutputDir = (async () => {
    const picked = await open({ directory: true });
    if (picked === null || Array.isArray(picked)) return null;
    lastOutputDir.value = picked;
    return picked;
  })();
  try {
    return await pendingOutputDir;
  } finally {
    pendingOutputDir = null;
  }
}

function currentResize(): { width: string; height: string; allowUpscale: boolean } | undefined {
  if (resizeWidth.value.trim() === "" || resizeHeight.value.trim() === "") return undefined;
  return { width: resizeWidth.value, height: resizeHeight.value, allowUpscale: !aspectLocked.value };
}

async function convertItem(item: QueueItem, outputDir: string) {
  item.status = "converting";
  item.error = null;
  try {
    const result = await item.runner(() =>
      invoke<{ outputPath: string; originalBytes: number; convertedBytes: number }>(
        "image_convert",
        {
          path: item.path,
          targetFormat: targetFormat.value,
          quality: quality.value,
          outputDir,
          resize: currentResize(),
          background: backgroundColor.value,
        },
      ),
    );
    if (result.superseded) return;
    item.status = "done";
    item.outputPath = result.value.outputPath;
    item.originalBytes = result.value.originalBytes;
    item.convertedBytes = result.value.convertedBytes;
  } catch (err) {
    item.status = "error";
    item.error = toToolError(err);
  }
}

// Code review 2026-09-15: was `status !== "error"`, which also counted already-"done" items as
// "ready" — after a fully successful batch the button stayed enabled and the hint still read
// "N of N ready," but clicking it was a silent no-op since `onConvertAll`'s own `runnable` filter
// below is the true "can be (re)converted" set. Kept in sync with that filter explicitly.
const readyCount = computed(
  () => queue.value.filter((item) => item.status === "pending" || item.status === "error").length,
);

/** AC18: "Convert all" — pending and previously-errored items are (re)run; a "done" item is left
 *  alone unless the user explicitly retries it (see `retryItem`), so reconverting everything on
 *  a settings change does not also re-write files that already succeeded under the old settings
 *  — the user would have to notice and re-open the destination folder to tell those apart. */
async function onConvertAll() {
  const runnable = queue.value.filter((item) => item.status === "pending" || item.status === "error");
  if (runnable.length === 0) return;
  const outputDir = await resolveOutputDir();
  if (outputDir === null) return;

  converting.value = true;
  announcement.value = "";
  try {
    await Promise.all(runnable.map((item) => convertItem(item, outputDir)));
  } finally {
    converting.value = false;
    const done = queue.value.filter((item) => item.status === "done").length;
    // Code review 2026-09-15: this branches on `done`, the count the sentence is actually about
    // — not on `queue.value.length`, which used to select "1 of 1 converted" even when that one
    // item's conversion had failed.
    announcement.value =
      done === 1
        ? t("tools.image.summaryOne", { total: queue.value.length })
        : t("tools.image.summaryOther", { done, total: queue.value.length });
  }
}

async function retryItem(item: QueueItem) {
  const outputDir = await resolveOutputDir();
  if (outputDir === null) return;
  await convertItem(item, outputDir);
}

// ---- formatting ----

function formatBytes(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${n(kb / 1024, "decimal1")} ${t("tools.image.sizeUnitMb")}`;
  }
  return `${n(kb, "decimal1")} ${t("tools.image.sizeUnitKb")}`;
}

function savingsPercent(original: number, converted: number): string {
  if (original <= 0) return "";
  const percent = Math.round((1 - converted / original) * 100);
  // U+2212 (minus sign), not a hyphen, matching this app's other signed-figure conventions —
  // and an explicit "+" when a conversion (an aggressive upscale, typically) made the file grow,
  // so that case reads as fact rather than as a mislabeled saving.
  return percent >= 0 ? `−${percent}%` : `+${Math.abs(percent)}%`;
}

function statsLabel(item: QueueItem): string {
  if (item.originalBytes === null || item.convertedBytes === null) return "";
  return t("tools.image.savedStats", {
    original: formatBytes(item.originalBytes),
    converted: formatBytes(item.convertedBytes),
    percent: savingsPercent(item.originalBytes, item.convertedBytes),
  });
}

function basename(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] || path;
}

// ---- compare (AC27/AC27a) ----

const compareItem = ref<QueueItem | null>(null);
const dividerPercent = ref(50);
let dragFrame: HTMLElement | null = null;
// Code review 2026-09-15: the compare overlay is `role="dialog" aria-modal="true"` but nothing
// moved focus into it on open or let a keyboard user dismiss it with Escape. `compareHandle`
// gives `openCompare` something focusable to hand focus to once the overlay has rendered.
const compareHandle = ref<HTMLElement | null>(null);

function openCompare(item: QueueItem) {
  compareItem.value = item;
  dividerPercent.value = 50;
  void nextTick(() => compareHandle.value?.focus());
}

function closeCompare() {
  compareItem.value = null;
  dragFrame = null;
}

function onCompareOverlayKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeCompare();
  }
}

function setDividerFromClientX(clientX: number) {
  if (!dragFrame) return;
  const rect = dragFrame.getBoundingClientRect();
  const ratio = ((clientX - rect.left) / rect.width) * 100;
  dividerPercent.value = Math.min(100, Math.max(0, ratio));
}

function onDividerPointerDown(event: PointerEvent) {
  // Render review feedback (2026-09-15): moving the cursor off the small handle while still
  // dragging let the browser's own click-drag text/element selection kick in underneath — the
  // native gesture that highlights content in light blue, same as selecting a paragraph, and
  // it fires independently of this handler's own logic. `preventDefault` here stops that
  // gesture from ever starting; `user-select: none` on `.compare-frame` (below) is the second
  // half — belt and braces, since `preventDefault` alone doesn't catch every browser's path
  // into a selection once the pointer leaves the handle element.
  event.preventDefault();
  dragFrame = (event.currentTarget as HTMLElement).closest(".compare-frame");
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
  setDividerFromClientX(event.clientX);
}

function onDividerPointerMove(event: PointerEvent) {
  if (event.buttons === 0) return;
  setDividerFromClientX(event.clientX);
}

// AC27a: dragging is never the only way to move the divider — arrow keys move it once it has
// focus, in steps a keyboard user can feel (2%, or 10% with Shift for a faster sweep).
function onDividerKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 10 : 2;
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      dividerPercent.value = Math.max(0, dividerPercent.value - step);
      break;
    case "ArrowRight":
      event.preventDefault();
      dividerPercent.value = Math.min(100, dividerPercent.value + step);
      break;
    case "Home":
      event.preventDefault();
      dividerPercent.value = 0;
      break;
    case "End":
      event.preventDefault();
      dividerPercent.value = 100;
      break;
    default:
      break;
  }
}

const compareBeforeSrc = computed(() =>
  compareItem.value ? convertFileSrc(compareItem.value.path) : "",
);
const compareAfterSrc = computed(() =>
  compareItem.value?.outputPath ? convertFileSrc(compareItem.value.outputPath) : "",
);

onUnmounted(() => {
  dragFrame = null;
});
</script>

<template>
  <section class="image-section">
    <h1>{{ t('tools.image.imageSectionHeading') }}</h1>

    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </p>
    <p
      v-if="topLevelError"
      class="error"
      role="alert"
    >
      {{ toolErrorMessage(topLevelError, t) }}
    </p>

    <!-- AC5/AC20: the empty state is the drop target; once files are queued the settings + queue
         panel take over, but drop keeps working everywhere (shell-level, AD-14). -->
    <div
      v-if="queue.length === 0"
      class="drop-target"
      :class="{ 'drag-over': isDragOver }"
    >
      <p class="drop-label">
        {{ isDragOver ? t('tools.image.dropToOpen') : t('tools.image.dropLabel') }}
      </p>
      <AppButton @click="onChooseImages">
        {{ t('tools.image.chooseImages') }}
      </AppButton>
      <p class="drop-hint">
        {{ t('tools.image.dropHint') }}
      </p>
    </div>

    <template v-else>
      <!-- AC20/AC25/AC6: batch-wide settings, applied to every queued file. -->
      <div class="panel settings-panel">
        <div class="settings-row">
          <div class="field">
            <label for="image-target-format">{{ t('tools.image.targetFormat') }}</label>
            <select
              id="image-target-format"
              v-model="targetFormat"
            >
              <option value="jpeg">
                JPEG
              </option>
              <option value="png">
                PNG
              </option>
              <option value="webp">
                WebP
              </option>
              <option value="avif">
                AVIF
              </option>
            </select>
          </div>

          <div
            v-if="showQualityControl"
            class="field"
          >
            <label for="image-quality">{{ t('tools.image.qualityLabel', { quality }) }}</label>
            <input
              id="image-quality"
              v-model.number="quality"
              type="range"
              min="1"
              max="100"
              @pointerdown="onSliderPointerDown"
            >
          </div>

          <div class="field">
            <span class="field-label">{{ t('tools.image.resizeLabel') }}</span>
            <div class="resize-row">
              <input
                v-model="resizeWidth"
                type="text"
                inputmode="numeric"
                class="dimension-input"
                :aria-label="t('tools.image.resizeWidthLabel')"
                @input="onResizeWidthInput"
              >
              <!-- The toggle IS the separator between the two fields — a chain-link icon sitting
                   directly on the connecting line, not a control floating above or below it
                   (render review 2026-09-15). PhLink/PhLinkSimpleBreak crossfade in place; the
                   line itself also switches solid-orange/dashed-grey, so the "linked" state reads
                   from the wire as well as the icon. -->
              <button
                type="button"
                class="link-toggle"
                :class="{ locked: aspectLocked }"
                :aria-pressed="aspectLocked"
                :aria-label="t('tools.image.lockAspectRatio')"
                :title="t('tools.image.lockAspectRatio')"
                @click="aspectLocked = !aspectLocked"
              >
                <span
                  class="link-line"
                  aria-hidden="true"
                />
                <span
                  class="link-icon-well"
                  aria-hidden="true"
                >
                  <PhLink class="link-icon link-icon-locked" />
                  <PhLinkSimpleBreak class="link-icon link-icon-unlocked" />
                </span>
              </button>
              <input
                v-model="resizeHeight"
                type="text"
                inputmode="numeric"
                class="dimension-input"
                :aria-label="t('tools.image.resizeHeightLabel')"
                @input="onResizeHeightInput"
              >
              <span class="hint">{{ t('tools.image.resizeUnit') }}</span>
            </div>
          </div>

          <div
            v-if="showBackgroundControl"
            class="field"
          >
            <label for="image-background">{{ t('tools.image.backgroundLabel') }}</label>
            <div class="resize-row">
              <input
                id="image-background"
                v-model="backgroundColor"
                type="color"
              >
              <span class="hint">{{ t('tools.image.backgroundHint') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- AC16/AC17/AC27/AC28: the queue itself. -->
      <div
        class="panel queue-panel"
        :class="{ 'drag-over': isDragOver }"
      >
        <div class="panel-head">
          <h2>
            {{ queue.length === 1
              ? t('tools.image.queueHeadingOne')
              : t('tools.image.queueHeadingOther', { count: queue.length }) }}
          </h2>
          <AppButton @click="onChooseImages">
            {{ t('tools.image.addMore') }}
          </AppButton>
        </div>

        <ul class="queue-list">
          <li
            v-for="item in queue"
            :key="item.id"
            class="queue-row"
          >
            <span
              class="thumb"
              :class="{ 'thumb-error': item.status === 'error' }"
            >
              <PhWarningCircle
                v-if="item.status === 'error'"
                aria-hidden="true"
              />
              <img
                v-else-if="!item.thumbnailFailed"
                class="thumb-image"
                :src="convertFileSrc(item.path)"
                alt=""
                @error="item.thumbnailFailed = true"
              >
              <PhImage
                v-else
                aria-hidden="true"
              />
            </span>

            <span
              class="file-name"
              :title="item.path"
            >{{ basename(item.path) }}</span>

            <!-- Render review feedback (2026-09-15): a pending item showed a "Waiting…" chip the
                 instant it was queued — noise, not information, for a batch that hasn't been
                 asked to do anything yet. A freshly-added file now renders with just its
                 thumbnail and name until it's actually converting, done, or errored. -->
            <template v-if="item.status === 'converting'">
              <span
                class="spinner"
                role="status"
                :aria-label="t('tools.image.converting')"
              />
              <span class="chip status-converting">{{ t('tools.image.converting') }}</span>
            </template>

            <template v-else-if="item.status === 'done'">
              <span class="hint stats">{{ statsLabel(item) }}</span>
              <button
                type="button"
                class="compare-button"
                @click="openCompare(item)"
              >
                {{ t('tools.image.compare') }}
              </button>
              <span class="chip status-done">{{ t('tools.image.done') }}</span>
            </template>

            <template v-else-if="item.status === 'error'">
              <span
                class="error-text"
                :title="toolErrorMessage(item.error!, t)"
              >{{ toolErrorMessage(item.error!, t) }}</span>
              <button
                type="button"
                class="ghost-button"
                @click="retryItem(item)"
              >
                {{ t('tools.image.retry') }}
              </button>
              <span class="chip status-error">{{ t('tools.image.error') }}</span>
            </template>

            <button
              type="button"
              class="ghost"
              :aria-label="t('tools.image.remove')"
              :title="t('tools.image.remove')"
              :disabled="item.status === 'converting'"
              @click="removeItem(item)"
            >
              <PhX aria-hidden="true" />
            </button>
          </li>
        </ul>

        <div class="convert-bar">
          <AppButton
            variant="primary"
            :disabled="readyCount === 0 || converting"
            @click="onConvertAll"
          >
            {{ queue.length === 1 ? t('tools.image.convertOne') : t('tools.image.convertAll') }}
          </AppButton>
          <span class="hint">
            {{ readyCount === 1
              ? t('tools.image.readyCountOne', { total: queue.length })
              : t('tools.image.readyCountOther', { ready: readyCount, total: queue.length }) }}
          </span>
        </div>
      </div>
    </template>

    <!-- AC27/AC27a: the slider/wipe compare, with a keyboard-operable divider — dragging is
         never the only way to move it. -->
    <div
      v-if="compareItem"
      class="compare-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('tools.image.compare')"
      @keydown="onCompareOverlayKeydown"
    >
      <div
        class="compare-frame"
        @pointermove="onDividerPointerMove"
      >
        <img
          class="compare-image"
          :src="compareBeforeSrc"
          alt=""
        >
        <div
          class="compare-after-clip"
          :style="{ clipPath: `inset(0 0 0 ${dividerPercent}%)` }"
        >
          <img
            class="compare-image"
            :src="compareAfterSrc"
            alt=""
          >
        </div>
        <div
          class="compare-line"
          :style="{ left: dividerPercent + '%' }"
        />
        <div
          ref="compareHandle"
          class="compare-handle"
          role="slider"
          tabindex="0"
          :aria-valuenow="Math.round(dividerPercent)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="t('tools.image.compareDividerLabel')"
          :style="{ left: dividerPercent + '%' }"
          @keydown="onDividerKeydown"
          @pointerdown="onDividerPointerDown"
        />
        <!-- Code review 2026-09-15: these used to render unconditionally, mislabeling the frame
             at the divider's extremes (both reachable via the Home/End keys AC27a requires) —
             at dividerPercent 0 the whole frame shows only the after-image, yet "Before" still
             rendered; at 100 the reverse. Hidden exactly when their own image is fully covered. -->
        <span
          v-if="dividerPercent > 0"
          class="compare-tag compare-tag-before"
        >{{ t('tools.image.before') }}</span>
        <span
          v-if="dividerPercent < 100"
          class="compare-tag compare-tag-after"
        >{{ t('tools.image.after') }}</span>
      </div>
      <p class="hint">
        {{ compareItem ? statsLabel(compareItem) : '' }}
      </p>
      <AppButton @click="closeCompare">
        {{ t('tools.image.closeCompare') }}
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
.image-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

h1 {
  font-family: var(--font-heading-family);
  font-size: var(--font-heading-size);
  font-weight: var(--font-heading-weight);
  line-height: var(--font-heading-line-height);
  margin: 0;
}

h2 {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  line-height: var(--font-label-line-height);
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* AC5: HashView's/OcrView's/PdfView's dashed-box drop language, used literally. */
.drop-target {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  min-height: 280px;
  padding: var(--spacing-6);
  border: 2px dashed var(--color-border-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
}

.drop-target.drag-over {
  border-style: solid;
  border-color: var(--color-accent-signature);
  background: var(--color-accent-signature-tint);
}

.drop-label {
  margin: 0;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-text-primary);
}

.drop-hint,
.hint {
  margin: 0;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
}

.panel {
  padding: var(--spacing-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-lg);
}

.settings-row {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-5);
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.field label,
.field-label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  color: var(--color-text-primary);
}

.resize-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.dimension-input {
  width: 4.5em;
  font-family: inherit;
  font-size: var(--font-body-size);
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  padding: 0.4em 0.5em;
}

/* The toggle sits IN the line between the two dimension fields, not above or below it
   (render review 2026-09-15) — .link-line is a hairline that reaches into the row's own gap on
   both sides so it reads as one continuous wire running through the button, and .link-icon-well
   punches a plain circular hole in that wire for the glyph to sit on, the same "bead on a wire"
   read a real chain link gets. */
.link-toggle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: none;
  background: none;
  padding: 0;
  border-radius: var(--radius-default);
  cursor: pointer;
}

.link-line {
  position: absolute;
  left: calc(-1 * var(--spacing-1));
  right: calc(-1 * var(--spacing-1));
  top: 50%;
  height: 1px;
  background: var(--color-border-hairline);
  transform: translateY(-50%);
  transition: background 180ms ease;
}

.link-toggle.locked .link-line {
  background: var(--color-accent-signature);
}

.link-icon-well {
  position: relative;
  z-index: 1;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.link-icon {
  position: absolute;
  inset: 0;
  width: 16px;
  height: 16px;
  margin: auto;
  color: var(--color-text-tertiary);
  transition: opacity 200ms cubic-bezier(.32, .72, 0, 1), transform 200ms cubic-bezier(.32, .72, 0, 1);
}

.link-icon-locked {
  opacity: 0;
  transform: scale(1.3) rotate(10deg);
}

.link-icon-unlocked {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}

.link-toggle.locked .link-icon-locked {
  opacity: 1;
  transform: scale(1) rotate(0deg);
  color: var(--color-accent-signature);
}

.link-toggle.locked .link-icon-unlocked {
  opacity: 0;
  transform: scale(0.7) rotate(-10deg);
}

.link-toggle:hover .link-icon-well {
  background: var(--color-bg-base);
}

.link-toggle:focus-visible,
.compare-button:focus-visible,
.ghost-button:focus-visible,
.ghost:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .link-line,
  .link-icon {
    transition: none;
  }
}

.panel-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
}

.panel-head h2 {
  flex: 1;
}

.queue-panel.drag-over {
  border-style: solid;
  border-color: var(--color-accent-signature);
  background: var(--color-accent-signature-tint);
}

.queue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.queue-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
}

.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex: none;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-hairline);
  color: var(--color-text-secondary);
}

.thumb-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-error {
  color: var(--color-accent-destructive);
}

.file-name {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-text-primary);
}

.stats {
  white-space: nowrap;
}

.error-text {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-accent-destructive);
}

/* Code review 2026-09-15: top-level picker/drop failures used to have no visible surface, only
   the sr-only announcement below — mirrors PdfView.vue's own `.error` class exactly. */
.error {
  margin: 0;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-accent-destructive);
}

.chip {
  padding: 2px var(--spacing-2);
  border-radius: var(--radius-full);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  white-space: nowrap;
  background: var(--color-bg-base);
  color: var(--color-text-secondary);
}

.chip.status-converting {
  background: var(--color-accent-signature-tint);
  color: var(--color-accent-signature);
}

.chip.status-done {
  color: var(--color-accent-success, #15803d);
}

.chip.status-error {
  color: var(--color-accent-destructive);
}

.spinner {
  width: 16px;
  height: 16px;
  flex: none;
  border-radius: 50%;
  border: 2px solid var(--color-accent-signature-tint);
  border-top-color: var(--color-accent-signature);
  animation: image-spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}

@keyframes image-spin {
  to {
    transform: rotate(360deg);
  }
}

.compare-button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  background: none;
  padding: 4px var(--spacing-2);
  font-family: inherit;
  font-size: var(--font-caption-size);
  color: var(--color-text-primary);
  cursor: pointer;
  white-space: nowrap;
}

.ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: none;
  background: none;
  border-radius: var(--radius-default);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.convert-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-top: var(--spacing-3);
}

/* AC27/AC27a: the wipe compare. Bottom layer is the ORIGINAL, full width; the CONVERTED layer
   sits on top, clipped to only the region right of the divider, which is what reveals "before"
   on the left and "after" on the right. */
.compare-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  background: var(--color-bg-scrim, rgba(0, 0, 0, 0.4));
}

.compare-frame {
  position: relative;
  width: min(90vw, 720px);
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--radius-default);
  /* The second half of the pointerdown `preventDefault` fix above — belt and braces against the
     browser's own click-drag text/element selection lighting up the frame in the OS's selection
     blue while dragging the divider. Inherits into every child (images, tags), which is exactly
     what's wanted here — nothing in the compare view is text a user would select anyway. */
  user-select: none;
  -webkit-user-select: none;
  background: var(--color-bg-base);
  touch-action: none;
}

.compare-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--color-bg-base);
  /* WebKit lets an <img> start its own native drag independently of text selection — the same
     class of interference `user-select: none` above fixes for selection, this fixes for drag. */
  -webkit-user-drag: none;
}

.compare-after-clip {
  position: absolute;
  inset: 0;
}

.compare-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
  transform: translateX(-1px);
  pointer-events: none;
}

.compare-handle {
  position: absolute;
  top: 50%;
  width: 28px;
  height: 28px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  cursor: ew-resize;
}

.compare-handle:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
}

.compare-tag {
  position: absolute;
  top: var(--spacing-2);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  font-weight: 600;
  color: #18181b;
  background: rgba(255, 255, 255, 0.85);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  pointer-events: none;
}

.compare-tag-before {
  left: var(--spacing-2);
}

.compare-tag-after {
  right: var(--spacing-2);
}
</style>
