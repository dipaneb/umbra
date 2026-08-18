import { afterEach, describe, expect, it, vi } from "vitest";

const checkForUpdate = vi.fn();

vi.mock("./updateCheck", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./updateCheck")>();
  return {
    ...actual,
    checkForUpdate: () => checkForUpdate(),
  };
});

const {
  pendingUpdate,
  dialogOpen,
  runCheck,
  openDialog,
  closeDialog,
  __setPendingUpdateForTest,
  __setDialogOpenForTest,
} = await import("./updateSignal");

afterEach(() => {
  vi.clearAllMocks();
  __setPendingUpdateForTest(null);
  __setDialogOpenForTest(false);
});

describe("runCheck", () => {
  it("sets pendingUpdate when an update is found", async () => {
    const update = { version: "1.1.0" };
    checkForUpdate.mockResolvedValueOnce(update);

    await runCheck();

    expect(pendingUpdate.value).toBe(update);
  });

  it("sets pendingUpdate to null when no update is available", async () => {
    checkForUpdate.mockResolvedValueOnce(null);

    await runCheck();

    expect(pendingUpdate.value).toBeNull();
  });

  it("leaves pendingUpdate at its last-known state and logs, without throwing, when the check fails (AC5)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    checkForUpdate.mockRejectedValueOnce(new Error("network error"));

    await expect(runCheck()).resolves.toBeUndefined();

    expect(pendingUpdate.value).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("openDialog / closeDialog", () => {
  it("openDialog sets dialogOpen to true", () => {
    expect(dialogOpen.value).toBe(false);

    openDialog();

    expect(dialogOpen.value).toBe(true);
  });

  it("closeDialog sets dialogOpen to false", () => {
    openDialog();

    closeDialog();

    expect(dialogOpen.value).toBe(false);
  });
});
