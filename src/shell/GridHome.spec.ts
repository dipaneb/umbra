import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createAppRouter } from "../router";
import { useRegistryStore } from "../stores/registry";
import { i18n } from "../i18n";
import GridHome from "./GridHome.vue";
import { resolveIcon } from "./icons";

async function mountGridHome() {
  const pinia = createPinia();
  const router = createAppRouter(pinia);
  router.push("/");
  await router.isReady();

  const wrapper = mount(GridHome, {
    global: { plugins: [pinia, router] },
  });

  return { wrapper, pinia, router };
}

describe("GridHome", () => {
  it("renders one card per registry entry, each showing its resolved icon, title, and description", async () => {
    const { wrapper, pinia } = await mountGridHome();
    const registry = useRegistryStore(pinia);
    const cards = wrapper.findAll("a.card");

    expect(cards).toHaveLength(registry.tools.length);
    cards.forEach((card, index) => {
      const tool = registry.tools[index];
      const icon = card.findComponent(resolveIcon(tool.icon));
      expect(icon.exists()).toBe(true);
      expect(card.text()).toContain(tool.name);
      expect(card.text()).toContain(i18n.global.t(tool.descriptionKey));
    });
  });

  it("gives each card an accessible name equal to the tool's name, not the title+description text", async () => {
    const { wrapper, pinia } = await mountGridHome();
    const registry = useRegistryStore(pinia);
    const cards = wrapper.findAll("a.card");

    cards.forEach((card, index) => {
      expect(card.attributes("aria-label")).toBe(registry.tools[index].name);
    });
  });

  it("navigates to the tool's route when a card is clicked", async () => {
    const { wrapper, pinia, router } = await mountGridHome();
    const registry = useRegistryStore(pinia);
    const uuidIndex = registry.tools.findIndex((tool) => tool.id === "uuid");
    const card = wrapper.findAll("a.card")[uuidIndex];

    await card.trigger("click");

    // The tool route's component is a genuine dynamic `import()`, so
    // resolving the navigation takes a few real event-loop turns beyond a
    // single microtask flush — poll instead of assuming one flush is enough
    // (same gap CommandPalette.spec.ts documents for its own click-to-navigate test).
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe("uuid"));
  });

  // Enter-activates-a-focused-<a> is native browser default-action behavior,
  // not application code — no keydown.enter handler exists on the card (nor
  // should one; Task 4's own design is that the plain <a> already covers
  // Enter). jsdom does not implement that default action (confirmed directly:
  // dispatching a real `keydown` with key "Enter" produces no navigation here,
  // unlike a genuine browser), so it cannot be exercised as a click-producing
  // unit test the way Space's explicit handler can. What a unit test *can*
  // verify in this environment is the structural precondition a real browser
  // needs to fire that default action at all: a focusable, real <a> with a
  // resolved href. Full behavioral confirmation (Enter actually opens the
  // tool) is deferred to Task 8's manual pnpm tauri dev check, same as every
  // other real-browser-only verification in this story.
  it("renders each card as a real, focusable <a> with a resolved href, the structural precondition Enter's native browser activation depends on", async () => {
    const { wrapper, pinia } = await mountGridHome();
    const registry = useRegistryStore(pinia);
    const cards = wrapper.findAll("a.card");

    cards.forEach((card, index) => {
      expect(card.element.tagName).toBe("A");
      expect(card.attributes("href")).toBe(registry.tools[index].route);
    });
  });

  it("navigates to the tool's route when a focused card is activated with Space", async () => {
    const { wrapper, pinia, router } = await mountGridHome();
    const registry = useRegistryStore(pinia);
    const baseIndex = registry.tools.findIndex((tool) => tool.id === "base64");
    const card = wrapper.findAll("a.card")[baseIndex];

    await card.trigger("keydown", { key: " " });

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe("base64"));
  });
});
