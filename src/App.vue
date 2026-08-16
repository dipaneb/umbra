<script setup lang="ts">
import AppSidebar from "./shell/AppSidebar.vue";
import CommandPalette from "./shell/CommandPalette.vue";
import DropZone from "./shell/DropZone.vue";
import UpdateDialog from "./shell/UpdateDialog.vue";
</script>

<template>
  <div class="shell">
    <AppSidebar />
    <main class="main-pane">
      <RouterView />
    </main>
    <CommandPalette />
    <DropZone />
    <UpdateDialog />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
}

.main-pane {
  flex: 1;
  padding: 1.5em;
  overflow: auto;
}
</style>

<style>
:root {
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  font-weight: var(--font-body-weight);
  line-height: var(--font-body-line-height);
}
</style>
