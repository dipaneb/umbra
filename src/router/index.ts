import { createRouter, createWebHistory, type Router } from "vue-router";
import type { Pinia } from "pinia";
import { useRegistryStore } from "../stores/registry";

export function createAppRouter(pinia: Pinia): Router {
  const registry = useRegistryStore(pinia);

  return createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: "/",
        component: { template: "<p>Select a tool from the sidebar.</p>" },
      },
      ...registry.routes,
    ],
  });
}
