<script setup lang="ts">
import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { readClipboardText } from "../../shell/clipboard";
import { createLatestWinsRunner } from "../../shell/invoke";
import { toToolError, type ToolError } from "../../shell/toolError";
import type { JwtDecoded } from "./jwtDecoded";

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
function formatClaim(value: number | null): string {
  return value === null ? "not present" : new Date(value * 1000).toLocaleString();
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
    <h1>JWT</h1>

    <p class="notice">
      Signatures are not verified — this tool only decodes and displays a token's contents.
    </p>

    <div class="field">
      <label for="jwt-token-input">Token</label>
      <textarea
        id="jwt-token-input"
        v-model="token"
        rows="6"
      />
    </div>

    <div class="actions">
      <button
        type="button"
        @click="onDecode"
      >
        Decode
      </button>
      <button
        type="button"
        @click="onPaste"
      >
        Paste from clipboard
      </button>
    </div>

    <p
      v-if="error"
      role="alert"
    >
      {{ error.message }}
    </p>

    <div v-if="decoded">
      <p
        v-if="isExpired"
        role="status"
        class="expired"
      >
        This token is expired.
      </p>

      <div class="field">
        <label>Header</label>
        <pre>{{ prettyHeader }}</pre>
      </div>

      <div class="field">
        <label>Payload</label>
        <pre>{{ prettyPayload }}</pre>
      </div>

      <ul class="claims">
        <li>
          <label>Expires (exp)</label>
          <span>{{ formatClaim(decoded.exp) }}</span>
        </li>
        <li>
          <label>Issued at (iat)</label>
          <span>{{ formatClaim(decoded.iat) }}</span>
        </li>
        <li>
          <label>Not before (nbf)</label>
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
  gap: 0.6em;
  padding: 0.4em 0;
}

.claims label {
  min-width: 8em;
  font-weight: 600;
}
</style>
