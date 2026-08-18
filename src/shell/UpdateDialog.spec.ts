import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import UpdateDialog from "./UpdateDialog.vue";
import { useSettingsStore } from "../stores/settings";
import { __setDialogOpenForTest, __setPendingUpdateForTest, pendingUpdate } from "./updateSignal";
import { formatUpdateDate, type Update } from "./updateCheck";

const installUpdate = vi.fn();

vi.mock("./updateCheck", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./updateCheck")>();
  return {
    ...actual,
    installUpdate: (update: unknown) => installUpdate(update),
  };
});

let wrapper: VueWrapper | undefined;

function fakeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    version: "1.1.0",
    currentVersion: "1.0.0",
    date: "2026-08-09",
    body: "Bug fixes and improvements.",
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Update;
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

beforeEach(() => {
  setActivePinia(createPinia());
  const settings = useSettingsStore();
  settings.setUpdateSignalDismissed = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.clearAllMocks();
  __setPendingUpdateForTest(null);
  __setDialogOpenForTest(false);
});

describe("UpdateDialog", () => {
  it("renders nothing when the dialog hasn't been opened, even with a pending update", async () => {
    __setPendingUpdateForTest(fakeUpdate());

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
  });

  it("renders nothing when opened with no pending update (defensive)", async () => {
    __setDialogOpenForTest(true);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
  });

  it("renders version, release date, and notes once externally opened (AC1, AC3)", async () => {
    __setPendingUpdateForTest(fakeUpdate());
    __setDialogOpenForTest(true);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const dialog = wrapper.find("[role='dialog']");
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain("1.0.0");
    expect(dialog.text()).toContain("1.1.0");
    expect(dialog.text()).toContain(formatUpdateDate("2026-08-09"));
    expect(dialog.text()).toContain("Bug fixes and improvements.");
  });

  it("strips a leading [security] marker from the displayed release notes", async () => {
    __setPendingUpdateForTest(fakeUpdate({ body: "[security] Fixes CVE-2026-0001." }));
    __setDialogOpenForTest(true);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const dialog = wrapper.find("[role='dialog']");
    expect(dialog.text()).toContain("Fixes CVE-2026-0001.");
    expect(dialog.text()).not.toContain("[security]");
  });

  it("calls installUpdate with the update when 'Install & Restart' is clicked (AC1)", async () => {
    const update = fakeUpdate();
    __setPendingUpdateForTest(update);
    __setDialogOpenForTest(true);
    installUpdate.mockResolvedValueOnce(undefined);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const installButton = buttons.find((b) => b.text().includes("Install"));
    await installButton?.trigger("click");

    expect(installUpdate).toHaveBeenCalledWith(update);
  });

  it("disables both buttons while install is in flight, and re-clicking 'Install' does not call it twice", async () => {
    __setPendingUpdateForTest(fakeUpdate());
    __setDialogOpenForTest(true);
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
    __setPendingUpdateForTest(fakeUpdate());
    __setDialogOpenForTest(true);
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

    const update = pendingUpdate.value!;
    expect(update.close).not.toHaveBeenCalled();
    expect(wrapper.find("[role='dialog']").exists()).toBe(true);

    install.resolve();
    await flushPromises();
  });

  it("shows an inline error and re-enables the buttons when install fails, allowing retry (AC1)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    __setPendingUpdateForTest(fakeUpdate());
    __setDialogOpenForTest(true);
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

  it("clears a stale install error on reopen, so a prior failed attempt doesn't resurface", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    __setPendingUpdateForTest(fakeUpdate());
    __setDialogOpenForTest(true);
    installUpdate.mockRejectedValueOnce(new Error("disk full"));

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const installButton = wrapper.findAll("button").find((b) => b.text().includes("Install"))!;
    await installButton.trigger("click");
    await flushPromises();
    expect(wrapper.find("[role='alert']").exists()).toBe(true);

    const dismissButton = wrapper.findAll("button").find((b) => b.text().includes("Not Now"));
    await dismissButton?.trigger("click");
    await flushPromises();
    wrapper.unmount();

    __setDialogOpenForTest(true);
    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find("[role='alert']").exists()).toBe(false);
    consoleError.mockRestore();
  });

  it("never calls update.close() or installUpdate, and hides the dialog, on 'Not Now' (AC4)", async () => {
    const update = fakeUpdate();
    __setPendingUpdateForTest(update);
    __setDialogOpenForTest(true);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const dismissButton = buttons.find((b) => b.text().includes("Not Now"));
    await dismissButton?.trigger("click");
    await flushPromises();

    // Deliberately not closed: the Settings banner can reopen the dialog on this same
    // Update object later this session, and closing it here would break that reopen path.
    expect(update.close).not.toHaveBeenCalled();
    expect(installUpdate).not.toHaveBeenCalled();
    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
  });

  it("dismisses on Escape with the same effect as 'Not Now' (AC4, NFR5)", async () => {
    const update = fakeUpdate();
    __setPendingUpdateForTest(update);
    __setDialogOpenForTest(true);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find("[role='dialog']").exists()).toBe(true);

    dispatch({ key: "Escape" });
    await flushPromises();

    expect(update.close).not.toHaveBeenCalled();
    expect(installUpdate).not.toHaveBeenCalled();
    expect(wrapper.find("[role='dialog']").exists()).toBe(false);
  });

  it("reopening after 'Not Now' still allows a successful install against the same Update (regression guard for the stale-resource bug)", async () => {
    const update = fakeUpdate();
    __setPendingUpdateForTest(update);
    __setDialogOpenForTest(true);
    installUpdate.mockResolvedValueOnce(undefined);

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const dismissButton = wrapper.findAll("button").find((b) => b.text().includes("Not Now"));
    await dismissButton?.trigger("click");
    await flushPromises();
    wrapper.unmount();

    // Simulates reopening via the Settings banner's "View update…" button.
    __setDialogOpenForTest(true);
    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const installButton = wrapper.findAll("button").find((b) => b.text().includes("Install"));
    await installButton?.trigger("click");
    await flushPromises();

    expect(installUpdate).toHaveBeenCalledWith(update);
    expect(wrapper.find(".install-error").exists()).toBe(false);
  });

  it("persists the dismissed version via the settings store on 'Not Now', without clearing pendingUpdate so the dot/banner stay visible (AC4)", async () => {
    const update = fakeUpdate();
    __setPendingUpdateForTest(update);
    __setDialogOpenForTest(true);
    const settings = useSettingsStore();

    wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    const dismissButton = wrapper.findAll("button").find((b) => b.text().includes("Not Now"));
    await dismissButton?.trigger("click");
    await flushPromises();

    expect(settings.setUpdateSignalDismissed).toHaveBeenCalledWith("1.1.0");
    expect(pendingUpdate.value).toBe(update);
  });
});
