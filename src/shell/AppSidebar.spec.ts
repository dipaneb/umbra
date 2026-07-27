import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createAppRouter } from "../router";
import { useRegistryStore } from "../stores/registry";
import AppSidebar from "./AppSidebar.vue";

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
