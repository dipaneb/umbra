<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatDateTimeWithFormat, resolveLocale } from "./locale";
import { useSettingsStore, type DateTimeFormat, type LocaleOverride, type ThemeOverride } from "../stores/settings";
import { getUpdateSeverity, getUpdateSeverityLabel } from "./updateCheck";
import { openDialog, pendingUpdate } from "./updateSignal";
import AppButton from "../components/AppButton.vue";

const { t } = useI18n();
const settings = useSettingsStore();

// A live example next to each date-time format option (see the <select>
// below) is the only way the difference between "ISO 8601", "Français", and
// "English (US)" is actually legible — a bare option label doesn't show it.
// `now` is computed once at component creation, not re-ticked live: this is
// a format preview, not a clock, so a stale-by-minutes example is fine and
// avoids an unnecessary interval timer on a settings page.
const now = new Date();
const dateTimeFormatPreview = computed(() => {
  const uiLocale = resolveLocale(settings.locale, navigator.languages);
  return {
    iso: formatDateTimeWithFormat(now, "iso", uiLocale),
    "fr-FR": formatDateTimeWithFormat(now, "fr-FR", uiLocale),
    "en-US": formatDateTimeWithFormat(now, "en-US", uiLocale),
    "en-GB": formatDateTimeWithFormat(now, "en-GB", uiLocale),
  };
});
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

function onChangeLocale(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as LocaleOverride;
  void settings.setLocale(value).catch((error: unknown) => {
    console.error("settings: failed to persist locale override", error);
  });
}

function onChangeDateTimeFormat(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as DateTimeFormat;
  void settings.setDateTimeFormat(value).catch((error: unknown) => {
    console.error("settings: failed to persist date-time format", error);
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
      {{ t('shell.settings.heading') }}
    </h1>

    <div
      v-if="updateSeverity !== 'none' && pendingUpdate"
      class="update-banner"
    >
      <h2 class="update-banner-heading">
        {{ updateSeverityLabel }}
      </h2>
      <p class="update-banner-version">
        {{ t('shell.settings.version', { version: pendingUpdate.version }) }}
      </p>
      <AppButton
        type="button"
        variant="default"
        class="update-banner-action"
        @click="openDialog"
      >
        {{ t('shell.settings.viewUpdate') }}
      </AppButton>
    </div>

    <div class="settings-section">
      <h2 class="section-heading">
        {{ t('shell.settings.appearance') }}
      </h2>

      <label class="settings-toggle">
        <input
          type="checkbox"
          :aria-label="t('shell.settings.restoreLabel')"
          :checked="settings.restoreEnabled"
          @change="onToggleRestore"
        >
        {{ t('shell.settings.restoreLabel') }}
      </label>

      <label class="settings-toggle">
        {{ t('shell.settings.theme') }}
        <select
          :aria-label="t('shell.settings.theme')"
          :value="settings.themeOverride"
          @change="onChangeTheme"
        >
          <option value="system">
            {{ t('shell.settings.themeSystem') }}
          </option>
          <option value="light">
            {{ t('shell.settings.themeLight') }}
          </option>
          <option value="dark">
            {{ t('shell.settings.themeDark') }}
          </option>
        </select>
      </label>

      <label class="settings-toggle">
        {{ t('shell.settings.language') }}
        <select
          :aria-label="t('shell.settings.language')"
          :value="settings.locale"
          @change="onChangeLocale"
        >
          <option value="system">
            {{ t('shell.settings.languageSystem') }}
          </option>
          <!-- Deliberately not translated: a language's own name is
               conventionally shown in that language, so the option stays
               legible to someone stuck in a UI language they don't read
               (the whole reason this control exists). -->
          <option value="en">
            English
          </option>
          <option value="fr">
            Français
          </option>
        </select>
      </label>

      <label class="settings-toggle">
        {{ t('shell.settings.dateTimeFormat') }}
        <select
          :aria-label="t('shell.settings.dateTimeFormat')"
          :value="settings.dateTimeFormat"
          @change="onChangeDateTimeFormat"
        >
          <option value="auto">
            {{ t('shell.settings.dateTimeAuto') }} — {{ dateTimeFormatPreview[settings.locale === 'fr' ? 'fr-FR' : 'en-US'] }}
          </option>
          <option value="system">
            {{ t('shell.settings.dateTimeSystem') }}
          </option>
          <option value="iso">
            {{ t('shell.settings.dateTimeIso') }} — {{ dateTimeFormatPreview['iso'] }}
          </option>
          <option value="fr-FR">
            Français — {{ dateTimeFormatPreview['fr-FR'] }}
          </option>
          <option value="en-US">
            English (US) — {{ dateTimeFormatPreview['en-US'] }}
          </option>
          <option value="en-GB">
            English (UK) — {{ dateTimeFormatPreview['en-GB'] }}
          </option>
        </select>
      </label>

      <label class="settings-toggle">
        <input
          type="checkbox"
          :aria-label="t('shell.settings.showPinnedAriaLabel')"
          :checked="settings.pinnedToolsVisible"
          @change="onTogglePinnedVisible"
        >
        {{ t('shell.settings.showPinnedLabel') }}
      </label>

      <label class="settings-toggle">
        <input
          type="checkbox"
          :aria-label="t('shell.settings.showRecentAriaLabel')"
          :checked="settings.recentToolsVisible"
          @change="onToggleRecentVisible"
        >
        {{ t('shell.settings.showRecentLabel') }}
      </label>

      <label class="settings-toggle">
        {{ t('shell.settings.clipboardSuggestionsToShow') }}
        <input
          type="number"
          min="0"
          max="5"
          :aria-label="t('shell.settings.clipboardSuggestionsToShow')"
          :value="settings.clipboardSuggestionMaxCount"
          @change="onChangeClipboardSuggestionMaxCount"
        >
      </label>
    </div>

    <div class="settings-section">
      <h2 class="section-heading">
        {{ t('shell.settings.data') }}
      </h2>
      <p>
        {{ t('shell.settings.dataDescription') }}
      </p>

      <button
        type="button"
        class="clear-all-button"
        :aria-label="t('shell.settings.clearAllStoredData')"
        @click="onClearAll"
      >
        {{ t('shell.settings.clearAllStoredData') }}
      </button>

      <label class="settings-toggle advanced-toggle">
        <input
          type="checkbox"
          :aria-label="t('shell.settings.showStoredData')"
          :checked="showAdvanced"
          @change="onToggleAdvanced"
        >
        {{ t('shell.settings.showStoredData') }}
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
            :aria-label="t('shell.settings.resetKeyLabel', { key })"
            @click="onResetKey(key)"
          >
            {{ t('shell.settings.resetKeyAction') }}
          </button>
        </li>
      </ul>
      <p
        v-else-if="showAdvanced"
        class="entries-empty"
      >
        {{ t('shell.settings.nothingStored') }}
      </p>
    </div>

    <div class="settings-section">
      <h2 class="section-heading">
        {{ t('shell.settings.privacy') }}
      </h2>
      <p>
        {{ t('shell.settings.privacyNetwork') }}
      </p>
      <p>
        {{ t('shell.settings.privacyClipboard') }}
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
  /* Was a fixed single-line row with no wrap — French labels ("Restaurer le
     dernier outil et la position de la fenêtre au lancement") run noticeably
     longer than English, and this row already had the longest label in the
     app before translation. A control's own label must wrap rather than
     truncate (policy: buttons/setting labels always wrap, never clip). */
  flex-wrap: wrap;
  row-gap: 0.4em;
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
  flex-wrap: wrap;
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
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 2px;
}
</style>
