import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import BucketView from "./BucketView.vue";
import { useRegistryStore } from "../../stores/registry";

const SAMPLE_OUTCOME = { text: "UMBRA OCR TEST", confidence: 0.97 };
const SAMPLE_EMPTY_OUTCOME = { text: "", confidence: null };
const SAMPLE_WHITESPACE_OUTCOME = { text: "\n", confidence: null };

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
  wrapper = mount(BucketView, { global: { plugins: [pinia] } });
  return wrapper;
}

function resultTextarea() {
  return wrapper!.find<HTMLTextAreaElement>(".result");
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

// AD-14/AD-16: DropZone.vue is the shell's single generic dispatcher — it invokes
// `bucket_extract_text` (drop) and `bucket_extract_text_from_clipboard` (paste, Story 4.2)
// itself, already routing both through `registry.getLatestWinsRunner("bucket")` on its own (see
// registry.ts/DropZone.vue). BucketView.vue has no manual invoke trigger of its own, so there is
// no local `createLatestWinsRunner()` to get wrong here: the view only ever consumes an
// already-arrived outcome via `registry.dropResult`/`registry.pasteResult`, exactly like
// HashView.vue's own drop-result handling. These tests exercise that consumption contract
// directly, matching HashView.spec.ts's own drop-result tests, rather than going through a real
// DropZone.vue + Tauri event mock.

describe("BucketView", () => {
  it("shows the drop hint before any drop has happened (AC1)", () => {
    mountView();
    expect(wrapper!.text()).toContain("Drop a PNG, JPEG, or WebP image");
    expect(wrapper!.text()).toContain("paste (⌘V)");
  });

  it("consumes a successful drop result into an editable text field and clears the signal (AC1, AC2)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
    await flushPromises();

    expect(resultTextarea().element.value).toBe(SAMPLE_OUTCOME.text);
    expect(registry.dropResult).toBeNull();
  });

  it("consumes a successful paste result the same way as a drop result (AC1, AC2)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.pasteResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
    await flushPromises();

    expect(resultTextarea().element.value).toBe(SAMPLE_OUTCOME.text);
    expect(registry.pasteResult).toBeNull();
  });

  it("ignores a drop result routed to a different tool", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "hash", value: { irrelevant: true } };
    await flushPromises();

    expect(resultTextarea().exists()).toBe(false);
  });

  it("ignores a paste result routed to a different tool", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.pasteResult = { toolId: "hash", value: { irrelevant: true } };
    await flushPromises();

    expect(resultTextarea().exists()).toBe(false);
  });

  it("states explicitly that no text was found for an empty-text drop result, instead of a blank textarea (AC1)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "bucket", value: SAMPLE_EMPTY_OUTCOME };
    await flushPromises();

    const status = wrapper!.find("[role='status']");
    expect(status.exists()).toBe(true);
    expect(status.text()).toContain("No text was found in this image.");
    expect(resultTextarea().exists()).toBe(false);
    // Scoped to the OCR section's own Copy button specifically, not "no button anywhere" — the
    // PDF section (Story 6.1) always renders its own buttons regardless of OCR outcome state.
    expect(wrapper!.findAll("button").find((b) => b.text() === "Copy")).toBeUndefined();
  });

  it("states explicitly that no text was found for an empty-text paste result, instead of a blank textarea (AC1)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.pasteResult = { toolId: "bucket", value: SAMPLE_EMPTY_OUTCOME };
    await flushPromises();

    const status = wrapper!.find("[role='status']");
    expect(status.exists()).toBe(true);
    expect(status.text()).toContain("No text was found in this image.");
    expect(resultTextarea().exists()).toBe(false);
    // Scoped to the OCR section's own Copy button specifically, not "no button anywhere" — the
    // PDF section (Story 6.1) always renders its own buttons regardless of OCR outcome state.
    expect(wrapper!.findAll("button").find((b) => b.text() === "Copy")).toBeUndefined();
  });

  it("states explicitly that no text was found for a whitespace-only outcome, instead of a blank-looking textarea (AC1)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "bucket", value: SAMPLE_WHITESPACE_OUTCOME };
    await flushPromises();

    const status = wrapper!.find("[role='status']");
    expect(status.exists()).toBe(true);
    expect(status.text()).toContain("No text was found in this image.");
    expect(resultTextarea().exists()).toBe(false);
    // Scoped to the OCR section's own Copy button specifically, not "no button anywhere" — the
    // PDF section (Story 6.1) always renders its own buttons regardless of OCR outcome state.
    expect(wrapper!.findAll("button").find((b) => b.text() === "Copy")).toBeUndefined();
  });

  it("renders a bucket-unsupported-format ToolError from a failed drop result and clears any prior result", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
    await flushPromises();
    expect(resultTextarea().exists()).toBe(true);

    registry.dropResult = {
      toolId: "bucket",
      error: {
        code: "bucket-unsupported-format",
        message: "could not decode image: unknown format",
        position: null,
        context: null,
      },
    };
    await flushPromises();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("could not decode image");
    expect(resultTextarea().exists()).toBe(false);
  });

  it("renders a bucket-input-too-large ToolError from a failed drop result", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = {
      toolId: "bucket",
      error: {
        code: "bucket-input-too-large",
        message: "file is 104857601 bytes, which exceeds the 104857600-byte limit",
        position: null,
        context: null,
      },
    };
    await flushPromises();

    expect(wrapper!.find("[role='alert']").text()).toContain("exceeds the 104857600-byte limit");
    expect(resultTextarea().exists()).toBe(false);
  });

  it("lets the extracted text be edited, and Copy writes the current edited value, not the original outcome (AC2)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
    await flushPromises();

    await resultTextarea().setValue("edited text, not the original OCR output");
    await wrapper!.find("button").trigger("click");
    await flushPromises();

    expect(writeClipboardTextMock).toHaveBeenCalledWith("edited text, not the original OCR output");
  });

  it("re-seeds the editable field from a new outcome, discarding unsaved edits to the previous one", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
    await flushPromises();
    await resultTextarea().setValue("a local edit that was never copied");

    registry.dropResult = { toolId: "bucket", value: { text: "second extraction", confidence: 0.5 } };
    await flushPromises();

    expect(resultTextarea().element.value).toBe("second extraction");
  });

  // Story 6.1: PDF section. Deliberately disjoint from the OCR section's own outcome/editedText/
  // error state (see BucketView.vue's own AD-16 comment) — mocks `@tauri-apps/plugin-dialog`'s
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

  // Story 6.2: Image section. Deliberately disjoint from the OCR/PDF sections' own state (see
  // BucketView.vue's own AD-16 comment for this section) — mocks the same `open`/`save`/`invoke`
  // already mocked above.
  describe("Image section", () => {
    it("shows the quality slider only for a JPEG target, not PNG/WebP (AC2)", async () => {
      openMock.mockResolvedValueOnce("/tmp/photo.png");
      mountView();

      // Default target format is JPEG, so the slider is already visible before any file is
      // picked — visibility is gated on target format alone, per this task's own wording.
      expect(wrapper!.find("#image-quality").exists()).toBe(true);

      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      expect(wrapper!.find("#image-quality").exists()).toBe(true);

      await wrapper!.find("#image-target-format").setValue("png");
      await flushPromises();
      expect(wrapper!.find("#image-quality").exists()).toBe(false);

      await wrapper!.find("#image-target-format").setValue("webp");
      await flushPromises();
      expect(wrapper!.find("#image-quality").exists()).toBe(false);

      await wrapper!.find("#image-target-format").setValue("jpeg");
      await flushPromises();
      expect(wrapper!.find("#image-quality").exists()).toBe(true);
    });

    it("debounces a quality change into a single estimate call and displays the result (AC2)", async () => {
      openMock.mockResolvedValueOnce("/tmp/photo.png");
      invokeMock.mockResolvedValue(12345);
      mountView();

      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();
      invokeMock.mockClear();

      const slider = wrapper!.find<HTMLInputElement>("#image-quality");
      await slider.setValue("10");
      await slider.setValue("20");
      await slider.setValue("30");
      // Only the last of three rapid slider ticks should reach invoke — the debounce collapses
      // invocation volume, not just result ordering (distinct from the AD-16 runner's job).
      expect(invokeMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith("bucket_estimate_image_size", {
        path: "/tmp/photo.png",
        targetFormat: "jpeg",
        quality: 30,
      });
      expect(wrapper!.text()).toContain("Estimated size: 12.1 KB");
    });

    it("clicking Convert calls save() then bucket_convert_image with the current path/format/quality/outputPath (AC1)", async () => {
      openMock.mockResolvedValueOnce("/tmp/photo.png");
      saveMock.mockResolvedValueOnce("/tmp/converted.jpg");
      invokeMock.mockResolvedValue(undefined);
      mountView();

      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      await clickButton(wrapper!, "Convert");
      await flushPromises();

      expect(saveMock).toHaveBeenCalledWith({
        filters: [{ name: "Image", extensions: ["jpg"] }],
        defaultPath: "photo.jpg",
      });
      expect(invokeMock).toHaveBeenCalledWith("bucket_convert_image", {
        path: "/tmp/photo.png",
        targetFormat: "jpeg",
        quality: 80,
        outputPath: "/tmp/converted.jpg",
      });
    });

    // Regression test: the save dialog's suggested filename must match the *selected* target
    // format's extension, not always default to the first extension in a shared filter list
    // (a real bug this story shipped with — every Convert click suggested "Untitled.png"
    // regardless of the chosen target format, even though the written bytes were always
    // correctly encoded per the selected format).
    it("suggests a save filename matching the selected target format, not always PNG (AC1)", async () => {
      openMock.mockResolvedValueOnce("/tmp/vacation.png");
      saveMock.mockResolvedValue("/tmp/vacation.webp");
      invokeMock.mockResolvedValue(undefined);
      mountView();

      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      await wrapper!.find("#image-target-format").setValue("webp");
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();
      saveMock.mockClear();

      await clickButton(wrapper!, "Convert");
      await flushPromises();

      expect(saveMock).toHaveBeenCalledWith({
        filters: [{ name: "Image", extensions: ["webp"] }],
        defaultPath: "vacation.webp",
      });
    });

    it("disables Convert until a file is chosen (AC1)", () => {
      mountView();
      const convertButton = wrapper!.findAll("button").find((b) => b.text() === "Convert");
      expect(convertButton?.attributes("disabled")).toBeDefined();
    });

    it("renders an estimate error via the Image section's own alert without disturbing OCR/PDF state", async () => {
      openMock.mockResolvedValueOnce("/tmp/photo.png");
      invokeMock.mockRejectedValueOnce({
        code: "bucket-image-unsupported-format",
        message: "could not decode image: unknown format",
        position: null,
        context: null,
      });
      mountView();
      const registry = useRegistryStore(pinia);
      registry.dropResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
      await flushPromises();

      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      const alerts = wrapper!.findAll("[role='alert']");
      expect(alerts.some((a) => a.text().includes("could not decode image"))).toBe(true);
      // OCR section's own state is untouched by the Image section's error.
      expect(resultTextarea().element.value).toBe(SAMPLE_OUTCOME.text);
    });

    it("renders a convert error via the Image section's own alert without disturbing OCR/PDF state", async () => {
      openMock.mockResolvedValueOnce("/tmp/photo.png");
      saveMock.mockResolvedValueOnce("/tmp/converted.jpg");
      invokeMock
        .mockResolvedValueOnce(12345) // debounced estimate call after picking the file
        .mockRejectedValueOnce({
          code: "bucket-image-encode-failed",
          message: "encoder rejected the input",
          position: null,
          context: null,
        });
      mountView();
      const registry = useRegistryStore(pinia);
      registry.dropResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
      await flushPromises();

      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      await clickButton(wrapper!, "Convert");
      await flushPromises();

      const alerts = wrapper!.findAll("[role='alert']");
      expect(alerts.some((a) => a.text().includes("encoder rejected the input"))).toBe(true);
      // OCR section's own state is untouched by the Image section's error.
      expect(resultTextarea().element.value).toBe(SAMPLE_OUTCOME.text);
    });

    // Regression test for the AD-16 two-runner scoping this section's design is built around:
    // the live estimate and the discrete Convert action each get their own local
    // createLatestWinsRunner(), specifically so a still-in-flight call on one never supersedes
    // or is disturbed by a call on the other. Clicking Convert while an estimate is still
    // pending must succeed on its own runner, and the estimate must still land normally once it
    // resolves afterward — proving the two runners are genuinely independent, not sharing state.
    it("keeps Convert independent of a still-in-flight estimate call (AD-16 two-runner scoping)", async () => {
      openMock.mockResolvedValueOnce("/tmp/photo.png");
      saveMock.mockResolvedValueOnce("/tmp/converted.jpg");

      let resolveEstimate: (value: number) => void = () => {};
      const pendingEstimate = new Promise<number>((resolve) => {
        resolveEstimate = resolve;
      });
      invokeMock.mockImplementation((command: string) => {
        if (command === "bucket_estimate_image_size") return pendingEstimate;
        if (command === "bucket_convert_image") return Promise.resolve(undefined);
        return Promise.resolve(undefined);
      });

      mountView();
      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      // Fires the debounced estimate call; its invoke() intentionally stays pending.
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      await clickButton(wrapper!, "Convert");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("bucket_convert_image", {
        path: "/tmp/photo.png",
        targetFormat: "jpeg",
        quality: 80,
        outputPath: "/tmp/converted.jpg",
      });
      expect(wrapper!.findAll("[role='alert']")).toHaveLength(0);

      resolveEstimate(54321);
      await flushPromises();

      expect(wrapper!.text()).toContain("Estimated size: 53.0 KB");
      expect(wrapper!.findAll("[role='alert']")).toHaveLength(0);
    });
  });
});
