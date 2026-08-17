<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useRegistryStore } from "../stores/registry";
import type { ToolRegistryEntry } from "../stores/registry";
import { useSettingsStore } from "../stores/settings";
import { resolveIcon } from "./icons";
import {
  PhGear,
  PhCaretLeft,
  PhCaretRight,
  PhPushPin,
  PhPushPinSlash,
} from "@phosphor-icons/vue";

const registry = useRegistryStore();
const settings = useSettingsStore();
const route = useRoute();

function isPinned(toolId: string): boolean {
  return settings.pinnedTools.includes(toolId);
}

function onTogglePin(toolId: string): void {
  settings.togglePinned(toolId).catch((error: unknown) => {
    console.error("settings: failed to persist pin toggle", error);
  });
}

// Both drop any id whose tool no longer exists in the registry — nothing
// today guards a stale pinned/recent id against a since-removed entry.
const pinnedEntries = computed<ToolRegistryEntry[]>(() =>
  settings.pinnedTools
    .map((id) => registry.tools.find((tool) => tool.id === id))
    .filter((tool): tool is ToolRegistryEntry => tool !== undefined),
);

// Write-time (settings.recordRecentTool) tracks raw recency only; the
// pinned-tools exclusion AC2 requires is enforced here, at render time —
// and only while the Pinned section is actually visible. AC2's own reason
// for the exclusion is "to avoid duplication" with Pinned; when Pinned is
// toggled off there's nothing to duplicate against, so hiding a tool's own
// recent usage from Recent at that point would just be confusing (it reads
// as "this tool wasn't used" when it was — it's simply pinned, invisibly).
const recentEntries = computed<ToolRegistryEntry[]>(() =>
  settings.recentTools
    .filter((id) => !settings.pinnedToolsVisible || !settings.pinnedTools.includes(id))
    .map((id) => registry.tools.find((tool) => tool.id === id))
    .filter((tool): tool is ToolRegistryEntry => tool !== undefined),
);

interface NavSection {
  key: string;
  heading: string;
  headingId: string;
  listClass: string;
  tools: ToolRegistryEntry[];
}

// A single row block below is reused across all three sections via this one
// computed list, instead of tripling the RouterLink+icon+label+pin-button
// markup — the same fix-applied-to-one-loop-missed-in-others drift risk
// Story 7.4's own review caught for joint-invariant test coverage. Every
// section (including "All tools") gets a heading, parallel to Pinned/Recent
// — an earlier draft left "All tools" nameless, which read as broken rather
// than intentional once real content was next to it.
const sections = computed<NavSection[]>(() => {
  const result: NavSection[] = [];
  if (settings.pinnedToolsVisible && pinnedEntries.value.length > 0) {
    result.push({
      key: "pinned",
      heading: "Pinned",
      headingId: "nav-section-heading-pinned",
      listClass: "nav-pinned",
      tools: pinnedEntries.value,
    });
  }
  if (settings.recentToolsVisible && recentEntries.value.length > 0) {
    result.push({
      key: "recent",
      heading: "Recent",
      headingId: "nav-section-heading-recent",
      listClass: "nav-recent",
      tools: recentEntries.value,
    });
  }
  result.push({
    key: "all",
    heading: "All tools",
    headingId: "nav-section-heading-all",
    listClass: "nav-all",
    tools: registry.tools,
  });
  return result;
});
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
    <div class="nav-scroll">
      <div
        v-for="section in sections"
        :key="section.key"
        class="nav-section"
      >
        <p
          v-if="!settings.sidebarCollapsed"
          :id="section.headingId"
          class="nav-section-heading"
        >
          {{ section.heading }}
        </p>
        <ul
          :class="section.listClass"
          :aria-labelledby="!settings.sidebarCollapsed ? section.headingId : undefined"
        >
          <li
            v-for="tool in section.tools"
            :key="tool.id"
            class="nav-item"
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
            <button
              v-if="!settings.sidebarCollapsed && settings.pinnedToolsVisible"
              type="button"
              class="pin-toggle"
              :aria-pressed="isPinned(tool.id)"
              :aria-label="(isPinned(tool.id) ? 'Unpin ' : 'Pin ') + tool.name"
              @click.stop.prevent="onTogglePin(tool.id)"
            >
              <component
                :is="isPinned(tool.id) ? PhPushPinSlash : PhPushPin"
                aria-hidden="true"
                size="1em"
              />
            </button>
          </li>
        </ul>
      </div>
    </div>
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
  /* Column flex so the tool-section list (`.nav-scroll`) can claim all
     leftover height and the Settings link can sit pinned below it — a plain
     block-flow nav (the pre-Story-7.5 shape) had no mechanism to push
     Settings anywhere but immediately after the last tool row. `nav` itself
     needs no explicit height: it's a flex item of `.shell` (`display: flex;
     height: 100vh`, App.vue), so its used height is already 100vh — the
     precondition `.nav-scroll`'s `min-height: 0` trick below depends on. */
  display: flex;
  flex-direction: column;
  width: 200px;
  /* Bottom padding added (was 0) so the now bottom-pinned Settings link
     isn't flush against the window edge — 0.6em matches
     `.collapse-toggle`'s own top padding for top/bottom symmetry. */
  padding: 0 var(--spacing-sidebar-padding) 0.6em;
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
  /* Column-flex nav item, not `flex: 1` like `.nav-scroll` below — the
     toggle stays its natural content height; `.nav-scroll` alone absorbs a
     short window's squeeze. */
  flex-shrink: 0;
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

/* The scrollable region between the collapse toggle and the Settings link.
   `flex: 1` claims all leftover height in the column-flex `nav`; `min-height:
   0` is the standard (and easy to forget) flexbox-scroll-child fix — without
   it a flex item's automatic minimum size is its own content height, so it
   refuses to shrink and nothing scrolls, it just overflows past `nav`'s
   edges. `overflow-x: hidden` is a second line of defense alongside `a svg`'s
   `flex-shrink: 0` below against text/icons ever spilling into the main
   pane. Also fixes a latent pre-existing gap: with three sections' worth of
   tools, content can exceed 100vh on a short window, and there was
   previously no way to scroll down to the items below the fold.
   `border-bottom` signals there's more content scrolling underneath, reusing
   the same hairline token as `nav`'s own right border. */
.nav-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 0.4em;
  padding-bottom: 0.4em;
  border-bottom: 1px solid var(--color-border-hairline);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Divider between sections, not on the heading itself, so it survives
   collapsed mode where headings are removed entirely — exactly where
   section separation matters most, since the same tool icon can otherwise
   repeat two or three times in a row with nothing explaining why. The
   adjacent-sibling combinator means zero dividers with one section, one with
   two, two with three — no conditional template logic needed for any of the
   three visibility combinations `pinnedToolsVisible`/`recentToolsVisible`
   can produce. Reuses the sidebar's own existing border token, same one
   already used for `nav`'s right border and `GridHome.vue`'s card border —
   never a new color value. */
.nav-section + .nav-section {
  margin-top: 0.6em;
  padding-top: 0.6em;
  border-top: 1px solid var(--color-border-hairline);
}

.nav-section-heading {
  /* No pin/section-header spec exists in DESIGN.md (confirmed absent) — a
     small neutral label licensed by DESIGN.md for non-semantic chrome,
     not an invented visual role. Top margin removed (was 0.8em) — vertical
     rhythm between sections now comes from `.nav-section + .nav-section`
     above; keeping both would double the gap under every divider. */
  margin: 0 0 0.2em;
  padding: 0 1em;
  font-size: 0.75em;
  font-weight: var(--font-label-weight);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.nav-item {
  display: flex;
  align-items: center;
}

a {
  display: flex;
  align-items: center;
  /* Fills the row's remaining width so the pin button lands at the row's
     trailing edge (`.nav-item` alone doesn't push it there — a plain
     `display: flex` on the `<li>` packs both children to the start) and the
     active/hover background still spans nearly the full row, matching the
     pre-pin-button rectangle. */
  flex: 1;
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

/* Guards against a real prior bug class (Story 7.4: flexbox shrinking an
   icon's SVG to 0 width inside the collapsed row, making it disappear) that
   `.nav-scroll`'s new `overflow-y: auto` could otherwise reintroduce on
   systems with "always show scrollbars" — the scrollbar steals a few px
   from the already-tight collapsed content box. */
a svg {
  flex-shrink: 0;
}

/* Direct child of the column-flex `nav`, sibling of `.nav-scroll` — pinned
   to the bottom of the sidebar rather than following the last tool row.
   `flex: none` is load-bearing, not cosmetic: the shared `a { flex: 1 }`
   rule above expands to `flex-grow: 1; flex-shrink: 1; flex-basis: 0%`,
   which — once this element is a direct column-flex item rather than a flex
   item's *label* — would make it compete with `.nav-scroll` for leftover
   height and balloon to roughly half the sidebar. `margin-top: auto` is
   redundant today (`.nav-scroll`'s own `flex: 1` already consumes all
   slack) but is cheap insurance if that ever changes. */
.settings-link {
  flex: none;
  margin-top: auto;
}

.pin-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* Vertical padding matches `a`'s own `--nav-item-vertical-padding`
     (0 previously) so the button's clickable box — and its focus ring —
     spans the row's full height instead of just the icon's own ~1em,
     rather than sitting small and centered inside a taller row. */
  padding: var(--nav-item-vertical-padding) 0.6em;
  color: var(--color-text-tertiary);
  background: none;
  border: none;
  /* Same Card/button radius token `a` uses just above — without it the
     focus outline (which follows an element's own border-radius) renders
     as a sharp rectangle, clashing with every other rounded focusable
     element in this file. */
  border-radius: var(--radius-default);
  cursor: pointer;
  /* Hover/focus-reveal via opacity, not display/visibility, so the button
     stays in the DOM and in tab order at all times — a Tab-only user must
     be able to reach and see it, the same screen-reader-trap class
     review-accessibility.md flagged against Story 7.4's collapsed-icon
     case. */
  opacity: 0;
}

/* Same hover treatment as `.collapse-toggle` — the file's other icon-only
   button — so directly hovering the pin button itself gives feedback, not
   just the row-hover opacity reveal above it. */
.pin-toggle:hover {
  background: var(--color-bg-surface-raised);
}

.nav-item:hover .pin-toggle,
.nav-item:focus-within .pin-toggle,
.pin-toggle:focus-visible {
  opacity: 1;
}

a:focus-visible,
.collapse-toggle:focus-visible,
.pin-toggle:focus-visible {
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
