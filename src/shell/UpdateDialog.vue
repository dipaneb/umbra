<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { checkForUpdate, installUpdate, type Update } from "./updateCheck";

// shallowRef, not ref: `Update` is a class with private fields (extends Tauri's `Resource`) —
// deep-reactivity-wrapping it in a Proxy risks breaking its own internal private-field access,
// and TS's `UnwrapRef` strips private members from a deeply-wrapped class type entirely.
const pendingUpdate = shallowRef<Update | null>(null);
const installing = ref(false);
const installError = ref<string | null>(null);
const dialogRef = ref<HTMLElement | null>(null);

let previouslyFocused: HTMLElement | null = null;

async function runCheck(): Promise<void> {
  try {
    pendingUpdate.value = await checkForUpdate();
  } catch (error) {
    console.error("updateCheck: background update check failed", error);
  }
}

async function onInstall(): Promise<void> {
  const update = pendingUpdate.value;
  if (!update || installing.value) return;
  installing.value = true;
  installError.value = null;
  try {
    await installUpdate(update);
  } catch (error) {
    console.error("updateCheck: install failed", error);
    installError.value = "Update failed to install. Please try again.";
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
  pendingUpdate.value = null;
  try {
    await update?.close();
  } catch (error) {
    console.error("updateCheck: failed to release update resource", error);
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!pendingUpdate.value || installing.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    onDismiss();
  }
}

// Matches CommandPalette.vue's modal focus convention: capture what was focused before the
// dialog appeared, move focus into the dialog once it renders, restore focus on close.
watch(pendingUpdate, async (update) => {
  if (update) {
    previouslyFocused = document.activeElement as HTMLElement | null;
    await nextTick();
    dialogRef.value?.focus();
  } else {
    previouslyFocused?.focus();
  }
});

onMounted(() => {
  // Must stay decoupled from main.ts's mount()+show() critical path — see Dev Notes.
  void runCheck();
  window.addEventListener("keydown", onKeydown, true);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <div
    v-if="pendingUpdate"
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
        Update available: {{ pendingUpdate.version }}
      </h2>
      <p class="version-line">
        Current version {{ pendingUpdate.currentVersion }} → {{ pendingUpdate.version }}
      </p>
      <p
        v-if="pendingUpdate.date"
        class="date-line"
      >
        Released {{ pendingUpdate.date }}
      </p>
      <p
        v-if="pendingUpdate.body"
        class="release-notes"
      >
        {{ pendingUpdate.body }}
      </p>
      <p
        v-if="installError"
        role="alert"
        class="install-error"
      >
        {{ installError }}
      </p>
      <div class="actions">
        <button
          type="button"
          :disabled="installing"
          @click="onDismiss"
        >
          Not Now
        </button>
        <button
          type="button"
          :disabled="installing"
          @click="onInstall"
        >
          {{ installing ? "Installing…" : "Install & Restart" }}
        </button>
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
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  padding: 1.5em;
}

.update-dialog h2 {
  margin-top: 0;
}

.version-line,
.date-line {
  color: #666;
}

.release-notes {
  white-space: pre-wrap;
}

.install-error {
  color: #b00020;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.8em;
  margin-top: 1.5em;
}

button:focus-visible {
  outline: 2px solid #396cd8;
  outline-offset: 2px;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
