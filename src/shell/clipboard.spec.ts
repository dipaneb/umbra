import { describe, expect, it, vi } from "vitest";

const readText = vi.fn();
const writeText = vi.fn();

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: () => readText(),
  writeText: (text: string) => writeText(text),
}));

const { readClipboardText, writeClipboardText } = await import("./clipboard");

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
