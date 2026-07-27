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

  const restoreEnabled = ref(true);
  const lastTool = ref<string | undefined>(undefined);
  const windowGeometry = ref<WindowGeometry | undefined>(undefined);

  async function init(): Promise<void> {
    try {
      const store = await load("settings.json", { autoSave: false });
      restoreEnabled.value =
        (await store.get<boolean>("shell.restoreSessionEnabled")) ?? true;
      lastTool.value = await store.get<string>("shell.lastTool");
      windowGeometry.value =
        await store.get<WindowGeometry>("shell.windowGeometry");
      backingStore = store;
    } catch (error) {
      console.error("settings: failed to load settings.json, using defaults", error);
    }
  }

  async function setRestoreEnabled(value: boolean): Promise<void> {
    restoreEnabled.value = value;
    if (!value) writeGeometry.cancel();
    if (!backingStore) return;
    const store = backingStore;
    await store.set("shell.restoreSessionEnabled", value);
    await store.save();
  }

  async function recordLastTool(toolId: string): Promise<void> {
    if (!restoreEnabled.value || !backingStore) return;
    lastTool.value = toolId;
    const store = backingStore;
    await store.set("shell.lastTool", toolId);
    await store.save();
  }

  const writeGeometry = debounce((geometry: WindowGeometry) => {
    if (!backingStore) return;
    windowGeometry.value = geometry;
    const store = backingStore;
    void store
      .set("shell.windowGeometry", geometry)
      .then(() => store.save())
      .catch((error: unknown) => {
        console.error("settings: failed to persist window geometry", error);
      });
  }, GEOMETRY_WRITE_DEBOUNCE_MS);

  function recordWindowGeometry(geometry: WindowGeometry): void {
    if (!restoreEnabled.value) return;
    writeGeometry(geometry);
  }

  async function entries(): Promise<[string, unknown][]> {
    if (!backingStore) return [];
    return backingStore.entries();
  }

  async function clearAll(): Promise<void> {
    writeGeometry.cancel();
    restoreEnabled.value = true;
    lastTool.value = undefined;
    windowGeometry.value = undefined;
    if (!backingStore) return;
    const store = backingStore;
    await store.clear();
    await store.save();
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
