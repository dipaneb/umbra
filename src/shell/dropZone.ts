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

// ⌘V is the standard OS text-paste shortcut, used everywhere in this app (Hash's textarea,
// JSON's input, Cron's fields, Bucket's own editable text-output field). The paste dispatcher
// must never intercept it while focus is inside an editable element — only a non-editable target
// with the Bucket route active means "paste an image into the Bucket" (Story 4.2).
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  // Attribute-based (not `.isContentEditable`, which jsdom doesn't implement) — `closest` also
  // correctly matches an element that merely inherits editability from a `contenteditable`
  // ancestor, not just an element carrying the attribute itself.
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

export interface PasteRouting {
  accepted: boolean;
  toolId?: string;
  handler?: string;
}

export function routePaste(activeTool: ToolRegistryEntry | undefined): PasteRouting {
  if (!activeTool?.paste) {
    return { accepted: false };
  }
  return { accepted: true, toolId: activeTool.id, handler: activeTool.paste.handler };
}
