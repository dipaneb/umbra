import { createApp } from "vue";
import { createPinia } from "pinia";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import "./styles/tokens.css";
import "./styles/base.css";
import App from "./App.vue";
import { i18n } from "./i18n";
import { createAppRouter } from "./router";
import { useRegistryStore } from "./stores/registry";
import { useSettingsStore } from "./stores/settings";
import { attachWindowGeometryListeners } from "./shell/windowGeometry";
import { attachThemeListener } from "./shell/theme";
import { attachLocaleListener } from "./shell/locale";

async function bootstrap(): Promise<void> {
  const pinia = createPinia();
  const router = createAppRouter(pinia);
  const registry = useRegistryStore(pinia);
  const settings = useSettingsStore(pinia);

  // The window starts invisible (tauri.conf.json's "visible": false) so
  // restored geometry/route apply before first paint. mount() lives in
  // `finally` so a failed restore (corrupted settings.json, plugin IPC
  // failure) degrades to "app opens at default geometry/route", never to
  // "app never mounts". The restore try/catch below and show()'s own
  // try/catch further ensure a failure at any single step can only cost
  // that step — never the mount, the show, or the wiring that follows.
  try {
    await settings.init();

    // Attaching here (not after the finally block below) applies the theme
    // once, immediately — before mount()/show() — and wires up ongoing
    // reactivity (OS changes, in-app toggle changes) before any restore step
    // below gets a chance to throw and skip past it.
    attachThemeListener(settings);
    // Same reasoning as attachThemeListener above: applies the resolved
    // locale before mount()/show(), so the window's first paint (it starts
    // `visible: false`, per tauri.conf.json) is never a flash of English
    // before a French preference kicks in.
    attachLocaleListener(settings);

    if (settings.restoreEnabled) {
      const lastTool = settings.lastTool;
      if (lastTool && registry.tools.some((tool) => tool.id === lastTool)) {
        await router.replace({ name: lastTool });
        // router.afterEach below isn't registered until after this restore
        // navigation runs, so the restored tool needs its own explicit call
        // to land in Recent — otherwise every restore-enabled relaunch would
        // silently skip the one tool the user is actually looking at.
        settings.recordRecentTool(lastTool).catch((error: unknown) => {
          console.error("settings: failed to record recent tool", error);
        });
      }

      const geometry = settings.windowGeometry;
      if (geometry) {
        const appWindow = getCurrentWindow();
        await appWindow.setPosition(
          new PhysicalPosition(geometry.x, geometry.y),
        );
        await appWindow.setSize(
          new PhysicalSize(geometry.width, geometry.height),
        );
      }
    }
  } catch (error: unknown) {
    // Swallowed here (rather than left to propagate past the finally below)
    // so a restore failure costs only the restore — router.afterEach and
    // attachWindowGeometryListeners still register afterward instead of
    // being silently skipped for the rest of the session.
    console.error(
      "main: session restore failed, continuing with defaults",
      error,
    );
  } finally {
    createApp(App).use(pinia).use(router).use(i18n).mount("#app");
    try {
      await getCurrentWindow().show();
    } catch (error: unknown) {
      // The window starts invisible; if show() itself fails, it stays
      // invisible for the rest of the session unless this is caught here.
      console.error("main: failed to show the window", error);
    }
  }

  router.afterEach((to) => {
    if (
      typeof to.name === "string" &&
      registry.tools.some((tool) => tool.id === to.name)
    ) {
      settings.recordLastTool(to.name).catch((error: unknown) => {
        console.error("settings: failed to record last tool", error);
      });
      settings.recordRecentTool(to.name).catch((error: unknown) => {
        console.error("settings: failed to record recent tool", error);
      });
    }
  });
  try {
    await attachWindowGeometryListeners(settings.recordWindowGeometry);
  } catch (error: unknown) {
    console.error(
      "main: failed to attach window geometry listeners",
      error,
    );
  }
}

bootstrap().catch((error: unknown) => {
  console.error("Umbra failed to restore session state:", error);
});
