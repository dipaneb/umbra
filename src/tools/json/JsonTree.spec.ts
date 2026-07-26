// jsdom has no `ResizeObserver` (verified: not present anywhere in the
// installed jsdom's living implementation), and @tanstack/vue-virtual's
// default scroll-container-watching path uses one. Stub it before mounting.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom does no layout, so `offsetWidth`/`offsetHeight` are always 0 — the
// virtualizer reads exactly these to size the scroll container, and with a
// measured size of 0 it short-circuits to an empty visible range regardless
// of `overscan`. Give every element a non-zero size so rows actually render.
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  value: 500,
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  value: 500,
});

import { afterAll, afterEach, describe, expect, it } from "vitest";

afterAll(() => {
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
});
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import JsonTree from "./JsonTree.vue";
import type { JsonTreeValue } from "./jsonTreeValue";

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

const str = (data: string): JsonTreeValue => ({ kind: "String", data });

function nestedFixture(): JsonTreeValue {
  return {
    kind: "Object",
    data: [
      ["a", { kind: "Object", data: [["deep", str("hidden")]] }],
      ["b", str("shallow")],
    ],
  };
}

function treeItems(w: VueWrapper) {
  return w.findAll('[role="treeitem"]');
}

// The virtualizer only learns the scroll container's real size once Vue
// binds the template ref, which happens a tick after the initial render —
// so every mount needs a settle tick before rows are queryable.
async function mountTree(value: JsonTreeValue | null): Promise<VueWrapper> {
  const w = mount(JsonTree, { props: { value }, attachTo: document.body });
  await nextTick();
  await nextTick();
  return w;
}

describe("JsonTree", () => {
  it("renders the unavailable status message and no tree when value is null", async () => {
    wrapper = await mountTree(null);

    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.find('[role="tree"]').exists()).toBe(false);
  });

  it("shows the root and its immediate children by default, not grandchildren", async () => {
    wrapper = await mountTree(nestedFixture());

    const labels = treeItems(wrapper).map((row) => row.text());
    expect(labels.some((l) => l.includes("a"))).toBe(true);
    expect(labels.some((l) => l.includes("b"))).toBe(true);
    expect(labels.some((l) => l.includes("deep"))).toBe(false);
  });

  it("reveals children on click and hides them again on a second click", async () => {
    wrapper = await mountTree(nestedFixture());

    const rowA = treeItems(wrapper).find((row) => row.text().includes("a"));
    await rowA?.trigger("click");

    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(true);

    const rowAAgain = treeItems(wrapper).find(
      (row) => row.text().includes("a") && !row.text().includes("deep"),
    );
    await rowAAgain?.trigger("click");

    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(false);
  });

  it("toggles a focused expandable row with Enter and Space", async () => {
    wrapper = await mountTree(nestedFixture());

    const rowA = treeItems(wrapper).find((row) => row.text().includes("a"));
    await rowA?.trigger("keydown", { key: "Enter" });
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(true);

    const rowAAgain = treeItems(wrapper).find(
      (row) => row.text().includes("a") && !row.text().includes("deep"),
    );
    await rowAAgain?.trigger("keydown", { key: " " });
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(false);
  });

  it("expands with ArrowRight and collapses with ArrowLeft", async () => {
    wrapper = await mountTree(nestedFixture());

    const rowA = treeItems(wrapper).find((row) => row.text().includes("a"));
    await rowA?.trigger("keydown", { key: "ArrowRight" });
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(true);

    const deepRow = treeItems(wrapper).find((row) => row.text().includes("deep"));
    await deepRow?.trigger("keydown", { key: "ArrowLeft" });

    const rowAAgain = treeItems(wrapper).find((row) => row.text().includes("a"));
    await rowAAgain?.trigger("keydown", { key: "ArrowLeft" });
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(false);
  });

  it("moves the roving tabindex between rows with ArrowDown/ArrowUp", async () => {
    wrapper = await mountTree(nestedFixture());

    const rows = treeItems(wrapper);
    expect(rows[0]?.attributes("tabindex")).toBe("0");
    expect(rows[1]?.attributes("tabindex")).toBe("-1");

    await rows[0]?.trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    const afterDown = treeItems(wrapper);
    expect(afterDown[0]?.attributes("tabindex")).toBe("-1");
    expect(afterDown[1]?.attributes("tabindex")).toBe("0");

    await afterDown[1]?.trigger("keydown", { key: "ArrowUp" });
    await nextTick();
    const afterUp = treeItems(wrapper);
    expect(afterUp[0]?.attributes("tabindex")).toBe("0");
    expect(afterUp[1]?.attributes("tabindex")).toBe("-1");
  });

  it("omits aria-expanded entirely on a leaf row", async () => {
    wrapper = await mountTree(nestedFixture());

    const leafRow = treeItems(wrapper).find((row) => row.text().includes("shallow"));
    expect(leafRow?.attributes("aria-expanded")).toBeUndefined();
  });
});
