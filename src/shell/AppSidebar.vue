<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useRegistryStore } from "../stores/registry";
import type { ToolRegistryEntry } from "../stores/registry";
import { useSettingsStore } from "../stores/settings";
import { resolveIcon } from "./icons";
import { getUpdateSeverity, getUpdateSeverityLabel } from "./updateCheck";
import { pendingUpdate } from "./updateSignal";
import { onClipboardChange, readClipboardText, type ClipboardChangeKind } from "./clipboard";
import type { ClipboardContent } from "./clipboardMatch";
import { createLatestWinsRunner } from "./invoke";
import {
  PhGear,
  PhCaretLeft,
  PhCaretRight,
  PhPushPin,
  PhPushPinSlash,
} from "@phosphor-icons/vue";

const { t } = useI18n();
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
      heading: t("shell.sidebar.pinnedHeading"),
      headingId: "nav-section-heading-pinned",
      listClass: "nav-pinned",
      tools: pinnedEntries.value,
    });
  }
  if (settings.recentToolsVisible && recentEntries.value.length > 0) {
    result.push({
      key: "recent",
      heading: t("shell.sidebar.recentHeading"),
      headingId: "nav-section-heading-recent",
      listClass: "nav-recent",
      tools: recentEntries.value,
    });
  }
  result.push({
    key: "all",
    heading: t("shell.sidebar.allToolsHeading"),
    headingId: "nav-section-heading-all",
    listClass: "nav-all",
    tools: registry.tools,
  });
  return result;
});

const updateSeverity = computed(() => getUpdateSeverity(pendingUpdate.value));
const updateSeverityLabel = computed(() => getUpdateSeverityLabel(updateSeverity.value));

// Story 7.8 (AC1/AC4/AC6/AC7/AC8/AC10/AC12): the clipboard-suggestion surface. Kept local to
// this component rather than a shared module like `updateSignal.ts` — unlike the update dot
// (needed by three unrelated components), only this sidebar renders this surface, so there's
// no genuine multi-consumer case for promoting it (see the story's own "Shared-module-vs-
// local-state judgment call precedent" Dev Note).
interface ClipboardMatchCandidate {
  tool: ToolRegistryEntry;
  preview: string | null;
}

const clipboardMatches = ref<ClipboardMatchCandidate[]>([]);
const clipboardAnnouncement = ref("");

// No source doc specifies an exact truncation length — chosen as a reasonable single-line
// preview length for the sidebar's ~200px width.
const PREVIEW_MAX_LENGTH = 50;

// Review finding: a large clipboard entry (a multi-MB log/data URI/JSON blob) would otherwise
// run every shape predicate synchronously on the main thread with no cap — this guards the
// AD-4 "trivial synchronous work" assumption the story's own Dev Notes rely on, which only
// holds for "typically-small" content, not unboundedly large content.
const CLIPBOARD_MATCH_MAX_CONTENT_LENGTH = 1_000_000;

function truncatePreview(value: string): string {
  const trimmed = value.trim();
  // Slices by Unicode code point (`Array.from`), not raw UTF-16 index — a plain `.slice()`
  // can split a surrogate pair (e.g. an emoji) in two, rendering a mangled trailing glyph.
  const characters = Array.from(trimmed);
  return characters.length > PREVIEW_MAX_LENGTH
    ? `${characters.slice(0, PREVIEW_MAX_LENGTH).join("")}…`
    : trimmed;
}

// AC7: most screen readers do not re-announce `aria-live` text set to an identical string —
// clearing the region on a `nextTick()` before re-setting it forces a real mutation each time,
// so the same tool suggested twice in a row from two different copies still announces. AC7's own
// text distinguishes the single-match case from the multi-match one ("e.g. '3 tools suggested
// from clipboard' vs. naming one tool") — a lone match names the tool directly rather than using
// the generic count wording.
async function announceClipboardMatchCount(matches: ClipboardMatchCandidate[]): Promise<void> {
  clipboardAnnouncement.value = "";
  await nextTick();
  if (matches.length === 0) return;
  clipboardAnnouncement.value =
    matches.length === 1
      ? t("shell.sidebar.clipboardSuggestedOne", { name: matches[0].tool.name })
      : t("shell.sidebar.clipboardSuggestedMany", { count: matches.length });
}

// AD-16: the read-and-match sequence below is async (`readClipboardText`), and two clipboard
// copies in quick succession (more likely on macOS's/Wayland's 500ms poll, per AC13) can have
// their reads/matches resolve out of order — this local runner (scoped to this component, with
// no other write-trigger reaching this state) guards against a stale match momentarily
// replacing a fresher one, the same race-prevention rule that fixed real bugs in Stories 2.3/2.5.
const runLatestWinsClipboardMatch = createLatestWinsRunner();

// Review finding: the match-list assignment and the live-region announcement now both run
// inside the same `runLatestWinsClipboardMatch` task (not just the clipboard read), so a call
// that's superseded never reaches either side effect — closing a gap where an older "winning"
// read could still race a newer one's independent announce sequence.
async function handleClipboardChange(kind: ClipboardChangeKind): Promise<void> {
  // AC6: not just hidden output — no matching work happens at all when suggestions are off.
  if (settings.clipboardSuggestionMaxCount === 0) return;

  let result;
  try {
    result = await runLatestWinsClipboardMatch<ClipboardMatchCandidate[]>(async () => {
      // AC12: the image case is constructed directly from the event payload — this text branch
      // is the only one that ever calls back into clipboard.ts, and even then only for text,
      // never `readClipboardImage()`.
      const content: ClipboardContent =
        kind === "image" ? { kind: "image" } : { kind: "text", value: await readClipboardText() };

      if (content.kind === "text" && content.value.length > CLIPBOARD_MATCH_MAX_CONTENT_LENGTH) {
        return [];
      }

      // AC3/AC4: iterates every registered entry's matcher generically (AD-5) rather than
      // hardcoding which tools are eligible; sorts by specificity descending, capped to the
      // configured count. `Array.prototype.sort` is stable in current JS engines, so equal-
      // specificity ties keep registry order (AC4's own tie-break requirement) with no
      // hand-rolled comparator needed.
      return registry.tools
        .filter((tool): tool is ToolRegistryEntry & { clipboardMatch: NonNullable<ToolRegistryEntry["clipboardMatch"]> } =>
          tool.clipboardMatch !== undefined && tool.clipboardMatch.test(content),
        )
        .sort((a, b) => b.clipboardMatch.specificity - a.clipboardMatch.specificity)
        .slice(0, settings.clipboardSuggestionMaxCount)
        .map((tool) => ({
          tool,
          preview: content.kind === "text" ? truncatePreview(content.value) : null,
        }));
    });
  } catch (error) {
    console.error("clipboard-match: failed to read/match clipboard content", error);
    return;
  }
  if (result.superseded) return;

  // AC10: always replaces the current list outright, including with an empty list.
  clipboardMatches.value = result.value;
  await announceClipboardMatchCount(clipboardMatches.value);
}

let unlistenClipboardChange: (() => void) | undefined;

onMounted(() => {
  unlistenClipboardChange = onClipboardChange((kind) => {
    void handleClipboardChange(kind);
  });
});

onUnmounted(() => {
  unlistenClipboardChange?.();
});

// Review finding: disabling suggestions (count -> 0) only stopped new matching work — an
// already-visible callout stayed on screen until the next clipboard change, which may never
// come in that session. "Off" now also clears whatever's currently showing.
watch(
  () => settings.clipboardSuggestionMaxCount,
  (count) => {
    if (count === 0) clipboardMatches.value = [];
  },
);
</script>

<template>
  <nav
    id="sidebar-nav"
    :aria-label="t('shell.sidebar.toolsNav')"
    :class="{ collapsed: settings.sidebarCollapsed }"
  >
    <button
      type="button"
      class="collapse-toggle"
      :aria-expanded="!settings.sidebarCollapsed"
      aria-controls="sidebar-nav"
      :aria-label="settings.sidebarCollapsed ? t('shell.sidebar.expandSidebar') : t('shell.sidebar.collapseSidebar')"
      @click="settings.setSidebarCollapsed(!settings.sidebarCollapsed)"
    >
      <component
        :is="settings.sidebarCollapsed ? PhCaretRight : PhCaretLeft"
        aria-hidden="true"
      />
    </button>
    <span
      role="status"
      class="visually-hidden"
    >{{ clipboardAnnouncement }}</span>
    <div class="nav-scroll">
      <div
        v-if="clipboardMatches.length > 0"
        class="clipboard-matches"
      >
        <RouterLink
          v-for="match in clipboardMatches"
          :key="match.tool.id"
          :to="match.tool.route"
          class="clipboard-match"
        >
          <span
            class="clipboard-match-label"
            :class="{ 'visually-hidden': settings.sidebarCollapsed }"
          >{{ t('shell.sidebar.clipboardMatchLabel') }}</span>
          <span class="clipboard-match-tool">
            <component
              :is="resolveIcon(match.tool.icon)"
              aria-hidden="true"
              size="1em"
            />
            <span :class="{ 'visually-hidden': settings.sidebarCollapsed }">{{ match.tool.name }}</span>
          </span>
          <span
            class="clipboard-match-preview"
            :class="{ 'visually-hidden': settings.sidebarCollapsed }"
          >{{ match.preview ?? t('shell.sidebar.imageCopied') }}</span>
        </RouterLink>
      </div>
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
              <span
                class="nav-label"
                :title="tool.name"
                :class="{ 'visually-hidden': settings.sidebarCollapsed }"
              >{{ tool.name }}</span>
            </RouterLink>
            <button
              v-if="!settings.sidebarCollapsed && settings.pinnedToolsVisible"
              type="button"
              class="pin-toggle"
              :aria-pressed="isPinned(tool.id)"
              :aria-label="isPinned(tool.id) ? t('shell.sidebar.unpinTool', { name: tool.name }) : t('shell.sidebar.pinTool', { name: tool.name })"
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
      <span class="settings-icon-wrap">
        <PhGear
          aria-hidden="true"
          size="1em"
          :weight="route.name === 'settings' ? 'bold' : 'regular'"
        />
        <span
          v-if="updateSeverity !== 'none'"
          aria-hidden="true"
          class="update-dot"
          :class="updateSeverity"
        />
      </span>
      <span :class="{ 'visually-hidden': settings.sidebarCollapsed }">{{ t('shell.sidebar.settings') }}</span>
      <span
        v-if="updateSeverity !== 'none'"
        class="visually-hidden"
      >{{ t('shell.sidebar.severitySuffix', { severity: updateSeverityLabel }) }}</span>
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
  /* Was a fixed 200px — French nav labels ("Correspondance presse-papiers"
     in the clipboard-match callout, "Tous les outils") run meaningfully
     longer than their English counterparts. `clamp()` keeps the sidebar at
     today's 200px by default but lets it grow up to 264px on a wider
     window, rather than clipping (`.nav-scroll` below sets
     `overflow-x: hidden`, so today's fixed width silently clips overflow
     instead of visibly breaking). */
  width: clamp(200px, 18vw, 264px);
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

/* Same flexbox-truncation reasoning as `.clipboard-match-preview` below:
   `min-width: 0` lets the label actually shrink to `a`'s available width
   (flex items default to `min-width: auto`, refusing to shrink below their
   own unwrapped text) so a long French tool label ellipsizes instead of
   pushing the pin button off the row's edge. `:title` on the element
   (template) surfaces the full name on hover for anything clipped. */
.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
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

/* Anchored to the icon itself (not the row) so the badge sits exactly at
   the gear's own corner in both expanded and collapsed sidebar states,
   rather than a fixed offset guessed against the row's variable padding. */
.settings-icon-wrap {
  position: relative;
  display: inline-flex;
}

/* Small corner badge touching the gear icon's top-right corner — no exact
   size is specified in DESIGN.md beyond color/role ("Notification dot",
   :184), so this follows the sidebar's existing corner-badge conventions
   rather than a locked pixel value. `pointer-events: none` keeps it a pure
   visual mark, never intercepting the link's own click. */
.update-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  pointer-events: none;
}

/* DESIGN.md's explicit, deliberate exception permitting red for this one
   non-destructive "pay attention" case (:194) — the only other role orange
   is licensed for outside active-nav tint. */
.update-dot.routine {
  background: var(--color-accent-signature);
}

.update-dot.security {
  background: var(--color-accent-destructive);
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

/* Story 7.8: the "Clipboard match" callout(s), stacked above the Pinned section. No dedicated
   DESIGN.md token exists for this exact treatment (confirmed absent by review-rubric.md §3) —
   this follows the Card-family "persistent surfaces get a border, not a shadow" rule instead,
   the closest documented precedent. */
.clipboard-matches {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  margin-bottom: 0.6em;
}

/* `a.clipboard-match` (not bare `.clipboard-match`) matches the specificity of the generic
   `a.router-link-exact-active`/`a:not(.router-link-exact-active):hover` rules above, so this
   block's later source position — not accidental specificity — decides which wins if a
   suggested tool also happens to be the current route. */
a.clipboard-match {
  display: flex;
  flex-direction: column;
  /* Overrides the bare `a { align-items: center; }` rule above (meant for the horizontal
     icon+label nav-item row) — without this, every child here shrinks to its own intrinsic
     width and centers, instead of stretching to the card's full width. Caught live: a
     `white-space: nowrap` preview line centered at its own unwrapped width overflows equally
     off both edges, showing a random middle slice instead of a clean head-truncated ellipsis. */
  align-items: stretch;
  gap: 0.2em;
  padding: 0.6em 1em;
  color: inherit;
  text-decoration: none;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
}

a.clipboard-match:hover,
a.clipboard-match.router-link-exact-active {
  background: var(--color-bg-surface-raised);
}

/* Same collapsed-row fix Story 7.4 had to apply to `a` itself (AppSidebar.vue's own prior
   collapsed-icon-disappearing bug): the callout's full-width padding alone would consume the
   entire collapsed nav's content box before its icon gets any space. */
nav.collapsed a.clipboard-match {
  padding-left: 0;
  padding-right: 0;
  align-items: center;
}

.clipboard-match-label {
  font-size: 0.75em;
  font-weight: var(--font-label-weight);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.clipboard-match-tool {
  display: flex;
  align-items: center;
  gap: 0.6em;
  font-weight: 700;
}

.clipboard-match-preview {
  font-family: var(--font-mono);
  font-size: 0.85em;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* Flex items default to `min-width: auto`, not 0 — without this, a `white-space: nowrap`
     child refuses to shrink below its own unwrapped text width and overflows past the row
     instead of being clipped, so `text-overflow: ellipsis` above silently never engages (the
     box grows to fit the content rather than the content being cut off within a fixed box).
     Classic flexbox-truncation gotcha, caught via manual testing: the un-clipped overflow
     visually reads as "centered, cut off on both edges" rather than a clean trailing ellipsis. */
  min-width: 0;
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
