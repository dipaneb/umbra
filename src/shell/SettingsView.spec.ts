import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SettingsView from "./SettingsView.vue";
import { useSettingsStore } from "../stores/settings";
import {
  __setDialogOpenForTest,
  __setPendingUpdateForTest,
  dialogOpen,
} from "./updateSignal";
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

afterEach(() => {
  __setPendingUpdateForTest(null);
  __setDialogOpenForTest(false);
});

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
  settings.setClipboardSuggestionMaxCount = vi.fn().mockResolvedValue(undefined);
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

  it("discloses the clipboard-suggestion read locally and reflects the persisted count (AC5)", async () => {
    const settings = stubbedSettingsStore();
    settings.clipboardSuggestionMaxCount = 1;
    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(wrapper.text()).toContain("clipboard locally");

    const input = wrapper.find('input[aria-label="Clipboard suggestions to show"]');
    expect((input.element as HTMLInputElement).value).toBe("1");
  });

  it("changing the clipboard-suggestions control calls setClipboardSuggestionMaxCount with the typed number", async () => {
    const settings = stubbedSettingsStore();
    settings.clipboardSuggestionMaxCount = 3;
    const wrapper = mount(SettingsView);
    await flushPromises();

    await wrapper
      .find('input[aria-label="Clipboard suggestions to show"]')
      .setValue("5");

    expect(settings.setClipboardSuggestionMaxCount).toHaveBeenCalledWith(5);
  });

  it("passes an out-of-range typed value straight through to the setter, relying on the store's own clamp rather than silently correcting it here", async () => {
    const settings = stubbedSettingsStore();
    const wrapper = mount(SettingsView);
    await flushPromises();

    await wrapper
      .find('input[aria-label="Clipboard suggestions to show"]')
      .setValue("99");

    // The component itself does no clamping — Task 6's clampClipboardSuggestionMaxCount() in
    // settings.ts is the single source of truth for the 0-5 bound (already covered by
    // settings.spec.ts). This only confirms the component doesn't add a second, potentially
    // divergent clamp of its own.
    expect(settings.setClipboardSuggestionMaxCount).toHaveBeenCalledWith(99);
  });

  it("resets the input's own displayed value to the clamped result after an out-of-range entry (regression: typing 9 visibly stuck on screen after tabbing away)", async () => {
    const settings = stubbedSettingsStore();
    // Mimics the real store's clamp behavior (settings.spec.ts covers the real clamp logic
    // itself) — this test is about the component reflecting that result back into the DOM, not
    // about re-verifying the clamp math.
    settings.setClipboardSuggestionMaxCount = vi.fn().mockImplementation((value: number) => {
      settings.clipboardSuggestionMaxCount = Math.min(5, Math.max(0, value));
      return Promise.resolve();
    });
    const wrapper = mount(SettingsView);
    await flushPromises();

    const input = wrapper.find('input[aria-label="Clipboard suggestions to show"]');
    await input.setValue("9");

    expect((input.element as HTMLInputElement).value).toBe("5");
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

  it("omits the update banner when no update is pending", async () => {
    stubbedSettingsStore();
    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(wrapper.find(".update-banner").exists()).toBe(false);
  });

  it("shows the update banner with the routine copy and version for an ordinary release (AC3)", async () => {
    stubbedSettingsStore();
    __setPendingUpdateForTest(fakeUpdate());
    const wrapper = mount(SettingsView);
    await flushPromises();

    const banner = wrapper.find(".update-banner");
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain("Update available");
    expect(banner.text()).not.toContain("Security update available");
    expect(banner.text()).toContain("1.1.0");
  });

  // Release notes were removed from the banner (2026-08-19, see epics.md's Story 7.7 AC3
  // amendment) -- the dialog is now their only home, so this banner no longer renders body
  // text at all. Marker-stripping coverage isn't lost: UpdateDialog.spec.ts's own
  // "strips a leading [security] marker..." test covers it independently.
  it("shows the update banner with the security copy for a [security]-marked release (AC3)", async () => {
    stubbedSettingsStore();
    __setPendingUpdateForTest(fakeUpdate({ body: "[security] Fixes CVE-2026-0001." }));
    const wrapper = mount(SettingsView);
    await flushPromises();

    const banner = wrapper.find(".update-banner");
    expect(banner.text()).toContain("Security update available");
    expect(banner.text()).not.toContain("[security]");
    expect(banner.text()).not.toContain("Fixes CVE-2026-0001.");
  });

  it("clicking the update banner's button opens the shared update dialog (AC3)", async () => {
    stubbedSettingsStore();
    __setPendingUpdateForTest(fakeUpdate());
    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(dialogOpen.value).toBe(false);
    await wrapper.find(".update-banner button").trigger("click");

    expect(dialogOpen.value).toBe(true);
  });
});
