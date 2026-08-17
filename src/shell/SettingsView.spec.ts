import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SettingsView from "./SettingsView.vue";
import { useSettingsStore } from "../stores/settings";

function stubbedSettingsStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const settings = useSettingsStore(pinia);
  settings.entries = vi.fn().mockResolvedValue([]);
  settings.setRestoreEnabled = vi.fn().mockResolvedValue(undefined);
  settings.clearAll = vi.fn().mockResolvedValue(undefined);
  settings.setThemeOverride = vi.fn().mockResolvedValue(undefined);
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
    const wrapper = mount(SettingsView);
    await flushPromises();

    await wrapper.find('input[type="checkbox"]').setValue(false);

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

  it("renders entries dynamically from the store, not a fixed set", async () => {
    const settings = stubbedSettingsStore();
    settings.entries = vi.fn().mockResolvedValue([
      ["shell.lastTool", "json"],
      ["shell.windowGeometry", { x: 1, y: 2, width: 3, height: 4 }],
      ["json.someFutureKey", true],
    ]);

    const wrapper = mount(SettingsView);
    await flushPromises();

    const items = wrapper.findAll(".entries li");
    expect(items).toHaveLength(3);
    expect(wrapper.text()).toContain("shell.lastTool");
    expect(wrapper.text()).toContain("json.someFutureKey");
  });

  it("clicking Clear all calls clearAll and re-renders an empty list", async () => {
    const settings = stubbedSettingsStore();
    settings.entries = vi
      .fn()
      .mockResolvedValueOnce([["shell.lastTool", "json"]])
      .mockResolvedValueOnce([]);

    const wrapper = mount(SettingsView);
    await flushPromises();
    expect(wrapper.findAll(".entries li")).toHaveLength(1);

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(settings.clearAll).toHaveBeenCalled();
    expect(wrapper.findAll(".entries li")).toHaveLength(0);
  });
});
