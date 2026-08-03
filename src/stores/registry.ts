import { computed, ref, type Component } from "vue";
import { defineStore } from "pinia";
import type { RouteRecordRaw } from "vue-router";
import { createLatestWinsRunner } from "../shell/invoke";
import type { ToolError } from "../shell/toolError";

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

// Duplicate ids are a developer error, not a runtime condition — the array
// below is a hardcoded literal, never user input. Assert at module load so a
// colliding id fails loud the moment it's written, instead of surfacing
// later as sidebar/palette/routing entries silently overwriting each other.
export function assertUniqueToolIds(entries: ToolRegistryEntry[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates.add(entry.id);
    }
    seen.add(entry.id);
  }
  if (duplicates.size > 0) {
    throw new Error(
      `Duplicate tool registry id(s): ${Array.from(duplicates)
        .map((id) => `"${id}"`)
        .join(", ")}`,
    );
  }
}

// AD-5: this store is the single source of truth for every tool in the app.
// The sidebar (AppSidebar.vue), the router's route table below, and (Story
// 1.6) the ⌘K command palette are all *generated* from `tools` — none of
// them list tool names, routes, or components independently. To add a tool,
// add one entry here; don't hand-edit the sidebar or the router.
const TOOLS: ToolRegistryEntry[] = [
  {
    id: "json",
    name: "JSON",
    aliases: ["json", "formatter"],
    route: "/tools/json",
    icon: "{ }",
    component: () => import("../tools/json/JsonView.vue"),
  },
  {
    id: "base64",
    name: "Base64",
    aliases: ["base64", "b64", "decode"],
    route: "/tools/base64",
    icon: "64",
    component: () => import("../tools/base64/Base64View.vue"),
    // Tauri's native drop event carries only filesystem paths, never a
    // browser-supplied MIME type — this field is presence-of-`.drop`-means-
    // accepts, not yet used for actual filtering (no story needs it yet).
    drop: { acceptedMimeTypes: [], handler: "base64_encode_file" },
  },
  {
    id: "uuid",
    name: "UUID",
    aliases: ["uuid", "guid"],
    route: "/tools/uuid",
    icon: "ID",
    component: () => import("../tools/uuid/UuidView.vue"),
  },
  {
    id: "hash",
    name: "Hash",
    aliases: ["hash", "checksum", "sha256", "sha512", "md5", "sha1", "digest"],
    route: "/tools/hash",
    icon: "#",
    component: () => import("../tools/hash/HashView.vue"),
    drop: { acceptedMimeTypes: [], handler: "hash_compute_file" },
  },
  {
    id: "jwt",
    name: "JWT",
    aliases: ["jwt", "token", "decode"],
    route: "/tools/jwt",
    icon: "JWT",
    component: () => import("../tools/jwt/JwtView.vue"),
  },
  {
    id: "cron",
    name: "Cron",
    aliases: ["cron", "crontab", "schedule"],
    route: "/tools/cron",
    icon: "CRN",
    component: () => import("../tools/cron/CronView.vue"),
  },
];

assertUniqueToolIds(TOOLS);

export const useRegistryStore = defineStore("registry", () => {
  // Each store instance gets its own array copy — `TOOLS` must stay a single
  // shared reference for the module-load assertion above, but Pinia's `ref()`
  // wraps arrays by reference rather than cloning, so reusing `TOOLS` here
  // directly would make every store instance mutate the same underlying array.
  const tools = ref<ToolRegistryEntry[]>([...TOOLS]);

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

  // AD-14: `DropZone.vue` is the shell's single generic drop dispatcher — it
  // invokes `activeTool.drop.handler` directly, but the dropped *path* is
  // the only argument it can supply on its own. Any additional,
  // tool-specific invoke arguments (e.g. Base64's `url_safe`, drawn from
  // that tool's own currently-selected radio button) come from the active
  // tool's own view via a provider registered here. Cross-tool signal lives
  // in this store, not a bare module `ref`, per AD-6.
  const dropArgsProviders = ref<Record<string, () => Record<string, unknown>>>({});
  function setDropArgsProvider(toolId: string, provider: (() => Record<string, unknown>) | null): void {
    if (provider) {
      dropArgsProviders.value[toolId] = provider;
    } else {
      delete dropArgsProviders.value[toolId];
    }
  }

  // One-shot outcome of a dispatcher-invoked drop command — set by
  // `DropZone.vue` after it invokes `activeTool.drop.handler`, consumed
  // (watched, then cleared) by the tool view that registered the provider
  // above.
  const dropResult = ref<{ toolId: string; value: unknown } | { toolId: string; error: ToolError } | null>(null);

  // AD-16: latest-wins must be scoped per tool, not per component instance —
  // otherwise a drop dispatched by `DropZone.vue`'s single shared dispatcher
  // and a manual invoke made by the tool's own view (e.g. Hash's "Compute"
  // button) race independently and can overwrite each other out of order,
  // and a drop for one tool can wrongly supersede an in-flight drop for a
  // different tool. One runner per `toolId`, lazily created and reused by
  // every caller for that tool, closes both gaps.
  const latestWinsRunners = new Map<string, ReturnType<typeof createLatestWinsRunner>>();
  function getLatestWinsRunner(toolId: string): ReturnType<typeof createLatestWinsRunner> {
    let runner = latestWinsRunners.get(toolId);
    if (!runner) {
      runner = createLatestWinsRunner();
      latestWinsRunners.set(toolId, runner);
    }
    return runner;
  }

  return { tools, routes, dropArgsProviders, setDropArgsProvider, dropResult, getLatestWinsRunner };
});
