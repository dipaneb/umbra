import { watch } from "vue";
import { i18n } from "../i18n";
import type { DateTimeFormat, LocaleOverride, useSettingsStore } from "../stores/settings";

export type SupportedLocale = "en" | "fr";

const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "fr"];

// Matches by base language subtag against an ordered preference list (e.g.
// `navigator.languages`) — "fr-CA" resolves to "fr" the same way "fr-FR"
// does, and the first supported match in preference order wins.
function matchSupportedLocale(languages: readonly string[]): SupportedLocale | undefined {
  for (const lang of languages) {
    const base = lang.split("-")[0]?.toLowerCase();
    const match = SUPPORTED_LOCALES.find((candidate) => candidate === base);
    if (match) return match;
  }
  return undefined;
}

// Mirrors theme.ts's resolveTheme: pure, unit-testable, no Vue/Pinia
// dependency. An explicit override always wins; "system" falls back to
// English when nothing in the preference list is supported.
export function resolveLocale(
  override: LocaleOverride,
  systemLanguages: readonly string[],
): SupportedLocale {
  if (override === "en" || override === "fr") return override;
  return matchSupportedLocale(systemLanguages) ?? "en";
}

const AUTO_LOCALE_TAG: Record<SupportedLocale, string> = { en: "en-US", fr: "fr-FR" };

// Deliberately takes the already-*resolved* UI locale, not the raw override
// or systemLanguages — resolveLocale() already did that work, and repeating
// it here would let the two disagree if either is ever changed independently.
// Returns "iso" as a sentinel this module's own format*() helpers special-
// case, not a real Intl locale tag; "system" returns `undefined`, which
// every Intl constructor already treats as "use the runtime/OS default" —
// this app's pre-i18n behavior (`toLocaleString(undefined)`).
export function resolveDateTimeLocale(
  format: DateTimeFormat,
  uiLocale: SupportedLocale,
): string | "iso" | undefined {
  switch (format) {
    case "iso":
      return "iso";
    case "system":
      return undefined;
    case "auto":
      return AUTO_LOCALE_TAG[uiLocale];
    default:
      return format; // "en-US" | "en-GB" | "fr-FR"
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatIsoDateTime(date: Date): string {
  return `${formatIsoDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Date-only formatting (the update dialog's "Released …" line). Pure and
// unit-testable — the exact same epoch under "iso"/"fr-FR"/"en-US" must
// produce three distinct, assertable strings (see locale.spec.ts).
export function formatDateWithFormat(
  date: Date,
  format: DateTimeFormat,
  uiLocale: SupportedLocale,
): string {
  const resolved = resolveDateTimeLocale(format, uiLocale);
  if (resolved === "iso") return formatIsoDate(date);
  return date.toLocaleDateString(resolved, { year: "numeric", month: "long", day: "numeric" });
}

// Date+time formatting (JWT claims, cron next-runs).
export function formatDateTimeWithFormat(
  date: Date,
  format: DateTimeFormat,
  uiLocale: SupportedLocale,
): string {
  const resolved = resolveDateTimeLocale(format, uiLocale);
  if (resolved === "iso") return formatIsoDateTime(date);
  return date.toLocaleString(resolved);
}

type DateTimeSettings = Pick<ReturnType<typeof useSettingsStore>, "locale" | "dateTimeFormat">;

// Convenience wrappers for component call sites — read navigator.languages
// directly (mirroring theme.ts's attachThemeListener reading matchMedia
// directly), so callers don't have to thread systemLanguages through.
export function formatDate(date: Date, settings: DateTimeSettings): string {
  const uiLocale = resolveLocale(settings.locale, navigator.languages);
  return formatDateWithFormat(date, settings.dateTimeFormat, uiLocale);
}

export function formatDateTime(date: Date, settings: DateTimeSettings): string {
  const uiLocale = resolveLocale(settings.locale, navigator.languages);
  return formatDateTimeWithFormat(date, settings.dateTimeFormat, uiLocale);
}

export function applyResolvedLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
}

// Attached once for the app's lifetime (src/main.ts) — mirrors theme.ts's
// attachThemeListener. Only watches settings.locale: dateTimeFormat has no
// app-wide side effect to apply (formatDate/formatDateTime above read it
// directly at call time, and Vue's own reactivity re-renders their callers).
export function attachLocaleListener(
  settings: ReturnType<typeof useSettingsStore>,
): void {
  const recompute = (): void => {
    applyResolvedLocale(resolveLocale(settings.locale, navigator.languages));
  };

  recompute();

  watch(() => settings.locale, recompute);
}
