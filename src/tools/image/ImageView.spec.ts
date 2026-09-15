import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import { useRegistryStore } from "../../stores/registry";
import ImageView from "./ImageView.vue";

// Story 8.9: the redesigned Images tool (AC8-AC34) — a multi-file queue replacing the
// single-file flow the old `describe("Image section")` suite (Story 6.2/8.7) exercised. This
// suite is a full rewrite, not a migration of those 8 tests: the command names, IPC shape, and
// UI structure are all new (rename, batch queue, resize, AVIF, background color, compare).

const { invokeMock, openMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  openMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  openMock.mockReset();
});

function mountView() {
  // attachTo: document.body — same convention PdfView/OcrView/CronView's own specs use, needed
  // so `document.activeElement` assertions (the compare overlay's focus-on-open fix) actually
  // reflect real focus rather than jsdom's no-op on a detached element.
  wrapper = mount(ImageView, { global: { plugins: [pinia] }, attachTo: document.body });
  return wrapper;
}

function store() {
  return useRegistryStore(pinia);
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

function ingestOutcome(path: string, width = 100, height = 50) {
  return { path, width, height, error: null };
}

describe("ImageView", () => {
  describe("empty state and arrival (AC5/AC16)", () => {
    it("shows the drop target and no queue when nothing has been added", () => {
      mountView();
      expect(wrapper!.find(".drop-target").exists()).toBe(true);
      expect(wrapper!.find(".queue-panel").exists()).toBe(false);
    });

    it("adds picked files to the queue via the picker, through the same ingest command a drop uses", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.png", "/tmp/b.png"]);
      invokeMock.mockResolvedValueOnce([ingestOutcome("/tmp/a.png"), ingestOutcome("/tmp/b.png")]);
      mountView();

      await clickButton(wrapper!, "Choose images…");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("image_ingest_dropped", {
        paths: ["/tmp/a.png", "/tmp/b.png"],
      });
      expect(wrapper!.text()).toContain("2 files");
      expect(wrapper!.text()).toContain("a.png");
      expect(wrapper!.text()).toContain("b.png");
    });

    it("adds a dropped batch via registry.dropResult, without a separate ingest call", async () => {
      mountView();

      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/dropped.png")],
      };
      await flushPromises();

      expect(invokeMock).not.toHaveBeenCalled();
      expect(wrapper!.text()).toContain("1 file");
      expect(wrapper!.text()).toContain("dropped.png");
    });

    it("ignores a drop result belonging to another tool", async () => {
      mountView();

      store().dropResult = { toolId: "pdf", value: [ingestOutcome("/tmp/x.png")] };
      await flushPromises();

      expect(wrapper!.find(".drop-target").exists()).toBe(true);
    });

    it("shows a visible error, not just an sr-only announcement, when a whole drop fails (code review 2026-09-15)", async () => {
      mountView();

      store().dropResult = {
        toolId: "image",
        error: { code: "file-read-error", message: "could not read the dropped file", position: null, context: null },
      };
      await flushPromises();

      const alert = wrapper!.find("[role='alert']");
      expect(alert.exists()).toBe(true);
      expect(alert.text()).toBe("could not read the dropped file");
    });

    it("shows a visible error when the picker/ingest call itself fails", async () => {
      openMock.mockResolvedValueOnce(["/tmp/a.png"]);
      invokeMock.mockRejectedValueOnce({
        code: "file-read-error",
        message: "disk unplugged",
        position: null,
        context: null,
      });
      mountView();

      await clickButton(wrapper!, "Choose images…");
      await flushPromises();

      const alert = wrapper!.find("[role='alert']");
      expect(alert.exists()).toBe(true);
      expect(alert.text()).toBe("disk unplugged");
    });

    it("shows a per-file error row for a dropped file that failed ingest, alongside good ones (AC15/AC17)", async () => {
      mountView();

      store().dropResult = {
        toolId: "image",
        value: [
          ingestOutcome("/tmp/good.png"),
          {
            path: "/tmp/bad.gif",
            width: null,
            height: null,
            error: { code: "image-unsupported-format", message: "bad format", position: null, context: null },
          },
        ],
      };
      await flushPromises();

      const rows = wrapper!.findAll(".queue-row");
      expect(rows).toHaveLength(2);
      expect(rows[1].text()).toContain("bad format");
      expect(rows[1].find(".chip.status-error").exists()).toBe(true);
      // The good file is unaffected and still convertible — pending rows render no status
      // chip at all (render review 2026-09-15), so its absence here is itself the assertion.
      expect(rows[0].find(".chip").exists()).toBe(false);
      // Code review 2026-09-15: a long/truncated error had no way to be read in full — `title`
      // gives it the same affordance `.file-name` already has via `:title="item.path"`.
      expect(rows[1].find(".error-text").attributes("title")).toBe("bad format");
    });

    it("does not duplicate a file that is already queued", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      expect(wrapper!.findAll(".queue-row")).toHaveLength(1);
    });

    // Render review feedback (2026-09-15): a generic icon on every row, even for a file the
    // command layer has already granted asset access to at ingest, read as broken rather than
    // merely plain — a real thumbnail is what actually confirms "yes, this is my photo."
    it("shows a real thumbnail for a pending file, not just a generic icon", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      const thumb = wrapper!.find(".thumb-image");
      expect(thumb.exists()).toBe(true);
      expect(thumb.attributes("src")).toBe("asset://localhost//tmp/a.png");
    });

    it("falls back to the generic icon if the thumbnail fails to load", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      await wrapper!.find(".thumb-image").trigger("error");

      expect(wrapper!.find(".thumb-image").exists()).toBe(false);
      expect(wrapper!.find(".thumb svg").exists()).toBe(true);
    });
  });

  describe("batch settings (AC20/AC23/AC25/AC26)", () => {
    it("shows the quality control for JPEG and AVIF, not PNG/WebP", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      expect(wrapper!.find("#image-quality").exists()).toBe(true); // default is jpeg

      await wrapper!.find("#image-target-format").setValue("avif");
      expect(wrapper!.find("#image-quality").exists()).toBe(true);

      await wrapper!.find("#image-target-format").setValue("png");
      expect(wrapper!.find("#image-quality").exists()).toBe(false);

      await wrapper!.find("#image-target-format").setValue("webp");
      expect(wrapper!.find("#image-quality").exists()).toBe(false);
    });

    it("shows the background color control only for JPEG (AC26, extended to AVIF's own alpha support)", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      expect(wrapper!.find("#image-background").exists()).toBe(true); // default is jpeg

      for (const format of ["png", "webp", "avif"]) {
        await wrapper!.find("#image-target-format").setValue(format);
        expect(wrapper!.find("#image-background").exists()).toBe(false);
      }
    });

    it("recomputes the height field from the first queued file's aspect ratio while locked (AC20)", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png", 200, 100)] };
      await flushPromises();

      const width = wrapper!.find<HTMLInputElement>('[aria-label="Width"]');
      await width.setValue("100");
      await width.trigger("input");

      const height = wrapper!.find<HTMLInputElement>('[aria-label="Height"]');
      expect(height.element.value).toBe("50");
    });

    it("recomputes the aspect-lock reference from a remaining item once its source item is removed (code review 2026-09-15)", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/a.png", 200, 100), ingestOutcome("/tmp/b.png", 50, 50)],
      };
      await flushPromises();

      // /tmp/a.png (200x100, a 2:1 ratio) is first in, so it seeds aspectReference.
      await wrapper!.find('button[aria-label="Remove"]').trigger("click");
      await flushPromises();
      expect(wrapper!.text()).not.toContain("a.png");

      // Only /tmp/b.png (50x50, a 1:1 ratio) remains — the reference must now derive from it,
      // not keep computing from the removed 2:1 file.
      const width = wrapper!.find<HTMLInputElement>('[aria-label="Width"]');
      await width.setValue("40");
      await width.trigger("input");

      const height = wrapper!.find<HTMLInputElement>('[aria-label="Height"]');
      expect(height.element.value).toBe("40");
    });

    it("stops recomputing the paired field once the lock is toggled off", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png", 200, 100)] };
      await flushPromises();

      await wrapper!.find(".link-toggle").trigger("click"); // unlock

      const width = wrapper!.find<HTMLInputElement>('[aria-label="Width"]');
      await width.setValue("999");
      await width.trigger("input");

      const height = wrapper!.find<HTMLInputElement>('[aria-label="Height"]');
      expect(height.element.value).toBe("");
    });

    // Render review feedback (2026-09-15): after a mouse drag, the arrow keys stopped moving
    // the slider — the fix is to force real DOM focus onto it on pointerdown, since WebKit does
    // not reliably grant that on its own for a dragged range input.
    it("focuses the quality slider on pointerdown, so the arrow keys work right after a drag", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      const slider = wrapper!.find<HTMLInputElement>("#image-quality");
      const focusSpy = vi.spyOn(slider.element, "focus");
      await slider.trigger("pointerdown");

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe("Convert all (AC18/AC19/AC27/AC28/AC29)", () => {
    // Developer preference (2026-09-15): the batch verb only makes sense once there's a batch —
    // a single queued file gets the singular "Convert", not "Convert all".
    it("labels the button 'Convert' for a single file and 'Convert all' once there are several", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();
      expect(wrapper!.findAll("button").some((b) => b.text() === "Convert")).toBe(true);
      expect(wrapper!.findAll("button").some((b) => b.text() === "Convert all")).toBe(false);

      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/b.png")] };
      await flushPromises();
      expect(wrapper!.findAll("button").some((b) => b.text() === "Convert all")).toBe(true);
      expect(wrapper!.findAll("button").some((b) => b.text() === "Convert")).toBe(false);
    });

    it("asks once for a destination folder, then converts every pending file into it", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/a.png"), ingestOutcome("/tmp/b.png")],
      };
      await flushPromises();

      openMock.mockResolvedValueOnce("/tmp/out");
      invokeMock.mockResolvedValue({
        outputPath: "/tmp/out/a.jpg",
        originalBytes: 1000,
        convertedBytes: 400,
      });

      await clickButton(wrapper!, "Convert all");
      await flushPromises();

      expect(openMock).toHaveBeenCalledTimes(1);
      expect(openMock).toHaveBeenCalledWith({ directory: true });
      expect(invokeMock).toHaveBeenCalledWith("image_convert", {
        path: "/tmp/a.png",
        targetFormat: "jpeg",
        quality: 80,
        outputDir: "/tmp/out",
        resize: undefined,
        background: "#ffffff",
      });
      expect(invokeMock).toHaveBeenCalledWith("image_convert", {
        path: "/tmp/b.png",
        targetFormat: "jpeg",
        quality: 80,
        outputDir: "/tmp/out",
        resize: undefined,
        background: "#ffffff",
      });

      const rows = wrapper!.findAll(".queue-row");
      expect(rows[0].find(".chip.status-done").exists()).toBe(true);
      expect(rows[0].text()).toContain("Done");
    });

    it("sends a resize object only when both width and height are filled in", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      await wrapper!.find('[aria-label="Width"]').setValue("300");
      await wrapper!.find('[aria-label="Height"]').setValue("150");
      await wrapper!.find(".link-toggle").trigger("click"); // unlock, so both stay as typed

      openMock.mockResolvedValueOnce("/tmp/out");
      invokeMock.mockResolvedValue({
        outputPath: "/tmp/out/a.jpg",
        originalBytes: 1000,
        convertedBytes: 400,
      });

      await clickButton(wrapper!, "Convert");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith(
        "image_convert",
        expect.objectContaining({
          resize: { width: "300", height: "150", allowUpscale: true },
        }),
      );
    });

    it("shows a per-item error and leaves the other items unaffected when one file fails (AC17)", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/good.png"), ingestOutcome("/tmp/bad.png")],
      };
      await flushPromises();

      openMock.mockResolvedValueOnce("/tmp/out");
      invokeMock.mockImplementation((command: string, args: { path: string }) => {
        if (command !== "image_convert") return Promise.resolve(undefined);
        if (args.path === "/tmp/bad.png") {
          return Promise.reject({
            code: "image-encode-failed",
            message: "encoder rejected the input",
            position: null,
            context: null,
          });
        }
        return Promise.resolve({ outputPath: "/tmp/out/good.jpg", originalBytes: 1000, convertedBytes: 400 });
      });

      await clickButton(wrapper!, "Convert all");
      await flushPromises();

      const rows = wrapper!.findAll(".queue-row");
      expect(rows[0].find(".chip.status-done").exists()).toBe(true);
      expect(rows[1].find(".chip.status-error").exists()).toBe(true);
      expect(rows[1].text()).toContain("encoder rejected the input");
    });

    it("announces a batch summary once every item has settled (AC29)", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/a.png"), ingestOutcome("/tmp/b.png")],
      };
      await flushPromises();

      openMock.mockResolvedValueOnce("/tmp/out");
      invokeMock.mockImplementation((command: string, args: { path: string }) => {
        if (command !== "image_convert") return Promise.resolve(undefined);
        if (args.path === "/tmp/b.png") {
          return Promise.reject({ code: "image-encode-failed", message: "nope", position: null, context: null });
        }
        return Promise.resolve({ outputPath: "/tmp/out/a.jpg", originalBytes: 1000, convertedBytes: 400 });
      });

      await clickButton(wrapper!, "Convert all");
      await flushPromises();

      const status = wrapper!.find("[role='status'][aria-live='polite']");
      expect(status.text()).toBe("1 of 2 converted");
    });

    it("announces the true settled count when a single-item batch fails, not a false success (AC29, code review 2026-09-15)", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/solo.png")],
      };
      await flushPromises();

      openMock.mockResolvedValueOnce("/tmp/out");
      invokeMock.mockRejectedValueOnce({
        code: "image-encode-failed",
        message: "nope",
        position: null,
        context: null,
      });

      await clickButton(wrapper!, "Convert");
      await flushPromises();

      const status = wrapper!.find("[role='status'][aria-live='polite']");
      expect(status.text()).toBe("0 of 1 converted");
    });

    it("retries a single failed item on its own, without re-running the others (AC33)", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [{ path: "/tmp/bad.png", width: 10, height: 10, error: null }],
      };
      await flushPromises();

      openMock.mockResolvedValue("/tmp/out");
      invokeMock.mockRejectedValueOnce({
        code: "image-encode-failed",
        message: "nope",
        position: null,
        context: null,
      });
      await clickButton(wrapper!, "Convert");
      await flushPromises();
      expect(wrapper!.find(".chip.status-error").exists()).toBe(true);

      invokeMock.mockResolvedValueOnce({
        outputPath: "/tmp/out/bad.jpg",
        originalBytes: 1000,
        convertedBytes: 500,
      });
      await clickButton(wrapper!, "Retry");
      await flushPromises();

      expect(wrapper!.find(".chip.status-done").exists()).toBe(true);
    });

    // Render review feedback (2026-09-15): Retry was reopening the native folder picker with no
    // explanation — surprising, since "Retry" reads as "try that again," not "pick a location,
    // then try that again." AC18's "asked once for a destination folder" is read as once per
    // queue session now, not once per click: the first successful pick is remembered and reused
    // silently for every later conversion or retry.
    it("remembers the destination folder after the first pick and never asks again this session", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/a.png"), ingestOutcome("/tmp/b.png")],
      };
      await flushPromises();

      openMock.mockResolvedValueOnce("/tmp/out");
      invokeMock.mockRejectedValueOnce({
        code: "image-encode-failed",
        message: "nope",
        position: null,
        context: null,
      });
      invokeMock.mockResolvedValueOnce({ outputPath: "/tmp/out/b.jpg", originalBytes: 1000, convertedBytes: 400 });

      await clickButton(wrapper!, "Convert all");
      await flushPromises();
      expect(openMock).toHaveBeenCalledTimes(1);

      invokeMock.mockResolvedValueOnce({ outputPath: "/tmp/out/a.jpg", originalBytes: 1000, convertedBytes: 400 });
      await clickButton(wrapper!, "Retry");
      await flushPromises();

      // Still one — Retry reused the remembered folder instead of asking again.
      expect(openMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenLastCalledWith(
        "image_convert",
        expect.objectContaining({ path: "/tmp/a.png", outputDir: "/tmp/out" }),
      );
    });

    it("opens the destination folder picker only once for two near-simultaneous triggers (code review 2026-09-15)", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [
          ingestOutcome("/tmp/a.png"),
          {
            path: "/tmp/bad.png",
            width: 10,
            height: 10,
            error: { code: "image-unsupported-format", message: "bad", position: null, context: null },
          },
        ],
      };
      await flushPromises();

      let resolveOpen!: (path: string) => void;
      openMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveOpen = resolve;
          }),
      );
      invokeMock.mockResolvedValue({ outputPath: "/tmp/out/x.jpg", originalBytes: 1000, convertedBytes: 400 });

      const convertAllClick = clickButton(wrapper!, "Convert all");
      await flushPromises();
      const retryClick = clickButton(wrapper!, "Retry");
      await flushPromises();

      // Both triggers are now awaiting the SAME still-pending folder pick.
      expect(openMock).toHaveBeenCalledTimes(1);

      resolveOpen("/tmp/out");
      await convertAllClick;
      await retryClick;
      await flushPromises();

      expect(openMock).toHaveBeenCalledTimes(1);
    });

    it("removes an item from the queue and never sends it to Convert all again", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/a.png"), ingestOutcome("/tmp/b.png")],
      };
      await flushPromises();

      await wrapper!.find('button[aria-label="Remove"]').trigger("click");
      await flushPromises();

      expect(wrapper!.findAll(".queue-row")).toHaveLength(1);
      expect(wrapper!.text()).not.toContain("a.png");
    });

    it("disables Convert all and reports zero ready once every item has already converted (code review 2026-09-15)", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      openMock.mockResolvedValueOnce("/tmp/out");
      invokeMock.mockResolvedValueOnce({
        outputPath: "/tmp/out/a.jpg",
        originalBytes: 1000,
        convertedBytes: 400,
      });
      await clickButton(wrapper!, "Convert");
      await flushPromises();

      const button = wrapper!.findAll("button").find((candidate) => candidate.text() === "Convert");
      expect(button?.attributes("disabled")).toBeDefined();
      expect(wrapper!.text()).toContain("0 of 1 files ready");
    });
  });

  describe("Compare (AC27/AC27a)", () => {
    async function convertOneItem() {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();
      openMock.mockResolvedValueOnce("/tmp/out");
      invokeMock.mockResolvedValueOnce({
        outputPath: "/tmp/out/a.jpg",
        originalBytes: 1000,
        convertedBytes: 400,
      });
      await clickButton(wrapper!, "Convert");
      await flushPromises();
    }

    it("shows both byte counts and the percentage saved directly on the row, with no compare view open (AC27a)", async () => {
      await convertOneItem();
      const row = wrapper!.find(".queue-row");
      expect(row.text()).toContain("1.0 KB");
      expect(row.text()).toContain("0.4 KB");
      expect(row.text()).toContain("60%");
      expect(wrapper!.find(".compare-overlay").exists()).toBe(false);
    });

    it("opens the compare overlay showing both images, and closes it again", async () => {
      await convertOneItem();
      await clickButton(wrapper!, "Compare");

      expect(wrapper!.find(".compare-overlay").exists()).toBe(true);
      expect(wrapper!.find(".compare-image").attributes("src")).toBe("asset://localhost//tmp/a.png");

      await clickButton(wrapper!, "Close");
      expect(wrapper!.find(".compare-overlay").exists()).toBe(false);
    });

    it("moves the divider with the keyboard, not only by dragging (AC27a)", async () => {
      await convertOneItem();
      await clickButton(wrapper!, "Compare");

      const handle = wrapper!.find("[role='slider']");
      expect(handle.attributes("aria-valuenow")).toBe("50");

      await handle.trigger("keydown", { key: "ArrowRight" });
      expect(handle.attributes("aria-valuenow")).toBe("52");

      await handle.trigger("keydown", { key: "End" });
      expect(handle.attributes("aria-valuenow")).toBe("100");
    });

    it("hides the tag for whichever image is fully covered at the divider's extremes (code review 2026-09-15)", async () => {
      await convertOneItem();
      await clickButton(wrapper!, "Compare");

      const handle = wrapper!.find("[role='slider']");
      await handle.trigger("keydown", { key: "Home" });
      expect(wrapper!.find(".compare-tag-before").exists()).toBe(false);
      expect(wrapper!.find(".compare-tag-after").exists()).toBe(true);

      await handle.trigger("keydown", { key: "End" });
      expect(wrapper!.find(".compare-tag-before").exists()).toBe(true);
      expect(wrapper!.find(".compare-tag-after").exists()).toBe(false);
    });

    it("closes on Escape and moves focus to the divider handle on open (code review 2026-09-15)", async () => {
      await convertOneItem();
      await clickButton(wrapper!, "Compare");
      await flushPromises();

      const handle = wrapper!.find("[role='slider']").element;
      expect(document.activeElement).toBe(handle);

      await wrapper!.find(".compare-overlay").trigger("keydown", { key: "Escape" });
      expect(wrapper!.find(".compare-overlay").exists()).toBe(false);
    });

    // Render review feedback (2026-09-15): moving the cursor off the handle mid-drag was letting
    // the browser's own click-drag text/element selection light up the frame — `preventDefault`
    // on pointerdown is what stops that gesture from ever starting.
    it("prevents the browser's default drag behavior when the divider handle is pressed", async () => {
      await convertOneItem();
      await clickButton(wrapper!, "Compare");

      const handle = wrapper!.find("[role='slider']").element as HTMLElement;
      // jsdom has no `setPointerCapture` at all; stubbed locally so the handler can run to
      // completion — real WebView/browser environments always have it.
      handle.setPointerCapture = vi.fn();
      const event = new Event("pointerdown", { cancelable: true });
      handle.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe("in-flight feedback (AC28)", () => {
    it("shows an announced in-flight indicator on a converting row, not just disabled controls", async () => {
      mountView();
      store().dropResult = { toolId: "image", value: [ingestOutcome("/tmp/a.png")] };
      await flushPromises();

      openMock.mockResolvedValueOnce("/tmp/out");
      let resolveConvert: (value: unknown) => void = () => {};
      invokeMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConvert = resolve;
          }),
      );

      const convertPromise = clickButton(wrapper!, "Convert");
      await flushPromises();

      const spinner = wrapper!.find(".spinner[role='status']");
      expect(spinner.exists()).toBe(true);
      expect(spinner.attributes("aria-label")).toBe("Converting…");

      resolveConvert({ outputPath: "/tmp/out/a.jpg", originalBytes: 100, convertedBytes: 50 });
      await convertPromise;
      await flushPromises();
    });
  });

  describe("AD-16 per-item runner scoping (AC19)", () => {
    it("keeps two items' conversions independent — a slower first item does not lose to a faster second one, or vice versa", async () => {
      mountView();
      store().dropResult = {
        toolId: "image",
        value: [ingestOutcome("/tmp/slow.png"), ingestOutcome("/tmp/fast.png")],
      };
      await flushPromises();

      openMock.mockResolvedValueOnce("/tmp/out");
      let resolveSlow: (value: unknown) => void = () => {};
      invokeMock.mockImplementation((command: string, args: { path: string }) => {
        if (command !== "image_convert") return Promise.resolve(undefined);
        if (args.path === "/tmp/slow.png") {
          return new Promise((resolve) => {
            resolveSlow = resolve;
          });
        }
        return Promise.resolve({ outputPath: "/tmp/out/fast.jpg", originalBytes: 100, convertedBytes: 50 });
      });

      const convertPromise = clickButton(wrapper!, "Convert all");
      await flushPromises();

      // The fast item is already done while the slow one is still converting.
      const rows = wrapper!.findAll(".queue-row");
      expect(rows[0].find(".chip.status-converting").exists()).toBe(true);
      expect(rows[1].find(".chip.status-done").exists()).toBe(true);

      resolveSlow({ outputPath: "/tmp/out/slow.jpg", originalBytes: 200, convertedBytes: 100 });
      await convertPromise;
      await flushPromises();

      expect(wrapper!.findAll(".chip.status-done")).toHaveLength(2);
    });
  });
});
