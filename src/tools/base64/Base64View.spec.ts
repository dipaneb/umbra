import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import Base64View from "./Base64View.vue";
import { lastDrop } from "../../shell/dropZone";

const { invokeMock, readTextMock, writeTextMock, saveMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  readTextMock: vi.fn(),
  writeTextMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: () => readTextMock(),
  writeText: (text: string) => writeTextMock(text),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (...args: unknown[]) => saveMock(...args),
}));

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  lastDrop.value = null;
  invokeMock.mockReset();
  readTextMock.mockReset();
  writeTextMock.mockReset();
  saveMock.mockReset();
});

function inputTextarea(w: VueWrapper) {
  return w.find("#base64-input");
}

function outputValue(w: VueWrapper) {
  return (w.find("#base64-output").element as HTMLTextAreaElement).value;
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

describe("Base64View", () => {
  it("encodes input with the standard alphabet by default and calls base64_encode (AC1)", async () => {
    invokeMock.mockResolvedValueOnce("aGVsbG8=");
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue("hello");
    await clickButton(wrapper, "Encode");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_encode", {
      input: "hello",
      url_safe: false,
    });
    expect(outputValue(wrapper)).toBe("aGVsbG8=");
  });

  it("passes url_safe: true to base64_encode when URL-safe alphabet is selected (AC1)", async () => {
    invokeMock.mockResolvedValueOnce("Pj4-");
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue(">>>");
    await wrapper.find('input[type="radio"][value="url_safe"]').setValue();
    await clickButton(wrapper, "Encode");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_encode", {
      input: ">>>",
      url_safe: true,
    });
  });

  it("decodes input without an alphabet choice and calls base64_decode (AC2)", async () => {
    invokeMock.mockResolvedValueOnce("hello");
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue("aGVsbG8=");
    await clickButton(wrapper, "Decode");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_decode", { input: "aGVsbG8=" });
    expect(outputValue(wrapper)).toBe("hello");
  });

  it("renders a rejected ToolError's message and byte offset, not a raw string (AC3)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-invalid",
      message: "Invalid symbol 33, offset 3.",
      position: { kind: "ByteOffset", offset: 3 },
      context: null,
    });
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue("bad!base64");
    await clickButton(wrapper, "Decode");
    await flushPromises();

    const alert = wrapper.find("[role='alert']");
    expect(alert.text()).toContain("Invalid symbol 33, offset 3.");
    expect(alert.text()).toContain("(offset 3)");
  });

  it("renders a generic error without a position", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-not-utf8",
      message: "invalid utf-8 sequence",
      position: null,
      context: null,
    });
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue("//4=");
    await clickButton(wrapper, "Decode");
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("invalid utf-8 sequence");
  });

  it("populates the input field from the clipboard on Paste (AC4)", async () => {
    readTextMock.mockResolvedValueOnce("aGVsbG8=");
    wrapper = mount(Base64View);

    await clickButton(wrapper, "Paste from clipboard");
    await flushPromises();

    expect((inputTextarea(wrapper).element as HTMLTextAreaElement).value).toBe("aGVsbG8=");
  });

  it("copies the current output text to the clipboard on Copy (AC4)", async () => {
    invokeMock.mockResolvedValueOnce("aGVsbG8=");
    writeTextMock.mockResolvedValueOnce(undefined);
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue("hello");
    await clickButton(wrapper, "Encode");
    await flushPromises();
    await clickButton(wrapper, "Copy to clipboard");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith("aGVsbG8=");
  });

  it("disables Copy to clipboard while output is empty", () => {
    wrapper = mount(Base64View);

    const copyButton = wrapper.findAll("button").find((b) => b.text() === "Copy to clipboard");
    expect(copyButton?.attributes("disabled")).toBeDefined();
  });

  it("encodes a dropped file via base64_encode_file (AC1)", async () => {
    invokeMock.mockResolvedValueOnce("//4AAQ==");
    wrapper = mount(Base64View);

    lastDrop.value = { toolId: "base64", paths: ["/tmp/dropped.bin"] };
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_encode_file", {
      path: "/tmp/dropped.bin",
      url_safe: false,
    });
    expect(outputValue(wrapper)).toBe("//4AAQ==");
    expect(lastDrop.value).toBeNull();
  });

  it("ignores a drop routed to a different tool", async () => {
    wrapper = mount(Base64View);

    lastDrop.value = { toolId: "json", paths: ["/tmp/dropped.json"] };
    await flushPromises();

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("renders a file-read ToolError from a dropped file that can't be read (AC4)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "file-read-error",
      message: "No such file or directory (os error 2)",
      position: null,
      context: null,
    });
    wrapper = mount(Base64View);

    lastDrop.value = { toolId: "base64", paths: ["/tmp/missing.bin"] };
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("No such file or directory");
  });

  it("decodes the current input to a chosen file via the save dialog (AC2)", async () => {
    saveMock.mockResolvedValueOnce("/tmp/decoded.bin");
    invokeMock.mockResolvedValueOnce(undefined);
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue("aGVsbG8=");
    await clickButton(wrapper, "Decode to file");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_decode_to_file", {
      input: "aGVsbG8=",
      path: "/tmp/decoded.bin",
    });
  });

  it("does nothing when the save dialog is cancelled", async () => {
    saveMock.mockResolvedValueOnce(null);
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue("aGVsbG8=");
    await clickButton(wrapper, "Decode to file");
    await flushPromises();

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("renders a ToolError when decode-to-file fails", async () => {
    saveMock.mockResolvedValueOnce("/tmp/decoded.bin");
    invokeMock.mockRejectedValueOnce({
      code: "base64-invalid",
      message: "Invalid symbol 33, offset 3.",
      position: { kind: "ByteOffset", offset: 3 },
      context: null,
    });
    wrapper = mount(Base64View);

    await inputTextarea(wrapper).setValue("bad!base64");
    await clickButton(wrapper, "Decode to file");
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("Invalid symbol 33, offset 3.");
  });
});
