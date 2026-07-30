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
    try {
      const value = await invoke<string>(activeTool!.drop!.handler, { path, ...extraArgs });
      registry.dropResult = { toolId, value };
    } catch (err) {
      registry.dropResult = { toolId, error: toToolError(err) };
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
