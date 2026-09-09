<script setup lang="ts">
// Story 8.7 slice 2 (AC8/AC9): the PDF section of the former BucketView.vue,
// transplanted VERBATIM. Its logic, markup and styles are unchanged apart from
// the `tools.bucket.*` -> `tools.pdf.*` i18n prefix that AC27's partition forces
// and the section's own `<h2>` becoming this routed view's `<h1>`. The nine
// `bucket_*` PDF commands and the `bucket-pdf-*` error codes are deliberately
// NOT renamed here — renaming them would rewrite tests that must move
// byte-identical (AC9). Story 8.8 owns this tool's redesign and its renames.
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";

const { t } = useI18n();

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
  return [{ name: t("tools.pdf.pdfFilterName"), extensions: ["pdf"] }];
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
</script>

<template>
  <section class="pdf-section">
    <h1>{{ t('tools.pdf.pdfSectionHeading') }}</h1>

    <p
      v-if="pdfError"
      role="alert"
    >
      {{ toolErrorMessage(pdfError, t) }}
    </p>

    <div class="pdf-flow">
      <h3>{{ t('tools.pdf.mergeHeading') }}</h3>
      <button
        type="button"
        :disabled="pdfMerging"
        @click="onAddPdfsForMerge"
      >
        {{ t('tools.pdf.addPdfs') }}
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
            :aria-label="t('tools.pdf.moveUp')"
            @click="moveMergeFileUp(index)"
          >
            ↑
          </button>
          <button
            type="button"
            :disabled="index === pdfMergeFiles.length - 1"
            :aria-label="t('tools.pdf.moveDown')"
            @click="moveMergeFileDown(index)"
          >
            ↓
          </button>
          <button
            type="button"
            @click="removeMergeFile(index)"
          >
            {{ t('tools.pdf.remove') }}
          </button>
        </li>
      </ul>
      <button
        type="button"
        :disabled="pdfMergeFiles.length < 2 || pdfMerging"
        @click="onMergePdfs"
      >
        {{ t('tools.pdf.merge') }}
      </button>
    </div>

    <div class="pdf-flow">
      <h3>{{ t('tools.pdf.splitExtractHeading') }}</h3>
      <button
        type="button"
        @click="onPickExtractPagesFile"
      >
        {{ t('tools.pdf.choosePdf') }}
      </button>
      <p v-if="pdfExtractPagesPath">
        {{ pdfExtractPagesPath }}
      </p>
      <label for="pdf-start-page">{{ t('tools.pdf.startPage') }}</label>
      <input
        id="pdf-start-page"
        v-model.number="pdfStartPage"
        type="number"
        min="1"
        step="1"
      >
      <label for="pdf-end-page">{{ t('tools.pdf.endPage') }}</label>
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
        {{ t('tools.pdf.extractPages') }}
      </button>
    </div>

    <div class="pdf-flow">
      <h3>{{ t('tools.pdf.extractTextHeading') }}</h3>
      <button
        type="button"
        @click="onPickExtractTextFile"
      >
        {{ t('tools.pdf.choosePdf') }}
      </button>
      <p v-if="pdfExtractTextPath">
        {{ pdfExtractTextPath }}
      </p>
      <button
        type="button"
        :disabled="!pdfExtractTextPath || pdfExtractingText"
        @click="onExtractText"
      >
        {{ t('tools.pdf.extractText') }}
      </button>

      <p
        v-if="pdfTextExtracted && !pdfExtractedText.trim()"
        role="status"
      >
        {{ t('tools.pdf.noTextInPdf') }}
      </p>

      <div
        v-if="pdfExtractedText"
        class="field"
      >
        <label for="pdf-extracted-text">{{ t('tools.pdf.extractedTextLabel') }}</label>
        <textarea
          id="pdf-extracted-text"
          v-model="pdfExtractedText"
          class="result"
          rows="10"
          spellcheck="false"
          autocorrect="off"
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
</template>

<style scoped>
/* Story 8.7 slice 2: the former `.pdf-section` rule
   (`margin-top: 1.5em; padding-top: 1em; border-top: 1px solid #ccc`) is the
   one style rule NOT transplanted. It described this section's relationship to
   the two *sibling* sections it used to sit between in BucketView.vue's flat
   scroll — a separator hairline — not the section itself. On a standalone
   routed view it would paint a stray rule across the top of the page. The
   class is kept so the markup stays verbatim and 8.8 has the hook it expects. */

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

.pdf-flow {
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
