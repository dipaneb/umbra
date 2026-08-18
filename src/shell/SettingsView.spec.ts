import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SettingsView from "./SettingsView.vue";
import { useSettingsStore } from "../stores/settings";

async function openAdvanced(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find('input[aria-label="Show stored data"]').setValue(true);
}

function stubbedSettingsStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const settings = useSettingsStore(pinia);
  settings.entries = vi.fn().mockResolvedValue([]);
  settings.setRestoreEnabled = vi.fn().mockResolvedValue(undefined);
  settings.clearAll = vi.fn().mockResolvedValue(undefined);
  settings.setThemeOverride = vi.fn().mockResolvedValue(undefined);
  settings.setPinnedToolsVisible = vi.fn().mockResolvedValue(undefined);
  settings.setRecentToolsVisible = vi.fn().mockResolvedValue(undefined);
  settings.resetKey = vi.fn().mockResolvedValue(undefined);
  return settings;
}

describe("SettingsView", () => {
  it("discloses the update-check network exception (AC2)", async () => {
    stubbedSettingsStore();
    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(wrapper.text()).toContain("automatic");
    expect(wrapper.text()).toContain("update");
    expect(wrapper.text()).toContain("no telemetry");
  });

  it("toggling the restore checkbox calls setRestoreEnabled", async () => {
    const settings = stubbedSettingsStore();
    settings.restoreEnabled = true;
    const wrapper = mount(SettingsView);
    await flushPromises();

    await wrapper
      .find(
        'input[aria-label="Restore last tool and window position on launch"]',
      )
      .setValue(false);

    expect(settings.setRestoreEnabled).toHaveBeenCalledWith(false);
  });

  it("changing the theme control calls setThemeOverride and reflects the current override", async () => {
    const settings = stubbedSettingsStore();
    settings.themeOverride = "dark";
    const wrapper = mount(SettingsView);
    await flushPromises();

    const select = wrapper.find('select[aria-label="Theme"]');
    expect((select.element as HTMLSelectElement).value).toBe("dark");

    await select.setValue("light");

    expect(settings.setThemeOverride).toHaveBeenCalledWith("light");
  });

  it("toggling the 'Show pinned tools' checkbox calls setPinnedToolsVisible and reflects the current state", async () => {
    const settings = stubbedSettingsStore();
    settings.pinnedToolsVisible = false;
    const wrapper = mount(SettingsView);
    await flushPromises();

    const checkbox = wrapper.find(
      'input[aria-label="Show pinned tools in the sidebar"]',
    );
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);

    await checkbox.setValue(true);

    expect(settings.setPinnedToolsVisible).toHaveBeenCalledWith(true);
  });

  it("toggling the 'Show recent tools' checkbox calls setRecentToolsVisible and reflects the current state", async () => {
    const settings = stubbedSettingsStore();
    settings.recentToolsVisible = false;
    const wrapper = mount(SettingsView);
    await flushPromises();

    const checkbox = wrapper.find(
      'input[aria-label="Show recent tools in the sidebar"]',
    );
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);

    await checkbox.setValue(true);

    expect(settings.setRecentToolsVisible).toHaveBeenCalledWith(true);
  });

  it("hides stored-data entries by default, even when data is persisted", async () => {
    const settings = stubbedSettingsStore();
    settings.entries = vi
      .fn()
      .mockResolvedValue([["shell.lastTool", "json"]]);

    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(wrapper.findAll(".entries li")).toHaveLength(0);
    expect(wrapper.find('input[aria-label="Show stored data"]').exists()).toBe(
      true,
    );
  });

  it("reveals entries dynamically from the store, not a fixed set, once 'Show stored data' is checked", async () => {
    const settings = stubbedSettingsStore();
    settings.entries = vi.fn().mockResolvedValue([
      ["shell.lastTool", "json"],
      ["shell.windowGeometry", { x: 1, y: 2, width: 3, height: 4 }],
      ["json.someFutureKey", true],
    ]);

    const wrapper = mount(SettingsView);
    await flushPromises();
    await openAdvanced(wrapper);

    const items = wrapper.findAll(".entries li");
    expect(items).toHaveLength(3);
    expect(wrapper.text()).toContain("shell.lastTool");
    expect(wrapper.text()).toContain("json.someFutureKey");
  });

  it("clicking Clear all stored data calls clearAll regardless of the advanced view's state", async () => {
    const settings = stubbedSettingsStore();
    settings.entries = vi
      .fn()
      .mockResolvedValueOnce([["shell.lastTool", "json"]])
      .mockResolvedValueOnce([]);

    const wrapper = mount(SettingsView);
    await flushPromises();
    await openAdvanced(wrapper);
    expect(wrapper.findAll(".entries li")).toHaveLength(1);

    await wrapper.find('button[aria-label="Clear all stored data"]').trigger("click");
    await flushPromises();

    expect(settings.clearAll).toHaveBeenCalled();
    expect(wrapper.findAll(".entries li")).toHaveLength(0);
  });

  it("clicking Clear all stored data works while the disclosure is still closed, the default state", async () => {
    const settings = stubbedSettingsStore();
    settings.entries = vi.fn().mockResolvedValue([["shell.lastTool", "json"]]);

    const wrapper = mount(SettingsView);
    await flushPromises();
    expect(wrapper.find('input[aria-label="Show stored data"]').element)
      .not.toHaveProperty("checked", true);

    await wrapper.find('button[aria-label="Clear all stored data"]').trigger("click");
    await flushPromises();

    expect(settings.clearAll).toHaveBeenCalled();
  });

  it("clicking a per-item reset button calls resetKey for that key and refreshes the list", async () => {
    const settings = stubbedSettingsStore();
    settings.entries = vi
      .fn()
      .mockResolvedValueOnce([
        ["shell.lastTool", "json"],
        ["shell.themeOverride", "dark"],
      ])
      .mockResolvedValueOnce([["shell.themeOverride", "dark"]]);

    const wrapper = mount(SettingsView);
    await flushPromises();
    await openAdvanced(wrapper);
    expect(wrapper.findAll(".entries li")).toHaveLength(2);

    await wrapper.find('button[aria-label="Reset shell.lastTool"]').trigger("click");
    await flushPromises();

    expect(settings.resetKey).toHaveBeenCalledWith("shell.lastTool");
    expect(wrapper.findAll(".entries li")).toHaveLength(1);
  });
});
