import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "../stores/settings";
import { i18n } from "../i18n";
import {
  applyResolvedLocale,
  attachLocaleListener,
  formatDateTimeWithFormat,
  formatDateWithFormat,
  resolveDateTimeLocale,
  resolveLocale,
} from "./locale";

describe("resolveLocale", () => {
  it("passes through an explicit en override regardless of system languages", () => {
    expect(resolveLocale("en", ["fr-FR"])).toBe("en");
  });

  it("passes through an explicit fr override regardless of system languages", () => {
    expect(resolveLocale("fr", ["en-US"])).toBe("fr");
  });

  it("resolves system to fr when the first supported system language is French", () => {
    expect(resolveLocale("system", ["fr-FR", "en-US"])).toBe("fr");
  });

  it("resolves system to fr for a regional French tag (fr-CA), matching by base subtag", () => {
    expect(resolveLocale("system", ["fr-CA"])).toBe("fr");
  });

  it("resolves system to en when the first supported system language is English", () => {
    expect(resolveLocale("system", ["en-GB", "fr-FR"])).toBe("en");
  });

  it("falls back to en when no system language is supported", () => {
    expect(resolveLocale("system", ["de-DE", "ja-JP"])).toBe("en");
  });

  it("falls back to en when the system language list is empty", () => {
    expect(resolveLocale("system", [])).toBe("en");
  });

  it("skips an unsupported language ahead of a supported one, preference order intact", () => {
    expect(resolveLocale("system", ["de-DE", "fr-FR"])).toBe("fr");
  });
});

describe("resolveDateTimeLocale", () => {
  it("returns the iso sentinel for format 'iso' regardless of UI locale", () => {
    expect(resolveDateTimeLocale("iso", "en")).toBe("iso");
    expect(resolveDateTimeLocale("iso", "fr")).toBe("iso");
  });

  it("returns undefined for format 'system' (the OS-default signal every Intl API understands)", () => {
    expect(resolveDateTimeLocale("system", "fr")).toBeUndefined();
  });

  it("returns fr-FR for format 'auto' when the UI locale is fr", () => {
    expect(resolveDateTimeLocale("auto", "fr")).toBe("fr-FR");
  });

  it("returns en-US for format 'auto' when the UI locale is en", () => {
    expect(resolveDateTimeLocale("auto", "en")).toBe("en-US");
  });

  it("passes an explicit locale tag straight through, independent of UI locale", () => {
    expect(resolveDateTimeLocale("en-GB", "fr")).toBe("en-GB");
    expect(resolveDateTimeLocale("fr-FR", "en")).toBe("fr-FR");
  });
});

describe("formatDateWithFormat / formatDateTimeWithFormat", () => {
  // A fixed instant so every locale/format combination below is deterministic.
  const epoch = new Date("2026-08-23T14:30:00.000Z");

  it("renders three distinct strings for the same instant under iso, fr-FR, and en-US", () => {
    const iso = formatDateWithFormat(epoch, "iso", "en");
    const fr = formatDateWithFormat(epoch, "fr-FR", "en");
    const en = formatDateWithFormat(epoch, "en-US", "en");

    expect(new Set([iso, fr, en]).size).toBe(3);
  });

  it("formats iso as YYYY-MM-DD (date only, no time)", () => {
    expect(formatDateWithFormat(epoch, "iso", "en")).toBe(
      `${epoch.getFullYear()}-${String(epoch.getMonth() + 1).padStart(2, "0")}-${String(epoch.getDate()).padStart(2, "0")}`,
    );
  });

  it("matches Date.prototype.toLocaleDateString for a real locale tag", () => {
    expect(formatDateWithFormat(epoch, "fr-FR", "en")).toBe(
      epoch.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }),
    );
  });

  it("formatDateTimeWithFormat's iso branch includes hours and minutes", () => {
    const iso = formatDateTimeWithFormat(epoch, "iso", "en");
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(iso).toBe(
      `${epoch.getFullYear()}-${pad(epoch.getMonth() + 1)}-${pad(epoch.getDate())} ${pad(epoch.getHours())}:${pad(epoch.getMinutes())}`,
    );
  });

  it("'auto' follows the UI locale for both date and date-time formatting", () => {
    expect(formatDateWithFormat(epoch, "auto", "fr")).toBe(
      epoch.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }),
    );
    expect(formatDateWithFormat(epoch, "auto", "en")).toBe(
      epoch.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    );
  });
});

describe("applyResolvedLocale", () => {
  it("sets i18n.global.locale and the root element's lang attribute", () => {
    applyResolvedLocale("fr");
    expect(i18n.global.locale.value).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");

    applyResolvedLocale("en");
    expect(i18n.global.locale.value).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("attachLocaleListener", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Deterministic regardless of the machine running the suite.
    vi.stubGlobal("navigator", { ...navigator, languages: ["en-US"] });
  });

  it("applies the resolved locale immediately on attach", () => {
    const settings = useSettingsStore();
    attachLocaleListener(settings);

    expect(i18n.global.locale.value).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("updates the resolved locale when settings.locale changes", async () => {
    const settings = useSettingsStore();
    attachLocaleListener(settings);

    settings.locale = "fr";
    await vi.waitFor(() => {
      expect(i18n.global.locale.value).toBe("fr");
      expect(document.documentElement.lang).toBe("fr");
    });
  });
});
