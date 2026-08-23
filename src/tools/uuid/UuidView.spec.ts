import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import UuidView from "./UuidView.vue";

const { invokeMock, writeTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(),
  writeText: (text: string) => writeTextMock(text),
}));

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  writeTextMock.mockReset();
});

function mountView() {
  wrapper = mount(UuidView);
  return wrapper;
}

function countInput(w: VueWrapper) {
  return w.find("#uuid-count");
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

function resultRows(w: VueWrapper) {
  return w.findAll(".results li");
}

describe("UuidView", () => {
  it("generates a single UUID and renders one row with a Copy button (AC1)", async () => {
    invokeMock.mockResolvedValueOnce(["11111111-1111-4111-8111-111111111111"]);
    mountView();

    await clickButton(wrapper!, "Generate");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("uuid_generate", { version: "v4", count: 1 });
    const rows = resultRows(wrapper!);
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("11111111-1111-4111-8111-111111111111");
    expect(rows[0].findAll("button").some((b) => b.text() === "Copy")).toBe(true);
  });

  it("generates a bulk count and renders that many rows plus a visible Copy all (AC2)", async () => {
    const bulk = Array.from({ length: 5 }, (_, i) => `id-${i}`);
    invokeMock.mockResolvedValueOnce(bulk);
    mountView();

    await countInput(wrapper!).setValue(5);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("uuid_generate", { version: "v4", count: 5 });
    expect(resultRows(wrapper!)).toHaveLength(5);
    expect(wrapper!.findAll("button").some((b) => b.text() === "Copy all")).toBe(true);
  });

  it("does not show Copy all for a single result", async () => {
    invokeMock.mockResolvedValueOnce(["only-one"]);
    mountView();

    await clickButton(wrapper!, "Generate");
    await flushPromises();

    expect(wrapper!.findAll("button").some((b) => b.text() === "Copy all")).toBe(false);
  });

  it("renders a rejected count-too-large ToolError inline (AC2)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "uuid-count-too-large",
      message: "count is 1001, which exceeds the 1000 limit",
      position: null,
      context: null,
    });
    mountView();

    await countInput(wrapper!).setValue(1001);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("count is 1001, which exceeds the 1000 limit");
    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("shows a client-side guard message for a cleared count and never calls invoke", async () => {
    mountView();

    await countInput(wrapper!).setValue("");
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    expect(wrapper!.find("[role='alert']").exists()).toBe(true);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("round-trips a count of 0 to the server instead of blocking it client-side", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "uuid-count-zero",
      message: "count must be at least 1",
      position: null,
      context: null,
    });
    mountView();

    await countInput(wrapper!).setValue(0);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("uuid_generate", { version: "v4", count: 0 });
    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    // Deliberately NOT the raw Rust message ("count must be at least 1") —
    // uuid-count-zero is one of the few ToolError codes toolErrorMessage()
    // translates client-side (src/shell/toolError.ts), so this asserts the
    // rendered, translated string instead.
    expect(alert.text()).toContain("Enter a count of at least 1.");
  });

  it("clears a previous result when switching version (AC3)", async () => {
    invokeMock.mockResolvedValueOnce(["v4-result"]);
    mountView();

    await clickButton(wrapper!, "Generate");
    await flushPromises();
    expect(resultRows(wrapper!)).toHaveLength(1);

    await wrapper!.find('input[type="radio"][value="v7"]').setValue();
    await flushPromises();

    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("discards a stale in-flight response after the version changes before it resolves", async () => {
    let resolveInvoke: (value: string[]) => void;
    invokeMock.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        resolveInvoke = resolve;
      }),
    );
    mountView();

    await clickButton(wrapper!, "Generate");
    await wrapper!.find('input[type="radio"][value="v7"]').setValue();
    await flushPromises();
    expect(resultRows(wrapper!)).toHaveLength(0);

    resolveInvoke!(["stale-v4-result"]);
    await flushPromises();

    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("copies a single row's UUID via the per-row Copy button", async () => {
    invokeMock.mockResolvedValueOnce(["copy-me"]);
    writeTextMock.mockResolvedValueOnce(undefined);
    mountView();

    await clickButton(wrapper!, "Generate");
    await flushPromises();
    await clickButton(wrapper!, "Copy");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith("copy-me");
  });

  it("copies all results newline-joined via Copy all", async () => {
    invokeMock.mockResolvedValueOnce(["a", "b", "c"]);
    writeTextMock.mockResolvedValueOnce(undefined);
    mountView();

    await countInput(wrapper!).setValue(3);
    await clickButton(wrapper!, "Generate");
    await flushPromises();
    await clickButton(wrapper!, "Copy all");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith("a\nb\nc");
  });
});
