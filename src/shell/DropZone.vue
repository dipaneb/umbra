<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useRegistryStore } from "../stores/registry";
import { resolveActiveTool, routeDrop, lastDrop } from "./dropZone";

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
  unlisten = await getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;

    const activeTool = resolveActiveTool(route.path, registry.tools);
    const routing = routeDrop(event.payload.paths, activeTool);

    if (!routing.accepted) {
      if (routing.noticeMessage) showNotice(routing.noticeMessage);
      return;
    }

    lastDrop.value = { toolId: routing.toolId!, paths: routing.paths! };
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
