// jsdom has no `ResizeObserver`, and @tanstack/vue-virtual's default
// scroll-container-watching path uses one — same setup JsonTree.spec.ts
// needs for the same reason.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom does no layout, so `offsetWidth`/`offsetHeight` are always 0 — give
// every element a non-zero size so rows actually render (same reasoning as
// JsonTree.spec.ts).
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 500 });
Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 500 });

import { afterAll, afterEach, describe, expect, it } from "vitest";

afterAll(() => {
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
});

import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import DiffTree from "./DiffTree.vue";
import type { DiffNode, DiffValue } from "./jsonDiff";
import type { JsonTreeValue } from "./jsonTreeValue";

function obj(entries: Array<[string, DiffNode]>): DiffValue {
  return { kind: "Object", data: entries };
}
const str = (data: string): DiffValue => ({ kind: "String", data });
const num = (data: string): DiffValue => ({ kind: "Number", data });
const jNum = (data: string): JsonTreeValue => ({ kind: "Number", data });

function unchanged(value: DiffValue): DiffNode {
  return { status: "unchanged", value, old_value: null };
}
function added(value: DiffValue): DiffNode {
  return { status: "added", value, old_value: null };
}
function removed(value: DiffValue): DiffNode {
  return { status: "removed", value, old_value: null };
}
function changedLeaf(value: DiffValue, oldValue: JsonTreeValue): DiffNode {
  return { status: "changed", value, old_value: oldValue };
}
function changedContainer(value: DiffValue): DiffNode {
  return { status: "changed", value, old_value: null };
}

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

function treeItems(w: VueWrapper) {
  return w.findAll('[role="treeitem"]');
}

async function mountTree(root: DiffNode | null): Promise<VueWrapper> {
  const w = mount(DiffTree, { props: { root }, attachTo: document.body });
  await nextTick();
  await nextTick();
  return w;
}

describe("DiffTree", () => {
  it("shows the unavailable status message and no tree when root is null", async () => {
    wrapper = await mountTree(null);

    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.find('[role="tree"]').exists()).toBe(false);
  });

  it("auto-expands ancestors of a change but leaves an unrelated unchanged sibling collapsed", async () => {
    const root = changedContainer(
      obj([
        ["a", changedContainer(obj([["deep", added(str("new"))]]))],
        ["b", unchanged(obj([["shallow", unchanged(str("same"))]]))],
      ]),
    );
    wrapper = await mountTree(root);

    const labels = treeItems(wrapper).map((row) => row.text());
    expect(labels.some((l) => l.includes("deep"))).toBe(true); // under "a", auto-expanded
    expect(labels.some((l) => l.includes("shallow"))).toBe(false); // under "b", left collapsed
  });

  it("applies a status-specific row class per node", async () => {
    const root = changedContainer(
      obj([
        ["a", unchanged(str("x"))],
        ["b", added(str("y"))],
        ["c", removed(str("z"))],
      ]),
    );
    wrapper = await mountTree(root);

    const rows = treeItems(wrapper);
    expect(rows[0]?.classes()).toContain("diff-tree-row-changed"); // root
    expect(rows[1]?.classes()).toContain("diff-tree-row-unchanged");
    expect(rows[2]?.classes()).toContain("diff-tree-row-added");
    expect(rows[3]?.classes()).toContain("diff-tree-row-removed");
  });

  it("renders a changed leaf's old and new values inline, not just one value", async () => {
    const root = changedContainer(obj([["age", changedLeaf(num("31"), jNum("30"))]]));
    wrapper = await mountTree(root);

    const row = treeItems(wrapper).find((r) => r.text().includes("age"));
    expect(row?.find(".diff-tree-old-value").text()).toBe("30");
    expect(row?.find(".diff-tree-new-value").text()).toBe("31");
  });

  it("does not render an old/new split for a row with no old_value", async () => {
    const root = changedContainer(obj([["a", unchanged(str("x"))]]));
    wrapper = await mountTree(root);

    const row = treeItems(wrapper).find((r) => r.text().includes("a"));
    expect(row?.find(".diff-tree-changed-values").exists()).toBe(false);
    expect(row?.find(".diff-tree-preview").exists()).toBe(true);
  });

  it("toggles a container row's expansion on click without disturbing sibling state", async () => {
    const root = changedContainer(
      obj([["a", changedContainer(obj([["deep", added(str("new"))]]))]]),
    );
    wrapper = await mountTree(root);

    expect(treeItems(wrapper).some((r) => r.text().includes("deep"))).toBe(true); // starts auto-expanded

    await treeItems(wrapper)[1]?.trigger("click"); // the "a" row
    expect(treeItems(wrapper).some((r) => r.text().includes("deep"))).toBe(false);

    await treeItems(wrapper)[1]?.trigger("click");
    expect(treeItems(wrapper).some((r) => r.text().includes("deep"))).toBe(true);
  });

  it("toggles expansion on Enter and Space, same as a click", async () => {
    const root = changedContainer(
      obj([["a", changedContainer(obj([["deep", added(str("new"))]]))]]),
    );
    wrapper = await mountTree(root);

    const aRow = treeItems(wrapper)[1];
    await aRow?.trigger("keydown", { key: "Enter" });
    expect(treeItems(wrapper).some((r) => r.text().includes("deep"))).toBe(false);

    await aRow?.trigger("keydown", { key: " " });
    expect(treeItems(wrapper).some((r) => r.text().includes("deep"))).toBe(true);
  });
});
