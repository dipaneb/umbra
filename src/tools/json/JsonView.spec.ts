import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import JsonView from "./JsonView.vue";
import JsonTree from "./JsonTree.vue";
import type { JsonTreeValue } from "./jsonTreeValue";

const { invokeMock, readTextMock, writeTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  readTextMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: () => readTextMock(),
  writeText: (text: string) => writeTextMock(text),
}));

let wrapper: VueWrapper | undefined;

// Live tree-parsing is debounced (src/shell/debounce.ts). Fake timers mean a
// test's pending debounce timeout simply never fires unless explicitly
// advanced — real timers would instead leave it dangling into whichever test
// runs next 200ms later, letting it steal a queued invoke mock response.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  readTextMock.mockReset();
  writeTextMock.mockReset();
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function inputTextarea(w: VueWrapper) {
  return w.find("#json-input");
}

function outputValue(w: VueWrapper) {
  return (w.find("#json-output").element as HTMLTextAreaElement).value;
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

describe("JsonView", () => {
  it("formats input with the default two-space indent and calls json_format (AC1)", async () => {
    invokeMock.mockResolvedValueOnce('{\n  "a": 1\n}');
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Format");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("json_format", {
      input: '{"a":1}',
      indent: "two_spaces",
    });
    expect(outputValue(wrapper)).toBe('{\n  "a": 1\n}');
  });

  it("passes the four-space indent choice to json_format (AC1)", async () => {
    invokeMock.mockResolvedValueOnce('{\n    "a": 1\n}');
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find('input[type="radio"][value="four_spaces"]').setValue();
    await clickButton(wrapper, "Format");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("json_format", {
      input: '{"a":1}',
      indent: "four_spaces",
    });
  });

  it("passes the tab indent choice to json_format (AC1)", async () => {
    invokeMock.mockResolvedValueOnce('{\n\t"a": 1\n}');
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find('input[type="radio"][value="tab"]').setValue();
    await clickButton(wrapper, "Format");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("json_format", {
      input: '{"a":1}',
      indent: "tab",
    });
  });

  it("minifies input to one line and calls json_minify (AC1)", async () => {
    invokeMock.mockResolvedValueOnce('{"a":1}');
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{\n  "a": 1\n}');
    await clickButton(wrapper, "Minify");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("json_minify", { input: '{\n  "a": 1\n}' });
    expect(outputValue(wrapper)).toBe('{"a":1}');
  });

  it("renders a rejected ToolError's structured message and position, not a raw string (AC2)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "json-syntax",
      message: "unexpected end of input",
      position: { kind: "LineCol", line: 3, column: 5 },
      context: null,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue("{");
    await clickButton(wrapper, "Format");
    await flushPromises();

    const alert = wrapper.find("[role='alert']");
    expect(alert.text()).toContain("unexpected end of input");
    expect(alert.text()).toContain("(line 3, column 5)");
  });

  it("populates the input field from the clipboard on Paste (AC3)", async () => {
    readTextMock.mockResolvedValueOnce("pasted text");
    wrapper = mount(JsonView);

    await clickButton(wrapper, "Paste from clipboard");
    await flushPromises();

    expect((inputTextarea(wrapper).element as HTMLTextAreaElement).value).toBe("pasted text");
  });

  it("copies the current output text to the clipboard on Copy (AC3)", async () => {
    invokeMock.mockResolvedValueOnce('{"a":1}');
    writeTextMock.mockResolvedValueOnce(undefined);
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Minify");
    await flushPromises();

    await clickButton(wrapper, "Copy to clipboard");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith('{"a":1}');
  });

  it("disables Copy to clipboard while output is empty", () => {
    wrapper = mount(JsonView);

    const copyButton = wrapper.findAll("button").find((b) => b.text() === "Copy to clipboard");
    expect(copyButton?.attributes("disabled")).toBeDefined();
  });

  it("clears a stale successful output when a later Format call fails", async () => {
    invokeMock.mockResolvedValueOnce('{\n  "a": 1\n}');
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Format");
    await flushPromises();
    expect(outputValue(wrapper)).toBe('{\n  "a": 1\n}');

    invokeMock.mockRejectedValueOnce({
      code: "json-syntax",
      message: "unexpected end of input",
      position: { kind: "LineCol", line: 1, column: 1 },
      context: null,
    });
    await inputTextarea(wrapper).setValue("{");
    await clickButton(wrapper, "Format");
    await flushPromises();

    expect(outputValue(wrapper)).toBe("");
    const copyButton = wrapper.findAll("button").find((b) => b.text() === "Copy to clipboard");
    expect(copyButton?.attributes("disabled")).toBeDefined();
  });

  it("clears stale output and error when Paste supplies new input", async () => {
    invokeMock.mockResolvedValueOnce('{"a":1}');
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Minify");
    await flushPromises();
    expect(outputValue(wrapper)).toBe('{"a":1}');

    readTextMock.mockResolvedValueOnce("new pasted text");
    await clickButton(wrapper, "Paste from clipboard");
    await flushPromises();

    expect(outputValue(wrapper)).toBe("");
    expect(wrapper.find("[role='alert']").exists()).toBe(false);
  });

  it("surfaces a Paste rejection via the error alert instead of failing silently (AC3)", async () => {
    readTextMock.mockRejectedValueOnce(new Error("clipboard permission denied"));
    wrapper = mount(JsonView);

    await clickButton(wrapper, "Paste from clipboard");
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("clipboard permission denied");
  });

  it("surfaces a Copy rejection via the error alert instead of failing silently (AC3)", async () => {
    invokeMock.mockResolvedValueOnce('{"a":1}');
    writeTextMock.mockRejectedValueOnce(new Error("clipboard write failed"));
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Minify");
    await flushPromises();
    await clickButton(wrapper, "Copy to clipboard");
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("clipboard write failed");
  });

  it("discards a stale Paste read that resolves after a newer Paste click", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    readTextMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    wrapper = mount(JsonView);

    const pasteButton = wrapper.findAll("button").find((b) => b.text() === "Paste from clipboard")!;
    const firstClick = pasteButton.trigger("click");
    const secondClick = pasteButton.trigger("click");

    second.resolve("second paste");
    await flushPromises();
    first.resolve("first paste");
    await flushPromises();
    await firstClick;
    await secondClick;

    expect((inputTextarea(wrapper).element as HTMLTextAreaElement).value).toBe("second paste");
  });

  it("renders a fallback message when a rejection is not ToolError-shaped", async () => {
    invokeMock.mockRejectedValueOnce(new Error("IPC deserialization failed"));
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Format");
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("IPC deserialization failed");
  });

  it("renders a ByteOffset error position instead of dropping it (AC2 position variants)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "json-internal",
      message: "invalid utf-8",
      position: { kind: "ByteOffset", offset: 42 },
      context: null,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Format");
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("(offset 42)");
  });

  it("parses live from typed input without clicking Format or Minify (AC1)", async () => {
    const parsed: JsonTreeValue = { kind: "Object", data: [["a", { kind: "Number", data: "1" }]] };
    invokeMock.mockResolvedValueOnce(parsed);
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("json_parse", { input: '{"a":1}' });
    expect(wrapper.findComponent(JsonTree).props("value")).toEqual(parsed);
  });

  it("shows the tree as unavailable when the live parse rejects (AC3)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "json-syntax",
      message: "unexpected end of input",
      position: { kind: "LineCol", line: 1, column: 1 },
      context: null,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue("{");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.findComponent(JsonTree).props("value")).toBeNull();
  });

  it("ends up with a null tree, not a stale value, when input is cleared before a slow parse resolves", async () => {
    const slow = deferred<JsonTreeValue>();
    invokeMock.mockReturnValueOnce(slow.promise);
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await vi.advanceTimersByTimeAsync(200);

    await inputTextarea(wrapper).setValue("");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.findComponent(JsonTree).props("value")).toBeNull();

    slow.resolve({ kind: "Object", data: [["a", { kind: "Number", data: "1" }]] });
    await flushPromises();

    expect(wrapper.findComponent(JsonTree).props("value")).toBeNull();
  });
});
