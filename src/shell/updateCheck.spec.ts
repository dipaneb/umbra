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

const {
  checkForUpdate,
  installUpdate,
  getUpdateSeverity,
  stripSeverityMarker,
  getLocalizedNotes,
  formatUpdateDate,
} = await import("./updateCheck");

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

describe("getLocalizedNotes", () => {
  it("returns undefined when there is no body", () => {
    expect(getLocalizedNotes(undefined, { locale: "en" })).toBeUndefined();
  });

  it("passes an unlabeled legacy body through unchanged, regardless of locale", () => {
    expect(getLocalizedNotes("Bug fixes and improvements.", { locale: "en" })).toBe(
      "Bug fixes and improvements.",
    );
    expect(getLocalizedNotes("Bug fixes and improvements.", { locale: "fr" })).toBe(
      "Bug fixes and improvements.",
    );
  });

  it("picks the block matching the current UI locale", () => {
    const body = "[en]\nFixes a crash.\n\n[fr]\nCorrige un plantage.";
    expect(getLocalizedNotes(body, { locale: "en" })).toBe("Fixes a crash.");
    expect(getLocalizedNotes(body, { locale: "fr" })).toBe("Corrige un plantage.");
  });

  it("falls back to the 'en' block when the current locale has no block of its own", () => {
    const body = "[en]\nFixes a crash.\n\n[de]\nBehebt einen Absturz.";
    expect(getLocalizedNotes(body, { locale: "fr" })).toBe("Fixes a crash.");
  });

  it("falls back to the first block when neither the current locale nor 'en' is present", () => {
    const body = "[de]\nBehebt einen Absturz.\n\n[it]\nCorregge un crash.";
    expect(getLocalizedNotes(body, { locale: "fr" })).toBe("Behebt einen Absturz.");
  });

  it("strips a leading [security] marker before selecting the locale block", () => {
    const body = "[security]\n[en]\nFixes CVE-2026-0001.\n\n[fr]\nCorrige la CVE-2026-0001.";
    expect(getLocalizedNotes(body, { locale: "fr" })).toBe("Corrige la CVE-2026-0001.");
  });

  it("does not treat inline bracket text mid-line as a locale header", () => {
    const body = "See [en] docs for details.";
    expect(getLocalizedNotes(body, { locale: "en" })).toBe("See [en] docs for details.");
  });
});

describe("formatUpdateDate", () => {
  // "system" reproduces the pre-i18n behavior exactly (toLocaleDateString(undefined, ...))
  // — dateTimeFormat's locale-following behavior is covered by locale.spec.ts's
  // formatDateWithFormat tests instead, so these stay focused on formatUpdateDate's own
  // contract (parsing/undefined-handling), not re-testing formatDate underneath it.
  const systemFormatSettings = { locale: "system" as const, dateTimeFormat: "system" as const };

  it("formats a full ISO-8601 timestamp as a readable date, locale-safe", () => {
    const iso = "2026-08-18T23:23:37.094Z";
    expect(formatUpdateDate(iso, systemFormatSettings)).toBe(
      new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    );
  });

  it("formats a bare date-only string the same way", () => {
    const dateOnly = "2026-08-09";
    expect(formatUpdateDate(dateOnly, systemFormatSettings)).toBe(
      new Date(dateOnly).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  });

  it("returns undefined for a missing date", () => {
    expect(formatUpdateDate(undefined, systemFormatSettings)).toBeUndefined();
  });

  it("returns undefined rather than 'Invalid Date' for an unparseable string", () => {
    expect(formatUpdateDate("not a date", systemFormatSettings)).toBeUndefined();
  });

  it("formats in French when the date-time format is pinned to fr-FR", () => {
    const iso = "2026-08-18T23:23:37.094Z";
    expect(formatUpdateDate(iso, { locale: "en", dateTimeFormat: "fr-FR" })).toBe(
      new Date(iso).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }),
    );
  });

  it("formats as ISO 8601 when the date-time format is pinned to iso", () => {
    const date = new Date("2026-08-18T23:23:37.094Z");
    expect(formatUpdateDate(date.toISOString(), { locale: "en", dateTimeFormat: "iso" })).toBe(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    );
  });
});
