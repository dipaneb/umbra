import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import Base64View from "./Base64View.vue";
import { useRegistryStore } from "../../stores/registry";

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
let pinia: Pinia;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  readTextMock.mockReset();
  writeTextMock.mockReset();
  saveMock.mockReset();
});

function mountView() {
  pinia = createPinia();
  wrapper = mount(Base64View, { global: { plugins: [pinia] } });
  return wrapper;
}

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Base64View", () => {
  it("encodes input with the standard alphabet by default and calls base64_encode (AC1)", async () => {
    invokeMock.mockResolvedValueOnce("aGVsbG8=");
    mountView();

    await inputTextarea(wrapper!).setValue("hello");
    await clickButton(wrapper!, "Encode");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_encode", {
      input: "hello",
      url_safe: false,
    });
    expect(outputValue(wrapper!)).toBe("aGVsbG8=");
  });

  it("passes url_safe: true to base64_encode when URL-safe alphabet is selected (AC1)", async () => {
    invokeMock.mockResolvedValueOnce("Pj4-");
    mountView();

    await inputTextarea(wrapper!).setValue(">>>");
    await wrapper!.find('input[type="radio"][value="url_safe"]').setValue();
    await clickButton(wrapper!, "Encode");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_encode", {
      input: ">>>",
      url_safe: true,
    });
  });

  it("decodes input without an alphabet choice and calls base64_decode (AC2)", async () => {
    invokeMock.mockResolvedValueOnce("hello");
    mountView();

    await inputTextarea(wrapper!).setValue("aGVsbG8=");
    await clickButton(wrapper!, "Decode");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_decode", { input: "aGVsbG8=" });
    expect(outputValue(wrapper!)).toBe("hello");
  });

  it("renders a rejected ToolError's message and byte offset, not a raw string (AC3)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-invalid",
      message: "Invalid symbol 33, offset 3.",
      position: { kind: "ByteOffset", offset: 3 },
      context: null,
    });
    mountView();

    await inputTextarea(wrapper!).setValue("bad!base64");
    await clickButton(wrapper!, "Decode");
    await flushPromises();

    const alert = wrapper!.find("[role='alert']");
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
    mountView();

    await inputTextarea(wrapper!).setValue("//4=");
    await clickButton(wrapper!, "Decode");
    await flushPromises();

    expect(wrapper!.find("[role='alert']").text()).toContain("invalid utf-8 sequence");
  });

  it("populates the input field from the clipboard on Paste (AC4)", async () => {
    readTextMock.mockResolvedValueOnce("aGVsbG8=");
    mountView();

    await clickButton(wrapper!, "Paste from clipboard");
    await flushPromises();

    expect((inputTextarea(wrapper!).element as HTMLTextAreaElement).value).toBe("aGVsbG8=");
  });

  it("copies the current output text to the clipboard on Copy (AC4)", async () => {
    invokeMock.mockResolvedValueOnce("aGVsbG8=");
    writeTextMock.mockResolvedValueOnce(undefined);
    mountView();

    await inputTextarea(wrapper!).setValue("hello");
    await clickButton(wrapper!, "Encode");
    await flushPromises();
    await clickButton(wrapper!, "Copy to clipboard");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith("aGVsbG8=");
  });

  it("disables Copy to clipboard while output is empty", () => {
    mountView();

    const copyButton = wrapper!.findAll("button").find((b) => b.text() === "Copy to clipboard");
    expect(copyButton?.attributes("disabled")).toBeDefined();
  });

  // AD-14: DropZone.vue is the shell's single generic dispatcher and calls
  // `invoke()` itself; Base64View.vue's only job on the drop path is to (a)
  // supply `url_safe` via a registered provider and (b) consume the outcome
  // via `registry.dropResult`. These tests exercise that contract directly
  // rather than going through a real DropZone.vue + Tauri event mock.

  it("registers a drop-args provider reporting the current url_safe setting (AC1)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    expect(registry.dropArgsProviders.base64?.()).toEqual({ url_safe: false });

    await wrapper!.find('input[type="radio"][value="url_safe"]').setValue();
    expect(registry.dropArgsProviders.base64?.()).toEqual({ url_safe: true });
  });

  it("deregisters its drop-args provider on unmount", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();
    expect(registry.dropArgsProviders.base64).toBeDefined();

    wrapper!.unmount();
    wrapper = undefined;
    expect(registry.dropArgsProviders.base64).toBeUndefined();
  });

  it("consumes a successful drop result into output and clears the signal (AC1)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "base64", value: "//4AAQ==" };
    await flushPromises();

    expect(outputValue(wrapper!)).toBe("//4AAQ==");
    expect(registry.dropResult).toBeNull();
  });

  it("ignores a drop result routed to a different tool", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "json", value: "irrelevant" };
    await flushPromises();

    expect(outputValue(wrapper!)).toBe("");
  });

  it("renders a file-read ToolError from a failed drop result (AC4)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = {
      toolId: "base64",
      error: {
        code: "file-read-error",
        message: "/tmp/missing.bin: No such file or directory (os error 2)",
        position: null,
        context: null,
      },
    };
    await flushPromises();

    expect(wrapper!.find("[role='alert']").text()).toContain("No such file or directory");
  });

  it("decodes the current input to a chosen file via the save dialog (AC2)", async () => {
    saveMock.mockResolvedValueOnce("/tmp/decoded.bin");
    invokeMock.mockResolvedValueOnce(undefined);
    mountView();

    await inputTextarea(wrapper!).setValue("aGVsbG8=");
    await clickButton(wrapper!, "Decode to file");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("base64_decode_to_file", {
      input: "aGVsbG8=",
      path: "/tmp/decoded.bin",
    });
  });

  it("does nothing when the save dialog is cancelled", async () => {
    saveMock.mockResolvedValueOnce(null);
    mountView();

    await inputTextarea(wrapper!).setValue("aGVsbG8=");
    await clickButton(wrapper!, "Decode to file");
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
    mountView();

    await inputTextarea(wrapper!).setValue("bad!base64");
    await clickButton(wrapper!, "Decode to file");
    await flushPromises();

    expect(wrapper!.find("[role='alert']").text()).toContain("Invalid symbol 33, offset 3.");
  });

  it("clears a stale error before a new decode-to-file attempt", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-invalid",
      message: "Invalid symbol 33, offset 3.",
      position: null,
      context: null,
    });
    mountView();

    await inputTextarea(wrapper!).setValue("bad!base64");
    await clickButton(wrapper!, "Decode");
    await flushPromises();
    expect(wrapper!.find("[role='alert']").exists()).toBe(true);

    saveMock.mockResolvedValueOnce("/tmp/decoded.bin");
    invokeMock.mockResolvedValueOnce(undefined);
    await inputTextarea(wrapper!).setValue("aGVsbG8=");
    await clickButton(wrapper!, "Decode to file");
    await flushPromises();

    expect(wrapper!.find("[role='alert']").exists()).toBe(false);
  });

  it("renders a ToolError when the save dialog itself rejects", async () => {
    saveMock.mockRejectedValueOnce(new Error("dialog unavailable"));
    mountView();

    await inputTextarea(wrapper!).setValue("aGVsbG8=");
    await clickButton(wrapper!, "Decode to file");
    await flushPromises();

    expect(wrapper!.find("[role='alert']").text()).toContain("dialog unavailable");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("disables Decode to file while a decode-to-file call is pending", async () => {
    const pendingSave = deferred<string | null>();
    saveMock.mockReturnValueOnce(pendingSave.promise);
    mountView();

    await inputTextarea(wrapper!).setValue("aGVsbG8=");
    const clickPromise = clickButton(wrapper!, "Decode to file");
    await flushPromises();

    const decodeButton = wrapper!.findAll("button").find((b) => b.text() === "Decode to file");
    expect(decodeButton?.attributes("disabled")).toBeDefined();

    pendingSave.resolve(null);
    await clickPromise;
    await flushPromises();

    expect(wrapper!.findAll("button").find((b) => b.text() === "Decode to file")?.attributes("disabled")).toBeUndefined();
  });
});
