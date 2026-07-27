import { ref } from "vue";
import { defineStore } from "pinia";
import { load, type Store } from "@tauri-apps/plugin-store";
import { debounce } from "../shell/debounce";

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Story 1.8's tree-parse debounce uses 200ms for latency-sensitive work;
// geometry writes have no such urgency, so a slightly longer interval cuts
// disk writes further during a drag.
const GEOMETRY_WRITE_DEBOUNCE_MS = 300;

// AD-10: this store is the single writer for settings.json — nothing else
// in the app imports @tauri-apps/plugin-store directly.
export const useSettingsStore = defineStore("settings", () => {
  let backingStore: Store | undefined;

  function getStore(): Store {
    if (!backingStore) {
      throw new Error("settings store accessed before init() resolved");
    }
    return backingStore;
  }

  const restoreEnabled = ref(true);
  const lastTool = ref<string | undefined>(undefined);
  const windowGeometry = ref<WindowGeometry | undefined>(undefined);

  async function init(): Promise<void> {
    backingStore = await load("settings.json", { autoSave: false });
    restoreEnabled.value =
      (await backingStore.get<boolean>("shell.restoreSessionEnabled")) ?? true;
    lastTool.value = await backingStore.get<string>("shell.lastTool");
    windowGeometry.value =
      await backingStore.get<WindowGeometry>("shell.windowGeometry");
  }

  async function setRestoreEnabled(value: boolean): Promise<void> {
    restoreEnabled.value = value;
    const store = getStore();
    await store.set("shell.restoreSessionEnabled", value);
    await store.save();
  }

  async function recordLastTool(toolId: string): Promise<void> {
    if (!restoreEnabled.value) return;
    lastTool.value = toolId;
    const store = getStore();
    await store.set("shell.lastTool", toolId);
    await store.save();
  }

  const writeGeometry = debounce((geometry: WindowGeometry) => {
    windowGeometry.value = geometry;
    const store = getStore();
    void store.set("shell.windowGeometry", geometry).then(() => store.save());
  }, GEOMETRY_WRITE_DEBOUNCE_MS);

  function recordWindowGeometry(geometry: WindowGeometry): void {
    if (!restoreEnabled.value) return;
    writeGeometry(geometry);
  }

  async function entries(): Promise<[string, unknown][]> {
    return getStore().entries();
  }

  async function clearAll(): Promise<void> {
    const store = getStore();
    await store.clear();
    await store.save();
    restoreEnabled.value = true;
    lastTool.value = undefined;
    windowGeometry.value = undefined;
  }

  return {
    restoreEnabled,
    lastTool,
    windowGeometry,
    init,
    setRestoreEnabled,
    recordLastTool,
    recordWindowGeometry,
    entries,
    clearAll,
  };
});
