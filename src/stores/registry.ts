import { computed, ref, type Component } from "vue";
import { defineStore } from "pinia";
import type { RouteRecordRaw } from "vue-router";

export interface ToolRegistryEntry {
  id: string;
  name: string;
  aliases: string[];
  route: string;
  icon: string;
  component: () => Promise<Component>;
  drop?: { acceptedMimeTypes: string[]; handler: string };
  shortcut?: string;
}

export const useRegistryStore = defineStore("registry", () => {
  const tools = ref<ToolRegistryEntry[]>([
    {
      id: "json",
      name: "JSON",
      aliases: ["json", "formatter"],
      route: "/tools/json",
      icon: "{ }",
      component: () => import("../tools/json/JsonView.vue"),
    },
  ]);

  const routes = computed<RouteRecordRaw[]>(() =>
    tools.value.map((tool) => ({
      path: tool.route,
      component: tool.component,
    })),
  );

  return { tools, routes };
});
