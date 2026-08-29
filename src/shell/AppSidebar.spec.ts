import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createAppRouter } from "../router";
import { useRegistryStore } from "../stores/registry";
import { useSettingsStore } from "../stores/settings";
import { PhGear } from "@phosphor-icons/vue";
import AppSidebar from "./AppSidebar.vue";
import { resolveIcon } from "./icons";
import { __setPendingUpdateForTest } from "./updateSignal";
import type { Update } from "./updateCheck";

function fakeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    version: "1.1.0",
    currentVersion: "1.0.0",
    date: "2026-08-09",
    body: "Bug fixes and improvements.",
    close: () => Promise.resolve(),
    ...overrides,
  } as unknown as Update;
}

// Story 7.8: AppSidebar now listens for clipboard changes on mount (via clipboard.ts's
// onClipboardChange, which wraps @tauri-apps/api/event's listen) — unmocked, this throws in
// jsdom (no real Tauri IPC bridge), the same class of gap every prior Epic 7 story hit for its
// own Tauri-only surface. `readText` needs the same treatment: it's the only clipboard.ts
// function this component ever calls (never `readImage`, per AC12).
type ClipboardChangedHandler = (event: { payload: { kind: string } }) => void;
const clipboardListenHandlers: ClipboardChangedHandler[] = [];
const clipboardUnlisten = vi.fn();
const listen = vi.fn((_event: string, handler: ClipboardChangedHandler) => {
  clipboardListenHandlers.push(handler);
  return Promise.resolve(clipboardUnlisten);
});
const readText = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, handler: ClipboardChangedHandler) => listen(event, handler),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: () => readText(),
  readImage: () => Promise.reject(new Error("AC12: image bytes must never be read here")),
  writeText: () => Promise.resolve(),
}));

// Triggers the most recently mounted AppSidebar's clipboard-change handler — each test mounts
// its own instance, so "most recent" is always the instance under test.
function triggerClipboardChange(kind: "text" | "image"): void {
  const handler = clipboardListenHandlers[clipboardListenHandlers.length - 1];
  handler?.({ payload: { kind } });
}

afterEach(() => {
  __setPendingUpdateForTest(null);
  clipboardListenHandlers.length = 0;
  clipboardUnlisten.mockClear();
  listen.mockClear();
  readText.mockReset();
});

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
      // Subtract whatever the icon component renders itself (nothing, for the
      // Phosphor SVGs; the literal "64" for Base64's deliberate typographic
      // badge — DESIGN.md) — the rest of the link's text must be exactly the
      // tool name, still ruling out any raw icon-key string leaking in.
      expect(link.text().replace(icon.text(), "").trim()).toBe(tool.name);
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
      const tool = registry.tools[index];
      const iconText = link.findComponent(resolveIcon(tool.icon)).text();
      // The collapsed accessible name is the (visually-hidden) label; the
      // icon is `aria-hidden`. Subtract the icon's own text ("64" for Base64,
      // nothing for the rest) before comparing to the tool name.
      expect(link.text().replace(iconText, "").trim()).toBe(tool.name);
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

  it("shows no update dot and no update suffix when no update is pending (AC1, AC7)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    expect(wrapper.find(".update-dot").exists()).toBe(false);
    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.text()).toBe("Settings");
  });

  it("shows an orange dot and 'Update available' in the accessible name for a routine update (AC2, AC7)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    __setPendingUpdateForTest(fakeUpdate());

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const dot = wrapper.find(".update-dot");
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).toContain("routine");
    expect(dot.attributes("aria-hidden")).toBe("true");

    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.text()).toBe("Settings, Update available");
  });

  it("shows a red dot and 'Security update available' in the accessible name for a [security]-marked update (AC2, AC7)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    __setPendingUpdateForTest(fakeUpdate({ body: "[security] Fixes CVE-2026-0001." }));

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    const dot = wrapper.find(".update-dot");
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).toContain("security");

    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.text()).toBe("Settings, Security update available");
  });

  it("keeps the dot and the accessible-name suffix present when the sidebar is collapsed", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const settings = useSettingsStore(pinia);
    settings.sidebarCollapsed = true;
    __setPendingUpdateForTest(fakeUpdate());

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    expect(wrapper.find(".update-dot").exists()).toBe(true);
    const settingsLink = wrapper.find('a[href="/settings"]');
    expect(settingsLink.text()).toBe("Settings, Update available");
  });

  it("clicking the Settings link still navigates to /settings and does not open the update dialog (regression guard)", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    __setPendingUpdateForTest(fakeUpdate());

    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router] },
    });

    await wrapper.find('a[href="/settings"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/settings");
    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
  });
});

describe("Clipboard-suggestion surface (Story 7.8)", () => {
  async function mountSidebar() {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();
    const wrapper = mount(AppSidebar, { global: { plugins: [pinia, router] } });
    return { pinia, router, wrapper };
  }

  it("shows no callout when clipboard content matches nothing", async () => {
    readText.mockResolvedValueOnce("just some plain prose, not shaped like anything");
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    expect(wrapper.find(".clipboard-matches").exists()).toBe(false);
  });

  it("shows a callout for a JWT-shaped match (icon, name, preview, correct route)", async () => {
    readText.mockResolvedValueOnce("abc.def.ghi");
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const callouts = wrapper.findAll(".clipboard-match");
    expect(callouts).toHaveLength(1);
    expect(callouts[0].text()).toContain("JWT");
    expect(callouts[0].text()).toContain("abc.def.ghi");
    expect(callouts[0].attributes("href")).toBe("/tools/jwt");
  });

  it("shows a callout for a JSON-shaped match", async () => {
    readText.mockResolvedValueOnce('{"a":1}');
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const callout = wrapper.find(".clipboard-match");
    expect(callout.text()).toContain("JSON");
    expect(callout.attributes("href")).toBe("/tools/json");
  });

  it("shows a callout for a base64-shaped match", async () => {
    readText.mockResolvedValueOnce("SGVsbG8gd29ybGQ=");
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const callout = wrapper.find(".clipboard-match");
    expect(callout.text()).toContain("Base64");
    expect(callout.attributes("href")).toBe("/tools/base64");
  });

  it("shows a callout for image content, suggesting Bucket, without ever reading clipboard text (AC12)", async () => {
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("image");
    await flushPromises();
    await flushPromises();

    const callout = wrapper.find(".clipboard-match");
    expect(callout.text()).toContain("Bucket");
    expect(callout.text()).toContain("Image copied");
    expect(callout.attributes("href")).toBe("/tools/bucket");
    expect(readText).not.toHaveBeenCalled();
  });

  it("orders multiple matches by specificity, descending (AC4)", async () => {
    // "123456789e1" is simultaneously JSON-shaped (a valid JSON number in scientific notation)
    // and Base64-shaped (11 chars, digit+lowercase diversity clears the review-fix gate — see
    // clipboardMatch.spec.ts) — JSON's specificity (2) must outrank Base64's (1).
    readText.mockResolvedValueOnce("123456789e1");
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const hrefs = wrapper.findAll(".clipboard-match").map((c) => c.attributes("href"));
    expect(hrefs).toEqual(["/tools/json", "/tools/base64"]);
  });

  it("caps the shown callouts at the configured clipboardSuggestionMaxCount (AC4)", async () => {
    const { wrapper, pinia } = await mountSidebar();
    const settings = useSettingsStore(pinia);
    settings.clipboardSuggestionMaxCount = 1;
    readText.mockResolvedValueOnce("123456789e1");

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const callouts = wrapper.findAll(".clipboard-match");
    expect(callouts).toHaveLength(1);
    expect(callouts[0].attributes("href")).toBe("/tools/json");
  });

  it("truncates a long preview with an ellipsis", async () => {
    readText.mockResolvedValueOnce(`{"value":"${"x".repeat(80)}"}`);
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const preview = wrapper.find(".clipboard-match-preview").text();
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(51);
  });

  it("truncates on a Unicode character boundary rather than splitting a surrogate pair", async () => {
    // A quoted string is itself valid JSON, so the raw clipboard text below is the previewed
    // content directly (no JSON-wrapper offset to account for). It's built so an astral emoji
    // (a surrogate pair — 2 UTF-16 code units, 1 Unicode code point) lands as exactly the 50th
    // code point: a raw `.slice(0, 50)` (UTF-16-indexed) would cut the pair in half and render a
    // lone, broken surrogate; a code-point-aware slice keeps the emoji whole.
    const raw = `"${"x".repeat(48)}\u{1F600}tail"`;
    readText.mockResolvedValueOnce(raw);
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const preview = wrapper.find(".clipboard-match-preview").text();
    expect(preview.endsWith("…")).toBe(true);
    expect(preview).not.toContain("�");
    expect(Array.from(preview.slice(0, -1))).toHaveLength(50);
  });

  it("skips matching entirely for pathologically large clipboard content", async () => {
    // Valid JSON (a very long digit string still parses as a number) but far past the
    // review-fix size guard — without it, this would match the JSON tool.
    readText.mockResolvedValueOnce("1".repeat(1_000_001));
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    expect(wrapper.find(".clipboard-matches").exists()).toBe(false);
  });

  it("does no matching work at all when clipboardSuggestionMaxCount is 0 — not just hidden output (AC6)", async () => {
    const { wrapper, pinia } = await mountSidebar();
    const settings = useSettingsStore(pinia);
    settings.clipboardSuggestionMaxCount = 0;

    triggerClipboardChange("text");
    triggerClipboardChange("image");
    await flushPromises();
    await flushPromises();

    // The text branch — the only path that ever reaches a shape predicate — never runs at
    // all. (The predicates themselves aren't spyable here: registry.ts captures their function
    // references into a plain object literal at module-load time, before any test-body
    // vi.spyOn call could run — an ESM binding snapshot, not a live one.)
    expect(readText).not.toHaveBeenCalled();
    expect(wrapper.find(".clipboard-matches").exists()).toBe(false);
  });

  it("clears an already-visible callout when clipboardSuggestionMaxCount is set to 0 mid-session", async () => {
    readText.mockResolvedValueOnce("abc.def.ghi");
    const { wrapper, pinia } = await mountSidebar();
    const settings = useSettingsStore(pinia);

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".clipboard-matches").exists()).toBe(true);

    await settings.setClipboardSuggestionMaxCount(0);
    await flushPromises();

    expect(wrapper.find(".clipboard-matches").exists()).toBe(false);
  });

  it("recovers cleanly when readClipboardText() rejects, without leaving a stale callout", async () => {
    readText.mockRejectedValueOnce(new Error("clipboard read failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    expect(wrapper.find(".clipboard-matches").exists()).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("replaces the candidate list outright on a fresh copy, never stacking (AC10)", async () => {
    readText.mockResolvedValueOnce("abc.def.ghi");
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".clipboard-match").attributes("href")).toBe("/tools/jwt");

    readText.mockResolvedValueOnce('{"a":1}');
    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const callouts = wrapper.findAll(".clipboard-match");
    expect(callouts).toHaveLength(1);
    expect(callouts[0].attributes("href")).toBe("/tools/json");
  });

  it("clears the candidate list outright when a fresh copy matches nothing (AC10)", async () => {
    readText.mockResolvedValueOnce("abc.def.ghi");
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".clipboard-matches").exists()).toBe(true);

    readText.mockResolvedValueOnce("nothing shaped here, just plain prose with spaces!!");
    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    expect(wrapper.find(".clipboard-matches").exists()).toBe(false);
  });

  it("announces the match count via the live region — naming the tool for a single match, count for multiple (AC7)", async () => {
    readText.mockResolvedValueOnce("abc.def.ghi");
    const { wrapper } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("[role='status']").text()).toBe("JWT suggested from clipboard");

    readText.mockResolvedValueOnce("123456789e1");
    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("[role='status']").text()).toBe("2 tools suggested from clipboard");
  });

  it("keeps the live region correctly set to the current count across two same-outcome clipboard changes in a row", async () => {
    // A known aria-live gotcha: most screen readers don't re-announce identical text —
    // announceClipboardMatchCount() guards against it with a clear-then-reset cycle. Real
    // screen-reader re-announcement isn't assertable at this test level (per this story's own
    // Dev Notes) — deferred to Task 10's live verification. This only confirms the final
    // rendered state is correct both times, not the intermediate clear.
    readText.mockResolvedValueOnce("abc.def.ghi");
    const { wrapper } = await mountSidebar();
    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("[role='status']").text()).toBe("JWT suggested from clipboard");

    readText.mockResolvedValueOnce("xyz.uvw.rst");
    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("[role='status']").text()).toBe("JWT suggested from clipboard");
  });

  it("places the callout(s) before Pinned/Recent/All in DOM order, so it's first in tab order too (AC8)", async () => {
    readText.mockResolvedValueOnce("abc.def.ghi");
    const { wrapper, pinia } = await mountSidebar();
    const settings = useSettingsStore(pinia);
    await settings.togglePinned("uuid");

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const firstChild = wrapper.find(".nav-scroll").element.firstElementChild;
    expect(firstChild?.classList.contains("clipboard-matches")).toBe(true);
  });

  it("each callout is a real, focusable <a> that navigates on click (AC8, AC9)", async () => {
    readText.mockResolvedValueOnce("abc.def.ghi");
    const { wrapper, router } = await mountSidebar();

    triggerClipboardChange("text");
    await flushPromises();
    await flushPromises();

    const callout = wrapper.find(".clipboard-match");
    expect(callout.element.tagName).toBe("A");

    await callout.trigger("click");

    // The target route's component is a genuine dynamic import() — resolving it takes more
    // event-loop turns than a single flushPromises() microtask flush. Poll instead of assuming
    // one flush is enough, same pattern CommandPalette.spec.ts already documents.
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/tools/jwt"));
  });

  it("stops listening for clipboard changes on unmount (no listener leak)", async () => {
    const { wrapper } = await mountSidebar();
    await flushPromises(); // let listen()'s promise resolve so the real unlisten fn is captured

    wrapper.unmount();

    expect(clipboardUnlisten).toHaveBeenCalledOnce();
  });
});
