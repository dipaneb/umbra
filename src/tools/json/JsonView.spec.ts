import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import JsonView from "./JsonView.vue";

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

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  readTextMock.mockReset();
  writeTextMock.mockReset();
});

function inputTextarea(w: VueWrapper) {
  return w.find("[aria-label='JSON input']");
}

function outputValue(w: VueWrapper) {
  return (w.find("[aria-label='JSON output']").element as HTMLTextAreaElement).value;
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
});
