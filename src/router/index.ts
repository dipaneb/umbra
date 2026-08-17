import { createRouter, createWebHistory, type Router } from "vue-router";
import type { Pinia } from "pinia";
import { useRegistryStore } from "../stores/registry";
import GridHome from "../shell/GridHome.vue";
import SettingsView from "../shell/SettingsView.vue";

export function createAppRouter(pinia: Pinia): Router {
  const registry = useRegistryStore(pinia);

  return createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: "/",
        name: "home",
        component: GridHome,
      },
      {
        path: "/settings",
        name: "settings",
        component: SettingsView,
      },
      ...registry.routes,
    ],
  });
}
