import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import BucketView from "./BucketView.vue";
import { useRegistryStore } from "../../stores/registry";

const SAMPLE_OUTCOME = { text: "UMBRA OCR TEST", confidence: 0.97 };

const { writeClipboardTextMock } = vi.hoisted(() => ({
  writeClipboardTextMock: vi.fn(),
}));

vi.mock("../../shell/clipboard", () => ({
  writeClipboardText: (...args: unknown[]) => writeClipboardTextMock(...args),
}));

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  writeClipboardTextMock.mockReset();
});

function mountView() {
  pinia = createPinia();
  wrapper = mount(BucketView, { global: { plugins: [pinia] } });
  return wrapper;
}

function resultTextarea() {
  return wrapper!.find<HTMLTextAreaElement>(".result");
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
});
