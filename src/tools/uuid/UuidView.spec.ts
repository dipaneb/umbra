import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import UuidView from "./UuidView.vue";

const { invokeMock, writeTextMock, saveMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  writeTextMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(),
  writeText: (text: string) => writeTextMock(text),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (...args: unknown[]) => saveMock(...args),
}));

// The settings store (uuid.* format persistence, AC18) imports this. The
// view never calls settings.init(), so the store stays on its in-memory
// DEFAULTS and setUuidFormat no-ops the disk write — this mock just keeps
// the import resolvable.
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => Promise.resolve(undefined)),
      set: vi.fn(() => Promise.resolve()),
      save: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve()),
      entries: vi.fn(() => Promise.resolve([])),
    }),
  ),
}));

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  writeTextMock.mockReset();
  saveMock.mockReset();
});

function mountView() {
  wrapper = mount(UuidView, { global: { plugins: [createPinia()] } });
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

async function chooseDownload(w: VueWrapper, ext: "txt" | "csv" | "json") {
  await clickButton(w, "Download"); // opens the format menu (Popover)
  await flushPromises();
  const item = w
    .findAll("button.download-menu-item")
    .find((b) => b.text() === `.${ext}`);
  if (!item) throw new Error(`download menu item not found: .${ext}`);
  await item.trigger("click");
  await flushPromises();
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
    // Structure-forced (AC16): the per-row Copy is now an icon-button
    // (AC13), so it's matched by class + accessible label, not button text.
    const copyButton = rows[0].find("button.row-copy");
    expect(copyButton.exists()).toBe(true);
    expect(copyButton.attributes("aria-label")).toBe("Copy to clipboard");
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
    // Structure-forced (AC16): per-row Copy is an icon-button now (AC13).
    await resultRows(wrapper!)[0].find("button.row-copy").trigger("click");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith("copy-me");
  });

  it("confirms the copied row via the icon-button's label, only after the write resolves (AC13)", async () => {
    invokeMock.mockResolvedValueOnce(["a", "b"]);
    let resolveWrite: () => void;
    writeTextMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveWrite = resolve;
      }),
    );
    mountView();

    await countInput(wrapper!).setValue(2);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    const firstCopy = () => resultRows(wrapper!)[0].find("button.row-copy");
    await firstCopy().trigger("click");
    await flushPromises();
    // Not confirmed until the clipboard write actually settles.
    expect(firstCopy().attributes("aria-label")).toBe("Copy to clipboard");

    resolveWrite!();
    await flushPromises();
    expect(firstCopy().attributes("aria-label")).toBe("Copied");
    // Only the clicked row confirms.
    expect(resultRows(wrapper!)[1].find("button.row-copy").attributes("aria-label")).toBe(
      "Copy to clipboard",
    );
  });

  it("drops a stale per-row copied confirmation when a format toggle changes the row (code review F14)", async () => {
    invokeMock.mockResolvedValueOnce(["a-b", "c-d"]);
    writeTextMock.mockResolvedValue(undefined);
    mountView();

    await countInput(wrapper!).setValue(2);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    const firstCopy = () => resultRows(wrapper!)[0].find("button.row-copy");
    await firstCopy().trigger("click");
    await flushPromises();
    expect(firstCopy().attributes("aria-label")).toBe("Copied");

    // Toggling a format re-renders row 0 to a different string — the lingering
    // check must clear rather than sit on a value the user never copied.
    await wrapper!
      .find('input[name="uuid-format-case"][aria-label="Uppercase"]')
      .setValue();
    expect(firstCopy().attributes("aria-label")).toBe("Copy to clipboard");
  });

  it("surfaces a failed download's error even when a prior client-guard error is still on screen (code review F1)", async () => {
    invokeMock.mockResolvedValueOnce(["a-b", "c-d"]);
    mountView();

    await countInput(wrapper!).setValue(2);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    // Client-guard failure: leaves the result list up, shows a client error.
    await countInput(wrapper!).setValue("");
    await clickButton(wrapper!, "Generate");
    await flushPromises();
    expect(wrapper!.find(".alert").text()).toContain("Enter");

    // A failed download must replace that stale message, not hide behind it.
    saveMock.mockResolvedValueOnce("/tmp/uuids.txt");
    invokeMock.mockRejectedValueOnce({
      code: "file-write-error",
      message: "disk full",
      position: null,
    });
    await chooseDownload(wrapper!, "txt");

    expect(wrapper!.find(".alert").text()).toContain("disk full");
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

  it("opens the v4-vs-v7 explainer from the ? on the version legend (AC9)", async () => {
    mountView();

    const helpTrigger = wrapper!.find("button.help-dot");
    expect(helpTrigger.exists()).toBe(true);
    expect(wrapper!.find('[role="dialog"]').exists()).toBe(false);

    await helpTrigger.trigger("click");
    await flushPromises();

    const dialog = wrapper!.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain("v4");
    expect(dialog.text()).toContain("v7");
  });

  it("re-renders existing results through the format toggles without re-generating (AC11/AC12)", async () => {
    invokeMock.mockResolvedValueOnce([
      "550e8400-e29b-41d4-a716-446655440000",
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    ]);
    mountView();

    await countInput(wrapper!).setValue(2);
    await clickButton(wrapper!, "Generate");
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledTimes(1);

    const rowText = () => resultRows(wrapper!).map((r) => r.find("code").text());
    const chip = (label: string) =>
      wrapper!.findAll("button.fmt-chip").find((b) => b.text() === label)!;

    // Uppercase (exclusive).
    await wrapper!.find('input[name="uuid-format-case"][aria-label="Uppercase"]').setValue();
    expect(rowText()[0]).toBe("550E8400-E29B-41D4-A716-446655440000");

    // Braces compose with uppercase.
    await chip("{ }").trigger("click");
    expect(rowText()[0]).toBe("{550E8400-E29B-41D4-A716-446655440000}");

    // No-hyphens composes with both.
    await chip("no hyphens").trigger("click");
    expect(rowText()[0]).toBe("{550E8400E29B41D4A716446655440000}");

    // None of that generated again.
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("per-row Copy and Copy all emit the currently-formatted strings (AC12)", async () => {
    invokeMock.mockResolvedValueOnce(["a-b", "c-d"]);
    writeTextMock.mockResolvedValue(undefined);
    mountView();

    await countInput(wrapper!).setValue(2);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    await wrapper!.find('input[name="uuid-format-case"][aria-label="Uppercase"]').setValue();
    await wrapper!
      .findAll("button.fmt-chip")
      .find((b) => b.text() === "no hyphens")!
      .trigger("click");

    await resultRows(wrapper!)[0].find("button.row-copy").trigger("click");
    await flushPromises();
    expect(writeTextMock).toHaveBeenLastCalledWith("AB");

    await clickButton(wrapper!, "Copy all");
    await flushPromises();
    expect(writeTextMock).toHaveBeenLastCalledWith("AB\nCD");
  });

  it("downloads .txt from the format menu: pre-named path, single filter, formatted content (AC14)", async () => {
    invokeMock.mockResolvedValueOnce(["a-b", "c-d"]);
    saveMock.mockResolvedValueOnce("/tmp/uuids.txt");
    mountView();

    await countInput(wrapper!).setValue(2);
    await clickButton(wrapper!, "Generate");
    await flushPromises();
    await wrapper!.find('input[name="uuid-format-case"][aria-label="Uppercase"]').setValue();

    await chooseDownload(wrapper!, "txt");

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: "uuids.txt",
        filters: [{ name: "TXT", extensions: ["txt"] }],
      }),
    );
    expect(invokeMock).toHaveBeenLastCalledWith("uuid_export", {
      content: "A-B\nC-D\n",
      path: "/tmp/uuids.txt",
    });
  });

  it("downloads .csv as an RFC-4180 quoted single column with a header (AC14)", async () => {
    invokeMock.mockResolvedValueOnce(["a-b", "c-d"]);
    saveMock.mockResolvedValueOnce("/tmp/uuids.csv");
    mountView();

    await countInput(wrapper!).setValue(2);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    await chooseDownload(wrapper!, "csv");

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "uuids.csv" }),
    );
    expect(invokeMock).toHaveBeenLastCalledWith("uuid_export", {
      content: 'uuid\r\n"a-b"\r\n"c-d"\r\n',
      path: "/tmp/uuids.csv",
    });
  });

  it("downloads .json as a pretty array of strings (AC14)", async () => {
    invokeMock.mockResolvedValueOnce(["a-b", "c-d"]);
    saveMock.mockResolvedValueOnce("/tmp/out.json");
    mountView();

    await countInput(wrapper!).setValue(2);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    await chooseDownload(wrapper!, "json");

    expect(invokeMock).toHaveBeenLastCalledWith("uuid_export", {
      content: `${JSON.stringify(["a-b", "c-d"], null, 2)}\n`,
      path: "/tmp/out.json",
    });
  });

  it("treats a cancelled save dialog as a no-op, not an error (AC14)", async () => {
    invokeMock.mockResolvedValueOnce(["a-b"]);
    saveMock.mockResolvedValueOnce(null);
    mountView();

    await clickButton(wrapper!, "Generate");
    await flushPromises();
    await chooseDownload(wrapper!, "txt");

    expect(invokeMock).not.toHaveBeenCalledWith("uuid_export", expect.anything());
    expect(wrapper!.find("[role='alert']").exists()).toBe(false);
  });

  it("disables Generate while a generation is in flight and re-enables it after (AC15)", async () => {
    let resolveInvoke: (value: string[]) => void;
    invokeMock.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        resolveInvoke = resolve;
      }),
    );
    mountView();

    const generateButton = () =>
      wrapper!.findAll("button").find((b) => b.text() === "Generate")!;
    expect(generateButton().attributes("disabled")).toBeUndefined();

    await generateButton().trigger("click");
    expect(generateButton().attributes("disabled")).toBeDefined();

    resolveInvoke!(["done"]);
    await flushPromises();
    expect(generateButton().attributes("disabled")).toBeUndefined();
  });

  it("announces the rendered batch via a role=status region (AC15)", async () => {
    invokeMock.mockResolvedValueOnce(["a", "b", "c", "d", "e"]);
    mountView();

    await countInput(wrapper!).setValue(5);
    await clickButton(wrapper!, "Generate");
    await flushPromises();

    const status = wrapper!.find("[role='status']");
    expect(status.exists()).toBe(true);
    expect(status.text()).toContain("5");
  });
});
