<script setup lang="ts">
import AppSidebar from "./shell/AppSidebar.vue";
import CommandPalette from "./shell/CommandPalette.vue";
import DropZone from "./shell/DropZone.vue";
</script>

<template>
  <div class="shell">
    <AppSidebar />
    <main class="main-pane">
      <RouterView />
    </main>
    <CommandPalette />
    <DropZone />
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
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
}
</style>
