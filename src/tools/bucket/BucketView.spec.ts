import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import BucketView from "./BucketView.vue";
import { useRegistryStore } from "../../stores/registry";

const SAMPLE_OUTCOME = { text: "UMBRA OCR TEST", confidence: 0.97 };

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

function mountView() {
  pinia = createPinia();
  wrapper = mount(BucketView, { global: { plugins: [pinia] } });
  return wrapper;
}

// AD-14/AD-16: DropZone.vue is the shell's single generic dispatcher — it invokes
// `bucket_extract_text` itself and already routes every drop through
// `registry.getLatestWinsRunner("bucket")` on its own (see registry.ts/DropZone.vue). This
// story's BucketView.vue has no manual invoke trigger of its own (drop is the only
// write-surface — Story 4.2 adds clipboard-paste), so there is no local
// `createLatestWinsRunner()` to get wrong here: the view only ever consumes an already-arrived
// outcome via `registry.dropResult`, exactly like HashView.vue's own drop-result handling.
// These tests exercise that consumption contract directly, matching HashView.spec.ts's own
// drop-result tests, rather than going through a real DropZone.vue + Tauri event mock.

describe("BucketView", () => {
  it("shows the drop hint before any drop has happened (AC1)", () => {
    mountView();
    expect(wrapper!.text()).toContain("Drop a PNG, JPEG, or WebP image");
  });

  it("consumes a successful drop result into the extracted-text display and clears the signal (AC1)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
    await flushPromises();

    expect(wrapper!.find(".result").text()).toBe(SAMPLE_OUTCOME.text);
    expect(registry.dropResult).toBeNull();
  });

  it("ignores a drop result routed to a different tool", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "hash", value: { irrelevant: true } };
    await flushPromises();

    expect(wrapper!.find(".result").exists()).toBe(false);
  });

  it("renders a bucket-unsupported-format ToolError from a failed drop result and clears any prior result", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "bucket", value: SAMPLE_OUTCOME };
    await flushPromises();
    expect(wrapper!.find(".result").exists()).toBe(true);

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
    expect(wrapper!.find(".result").exists()).toBe(false);
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
    expect(wrapper!.find(".result").exists()).toBe(false);
  });
});
