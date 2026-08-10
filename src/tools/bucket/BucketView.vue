<script setup lang="ts">
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useRegistryStore } from "../../stores/registry";
import { writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, type ToolError } from "../../shell/toolError";
import type { OcrOutcome } from "./ocrOutcome";

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
const PDF_FILTERS = [{ name: "PDF", extensions: ["pdf"] }];

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

async function onAddPdfsForMerge() {
  pdfError.value = null;
  try {
    const paths = await open({ multiple: true, filters: PDF_FILTERS });
    if (paths === null) return;
    pdfMergeFiles.value.push(...paths);
  } catch (err) {
    pdfError.value = toToolError(err);
  }
}

function moveMergeFileUp(index: number) {
  if (index <= 0) return;
  const files = pdfMergeFiles.value;
  [files[index - 1], files[index]] = [files[index], files[index - 1]];
}

function moveMergeFileDown(index: number) {
  const files = pdfMergeFiles.value;
  if (index >= files.length - 1) return;
  [files[index], files[index + 1]] = [files[index + 1], files[index]];
}

function removeMergeFile(index: number) {
  pdfMergeFiles.value.splice(index, 1);
}

async function onMergePdfs() {
  pdfError.value = null;
  pdfMerging.value = true;
  try {
    const outputPath = await save({ filters: PDF_FILTERS });
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
    const path = await open({ filters: PDF_FILTERS });
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
    const outputPath = await save({ filters: PDF_FILTERS });
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
    const path = await open({ filters: PDF_FILTERS });
    if (path === null) return;
    pdfExtractTextPath.value = path;
    pdfExtractedText.value = "";
  } catch (err) {
    pdfError.value = toToolError(err);
  }
}

async function onExtractText() {
  if (!pdfExtractTextPath.value) return;
  pdfError.value = null;
  try {
    const result = await runPdf(() =>
      invoke<string>("bucket_extract_pdf_text", { path: pdfExtractTextPath.value }),
    );
    if (!result.superseded) {
      pdfExtractedText.value = result.value;
    }
  } catch (err) {
    pdfExtractedText.value = "";
    pdfError.value = toToolError(err);
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
  <section>
    <h1>Bucket</h1>

    <p class="drop-hint">
      Drop a PNG, JPEG, or WebP image anywhere in the window, or paste (⌘V), to extract its text.
    </p>

    <p
      v-if="error"
      role="alert"
    >
      {{ error.message }}
    </p>

    <p
      v-if="outcome && !outcome.text.trim()"
      role="status"
    >
      No text was found in this image.
    </p>

    <div
      v-if="outcome && outcome.text.trim()"
      class="field"
    >
      <label for="bucket-result">Extracted text</label>
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
        Copy
      </button>
    </div>

    <section class="pdf-section">
      <h2>PDF tools</h2>

      <p
        v-if="pdfError"
        role="alert"
      >
        {{ pdfError.message }}
      </p>

      <div class="pdf-flow">
        <h3>Merge</h3>
        <button
          type="button"
          @click="onAddPdfsForMerge"
        >
          Add PDFs…
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
              @click="moveMergeFileUp(index)"
            >
              ↑
            </button>
            <button
              type="button"
              :disabled="index === pdfMergeFiles.length - 1"
              @click="moveMergeFileDown(index)"
            >
              ↓
            </button>
            <button
              type="button"
              @click="removeMergeFile(index)"
            >
              Remove
            </button>
          </li>
        </ul>
        <button
          type="button"
          :disabled="pdfMergeFiles.length < 2 || pdfMerging"
          @click="onMergePdfs"
        >
          Merge
        </button>
      </div>

      <div class="pdf-flow">
        <h3>Split / Extract pages</h3>
        <button
          type="button"
          @click="onPickExtractPagesFile"
        >
          Choose PDF…
        </button>
        <p v-if="pdfExtractPagesPath">
          {{ pdfExtractPagesPath }}
        </p>
        <label for="pdf-start-page">Start page</label>
        <input
          id="pdf-start-page"
          v-model.number="pdfStartPage"
          type="number"
          min="1"
        >
        <label for="pdf-end-page">End page</label>
        <input
          id="pdf-end-page"
          v-model.number="pdfEndPage"
          type="number"
          min="1"
        >
        <button
          type="button"
          :disabled="
            !pdfExtractPagesPath || pdfStartPage < 1 || pdfStartPage > pdfEndPage || pdfExtractingPages
          "
          @click="onExtractPages"
        >
          Extract pages
        </button>
      </div>

      <div class="pdf-flow">
        <h3>Extract text</h3>
        <button
          type="button"
          @click="onPickExtractTextFile"
        >
          Choose PDF…
        </button>
        <p v-if="pdfExtractTextPath">
          {{ pdfExtractTextPath }}
        </p>
        <button
          type="button"
          :disabled="!pdfExtractTextPath"
          @click="onExtractText"
        >
          Extract text
        </button>

        <div
          v-if="pdfExtractedText"
          class="field"
        >
          <label for="pdf-extracted-text">Extracted text</label>
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
            Copy
          </button>
        </div>
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

.pdf-section {
  margin-top: 1.5em;
  padding-top: 1em;
  border-top: 1px solid #ccc;
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
