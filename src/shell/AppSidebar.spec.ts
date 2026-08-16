import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createAppRouter } from "../router";
import { useRegistryStore } from "../stores/registry";
import AppSidebar from "./AppSidebar.vue";
import { resolveIcon } from "./icons";

describe("AppSidebar", () => {
  it("renders one real <a> link per registry entry, labeled with the tool name", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const registry = useRegistryStore(pinia);
    const links = wrapper.findAll("ul a");

    expect(links).toHaveLength(registry.tools.length);
    links.forEach((link, index) => {
      expect(link.element.tagName).toBe("A");
      expect(link.text()).toContain(registry.tools[index].name);
    });
  });

  it("renders each tool's registry icon as a resolved icon component, not raw text (AC5)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const registry = useRegistryStore(pinia);
    const links = wrapper.findAll("ul a");

    links.forEach((link, index) => {
      const tool = registry.tools[index];
      const icon = link.findComponent(resolveIcon(tool.icon));
      expect(icon.exists()).toBe(true);
      // Exact match, not `not.toContain(tool.icon)` — the icon component
      // renders no text, so the link's only real text content is the tool
      // name. An exact match rules out any raw icon string leaking in,
      // regardless of case, rather than relying on today's icon/name pairs
      // happening to differ by case.
      expect(link.text()).toBe(tool.name);
    });
  });

  it("renders a Settings link that is not sourced from the registry", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.exists()).toBe(true);
    expect(settingsLink.text()).toContain("Settings");
  });
});
