import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type { Update };

export async function checkForUpdate(): Promise<Update | null> {
  return check();
}

// Tauri's own documented pattern: downloadAndInstall() replaces the binary but does not relaunch
// the app on its own — relaunch() (from the separate process plugin) is required afterward, or a
// confirmed install would leave the user staring at the old, now-stale running instance.
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
