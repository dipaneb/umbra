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
    const links = wrapper.findAll("ul.nav-all a");

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
    const links = wrapper.findAll("ul.nav-all a");

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
    const links = wrapper.findAll("ul.nav-all a");

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

    wrapper.findAll("ul.nav-all a").forEach((link) => {
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
    const links = wrapper.findAll("ul.nav-all a");

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
    const links = wrapper.findAll("ul.nav-all a");

    links.forEach((link, index) => {
      expect(link.text()).toBe(registry.tools[index].name);
    });

    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.text()).toBe("Settings");
  });

  it("pinning a tool moves it into the Pinned section, and it still also appears in the All-tools section (AC1, AC3)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("json");

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const pinnedLinks = wrapper.findAll("ul.nav-pinned a");
    expect(pinnedLinks).toHaveLength(1);
    expect(pinnedLinks[0].text()).toContain("JSON");

    const allLinks = wrapper.findAll("ul.nav-all a");
    expect(allLinks.some((link) => link.text().includes("JSON"))).toBe(true);
  });

  it("populates Recent from navigation, most-recent-first, deduped, capped at 5", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    for (const id of ["json", "base64", "uuid", "hash", "jwt"]) {
      await settings.recordRecentTool(id);
    }
    await settings.recordRecentTool("cron");
    await settings.recordRecentTool("json");

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const recentLinks = wrapper.findAll("ul.nav-recent a");
    expect(recentLinks.map((link) => link.text())).toEqual([
      "JSON",
      "Cron",
      "JWT",
      "Hash",
      "UUID",
    ]);
  });

  it("never shows a pinned tool in Recent at the same time (joint invariant)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.recordRecentTool("json");
    await settings.recordRecentTool("uuid");
    await settings.togglePinned("json");

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const pinnedLinks = wrapper.findAll("ul.nav-pinned a");
    expect(pinnedLinks.map((link) => link.text())).toContain("JSON");

    const recentLinks = wrapper.findAll("ul.nav-recent a");
    expect(recentLinks.map((link) => link.text())).not.toContain("JSON");
    expect(recentLinks.map((link) => link.text())).toContain("UUID");
  });

  it("unpinning returns a tool to only the All-tools section until a fresh navigation adds it back to Recent (AC4)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("json");
    await settings.togglePinned("json");

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    expect(wrapper.find("ul.nav-pinned").exists()).toBe(false);
    expect(wrapper.find("ul.nav-recent").exists()).toBe(false);
    const allLinks = wrapper.findAll("ul.nav-all a");
    expect(allLinks.some((link) => link.text().includes("JSON"))).toBe(true);
  });

  it("unpinning a tool that was already tracked in Recent surfaces it there immediately, per the normal recency rule (AC4)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.recordRecentTool("json");
    await settings.togglePinned("json");
    await settings.togglePinned("json");

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const recentLinks = wrapper.findAll("ul.nav-recent a");
    expect(recentLinks.map((link) => link.text())).toContain("JSON");
  });

  it("hides Pinned/Recent entirely when their visibility toggle is off, without touching the underlying data (AC7)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("json");
    await settings.recordRecentTool("uuid");
    await settings.setPinnedToolsVisible(false);
    await settings.setRecentToolsVisible(false);

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    expect(wrapper.find("ul.nav-pinned").exists()).toBe(false);
    expect(wrapper.find("ul.nav-recent").exists()).toBe(false);
    expect(settings.pinnedTools).toEqual(["json"]);
    expect(settings.recentTools).toEqual(["uuid"]);
  });

  it("removes the pin button entirely (not just hidden) when 'Show pinned tools' is off, even while expanded", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.setPinnedToolsVisible(false);

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    expect(wrapper.findAll(".pin-toggle")).toHaveLength(0);
  });

  it("surfaces a pinned tool's own recent usage in Recent while Pinned is hidden, then re-excludes it once Pinned is shown again (round-trip)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.recordRecentTool("json");
    await settings.togglePinned("json");

    // Baseline: Pinned visible (default) — "json" is pinned, so it's
    // excluded from Recent to avoid showing the same tool twice.
    let wrapper = mount(AppSidebar, { global: { plugins: [pinia, router] } });
    expect(
      wrapper.findAll("ul.nav-recent a").map((link) => link.text()),
    ).not.toContain("JSON");
    expect(wrapper.findAll(".pin-toggle").length).toBeGreaterThan(0);

    // Hide Pinned: nothing on screen shows "json" is pinned anymore, so its
    // recent usage must surface in Recent instead of silently vanishing —
    // and the pin control disappears too, since there's no visible pinned
    // state left to toggle.
    await settings.setPinnedToolsVisible(false);
    wrapper = mount(AppSidebar, { global: { plugins: [pinia, router] } });
    expect(
      wrapper.findAll("ul.nav-recent a").map((link) => link.text()),
    ).toContain("JSON");
    expect(wrapper.findAll(".pin-toggle")).toHaveLength(0);
    expect(settings.pinnedTools).toEqual(["json"]);

    // Re-show Pinned: "json" reappears in Pinned, and Recent goes back to
    // excluding it — no manual re-sync needed, the underlying data (both
    // pinnedTools and recentTools) never changed through any of this.
    await settings.setPinnedToolsVisible(true);
    wrapper = mount(AppSidebar, { global: { plugins: [pinia, router] } });
    expect(
      wrapper.findAll("ul.nav-pinned a").map((link) => link.text()),
    ).toContain("JSON");
    expect(
      wrapper.findAll("ul.nav-recent a").map((link) => link.text()),
    ).not.toContain("JSON");
    expect(wrapper.findAll(".pin-toggle").length).toBeGreaterThan(0);
  });

  it("the pin button is a real, keyboard-reachable button whose aria-pressed/aria-label reflect pinned state (AC1, AC4, NFR5)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });
    const settings = useSettingsStore(pinia);
    const registry = useRegistryStore(pinia);

    const jsonIndex = registry.tools.findIndex((tool) => tool.id === "json");
    const pinButton = wrapper.findAll("ul.nav-all .pin-toggle")[jsonIndex];
    expect(pinButton.element.tagName).toBe("BUTTON");
    expect(pinButton.attributes("aria-pressed")).toBe("false");
    expect(pinButton.attributes("aria-label")).toBe("Pin JSON");

    await pinButton.trigger("click");

    expect(settings.pinnedTools).toContain("json");
    const updatedButton = wrapper.findAll("ul.nav-all .pin-toggle")[jsonIndex];
    expect(updatedButton.attributes("aria-pressed")).toBe("true");
    expect(updatedButton.attributes("aria-label")).toBe("Unpin JSON");
  });

  it("the pin button is absent (not just hidden) when the sidebar is collapsed", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    settings.sidebarCollapsed = true;

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    expect(wrapper.findAll(".pin-toggle")).toHaveLength(0);
  });

  it("omits a pinned/recent id with no matching registry tool, without throwing (stale state)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("not-a-real-tool");
    await settings.recordRecentTool("also-not-a-real-tool");

    expect(() =>
      mount(AppSidebar, { global: { plugins: [pinia, router] } }),
    ).not.toThrow();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });
    expect(wrapper.find("ul.nav-pinned").exists()).toBe(false);
    expect(wrapper.find("ul.nav-recent").exists()).toBe(false);
  });

  it("labels all three sections, in order, when Pinned and Recent are both populated", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("json");
    await settings.recordRecentTool("uuid");

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const headings = wrapper.findAll(".nav-section-heading").map((h) => h.text());
    expect(headings).toEqual(["Pinned", "Recent", "All tools"]);
  });

  it("labels the lone All-tools section on a fresh install (nothing pinned or recent)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const headings = wrapper.findAll(".nav-section-heading").map((h) => h.text());
    expect(headings).toEqual(["All tools"]);
  });

  it("removes every section heading entirely (not just visually) when the sidebar is collapsed", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("json");
    await settings.recordRecentTool("uuid");
    settings.sidebarCollapsed = true;

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    expect(wrapper.findAll(".nav-section-heading")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("Pinned");
    expect(wrapper.text()).not.toContain("Recent");
    expect(wrapper.text()).not.toContain("All tools");
  });

  it("keeps the Settings link outside the scrolling tool list, as a direct child of nav", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    expect(
      wrapper.find(".nav-scroll").findAll('a[href="/settings"]'),
    ).toHaveLength(0);
    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.element.parentElement).toBe(wrapper.find("nav").element);
  });

  it("renders one .nav-section wrapper per visible section, in Pinned/Recent/All order", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("json");
    await settings.recordRecentTool("uuid");

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const sections = wrapper.findAll(".nav-section");
    expect(sections).toHaveLength(3);
    expect(sections[0].find("ul").classes()).toContain("nav-pinned");
    expect(sections[1].find("ul").classes()).toContain("nav-recent");
    expect(sections[2].find("ul").classes()).toContain("nav-all");
  });

  it("marks every appearance of the active tool as active, when it's both pinned and in All tools", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("json");
    router.push("/tools/json");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const pinnedLink = wrapper.find("ul.nav-pinned a");
    expect(pinnedLink.classes()).toContain("router-link-exact-active");
    expect(pinnedLink.attributes("aria-current")).toBe("page");

    const registry = useRegistryStore(pinia);
    const jsonIndex = registry.tools.findIndex((tool) => tool.id === "json");
    const allLink = wrapper.findAll("ul.nav-all a")[jsonIndex];
    expect(allLink.classes()).toContain("router-link-exact-active");
    expect(allLink.attributes("aria-current")).toBe("page");
  });
});
