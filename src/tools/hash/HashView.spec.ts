import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import HashView from "./HashView.vue";
import { useRegistryStore } from "../../stores/registry";
import { useSettingsStore } from "../../stores/settings";

const { invokeMock, writeTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: (text: string) => writeTextMock(text),
}));

// Canonical NIST / hashlib vectors for "abc".
const HEX: Record<string, string> = {
  sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  sha512:
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  "sha3-256": "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532",
  "sha3-512":
    "b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0",
  md5: "900150983cd24fb0d6963f7d28e17f72",
  sha1: "a9993e364706816aba3e25717850c26c9cd0d89d",
};

function digestEntries(...algorithms: string[]) {
  return algorithms.map((algorithm) => ({ algorithm, hex: HEX[algorithm] }));
}

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

// Hashing is live and debounced (src/shell/debounce.ts, 200ms). Fake timers
// mean a pending debounce never fires unless a test advances the clock — real
// timers would leave one dangling into the next test. Same pattern as
// Base64View.spec.ts / JsonView.spec.ts.
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

function mountView() {
  pinia = createPinia();
  wrapper = mount(HashView, { global: { plugins: [pinia] } });
  return wrapper;
}

function resultRows(w: VueWrapper) {
  return w.findAll(".results li");
}

function algoCheckbox(w: VueWrapper, name: string) {
  const wrapperLabel = w
    .findAll("label.algo-check")
    .find((l) => l.find(".algo-name").text() === name);
  if (!wrapperLabel) throw new Error(`algorithm checkbox not found: ${name}`);
  return wrapperLabel.find("input[type='checkbox']");
}

function caseRadio(w: VueWrapper, mode: "lower" | "upper") {
  return w.find(`input[aria-label="${mode === "lower" ? "lowercase" : "UPPERCASE"}"]`);
}

function encodingRadio(w: VueWrapper, enc: "Hex" | "Base64") {
  const label = w.findAll(".segmented label").find((l) => l.text() === enc);
  if (!label) throw new Error(`encoding option not found: ${enc}`);
  return label.find("input");
}

// Reference base64 of a digest's raw bytes — what the view's hex→bytes→btoa
// path must produce, computed here independently.
function b64(hex: string): string {
  const bytes = hex.match(/../g)!.map((h) => parseInt(h, 16));
  return btoa(String.fromCharCode(...bytes));
}

function setInput(w: VueWrapper, text: string) {
  return w.find("#hash-input").setValue(text);
}

// Advance past the live-hash debounce and let the resulting promise chain
// settle.
async function settle() {
  await vi.advanceTimersByTimeAsync(200);
  await flushPromises();
}

// Type `text` and let the debounced hash run, resolving `invoke` once with
// `entries` (defaults to the default selection's two digests).
async function hashInput(
  w: VueWrapper,
  text = "abc",
  entries = digestEntries("sha256", "sha512"),
) {
  invokeMock.mockResolvedValueOnce(entries);
  await setInput(w, text);
  await settle();
}

// Simulate a file drop the way DropZone.vue delivers it: the path on
// `dropSourcePath`, the digests on `dropResult`.
async function dropFile(
  path = "/tmp/report.pdf",
  entries = digestEntries("sha256", "sha512"),
) {
  const registry = useRegistryStore(pinia);
  registry.dropSourcePath = { toolId: "hash", path };
  registry.dropResult = { toolId: "hash", value: entries };
  await flushPromises();
}

describe("HashView", () => {
  it("checks SHA-256 and SHA-512 by default and nothing else (AC7)", () => {
    mountView();
    const checked = (label: string) =>
      (algoCheckbox(wrapper!, label).element as HTMLInputElement).checked;

    expect(checked("SHA-256")).toBe(true);
    expect(checked("SHA-512")).toBe(true);
    expect(checked("SHA3-256")).toBe(false);
    expect(checked("SHA3-512")).toBe(false);
    expect(checked("MD5")).toBe(false);
    expect(checked("SHA-1")).toBe(false);
  });

  it("hashes as you type, debounced, over exactly the checked algorithms (AC8/AC10)", async () => {
    mountView();
    await hashInput(wrapper!);

    expect(invokeMock).toHaveBeenCalledWith("hash_compute", {
      input: "abc",
      algorithms: ["sha256", "sha512"],
    });
    const rows = resultRows(wrapper!);
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain(HEX.sha256);
    expect(rows[1].text()).toContain(HEX.sha512);
  });

  it("does not hash until the debounce elapses (AC10)", async () => {
    mountView();
    invokeMock.mockResolvedValueOnce(digestEntries("sha256", "sha512"));

    await setInput(wrapper!, "abc");
    await flushPromises(); // no timer advance
    expect(invokeMock).not.toHaveBeenCalled();

    await settle();
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("re-runs immediately — no debounce wait — when an algorithm box is toggled (AC10)", async () => {
    mountView();
    await hashInput(wrapper!);
    expect(resultRows(wrapper!)).toHaveLength(2);

    invokeMock.mockResolvedValueOnce(digestEntries("sha256", "sha512", "sha3-256"));
    await algoCheckbox(wrapper!, "SHA3-256").trigger("change");
    await flushPromises(); // note: no timer advance

    expect(invokeMock).toHaveBeenLastCalledWith("hash_compute", {
      input: "abc",
      algorithms: ["sha256", "sha512", "sha3-256"],
    });
    expect(resultRows(wrapper!)).toHaveLength(3);
  });

  it("persists an algorithm-set change to the hash.* setting (AC7/AC9)", async () => {
    mountView();
    const settings = useSettingsStore(pinia);

    await algoCheckbox(wrapper!, "SHA3-256").trigger("change");
    await flushPromises();
    expect(settings.hashAlgorithms).toContain("sha3-256");

    await algoCheckbox(wrapper!, "SHA-512").trigger("change");
    await flushPromises();
    expect(settings.hashAlgorithms).not.toContain("sha512");
  });

  it("clears the results when the input is emptied", async () => {
    mountView();
    await hashInput(wrapper!);
    expect(resultRows(wrapper!)).toHaveLength(2);

    await setInput(wrapper!, "");
    await settle();

    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("a slower in-flight hash resolving late does not overwrite the input being cleared (AD-16)", async () => {
    mountView();
    let resolveInvoke!: (value: unknown) => void;
    invokeMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInvoke = resolve;
      }),
    );

    // A hash for "abc" starts and is still in flight (hashing.value is true).
    await setInput(wrapper!, "abc");
    await settle();

    // The user clears the input before that hash resolves. Previously this
    // set digests.value = [] directly, bypassing the latest-wins runner, so
    // the still-in-flight "abc" result could resolve afterward and silently
    // overwrite the correctly-cleared display (code review, Story 8.4).
    await setInput(wrapper!, "");
    await vi.advanceTimersByTimeAsync(200);
    await flushPromises();

    resolveInvoke(digestEntries("sha256", "sha512"));
    await flushPromises();
    await flushPromises();

    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("makes no request and shows no rows when every algorithm is unchecked", async () => {
    mountView();
    await algoCheckbox(wrapper!, "SHA-256").trigger("change");
    await algoCheckbox(wrapper!, "SHA-512").trigger("change");
    await flushPromises();

    await setInput(wrapper!, "abc");
    await settle();

    expect(invokeMock).not.toHaveBeenCalled();
    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("flags MD5 and SHA-1 with a help affordance on the legend and on their rows, not SHA-256 (AC13)", async () => {
    mountView();
    expect(wrapper!.find(".algo-field legend .help-dot").exists()).toBe(true);

    await algoCheckbox(wrapper!, "MD5").trigger("change");
    await algoCheckbox(wrapper!, "SHA-1").trigger("change");
    await flushPromises();
    await hashInput(wrapper!, "abc", digestEntries("sha256", "sha512", "md5", "sha1"));

    const rows = resultRows(wrapper!);
    expect(rows[0].find(".row-algo .help-dot").exists()).toBe(false);
    expect(rows[2].find(".row-algo .help-dot").exists()).toBe(true);
    expect(rows[3].find(".row-algo .help-dot").exists()).toBe(true);
    // The old inline wording is gone.
    expect(wrapper!.text()).not.toContain("legacy");
  });

  it("opens the not-collision-resistant explainer from the legend help dot (AC13)", async () => {
    mountView();

    await wrapper!.find(".algo-field legend .help-dot").trigger("click");
    await flushPromises();

    const dialog = wrapper!.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain("collision");
  });

  it("toggling case re-renders the same digests without a second invoke call (AC2/AC11)", async () => {
    mountView();
    await hashInput(wrapper!);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    await caseRadio(wrapper!, "upper").setValue();
    await flushPromises();

    expect(resultRows(wrapper!)[0].find("code").text()).toBe(HEX.sha256.toUpperCase());
    expect(invokeMock).toHaveBeenCalledTimes(1);

    await caseRadio(wrapper!, "lower").setValue();
    await flushPromises();

    expect(resultRows(wrapper!)[0].find("code").text()).toBe(HEX.sha256);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("renders Base64 of the raw digest bytes when Encoding is switched, no new invoke (AC11)", async () => {
    mountView();
    await hashInput(wrapper!);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    await encodingRadio(wrapper!, "Base64").setValue();
    await flushPromises();

    expect(resultRows(wrapper!)[0].find("code").text()).toBe(b64(HEX.sha256));
    expect(resultRows(wrapper!)[1].find("code").text()).toBe(b64(HEX.sha512));
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("persists case and encoding as hash.* settings (AC11)", async () => {
    mountView();
    const settings = useSettingsStore(pinia);

    await caseRadio(wrapper!, "upper").setValue();
    await encodingRadio(wrapper!, "Base64").setValue();
    await flushPromises();

    expect(settings.hashCase).toBe("upper");
    expect(settings.hashEncoding).toBe("base64");
  });

  it("per-row Copy copies that row's currently-displayed (case- and encoding-respecting) string (AC12)", async () => {
    writeTextMock.mockResolvedValue(undefined);
    mountView();
    await hashInput(wrapper!);

    await caseRadio(wrapper!, "upper").setValue();
    await flushPromises();
    await resultRows(wrapper!)[0].find("button").trigger("click");
    await flushPromises();
    expect(writeTextMock).toHaveBeenLastCalledWith(HEX.sha256.toUpperCase());

    await encodingRadio(wrapper!, "Base64").setValue();
    await flushPromises();
    await resultRows(wrapper!)[0].find("button").trigger("click");
    await flushPromises();
    expect(writeTextMock).toHaveBeenLastCalledWith(b64(HEX.sha256));
  });

  it("announces a completed hash in a polite live region (AC14)", async () => {
    mountView();
    await hashInput(wrapper!);

    const region = wrapper!.find('.sr-only[role="status"]');
    expect(region.exists()).toBe(true);
    expect(region.text()).toContain("Text input");
  });

  it("rejects an over-ceiling paste inline without calling the backend (AC10/AC19)", async () => {
    mountView();

    await setInput(wrapper!, "a".repeat(100 * 1024 * 1024 + 1));
    await settle();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("exceeds");
    expect(invokeMock).not.toHaveBeenCalled();
    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("renders a rejected hash-input-too-large error from the backend inline (AC19)", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "hash-input-too-large",
      message: "input is 104857601 bytes, which exceeds the 104857600-byte limit",
      position: null,
      context: null,
    });
    mountView();

    await setInput(wrapper!, "huge");
    await settle();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("exceeds the 104857600-byte limit");
    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  // AD-14: DropZone.vue is the shell's single generic dispatcher and calls
  // `invoke()` itself; HashView.vue's job on the drop path is to supply the
  // algorithm list via a dropArgsProvider and consume the outcome via
  // `registry.dropResult`. These tests exercise that contract directly.

  it("registers a dropArgsProvider carrying the selected algorithms while mounted (AC15)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);

    expect(registry.dropArgsProviders.hash?.()).toEqual({
      algorithms: ["sha256", "sha512"],
    });

    await algoCheckbox(wrapper!, "MD5").trigger("change");
    await flushPromises();
    expect(registry.dropArgsProviders.hash?.()).toEqual({
      algorithms: ["sha256", "sha512", "md5"],
    });

    wrapper!.unmount();
    wrapper = undefined;
    expect(registry.dropArgsProviders.hash).toBeUndefined();
  });

  it("consumes a successful drop result into digest rows and clears the signal (AC15)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    await dropFile("/tmp/report.pdf", digestEntries("sha256", "sha512"));

    const rows = resultRows(wrapper!);
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain(HEX.sha256);
    expect(registry.dropResult).toBeNull();
  });

  it("names the dropped file as the digest source (AC14)", async () => {
    mountView();
    await flushPromises();

    await dropFile("/tmp/photos/holiday.jpg", digestEntries("sha256", "sha512"));

    expect(wrapper!.find(".results-source").text()).toBe("holiday.jpg");
  });

  it("clears the text box on a drop without wiping the dropped digests (AC14)", async () => {
    mountView();
    await hashInput(wrapper!); // text "abc" hashed, source label "Text input"
    expect(wrapper!.find(".results-source").text()).toBe("Text input");
    invokeMock.mockClear();

    await dropFile("/tmp/a.bin", digestEntries("sha256", "sha512", "md5"));
    await settle(); // let the input-clear watcher run through

    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe("");
    expect(resultRows(wrapper!)).toHaveLength(3);
    expect(wrapper!.find(".results-source").text()).toBe("a.bin");
    // The cleared box must not have triggered a text hash.
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("re-hashes the dropped file — not the empty text box — when the algorithm set changes (AC15)", async () => {
    mountView();
    await flushPromises();
    await dropFile("/tmp/a.bin", digestEntries("sha256", "sha512"));
    expect(resultRows(wrapper!)).toHaveLength(2);
    invokeMock.mockClear();

    invokeMock.mockResolvedValueOnce(digestEntries("sha256", "sha512", "md5"));
    await algoCheckbox(wrapper!, "MD5").trigger("change");
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith("hash_compute_file", {
      path: "/tmp/a.bin",
      algorithms: ["sha256", "sha512", "md5"],
    });
    expect(resultRows(wrapper!)).toHaveLength(3);
    expect(wrapper!.find(".results-source").text()).toBe("a.bin");
  });

  it("flips the source back to the text box on the next edit", async () => {
    mountView();
    await flushPromises();
    await dropFile("/tmp/a.bin", digestEntries("sha256", "sha512"));
    expect(wrapper!.find(".results-source").text()).toBe("a.bin");

    await hashInput(wrapper!, "xyz");
    expect(wrapper!.find(".results-source").text()).toBe("Text input");
  });

  it("ignores a drop result routed to a different tool", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();

    registry.dropResult = { toolId: "base64", value: "irrelevant" };
    await flushPromises();

    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("renders a file-read ToolError from a failed drop result and clears any prior digests (AC3)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await hashInput(wrapper!);
    expect(resultRows(wrapper!)).toHaveLength(2);

    registry.dropResult = {
      toolId: "hash",
      error: {
        code: "file-read-error",
        message: "/tmp/missing.bin: No such file or directory (os error 2)",
        position: null,
        context: null,
      },
    };
    await flushPromises();

    expect(wrapper!.find("[role='alert']").text()).toContain("No such file or directory");
    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("cancels a pending live hash so a drop result is not clobbered by a late debounce (AC15)", async () => {
    mountView();
    const registry = useRegistryStore(pinia);

    // A keystroke schedules a debounced hash…
    invokeMock.mockResolvedValue(digestEntries("sha256"));
    await setInput(wrapper!, "abc");
    // …then a drop lands before the 200ms elapses.
    registry.dropResult = { toolId: "hash", value: digestEntries("sha256", "sha512", "md5") };
    await flushPromises();
    await settle();

    // The drop's three rows stand; the cancelled keystroke hash never ran.
    expect(invokeMock).not.toHaveBeenCalled();
    expect(resultRows(wrapper!)).toHaveLength(3);
  });

  // --- Verify panel (AC16) ---

  it("keeps the verify field present even with no results (persistent panel)", () => {
    mountView();
    expect(wrapper!.find("#hash-verify").exists()).toBe(true);
  });

  it("shows no verify indicators or summary while the verify field is empty", async () => {
    mountView();
    await hashInput(wrapper!);

    expect(wrapper!.find(".verify-indicator").exists()).toBe(false);
    expect(wrapper!.find(".verify-summary").exists()).toBe(false);
  });

  it("marks the matching algorithm, flags the rest, and states a role=status summary", async () => {
    mountView();
    await hashInput(wrapper!, "abc", digestEntries("sha256", "sha512"));

    await wrapper!.find("#hash-verify").setValue(HEX.sha256);
    await flushPromises();

    const rows = resultRows(wrapper!);
    expect(rows[0].find(".verify-indicator.match").exists()).toBe(true);
    expect(rows[1].find(".verify-indicator.mismatch").exists()).toBe(true);

    const summary = wrapper!.find(".verify-summary");
    expect(summary.attributes("role")).toBe("status");
    expect(summary.text()).toContain("SHA-256");
  });

  it("checks the pasted value against every selected algorithm — no length-based guess", async () => {
    mountView();
    await algoCheckbox(wrapper!, "SHA3-256").trigger("change");
    await flushPromises();
    await hashInput(wrapper!, "abc", digestEntries("sha256", "sha512", "sha3-256"));

    // 64 hex chars fits both SHA-256 and SHA3-256; only the real SHA3-256
    // digest matches its row, and SHA-256's row is flagged.
    await wrapper!.find("#hash-verify").setValue(HEX["sha3-256"]);
    await flushPromises();

    const rows = resultRows(wrapper!);
    expect(rows[0].find(".verify-indicator.mismatch").exists()).toBe(true);
    expect(rows[2].find(".verify-indicator.match").exists()).toBe(true);
  });

  it("matches a pasted digest case-insensitively and in Base64 form", async () => {
    mountView();
    await hashInput(wrapper!, "abc", digestEntries("sha256", "sha512"));

    await wrapper!.find("#hash-verify").setValue(HEX.sha256.toUpperCase());
    await flushPromises();
    expect(resultRows(wrapper!)[0].find(".verify-indicator.match").exists()).toBe(true);

    await wrapper!.find("#hash-verify").setValue(b64(HEX.sha256));
    await flushPromises();
    expect(resultRows(wrapper!)[0].find(".verify-indicator.match").exists()).toBe(true);
  });

  it("states a calm no-match summary — never role=alert — when nothing matches", async () => {
    mountView();
    await hashInput(wrapper!, "abc", digestEntries("sha256", "sha512"));

    await wrapper!.find("#hash-verify").setValue("deadbeef");
    await flushPromises();

    const summary = wrapper!.find(".verify-summary");
    expect(summary.exists()).toBe(true);
    expect(summary.attributes("role")).toBe("status");
    expect(wrapper!.findAll('[role="alert"]')).toHaveLength(0);
    expect(resultRows(wrapper!)[0].find(".verify-indicator.mismatch").exists()).toBe(true);
  });

  // --- Smart paste-detection (AC17) ---

  function offerButton(w: VueWrapper) {
    return w.find(".field-hd .to-verify-btn");
  }
  function undoButton(w: VueWrapper) {
    return w.find(".verify-panel .moved-into .offer-action");
  }

  it("offers to move a bare recognised-length hex string to Verify, naming the algorithms in the label", async () => {
    mountView();
    await setInput(wrapper!, HEX.sha256); // 64 hex chars
    await flushPromises();

    const btn = offerButton(wrapper!);
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("aria-label")).toContain("SHA-256 / SHA3-256");
  });

  it("shows no offer for non-hex content or an unrecognised length", async () => {
    mountView();

    await setInput(wrapper!, "not a hash at all");
    await flushPromises();
    expect(offerButton(wrapper!).exists()).toBe(false);

    await setInput(wrapper!, "abcdef12"); // 8 hex chars — not a digest length
    await flushPromises();
    expect(offerButton(wrapper!).exists()).toBe(false);
  });

  it("offers to move a bare Base64-encoded SHA-256 digest to Verify, naming the algorithms in the label", async () => {
    mountView();
    await setInput(wrapper!, b64(HEX.sha256)); // 44-char Base64, decodes to 32 bytes
    await flushPromises();

    const btn = offerButton(wrapper!);
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("aria-label")).toContain("SHA-256 / SHA3-256");
  });

  it("offers to move a bare Base64-encoded MD5 digest to Verify, naming the algorithm in the label", async () => {
    mountView();
    await setInput(wrapper!, b64(HEX.md5)); // 24-char Base64, decodes to 16 bytes
    await flushPromises();

    const btn = offerButton(wrapper!);
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("aria-label")).toContain("MD5");
  });

  it("still detects a hex-charset digest as hex, not Base64, at a valid hex length (regression guard)", async () => {
    mountView();
    await setInput(wrapper!, HEX.sha256); // 64 lowercase hex chars — a hex-charset string
    await flushPromises();

    const btn = offerButton(wrapper!);
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("aria-label")).toContain("SHA-256 / SHA3-256");
    // Exactly one offer — never a dual/ambiguous hex-or-Base64 state.
    expect(wrapper!.findAll(".field-hd .to-verify-btn")).toHaveLength(1);
  });

  it("shows no offer for a base64url-charset string, even at a plausible digest length", async () => {
    mountView();
    // Same length as a real Base64 SHA-256 digest, but with a base64url-only
    // character (`-`) swapped in — must never trigger an offer.
    const base64url = `${b64(HEX.sha256).slice(0, -1)}-`;
    await setInput(wrapper!, base64url);
    await flushPromises();

    expect(offerButton(wrapper!).exists()).toBe(false);
  });

  it("shows no offer for a Base64 string that decodes to a non-digest byte length", async () => {
    mountView();
    await setInput(wrapper!, "YWJj"); // Base64 of "abc" — decodes to 3 bytes
    await flushPromises();

    expect(offerButton(wrapper!).exists()).toBe(false);
  });

  it("moves a detected Base64 digest to Verify unchanged on accept, clears the input, and hides the button", async () => {
    mountView();
    const value = b64(HEX.sha256);
    await setInput(wrapper!, value);
    await flushPromises();

    await offerButton(wrapper!).trigger("click");
    await flushPromises();

    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe(value);
    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe("");
    expect(offerButton(wrapper!).exists()).toBe(false);
  });

  it("never moves anything without the click (AD-9)", async () => {
    invokeMock.mockResolvedValue(digestEntries("sha256", "sha512"));
    mountView();
    await setInput(wrapper!, HEX.md5); // 32 hex chars
    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe("");
    expect(offerButton(wrapper!).exists()).toBe(true);
  });

  it("the offer clears itself once the input is no longer a bare digest", async () => {
    mountView();
    await setInput(wrapper!, HEX.sha1);
    await flushPromises();
    expect(offerButton(wrapper!).exists()).toBe(true);

    await setInput(wrapper!, `${HEX.sha1}x`); // trailing non-hex char
    await flushPromises();
    expect(offerButton(wrapper!).exists()).toBe(false);
  });

  it("moves the digest to Verify on accept, clears the input, and acknowledges below the field in two beats", async () => {
    mountView();
    await setInput(wrapper!, HEX.sha256);
    await flushPromises();

    await offerButton(wrapper!).trigger("click");
    await flushPromises();

    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe(HEX.sha256);
    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe("");
    expect(offerButton(wrapper!).exists()).toBe(false);
    // Nothing near the input.
    expect(wrapper!.find(".moved-note").exists()).toBe(false);
    // The acknowledgement + Undo sit below the Verify field, in the tint.
    expect(wrapper!.find(".verify-panel.just-moved").exists()).toBe(true);
    expect(wrapper!.find(".moved-into").exists()).toBe(true);
    expect(undoButton(wrapper!).exists()).toBe(true);

    // Beat 1: at ~3s the tint fades, but the caption + Undo linger.
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();
    expect(wrapper!.find(".verify-panel.just-moved").exists()).toBe(false);
    expect(wrapper!.find(".moved-into").exists()).toBe(true);

    // Beat 2: ~2s later the caption + Undo go too.
    await vi.advanceTimersByTimeAsync(2000);
    await flushPromises();
    expect(wrapper!.find(".moved-into").exists()).toBe(false);
  });

  it("Undo clears the Verify field and returns the digest to the input", async () => {
    mountView();
    await setInput(wrapper!, HEX.sha256);
    await flushPromises();
    await offerButton(wrapper!).trigger("click");
    await flushPromises();
    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe(HEX.sha256);

    await undoButton(wrapper!).trigger("click");
    await flushPromises();

    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe("");
    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe(HEX.sha256);
    expect(offerButton(wrapper!).exists()).toBe(true);
  });

  // --- Move/Undo overwrite confirmation (code review, Story 8.4) ---

  function overwriteConfirm(w: VueWrapper) {
    return w.find(".overwrite-confirm");
  }
  function overwriteAccept(w: VueWrapper) {
    return overwriteConfirm(w).findAll(".offer-action")[0];
  }
  function overwriteCancel(w: VueWrapper) {
    return overwriteConfirm(w).findAll(".offer-action")[1];
  }

  it("does not move without confirmation when Verify already holds content, and Undo still leaves Verify empty after", async () => {
    mountView();
    await wrapper!.find("#hash-verify").setValue(HEX.md5);
    await setInput(wrapper!, HEX.sha512);
    await flushPromises();

    await offerButton(wrapper!).trigger("click");
    await flushPromises();
    // Not moved yet — Verify still holds the earlier, unrelated value.
    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe(HEX.md5);
    expect(overwriteConfirm(wrapper!).exists()).toBe(true);

    await overwriteAccept(wrapper!).trigger("click");
    await flushPromises();

    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe(HEX.sha512);
    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe("");
    expect(overwriteConfirm(wrapper!).exists()).toBe(false);

    await undoButton(wrapper!).trigger("click");
    await flushPromises();

    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe(HEX.sha512);
    // Undo restores the input, but never the earlier Verify content.
    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe("");
  });

  it("cancelling the move-overwrite confirmation leaves both fields untouched", async () => {
    mountView();
    await wrapper!.find("#hash-verify").setValue(HEX.md5);
    await setInput(wrapper!, HEX.sha512);
    await flushPromises();

    await offerButton(wrapper!).trigger("click");
    await flushPromises();
    await overwriteCancel(wrapper!).trigger("click");
    await flushPromises();

    expect(overwriteConfirm(wrapper!).exists()).toBe(false);
    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe(HEX.md5);
    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe(HEX.sha512);
  });

  it("does not undo without confirmation when the input has changed since the move", async () => {
    mountView();
    await setInput(wrapper!, HEX.sha256);
    await flushPromises();
    await offerButton(wrapper!).trigger("click");
    await flushPromises();
    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe("");

    await setInput(wrapper!, "something new");
    await flushPromises();

    await undoButton(wrapper!).trigger("click");
    await flushPromises();
    // Not undone yet — the newly typed input stands.
    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe("something new");
    expect(overwriteConfirm(wrapper!).exists()).toBe(true);

    await overwriteAccept(wrapper!).trigger("click");
    await flushPromises();

    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe(HEX.sha256);
    expect((wrapper!.find("#hash-verify").element as HTMLInputElement).value).toBe("");
  });

  // --- In-flight disabled state (AC10) ---

  it("disables the algorithm/case/encoding controls, but not the text input, while a hash is in flight", async () => {
    mountView();
    let resolveInvoke!: (value: unknown) => void;
    invokeMock.mockReturnValueOnce(new Promise((resolve) => { resolveInvoke = resolve; }));

    await setInput(wrapper!, "abc");
    await settle();

    expect((algoCheckbox(wrapper!, "SHA-256").element as HTMLInputElement).disabled).toBe(true);
    // The text input stays interactive — the user must always be able to
    // keep typing or clear the box; the coalescing runner (AC10) absorbs
    // whatever they do meanwhile, rather than blocking them.
    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).disabled).toBe(false);

    resolveInvoke(digestEntries("sha256", "sha512"));
    await flushPromises();

    expect((algoCheckbox(wrapper!, "SHA-256").element as HTMLInputElement).disabled).toBe(false);
  });

  // --- AC11: Case is inert (and disabled) while Base64 encoding is active ---

  it("disables the Case control while Base64 encoding is selected", async () => {
    mountView();
    expect((caseRadio(wrapper!, "upper").element as HTMLInputElement).disabled).toBe(false);

    await encodingRadio(wrapper!, "Base64").setValue();
    await flushPromises();

    expect((caseRadio(wrapper!, "upper").element as HTMLInputElement).disabled).toBe(true);

    await encodingRadio(wrapper!, "Hex").setValue();
    await flushPromises();

    expect((caseRadio(wrapper!, "upper").element as HTMLInputElement).disabled).toBe(false);
  });

  // --- All-unchecked hint ---

  it("shows an explanatory hint, not a blank area, when every algorithm is unchecked", async () => {
    mountView();
    await algoCheckbox(wrapper!, "SHA-256").trigger("change");
    await algoCheckbox(wrapper!, "SHA-512").trigger("change");
    await flushPromises();

    await setInput(wrapper!, "abc");
    await settle();

    expect(wrapper!.find(".no-algo-hint").exists()).toBe(true);
  });

  // --- WeakHashPopover: distinct accessible names per row (a11y) ---

  it("gives the legend and each weak row's help popover a distinct accessible name", async () => {
    mountView();
    await algoCheckbox(wrapper!, "MD5").trigger("change");
    await algoCheckbox(wrapper!, "SHA-1").trigger("change");
    await flushPromises();
    await hashInput(wrapper!, "abc", digestEntries("sha256", "sha512", "md5", "sha1"));

    const legendLabel = wrapper!.find(".algo-field legend .help-dot").attributes("aria-label");
    const rowLabels = resultRows(wrapper!)
      .map((r) => r.find(".help-dot"))
      .filter((d) => d.exists())
      .map((d) => d.attributes("aria-label"));

    expect(rowLabels).toHaveLength(2);
    expect(rowLabels[0]).not.toBe(rowLabels[1]);
    expect(rowLabels).not.toContain(legendLabel);
  });

  // --- Paste-detection hints only name selectable algorithms ---

  it("shows no offer for a length only an unselectable algorithm produces (SHA-224/384)", async () => {
    mountView();
    await setInput(wrapper!, "a".repeat(56)); // SHA-224/SHA3-224 hex length
    await flushPromises();
    expect(offerButton(wrapper!).exists()).toBe(false);

    await setInput(wrapper!, "a".repeat(96)); // SHA-384/SHA3-384 hex length
    await flushPromises();
    expect(offerButton(wrapper!).exists()).toBe(false);
  });

  // --- Verify: tolerant matching (code review, Story 8.4) ---

  it("matches a Base64 digest pasted without its padding", async () => {
    mountView();
    await hashInput(wrapper!, "abc", digestEntries("sha256"));

    const unpadded = b64(HEX.sha256).replace(/=+$/, "");
    await wrapper!.find("#hash-verify").setValue(unpadded);
    await flushPromises();

    expect(resultRows(wrapper!)[0].find(".verify-indicator.match").exists()).toBe(true);
  });

  it("matches a copied sha256sum-style line, ignoring the trailing filename", async () => {
    mountView();
    await hashInput(wrapper!, "abc", digestEntries("sha256"));

    await wrapper!.find("#hash-verify").setValue(`${HEX.sha256}  report.txt`);
    await flushPromises();

    expect(resultRows(wrapper!)[0].find(".verify-indicator.match").exists()).toBe(true);
  });

  it("names both matches and non-matches in the summary on a partial match (AC16)", async () => {
    mountView();
    await hashInput(wrapper!, "abc", digestEntries("sha256", "sha512"));

    await wrapper!.find("#hash-verify").setValue(HEX.sha256);
    await flushPromises();

    const summary = wrapper!.find(".verify-summary").text();
    expect(summary).toContain("SHA-256");
    expect(summary).toContain("SHA-512");
  });

  // --- Failed second drop must not leave a stale re-hash target ---

  it("does not re-hash a stale dropped file after a later drop on the same tool fails", async () => {
    mountView();
    const registry = useRegistryStore(pinia);
    await flushPromises();
    await dropFile("/tmp/a.bin", digestEntries("sha256", "sha512"));
    expect(resultRows(wrapper!)).toHaveLength(2);

    registry.dropResult = {
      toolId: "hash",
      error: {
        code: "file-read-error",
        message: "/tmp/gone.bin: No such file or directory (os error 2)",
        position: null,
        context: null,
      },
    };
    await flushPromises();
    invokeMock.mockClear();

    await algoCheckbox(wrapper!, "MD5").trigger("change");
    await flushPromises();

    // Must not silently re-hash the earlier /tmp/a.bin.
    expect(invokeMock).not.toHaveBeenCalledWith("hash_compute_file", expect.anything());
  });

  // --- Deferred-work fold-in: digests clear when a new failure follows a
  // prior success (decision record commitment, code review, Story 8.4) ---

  it("clears digests when a hash that fails follows one that succeeded", async () => {
    mountView();
    await hashInput(wrapper!, "abc", digestEntries("sha256", "sha512"));
    expect(resultRows(wrapper!)).toHaveLength(2);

    invokeMock.mockRejectedValueOnce({
      code: "hash-internal",
      message: "background task failed",
      position: null,
      context: null,
    });
    await setInput(wrapper!, "xyz");
    await settle();

    expect(resultRows(wrapper!)).toHaveLength(0);
    expect(wrapper!.find("[role='alert']").exists()).toBe(true);
  });
});
