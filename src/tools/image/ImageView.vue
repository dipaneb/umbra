<script setup lang="ts">
// Story 8.7 slice 2 (AC8/AC9): the Image section of the former BucketView.vue,
// transplanted VERBATIM. Its logic, markup and styles are unchanged apart from
// the `tools.bucket.*` -> `tools.image.*` i18n prefix that AC27's partition
// forces and the section's own `<h2>` becoming this routed view's `<h1>`. The
// `bucket_*` commands and `bucket-image-*` error codes are deliberately NOT
// renamed here — renaming them would rewrite tests that must move
// byte-identical (AC9). Story 8.9 owns this tool's redesign and its renames.
import { onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { debounce } from "../../shell/debounce";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import type { ImageTargetFormat } from "./imageTargetFormat";

const { t, n } = useI18n();

// A third, disjoint state group (same AD-16 reasoning as the PDF section above). Two local
// runners, not one: the live estimate can fire many times per second while the quality slider is
// dragged, and a Convert click can land mid-stream — sharing one runner between "the live
// preview" and "the actual save-to-disk conversion" risks one superseding the other's result,
// matching CronView.vue's "two disjoint state-groups get two runners" reasoning (not
// Base64View.vue's "three same-shape actions share one" reasoning, which fits discrete
// non-overlapping clicks only).
// Same reasoning as pdfFilters() above — a function, not a module-level const.
function imageFilters() {
  return [{ name: t("tools.image.imageFilterName"), extensions: ["png", "jpg", "jpeg", "webp"] }];
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
  const stem = baseName.replace(/\.[^./\\]+$/, "") || t("tools.image.defaultFileNameStem");
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
      filters: [{ name: t("tools.image.imageFilterName"), extensions: [targetExtension(targetFormat)] }],
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
    return `${n(kb / 1024, "decimal1")} ${t("tools.image.sizeUnitMb")}`;
  }
  return `${n(kb, "decimal1")} ${t("tools.image.sizeUnitKb")}`;
}
</script>

<template>
  <section class="image-section">
    <h1>{{ t('tools.image.imageSectionHeading') }}</h1>

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
        {{ t('tools.image.chooseImage') }}
      </button>
      <p v-if="imagePath">
        {{ imagePath }}
      </p>

      <label for="image-target-format">{{ t('tools.image.targetFormat') }}</label>
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
        <label for="image-quality">{{ t('tools.image.qualityLabel', { quality: imageQuality }) }}</label>
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
        {{ t('tools.image.estimating') }}
      </p>
      <p
        v-else-if="imageEstimatedSize !== null"
        role="status"
      >
        {{ t('tools.image.estimatedSize', { size: formatEstimatedSize(imageEstimatedSize) }) }}
      </p>

      <button
        type="button"
        :disabled="!imagePath || imageConverting"
        @click="onConvertImage"
      >
        {{ t('tools.image.convert') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
/* Story 8.7 slice 2: the former `.image-section` rule
   (`margin-top: 1.5em; padding-top: 1em; border-top: 1px solid #ccc`) is the
   one style rule NOT transplanted, for the same reason as PdfView.vue's — it
   described this section's relationship to the sibling sections above it in
   BucketView.vue's flat scroll, not the section itself, and on a standalone
   routed view it would paint a stray hairline across the top of the page. */

p[role="alert"] {
  color: #b00020;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}

.image-flow {
  margin-bottom: 1.2em;
}
</style>
