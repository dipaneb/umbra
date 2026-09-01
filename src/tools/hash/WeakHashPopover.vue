<script setup lang="ts">
// AC13: MD5 / SHA-1 are flagged as not collision-resistant. Rather than a
// qualifier crammed onto every label (it doubled every row's height and blew
// out the checkbox row), the explanation lives behind a `?` — the reusable
// AppPopover + help-dot pattern UuidView established for its v4-vs-v7
// explainer. One shared trigger component, used on the "Algorithms" legend
// and on each weak result row.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppPopover from "../../components/AppPopover.vue";

// `algorithm` names the one row this instance sits on (e.g. "MD5"), giving
// it a distinct accessible name from the legend's general instance and from
// a sibling row's instance — without it, every WeakHashPopover on the page
// shared the exact same aria-label/dialog-label (code review, Story 8.4).
// Omitted on the legend, which covers both flagged algorithms generally.
const props = withDefaults(
  defineProps<{
    placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
    algorithm?: string;
  }>(),
  { placement: "bottom-start", algorithm: undefined },
);

const { t } = useI18n();

const dialogLabel = computed(() =>
  props.algorithm
    ? t("tools.hash.weakHelpLabelFor", { algorithm: props.algorithm })
    : t("tools.hash.weakHelpLabel"),
);
const triggerLabel = computed(() =>
  props.algorithm
    ? t("tools.hash.weakHelpTriggerFor", { algorithm: props.algorithm })
    : t("tools.hash.weakHelpTrigger"),
);
const heading = computed(() =>
  props.algorithm
    ? t("tools.hash.weakHelpHeadingFor", { algorithm: props.algorithm })
    : t("tools.hash.weakHelpHeading"),
);
</script>

<template>
  <AppPopover
    :label="dialogLabel"
    :placement="placement"
  >
    <template #trigger="{ toggle, triggerProps }">
      <button
        type="button"
        class="help-dot"
        v-bind="triggerProps"
        :aria-label="triggerLabel"
        @click="toggle"
      >
        ?
      </button>
    </template>
    <h2 class="popover-heading">
      {{ heading }}
    </h2>
    <p class="popover-body">
      {{ t('tools.hash.weakHelpBody') }}
    </p>
  </AppPopover>
</template>

<style scoped>
/* 24x24 hit area with a 16px visible ring inset — an inline help affordance
   shouldn't be a sub-target-size tap. Copied from UuidView's `.help-dot`. */
.help-dot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: var(--font-caption-size);
  font-weight: var(--font-label-weight);
  line-height: 1;
  cursor: pointer;
}

.help-dot::before {
  content: "";
  position: absolute;
  inset: var(--spacing-1);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-full);
}

.help-dot:hover {
  color: var(--color-text-primary);
}

.help-dot:hover::before {
  border-color: var(--color-text-secondary);
}

.help-dot:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
  border-radius: var(--radius-full);
}

.popover-heading {
  margin: 0 0 var(--spacing-2);
  font-family: var(--font-heading-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-heading-weight);
  color: var(--color-text-primary);
}

.popover-body {
  margin: 0;
  color: var(--color-text-secondary);
}
</style>
