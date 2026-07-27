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
