import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import HashView from "./HashView.vue";

const { invokeMock, readTextMock, writeTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  readTextMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: (...args: unknown[]) => readTextMock(...args),
  writeText: (text: string) => writeTextMock(text),
}));

const SAMPLE_DIGESTS = {
  sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  sha512:
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  md5: "900150983cd24fb0d6963f7d28e17f72",
  sha1: "a9993e364706816aba3e25717850c26c9cd0d89d",
};

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  readTextMock.mockReset();
  writeTextMock.mockReset();
});

function mountView() {
  wrapper = mount(HashView);
  return wrapper;
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

function resultRows(w: VueWrapper) {
  return w.findAll(".results li");
}

async function computeSample(w: VueWrapper) {
  invokeMock.mockResolvedValueOnce(SAMPLE_DIGESTS);
  await w.find("#hash-input").setValue("abc");
  await clickButton(w, "Compute");
  await flushPromises();
}

describe("HashView", () => {
  it("computes and renders all four digests simultaneously (AC1)", async () => {
    mountView();
    await computeSample(wrapper!);

    expect(invokeMock).toHaveBeenCalledWith("hash_compute", { input: "abc" });
    const rows = resultRows(wrapper!);
    expect(rows).toHaveLength(4);
    expect(rows[0].text()).toContain(SAMPLE_DIGESTS.sha256);
    expect(rows[1].text()).toContain(SAMPLE_DIGESTS.sha512);
    expect(rows[2].text()).toContain(SAMPLE_DIGESTS.md5);
    expect(rows[3].text()).toContain(SAMPLE_DIGESTS.sha1);
  });

  it("visibly labels MD5 and SHA-1 rows as legacy (AC1)", async () => {
    mountView();
    await computeSample(wrapper!);

    const rows = resultRows(wrapper!);
    expect(rows[0].text()).not.toContain("legacy");
    expect(rows[1].text()).not.toContain("legacy");
    expect(rows[2].text()).toContain("legacy");
    expect(rows[3].text()).toContain("legacy");
  });

  it("toggling uppercase/lowercase re-renders the same digests without a second invoke call (AC2)", async () => {
    mountView();
    await computeSample(wrapper!);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    await wrapper!.find('input[type="radio"][value="upper"]').setValue();
    await flushPromises();

    const rows = resultRows(wrapper!);
    expect(rows[0].text()).toContain(SAMPLE_DIGESTS.sha256.toUpperCase());
    expect(rows[3].text()).toContain(SAMPLE_DIGESTS.sha1.toUpperCase());
    expect(invokeMock).toHaveBeenCalledTimes(1);

    await wrapper!.find('input[type="radio"][value="lower"]').setValue();
    await flushPromises();

    expect(resultRows(wrapper!)[0].text()).toContain(SAMPLE_DIGESTS.sha256);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("renders a rejected hash-input-too-large error inline", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "hash-input-too-large",
      message: "input is 104857601 bytes, which exceeds the 104857600-byte limit",
      position: null,
      context: null,
    });
    mountView();

    await wrapper!.find("#hash-input").setValue("huge");
    await clickButton(wrapper!, "Compute");
    await flushPromises();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("exceeds the 104857600-byte limit");
    expect(resultRows(wrapper!)).toHaveLength(0);
  });

  it("per-row Copy copies that row's currently-displayed (case-respecting) string", async () => {
    writeTextMock.mockResolvedValueOnce(undefined);
    mountView();
    await computeSample(wrapper!);

    await wrapper!.find('input[type="radio"][value="upper"]').setValue();
    await flushPromises();

    const sha256Row = resultRows(wrapper!)[0];
    await sha256Row.find("button").trigger("click");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith(SAMPLE_DIGESTS.sha256.toUpperCase());
  });

  it("paste-from-clipboard populates the input and clears a prior result", async () => {
    mountView();
    await computeSample(wrapper!);
    expect(resultRows(wrapper!)).toHaveLength(4);

    readTextMock.mockResolvedValueOnce("pasted text");
    await clickButton(wrapper!, "Paste from clipboard");
    await flushPromises();

    expect((wrapper!.find("#hash-input").element as HTMLTextAreaElement).value).toBe("pasted text");
    expect(resultRows(wrapper!)).toHaveLength(0);
  });
});
