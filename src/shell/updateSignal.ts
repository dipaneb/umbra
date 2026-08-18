import { ref, shallowReadonly, shallowRef } from "vue";
import { checkForUpdate, type Update } from "./updateCheck";

// Ephemeral, cross-component update-check state: AppSidebar's dot, SettingsView's Privacy
// banner, and UpdateDialog all need to read "is there a pending update, and what severity",
// and SettingsView/UpdateDialog both need to coordinate the dialog's open/close state — but
// the three are flat siblings/a separately routed view with no shared parent to hold that
// state (App.vue). AD-6 scopes the two Pinia stores to persisted state and tool state
// respectively; this is neither (never written to disk — only the dismissal outcome is, via
// the settings store), so a plain module-level singleton is the right fit here, the same
// "shell owns a cross-cutting concern as a shared module" pattern already used by icons.ts
// (resolveIcon) and clipboard.ts (AD-14).
//
// The underlying refs are private; only runCheck()/openDialog()/closeDialog() (and the
// test-only setters below) may write them, so consumers can't bypass those functions by
// reaching into `.value` directly.
const _pendingUpdate = shallowRef<Update | null>(null);
const _dialogOpen = ref(false);

// shallowReadonly, not readonly: plain readonly() would deep-wrap the returned Update
// instance in a new Proxy on every read, breaking reference identity (`pendingUpdate.value
// === update`) and risking real Tauri Update methods that touch private class fields via
// `this` — which a Proxy's receiver isn't the original instance for. shallowReadonly only
// guards `.value` reassignment itself, matching the underlying shallowRef's own semantics.
export const pendingUpdate = shallowReadonly(_pendingUpdate);
export const dialogOpen = shallowReadonly(_dialogOpen);

export async function runCheck(): Promise<void> {
  try {
    _pendingUpdate.value = await checkForUpdate();
  } catch (error) {
    console.error("updateSignal: background update check failed", error);
  }
}

export function openDialog(): void {
  _dialogOpen.value = true;
}

export function closeDialog(): void {
  _dialogOpen.value = false;
}

// Test-only escape hatch: specs simulate "a check already ran and found X" without driving
// the real checkForUpdate()/runCheck() flow. Not for use outside test setup.
export function __setPendingUpdateForTest(value: Update | null): void {
  _pendingUpdate.value = value;
}

export function __setDialogOpenForTest(value: boolean): void {
  _dialogOpen.value = value;
}
