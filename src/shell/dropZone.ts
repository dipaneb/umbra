import { ref } from "vue";
import type { ToolRegistryEntry } from "../stores/registry";

export function resolveActiveTool(
  routePath: string,
  tools: ToolRegistryEntry[],
): ToolRegistryEntry | undefined {
  return tools.find((tool) => tool.route === routePath);
}

export interface DropRouting {
  accepted: boolean;
  toolId?: string;
  paths?: string[];
  noticeMessage?: string;
}

export function routeDrop(paths: string[], activeTool: ToolRegistryEntry | undefined): DropRouting {
  if (!activeTool?.drop) {
    return {
      accepted: false,
      noticeMessage: activeTool
        ? `${activeTool.name} doesn't accept dropped files.`
        : "This view doesn't accept dropped files.",
    };
  }
  return { accepted: true, toolId: activeTool.id, paths };
}

// A bare exported `ref`, not a Pinia store: AD-6 restricts cross-tool state
// to exactly the `settings` and `registry` stores. This mirrors the
// shared-but-stateless shell-service pattern `clipboard.ts`/`invoke.ts`
// already use rather than introducing a third store for one signal.
export const lastDrop = ref<{ toolId: string; paths: string[] } | null>(null);
