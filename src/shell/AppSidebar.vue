<script setup lang="ts">
import { useRegistryStore } from "../stores/registry";

const registry = useRegistryStore();
</script>

<template>
  <nav aria-label="Tools">
    <ul>
      <li
        v-for="tool in registry.tools"
        :key="tool.id"
      >
        <RouterLink :to="tool.route">
          <span aria-hidden="true">{{ tool.icon }}</span>
          {{ tool.name }}
        </RouterLink>
      </li>
    </ul>
    <RouterLink
      to="/settings"
      class="settings-link"
    >
      <span aria-hidden="true">⚙</span>
      Settings
    </RouterLink>
  </nav>
</template>

<style scoped>
nav {
  width: 200px;
  border-right: 1px solid #e0e0e0;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

a {
  display: block;
  padding: 0.6em 1em;
  color: inherit;
  text-decoration: none;
}

a:focus-visible {
  outline: 2px solid #396cd8;
  outline-offset: -2px;
}
</style>
