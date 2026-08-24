<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import AppButton from "../../components/AppButton.vue";
import { readClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { formatDateTime } from "../../shell/locale";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import { useSettingsStore } from "../../stores/settings";
import type { JwtDecoded } from "./jwtDecoded";

const { t } = useI18n();
const settings = useSettingsStore();

const token = ref("");
const decoded = ref<JwtDecoded | null>(null);
const error = ref<ToolError | null>(null);

// No drop handler exists for this tool (JWTs are pasted, not dropped), so
// there's no other caller to coordinate latest-wins ordering with — a local
// runner is sufficient, unlike tools that also participate in file drops.
const runLatestWins = createLatestWinsRunner();

const prettyHeader = computed(() => (decoded.value ? JSON.stringify(decoded.value.header, null, 2) : ""));
const prettyPayload = computed(() => (decoded.value ? JSON.stringify(decoded.value.payload, null, 2) : ""));

// Core returns unix-seconds epoch values (never milliseconds); `Date`
// expects milliseconds, hence the `* 1000` here and in `isExpired` below.
// Routed through formatDateTime (src/shell/locale.ts) rather than a bare
// `toLocaleString()` so this follows the app's locale/date-format settings
// instead of always the OS default (the pre-i18n behavior).
function formatClaim(value: number | null): string {
  return value === null ? t("tools.jwt.claimNotPresent") : formatDateTime(new Date(value * 1000), settings);
}

const isExpired = computed(() => decoded.value?.exp != null && decoded.value.exp * 1000 < Date.now());

async function onDecode() {
  error.value = null;
  try {
    const result = await runLatestWins(() => invoke<JwtDecoded>("jwt_decode", { token: token.value }));
    if (!result.superseded) {
      decoded.value = result.value;
    }
  } catch (err) {
    decoded.value = null;
    error.value = toToolError(err);
  }
}

async function onPaste() {
  error.value = null;
  try {
    const result = await runLatestWins(() => readClipboardText());
    if (!result.superseded) {
      token.value = result.value;
      decoded.value = null;
    }
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section>
    <h1>{{ t('tools.jwt.heading') }}</h1>

    <p class="notice">
      {{ t('tools.jwt.notice') }}
    </p>

    <div class="field">
      <label for="jwt-token-input">{{ t('tools.jwt.tokenLabel') }}</label>
      <textarea
        id="jwt-token-input"
        v-model="token"
        rows="6"
        spellcheck="false"
        autocorrect="off"
      />
    </div>

    <div class="actions">
      <AppButton
        variant="primary"
        @click="onDecode"
      >
        {{ t('tools.jwt.decode') }}
      </AppButton>
      <AppButton @click="onPaste">
        {{ t('common.pasteFromClipboard') }}
      </AppButton>
    </div>

    <p
      v-if="error"
      role="alert"
    >
      {{ toolErrorMessage(error, t) }}
    </p>

    <div v-if="decoded">
      <p
        v-if="isExpired"
        role="status"
        class="expired"
      >
        {{ t('tools.jwt.expired') }}
      </p>

      <div class="field">
        <label>{{ t('tools.jwt.header') }}</label>
        <pre>{{ prettyHeader }}</pre>
      </div>

      <div class="field">
        <label>{{ t('tools.jwt.payload') }}</label>
        <pre>{{ prettyPayload }}</pre>
      </div>

      <ul class="claims">
        <li>
          <label>{{ t('tools.jwt.claimExpires') }}</label>
          <span>{{ formatClaim(decoded.exp) }}</span>
        </li>
        <li>
          <label>{{ t('tools.jwt.claimIssuedAt') }}</label>
          <span>{{ formatClaim(decoded.iat) }}</span>
        </li>
        <li>
          <label>{{ t('tools.jwt.claimNotBefore') }}</label>
          <span>{{ formatClaim(decoded.nbf) }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.notice {
  color: #666;
  font-size: 0.9em;
  border: 1px dashed #ccc;
  border-radius: 6px;
  padding: 0.6em 0.8em;
  margin-bottom: 1em;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  margin-bottom: 1em;
}

textarea,
pre {
  font-family: monospace;
}

pre {
  white-space: pre-wrap;
  word-break: break-all;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0.6em 0.8em;
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.6em;
  margin-bottom: 1em;
}

p[role="alert"] {
  color: #b00020;
}

p.expired {
  color: #b00020;
  font-weight: 600;
}

.claims {
  list-style: none;
  margin: 0;
  padding: 0;
}

.claims li {
  display: flex;
  align-items: center;
  /* Allows the label column to wrap onto its own line rather than crowd the
     value — "Valide à partir de (nbf)" runs longer than "Not before (nbf)". */
  flex-wrap: wrap;
  gap: 0.6em;
  padding: 0.4em 0;
}

.claims label {
  min-width: 8em;
  font-weight: 600;
}
</style>
