import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import PdfView from "./PdfView.vue";
import { useRegistryStore } from "../../stores/registry";

// Story 8.7 slice 2 (AC9) moved this file's 13 `it()` blocks from the former BucketView.spec.ts
// byte-identically, which is what made that story's verbatim-move gate checkable.
//
// **Story 8.8 ends that property deliberately, and this note is the record of it.** Slice 4
// replaced the three independent flows those tests described — merge / split-extract /
// extract-text, each with its own file picker — with one open-once document surface (AC20-AC24).
// The old blocks are not "updated"; the surface they asserted against no longer exists. What was
// retired, and where its coverage went, stated explicitly rather than left to inference (Story
// 8.7's lesson 9 — silent retirements slip through):
//
//   - merge list add / reorder / remove / disabled-below-2 / clears-on-success  -> the merge-queue
//     state below, which is now reached by choosing SEVERAL files rather than by a dedicated
//     picker.
//   - page-range invoke args + client-side disabled guard  -> replaced by the selection model.
//     The client-side range guard is GONE by design: it could never know the page count, so
//     `end > totalPages` round-tripped to Rust to fail. The view now knows the count from
//     `pdf_open`, and core still validates authoritatively (AC11).
//   - extract-text invoke args / display / copy / disabled-until-chosen  -> the document-scoped
//     "Read text" verb below.
//   - one rendered-ToolError test per flow  -> AC31 split the single shared error ref in two, so
//     the equivalent coverage is per-SCOPE (document vs. operation) rather than per-flow.
//
// This file is no longer a move-gate artifact — it is this tool's own spec.

const { writeClipboardTextMock, invokeMock, openMock, saveMock, askMock } = vi.hoisted(() => ({
  writeClipboardTextMock: vi.fn(),
  invokeMock: vi.fn(),
  openMock: vi.fn(),
  saveMock: vi.fn(),
  askMock: vi.fn(),
}));

vi.mock("../../shell/clipboard", () => ({
  writeClipboardText: (...args: unknown[]) => writeClipboardTextMock(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
  save: (...args: unknown[]) => saveMock(...args),
  ask: (...args: unknown[]) => askMock(...args),
}));

/**
 * jsdom has no `IntersectionObserver`, and the view degrades to fetching the first batch eagerly
 * without one — which is what every test above the AC45 block relies on. The AC45 tests install
 * this instead: a minimal observer whose intersections the TEST fires, so "what scrolls into view
 * is what gets fetched" can be asserted rather than assumed.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observed = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.add(element);
  }
  unobserve(element: Element) {
    this.observed.delete(element);
  }
  disconnect() {
    this.observed.clear();
  }
  /** Simulates the given page cells scrolling into view. */
  intersect(pages: number[]) {
    const entries = [...this.observed]
      .filter((element) => pages.includes(Number((element as HTMLElement).dataset.page)))
      .map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry);
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

function installIntersectionObserver() {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
}

function fakeObserver() {
  const instance = FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];
  if (!instance) throw new Error("no IntersectionObserver was created");
  return instance;
}

function requestedTextPages(): number[][] {
  return invokeMock.mock.calls
    .filter((call) => call[0] === "pdf_page_text")
    .map((call) => (call[1] as { pageNumbers: number[] }).pageNumbers);
}

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  writeClipboardTextMock.mockReset();
  invokeMock.mockReset();
  openMock.mockReset();
  saveMock.mockReset();
  askMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mountView() {
  pinia = createPinia();
  // VTU renders every `TransitionGroup` as `<transition-group-stub>` — the queue (AC50) and the
  // page grid (AC51) both — so selectors here use the CLASS, never the tag. The stub keeps keyed
  // identity (which is what the AC50/AC51 identity assertions need) without the leave-transition
  // frames a real TransitionGroup would wait on under fake timers.
  wrapper = mount(PdfView, { global: { plugins: [pinia] }, attachTo: document.body });
  return wrapper;
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

function clickButtonByLabel(w: VueWrapper, label: string) {
  const button = w
    .findAll("button")
    .find((candidate) => candidate.attributes("aria-label") === label);
  if (!button) throw new Error(`button not found by aria-label: ${label}`);
  return button.trigger("click");
}

/**
 * The default backend responses for a document that opens cleanly. Declared once so each test
 * states only what it actually varies — a test that re-declares every mock hides which value it
 * is really about.
 */
function mockOpen(pageCount: number, overrides: Partial<Record<string, unknown>> = {}) {
  invokeMock.mockImplementation((command: string) => {
    if (command === "pdf_open") {
      return Promise.resolve({
        pageCount,
        textLayer: "partial",
        canRenderPreviews: false,
        ...overrides,
      });
    }
    if (command === "pdf_page_text") {
      return Promise.resolve(
        Array.from({ length: pageCount }, (_, index) => ({
          page: index + 1,
          text: `Heading ${index + 1}`,
        })),
      );
    }
    if (command === "pdf_render_pages") return Promise.resolve([]);
    // AC52: the working copy every edit acts on. A fixed path keeps the assertions readable.
    if (command === "pdf_begin_edit") return Promise.resolve("/tmp/working.pdf");
    return Promise.resolve(undefined);
  });
}

async function openOneDocument(pageCount = 3) {
  mockOpen(pageCount);
  openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
  mountView();
  await clickButton(wrapper!, "Open PDF…");
  await flushPromises();
}

/**
 * Every cell currently carrying the roving-focus marker (render review 2026-09-14, second pass —
 * the marker moved from `:focus-visible` to a class bound to `focusedPage`). Returns the whole
 * list rather than a single boolean: asserting the full set is what catches a marker LEFT BEHIND
 * on a previously-focused cell, not just its presence on the new one.
 */
function rovingPages() {
  return wrapper!
    .findAll(".page-cell")
    .filter((cell) => cell.classes("roving-focus"))
    .map((cell) => cell.attributes("data-page"));
}

/**
 * Like `mockOpen`, but the working copy's page count FOLLOWS the edits the view sends, the way
 * the real file's would — so a test of local application can check the grid against what the
 * file says rather than against a count that never changes.
 */
function mockEditableDocument(pageCount: number, canRenderPreviews = false) {
  let workingCount = pageCount;
  invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
    if (command === "pdf_open") {
      const count = args?.path === "/tmp/working.pdf" ? workingCount : pageCount;
      return Promise.resolve({ pageCount: count, textLayer: "partial", canRenderPreviews });
    }
    if (command === "pdf_page_text") {
      const pages = args?.pageNumbers as number[];
      return Promise.resolve(pages.map((page) => ({ page, text: `Heading ${page}` })));
    }
    if (command === "pdf_render_pages") {
      const pages = args?.pageNumbers as number[];
      return Promise.resolve(pages.map((page) => ({ page, pngBase64: `PNG${page}` })));
    }
    if (command === "pdf_begin_edit") return Promise.resolve("/tmp/working.pdf");
    if (command === "pdf_delete_pages") {
      workingCount -= (args?.pageNumbers as number[]).length;
    }
    return Promise.resolve(undefined);
  });
}

describe("PdfView", () => {
  describe("the resting surface (AC20)", () => {
    it("shows one drop target with a single way in, not three pickers", () => {
      mountView();

      // The old view had three "Choose PDF…" buttons, one per flow. The whole point of AC20 is
      // that there is now exactly one way in.
      expect(wrapper!.findAll(".drop-target")).toHaveLength(1);
      expect(wrapper!.findAll("button").filter((b) => b.text() === "Open PDF…")).toHaveLength(1);
      expect(wrapper!.text()).toContain("Drop several PDFs to merge them into one.");
    });

    it("descends heading ranks without skipping (AC26)", async () => {
      await openOneDocument();
      // The rank sequence itself, not "some h1 and some h2 exist": the first heading is the tool's
      // h1 and nothing below h2 appears anywhere on the surface.
      const headings = wrapper!.findAll("h1, h2, h3, h4, h5, h6").map((h) => h.element.tagName);
      expect(headings[0]).toBe("H1");
      expect(headings.filter((tag) => tag === "H1")).toHaveLength(1);
      expect(headings.every((tag) => tag === "H1" || tag === "H2")).toBe(true);

      expect(wrapper!.findAll("h1")).toHaveLength(1);
      expect(wrapper!.findAll("h2").length).toBeGreaterThan(0);
      expect(wrapper!.findAll("h3")).toHaveLength(0);
    });
  });

  describe("the open document (AC21)", () => {
    it("opens one chosen file and lists its pages with their text", async () => {
      await openOneDocument(3);

      expect(invokeMock).toHaveBeenCalledWith("pdf_open", { path: "/tmp/report.pdf" });
      const cells = wrapper!.findAll(".page-cell");
      expect(cells).toHaveLength(3);
      expect(cells[0].text()).toContain("Heading 1");
    });

    it("names each cell fully for assistive tech, not just by its number (AC54)", async () => {
      // The grid shows a bare "1" — repeating "Page" twenty-four times is visual noise once the
      // previews carry the meaning. But a screen reader announcing "1, Heading 1" would be worse
      // than the list this replaced, so the full name moves to the accessible name rather than
      // disappearing with the label. At size S it is the only place that text survives at all.
      await openOneDocument(3);

      const cells = wrapper!.findAll(".page-cell");
      expect(cells[0].attributes("aria-label")).toBe("Page 1 — Heading 1");
    });

    it("lays pages out as a grid whose density follows the size control (AC54)", async () => {
      await openOneDocument(3);

      const grid = wrapper!.find(".page-grid");
      // Medium is the default; the class is what drives the grid's track width.
      expect(grid.classes()).toContain("size-m");

      const large = wrapper!.findAll(".size-option").find((b) => b.text() === "L")!;
      await large.trigger("click");
      await flushPromises();

      expect(wrapper!.find(".page-grid").classes()).toContain("size-l");
      expect(large.attributes("aria-pressed")).toBe("true");
    });

    it("shows only the basename on screen, with the full path on title (AC25)", async () => {
      await openOneDocument();

      // `CLAUDE.md` treats `/Users/<name>/…` as personally-identifying and this repo enforces it
      // on its own commits; a public-portfolio app must not print it in a screenshot of itself.
      expect(wrapper!.text()).toContain("report.pdf");
      expect(wrapper!.text()).not.toContain("/tmp/report.pdf");
      expect(wrapper!.find(".doc-name").attributes("title")).toBe("/tmp/report.pdf");
    });

    it("renders a thumbnail per row when the platform can render previews", async () => {
      invokeMock.mockImplementation((command: string) => {
        if (command === "pdf_open") {
          return Promise.resolve({ pageCount: 1, textLayer: "partial", canRenderPreviews: true });
        }
        if (command === "pdf_page_text") return Promise.resolve([{ page: 1, text: "Heading" }]);
        if (command === "pdf_render_pages") {
          return Promise.resolve([{ page: 1, pngBase64: "AAAA" }]);
        }
        return Promise.resolve(undefined);
      });
      openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      expect(wrapper!.find("img.thumb").attributes("src")).toBe("data:image/png;base64,AAAA");
    });

    // AC55. The bug this pins: a CSS pixel is not a device pixel. On a 2x display a 208px-wide
    // cell is 416 real pixels, so a preview rendered at the CSS width is upscaled by the browser
    // and goes soft — invisible at the smallest step, unreadable at the largest, which is exactly
    // the pattern that was reported. jsdom reports `devicePixelRatio` 1, so it is set explicitly
    // here; without that this test would pass against the very bug it exists to catch.
    describe("preview resolution (AC55)", () => {
      const realRatio = window.devicePixelRatio;

      afterEach(() => {
        Object.defineProperty(window, "devicePixelRatio", {
          configurable: true,
          value: realRatio,
        });
      });

      function setRatio(value: number) {
        Object.defineProperty(window, "devicePixelRatio", { configurable: true, value });
      }

      async function openWithPreviews() {
        invokeMock.mockImplementation((command: string) => {
          if (command === "pdf_open") {
            return Promise.resolve({ pageCount: 2, textLayer: "partial", canRenderPreviews: true });
          }
          if (command === "pdf_page_text") {
            return Promise.resolve([{ page: 1, text: "A" }, { page: 2, text: "B" }]);
          }
          if (command === "pdf_render_pages") return Promise.resolve([]);
          return Promise.resolve(undefined);
        });
        openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
        mountView();
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();
      }

      function lastRenderWidth() {
        const calls = invokeMock.mock.calls.filter((call) => call[0] === "pdf_render_pages");
        return (calls[calls.length - 1][1] as { maxWidth: number }).maxWidth;
      }

      it("asks for previews in device pixels, not CSS pixels", async () => {
        setRatio(2);
        await openWithPreviews();

        // Medium's cell is 148 CSS px, so a 2x display needs 296 real pixels.
        expect(lastRenderWidth()).toBe(296);
      });

      it("scales the request with the display, not with a hardcoded number", async () => {
        setRatio(1);
        await openWithPreviews();

        expect(lastRenderWidth()).toBe(148);
      });

      it("re-renders at the new resolution when the size step changes", async () => {
        // Otherwise the control meant to fix the blur reintroduces it: switching S -> L would
        // keep the small images and simply stretch them.
        setRatio(2);
        await openWithPreviews();

        const large = wrapper!.findAll(".size-option").find((b) => b.text() === "L")!;
        await large.trigger("click");
        await flushPromises();

        // Large's cell is 208 CSS px; at 2x that is 416.
        expect(lastRenderWidth()).toBe(416);
      });
    });

    it("says why previews are missing and keeps the text list (AC46)", async () => {
      // The no-renderer path, reached on Linux always and on a failed page anywhere. It must not
      // render a row of frames that never fill, and it must not silently show an empty list.
      await openOneDocument(2);

      expect(wrapper!.text()).toContain("Page previews aren't available on this system");
      expect(wrapper!.findAll("img.thumb")).toHaveLength(0);
      expect(wrapper!.findAll(".page-cell")).toHaveLength(2);
      expect(wrapper!.text()).toContain("Heading 1");
    });

    it("never asks for the whole document's pages at once (AC45)", async () => {
      // A 400-page document must not become a 400-entry IPC payload. The batch ceiling is the
      // contract; the exact number is not. Without an observer (plain jsdom) the view fetches
      // one eager batch and nothing more.
      await openOneDocument(400);

      const batches = requestedTextPages();
      expect(batches).toHaveLength(1);
      expect(batches[0].length).toBeLessThan(400);
      expect(batches[0][0]).toBe(1);
    });

    describe("per visible range (AC45)", () => {
      // The first build had one sentinel below the LAST row of the whole document and always
      // fetched "the next 24 from the top", so on a long document the middle stayed blank until
      // the user reached the very bottom. These tests pin what AC45 actually says: the pages on
      // screen are the pages fetched.
      beforeEach(() => {
        installIntersectionObserver();
      });

      it("keeps loading working for a SECOND document opened after the first is closed (render review 2026-09-14)", async () => {
        // The bug this pins: `observeUnloadedCells` does `observer ??= new IntersectionObserver(
        // ..., { root: list })`. `root` is captured once, at construction — reusing the same
        // observer instance across documents left it bound to the FIRST document's now-unmounted
        // `<ul>` as root, so a second document's cells never reported an intersection at all.
        // Every preview and every page's text silently never loaded, on any size step, until an
        // edit's own explicit `requestPages` call touched a page directly.
        invokeMock.mockImplementation((command: string, args?: { path?: string; pageNumbers?: number[] }) => {
          if (command === "pdf_open") {
            return Promise.resolve({ pageCount: 2, textLayer: "partial", canRenderPreviews: true });
          }
          if (command === "pdf_page_text") {
            return Promise.resolve(
              (args!.pageNumbers as number[]).map((page) => ({
                page,
                text: `${args!.path} page ${page}`,
              })),
            );
          }
          if (command === "pdf_render_pages") {
            return Promise.resolve(
              (args!.pageNumbers as number[]).map((page) => ({ page, pngBase64: `PNG-${page}` })),
            );
          }
          return Promise.resolve(undefined);
        });
        openMock.mockResolvedValueOnce(["/tmp/first.pdf"]);
        mountView();
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();
        fakeObserver().intersect([1, 2]);
        await flushPromises();
        expect(wrapper!.findAll("img.thumb")).toHaveLength(2);

        await clickButtonByLabel(wrapper!, "Close");
        openMock.mockResolvedValueOnce(["/tmp/second.pdf"]);
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();

        // A fresh observer for the fresh grid — not the first document's, now-detached one.
        expect(FakeIntersectionObserver.instances).toHaveLength(2);
        fakeObserver().intersect([1, 2]);
        await flushPromises();

        const cells = wrapper!.findAll(".page-cell");
        expect(cells).toHaveLength(2);
        expect(cells[0].find("img.thumb").attributes("src")).toBe("data:image/png;base64,PNG-1");
        expect(cells[0].text()).toContain("/tmp/second.pdf page 1");
      });

      it("fetches exactly the pages that scroll into view, in bounded batches", async () => {
        await openOneDocument(400);
        expect(requestedTextPages()).toHaveLength(0);

        fakeObserver().intersect(Array.from({ length: 30 }, (_, i) => i + 1));
        await flushPromises();

        // Thirty visible cells become two batches — one full, one the remainder — and nothing
        // beyond what is on screen.
        expect(requestedTextPages()).toEqual([
          Array.from({ length: 24 }, (_, i) => i + 1),
          [25, 26, 27, 28, 29, 30],
        ]);
      });

      it("fetches the middle of a long document when the user lands there", async () => {
        await openOneDocument(400);

        fakeObserver().intersect([200, 201, 202]);
        await flushPromises();

        expect(requestedTextPages()).toEqual([[200, 201, 202]]);
        expect(wrapper!.findAll(".page-cell")[199].text()).toContain("Heading 200");
      });

      it("never requests a page twice, however often it re-enters the viewport", async () => {
        await openOneDocument(50);

        fakeObserver().intersect([1, 2, 3]);
        fakeObserver().intersect([1, 2, 3]);
        await flushPromises();
        fakeObserver().intersect([1, 2, 3]);
        await flushPromises();

        expect(requestedTextPages()).toEqual([[1, 2, 3]]);
      });

      it("keeps every batch that arrives, whatever order they arrive in", async () => {
        // The first build put batches on a latest-wins runner, so a second batch starting while
        // the first was in flight silently discarded the first — and its rows were never asked
        // for again. Batches are independent work: both must land.
        const resolvers: Record<number, (value: unknown) => void> = {};
        invokeMock.mockImplementation((command: string, args?: { pageNumbers?: number[] }) => {
          if (command === "pdf_open") {
            return Promise.resolve({ pageCount: 60, textLayer: "partial", canRenderPreviews: false });
          }
          if (command === "pdf_page_text") {
            return new Promise((resolve) => {
              resolvers[args!.pageNumbers![0]] = resolve;
            });
          }
          return Promise.resolve(undefined);
        });
        openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
        mountView();
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();

        fakeObserver().intersect([1, 2]);
        await flushPromises();
        fakeObserver().intersect([40, 41]);
        await flushPromises();

        // The later batch lands first.
        resolvers[40]([{ page: 40, text: "Forty" }, { page: 41, text: "Forty-one" }]);
        await flushPromises();
        resolvers[1]([{ page: 1, text: "One" }, { page: 2, text: "Two" }]);
        await flushPromises();

        const cells = wrapper!.findAll(".page-cell");
        expect(cells[39].text()).toContain("Forty");
        expect(cells[0].text()).toContain("One");
      });

      it("drops a batch that belongs to a document that has since been closed", async () => {
        let resolveText: ((value: unknown) => void) | undefined;
        invokeMock.mockImplementation((command: string) => {
          if (command === "pdf_open") {
            return Promise.resolve({ pageCount: 5, textLayer: "partial", canRenderPreviews: false });
          }
          if (command === "pdf_page_text") {
            return new Promise((resolve) => {
              resolveText = resolve;
            });
          }
          return Promise.resolve(undefined);
        });
        openMock.mockResolvedValueOnce(["/tmp/first.pdf"]);
        mountView();
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();
        fakeObserver().intersect([1]);
        await flushPromises();

        // Replace the document (by drop) while the batch is in flight, then let the old batch land.
        useRegistryStore(pinia).dropResult = {
          toolId: "pdf",
          value: [{ path: "/tmp/second.pdf", pageCount: 5, textLayer: "partial" }],
        };
        await flushPromises();
        resolveText!([{ page: 1, text: "From the FIRST document" }]);
        await flushPromises();

        expect(wrapper!.text()).not.toContain("From the FIRST document");
      });

      it("marks a page the renderer omitted as text-only rather than forever loading (AC46)", async () => {
        invokeMock.mockImplementation((command: string) => {
          if (command === "pdf_open") {
            return Promise.resolve({ pageCount: 2, textLayer: "partial", canRenderPreviews: true });
          }
          if (command === "pdf_page_text") {
            return Promise.resolve([{ page: 1, text: "A" }, { page: 2, text: "B" }]);
          }
          // Page 2 fails to draw and is omitted, the shape `pdf_render_pages` returns.
          if (command === "pdf_render_pages") return Promise.resolve([{ page: 1, pngBase64: "AAAA" }]);
          return Promise.resolve(undefined);
        });
        openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
        mountView();
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();
        fakeObserver().intersect([1, 2]);
        await flushPromises();

        const cells = wrapper!.findAll(".page-cell");
        expect(cells[0].find("img.thumb").exists()).toBe(true);
        expect(cells[1].find("img.thumb").exists()).toBe(false);
        // Settled, not pending: the observer has let go of it.
        expect(fakeObserver().observed.has(cells[1].element)).toBe(false);
        expect(cells[1].text()).toContain("B");
      });
    });
  });

  describe("the honest scan message (AC40)", () => {
    it("says a scan is a scan rather than that no text was found", async () => {
      mockOpen(1, { textLayer: "scanned" });
      openMock.mockResolvedValueOnce(["/tmp/scan.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      expect(wrapper!.text()).toContain("This PDF is a scan");
      expect(wrapper!.text()).not.toContain("No text was found in this PDF.");
    });

    it("keeps page operations available on a scan", async () => {
      // AC40 is explicit that the scan state does not disable the page verbs — the pages are
      // still there to extract, rotate, delete and reorder.
      mockOpen(2, { textLayer: "scanned" });
      openMock.mockResolvedValueOnce(["/tmp/scan.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      await wrapper!.findAll(".page-cell")[0].trigger("click");
      const rotate = wrapper!.findAll("button").find((b) => b.text().includes("Rotate"));
      expect(rotate?.attributes("disabled")).toBeUndefined();
    });

    // The gap the original pair of tests could not see: both asserted the scan sentence at OPEN,
    // when `textShown` is still false, so "does not say no text was found" passed without the
    // forbidden sentence ever having had a chance to render. It renders after "Read text" returns
    // nothing — which for a scan is the expected outcome, not a surprise — and AC40 is about
    // exactly that moment.
    it("still refuses to say no text was found after reading a scan comes back empty", async () => {
      mockOpen(1, { textLayer: "scanned" });
      openMock.mockResolvedValueOnce(["/tmp/scan.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      invokeMock.mockResolvedValueOnce("");
      await clickButton(wrapper!, "Read text");
      await flushPromises();

      expect(wrapper!.text()).not.toContain("No text was found in this PDF.");
      expect(wrapper!.text()).toContain("This PDF is a scan");
    });

    it("does say no text was found when a document that has a text layer reads back empty", async () => {
      // The honest sentence keeps its job everywhere it is actually true — AC40 replaces it for a
      // scan, it does not retire it.
      await openOneDocument(2);

      invokeMock.mockResolvedValueOnce("   ");
      await clickButton(wrapper!, "Read text");
      await flushPromises();

      expect(wrapper!.text()).toContain("No text was found in this PDF.");
    });

    it("distinguishes an empty document from a scan", async () => {
      mockOpen(0, { textLayer: "empty" });
      openMock.mockResolvedValueOnce(["/tmp/empty.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      expect(wrapper!.text()).toContain("This PDF has no pages.");
      expect(wrapper!.text()).not.toContain("This PDF is a scan");
    });

    it("says 0 pages, not 1, for a page-less document (code review 2026-09-14)", async () => {
      // `pageCount`/`selectedCount` used vue-i18n's `|`-pipe plural syntax (`"1 page | {count}
      // pages"`), which this codebase's own `i18n.ts` documents avoiding everywhere else in favour
      // of an explicit `…One`/`…Other` key pair, precisely because its plural-index mapping "isn't
      // straightforward to verify without a running app." Direct testing here did not reproduce a
      // concrete `count === 0` failure in either locale with the pipe form (vue-i18n's default
      // 2-choice rule maps 0 to the "other" index, and the app's own custom French override was
      // not observed to change that from a component-level `t()` call) — so this is a convention
      // fix, not a confirmed-regression fix: it removes reliance on framework plural-index
      // behaviour this codebase has already decided not to trust, in favour of the explicit
      // selection `JsonView.vue`/`UuidView.vue` use, which is what this test actually pins.
      mockOpen(0, { textLayer: "empty" });
      openMock.mockResolvedValueOnce(["/tmp/empty.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      expect(wrapper!.find(".chip").text()).toBe("0 pages");
    });
  });

  describe("selection (AC22)", () => {
    it("is a real listbox with per-row selected state", async () => {
      await openOneDocument();

      const list = wrapper!.find(".page-grid");
      expect(list.attributes("role")).toBe("listbox");
      expect(list.attributes("aria-multiselectable")).toBe("true");

      await wrapper!.findAll(".page-cell")[1].trigger("click");
      const rows = wrapper!.findAll(".page-cell");
      expect(rows[1].attributes("aria-selected")).toBe("true");
      expect(rows[0].attributes("aria-selected")).toBe("false");
    });

    it("moves real DOM focus onto a clicked cell, not only the visual selected state", async () => {
      // WebKit does not focus non-form elements on click by default (Chromium and Firefox do),
      // so a click that only updated reactive state left `document.activeElement` untouched —
      // the arrow-key handler below is bound to the grid and never received the keydown at all,
      // and the browser's native page-scroll ran instead (render review 2026-09-14).
      await openOneDocument(3);
      const cell = wrapper!.findAll(".page-cell")[1];

      await cell.trigger("click");

      expect(document.activeElement).toBe(cell.element);
    });

    it("toggles the focused row with Space, without a mouse", async () => {
      // NFR5 admits no exceptions. This is the keyboard path end-to-end, not the model unit test.
      await openOneDocument();

      const list = wrapper!.find(".page-grid");
      await list.trigger("keydown", { key: " " });
      expect(wrapper!.findAll(".page-cell")[0].attributes("aria-selected")).toBe("true");

      await list.trigger("keydown", { key: " " });
      expect(wrapper!.findAll(".page-cell")[0].attributes("aria-selected")).toBe("false");
    });

    it("extends a range with Shift+ArrowDown", async () => {
      await openOneDocument(4);

      const list = wrapper!.find(".page-grid");
      await list.trigger("keydown", { key: "ArrowDown", shiftKey: true });
      await flushPromises();

      const selected = wrapper!
        .findAll(".page-cell")
        .filter((row) => row.attributes("aria-selected") === "true")
        .map((row) => row.attributes("data-page"));
      // Which two, not merely two: a range anchored at the focused page and extended one step.
      expect(selected).toEqual(["1", "2"]);
    });

    it("moves through the grid in two dimensions, with Home and End (AC22/AC54)", async () => {
      // jsdom lays out one column, so Up/Down step by one here; Left/Right and Home/End are the
      // keys the list never had and the grid needs.
      await openOneDocument(6);
      const list = wrapper!.find(".page-grid");

      await list.trigger("keydown", { key: "ArrowRight" });
      await flushPromises();
      expect(document.activeElement?.getAttribute("data-page")).toBe("2");
      expect(rovingPages()).toEqual(["2"]);

      await list.trigger("keydown", { key: "End" });
      await flushPromises();
      expect(document.activeElement?.getAttribute("data-page")).toBe("6");
      expect(rovingPages()).toEqual(["6"]);

      await list.trigger("keydown", { key: "ArrowLeft" });
      await flushPromises();
      expect(document.activeElement?.getAttribute("data-page")).toBe("5");
      expect(rovingPages()).toEqual(["5"]);

      await list.trigger("keydown", { key: "Home" });
      await flushPromises();
      expect(document.activeElement?.getAttribute("data-page")).toBe("1");
      expect(rovingPages()).toEqual(["1"]);
    });

    it("stays on the current cell at a grid edge, rather than jumping to page 1 or the last page", async () => {
      // Render review 2026-09-14: `clampPage`'s saturating behaviour meant ArrowUp on the top row
      // (or ArrowLeft on the first cell) landed on page 1 from wherever focus actually was — a
      // large, unexplained jump the developer read as broken rather than as "there's nothing
      // above this row." Arrow keys with no cell in that direction are now a no-op; only Home/End
      // are a real jump to the edge.
      await openOneDocument(6);
      const list = wrapper!.find(".page-grid");

      // Real focus has to actually land somewhere first (Home always moves, even to where focus
      // already conceptually is) before a no-op can be told apart from "nothing was ever focused".
      await list.trigger("keydown", { key: "Home" });
      await flushPromises();
      expect(document.activeElement?.getAttribute("data-page")).toBe("1");
      expect(rovingPages()).toEqual(["1"]);

      await list.trigger("keydown", { key: "ArrowLeft" });
      await flushPromises();
      expect(document.activeElement?.getAttribute("data-page")).toBe("1");
      expect(rovingPages()).toEqual(["1"]);

      await list.trigger("keydown", { key: "End" });
      await flushPromises();
      expect(document.activeElement?.getAttribute("data-page")).toBe("6");
      expect(rovingPages()).toEqual(["6"]);

      await list.trigger("keydown", { key: "ArrowRight" });
      await flushPromises();
      expect(document.activeElement?.getAttribute("data-page")).toBe("6");
      expect(rovingPages()).toEqual(["6"]);
    });

    it("marks where the keyboard is with state, not with :focus-visible (render review 2026-09-14, second pass)", async () => {
      // `:focus-visible` is a browser heuristic ("did this look keyboard-like?") and it does not
      // reliably match a `.focus()` issued from a keydown handler after a microtask boundary —
      // which is exactly how `focusRow()` calls it. In the real WebView the ring appeared late,
      // on the wrong cell, or not at all. The marker is now the `roving-focus` class, bound
      // directly to `focusedPage` — the same ref that already drives `:tabindex`.
      //
      // jsdom applies no real stylesheet and cannot evaluate `:focus-visible`/`:focus-within`
      // against synthetic events, so this proves the CLASS is correctly bound to state across
      // every kind of move — not that a ring renders. That's exactly the mechanism the bug was
      // in, and exactly what no unit test could previously have caught; the live `pnpm tauri dev`
      // check is what closes the loop on pixels.
      await openOneDocument(6);
      expect(rovingPages()).toEqual(["1"]);

      await wrapper!.findAll(".page-cell")[2].trigger("click");
      expect(rovingPages()).toEqual(["3"]);

      const list = wrapper!.find(".page-grid");
      await list.trigger("keydown", { key: "ArrowRight" });
      await flushPromises();
      expect(rovingPages()).toEqual(["4"]);
      // A plain arrow move only moves FOCUS — the click's selection (page 3) must be untouched,
      // not extended to the cell focus just landed on.
      expect(
        wrapper!
          .findAll(".page-cell")
          .filter((cell) => cell.attributes("aria-selected") === "true")
          .map((cell) => cell.attributes("data-page")),
      ).toEqual(["3"]);

      await list.trigger("keydown", { key: "Home" });
      await flushPromises();
      expect(rovingPages()).toEqual(["1"]);

      await list.trigger("keydown", { key: "End" });
      await flushPromises();
      expect(rovingPages()).toEqual(["6"]);

      // No-op at the edge: the marker must stay exactly where it is, not vanish or duplicate.
      await list.trigger("keydown", { key: "ArrowRight" });
      await flushPromises();
      expect(rovingPages()).toEqual(["6"]);
    });

    it("keeps the keyboard marker on the moving end of a Shift-extended selection", async () => {
      // The one sequence where the two models genuinely diverge: Shift+arrow grows SELECTION,
      // a plain arrow afterwards moves FOCUS only. Proves `roving-focus` tracks `focusedPage`,
      // not `isSelected` — the two were easy to conflate since a click sets both to the same page.
      await openOneDocument(4);
      const list = wrapper!.find(".page-grid");

      await list.trigger("keydown", { key: "ArrowDown", shiftKey: true });
      await flushPromises();

      const selectedPages = () =>
        wrapper!
          .findAll(".page-cell")
          .filter((cell) => cell.attributes("aria-selected") === "true")
          .map((cell) => cell.attributes("data-page"));
      expect(selectedPages()).toEqual(["1", "2"]);
      expect(rovingPages()).toEqual(["2"]);

      await list.trigger("keydown", { key: "ArrowUp" });
      await flushPromises();

      expect(selectedPages()).toEqual(["1", "2"]);
      expect(rovingPages()).toEqual(["1"]);
    });

    it("selects every page with Cmd+A while focus is in the list", async () => {
      await openOneDocument(4);

      await wrapper!.find(".page-grid").trigger("keydown", { key: "a", metaKey: true });

      const selected = wrapper!
        .findAll(".page-cell")
        .filter((row) => row.attributes("aria-selected") === "true");
      expect(selected).toHaveLength(4);
    });

    it("announces the selected count as a status (AC22/AC29)", async () => {
      await openOneDocument(3);

      await wrapper!.find(".page-grid").trigger("keydown", { key: "a", metaKey: true });

      // Announced, not merely displayed — the live region is what a screen-reader user gets.
      expect(wrapper!.find("[role='status']").text()).toContain("3 pages selected");
    });
  });

  describe("the verb bar (AC23)", () => {
    it("offers document-scoped actions when nothing is selected", async () => {
      await openOneDocument();

      const labels = wrapper!.findAll(".verb-bar button").map((b) => b.text());
      expect(labels).toContain("Read text");
      expect(labels).toContain("Merge with…");
      expect(labels).not.toContain("Extract to new PDF");
    });

    it("offers exactly the five page verbs on a non-empty selection", async () => {
      await openOneDocument();
      await wrapper!.findAll(".page-cell")[0].trigger("click");

      const labels = wrapper!.findAll(".verb-bar button").map((b) => b.text());
      expect(labels).toEqual([
        "Extract to new PDF",
        "Rotate",
        "Move up",
        "Move down",
        "Delete",
      ]);
    });

    it("gives Delete the default treatment, never destructive red (AC23)", async () => {
      // DESIGN.md:149 rules that removing pages before saving is low-stakes and reversible. That
      // ruling is not re-derived here, and this asserts the code honours it.
      await openOneDocument();
      await wrapper!.findAll(".page-cell")[0].trigger("click");

      const del = wrapper!.findAll(".verb-bar button").find((b) => b.text() === "Delete");
      expect(del?.classes()).toContain("default");
      expect(del?.classes()).not.toContain("destructive");
    });

    it("extracts the selected pages to a chosen file", async () => {
      await openOneDocument(4);
      await wrapper!.findAll(".page-cell")[1].trigger("click");
      saveMock.mockResolvedValueOnce("/tmp/out.pdf");

      await clickButton(wrapper!, "Extract to new PDF");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("pdf_extract_pages", {
        path: "/tmp/report.pdf",
        startPage: 2,
        endPage: 2,
        outputPath: "/tmp/out.pdf",
      });
    });

    it("extracts a gapped selection as the selection, not the range it spans", async () => {
      // The bug this pins: ⌘-clicking pages 2 and 4 said "2 pages selected" and wrote pages 2-4.
      // Core has only a range command, so the selection is expressed by deleting its complement
      // into the destination.
      await openOneDocument(5);
      const cells = wrapper!.findAll(".page-cell");
      await cells[1].trigger("click");
      await cells[3].trigger("click", { metaKey: true });
      saveMock.mockResolvedValueOnce("/tmp/out.pdf");

      await clickButton(wrapper!, "Extract to new PDF");
      await flushPromises();

      expect(invokeMock).not.toHaveBeenCalledWith("pdf_extract_pages", expect.anything());
      expect(invokeMock).toHaveBeenCalledWith("pdf_delete_pages", {
        path: "/tmp/report.pdf",
        pageNumbers: [1, 3, 5],
        outputPath: "/tmp/out.pdf",
      });
    });

    it("rotates in place without asking where to save (AC52)", async () => {
      // The behaviour this pins is the render-review correction: *"if I select a page and click
      // rotate, it prompts me to save the file instead of just rotating the page."* An edit verb
      // acts on the working copy and asks nothing.
      await openOneDocument();
      await wrapper!.findAll(".page-cell")[0].trigger("click");

      const rotate = wrapper!.findAll("button").find((b) => b.text().includes("Rotate"))!;
      await rotate.trigger("click");
      await flushPromises();

      expect(saveMock).not.toHaveBeenCalled();
      expect(invokeMock).toHaveBeenCalledWith("pdf_begin_edit", { path: "/tmp/report.pdf" });
      expect(invokeMock).toHaveBeenCalledWith("pdf_rotate_pages", {
        path: "/tmp/working.pdf",
        pageNumbers: [1],
        quarterTurns: 1,
        outputPath: "/tmp/working.pdf",
      });
    });

    it("never writes to the file the user opened (AC52)", async () => {
      // The original is the one file this tool must not touch — an edit is reversible precisely
      // because closing without saving leaves it exactly as it was.
      await openOneDocument();
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      await clickButton(wrapper!, "Delete");
      await flushPromises();

      const wroteToOriginal = invokeMock.mock.calls.some(
        ([, args]) => (args as { outputPath?: string })?.outputPath === "/tmp/report.pdf",
      );
      expect(wroteToOriginal).toBe(false);
    });

    it("takes the working copy once, however many edits follow (AC52)", async () => {
      await openOneDocument();
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      await clickButton(wrapper!, "Delete");
      await flushPromises();
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      await clickButton(wrapper!, "Delete");
      await flushPromises();

      const begins = invokeMock.mock.calls.filter((call) => call[0] === "pdf_begin_edit");
      expect(begins).toHaveLength(1);
    });

    it("shows the edit immediately and re-reads the working copy to confirm it (AC52)", async () => {
      // Without this the operation succeeded and the list showed pre-edit pages, which is what
      // made the tool look broken even when it had worked. The grid is updated locally, then
      // `pdf_open` on the working copy confirms the page count agrees.
      mockEditableDocument(3);
      openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      await clickButton(wrapper!, "Delete");
      await flushPromises();

      const opens = invokeMock.mock.calls.filter((call) => call[0] === "pdf_open");
      expect(opens[opens.length - 1][1]).toEqual({ path: "/tmp/working.pdf" });
      const cells = wrapper!.findAll(".page-cell");
      expect(cells).toHaveLength(2);
      // Renumbered, and the surviving pages kept their text — nothing was re-fetched.
      expect(cells.map((c) => c.attributes("data-page"))).toEqual(["1", "2"]);
      expect(cells[0].text()).toContain("Heading 2");
      expect(requestedTextPages()).toEqual([[1, 2, 3]]);
    });

    describe("local application of edits (AC51/AC52)", () => {
      async function openEditable(pageCount = 4, canRenderPreviews = false) {
        mockEditableDocument(pageCount, canRenderPreviews);
        openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
        mountView();
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();
      }

      it("keeps a cell's identity across a move, so the grid can animate it (AC51)", async () => {
        await openEditable(4);
        const cells = wrapper!.findAll(".page-cell");
        const movedElement = cells[0].element;
        await cells[0].trigger("click");

        await clickButton(wrapper!, "Move down");
        await flushPromises();

        expect(invokeMock).toHaveBeenCalledWith("pdf_reorder_pages", {
          newOrder: [2, 1, 3, 4],
          path: "/tmp/working.pdf",
          outputPath: "/tmp/working.pdf",
        });
        const after = wrapper!.findAll(".page-cell");
        // The same DOM node, now second — which is the one thing FLIP needs.
        expect(after[1].element).toBe(movedElement);
        expect(after.map((c) => c.attributes("data-page"))).toEqual(["1", "2", "3", "4"]);
        expect(after[1].text()).toContain("Heading 1");
      });

      it("keeps the selection on the pages that moved, so moving again moves the same block", async () => {
        await openEditable(4);
        await wrapper!.findAll(".page-cell")[0].trigger("click");

        await clickButton(wrapper!, "Move down");
        await flushPromises();

        const selected = wrapper!
          .findAll(".page-cell")
          .filter((c) => c.attributes("aria-selected") === "true")
          .map((c) => c.attributes("data-page"));
        expect(selected).toEqual(["2"]);
      });

      it("keeps thumbnails across a move and re-fetches only a rotated page's", async () => {
        await openEditable(3, true);
        const before = wrapper!.findAll(".page-cell");
        expect(before[0].find("img.thumb").attributes("src")).toBe("data:image/png;base64,PNG1");
        await before[0].trigger("click");

        await clickButton(wrapper!, "Move down");
        await flushPromises();
        const renders = () => invokeMock.mock.calls.filter((call) => call[0] === "pdf_render_pages");
        expect(renders()).toHaveLength(1);
        expect(wrapper!.findAll(".page-cell")[1].find("img.thumb").attributes("src")).toBe(
          "data:image/png;base64,PNG1",
        );

        const rotate = wrapper!.findAll("button").find((b) => b.text().includes("Rotate"))!;
        await rotate.trigger("click");
        await flushPromises();
        // One more render, for the rotated page alone (now at position 2).
        expect(renders()).toHaveLength(2);
        expect((renders()[1][1] as { pageNumbers: number[] }).pageNumbers).toEqual([2]);
      });

      it("disables Move up at the top and Move down at the bottom rather than writing a no-op", async () => {
        await openEditable(3);
        const cells = wrapper!.findAll(".page-cell");
        await cells[0].trigger("click");

        const button = (text: string) => wrapper!.findAll("button").find((b) => b.text() === text)!;
        expect(button("Move up").attributes("disabled")).toBeDefined();
        expect(button("Move down").attributes("disabled")).toBeUndefined();

        await cells[2].trigger("click");
        expect(button("Move up").attributes("disabled")).toBeUndefined();
        expect(button("Move down").attributes("disabled")).toBeDefined();
        expect(invokeMock).not.toHaveBeenCalledWith("pdf_reorder_pages", expect.anything());
      });

      it("returns focus to the grid after an edit instead of dropping it on <body> (NFR5)", async () => {
        await openEditable(3);
        await wrapper!.findAll(".page-cell")[0].trigger("click");
        await clickButton(wrapper!, "Delete");
        await flushPromises();

        expect(document.activeElement?.classList.contains("page-cell")).toBe(true);
      });

      it("rebuilds the grid from the file if the local edit and the file ever disagree", async () => {
        // The verification step is not decorative: a wrong grid is worse than a blank one.
        mockOpen(3); // a working copy whose count never changes, i.e. the edit did not "take"
        openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
        mountView();
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();
        await wrapper!.findAll(".page-cell")[0].trigger("click");

        await clickButton(wrapper!, "Delete");
        await flushPromises();

        expect(wrapper!.findAll(".page-cell")).toHaveLength(3);
      });

      it("ignores an edit that finishes after its document was closed", async () => {
        let finishDelete: ((value: unknown) => void) | undefined;
        invokeMock.mockImplementation((command: string) => {
          if (command === "pdf_open") {
            return Promise.resolve({ pageCount: 2, textLayer: "partial", canRenderPreviews: false });
          }
          if (command === "pdf_page_text") {
            return Promise.resolve([{ page: 1, text: "A" }, { page: 2, text: "B" }]);
          }
          if (command === "pdf_begin_edit") return Promise.resolve("/tmp/working.pdf");
          if (command === "pdf_delete_pages") {
            return new Promise((resolve) => {
              finishDelete = resolve;
            });
          }
          return Promise.resolve(undefined);
        });
        openMock.mockResolvedValueOnce(["/tmp/first.pdf"]);
        mountView();
        await clickButton(wrapper!, "Open PDF…");
        await flushPromises();
        await wrapper!.findAll(".page-cell")[0].trigger("click");
        await clickButton(wrapper!, "Delete");
        await flushPromises();

        // A drop replaces the document while the delete is still in flight.
        useRegistryStore(pinia).dropResult = {
          toolId: "pdf",
          value: [{ path: "/tmp/second.pdf", pageCount: 2, textLayer: "partial" }],
        };
        await flushPromises();
        finishDelete!(undefined);
        await flushPromises();

        // The new document is not marked dirty by the old document's edit.
        expect(wrapper!.findAll("button").some((b) => b.text() === "Save a copy…")).toBe(false);
        expect(wrapper!.findAll(".page-cell")).toHaveLength(2);
      });
    });

    it("clears the selection after an edit rather than keeping stale page numbers (AC52)", async () => {
      // Deleting shifts every later page down and reordering moves them outright, so a selection
      // carried across an edit would silently point at different pages than the user chose.
      await openOneDocument(3);
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      await clickButton(wrapper!, "Delete");
      await flushPromises();

      const selected = wrapper!
        .findAll(".page-cell")
        .filter((row) => row.attributes("aria-selected") === "true");
      expect(selected).toHaveLength(0);
    });

    it("offers Save a copy only once there is something to save (AC52)", async () => {
      await openOneDocument();
      expect(wrapper!.findAll("button").some((b) => b.text() === "Save a copy…")).toBe(false);

      await wrapper!.findAll(".page-cell")[0].trigger("click");
      await clickButton(wrapper!, "Delete");
      await flushPromises();

      expect(wrapper!.findAll("button").some((b) => b.text() === "Save a copy…")).toBe(true);

      saveMock.mockResolvedValueOnce("/tmp/edited.pdf");
      await clickButton(wrapper!, "Save a copy…");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("pdf_save_copy", {
        path: "/tmp/working.pdf",
        outputPath: "/tmp/edited.pdf",
      });
      // Saved means no longer dirty — leaving the button up would imply work still pending.
      expect(wrapper!.findAll("button").some((b) => b.text() === "Save a copy…")).toBe(false);
    });

    it("does nothing when the save dialog is cancelled", async () => {
      await openOneDocument();
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      saveMock.mockResolvedValueOnce(null);

      await clickButton(wrapper!, "Extract to new PDF");
      await flushPromises();

      expect(invokeMock.mock.calls.some((call) => call[0] === "pdf_extract_pages")).toBe(false);
    });
  });

  describe("saving and errors (AC29/AC30/AC31)", () => {
    it("says what it saved, by basename", async () => {
      // Before this the tool wrote a file and said nothing at all — the user's only evidence was
      // opening Finder (deferred-work.md:154, assigned to this story by name).
      await openOneDocument();
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      saveMock.mockResolvedValueOnce("/tmp/secret-dir/out.pdf");

      await clickButton(wrapper!, "Extract to new PDF");
      await flushPromises();

      const status = wrapper!.find("[role='status']").text();
      expect(status).toContain("Saved out.pdf");
      expect(status).not.toContain("/tmp/secret-dir");
      // And SHOWN, not only announced: the live region is clipped off-screen, and a sighted user
      // who extracted pages otherwise saw nothing change.
      expect(wrapper!.find(".completion").text()).toContain("Saved out.pdf");
    });

    it("keeps an operation error out of the document scope, and vice versa (AC31)", async () => {
      // The single shared `pdfError` meant an error raised by one flow was silently cleared by an
      // unrelated click in another. The two scopes are now independent.
      await openOneDocument();
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      saveMock.mockResolvedValueOnce("/tmp/out.pdf");
      invokeMock.mockRejectedValueOnce({
        code: "pdf-invalid-range",
        message: "the requested page range does not exist in this document",
        position: null,
        // AC38: the numbers ride here, not in the prose, and the view renders the translated
        // sentence with them interpolated back in — this is the end-to-end proof of that seam,
        // asserted where a user would actually see it.
        context: JSON.stringify({ startPage: 4, endPage: 4, totalPages: 3 }),
      });

      await clickButton(wrapper!, "Extract to new PDF");
      await flushPromises();

      const alert = wrapper!.find("[role='alert']");
      expect(alert.exists()).toBe(true);
      expect(alert.text()).toContain("That page range isn't in this document");
      expect(alert.text()).toContain("page 3");

      // The other scope, raised afterwards, does not clear it — and the reverse holds.
      // ⌘-click toggles the one selected page off, which brings the document-scoped verbs back.
      await wrapper!.findAll(".page-cell")[0].trigger("click", { metaKey: true });
      invokeMock.mockRejectedValueOnce({
        code: "pdf-corrupt",
        message: "unreadable",
        position: null,
        context: null,
      });
      await clickButton(wrapper!, "Read text");
      await flushPromises();
      const alerts = wrapper!.findAll("[role='alert']").map((a) => a.text());
      expect(alerts).toHaveLength(2);
      expect(alerts.some((text) => text.includes("page 3"))).toBe(true);
      expect(alerts.some((text) => text.includes("unreadable"))).toBe(true);
    });

    it("reports a failure to open in the document scope", async () => {
      invokeMock.mockRejectedValueOnce({
        code: "pdf-encrypted",
        message: "PDF is encrypted with a password and cannot be processed",
        position: null,
        context: null,
      });
      openMock.mockResolvedValueOnce(["/tmp/locked.pdf"]);
      mountView();

      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("password-protected");
    });
  });

  describe("reading text (AC28/AC40)", () => {
    it("reads the document's text and copies it with confirmation", async () => {
      await openOneDocument();
      invokeMock.mockResolvedValueOnce("Hello from a real PDF");

      await clickButton(wrapper!, "Read text");
      await flushPromises();

      const textarea = wrapper!.find<HTMLTextAreaElement>("#pdf-extracted-text");
      expect(textarea.element.value).toBe("Hello from a real PDF");

      writeClipboardTextMock.mockResolvedValueOnce(undefined);
      await clickButton(wrapper!, "Copy");
      await flushPromises();

      expect(writeClipboardTextMock).toHaveBeenCalledWith("Hello from a real PDF");
      expect(wrapper!.text()).toContain("Copied");
    });

    it("never confirms a failed copy", async () => {
      // A false "Copied" is worse than no feedback: the user walks away believing they have it.
      await openOneDocument();
      invokeMock.mockResolvedValueOnce("Hello");
      await clickButton(wrapper!, "Read text");
      await flushPromises();

      writeClipboardTextMock.mockRejectedValueOnce(new Error("clipboard unavailable"));
      await clickButton(wrapper!, "Copy");
      await flushPromises();

      expect(wrapper!.text()).not.toContain("Copied");
    });
  });

  describe("drop and hand-off (AC33/AC34/AC37)", () => {
    function store() {
      return useRegistryStore(pinia);
    }

    it("opens a single dropped PDF straight into the document surface", async () => {
      mockOpen(3);
      mountView();

      store().dropResult = {
        toolId: "pdf",
        value: [{ path: "/tmp/dropped.pdf", pageCount: 3, textLayer: "partial" }],
      };
      await flushPromises();

      expect(wrapper!.text()).toContain("dropped.pdf");
      expect(wrapper!.findAll(".page-cell")).toHaveLength(3);
    });

    it("starts a merge queue when several PDFs are dropped at once (AC33)", async () => {
      // The gesture Story 6.1 called the most obvious drop use for this tool, and the one the
      // shell's `paths![0]` truncation made impossible.
      mockOpen(1);
      mountView();

      store().dropResult = {
        toolId: "pdf",
        value: [
          { path: "/tmp/a.pdf", pageCount: 2, textLayer: "partial" },
          { path: "/tmp/b.pdf", pageCount: 5, textLayer: "partial" },
        ],
      };
      await flushPromises();

      expect(wrapper!.text()).toContain("Merge queue");
      const rows = wrapper!.findAll(".file-list li");
      expect(rows).toHaveLength(2);
      // Page counts come from the drop's own result — no second round trip per file.
      expect(rows[0].text()).toContain("2 pages");
      expect(rows[1].text()).toContain("5 pages");
    });

    it("ignores a drop result belonging to another tool", async () => {
      mockOpen(1);
      mountView();

      store().dropResult = { toolId: "ocr", value: [{ path: "/tmp/x.pdf", pageCount: 1 }] };
      await flushPromises();

      expect(wrapper!.find(".drop-target").exists()).toBe(true);
    });

    it("surfaces a failed drop in the document scope rather than silently doing nothing", async () => {
      mockOpen(1);
      mountView();

      store().dropResult = {
        toolId: "pdf",
        error: {
          code: "pdf-encrypted",
          message: "PDF is encrypted with a password and cannot be processed",
          position: null,
          context: null,
        },
      };
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("password-protected");
    });

    it("opens a document handed across from another tool (AC37)", async () => {
      // Story 8.7's third hand-off. The offer carries the file, so this lands on a loaded
      // document rather than an empty view demanding the user re-pick what they just dropped.
      mockOpen(2);
      pinia = createPinia();
      const registry = useRegistryStore(pinia);
      registry.handOffPath = { toolId: "pdf", path: "/tmp/carried.pdf" };
      wrapper = mount(PdfView, { global: { plugins: [pinia] }, attachTo: document.body });
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("pdf_open", { path: "/tmp/carried.pdf" });
      expect(wrapper!.text()).toContain("carried.pdf");
      // One-shot: consumed and cleared, so navigating back later does not re-open it.
      expect(registry.handOffPath).toBeNull();
    });

    it("opens a handed-off document even when a merge queue is on screen", async () => {
      // "Open in the PDF tool" means open. The first build appended the file to the queue.
      mockOpen(2);
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();
      expect(wrapper!.text()).toContain("Merge queue");

      store().handOffPath = { toolId: "pdf", path: "/tmp/carried.pdf" };
      await flushPromises();

      expect(wrapper!.text()).not.toContain("Merge queue");
      expect(wrapper!.text()).toContain("carried.pdf");
      expect(wrapper!.findAll(".page-cell")).toHaveLength(2);
    });

    it("shows a failed drop while the queue is on screen (AC31)", async () => {
      // The queue panel used to render only the operation scope, so an encrypted file dropped
      // onto a queue produced nothing at all.
      mockOpen(2);
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      store().dropResult = {
        toolId: "pdf",
        error: { code: "pdf-encrypted", message: "encrypted", position: null, context: null },
      };
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("password-protected");
    });
  });

  describe("unsaved edits (AC52, code review 2026-09-13)", () => {
    async function openAndRotate() {
      await openOneDocument(3);
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      const rotate = wrapper!.findAll("button").find((b) => b.text().includes("Rotate"))!;
      await rotate.trigger("click");
      await flushPromises();
      expect(wrapper!.findAll("button").some((b) => b.text() === "Save a copy…")).toBe(true);
    }

    it("asks before closing a document with unsaved edits, and keeps it on Cancel", async () => {
      await openAndRotate();
      askMock.mockResolvedValueOnce(false);

      await clickButtonByLabel(wrapper!, "Close");
      await flushPromises();

      expect(askMock).toHaveBeenCalledTimes(1);
      expect((askMock.mock.calls[0][0] as string)).toContain("report.pdf");
      expect(wrapper!.text()).toContain("report.pdf");
    });

    it("discards when the user confirms", async () => {
      await openAndRotate();
      askMock.mockResolvedValueOnce(true);

      await clickButtonByLabel(wrapper!, "Close");
      await flushPromises();

      expect(wrapper!.find(".drop-target").exists()).toBe(true);
    });

    it("asks before a dropped file replaces a document with unsaved edits", async () => {
      await openAndRotate();
      askMock.mockResolvedValueOnce(false);

      useRegistryStore(pinia).dropResult = {
        toolId: "pdf",
        value: [{ path: "/tmp/other.pdf", pageCount: 1, textLayer: "partial" }],
      };
      await flushPromises();

      expect(askMock).toHaveBeenCalledTimes(1);
      expect(wrapper!.text()).toContain("report.pdf");
      expect(wrapper!.text()).not.toContain("other.pdf");
    });

    it("does not ask when there is nothing to lose", async () => {
      await openOneDocument(3);

      await clickButtonByLabel(wrapper!, "Close");
      await flushPromises();

      expect(askMock).not.toHaveBeenCalled();
      expect(wrapper!.find(".drop-target").exists()).toBe(true);
    });
  });

  describe("Merge with… (AC23/AC24, code review 2026-09-13)", () => {
    it("queues the open document with ONE picked file instead of replacing it", async () => {
      // The most natural merge gesture — this document plus one other — used to close the
      // document and open the other one.
      await openOneDocument(3);
      openMock.mockResolvedValueOnce(["/tmp/other.pdf"]);

      await clickButton(wrapper!, "Merge with…");
      await flushPromises();

      expect(wrapper!.text()).toContain("Merge queue");
      const names = wrapper!.findAll(".file-list li").map((li) => li.text());
      expect(names).toHaveLength(2);
      expect(names[0]).toContain("report.pdf");
      expect(names[1]).toContain("other.pdf");
    });

    it("merges the EDITED document, shown under the name the user opened", async () => {
      await openOneDocument(3);
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      const rotate = wrapper!.findAll("button").find((b) => b.text().includes("Rotate"))!;
      await rotate.trigger("click");
      await flushPromises();
      // The selection survives a rotate (so it can be rotated again); clear it to reach the
      // document-scoped verbs.
      await wrapper!.findAll(".page-cell")[0].trigger("click", { metaKey: true });
      openMock.mockResolvedValueOnce(["/tmp/other.pdf"]);
      await clickButton(wrapper!, "Merge with…");
      await flushPromises();
      saveMock.mockResolvedValueOnce("/tmp/merged.pdf");

      const first = wrapper!.findAll(".file-list li")[0];
      expect(first.text()).toContain("report.pdf");
      expect(first.find(".file-name").attributes("title")).toBe("/tmp/report.pdf");
      await clickButton(wrapper!, "Merge PDFs");
      await flushPromises();

      // The working copy is what gets merged — the rotation is in the output.
      expect(invokeMock).toHaveBeenCalledWith("pdf_merge", {
        paths: ["/tmp/working.pdf", "/tmp/other.pdf"],
        outputPath: "/tmp/merged.pdf",
      });
    });

    it("never queues the same file twice", async () => {
      await openOneDocument(3);
      openMock.mockResolvedValueOnce(["/tmp/report.pdf", "/tmp/other.pdf", "/tmp/other.pdf"]);

      await clickButton(wrapper!, "Merge with…");
      await flushPromises();

      expect(wrapper!.findAll(".file-list li")).toHaveLength(2);
    });

    it("shows on its row why a queued file's count could not be read", async () => {
      invokeMock.mockImplementation((command: string, args?: { path?: string }) => {
        if (command === "pdf_open" && args?.path === "/tmp/locked.pdf") {
          return Promise.reject({
            code: "pdf-encrypted",
            message: "encrypted",
            position: null,
            context: null,
          });
        }
        if (command === "pdf_open") {
          return Promise.resolve({ pageCount: 2, textLayer: "partial", canRenderPreviews: false });
        }
        return Promise.resolve(undefined);
      });
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/locked.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      const rows = wrapper!.findAll(".file-list li");
      expect(rows[0].text()).toContain("2 pages");
      expect(rows[1].text()).toContain("password-protected");
    });
  });

  describe("opening (AC29, code review 2026-09-13)", () => {
    it("shows the document's name and an Opening… hint while the parse runs", async () => {
      let finishOpen: ((value: unknown) => void) | undefined;
      invokeMock.mockImplementation((command: string) => {
        if (command === "pdf_open") {
          return new Promise((resolve) => {
            finishOpen = resolve;
          });
        }
        return Promise.resolve([]);
      });
      openMock.mockResolvedValueOnce(["/tmp/slow.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();

      // The resting surface is gone and the header is up before a single byte has been parsed.
      expect(wrapper!.find(".drop-target").exists()).toBe(false);
      expect(wrapper!.text()).toContain("slow.pdf");
      expect(wrapper!.text()).toContain("Opening…");

      finishOpen!({ pageCount: 1, textLayer: "partial", canRenderPreviews: false });
      await flushPromises();
      expect(wrapper!.text()).not.toContain("Opening…");
      expect(wrapper!.findAll(".page-cell")).toHaveLength(1);
    });
  });

  describe("display changes (AC55b)", () => {
    it("re-renders previews when the device pixel ratio changes under the window", async () => {
      // `devicePixelRatio` is not reactive; the view listens for the `(resolution:)` media query
      // to stop matching, which is what happens when the window is dragged to another display.
      let changeListener: (() => void) | undefined;
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: true,
        media: query,
        addEventListener: (_: string, listener: () => void) => {
          changeListener = listener;
        },
        removeEventListener: () => {},
      }));
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
      invokeMock.mockImplementation((command: string) => {
        if (command === "pdf_open") {
          return Promise.resolve({ pageCount: 1, textLayer: "partial", canRenderPreviews: true });
        }
        if (command === "pdf_page_text") return Promise.resolve([{ page: 1, text: "A" }]);
        if (command === "pdf_render_pages") return Promise.resolve([{ page: 1, pngBase64: "AA" }]);
        return Promise.resolve(undefined);
      });
      openMock.mockResolvedValueOnce(["/tmp/report.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();
      const widths = () =>
        invokeMock.mock.calls
          .filter((call) => call[0] === "pdf_render_pages")
          .map((call) => (call[1] as { maxWidth: number }).maxWidth);
      expect(widths()).toEqual([296]);

      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
      changeListener!();
      await flushPromises();

      expect(widths()).toEqual([296, 148]);
      Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
    });
  });

  describe("the merge queue (AC24)", () => {
    async function openQueue() {
      mockOpen(2);
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      mountView();
      await clickButton(wrapper!, "Open PDF…");
      await flushPromises();
    }

    it("enters the queue state when several PDFs are chosen at once", async () => {
      await openQueue();

      expect(wrapper!.text()).toContain("Merge queue");
      expect(wrapper!.findAll(".file-list li")).toHaveLength(2);
      // A mutually-exclusive STATE of the same view, not a tab and not a second surface — so the
      // document surface must not be on screen at the same time.
      expect(wrapper!.findAll(".page-grid")).toHaveLength(0);
    });

    it("lists each document by basename with its page count", async () => {
      await openQueue();

      const first = wrapper!.findAll(".file-list li")[0];
      expect(first.text()).toContain("a.pdf");
      expect(first.text()).toContain("2 pages");
      expect(first.text()).not.toContain("/tmp/");
    });

    it("reorders and removes queue entries", async () => {
      await openQueue();

      await clickButtonByLabel(wrapper!, "Move down");
      await flushPromises();
      let names = wrapper!.findAll(".file-list li").map((li) => li.text());
      expect(names[0]).toContain("b.pdf");

      await clickButton(wrapper!, "Remove");
      await flushPromises();
      names = wrapper!.findAll(".file-list li").map((li) => li.text());
      expect(names).toHaveLength(1);
      expect(names[0]).toContain("a.pdf");
    });

    it("keeps a row's identity across a move, so the reorder transition can run (AC50)", async () => {
      // `<TransitionGroup>` runs FLIP only if Vue recognises a moved row as the SAME element
      // relocated, which it decides purely from `:key`. A key that changes on move (the old
      // `path + index`) makes Vue destroy and rebuild the row, leaving nothing to animate — and
      // that regression is invisible to every other assertion here, and to jsdom, which runs no
      // transitions at all.
      await openQueue();

      const before = wrapper!.findAll(".file-list li")[0].element;
      await clickButtonByLabel(wrapper!, "Move down");
      await flushPromises();

      const rows = wrapper!.findAll(".file-list li");
      expect(rows[1].element).toBe(before);
    });

    it("merges in list order with the primary button, and clears on success", async () => {
      await openQueue();
      saveMock.mockResolvedValueOnce("/tmp/merged.pdf");

      const merge = wrapper!.findAll("button").find((b) => b.text() === "Merge PDFs")!;
      // DESIGN.md:183 names this as the worked example of the Primary/Signature variant.
      expect(merge.classes()).toContain("primary");

      await merge.trigger("click");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("pdf_merge", {
        paths: ["/tmp/a.pdf", "/tmp/b.pdf"],
        outputPath: "/tmp/merged.pdf",
      });
      expect(wrapper!.text()).toContain("Drop a PDF here");
    });

    it("disables merge below two documents", async () => {
      await openQueue();
      await clickButton(wrapper!, "Remove");
      await flushPromises();

      const merge = wrapper!.findAll("button").find((b) => b.text() === "Merge PDFs");
      expect(merge?.attributes("disabled")).toBeDefined();
    });
  });
});
