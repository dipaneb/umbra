import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import Base64View from "./Base64View.vue";
import { useRegistryStore } from "../../stores/registry";

const { invokeMock, writeTextMock, saveMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  writeTextMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: (text: string) => writeTextMock(text),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (...args: unknown[]) => saveMock(...args),
}));

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

// Story 8.2 slice 2: conversion is now live and debounced
// (src/shell/debounce.ts, 200ms). Fake timers mean a test's pending debounce
// simply never fires unless it explicitly advances the clock — real timers
// would instead leave it dangling into whichever test runs next and let a
// stale invoke response land there. Same pattern as JsonView.spec.ts.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  writeTextMock.mockReset();
  saveMock.mockReset();
  vi.useRealTimers();
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

// Story 8.2 slice 1: Copy is a text-less icon button on the output panel, so
// it can't be found by visible text like the action buttons.
function copyButton(w: VueWrapper) {
  return w.find(".copy-button");
}

// Story 8.2 slice 2: the direction is a segmented control backed by native
// radios; toggling it re-runs the conversion immediately (no debounce wait).
function setDirection(w: VueWrapper, dir: "encode" | "decode") {
  return w.find(`input[name="base64-direction"][value="${dir}"]`).setValue();
}

function urlSafeCheckbox(w: VueWrapper) {
  return w.find('input[type="checkbox"]');
}

function wrapModeSelect(w: VueWrapper) {
  return w.find(".wrap-select select");
}

// Advance past the live-conversion debounce and let the resulting
// promise chain settle.
async function settleConversion() {
  await vi.advanceTimersByTimeAsync(200);
  await flushPromises();
}

// Story 8.2 slice 3: a decode whose bytes aren't text surfaces a detection
// line + "Save as file" offer, never a red alert. Drives the tool there via a
// live `base64_sniff` that identifies an unrecognized blob.
async function reachSaveOffer(w: VueWrapper) {
  invokeMock.mockResolvedValueOnce({ kind: "unknown", byte_len: 4 });
  await setDirection(w, "decode");
  await inputTextarea(w).setValue("//4=");
  await settleConversion();
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
  it("encodes as you type with the standard alphabet by default (AC1, AC7)", async () => {
    invokeMock.mockResolvedValueOnce("aGVsbG8=");
    mountView();

    await inputTextarea(wrapper!).setValue("hello");
    await settleConversion();

    expect(invokeMock).toHaveBeenCalledWith("base64_encode", {
      input: "hello",
      url_safe: false,
      wrap: null,
    });
    expect(outputValue(wrapper!)).toBe("aGVsbG8=");
  });

  it("passes url_safe: true to base64_encode when the URL-safe checkbox is ticked (AC1)", async () => {
    invokeMock.mockResolvedValue("Pj4-");
    mountView();

    await inputTextarea(wrapper!).setValue(">>>");
    await urlSafeCheckbox(wrapper!).setValue(true);
    await settleConversion();

    expect(invokeMock).toHaveBeenCalledWith("base64_encode", {
      input: ">>>",
      url_safe: true,
      wrap: null,
    });
  });

  it("passes the picked wrap width to base64_encode and re-encodes when it changes (AC13)", async () => {
    invokeMock.mockResolvedValue("d3JhcHBlZA==");
    mountView();

    await inputTextarea(wrapper!).setValue("wrapped");
    await settleConversion();
    expect(invokeMock).toHaveBeenLastCalledWith("base64_encode", {
      input: "wrapped",
      url_safe: false,
      wrap: null,
    });

    invokeMock.mockClear();
    await wrapModeSelect(wrapper!).setValue("col64");
    await flushPromises(); // a selector change re-runs immediately, no debounce

    expect(invokeMock).toHaveBeenCalledWith("base64_encode", {
      input: "wrapped",
      url_safe: false,
      wrap: "col64",
    });
  });

  it("shows the wrap selector only in the Encode direction (AC13)", async () => {
    mountView();
    expect(wrapModeSelect(wrapper!).exists()).toBe(true);

    await setDirection(wrapper!, "decode");
    expect(wrapModeSelect(wrapper!).exists()).toBe(false);
  });

  it("keeps a wrapped output out of the data-URI builder string (AC11/AC13)", async () => {
    invokeMock.mockResolvedValue("QUJD\nREVG");
    mountView();

    await inputTextarea(wrapper!).setValue("ABCDEF");
    await wrapModeSelect(wrapper!).setValue("col64");
    await settleConversion();

    await clickButton(wrapper!, "Build a data URI");
    expect((wrapper!.find("#base64-datauri").element as HTMLTextAreaElement).value).toBe(
      "data:application/octet-stream;base64,QUJDREVG",
    );
  });

  it("decodes as you type when the direction is set to Decode, via base64_sniff (AC2, AC7)", async () => {
    invokeMock.mockResolvedValueOnce({ kind: "text", text: "hello" });
    mountView();

    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("aGVsbG8=");
    await settleConversion();

    expect(invokeMock).toHaveBeenCalledWith("base64_sniff", { input: "aGVsbG8=" });
    expect(outputValue(wrapper!)).toBe("hello");
    // Plain text needs no contextual line — the output panel is the answer.
    expect(wrapper!.find(".detection").exists()).toBe(false);
  });

  it("does not convert until the debounce elapses (AC7)", async () => {
    invokeMock.mockResolvedValue("aGVsbG8=");
    mountView();

    await inputTextarea(wrapper!).setValue("hello");
    await flushPromises();
    expect(invokeMock).not.toHaveBeenCalled();

    await settleConversion();
    expect(invokeMock).toHaveBeenCalledWith("base64_encode", { input: "hello", url_safe: false, wrap: null });
  });

  it("re-runs the conversion immediately when the direction switch is toggled (AC7)", async () => {
    invokeMock.mockImplementation((cmd: string) =>
      Promise.resolve(cmd === "base64_sniff" ? { kind: "text", text: "hi" } : "ENCODED"),
    );
    mountView();

    await inputTextarea(wrapper!).setValue("aGk=");
    await settleConversion();
    expect(outputValue(wrapper!)).toBe("ENCODED");

    invokeMock.mockClear();
    await setDirection(wrapper!, "decode");
    await flushPromises(); // note: no timer advance — the switch must not wait out the debounce

    expect(invokeMock).toHaveBeenCalledWith("base64_sniff", { input: "aGk=" });
    expect(outputValue(wrapper!)).toBe("hi");
  });

  it("clears the previous result the moment a new conversion starts, not when it finishes", async () => {
    const pending = deferred<{ kind: string; text: string }>();
    invokeMock.mockResolvedValueOnce("ENCODED").mockReturnValueOnce(pending.promise);
    mountView();

    await inputTextarea(wrapper!).setValue("aGk=");
    await settleConversion();
    expect(outputValue(wrapper!)).toBe("ENCODED");

    await setDirection(wrapper!, "decode");
    await flushPromises(); // sniff is in flight, unresolved

    // The stale Encode result must be gone already — not left sitting there
    // looking like the decode answer.
    expect(outputValue(wrapper!)).toBe("");

    pending.resolve({ kind: "text", text: "hi" });
    await flushPromises();
    expect(outputValue(wrapper!)).toBe("hi");
  });

  it("keeps every conversion on one latest-wins runner so a slow earlier result can't overwrite a newer one (AC7)", async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    invokeMock.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    mountView();

    await inputTextarea(wrapper!).setValue("a");
    await vi.advanceTimersByTimeAsync(200); // fires conversion #1 (slow, still pending)
    await inputTextarea(wrapper!).setValue("ab");
    await vi.advanceTimersByTimeAsync(200); // fires conversion #2 (fast)

    fast.resolve("NEWER");
    await flushPromises();
    expect(outputValue(wrapper!)).toBe("NEWER");

    slow.resolve("STALE");
    await flushPromises();
    expect(outputValue(wrapper!)).toBe("NEWER"); // #1 was superseded and dropped
  });

  it("renders a classified decode error from its code + structured position, not the raw message (AC3, AC15)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-invalid-char",
      message: "raw base64-crate text",
      position: { kind: "ByteOffset", offset: 3 },
      context: null,
    });
    mountView();

    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("bad!base64");
    await settleConversion();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.text()).toContain("Invalid Base64 character"); // translated via errors.*
    expect(alert.text()).not.toContain("raw base64-crate text");
    expect(alert.text()).toContain("(offset 3)"); // offset rides `position`
  });

  it("renders a classified decode error with no position (AC15)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-invalid-length",
      message: "raw",
      position: null,
      context: null,
    });
    mountView();

    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("x");
    await settleConversion();

    expect(wrapper!.find("[role='alert']").text()).toContain("isn't a valid length");
  });

  it("labels the input for the current direction", async () => {
    mountView();

    expect(wrapper!.find("label[for='base64-input']").text()).toBe("Text to encode");

    await setDirection(wrapper!, "decode");
    expect(wrapper!.find("label[for='base64-input']").text()).toBe("Base64 to decode");
  });

  it("copies the current output text to the clipboard via the Copy icon button (AC8)", async () => {
    invokeMock.mockResolvedValueOnce("aGVsbG8=");
    writeTextMock.mockResolvedValueOnce(undefined);
    mountView();

    await inputTextarea(wrapper!).setValue("hello");
    await settleConversion();
    await copyButton(wrapper!).trigger("click");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith("aGVsbG8=");
  });

  it("shows the signature-accent 'copied' confirmation after a successful copy (AC8)", async () => {
    invokeMock.mockResolvedValueOnce("aGVsbG8=");
    writeTextMock.mockResolvedValueOnce(undefined);
    mountView();

    await inputTextarea(wrapper!).setValue("hello");
    await settleConversion();
    expect(copyButton(wrapper!).find(".copy-success").exists()).toBe(false);

    await copyButton(wrapper!).trigger("click");
    await flushPromises();

    expect(copyButton(wrapper!).find(".copy-success").exists()).toBe(true);
  });

  it("disables the Copy icon button while output is empty (AC8)", () => {
    mountView();

    expect(copyButton(wrapper!).attributes("disabled")).toBeDefined();
  });

  it("renders no Paste button — cmd+V into the input is the paste path (AC8)", () => {
    mountView();

    const buttonTexts = wrapper!.findAll("button").map((b) => b.text());
    expect(buttonTexts).not.toContain("Paste from clipboard");
  });

  it("renders Copy as a text-less icon button, not a full-width labelled button (AC8)", () => {
    mountView();

    const copy = copyButton(wrapper!);
    expect(copy.exists()).toBe(true);
    expect(copy.text()).toBe("");
    expect(copy.find("svg").exists()).toBe(true);
    expect(copy.attributes("aria-label")).toBe("Copy to clipboard");
  });

  it("renders as a single enriched view with no tab bar (AC6)", () => {
    mountView();

    expect(wrapper!.find("[role='tablist']").exists()).toBe(false);
    expect(wrapper!.find("[role='tab']").exists()).toBe(false);
  });

  it("drives direction from an Encode/Decode segmented radiogroup, not action buttons (AC6, AC7)", () => {
    mountView();

    expect(wrapper!.find('[role="radiogroup"]').exists()).toBe(true);
    expect(wrapper!.find('input[name="base64-direction"][value="encode"]').exists()).toBe(true);
    expect(wrapper!.find('input[name="base64-direction"][value="decode"]').exists()).toBe(true);

    const buttonTexts = wrapper!.findAll("button").map((b) => b.text());
    expect(buttonTexts).not.toContain("Encode");
    expect(buttonTexts).not.toContain("Decode");
  });

  it("slides a thumb that tracks the active side (AC7 — sliding-thumb motion)", async () => {
    mountView();

    const sw = wrapper!.find(".direction-switch");
    expect(sw.find(".direction-thumb").exists()).toBe(true);
    expect(sw.classes()).not.toContain("is-decode");

    await setDirection(wrapper!, "decode");
    expect(wrapper!.find(".direction-switch").classes()).toContain("is-decode");
  });

  it("shows the URL-safe alphabet checkbox only in the Encode direction (AC6)", async () => {
    mountView();
    expect(urlSafeCheckbox(wrapper!).exists()).toBe(true);

    await setDirection(wrapper!, "decode");
    expect(wrapper!.find('input[type="checkbox"]').exists()).toBe(false);
  });

  it("shows an 'unrecognized' detection line + Save-as-file offer for a blob sniff can't place (AC9, AC10)", async () => {
    mountView();
    await reachSaveOffer(wrapper!);

    expect(wrapper!.find("[role='alert']").exists()).toBe(false);
    const line = wrapper!.find(".detection");
    expect(line.exists()).toBe(true);
    expect(line.text()).toContain("unrecognized");
    expect(wrapper!.findAll("button").some((b) => b.text() === "Save as file")).toBe(true);
  });

  it("replaces the output field with an inline PNG preview, with the type + size in the strip (AC9, AC12)", async () => {
    invokeMock.mockResolvedValueOnce({ kind: "png", byte_len: 2048 });
    mountView();
    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("iVBORw0KGgo=");
    await settleConversion();

    // The empty output textarea is gone entirely.
    expect(wrapper!.find("#base64-output").exists()).toBe(false);

    const img = wrapper!.find(".image-preview img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("data:image/png;base64,iVBORw0KGgo=");

    const strip = wrapper!.find(".image-preview .reveal-strip");
    expect(strip.text()).toContain("PNG");
    expect(strip.text()).toContain("2.0 KB");
    expect(strip.text()).toContain("Save as file");
  });

  it("falls back to the text note when a 'PNG' blob doesn't actually render (AD-9 honesty)", async () => {
    invokeMock.mockResolvedValueOnce({ kind: "png", byte_len: 12 });
    mountView();
    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("bm90YXBuZw==");
    await settleConversion();

    await wrapper!.find(".image-preview img").trigger("error");

    expect(wrapper!.find(".image-preview").exists()).toBe(false);
    expect(wrapper!.find(".detection").text()).toContain("PNG");
    expect(wrapper!.findAll("button").some((b) => b.text() === "Save as file")).toBe(true);
  });

  // --- Data URI (slice 4 / AC11, AC12) ---

  it("decodes a data:image/* URI to an inline preview built from its MIME + payload (AC12)", async () => {
    invokeMock.mockResolvedValueOnce({ mime: "image/png", payload: "iVBORw0KGgo=" });
    mountView();
    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("data:image/png;base64,iVBORw0KGgo=");
    await settleConversion();

    expect(invokeMock).toHaveBeenCalledWith("base64_parse_data_uri", {
      input: "data:image/png;base64,iVBORw0KGgo=",
    });
    expect(wrapper!.find("#base64-output").exists()).toBe(false);
    const img = wrapper!.find(".image-preview img");
    expect(img.attributes("src")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(wrapper!.find(".image-preview .reveal-strip").text()).toContain("image/png");
  });

  it("renders base64-data-uri-malformed as a translated alert (AC12)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-data-uri-malformed",
      message: "raw rust message",
      position: null,
      context: null,
    });
    mountView();
    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("data:not-a-real-uri");
    await settleConversion();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    // Translated via TRANSLATABLE_CODES, not the raw Rust message.
    expect(alert.text()).toContain(";base64,");
    expect(alert.text()).not.toContain("raw rust message");
  });

  it("chains parse → sniff for a non-image data URI and names the save file from the MIME (AC12)", async () => {
    invokeMock
      .mockResolvedValueOnce({ mime: "application/pdf", payload: "JVBERi0=" })
      .mockResolvedValueOnce({ kind: "pdf", byte_len: 4096 });
    mountView();
    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("data:application/pdf;base64,JVBERi0=");
    await settleConversion();

    expect(invokeMock).toHaveBeenNthCalledWith(2, "base64_sniff", { input: "JVBERi0=" });
    expect(wrapper!.find(".detection").text()).toContain("PDF");

    saveMock.mockResolvedValueOnce("/tmp/decoded.pdf");
    invokeMock.mockResolvedValueOnce(undefined);
    await clickButton(wrapper!, "Save as file");
    await flushPromises();

    expect(saveMock).toHaveBeenCalledWith({ defaultPath: "decoded.pdf" });
    // Writes the payload, not the whole data: string.
    expect(invokeMock).toHaveBeenLastCalledWith("base64_decode_to_file", {
      input: "JVBERi0=",
      path: "/tmp/decoded.pdf",
    });
  });

  it("builds a live, copyable data URI from the encoded output + a picked MIME (AC11)", async () => {
    invokeMock.mockResolvedValue("aGk=");
    writeTextMock.mockResolvedValueOnce(undefined);
    mountView();

    await inputTextarea(wrapper!).setValue("hi");
    await settleConversion();

    await clickButton(wrapper!, "Build a data URI");
    await wrapper!.find("#base64-datauri-mime").setValue("image/png");

    expect((wrapper!.find("#base64-datauri").element as HTMLTextAreaElement).value).toBe(
      "data:image/png;base64,aGk=",
    );

    await wrapper!.find(".du-controls .copy-button").trigger("click");
    await flushPromises();
    expect(writeTextMock).toHaveBeenCalledWith("data:image/png;base64,aGk=");
  });

  it("pre-selects the data-URI builder's MIME from a dropped file's extension (AC11)", async () => {
    invokeMock.mockResolvedValue("aGk=");
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = {
      toolId: "base64",
      value: { mode: "encoded", value: "aGk=", mime: "image/png" },
    };
    await flushPromises();
    await clickButton(wrapper!, "Build a data URI");

    expect((wrapper!.find("#base64-datauri-mime").element as HTMLSelectElement).value).toBe("image/png");
  });

  it("shows the JWT segment split by default, framed as an interpretation, collapsible via 'Show raw' (AC10 amended)", async () => {
    invokeMock.mockResolvedValueOnce({
      kind: "jwt",
      header: '{\n  "alg": "HS256"\n}',
      payload: '{\n  "sub": "42"\n}',
    });
    mountView();
    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("a.b.c");
    await settleConversion();

    // Split is visible immediately, under a "Reading as JWT" strip.
    expect(wrapper!.find(".reveal-strip").text()).toContain("Reading as JWT");
    expect((wrapper!.find("#base64-jwt-header").element as HTMLTextAreaElement).value).toContain("HS256");
    expect((wrapper!.find("#base64-jwt-payload").element as HTMLTextAreaElement).value).toContain('"sub": "42"');
    expect(wrapper!.find("#base64-output").exists()).toBe(false);

    // "Show raw" collapses it to the bare line…
    await clickButton(wrapper!, "Show raw");
    expect(wrapper!.find("#base64-jwt-header").exists()).toBe(false);
    expect(wrapper!.find(".detection").text()).toContain("JWT");

    // …and "Read as JWT" brings it back.
    await clickButton(wrapper!, "Read as JWT");
    expect(wrapper!.find("#base64-jwt-header").exists()).toBe(true);
  });

  it("keeps a genuine decode error as an alert, not a detection line (AC9)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-invalid-char",
      message: "Invalid symbol 33, offset 3.",
      position: { kind: "ByteOffset", offset: 3 },
      context: null,
    });
    mountView();

    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("bad!");
    await settleConversion();

    expect(wrapper!.find("[role='alert']").exists()).toBe(true);
    expect(wrapper!.find(".detection").exists()).toBe(false);
  });

  it("clears a live decode error once the input becomes valid again", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "base64-invalid-char",
      message: "bad",
      position: null,
      context: null,
    });
    mountView();

    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("bad!");
    await settleConversion();
    expect(wrapper!.find("[role='alert']").exists()).toBe(true);

    invokeMock.mockResolvedValueOnce({ kind: "text", text: "hello" });
    await inputTextarea(wrapper!).setValue("aGVsbG8=");
    await settleConversion();
    expect(wrapper!.find("[role='alert']").exists()).toBe(false);
    expect(outputValue(wrapper!)).toBe("hello");
  });

  // AD-14: DropZone.vue is the shell's single generic dispatcher and calls
  // `invoke()` itself; Base64View.vue's only job on the drop path is to (a)
  // supply `url_safe` via a registered provider and (b) consume the outcome
  // via `registry.dropResult`. These tests exercise that contract directly
  // rather than going through a real DropZone.vue + Tauri event mock.

  it("registers a drop-args provider reporting url_safe and the current direction (AC1)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    expect(registry.dropArgsProviders.base64?.()).toEqual({
      url_safe: false,
      decode: false,
      wrap: null,
    });

    await setDirection(wrapper!, "decode");
    expect(registry.dropArgsProviders.base64?.()).toEqual({
      url_safe: false,
      decode: true,
      wrap: null,
    });

    await setDirection(wrapper!, "encode");
    await urlSafeCheckbox(wrapper!).setValue(true);
    await wrapModeSelect(wrapper!).setValue("col76");
    expect(registry.dropArgsProviders.base64?.()).toEqual({
      url_safe: true,
      decode: false,
      wrap: "col76",
    });
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

  it("consumes an 'encoded' drop result into output and clears the signal (AC1)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "base64", value: { mode: "encoded", value: "//4AAQ==" } };
    await flushPromises();

    expect(outputValue(wrapper!)).toBe("//4AAQ==");
    expect(registry.dropResult).toBeNull();
  });

  it("clears the now-stale input text when a file is dropped to be encoded", async () => {
    invokeMock.mockResolvedValue("Z2FyYmFnZQ==");
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    await inputTextarea(wrapper!).setValue("data:garbage");
    await settleConversion();

    registry.dropResult = { toolId: "base64", value: { mode: "encoded", value: "//4AAQ==" } };
    await flushPromises();

    // The dropped file is the source now — the old text is gone, and the
    // Base64 result isn't clobbered by a re-encode of the empty box.
    expect((inputTextarea(wrapper!).element as HTMLTextAreaElement).value).toBe("");
    expect(outputValue(wrapper!)).toBe("//4AAQ==");
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

  it("an 'encoded' drop while in Decode flips the switch to Encode and keeps the Base64", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();
    await setDirection(wrapper!, "decode");

    registry.dropResult = { toolId: "base64", value: { mode: "encoded", value: "aVZCT1J3MEs=" } };
    await flushPromises();

    expect(
      (wrapper!.find('input[name="base64-direction"][value="encode"]').element as HTMLInputElement).checked,
    ).toBe(true);
    // The drop result survives the direction flip's re-convert.
    expect(outputValue(wrapper!)).toBe("aVZCT1J3MEs=");
  });

  it("a Base64-text file dropped while Decoding lands in the input and decodes there", async () => {
    invokeMock.mockResolvedValueOnce({ kind: "text", text: "hello" });
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();
    await setDirection(wrapper!, "decode");

    registry.dropResult = { toolId: "base64", value: { mode: "text", value: "aGVsbG8=" } };
    await flushPromises();

    // Stays in Decode; the file's contents are now the input.
    expect(
      (wrapper!.find('input[name="base64-direction"][value="decode"]').element as HTMLInputElement).checked,
    ).toBe(true);
    expect((inputTextarea(wrapper!).element as HTMLTextAreaElement).value).toBe("aGVsbG8=");

    await settleConversion();
    expect(invokeMock).toHaveBeenCalledWith("base64_sniff", { input: "aGVsbG8=" });
    expect(outputValue(wrapper!)).toBe("hello");
  });

  it("a binary file dropped while Decoding shows a notice and does NOT encode it", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();
    await setDirection(wrapper!, "decode");

    registry.dropResult = { toolId: "base64", value: { mode: "not_text" } };
    await flushPromises();

    expect(wrapper!.find(".drop-notice").text()).toContain("isn't Base64 text");
    // Still in Decode, nothing encoded into the output.
    expect(
      (wrapper!.find('input[name="base64-direction"][value="decode"]').element as HTMLInputElement).checked,
    ).toBe(true);
    expect(wrapper!.find("#base64-output").exists()).toBe(true);
    expect(outputValue(wrapper!)).toBe("");
  });

  it("the drop hint text follows the direction", async () => {
    mountView();
    expect(wrapper!.find(".drop-hint").text()).toContain("Base64-encode it");

    await setDirection(wrapper!, "decode");
    expect(wrapper!.find(".drop-hint").text()).toContain("Base64 text to decode it");
  });

  // "Save as file" reuses the existing decode-to-file save flow (AC14),
  // reached only through the non-text offer. The pending live-decode debounce
  // is left unadvanced so `base64_decode_to_file` is the only `invoke` after
  // the one that produced the offer.

  it("writes the decoded bytes to a chosen file via the save dialog (AC14)", async () => {
    mountView();
    await reachSaveOffer(wrapper!);

    saveMock.mockResolvedValueOnce("/tmp/decoded.bin");
    invokeMock.mockResolvedValueOnce(undefined);
    await clickButton(wrapper!, "Save as file");
    await flushPromises();

    // Pre-fills a sensible name so the OS dialog isn't a nameless "Untitled".
    expect(saveMock).toHaveBeenCalledWith({ defaultPath: "decoded.bin" });
    expect(invokeMock).toHaveBeenLastCalledWith("base64_decode_to_file", {
      input: "//4=",
      path: "/tmp/decoded.bin",
    });
  });

  it("names the save file after the identified type (AC10)", async () => {
    invokeMock.mockResolvedValueOnce({ kind: "png", byte_len: 8 });
    mountView();
    await setDirection(wrapper!, "decode");
    await inputTextarea(wrapper!).setValue("iVBORw0K");
    await settleConversion();

    saveMock.mockResolvedValueOnce("/tmp/decoded.png");
    invokeMock.mockResolvedValueOnce(undefined);
    await clickButton(wrapper!, "Save as file");
    await flushPromises();

    expect(saveMock).toHaveBeenCalledWith({ defaultPath: "decoded.png" });
  });

  it("does nothing when the save dialog is cancelled", async () => {
    mountView();
    await reachSaveOffer(wrapper!);
    invokeMock.mockClear();

    saveMock.mockResolvedValueOnce(null);
    await clickButton(wrapper!, "Save as file");
    await flushPromises();

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("surfaces a ToolError when the file write fails", async () => {
    mountView();
    await reachSaveOffer(wrapper!);

    saveMock.mockResolvedValueOnce("/tmp/decoded.bin");
    invokeMock.mockRejectedValueOnce({
      code: "base64-internal",
      message: "write failed",
      position: null,
      context: null,
    });
    await clickButton(wrapper!, "Save as file");
    await flushPromises();

    expect(wrapper!.find("[role='alert']").text()).toContain("write failed");
  });

  it("surfaces a ToolError when the save dialog itself rejects", async () => {
    mountView();
    await reachSaveOffer(wrapper!);
    invokeMock.mockClear();

    saveMock.mockRejectedValueOnce(new Error("dialog unavailable"));
    await clickButton(wrapper!, "Save as file");
    await flushPromises();

    expect(wrapper!.find("[role='alert']").text()).toContain("dialog unavailable");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("disables the save action while a save is pending", async () => {
    mountView();
    await reachSaveOffer(wrapper!);

    const pendingSave = deferred<string | null>();
    saveMock.mockReturnValueOnce(pendingSave.promise);
    const clickPromise = clickButton(wrapper!, "Save as file");
    await flushPromises();

    expect(
      wrapper!.findAll("button").find((b) => b.text() === "Save as file")?.attributes("disabled"),
    ).toBeDefined();

    pendingSave.resolve(null);
    await clickPromise;
    await flushPromises();

    expect(
      wrapper!.findAll("button").find((b) => b.text() === "Save as file")?.attributes("disabled"),
    ).toBeUndefined();
  });
});
