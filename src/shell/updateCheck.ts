import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

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
export function getUpdateSeverityLabel(severity: UpdateSeverity): string {
  return severity === "security" ? "Security update available" : "Update available";
}

// This project's principle (Story 7.6) is not leaking internal/implementation-facing
// markup to end users, so the marker is stripped before the notes reach any UI surface.
export function stripSeverityMarker(body: string | undefined): string | undefined {
  return body?.replace(SECURITY_MARKER, "");
}

// Update.date is a plain, unparsed string (latest.json's optional pub_date field passed
// straight through by the plugin — confirmed via its own .d.ts, never a Date object).
// Formats it for display; returns undefined (not the string "Invalid Date") for a missing
// or unparseable value, so callers' existing `v-if="formatUpdateDate(...)"` correctly hides
// the line rather than render nonsense.
export function formatUpdateDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// Tauri's own documented pattern: downloadAndInstall() replaces the binary but does not relaunch
// the app on its own — relaunch() (from the separate process plugin) is required afterward, or a
// confirmed install would leave the user staring at the old, now-stale running instance.
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
