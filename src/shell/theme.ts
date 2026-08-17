import { watch } from "vue";
import type { ThemeOverride, useSettingsStore } from "../stores/settings";

export function resolveTheme(
  override: ThemeOverride,
  prefersDark: boolean,
): "light" | "dark" {
  if (override === "light" || override === "dark") return override;
  return prefersDark ? "dark" : "light";
}

export function applyResolvedTheme(resolved: "light" | "dark"): void {
  document.documentElement.dataset.theme = resolved;
}

// Story 1.8's onUnmounted-cancel pattern doesn't apply here: this listener is
// attached once for the app's lifetime (src/main.ts), not a component's —
// mirrors windowGeometry.ts's own attachWindowGeometryListeners.
export function attachThemeListener(
  settings: ReturnType<typeof useSettingsStore>,
): void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const recompute = (): void => {
    applyResolvedTheme(resolveTheme(settings.themeOverride, media.matches));
  };

  recompute();

  media.addEventListener("change", recompute);
  watch(() => settings.themeOverride, recompute);
}
