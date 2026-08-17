<script setup lang="ts">
import { useRoute } from "vue-router";
import { useRegistryStore } from "../stores/registry";
import { useSettingsStore } from "../stores/settings";
import { resolveIcon } from "./icons";
import { PhGear, PhCaretLeft, PhCaretRight } from "@phosphor-icons/vue";

const registry = useRegistryStore();
const settings = useSettingsStore();
const route = useRoute();
</script>

<template>
  <nav
    id="sidebar-nav"
    aria-label="Tools"
    :class="{ collapsed: settings.sidebarCollapsed }"
  >
    <button
      type="button"
      class="collapse-toggle"
      :aria-expanded="!settings.sidebarCollapsed"
      aria-controls="sidebar-nav"
      :aria-label="settings.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="settings.setSidebarCollapsed(!settings.sidebarCollapsed)"
    >
      <component
        :is="settings.sidebarCollapsed ? PhCaretRight : PhCaretLeft"
        aria-hidden="true"
      />
    </button>
    <ul>
      <li
        v-for="tool in registry.tools"
        :key="tool.id"
      >
        <RouterLink :to="tool.route">
          <component
            :is="resolveIcon(tool.icon)"
            aria-hidden="true"
            size="1em"
            :weight="route.name === tool.id ? 'bold' : 'regular'"
          />
          <span :class="{ 'visually-hidden': settings.sidebarCollapsed }">{{ tool.name }}</span>
        </RouterLink>
      </li>
    </ul>
    <RouterLink
      to="/settings"
      class="settings-link"
    >
      <PhGear
        aria-hidden="true"
        size="1em"
        :weight="route.name === 'settings' ? 'bold' : 'regular'"
      />
      <span :class="{ 'visually-hidden': settings.sidebarCollapsed }">Settings</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
nav {
  width: 200px;
  padding: 0 var(--spacing-sidebar-padding);
  box-sizing: border-box;
  border-right: 1px solid var(--color-border-hairline);
  /* Shared with `a`'s vertical padding and the collapsed-width formula
     below, so the two can't silently drift out of sync with each other. */
  --nav-item-vertical-padding: 0.6em;
}

/* No target collapsed width is specified in DESIGN.md/EXPERIENCE.md. The
   icon-slot width below is deliberately not a guessed pixel value: it's
   `--font-label-size` (the icon's own explicit `size="1em"`, matching `a`'s
   `font-size`) plus `--nav-item-vertical-padding` on each side — the same
   custom property `a`'s own padding below reads from, so this can't drift
   out of sync the way a bare "2.2" constant could. That makes the collapsed
   icon's clickable/highlight box square by construction (matching its own
   height) rather than by a coincidentally-close literal. */
nav.collapsed {
  width: calc(
    var(--font-label-size) + var(--nav-item-vertical-padding) * 2 +
      var(--spacing-sidebar-padding) * 2
  );
}

/* `a`'s own 1em horizontal padding (below) is sized for the expanded row's
   icon+label layout — inside the collapsed 24px content box it alone
   exceeds the available width, and flexbox shrinks the icon's SVG to 0
   rather than overflow it, making every icon disappear. Collapsed rows
   need their own centered, padding-free layout instead. */
nav.collapsed a {
  padding-left: 0;
  padding-right: 0;
  justify-content: center;
}

.collapse-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  padding: 0.6em 0;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}

.collapse-toggle:hover {
  background: var(--color-bg-surface-raised);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

a {
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding: var(--nav-item-vertical-padding) 1em;
  color: inherit;
  text-decoration: none;
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  line-height: var(--font-label-line-height);
  /* DESIGN.md's `components:` block has no dedicated `nav-item` entry, only
     Card/buttons (`--radius-default`) and the floating `--radius-lg`. A nav
     item is a persistent, card-like surface, not a floating one, so it
     follows the Card/button precedent rather than inventing a new radius. */
  border-radius: var(--radius-default);
}

a:focus-visible,
.collapse-toggle:focus-visible {
  /* No dedicated focus-ring token exists in DESIGN.md. Orange is licensed
     for exactly two roles per the "budget of one" rule; "drawing attention
     to something that needs it" (a focus ring) fits the second role.
     Story 7.4 — see AppSidebar.vue:53-55's prior hardcoded #396cd8. */
  outline: 2px solid var(--color-accent-signature);
  outline-offset: -2px;
}

a.router-link-exact-active {
  background: var(--color-accent-signature-tint);
  /* --color-accent-signature-on-text is only defined in tokens.css's light
     [data-theme] block; the fallback resolves to --color-accent-signature,
     the AA-safe dark-mode value for orange text, so one rule covers both
     themes. Story 7.4. */
  color: var(--color-accent-signature-on-text, var(--color-accent-signature));
  /* No weight is named in DESIGN.md's Nav item prose either — confirmed
     directly against the locked mockup (step4.3-mockups-light.png), which
     renders the active label visibly bolder than --font-label-weight (500). */
  font-weight: 700;
}

a:not(.router-link-exact-active):hover {
  background: var(--color-bg-surface-raised);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
