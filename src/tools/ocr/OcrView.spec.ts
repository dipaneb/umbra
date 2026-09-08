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

const { writeClipboardTextMock, invokeMock, convertFileSrcMock, openMock } = vi.hoisted(() => ({
  writeClipboardTextMock: vi.fn(),
  invokeMock: vi.fn(),
  convertFileSrcMock: vi.fn((path: string) => `asset://localhost/${path}`),
  openMock: vi.fn(),
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
  registry.dropSourcePath = { toolId: "ocr", path };
  registry.dropResult = { toolId: "ocr", value };
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
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png" };
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
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png" };
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
      invokeMock.mockReturnValueOnce(new Promise(() => {})); // never resolves
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
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png" };
      await flushPromises();

      expect(wrapper!.find(".chip").attributes("aria-hidden")).toBe("true");
      expect(wrapper!.find(".sr-only[role='status']").text()).toContain("Extracting");
    });

    it("stops the indicator when the extraction fails", async () => {
      mountView();
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png" };
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
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png" };
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
      invokeMock.mockResolvedValueOnce(SAMPLE_OUTCOME);
      mountView();

      await wrapper!.find(".drop-target button").trigger("click");
      await flushPromises();

      expect(invokeMock).toHaveBeenCalledWith("ocr_extract_text", { path: "/tmp/picked.png" });
      expect(convertFileSrcMock).toHaveBeenCalledWith("/tmp/picked.png");
      expect(spans()).toHaveLength(1);
    });

    it("does nothing when the picker is cancelled", async () => {
      openMock.mockResolvedValueOnce(null);
      mountView();

      await wrapper!.find(".drop-target button").trigger("click");
      await flushPromises();

      expect(invokeMock).not.toHaveBeenCalled();
      expect(wrapper!.find(".drop-target").exists()).toBe(true);
    });

    it("renders a picker failure as a ToolError rather than throwing", async () => {
      openMock.mockResolvedValueOnce("/tmp/picked.png");
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

      store().dropSourcePath = { toolId: "ocr", path: "/tmp/second.png" };
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
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png" };
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
      store().dropSourcePath = { toolId: "ocr", path: "/tmp/shot.png" };
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
});
