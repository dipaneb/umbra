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

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterAll(() => {
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
});
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import JsonTree from "./JsonTree.vue";
import type { JsonTreeValue } from "./jsonTreeValue";

const { writeTextMock } = vi.hoisted(() => ({ writeTextMock: vi.fn() }));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: (text: string) => writeTextMock(text),
}));

let wrapper: VueWrapper | undefined;

beforeEach(() => {
  writeTextMock.mockReset();
});

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

function twoMatchFixture(): JsonTreeValue {
  return {
    kind: "Object",
    data: [
      ["first", str("apple")],
      ["second", str("apple pie")],
    ],
  };
}

function multiOccurrenceFixture(): JsonTreeValue {
  return {
    kind: "Object",
    data: [["phrase", str("banana banana banana")]],
  };
}

function treeItems(w: VueWrapper) {
  return w.findAll('[role="treeitem"]');
}

// Matching a row by `row.text().includes("a")` risks picking the wrong row
// (or the root) the moment any descendant text happens to contain that
// substring — the copy-action buttons did exactly this back when they still
// carried visible "Value"/"Path" labels. Match on the `.json-tree-key` span
// itself instead, which only ever holds the exact `"<key>:"` label.
function rowByKey(w: VueWrapper, key: string) {
  return treeItems(w).find((row) => {
    const keyEl = row.find(".json-tree-key");
    return keyEl.exists() && keyEl.text() === `${key}:`;
  });
}

function searchInput(w: VueWrapper) {
  return w.find("#json-tree-search-input");
}

// The search query is debounced (200ms-class, matching JsonView.vue's own
// live-parse debounce) so a keystroke on a large document doesn't force a
// full re-walk per character — real timers, not `vi.useFakeTimers()`, since
// the virtualizer's own settle ticks elsewhere in this file already lean on
// real `nextTick()`/ResizeObserver timing that fake timers could disturb.
async function waitForSearchDebounce() {
  await new Promise((resolve) => setTimeout(resolve, 200));
  await nextTick();
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

    await rowByKey(wrapper, "a")?.trigger("click");
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(true);

    await rowByKey(wrapper, "a")?.trigger("click");
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(false);
  });

  it("toggles a focused expandable row with Enter and Space", async () => {
    wrapper = await mountTree(nestedFixture());

    await rowByKey(wrapper, "a")?.trigger("keydown", { key: "Enter" });
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(true);

    await rowByKey(wrapper, "a")?.trigger("keydown", { key: " " });
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(false);
  });

  it("expands with ArrowRight and collapses with ArrowLeft", async () => {
    wrapper = await mountTree(nestedFixture());

    await rowByKey(wrapper, "a")?.trigger("keydown", { key: "ArrowRight" });
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(true);

    const deepRow = treeItems(wrapper).find((row) => row.text().includes("deep"));
    await deepRow?.trigger("keydown", { key: "ArrowLeft" });

    await rowByKey(wrapper, "a")?.trigger("keydown", { key: "ArrowLeft" });
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

  it("shows a chevron on an expandable row and none on a leaf row", async () => {
    wrapper = await mountTree(nestedFixture());

    const rowA = rowByKey(wrapper, "a");
    const leafRow = treeItems(wrapper).find((row) => row.text().includes("shallow"));

    expect(rowA?.find(".json-tree-chevron svg").exists()).toBe(true);
    expect(leafRow?.find(".json-tree-chevron svg").exists()).toBe(false);
  });

  it("styles a collapsed container's key-count summary distinctly from a real leaf value", async () => {
    wrapper = await mountTree(nestedFixture());

    const rowA = rowByKey(wrapper, "a");
    const leafRow = treeItems(wrapper).find((row) => row.text().includes("shallow"));

    expect(rowA?.find(".json-tree-preview").classes()).toContain("json-tree-summary");
    expect(leafRow?.find(".json-tree-preview").classes()).not.toContain("json-tree-summary");
  });

  it("copies a leaf's JSON-serialized value on Copy value, without also toggling the row", async () => {
    wrapper = await mountTree(nestedFixture());

    const rowB = treeItems(wrapper).find((row) => row.text().includes("shallow"));
    await rowB?.find('button[aria-label="Copy value"]').trigger("click");

    expect(writeTextMock).toHaveBeenCalledWith('"shallow"');
    // A row-scoped copy click must not also fire the row's own toggle handler.
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(false);
  });

  it("copies a container's subtree as compact JSON on Copy value", async () => {
    wrapper = await mountTree(nestedFixture());

    await rowByKey(wrapper, "a")?.find('button[aria-label="Copy value"]').trigger("click");

    expect(writeTextMock).toHaveBeenCalledWith('{"deep":"hidden"}');
  });

  it("copies a JSONPath locator on Copy path", async () => {
    wrapper = await mountTree(nestedFixture());

    const rowB = treeItems(wrapper).find((row) => row.text().includes("shallow"));
    await rowB?.find('button[aria-label="Copy JSONPath"]').trigger("click");

    expect(writeTextMock).toHaveBeenCalledWith("$.b");
  });

  it("surfaces a clipboard write failure via a copy-error emit instead of failing silently", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("clipboard write failed"));
    wrapper = await mountTree(nestedFixture());

    const rowB = treeItems(wrapper).find((row) => row.text().includes("shallow"));
    await rowB?.find('button[aria-label="Copy value"]').trigger("click");
    await nextTick();

    const emitted = wrapper.emitted("copy-error");
    expect(emitted?.[0]?.[0]).toBeInstanceOf(Error);
  });

  it("auto-expands ancestors of a match without hiding unrelated siblings", async () => {
    wrapper = await mountTree(nestedFixture());

    await searchInput(wrapper).setValue("hidden");
    await waitForSearchDebounce();

    expect(rowByKey(wrapper, "a")).toBeTruthy();
    expect(rowByKey(wrapper, "b")).toBeTruthy(); // unrelated sibling stays visible — this is find, not filter
    expect(treeItems(wrapper).some((row) => row.text().includes("deep"))).toBe(true); // ancestor auto-expanded
  });

  it("matches by key as well as by leaf value", async () => {
    wrapper = await mountTree(nestedFixture());

    await searchInput(wrapper).setValue("b");
    await waitForSearchDebounce();

    expect(wrapper.find(".json-tree-match-count").text()).toBe("1 of 1");
  });

  it("highlights the matched substring within a row", async () => {
    wrapper = await mountTree(nestedFixture());

    await searchInput(wrapper).setValue("hidden");
    await waitForSearchDebounce();

    const marks = wrapper.findAll(".json-tree-highlight");
    expect(marks.some((m) => m.text() === "hidden")).toBe(true);
  });

  it("shows a live match count and cycles Next/Previous with wraparound", async () => {
    wrapper = await mountTree(twoMatchFixture());

    await searchInput(wrapper).setValue("apple");
    await waitForSearchDebounce();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("1 of 2");

    await wrapper.find('button[aria-label="Next match"]').trigger("click");
    await nextTick();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("2 of 2");

    await wrapper.find('button[aria-label="Next match"]').trigger("click");
    await nextTick();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("1 of 2"); // wraps forward

    await wrapper.find('button[aria-label="Previous match"]').trigger("click");
    await nextTick();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("2 of 2"); // wraps backward
  });

  it("cycles matches with Enter/Shift+Enter in the search input, keeping focus in the input", async () => {
    wrapper = await mountTree(twoMatchFixture());

    await searchInput(wrapper).setValue("apple");
    await waitForSearchDebounce();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("1 of 2");

    await searchInput(wrapper).trigger("keydown", { key: "Enter" });
    await nextTick();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("2 of 2");

    await searchInput(wrapper).trigger("keydown", { key: "Enter", shiftKey: true });
    await nextTick();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("1 of 2");
  });

  it("cycles matches with ArrowDown/ArrowUp in the search input, wrapping at either end", async () => {
    wrapper = await mountTree(twoMatchFixture());

    await searchInput(wrapper).setValue("apple");
    await waitForSearchDebounce();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("1 of 2");

    await searchInput(wrapper).trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("2 of 2");

    await searchInput(wrapper).trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("1 of 2"); // wraps forward

    await searchInput(wrapper).trigger("keydown", { key: "ArrowUp" });
    await nextTick();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("2 of 2"); // wraps backward
  });

  it("does nothing (no crash, no state change) on ArrowDown/ArrowUp when there are no matches", async () => {
    wrapper = await mountTree(nestedFixture());

    await searchInput(wrapper).setValue("nonexistent-zzz");
    await waitForSearchDebounce();
    expect(wrapper.find(".json-tree-match-count").text()).toBe("No matches");

    await searchInput(wrapper).trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    await searchInput(wrapper).trigger("keydown", { key: "ArrowUp" });
    await nextTick();

    expect(wrapper.find(".json-tree-match-count").text()).toBe("No matches");
  });

  it("does not let ArrowDown/ArrowUp on the search input move the tree's own roving row focus", async () => {
    wrapper = await mountTree(twoMatchFixture());

    await searchInput(wrapper).setValue("apple");
    await waitForSearchDebounce();

    const rowsBefore = treeItems(wrapper);
    const rowIndexBefore = rowsBefore.findIndex((r) => r.attributes("tabindex") === "0");

    await searchInput(wrapper).trigger("keydown", { key: "ArrowDown" });
    await nextTick();

    // The tree's own row-to-row keyboard navigation (a separate handler bound
    // to each treeitem, not the search input) must be untouched by this —
    // the roving tabindex should still point at the same row it did before.
    const rowIndexAfter = treeItems(wrapper).findIndex((r) => r.attributes("tabindex") === "0");
    expect(rowIndexAfter).toBe(rowIndexBefore);
  });

  it("marks the current match's highlighted text distinctly from other matches", async () => {
    wrapper = await mountTree(twoMatchFixture());

    await searchInput(wrapper).setValue("apple");
    await waitForSearchDebounce();
    expect(
      rowByKey(wrapper, "first")?.find(".json-tree-highlight").classes(),
    ).toContain("json-tree-highlight-current");
    expect(
      rowByKey(wrapper, "second")?.find(".json-tree-highlight").classes(),
    ).not.toContain("json-tree-highlight-current");

    await wrapper.find('button[aria-label="Next match"]').trigger("click");
    await nextTick();
    expect(
      rowByKey(wrapper, "first")?.find(".json-tree-highlight").classes(),
    ).not.toContain("json-tree-highlight-current");
    expect(
      rowByKey(wrapper, "second")?.find(".json-tree-highlight").classes(),
    ).toContain("json-tree-highlight-current");
  });

  it("counts multiple occurrences on a single row as separate matches, not one", async () => {
    wrapper = await mountTree(multiOccurrenceFixture());

    await searchInput(wrapper).setValue("banana");
    await waitForSearchDebounce();

    // Three "banana"s on one row must be three navigable matches, not one —
    // this is the exact bug report: multiple hits on one line collapsing
    // into a single step.
    expect(wrapper.find(".json-tree-match-count").text()).toBe("1 of 3");
    expect(rowByKey(wrapper, "phrase")?.findAll(".json-tree-highlight")).toHaveLength(3);
  });

  it("marks only the current occurrence within a multi-occurrence row, never all of them at once", async () => {
    const w = await mountTree(multiOccurrenceFixture());
    wrapper = w;

    await searchInput(w).setValue("banana");
    await waitForSearchDebounce();

    const currentCount = () => rowByKey(w, "phrase")?.findAll(".json-tree-highlight-current").length ?? 0;
    const marks = () => rowByKey(w, "phrase")?.findAll(".json-tree-highlight") ?? [];

    expect(currentCount()).toBe(1);
    expect(marks()[0]?.classes()).toContain("json-tree-highlight-current");

    await wrapper.find('button[aria-label="Next match"]').trigger("click");
    await nextTick();
    expect(currentCount()).toBe(1); // still exactly one, never more
    expect(marks()[1]?.classes()).toContain("json-tree-highlight-current");
    expect(marks()[0]?.classes()).not.toContain("json-tree-highlight-current");

    await wrapper.find('button[aria-label="Next match"]').trigger("click");
    await nextTick();
    expect(currentCount()).toBe(1);
    expect(marks()[2]?.classes()).toContain("json-tree-highlight-current");
  });

  it("shows 'No matches' without hiding the tree when nothing matches", async () => {
    wrapper = await mountTree(nestedFixture());

    await searchInput(wrapper).setValue("nonexistent-zzz");
    await waitForSearchDebounce();

    expect(wrapper.find(".json-tree-match-count").text()).toBe("No matches");
    expect(rowByKey(wrapper, "a")).toBeTruthy();
    expect(rowByKey(wrapper, "b")).toBeTruthy();
  });

  it("clears the search on Escape", async () => {
    wrapper = await mountTree(nestedFixture());

    await searchInput(wrapper).setValue("hidden");
    await waitForSearchDebounce();

    await searchInput(wrapper).trigger("keydown", { key: "Escape" });
    await waitForSearchDebounce();

    expect((searchInput(wrapper).element as HTMLInputElement).value).toBe("");
    expect(wrapper.find(".json-tree-match-count").exists()).toBe(false);
  });
});
