import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createPinia, setActivePinia } from "pinia";

function createFakeStore() {
  const data = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(data.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      data.set(key, value);
      return Promise.resolve();
    }),
    save: vi.fn(() => Promise.resolve()),
    entries: vi.fn(() => Promise.resolve(Array.from(data.entries()))),
    clear: vi.fn(() => {
      data.clear();
      return Promise.resolve();
    }),
    delete: vi.fn((key: string) => Promise.resolve(data.delete(key))),
  };
}

let fakeStore: ReturnType<typeof createFakeStore>;
const load = vi.fn();

vi.mock("@tauri-apps/plugin-store", () => ({
  load: (path: string, options?: unknown) => load(path, options),
}));

const { useSettingsStore } = await import("./settings");

beforeEach(() => {
  vi.useFakeTimers();
  setActivePinia(createPinia());
  fakeStore = createFakeStore();
  load.mockResolvedValue(fakeStore);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSettingsStore", () => {
  it("defaults restoreEnabled to false when the key is absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.restoreEnabled).toBe(false);
  });

  it("preserves an existing install's restoreEnabled value when the key is already persisted", async () => {
    fakeStore.set("shell.restoreSessionEnabled", true);
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.restoreEnabled).toBe(true);
  });

  it("records the last tool and persists it when restore is enabled", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);
    fakeStore.set.mockClear();
    fakeStore.save.mockClear();

    await settings.recordLastTool("json");

    expect(fakeStore.set).toHaveBeenCalledWith("shell.lastTool", "json");
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("does not persist the last tool when restore is disabled", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(false);
    fakeStore.set.mockClear();
    fakeStore.save.mockClear();

    await settings.recordLastTool("json");

    expect(fakeStore.set).not.toHaveBeenCalled();
    expect(fakeStore.save).not.toHaveBeenCalled();
  });

  it("debounces and persists window geometry when restore is enabled", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);
    fakeStore.set.mockClear();
    fakeStore.save.mockClear();

    settings.recordWindowGeometry({ x: 1, y: 2, width: 800, height: 600 });
    settings.recordWindowGeometry({ x: 3, y: 4, width: 810, height: 610 });
    expect(fakeStore.set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.set).toHaveBeenCalledTimes(1);
    expect(fakeStore.set).toHaveBeenCalledWith("shell.windowGeometry", {
      x: 3,
      y: 4,
      width: 810,
      height: 610,
    });
  });

  it("does not persist window geometry when restore is disabled", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(false);
    fakeStore.set.mockClear();

    settings.recordWindowGeometry({ x: 1, y: 2, width: 800, height: 600 });
    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.set).not.toHaveBeenCalled();
  });

  it("clears all persisted state and resets restoreEnabled to false", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);

    await settings.clearAll();

    expect(fakeStore.clear).toHaveBeenCalled();
    expect(fakeStore.save).toHaveBeenCalled();
    expect(settings.restoreEnabled).toBe(false);
  });

  it("cancels a pending window geometry write when restore is toggled off mid-debounce", async () => {
    const settings = useSettingsStore();
    await settings.init();

    settings.recordWindowGeometry({ x: 1, y: 2, width: 800, height: 600 });
    await settings.setRestoreEnabled(false);

    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.set).not.toHaveBeenCalledWith(
      "shell.windowGeometry",
      expect.anything(),
    );
  });

  it("cancels a pending window geometry write when clearAll runs mid-debounce", async () => {
    const settings = useSettingsStore();
    await settings.init();

    settings.recordWindowGeometry({ x: 1, y: 2, width: 800, height: 600 });
    await settings.clearAll();
    fakeStore.set.mockClear();

    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.set).not.toHaveBeenCalled();
  });

  it("defaults themeOverride to system when the key is absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.themeOverride).toBe("system");
  });

  it("setThemeOverride persists and updates the ref", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setThemeOverride("dark");

    expect(settings.themeOverride).toBe("dark");
    expect(fakeStore.set).toHaveBeenCalledWith("shell.themeOverride", "dark");
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("falls back to system when the persisted themeOverride value is invalid", async () => {
    fakeStore.set("shell.themeOverride", "sepia");
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.themeOverride).toBe("system");
  });

  it("clearAll resets themeOverride back to system", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setThemeOverride("dark");

    await settings.clearAll();

    expect(settings.themeOverride).toBe("system");
  });

  it("defaults locale to system when the key is absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.locale).toBe("system");
  });

  it("setLocale persists and updates the ref", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setLocale("fr");

    expect(settings.locale).toBe("fr");
    expect(fakeStore.set).toHaveBeenCalledWith("shell.locale", "fr");
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("falls back to system when the persisted locale value is invalid", async () => {
    fakeStore.set("shell.locale", "klingon");
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.locale).toBe("system");
  });

  it("clearAll resets locale back to system", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setLocale("fr");

    await settings.clearAll();

    expect(settings.locale).toBe("system");
  });

  it("resetKey resets locale to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setLocale("fr");

    await settings.resetKey("shell.locale");

    expect(settings.locale).toBe("system");
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.locale");
    await expect(settings.entries()).resolves.not.toContainEqual([
      "shell.locale",
      "fr",
    ]);
  });

  it("defaults dateTimeFormat to auto when the key is absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.dateTimeFormat).toBe("auto");
  });

  it("setDateTimeFormat persists and updates the ref", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setDateTimeFormat("iso");

    expect(settings.dateTimeFormat).toBe("iso");
    expect(fakeStore.set).toHaveBeenCalledWith("shell.dateTimeFormat", "iso");
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("falls back to auto when the persisted dateTimeFormat value is invalid", async () => {
    fakeStore.set("shell.dateTimeFormat", "stardate");
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.dateTimeFormat).toBe("auto");
  });

  it("clearAll resets dateTimeFormat back to auto", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setDateTimeFormat("iso");

    await settings.clearAll();

    expect(settings.dateTimeFormat).toBe("auto");
  });

  it("resetKey resets dateTimeFormat to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setDateTimeFormat("iso");

    await settings.resetKey("shell.dateTimeFormat");

    expect(settings.dateTimeFormat).toBe("auto");
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.dateTimeFormat");
    await expect(settings.entries()).resolves.not.toContainEqual([
      "shell.dateTimeFormat",
      "iso",
    ]);
  });

  it("defaults sidebarCollapsed to false when the key is absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.sidebarCollapsed).toBe(false);
  });

  it("persists sidebarCollapsed via setSidebarCollapsed", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setSidebarCollapsed(true);

    expect(settings.sidebarCollapsed).toBe(true);
    expect(fakeStore.set).toHaveBeenCalledWith(
      "shell.sidebarCollapsed",
      true,
    );
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("clearAll resets sidebarCollapsed back to false", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setSidebarCollapsed(true);

    await settings.clearAll();

    expect(settings.sidebarCollapsed).toBe(false);
  });

  it("defaults pinnedTools and recentTools to [] when absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.pinnedTools).toEqual([]);
    expect(settings.recentTools).toEqual([]);
  });

  it("defaults pinnedToolsVisible and recentToolsVisible to true when absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.pinnedToolsVisible).toBe(true);
    expect(settings.recentToolsVisible).toBe(true);
  });

  it("falls back to [] when persisted pinnedTools is not an array", async () => {
    fakeStore.set("shell.pinnedTools", "json");
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.pinnedTools).toEqual([]);
  });

  it("falls back to [] when persisted recentTools is not an array", async () => {
    fakeStore.set("shell.recentTools", { not: "an array" });
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.recentTools).toEqual([]);
  });

  it("drops non-string entries from a persisted pinnedTools array", async () => {
    fakeStore.set("shell.pinnedTools", ["json", 5, "uuid", null]);
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.pinnedTools).toEqual(["json", "uuid"]);
  });

  it("togglePinned pins an unpinned tool and persists the array", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.togglePinned("json");

    expect(settings.pinnedTools).toEqual(["json"]);
    expect(fakeStore.set).toHaveBeenCalledWith("shell.pinnedTools", ["json"]);
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("togglePinned unpins an already-pinned tool and persists the array", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.togglePinned("json");
    fakeStore.set.mockClear();
    fakeStore.save.mockClear();

    await settings.togglePinned("json");

    expect(settings.pinnedTools).toEqual([]);
    expect(fakeStore.set).toHaveBeenCalledWith("shell.pinnedTools", []);
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("recordRecentTool adds a tool to the front of recentTools", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.recordRecentTool("json");

    expect(settings.recentTools).toEqual(["json"]);
    expect(fakeStore.set).toHaveBeenCalledWith("shell.recentTools", ["json"]);
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("recordRecentTool dedupes by moving an already-present id to the front", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.recordRecentTool("json");
    await settings.recordRecentTool("uuid");

    await settings.recordRecentTool("json");

    expect(settings.recentTools).toEqual(["json", "uuid"]);
  });

  it("recordRecentTool caps recentTools at 5, dropping the oldest", async () => {
    const settings = useSettingsStore();
    await settings.init();

    for (const id of ["a", "b", "c", "d", "e"]) {
      await settings.recordRecentTool(id);
    }
    await settings.recordRecentTool("f");

    expect(settings.recentTools).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("recordRecentTool persists unconditionally, ignoring restoreEnabled", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(false);
    fakeStore.set.mockClear();
    fakeStore.save.mockClear();

    await settings.recordRecentTool("json");

    expect(settings.recentTools).toEqual(["json"]);
    expect(fakeStore.set).toHaveBeenCalledWith("shell.recentTools", ["json"]);
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("setPinnedToolsVisible persists and updates the ref", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setPinnedToolsVisible(false);

    expect(settings.pinnedToolsVisible).toBe(false);
    expect(fakeStore.set).toHaveBeenCalledWith(
      "shell.pinnedToolsVisible",
      false,
    );
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("setRecentToolsVisible persists and updates the ref", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setRecentToolsVisible(false);

    expect(settings.recentToolsVisible).toBe(false);
    expect(fakeStore.set).toHaveBeenCalledWith(
      "shell.recentToolsVisible",
      false,
    );
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("clearAll resets pinnedTools, recentTools, and both visibility flags", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.togglePinned("json");
    await settings.recordRecentTool("uuid");
    await settings.setPinnedToolsVisible(false);
    await settings.setRecentToolsVisible(false);

    await settings.clearAll();

    expect(settings.pinnedTools).toEqual([]);
    expect(settings.recentTools).toEqual([]);
    expect(settings.pinnedToolsVisible).toBe(true);
    expect(settings.recentToolsVisible).toBe(true);
  });

  it("resetKey resets a boolean key to its default, deletes it from disk, and it is absent from entries()", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setSidebarCollapsed(true);

    await settings.resetKey("shell.sidebarCollapsed");

    expect(settings.sidebarCollapsed).toBe(false);
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.sidebarCollapsed");
    expect(fakeStore.save).toHaveBeenCalled();
    await expect(settings.entries()).resolves.not.toContainEqual([
      "shell.sidebarCollapsed",
      expect.anything(),
    ]);
  });

  it("resetKey resets an array key to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.togglePinned("json");

    await settings.resetKey("shell.pinnedTools");

    expect(settings.pinnedTools).toEqual([]);
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.pinnedTools");
    await expect(settings.entries()).resolves.not.toContainEqual([
      "shell.pinnedTools",
      expect.anything(),
    ]);
  });

  it("resetKey on an unrecognized key deletes it from disk without throwing", async () => {
    const settings = useSettingsStore();
    await settings.init();
    fakeStore.set("json.someFutureKey", true);

    await expect(
      settings.resetKey("json.someFutureKey"),
    ).resolves.toBeUndefined();
    expect(fakeStore.delete).toHaveBeenCalledWith("json.someFutureKey");
  });

  it("resetKey resets restoreEnabled to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);

    await settings.resetKey("shell.restoreSessionEnabled");

    expect(settings.restoreEnabled).toBe(false);
    expect(fakeStore.delete).toHaveBeenCalledWith(
      "shell.restoreSessionEnabled",
    );
  });

  it("resetKey resets lastTool to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);
    await settings.recordLastTool("json");

    await settings.resetKey("shell.lastTool");

    expect(settings.lastTool).toBeUndefined();
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.lastTool");
  });

  it("resetKey resets themeOverride to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setThemeOverride("dark");

    await settings.resetKey("shell.themeOverride");

    expect(settings.themeOverride).toBe("system");
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.themeOverride");
  });

  it("resetKey resets recentTools to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.recordRecentTool("json");

    await settings.resetKey("shell.recentTools");

    expect(settings.recentTools).toEqual([]);
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.recentTools");
  });

  it("resetKey resets pinnedToolsVisible to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setPinnedToolsVisible(false);

    await settings.resetKey("shell.pinnedToolsVisible");

    expect(settings.pinnedToolsVisible).toBe(true);
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.pinnedToolsVisible");
  });

  it("resetKey resets recentToolsVisible to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRecentToolsVisible(false);

    await settings.resetKey("shell.recentToolsVisible");

    expect(settings.recentToolsVisible).toBe(true);
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.recentToolsVisible");
  });

  it("defaults updateSignalDismissedVersion to undefined when the key is absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.updateSignalDismissedVersion).toBeUndefined();
  });

  it("preserves an existing install's updateSignalDismissedVersion value when the key is already persisted", async () => {
    fakeStore.set("shell.updateSignal.dismissedVersion", "1.1.0");
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.updateSignalDismissedVersion).toBe("1.1.0");
  });

  it("setUpdateSignalDismissed persists and updates the ref", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setUpdateSignalDismissed("1.1.0");

    expect(settings.updateSignalDismissedVersion).toBe("1.1.0");
    expect(fakeStore.set).toHaveBeenCalledWith(
      "shell.updateSignal.dismissedVersion",
      "1.1.0",
    );
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("resetKey resets updateSignalDismissedVersion to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setUpdateSignalDismissed("1.1.0");

    await settings.resetKey("shell.updateSignal.dismissedVersion");

    expect(settings.updateSignalDismissedVersion).toBeUndefined();
    expect(fakeStore.delete).toHaveBeenCalledWith(
      "shell.updateSignal.dismissedVersion",
    );
    await expect(settings.entries()).resolves.not.toContainEqual([
      "shell.updateSignal.dismissedVersion",
      expect.anything(),
    ]);
  });

  it("clearAll resets updateSignalDismissedVersion back to undefined", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setUpdateSignalDismissed("1.1.0");

    await settings.clearAll();

    expect(settings.updateSignalDismissedVersion).toBeUndefined();
  });

  it("defaults clipboardSuggestionMaxCount to 3 when the key is absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.clipboardSuggestionMaxCount).toBe(3);
  });

  it("preserves an existing install's clipboardSuggestionMaxCount value when the key is already persisted", async () => {
    fakeStore.set("shell.clipboardSuggestionMaxCount", 1);
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.clipboardSuggestionMaxCount).toBe(1);
  });

  it("setClipboardSuggestionMaxCount persists and updates the ref", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setClipboardSuggestionMaxCount(5);

    expect(settings.clipboardSuggestionMaxCount).toBe(5);
    expect(fakeStore.set).toHaveBeenCalledWith("shell.clipboardSuggestionMaxCount", 5);
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("setClipboardSuggestionMaxCount clamps an out-of-range value to the 0-5 bound before persisting", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setClipboardSuggestionMaxCount(99);
    expect(settings.clipboardSuggestionMaxCount).toBe(5);
    expect(fakeStore.set).toHaveBeenCalledWith("shell.clipboardSuggestionMaxCount", 5);

    await settings.setClipboardSuggestionMaxCount(-3);
    expect(settings.clipboardSuggestionMaxCount).toBe(0);
    expect(fakeStore.set).toHaveBeenCalledWith("shell.clipboardSuggestionMaxCount", 0);
  });

  it("clamps a hand-edited out-of-range persisted value on load, not just on the setter path", async () => {
    fakeStore.set("shell.clipboardSuggestionMaxCount", 42);
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.clipboardSuggestionMaxCount).toBe(5);
  });

  it("resetKey resets clipboardSuggestionMaxCount to its default and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setClipboardSuggestionMaxCount(1);

    await settings.resetKey("shell.clipboardSuggestionMaxCount");

    expect(settings.clipboardSuggestionMaxCount).toBe(3);
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.clipboardSuggestionMaxCount");
    await expect(settings.entries()).resolves.not.toContainEqual([
      "shell.clipboardSuggestionMaxCount",
      expect.anything(),
    ]);
  });

  it("clearAll resets clipboardSuggestionMaxCount back to its default", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setClipboardSuggestionMaxCount(1);

    await settings.clearAll();

    expect(settings.clipboardSuggestionMaxCount).toBe(3);
  });

  it("resetKey on shell.windowGeometry cancels a pending debounced write so it doesn't re-persist after reset", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);
    fakeStore.set.mockClear();
    settings.recordWindowGeometry({ x: 1, y: 2, width: 800, height: 600 });

    await settings.resetKey("shell.windowGeometry");
    await vi.advanceTimersByTimeAsync(300);

    expect(settings.windowGeometry).toBeUndefined();
    expect(fakeStore.delete).toHaveBeenCalledWith("shell.windowGeometry");
    expect(fakeStore.set).not.toHaveBeenCalledWith(
      "shell.windowGeometry",
      expect.anything(),
    );
  });

  it("degrades to defaults and does not throw when settings.json fails to load", async () => {
    load.mockRejectedValueOnce(new Error("corrupt settings.json"));
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.restoreEnabled).toBe(false);
    await expect(settings.recordLastTool("json")).resolves.toBeUndefined();
    await expect(settings.entries()).resolves.toEqual([]);
    expect(fakeStore.set).not.toHaveBeenCalled();
  });

  // Story 8.3 (AC18): the uuid.* format keys — the first non-shell.* namespace.
  it("defaults the uuid.* format keys to lowercase / no braces / hyphens kept", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.uuidFormatCase).toBe("lower");
    expect(settings.uuidFormatBraces).toBe(false);
    expect(settings.uuidFormatHyphens).toBe(true);
  });

  it("setUuidFormat persists only the touched keys and updates the refs", async () => {
    const settings = useSettingsStore();
    await settings.init();

    await settings.setUuidFormat({ case: "upper", braces: true });

    expect(settings.uuidFormatCase).toBe("upper");
    expect(settings.uuidFormatBraces).toBe(true);
    expect(settings.uuidFormatHyphens).toBe(true);
    expect(fakeStore.set).toHaveBeenCalledWith("uuid.formatCase", "upper");
    expect(fakeStore.set).toHaveBeenCalledWith("uuid.formatBraces", true);
    expect(fakeStore.set).not.toHaveBeenCalledWith(
      "uuid.formatHyphens",
      expect.anything(),
    );
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it("falls back to the default when a persisted uuid.formatCase value is invalid", async () => {
    fakeStore.set("uuid.formatCase", "TitleCase");
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.uuidFormatCase).toBe("lower");
  });

  it("resetKey resets a uuid.* format key and deletes it from disk", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setUuidFormat({ hyphens: false });

    await settings.resetKey("uuid.formatHyphens");

    expect(settings.uuidFormatHyphens).toBe(true);
    expect(fakeStore.delete).toHaveBeenCalledWith("uuid.formatHyphens");
    await expect(settings.entries()).resolves.not.toContainEqual([
      "uuid.formatHyphens",
      false,
    ]);
  });

  it("clearAll resets the uuid.* format keys to their defaults", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setUuidFormat({ case: "upper", braces: true, hyphens: false });

    await settings.clearAll();

    expect(settings.uuidFormatCase).toBe("lower");
    expect(settings.uuidFormatBraces).toBe(false);
    expect(settings.uuidFormatHyphens).toBe(true);
  });
});
