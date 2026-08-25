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

  // Regression: the message and position used to be two adjacent text
  // nodes with only incidental template whitespace between them, which Vue
  // silently collapsed to nothing ("...inputend of input(line 3, column
  // 5)"). The position is now its own element (spaced via CSS margin, not a
  // text-node space), so this asserts real DOM separation rather than mere
  // substring containment — `.toContain` alone wouldn't have caught the
  // original bug, since both strings are still "contained" even glued
  // together with no space.
  it("keeps the error message and its position as separate elements, not run together (regression)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "json-expected-value",
      message: "expected a value here",
      position: { kind: "LineCol", line: 1, column: 6 },
      context: null,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":}');
    await clickButton(wrapper, "Format");
    await flushPromises();

    const alert = wrapper.find("[role='alert']");
    const positionLink = alert.find(".position-link");
    expect(positionLink.exists()).toBe(true);
    expect(positionLink.text()).toBe("(line 1, column 6)");
    expect(alert.text()).not.toContain("here(line");
  });

  it("moves the textarea's caret to the reported position when it's clicked (AC8 follow-up)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "json-expected-value",
      message: "expected a value here",
      position: { kind: "LineCol", line: 1, column: 6 },
      context: null,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":}');
    await clickButton(wrapper, "Format");
    await flushPromises();
    await wrapper.find(".position-link").trigger("click");

    // Column 6 (1-indexed) on the single line '{"a":}' is offset 5 — right
    // before the '}' where a value was expected.
    const textarea = inputTextarea(wrapper).element as HTMLTextAreaElement;
    expect(textarea.selectionStart).toBe(5);
    expect(textarea.selectionEnd).toBe(5);
  });

  it("moves the caret past earlier lines when the reported position is on a later line", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "json-expected-object-separator",
      message: "expected , or }",
      position: { kind: "LineCol", line: 3, column: 3 },
      context: null,
    });
    wrapper = mount(JsonView);

    const value = '{\n  "a": 1\n  "b": 2\n}';
    await inputTextarea(wrapper).setValue(value);
    await clickButton(wrapper, "Format");
    await flushPromises();
    await wrapper.find(".position-link").trigger("click");

    const textarea = inputTextarea(wrapper).element as HTMLTextAreaElement;
    const expectedOffset = value.split("\n").slice(0, 2).join("\n").length + 1 + 2; // start of line 3 + column 3
    expect(textarea.selectionStart).toBe(expectedOffset);
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

  // Every Repair test below routes `json_parse` (the always-on live-tree
  // watcher, unrelated to Repair but fired by the same `input` change) to a
  // harmless empty tree, and asserts only against `json_repair`'s result —
  // keeps each test's mock focused on what it's actually exercising.
  function mockRepair(result: unknown) {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "json_repair") return Promise.resolve(result);
      if (cmd === "json_parse") return Promise.resolve(null);
      throw new Error(`unexpected invoke: ${cmd}`);
    });
  }

  it("shows a neutral prompt on the Repair tab when input is empty (AC9)", async () => {
    wrapper = mount(JsonView);
    await wrapper.find("#tab-repair").trigger("click");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.find("#tabpanel-repair").text()).toBe("Paste malformed JSON above to see repair suggestions.");
  });

  it("shows a no-changes-needed status on the Repair tab for already-valid input (AC9)", async () => {
    mockRepair({ repaired: '{"a":1}', changes: [], still_invalid: false });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find("#tab-repair").trigger("click");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.find("#tabpanel-repair").text()).toBe("This input is already valid JSON — nothing to repair.");
  });

  it("shows a no-fixes-available status when heuristics find nothing to change but input stays invalid (AC9)", async () => {
    mockRepair({ repaired: "1, 2", changes: [], still_invalid: true });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue("1, 2");
    await wrapper.find("#tab-repair").trigger("click");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.find("#tabpanel-repair").text()).toBe("No automatic fixes available for this input.");
  });

  it("shows per-change descriptions, a preview, and applies the repair only on explicit confirm (AC9)", async () => {
    mockRepair({
      repaired: "[1,2]",
      changes: [{ code: "trailing-comma", description: "Removed a trailing comma before a closing bracket", position: null }],
      still_invalid: false,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue("[1,2,]");
    await wrapper.find("#tab-repair").trigger("click");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    const panel = wrapper.find("#tabpanel-repair");
    expect(panel.text()).toContain("Removed a trailing comma before a closing bracket");
    expect((wrapper.find("#repair-preview").element as HTMLTextAreaElement).value).toBe("[1,2]");
    // Preview-then-confirm (AD-9): the original input is untouched until Apply is clicked.
    expect(inputValue(wrapper)).toBe("[1,2,]");

    mockRepair({ repaired: "[1,2]", changes: [], still_invalid: false });
    await clickButton(wrapper, "Apply repair");
    await flushPromises();

    expect(inputValue(wrapper)).toBe("[1,2]");
  });

  it("shows an honest still-invalid note when repair fixes something but can't fully validate it (AC9)", async () => {
    mockRepair({
      repaired: '{"a": 1,',
      changes: [{ code: "single-quoted-string", description: "Converted a single-quoted string to double-quoted", position: null }],
      still_invalid: true,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue("{'a': 1,");
    await wrapper.find("#tab-repair").trigger("click");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.find("#tabpanel-repair").text()).toContain(
      "These fixes aren't enough to make this valid JSON — you may need to fix the rest by hand.",
    );
  });

  // Every Query test below routes `json_parse` (the always-on live-tree
  // watcher) to a harmless empty tree, same convention as `mockRepair` above.
  function mockQuery(result: unknown) {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "json_query") return Promise.resolve(result);
      if (cmd === "json_parse") return Promise.resolve(null);
      throw new Error(`unexpected invoke: ${cmd}`);
    });
  }

  it("shows a neutral prompt on the Query tab when input is empty (AC10)", async () => {
    wrapper = mount(JsonView);
    await wrapper.find("#tab-query").trigger("click");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.find("#tabpanel-query").text()).toContain("Paste JSON above to query it.");
  });

  it("shows a neutral prompt on the Query tab when no expression has been entered yet (AC10)", async () => {
    wrapper = mount(JsonView);
    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find("#tab-query").trigger("click");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.find("#tabpanel-query").text()).toContain(
      "Enter a JSONPath expression above to query the document.",
    );
  });

  it("shows matches with their path, value, and copy actions on the Query tab (AC10)", async () => {
    mockQuery({
      matches: [
        { path: "$['a']", value: { kind: "Number", data: "1" } },
        { path: "$['b']", value: { kind: "Number", data: "2" } },
      ],
      total: 2,
      truncated: false,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1,"b":2}');
    await wrapper.find("#tab-query").trigger("click");
    await wrapper.find("#json-query-expression").setValue("$.*");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    const panel = wrapper.find("#tabpanel-query");
    expect(panel.text()).toContain("2 matches");
    expect(panel.text()).toContain("$['a']");
    expect(panel.text()).toContain("$['b']");
    expect(panel.findAll("li.query-match").length).toBe(2);
  });

  it("shows a no-matches status on the Query tab for a valid expression with no results (AC10)", async () => {
    mockQuery({ matches: [], total: 0, truncated: false });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find("#tab-query").trigger("click");
    await wrapper.find("#json-query-expression").setValue("$.nonexistent");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.find("#tabpanel-query").text()).toContain("No matches for this expression.");
  });

  it("shows a truncation notice with shown/total counts when matches exceed the server-side cap (AC10/AC14)", async () => {
    mockQuery({
      matches: [
        { path: "$[0]", value: { kind: "Number", data: "0" } },
        { path: "$[1]", value: { kind: "Number", data: "1" } },
      ],
      total: 5,
      truncated: true,
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue("[0,1,2,3,4]");
    await wrapper.find("#tab-query").trigger("click");
    await wrapper.find("#json-query-expression").setValue("$[*]");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    expect(wrapper.find("#tabpanel-query").text()).toContain(
      "Showing the first 2 of 5 matches — refine your expression to see the rest.",
    );
  });

  it("copies a query match's value and path to the clipboard (AC10)", async () => {
    mockQuery({ matches: [{ path: "$['a']", value: { kind: "Number", data: "1" } }], total: 1, truncated: false });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find("#tab-query").trigger("click");
    await wrapper.find("#json-query-expression").setValue("$.a");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    const buttons = wrapper.find("li.query-match").findAll("button");
    await buttons[0].trigger("click");
    expect(writeTextMock).toHaveBeenCalledWith("1");

    await buttons[1].trigger("click");
    expect(writeTextMock).toHaveBeenCalledWith("$['a']");
  });

  it("briefly confirms a query match copy with a changed label and checkmark, then reverts (AC10)", async () => {
    mockQuery({ matches: [{ path: "$['a']", value: { kind: "Number", data: "1" } }], total: 1, truncated: false });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find("#tab-query").trigger("click");
    await wrapper.find("#json-query-expression").setValue("$.a");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    const [valueButton, pathButton] = wrapper.find("li.query-match").findAll("button");
    await valueButton.trigger("click");
    await flushPromises();

    expect(wrapper.find('button[aria-label="Value copied"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Value copied"] svg').exists()).toBe(true);
    // Only the clicked (value) button's confirmation shows — the sibling
    // copy-path button on the same match is unaffected.
    expect(pathButton.attributes("aria-label")).toBe("Copy JSONPath");

    await vi.advanceTimersByTimeAsync(1500);
    await flushPromises();

    expect(wrapper.find('button[aria-label="Value copied"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Copy value"]').exists()).toBe(true);
  });

  it("does not show a false copied confirmation when a query match copy fails (AC10)", async () => {
    mockQuery({ matches: [{ path: "$['a']", value: { kind: "Number", data: "1" } }], total: 1, truncated: false });
    writeTextMock.mockRejectedValueOnce(new Error("clipboard write failed"));
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find("#tab-query").trigger("click");
    await wrapper.find("#json-query-expression").setValue("$.a");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    const [valueButton] = wrapper.find("li.query-match").findAll("button");
    await valueButton.trigger("click");
    await flushPromises();

    expect(wrapper.find('button[aria-label="Value copied"]').exists()).toBe(false);
    // Same shared error-alert path Explorer's own copy failures already use.
    expect(wrapper.find("[role='alert']").text()).toContain("clipboard write failed");
  });

  it("surfaces an invalid-expression error on the Query tab without a document-caret jump link (AC10)", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "json_query") {
        return Promise.reject({
          code: "json-query-invalid-expression",
          message: "expected an identifier",
          position: { kind: "ByteOffset", offset: 3 },
          context: null,
        });
      }
      if (cmd === "json_parse") return Promise.resolve(null);
      throw new Error(`unexpected invoke: ${cmd}`);
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":1}');
    await wrapper.find("#tab-query").trigger("click");
    await wrapper.find("#json-query-expression").setValue("$.[");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    const panel = wrapper.find("#tabpanel-query");
    expect(panel.text()).toContain("expected an identifier");
    expect(panel.text()).toContain("(offset 3)");
    // A ByteOffset position here locates a spot in the *expression*, not the
    // shared document — must not render as the same clickable jump-to-caret
    // button Format/Validate/Repair use for their (document) LineCol
    // positions, or it would move the wrong text field's caret.
    expect(panel.find(".position-link").exists()).toBe(false);
  });

  it("surfaces the document's own classified parse error on the Query tab, with a working caret jump, when the input itself is malformed (AC10)", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "json_query" || cmd === "json_parse") {
        return Promise.reject({
          code: "json-expected-value",
          message: "expected a value here — a string, number, object, array, true, false, or null",
          position: { kind: "LineCol", line: 1, column: 6 },
          context: null,
        });
      }
      throw new Error(`unexpected invoke: ${cmd}`);
    });
    wrapper = mount(JsonView);

    await inputTextarea(wrapper).setValue('{"a":}');
    await wrapper.find("#tab-query").trigger("click");
    await wrapper.find("#json-query-expression").setValue("$.a");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    const panel = wrapper.find("#tabpanel-query");
    // json-expected-value is TRANSLATABLE_CODES-registered (shared with
    // Validate), so this renders the real translated message, not the
    // mocked ToolError's raw text.
    expect(panel.text()).toContain("Expected a value here");
    expect(panel.text()).toContain("(line 1, column 6)");
    expect(panel.find(".position-link").exists()).toBe(true);
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

    // Validate, Repair, and Query now have real content (AC8/AC9/AC10) — Diff
    // is still an honest placeholder, so it's the one that exercises this
    // AC6 behavior.
    await wrapper.find("#tab-diff").trigger("click");

    expect(wrapper.findComponent(JsonTree).exists()).toBe(false);
    expect(wrapper.find("#tabpanel-diff").text()).toBe("Coming soon.");
  });

  it("surfaces a tree copy failure through the same error alert as Format/Minify", async () => {
    wrapper = mount(JsonView);
    await wrapper.findComponent(JsonTree).vm.$emit("copy-error", new Error("clipboard write failed"));
    await flushPromises();

    expect(wrapper.find("[role='alert']").text()).toContain("clipboard write failed");
  });
});
