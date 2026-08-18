import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

type MovedHandler = (event: { payload: { x: number; y: number } }) => void;
type ResizedHandler = (event: {
  payload: { width: number; height: number };
}) => void;

let movedHandler: MovedHandler | undefined;
let resizedHandler: ResizedHandler | undefined;

const fakeWindow = {
  outerPosition: vi.fn(() => Promise.resolve({ x: 10, y: 20 })),
  innerSize: vi.fn(() => Promise.resolve({ width: 800, height: 600 })),
  onMoved: vi.fn((handler: MovedHandler) => {
    movedHandler = handler;
    return Promise.resolve(vi.fn());
  }),
  onResized: vi.fn((handler: ResizedHandler) => {
    resizedHandler = handler;
    return Promise.resolve(vi.fn());
  }),
};

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => fakeWindow,
}));

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

const { attachWindowGeometryListeners } = await import("./windowGeometry");
const { useSettingsStore } = await import("../stores/settings");

beforeEach(async () => {
  vi.useFakeTimers();
  setActivePinia(createPinia());
  fakeStore = createFakeStore();
  load.mockResolvedValue(fakeStore);
  movedHandler = undefined;
  resizedHandler = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("attachWindowGeometryListeners", () => {
  it("emits the current position merged with the last known size on move", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);
    fakeStore.set.mockClear();
    await attachWindowGeometryListeners(settings.recordWindowGeometry);

    movedHandler?.({ payload: { x: 111, y: 222 } });
    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.set).toHaveBeenCalledWith("shell.windowGeometry", {
      x: 111,
      y: 222,
      width: 800,
      height: 600,
    });
  });

  it("emits the current size merged with the last known position on resize", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);
    fakeStore.set.mockClear();
    await attachWindowGeometryListeners(settings.recordWindowGeometry);

    resizedHandler?.({ payload: { width: 950, height: 700 } });
    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.set).toHaveBeenCalledWith("shell.windowGeometry", {
      x: 10,
      y: 20,
      width: 950,
      height: 700,
    });
  });

  it("debounces rapid move events into a single persisted write", async () => {
    const settings = useSettingsStore();
    await settings.init();
    await settings.setRestoreEnabled(true);
    fakeStore.set.mockClear();
    await attachWindowGeometryListeners(settings.recordWindowGeometry);

    movedHandler?.({ payload: { x: 1, y: 1 } });
    await vi.advanceTimersByTimeAsync(50);
    movedHandler?.({ payload: { x: 2, y: 2 } });
    await vi.advanceTimersByTimeAsync(50);
    movedHandler?.({ payload: { x: 3, y: 3 } });

    expect(fakeStore.set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(fakeStore.set).toHaveBeenCalledTimes(1);
    expect(fakeStore.set).toHaveBeenCalledWith(
      "shell.windowGeometry",
      expect.objectContaining({ x: 3, y: 3 }),
    );
  });
});
