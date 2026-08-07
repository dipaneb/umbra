<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readClipboardImage } from "./clipboard";
import { useRegistryStore } from "../stores/registry";
import { toToolError } from "./toolError";
import { isEditableTarget, resolveActiveTool, routeDrop, routePaste } from "./dropZone";

const route = useRoute();
const registry = useRegistryStore();

const noticeMessage = ref<string | null>(null);
let noticeTimeout: ReturnType<typeof setTimeout> | undefined;
let unlisten: (() => void) | undefined;

function showNotice(message: string) {
  noticeMessage.value = message;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => {
    noticeMessage.value = null;
  }, 3000);
}

// AD-14/AD-16: paste shares the exact same dispatch shape as drop above — resolve the active
// tool from the registry, look up its declared handler, run it through that tool's shared
// `getLatestWinsRunner` so a drop and a paste for the same tool participate in one latest-wins
// sequence (AC4), and discard the outcome if the tool is no longer active when it arrives.
async function dispatchPaste(toolId: string, handler: string) {
  const runLatestWins = registry.getLatestWinsRunner(toolId);

  function isStillActive(): boolean {
    return resolveActiveTool(route.path, registry.tools)?.id === toolId;
  }

  try {
    const result = await runLatestWins(async () => {
      const { rgba, width, height } = await readClipboardImage();
      return invoke<unknown>(handler, rgba, {
        headers: { "x-image-width": String(width), "x-image-height": String(height) },
      });
    });
    if (!result.superseded && isStillActive()) {
      registry.pasteResult = { toolId, value: result.value };
    }
  } catch (err) {
    if (isStillActive()) registry.pasteResult = { toolId, error: toToolError(err) };
  }
}

// Capture-phase, app-scope listener mirroring `CommandPalette.vue`'s own ⌘K pattern. ⌘V is the
// standard OS text-paste shortcut used everywhere in this app — this must NOT intercept it while
// focus is inside an editable element (Hash's textarea, JSON's input, Cron's fields, Bucket's own
// editable output field); only a non-editable target with a paste-declaring tool active means
// "paste an image" (Story 4.2).
function onKeydown(event: KeyboardEvent) {
  const isPasteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v";
  if (!isPasteShortcut || event.repeat || isEditableTarget(event.target)) return;

  const activeTool = resolveActiveTool(route.path, registry.tools);
  const routing = routePaste(activeTool);
  if (!routing.accepted) return;

  event.preventDefault();
  void dispatchPaste(routing.toolId!, routing.handler!);
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown, true);
  unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type !== "drop") return;

    const activeTool = resolveActiveTool(route.path, registry.tools);
    const routing = routeDrop(event.payload.paths, activeTool);

    if (!routing.accepted) {
      if (routing.noticeMessage) showNotice(routing.noticeMessage);
      return;
    }

    // AD-14: this is the shell's one generic dispatcher — it invokes the
    // registry-declared handler command directly. It only knows the dropped
    // path; any further, tool-specific arguments come from the active
    // tool's own registered provider (AD-6: the signal lives in the
    // `registry` store, not a bare module ref).
    const toolId = routing.toolId!;
    const path = routing.paths![0];
    const extraArgs = registry.dropArgsProviders[toolId]?.() ?? {};
    const runLatestWins = registry.getLatestWinsRunner(toolId);

    // AD-16: a result only reaches the store if its tool is still the
    // active one when the invoke resolves — otherwise the consuming view
    // has unmounted and the result is discarded, per AD-16, rather than
    // left to rot in `dropResult` for a watcher that will never fire again.
    function isStillActive(): boolean {
      return resolveActiveTool(route.path, registry.tools)?.id === toolId;
    }

    try {
      const result = await runLatestWins(() =>
        invoke<unknown>(activeTool!.drop!.handler, { path, ...extraArgs }),
      );
      if (!result.superseded && isStillActive()) {
        registry.dropResult = { toolId, value: result.value };
      }
    } catch (err) {
      if (isStillActive()) registry.dropResult = { toolId, error: toToolError(err) };
    }
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown, true);
  clearTimeout(noticeTimeout);
  unlisten?.();
});
</script>

<template>
  <p
    v-if="noticeMessage"
    role="status"
    class="drop-notice"
  >
    {{ noticeMessage }}
  </p>
</template>

<style scoped>
.drop-notice {
  position: fixed;
  bottom: 1.5em;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.6em 1.2em;
  background: #333;
  color: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
</style>
