import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createAppRouter } from "../router";
import { useRegistryStore } from "../stores/registry";
import CommandPalette from "./CommandPalette.vue";

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

async function setup() {
  const pinia = createPinia();

  useRegistryStore(pinia).tools.push({
    id: "b64",
    name: "Base64",
    aliases: ["b64"],
    route: "/tools/b64",
    icon: "#",
    component: () => Promise.resolve({ template: "<div />" }),
  });

  const router = createAppRouter(pinia);
  router.push("/");
  await router.isReady();

  wrapper = mount(CommandPalette, {
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  });

  return { pinia, router, wrapper };
}

function dispatch(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent("keydown", init));
}

describe("CommandPalette", () => {
  it("opens on Cmd+K and closes on Escape (AC1, AC2)", async () => {
    const { wrapper } = await setup();

    expect(wrapper.find(".palette-overlay").exists()).toBe(false);

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".palette-overlay").exists()).toBe(true);

    dispatch({ key: "Escape" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".palette-overlay").exists()).toBe(false);
  });

  it("shows results matching the query, ranked like paletteSearch (AC2)", async () => {
    const { wrapper } = await setup();

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();

    const input = wrapper.find("input");
    await input.setValue("base");

    const options = wrapper.findAll("li[role='option']");
    expect(options).toHaveLength(1);
    expect(options[0].text()).toContain("Base64");
  });

  it("navigates with arrows and opens the selected tool on Enter (AC2, AC4)", async () => {
    const { wrapper, router } = await setup();

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();

    dispatch({ key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    const activeOption = wrapper.find("li.active");
    expect(activeOption.attributes("aria-selected")).toBe("true");
    expect(document.activeElement?.tagName).toBe("INPUT");

    dispatch({ key: "Enter" });
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("b64");
    expect(wrapper.find(".palette-overlay").exists()).toBe(false);
  });

  it("shows an explicit empty state for a query matching nothing (AC3)", async () => {
    const { wrapper } = await setup();

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();

    const input = wrapper.find("input");
    await input.setValue("zzz");

    expect(wrapper.find("ul").exists()).toBe(false);
    expect(wrapper.find("[role='status']").text()).toContain('No tools match "zzz"');
  });

  it("labels the input for keyboard-only usage (AC4)", async () => {
    const { wrapper } = await setup();

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.find("input").attributes("aria-label")).toBeTruthy();
  });
});
