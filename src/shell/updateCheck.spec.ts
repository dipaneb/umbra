import { describe, expect, it, vi } from "vitest";
import type { Update } from "./updateCheck";

const check = vi.fn();
const relaunch = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => check(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: () => relaunch(),
}));

const { checkForUpdate, installUpdate, getUpdateSeverity, stripSeverityMarker } =
  await import("./updateCheck");

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

    await installUpdate({ downloadAndInstall } as unknown as Update);

    expect(downloadAndInstall).toHaveBeenCalled();
    expect(relaunch).toHaveBeenCalled();
    expect(calls).toEqual(["downloadAndInstall", "relaunch"]);
  });
});

describe("getUpdateSeverity", () => {
  it("returns 'none' when there is no update", () => {
    expect(getUpdateSeverity(null)).toBe("none");
  });

  it("returns 'routine' when the update has no body", () => {
    expect(getUpdateSeverity({ body: undefined } as unknown as Update)).toBe("routine");
  });

  it("returns 'routine' for an ordinary release body", () => {
    expect(
      getUpdateSeverity({ body: "Bug fixes and improvements." } as unknown as Update),
    ).toBe("routine");
  });

  it("returns 'security' when the body starts with a [security] marker", () => {
    expect(
      getUpdateSeverity({ body: "[security] Fixes CVE-2026-0001." } as unknown as Update),
    ).toBe("security");
  });

  it("is case-insensitive to the [security] marker", () => {
    expect(getUpdateSeverity({ body: "[SECURITY] Fixes a CVE." } as unknown as Update)).toBe(
      "security",
    );
    expect(getUpdateSeverity({ body: "[Security] Fixes a CVE." } as unknown as Update)).toBe(
      "security",
    );
  });

  it("does not escalate when the marker appears mid-string rather than at the start", () => {
    expect(
      getUpdateSeverity({ body: "See [security] notes below." } as unknown as Update),
    ).toBe("routine");
  });
});

describe("stripSeverityMarker", () => {
  it("removes a leading [security] marker and following whitespace", () => {
    expect(stripSeverityMarker("[security] Fixes CVE-2026-0001.")).toBe(
      "Fixes CVE-2026-0001.",
    );
  });

  it("leaves an ordinary body unchanged", () => {
    expect(stripSeverityMarker("Bug fixes and improvements.")).toBe(
      "Bug fixes and improvements.",
    );
  });

  it("passes undefined through unchanged", () => {
    expect(stripSeverityMarker(undefined)).toBeUndefined();
  });
});
