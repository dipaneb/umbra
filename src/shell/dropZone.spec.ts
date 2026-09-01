import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import type { ToolRegistryEntry } from "../stores/registry";
import { useRegistryStore } from "../stores/registry";
import { createAppRouter } from "../router";
import { isEditableTarget, resolveActiveTool, routeDrop, routePaste } from "./dropZone";
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
  descriptionKey: "test",
  aliases: ["base64", "b64"],
  route: "/tools/base64",
  icon: "base64",
  component: () => import("../tools/base64/Base64View.vue"),
  drop: { acceptedMimeTypes: [], handler: "base64_ingest_file" },
};

const jsonTool: ToolRegistryEntry = {
  id: "json",
  name: "JSON",
  descriptionKey: "test",
  aliases: ["json"],
  route: "/tools/json",
  icon: "json",
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

const bucketTool: ToolRegistryEntry = {
  id: "bucket",
  name: "Bucket",
  descriptionKey: "test",
  aliases: ["bucket", "ocr"],
  route: "/tools/bucket",
  icon: "bucket",
  component: () => import("../tools/bucket/BucketView.vue"),
  drop: { acceptedMimeTypes: [], handler: "bucket_extract_text" },
  paste: { handler: "bucket_extract_text_from_clipboard" },
};

describe("routePaste", () => {
  it("accepts a paste for a tool that declares paste support", () => {
    const result = routePaste(bucketTool);
    expect(result).toEqual({
      accepted: true,
      toolId: "bucket",
      handler: "bucket_extract_text_from_clipboard",
    });
  });

  it("rejects a paste when the active tool has no paste support", () => {
    expect(routePaste(base64Tool)).toEqual({ accepted: false });
  });

  it("rejects a paste when no tool matches the route", () => {
    expect(routePaste(undefined)).toEqual({ accepted: false });
  });
});

describe("isEditableTarget", () => {
  it("treats an <input> as editable", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
  });

  it("treats a <textarea> as editable", () => {
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
  });

  it("treats a contenteditable element as editable", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    expect(isEditableTarget(div)).toBe(true);
  });

  it("treats an element that only inherits contenteditable from an ancestor as editable", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    const span = document.createElement("span");
    div.appendChild(span);
    expect(isEditableTarget(span)).toBe(true);
  });

  it("does not treat a plain element as editable", () => {
    expect(isEditableTarget(document.createElement("section"))).toBe(false);
  });

  it("does not treat a null/non-element target as editable", () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });
});

type DragDropCallback = (event: { payload: { type: string; paths: string[] } }) => void;

const { onDragDropEventMock, unlistenMock, invokeMock, readClipboardImageMock } = vi.hoisted(() => ({
  onDragDropEventMock: vi.fn(),
  unlistenMock: vi.fn(),
  invokeMock: vi.fn(),
  readClipboardImageMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: (callback: DragDropCallback) => onDragDropEventMock(callback),
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("./clipboard", () => ({
  readClipboardImage: (...args: unknown[]) => readClipboardImageMock(...args),
}));

let wrapper: VueWrapper | undefined;
let capturedCallback: DragDropCallback | undefined;

const SAMPLE_CLIPBOARD_IMAGE = { rgba: new Uint8Array([1, 2, 3, 4]), width: 1, height: 1 };

function dispatchPasteKeydown(target: EventTarget = window, options: { repeat?: boolean } = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "v",
    metaKey: true,
    bubbles: true,
    cancelable: true,
    repeat: options.repeat ?? false,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  onDragDropEventMock.mockReset();
  unlistenMock.mockReset();
  invokeMock.mockReset();
  readClipboardImageMock.mockReset();
  capturedCallback = undefined;
  vi.useRealTimers();
});

async function setupDropZone(
  routePath: string,
): Promise<{ wrapper: VueWrapper; pinia: Pinia; router: ReturnType<typeof createAppRouter> }> {
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

  return { wrapper, pinia, router };
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
    const ingest = { mode: "encoded", value: "//4AAQ==", mime: null };
    invokeMock.mockResolvedValueOnce(ingest);
    const { pinia } = await setupDropZone("/tools/base64");
    const registry = useRegistryStore(pinia);
    registry.setDropArgsProvider("base64", () => ({ url_safe: true }));

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/file.bin"] } });
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_ingest_file", { path: "/tmp/file.bin", url_safe: true });
    expect(registry.dropResult).toEqual({ toolId: "base64", value: ingest });
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
    // Story 8.4: no source path on an error outcome.
    expect(registry.dropSourcePath).toBeNull();
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
    // Story 8.4: the file's path is forwarded alongside the outcome so a view
    // can re-invoke its file handler (Hash re-hashing on a selection change).
    // Tagged with toolId like dropResult (code review, Story 8.4).
    expect(registry.dropSourcePath).toEqual({ toolId: "hash", path: "/tmp/report.pdf" });
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

  it("does not let a drop for one tool supersede an unrelated in-flight drop for a different tool (AD-16 cross-tool fix)", async () => {
    let resolveBase64: (value: unknown) => void;
    const base64Promise = new Promise((resolve) => {
      resolveBase64 = resolve;
    });
    let resolveHash: (value: unknown) => void;
    const hashPromise = new Promise((resolve) => {
      resolveHash = resolve;
    });
    invokeMock.mockReturnValueOnce(base64Promise).mockReturnValueOnce(hashPromise);

    const { pinia, router } = await setupDropZone("/tools/base64");
    const registry = useRegistryStore(pinia);

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/a.bin"] } });
    await flushPromises();

    // The user switches to Hash and drops there before base64's invoke
    // resolves. Under the old shared-runner bug, this dispatch would bump
    // one component-wide counter and wrongly mark base64's in-flight
    // request "superseded" even though it targets an unrelated tool.
    await router.push("/tools/hash");
    await flushPromises();
    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/b.bin"] } });
    await flushPromises();

    // ...then switches back to Base64 before its invoke resolves, so its
    // view is active again by the time the result arrives.
    await router.push("/tools/base64");
    await flushPromises();

    resolveBase64!("//base64result==");
    await flushPromises();
    expect(registry.dropResult).toEqual({ toolId: "base64", value: "//base64result==" });

    // The stale hash drop resolving afterwards must not overwrite it, and
    // (per the discard-on-unmount fix) is itself discarded since Hash is no
    // longer the active tool.
    resolveHash!({ sha256: "hash-value", sha512: "x", md5: "x", sha1: "x" });
    await flushPromises();
    expect(registry.dropResult).toEqual({ toolId: "base64", value: "//base64result==" });
  });

  it("discards a drop's result once its tool is no longer active by the time invoke() resolves (AD-16: results for unmounted views are discarded on arrival)", async () => {
    let resolveInvoke: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveInvoke = resolve;
    });
    invokeMock.mockReturnValueOnce(pending);

    const { pinia, router } = await setupDropZone("/tools/hash");
    const registry = useRegistryStore(pinia);

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/big.bin"] } });
    await flushPromises();

    // The user navigates away from Hash before the invoke resolves.
    await router.push("/tools/base64");
    await flushPromises();

    resolveInvoke!({ sha256: "late", sha512: "x", md5: "x", sha1: "x" });
    await flushPromises();

    expect(registry.dropResult).toBeNull();
  });
});

describe("DropZone paste dispatch (Story 4.2)", () => {
  it("dispatches ⌘V as a clipboard-image paste when Bucket is active and the target isn't editable (AC1)", async () => {
    readClipboardImageMock.mockResolvedValueOnce(SAMPLE_CLIPBOARD_IMAGE);
    invokeMock.mockResolvedValueOnce({ text: "UMBRA", confidence: 0.9 });
    const { pinia } = await setupDropZone("/tools/bucket");
    const registry = useRegistryStore(pinia);

    dispatchPasteKeydown();
    await flushPromises();

    expect(readClipboardImageMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("bucket_extract_text_from_clipboard", SAMPLE_CLIPBOARD_IMAGE.rgba, {
      headers: { "x-image-width": "1", "x-image-height": "1" },
    });
    expect(registry.pasteResult).toEqual({ toolId: "bucket", value: { text: "UMBRA", confidence: 0.9 } });
  });

  it("stores a ToolError on the registry when the paste handler rejects", async () => {
    readClipboardImageMock.mockResolvedValueOnce(SAMPLE_CLIPBOARD_IMAGE);
    invokeMock.mockRejectedValueOnce({
      code: "bucket-malformed-image-buffer",
      message: "RGBA buffer is 3 bytes, which does not match 10x10x4 = 400 bytes",
      position: null,
      context: null,
    });
    const { pinia } = await setupDropZone("/tools/bucket");
    const registry = useRegistryStore(pinia);

    dispatchPasteKeydown();
    await flushPromises();

    expect(registry.pasteResult).toEqual({
      toolId: "bucket",
      error: {
        code: "bucket-malformed-image-buffer",
        message: "RGBA buffer is 3 bytes, which does not match 10x10x4 = 400 bytes",
        position: null,
        context: null,
      },
    });
  });

  it("does not intercept ⌘V for a tool with no paste support", async () => {
    await setupDropZone("/tools/json");

    dispatchPasteKeydown();
    await flushPromises();

    expect(readClipboardImageMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  // Critical regression-prevention test (Story 4.2 Task 4/6): ⌘V is the standard OS text-paste
  // shortcut, used everywhere in this app (Hash's textarea, JSON's input, Cron's fields, and
  // Bucket's own editable text-output field). A naive global listener would break normal
  // text-paste in all of them. This must never fire the image-paste dispatch when focus is
  // inside an editable element, even with the Bucket route active.
  it("does NOT intercept ⌘V when the event target is an editable element, even with Bucket active (regression)", async () => {
    await setupDropZone("/tools/bucket");

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    try {
      const event = dispatchPasteKeydown(textarea);
      await flushPromises();

      expect(readClipboardImageMock).not.toHaveBeenCalled();
      expect(invokeMock).not.toHaveBeenCalled();
      // Native text-paste must be left to proceed unmodified.
      expect(event.defaultPrevented).toBe(false);
    } finally {
      textarea.remove();
    }
  });

  it("does NOT intercept ⌘V when focus is inside an <input>, even with Bucket active (regression)", async () => {
    await setupDropZone("/tools/bucket");

    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      dispatchPasteKeydown(input);
      await flushPromises();

      expect(readClipboardImageMock).not.toHaveBeenCalled();
      expect(invokeMock).not.toHaveBeenCalled();
    } finally {
      input.remove();
    }
  });

  it("does NOT intercept a repeated (held-key) ⌘V keydown, only the initial press", async () => {
    readClipboardImageMock.mockResolvedValueOnce(SAMPLE_CLIPBOARD_IMAGE);
    invokeMock.mockResolvedValueOnce({ text: "UMBRA", confidence: 0.9 });
    await setupDropZone("/tools/bucket");

    dispatchPasteKeydown(window, { repeat: false });
    await flushPromises();
    dispatchPasteKeydown(window, { repeat: true });
    await flushPromises();

    expect(readClipboardImageMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("latest-wins: a paste dispatched after an in-flight drop for the same tool wins when it resolves first (AC4, AD-16)", async () => {
    let resolveDrop: (value: unknown) => void;
    const dropPromise = new Promise((resolve) => {
      resolveDrop = resolve;
    });
    invokeMock.mockReturnValueOnce(dropPromise);
    readClipboardImageMock.mockResolvedValueOnce(SAMPLE_CLIPBOARD_IMAGE);
    invokeMock.mockResolvedValueOnce({ text: "from paste", confidence: 0.8 });

    const { pinia } = await setupDropZone("/tools/bucket");
    const registry = useRegistryStore(pinia);

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/screenshot.png"] } });
    await flushPromises();

    dispatchPasteKeydown();
    await flushPromises();

    // The paste (dispatched after the drop) resolves and wins...
    expect(registry.dropResult).toBeNull();
    expect(registry.pasteResult).toEqual({ toolId: "bucket", value: { text: "from paste", confidence: 0.8 } });

    // ...then the older, superseded drop resolves after it and must not overwrite the paste's outcome.
    resolveDrop!({ text: "from drop", confidence: 0.7 });
    await flushPromises();
    expect(registry.dropResult).toBeNull();
    expect(registry.pasteResult).toEqual({ toolId: "bucket", value: { text: "from paste", confidence: 0.8 } });
  });

  it("latest-wins: a drop dispatched after an in-flight paste for the same tool wins when it resolves first (AC4, AD-16)", async () => {
    let resolvePaste: (value: unknown) => void;
    const pastePromise = new Promise((resolve) => {
      resolvePaste = resolve;
    });
    readClipboardImageMock.mockResolvedValueOnce(SAMPLE_CLIPBOARD_IMAGE);
    invokeMock.mockReturnValueOnce(pastePromise);
    invokeMock.mockResolvedValueOnce({ text: "from drop", confidence: 0.7 });

    const { pinia } = await setupDropZone("/tools/bucket");
    const registry = useRegistryStore(pinia);

    dispatchPasteKeydown();
    await flushPromises();

    capturedCallback?.({ payload: { type: "drop", paths: ["/tmp/screenshot.png"] } });
    await flushPromises();

    // The drop (dispatched after the paste) resolves and wins...
    expect(registry.pasteResult).toBeNull();
    expect(registry.dropResult).toEqual({ toolId: "bucket", value: { text: "from drop", confidence: 0.7 } });

    // ...then the older, superseded paste resolves after it and must not overwrite the drop's outcome.
    resolvePaste!({ text: "from paste", confidence: 0.8 });
    await flushPromises();
    expect(registry.pasteResult).toBeNull();
    expect(registry.dropResult).toEqual({ toolId: "bucket", value: { text: "from drop", confidence: 0.7 } });
  });
});
