import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import JsonView from "./JsonView.vue";
import JsonTree from "./JsonTree.vue";
import type { JsonTreeValue } from "./jsonTreeValue";

const { invokeMock, writeTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// Only JsonTree's own copy-value/copy-path actions still touch the
// clipboard now that the toolbar's generic Paste/Copy are gone (Story 8.1
// Task 2 design pass) — kept for the copy-error-surfacing test below.
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
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

function inputValue(w: VueWrapper) {
  return (inputTextarea(w).element as HTMLTextAreaElement).value;
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
    expect(inputValue(wrapper)).toBe('{\n  "a": 1\n}');
  });

  it("passes the four-space indent choice to json_format (AC1)", async () => {
    invokeMock.mockResolvedValueOnce('{\n    "a": 1\n}');
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find("#json-indent").setValue("four_spaces");
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
    await wrapper.find("#json-indent").setValue("tab");
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
    expect(inputValue(wrapper)).toBe('{"a":1}');
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

  it("does not render a Paste or Copy button — cut in the Story 8.1 Task 2 design pass", () => {
    wrapper = mount(JsonView);

    const labels = wrapper.findAll("button").map((b) => b.text());
    expect(labels).not.toContain("Paste from clipboard");
    expect(labels).not.toContain("Copy to clipboard");
  });

  it("leaves input as the user's current (invalid) text when Format fails, instead of reverting to a prior success", async () => {
    invokeMock.mockResolvedValueOnce('{\n  "a": 1\n}');
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Format");
    await flushPromises();
    expect(inputValue(wrapper)).toBe('{\n  "a": 1\n}');

    invokeMock.mockRejectedValueOnce({
      code: "json-syntax",
      message: "unexpected end of input",
      position: { kind: "LineCol", line: 1, column: 1 },
      context: null,
    });
    await inputTextarea(wrapper).setValue("{");
    await clickButton(wrapper, "Format");
    await flushPromises();

    expect(inputValue(wrapper)).toBe("{");
    expect(wrapper.find("[role='alert']").exists()).toBe(true);
  });

  it("clears a stale error on the next successful Format", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "json-syntax",
      message: "unexpected end of input",
      position: { kind: "LineCol", line: 1, column: 1 },
      context: null,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue("{");
    await clickButton(wrapper, "Format");
    await flushPromises();
    expect(wrapper.find("[role='alert']").exists()).toBe(true);

    invokeMock.mockResolvedValueOnce('{\n  "a": 1\n}');
    await inputTextarea(wrapper).setValue('{"a":1}');
    await clickButton(wrapper, "Format");
    await flushPromises();

    expect(wrapper.find("[role='alert']").exists()).toBe(false);
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

  it("shows a neutral prompt on the Validate tab when input is empty (AC8)", async () => {
    wrapper = mount(JsonView);
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    await wrapper.find("#tab-validate").trigger("click");

    expect(wrapper.find("#tabpanel-validate").text()).toBe("Paste JSON above to validate it.");
  });

  it("shows a valid-JSON status on the Validate tab once the live parse succeeds (AC8)", async () => {
    const parsed: JsonTreeValue = { kind: "Object", data: [] };
    invokeMock.mockResolvedValueOnce(parsed);
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue("{}");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();
    await wrapper.find("#tab-validate").trigger("click");

    expect(wrapper.find("#tabpanel-validate").text()).toBe("Valid JSON.");
  });

  it("surfaces the rewritten error, its position, and a Try Repair cross-link on the Validate tab (AC8)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "json-expected-value",
      message: "expected a value here — a string, number, object, array, true, false, or null",
      position: { kind: "LineCol", line: 1, column: 6 },
      context: null,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":}');
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();
    await wrapper.find("#tab-validate").trigger("click");

    // json-expected-value is TRANSLATABLE_CODES-registered, so the real
    // mounted i18n instance renders errors.json-expected-value from the
    // locale file, not the mocked ToolError's raw `message` verbatim.
    const panel = wrapper.find("#tabpanel-validate");
    expect(panel.text()).toContain("Expected a value here");
    expect(panel.text()).toContain("(line 1, column 6)");

    await clickButton(wrapper, "Try Repair");

    expect(wrapper.find("#tabpanel-repair").exists()).toBe(true);
    // Same shared `input` ref — switching tabs is the whole "carry over".
    expect(inputValue(wrapper)).toBe('{"a":}');
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

  it("discards a stale Format result that resolves after a newer Format call, keeping the newer output (AC2)", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    invokeMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    const firstClick = clickButton(wrapper, "Format");
    const secondClick = clickButton(wrapper, "Format");

    second.resolve('{\n  "a": 2\n}');
    await flushPromises();
    first.resolve('{\n  "a": 1\n}');
    await flushPromises();
    await firstClick;
    await secondClick;

    expect(inputValue(wrapper)).toBe('{\n  "a": 2\n}');
  });

  it("keeps the newer of two distinct non-null live-parsed trees when an older parse resolves late (AC2)", async () => {
    const first = deferred<JsonTreeValue>();
    const second = deferred<JsonTreeValue>();
    invokeMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await vi.advanceTimersByTimeAsync(200);
    await inputTextarea(wrapper).setValue('{"b":2}');
    await vi.advanceTimersByTimeAsync(200);

    const treeA: JsonTreeValue = { kind: "Object", data: [["a", { kind: "Number", data: "1" }]] };
    const treeB: JsonTreeValue = { kind: "Object", data: [["b", { kind: "Number", data: "2" }]] };

    second.resolve(treeB);
    await flushPromises();
    expect(wrapper.findComponent(JsonTree).props("value")).toEqual(treeB);

    first.resolve(treeA);
    await flushPromises();
    expect(wrapper.findComponent(JsonTree).props("value")).toEqual(treeB);
  });

  it("shows Explorer (with the live tree) as the default active tab (AC6)", () => {
    wrapper = mount(JsonView);

    const explorerTab = wrapper.find("#tab-explorer");
    expect(explorerTab.attributes("aria-selected")).toBe("true");
    expect(wrapper.findComponent(JsonTree).exists()).toBe(true);
  });

  it("shows an honest placeholder, not the tree, for a not-yet-built tab (AC6)", async () => {
    wrapper = mount(JsonView);

    // Validate now has real content (AC8) — Repair is still an honest
    // placeholder, so it's the one that exercises this AC6 behavior.
    await wrapper.find("#tab-repair").trigger("click");

    expect(wrapper.findComponent(JsonTree).exists()).toBe(false);
    expect(wrapper.find("#tabpanel-repair").text()).toBe("Coming soon.");
  });

  it("surfaces a tree copy failure through the same error alert as Format/Minify", async () => {
    wrapper = mount(JsonView);
    await wrapper.findComponent(JsonTree).vm.$emit("copy-error", new Error("clipboard write failed"));
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("clipboard write failed");
  });
});
