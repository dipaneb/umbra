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

// AD-5: this store is the single source of truth for every tool in the app.
// The sidebar (AppSidebar.vue), the router's route table below, and (Story
// 1.6) the ⌘K command palette are all *generated* from `tools` — none of
// them list tool names, routes, or components independently. To add a tool,
// add one entry here; don't hand-edit the sidebar or the router.
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

  // Named routes use `tool.id` as the route name — already unique per entry,
  // so no separate field is needed. This lets other code navigate with
  // `router.push({ name: tool.id })` instead of hardcoding path strings.
  const routes = computed<RouteRecordRaw[]>(() =>
    tools.value.map((tool) => ({
      path: tool.route,
      name: tool.id,
      component: tool.component,
    })),
  );

  return { tools, routes };
});
