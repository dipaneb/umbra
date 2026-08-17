import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createAppRouter } from "../router";
import { useRegistryStore } from "../stores/registry";
import { useSettingsStore } from "../stores/settings";
import { PhGear } from "@phosphor-icons/vue";
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

  it("marks the active tool's link with router-link-exact-active and aria-current, and no other tool link (AC2, AC3)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/tools/json");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const registry = useRegistryStore(pinia);
    const links = wrapper.findAll("ul a");

    links.forEach((link, index) => {
      const tool = registry.tools[index];
      if (tool.id === "json") {
        expect(link.classes()).toContain("router-link-exact-active");
        expect(link.attributes("aria-current")).toBe("page");
      } else {
        expect(link.classes()).not.toContain("router-link-exact-active");
        expect(link.attributes("aria-current")).toBeUndefined();
      }
    });

    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.classes()).not.toContain("router-link-exact-active");
  });

  it("marks the Settings link with router-link-exact-active and aria-current when on /settings", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/settings");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.classes()).toContain("router-link-exact-active");
    expect(settingsLink.attributes("aria-current")).toBe("page");

    wrapper.findAll("ul a").forEach((link) => {
      expect(link.classes()).not.toContain("router-link-exact-active");
    });
  });

  it("renders the active tool's icon at bold weight and every other tool's icon at regular weight", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/tools/json");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const registry = useRegistryStore(pinia);
    const links = wrapper.findAll("ul a");

    links.forEach((link, index) => {
      const tool = registry.tools[index];
      const icon = link.findComponent(resolveIcon(tool.icon));
      const iconProps = icon.props() as Record<string, unknown>;
      expect(iconProps.weight).toBe(tool.id === "json" ? "bold" : "regular");
    });
  });

  it("renders the Settings icon at bold weight when on /settings, regular otherwise", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/settings");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const settingsLink = wrapper.find('a[href="/settings"]');
    const icon = settingsLink.findComponent(PhGear);
    expect(icon.props("weight")).toBe("bold");
  });

  it("the collapse control is a real button that toggles settings.sidebarCollapsed (AC5)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const settings = useSettingsStore(pinia);
    expect(settings.sidebarCollapsed).toBe(false);

    const button = wrapper.find("button");
    expect(button.exists()).toBe(true);
    expect(button.element.tagName).toBe("BUTTON");

    await button.trigger("click");

    expect(settings.sidebarCollapsed).toBe(true);
  });

  it("keeps every nav link's accessible name equal to the tool name (or Settings) when collapsed (AC5)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    settings.sidebarCollapsed = true;

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const registry = useRegistryStore(pinia);
    const links = wrapper.findAll("ul a");

    links.forEach((link, index) => {
      expect(link.text()).toBe(registry.tools[index].name);
    });

    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.text()).toBe("Settings");
  });
});
