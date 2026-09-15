import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { i18n } from "../i18n";
import { formatDate as formatLocaleDate, resolveLocale } from "./locale";
import type { useSettingsStore } from "../stores/settings";

export type { Update };

export async function checkForUpdate(): Promise<Update | null> {
  return check();
}

export type UpdateSeverity = "none" | "routine" | "security";

// Tauri's latest.json has no native severity field (Context7-confirmed) — this project's
// own convention, documented in docs/release-checklist.md: a leading, case-insensitive
// `[security]` tag on the release notes (the JS `Update.body` field, the documented
// binding for latest.json's `notes`) marks the release as security-urgent. Anchored to the
// very start on purpose — a mid-string match (e.g. "See [security] notes below") must not
// falsely escalate a routine release.
const SECURITY_MARKER = /^\[security\]\s*/i;

export function getUpdateSeverity(update: Update | null): UpdateSeverity {
  if (!update) return "none";
  return SECURITY_MARKER.test(update.body ?? "") ? "security" : "routine";
}

// Shared with AppSidebar.vue's accessible-name suffix and SettingsView.vue's banner
// heading (AC7) — a single source for these exact strings so the two can't drift apart.
// Reads i18n.global directly (a pure module, not a component, so useI18n()
// isn't available) — same pattern flattenJsonTree.ts's previewFor() uses.
export function getUpdateSeverityLabel(severity: UpdateSeverity): string {
  return severity === "security"
    ? i18n.global.t("shell.updateCheck.securityUpdateAvailable")
    : i18n.global.t("shell.updateCheck.updateAvailable");
}

// This project's principle (Story 7.6) is not leaking internal/implementation-facing
// markup to end users, so the marker is stripped before the notes reach any UI surface.
export function stripSeverityMarker(body: string | undefined): string | undefined {
  return body?.replace(SECURITY_MARKER, "");
}

// Tauri's latest.json `notes` field is a single string with no native per-locale
// variant (Context7-confirmed against the v2 updater docs — same schema for both the
// static-file and dynamic-server forms). This project's own convention, documented in
// docs/release-checklist.md, packs every supported language into that one string as
// `[xx]`-headed blocks — a `[security]`-marker line (matched, stripped above) then a
// bare `[en]`/`[fr]` line, then that language's notes, e.g.:
//   [en]
//   Fixes a crash when opening large files.
//
//   [fr]
//   Corrige un plantage lors de l'ouverture de fichiers volumineux.
// A header must be alone on its line (`$` before the newline) so it can't false-match
// inline bracket text elsewhere in the notes (e.g. "see [en] docs" mid-sentence).
const LOCALE_HEADER = /^\[([a-z]{2})][ \t]*$/gm;

// Releases tagged before this convention existed carry no `[xx]` headers at all — for
// those, `blocks` comes back empty and the caller falls back to the raw (unlabeled)
// text below, so old tags keep rendering exactly as they always have.
function parseLocaleBlocks(text: string): Map<string, string> {
  const headers = [...text.matchAll(LOCALE_HEADER)];
  const blocks = new Map<string, string>();
  headers.forEach((header, index) => {
    const start = header.index + header[0].length;
    const end = headers[index + 1]?.index ?? text.length;
    blocks.set(header[1].toLowerCase(), text.slice(start, end).trim());
  });
  return blocks;
}

// Picks this release's notes in the UI's current language: the resolved locale's block
// if present, else the "en" block (mirrors vue-i18n's own fallbackLocale in i18n/index.ts),
// else whichever block came first in the tag message. Takes `settings` rather than an
// already-resolved locale to match formatUpdateDate's convention just below — resolution
// stays centralized in resolveLocale (./locale), not duplicated at each call site.
export function getLocalizedNotes(
  body: string | undefined,
  settings: Pick<ReturnType<typeof useSettingsStore>, "locale">,
): string | undefined {
  const withoutSeverity = stripSeverityMarker(body);
  if (!withoutSeverity) return withoutSeverity;
  const blocks = parseLocaleBlocks(withoutSeverity);
  if (blocks.size === 0) return withoutSeverity.trim();
  const uiLocale = resolveLocale(settings.locale, navigator.languages);
  return blocks.get(uiLocale) ?? blocks.get("en") ?? blocks.values().next().value;
}

// Update.date is a plain, unparsed string (latest.json's optional pub_date field passed
// straight through by the plugin — confirmed via its own .d.ts, never a Date object).
// Formats it for display; returns undefined (not the string "Invalid Date") for a missing
// or unparseable value, so callers' existing `v-if="formatUpdateDate(...)"` correctly hides
// the line rather than render nonsense. Routed through formatDate (src/shell/locale.ts)
// rather than a bare `toLocaleDateString(undefined, ...)`, so this follows the app's
// locale/date-format settings instead of always the OS default (the pre-i18n behavior).
export function formatUpdateDate(
  date: string | undefined,
  settings: Pick<ReturnType<typeof useSettingsStore>, "locale" | "dateTimeFormat">,
): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatLocaleDate(parsed, settings);
}

// Tauri's own documented pattern: downloadAndInstall() replaces the binary but does not relaunch
// the app on its own — relaunch() (from the separate process plugin) is required afterward, or a
// confirmed install would leave the user staring at the old, now-stale running instance.
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
