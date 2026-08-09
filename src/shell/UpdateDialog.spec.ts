import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import UpdateDialog from "./UpdateDialog.vue";

const checkForUpdate = vi.fn();
const installUpdate = vi.fn();

vi.mock("./updateCheck", () => ({
  checkForUpdate: () => checkForUpdate(),
  installUpdate: (update: unknown) => installUpdate(update),
}));

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.clearAllMocks();
});

function fakeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    version: "1.1.0",
    currentVersion: "1.0.0",
    date: "2026-08-09",
    body: "Bug fixes and improvements.",
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function dispatch(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent("keydown", init));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("UpdateDialog", () => {
  it("renders nothing when no update is available (AC4)", async () => {
    checkForUpdate.mockResolvedValueOnce(null);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
  });

  it("renders nothing when the check rejects (offline/unreachable)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    checkForUpdate.mockRejectedValueOnce(new Error("network error"));

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("renders version, release date, and notes once an update is found (AC1)", async () => {
    checkForUpdate.mockResolvedValueOnce(fakeUpdate());

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const dialog = wrapper.find("[role='dialog']");
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain("1.0.0");
    expect(dialog.text()).toContain("1.1.0");
    expect(dialog.text()).toContain("2026-08-09");
    expect(dialog.text()).toContain("Bug fixes and improvements.");
  });

  it("calls installUpdate with the update when 'Install & Restart' is clicked (AC1)", async () => {
    const update = fakeUpdate();
    checkForUpdate.mockResolvedValueOnce(update);
    installUpdate.mockResolvedValueOnce(undefined);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const installButton = buttons.find((b) => b.text().includes("Install"));
    await installButton?.trigger("click");

    expect(installUpdate).toHaveBeenCalledWith(update);
  });

  it("disables both buttons while install is in flight, and re-clicking 'Install' does not call it twice", async () => {
    const update = fakeUpdate();
    checkForUpdate.mockResolvedValueOnce(update);
    const install = deferred<void>();
    installUpdate.mockReturnValueOnce(install.promise);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const installButton = buttons.find((b) => b.text().includes("Install"))!;
    const dismissButton = buttons.find((b) => b.text().includes("Not Now"))!;

    await installButton.trigger("click");
    await installButton.trigger("click");

    expect(installButton.attributes("disabled")).toBeDefined();
    expect(dismissButton.attributes("disabled")).toBeDefined();
    expect(installUpdate).toHaveBeenCalledTimes(1);

    install.resolve();
    await flushPromises();
  });

  it("ignores 'Not Now' and Escape while an install is in flight, so the app cannot relaunch after the user believes they've declined (AC4)", async () => {
    const update = fakeUpdate();
    checkForUpdate.mockResolvedValueOnce(update);
    const install = deferred<void>();
    installUpdate.mockReturnValueOnce(install.promise);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const installButton = wrapper.findAll("button").find((b) => b.text().includes("Install"))!;
    await installButton.trigger("click");

    const dismissButton = wrapper.findAll("button").find((b) => b.text().includes("Not Now"))!;
    await dismissButton.trigger("click");
    dispatch({ key: "Escape" });
    await flushPromises();

    expect(update.close).not.toHaveBeenCalled();
    expect(wrapper.find("[role='dialog']").exists()).toBe(true);

    install.resolve();
    await flushPromises();
  });

  it("shows an inline error and re-enables the buttons when install fails, allowing retry (AC1)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const update = fakeUpdate();
    checkForUpdate.mockResolvedValueOnce(update);
    installUpdate.mockRejectedValueOnce(new Error("disk full"));

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const installButton = wrapper.findAll("button").find((b) => b.text().includes("Install"))!;
    await installButton.trigger("click");
    await flushPromises();

    expect(wrapper.find("[role='alert']").exists()).toBe(true);
    const buttonsAfterFailure = wrapper.findAll("button");
    expect(buttonsAfterFailure.find((b) => b.text().includes("Install"))?.attributes("disabled")).toBeUndefined();
    expect(buttonsAfterFailure.find((b) => b.text().includes("Not Now"))?.attributes("disabled")).toBeUndefined();
    consoleError.mockRestore();
  });

  it("calls update.close(), never installUpdate, and hides the dialog on 'Not Now' (AC4)", async () => {
    const update = fakeUpdate();
    checkForUpdate.mockResolvedValueOnce(update);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const dismissButton = buttons.find((b) => b.text().includes("Not Now"));
    await dismissButton?.trigger("click");
    await flushPromises();

    expect(update.close).toHaveBeenCalled();
    expect(installUpdate).not.toHaveBeenCalled();
    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
  });

  it("dismisses on Escape with the same effect as 'Not Now' (AC4, NFR5)", async () => {
    const update = fakeUpdate();
    checkForUpdate.mockResolvedValueOnce(update);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find("[role='dialog']").exists()).toBe(true);

    dispatch({ key: "Escape" });
    await flushPromises();

    expect(update.close).toHaveBeenCalled();
    expect(installUpdate).not.toHaveBeenCalled();
    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
  });
});
