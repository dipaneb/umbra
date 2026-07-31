import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import JwtView from "./JwtView.vue";

const { invokeMock, readTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  readTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: (...args: unknown[]) => readTextMock(...args),
  writeText: vi.fn(),
}));

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  readTextMock.mockReset();
});

function mountView() {
  pinia = createPinia();
  wrapper = mount(JwtView, { global: { plugins: [pinia] } });
  return wrapper;
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

async function decodeToken(w: VueWrapper, decoded: unknown) {
  invokeMock.mockResolvedValueOnce(decoded);
  await w.find("#jwt-token-input").setValue("header.payload.sig");
  await clickButton(w, "Decode");
  await flushPromises();
}

describe("JwtView", () => {
  it("renders pretty-printed header/payload and humanized exp/iat/nbf on a successful decode (AC1, AC2)", async () => {
    mountView();
    const decoded = {
      header: { alg: "HS256", typ: "JWT" },
      payload: { sub: "1234567890" },
      exp: 1735689600,
      iat: 1735686000,
      nbf: 1735686000,
    };
    await decodeToken(wrapper!, decoded);

    expect(invokeMock).toHaveBeenCalledWith("jwt_decode", { token: "header.payload.sig" });
    expect(wrapper!.text()).toContain('"alg": "HS256"');
    expect(wrapper!.text()).toContain('"sub": "1234567890"');
    expect(wrapper!.text()).toContain(new Date(1735689600 * 1000).toLocaleString());
    expect(wrapper!.text()).toContain(new Date(1735686000 * 1000).toLocaleString());
  });

  it("shows the expired-status element when exp is in the past (AC2)", async () => {
    mountView();
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    await decodeToken(wrapper!, {
      header: { alg: "HS256" },
      payload: {},
      exp: pastExp,
      iat: null,
      nbf: null,
    });

    expect(wrapper!.find("[role='status']").exists()).toBe(true);
  });

  it("does not show the expired-status element when exp is in the future (AC2)", async () => {
    mountView();
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    await decodeToken(wrapper!, {
      header: { alg: "HS256" },
      payload: {},
      exp: futureExp,
      iat: null,
      nbf: null,
    });

    expect(wrapper!.find("[role='status']").exists()).toBe(false);
  });

  it("does not show the expired-status element when exp is absent (AC2)", async () => {
    mountView();
    await decodeToken(wrapper!, {
      header: { alg: "HS256" },
      payload: {},
      exp: null,
      iat: null,
      nbf: null,
    });

    expect(wrapper!.find("[role='status']").exists()).toBe(false);
  });

  it("renders a decode error via the role=alert pattern with the backend's message (AC3)", async () => {
    mountView();
    invokeMock.mockRejectedValueOnce({
      code: "jwt-malformed",
      message: "expected 3 dot-separated segments (header.payload.signature), found 2",
      position: null,
      context: "segment: structure",
    });

    await wrapper!.find("#jwt-token-input").setValue("a.b");
    await clickButton(wrapper!, "Decode");
    await flushPromises();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("expected 3 dot-separated segments");
  });

  it("shows the signatures-not-verified notice before any decode attempt (AC4)", () => {
    mountView();

    expect(wrapper!.text()).toContain("Signatures are not verified");
  });

  it("keeps the signatures-not-verified notice visible after a successful decode (AC4)", async () => {
    mountView();
    await decodeToken(wrapper!, {
      header: { alg: "HS256" },
      payload: {},
      exp: null,
      iat: null,
      nbf: null,
    });

    expect(wrapper!.text()).toContain("Signatures are not verified");
  });

  it("paste populates the token field from a mocked readClipboardText", async () => {
    mountView();
    readTextMock.mockResolvedValueOnce("pasted.jwt.token");

    await clickButton(wrapper!, "Paste from clipboard");
    await flushPromises();

    expect((wrapper!.find("#jwt-token-input").element as HTMLTextAreaElement).value).toBe("pasted.jwt.token");
  });
});
