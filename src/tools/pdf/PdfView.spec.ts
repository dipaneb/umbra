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

const { writeClipboardTextMock, invokeMock, openMock, saveMock } = vi.hoisted(() => ({
  writeClipboardTextMock: vi.fn(),
  invokeMock: vi.fn(),
  openMock: vi.fn(),
  saveMock: vi.fn(),
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
}));

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
  vi.useRealTimers();
});

function mountView() {
  pinia = createPinia();
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

      const grid = wrapper!.find("ul.page-grid");
      // Medium is the default; the class is what drives the grid's track width.
      expect(grid.classes()).toContain("size-m");

      const large = wrapper!.findAll(".size-option").find((b) => b.text() === "L")!;
      await large.trigger("click");
      await flushPromises();

      expect(wrapper!.find("ul.page-grid").classes()).toContain("size-l");
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
      // contract; the exact number is not.
      await openOneDocument(400);

      const textCall = invokeMock.mock.calls.find((call) => call[0] === "pdf_page_text");
      const requested = (textCall?.[1] as { pageNumbers: number[] }).pageNumbers;
      expect(requested.length).toBeLessThan(400);
      expect(requested[0]).toBe(1);
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
  });

  describe("selection (AC22)", () => {
    it("is a real listbox with per-row selected state", async () => {
      await openOneDocument();

      const list = wrapper!.find("ul.page-grid");
      expect(list.attributes("role")).toBe("listbox");
      expect(list.attributes("aria-multiselectable")).toBe("true");

      await wrapper!.findAll(".page-cell")[1].trigger("click");
      const rows = wrapper!.findAll(".page-cell");
      expect(rows[1].attributes("aria-selected")).toBe("true");
      expect(rows[0].attributes("aria-selected")).toBe("false");
    });

    it("toggles the focused row with Space, without a mouse", async () => {
      // NFR5 admits no exceptions. This is the keyboard path end-to-end, not the model unit test.
      await openOneDocument();

      const list = wrapper!.find("ul.page-grid");
      await list.trigger("keydown", { key: " " });
      expect(wrapper!.findAll(".page-cell")[0].attributes("aria-selected")).toBe("true");

      await list.trigger("keydown", { key: " " });
      expect(wrapper!.findAll(".page-cell")[0].attributes("aria-selected")).toBe("false");
    });

    it("extends a range with Shift+ArrowDown", async () => {
      await openOneDocument(4);

      const list = wrapper!.find("ul.page-grid");
      await list.trigger("keydown", { key: "ArrowDown", shiftKey: true });
      await flushPromises();

      const selected = wrapper!
        .findAll(".page-cell")
        .filter((row) => row.attributes("aria-selected") === "true");
      expect(selected).toHaveLength(2);
    });

    it("selects every page with Cmd+A while focus is in the list", async () => {
      await openOneDocument(4);

      await wrapper!.find("ul.page-grid").trigger("keydown", { key: "a", metaKey: true });

      const selected = wrapper!
        .findAll(".page-cell")
        .filter((row) => row.attributes("aria-selected") === "true");
      expect(selected).toHaveLength(4);
    });

    it("announces the selected count as a status (AC22/AC29)", async () => {
      await openOneDocument(3);

      await wrapper!.find("ul.page-grid").trigger("keydown", { key: "a", metaKey: true });

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

    it("reloads the page list after an edit so the change is visible (AC52)", async () => {
      // Without this the operation succeeded and the list showed pre-edit pages, which is what
      // made the tool look broken even when it had worked.
      await openOneDocument(3);
      await wrapper!.findAll(".page-cell")[0].trigger("click");
      await clickButton(wrapper!, "Delete");
      await flushPromises();

      const opens = invokeMock.mock.calls.filter((call) => call[0] === "pdf_open");
      expect(opens.length).toBeGreaterThan(1);
      expect(opens[opens.length - 1][1]).toEqual({ path: "/tmp/working.pdf" });
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
