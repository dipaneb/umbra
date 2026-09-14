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
import { ask, open, save } from "@tauri-apps/plugin-dialog";
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

/**
 * One page of the open document.
 *
 * `id` is the row's IDENTITY and `page` is its current POSITION, and the two are separate on
 * purpose (code review 2026-09-13, AC51): an edit that moves or removes pages is applied to this
 * array locally — the row keeps its id, its text and its thumbnail, and only `page` is renumbered —
 * so the grid can animate a move instead of rebuilding every cell, and a move no longer blanks
 * twenty-four thumbnails and fetches them again.
 */
interface PageRow {
  id: number;
  page: number;
  /** `undefined` = not fetched yet; `null` = fetched and unreadable; a string = the page's text. */
  text: string | null | undefined;
  /** `undefined` = not fetched yet; `null` = the renderer could not draw it (AC46: text-only cell);
   *  a string = a `data:` URI. */
  thumbnail: string | null | undefined;
}

// AC45: pages are fetched in bounded batches as they scroll into view, never all at once. At four
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
 * AC55(b): `devicePixelRatio` is not reactive, so a computed that reads it once would go stale
 * when the window moves between a Retina display and a 1x monitor — which is exactly the case
 * the comment below promises to handle. The standard trick: listen for the `(resolution:)`
 * media query to stop matching, bump a counter the computed depends on, then listen again at
 * the new ratio (each query matches exactly one ratio, so it has to be re-armed after a change).
 */
const displayRatioTick = ref(0);
let displayRatioQuery: MediaQueryList | null = null;
function onDisplayRatioChange() {
  displayRatioTick.value += 1;
  armDisplayRatioListener();
}
function armDisplayRatioListener() {
  displayRatioQuery?.removeEventListener("change", onDisplayRatioChange);
  displayRatioQuery = null;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  displayRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  displayRatioQuery.addEventListener("change", onDisplayRatioChange);
}
armDisplayRatioListener();

/**
 * AC55: how wide to render a preview, in **device pixels**.
 *
 * This is the fix for previews that looked soft at the largest size step and fine at the smallest.
 * A CSS pixel is not a device pixel: on a 2x Retina display a 208px-wide cell is 416 real pixels,
 * so an image rendered 208 wide — let alone the old fixed 160 — is upscaled by the browser and
 * goes blurry. Small cells hid it because the upscale factor was near 1; the largest cell was
 * being stretched 2.6x, which is exactly where it became unreadable.
 *
 * `devicePixelRatio` is read live rather than captured once (see `displayRatioTick`): moving the
 * window between a Retina laptop display and an external 1x monitor changes it, and a preview
 * rendered for the wrong one is the same bug in the other direction.
 */
const previewPixelWidth = computed(() => {
  void displayRatioTick.value;
  const css = CELL_CSS_WIDTH[settings.pdfPreviewSize];
  const ratio = typeof window === "undefined" ? 1 : (window.devicePixelRatio || 1);
  return Math.round(css * ratio);
});

// AC32: AD-16's rule is ONE RUNNER PER INDEPENDENT PIECE OF STATE, and this view has two.
//
//   `runDocument` fences the two reads that DEFINE the open document — opening it, and reading
//                 its whole text.
//   `runWrite`    fences operations that produce a file (extract/delete/rotate/reorder/merge).
//
// They must be separate because a "Read text" landing while a save is in flight must not mark
// the save superseded, nor the reverse — they are genuinely independent state, and one runner
// across both would let one cancel the other.
//
// **Page batches are deliberately NOT on a runner** (code review 2026-09-13). A latest-wins
// runner answers "which REQUEST is newest?", and for a scroll-driven loader that is the wrong
// question: batch 2 arriving is no reason to throw batch 1 away — they are different pages. The
// first build put every batch on `runDocument`, and the observer firing for the next batch
// silently discarded the one in flight, whose rows were then never requested again. Batches
// are fenced by DOCUMENT IDENTITY instead (`generation`, below): a result is written back only if
// the document it was fetched for is still the one on screen. That is AD-16's amendment applied
// literally — re-check the snapshot before publishing derived state.
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
//   `workingPath`  — a copy in the app's cache dir, created lazily on the FIRST edit. Every page
//                    verb reads it and writes it back, then the page list is updated in place,
//                    so the change is visible immediately.
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
const opening = ref(false);
const working = ref(false);

/**
 * Which document the rows on screen belong to. Bumped by every open, reload and reset; every
 * batch captures it at request time and compares before writing back, so a result for a document
 * that has since been closed or replaced is dropped rather than landing in the new one's rows.
 */
let generation = 0;
let nextRowId = 0;

// AC31: errors are scoped to the operation that raised them. A single shared ref meant an error
// from merge was silently cleared by an unrelated click in another flow — the user's only signal
// that something failed, wiped by an action that had nothing to do with it.
const documentError = ref<ToolError | null>(null);
const operationError = ref<ToolError | null>(null);

// AC29/AC30: what the live region announces. Start and completion are exposed to assistive tech
// as an announced status, not only indicated visually — EXPERIENCE.md states this as the general
// rule, not an OCR-only exception.
const announcement = ref("");
// AC30's visible half (code review 2026-09-13): the same "Saved report.pdf" a screen reader hears
// is also SHOWN. The first build put it in the live region only, so a sighted user who extracted
// pages saw nothing change — the gap AC30 was written to close. Cleared when the next operation
// starts, so it never describes a previous action.
const completion = ref("");
let completionTimer: ReturnType<typeof setTimeout> | null = null;
// A few seconds, not indefinite (render review 2026-09-14): the developer's own read was that a
// confirmation that never goes away stops being a confirmation and starts being clutter — the
// same "briefly confirm, then get out of the way" shape `useCopyFeedback` already uses elsewhere
// in this app, just longer-lived (this names a whole file, not a button).
const COMPLETION_DURATION_MS = 4000;
function showCompletion(text: string) {
  if (completionTimer !== null) clearTimeout(completionTimer);
  completion.value = text;
  completionTimer = setTimeout(() => {
    completion.value = "";
    completionTimer = null;
  }, COMPLETION_DURATION_MS);
}
function clearCompletion() {
  if (completionTimer !== null) {
    clearTimeout(completionTimer);
    completionTimer = null;
  }
  completion.value = "";
}

const selection = ref<PageSelection>(emptySelection());
const focusedPage = ref(1);
// The grid is a `TransitionGroup` (AC51), so the template ref resolves to a component instance
// whose `$el` is the `<ul>` — never read `listRef.value` directly; go through `listElement()`.
const listRef = useTemplateRef<{ $el: HTMLElement } | HTMLElement>("pageList");
function listElement(): HTMLElement | null {
  const value = listRef.value;
  if (!value) return null;
  return "$el" in value ? value.$el : value;
}

const extractedText = ref("");
const textShown = ref(false);
// AC40: the "no text" notice keys on what the READ returned, not on the live textarea — editing
// the extracted text down to nothing must not make the view claim the document had none.
const readCameBackEmpty = ref(false);

let nextQueueId = 0;
/**
 * One merge-queue entry. `path` is what gets merged; `sourcePath` is what the user is shown
 * (basename on screen, full path on `title`). They differ for the open document, which merges
 * from its WORKING COPY so its edits are included — but is shown under the name the user opened.
 */
interface QueueEntry {
  id: number;
  path: string;
  sourcePath: string;
  pageCount: number | null;
  error: ToolError | null;
}
const mergeQueue = ref<QueueEntry[]>([]);

const { isCopied, markCopied, cancel: cancelCopyFeedback } = useCopyFeedback();
onUnmounted(() => {
  cancelCopyFeedback();
  clearCompletion();
  observer?.disconnect();
  displayRatioQuery?.removeEventListener("change", onDisplayRatioChange);
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
// The grid's move verbs are boundary-disabled like the queue's arrows: "Move up" with page 1
// selected is not an edit, and running it anyway used to take a working copy, set `dirty` and
// offer "Save a copy…" for a document that had not changed (code review 2026-09-13).
const canMoveUp = computed(() => hasSelection.value && Math.min(...selection.value.pages) > 1);
const canMoveDown = computed(
  () =>
    hasSelection.value &&
    Math.max(...selection.value.pages) < (info.value?.pageCount ?? 0),
);

// AC20: the shell publishes drag-over state; this view only decides whether it is the one being
// hovered — the same shape `OcrView` and `HashView` use.
const isDragOver = computed(() => registry.dragOverToolId === "pdf");

/**
 * The file every read and every edit actually addresses: the working copy once one exists, the
 * user's original before that. Nothing else in this view should reach for `documentPath` except
 * to display its name — reading the original after an edit would show pre-edit pages.
 */
const livePath = computed(() => workingPath.value ?? documentPath.value);

/**
 * Takes the working copy on first use. Every later edit reuses it, so the cost is paid once per
 * document rather than once per verb.
 *
 * Returns `null` if the document changed while the copy was being taken — a copy of A must never
 * become the working copy of B (code review 2026-09-13).
 */
async function ensureWorkingCopy(): Promise<string | null> {
  if (workingPath.value !== null) return workingPath.value;
  const original = documentPath.value;
  if (original === null) return null;
  const startedFor = generation;
  const created = await invoke<string>("pdf_begin_edit", { path: original });
  if (generation !== startedFor) return null;
  workingPath.value = created;
  return created;
}

function buildRows(pageCount: number): PageRow[] {
  return Array.from({ length: pageCount }, (_, index) => ({
    id: (nextRowId += 1),
    page: index + 1,
    text: undefined,
    thumbnail: undefined,
  }));
}

function resetDocument() {
  generation += 1;
  pendingPages.clear();
  // NULLED, not just disconnected (render review 2026-09-14): `observeUnloadedCells` does
  // `observer ??= new IntersectionObserver(..., { root: list })`, and `root` is captured ONCE, at
  // construction. Disconnecting alone leaves that instance alive with its `root` still pointing
  // at the FIRST document's now-unmounted `<ul>` — every element observed against a detached root
  // never reports an intersection, so a second document's previews and text never auto-load at
  // all (only an edit's own explicit `requestPages` call ever reaches them). Nulling forces the
  // next `observeUnloadedCells` to build a fresh observer against the grid that is actually live.
  observer?.disconnect();
  observer = null;
  documentPath.value = null;
  workingPath.value = null;
  dirty.value = false;
  info.value = null;
  rows.value = [];
  selection.value = emptySelection();
  focusedPage.value = 1;
  extractedText.value = "";
  textShown.value = false;
  readCameBackEmpty.value = false;
  documentError.value = null;
  operationError.value = null;
  completion.value = "";
}

/**
 * AC52 by way of the code review (2026-09-13): the one thing that must not happen silently is
 * losing edits. Every path that would discard a dirty working copy — closing, replacing by drop
 * or hand-off, opening another file — asks first. Returns whether it is safe to proceed.
 */
async function confirmDiscard(): Promise<boolean> {
  if (!dirty.value || documentPath.value === null) return true;
  return ask(t("tools.pdf.discardEditsQuestion", { name: basename(documentPath.value) }), {
    title: t("tools.pdf.unsavedChanges"),
    kind: "warning",
    okLabel: t("tools.pdf.discardEdits"),
    cancelLabel: t("tools.pdf.keepEditing"),
  });
}

async function onCloseDocument() {
  if (working.value) return;
  if (!(await confirmDiscard())) return;
  resetDocument();
}

async function openDocument(path: string) {
  resetDocument();
  // Set BEFORE the round trip, not after it (code review 2026-09-13): `mode` follows
  // `documentPath`, so the header — the file's name and the "Opening…" hint — appears the moment
  // the user acts, rather than the view sitting on the resting surface for the whole parse with
  // nothing to show for the click (AC29; EXPERIENCE.md's "never a blank pane").
  documentPath.value = path;
  opening.value = true;
  announcement.value = t("tools.pdf.opening");
  const startedFor = generation;
  try {
    const result = await runDocument(() => invoke<DocumentInfo>("pdf_open", { path }));
    if (result.superseded || generation !== startedFor) return;

    info.value = result.value;
    rows.value = buildRows(result.value.pageCount);
    announcement.value = pageCountLabel(result.value.pageCount);
    await startLoading();
  } catch (err) {
    if (generation === startedFor) {
      documentError.value = toToolError(err);
      announcement.value = "";
    }
  } finally {
    if (generation === startedFor) opening.value = false;
  }
}

// ---- the page loader (AC45) ----
//
// Per VISIBLE range, literally: an IntersectionObserver watches every cell that has not been
// fetched yet, and whatever scrolls into view is what gets requested — in batches of at most
// `PAGE_BATCH`, tracked per page so a cell is never requested twice. The first build had one
// sentinel below the LAST row of the whole document and fetched "the next 24 from the top", so on
// a 400-page document the middle stayed blank until the user reached the very bottom, and an edit
// made at page 200 reloaded pages 1-24 while the scroll position stayed at 200. This is the
// shape AC45 actually describes, and it is what lets a keyboard user's focus (which scrolls the
// cell into view) drive loading too.
//
// Where there is no IntersectionObserver (jsdom), the first batch is fetched eagerly so the view
// still shows something — and the tests that care about scrolling install a mock.

/** Pages with a request in flight, so an observer firing twice does not fetch twice. */
const pendingPages = new Set<number>();
let observer: IntersectionObserver | null = null;

function rowAt(page: number): PageRow | undefined {
  return rows.value[page - 1];
}

function needsText(row: PageRow): boolean {
  return row.text === undefined;
}

function needsThumbnail(row: PageRow): boolean {
  return info.value?.canRenderPreviews === true && row.thumbnail === undefined;
}

function isUnloaded(row: PageRow): boolean {
  return needsText(row) || needsThumbnail(row);
}

/**
 * Starts loading for a freshly built or refreshed grid: puts every unloaded cell under
 * observation, or — where there is no observer to drive loading — fetches the first batch once,
 * so the surface is never blank. The eager path is deliberately NOT in `observeUnloadedCells`:
 * a re-observe after a batch that answered nothing would otherwise fetch the same page forever.
 */
async function startLoading() {
  await nextTick();
  if (typeof IntersectionObserver === "undefined") {
    void fetchPages(rows.value.filter(isUnloaded).slice(0, PAGE_BATCH).map((row) => row.page));
    return;
  }
  observeUnloadedCells();
}

/** (Re)observes every cell whose row still has something to fetch, and releases the rest.
 *  Idempotent — observing an element twice is a no-op — so it is safe after any change to `rows`. */
function observeUnloadedCells() {
  const list = listElement();
  if (!list || typeof IntersectionObserver === "undefined") return;

  observer ??= new IntersectionObserver(
    (entries) => {
      const pages: number[] = [];
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const page = Number((entry.target as HTMLElement).dataset.page);
        const row = rowAt(page);
        if (row && isUnloaded(row)) pages.push(page);
        else observer?.unobserve(entry.target);
      }
      void requestPages(pages);
    },
    // Fetch a little ahead of the viewport in both directions, so ordinary scrolling rarely lands
    // on a placeholder; still bounded, still per visible range.
    { root: list, rootMargin: "50% 0px" },
  );

  for (const cell of list.querySelectorAll<HTMLElement>(".page-cell")) {
    const row = rowAt(Number(cell.dataset.page));
    if (row && isUnloaded(row)) observer.observe(cell);
    else observer.unobserve(cell);
  }
}

/** Splits a set of wanted pages into bounded batches and fetches each. */
async function requestPages(pages: number[]) {
  const wanted = [...new Set(pages)]
    .filter((page) => !pendingPages.has(page))
    .filter((page) => {
      const row = rowAt(page);
      return row !== undefined && isUnloaded(row);
    })
    .sort((a, b) => a - b);
  const batches: Promise<void>[] = [];
  for (let start = 0; start < wanted.length; start += PAGE_BATCH) {
    batches.push(fetchPages(wanted.slice(start, start + PAGE_BATCH)));
  }
  await Promise.all(batches);
}

/**
 * Fetches text — and previews where the platform has a renderer — for one bounded batch of pages.
 * Fenced by document identity, never by request order: see the `runDocument` comment.
 */
async function fetchPages(pages: number[]) {
  if (pages.length === 0) return;
  const path = livePath.value;
  if (path === null) return;
  const startedFor = generation;
  const width = previewPixelWidth.value;
  for (const page of pages) pendingPages.add(page);

  try {
    const textPages = pages.filter((page) => {
      const row = rowAt(page);
      return row !== undefined && needsText(row);
    });
    if (textPages.length > 0) {
      const texts = await invoke<PageText[]>("pdf_page_text", { path, pageNumbers: textPages });
      if (generation !== startedFor) return;
      const answered = new Map(texts.map((entry) => [entry.page, entry.text]));
      for (const page of textPages) {
        const row = rowAt(page);
        // A page the command did not answer for is settled as unreadable rather than left
        // pending — a pending page is one the observer would ask for again, forever.
        if (row) row.text = answered.get(page) ?? null;
      }
    }

    const previewPages = pages.filter((page) => {
      const row = rowAt(page);
      return row !== undefined && needsThumbnail(row);
    });
    if (previewPages.length > 0) {
      const previews = await invoke<PagePreview[]>("pdf_render_pages", {
        path,
        pageNumbers: previewPages,
        maxWidth: width,
      });
      if (generation !== startedFor) return;
      // A size change while this was in flight: the result is the wrong resolution, and
      // `reloadPreviews` is already re-fetching at the right one. Leave the rows for it.
      if (previewPixelWidth.value !== width) return;
      const drawn = new Map(previews.map((entry) => [entry.page, entry.pngBase64]));
      for (const page of previewPages) {
        const row = rowAt(page);
        if (!row) continue;
        const png = drawn.get(page);
        // AC46: a page the renderer omitted is a text-only cell, not a frame that never fills.
        row.thumbnail = png === undefined ? null : `data:image/png;base64,${png}`;
      }
    }
  } catch (err) {
    if (generation !== startedFor) return;
    documentError.value = toToolError(err);
  } finally {
    for (const page of pages) pendingPages.delete(page);
    // Whatever is still unloaded — because the call failed, or because the size changed under
    // it — goes back under observation, so it is fetched again the next time it is on screen
    // rather than left blank for good.
    if (generation === startedFor) observeUnloadedCells();
  }
}

/**
 * AC55: re-renders the previews already on screen when the size step changes.
 *
 * Without this, switching S -> L keeps the small images and simply stretches them — which is the
 * blur this AC exists to remove, reintroduced by the control meant to fix it. Only previews are
 * re-fetched: the page text is resolution-independent and re-requesting it would be pure waste.
 *
 * Each thumbnail is REPLACED as its batch arrives rather than the whole grid being blanked first
 * (code review 2026-09-13): the old image at the old resolution is a better placeholder than a
 * grey box, and a bail-out partway no longer leaves half the grid empty.
 */
async function reloadPreviews() {
  const path = livePath.value;
  if (path === null || !info.value?.canRenderPreviews) return;
  const startedFor = generation;
  const width = previewPixelWidth.value;
  const loaded = rows.value.filter((row) => row.thumbnail !== undefined).map((row) => row.page);

  for (let start = 0; start < loaded.length; start += PAGE_BATCH) {
    const pageNumbers = loaded.slice(start, start + PAGE_BATCH);
    try {
      const previews = await invoke<PagePreview[]>("pdf_render_pages", {
        path,
        pageNumbers,
        maxWidth: width,
      });
      // Bail out if anything moved under us — a newer size or a different document. The rows
      // keep what they had; a newer `reloadPreviews` is already on its way.
      if (generation !== startedFor || previewPixelWidth.value !== width) return;
      for (const entry of previews) {
        const row = rowAt(entry.page);
        if (row) row.thumbnail = `data:image/png;base64,${entry.pngBase64}`;
      }
    } catch (err) {
      if (generation === startedFor) documentError.value = toToolError(err);
      return;
    }
  }
}

watch(previewPixelWidth, () => {
  void reloadPreviews();
});

// ---- arrivals: picker, drop, hand-off ----

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
 * AC23's "Merge with…": the open document plus whatever the user picks, ALWAYS as a queue — one
 * picked file included. The first build routed this through `acceptPaths`, whose one-file branch
 * did not look at the open document and simply opened the picked file in its place: the most
 * natural merge gesture closed the document the user meant to keep (code review 2026-09-13).
 */
async function onMergeWith() {
  if (documentPath.value === null) return;
  documentError.value = null;
  try {
    const picked = await open({ multiple: true, filters: pdfFilters() });
    if (picked === null) return;
    await startQueue(Array.isArray(picked) ? picked : [picked]);
  } catch (err) {
    documentError.value = toToolError(err);
  }
}

/**
 * The single entry point for "some PDFs arrived", whether from the picker or from a drop. One file
 * opens it; several start a merge queue — which is why the resting surface can say "drop several
 * to merge them" and mean it. A single file arriving while a document is open REPLACES it, after
 * `confirmDiscard` if there are unsaved edits.
 */
async function acceptPaths(paths: string[], known?: Map<string, number>) {
  if (paths.length === 0) return;
  if (paths.length === 1 && mergeQueue.value.length === 0) {
    if (!(await confirmDiscard())) return;
    await openDocument(paths[0]);
    return;
  }
  await startQueue(paths, known);
}

/**
 * Enters (or extends) the merge queue. An open document is folded in FIRST, and it is folded in
 * as its working copy so any edits it carries are what get merged — the first build queued the
 * original and silently dropped the edits (code review 2026-09-13). Duplicates are skipped: the
 * same file twice is never what a merge meant.
 */
async function startQueue(paths: string[], known?: Map<string, number>) {
  const openedFile = documentPath.value;
  const openedLive = livePath.value;
  const openedInfo = info.value;
  if (mergeQueue.value.length === 0) resetDocument();

  const incoming: Omit<QueueEntry, "id">[] = [];
  if (openedFile !== null && openedLive !== null) {
    incoming.push({
      path: openedLive,
      sourcePath: openedFile,
      pageCount: openedInfo?.pageCount ?? null,
      error: null,
    });
  }
  for (const path of paths) {
    incoming.push({
      path,
      sourcePath: path,
      // A drop already learned every page count in one round trip (`pdf_open_dropped`), so the
      // per-file loop below is skipped for those. The picker path has no such result and still
      // fetches.
      pageCount: known?.get(path) ?? null,
      error: null,
    });
  }

  const present = new Set(mergeQueue.value.map((entry) => entry.sourcePath));
  for (const entry of incoming) {
    if (present.has(entry.sourcePath)) continue;
    present.add(entry.sourcePath);
    mergeQueue.value.push({ id: (nextQueueId += 1), ...entry });
  }
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
//
// "Open in the PDF tool" means OPEN: a queue that happens to be on screen is cleared rather than
// appended to (code review 2026-09-13).
watch(
  () => registry.handOffPath,
  async (handOff) => {
    if (!handOff || handOff.toolId !== "pdf") return;
    registry.handOffPath = null;
    if (!(await confirmDiscard())) return;
    mergeQueue.value = [];
    await openDocument(handOff.path);
  },
  { immediate: true },
);

/** AC24: the queue lists each document by basename WITH its page count, so the order being set is
 *  an informed one rather than a list of filenames. Re-entrant-safe: a second "Add more PDFs…"
 *  while the first loop is still running must not fetch the same entries twice. */
const countsInFlight = new Set<number>();
async function loadQueuePageCounts() {
  for (const entry of mergeQueue.value) {
    if (entry.pageCount !== null || entry.error !== null || countsInFlight.has(entry.id)) continue;
    countsInFlight.add(entry.id);
    try {
      const result = await invoke<DocumentInfo>("pdf_open", { path: entry.path });
      entry.pageCount = result.pageCount;
    } catch (err) {
      // A queue entry whose page count cannot be read still merges — the count is a courtesy —
      // but the reason is kept and shown on the row, so an encrypted file is found here rather
      // than when the merge fails later with no indication of which file.
      entry.error = toToolError(err);
    } finally {
      countsInFlight.delete(entry.id);
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
  if (working.value) return;
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
  // WebKit does not move real focus to a clicked non-form element by default (only text inputs
  // reliably get it) — Chromium and Firefox do, which is why this was invisible until a real
  // render review (render review 2026-09-14). Without this, `focusedPage` and `tabindex` update
  // correctly but the arrow-key handler below never receives the keydown at all (it isn't inside
  // the focused subtree), so ArrowUp/ArrowDown fall through to the browser's native page scroll.
  (event.currentTarget as HTMLElement).focus();
}

async function focusRow(page: number) {
  focusedPage.value = page;
  await nextTick();
  const element = listElement()?.querySelector<HTMLElement>(`[data-page="${page}"]`);
  element?.focus();
  // Focusing scrolls the cell into view, which is what drives loading — but a keyboard user
  // arriving on a placeholder should not wait for the observer, so ask for it directly too.
  const row = rowAt(page);
  if (row && isUnloaded(row)) void requestPages([page]);
}

/**
 * How many cells share a row of the grid, read from the layout itself — the grid is `auto-fill`,
 * so the count depends on the window. Without a layout (jsdom) it is one column, which makes
 * Up/Down behave as they did in the list.
 */
function gridColumns(): number {
  const list = listElement();
  if (!list || typeof getComputedStyle !== "function") return 1;
  const template = getComputedStyle(list).gridTemplateColumns;
  const tracks = template.split(" ").filter((track) => track.length > 0);
  return Math.max(tracks.length, 1);
}

/**
 * AC22 on a GRID (AC54), not a list: Up/Down move by a visual row, Left/Right by one cell,
 * Home/End to the first and last page. The first build kept the list's two-key model, where
 * ArrowDown moved one cell to the RIGHT (code review 2026-09-13).
 */
function onListKeydown(event: KeyboardEvent) {
  const total = info.value?.pageCount ?? 0;
  if (total === 0) return;

  // `raw`, unclamped: an arrow key with no cell in that direction is a NO-OP (stays on the
  // current cell) rather than jumping to page 1/last, which is what `clampPage`'s saturating
  // behaviour did here before (render review 2026-09-14). Landing on page 1 from page 30 because
  // there happened to be no row above read as a random jump, not as "there's nothing that way."
  // `Home`/`End` keep their own real jump-to-edge meaning and are unaffected.
  let raw: number | null = null;
  switch (event.key) {
    case "ArrowDown":
      raw = focusedPage.value + gridColumns();
      break;
    case "ArrowUp":
      raw = focusedPage.value - gridColumns();
      break;
    case "ArrowRight":
      raw = focusedPage.value + 1;
      break;
    case "ArrowLeft":
      raw = focusedPage.value - 1;
      break;
    case "Home":
      event.preventDefault();
      void focusRow(1);
      return;
    case "End":
      event.preventDefault();
      void focusRow(total);
      return;
    default:
      break;
  }
  if (raw !== null) {
    // Always ours to handle, in bounds or not — otherwise an out-of-range arrow falls through to
    // the browser's native scroll, which is the exact "the scrollbar moves instead" confusion
    // this round of render review reported.
    event.preventDefault();
    if (raw < 1 || raw > total) return;
    const next = raw;
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

/**
 * Code review 2026-09-14: NOT vue-i18n's `|`-pipe plural syntax. `i18n.ts`'s own comment on the
 * custom French plural rule documents why this codebase avoids it everywhere else — its index
 * mapping for `count === 0` collapsed onto the SAME form as `count === 1`, so a genuinely
 * page-less PDF's count chip read "1 page" beside `emptyNotice`'s "This PDF has no pages."
 * Explicit `…One`/`…Other` selection, the same pattern `JsonView.vue`/`UuidView.vue` use.
 */
function pageCountLabel(count: number): string {
  return count === 1 ? t("tools.pdf.pageCountOne") : t("tools.pdf.pageCountOther", { count });
}

function selectedCountLabel(count: number): string {
  return count === 1
    ? t("tools.pdf.selectedCountOne")
    : t("tools.pdf.selectedCountOther", { count });
}

function announceSelection() {
  const count = selection.value.pages.length;
  announcement.value = count === 0 ? "" : selectedCountLabel(count);
}

// ---- verbs ----

/** Shared shape for every write: fence on `runWrite`, report per-operation, and say what happened
 *  by basename when a file is produced (AC29/AC30/AC31). */
async function runWriteOperation(command: string, args: Record<string, unknown>, outputPath: string) {
  operationError.value = null;
  clearCompletion();
  working.value = true;
  announcement.value = t("tools.pdf.workingOnIt");
  try {
    const result = await runWrite(() => invoke(command, { ...args, outputPath }));
    if (result.superseded) {
      announcement.value = "";
      return false;
    }
    // AC30: merge and extract-pages used to write a file and say nothing at all — the user's only
    // evidence was opening Finder. Announced AND shown.
    const saved = t("tools.pdf.savedFile", { name: basename(outputPath) });
    announcement.value = saved;
    showCompletion(saved);
    return true;
  } catch (err) {
    operationError.value = toToolError(err);
    announcement.value = "";
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

/**
 * Extracts the SELECTION — not the range it spans. The first build sent `[first, last]` to the
 * range-only command, so ⌘-clicking pages 2 and 9 produced an eight-page file and announced it as
 * saved (code review 2026-09-13; NFR4). A contiguous selection still takes the range command,
 * which writes the cleanest output; a gapped one is expressed with the commands that exist by
 * deleting its complement into the destination — no new IPC surface for a case core already
 * handles.
 */
async function onExtractSelection() {
  if (!documentPath.value || !hasSelection.value || !info.value) return;
  const pages = selection.value.pages;
  const total = info.value.pageCount;
  const outputPath = await askWherePdfGoes();
  if (outputPath === null) return;

  const contiguous = pages[pages.length - 1] - pages[0] === pages.length - 1;
  if (contiguous) {
    await runWriteOperation(
      "pdf_extract_pages",
      { path: livePath.value, startPage: pages[0], endPage: pages[pages.length - 1] },
      outputPath,
    );
    return;
  }
  const selected = new Set(pages);
  const complement: number[] = [];
  for (let page = 1; page <= total; page += 1) if (!selected.has(page)) complement.push(page);
  await runWriteOperation(
    "pdf_delete_pages",
    { path: livePath.value, pageNumbers: complement },
    outputPath,
  );
}

/**
 * AC52: applies an edit to the working copy IN PLACE and updates the page grid, so the change is
 * visible immediately and nothing is asked of the user.
 *
 * Reading and writing the same path is safe: the command reads the file completely before it
 * writes, and `fs_helper::write_file_bytes` writes to a temp file and renames — so a failure
 * partway through cannot leave the working copy truncated.
 *
 * **The grid is updated locally, then verified** (code review 2026-09-13, AC51/AC52). `applyLocally`
 * transforms `rows` the same way the command transformed the file — rows keep their identity,
 * text and thumbnails, only positions change — which is what lets the move animate and spares
 * a re-fetch of everything on screen. `pdf_open` on the working copy then refreshes `info` (the
 * text-layer classification can change when pages go) and confirms the page count agrees; if it
 * ever does not, the grid is rebuilt from the file, because a wrong grid is worse than a blank one.
 *
 * Every step re-checks `generation`: an edit started on document A must not touch document B if
 * A was closed while the edit was in flight.
 */
async function applyEdit(
  command: string,
  args: Record<string, unknown>,
  applyLocally: () => void,
) {
  if (!documentPath.value || !hasSelection.value) return;
  operationError.value = null;
  clearCompletion();
  working.value = true;
  announcement.value = t("tools.pdf.workingOnIt");
  const startedFor = generation;
  try {
    const path = await ensureWorkingCopy();
    if (path === null) return;
    const result = await runWrite(() => invoke(command, { ...args, path, outputPath: path }));
    if (result.superseded || generation !== startedFor) return;
    dirty.value = true;
    applyLocally();
    await refreshAfterEdit(path);
    if (generation !== startedFor) return;
    // The verb bar re-renders with the new selection, and the button that was focused may be gone
    // with it. Focus goes back to the grid rather than falling to <body> (NFR5).
    await focusRow(clampPage(focusedPage.value, info.value?.pageCount ?? 1));
    announcement.value = t("tools.pdf.editApplied");
    showCompletion(t("tools.pdf.editApplied"));
  } catch (err) {
    if (generation === startedFor) {
      operationError.value = toToolError(err);
      announcement.value = "";
    }
  } finally {
    if (generation === startedFor) working.value = false;
  }
}

/** Re-reads `info` from the edited working copy and checks the grid still describes the file. */
async function refreshAfterEdit(path: string) {
  const startedFor = generation;
  const result = await runDocument(() => invoke<DocumentInfo>("pdf_open", { path }));
  if (result.superseded || generation !== startedFor) return;
  info.value = result.value;
  // The extracted text describes the document before the edit; clear it rather than show it.
  extractedText.value = "";
  textShown.value = false;
  readCameBackEmpty.value = false;
  if (result.value.pageCount !== rows.value.length) {
    rows.value = buildRows(result.value.pageCount);
    selection.value = emptySelection();
    focusedPage.value = clampPage(focusedPage.value, result.value.pageCount);
  }
  await startLoading();
}

/** Renumbers `rows` to their positions after a local edit. */
function renumberRows() {
  rows.value.forEach((row, index) => {
    row.page = index + 1;
  });
}

async function onRotateSelection() {
  const pages = [...selection.value.pages];
  await applyEdit("pdf_rotate_pages", { pageNumbers: pages, quarterTurns: 1 }, () => {
    // A rotated page keeps its text and its place; only its picture is stale. The selection
    // stays, so rotating again is one click.
    for (const page of pages) {
      const row = rowAt(page);
      if (row && row.thumbnail !== undefined) row.thumbnail = undefined;
    }
  });
}

async function onDeleteSelection() {
  const pages = [...selection.value.pages];
  await applyEdit("pdf_delete_pages", { pageNumbers: pages }, () => {
    const gone = new Set(pages);
    rows.value = rows.value.filter((row) => !gone.has(row.page));
    renumberRows();
    // The selected pages no longer exist; the honest selection is none (AC52).
    selection.value = emptySelection();
    focusedPage.value = clampPage(focusedPage.value, rows.value.length);
  });
}

async function onMoveSelection(delta: number) {
  const total = info.value?.pageCount ?? 0;
  if (!hasSelection.value || total === 0) return;
  if (delta < 0 && !canMoveUp.value) return;
  if (delta > 0 && !canMoveDown.value) return;

  const moving = new Set(selection.value.pages);
  const order: number[] = [];
  for (let page = 1; page <= total; page += 1) if (!moving.has(page)) order.push(page);
  // Insert the moved block at its shifted position, keeping the block's own internal order —
  // moving three pages must keep those three adjacent and in sequence.
  const anchorIndex = clampPage(Math.min(...selection.value.pages) + delta, total) - 1;
  order.splice(Math.max(anchorIndex, 0), 0, ...selection.value.pages);
  if (order.every((page, index) => page === index + 1)) return;

  await applyEdit("pdf_reorder_pages", { newOrder: order }, () => {
    const byOldPage = new Map(rows.value.map((row) => [row.page, row]));
    rows.value = order.map((oldPage) => byOldPage.get(oldPage)!);
    renumberRows();
    // The selection follows the pages it named, so "Move down" again moves the same block.
    const newPageOf = new Map(order.map((oldPage, index) => [oldPage, index + 1]));
    const pages = selection.value.pages.map((page) => newPageOf.get(page) ?? page).sort((a, b) => a - b);
    const anchor =
      selection.value.anchor === null ? null : (newPageOf.get(selection.value.anchor) ?? null);
    selection.value = { pages, anchor };
    focusedPage.value = newPageOf.get(focusedPage.value) ?? focusedPage.value;
  });
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
  completion.value = "";
  working.value = true;
  announcement.value = t("tools.pdf.workingOnIt");
  try {
    const result = await runDocument(() =>
      invoke<string>("pdf_extract_text", { path: livePath.value }),
    );
    if (result.superseded) {
      announcement.value = "";
      return;
    }
    extractedText.value = result.value;
    textShown.value = true;
    readCameBackEmpty.value = result.value.trim().length === 0;
    announcement.value = t("tools.pdf.textRead");
  } catch (err) {
    documentError.value = toToolError(err);
    announcement.value = "";
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

    <!-- AC30, the visible half: what the live region just said about a finished write, shown for
         a few seconds, then cleared when the next operation starts. ALWAYS rendered — never
         `v-if` — because inserting and removing this element was what caused the whole page to
         jump every time an edit completed (render review 2026-09-14); a fixed-height slot that is
         merely empty most of the time does not move anything around it. -->
    <p class="completion">
      {{ completion }}
    </p>

    <!-- AC20: ONE resting surface. The three independent file pickers are gone; a dashed drop
         target carries the drop language HashView and OcrView established, and the sentence
         states plainly that several PDFs merge. -->
    <div
      v-if="mode === 'resting'"
      class="drop-target"
      :class="{ 'drag-over': isDragOver }"
    >
      <p class="drop-label">
        {{ isDragOver ? t('tools.pdf.dropToOpen') : t('tools.pdf.dropLabel') }}
      </p>
      <AppButton
        :disabled="opening"
        @click="onChoosePdfs"
      >
        {{ t('tools.pdf.openDocument') }}
      </AppButton>
      <p class="drop-hint">
        {{ t('tools.pdf.dropHint') }}
      </p>
      <!-- AC31: BOTH scopes render in every state (code review 2026-09-13). A merge that fails
           after the queue was cleared lands in `operationError`, and this is the surface on
           screen when it does. -->
      <p
        v-if="documentError"
        class="error"
        role="alert"
      >
        {{ toolErrorMessage(documentError, t) }}
      </p>
      <p
        v-if="operationError"
        class="error"
        role="alert"
      >
        {{ toolErrorMessage(operationError, t) }}
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
          :disabled="working"
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
            :title="entry.sourcePath"
          >{{ basename(entry.sourcePath) }}</span>
          <span
            v-if="entry.pageCount !== null"
            class="chip"
          >{{ pageCountLabel(entry.pageCount) }}</span>
          <!-- A file whose count could not be read says why HERE, on its own row — not later,
               when the merge fails with no indication of which file. -->
          <span
            v-else-if="entry.error"
            class="error"
          >{{ toolErrorMessage(entry.error, t) }}</span>
          <button
            type="button"
            class="ghost"
            :disabled="index === 0 || working"
            :aria-label="t('tools.pdf.moveUp')"
            :title="t('tools.pdf.moveUp')"
            @click="moveQueueEntry(index, -1)"
          >
            <PhArrowUp aria-hidden="true" />
          </button>
          <button
            type="button"
            class="ghost"
            :disabled="index === mergeQueue.length - 1 || working"
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
            :disabled="working"
            @click="removeQueueEntry(index)"
          >
            {{ t('tools.pdf.remove') }}
          </AppButton>
        </li>
      </TransitionGroup>

      <div class="verb-bar">
        <AppButton
          :disabled="working"
          @click="onChoosePdfs"
        >
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
        v-if="documentError"
        class="error"
        role="alert"
      >
        {{ toolErrorMessage(documentError, t) }}
      </p>
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
        >{{ pageCountLabel(info.pageCount) }}</span>
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
          :disabled="working"
          @click="onCloseDocument"
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
      <!-- AC51: a TransitionGroup keyed by row IDENTITY, so a move animates the cells that moved
           (the same `reorder` motion the queue uses) instead of rebuilding all of them. The
           observer that drives loading attaches to the cells themselves — there is no sentinel:
           whatever is on screen is what gets fetched (AC45). -->
      <TransitionGroup
        v-if="info && info.pageCount > 0"
        ref="pageList"
        tag="ul"
        name="reorder"
        class="page-grid"
        :class="`size-${settings.pdfPreviewSize}`"
        role="listbox"
        aria-multiselectable="true"
        :aria-label="t('tools.pdf.pdfSectionHeading')"
        @keydown="onListKeydown"
      >
        <li
          v-for="row in rows"
          :key="row.id"
          :data-page="row.page"
          class="page-cell"
          :class="{
            selected: isSelected(selection, row.page),
            'roving-focus': row.page === focusedPage,
          }"
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
      </TransitionGroup>

      <!-- AC23: the verb bar acts on the selection, and shows document-scoped actions when
           nothing is selected. -->
      <div class="verb-bar">
        <template v-if="hasSelection">
          <span class="hint">{{ selectedCountLabel(selection.pages.length) }}</span>
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
            :disabled="working || !canMoveUp"
            @click="onMoveSelection(-1)"
          >
            {{ t('tools.pdf.moveUp') }}
          </AppButton>
          <AppButton
            :disabled="working || !canMoveDown"
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
            @click="onMergeWith"
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
            readCameBackEmpty &&
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
/* AC30's visible confirmation: the same sentence the live region announces, shown. */
.completion {
  margin: 0;
  /* Reserves its own line always, present or not — see the template comment above. */
  min-height: calc(var(--font-body-size) * var(--font-body-line-height));
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  line-height: var(--font-body-line-height);
  color: var(--color-text-secondary);
}

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

/* AC20, used literally: the solid border and tinted fill OcrView and HashView show while a drag
   is over the window (code review 2026-09-13 — the first build had no drag-over state at all). */
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

/* `:focus`, not `:focus-visible`: the box's own outline is suppressed unconditionally, because
   the visible marker now lives entirely on state (below), not on any focus heuristic. */
.page-cell:focus {
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

/* State-driven, not `:focus-visible` (render review 2026-09-14, second pass). `:focus-visible`
   is a browser HEURISTIC — "did this focus change look keyboard-like?" — and it does not
   reliably match a `.focus()` issued programmatically from a keydown handler after a microtask
   boundary, which is exactly what `focusRow()` does (`await nextTick()`, then `.focus()`). That
   produced the intermittent ring the developer found live: appearing late, on the wrong cell, or
   not at all, depending on how the WebView's heuristic happened to classify each call. Every
   other roving-tabindex widget in this app already avoids the heuristic — `AppTabs.vue` binds a
   reactive `.active` class off the same ref that drives its `:tabindex`; `JsonTree.vue` and
   `DiffTree.vue` use plain `:focus` (deterministic, no heuristic) for their rows. `roving-focus`
   here is the same idea: bound directly to `focusedPage`, the ref that ALREADY drives `:tabindex`
   two lines up in the template, so the class and the tab stop can never disagree.

   `.page-grid:focus-within`, not just `.roving-focus`: `:focus-within` is deterministic (real
   DOM focus is somewhere inside the grid), unlike `:focus-visible` — it gates the ring so a
   freshly opened document doesn't ring page 1 before the user has touched anything (`focusedPage`
   starts at `ref(1)`, and a plain class has no built-in "nothing is focused yet" concept the way
   `:focus-visible` does), and so the ring disappears once the user Tabs out to the verb bar.

   NEUTRAL, not signature orange (first pass, kept): plain arrow-key movement moves FOCUS only,
   never SELECTION (Shift+arrow does that) — a standard roving-focus/listbox split. Orange for
   both would make moving focus off a selected cell onto a plain one read as "nothing happened".
   Kept visible on selected cells too, deliberately: suppressing it there would make the marker
   flicker in and out on every selection change, and leave no marker at all after Cmd+A or any
   Shift-extension, when every cell is orange. The offset below nests it outside the selection
   ring rather than overlapping it. */
.page-grid:focus-within .page-cell.roving-focus .thumb {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}

/* The orange `box-shadow` above reaches 3px out; without this, a cell that is both selected AND
   roving-focused would have the two rings overlap in the 2-3px band. Nesting them concentrically
   (orange 0-3px, this one 4-6px) is geometry only — it does not change either ring's colour. */
.page-grid:focus-within .page-cell.roving-focus.selected .thumb {
  outline-offset: 4px;
}

.cell-caption {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-1);
  min-width: 0;
}

/* `accent-signature-on-text`, not the raw signature token: DESIGN.md rules the raw orange fails
   AA 4.5:1 as small text on a light ground, and a caption-size page number is small text. The
   fallback is the pattern `AppSidebar.vue` already uses (code review 2026-09-13). */
.page-cell.selected .page-number {
  color: var(--color-accent-signature-on-text, var(--color-accent-signature));
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
