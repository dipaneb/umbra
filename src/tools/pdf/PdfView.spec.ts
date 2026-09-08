import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import PdfView from "./PdfView.vue";

// Story 8.7 slice 2 (AC9): the 13 `it()` blocks below are the `describe("PDF section")`
// block of the former BucketView.spec.ts, moved with nothing changed but the import
// path and the mount target — every assertion string, every mock and every `bucket_*`
// command name is byte-identical. The harness above is the same file's, minus the OCR
// helpers this view has no use for (an unused binding fails `--max-warnings 0`).

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

// Mirrors Base64View.spec.ts's own established save()-mocking shape exactly (same package, same
// call pattern already proven in this codebase) — `open` mocked the same way for the PDF
// section's file pickers.
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
  save: (...args: unknown[]) => saveMock(...args),
}));

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

// The Image section's live estimate is debounced (src/shell/debounce.ts). Fake timers mean a
// test's pending debounce timeout simply never fires unless explicitly advanced — real timers
// would instead leave it dangling into whichever test runs next, letting it steal a queued
// invoke mock response. Same rationale as JsonView.spec.ts's own live tree-parse fake-timer setup.
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
  wrapper = mount(PdfView, { global: { plugins: [pinia] } });
  return wrapper;
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

describe("PdfView", () => {
  // Story 6.1: PDF section. Deliberately disjoint from the OCR section's own outcome/editedText/
  // error state (see PdfView.vue's own AD-16 comment) — mocks `@tauri-apps/plugin-dialog`'s
  // `open`/`save` and `@tauri-apps/api/core`'s `invoke`, mirroring Base64View.spec.ts's own
  // established save()-mocking shape exactly.
  describe("PDF section", () => {
    it("adds files selected via the multi-file picker to the merge list (AC1)", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      mountView();

      await clickButton(wrapper!, "Add PDFs…");
      await flushPromises();

      expect(openMock).toHaveBeenCalledWith({
        multiple: true,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      expect(wrapper!.text()).toContain("/tmp/a.pdf");
      expect(wrapper!.text()).toContain("/tmp/b.pdf");
    });

    it("disables Merge below 2 files and enables it at 2 (AC1)", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.pdf"]);
      mountView();

      let mergeButton = wrapper!.findAll("button").find((b) => b.text() === "Merge");
      expect(mergeButton?.attributes("disabled")).toBeDefined();

      await clickButton(wrapper!, "Add PDFs…");
      await flushPromises();
      mergeButton = wrapper!.findAll("button").find((b) => b.text() === "Merge");
      expect(mergeButton?.attributes("disabled")).toBeDefined();

      openMock.mockResolvedValueOnce(["/tmp/b.pdf"]);
      await clickButton(wrapper!, "Add PDFs…");
      await flushPromises();
      mergeButton = wrapper!.findAll("button").find((b) => b.text() === "Merge");
      expect(mergeButton?.attributes("disabled")).toBeUndefined();
    });

    it("merges the chosen files in list order via the save dialog and clears the list (AC1)", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      saveMock.mockResolvedValueOnce("/tmp/merged.pdf");
      invokeMock.mockResolvedValueOnce(undefined);
      mountView();

      await clickButton(wrapper!, "Add PDFs…");
      await flushPromises();
      await clickButton(wrapper!, "Merge");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("bucket_merge_pdfs", {
        paths: ["/tmp/a.pdf", "/tmp/b.pdf"],
        outputPath: "/tmp/merged.pdf",
      });
      expect(wrapper!.text()).not.toContain("/tmp/a.pdf");
    });

    it("reorders merge files with the up/down controls (AC1)", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      mountView();

      await clickButton(wrapper!, "Add PDFs…");
      await flushPromises();

      const items = wrapper!.findAll("li").map((li) => li.text());
      expect(items[0]).toContain("/tmp/a.pdf");

      await clickButton(wrapper!, "↓");
      await flushPromises();

      const reordered = wrapper!.findAll("li").map((li) => li.text());
      expect(reordered[0]).toContain("/tmp/b.pdf");
      expect(reordered[1]).toContain("/tmp/a.pdf");
    });

    it("removes a file from the merge list (AC1)", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      mountView();

      await clickButton(wrapper!, "Add PDFs…");
      await flushPromises();
      await clickButton(wrapper!, "Remove");
      await flushPromises();

      expect(wrapper!.text()).not.toContain("/tmp/a.pdf");
      expect(wrapper!.text()).toContain("/tmp/b.pdf");
    });

    it("does nothing when the merge save dialog is cancelled", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      saveMock.mockResolvedValueOnce(null);
      mountView();

      await clickButton(wrapper!, "Add PDFs…");
      await flushPromises();
      await clickButton(wrapper!, "Merge");
      await flushPromises();

      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("renders a bucket-pdf-too-few-files ToolError from a failed merge", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.pdf", "/tmp/b.pdf"]);
      saveMock.mockResolvedValueOnce("/tmp/merged.pdf");
      invokeMock.mockRejectedValueOnce({
        code: "bucket-pdf-too-few-files",
        message: "merge requires at least 2 PDFs, got 1",
        position: null,
        context: null,
      });
      mountView();

      await clickButton(wrapper!, "Add PDFs…");
      await flushPromises();
      await clickButton(wrapper!, "Merge");
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("at least 2 PDFs");
    });

    it("extracts a page range via the chosen file and save dialog (AC2)", async () => {
      openMock.mockResolvedValueOnce("/tmp/doc.pdf");
      saveMock.mockResolvedValueOnce("/tmp/extracted.pdf");
      invokeMock.mockResolvedValueOnce(undefined);
      mountView();

      await clickButton(wrapper!, "Choose PDF…");
      await flushPromises();
      await wrapper!.find("#pdf-start-page").setValue(2);
      await wrapper!.find("#pdf-end-page").setValue(3);
      await clickButton(wrapper!, "Extract pages");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("bucket_extract_pdf_pages", {
        path: "/tmp/doc.pdf",
        startPage: 2,
        endPage: 3,
        outputPath: "/tmp/extracted.pdf",
      });
    });

    it("disables Extract pages until a file is chosen, and for an invalid client-side range (AC2)", async () => {
      openMock.mockResolvedValueOnce("/tmp/doc.pdf");
      mountView();

      let extractButton = wrapper!.findAll("button").find((b) => b.text() === "Extract pages");
      expect(extractButton?.attributes("disabled")).toBeDefined();

      await clickButton(wrapper!, "Choose PDF…");
      await flushPromises();
      extractButton = wrapper!.findAll("button").find((b) => b.text() === "Extract pages");
      expect(extractButton?.attributes("disabled")).toBeUndefined();

      await wrapper!.find("#pdf-start-page").setValue(5);
      await wrapper!.find("#pdf-end-page").setValue(2);
      extractButton = wrapper!.findAll("button").find((b) => b.text() === "Extract pages");
      expect(extractButton?.attributes("disabled")).toBeDefined();
    });

    it("renders a bucket-pdf-invalid-range ToolError from a failed extract-pages call", async () => {
      openMock.mockResolvedValueOnce("/tmp/doc.pdf");
      saveMock.mockResolvedValueOnce("/tmp/extracted.pdf");
      invokeMock.mockRejectedValueOnce({
        code: "bucket-pdf-invalid-range",
        message: "page range 1-5 is invalid for a 2-page document",
        position: null,
        context: null,
      });
      mountView();

      await clickButton(wrapper!, "Choose PDF…");
      await flushPromises();
      await clickButton(wrapper!, "Extract pages");
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("is invalid for a 2-page document");
    });

    it("extracts and displays editable text with one-click copy (AC3)", async () => {
      // Two "Choose PDF…" buttons exist (extract-pages and extract-text sections) — the second
      // match is this test's target.
      openMock.mockResolvedValueOnce("/tmp/text.pdf");
      invokeMock.mockResolvedValueOnce("Hello from a real PDF");
      writeClipboardTextMock.mockResolvedValueOnce(undefined);
      mountView();

      const choosePdfButtons = wrapper!.findAll("button").filter((b) => b.text() === "Choose PDF…");
      await choosePdfButtons[1].trigger("click");
      await flushPromises();
      await clickButton(wrapper!, "Extract text");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("bucket_extract_pdf_text", { path: "/tmp/text.pdf" });
      const pdfTextarea = wrapper!.find<HTMLTextAreaElement>("#pdf-extracted-text");
      expect(pdfTextarea.element.value).toBe("Hello from a real PDF");

      const copyButtons = wrapper!.findAll("button").filter((b) => b.text() === "Copy");
      await copyButtons[copyButtons.length - 1].trigger("click");
      await flushPromises();
      expect(writeClipboardTextMock).toHaveBeenCalledWith("Hello from a real PDF");
    });

    it("disables Extract text until a file is chosen (AC3)", () => {
      mountView();
      const extractTextButton = wrapper!.findAll("button").find((b) => b.text() === "Extract text");
      expect(extractTextButton?.attributes("disabled")).toBeDefined();
    });

    it("renders a bucket-pdf-corrupt ToolError from a failed extract-text call", async () => {
      openMock.mockResolvedValueOnce("/tmp/corrupt.pdf");
      invokeMock.mockRejectedValueOnce({
        code: "bucket-pdf-corrupt",
        message: "PDF could not be parsed",
        position: null,
        context: null,
      });
      mountView();

      const choosePdfButtons = wrapper!.findAll("button").filter((b) => b.text() === "Choose PDF…");
      await choosePdfButtons[1].trigger("click");
      await flushPromises();
      await clickButton(wrapper!, "Extract text");
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("PDF could not be parsed");
    });
  });
});
