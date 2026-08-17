<script setup lang="ts">
import { useRegistryStore } from "../stores/registry";
import { resolveIcon } from "./icons";

const registry = useRegistryStore();
</script>

<template>
  <div class="grid">
    <RouterLink
      v-for="tool in registry.tools"
      :key="tool.id"
      v-slot="{ navigate, href }"
      :to="tool.route"
      custom
    >
      <a
        class="card"
        :href="href"
        :aria-label="tool.name"
        @click="navigate"
        @keydown.space.prevent="navigate()"
      >
        <span class="icon-badge">
          <component
            :is="resolveIcon(tool.icon)"
            class="icon"
            aria-hidden="true"
          />
        </span>
        <span class="title">{{ tool.name }}</span>
        <span class="description">{{ tool.description }}</span>
      </a>
    </RouterLink>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-4);
}

.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: var(--spacing-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  color: inherit;
  text-decoration: none;
}

.icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: var(--color-accent-neutral-chip);
  border-radius: var(--radius-sm);
}

.icon {
  width: 24px;
  height: 24px;
  color: var(--color-text-primary);
}

.title {
  font-family: var(--font-heading-family);
  font-size: var(--font-heading-size);
  font-weight: var(--font-heading-weight);
  line-height: var(--font-heading-line-height);
  color: var(--color-text-primary);
}

.description {
  font-family: var(--font-body-family);
  font-size: var(--font-body-size);
  font-weight: var(--font-body-weight);
  line-height: var(--font-body-line-height);
  color: var(--color-text-secondary);
}

.card:focus-visible {
  outline: 2px solid #396cd8;
  outline-offset: -2px;
}
</style>
