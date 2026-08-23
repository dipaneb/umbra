<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { formatUpdateDate, installUpdate, stripSeverityMarker } from "./updateCheck";
import { closeDialog, dialogOpen, pendingUpdate } from "./updateSignal";
import { useSettingsStore } from "../stores/settings";
import AppButton from "../components/AppButton.vue";

const { t } = useI18n();
const settings = useSettingsStore();
const installing = ref(false);
const installError = ref<string | null>(null);
const dialogRef = ref<HTMLElement | null>(null);

let previouslyFocused: HTMLElement | null = null;

async function onInstall(): Promise<void> {
  const update = pendingUpdate.value;
  if (!update || installing.value) return;
  installing.value = true;
  installError.value = null;
  try {
    await installUpdate(update);
  } catch (error) {
    console.error("updateCheck: install failed", error);
    installError.value = t("shell.updateDialog.installFailed");
    installing.value = false;
  }
}

async function onDismiss(): Promise<void> {
  // Guards against the case where the user clicks "Not Now" (or presses Esc) while an
  // install triggered by "Install & Restart" is still in flight — without this, the dialog
  // would hide while installUpdate() keeps running underneath and can still relaunch the
  // app after the user believed they'd declined.
  if (installing.value) return;
  const update = pendingUpdate.value;
  closeDialog();
  // Deliberately does NOT call update?.close() here: pendingUpdate stays set after dismiss
  // (AC4 — the dot/banner keep showing this same update for the rest of the session), and
  // the Settings banner can reopen this dialog on that same Update object later. Closing its
  // underlying resource on mere dismissal would make a subsequent Install attempt fail
  // against an already-closed resource.
  if (update) {
    try {
      await settings.setUpdateSignalDismissed(update.version);
    } catch (error) {
      console.error("settings: failed to persist update dismissal", error);
    }
  }
}

// Queries live, not cached: which elements are focusable changes at runtime (both actions
// get :disabled while installing.value is true), so a stale list would trap Tab against
// elements that can no longer hold focus.
function getFocusableElements(): HTMLElement[] {
  if (!dialogRef.value) return [];
  return Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function onKeydown(event: KeyboardEvent): void {
  if (!dialogOpen.value) return;
  if (event.key === "Escape") {
    // Unchanged: still suppressed mid-install (see onDismiss's own guard) so a stray
    // Escape can't hide the dialog while installUpdate() is still running underneath it.
    if (installing.value) return;
    event.preventDefault();
    onDismiss();
    return;
  }
  if (event.key === "Tab") {
    // Deliberately NOT gated on installing.value like Escape above — the opposite is
    // needed here: focus must stay trapped in the dialog for the entire time it's open,
    // installing or not. CommandPalette.vue's own modal swallows Tab outright, which works
    // there because it has exactly one focusable element; this dialog has two (Not Now,
    // Install & Restart) that must stay Tab-reachable between each other, so this cycles
    // first↔last instead of blocking Tab entirely.
    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      // Both actions are disabled (an install is in flight) -- nothing inside the dialog
      // can hold focus. Pin it back on the dialog container itself rather than let Tab
      // escape into the app behind the overlay.
      event.preventDefault();
      dialogRef.value?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !dialogRef.value?.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !dialogRef.value?.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }
}

// Matches CommandPalette.vue's modal focus convention: capture what was focused before the
// dialog appeared, move focus into the dialog once it renders, restore focus on close.
watch(dialogOpen, async (open) => {
  if (open) {
    // Clears any error left over from a previous, since-dismissed install attempt on this
    // same pendingUpdate — otherwise reopening the dialog shows a stale failure message
    // before the user has done anything in this new attempt.
    installError.value = null;
    previouslyFocused = document.activeElement as HTMLElement | null;
    await nextTick();
    dialogRef.value?.focus();
  } else {
    previouslyFocused?.focus();
  }
});

onMounted(() => {
  window.addEventListener("keydown", onKeydown, true);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <div
    v-if="dialogOpen && pendingUpdate"
    class="update-overlay"
  >
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-dialog-heading"
      class="update-dialog"
      tabindex="-1"
    >
      <h2 id="update-dialog-heading">
        {{ t('shell.updateDialog.headingAvailable', { version: pendingUpdate.version }) }}
      </h2>
      <p class="version-line">
        {{ t('shell.updateDialog.versionLine', { current: pendingUpdate.currentVersion, next: pendingUpdate.version }) }}
      </p>
      <p
        v-if="formatUpdateDate(pendingUpdate.date, settings)"
        class="date-line"
      >
        {{ t('shell.updateDialog.releasedLine', { date: formatUpdateDate(pendingUpdate.date, settings) }) }}
      </p>
      <p
        v-if="pendingUpdate.body"
        class="release-notes"
      >
        {{ stripSeverityMarker(pendingUpdate.body) }}
      </p>
      <p
        v-if="installError"
        role="alert"
        class="install-error"
      >
        {{ installError }}
      </p>
      <div class="actions">
        <AppButton
          type="button"
          variant="default"
          :disabled="installing"
          @click="onDismiss"
        >
          {{ t('shell.updateDialog.notNow') }}
        </AppButton>
        <AppButton
          type="button"
          variant="primary"
          :disabled="installing"
          @click="onInstall"
        >
          {{ installing ? t('shell.updateDialog.installing') : t('shell.updateDialog.installAndRestart') }}
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.update-dialog {
  width: 420px;
  max-width: 90vw;
  max-height: 70vh;
  overflow: auto;
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  /* Floating/temporary surfaces get a shadow, not a border — the inverse of persistent
     surfaces like cards. DESIGN.md:165,192. First real consumer of --shadow-floating. */
  box-shadow: var(--shadow-floating);
  padding: 1.5em;
}

.update-dialog h2 {
  margin-top: 0;
}

.version-line,
.date-line {
  color: var(--color-text-secondary);
}

.release-notes {
  white-space: pre-wrap;
  /* Scoped to just the notes paragraph, not the whole dialog: .update-dialog's own
     max-height/overflow (above) would otherwise scroll the Not Now/Install & Restart
     buttons out of view along with long notes. This keeps the actions always visible. */
  max-height: 12em;
  overflow-y: auto;
}

.install-error {
  color: var(--color-accent-destructive);
}

.actions {
  display: flex;
  /* Was single-line only — "Installer et redémarrer" runs noticeably longer
     than "Install & Restart", and this is the tightest button row in the
     app (420px dialog minus padding, two buttons). Wrapping keeps both
     buttons fully readable instead of letting the wider one overflow. */
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.8em;
  margin-top: 1.5em;
}
</style>
