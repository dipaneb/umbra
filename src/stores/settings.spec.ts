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
  it("defaults restoreEnabled to true when the key is absent", async () => {
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.restoreEnabled).toBe(true);
  });

  it("records the last tool and persists it when restore is enabled", async () => {
    const settings = useSettingsStore();
    await settings.init();

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

  it("clears all persisted state and resets restoreEnabled to true", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(false);

    await settings.clearAll();

    expect(fakeStore.clear).toHaveBeenCalled();
    expect(fakeStore.save).toHaveBeenCalled();
    expect(settings.restoreEnabled).toBe(true);
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

  it("degrades to defaults and does not throw when settings.json fails to load", async () => {
    load.mockRejectedValueOnce(new Error("corrupt settings.json"));
    const settings = useSettingsStore();

    await settings.init();

    expect(settings.restoreEnabled).toBe(true);
    await expect(settings.recordLastTool("json")).resolves.toBeUndefined();
    await expect(settings.entries()).resolves.toEqual([]);
    expect(fakeStore.set).not.toHaveBeenCalled();
  });
});
