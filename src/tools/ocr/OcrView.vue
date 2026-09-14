<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  PhCopySimple,
  PhCheck,
  PhImage,
  PhMagnifyingGlass,
  PhX,
  PhCaretUp,
  PhCaretDown,
} from "@phosphor-icons/vue";
import AppButton from "../../components/AppButton.vue";
import { useRegistryStore } from "../../stores/registry";
import { writeClipboardText } from "../../shell/clipboard";
import { useCopyFeedback } from "../../shell/useCopyFeedback";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import type { OcrOutcome, OcrRegion } from "./ocrOutcome";
import { isLowConfidence, isUnreadable } from "./lowConfidence";
import { findMatches, wrapIndex } from "./findMatches";
import {
  OVERLAY_FONT_STACK,
  fitScale,
  spanGeometryFor,
  quadPlacement,
  charRunPlacement,
  type MeasureText,
} from "./overlayGeometry";

const { t } = useI18n();
const registry = useRegistryStore();
// AC37: routing is this view's own navigation, not a reach into another tool (AD-6).
const router = useRouter();
const { isCopied, markCopied, cancel: cancelCopyFeedback } = useCopyFeedback();

type OcrResult = { toolId: string; value: unknown } | { toolId: string; error: ToolError };

const outcome = ref<OcrOutcome | null>(null);
const error = ref<ToolError | null>(null);
const announcement = ref("");

// The image behind the current outcome. Two sources, because the two entry paths hand us
// different things: drop and the file picker give a filesystem path (AC11's asset protocol
// turns it into something an <img> can load), while paste gives raw pixels the shell already
// read (AC12) — there is no file, so nothing for convertFileSrc to convert.
const imageSrc = ref<string | null>(null);
const pastedImage = ref<{ rgba: Uint8Array; width: number; height: number } | null>(null);
const pasteCanvas = ref<HTMLCanvasElement | null>(null);

const paneEl = ref<HTMLElement | null>(null);
const paneSize = ref({ width: 0, height: 0 });
const overlayEl = ref<HTMLElement | null>(null);

const findQuery = ref("");
const findInput = ref<HTMLInputElement | null>(null);
const currentMatch = ref(0);


// AC32: the shell publishes drag-over state; this view only decides whether it is the one being
// dragged onto. Drop dispatch itself stays window-level — this is an affordance, not a hit area.
const isDragOver = computed(() => registry.dragOverToolId === "ocr");

const hasImage = computed(() => imageSrc.value !== null || pastedImage.value !== null);

// AC33: derived rather than a flag each entry point has to remember to set — which is exactly
// how drop and paste shipped without an indicator at all in the first cut of this slice. An
// image on screen with neither an outcome nor an error can only mean the extraction is still
// running, and that is true identically for drop, paste and the file picker.
const extracting = computed(() => hasImage.value && outcome.value === null && error.value === null);
const regions = computed<OcrRegion[]>(() => outcome.value?.regions ?? []);

// FR26, anchored to TEXT rather than region count: an image can yield several regions and still
// have nothing readable in it.
const hasReadableText = computed(() =>
  regions.value.some((r) => r.text !== null && r.text.trim() !== ""),
);
// AC39: "no text found" becomes a diagnosis when the detector DID find regions — we located
// writing here and could not read it — rather than a bare denial on an image full of text.
const showNoTextFound = computed(() => outcome.value !== null && !hasReadableText.value);
const hasUnreadableRegions = computed(() => regions.value.some(isUnreadable));

// AD-1: core returns regions and geometry and deliberately exposes no whole-text accessor —
// joining them is presentation. Regions arrive already sorted into reading order, which is what
// makes this join correct rather than merely plausible.
const wholeText = computed(() =>
  regions.value
    .map((r) => r.text)
    .filter((text): text is string => text !== null)
    .join("\n"),
);

// --- geometry -----------------------------------------------------------------------------

// One offscreen 2d context, reused. Text measurement is what makes the width fit land on the
// pixels rather than near them; without a context (jsdom, or a browser that refuses one) the
// geometry falls back to unfitted spans rather than failing.
let measureCtx: CanvasRenderingContext2D | null | undefined;
const measure: MeasureText = (text, fontSizePx) => {
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return Number.NaN;
  measureCtx.font = `${fontSizePx}px ${OVERLAY_FONT_STACK}`;
  return measureCtx.measureText(text).width;
};

// Three sources, in falling order of authority, and the order is the point:
//
// 1. The outcome, once it lands — these are the dimensions recognition actually ran against,
//    AFTER EXIF orientation, so they are the space the region polygons live in. Nothing else
//    may win once this exists, or the overlay drifts off the text.
// 2. The pasted pixels, which carry their own width/height from the clipboard.
// 3. The dropped/picked file's decoded size, read off the `<img>` once the browser has it.
//
// Without (3) the drop and file-picker paths had NO size at all until recognition returned,
// roughly three seconds later — so `.surface` was 0x0, and since it clips its overflow both
// the image and the sweep inside it were invisible for the entire wait. AC33 asks for the
// image in the first frame; on those two paths it was never drawn until the last one.
const loadedSize = ref<{ width: number; height: number } | null>(null);

function onImageLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  if (img.naturalWidth > 0) {
    loadedSize.value = { width: img.naturalWidth, height: img.naturalHeight };
  }
}

/**
 * Code review 2026-09-08: only `@load` was bound, so a source image that failed to render did so
 * in total silence — `onImageLoad` never fired, the surface was still sized from the outcome's
 * own `image_width`/`image_height`, and the transparent region spans and dashed unreadable boxes
 * were painted over an empty rectangle. The user could not tell whether recognition had failed or
 * the render had. Reachable from a refused asset request, a file moved or deleted between the
 * drop and the paint, or a permission change — none of which the extraction itself would notice.
 */
function onImageError() {
  imageSrc.value = null;
  outcome.value = null;
  error.value = {
    code: "ocr-image-unreadable",
    message: t("errors.ocr-image-unreadable"),
    position: null,
    context: null,
  };
  announcement.value = t("errors.ocr-image-unreadable");
}

const naturalSize = computed(() => ({
  width: outcome.value?.image_width ?? pastedImage.value?.width ?? loadedSize.value?.width ?? 0,
  height: outcome.value?.image_height ?? pastedImage.value?.height ?? loadedSize.value?.height ?? 0,
}));

// AC35: fit to pane, never upscale. One factor, both axes, one coordinate transform — no zoom,
// no pan, no scroll, because every one of those would add a second transform and a viewport
// model for a job that ends the moment the user pastes.
const scale = computed(() =>
  fitScale(
    naturalSize.value.width,
    naturalSize.value.height,
    paneSize.value.width,
    paneSize.value.height,
  ),
);
const renderedSize = computed(() => ({
  width: naturalSize.value.width * scale.value,
  height: naturalSize.value.height * scale.value,
}));

const matches = computed(() => findMatches(regions.value, findQuery.value));

interface RenderedMatch {
  key: string;
  current: boolean;
  /** True when the region gave no character geometry and the whole line is banded instead. */
  approximate: boolean;
  style: Record<string, string>;
}

interface RenderedSpan {
  key: string;
  region: OcrRegion;
  text: string;
  style: Record<string, string>;
  low: boolean;
  unreadable: boolean;
}

const spans = computed<RenderedSpan[]>(() =>
  regions.value.map((region) => {
    const geometry = spanGeometryFor(region, scale.value, measure);
    const text = region.text ?? "";

    return {
      key: `${region.polygon[0]?.x ?? 0}:${region.polygon[0]?.y ?? 0}:${region.text ?? ""}`,
      region,
      text,
      low: isLowConfidence(region),
      unreadable: isUnreadable(region),
      style: {
        left: `${geometry.left}px`,
        top: `${geometry.top}px`,
        width: `${geometry.widthPx}px`,
        height: `${geometry.fontSizePx}px`,
        fontSize: `${geometry.fontSizePx}px`,
        letterSpacing: `${geometry.letterSpacingPx}px`,
        transform: `rotate(${geometry.angleRad}rad)`,
      },
    };
  }),
);

watch(extracting, (running) => {
  if (running) announcement.value = t("tools.ocr.extracting");
});

// Match placement, straight from the per-character polygons core returns — the run's own quad,
// first character's leading edge through last character's trailing edge. No font metrics are
// involved, so a monospace terminal capture and a proportional document photo are equally exact.
//
// When a region carries no usable character polygons the whole REGION is banded instead, and the
// mark is flagged approximate. That is deliberate: the previous fallback estimated a substring's
// position from the overlay font's metrics, which is systematically wrong whenever the image's
// font distributes width differently — it drew a precise-looking box in the wrong place, which
// is worse than an honest imprecise one. A tool that never bluffs about its results should not
// bluff about where it found them either.
const matchOverlays = computed<RenderedMatch[]>(() =>
  matches.value.map((match, matchIndex) => {
    const region = regions.value[match.regionIndex];
    const exact =
      region && region.char_polygons.length > 0
        ? charRunPlacement(region.char_polygons, match.start, match.end, scale.value)
        : null;
    const placement = exact ?? quadPlacement(region?.polygon ?? [], scale.value);
    const pad = placement.heightPx * 0.08;
    return {
      key: `${match.regionIndex}:${match.start}`,
      current: matchIndex === currentMatch.value,
      approximate: exact === null,
      style: {
        left: `${placement.left}px`,
        top: `${placement.top - pad}px`,
        width: `${placement.widthPx}px`,
        height: `${placement.heightPx + pad * 2}px`,
        transform: `rotate(${placement.angleRad}rad)`,
      },
    };
  }),
);

// --- extraction ---------------------------------------------------------------------------

// Called by every entry point the moment a NEW image arrives, before its text is known.
//
// It used to be called by the file picker alone, which left the drop and paste paths carrying
// the previous image's state into the next one — three visible bugs from one omission, all
// reported at the 2026-09-08 render review, all fixed by widening the caller set rather than
// by patching each symptom:
//
// - the stale `outcome` kept `extracting` false, so the second image arrived with no blur and
//   no sweep — the app looked like it had done nothing;
// - `naturalSize` reads the outcome first (it must — see its own comment), so the second image
//   was drawn into the FIRST one's dimensions, stretched to a shape it never had;
// - `findQuery` and its matches survived, so highlights located in the old image were painted
//   over the new one, pointing at text that is not there.
//
// A second image replaces the first: no history, no accumulation.
// Code review 2026-09-08: whether THIS instance ever received a source of its own — not whether
// an image is currently on screen, which is a different question with a window in it (the drop
// path now awaits the asset grant before the `<img>` src is set). `DropZone.vue`'s `isStillActive`
// checks the ROUTE, so a result can be delivered to a fresh instance that mounted after the
// original one consumed the one-shot source signal. Without this, that outcome rendered nothing
// at all while the announcer said "Text extracted."
const hasOwnSource = ref(false);

function resetForNewSource() {
  error.value = null;
  outcome.value = null;
  loadedSize.value = null;
  findQuery.value = "";
  currentMatch.value = 0;
  hasOwnSource.value = true;
}

function applyOcrResult(result: OcrResult) {
  if ("error" in result) {
    error.value = result.error;
    // Code review 2026-09-08: a clipboard holding no image never replaced the source, so it must
    // not clear it. Every other error DID arrive with a new file or new pixels, and clearing is
    // right for those — the thing on screen is the thing that just failed.
    if (result.error.code !== "paste-no-image") {
      outcome.value = null;
      imageSrc.value = null;
      pastedImage.value = null;
    }
    // Code review 2026-09-08: this branch used to return without touching `announcement`, and
    // because it clears the image, `extracting` went false without the watcher firing — so after
    // any failure the one always-mounted live region still read "Extracting text…", or the
    // PREVIOUS run's "Text extracted." The visible error is a `v-if`-inserted `role="alert"`,
    // which is exactly the pattern documented below as producing no announcement at all, and is
    // why this announcer exists. The no-text case was fixed at the 2026-09-08 screen-reader
    // pass; the error case had the same hole.
    announcement.value = toolErrorMessage(result.error, t);
    return;
  }
  error.value = null;
  outcome.value = result.value as OcrOutcome;
  // Code review 2026-09-08: `isStillActive()` in the shell checks the ROUTE, not the component
  // instance. Drop an image, navigate away, navigate back before the ~3 s inference resolves,
  // and the result is delivered to a FRESH instance that never saw the source signal (the
  // watchers are not `immediate`, and the old instance already consumed it). Every result
  // surface in the template sits behind `v-if="hasImage"`, so the outcome rendered nothing at
  // all — while the announcer said "Text extracted." That is the tool bluffing about its own
  // result, in the one view built around never doing that.
  if (!hasOwnSource.value) {
    outcome.value = null;
    announcement.value = "";
    return;
  }
  // Announce the RESULT, not the event. Two reasons, and the first one is why this changed
  // after the 2026-09-08 screen-reader pass found the no-text case silent:
  //
  // 1. A live region only speaks when the content of an element ALREADY in the accessibility
  //    tree changes. The visible no-text message is `v-if`-inserted, so the region and its text
  //    arrived together and VoiceOver had nothing to observe — it said nothing at all. The
  //    `.sr-only` region below is mounted for the life of the view, so routing the sentence
  //    through it is what makes it audible. The visible message consequently carries no live
  //    role of its own; two regions speaking the same result is the other failure mode.
  // 2. "Text extracted." was announced unconditionally, including when nothing was extracted.
  //    Audible or not, that was the tool bluffing about its own result in an app whose whole
  //    claim is that it never does.
  announcement.value = hasReadableText.value
    ? t("tools.ocr.extractionComplete")
    : hasUnreadableRegions.value
      ? t("tools.ocr.noTextDiagnosis")
      : t("tools.ocr.noTextInImage");
}

watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "ocr") return;
    registry.dropResult = null; // one-shot signal
    applyOcrResult(result);
  },
);

watch(
  () => registry.pasteResult,
  (result) => {
    if (!result || result.toolId !== "ocr") return;
    registry.pasteResult = null; // one-shot signal
    applyOcrResult(result);
  },
);

// AC33: the image renders in the FIRST frame, before recognition returns. The ~3 s wait is a
// feedback problem, not a speed problem — showing the image answers "did it take my file?"
// instantly, and the first-run model load then happens against something recognisable.
// AC37: the path of a PDF that was just dropped here and refused. Held so the refusal can offer
// to carry the file to the tool that CAN open it, rather than only naming that tool.
const droppedPdfPath = ref<string | null>(null);

/**
 * AC37: the dropped PDF the refusal can offer to carry, or `null`.
 *
 * Gated on the error code rather than tracked as its own flag, which is what keeps it correct
 * without any explicit clean-up: any new source clears `error` (`resetForNewSource`), so this
 * goes null on its own the moment the user does something else. A separate boolean would have
 * needed resetting on the drop path, the paste path and the file-picker path, and would have been
 * forgotten on at least one of them.
 */
const pdfRedirect = computed(() =>
  error.value?.code === "ocr-pdf-wrong-tool" ? droppedPdfPath.value : null,
);

/** AC25: only the basename reaches the screen — never the absolute path. */
function basename(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] || path;
}

async function onOpenDroppedPdf() {
  const path = droppedPdfPath.value;
  if (path === null) return;
  droppedPdfPath.value = null;
  error.value = null;
  // Published BEFORE the route change, so the PDF view's `immediate` watcher sees it the moment
  // it mounts. The reverse order would race: the view would mount, find nothing, and the signal
  // would arrive to an empty room.
  registry.handOffPath = { toolId: "pdf", path };
  await router.push("/tools/pdf");
}

// AC37: captured by a SYNCHRONOUS watcher, and that is the whole fix for a bug the first attempt
// shipped.
//
// `dropSourcePath` is genuinely transient. `DropZone.vue` publishes it, invokes, and on rejection
// sets `dropResult` **and clears `dropSourcePath`** — all within one tick. A dropped PDF is
// refused by a format check, i.e. almost instantly, so with Vue's default `flush: "pre"` the
// watcher below never observes the non-null value at all: it runs once, sees `null`, and returns.
// The path was never captured and the offer never rendered, which is exactly what the developer
// saw — the sentence appeared and nothing else did.
//
// A sync watcher observes every mutation as it happens, so the value cannot be set and unset
// behind its back. Kept separate from the main watcher below rather than making that one sync:
// that one's ordering is load-bearing and carefully reasoned, and it has no business changing
// timing to serve this.
watch(
  () => registry.dropSourcePath,
  (source) => {
    if (!source || source.toolId !== "ocr") return;
    // Code review 2026-09-14: no longer gated on the path ending in `.pdf`. The refusal this
    // offers to redirect (`ocr-pdf-wrong-tool`) is raised by the Rust side sniffing the file's
    // magic bytes, not its name — a PDF with no extension, a renamed one, or a temp/download path
    // is refused exactly the same way, and the extension check here silently hid the offer for
    // precisely that class of file. `pdfRedirect` already gates on the error code alone; capturing
    // the path unconditionally is what makes that the ONLY gate.
    droppedPdfPath.value = source.path;
  },
  { flush: "sync" },
);

watch(
  () => registry.dropSourcePath,
  (source) => {
    if (!source || source.toolId !== "ocr") return;
    registry.dropSourcePath = null; // one-shot signal
    // Safe to clear the previous result here, and only here: the shell publishes the source
    // BEFORE it invokes (`DropZone.vue`), and the result only after the await, so this signal
    // always precedes the outcome it belongs to and can never wipe a fresh one.
    resetForNewSource();
    pastedImage.value = null;
    void showFileSource(source.path);
  },
);

/**
 * Grants the webview read access to `path`, then renders it.
 *
 * Code review 2026-09-08. `tauri.conf.json` ships `assetProtocol.scope` statically EMPTY, so a
 * path is unreadable until the Rust side allows it. That grant used to be made inside
 * `ocr_extract_text`'s `spawn_blocking`, while this line set the `<img>` src in the same tick the
 * drop was published — an asset request needing one Vue flush and a custom-scheme handler call,
 * racing a grant sitting behind an IPC hop, a runtime scheduling decision, a blocking-pool
 * dispatch and a `metadata()` stat. Nothing ordered the two, and losing the race was permanent:
 * the protocol returns 403 and the `src` never changes, so the browser never retries.
 *
 * Awaiting a grant command of its own makes the ordering a guarantee. It costs one IPC round
 * trip before the image appears, against an inference measured in seconds.
 */
async function showFileSource(path: string) {
  try {
    await invoke("ocr_grant_asset", { path });
  } catch (err) {
    applyOcrResult({ toolId: "ocr", error: toToolError(err) });
    return;
  }
  imageSrc.value = convertFileSrc(path);
}

watch(
  () => registry.pasteSourceImage,
  (source) => {
    if (!source || source.toolId !== "ocr") return;
    registry.pasteSourceImage = null; // one-shot signal
    resetForNewSource(); // same ordering guarantee as the drop path above
    imageSrc.value = null;
    pastedImage.value = { rgba: source.rgba, width: source.width, height: source.height };
    void drawPastedImage();
  },
);

// The paste path has no file, so it has no URL: the shell hands us the pixels it already read
// and the view paints them itself. Reading the clipboard here instead would be a second OS I/O
// edge (AD-14) and racy, since the clipboard can change during the ~3 s inference.
async function drawPastedImage() {
  await Promise.resolve(); // let the canvas mount
  const canvas = pasteCanvas.value;
  const image = pastedImage.value;
  if (!canvas || !image) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = image.width;
  canvas.height = image.height;
  // Code review 2026-09-08: `ImageData` throws `DataError` when the buffer length does not match
  // width * height * 4, and the only call site is a bare `void drawPastedImage()`. The throw
  // surfaced as an unhandled rejection, the canvas stayed blank, and the view depended entirely
  // on Rust independently rejecting the same bytes with `ocr-malformed-image-buffer`. The two
  // validations agree today; the view should not need them to.
  try {
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height),
      0,
      0,
    );
  } catch (err) {
    applyOcrResult({ toolId: "ocr", error: toToolError(err) });
  }
}

// AC13: the file picker is a THIRD write-trigger on the same extraction state, alongside drop
// and paste. Per AD-16's amended one-runner-per-independent-state rule that means the view calls
// `registry.getLatestWinsRunner("ocr")` directly — the first view in this codebase to do so —
// rather than creating a local runner, so a pick landing after an in-flight drop supersedes it
// instead of racing it.
async function onChooseImage() {
  try {
    const path = await open({ multiple: false });
    if (path === null) return;

    // Code review 2026-09-14: the picker is the other place `ocr-pdf-wrong-tool` is reachable
    // (via `showFileSource` -> `ocr_grant_asset`, which sniffs the same magic bytes as the drop
    // path). Captured unconditionally, exactly like the drop watcher above — `pdfRedirect`'s
    // error-code gate is what decides whether it is ever shown, not this assignment. Without it,
    // picking a misidentified PDF hit the identical wall a drop would, with no way out of it.
    droppedPdfPath.value = path;
    resetForNewSource();
    pastedImage.value = null;
    await showFileSource(path);
    if (error.value) return; // the grant was refused; it already said why

    const result = await registry.getLatestWinsRunner("ocr")(() =>
      invoke<unknown>("ocr_extract_text", { path }),
    );
    if (!result.superseded) applyOcrResult({ toolId: "ocr", value: result.value });
  } catch (err) {
    applyOcrResult({ toolId: "ocr", error: toToolError(err) });
  }
}

// --- copy ---------------------------------------------------------------------------------

async function onCopyAll() {
  error.value = null;
  try {
    await writeClipboardText(wholeText.value);
    markCopied("all");
  } catch (err) {
    error.value = toToolError(err);
  }
}

// --- find ---------------------------------------------------------------------------------

// The find field is always on screen whenever there is text to search, rather than summoned by
// ⌘F. Render review, 2026-09-08: "not everyone knows cmd+f". The shortcut still works — it
// focuses the field — but it is now an accelerator for a visible control, not the only door to
// a hidden one.
function focusFind() {
  currentMatch.value = 0;
  void Promise.resolve().then(() => findInput.value?.select());
}

function clearFind() {
  findQuery.value = "";
  currentMatch.value = 0;
}

// Mirrors JsonTree's own find-bar navigation, which this rebuilt one had failed to match:
// Next/Previous buttons AND Enter/Shift+Enter AND ArrowUp/ArrowDown, all wrapping at either
// end. `upPulseKey`/`downPulseKey` re-key the caret so it pulses when you navigate from the
// keyboard — without it there is no acknowledgement that the key did anything, since the
// image itself does not scroll (AC35: fit to pane, no scroll).
const upPulseKey = ref(0);
const downPulseKey = ref(0);

function goToMatch(index: number, direction?: "up" | "down") {
  if (matches.value.length === 0) return;
  currentMatch.value = wrapIndex(index, matches.value.length);
  if (direction === "up") upPulseKey.value += 1;
  if (direction === "down") downPulseKey.value += 1;
}

function onFindKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    clearFind();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    goToMatch(currentMatch.value + (event.shiftKey ? -1 : 1), event.shiftKey ? "up" : "down");
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    goToMatch(currentMatch.value + 1, "down");
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    goToMatch(currentMatch.value - 1, "up");
  }
}

watch(findQuery, () => {
  currentMatch.value = 0;
});

// AC38: scoped to this view, NOT intercepted app-wide. No other tool has a find, and a global
// interceptor would be shell surface this story does not need to claim.
// AC37: ⌘A inside the overlay selects every recognised region, so ⌘C yields the whole result
// without touching the Copy control — the pure keyboard path for copy-and-leave (NFR5).
//
// Code review 2026-09-08: this branch was unreachable as shipped. It gates on
// `overlayEl.contains(document.activeElement)`, but the overlay was a `role="group"` with no
// `tabindex` and only `span`/`div` children, none focusable — so `activeElement` was `<body>`
// (or the find input, which is outside the overlay) at all times, `contains` was always false,
// and ⌘A fell through to the browser's select-the-whole-document default. The overlay now
// carries `tabindex="0"`, which is what makes AC37's stated path exist. The focus-order and
// screen-reader consequences of a focusable overlay belong to AC30's owed VoiceOver pass.
function onKeydown(event: KeyboardEvent) {
  const meta = event.metaKey || event.ctrlKey;
  if (!meta) return;

  if (event.key.toLowerCase() === "f" && hasReadableText.value) {
    event.preventDefault();
    focusFind();
    return;
  }

  if (event.key.toLowerCase() === "a" && overlayEl.value?.contains(document.activeElement)) {
    event.preventDefault();
    const range = document.createRange();
    range.selectNodeContents(overlayEl.value);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

let resizeObserver: ResizeObserver | undefined;

function measurePane() {
  const el = paneEl.value;
  if (!el) return;
  paneSize.value = { width: el.clientWidth, height: el.clientHeight };
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  measurePane();
  if (typeof ResizeObserver !== "undefined" && paneEl.value) {
    resizeObserver = new ResizeObserver(measurePane);
    resizeObserver.observe(paneEl.value);
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  resizeObserver?.disconnect();
  cancelCopyFeedback();
});
</script>

<template>
  <section class="ocr">
    <h1>{{ t('tools.ocr.heading') }}</h1>
    <p class="tool-desc">
      {{ t('tools.ocr.dropHint') }}
    </p>

    <!-- AC37/AC38, revised at render review 2026-09-08: the control cluster sits ABOVE the
         image, not pinned inside it. On the image it covered whatever text happened to be
         underneath — and on a screenshot the top-right corner is as likely to hold the thing
         you came looking for as anywhere else. A control that can hide the result is the
         wrong trade in a tool whose whole point is reading the result. -->
    <div
      v-if="hasImage"
      class="toolbar"
    >
      <!-- Render review 2026-09-08: these two used to sit AFTER the pane, and since the pane
           claims every leftover pixel of a full-height column they landed at the bottom of the
           window — far from the image they describe, and far enough from the drop target that
           the developer never saw the error at all. The toolbar is already this view's status
           row (it holds the in-flight chip), directly above the image, so a message about the
           image belongs here. `margin-right: auto` keeps it left while the controls stay right. -->
      <p
        v-if="error"
        role="alert"
        class="status error"
      >
        {{ toolErrorMessage(error, t) }}
        <!-- The same inline action as the drop target's copy below. Both blocks carry it because
             which one renders depends on whether an image was ever set: a slow failure leaves one
             on screen and reports here, a fast refusal — every dropped PDF — never gets that far
             and reports there. -->
        <button
          v-if="pdfRedirect"
          type="button"
          class="error-action"
          @click="onOpenDroppedPdf"
        >
          {{ t('tools.ocr.openDroppedPdf', { name: basename(pdfRedirect) }) }}
        </button>
      </p>
      <!-- Visual only, deliberately: `role="status"` here was inaudible (the element is
           `v-if`-inserted, so there was no pre-existing region for VoiceOver to observe) and,
           now that the sr-only announcer carries this sentence, keeping it would double the
           announcement rather than fix it. Screen-reader pass, 2026-09-08. -->
      <p
        v-else-if="showNoTextFound"
        class="status no-text"
      >
        {{ hasUnreadableRegions ? t('tools.ocr.noTextDiagnosis') : t('tools.ocr.noTextInImage') }}
      </p>
      <!-- aria-hidden: the sr-only live region below is what announces this, so the chip
           would otherwise be read a second time on traversal. -->
      <div
        v-if="extracting"
        class="chip"
        aria-hidden="true"
      >
        <svg
          class="spinner"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            stroke-opacity="0.22"
            stroke-width="2"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <span>{{ t('tools.ocr.extracting') }}</span>
      </div>
      <div
        v-if="hasReadableText"
        class="findbar"
      >
        <PhMagnifyingGlass aria-hidden="true" />
        <input
          ref="findInput"
          v-model="findQuery"
          type="text"
          :aria-label="t('tools.ocr.find')"
          :placeholder="t('tools.ocr.findPlaceholder')"
          @keydown="onFindKeydown"
        >
        <span
          class="match-count"
          role="status"
        >{{
          findQuery === ''
            ? ''
            : matches.length
              ? t('tools.ocr.matchCount', { current: currentMatch + 1, total: matches.length })
              : t('tools.ocr.noMatches')
        }}</span>
        <button
          v-if="matches.length > 1"
          type="button"
          class="nav"
          :aria-label="t('tools.ocr.previousMatch')"
          :title="t('tools.ocr.previousMatch')"
          @click="goToMatch(currentMatch - 1, 'up')"
        >
          <PhCaretUp
            :key="upPulseKey"
            aria-hidden="true"
            :class="{ pulse: upPulseKey > 0 }"
          />
        </button>
        <button
          v-if="matches.length > 1"
          type="button"
          class="nav"
          :aria-label="t('tools.ocr.nextMatch')"
          :title="t('tools.ocr.nextMatch')"
          @click="goToMatch(currentMatch + 1, 'down')"
        >
          <PhCaretDown
            :key="downPulseKey"
            aria-hidden="true"
            :class="{ pulse: downPulseKey > 0 }"
          />
        </button>
        <button
          v-if="findQuery"
          type="button"
          class="nav clear"
          :aria-label="t('tools.ocr.clearFind')"
          :title="t('tools.ocr.clearFind')"
          @click="clearFind"
        >
          <PhX aria-hidden="true" />
        </button>
      </div>
      <button
        v-if="hasReadableText"
        type="button"
        class="ghost"
        :aria-label="isCopied('all') ? t('tools.ocr.copied') : t('tools.ocr.copyAllText')"
        :title="isCopied('all') ? t('tools.ocr.copied') : t('tools.ocr.copyAllText')"
        @click="onCopyAll"
      >
        <PhCheck
          v-if="isCopied('all')"
          class="ok"
          aria-hidden="true"
        />
        <PhCopySimple
          v-else
          aria-hidden="true"
        />
      </button>
    </div>
    <!-- The image and the resting target occupy the SAME frame, so nothing jumps on drop. -->
    <div
      ref="paneEl"
      class="pane"
    >
      <!-- AC31: the resting state is a real drop target — three doors, one object. -->
      <div
        v-if="!hasImage"
        class="drop-target"
        :class="{ 'drag-over': isDragOver }"
      >
        <PhImage
          class="drop-glyph"
          aria-hidden="true"
        />
        <p class="drop-label">
          {{ isDragOver ? t('tools.ocr.dropToExtract') : t('tools.ocr.dropTargetLabel') }}
        </p>
        <p class="or-separator">
          {{ t('tools.ocr.orSeparator') }}
        </p>
        <AppButton
          variant="default"
          @click="onChooseImage"
        >
          {{ t('tools.ocr.chooseImage') }}
        </AppButton>
        <p class="or-separator">
          {{ t('tools.ocr.orSeparator') }}
        </p>
        <p class="paste-hint">
          {{ t('tools.ocr.pasteHint') }}
        </p>

        <!-- AC40: the error explains without removing the way back in — it is rendered INSIDE
             the resting target, under the controls that offer another go, so the answer and
             the retry are one object. Every drop/paste failure clears the image, which is what
             puts the target back on screen; a copy failure keeps its image, and the toolbar
             copy above is that case's home. -->
        <p
          v-if="error"
          role="alert"
          class="error"
        >
          {{ toolErrorMessage(error, t) }}
          <!-- AC37, render review 2026-09-11 (second pass). The first attempt appended a `default`
               AppButton here and the developer rejected it; the replacement — a dedicated redirect
               state with a PDF glyph — was rejected too, and for better reasons than the design it
               replaced:

                 * dropping the red made it read as though nothing had gone wrong. It had: the user
                   handed this tool a file and the tool refused it. Red is the honest colour for
                   that, and calling it "just a routing hint" was the designer's view, not theirs.
                 * showing the PDF tool's own glyph inside Image to Text signals "you are in the
                   PDF tool now", which is precisely the confusion a hand-off should avoid.

               So the message keeps its colour, its place and its `role="alert"`, and the ACTION
               lives inside the sentence as a text link. Nothing new competes with "Choose an
               image…", nothing is off-centre, and the affordance is where the explanation already
               is. The link names the FILE rather than repeating "the PDF tool", so the visible
               text is also a complete accessible name (WCAG 2.5.3) instead of a statement that
               happens to be clickable. -->
          <button
            v-if="pdfRedirect"
            type="button"
            class="error-action"
            @click="onOpenDroppedPdf"
          >
            {{ t('tools.ocr.openDroppedPdf', { name: basename(pdfRedirect) }) }}
          </button>
        </p>
      </div>

      <div
        v-else
        class="surface"
        :style="{ width: `${renderedSize.width}px`, height: `${renderedSize.height}px` }"
      >
        <img
          v-if="imageSrc"
          :src="imageSrc"
          class="source-image"
          :class="{ unresolved: extracting }"
          :alt="t('tools.ocr.imageAccessibleName')"
          @load="onImageLoad"
          @error="onImageError"
        >
        <canvas
          v-else
          ref="pasteCanvas"
          class="source-image"
          :class="{ unresolved: extracting }"
          :aria-label="t('tools.ocr.imageAccessibleName')"
          role="img"
        />

        <!-- AC34: the extracted text is rendered exactly ONCE — here, on the image. No
             textarea, no second pane, no transcript below. -->
        <div
          ref="overlayEl"
          class="overlay"
          role="group"
          tabindex="0"
          :aria-label="t('tools.ocr.overlayLabel')"
        >
          <div
            v-for="mark in matchOverlays"
            :key="`m${mark.key}`"
            class="match"
            :class="{ current: mark.current, approximate: mark.approximate }"
            :style="mark.style"
            aria-hidden="true"
          />
          <template
            v-for="span in spans"
            :key="span.key"
          >
            <div
              v-if="span.unreadable"
              class="region-unreadable"
              :style="span.style"
              :title="t('tools.ocr.unreadableRegion')"
            />
            <span
              v-else
              class="region"
              :class="{ low: span.low }"
              :style="span.style"
            >
              {{ span.text }}
            </span>
          </template>
        </div>

        <!-- AC33: INDETERMINATE, never a filling bar. ONNX reports no progress, and a bar
             advancing at an invented rate would be a bluff about our own internals in an app
             built on never bluffing. A sweep loops; it never claims to be nearly done. -->
        <div
          v-if="extracting"
          class="in-flight"
          aria-hidden="true"
        >
          <div class="sweep" />
        </div>
      </div>
    </div>

    <!-- Announce-only live region for start/completion (AC33). -->
    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </p>
  </section>
</template>

<style scoped>
.ocr {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  /* `.main-pane` is a flex child of a 100vh shell, so there is a real height here to claim.
     Claiming it is what lets the image use the window instead of a fixed fraction of it. */
  height: 100%;
  min-height: 0;
}

h1 {
  font-family: var(--font-heading-family);
  font-size: var(--font-heading-size);
  font-weight: var(--font-heading-weight);
  line-height: var(--font-heading-line-height);
  margin: 0;
}

.tool-desc {
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-2);
}

.pane {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  /* Takes every pixel left over after the heading, and no more. `min-height: 0` is what stops
     a flex item refusing to shrink below its content — without it the pane would grow to the
     image's natural size and push the window into a scroll. */
  flex: 1;
  min-height: 240px;
}

/* AC31: HashView's existing dashed-box drop language, used here LITERALLY — 8.5 established
   that the dashed box means *drop* and must not be borrowed as decoration. This is the one
   place it belongs. */
.drop-target {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  width: 100%;
  min-height: 320px;
  padding: var(--spacing-6);
  border: 2px dashed var(--color-border-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
}

/* AC32: solid border and tinted fill while a drag is over the window. */
.drop-target.drag-over {
  border-style: solid;
  border-color: var(--color-accent-signature);
  background: var(--color-accent-signature-tint);
}

.drop-glyph {
  width: 32px;
  height: 32px;
  color: var(--color-text-tertiary);
}

/* The two ways in that are plain sentences read as one voice — the paste hint is
   an equal door, not a footnote to the drop label. */
.drop-label,
.paste-hint {
  margin: 0;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-text-primary);
}

/* The two "or" lines are connectors, not content: caption weight, and half the
   stack's gap on each side so each one reads as binding the pair it sits between
   rather than as a third instruction. */
.or-separator {
  margin: calc(var(--spacing-3) / -2) 0;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-tertiary);
}

.surface {
  position: relative;
  flex: 0 0 auto;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.source-image {
  display: block;
  width: 100%;
  height: 100%;
  /* Blur-to-sharp: the image itself carries the in-flight state, and RESOLVING is the
     completion signal — nothing has to disappear for the result to read as arrived. Kept
     short so it never delays the moment the text becomes usable. */
  transition: filter 320ms ease;
}

.source-image.unresolved {
  filter: blur(3px) saturate(0.55);
}

.overlay {
  position: absolute;
  inset: 0;
}

/* Transparent but real: a screen reader reads these spans in DOM order, which is the reading
   order core sorted them into, and a native drag-select picks up everything between two of
   them. */
.region {
  position: absolute;
  white-space: pre;
  color: transparent;
  /* Code review 2026-09-08: this was `var(--font-sans)`, which tokens.css resolves to the
     bundled "Geist Sans" webfont — while `measureOverlayText` measures with
     OVERLAY_FONT_STACK (the system stack), whose own doc says it is exported "so the two
     cannot drift". They had drifted. `fitLetterSpacing` solves (target - naturalSF)/len but
     the span then renders at naturalGeist + spacing*len, and the residual is absorbed
     nowhere — so a native drag-selection highlight, which is the entire premise of Live Text,
     slides progressively off the words toward the end of every line. Invisible to the suite:
     jsdom has no canvas 2d context, so `measure` returns NaN and letterSpacingPx is 0 in all
     963 tests. Bound to the constant rather than the token so the drift cannot recur. */
  font-family: v-bind(OVERLAY_FONT_STACK);
  line-height: 1;
  transform-origin: 0 0;
  cursor: text;
}

.region::selection {
  background: var(--color-accent-signature-tint);
}

/* AC36: low confidence is a dotted UNDERLINE and unreadable is a dashed BOX — two shapes, so
   the signal survives a colour-blind viewer and a greyscale screenshot. */
.region.low {
  border-bottom: 2px dotted var(--color-accent-signature);
}

.region-unreadable {
  position: absolute;
  border: 1.5px dashed var(--color-accent-signature);
  border-radius: var(--radius-sm);
  transform-origin: 0 0;
}

/* Two-tier highlight in one hue, as JsonTree's find does — "one of the matches" versus "the
   one you're on". Two things differ from JsonTree, both because these sit on an image:
   
   1. NOTHING here is opaque. JsonTree's current match is a solid accent fill with white text
      drawn on top; the overlay's text is transparent, so a solid fill has nothing on top of it
      and simply hides the pixels. Render review, 2026-09-08: "an opaque orange rectangle
      hiding it". Both tiers are translucent so the word underneath stays readable.
   2. Both are stronger and TALLER than JsonTree's 18% sliver: over arbitrary photo pixels a
      thin, faint mark disappears, which is what made unselected matches hard to find. */
.match {
  position: absolute;
  background: color-mix(in srgb, var(--color-accent-signature) 42%, transparent);
  border-radius: var(--radius-sm);
  /* The placement gives the quad's FIRST CORNER, so the rotation has to pivot there. Without
     this the default 50% 50% origin swings the band off a tilted line by half its width. */
  transform-origin: 0 0;
}

/* No character geometry for this region, so the whole line is banded rather than a guessed
   substring. Dashed, because an approximate mark should not look like an exact one. */
.match.approximate {
  background: none;
  border: 2px dashed var(--color-accent-signature);
}

/* The one you're on: a stronger wash plus a ring. The ring is what distinguishes it at a
   glance; the wash alone would only read as "slightly more orange". */
.match.current {
  background: color-mix(in srgb, var(--color-accent-signature) 62%, transparent);
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 0;
}

/* Same anatomy as JsonTree's own `.json-tree-nav-button`. */
.nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.nav svg {
  width: 13px;
  height: 13px;
}

.nav:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.nav:disabled {
  opacity: 0.4;
  cursor: default;
}

.nav:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

@keyframes nav-pulse {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.35);
  }
  100% {
    transform: scale(1);
  }
}

.pulse {
  animation: nav-pulse 180ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .pulse {
    animation: none;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-1);
  min-height: 24px;
}

/* The 24px ghost icon-button anatomy already used by JsonTree, Base64View, HashView, JwtView
   and CronView — not a labelled button competing with the surface it sits on. */
.ghost {
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

.ghost svg {
  width: 15px;
  height: 15px;
}

.ghost:hover {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.ghost:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.ok {
  color: var(--color-accent-signature);
}

.findbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  height: 24px;
  padding: 0 var(--spacing-1);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-sm);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-primary);
}

.findbar svg {
  width: 13px;
  height: 13px;
  color: var(--color-text-secondary);
}

.findbar input {
  width: 96px;
  border: none;
  outline: none;
  background: none;
  font: inherit;
  color: inherit;
}

.match-count {
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.in-flight {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

/* An accent line sweeping down the image, trailing a faint tint — the metaphor is the job
   itself, something being read top to bottom, rather than a generic "busy". */
.sweep {
  position: absolute;
  left: 0;
  right: 0;
  height: 26%;
  background: linear-gradient(to bottom, transparent, var(--color-accent-signature-tint));
  border-bottom: 2px solid var(--color-accent-signature);
  animation: sweep 2.1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes sweep {
  0% {
    top: -26%;
  }
  100% {
    top: 100%;
  }
}

/* No parked band under reduced motion: a stationary accent line across the middle of an image
   reads as a defect, not as a state. The blur and the labelled chip both still say "working". */
@media (prefers-reduced-motion: reduce) {
  .sweep {
    display: none;
  }

  .source-image {
    transition: none;
  }
}

.chip {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  height: 24px;
  padding: 0 var(--spacing-2);
  background: var(--color-bg-surface);
  border-radius: var(--radius-sm);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line-height);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.spinner {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  color: var(--color-accent-signature);
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}

/* AC37: an action INSIDE the message, in the message's own colour — not a second button beside
   it. `color: inherit` is doing the work: it keeps the link red with the sentence it belongs to,
   so the pair reads as one line rather than as an error with a control bolted to its side. The
   underline is the affordance; without it a coloured span in already-coloured text is invisible
   as something clickable. */
.error-action {
  appearance: none;
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.error-action:hover {
  text-decoration-thickness: 2px;
}

.error-action:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.error {
  margin: 0;
  color: var(--color-accent-destructive);
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
}

/* In the toolbar these sit left of the controls, and must not squeeze the find bar on a narrow
   window — hence `min-width: 0` plus ellipsis rather than wrapping the row onto two lines. */
.status {
  margin-right: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-text {
  margin: 0;
  color: var(--color-text-secondary);
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
}

/* Standard clip pattern (cf. JwtView / HashView / CronView `.sr-only`). */
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
</style>
