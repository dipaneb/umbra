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

// Single source of truth for every shell.* key's default value — read by
// init()'s absent-key fallback, clearAll(), and resetKey() alike, so the
// three can't drift apart the way clearAll()'s hardcoded restoreEnabled
// reset once did (Story 7.6).
const DEFAULTS = {
  restoreSessionEnabled: false,
  lastTool: undefined as string | undefined,
  windowGeometry: undefined as WindowGeometry | undefined,
  themeOverride: "system" as ThemeOverride,
  sidebarCollapsed: false,
  pinnedTools: [] as string[],
  recentTools: [] as string[],
  pinnedToolsVisible: true,
  recentToolsVisible: true,
  updateSignalDismissedVersion: undefined as string | undefined,
};

// Story 1.8's tree-parse debounce uses 200ms for latency-sensitive work;
// geometry writes have no such urgency, so a slightly longer interval cuts
// disk writes further during a drag.
const GEOMETRY_WRITE_DEBOUNCE_MS = 300;

// AD-10: this store is the single writer for settings.json — nothing else
// in the app imports @tauri-apps/plugin-store directly.
export const useSettingsStore = defineStore("settings", () => {
  let backingStore: Store | undefined;

  const restoreEnabled = ref(DEFAULTS.restoreSessionEnabled);
  const lastTool = ref<string | undefined>(DEFAULTS.lastTool);
  const windowGeometry = ref<WindowGeometry | undefined>(DEFAULTS.windowGeometry);
  const themeOverride = ref<ThemeOverride>(DEFAULTS.themeOverride);
  const sidebarCollapsed = ref<boolean>(DEFAULTS.sidebarCollapsed);
  const pinnedTools = ref<string[]>([...DEFAULTS.pinnedTools]);
  const recentTools = ref<string[]>([...DEFAULTS.recentTools]);
  const pinnedToolsVisible = ref<boolean>(DEFAULTS.pinnedToolsVisible);
  const recentToolsVisible = ref<boolean>(DEFAULTS.recentToolsVisible);
  const updateSignalDismissedVersion = ref<string | undefined>(
    DEFAULTS.updateSignalDismissedVersion,
  );

  async function init(): Promise<void> {
    try {
      const store = await load("settings.json", { autoSave: false });
      restoreEnabled.value =
        (await store.get<boolean>("shell.restoreSessionEnabled")) ??
        DEFAULTS.restoreSessionEnabled;
      lastTool.value = await store.get<string>("shell.lastTool");
      windowGeometry.value =
        await store.get<WindowGeometry>("shell.windowGeometry");
      const storedThemeOverride = await store.get<string>(
        "shell.themeOverride",
      );
      themeOverride.value = isThemeOverride(storedThemeOverride)
        ? storedThemeOverride
        : DEFAULTS.themeOverride;
      sidebarCollapsed.value =
        (await store.get<boolean>("shell.sidebarCollapsed")) ??
        DEFAULTS.sidebarCollapsed;
      pinnedTools.value = toStringArray(
        await store.get<unknown>("shell.pinnedTools"),
      );
      recentTools.value = toStringArray(
        await store.get<unknown>("shell.recentTools"),
      );
      pinnedToolsVisible.value =
        (await store.get<boolean>("shell.pinnedToolsVisible")) ??
        DEFAULTS.pinnedToolsVisible;
      recentToolsVisible.value =
        (await store.get<boolean>("shell.recentToolsVisible")) ??
        DEFAULTS.recentToolsVisible;
      updateSignalDismissedVersion.value = await store.get<string>(
        "shell.updateSignal.dismissedVersion",
      );
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

  async function setUpdateSignalDismissed(version: string): Promise<void> {
    updateSignalDismissedVersion.value = version;
    if (!backingStore) return;
    const store = backingStore;
    await store.set("shell.updateSignal.dismissedVersion", version);
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

  // Additive to clearAll()'s one-action clear (AC2), not a replacement for
  // it. Deletes the key outright rather than rewriting it to its default
  // value, so it actually disappears from entries() afterward — mirroring
  // true never-persisted state instead of a second "reset" meaning.
  // Keys with no matching in-memory ref (e.g. a future <tool-id>.* key) are
  // simply deleted from disk with no ref to reset.
  async function resetKey(key: string): Promise<void> {
    switch (key) {
      case "shell.restoreSessionEnabled":
        restoreEnabled.value = DEFAULTS.restoreSessionEnabled;
        break;
      case "shell.lastTool":
        lastTool.value = DEFAULTS.lastTool;
        break;
      case "shell.windowGeometry":
        writeGeometry.cancel();
        windowGeometry.value = DEFAULTS.windowGeometry;
        break;
      case "shell.themeOverride":
        themeOverride.value = DEFAULTS.themeOverride;
        break;
      case "shell.sidebarCollapsed":
        sidebarCollapsed.value = DEFAULTS.sidebarCollapsed;
        break;
      case "shell.pinnedTools":
        pinnedTools.value = [...DEFAULTS.pinnedTools];
        break;
      case "shell.recentTools":
        recentTools.value = [...DEFAULTS.recentTools];
        break;
      case "shell.pinnedToolsVisible":
        pinnedToolsVisible.value = DEFAULTS.pinnedToolsVisible;
        break;
      case "shell.recentToolsVisible":
        recentToolsVisible.value = DEFAULTS.recentToolsVisible;
        break;
      case "shell.updateSignal.dismissedVersion":
        updateSignalDismissedVersion.value = DEFAULTS.updateSignalDismissedVersion;
        break;
    }
    if (!backingStore) return;
    const store = backingStore;
    await store.delete(key);
    await store.save();
  }

  async function clearAll(): Promise<void> {
    writeGeometry.cancel();
    restoreEnabled.value = DEFAULTS.restoreSessionEnabled;
    lastTool.value = DEFAULTS.lastTool;
    windowGeometry.value = DEFAULTS.windowGeometry;
    themeOverride.value = DEFAULTS.themeOverride;
    sidebarCollapsed.value = DEFAULTS.sidebarCollapsed;
    pinnedTools.value = [...DEFAULTS.pinnedTools];
    recentTools.value = [...DEFAULTS.recentTools];
    pinnedToolsVisible.value = DEFAULTS.pinnedToolsVisible;
    recentToolsVisible.value = DEFAULTS.recentToolsVisible;
    updateSignalDismissedVersion.value = DEFAULTS.updateSignalDismissedVersion;
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
    updateSignalDismissedVersion,
    init,
    setRestoreEnabled,
    setThemeOverride,
    setSidebarCollapsed,
    setPinnedToolsVisible,
    setRecentToolsVisible,
    setUpdateSignalDismissed,
    togglePinned,
    recordRecentTool,
    recordLastTool,
    recordWindowGeometry,
    entries,
    resetKey,
    clearAll,
  };
});
