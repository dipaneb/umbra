<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useRegistryStore } from "../../stores/registry";
import { writeClipboardText } from "../../shell/clipboard";
import { debounce } from "../../shell/debounce";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import type { OcrOutcome } from "./ocrOutcome";
import type { ImageTargetFormat } from "./imageTargetFormat";

const { t, n } = useI18n();

type BucketResult = { toolId: string; value: unknown } | { toolId: string; error: ToolError };

const outcome = ref<OcrOutcome | null>(null);
const error = ref<ToolError | null>(null);
// AC2: editable in place, re-seeded from each new `outcome.text` as it arrives; Copy always
// copies this current edited value, not the original `outcome.text`.
const editedText = ref("");

const registry = useRegistryStore();

// AD-14: `DropZone.vue` is the shell's single generic dispatcher — it
// invokes `bucket_extract_text` itself, already routed through
// `registry.getLatestWinsRunner("bucket")` (AD-16) on its own. This view
// only consumes the outcome via `registry.dropResult`; no local
// `createLatestWinsRunner()` here — Story 4.2 adds a second write-trigger
// (clipboard-paste) that must share this same tool-scoped runner, not a
// separate one (ARCHITECTURE-SPINE.md's AD-16 amendment, `HashView.vue` is
// the reference implementation for that shape).
function applyBucketResult(result: BucketResult) {
  if ("error" in result) {
    outcome.value = null;
    error.value = result.error;
  } else {
    error.value = null;
    outcome.value = result.value as OcrOutcome;
    editedText.value = outcome.value.text;
  }
}

watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "bucket") return;
    registry.dropResult = null; // one-shot signal
    applyBucketResult(result);
  },
);

// Story 4.2: paste dispatches through the same registry-declared handler shape as drop
// (`getLatestWinsRunner("bucket")` shared by both, per AD-16's amendment), delivered via its own
// `pasteResult` field rather than repurposing `dropResult` — five other tools depend on
// `dropResult` meaning "a file-drop outcome" exactly.
watch(
  () => registry.pasteResult,
  (result) => {
    if (!result || result.toolId !== "bucket") return;
    registry.pasteResult = null; // one-shot signal
    applyBucketResult(result);
  },
);

async function onCopy() {
  error.value = null;
  try {
    await writeClipboardText(editedText.value);
  } catch (err) {
    error.value = toToolError(err);
  }
}

// --- PDF section (Story 6.1) ---
// Deliberately separate state from the OCR section above: this is a second, disjoint state
// group in the same view, triggered only by explicit button clicks (never drop/paste), so it
// gets its own local latest-wins runner rather than reusing `registry.getLatestWinsRunner
// ("bucket")` — reusing it would let a PDF operation spuriously mark an in-flight OCR
// extraction as "superseded," or vice versa, per AD-16's amendment (see ARCHITECTURE-SPINE.md).
// A function, not a module-level const: these render in the OS's native
// file-picker dialog, so the label must reflect the *current* locale at the
// moment the dialog opens — a plain const captured at component-creation
// time would go stale if the user switches language without navigating away
// from this view.
function pdfFilters() {
  return [{ name: t("tools.bucket.pdfFilterName"), extensions: ["pdf"] }];
}

const pdfError = ref<ToolError | null>(null);
const runPdf = createLatestWinsRunner();

const pdfMergeFiles = ref<string[]>([]);
const pdfMerging = ref(false);

const pdfExtractPagesPath = ref<string | null>(null);
const pdfStartPage = ref(1);
const pdfEndPage = ref(1);
const pdfExtractingPages = ref(false);

const pdfExtractTextPath = ref<string | null>(null);
const pdfExtractedText = ref("");
const pdfExtractingText = ref(false);
const pdfTextExtracted = ref(false);

async function onAddPdfsForMerge() {
  pdfError.value = null;
  try {
    const paths = await open({ multiple: true, filters: pdfFilters() });
    if (paths === null) return;
    pdfMergeFiles.value.push(...paths);
  } catch (err) {
    pdfError.value = toToolError(err);
  }
}

function moveMergeFileUp(index: number) {
  if (index <= 0) return;
  pdfError.value = null;
  const files = pdfMergeFiles.value;
  [files[index - 1], files[index]] = [files[index], files[index - 1]];
}

function moveMergeFileDown(index: number) {
  pdfError.value = null;
  const files = pdfMergeFiles.value;
  if (index >= files.length - 1) return;
  [files[index], files[index + 1]] = [files[index + 1], files[index]];
}

function removeMergeFile(index: number) {
  pdfError.value = null;
  pdfMergeFiles.value.splice(index, 1);
}

async function onMergePdfs() {
  pdfError.value = null;
  pdfMerging.value = true;
  try {
    const outputPath = await save({ filters: pdfFilters() });
    if (outputPath === null) return;
    const result = await runPdf(() =>
      invoke("bucket_merge_pdfs", { paths: pdfMergeFiles.value, outputPath }),
    );
    if (!result.superseded) {
      pdfMergeFiles.value = [];
    }
  } catch (err) {
    pdfError.value = toToolError(err);
  } finally {
    pdfMerging.value = false;
  }
}

async function onPickExtractPagesFile() {
  pdfError.value = null;
  try {
    const path = await open({ filters: pdfFilters() });
    if (path === null) return;
    pdfExtractPagesPath.value = path;
  } catch (err) {
    pdfError.value = toToolError(err);
  }
}

async function onExtractPages() {
  if (!pdfExtractPagesPath.value) return;
  pdfError.value = null;
  pdfExtractingPages.value = true;
  try {
    const outputPath = await save({ filters: pdfFilters() });
    if (outputPath === null) return;
    await runPdf(() =>
      invoke("bucket_extract_pdf_pages", {
        path: pdfExtractPagesPath.value,
        startPage: pdfStartPage.value,
        endPage: pdfEndPage.value,
        outputPath,
      }),
    );
  } catch (err) {
    pdfError.value = toToolError(err);
  } finally {
    pdfExtractingPages.value = false;
  }
}

async function onPickExtractTextFile() {
  pdfError.value = null;
  try {
    const path = await open({ filters: pdfFilters() });
    if (path === null) return;
    pdfExtractTextPath.value = path;
    pdfExtractedText.value = "";
    pdfTextExtracted.value = false;
  } catch (err) {
    pdfError.value = toToolError(err);
  }
}

async function onExtractText() {
  if (!pdfExtractTextPath.value) return;
  pdfError.value = null;
  pdfExtractingText.value = true;
  try {
    const result = await runPdf(() =>
      invoke<string>("bucket_extract_pdf_text", { path: pdfExtractTextPath.value }),
    );
    if (!result.superseded) {
      pdfExtractedText.value = result.value;
      pdfTextExtracted.value = true;
    }
  } catch (err) {
    pdfExtractedText.value = "";
    pdfTextExtracted.value = false;
    pdfError.value = toToolError(err);
  } finally {
    pdfExtractingText.value = false;
  }
}

async function onCopyExtractedPdfText() {
  pdfError.value = null;
  try {
    await writeClipboardText(pdfExtractedText.value);
  } catch (err) {
    pdfError.value = toToolError(err);
  }
}

// --- Image section (Story 6.2) ---
// A third, disjoint state group (same AD-16 reasoning as the PDF section above). Two local
// runners, not one: the live estimate can fire many times per second while the quality slider is
// dragged, and a Convert click can land mid-stream — sharing one runner between "the live
// preview" and "the actual save-to-disk conversion" risks one superseding the other's result,
// matching CronView.vue's "two disjoint state-groups get two runners" reasoning (not
// Base64View.vue's "three same-shape actions share one" reasoning, which fits discrete
// non-overlapping clicks only).
// Same reasoning as pdfFilters() above — a function, not a module-level const.
function imageFilters() {
  return [{ name: t("tools.bucket.imageFilterName"), extensions: ["png", "jpg", "jpeg", "webp"] }];
}

// The save dialog's `filters` only names *extensions*, not which target format each one maps to
// — so a single filter entry listing all four (fine for the *open* picker, which accepts any of
// them) would make the save dialog default its suggested filename to the first extension in the
// list ("png") regardless of `imageTargetFormat`. Scope the save-side filter and default filename
// to the one real output extension instead, so the suggested name always matches what `convert`
// actually writes (magic numbers, not extension, are what identify a file's real format — but
// the OS-level save dialog only ever has a filename to go on, so it needs to be told correctly).
function targetExtension(format: ImageTargetFormat): string {
  switch (format) {
    case "png":
      return "png";
    case "jpeg":
      return "jpg";
    case "webp":
      return "webp";
  }
}

function defaultConvertedFileName(sourcePath: string, format: ImageTargetFormat): string {
  const baseName = sourcePath.split(/[/\\]/).pop() ?? "";
  const stem = baseName.replace(/\.[^./\\]+$/, "") || t("tools.bucket.defaultFileNameStem");
  return `${stem}.${targetExtension(format)}`;
}

const imageError = ref<ToolError | null>(null);
const runImageEstimate = createLatestWinsRunner();
const runImageConvert = createLatestWinsRunner();

const imagePath = ref<string | null>(null);
const imageTargetFormat = ref<ImageTargetFormat>("jpeg");
const imageQuality = ref(80); // no source specifies a default; a reasonable mid-high choice
const imageEstimatedSize = ref<number | null>(null);
const imageEstimating = ref(false);
const imageConverting = ref(false);

async function onPickImage() {
  imageError.value = null;
  try {
    const path = await open({ filters: imageFilters() });
    if (path === null) return;
    imagePath.value = path;
    imageEstimatedSize.value = null;
  } catch (err) {
    imageError.value = toToolError(err);
  }
}

async function runEstimate() {
  if (!imagePath.value) return;
  imageError.value = null;
  imageEstimating.value = true;
  try {
    const result = await runImageEstimate(() =>
      invoke<number>("bucket_estimate_image_size", {
        path: imagePath.value,
        targetFormat: imageTargetFormat.value,
        quality: imageQuality.value,
      }),
    );
    if (!result.superseded) {
      imageEstimatedSize.value = result.value;
    }
  } catch (err) {
    // runImageEstimate already swallows stale rejections as `{ superseded: true }` (see
    // shell/invoke.ts) — anything that reaches this catch is a genuinely fresh error.
    imageEstimatedSize.value = null;
    imageError.value = toToolError(err);
  } finally {
    imageEstimating.value = false;
  }
}

// Debounces the *invocation itself*, not just resolution of out-of-order results: the
// latest-wins runner above resolves out-of-order results, it does not reduce invocation volume —
// without this, an undebounced slider drag would fire one spawn_blocking image-encode per input
// event. 200ms matches this codebase's existing debounce precedent (json.rs's live tree-parse).
const debouncedEstimate = debounce(() => void runEstimate(), 200);

watch([imagePath, imageTargetFormat, imageQuality], () => {
  if (!imagePath.value) return;
  // Clear the previous selection's estimate immediately (not just on debounce resolution) so a
  // stale number is never shown against the newly selected format/quality.
  imageEstimatedSize.value = null;
  debouncedEstimate();
});

onUnmounted(() => debouncedEstimate.cancel());

async function onConvertImage() {
  if (!imagePath.value) return;
  // Snapshot the selection at click time: the file picker/format select/quality slider are
  // disabled while imageConverting is true (see template), but the native save() dialog itself
  // still runs before that disables anything, and the async gap between click and the eventual
  // invoke() call should convert exactly what the user selected when they clicked — not whatever
  // the refs happen to hold once the dialog resolves.
  const path = imagePath.value;
  const targetFormat = imageTargetFormat.value;
  const quality = imageQuality.value;

  imageError.value = null;
  imageConverting.value = true;
  try {
    const outputPath = await save({
      filters: [{ name: t("tools.bucket.imageFilterName"), extensions: [targetExtension(targetFormat)] }],
      defaultPath: defaultConvertedFileName(path, targetFormat),
    });
    if (outputPath === null) return;
    await runImageConvert(() =>
      invoke("bucket_convert_image", {
        path,
        targetFormat,
        quality,
        outputPath,
      }),
    );
  } catch (err) {
    imageError.value = toToolError(err);
  } finally {
    imageConverting.value = false;
  }
}

// No existing byte-formatting helper in this codebase (confirmed by reading BucketView.vue,
// Base64View.vue, HashView.vue) — small enough to keep local rather than a new shared module.
// Routed through n() (vue-i18n's Intl.NumberFormat wrapper) rather than a bare `.toFixed(1)`,
// so the decimal separator follows the app's locale — French uses a comma ("1,5 Mo"), not a
// period — and through translated unit keys, since French uses "Ko"/"Mo" (octet), not "KB"/"MB".
function formatEstimatedSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${n(kb / 1024, "decimal1")} ${t("tools.bucket.sizeUnitMb")}`;
  }
  return `${n(kb, "decimal1")} ${t("tools.bucket.sizeUnitKb")}`;
}
</script>

<template>
  <section>
    <h1>{{ t('tools.bucket.heading') }}</h1>

    <p class="drop-hint">
      {{ t('tools.bucket.dropHint') }}
    </p>

    <p
      v-if="error"
      role="alert"
    >
      {{ toolErrorMessage(error, t) }}
    </p>

    <p
      v-if="outcome && !outcome.text.trim()"
      role="status"
    >
      {{ t('tools.bucket.noTextInImage') }}
    </p>

    <div
      v-if="outcome && outcome.text.trim()"
      class="field"
    >
      <label for="bucket-result">{{ t('tools.bucket.extractedTextLabel') }}</label>
      <textarea
        id="bucket-result"
        v-model="editedText"
        class="result"
        rows="10"
      />
      <button
        type="button"
        @click="onCopy"
      >
        {{ t('common.copy') }}
      </button>
    </div>

    <section class="pdf-section">
      <h2>{{ t('tools.bucket.pdfSectionHeading') }}</h2>

      <p
        v-if="pdfError"
        role="alert"
      >
        {{ toolErrorMessage(pdfError, t) }}
      </p>

      <div class="pdf-flow">
        <h3>{{ t('tools.bucket.mergeHeading') }}</h3>
        <button
          type="button"
          :disabled="pdfMerging"
          @click="onAddPdfsForMerge"
        >
          {{ t('tools.bucket.addPdfs') }}
        </button>
        <ul v-if="pdfMergeFiles.length">
          <li
            v-for="(path, index) in pdfMergeFiles"
            :key="path + index"
          >
            {{ path }}
            <button
              type="button"
              :disabled="index === 0"
              :aria-label="t('tools.bucket.moveUp')"
              @click="moveMergeFileUp(index)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="index === pdfMergeFiles.length - 1"
              :aria-label="t('tools.bucket.moveDown')"
              @click="moveMergeFileDown(index)"
            >
              ↓
            </button>
            <button
              type="button"
              @click="removeMergeFile(index)"
            >
              {{ t('tools.bucket.remove') }}
            </button>
          </li>
        </ul>
        <button
          type="button"
          :disabled="pdfMergeFiles.length < 2 || pdfMerging"
          @click="onMergePdfs"
        >
          {{ t('tools.bucket.merge') }}
        </button>
      </div>

      <div class="pdf-flow">
        <h3>{{ t('tools.bucket.splitExtractHeading') }}</h3>
        <button
          type="button"
          @click="onPickExtractPagesFile"
        >
          {{ t('tools.bucket.choosePdf') }}
        </button>
        <p v-if="pdfExtractPagesPath">
          {{ pdfExtractPagesPath }}
        </p>
        <label for="pdf-start-page">{{ t('tools.bucket.startPage') }}</label>
        <input
          id="pdf-start-page"
          v-model.number="pdfStartPage"
          type="number"
          min="1"
          step="1"
        >
        <label for="pdf-end-page">{{ t('tools.bucket.endPage') }}</label>
        <input
          id="pdf-end-page"
          v-model.number="pdfEndPage"
          type="number"
          min="1"
          step="1"
        >
        <button
          type="button"
          :disabled="
            !pdfExtractPagesPath ||
              !Number.isInteger(pdfStartPage) ||
              !Number.isInteger(pdfEndPage) ||
              pdfStartPage < 1 ||
              pdfStartPage > pdfEndPage ||
              pdfExtractingPages
          "
          @click="onExtractPages"
        >
          {{ t('tools.bucket.extractPages') }}
        </button>
      </div>

      <div class="pdf-flow">
        <h3>{{ t('tools.bucket.extractTextHeading') }}</h3>
        <button
          type="button"
          @click="onPickExtractTextFile"
        >
          {{ t('tools.bucket.choosePdf') }}
        </button>
        <p v-if="pdfExtractTextPath">
          {{ pdfExtractTextPath }}
        </p>
        <button
          type="button"
          :disabled="!pdfExtractTextPath || pdfExtractingText"
          @click="onExtractText"
        >
          {{ t('tools.bucket.extractText') }}
        </button>

        <p
          v-if="pdfTextExtracted && !pdfExtractedText.trim()"
          role="status"
        >
          {{ t('tools.bucket.noTextInPdf') }}
        </p>

        <div
          v-if="pdfExtractedText"
          class="field"
        >
          <label for="pdf-extracted-text">{{ t('tools.bucket.extractedTextLabel') }}</label>
          <textarea
            id="pdf-extracted-text"
            v-model="pdfExtractedText"
            class="result"
            rows="10"
          />
          <button
            type="button"
            @click="onCopyExtractedPdfText"
          >
            {{ t('common.copy') }}
          </button>
        </div>
      </div>
    </section>

    <section class="image-section">
      <h2>{{ t('tools.bucket.imageSectionHeading') }}</h2>

      <p
        v-if="imageError"
        role="alert"
      >
        {{ toolErrorMessage(imageError, t) }}
      </p>

      <div class="image-flow">
        <button
          type="button"
          :disabled="imageConverting"
          @click="onPickImage"
        >
          {{ t('tools.bucket.chooseImage') }}
        </button>
        <p v-if="imagePath">
          {{ imagePath }}
        </p>

        <label for="image-target-format">{{ t('tools.bucket.targetFormat') }}</label>
        <select
          id="image-target-format"
          v-model="imageTargetFormat"
          :disabled="imageConverting"
        >
          <option value="png">
            PNG
          </option>
          <option value="jpeg">
            JPEG
          </option>
          <option value="webp">
            WebP
          </option>
        </select>

        <div
          v-if="imageTargetFormat === 'jpeg'"
          class="field"
        >
          <label for="image-quality">{{ t('tools.bucket.qualityLabel', { quality: imageQuality }) }}</label>
          <input
            id="image-quality"
            v-model.number="imageQuality"
            type="range"
            min="1"
            max="100"
            :disabled="imageConverting"
          >
        </div>

        <p
          v-if="imageEstimating"
          role="status"
        >
          {{ t('tools.bucket.estimating') }}
        </p>
        <p
          v-else-if="imageEstimatedSize !== null"
          role="status"
        >
          {{ t('tools.bucket.estimatedSize', { size: formatEstimatedSize(imageEstimatedSize) }) }}
        </p>

        <button
          type="button"
          :disabled="!imagePath || imageConverting"
          @click="onConvertImage"
        >
          {{ t('tools.bucket.convert') }}
        </button>
      </div>
    </section>
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

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}

/* French labels ("Ajouter des PDF…", "Choisir une image…") next to a
   filesystem path can crowd a narrow window — this section mixes buttons,
   labels, and inline `<p>` path text with no flex container of its own
   (plain block flow), so nothing here needs flex-wrap; the risk instead is
   the reorder/remove button row inside `<li>` below. */
.pdf-flow li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em;
}

.pdf-section {
  margin-top: 1.5em;
  padding-top: 1em;
  border-top: 1px solid #ccc;
}

.pdf-flow {
  margin-bottom: 1.2em;
}

.image-section {
  margin-top: 1.5em;
  padding-top: 1em;
  border-top: 1px solid #ccc;
}

.image-flow {
  margin-bottom: 1.2em;
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
