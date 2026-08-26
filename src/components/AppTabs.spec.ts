import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import AppTabs from "./AppTabs.vue";

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

const TABS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
];

describe("AppTabs", () => {
  it("marks the modelValue tab as selected via aria-selected", () => {
    wrapper = mount(AppTabs, { props: { tabs: TABS, modelValue: "two" } });

    expect(wrapper.find("#tab-one").attributes("aria-selected")).toBe("false");
    expect(wrapper.find("#tab-two").attributes("aria-selected")).toBe("true");
  });

  it("emits update:modelValue when a tab is clicked", async () => {
    wrapper = mount(AppTabs, { props: { tabs: TABS, modelValue: "one" } });

    await wrapper.find("#tab-three").trigger("click");

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["three"]);
  });

  // WebKit (this app's Tauri macOS runtime) doesn't move focus to a
  // clicked button by default, unlike Chromium/Firefox — clicking must
  // explicitly call .focus() the same way ArrowRight/ArrowLeft already do,
  // or a following arrow-key press acts on stale focus.
  it("moves DOM focus to the clicked tab", async () => {
    wrapper = mount(AppTabs, { props: { tabs: TABS, modelValue: "one" }, attachTo: document.body });

    await wrapper.find("#tab-three").trigger("click");

    expect(document.activeElement?.id).toBe("tab-three");
  });

  it("moves selection with ArrowRight/ArrowLeft, wrapping at the ends", async () => {
    wrapper = mount(AppTabs, { props: { tabs: TABS, modelValue: "three" }, attachTo: document.body });

    await wrapper.find("#tab-three").trigger("keydown", { key: "ArrowRight" });
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["one"]);

    await wrapper.setProps({ modelValue: "one" });
    await wrapper.find("#tab-one").trigger("keydown", { key: "ArrowLeft" });
    expect(wrapper.emitted("update:modelValue")?.[1]).toEqual(["three"]);
  });

  it("only the active tab is in the tab order", () => {
    wrapper = mount(AppTabs, { props: { tabs: TABS, modelValue: "two" } });

    expect(wrapper.find("#tab-one").attributes("tabindex")).toBe("-1");
    expect(wrapper.find("#tab-two").attributes("tabindex")).toBe("0");
    expect(wrapper.find("#tab-three").attributes("tabindex")).toBe("-1");
  });
});
