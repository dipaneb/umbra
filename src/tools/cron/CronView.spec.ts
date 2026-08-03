import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import CronView from "./CronView.vue";

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
  writeText: (...args: unknown[]) => writeTextMock(...args),
}));

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  readTextMock.mockReset();
  writeTextMock.mockReset();
});

function mountView() {
  pinia = createPinia();
  wrapper = mount(CronView, { global: { plugins: [pinia] } });
  return wrapper;
}

function clickButton(w: VueWrapper, text: string) {
  const button = w.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button.trigger("click");
}

async function explainExpression(w: VueWrapper, explanation: unknown) {
  invokeMock.mockResolvedValueOnce(explanation);
  await w.find("#cron-expression-input").setValue("0 9 * * 1");
  await clickButton(w, "Explain");
  await flushPromises();
}

describe("CronView", () => {
  it("renders the description and 3 formatted local datetimes on a successful explain (AC1)", async () => {
    mountView();
    const nextRuns = [1735714800, 1736319600, 1736924400];
    await explainExpression(wrapper!, { description: "Every Monday, at 9:00 AM", next_runs: nextRuns });

    expect(invokeMock).toHaveBeenCalledWith("cron_explain", { expression: "0 9 * * 1" });
    expect(wrapper!.text()).toContain("Every Monday, at 9:00 AM");
    for (const epochSeconds of nextRuns) {
      expect(wrapper!.text()).toContain(new Date(epochSeconds * 1000).toLocaleString());
    }
  });

  it("renders an explain error via the role=alert pattern with the backend's message (AC2)", async () => {
    mountView();
    invokeMock.mockRejectedValueOnce({
      code: "cron-invalid-pattern",
      message: "Invalid pattern: too few fields",
      position: null,
      context: null,
    });

    await wrapper!.find("#cron-expression-input").setValue("* * *");
    await clickButton(wrapper!, "Explain");
    await flushPromises();

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("Invalid pattern: too few fields");
  });

  it("clears stale explanation output when an explain following a prior success fails (AC2)", async () => {
    mountView();
    await explainExpression(wrapper!, { description: "Every Monday, at 9:00 AM", next_runs: [1735714800] });
    expect(wrapper!.text()).toContain("Every Monday, at 9:00 AM");

    invokeMock.mockRejectedValueOnce({
      code: "cron-invalid-pattern",
      message: "Invalid pattern: too few fields",
      position: null,
      context: null,
    });
    await wrapper!.find("#cron-expression-input").setValue("* * *");
    await clickButton(wrapper!, "Explain");
    await flushPromises();

    expect(wrapper!.text()).not.toContain("Every Monday, at 9:00 AM");
    expect(wrapper!.find("[role='alert']").exists()).toBe(true);
  });

  it("discards a stale result from a superseded explain call (AD-16)", async () => {
    mountView();
    let resolveFirst: (value: unknown) => void = () => {};
    invokeMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    await wrapper!.find("#cron-expression-input").setValue("first expr");
    await clickButton(wrapper!, "Explain");

    invokeMock.mockResolvedValueOnce({ description: "second result", next_runs: [1735714800] });
    await wrapper!.find("#cron-expression-input").setValue("second expr");
    await clickButton(wrapper!, "Explain");
    await flushPromises();

    resolveFirst({ description: "first result (stale)", next_runs: [1735714800] });
    await flushPromises();

    expect(wrapper!.text()).toContain("second result");
    expect(wrapper!.text()).not.toContain("first result (stale)");
  });

  it("paste populates the expression field from a mocked readClipboardText", async () => {
    mountView();
    readTextMock.mockResolvedValueOnce("0 0 * * *");

    await clickButton(wrapper!, "Paste from clipboard");
    await flushPromises();

    expect((wrapper!.find("#cron-expression-input").element as HTMLTextAreaElement).value).toBe("0 0 * * *");
  });

  it("copy calls writeClipboardText with the description", async () => {
    mountView();
    await explainExpression(wrapper!, { description: "Every Monday, at 9:00 AM", next_runs: [1735714800] });

    await clickButton(wrapper!, "Copy description");
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith("Every Monday, at 9:00 AM");
  });
});
