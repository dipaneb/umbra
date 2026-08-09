import { describe, expect, it, vi } from "vitest";

const check = vi.fn();
const relaunch = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => check(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: () => relaunch(),
}));

const { checkForUpdate, installUpdate } = await import("./updateCheck");

describe("checkForUpdate", () => {
  it("resolves the update returned by the plugin unchanged", async () => {
    const update = { version: "1.2.3" };
    check.mockResolvedValueOnce(update);

    await expect(checkForUpdate()).resolves.toBe(update);
  });

  it("resolves null when no update is available", async () => {
    check.mockResolvedValueOnce(null);

    await expect(checkForUpdate()).resolves.toBeNull();
  });
});

describe("installUpdate", () => {
  it("downloads and installs the update, then relaunches, in order", async () => {
    const calls: string[] = [];
    const downloadAndInstall = vi.fn().mockImplementation(async () => {
      calls.push("downloadAndInstall");
    });
    relaunch.mockImplementationOnce(async () => {
      calls.push("relaunch");
    });

    await installUpdate({ downloadAndInstall } as never);

    expect(downloadAndInstall).toHaveBeenCalled();
    expect(relaunch).toHaveBeenCalled();
    expect(calls).toEqual(["downloadAndInstall", "relaunch"]);
  });
});
