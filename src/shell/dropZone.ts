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
  if (paths.length === 0) {
    return { accepted: false, noticeMessage: "No file was found in that drop." };
  }
  return { accepted: true, toolId: activeTool.id, paths };
}
