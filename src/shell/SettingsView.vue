<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useSettingsStore, type ThemeOverride } from "../stores/settings";
import { getUpdateSeverity, getUpdateSeverityLabel } from "./updateCheck";
import { openDialog, pendingUpdate } from "./updateSignal";
import AppButton from "../components/AppButton.vue";

const settings = useSettingsStore();
const updateSeverity = computed(() => getUpdateSeverity(pendingUpdate.value));
const updateSeverityLabel = computed(() => getUpdateSeverityLabel(updateSeverity.value));
const persistedEntries = ref<[string, unknown][]>([]);

// Local-only, not persisted: a one-off reveal for the raw stored-data list,
// not a preference worth remembering between visits. Defaults closed so a
// regular user never sees key/value internals unless they go looking.
const showAdvanced = ref(false);

async function refreshEntries(): Promise<void> {
  persistedEntries.value = await settings.entries();
}

onMounted(() => {
  void refreshEntries().catch((error: unknown) => {
    console.error("settings: failed to read persisted entries", error);
  });
});

function onToggleRestore(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  void settings.setRestoreEnabled(checked).catch((error: unknown) => {
    console.error("settings: failed to persist restore toggle", error);
  });
}

function onChangeTheme(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as ThemeOverride;
  void settings.setThemeOverride(value).catch((error: unknown) => {
    console.error("settings: failed to persist theme override", error);
  });
}

function onTogglePinnedVisible(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  void settings.setPinnedToolsVisible(checked).catch((error: unknown) => {
    console.error("settings: failed to persist pinned-tools visibility", error);
  });
}

function onToggleRecentVisible(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  void settings.setRecentToolsVisible(checked).catch((error: unknown) => {
    console.error("settings: failed to persist recent-tools visibility", error);
  });
}

function onToggleAdvanced(event: Event): void {
  showAdvanced.value = (event.target as HTMLInputElement).checked;
}

function onChangeClipboardSuggestionMaxCount(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  void settings.setClipboardSuggestionMaxCount(value).catch((error: unknown) => {
    console.error("settings: failed to persist clipboard-suggestion max count", error);
  });
  // The store's setter clamps `clipboardSuggestionMaxCount` synchronously (before any I/O),
  // so it already reflects the clamped value here. Force the input's own DOM value back in
  // sync explicitly rather than trusting the `:value` binding's reactive patch alone — an out-
  // of-range typed value (e.g. 9) otherwise visibly stayed on screen after tabbing away, even
  // though the persisted value was already correctly clamped (a UI-only bug, caught live).
  input.value = String(settings.clipboardSuggestionMaxCount);
}

async function onResetKey(key: string): Promise<void> {
  try {
    await settings.resetKey(key);
    await refreshEntries();
  } catch (error) {
    console.error(`settings: failed to reset ${key}`, error);
  }
}

async function onClearAll(): Promise<void> {
  try {
    await settings.clearAll();
    await refreshEntries();
  } catch (error) {
    console.error("settings: failed to clear persisted settings", error);
  }
}
</script>

<template>
  <section aria-labelledby="settings-heading">
    <h1 id="settings-heading">
      Settings
    </h1>

    <div
      v-if="updateSeverity !== 'none' && pendingUpdate"
      class="update-banner"
    >
      <h2 class="update-banner-heading">
        {{ updateSeverityLabel }}
      </h2>
      <p class="update-banner-version">
        Version {{ pendingUpdate.version }}
      </p>
      <AppButton
        type="button"
        variant="default"
        class="update-banner-action"
        @click="openDialog"
      >
        View update…
      </AppButton>
    </div>

    <div class="settings-section">
      <h2 class="section-heading">
        Appearance
      </h2>

      <label class="settings-toggle">
        <input
          type="checkbox"
          aria-label="Restore last tool and window position on launch"
          :checked="settings.restoreEnabled"
          @change="onToggleRestore"
        >
        Restore last tool and window position on launch
      </label>

      <label class="settings-toggle">
        Theme
        <select
          aria-label="Theme"
          :value="settings.themeOverride"
          @change="onChangeTheme"
        >
          <option value="system">
            System
          </option>
          <option value="light">
            Light
          </option>
          <option value="dark">
            Dark
          </option>
        </select>
      </label>

      <label class="settings-toggle">
        <input
          type="checkbox"
          aria-label="Show pinned tools in the sidebar"
          :checked="settings.pinnedToolsVisible"
          @change="onTogglePinnedVisible"
        >
        Show pinned tools
      </label>

      <label class="settings-toggle">
        <input
          type="checkbox"
          aria-label="Show recent tools in the sidebar"
          :checked="settings.recentToolsVisible"
          @change="onToggleRecentVisible"
        >
        Show recent tools
      </label>

      <label class="settings-toggle">
        Clipboard suggestions to show
        <input
          type="number"
          min="0"
          max="5"
          aria-label="Clipboard suggestions to show"
          :value="settings.clipboardSuggestionMaxCount"
          @change="onChangeClipboardSuggestionMaxCount"
        >
      </label>
    </div>

    <div class="settings-section">
      <h2 class="section-heading">
        Data
      </h2>
      <p>
        Umbra saves your preferences and recent activity on this device,
        including layout, theme, and recently used tools.
      </p>

      <button
        type="button"
        class="clear-all-button"
        aria-label="Clear all stored data"
        @click="onClearAll"
      >
        Clear all stored data
      </button>

      <label class="settings-toggle advanced-toggle">
        <input
          type="checkbox"
          aria-label="Show stored data"
          :checked="showAdvanced"
          @change="onToggleAdvanced"
        >
        Show stored data
      </label>

      <ul
        v-if="showAdvanced && persistedEntries.length"
        class="entries"
      >
        <li
          v-for="[key, value] in persistedEntries"
          :key="key"
        >
          <span class="entry-value">
            <code>{{ key }}</code>: {{ JSON.stringify(value) }}
          </span>
          <button
            type="button"
            class="reset-button"
            :aria-label="`Reset ${key}`"
            @click="onResetKey(key)"
          >
            Clear stored data
          </button>
        </li>
      </ul>
      <p
        v-else-if="showAdvanced"
        class="entries-empty"
      >
        Nothing is currently stored.
      </p>
    </div>

    <div class="settings-section">
      <h2 class="section-heading">
        Privacy
      </h2>
      <p>
        The only network call Umbra makes is an automatic check for updates.
        Nothing installs without your confirmation, and there's no telemetry.
      </p>
      <p>
        Umbra reads your clipboard locally to suggest a matching tool. Nothing leaves your device.
      </p>
    </div>
  </section>
</template>

<style scoped>
.settings-section + .settings-section {
  margin-top: var(--spacing-6);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-border-hairline);
}

.section-heading {
  margin: 0 0 var(--spacing-4);
  font-size: 0.75em;
  font-weight: var(--font-label-weight);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.settings-toggle {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin: 1em 0;
}

.advanced-toggle {
  margin-top: var(--spacing-4);
  color: var(--color-text-secondary);
  font-size: 0.9em;
}

.entries {
  list-style: none;
  margin: var(--spacing-4) 0 0;
  padding: 0;
}

.entries li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
  padding: 0.3em 0;
}

.entry-value {
  font-family: monospace;
}

.entries-empty {
  color: var(--color-text-secondary);
  margin-top: var(--spacing-4);
}

/* Sits above every settings section, not tucked inside Privacy at the
   bottom of the page — a pending update (especially a security one) is
   more important than any of the settings below it, so it needs to be the
   first thing seen, not something a user has to scroll past two sections
   to find. Reuses the same divider convention `.settings-section +
   .settings-section` uses below, just applied manually since this block
   isn't itself a `.settings-section`. */
.update-banner {
  margin-bottom: var(--spacing-6);
  padding-bottom: var(--spacing-6);
  border-bottom: 1px solid var(--color-border-hairline);
}

.update-banner-heading {
  margin: 0;
  font-weight: var(--font-label-weight);
}

.update-banner-version {
  margin: 0.3em 0 0;
  color: var(--color-text-secondary);
}

.update-banner-action {
  margin-top: var(--spacing-4);
}

.reset-button,
.clear-all-button {
  border-radius: var(--radius-default);
  padding: 0.4em 0.9em;
  font-family: inherit;
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  cursor: pointer;
}

/* Default/outlined — the workhorse treatment for the low-stakes, single-key
   reset action, kept visually distinct from the all-clear button so two
   differently-scoped destructive-ish actions don't read identically. No
   outline-button spec exists in DESIGN.md; this borrows its border from the
   licensed-neutral text-tertiary role rather than inventing a new color. */
.reset-button {
  background: transparent;
  border: 1px solid var(--color-text-tertiary);
  color: var(--color-text-primary);
}

.reset-button:hover {
  background: var(--color-bg-surface-raised);
}

/* Destructive — reserved for the high-consequence, hard-to-reverse all-clear
   action (DESIGN.md's own worked example for this exact button, INV-3).
   White-on-fill is a known, deliberately accepted AA trade-off in dark mode
   (DESIGN.md Colors) — not fixed here. */
.clear-all-button {
  background: var(--color-accent-destructive);
  border: none;
  color: white;
}

.clear-all-button:hover {
  opacity: 0.9;
}

input:focus-visible,
select:focus-visible,
button:focus-visible {
  outline: 2px solid #396cd8;
  outline-offset: 2px;
}
</style>
