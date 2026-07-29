import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import type { ToolRegistryEntry } from "../stores/registry";
import { createAppRouter } from "../router";
import { resolveActiveTool, routeDrop, lastDrop } from "./dropZone";
import DropZone from "./DropZone.vue";

// NOTE: `DropZone.vue`'s component tests live in this same file, rather than
// a separate `DropZone.spec.ts`, because this repo sits on a case-insensitive
// filesystem (APFS) where `dropZone.spec.ts` and `DropZone.spec.ts` collide
// into a single path — confirmed empirically while authoring this story.
// AD-11's three-OS CI matrix means Windows (NTFS, case-insensitive by
// default) would hit the same collision even though Linux (ext4) would not;
// one shared file avoids the hazard entirely rather than relying on every
// contributor's OS to happen to be case-sensitive. Flagging this deviation
// from the story's literal two-file split per this project's established
// practice for resolving genuine spec ambiguities.

const base64Tool: ToolRegistryEntry = {
  id: "base64",
  name: "Base64",
  aliases: ["base64", "b64"],
  route: "/tools/base64",
  icon: "64",
  component: () => import("../tools/base64/Base64View.vue"),
  drop: { acceptedMimeTypes: [], handler: "base64_encode_file" },
};

const jsonTool: ToolRegistryEntry = {
  id: "json",
  name: "JSON",
  aliases: ["json"],
  route: "/tools/json",
  icon: "{ }",
  component: () => import("../tools/json/JsonView.vue"),
};

const tools = [jsonTool, base64Tool];

describe("resolveActiveTool", () => {
  it("finds the tool whose route matches the current path", () => {
    expect(resolveActiveTool("/tools/base64", tools)).toBe(base64Tool);
  });

  it("returns undefined when no tool's route matches", () => {
    expect(resolveActiveTool("/", tools)).toBeUndefined();
  });
});

describe("routeDrop", () => {
  it("accepts a drop for a tool that declares drop support", () => {
    const result = routeDrop(["/tmp/file.bin"], base64Tool);
    expect(result).toEqual({ accepted: true, toolId: "base64", paths: ["/tmp/file.bin"] });
  });

  it("rejects a drop with a tool-named notice when the active tool has no drop support", () => {
    const result = routeDrop(["/tmp/file.bin"], jsonTool);
    expect(result.accepted).toBe(false);
    expect(result.noticeMessage).toContain("JSON");
  });

  it("rejects a drop with a generic notice when no tool matches the route", () => {
    const result = routeDrop(["/tmp/file.bin"], undefined);
    expect(result.accepted).toBe(false);
    expect(result.noticeMessage).toBeTruthy();
    expect(result.noticeMessage).not.toContain("undefined");
  });
});

type DragDropCallback = (event: { payload: { type: string; paths: string[] } }) => void;

const { onDragDropEventMock, unlistenMock } = vi.hoisted(() => ({
  onDragDropEventMock: vi.fn(),
  unlistenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: (callback: DragDropCallback) => onDragDropEventMock(callback),
  }),
}));

let wrapper: VueWrapper | undefined;
let capturedCallback: DragDropCallback | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  lastDrop.value = null;
  onDragDropEventMock.mockReset();
  unlistenMock.mockReset();
  capturedCallback = undefined;
  vi.useRealTimers();
});

async function setupDropZone(routePath: string) {
  onDragDropEventMock.mockImplementation((callback: DragDropCallback) => {
    capturedCallback = callback;
    return Promise.resolve(unlistenMock);
  });

  const pinia = createPinia();
  const router = createAppRouter(pinia);
  router.push(routePath);
  await router.isReady();

  wrapper = mount(DropZone, { global: { plugins: [pinia, router] } });
  await flushPromises();

  return { wrapper, router };
}

describe("DropZone", () => {
  it("registers the native drop listener on mount and unlistens on unmount (AD-14)", async () => {
    await setupDropZone("/tools/base64");

    expect(onDragDropEventMock).toHaveBeenCalledTimes(1);
    expect(unlistenMock).not.toHaveBeenCalled();

    wrapper?.unmount();
    wrapper = undefined;

    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });

  it("sets lastDrop when a file is dropped while Base64 is active (AC1)", async () => {
    await setupDropZone("/tools/base64");

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/file.bin"] } });
    await flushPromises();

    expect(lastDrop.value).toEqual({ toolId: "base64", paths: ["/tmp/file.bin"] });
  });

  it("shows a no-op notice that auto-clears when dropping on a tool with no drop support (AC3)", async () => {
    vi.useFakeTimers();
    await setupDropZone("/tools/json");

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/file.bin"] } });
    await flushPromises();

    expect(wrapper?.find("[role='status']").exists()).toBe(true);
    expect(lastDrop.value).toBeNull();

    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper?.find("[role='status']").exists()).toBe(false);
  });

  it("ignores non-drop drag events (e.g. hover/enter)", async () => {
    await setupDropZone("/tools/base64");

    capturedCallback?.({ payload: { type: "over", paths: [] } });
    await flushPromises();

    expect(lastDrop.value).toBeNull();
  });
});
