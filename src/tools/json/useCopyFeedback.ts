import { ref } from "vue";

// Shared by JsonTree.vue's (Explorer) and JsonView.vue's (Query) per-row
// copy-value/copy-path buttons — both need the same "briefly confirm which
// exact button was just clicked" behavior, keyed by a caller-chosen string
// (e.g. `${row.path}:value`) since several copy buttons can exist on screen
// at once and only the one actually clicked should show feedback.
const FEEDBACK_DURATION_MS = 1500;

export function useCopyFeedback() {
  const copiedKey = ref<string | null>(null);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function isCopied(key: string): boolean {
    return copiedKey.value === key;
  }

  // Callers mark a key copied only *after* the clipboard write itself
  // succeeds — a failed write already has its own error-alert path and
  // should never also flash a false "copied" confirmation.
  function markCopied(key: string): void {
    if (timeoutId !== null) clearTimeout(timeoutId);
    copiedKey.value = key;
    timeoutId = setTimeout(() => {
      copiedKey.value = null;
      timeoutId = null;
    }, FEEDBACK_DURATION_MS);
  }

  // Otherwise a pending timeout fires into a ref nobody reads after the
  // component unmounts — same class of cleanup this codebase's debounced
  // watchers already do in their own `onUnmounted` hooks.
  function cancel(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    copiedKey.value = null;
  }

  return { isCopied, markCopied, cancel };
}
