import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import OcrView from "./OcrView.vue";
import { useRegistryStore } from "../../stores/registry";
import { i18n } from "../../i18n";

// Story 8.7 slice 4: rewritten against the Live Text surface. AC29 governs which behaviours had
// to survive the shape change and which are deliberately retired — exactly two of the latter,
// both describing the `<textarea>` this story removes: "lets the extracted text be edited, and
// Copy writes the current edited value" and "re-seeds the editable field from a new outcome,
// discarding unsaved edits". The second also described a stale-snapshot bug class (8.6's lesson
// 5) that removing the field structurally dissolves rather than merely fixes.

const { writeClipboardTextMock, invokeMock, convertFileSrcMock, openMock, routerPushMock } =
  vi.hoisted(() => ({
    routerPushMock: vi.fn(),
    writeClipboardTextMock: vi.fn(),
    invokeMock: vi.fn(),
    convertFileSrcMock: vi.fn((path: string) => `asset://localhost/${path}`),
    openMock: vi.fn(),
  }));

// AC37 (Story 8.8): this view now routes — it carries a dropped PDF across to the PDF tool
// rather than only naming it. The push is spied rather than driven through a real router: the
// assertion that matters is WHAT is published and WHERE it goes, not vue-router's own behaviour.
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock("../../shell/clipboard", () => ({
  writeClipboardText: (...args: unknown[]) => writeClipboardTextMock(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (...args: [string]) => convertFileSrcMock(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

/**
 * A region as core now returns it: text, confidence, and a four-corner polygon in
 * `image_width`/`image_height` space. Axis-aligned here only because these tests assert on
 * behaviour, not geometry — `overlayGeometry.spec.ts` owns the rotated-quad cases.
 */
function region(text: string | null, confidence: number | null = 0.97, y = 10) {
  const chars = text ?? "";
  const width = 200 / Math.max(1, chars.length);
  return {
    text,
    confidence,
    polygon: [
      { x: 10, y },
      { x: 210, y },
      { x: 210, y: y + 30 },
      { x: 10, y: y + 30 },
    ],
    // One polygon per character, index-aligned — the shape core returns since Story 8.7's
    // render review reversed Cut #4. Evenly spaced here because these tests assert behaviour,
    // not geometry; overlayGeometry.spec.ts owns the placement maths.
    char_polygons: [...chars].map((_, i) => [
      { x: 10 + i * width, y },
      { x: 10 + (i + 1) * width, y },
      { x: 10 + (i + 1) * width, y: y + 30 },
      { x: 10 + i * width, y: y + 30 },
    ]),
  };
}

function outcome(regions: ReturnType<typeof region>[]) {
  return { regions, image_width: 400, image_height: 200 };
}

const SAMPLE_OUTCOME = outcome([region("UMBRA OCR TEST")]);
const MULTI_REGION_OUTCOME = outcome([region("first line", 0.97, 10), region("second line", 0.97, 60)]);
const EMPTY_OUTCOME = outcome([]);
// Detected, and recognition failed on every one — the state that turns "no text found" from a
// bare denial into a diagnosis (AC39).
const UNREADABLE_OUTCOME = outcome([region(null, null, 10), region(null, null, 60)]);

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  writeClipboardTextMock.mockReset();
  invokeMock.mockReset();
  openMock.mockReset();
  convertFileSrcMock.mockClear();
});

function mountView() {
  wrapper = mount(OcrView, { global: { plugins: [pinia] }, attachTo: document.body });
  return wrapper;
}

function store() {
  return useRegistryStore(pinia);
}

/** Delivers a drop the way `DropZone.vue` does: the outcome and the source path together. */
async function deliverDrop(value: unknown, path = "/tmp/shot.png") {
  const registry = store();
  registry.dropSourcePath = { toolId: "ocr", path, paths: [path] };
  registry.dropResult = { toolId: "ocr", value };
  await flushPromises();
}

/**
 * Delivers a refused PDF the way the shell really does (AC37): publish the source, set the error
 * result, and clear the source — all before a flush, because the format check rejects inside one
 * tick. Reproducing that sequence is what the first AC37 test failed to do.
 */
async function deliverRefusedPdf(path = "/tmp/doc.pdf") {
  const registry = store();
  registry.dropSourcePath = { toolId: "ocr", path, paths: [path] };
  registry.dropResult = {
    toolId: "ocr",
    error: {
      code: "ocr-pdf-wrong-tool",
      message: "PDFs open in the PDF tool.",
      position: null,
      context: null,
    },
  };
  registry.dropSourcePath = null;
  await flushPromises();
}

/** Delivers a paste the way `DropZone.vue` does: the pixels first, then the outcome. */
async function deliverPasteSource(width: number, height: number) {
  store().pasteSourceImage = {
    toolId: "ocr",
    rgba: new Uint8Array(width * height * 4),
    width,
    height,
  };
  await flushPromises();
}

function surfaceStyle() {
  return wrapper!.find(".surface").attributes("style") ?? "";
}

function spans() {
  return wrapper!.findAll(".region");
}

/**
 * The copy control is the last ghost button in the cluster — the find bar's close button
 * precedes it when find is open. Indexed rather than `.at(-1)`, which this project's TS lib
 * target does not include.
 */
function copyButton() {
  const ghosts = wrapper!.findAll("button.ghost");
  return ghosts[ghosts.length - 1];
}

describe("OcrView", () => {
  describe("resting state (AC31)", () => {
    it("shows a real drop target with all three doors, not a bare sentence", () => {
      mountView();

      // The affordance, the keyboard path, and the paste hint — three entrances, one object.
      expect(wrapper!.find(".drop-target").exists()).toBe(true);
      expect(wrapper!.text()).toContain("Drop an image here");
      expect(wrapper!.text()).toContain("Choose an image…");
      expect(wrapper!.text()).toContain("paste with ⌘V");
      // …joined by two "or" lines, so the three read as one choice, not three steps.
      expect(wrapper!.findAll(".or-separator")).toHaveLength(2);
    });

    it("does not show the drop target once an image is on screen", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      expect(wrapper!.find(".drop-target").exists()).toBe(false);
      expect(wrapper!.find(".surface").exists()).toBe(true);
    });
  });

  describe("drag-over highlight (AC32)", () => {
    it("highlights only when the shell says a drag is over THIS tool", async () => {
      mountView();
      expect(wrapper!.find(".drop-target").classes()).not.toContain("drag-over");

      store().dragOverToolId = "ocr";
      await flushPromises();
      expect(wrapper!.find(".drop-target").classes()).toContain("drag-over");
      expect(wrapper!.text()).toContain("Drop to extract text");

      store().dragOverToolId = null;
      await flushPromises();
      expect(wrapper!.find(".drop-target").classes()).not.toContain("drag-over");
    });

    it("ignores a drag over a different tool", async () => {
      mountView();
      store().dragOverToolId = "pdf";
      await flushPromises();

      expect(wrapper!.find(".drop-target").classes()).not.toContain("drag-over");
    });
  });

  describe("consuming outcomes", () => {
    it("renders the recognised text as spans on the image after a drop, and clears the signal", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      expect(spans()).toHaveLength(1);
      expect(spans()[0].text()).toContain("UMBRA OCR TEST");
      expect(store().dropResult).toBeNull();
      expect(store().dropSourcePath).toBeNull();
    });

    it("consumes a paste result the same way, rendering the pixels the shell already read (AC12)", async () => {
      mountView();
      const registry = store();
      registry.pasteSourceImage = {
        toolId: "ocr",
        rgba: new Uint8Array(400 * 200 * 4),
        width: 400,
        height: 200,
      };
      registry.pasteResult = { toolId: "ocr", value: SAMPLE_OUTCOME };
      await flushPromises();

      expect(spans()).toHaveLength(1);
      // A canvas, not an <img>: the paste path has no file, so there is no URL to convert.
      expect(wrapper!.find("canvas.source-image").exists()).toBe(true);
      expect(registry.pasteResult).toBeNull();
      expect(registry.pasteSourceImage).toBeNull();
    });

    it("renders the extracted text exactly once — on the image, with no textarea (AC34)", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);

      expect(wrapper!.find("textarea").exists()).toBe(false);
      expect(spans()).toHaveLength(2);
    });

    it("puts spans in the DOM in the reading order core sorted them into", async () => {
      // What makes a native drag-select from one region through to a later one pick up
      // everything between them, and what a screen reader reads.
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);

      expect(spans().map((s) => s.text().trim())).toEqual(["first line", "second line"]);
    });

    it("shows the image immediately from the dropped path, before recognition returns (AC33)", async () => {
      mountView();
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png", paths: ["/tmp/shot.png"] };
      await flushPromises();

      expect(convertFileSrcMock).toHaveBeenCalledWith("/tmp/shot.png");
      expect(wrapper!.find("img.source-image").attributes("src")).toBe("asset://localhost//tmp/shot.png");
    });

    it("ignores a drop result routed to a different tool", async () => {
      mountView();
      const registry = store();
      registry.dropResult = { toolId: "hash", value: SAMPLE_OUTCOME };
      await flushPromises();

      expect(spans()).toHaveLength(0);
      // Left in place for the tool it belongs to.
      expect(registry.dropResult).not.toBeNull();
    });

    it("ignores a paste result routed to a different tool", async () => {
      mountView();
      const registry = store();
      registry.pasteResult = { toolId: "base64", value: SAMPLE_OUTCOME };
      await flushPromises();

      expect(spans()).toHaveLength(0);
      expect(registry.pasteResult).not.toBeNull();
    });
  });

  describe("in-flight feedback (AC33)", () => {
    it("shows the image and the indicator for a DROP, before the outcome arrives", async () => {
      // Regression: the first cut of this slice set `extracting` only on the picker path, and
      // the shell published the source only after the command resolved — so a drop showed a
      // blank pane for the whole inference. Measured at 13 s on a full-screen Retina capture.
      mountView();
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png", paths: ["/tmp/shot.png"] };
      await flushPromises();

      expect(wrapper!.find("img.source-image").exists()).toBe(true);
      expect(wrapper!.find(".in-flight").exists()).toBe(true);
      expect(wrapper!.text()).toContain("Extracting text…");
      // Blur-to-sharp: the image itself carries the state, so it cannot be mistaken for a
      // finished-but-small render — which is exactly how the first attempt read.
      expect(wrapper!.find("img.source-image").classes()).toContain("unresolved");
    });

    it("shows the image and the indicator for a PASTE, before the outcome arrives", async () => {
      mountView();
      store().pasteSourceImage = {
        toolId: "ocr",
        rgba: new Uint8Array(4),
        width: 1,
        height: 1,
      };
      await flushPromises();

      expect(wrapper!.find("canvas.source-image").exists()).toBe(true);
      expect(wrapper!.find(".in-flight").exists()).toBe(true);
    });

    it("shows the indicator for the file picker too", async () => {
      openMock.mockResolvedValueOnce("/tmp/picked.png");
      // The picker path invokes twice now (code review 2026-09-08): `ocr_grant_asset` first,
      // awaited so the asset-protocol grant cannot lose the race to the `<img>` request it
      // authorises, then the extraction itself.
      invokeMock.mockResolvedValueOnce(undefined); // ocr_grant_asset
      invokeMock.mockReturnValueOnce(new Promise(() => {})); // ocr_extract_text: never resolves
      mountView();

      await wrapper!.find(".drop-target button").trigger("click");
      await flushPromises();

      expect(wrapper!.find(".in-flight").exists()).toBe(true);
    });

    it("stops the indicator once the outcome arrives, and resolves the image to sharp", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      expect(wrapper!.find(".in-flight").exists()).toBe(false);
      // Resolving to sharp IS the completion signal — nothing else has to disappear.
      expect(wrapper!.find("img.source-image").classes()).not.toContain("unresolved");
    });

    it("hides the in-flight chip from assistive tech, leaving the live region to announce", async () => {
      // Both carry the same words; without this a screen reader meets "Extracting text…"
      // twice — once announced, once on traversal.
      mountView();
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png", paths: ["/tmp/shot.png"] };
      await flushPromises();

      expect(wrapper!.find(".chip").attributes("aria-hidden")).toBe("true");
      expect(wrapper!.find(".sr-only[role='status']").text()).toContain("Extracting");
    });

    it("stops the indicator when the extraction fails", async () => {
      mountView();
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png", paths: ["/tmp/shot.png"] };
      await flushPromises();
      expect(wrapper!.find(".in-flight").exists()).toBe(true);

      store().dropResult = {
        toolId: "ocr",
        error: { code: "ocr-unsupported-format", message: "nope", position: null, context: null },
      };
      await flushPromises();

      expect(wrapper!.find(".in-flight").exists()).toBe(false);
    });

    it("announces the start, not only the completion", async () => {
      mountView();
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png", paths: ["/tmp/shot.png"] };
      await flushPromises();

      expect(wrapper!.find(".sr-only[role='status']").text()).toContain("Extracting");
    });
  });

  describe("honesty states", () => {
    it("states explicitly that no text was found when the detector found nothing", async () => {
      mountView();
      await deliverDrop(EMPTY_OUTCOME);

      expect(wrapper!.find(".no-text").text()).toContain("No text was found");
    });

    it("turns no-text-found into a diagnosis when regions were found but not read (AC39)", async () => {
      // On an image visibly full of text, "no text was found" alone is a lie of omission.
      mountView();
      await deliverDrop(UNREADABLE_OUTCOME);

      expect(wrapper!.find(".no-text").text()).toContain("found but not recognised");
      expect(wrapper!.findAll(".region-unreadable")).toHaveLength(2);
    });

    it("marks a low-confidence region with a dotted underline, and never shows a number (AC36)", async () => {
      mountView();
      await deliverDrop(outcome([region("介", 0.4961), region("Try Again", 0.98, 60)]));

      const marked = wrapper!.findAll(".region.low");
      expect(marked).toHaveLength(1);
      expect(marked[0].text()).toContain("介");
      expect(wrapper!.text()).not.toContain("0.49");
      expect(wrapper!.text()).not.toContain("49%");
    });

    it("distinguishes unreadable from low-confidence by shape, not by colour", async () => {
      // A dashed BOX versus a dotted UNDERLINE, so the signal survives a colour-blind viewer
      // and a greyscale screenshot.
      mountView();
      await deliverDrop(outcome([region(null, null, 10), region("介", 0.4961, 60)]));

      expect(wrapper!.findAll(".region-unreadable")).toHaveLength(1);
      expect(wrapper!.findAll(".region.low")).toHaveLength(1);
    });

    it("renders an ocr-unsupported-format ToolError and clears any prior result (AC40)", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);
      expect(spans()).toHaveLength(1);

      store().dropResult = {
        toolId: "ocr",
        error: {
          code: "ocr-unsupported-format",
          message: "That file isn't an image this tool can read.",
          position: null,
          context: null,
        },
      };
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("isn't an image");
      expect(spans()).toHaveLength(0);
      // The way back in stays on screen — the tool never becomes a dead end.
      expect(wrapper!.find(".drop-target").exists()).toBe(true);
    });

    it("rejects a dropped PDF by name rather than as an unreadable image (AC25)", async () => {
      mountView();

      store().dropResult = {
        toolId: "ocr",
        error: {
          code: "ocr-pdf-wrong-tool",
          message: "PDFs open in the PDF tool.",
          position: null,
          context: null,
        },
      };
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("PDF tool");
      // A sentence, not a routing offer (developer's call, 2026-09-07) — a button cannot route
      // to somewhere that is not built yet. Story 8.8 owns carrying the file across.
      expect(wrapper!.findAll("a")).toHaveLength(0);
      expect(wrapper!.find(".drop-target").exists()).toBe(true);
    });

    // AC24/AC26's actual payoff, and the one thing the two tests above CANNOT show: their
    // English locale string is word-for-word the Rust `message`, so they pass whether or not
    // the code ever reached TRANSLATABLE_CODES. Flipping the locale is what separates
    // "translated through `errors.<code>`" from "the Rust sentence rendered verbatim".
    //
    // `src/shell/frenchRender.spec.ts` is normally the single place that flips this switch, and
    // its reason is that a leaked flip would invalidate the English assertions everywhere else.
    // That reason is honoured here — the flip is scoped to this block and restored after — while
    // the alternative (mounting OcrView over there) would have to install module-level Tauri
    // `core`/`dialog` mocks into a file whose four existing tests do not want them.
    describe("under the French locale", () => {
      afterEach(() => {
        i18n.global.locale.value = "en";
      });

      it.each([
        ["ocr-unsupported-format", "That file isn't an image this tool can read.", "pas une image"],
        ["ocr-pdf-wrong-tool", "PDFs open in the PDF tool.", "outil PDF"],
      ])("renders %s in French rather than the Rust message", async (code, rustMessage, french) => {
        i18n.global.locale.value = "fr";
        mountView();

        store().dropResult = {
          toolId: "ocr",
          error: { code, message: rustMessage, position: null, context: null },
        };
        await flushPromises();

        const alert = wrapper!.find("[role='alert']").text();
        expect(alert).toContain(french);
        expect(alert).not.toContain(rustMessage);
      });
    });
  });

  describe("the file picker (AC13)", () => {
    it("extracts through the tool-scoped runner, so a pick supersedes an in-flight drop", async () => {
      // AD-16's amended one-runner-per-independent-state rule: drop, paste and pick all write
      // the same extraction outcome, so this view calls registry.getLatestWinsRunner("ocr")
      // directly rather than creating a local runner.
      openMock.mockResolvedValueOnce("/tmp/picked.png");
      invokeMock.mockResolvedValueOnce(undefined); // ocr_grant_asset (code review 2026-09-08)
      invokeMock.mockResolvedValueOnce(SAMPLE_OUTCOME);
      mountView();

      await wrapper!.find(".drop-target button").trigger("click");
      await flushPromises();

      // The grant is awaited BEFORE the src is set, which is what makes the ordering a
      // guarantee rather than a race the webview usually happens to win.
      expect(invokeMock).toHaveBeenNthCalledWith(1, "ocr_grant_asset", { path: "/tmp/picked.png" });
      expect(invokeMock).toHaveBeenNthCalledWith(2, "ocr_extract_text", { path: "/tmp/picked.png" });
      expect(convertFileSrcMock).toHaveBeenCalledWith("/tmp/picked.png");
      expect(spans()).toHaveLength(1);
    });

    it("does nothing when the picker is cancelled", async () => {
      openMock.mockResolvedValueOnce(null);
      mountView();

      await wrapper!.find(".drop-target button").trigger("click");
      await flushPromises();

      expect(invokeMock).not.toHaveBeenCalled(); // not even the grant
      expect(wrapper!.find(".drop-target").exists()).toBe(true);
    });

    it("renders a picker failure as a ToolError rather than throwing", async () => {
      openMock.mockResolvedValueOnce("/tmp/picked.png");
      invokeMock.mockResolvedValueOnce(undefined); // ocr_grant_asset (code review 2026-09-08)
      invokeMock.mockRejectedValueOnce({
        code: "ocr-input-too-large",
        message: "file is too big",
        position: null,
        context: null,
      });
      mountView();

      await wrapper!.find(".drop-target button").trigger("click");
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("file is too big");
    });
  });

  describe("controls live outside the image (AC37/AC38, revised 2026-09-08)", () => {
    it("puts the control cluster above the image, never over it", async () => {
      // Pinned inside the image the cluster covered whatever text sat under it — and on a
      // screenshot the top-right corner is as likely to hold what you came for as anywhere.
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      expect(wrapper!.find(".toolbar").exists()).toBe(true);
      expect(wrapper!.find(".surface .toolbar").exists()).toBe(false);
      expect(wrapper!.find(".surface button.ghost").exists()).toBe(false);
    });

    it("shows no toolbar at rest, when there is no image for it to sit above", () => {
      mountView();
      expect(wrapper!.find(".toolbar").exists()).toBe(false);
    });
  });

  describe("copy (AC37)", () => {
    it("copies every region joined in reading order, from a ghost icon-button", async () => {
      writeClipboardTextMock.mockResolvedValueOnce(undefined);
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);

      const copy = copyButton();
      expect(copy.attributes("aria-label")).toBe("Copy all text");
      await copy.trigger("click");
      await flushPromises();

      expect(writeClipboardTextMock).toHaveBeenCalledWith("first line\nsecond line");
    });

    it("confirms the copy on the control that was clicked", async () => {
      writeClipboardTextMock.mockResolvedValueOnce(undefined);
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      await copyButton().trigger("click");
      await flushPromises();

      expect(copyButton().attributes("aria-label")).toBe("Copied");
    });

    it("offers no copy control when there is nothing readable to copy", async () => {
      mountView();
      await deliverDrop(UNREADABLE_OUTCOME);

      expect(wrapper!.findAll("button.ghost")).toHaveLength(0);
    });
  });

  describe("find in image (AC38)", () => {
    async function openFind() {
      await flushPromises();
    }

    it("is visible as soon as there is text to search, without any shortcut", async () => {
      // Render review, 2026-09-08: "not everyone knows cmd+f". The field is a visible control;
      // the shortcut is an accelerator for it, not the only way in.
      mountView();
      expect(wrapper!.find(".findbar").exists()).toBe(false);

      await deliverDrop(MULTI_REGION_OUTCOME);
      expect(wrapper!.find(".findbar").exists()).toBe(true);
    });

    it("places every match from the model's own per-character boxes, not from font metrics", async () => {
      // The bug this closes: estimating a substring's position from the OVERLAY font's metrics
      // drifts badly whenever the image's font distributes width differently — a monospace
      // terminal capture was off by several characters by mid-line.
      mountView();
      await deliverDrop(outcome([region("aaaaXXXXbbbb", 0.97, 10)]));
      await wrapper!.find(".findbar input").setValue("XXXX");
      await flushPromises();

      const mark = wrapper!.findAll(".match")[0];
      // Characters 4..8 of 12, across a 200px-wide region starting at x=10.
      expect(mark.attributes("style")).toContain("left: 76.66");
      expect(mark.attributes("style")).toContain("width: 66.66");
      expect(mark.classes()).not.toContain("approximate");
    });

    it("bands the whole region, marked approximate, when there is no character geometry", async () => {
      // Never a precise-looking box in the wrong place: the estimate this replaced drew one,
      // which is worse than an honest imprecise mark.
      mountView();
      await deliverDrop(outcome([{ ...region("first line"), char_polygons: [] }]));
      await wrapper!.find(".findbar input").setValue("line");
      await flushPromises();

      const marks = wrapper!.findAll(".match");
      expect(marks).toHaveLength(1);
      expect(marks[0].classes()).toContain("approximate");
      // The whole region, not a guessed slice of it.
      expect(marks[0].attributes("style")).toContain("left: 10px");
      expect(marks[0].attributes("style")).toContain("width: 200px");
    });

    it("marks matches on the image and reports a count", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await openFind();

      await wrapper!.find(".findbar input").setValue("line");
      await flushPromises();

      // EVERY match is marked, not just the current one.
      expect(wrapper!.findAll(".match")).toHaveLength(2);
      expect(wrapper!.find(".match-count").text()).toBe("1 of 2");
      // Exactly one is "the one you're on" — the same two-tier signal JsonTree's find uses.
      expect(wrapper!.findAll(".match.current")).toHaveLength(1);
    });

    it("steps forward with Enter and back with ⇧Enter, wrapping at both ends", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await openFind();
      await wrapper!.find(".findbar input").setValue("line");
      await flushPromises();

      const input = wrapper!.find(".findbar input");
      await input.trigger("keydown", { key: "Enter" });
      expect(wrapper!.find(".match-count").text()).toBe("2 of 2");

      await input.trigger("keydown", { key: "Enter" });
      expect(wrapper!.find(".match-count").text()).toBe("1 of 2");

      await input.trigger("keydown", { key: "Enter", shiftKey: true });
      expect(wrapper!.find(".match-count").text()).toBe("2 of 2");
    });

    it("navigates with the Previous and Next buttons, the way the JSON explorer's find does", async () => {
      // The gap this closes: the first cut had keyboard-only navigation and no visible
      // affordance at all, which is not what "we tweaked it" produced for JsonTree.
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await openFind();
      await wrapper!.find(".findbar input").setValue("line");
      await flushPromises();

      const [prev, next] = wrapper!.findAll("button.nav:not(.clear)");
      await next.trigger("click");
      expect(wrapper!.find(".match-count").text()).toBe("2 of 2");

      await next.trigger("click");
      expect(wrapper!.find(".match-count").text()).toBe("1 of 2");

      await prev.trigger("click");
      expect(wrapper!.find(".match-count").text()).toBe("2 of 2");
    });

    it("also steps with ArrowUp and ArrowDown", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await openFind();
      await wrapper!.find(".findbar input").setValue("line");
      await flushPromises();

      const input = wrapper!.find(".findbar input");
      await input.trigger("keydown", { key: "ArrowDown" });
      expect(wrapper!.find(".match-count").text()).toBe("2 of 2");

      await input.trigger("keydown", { key: "ArrowUp" });
      expect(wrapper!.find(".match-count").text()).toBe("1 of 2");
    });

    it("removes both nav buttons when nothing matches", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await openFind();
      await wrapper!.find(".findbar input").setValue("zzz");
      await flushPromises();

      // The arrows are gone entirely rather than disabled: a control that can never do
      // anything is better absent than greyed.
      expect(wrapper!.findAll("button.nav:not(.clear)")).toHaveLength(0);
    });

    it("says nothing at all while the query is empty", async () => {
      // "No matches" against an empty box is a complaint about a question nobody asked.
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);

      expect(wrapper!.find(".match-count").text()).toBe("");
      expect(wrapper!.findAll("button.nav:not(.clear)")).toHaveLength(0);
    });

    it("hides the step arrows when there is nothing to step between", async () => {
      // Arrows on 0 or 1 result are controls that cannot do anything.
      mountView();
      await deliverDrop(outcome([region("only one line here")]));

      await wrapper!.find(".findbar input").setValue("zzz");
      await flushPromises();
      expect(wrapper!.findAll("button.nav:not(.clear)")).toHaveLength(0);

      await wrapper!.find(".findbar input").setValue("one");
      await flushPromises();
      expect(wrapper!.find(".match-count").text()).toBe("1 of 1");
      expect(wrapper!.findAll("button.nav:not(.clear)")).toHaveLength(0);

      await wrapper!.find(".findbar input").setValue("e");
      await flushPromises();
      expect(wrapper!.findAll("button.nav:not(.clear)").length).toBe(2);
    });

    it("says so when nothing matches, rather than silently marking nothing", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await openFind();

      await wrapper!.find(".findbar input").setValue("zzz");
      await flushPromises();

      expect(wrapper!.find(".match-count").text()).toBe("No matches");
      expect(wrapper!.findAll(".match")).toHaveLength(0);
    });

    it("clears the query on Escape, leaving the field in place", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await wrapper!.find(".findbar input").setValue("line");
      await flushPromises();
      expect(wrapper!.findAll(".match")).toHaveLength(2);

      await wrapper!.find(".findbar input").trigger("keydown", { key: "Escape" });
      await flushPromises();

      expect(wrapper!.find(".findbar").exists()).toBe(true);
      expect(wrapper!.findAll(".match")).toHaveLength(0);
    });
  });

  describe("accessibility (AC41)", () => {
    it("gives the image an accessible name that is not the filename and says its text is available", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME, "/Users/somebody/Desktop/private-name.png");

      const alt = wrapper!.find("img.source-image").attributes("alt")!;
      expect(alt).not.toContain("private-name");
      expect(alt).toContain("text is available");
    });

    it("gives the overlay a role that does not announce 'image' and stop", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      const overlay = wrapper!.find(".overlay");
      expect(overlay.attributes("role")).toBe("group");
      expect(overlay.attributes("aria-label")).toContain("Text recognised");
    });

    it("announces completion in a live region", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      expect(wrapper!.find(".sr-only[role='status']").text()).toContain("Text extracted");
    });
  });

  // Render review 2026-09-08. Three symptoms, one cause: `resetForNewSource()` was called by the
  // file picker only, so drop and paste carried the previous image's state into the next one.
  // Each symptom gets its own test — they fail independently, and a future refactor that fixes
  // one by accident should not be able to claim the other two.
  describe("replacing one image with another (render review 2026-09-08)", () => {
    it("returns to the in-flight state, rather than looking like nothing happened", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);
      expect(wrapper!.find(".in-flight").exists()).toBe(false);

      await deliverPasteSource(2, 2);

      // The stale outcome used to keep `extracting` false, so the second image arrived with no
      // blur and no sweep.
      expect(wrapper!.find(".in-flight").exists()).toBe(true);
      expect(wrapper!.find("canvas.source-image").classes()).toContain("unresolved");
    });

    it("draws the new image at ITS dimensions, not the previous image's", async () => {
      mountView();
      // SAMPLE_OUTCOME is 400x200. The next paste is 40x80 — a different aspect ratio, so a
      // carried-over size cannot coincidentally look right.
      await deliverDrop(SAMPLE_OUTCOME);
      expect(surfaceStyle()).toContain("width: 400px");

      await deliverPasteSource(40, 80);

      // `naturalSize` reads the outcome first (it must — those are the coordinates the region
      // polygons live in), so a surviving outcome stretched the new image into the old shape.
      expect(surfaceStyle()).toContain("width: 40px");
      expect(surfaceStyle()).toContain("height: 80px");
    });

    it("clears the find query and its highlights, which located text in the OLD image", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await wrapper!.find(".findbar input").setValue("line");
      expect(wrapper!.findAll(".match")).toHaveLength(2);

      await deliverPasteSource(2, 2);

      // Marks positioned from the old image's geometry, painted over the new one, pointing at
      // text that is not there.
      expect(wrapper!.findAll(".match")).toHaveLength(0);
      expect(wrapper!.find(".findbar").exists()).toBe(false);
    });

    it("resets on a second DROP as well, not only on a paste", async () => {
      mountView();
      await deliverDrop(MULTI_REGION_OUTCOME);
      await wrapper!.find(".findbar input").setValue("line");

      store().dropSourcePath = { toolId: "ocr", path: "/tmp/second.png", paths: ["/tmp/second.png"] };
      await flushPromises();

      expect(wrapper!.find(".in-flight").exists()).toBe(true);
      expect(wrapper!.findAll(".match")).toHaveLength(0);
      expect(spans()).toHaveLength(0);
    });
  });

  // The same render review turned up a fourth bug in this area, unreported because it hides:
  // AC33 promises the image in the first frame, but drop and the file picker had no dimensions
  // until recognition returned ~3 s later, so `.surface` was 0x0 and — because it clips its
  // overflow — the image AND the sweep were invisible for the whole wait.
  describe("the in-flight size on the file paths (AC33)", () => {
    it("sizes the surface from the decoded image before any outcome exists", async () => {
      mountView();
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png", paths: ["/tmp/shot.png"] };
      await flushPromises();

      // jsdom never loads a real image, so the browser's own load event is simulated with the
      // dimensions it would carry.
      const img = wrapper!.find("img.source-image");
      Object.defineProperty(img.element, "naturalWidth", { value: 300, configurable: true });
      Object.defineProperty(img.element, "naturalHeight", { value: 150, configurable: true });
      await img.trigger("load");

      expect(surfaceStyle()).toContain("width: 300px");
      expect(surfaceStyle()).toContain("height: 150px");
      expect(wrapper!.find(".in-flight").exists()).toBe(true);
    });

    it("lets the outcome's oriented dimensions win once they arrive", async () => {
      // The decoded size is only a stand-in. Core returns the size recognition actually ran
      // against, AFTER EXIF orientation, and the region polygons live in THAT space — so it
      // must take over the moment it exists or the overlay drifts off the text.
      mountView();
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png", paths: ["/tmp/shot.png"] };
      await flushPromises();

      const img = wrapper!.find("img.source-image");
      Object.defineProperty(img.element, "naturalWidth", { value: 999, configurable: true });
      Object.defineProperty(img.element, "naturalHeight", { value: 999, configurable: true });
      await img.trigger("load");

      store().dropResult = { toolId: "ocr", value: SAMPLE_OUTCOME };
      await flushPromises();

      expect(surfaceStyle()).toContain("width: 400px");
      expect(surfaceStyle()).toContain("height: 200px");
    });
  });

  // Render review 2026-09-08: "I didn't see this error message [...] because it was at the
  // bottom of the screen instead of just below the drop zone." The pane claims every leftover
  // pixel of a full-height column, so anything rendered after it lands at the window's bottom
  // edge, nowhere near the thing it describes.
  describe("where the messages appear (render review 2026-09-08)", () => {
    it("puts a drop/paste error inside the drop target, under the way back in", async () => {
      mountView();
      store().dropResult = {
        toolId: "ocr",
        error: {
          code: "ocr-unsupported-format",
          message: "That file isn't an image this tool can read.",
          position: null,
          context: null,
        },
      };
      await flushPromises();

      const alert = wrapper!.find(".drop-target [role='alert']");
      expect(alert.exists()).toBe(true);
      expect(alert.text()).toContain("isn't an image");
      // And nowhere else: a second copy at section level is what put it off-screen.
      expect(wrapper!.findAll("[role='alert']")).toHaveLength(1);
    });

    it("puts no-text-found in the toolbar, directly above the image it describes", async () => {
      mountView();
      await deliverDrop(EMPTY_OUTCOME);

      expect(wrapper!.find(".toolbar .no-text").exists()).toBe(true);
      expect(wrapper!.find(".toolbar").text()).toContain("No text was found");
    });
  });

  // Manual VoiceOver pass, 2026-09-08 (AC30): the no-text case announced NOTHING. A live region
  // only speaks when an element already in the accessibility tree changes its content, and the
  // visible message is `v-if`-inserted — region and text arrived together, so there was nothing
  // to observe. The always-mounted `.sr-only` region is now the single spoken channel.
  //
  // These assert the announcer's TEXT, which is the part a screen reader reads. They cannot
  // prove audibility — no jsdom test can, which is why AC30 requires a real pass — but they do
  // pin the two things that were actually wrong: the sentence was in the wrong element, and it
  // was the wrong sentence.
  describe("what the live region says (AC30, screen-reader pass)", () => {
    function announcer() {
      return wrapper!.find(".sr-only[role='status']").text();
    }

    it("announces the no-text result, which used to be silent", async () => {
      mountView();
      await deliverDrop(EMPTY_OUTCOME);

      expect(announcer()).toContain("No text was found");
    });

    it("announces the diagnosis when regions were found but not read", async () => {
      // The stronger honesty case: we located writing and could not read it, which is a
      // different fact from "there is no text here" and must not be flattened into it.
      mountView();
      await deliverDrop(UNREADABLE_OUTCOME);

      expect(announcer()).toContain("marked regions were found but not recognised");
    });

    it("does not claim text was extracted when none was", async () => {
      // The old code announced "Text extracted." unconditionally — a bluff about its own result
      // in the one app that must never make one.
      mountView();
      await deliverDrop(EMPTY_OUTCOME);

      expect(announcer()).not.toContain("Text extracted");
    });

    it("still announces completion when there IS text", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      expect(announcer()).toContain("Text extracted");
    });

    it("leaves the visible no-text message with no live role, so it cannot double-announce", async () => {
      mountView();
      await deliverDrop(EMPTY_OUTCOME);

      expect(wrapper!.find(".toolbar .no-text").attributes("role")).toBeUndefined();
      // Exactly one polite live region is speaking the result.
      expect(wrapper!.findAll(".toolbar [role='status']")).toHaveLength(0);
    });

    it("keeps a copy failure visible in the toolbar, where the image is still on screen", async () => {
      // The one error path that does NOT clear the image, so the drop target is not rendered
      // and cannot host the message.
      writeClipboardTextMock.mockRejectedValueOnce(new Error("clipboard unavailable"));
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      await copyButton().trigger("click");
      await flushPromises();

      expect(wrapper!.find(".toolbar [role='alert']").exists()).toBe(true);
      expect(wrapper!.find(".surface").exists()).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------------------
  // Code review 2026-09-08. Everything below covers a hole the review found: three no-text
  // sub-cases AC29 retired without saying so, the two keyboard paths that had no coverage at
  // all (one of which turned out to be unreachable), and the error states that reached the user
  // silently or not at all.
  // ------------------------------------------------------------------------------------------
  describe("no-text sub-cases restored from the baseline (AC29)", () => {
    function announcer() {
      return wrapper!.find("p.sr-only").text();
    }

    it("states no text found for an empty PASTE, not only an empty drop", async () => {
      // The baseline had this as its own block. The rewrite collapsed drop and paste into one
      // generic empty case, and the paste path reaches `applyOcrResult` through a different
      // watcher with a different source signal — the two are not interchangeable.
      mountView();
      await deliverPasteSource(40, 20);
      store().pasteResult = { toolId: "ocr", value: EMPTY_OUTCOME };
      await flushPromises();

      expect(wrapper!.find(".toolbar .no-text").exists()).toBe(true);
      expect(announcer()).toContain("No text was found");
    });

    it("treats a whitespace-only recognition as no text, not as a result", async () => {
      // FR26 is anchored to TEXT, not to region count: a region can recognise successfully and
      // still contain nothing readable. No test on either side of the stack covered it.
      mountView();
      await deliverDrop(outcome([region("   ")]));

      expect(wrapper!.find(".toolbar .no-text").exists()).toBe(true);
      expect(announcer()).not.toContain("Text extracted");
    });
  });

  describe("the keyboard paths (AC37/AC38)", () => {
    it("focuses the find field on Cmd-F once there is text to find", async () => {
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      // Asserted through `select()` rather than `document.activeElement`: jsdom implements
      // `HTMLInputElement.select()` without moving focus, so the real-browser side effect this
      // relies on is not observable here.
      const input = wrapper!.find(".findbar input").element as HTMLInputElement;
      const select = vi.spyOn(input, "select");

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true }));
      await flushPromises();

      expect(select).toHaveBeenCalled();
    });

    it("selects every recognised region on Cmd-A with the overlay focused", async () => {
      // This branch was unreachable until the review: it gates on the overlay containing
      // `document.activeElement`, and the overlay had no `tabindex`, so nothing inside it could
      // ever hold focus and Cmd-A fell through to the browser's select-the-document default.
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      const overlay = wrapper!.find(".overlay").element as HTMLElement;
      expect(overlay.getAttribute("tabindex")).toBe("0");
      overlay.focus();
      expect(overlay.contains(document.activeElement)).toBe(true);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", metaKey: true }));
      await flushPromises();

      expect(window.getSelection()?.rangeCount).toBeGreaterThan(0);
    });
  });

  describe("errors that used to arrive silently", () => {
    function announcer() {
      return wrapper!.find("p.sr-only").text();
    }

    it("announces a failure instead of leaving the live region on the previous result", async () => {
      // The error branch returned without touching `announcement`, and because it clears the
      // image, `extracting` went false without the watcher firing — so a screen reader was left
      // reading "Extracting text…", or the last run's "Text extracted.", after a failure whose
      // only other channel is a `v-if`-inserted role="alert" that announces nothing.
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);
      expect(announcer()).toContain("Text extracted");

      store().dropSourcePath = { toolId: "ocr", path: "/tmp/doc.pdf", paths: ["/tmp/doc.pdf"] };
      store().dropResult = {
        toolId: "ocr",
        error: { code: "ocr-pdf-wrong-tool", message: "PDFs open in the PDF tool.", position: null, context: null },
      };
      await flushPromises();

      expect(announcer()).toContain("PDF");
      expect(announcer()).not.toContain("Text extracted");
    });

    // AC37 (Story 8.8): the third hand-off Story 8.7 handed forward in writing. Until now this
    // refusal was a signpost pointing at a closed door — it named the tool that could open the
    // file and then made the user go there and re-pick the file they had just dropped.
    it("offers to carry a dropped PDF to the PDF tool, and carries it (AC37)", async () => {
      mountView();

      store().dropSourcePath = { toolId: "ocr", path: "/tmp/doc.pdf", paths: ["/tmp/doc.pdf"] };
      store().dropResult = {
        toolId: "ocr",
        error: {
          code: "ocr-pdf-wrong-tool",
          message: "PDFs open in the PDF tool.",
          position: null,
          context: null,
        },
      };
      await flushPromises();

      const offer = wrapper!.find(".error-action");
      expect(offer.exists()).toBe(true);

      await offer.trigger("click");
      await flushPromises();

      // Published BEFORE the route change: the receiving view's watcher is `immediate`, so the
      // reverse order would have it mount, find nothing, and the signal arrive to an empty room.
      expect(store().handOffPath).toEqual({ toolId: "pdf", path: "/tmp/doc.pdf" });
      expect(routerPushMock).toHaveBeenCalledWith("/tools/pdf");
    });

    it("offers the hand-off even when the drop fails before Vue flushes (AC37)", async () => {
      // The ordering the SHELL actually produces, which the test above did not reproduce and the
      // app therefore failed at. `DropZone.vue` publishes `dropSourcePath`, invokes, and on
      // rejection sets `dropResult` AND clears `dropSourcePath` — all synchronously relative to
      // Vue's default `flush: "pre"` watcher. A PDF is refused by a format check, i.e. almost
      // instantly, so the source signal is set and unset inside one tick and the view's watcher
      // only ever sees the final value: `null`. It returned early, the path was never captured,
      // and the offer never rendered.
      mountView();

      const registry = store();
      registry.dropSourcePath = { toolId: "ocr", path: "/tmp/doc.pdf", paths: ["/tmp/doc.pdf"] };
      registry.dropResult = {
        toolId: "ocr",
        error: {
          code: "ocr-pdf-wrong-tool",
          message: "PDFs open in the PDF tool.",
          position: null,
          context: null,
        },
      };
      registry.dropSourcePath = null;
      await flushPromises();

      expect(wrapper!.find(".error-action").exists()).toBe(true);
    });

    // Render review 2026-09-11. The first cut appended the offer to the resting state, and the
    // developer rejected it: *"everything is centered with one main action using a button, and
    // then you have this new white button not centered and competing with the first one."* These
    // pin the redesign so it cannot quietly revert to an append.
    it("keeps the refusal an error, and the resting state intact (AC37)", async () => {
      // Two corrections from the developer, both against an earlier attempt of mine:
      //   * the red stays. Something DID go wrong from the user's side — they handed this tool a
      //     file and it refused. Calling it "just a routing hint" was the designer's view, not
      //     theirs, and dropping the colour made the screen read as though nothing had happened.
      //   * the resting state stays. Replacing it with a PDF-glyph panel put the PDF tool's own
      //     identity inside Image to Text, which signals "you are in the PDF tool now".
      mountView();
      await deliverRefusedPdf();

      const alert = wrapper!.find(".drop-target p.error[role='alert']");
      expect(alert.exists()).toBe(true);
      expect(alert.text()).toContain("PDFs open in the PDF tool.");
      // The three doors are untouched — the tool still says what it takes.
      expect(wrapper!.text()).toContain("Drop an image here");
      expect(wrapper!.text()).toContain("paste with ⌘V");
      expect(wrapper!.findAll(".or-separator")).toHaveLength(2);
    });

    it("carries the action inside the message rather than beside it (AC37)", async () => {
      // The fault this fixes: a second `default` AppButton next to "Choose an image…" gave the
      // screen two equal main actions, off-centre, with no order between them. The action is now
      // a text link inside the sentence it belongs to.
      mountView();
      await deliverRefusedPdf();

      const action = wrapper!.find(".drop-target .error-action");
      expect(action.exists()).toBe(true);
      // Inside the alert paragraph, not a sibling of it.
      expect(wrapper!.find(".drop-target p.error .error-action").exists()).toBe(true);
      // Exactly one real button remains on the resting surface: the tool's own.
      const appButtons = wrapper!.findAll(".drop-target button.app-button");
      expect(appButtons).toHaveLength(1);
      expect(appButtons[0].text()).toBe("Choose an image…");
    });

    it("names the file in the action, so the visible text is a complete label (AC37)", async () => {
      // WCAG 2.5.3: a control's accessible name must contain its visible text, so the link says
      // what it does rather than being a statement that happens to be clickable. Naming the file
      // also confirms we took the one they meant — basename only, per AC25.
      mountView();
      await deliverRefusedPdf();

      const action = wrapper!.find(".error-action");
      expect(action.text()).toBe("Open doc.pdf");
      expect(wrapper!.text()).not.toContain("/tmp/doc.pdf");
    });

    it("leaves the redirect the moment another source arrives (AC37)", async () => {
      // The state is derived from the error code, not a flag — so it clears itself rather than
      // relying on every other entry path remembering to reset it.
      mountView();
      await deliverRefusedPdf();
      expect(wrapper!.find(".error-action").exists()).toBe(true);

      await deliverDrop(SAMPLE_OUTCOME);

      expect(wrapper!.find(".error-action").exists()).toBe(false);
    });

    it("offers the hand-off for a PDF whose path does not end in .pdf (code review 2026-09-14)", async () => {
      // The refusal this offers to redirect is raised by the Rust side sniffing the file's magic
      // bytes, not its name (`umbra_core::ocr::looks_like_a_supported_image` / the `%PDF-` check
      // in `ocr_grant_asset`). The first version of this offer additionally required the dropped
      // path to end in `.pdf`, so a PDF with no extension, a renamed one, or a temp/download path
      // was refused correctly but never got the "Open …" button — silently, since the error text
      // itself renders regardless.
      mountView();
      await deliverRefusedPdf("/tmp/CourrierCaisse__0038_MTB23_SMB188_85073d94");

      expect(wrapper!.find(".error-action").exists()).toBe(true);
      expect(wrapper!.find(".error-action").text()).toBe(
        "Open CourrierCaisse__0038_MTB23_SMB188_85073d94",
      );
    });

    it("offers the hand-off from the file picker too, not only from a drop (code review 2026-09-14)", async () => {
      // The same `ocr-pdf-wrong-tool` code is reachable via "Choose an image…" -> `showFileSource`
      // -> `ocr_grant_asset`, which sniffs the identical magic bytes. The first version only
      // populated the redirect state from the drop-specific watcher, so picking a misidentified
      // PDF hit the same wall a drop would, with no way out of it.
      openMock.mockResolvedValueOnce("/tmp/scan.pdf");
      invokeMock.mockRejectedValueOnce({
        code: "ocr-pdf-wrong-tool",
        message: "PDFs open in the PDF tool.",
        position: null,
        context: null,
      });
      mountView();

      await wrapper!.find(".drop-target button").trigger("click");
      await flushPromises();

      const action = wrapper!.find(".error-action");
      expect(action.exists()).toBe(true);
      expect(action.text()).toBe("Open scan.pdf");
    });

    it("does not offer the PDF hand-off for an unrelated failure (AC37)", async () => {
      // The offer is specific to one code. An image that simply failed to decode has nothing to
      // carry anywhere, and a button suggesting otherwise would be a wrong answer offered
      // confidently.
      mountView();

      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png", paths: ["/tmp/shot.png"] };
      store().dropResult = {
        toolId: "ocr",
        error: {
          code: "ocr-unsupported-format",
          message: "Unsupported image format.",
          position: null,
          context: null,
        },
      };
      await flushPromises();

      expect(wrapper!.find(".error-action").exists()).toBe(false);
    });

    it("says so when the source image cannot be rendered, instead of floating text over nothing", async () => {
      // Without an @error handler a refused asset request produced transparent spans and dashed
      // unreadable boxes painted over an empty rectangle, with no way to tell whether
      // recognition or the render had failed.
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);
      expect(spans().length).toBeGreaterThan(0);

      await wrapper!.find("img.source-image").trigger("error");
      await flushPromises();

      expect(wrapper!.find("[role='alert']").text()).toContain("couldn't be displayed");
      expect(spans()).toHaveLength(0);
      expect(announcer()).toContain("couldn't be displayed");
    });

    it("keeps a good result on screen when the clipboard holds no image", async () => {
      // Nothing new arrived, so nothing should be replaced — and the message is ours, not the
      // clipboard plugin's untranslated English.
      mountView();
      await deliverDrop(SAMPLE_OUTCOME);

      store().pasteResult = {
        toolId: "ocr",
        error: { code: "paste-no-image", message: "raw plugin text", position: null, context: null },
      };
      await flushPromises();

      expect(wrapper!.find(".surface").exists()).toBe(true);
      expect(spans().length).toBeGreaterThan(0);
      expect(wrapper!.find("[role='alert']").text()).toContain("no image on the clipboard");
    });

    it("does not claim success for a result delivered to a view that never saw its source", async () => {
      // `DropZone.vue`'s isStillActive() checks the ROUTE, not the instance: navigate away and
      // back during a ~3 s inference and the outcome lands on a fresh instance whose source
      // signal was already consumed. Every result surface is behind v-if="hasImage", so it
      // rendered nothing while the announcer said "Text extracted."
      mountView();
      store().dropResult = { toolId: "ocr", value: SAMPLE_OUTCOME };
      await flushPromises();

      expect(wrapper!.find(".drop-target").exists()).toBe(true);
      expect(announcer()).not.toContain("Text extracted");
    });
  });
});
