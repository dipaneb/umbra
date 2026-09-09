import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import ImageView from "./ImageView.vue";

// Story 8.7 slice 2 (AC9): the 8 `it()` blocks below are the `describe("Image section")`
// block of the former BucketView.spec.ts. Six moved byte-identical. TWO DID NOT, and the
// deviation is recorded rather than absorbed: both error tests additionally asserted that
// the Image error left the *OCR section's* textarea untouched, by seeding
// `registry.dropResult` and reading `.result`. After the split there is no OCR section in
// this view to disturb — the isolation those two lines guarded is now structural rather
// than tested, the same way AC29 retires the two textarea tests. Their Image-side
// assertions are unchanged; only the cross-section clause and the now-inaccurate "without
// disturbing OCR/PDF state" title fragment were removed.

const { invokeMock, openMock, saveMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  openMock: vi.fn(),
  saveMock: vi.fn(),
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
  invokeMock.mockReset();
  openMock.mockReset();
  saveMock.mockReset();
  vi.useRealTimers();
});

function mountView() {
  pinia = createPinia();
  wrapper = mount(ImageView, { global: { plugins: [pinia] } });
  return wrapper;
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

describe("ImageView", () => {
  // Story 6.2: Image section. Deliberately disjoint from the OCR/PDF sections' own state (see
  // ImageView.vue's own AD-16 comment for this section) — mocks the same `open`/`save`/`invoke`
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

    it("renders an estimate error via the Image view's own alert", async () => {
      openMock.mockResolvedValueOnce("/tmp/photo.png");
      invokeMock.mockRejectedValueOnce({
        code: "bucket-image-unsupported-format",
        message: "could not decode image: unknown format",
        position: null,
        context: null,
      });
      mountView();
      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      const alerts = wrapper!.findAll("[role='alert']");
      expect(alerts.some((a) => a.text().includes("could not decode image"))).toBe(true);
    });

    it("renders a convert error via the Image view's own alert", async () => {
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
      await clickButton(wrapper!, "Choose image…");
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      await clickButton(wrapper!, "Convert");
      await flushPromises();

      const alerts = wrapper!.findAll("[role='alert']");
      expect(alerts.some((a) => a.text().includes("encoder rejected the input"))).toBe(true);
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
