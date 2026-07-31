import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import type { ToolRegistryEntry } from "../stores/registry";
import { useRegistryStore } from "../stores/registry";
import { createAppRouter } from "../router";
import { resolveActiveTool, routeDrop } from "./dropZone";
import DropZone from "./DropZone.vue";

// NOTE: `DropZone.vue`'s component tests live in this same file, rather than
// a separate `DropZone.spec.ts`, because this repo sits on a case-insensitive
// filesystem (APFS) where `dropZone.spec.ts` and `DropZone.spec.ts` collide
// into a single path — confirmed empirically while authoring this story.
// AD-11's three-OS CI matrix means Windows (NTFS, case-insensitive by
// default) would hit the same collision even though Linux (ext4) would not;
// one shared file avoids the hazard entirely rather than relying on every
// contributor's OS to happen to be case-sensitive.

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

  it("rejects a drop with no paths, even for a tool that declares drop support", () => {
    const result = routeDrop([], base64Tool);
    expect(result.accepted).toBe(false);
    expect(result.noticeMessage).toBeTruthy();
  });
});

type DragDropCallback = (event: { payload: { type: string; paths: string[] } }) => void;

const { onDragDropEventMock, unlistenMock, invokeMock } = vi.hoisted(() => ({
  onDragDropEventMock: vi.fn(),
  unlistenMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: (callback: DragDropCallback) => onDragDropEventMock(callback),
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

let wrapper: VueWrapper | undefined;
let capturedCallback: DragDropCallback | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  onDragDropEventMock.mockReset();
  unlistenMock.mockReset();
  invokeMock.mockReset();
  capturedCallback = undefined;
  vi.useRealTimers();
});

async function setupDropZone(routePath: string): Promise<{ wrapper: VueWrapper; pinia: Pinia }> {
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

  return { wrapper, pinia };
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

  it("invokes the registry-declared handler with the dropped path and the tool's provided args (AC1, AD-14)", async () => {
    invokeMock.mockResolvedValueOnce("//4AAQ==");
    const { pinia } = await setupDropZone("/tools/base64");
    const registry = useRegistryStore(pinia);
    registry.setDropArgsProvider("base64", () => ({ url_safe: true }));

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/file.bin"] } });
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_encode_file", { path: "/tmp/file.bin", url_safe: true });
    expect(registry.dropResult).toEqual({ toolId: "base64", value: "//4AAQ==" });
  });

  it("stores a ToolError on the registry when the invoked handler rejects", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "file-read-error",
      message: "/tmp/file.bin: boom",
      position: null,
      context: null,
    });
    const { pinia } = await setupDropZone("/tools/base64");
    const registry = useRegistryStore(pinia);

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/file.bin"] } });
    await flushPromises();

    expect(registry.dropResult).toEqual({
      toolId: "base64",
      error: { code: "file-read-error", message: "/tmp/file.bin: boom", position: null, context: null },
    });
  });

  it("shows a no-op notice that auto-clears when dropping on a tool with no drop support (AC3)", async () => {
    vi.useFakeTimers();
    const { wrapper } = await setupDropZone("/tools/json");

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/file.bin"] } });
    await flushPromises();

    expect(wrapper.find("[role='status']").exists()).toBe(true);
    expect(invokeMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper.find("[role='status']").exists()).toBe(false);
  });

  it("ignores non-drop drag events (e.g. hover/enter)", async () => {
    await setupDropZone("/tools/base64");

    capturedCallback?.({ payload: { type: "over", paths: [] } });
    await flushPromises();

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes hash_compute_file with path only (no dropArgsProvider registered for hash) (AC1)", async () => {
    const sampleDigests = { sha256: "aaa", sha512: "bbb", md5: "ccc", sha1: "ddd" };
    invokeMock.mockResolvedValueOnce(sampleDigests);
    const { pinia } = await setupDropZone("/tools/hash");
    const registry = useRegistryStore(pinia);

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/report.pdf"] } });
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("hash_compute_file", { path: "/tmp/report.pdf" });
    expect(registry.dropResult).toEqual({ toolId: "hash", value: sampleDigests });
  });

  it("latest-wins: a newer drop's outcome survives even when the older drop's invoke() resolves later (AC2, AD-16)", async () => {
    let resolveFirst: (value: unknown) => void;
    let resolveSecond: (value: unknown) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    invokeMock.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

    const { pinia } = await setupDropZone("/tools/hash");
    const registry = useRegistryStore(pinia);

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/first.bin"] } });
    await flushPromises();
    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/second.bin"] } });
    await flushPromises();

    // The second (later-dispatched) drop resolves first...
    resolveSecond!({ sha256: "second", sha512: "s", md5: "s", sha1: "s" });
    await flushPromises();
    // ...then the first (older) drop resolves after it.
    resolveFirst!({ sha256: "first", sha512: "f", md5: "f", sha1: "f" });
    await flushPromises();

    expect(registry.dropResult).toEqual({
      toolId: "hash",
      value: { sha256: "second", sha512: "s", md5: "s", sha1: "s" },
    });
  });
});
