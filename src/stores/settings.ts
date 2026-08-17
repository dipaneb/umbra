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

export type ThemeOverride = "system" | "light" | "dark";

const THEME_OVERRIDES: readonly ThemeOverride[] = ["system", "light", "dark"];

function isThemeOverride(value: unknown): value is ThemeOverride {
  return (
    typeof value === "string" &&
    (THEME_OVERRIDES as readonly string[]).includes(value)
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === "string"))]
    : [];
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
  const themeOverride = ref<ThemeOverride>("system");
  const sidebarCollapsed = ref<boolean>(false);
  const pinnedTools = ref<string[]>([]);
  const recentTools = ref<string[]>([]);
  const pinnedToolsVisible = ref<boolean>(true);
  const recentToolsVisible = ref<boolean>(true);

  async function init(): Promise<void> {
    try {
      const store = await load("settings.json", { autoSave: false });
      restoreEnabled.value =
        (await store.get<boolean>("shell.restoreSessionEnabled")) ?? true;
      lastTool.value = await store.get<string>("shell.lastTool");
      windowGeometry.value =
        await store.get<WindowGeometry>("shell.windowGeometry");
      const storedThemeOverride = await store.get<string>(
        "shell.themeOverride",
      );
      themeOverride.value = isThemeOverride(storedThemeOverride)
        ? storedThemeOverride
        : "system";
      sidebarCollapsed.value =
        (await store.get<boolean>("shell.sidebarCollapsed")) ?? false;
      pinnedTools.value = toStringArray(
        await store.get<unknown>("shell.pinnedTools"),
      );
      recentTools.value = toStringArray(
        await store.get<unknown>("shell.recentTools"),
      );
      pinnedToolsVisible.value =
        (await store.get<boolean>("shell.pinnedToolsVisible")) ?? true;
      recentToolsVisible.value =
        (await store.get<boolean>("shell.recentToolsVisible")) ?? true;
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

  async function setThemeOverride(value: ThemeOverride): Promise<void> {
    themeOverride.value = value;
    if (!backingStore) return;
    const store = backingStore;
    await store.set("shell.themeOverride", value);
    await store.save();
  }

  async function setSidebarCollapsed(value: boolean): Promise<void> {
    sidebarCollapsed.value = value;
    if (!backingStore) return;
    const store = backingStore;
    await store.set("shell.sidebarCollapsed", value);
    await store.save();
  }

  async function setPinnedToolsVisible(value: boolean): Promise<void> {
    pinnedToolsVisible.value = value;
    if (!backingStore) return;
    const store = backingStore;
    await store.set("shell.pinnedToolsVisible", value);
    await store.save();
  }

  async function setRecentToolsVisible(value: boolean): Promise<void> {
    recentToolsVisible.value = value;
    if (!backingStore) return;
    const store = backingStore;
    await store.set("shell.recentToolsVisible", value);
    await store.save();
  }

  async function togglePinned(toolId: string): Promise<void> {
    pinnedTools.value = pinnedTools.value.includes(toolId)
      ? pinnedTools.value.filter((id) => id !== toolId)
      : [...pinnedTools.value, toolId];
    if (!backingStore) return;
    const store = backingStore;
    await store.set("shell.pinnedTools", pinnedTools.value);
    await store.save();
  }

  async function recordRecentTool(toolId: string): Promise<void> {
    recentTools.value = [
      toolId,
      ...recentTools.value.filter((id) => id !== toolId),
    ].slice(0, 5);
    if (!backingStore) return;
    const store = backingStore;
    await store.set("shell.recentTools", recentTools.value);
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
    themeOverride.value = "system";
    sidebarCollapsed.value = false;
    pinnedTools.value = [];
    recentTools.value = [];
    pinnedToolsVisible.value = true;
    recentToolsVisible.value = true;
    if (!backingStore) return;
    const store = backingStore;
    await store.clear();
    await store.save();
  }

  return {
    restoreEnabled,
    lastTool,
    windowGeometry,
    themeOverride,
    sidebarCollapsed,
    pinnedTools,
    recentTools,
    pinnedToolsVisible,
    recentToolsVisible,
    init,
    setRestoreEnabled,
    setThemeOverride,
    setSidebarCollapsed,
    setPinnedToolsVisible,
    setRecentToolsVisible,
    togglePinned,
    recordRecentTool,
    recordLastTool,
    recordWindowGeometry,
    entries,
    clearAll,
  };
});
