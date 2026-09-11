<script setup lang="ts">
// Story 8.8 slice 4 — the open-once document surface (AC20-AC32).
//
// This replaces three independent file pickers, each re-picking the same file, with one document
// you open and then act on. The tool's three original verbs were traced in Task 1 to Epic 6's
// one-line description and found to have no decision behind them; delete, rotate and reorder are
// added because they are near-free once a selection model exists.
//
// The view has exactly THREE mutually-exclusive states, and they are states of one surface rather
// than tabs (AC24): resting (no document), document (one PDF open), and mergeQueue (several PDFs
// waiting to be joined). A tab strip would imply you can be in two at once, which you cannot.
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { PhArrowClockwise, PhArrowDown, PhArrowUp, PhTrash, PhX } from "@phosphor-icons/vue";
import AppButton from "../../components/AppButton.vue";
import { writeClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { useRegistryStore } from "../../stores/registry";
import { useSettingsStore } from "../../stores/settings";
import { useCopyFeedback } from "../../shell/useCopyFeedback";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import {
  clampPage,
  emptySelection,
  extendTo,
  isSelected,
  selectAll,
  selectOnly,
  togglePage,
  type PageSelection,
} from "./pageSelection";

const { t } = useI18n();
// AC54: the preview size persists via the settings store (AD-10), the same way every other
// per-tool preference does — `uuid.format*`, `hash.case`, `hash.encoding`. The Settings pane
// enumerates persisted keys from the store itself rather than a hardcoded list, so `pdf.previewSize`
// appears there with its own reset without touching that view (PRD INV-3).
const settings = useSettingsStore();
// AC33/AC37: the two shell-owned signals this view consumes — a dropped set of files, and a
// hand-off carrying a file from another tool. Both live in the registry store rather than being
// passed between views, because AD-6 forbids a tool reading another tool's state.
const registry = useRegistryStore();

type TextLayer = "scanned" | "partial" | "empty";

interface DocumentInfo {
  pageCount: number;
  textLayer: TextLayer;
  canRenderPreviews: boolean;
}

interface PageText {
  page: number;
  text: string | null;
}

interface PagePreview {
  page: number;
  pngBase64: string;
}

interface PageRow {
  page: number;
  /** `null` = not fetched yet; `""` = fetched and genuinely blank; a string = the page's text. */
  text: string | null | undefined;
  thumbnail: string | undefined;
}

// AC45: pages are fetched in bounded batches as they are scrolled to, never all at once. At four
// hundred pages the whole-document fetch is the thing that would blow AD-15's IPC ceiling — not
// any single thumbnail, but the volume of them.
const PAGE_BATCH = 24;

/**
 * AC54: the CSS width of a grid cell at each size step, matching `.page-grid.size-*`'s track
 * minimum. Declared here as well as in CSS because the renderer has to be told how big to draw —
 * and the two must agree or the preview is either soft or wastefully large.
 */
const CELL_CSS_WIDTH = { s: 104, m: 148, l: 208 } as const;

/**
 * AC55: how wide to render a preview, in **device pixels**.
 *
 * This is the fix for previews that looked soft at the largest size step and fine at the smallest.
 * A CSS pixel is not a device pixel: on a 2x Retina display a 208px-wide cell is 416 real pixels,
 * so an image rendered 208 wide — let alone the old fixed 160 — is upscaled by the browser and
 * goes blurry. Small cells hid it because the upscale factor was near 1; the largest cell was
 * being stretched 2.6x, which is exactly where it became unreadable.
 *
 * `devicePixelRatio` is read live rather than captured once: moving the window between a Retina
 * laptop display and an external 1x monitor changes it, and a preview rendered for the wrong one
 * is the same bug in the other direction.
 */
const previewPixelWidth = computed(() => {
  const css = CELL_CSS_WIDTH[settings.pdfPreviewSize];
  const ratio = typeof window === "undefined" ? 1 : (window.devicePixelRatio || 1);
  return Math.round(css * ratio);
});

// AC32: AD-16's rule is ONE RUNNER PER INDEPENDENT PIECE OF STATE, and this view has two. The
// previous single `runPdf` was carried forward from a shared view that no longer exists, and its
// in-file rationale argued against reusing a `bucket` runner and superseding an in-flight OCR
// extraction — neither of which exists after Story 8.7 deleted them. Re-derived rather than
// inherited:
//
//   `runDocument` fences reads of the open document (open, page text, previews).
//   `runWrite`    fences operations that produce a file (extract/delete/rotate/reorder/merge).
//
// They must be separate because a page-text batch landing while a save is in flight must not mark
// the save superseded, nor the reverse — they are genuinely independent state, and one runner
// across both would let a scroll cancel a save.
//
// AD-16's amendment also binds: a runner fences against a newer REQUEST, not newer INPUT, so any
// task publishing derived state re-checks that its snapshot still matches the live document
// before writing it back (see `loadPageBatch`).
const runDocument = createLatestWinsRunner();
const runWrite = createLatestWinsRunner();

// AC52 — the editing model, corrected at the slice-4 render review.
//
// The first build made every page verb prompt for a save location, which the developer rejected
// on sight: *"if I select a page and click rotate, it prompts me to save the file instead of just
// rotating the page."* That was the old three-flow export model wearing the new surface's clothes
// — and worse, the page list never changed afterwards, so the tool looked broken even when the
// operation had succeeded.
//
// Corrected shape, which is what "open a document and act on it" has to mean:
//
//   `documentPath` — the file the user opened. NEVER written to.
//   `workingPath`  — a copy in the app's temp dir, created lazily on the FIRST edit. Every page
//                    verb reads it and writes it back, then the page list reloads from it, so the
//                    change is visible immediately.
//   `dirty`        — whether the working copy has diverged from the original, i.e. whether there
//                    is anything to save.
//
// The split that decides whether a verb prompts: a verb that EDITS this document (rotate, delete,
// move) applies in place and prompts for nothing. A verb that PRODUCES A NEW FILE (extract to new
// PDF, merge) genuinely needs a destination and keeps its dialog. "Save a copy…" is the one place
// the edited document leaves the app.
const documentPath = ref<string | null>(null);
const workingPath = ref<string | null>(null);
const dirty = ref(false);
const info = ref<DocumentInfo | null>(null);
const rows = ref<PageRow[]>([]);
const loadedThrough = ref(0);
const opening = ref(false);
const working = ref(false);

// AC31: errors are scoped to the operation that raised them. A single shared ref meant an error
// from merge was silently cleared by an unrelated click in another flow — the user's only signal
// that something failed, wiped by an action that had nothing to do with it.
const documentError = ref<ToolError | null>(null);
const operationError = ref<ToolError | null>(null);

// AC29/AC30: what the live region announces. Start and completion are exposed to assistive tech
// as an announced status, not only indicated visually — EXPERIENCE.md states this as the general
// rule, not an OCR-only exception.
const announcement = ref("");

const selection = ref<PageSelection>(emptySelection());
const focusedPage = ref(1);
const listRef = useTemplateRef<HTMLElement>("pageList");

const extractedText = ref("");
const textShown = ref(false);

let nextQueueId = 0;
const mergeQueue = ref<{ id: number; path: string; pageCount: number | null }[]>([]);

const { isCopied, markCopied, cancel: cancelCopyFeedback } = useCopyFeedback();
onUnmounted(() => {
  cancelCopyFeedback();
  observer?.disconnect();
});

// A function, not a module-level const: these render in the OS's native file-picker dialog, so
// the label must reflect the CURRENT locale at the moment the dialog opens — a plain const
// captured at component-creation time would go stale if the user switches language without
// navigating away from this view.
function pdfFilters() {
  return [{ name: t("tools.pdf.pdfFilterName"), extensions: ["pdf"] }];
}

// AC25: only the basename reaches the screen; the absolute path stays available via `title`.
// `CLAUDE.md` treats `/Users/<name>/…` as personally-identifying and this repo enforces that on
// its own commits — a public-portfolio app must not print it in a screenshot of itself. Splits on
// BOTH separators: a Windows path has no forward slash and would otherwise render whole.
function basename(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] || path;
}

/**
 * AC22/NFR5: the cell's accessible name.
 *
 * The grid shows a bare page number — repeating the word "Page" twenty-four times is visual noise
 * once the previews carry the meaning. But a screen reader announcing *"1, Heading 1"* is worse
 * than the list it replaced, so the full name is supplied here rather than lost with the label.
 * At the smallest size step the text label is also visually hidden, and this is then the only
 * place that text survives at all.
 */
function pageAccessibleName(row: PageRow): string {
  const label = t("tools.pdf.pageLabel", { number: row.page });
  if (row.text === null) return `${label} — ${t("tools.pdf.pageTextUnreadable")}`;
  const firstLine = (row.text ?? "").trim().split("\n")[0];
  return firstLine ? `${label} — ${firstLine}` : label;
}

const mode = computed<"resting" | "document" | "mergeQueue">(() => {
  if (mergeQueue.value.length > 0) return "mergeQueue";
  if (documentPath.value !== null) return "document";
  return "resting";
});

const hasSelection = computed(() => selection.value.pages.length > 0);

/**
 * The file every read and every edit actually addresses: the working copy once one exists, the
 * user's original before that. Nothing else in this view should reach for `documentPath` except
 * to display its name — reading the original after an edit would show pre-edit pages.
 */
const livePath = computed(() => workingPath.value ?? documentPath.value);

/**
 * Takes the working copy on first use. Every later edit reuses it, so the cost is paid once per
 * document rather than once per verb.
 */
async function ensureWorkingCopy(): Promise<string | null> {
  if (workingPath.value !== null) return workingPath.value;
  const original = documentPath.value;
  if (original === null) return null;
  const created = await invoke<string>("pdf_begin_edit", { path: original });
  workingPath.value = created;
  return created;
}

/** Re-reads the document after an edit so the page list shows what actually changed. */
async function reloadPages() {
  const path = livePath.value;
  if (path === null) return;
  const result = await runDocument(() => invoke<DocumentInfo>("pdf_open", { path }));
  if (result.superseded) return;
  info.value = result.value;
  rows.value = Array.from({ length: result.value.pageCount }, (_, index) => ({
    page: index + 1,
    text: undefined,
    thumbnail: undefined,
  }));
  loadedThrough.value = 0;
  // A selection kept across an edit points at rows that may no longer be the same pages — after a
  // delete every later page shifts down, after a reorder they move outright. Clearing is the
  // honest answer; silently keeping stale page numbers is how the next verb acts on the wrong
  // pages.
  selection.value = emptySelection();
  focusedPage.value = clampPage(focusedPage.value, result.value.pageCount);
  await loadPageBatch();
}

function resetDocument() {
  documentPath.value = null;
  workingPath.value = null;
  dirty.value = false;
  info.value = null;
  rows.value = [];
  loadedThrough.value = 0;
  selection.value = emptySelection();
  focusedPage.value = 1;
  extractedText.value = "";
  textShown.value = false;
  documentError.value = null;
  operationError.value = null;
}

async function openDocument(path: string) {
  resetDocument();
  opening.value = true;
  announcement.value = t("tools.pdf.opening");
  try {
    const result = await runDocument(() => invoke<DocumentInfo>("pdf_open", { path }));
    if (result.superseded) return;

    documentPath.value = path;
    info.value = result.value;
    rows.value = Array.from({ length: result.value.pageCount }, (_, index) => ({
      page: index + 1,
      text: undefined,
      thumbnail: undefined,
    }));
    announcement.value = t("tools.pdf.pageCount", result.value.pageCount);
    await loadPageBatch();
  } catch (err) {
    documentError.value = toToolError(err);
  } finally {
    opening.value = false;
  }
}

/**
 * Fetches text — and previews where the platform has a renderer — for the next bounded batch of
 * pages (AC45).
 */
async function loadPageBatch() {
  const total = info.value?.pageCount ?? 0;
  if (loadedThrough.value >= total) return;

  const path = livePath.value;
  if (path === null) return;

  const from = loadedThrough.value + 1;
  const to = Math.min(from + PAGE_BATCH - 1, total);
  const pageNumbers = Array.from({ length: to - from + 1 }, (_, index) => from + index);
  loadedThrough.value = to;

  try {
    const texts = await runDocument(() =>
      invoke<PageText[]>("pdf_page_text", { path, pageNumbers }),
    );
    // AD-16's amendment: the runner fences a newer REQUEST, but the document may also have been
    // closed or replaced while this was in flight. Re-check the snapshot before writing derived
    // state back, or a batch from the previous document lands in the current one's rows.
    if (texts.superseded || livePath.value !== path) return;
    for (const entry of texts.value) {
      const row = rows.value[entry.page - 1];
      if (row) row.text = entry.text;
    }

    if (!info.value?.canRenderPreviews) return;

    const previews = await runDocument(() =>
      invoke<PagePreview[]>("pdf_render_pages", { path, pageNumbers, maxWidth: previewPixelWidth.value }),
    );
    if (previews.superseded || livePath.value !== path) return;
    for (const entry of previews.value) {
      const row = rows.value[entry.page - 1];
      if (row) row.thumbnail = `data:image/png;base64,${entry.pngBase64}`;
    }
  } catch (err) {
    documentError.value = toToolError(err);
  }
}

/**
 * AC55: re-renders the previews already on screen when the size step changes.
 *
 * Without this, switching S -> L keeps the small images and simply stretches them — which is the
 * blur this AC exists to remove, reintroduced by the control meant to fix it. Only previews are
 * re-fetched: the page text is resolution-independent and re-requesting it would be pure waste.
 *
 * Chunked rather than one call for the whole loaded range, because "already loaded" can be two
 * hundred pages by the time someone changes their mind about density.
 */
async function reloadPreviews() {
  const path = livePath.value;
  if (path === null || !info.value?.canRenderPreviews) return;

  const through = loadedThrough.value;
  const width = previewPixelWidth.value;
  for (const row of rows.value) row.thumbnail = undefined;

  for (let from = 1; from <= through; from += PAGE_BATCH) {
    const to = Math.min(from + PAGE_BATCH - 1, through);
    const pageNumbers = Array.from({ length: to - from + 1 }, (_, index) => from + index);
    try {
      const previews = await runDocument(() =>
        invoke<PagePreview[]>("pdf_render_pages", { path, pageNumbers, maxWidth: width }),
      );
      // Bail out wholesale if anything moved under us — a newer size, a different document, or a
      // newer request. Writing a stale batch back would leave a grid of mixed resolutions.
      if (previews.superseded || livePath.value !== path || previewPixelWidth.value !== width) {
        return;
      }
      for (const entry of previews.value) {
        const row = rows.value[entry.page - 1];
        if (row) row.thumbnail = `data:image/png;base64,${entry.pngBase64}`;
      }
    } catch (err) {
      documentError.value = toToolError(err);
      return;
    }
  }
}

watch(previewPixelWidth, () => {
  void reloadPreviews();
});

// AC45: the sentinel below the last rendered row asks for the next batch as it scrolls into view.
// Guarded rather than assumed — jsdom implements no IntersectionObserver, and a view that throws
// on mount in the test environment is a view nobody can test.
let observer: IntersectionObserver | null = null;
function attachSentinel(element: Element | null) {
  observer?.disconnect();
  observer = null;
  if (!element || typeof IntersectionObserver === "undefined") return;
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) void loadPageBatch();
  });
  observer.observe(element);
}

async function onChoosePdfs() {
  documentError.value = null;
  try {
    const picked = await open({ multiple: true, filters: pdfFilters() });
    if (picked === null) return;
    await acceptPaths(Array.isArray(picked) ? picked : [picked]);
  } catch (err) {
    documentError.value = toToolError(err);
  }
}

/**
 * The single entry point for "some PDFs arrived", whether from the picker or (once AC33-AC35 land)
 * from a drop. One file opens it; several start a merge queue — which is why the resting surface
 * can say "drop several to merge them" and mean it.
 */
async function acceptPaths(paths: string[], known?: Map<string, number>) {
  if (paths.length === 0) return;
  if (paths.length === 1 && mergeQueue.value.length === 0) {
    await openDocument(paths[0]);
    return;
  }
  const existing = documentPath.value;
  resetDocument();
  const incoming = existing !== null ? [existing, ...paths] : paths;
  mergeQueue.value.push(
    ...incoming.map((path) => ({
      id: (nextQueueId += 1),
      path,
      // A drop already learned every page count in one round trip (`pdf_open_dropped`), so the
      // per-file loop below is skipped entirely on that path. The picker path has no such
      // result and still fetches.
      pageCount: known?.get(path) ?? null,
    })),
  );
  void loadQueuePageCounts();
}

// AC33/AC34: the drop path. The shell dispatches `pdf_open_dropped` and publishes the result;
// this view decides what the drop MEANS — one file opens it, several start a merge queue —
// which is the same decision `acceptPaths` makes for the picker, deliberately not a second one.
//
// AD-6 holds: the view never reaches into the shell or another tool. It reads two registry
// signals, which is the same shape `HashView` and `OcrView` already use.
watch(
  () => registry.dropResult,
  async (result) => {
    if (!result || result.toolId !== "pdf") return;
    registry.dropResult = null;
    if ("error" in result) {
      documentError.value = result.error;
      return;
    }
    const opened = result.value as { path: string; pageCount: number }[];
    const known = new Map(opened.map((entry) => [entry.path, entry.pageCount]));
    await acceptPaths(
      opened.map((entry) => entry.path),
      known,
    );
  },
);

// AC37: the third hand-off from Story 8.7. A PDF dropped on Image to Text now offers to open it
// HERE, carrying the file — so accepting lands on a loaded document rather than an empty view
// demanding the user re-pick the file they just dropped. The mechanism is shell-owned (AD-6:
// neither tool reads the other's state) — a one-shot signal in the registry store, published
// before the route change and consumed on mount, the same shape `dropSourcePath` already uses.
watch(
  () => registry.handOffPath,
  async (handOff) => {
    if (!handOff || handOff.toolId !== "pdf") return;
    registry.handOffPath = null;
    await acceptPaths([handOff.path]);
  },
  { immediate: true },
);

/** AC24: the queue lists each document by basename WITH its page count, so the order being set is
 *  an informed one rather than a list of filenames. */
async function loadQueuePageCounts() {
  for (const entry of mergeQueue.value) {
    if (entry.pageCount !== null) continue;
    try {
      const result = await invoke<DocumentInfo>("pdf_open", { path: entry.path });
      entry.pageCount = result.pageCount;
    } catch {
      // A queue entry whose page count cannot be read still merges — the count is a courtesy, and
      // failing the whole queue over it would be worse than showing one row without a number.
      entry.pageCount = null;
    }
  }
}

function moveQueueEntry(index: number, delta: number) {
  operationError.value = null;
  const target = index + delta;
  const queue = mergeQueue.value;
  if (target < 0 || target >= queue.length) return;
  [queue[index], queue[target]] = [queue[target], queue[index]];
}

function removeQueueEntry(index: number) {
  operationError.value = null;
  mergeQueue.value.splice(index, 1);
}

function clearQueue() {
  mergeQueue.value = [];
  operationError.value = null;
}

// ---- selection & keyboard (AC22) ----

function onRowClick(page: number, event: MouseEvent) {
  focusedPage.value = page;
  if (event.shiftKey) {
    selection.value = extendTo(selection.value, page);
  } else if (event.metaKey || event.ctrlKey) {
    selection.value = togglePage(selection.value, page);
  } else {
    selection.value = selectOnly(page);
  }
  announceSelection();
}

async function focusRow(page: number) {
  focusedPage.value = page;
  await nextTick();
  const element = listRef.value?.querySelector<HTMLElement>(`[data-page="${page}"]`);
  element?.focus();
  // Arrowing to the end of the loaded range is exactly when the next batch is wanted, and a
  // keyboard user may never scroll — so focus movement asks too, not just the scroll sentinel.
  if (page >= loadedThrough.value) void loadPageBatch();
}

function onListKeydown(event: KeyboardEvent) {
  const total = info.value?.pageCount ?? 0;
  if (total === 0) return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const next = clampPage(focusedPage.value + (event.key === "ArrowDown" ? 1 : -1), total);
    if (event.shiftKey) {
      selection.value = extendTo(
        selection.value.anchor === null ? selectOnly(focusedPage.value) : selection.value,
        next,
      );
      announceSelection();
    }
    void focusRow(next);
    return;
  }

  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    selection.value = togglePage(selection.value, focusedPage.value);
    announceSelection();
    return;
  }

  if (event.key.toLowerCase() === "a" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    selection.value = selectAll(total);
    announceSelection();
  }
}

function announceSelection() {
  const count = selection.value.pages.length;
  announcement.value = count === 0 ? "" : t("tools.pdf.selectedCount", count);
}

// ---- verbs ----

/** Shared shape for every write: fence on `runWrite`, report per-operation, and say what happened
 *  by basename when a file is produced (AC29/AC30/AC31). */
async function runWriteOperation(command: string, args: Record<string, unknown>, outputPath: string) {
  operationError.value = null;
  working.value = true;
  announcement.value = t("tools.pdf.workingOnIt");
  try {
    const result = await runWrite(() => invoke(command, { ...args, outputPath }));
    if (result.superseded) return false;
    // AC30: merge and extract-pages used to write a file and say nothing at all — the user's only
    // evidence was opening Finder.
    announcement.value = t("tools.pdf.savedFile", { name: basename(outputPath) });
    return true;
  } catch (err) {
    operationError.value = toToolError(err);
    return false;
  } finally {
    working.value = false;
  }
}

async function askWherePdfGoes(): Promise<string | null> {
  try {
    return await save({ filters: pdfFilters() });
  } catch (err) {
    operationError.value = toToolError(err);
    return null;
  }
}

async function onExtractSelection() {
  if (!documentPath.value || !hasSelection.value) return;
  const pages = selection.value.pages;
  const outputPath = await askWherePdfGoes();
  if (outputPath === null) return;
  await runWriteOperation(
    "pdf_extract_pages",
    { path: livePath.value, startPage: pages[0], endPage: pages[pages.length - 1] },
    outputPath,
  );
}

/**
 * AC52: applies an edit to the working copy IN PLACE and reloads the page list, so the change is
 * visible immediately and nothing is asked of the user.
 *
 * Reading and writing the same path is safe: the command reads the file completely before it
 * writes, and `fs_helper::write_file_bytes` writes to a temp file and renames — so a failure
 * partway through cannot leave the working copy truncated.
 */
async function applyEdit(command: string, args: Record<string, unknown>) {
  if (!documentPath.value || !hasSelection.value) return;
  operationError.value = null;
  working.value = true;
  announcement.value = t("tools.pdf.workingOnIt");
  try {
    const path = await ensureWorkingCopy();
    if (path === null) return;
    const result = await runWrite(() => invoke(command, { ...args, path, outputPath: path }));
    if (result.superseded) return;
    dirty.value = true;
    await reloadPages();
    announcement.value = t("tools.pdf.editApplied");
  } catch (err) {
    operationError.value = toToolError(err);
  } finally {
    working.value = false;
  }
}

async function onRotateSelection() {
  await applyEdit("pdf_rotate_pages", {
    pageNumbers: selection.value.pages,
    quarterTurns: 1,
  });
}

async function onDeleteSelection() {
  await applyEdit("pdf_delete_pages", { pageNumbers: selection.value.pages });
}

async function onMoveSelection(delta: number) {
  const total = info.value?.pageCount ?? 0;
  if (!hasSelection.value || total === 0) return;

  const moving = new Set(selection.value.pages);
  const order: number[] = [];
  for (let page = 1; page <= total; page += 1) if (!moving.has(page)) order.push(page);
  // Insert the moved block at its shifted position, keeping the block's own internal order —
  // moving three pages must keep those three adjacent and in sequence.
  const anchorIndex = clampPage(Math.min(...selection.value.pages) + delta, total) - 1;
  order.splice(Math.max(anchorIndex, 0), 0, ...selection.value.pages);

  await applyEdit("pdf_reorder_pages", { newOrder: order });
}

/** AC52: the one place an edited document leaves the app. The original is never overwritten —
 *  "save a copy", not "save", because the user opened a file they did not ask us to modify. */
async function onSaveCopy() {
  const path = livePath.value;
  if (path === null || !dirty.value) return;
  const outputPath = await askWherePdfGoes();
  if (outputPath === null) return;
  if (await runWriteOperation("pdf_save_copy", { path }, outputPath)) {
    dirty.value = false;
  }
}

async function onMergeQueue() {
  if (mergeQueue.value.length < 2) return;
  const outputPath = await askWherePdfGoes();
  if (outputPath === null) return;
  const merged = await runWriteOperation(
    "pdf_merge",
    { paths: mergeQueue.value.map((entry) => entry.path) },
    outputPath,
  );
  if (merged) mergeQueue.value = [];
}

async function onReadText() {
  if (!documentPath.value) return;
  documentError.value = null;
  working.value = true;
  announcement.value = t("tools.pdf.workingOnIt");
  try {
    const result = await runDocument(() =>
      invoke<string>("pdf_extract_text", { path: livePath.value }),
    );
    if (result.superseded) return;
    extractedText.value = result.value;
    textShown.value = true;
  } catch (err) {
    documentError.value = toToolError(err);
  } finally {
    working.value = false;
  }
}

async function onCopyText() {
  documentError.value = null;
  try {
    await writeClipboardText(extractedText.value);
    markCopied("extracted-text");
  } catch (err) {
    documentError.value = toToolError(err);
  }
}
</script>

<template>
  <section class="pdf-section">
    <h1>{{ t('tools.pdf.pdfSectionHeading') }}</h1>

    <!-- AC29: one live region for the whole view. Start and completion of every unbounded
         operation are announced, not only shown — EXPERIENCE.md's general rule. -->
    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </p>

    <!-- AC20: ONE resting surface. The three independent file pickers are gone; a dashed drop
         target carries the drop language HashView and OcrView established, and the sentence
         states plainly that several PDFs merge. -->
    <div
      v-if="mode === 'resting'"
      class="drop-target"
    >
      <p class="drop-label">
        {{ t('tools.pdf.dropLabel') }}
      </p>
      <AppButton @click="onChoosePdfs">
        {{ t('tools.pdf.openDocument') }}
      </AppButton>
      <p class="drop-hint">
        {{ t('tools.pdf.dropHint') }}
      </p>
      <p
        v-if="documentError"
        class="error"
        role="alert"
      >
        {{ toolErrorMessage(documentError, t) }}
      </p>
    </div>

    <!-- AC24: the merge queue is a mutually-exclusive STATE of this same view — not a tab, and
         not a second surface. -->
    <div
      v-else-if="mode === 'mergeQueue'"
      class="panel"
    >
      <div class="panel-head">
        <h2>{{ t('tools.pdf.mergeQueueHeading') }}</h2>
        <button
          type="button"
          class="ghost"
          :aria-label="t('tools.pdf.clearQueue')"
          :title="t('tools.pdf.clearQueue')"
          @click="clearQueue"
        >
          <PhX aria-hidden="true" />
        </button>
      </div>
      <p class="hint">
        {{ t('tools.pdf.mergeQueueHint') }}
      </p>

      <TransitionGroup
        tag="ul"
        name="reorder"
        class="file-list"
      >
        <li
          v-for="(entry, index) in mergeQueue"
          :key="entry.id"
        >
          <span
            class="file-name"
            :title="entry.path"
          >{{ basename(entry.path) }}</span>
          <span
            v-if="entry.pageCount !== null"
            class="chip"
          >{{ t('tools.pdf.pageCount', entry.pageCount) }}</span>
          <button
            type="button"
            class="ghost"
            :disabled="index === 0"
            :aria-label="t('tools.pdf.moveUp')"
            :title="t('tools.pdf.moveUp')"
            @click="moveQueueEntry(index, -1)"
          >
            <PhArrowUp aria-hidden="true" />
          </button>
          <button
            type="button"
            class="ghost"
            :disabled="index === mergeQueue.length - 1"
            :aria-label="t('tools.pdf.moveDown')"
            :title="t('tools.pdf.moveDown')"
            @click="moveQueueEntry(index, 1)"
          >
            <PhArrowDown aria-hidden="true" />
          </button>
          <!-- DESIGN.md:149 — removing from a merge queue before merging is low-stakes and
               trivially reversible, so it takes the Default (black) treatment, NOT destructive
               red. Not re-derived here. -->
          <AppButton
            variant="default"
            @click="removeQueueEntry(index)"
          >
            {{ t('tools.pdf.remove') }}
          </AppButton>
        </li>
      </TransitionGroup>

      <div class="verb-bar">
        <AppButton @click="onChoosePdfs">
          {{ t('tools.pdf.addMorePdfs') }}
        </AppButton>
        <!-- DESIGN.md:183 names "Merge PDFs" as the worked example of the Primary/Signature
             variant, one per screen at most. This is that one. -->
        <AppButton
          variant="primary"
          :disabled="mergeQueue.length < 2 || working"
          @click="onMergeQueue"
        >
          {{ t('tools.pdf.mergePdfs') }}
        </AppButton>
        <span
          v-if="working"
          class="hint"
        >{{ t('tools.pdf.workingOnIt') }}</span>
      </div>

      <p
        v-if="operationError"
        class="error"
        role="alert"
      >
        {{ toolErrorMessage(operationError, t) }}
      </p>
    </div>

    <!-- AC21: the open document — basename, page count, and a list of its pages. -->
    <div
      v-else
      class="panel"
    >
      <div class="panel-head">
        <h2
          class="doc-name"
          :title="documentPath ?? ''"
        >
          {{ basename(documentPath ?? '') }}
        </h2>
        <span
          v-if="info"
          class="chip"
        >{{ t('tools.pdf.pageCount', info.pageCount) }}</span>
        <!-- AC52: edits live in a working copy, so there is exactly one place the edited document
             leaves the app — and it is "save a COPY", because the user opened a file they never
             asked us to overwrite. The button appears only once there is something to save. -->
        <AppButton
          v-if="dirty"
          variant="primary"
          :disabled="working"
          @click="onSaveCopy"
        >
          {{ t('tools.pdf.saveCopy') }}
        </AppButton>
        <button
          type="button"
          class="ghost"
          :aria-label="t('tools.pdf.closeDocument')"
          :title="t('tools.pdf.closeDocument')"
          @click="resetDocument"
        >
          <PhX aria-hidden="true" />
        </button>
      </div>

      <p
        v-if="opening"
        class="hint"
      >
        {{ t('tools.pdf.opening') }}
      </p>

      <!-- AC40: the honest scan message. "No text was found" is true and useless for a page
           whose text is visibly present as pixels. Page operations stay available. -->
      <p
        v-if="info?.textLayer === 'scanned'"
        class="notice"
      >
        {{ t('tools.pdf.scannedNotice') }}
      </p>
      <p
        v-else-if="info?.textLayer === 'empty'"
        class="notice"
      >
        {{ t('tools.pdf.emptyNotice') }}
      </p>

      <!-- AC46: says why, rather than showing a row of frames that never fill. -->
      <p
        v-if="info && !info.canRenderPreviews"
        class="notice"
      >
        {{ t('tools.pdf.previewsUnavailable') }}
      </p>

      <p
        v-if="documentError"
        class="error"
        role="alert"
      >
        {{ toolErrorMessage(documentError, t) }}
      </p>

      <!-- AC54: three named density steps rather than a slider. A slider persists a pixel value
           nobody chose deliberately, and the grid only has three densities worth having. -->
      <div
        v-if="info && info.pageCount > 0"
        class="size-control"
        role="group"
        :aria-label="t('tools.pdf.previewSizeLabel')"
      >
        <span class="hint">{{ t('tools.pdf.previewSizeLabel') }}</span>
        <button
          v-for="option in ['s', 'm', 'l'] as const"
          :key="option"
          type="button"
          class="size-option"
          :aria-pressed="settings.pdfPreviewSize === option"
          @click="settings.setPdfPreviewSize(option)"
        >
          {{ t(`tools.pdf.previewSize.${option}`) }}
        </button>
      </div>

      <!-- AC21/AC54: a GRID, not a vertical list. The list spent 48px of a 1100px-wide window on
           the one thing that helps you recognise a page and left the rest empty; a grid spends
           the whole width on previews, so twenty-four pages are a glance instead of a scroll.
           AC22: still a real listbox — arrow keys move focus, Space toggles, Shift extends,
           Cmd/Ctrl-A selects all — and the keydown handler is scoped to this element rather than
           to `window`, so no AD-14 document-level listener is introduced at all. -->
      <ul
        v-if="info && info.pageCount > 0"
        ref="pageList"
        class="page-grid"
        :class="`size-${settings.pdfPreviewSize}`"
        role="listbox"
        aria-multiselectable="true"
        :aria-label="t('tools.pdf.pdfSectionHeading')"
        @keydown="onListKeydown"
      >
        <li
          v-for="row in rows"
          :key="row.page"
          :data-page="row.page"
          class="page-cell"
          :class="{ selected: isSelected(selection, row.page) }"
          role="option"
          :aria-selected="isSelected(selection, row.page)"
          :aria-label="pageAccessibleName(row)"
          :tabindex="row.page === focusedPage ? 0 : -1"
          @click="onRowClick(row.page, $event)"
          @focus="focusedPage = row.page"
        >
          <img
            v-if="row.thumbnail"
            class="thumb"
            :src="row.thumbnail"
            alt=""
          >
          <span
            v-else
            class="thumb thumb-placeholder"
            aria-hidden="true"
          />
          <span class="cell-caption">
            <span class="page-number">{{ row.page }}</span>
            <!-- AC21: the text label is KEPT under the thumbnail. A heading you can read beats a
                 picture of one, and it is what the cell degrades to with no renderer. -->
            <span class="page-text">
              <template v-if="row.text === null">{{ t('tools.pdf.pageTextUnreadable') }}</template>
              <template v-else>{{ (row.text ?? '').trim().split('\n')[0] }}</template>
            </span>
          </span>
        </li>
        <li
          :ref="(el) => attachSentinel(el as Element | null)"
          class="sentinel"
          aria-hidden="true"
        />
      </ul>

      <!-- AC23: the verb bar acts on the selection, and shows document-scoped actions when
           nothing is selected. -->
      <div class="verb-bar">
        <template v-if="hasSelection">
          <span class="hint">{{ t('tools.pdf.selectedCount', selection.pages.length) }}</span>
          <AppButton
            :disabled="working"
            @click="onExtractSelection"
          >
            {{ t('tools.pdf.extractSelection') }}
          </AppButton>
          <AppButton
            :disabled="working"
            @click="onRotateSelection"
          >
            <PhArrowClockwise
              class="inline-icon"
              aria-hidden="true"
            />
            {{ t('tools.pdf.rotate') }}
          </AppButton>
          <AppButton
            :disabled="working"
            @click="onMoveSelection(-1)"
          >
            {{ t('tools.pdf.moveUp') }}
          </AppButton>
          <AppButton
            :disabled="working"
            @click="onMoveSelection(1)"
          >
            {{ t('tools.pdf.moveDown') }}
          </AppButton>
          <!-- DESIGN.md:149 again: Default (black), never destructive red. Removing pages before
               saving is low-stakes and reversible — the original file is untouched. -->
          <AppButton
            variant="default"
            :disabled="working"
            @click="onDeleteSelection"
          >
            <PhTrash
              class="inline-icon"
              aria-hidden="true"
            />
            {{ t('tools.pdf.deletePages') }}
          </AppButton>
        </template>
        <template v-else>
          <span class="hint">{{ t('tools.pdf.noSelectionHint') }}</span>
          <AppButton
            :disabled="working"
            @click="onReadText"
          >
            {{ t('tools.pdf.readText') }}
          </AppButton>
          <AppButton
            :disabled="working"
            @click="onChoosePdfs"
          >
            {{ t('tools.pdf.mergeWith') }}
          </AppButton>
        </template>
        <span
          v-if="working"
          class="hint"
        >{{ t('tools.pdf.workingOnIt') }}</span>
      </div>

      <p
        v-if="operationError"
        class="error"
        role="alert"
      >
        {{ toolErrorMessage(operationError, t) }}
      </p>

      <!-- AC40: an empty read is the EXPECTED outcome for a scan and for a page-less document,
           and both already say so above. Repeating "No text was found" underneath would contradict
           the sentence next to it — and for a scan it is the exact phrasing AC40 exists to avoid,
           true and useless for text that is visibly present as pixels. The sentence keeps its job
           wherever it is genuinely informative. -->
      <p
        v-if="
          textShown &&
            !extractedText.trim() &&
            info?.textLayer !== 'scanned' &&
            info?.textLayer !== 'empty'
        "
        class="notice"
        role="status"
      >
        {{ t('tools.pdf.noTextInPdf') }}
      </p>

      <div
        v-if="extractedText"
        class="field"
      >
        <label for="pdf-extracted-text">{{ t('tools.pdf.extractedTextLabel') }}</label>
        <textarea
          id="pdf-extracted-text"
          v-model="extractedText"
          class="result"
          rows="10"
          spellcheck="false"
          autocorrect="off"
        />
        <AppButton @click="onCopyText">
          {{ isCopied('extracted-text') ? t('tools.pdf.copied') : t('common.copy') }}
        </AppButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* AC55: claims the window's real height rather than settling for a fixed slice of it.
   `.main-pane` is `flex: 1` inside a `height: 100vh` flex shell (`App.vue`), so there is genuine
   height here to take — the same claim `OcrView.vue` makes for its image. `min-height: 0` is what
   stops a flex item refusing to shrink below its content; without it the grid grows to fit every
   page and pushes the window into a second scrollbar instead of scrolling inside itself. */
.pdf-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
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

h2 {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  line-height: var(--font-label-line-height);
  margin: 0;
}

/* Standard clip pattern (cf. JwtView / HashView / CronView `.sr-only`). Hoisting it to a shared
   stylesheet is filed as issue #148 and is not this story's to do. */
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

/* AC20: HashView's/OcrView's dashed-box drop language, used LITERALLY — 8.5 established that the
   dashed box means *drop* and must not be borrowed as decoration. */
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

/* `flex: 1` + `min-height: 0`: the panel takes whatever the heading leaves and no more, and the
   grid inside it scrolls rather than the page. The merge queue uses the same panel and is short,
   so `justify-content` is not set — a short panel sits at its natural height at the top. */
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  flex: 1;
  min-height: 0;
  padding: var(--spacing-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-lg);
}

.panel-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.doc-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-head .ghost {
  margin-left: auto;
}

.chip {
  flex: 0 0 auto;
  padding: var(--spacing-0-5) var(--spacing-2);
  background: var(--color-accent-neutral-chip);
  border-radius: var(--radius-full);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
}

.notice {
  margin: 0;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-text-secondary);
}

.error {
  margin: 0;
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  color: var(--color-accent-destructive);
}

.file-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  margin: 0;
  padding: 0;
}

/* AC54: the three density steps. `auto-fill` with a min track means the column count follows the
   window rather than being fixed, so the grid stays full-width at every size without a breakpoint
   per step. The 2px padding is not decoration — it is room for the selected cell's outline ring,
   which would otherwise be clipped by `overflow-y: auto` on the first and last rows. */
.page-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--cell-width), 1fr));
  align-content: start;
  gap: var(--spacing-4);
  margin: 0;
  padding: 2px;
  /* Takes the height the panel has left instead of a fixed 520px slice of it — on a laptop that
     was roughly half the window spent on nothing. `min-height` keeps it usable when the extracted
     text panel is also open and competing for the same space. `align-content: start` stops a
     single row of cells stretching to fill the height it just claimed. */
  flex: 1 1 auto;
  min-height: 220px;
  overflow-y: auto;
}

.page-grid.size-s {
  --cell-width: 104px;
}

.page-grid.size-m {
  --cell-width: 148px;
}

.page-grid.size-l {
  --cell-width: 208px;
}

.size-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.size-control .hint {
  margin-right: var(--spacing-1);
}

.size-option {
  appearance: none;
  min-width: 28px;
  padding: var(--spacing-0-5) var(--spacing-2);
  background: none;
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-sm);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.size-option[aria-pressed="true"] {
  background: var(--color-bg-base);
  border-color: var(--color-accent-signature);
  color: var(--color-text-primary);
}

.size-option:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

/* Deliberately does NOT wrap. The row inherited `flex-wrap: wrap` from the pre-Epic-7 view,
   whose comment worried that French labels beside a filename would crowd a narrow window — but
   wrapping solves that by breaking the row's controls onto a second line, which reads as a second
   entry and makes the queue's order harder to follow, not easier. A real filename
   (`CourrierCaisse__0038_MTB23_SMB188_85073d94-…`) triggers it at any ordinary window width.
   The name absorbs the shrink instead and ellipsises; the full name stays on `title`. */
.file-list li {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--spacing-2);
}

/* `flex: 1 1 0`, not `1 1 auto`: with an `auto` basis the name claims its full intrinsic width
   first and only then shrinks, which is what lets a long name shove the controls out of the row
   before the ellipsis ever engages. A zero basis makes it take only what is left over. */
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

/* AC50 — reorder is legible or it is guesswork. Before this, rows changed places between one
   frame and the next: nothing said which file moved or where it went, and with names as alike as
   `invoice-2026-Q1.pdf` / `invoice-2026-Q2.pdf` the only way to find out was to re-read the list.
   Neither value is invented: the CURVE is the house curve for a sliding element, already driving
   the Base64 direction-switch thumb (`Base64View.vue:992`) — its start tangent is ~2.25 and its
   end tangent horizontal, i.e. it IS an ease-out, which is why the `ease-out` keyword is not also
   applied (an alternative value of the same property, it would replace this curve with a weaker
   one). The DURATION is the developer's render-review call, above the app's 120-140ms
   micro-feedback band and beside `OcrView.vue:969`'s `filter 320ms` — the house duration for a
   state CHANGE rather than a click acknowledgement. */
.reorder-move {
  transition: transform 310ms cubic-bezier(0.32, 0.72, 0, 1);
}

/* The convention AppPopover, Base64View, HashView, JsonTree, OcrView and UuidView already follow:
   the motion is an enhancement, and its absence is a supported outcome. */
@media (prefers-reduced-motion: reduce) {
  .reorder-move {
    transition: none;
  }
}

.page-cell {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  cursor: default;
}

.page-cell:focus-visible {
  outline: none;
}

/* The thumbnail carries selection and focus, not the cell box. A ring on the preview itself reads
   as "this page is chosen"; a box drawn around the caption as well would put the emphasis on the
   label rather than on the page. */
.thumb {
  width: 100%;
  aspect-ratio: 1 / 1.414;
  object-fit: contain;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-sm);
}

/* Selection is a ring AND a tinted caption, not colour alone — the same two-signal rule OcrView's
   confidence markers follow, so it survives a greyscale screenshot. */
.page-cell.selected .thumb {
  box-shadow: 0 0 0 3px var(--color-accent-signature);
  border-color: var(--color-accent-signature);
}

.page-cell:focus-visible .thumb {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
}

.cell-caption {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-1);
  min-width: 0;
}

.page-cell.selected .page-number {
  color: var(--color-accent-signature);
  font-weight: 600;
}

.page-number {
  flex: 0 0 auto;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}

/* `flex: 1 1 0`, not `1 1 auto`: an `auto` basis lets the label claim its full intrinsic width
   before shrinking, which pushes the page number out of a narrow cell instead of ellipsising. */
.page-text {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-primary);
}

/* At the smallest step the caption would take as much height as the preview it describes, so the
   label steps aside and the page number carries the cell. The text is still in the DOM for
   assistive tech — hidden visually, not removed. */
.page-grid.size-s .page-text {
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

.sentinel {
  height: 1px;
}

.verb-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-2);
}

.inline-icon {
  width: 13px;
  height: 13px;
  vertical-align: -2px;
  margin-right: var(--spacing-0-5);
}

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

.ghost:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.ghost:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.ghost:disabled {
  opacity: 0.4;
  cursor: default;
}

.field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-1);
}

.field label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

.result {
  width: 100%;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  line-height: var(--font-code-line-height);
  color: var(--color-text-primary);
  background: var(--color-bg-base);
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  padding: var(--spacing-3);
  resize: vertical;
}

.result:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}
</style>
