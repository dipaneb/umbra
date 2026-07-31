<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useRegistryStore } from "../stores/registry";
import { toToolError } from "./toolError";
import { resolveActiveTool, routeDrop } from "./dropZone";

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

onMounted(async () => {
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
