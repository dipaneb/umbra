<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { PhArrowLeft, PhArrowRight, PhCaretRight, PhCheck, PhCopySimple } from "@phosphor-icons/vue";
import { writeClipboardText } from "../../shell/clipboard";
import { debounce } from "../../shell/debounce";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import { useRegistryStore } from "../../stores/registry";
// Story 8.2 slice 1: reuse JSON's per-button "copied" feedback composable
// rather than reinvent it — same signature-accent confirm pattern
// `JsonTree.vue` / `JsonView.vue`'s copy buttons already use. A single
// output-panel Copy button only ever has one thing to confirm, so it keys
// off one fixed string, exactly like JsonView's Transform-tab copy button.
import { useCopyFeedback } from "../json/useCopyFeedback";

const { t } = useI18n();

type Direction = "encode" | "decode";

// Mirrors `umbra_core::base64::Sniff` (serde tag = "kind"). Every arm is a
// candidate the view phrases as "looks like …" and never applies silently
// (AD-9 / AC10).
type Sniff =
  | { kind: "jwt"; header: string; payload: string }
  | { kind: "png"; byte_len: number }
  | { kind: "pdf"; byte_len: number }
  | { kind: "gzip"; byte_len: number }
  | { kind: "zip"; byte_len: number }
  | { kind: "text"; text: string }
  | { kind: "unknown"; byte_len: number };

// A decoded `data:` URI (slice 4 / AC12). "image" → inline preview from the
// MIME; "sniffed" → the inner payload run through `base64_sniff` for
// everything else.
type DataUriResult =
  | { kind: "image"; mime: string; payload: string }
  | { kind: "sniffed"; mime: string; payload: string; sniff: Sniff };

// Kept in sync with `mime_from_path` (src-tauri/src/commands/base64.rs) so a
// dropped file's guessed MIME always has a matching builder option to
// pre-select (code review P6).
const DATA_URI_MIME_OPTIONS = [
  "application/octet-stream",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/json",
  "application/zip",
  "application/gzip",
  "application/wasm",
  "font/woff2",
  "text/plain",
  "text/html",
  "text/css",
  "text/javascript",
] as const;

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/json": "json",
  "application/zip": "zip",
  "application/gzip": "gz",
  "text/plain": "txt",
  "text/html": "html",
  "text/css": "css",
  "text/javascript": "js",
  "application/wasm": "wasm",
  "font/woff2": "woff2",
};

function mimeToExt(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "application/octet-stream") return "bin";
  if (MIME_EXT[base]) return MIME_EXT[base];
  const sub = base.split("/")[1]?.replace(/\+.*/, "");
  return sub && /^[a-z0-9._-]+$/.test(sub) ? sub : "bin";
}

const input = ref("");
const output = ref("");
const urlSafe = ref(false);
// AC13: line-wrap the encoded output. `none` by default (changing what
// existing users get out is a trap); `64` / `76` are the PEM / MIME widths.
// The wrap itself happens in umbra-core, not here.
type WrapMode = "none" | "col64" | "col76";
const wrapMode = ref<WrapMode>("none");
const wrapArg = () => (wrapMode.value === "none" ? null : wrapMode.value);
const direction = ref<Direction>("encode");
const error = ref<ToolError | null>(null);
// Decode-direction only: what `base64_sniff` says the payload is. When it's
// not plain text, the output panel is *replaced* by a reading of the
// payload — a JWT's segment split, an inline image, or a one-line note
// (AC9/AC10, amended after the slice-3 render review: an empty ten-row
// textarea under a faint caption read as broken). Null in Encode / empty
// input.
const sniff = ref<Sniff | null>(null);
// Decode-direction, `data:`-prefixed input only (slice 4 / AC12): the parsed
// data URI. Drives the image preview and the MIME-derived save name.
const dataUri = ref<DataUriResult | null>(null);
// The Encode-direction data-URI builder (AC11): a collapsed disclosure, its
// MIME picker pre-selected from a dropped file's extension.
const builderOpen = ref(false);
const builderMime = ref<string>(DATA_URI_MIME_OPTIONS[0]);
// A JWT's split shows by default now, framed as an interpretation
// ("Reading as JWT") with a persistent "Show raw" that collapses it back to
// the bare "Looks like a JWT" line — honesty per AD-9 comes from the framing
// and the always-available dismissal, not from gating the view behind a click.
const jwtCollapsed = ref(false);
// Set false by the <img>'s own error handler when a "looks like PNG" blob
// doesn't actually render — then we fall back to the text note rather than a
// broken-image icon.
const imagePreviewOk = ref(true);
const decodingToFile = ref(false);
// A drop that ends up *encoding* (Encode direction, or a decode-direction
// drop of a binary file that got handed back for encoding) flips the switch
// to Encode so the result reads coherently. That flip fires the
// `[input, direction, urlSafe]` watch, which would re-convert and overwrite
// the drop's output with an encode of the (usually empty) text box — this
// swallows exactly that one watcher run.
const suppressConvertOnce = ref(false);
// A transient line for the one drop outcome that's a user mistake rather
// than a failure: a binary file dropped while Decoding. Auto-dismisses.
const dropNotice = ref<string | null>(null);
let dropNoticeTimer: ReturnType<typeof setTimeout> | undefined;
function showDropNotice(message: string) {
  dropNotice.value = message;
  clearTimeout(dropNoticeTimer);
  dropNoticeTimer = setTimeout(() => {
    dropNotice.value = null;
  }, 8000);
}

const registry = useRegistryStore();

// AD-16 / AC7: one latest-wins runner backs *every* conversion in this view
// (live encode, live decode, and — later slices — data-URI decode and
// `sniff`). They all write the single `output` / `error` pair, so a slow
// earlier call must never land on top of a newer one; one shared runner is
// exactly right here, no per-direction scope.
const runLatestWins = createLatestWinsRunner();

const COPY_KEY = "output";
const { isCopied, markCopied, cancel: cancelCopyFeedback } = useCopyFeedback();
const isOutputCopied = computed(() => isCopied(COPY_KEY));

// Direction-aware, following the segmented switch — the pattern mainstream
// single-field converters use (jam.dev: "Text to encode" ⇄ "Base64 to
// decode"). A static "Text or Base64 input" describes both modes at once and
// helps in neither.
const inputLabel = computed(() =>
  direction.value === "encode"
    ? t("tools.base64.inputLabelEncode")
    : t("tools.base64.inputLabelDecode"),
);

const errorLocation = computed(() => {
  const position = error.value?.position;
  if (position?.kind === "LineCol") {
    return t("common.positionLineCol", { line: position.line, column: position.column });
  }
  if (position?.kind === "ByteOffset") {
    return t("common.positionByteOffset", { offset: position.offset });
  }
  return null;
});

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// The one contextual line under the output. `null` for plain text (the
// output panel itself is the identification) and when nothing is detected.
const detectionText = computed(() => {
  if (dataUri.value?.kind === "image") {
    return t("tools.base64.dataUriImageLine", { mime: dataUri.value.mime });
  }
  const s = sniff.value;
  if (!s) return null;
  switch (s.kind) {
    case "text":
      return null;
    case "jwt":
      return t("tools.base64.looksLikeJwt");
    case "png":
      return t("tools.base64.looksLikeBinary", { type: "PNG", size: formatBytes(s.byte_len) });
    case "pdf":
      return t("tools.base64.looksLikeBinary", { type: "PDF", size: formatBytes(s.byte_len) });
    case "gzip":
      return t("tools.base64.looksLikeBinary", { type: "gzip", size: formatBytes(s.byte_len) });
    case "zip":
      return t("tools.base64.looksLikeBinary", { type: "ZIP", size: formatBytes(s.byte_len) });
    case "unknown":
      return t("tools.base64.decodedUnrecognized", { size: formatBytes(s.byte_len) });
  }
  return null;
});

const jwtSegments = computed(() => (sniff.value?.kind === "jwt" ? sniff.value : null));

// How the output panel is replaced when the decode isn't text:
//  - "jwt"   — segment split (or, when collapsed, the one-line note)
//  - "image" — inline <img> preview of a PNG blob
//  - "note"  — one caption line + "Save as file" (pdf/gzip/zip/unknown, or a
//              PNG whose preview failed to render)
//  - null    — plain text, or nothing detected: the normal output field shows
const detectionMode = computed<"jwt" | "image" | "note" | null>(() => {
  if (dataUri.value?.kind === "image") {
    return imagePreviewOk.value ? "image" : "note";
  }
  const s = sniff.value;
  if (!s || s.kind === "text") return null;
  if (s.kind === "jwt") return "jwt";
  if (s.kind === "png" && imagePreviewOk.value) return "image";
  return "note";
});

// The normal output <textarea> shows only when there's actually text to put
// in it — otherwise `detectionMode` owns that space.
const showOutputPanel = computed(
  () => !error.value && detectionMode.value === null,
);

// The `<img src>` for the contextual image preview — a view-side `data:` URI
// (no command, no bytes over IPC; `img-src … data:` is already in the CSP).
// Either the payload of a parsed `data:image/*` URI, or a bare PNG blob
// `sniff` recognised.
const imageDataUri = computed(() => {
  const du = dataUri.value;
  if (du?.kind === "image") {
    return `data:${du.mime};base64,${du.payload.replace(/\s+/g, "")}`;
  }
  // A PNG blob delivered through a non-image `data:` URI: preview it from the
  // *parsed payload*, not the raw input (which still carries the `data:…`
  // prefix) — code review P3.
  if (du?.kind === "sniffed" && du.sniff.kind === "png") {
    const b64 = du.payload.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    return `data:image/png;base64,${b64}`;
  }
  // A bare PNG blob `sniff` recognised straight from the input box.
  if (!du && sniff.value?.kind === "png") {
    const b64 = input.value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    return `data:image/png;base64,${b64}`;
  }
  return "";
});

// The Base64 to write when "Save as file" is clicked — a parsed data URI's
// payload, else the raw input.
const saveSource = computed(() => dataUri.value?.payload ?? input.value);

// Type-aware default filename — the data URI's MIME extension when we have
// one, else `sniff`'s identification, else `.bin`.
function saveDefaultName(): string {
  if (dataUri.value) return `decoded.${mimeToExt(dataUri.value.mime)}`;
  switch (sniff.value?.kind) {
    case "png":
      return "decoded.png";
    case "pdf":
      return "decoded.pdf";
    case "gzip":
      return "decoded.gz";
    case "zip":
      return "decoded.zip";
    case "text":
      return "decoded.txt";
    default:
      return "decoded.bin";
  }
}

// The data URI the Encode-direction builder shows / copies (AC11): pure
// string composition off the current encoded output + the picked MIME. Any
// line-wrap on the output is stripped — a data URI is meant to be one line.
const dataUriString = computed(() =>
  output.value
    ? `data:${builderMime.value};base64,${output.value.replace(/\s+/g, "")}`
    : "",
);
const isDataUriCopied = computed(() => isCopied("datauri"));

async function onCopyDataUri() {
  error.value = null;
  try {
    await writeClipboardText(dataUriString.value);
    markCopied("datauri");
  } catch (err) {
    error.value = toToolError(err);
  }
}

// AC7: conversion runs on every (debounced) input edit and *immediately* on a
// direction / alphabet change — never on a button press. The empty-input
// short-circuit lives inside the runner task, not as an early return, so
// clearing the input while a real conversion is still in flight still bumps
// the latest-wins counter and the older result can't land afterward.
async function convert() {
  error.value = null;
  sniff.value = null;
  dataUri.value = null;
  jwtCollapsed.value = false;
  imagePreviewOk.value = true;
  dropNotice.value = null;
  // Clear the previous result up front — otherwise switching direction shows
  // the stale output (e.g. an Encode result) in the panel for as long as the
  // new conversion is in flight, which for a large input is long enough to
  // look like the wrong answer.
  output.value = "";
  const value = input.value;
  const dir = direction.value;
  try {
    if (dir === "encode") {
      const result = await runLatestWins(() =>
        value === ""
          ? Promise.resolve("")
          : invoke<string>("base64_encode", {
              input: value,
              url_safe: urlSafe.value,
              wrap: wrapArg(),
            }),
      );
      if (!result.superseded) output.value = result.value;
    } else if (/^data:/i.test(value.trim())) {
      // Decode a `data:` URI (AC12): parse the MIME + payload off, then
      // preview an image by its MIME or run the inner payload through
      // `sniff` for everything else. Both calls ride the one latest-wins
      // runner as a single task (AC7).
      const result = await runLatestWins(async (): Promise<DataUriResult | null> => {
        const du = await invoke<{ mime: string; payload: string }>("base64_parse_data_uri", {
          input: value,
        });
        if (du.mime.toLowerCase().startsWith("image/")) {
          return { kind: "image", mime: du.mime, payload: du.payload };
        }
        const s = await invoke<Sniff>("base64_sniff", { input: du.payload });
        return { kind: "sniffed", mime: du.mime, payload: du.payload, sniff: s };
      });
      if (!result.superseded) {
        dataUri.value = result.value;
        sniff.value = result.value?.kind === "sniffed" ? result.value.sniff : null;
        output.value =
          result.value?.kind === "sniffed" && result.value.sniff.kind === "text"
            ? result.value.sniff.text
            : "";
      }
    } else {
      // Plain Base64: `base64_sniff` returns the decoded text when it's text,
      // and an identification otherwise — one call, no second runner race.
      const result = await runLatestWins((): Promise<Sniff | null> =>
        value === "" ? Promise.resolve(null) : invoke<Sniff>("base64_sniff", { input: value }),
      );
      if (!result.superseded) {
        sniff.value = result.value;
        output.value = result.value?.kind === "text" ? result.value.text : "";
      }
    }
  } catch (err) {
    // A failed transform must never leave a *previous* success sitting next
    // to the new error looking like the current result.
    output.value = "";
    error.value = toToolError(err);
  }
}

const debouncedConvert = debounce(() => void convert(), 200);

watch([input, direction, urlSafe, wrapMode], ([nextInput], [prevInput]) => {
  if (suppressConvertOnce.value) {
    // The Decode→Encode flip a file drop just made — the drop already put its
    // result in the panel; don't clobber it with an encode of the text box.
    suppressConvertOnce.value = false;
    return;
  }
  // A direction or alphabet change re-runs against the current input
  // immediately (AC7); only a text edit waits out the debounce.
  if (nextInput !== prevInput) {
    debouncedConvert();
  } else {
    debouncedConvert.cancel();
    void convert();
  }
});

// AD-14: `DropZone.vue` is the shell's single generic dispatcher and
// invokes `base64_ingest_file` itself; this view only supplies the args the
// dispatcher can't know — the alphabet, and whether the current direction is
// Decode (so a dropped file is decoded, not encoded) — and consumes the
// outcome via `registry.dropResult` below.
function dropArgsProvider() {
  return { url_safe: urlSafe.value, decode: direction.value === "decode", wrap: wrapArg() };
}

onMounted(() => registry.setDropArgsProvider("base64", dropArgsProvider));
onUnmounted(() => {
  registry.setDropArgsProvider("base64", null);
  cancelCopyFeedback();
  debouncedConvert.cancel();
  clearTimeout(dropNoticeTimer);
});

type Ingest =
  | { mode: "encoded"; value: string; mime: string | null }
  | { mode: "text"; value: string }
  | { mode: "not_text" };

function landInEncode() {
  if (direction.value !== "encode") {
    suppressConvertOnce.value = true;
    direction.value = "encode";
  }
}

watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "base64") return;
    registry.dropResult = null; // one-shot signal
    // A debounce scheduled by the last keystroke would otherwise fire ~200 ms
    // later, re-run `convert()` against the input this handler is about to
    // rewrite, and wipe the drop's output. `suppressConvertOnce` only
    // neutralises the synchronous watcher run, not a pending timer (code
    // review P1).
    debouncedConvert.cancel();
    sniff.value = null;
    dataUri.value = null;
    jwtCollapsed.value = false;
    imagePreviewOk.value = true;
    dropNotice.value = null;

    if ("error" in result) {
      // file-read-error / too-large — a drop is always an encode attempt at
      // heart, so land in Encode with the alert.
      output.value = "";
      error.value = result.error;
      landInEncode();
      return;
    }

    error.value = null;
    const ingest = result.value as Ingest;
    if (ingest.mode === "not_text") {
      // Decode direction + a binary file: nothing to decode. Say so — don't
      // silently switch to encoding it.
      output.value = "";
      showDropNotice(t("tools.base64.fileNotBase64Text"));
      return;
    }
    if (ingest.mode === "text") {
      // A Base64 text file dropped while Decoding: feed its contents to the
      // input and let the live decode / `sniff` pipeline take over (it drives
      // the preview, JWT split, etc. off `input`).
      input.value = ingest.value;
      return;
    }
    // "encoded": the dropped file is the source, so the text box's old
    // contents are stale — clear them, show the Base64 in Output, land in
    // Encode. Any input/direction change here would fire `convert()` and
    // re-encode the now-empty box over the result, so swallow that one run.
    if (input.value !== "" || direction.value !== "encode") {
      suppressConvertOnce.value = true;
    }
    input.value = "";
    output.value = ingest.value;
    if (ingest.mime && (DATA_URI_MIME_OPTIONS as readonly string[]).includes(ingest.mime)) {
      builderMime.value = ingest.mime;
    }
    if (direction.value !== "encode") direction.value = "encode";
  },
);

async function onSaveAsFile() {
  error.value = null;
  // Snapshot the source and the name up front: a debounced `convert()` can
  // fire while the native save dialog is open, and the bytes written must
  // match the detection the user clicked on, not whatever the input became
  // (code review P4). For a data URI that source is the payload — not the
  // whole `data:…` string.
  const source = saveSource.value;
  const defaultPath = saveDefaultName();
  decodingToFile.value = true;
  try {
    const path = await save({ defaultPath });
    if (path === null) return; // user cancelled — not an error
    await invoke("base64_decode_to_file", { input: source, path });
  } catch (err) {
    error.value = toToolError(err);
  } finally {
    decodingToFile.value = false;
  }
}

async function onCopy() {
  error.value = null;
  try {
    await writeClipboardText(output.value);
    // Confirm only after the clipboard write actually succeeds — a failed
    // write has its own error-alert path and must not also flash a false
    // "copied" confirmation.
    markCopied(COPY_KEY);
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section>
    <h1>{{ t('tools.base64.heading') }}</h1>

    <!-- A dropped file follows the current direction: encoded while Encoding,
         read as Base64 text to decode while Decoding. -->
    <p class="drop-hint">
      {{ direction === 'encode' ? t('tools.base64.dropHintEncode') : t('tools.base64.dropHintDecode') }}
    </p>

    <p
      v-if="dropNotice"
      class="drop-notice"
      role="status"
    >
      {{ dropNotice }}
    </p>

    <div class="field">
      <label for="base64-input">{{ inputLabel }}</label>
      <textarea
        id="base64-input"
        v-model="input"
        rows="10"
        spellcheck="false"
        autocorrect="off"
      />
    </div>

    <div class="switch-row">
      <div
        class="direction-switch"
        :class="{ 'is-decode': direction === 'decode' }"
        role="radiogroup"
        :aria-label="t('tools.base64.directionLegend')"
      >
        <span
          class="direction-thumb"
          aria-hidden="true"
        />
        <label :class="{ active: direction === 'encode' }">
          <input
            v-model="direction"
            type="radio"
            name="base64-direction"
            value="encode"
          >
          <PhArrowRight
            aria-hidden="true"
            weight="bold"
          />
          {{ t('tools.base64.encode') }}
        </label>
        <label :class="{ active: direction === 'decode' }">
          <input
            v-model="direction"
            type="radio"
            name="base64-direction"
            value="decode"
          >
          <PhArrowLeft
            aria-hidden="true"
            weight="bold"
          />
          {{ t('tools.base64.decode') }}
        </label>
      </div>

      <!-- Alphabet only affects encoding — decode auto-detects it from the
           input's characters — so it's shown only in the Encode direction.
           "Standard" is the unstated default; the checkbox is the one
           deviation. -->
      <label
        v-if="direction === 'encode'"
        class="alphabet-check"
      >
        <input
          v-model="urlSafe"
          type="checkbox"
        >
        {{ t('tools.base64.urlSafeAlphabet') }}
      </label>
    </div>

    <div
      v-if="showOutputPanel"
      class="field"
    >
      <div class="output-header">
        <label for="base64-output">{{ t('tools.base64.outputLabel') }}</label>
        <label
          v-if="direction === 'encode'"
          class="wrap-select"
        >
          {{ t('tools.base64.wrapLabel') }}
          <select v-model="wrapMode">
            <option value="none">
              {{ t('tools.base64.wrapNone') }}
            </option>
            <option value="col64">
              64
            </option>
            <option value="col76">
              76
            </option>
          </select>
        </label>
        <!-- AC14 preserved behaviour (code review DN2): a decoded text result
             is still writable to a file, not only Copy-able. Decode direction
             only — the encode-direction output is Base64 you Copy. -->
        <button
          v-if="direction === 'decode' && output !== ''"
          type="button"
          class="offer-action"
          :disabled="decodingToFile"
          @click="onSaveAsFile"
        >
          {{ t('tools.base64.saveAsFile') }}
        </button>
        <button
          type="button"
          class="copy-button"
          :disabled="output === ''"
          :aria-label="isOutputCopied ? t('tools.base64.outputCopied') : t('common.copyToClipboard')"
          :title="isOutputCopied ? t('tools.base64.outputCopied') : t('common.copyToClipboard')"
          @click="onCopy"
        >
          <PhCheck
            v-if="isOutputCopied"
            aria-hidden="true"
            class="copy-success"
          />
          <PhCopySimple
            v-else
            aria-hidden="true"
          />
        </button>
      </div>
      <textarea
        id="base64-output"
        readonly
        rows="10"
        :value="output"
      />
    </div>

    <!-- AC11: a collapsible builder — pick a MIME type, get a live, copyable
         `data:<mime>;base64,<output>` string. Pure view-side composition. The
         fields use `v-show`, not `v-if`, so re-opening doesn't re-mount (and
         re-render) the whole data-URI string every time. -->
    <div
      v-if="direction === 'encode'"
      class="data-uri-builder"
    >
      <button
        type="button"
        class="disclosure"
        :class="{ 'is-open': builderOpen }"
        :aria-expanded="builderOpen"
        aria-controls="base64-datauri-fields"
        @click="builderOpen = !builderOpen"
      >
        <PhCaretRight
          aria-hidden="true"
          class="disclosure-caret"
        />
        {{ t('tools.base64.dataUriBuilder') }}
      </button>
      <div
        v-show="builderOpen"
        id="base64-datauri-fields"
        class="data-uri-fields"
      >
        <div class="du-controls">
          <label for="base64-datauri-mime">{{ t('tools.base64.dataUriMimeLabel') }}</label>
          <select
            id="base64-datauri-mime"
            v-model="builderMime"
          >
            <option
              v-for="m in DATA_URI_MIME_OPTIONS"
              :key="m"
              :value="m"
            >
              {{ m }}
            </option>
          </select>
          <button
            type="button"
            class="copy-button"
            :disabled="dataUriString === ''"
            :aria-label="isDataUriCopied ? t('tools.base64.dataUriCopied') : t('common.copyToClipboard')"
            :title="isDataUriCopied ? t('tools.base64.dataUriCopied') : t('common.copyToClipboard')"
            @click="onCopyDataUri"
          >
            <PhCheck
              v-if="isDataUriCopied"
              aria-hidden="true"
              class="copy-success"
            />
            <PhCopySimple
              v-else
              aria-hidden="true"
            />
          </button>
        </div>
        <textarea
          id="base64-datauri"
          readonly
          rows="3"
          :value="dataUriString"
        />
      </div>
    </div>

    <!-- AC9/AC10 (amended after the slice-3 render review): the slot under
         the input holds at most one thing — a conversion error, or a reading
         of a non-text payload that *replaces* the empty output field. Error
         always wins. -->
    <p
      v-if="error"
      role="alert"
    >
      {{ toolErrorMessage(error, t) }}<template v-if="errorLocation">
        {{ errorLocation }}
      </template>
    </p>

    <!-- JWT: the segment split shows by default, framed as an interpretation
         with a persistent "Show raw" that collapses it to the bare line. -->
    <template v-else-if="detectionMode === 'jwt' && jwtSegments">
      <p
        v-if="jwtCollapsed"
        class="detection"
      >
        <span>{{ t('tools.base64.looksLikeJwt') }}</span>
        <button
          type="button"
          class="offer-action"
          @click="jwtCollapsed = false"
        >
          {{ t('tools.base64.readAsJwt') }}
        </button>
      </p>
      <template v-else>
        <div class="reveal-strip">
          <span>{{ t('tools.base64.readingAsJwt') }}</span>
          <button
            type="button"
            class="offer-action"
            @click="jwtCollapsed = true"
          >
            {{ t('tools.base64.showRaw') }}
          </button>
        </div>
        <div class="field">
          <label for="base64-jwt-header">{{ t('tools.base64.jwtHeader') }}</label>
          <textarea
            id="base64-jwt-header"
            readonly
            rows="4"
            :value="jwtSegments.header"
          />
        </div>
        <div class="field">
          <label for="base64-jwt-payload">{{ t('tools.base64.jwtPayload') }}</label>
          <textarea
            id="base64-jwt-payload"
            readonly
            rows="8"
            :value="jwtSegments.payload"
          />
        </div>
      </template>
    </template>

    <!-- PNG: an inline preview built from a view-side data: URI. If it fails
         to render, `imagePreviewOk` flips and we fall through to the note. -->
    <div
      v-else-if="detectionMode === 'image'"
      class="image-preview"
    >
      <div class="reveal-strip">
        <span>{{ detectionText }}</span>
        <button
          type="button"
          class="offer-action"
          :disabled="decodingToFile"
          @click="onSaveAsFile"
        >
          {{ t('tools.base64.saveAsFile') }}
        </button>
      </div>
      <div class="image-frame">
        <img
          :src="imageDataUri"
          :alt="t('tools.base64.imagePreviewAlt')"
          @error="imagePreviewOk = false"
        >
      </div>
    </div>

    <!-- Everything else non-text (pdf/gzip/zip/unknown, or a PNG whose
         preview failed): one caption line. -->
    <p
      v-else-if="detectionMode === 'note'"
      class="detection"
    >
      <span>{{ detectionText }}</span>
      <button
        type="button"
        class="offer-action"
        :disabled="decodingToFile"
        @click="onSaveAsFile"
      >
        {{ t('tools.base64.saveAsFile') }}
      </button>
    </p>
  </section>
</template>

<style scoped>
.drop-hint {
  color: var(--color-text-secondary);
  font-size: var(--font-caption-size);
  border: 1px dashed var(--color-border-hairline);
  border-radius: var(--radius-default);
  padding: var(--spacing-2) var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

/* Transient "you dropped a binary file while Decoding" line — an
   explanation, not a failure, so it borrows the signature tint rather than
   the destructive colour. */
.drop-notice {
  font-size: var(--font-caption-size);
  color: var(--color-text-primary);
  background: var(--color-accent-signature-tint);
  border-radius: var(--radius-default);
  padding: var(--spacing-2) var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  margin-bottom: var(--spacing-4);
}

.data-uri-builder {
  margin-bottom: var(--spacing-4);
}

/* A disclosure toggle, not a link: a rotating caret + a plain label. */
.disclosure {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.disclosure:hover {
  color: var(--color-text-primary);
}

.disclosure:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.disclosure-caret {
  width: 12px;
  height: 12px;
  transition: transform 120ms ease;
}

.disclosure.is-open .disclosure-caret {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .disclosure-caret {
    transition: none;
  }
}

.data-uri-fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin-top: var(--spacing-2);
}

.du-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.du-controls label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

.du-controls select {
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
}

.du-controls .copy-button {
  margin-left: auto;
}

/* Adopt {typography.code} for the in/out panels (Story 8.2 AC6). base.css
   already gives a bare <textarea> its token border, background and
   focus-visible ring — only the code face is overridden here. */
textarea {
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  line-height: var(--font-code-line-height);
  /* Base64 is one unbroken token with no spaces for a <textarea> to
     soft-wrap on; `break-all` forces the wrap so it doesn't keep a phantom
     horizontal scrollbar. (`overflow-wrap` is unreliable on <textarea> in
     WebKit — this is the one that takes.) */
  word-break: break-all;
}

p[role="alert"] {
  color: var(--color-accent-destructive);
}

/* Direction switch + the encode-only alphabet checkbox share one row. */
.switch-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-4);
}

/* A two-option segmented control matching Umbra's macOS-style reference: a
   grey track with a white raised card that slides under the active half.
   The native radios stay in the DOM for keyboard + screen-reader support,
   visually collapsed (not `display: none`, which drops them from the tab
   order and the a11y tree). */
.direction-switch {
  position: relative;
  display: inline-flex;
  padding: 3px;
  background: var(--color-accent-neutral-chip);
  border-radius: var(--radius-lg);
}

.direction-thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-hairline);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  transition: transform 140ms cubic-bezier(0.32, 0.72, 0, 1);
}

.direction-switch.is-decode .direction-thumb {
  transform: translateX(100%);
}

.direction-switch label {
  position: relative;
  z-index: 1;
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-1);
  padding: 6px 16px;
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: color 140ms ease;
}

.direction-switch label.active {
  color: var(--color-text-primary);
}

.direction-switch label:focus-within {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
  border-radius: var(--radius-default);
}

.direction-switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.direction-switch svg {
  width: 14px;
  height: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .direction-thumb,
  .direction-switch label {
    transition: none;
  }
}

.alphabet-check {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-left: auto;
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.alphabet-check input {
  margin: 0;
}

/* AC9: caption weight, not a tinted card. Shared by the collapsed-JWT line
   and the pdf/gzip/zip/unknown note. */
.detection {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-4);
}

/* The header above a JWT split / image preview: names the reading as an
   interpretation and carries the dismiss / save action. Same caption weight
   — still not a card. */
.reveal-strip {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-2);
}

.image-preview {
  margin-bottom: var(--spacing-4);
}

/* Checkerboard so a transparent PNG reads; the image sits at its natural
   size up to a sane ceiling. */
.image-frame {
  display: flex;
  justify-content: center;
  padding: var(--spacing-3);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  background:
    repeating-conic-gradient(
      var(--color-bg-base) 0% 25%,
      var(--color-bg-surface) 0% 50%
    )
    50% / 16px 16px;
}

.image-frame img {
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

/* Plain text action, not a signature-accent button — same restraint as
   JsonView's position links; DESIGN.md reserves the accent for one true
   action per screen. Own node with real margin, never template whitespace. */
.offer-action {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.offer-action:hover:not(:disabled),
.offer-action:focus-visible {
  text-decoration-thickness: 2px;
}

.offer-action:disabled {
  opacity: 0.6;
  cursor: default;
}

.output-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* The "Output" label sits left; the wrap selector + copy button group at
   the right edge. */
.output-header > label[for="base64-output"] {
  margin-right: auto;
}

/* The label text and the <select>'s value share one size so "Wrap None"
   reads as one control, not two mismatched pieces. */
.wrap-select {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  color: var(--color-text-secondary);
}

.wrap-select select {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  padding: 0.15em 0.4em;
}

/* Extra breathing room so the config control (wrap) and the action (copy)
   don't read as one cluster. */
.output-header .copy-button {
  margin-left: var(--spacing-2);
}

/* Fixed-px, JsonTree.vue-style — a copy icon's legibility floor doesn't
   scale with the code font. Sized up a touch from JsonTree's 24/16 so it
   holds its own next to the wrap <select>. */
.copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.copy-button svg {
  width: 18px;
  height: 18px;
}

.copy-button:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-bg-base);
}

.copy-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.copy-button:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

/* Reuses the signature accent as the "this happened" colour — this app's
   palette has no separate success hue (same call JsonTree.vue's
   `.json-tree-copy-success` makes). */
.copy-success {
  color: var(--color-accent-signature);
}
</style>
