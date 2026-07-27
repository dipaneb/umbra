import { createApp } from "vue";
import { createPinia } from "pinia";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import App from "./App.vue";
import { createAppRouter } from "./router";
import { useRegistryStore } from "./stores/registry";
import { useSettingsStore } from "./stores/settings";
import { attachWindowGeometryListeners } from "./shell/windowGeometry";

async function bootstrap(): Promise<void> {
  const pinia = createPinia();
  const router = createAppRouter(pinia);
  const registry = useRegistryStore(pinia);
  const settings = useSettingsStore(pinia);

  // The window starts invisible (tauri.conf.json's "visible": false) so
  // restored geometry/route apply before first paint. mount()+show() live in
  // `finally` so a failed restore (corrupted settings.json, plugin IPC
  // failure) degrades to "app opens at default geometry/route", never to
  // "app never appears".
  try {
    await settings.init();

    if (settings.restoreEnabled) {
      const lastTool = settings.lastTool;
      if (lastTool && registry.tools.some((tool) => tool.id === lastTool)) {
        await router.replace({ name: lastTool });
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
  } finally {
    createApp(App).use(pinia).use(router).mount("#app");
    await getCurrentWindow().show();
  }

  router.afterEach((to) => {
    if (typeof to.name === "string") {
      settings.recordLastTool(to.name);
    }
  });
  await attachWindowGeometryListeners(settings.recordWindowGeometry);
}

bootstrap().catch((error: unknown) => {
  console.error("Umbra failed to restore session state:", error);
});
