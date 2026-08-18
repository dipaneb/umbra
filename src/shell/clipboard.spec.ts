import { describe, expect, it, vi } from "vitest";

const readText = vi.fn();
const writeText = vi.fn();
const listen = vi.fn();

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: () => readText(),
  writeText: (text: string) => writeText(text),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listen(...args),
}));

const { onClipboardChange, readClipboardText, writeClipboardText } = await import("./clipboard");

describe("readClipboardText", () => {
  it("returns the text read from the clipboard plugin", async () => {
    readText.mockResolvedValueOnce("hello from clipboard");

    await expect(readClipboardText()).resolves.toBe("hello from clipboard");
  });
});

describe("writeClipboardText", () => {
  it("writes the given text via the clipboard plugin", async () => {
    writeText.mockResolvedValueOnce(undefined);

    await writeClipboardText("copy me");

    expect(writeText).toHaveBeenCalledWith("copy me");
  });
});

describe("onClipboardChange", () => {
  it("invokes the callback with the emitted event payload's kind", async () => {
    let handler: ((event: { payload: { kind: string } }) => void) | undefined;
    listen.mockImplementationOnce((_event: string, cb: typeof handler) => {
      handler = cb;
      return Promise.resolve(vi.fn());
    });

    const callback = vi.fn();
    onClipboardChange(callback);
    await Promise.resolve();
    await Promise.resolve();

    handler?.({ payload: { kind: "image" } });

    expect(listen).toHaveBeenCalledWith("clipboard-changed", expect.any(Function));
    expect(callback).toHaveBeenCalledWith("image");
  });

  it("returns a function that calls through to the real unlisten once registration resolves", async () => {
    const unlistenFn = vi.fn();
    listen.mockResolvedValueOnce(unlistenFn);

    const stop = onClipboardChange(vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    stop();

    expect(unlistenFn).toHaveBeenCalledOnce();
  });

  it("unlistens as soon as registration resolves, even when stopped before it resolves", async () => {
    const unlistenFn = vi.fn();
    let resolveListen: ((fn: () => void) => void) | undefined;
    listen.mockReturnValueOnce(
      new Promise<() => void>((resolve) => {
        resolveListen = resolve;
      }),
    );

    const stop = onClipboardChange(vi.fn());
    stop(); // called before listen()'s promise ever resolves
    expect(unlistenFn).not.toHaveBeenCalled();

    resolveListen?.(unlistenFn);
    await Promise.resolve();
    await Promise.resolve();

    expect(unlistenFn).toHaveBeenCalledOnce();
  });
});
