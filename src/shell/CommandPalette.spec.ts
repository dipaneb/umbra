import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createAppRouter } from "../router";
import CommandPalette from "./CommandPalette.vue";
import { resolveIcon } from "./icons";
import { useRegistryStore } from "../stores/registry";

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

// Real registry order is [JSON, Base64] (see src/stores/registry.ts) — tests
// below rely on that order rather than injecting a synthetic tool, so they
// exercise the actual "b64" alias resolution (FR2).
async function setup() {
  const pinia = createPinia();
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

    // The Base64 route's component is a genuine dynamic `import()` (unlike a
    // synthetic test double), so resolving the navigation takes a few real
    // event-loop turns beyond a single flushPromises() microtask flush —
    // poll instead of assuming one flush is enough.
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe("base64"));
    await flushPromises();
    expect(wrapper.find(".palette-overlay").exists()).toBe(false);
  });

  it("resolves the 'b64' alias to the Base64 tool (FR2)", async () => {
    const { wrapper, router } = await setup();

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();

    const input = wrapper.find("input");
    await input.setValue("b64");

    const options = wrapper.findAll("li[role='option']");
    expect(options).toHaveLength(1);
    expect(options[0].text()).toContain("Base64");

    dispatch({ key: "Enter" });

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe("base64"));
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

  it("opens on Ctrl+K as well as Cmd+K, for cross-platform support (AC1, NFR3)", async () => {
    const { wrapper } = await setup();

    dispatch({ key: "k", ctrlKey: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".palette-overlay").exists()).toBe(true);
  });

  it("wraps active index in both directions with ArrowUp and ArrowDown (AC4)", async () => {
    const { wrapper } = await setup();

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();

    // Default empty query lists all registry entries (JSON, Base64, UUID, Hash, JWT, Cron, Bucket).
    // ArrowUp from index 0 should wrap to the last item, not go negative.
    dispatch({ key: "ArrowUp" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find("li.active").text()).toContain("Bucket");

    // ArrowDown from the last item should wrap back to the first.
    dispatch({ key: "ArrowDown" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find("li.active").text()).toContain("JSON");
  });

  it("resets the active index when a narrowing query invalidates it (AC2, AC4)", async () => {
    const { wrapper } = await setup();

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();

    dispatch({ key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    const input = wrapper.find("input");
    await input.setValue("base");
    await wrapper.vm.$nextTick();

    expect(wrapper.find("li.active").attributes("aria-selected")).toBe("true");

    dispatch({ key: "Enter" });

    await vi.waitFor(() => expect(wrapper?.find(".palette-overlay").exists()).toBe(false));
  });

  it("renders each result's registry icon as a resolved icon component, not raw text (AC5)", async () => {
    const { wrapper, pinia } = await setup();

    dispatch({ key: "k", metaKey: true });
    await wrapper.vm.$nextTick();

    const registry = useRegistryStore(pinia);
    const options = wrapper.findAll("li[role='option']");

    options.forEach((option, index) => {
      const tool = registry.tools[index];
      const icon = option.findComponent(resolveIcon(tool.icon));
      expect(icon.exists()).toBe(true);
      // Subtract whatever the icon component renders itself (nothing, for the
      // Phosphor SVGs; the literal "64" for Base64's deliberate typographic
      // badge — DESIGN.md) — the rest must be exactly the tool name, still
      // ruling out any raw icon-key string leaking in.
      expect(option.text().replace(icon.text(), "").trim()).toBe(tool.name);
    });
  });

  it("removes the window keydown listener on unmount (AD-14)", async () => {
    await setup();
    wrapper?.unmount();
    wrapper = undefined;

    dispatch({ key: "k", metaKey: true });
    await flushPromises();

    expect(document.querySelector(".palette-overlay")).toBeNull();
  });
});
