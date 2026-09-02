import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import JwtView from "./JwtView.vue";

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

// Decode is live and debounced (src/shell/debounce.ts, 200ms). Fake timers
// mean a pending debounce never fires unless a test advances the clock — and
// they let us pin "now" so the live clock / relative-time output is
// deterministic. Same pattern as HashView.spec.ts / Base64View.spec.ts.
const DEBOUNCE_MS = 200;
const FIXED_NOW = new Date("2026-09-02T12:00:00.000Z");
const nowSec = () => Math.floor(FIXED_NOW.getTime() / 1000);

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
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
  wrapper = mount(JwtView, { global: { plugins: [pinia] } });
  return wrapper;
}

const HEADER = { alg: "HS256", typ: "JWT" };

async function typeToken(
  w: VueWrapper,
  value: string,
  outcome?: { resolve: unknown } | { reject: unknown },
) {
  if (outcome && "resolve" in outcome) invokeMock.mockResolvedValueOnce(outcome.resolve);
  if (outcome && "reject" in outcome) invokeMock.mockRejectedValueOnce(outcome.reject);
  await w.find("#jwt-token-input").setValue(value);
  vi.advanceTimersByTime(DEBOUNCE_MS);
  await flushPromises();
}

const MALFORMED = {
  code: "jwt-malformed",
  message: "expected 3 dot-separated segments (header.payload.signature), found 2",
  position: null,
  context: "segment: structure",
};

describe("JwtView", () => {
  it("decodes automatically after the debounce and renders pretty-printed header + payload (AC7, AC10)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { sub: "1234567890" }, exp: null, iat: null, nbf: null },
    });

    expect(invokeMock).toHaveBeenCalledWith("jwt_decode", { token: "h.p.s" });
    expect(wrapper!.text()).toContain('"alg": "HS256"');
    expect(wrapper!.text()).toContain('"sub": "1234567890"');
  });

  it("has no Decode button and no Paste button (AC7)", () => {
    mountView();
    expect(wrapper!.findAll("button").map((b) => b.text())).not.toContain("Decode");
    expect(wrapper!.findAll("button").map((b) => b.text())).not.toContain("Paste from clipboard");
  });

  it("does not decode until the debounce elapses (AC7)", async () => {
    mountView();
    await wrapper!.find("#jwt-token-input").setValue("h.p.s");
    expect(invokeMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("renders exp / iat as absolute local datetimes with a relative-time suffix (AC15)", async () => {
    mountView();
    const exp = nowSec() + 3600;
    const iat = nowSec() - 3 * 86400;
    await typeToken(wrapper!, "h.p.s", { resolve: { header: HEADER, payload: { exp, iat } } });

    const text = wrapper!.text();
    expect(text).toContain(new Date(exp * 1000).toLocaleString());
    expect(text).toContain(new Date(iat * 1000).toLocaleString());
    expect(text).toContain("in 1 hour");
    expect(text).toContain("3 days ago");
  });

  it("shows the expired status line only when exp is in the past (AC13)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { exp: nowSec() - 3600 } },
    });
    const line = wrapper!.find(".jwt-status-expired");
    expect(line.exists()).toBe(true);
    expect(line.attributes("role")).toBe("status");
  });

  it("does not show the expired status line when exp is in the future (AC13)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { exp: nowSec() + 3600 } },
    });
    expect(wrapper!.find(".jwt-status-expired").exists()).toBe(false);
  });

  it("does not show the expired status line when exp is absent (AC13)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", { resolve: { header: HEADER, payload: {} } });
    expect(wrapper!.find(".jwt-status-expired").exists()).toBe(false);
  });

  it("flips to expired as the live clock passes exp, with no re-decode (AC13)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { exp: nowSec() + 2 } },
    });
    expect(wrapper!.find(".jwt-status-expired").exists()).toBe(false);

    invokeMock.mockClear();
    vi.advanceTimersByTime(3000);
    await flushPromises();

    expect(wrapper!.find(".jwt-status-expired").exists()).toBe(true);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("shows a not-valid-yet status line when nbf is in the future (AC14)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { nbf: nowSec() + 3600 } },
    });
    const line = wrapper!.find(".jwt-status-nbf");
    expect(line.exists()).toBe(true);
    expect(line.attributes("role")).toBe("status");
    expect(line.text()).toContain("not valid yet");
  });

  it("shows no expiry / not-yet-valid line for a currently-valid token (AC14)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { exp: nowSec() + 3600, nbf: nowSec() - 3600 } },
    });
    expect(wrapper!.find(".jwt-status-expired").exists()).toBe(false);
    expect(wrapper!.find(".jwt-status-nbf").exists()).toBe(false);
  });

  it("renders a decode rejection via role=alert with the backend message (AC22)", async () => {
    mountView();
    await typeToken(wrapper!, "a.b", { reject: MALFORMED });

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("expected 3 dot-separated segments");
  });

  it("keeps the honesty caption visible before any decode and after a successful one (AC9)", async () => {
    mountView();
    expect(wrapper!.text()).toContain("does not verify signatures");
    await typeToken(wrapper!, "h.p.s", { resolve: { header: HEADER, payload: {} } });
    expect(wrapper!.text()).toContain("does not verify signatures");
  });

  it("clears stale decoded output when a later decode fails (AC22)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { sub: "1234567890" } },
    });
    expect(wrapper!.text()).toContain('"sub": "1234567890"');

    await typeToken(wrapper!, "a.b", { reject: MALFORMED });

    expect(wrapper!.text()).not.toContain('"sub": "1234567890"');
    expect(wrapper!.find("[role='alert']").exists()).toBe(true);
  });

  it("shows a calm status line and does not call the backend for an over-cap input (AC18)", async () => {
    mountView();
    await wrapper!.find("#jwt-token-input").setValue("x".repeat(1_048_576 + 1));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();

    const line = wrapper!.find(".jwt-status-oversize");
    expect(line.exists()).toBe(true);
    expect(line.attributes("role")).toBe("status");
    expect(wrapper!.find("[role='alert']").exists()).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("marks a registered claim that is present but not a number, distinctly from an absent one (AC17)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { exp: "not-a-number", iat: nowSec() } },
    });

    const text = wrapper!.text();
    expect(text).toContain("not a number");
    expect(text).toContain('"not-a-number"');
    // nbf is genuinely absent — rendered differently.
    expect(text).toContain("not present");
    expect(wrapper!.find("[role='alert']").exists()).toBe(false);
  });

  it("shows an honest out-of-range message instead of Invalid Date for a huge exp (AC16)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { exp: Number.MAX_SAFE_INTEGER } },
    });

    const text = wrapper!.text();
    expect(text).toContain("out of representable range");
    expect(text).not.toContain("Invalid Date");
  });

  it("warns when alg is none / absent / non-string, and not for a normal algorithm (AC12)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s1", { resolve: { header: { alg: "none" }, payload: {} } });
    expect(wrapper!.find(".alg-warning").exists()).toBe(true);

    await typeToken(wrapper!, "h.p.s2", { resolve: { header: { typ: "JWT" }, payload: {} } });
    expect(wrapper!.find(".alg-warning").exists()).toBe(true);

    await typeToken(wrapper!, "h.p.s3", { resolve: { header: { alg: "HS256" }, payload: {} } });
    expect(wrapper!.find(".alg-warning").exists()).toBe(false);
  });

  it("copies a block only after the clipboard write resolves (AC10)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", {
      resolve: { header: HEADER, payload: { sub: "x" } },
    });

    let resolveWrite: () => void = () => {};
    writeTextMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    await wrapper!.findAll(".block-copy")[0].trigger("click");
    await flushPromises();
    expect(wrapper!.findAll(".block-copy")[0].find(".block-copy-ok").exists()).toBe(false);

    resolveWrite();
    await flushPromises();
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('"alg": "HS256"'));
    expect(wrapper!.findAll(".block-copy")[0].find(".block-copy-ok").exists()).toBe(true);
  });

  it("announces a successful decode via a polite status region (AC21)", async () => {
    mountView();
    await typeToken(wrapper!, "h.p.s", { resolve: { header: HEADER, payload: {} } });

    const region = wrapper!.find(".sr-only[role='status']");
    expect(region.exists()).toBe(true);
    expect(region.text().length).toBeGreaterThan(0);
  });
});
