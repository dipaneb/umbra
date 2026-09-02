<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { PhCheck, PhCopySimple } from "@phosphor-icons/vue";
import AppPopover from "../../components/AppPopover.vue";
import { writeClipboardText } from "../../shell/clipboard";
import { debounce } from "../../shell/debounce";
import { createLatestWinsRunner } from "../../shell/invoke";
import { formatDateTime } from "../../shell/locale";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import { useSettingsStore } from "../../stores/settings";
// Per-block copy confirmation — the JsonTree.vue / Base64View.vue /
// HashView.vue icon-button pattern (imported cross-tool from the JSON tool
// with its existing hoist-candidate comment; the hoist is still not done).
import { useCopyFeedback } from "../json/useCopyFeedback";
import type { JwtDecoded } from "./jwtDecoded";

const { t } = useI18n();
const settings = useSettingsStore();

// Mirrors umbra-core::jwt::MAX_TOKEN_BYTES (1 MiB). Caught here on the live
// path before an over-cap paste is ever shipped over IPC; umbra-core keeps
// its own identical guard (defense in depth, AC18 — the cap holds end to end
// even if this one is bypassed). Measured as UTF-8 bytes (TextEncoder), the
// same unit umbra-core's `token.len()` guard uses, so the two agree for any
// input — not just a pure-ASCII base64url token.
const MAX_TOKEN_BYTES = 1_048_576;

// Live-decode debounce — the same 200 ms as Base64View / JsonView / HashView.
const DECODE_DEBOUNCE_MS = 200;

// The live clock behind the expiry / not-yet-valid flags and the relative
// times. One tick a second keeps "in 1 minute" → "just now" and the expiry
// boundary responsive without a re-decode; decode itself is untouched.
const CLOCK_TICK_MS = 1000;

const token = ref("");
const decoded = ref<JwtDecoded | null>(null);
const error = ref<ToolError | null>(null);
const oversize = ref(false);
// AC21: an always-present polite region (a region inserted together with its
// text is not reliably announced) — cleared then re-set on each completed
// decode so an identical result still re-announces. Errors keep role="alert".
const announcement = ref("");
const now = ref(Date.now());

// No drop handler exists for this tool (JWTs are pasted, not dropped), so
// there's no other caller to coordinate latest-wins ordering with — a local
// runner is sufficient, unlike tools that also participate in file drops.
// It backs the single `decoded` write-surface, now driven by the debounced
// watch rather than two click handlers (AC20).
const runLatestWins = createLatestWinsRunner();

const { isCopied, markCopied, cancel: cancelCopyFeedback } = useCopyFeedback();

const prettyHeader = computed(() =>
  decoded.value ? JSON.stringify(decoded.value.header, null, 2) : "",
);
const prettyPayload = computed(() =>
  decoded.value ? JSON.stringify(decoded.value.payload, null, 2) : "",
);

// AC12: the header algorithm is only surfaced as a *warning*, and only for
// the dangerous cases — `alg: none`, `alg` absent, or `alg` present but not a
// string. A normal algorithm (HS256/RS256/ES256/…) gets no callout: it is
// already line 2 of the Header <pre>.
const algWarning = computed(() => {
  if (!decoded.value) return false;
  const alg = (decoded.value.header as Record<string, unknown>).alg;
  if (typeof alg !== "string") return true;
  // An empty or whitespace-only `alg` is as unreadable as a missing one, and
  // `" none "` is still `none` — trim before comparing.
  const normalized = alg.trim().toLowerCase();
  return normalized === "" || normalized === "none";
});

// --- Claims ---------------------------------------------------------------

type RawClaim =
  | { kind: "absent" }
  | { kind: "wrongType"; raw: unknown }
  | { kind: "number"; value: number };

// AC17: read the raw `payload` Value the view already holds — no JwtDecoded /
// jwtDecoded.ts change. A registered claim present with a non-number JSON
// type is a distinct state from an absent one.
function rawClaim(key: "exp" | "iat" | "nbf"): RawClaim {
  const payload = decoded.value?.payload as Record<string, unknown> | undefined;
  if (!payload || !(key in payload)) return { kind: "absent" };
  const raw = payload[key];
  if (typeof raw !== "number") return { kind: "wrongType", raw };
  return { kind: "number", value: raw };
}

// The JSON type word shown in the wrong-type note. Translated (it rides in a
// French sentence) — unlike `alg` identifiers and claim names, which are not.
function jsonTypeOf(value: unknown): string {
  if (value === null) return t("tools.jwt.typeNull");
  if (Array.isArray(value)) return t("tools.jwt.typeArray");
  if (typeof value === "boolean") return t("tools.jwt.typeBoolean");
  if (typeof value === "string") return t("tools.jwt.typeString");
  return t("tools.jwt.typeObject");
}

// AC16 (deferred-work fold-in #1): `value * 1000` can land past the range
// `new Date()` can represent for an epoch near the outer edge of the Rust i64 /
// RFC 7519 NumericDate range — which would then render "Invalid Date".
function outOfRange(seconds: number): boolean {
  // ±8.64e15 ms is the ECMAScript time-value limit — past it `new Date()` is
  // an Invalid Date. That band sits *below* Number.MAX_SAFE_INTEGER (~9.007e15),
  // so the guard has to be the Date limit, not the safe-integer limit, or an
  // epoch in the gap still renders "Invalid Date".
  const MAX_DATE_MS = 8_640_000_000_000_000;
  const ms = seconds * 1000;
  return !Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS;
}

const CLAIM_LABEL_KEYS = {
  exp: "tools.jwt.claimExpires",
  iat: "tools.jwt.claimIssuedAt",
  nbf: "tools.jwt.claimNotBefore",
} as const;

interface ClaimRow {
  key: "exp" | "iat" | "nbf";
  label: string;
  kind: "absent" | "wrongType" | "outOfRange" | "datetime";
  raw?: string;
  note?: string;
  absolute?: string;
  relative?: string;
}

const claimRows = computed<ClaimRow[]>(() => {
  void now.value; // re-derive the relative times on each clock tick
  return (["exp", "iat", "nbf"] as const).map((key): ClaimRow => {
    const label = t(CLAIM_LABEL_KEYS[key]);
    const claim = rawClaim(key);
    if (claim.kind === "absent") return { key, label, kind: "absent" };
    if (claim.kind === "wrongType") {
      return {
        key,
        label,
        kind: "wrongType",
        raw: JSON.stringify(claim.raw),
        note: t("tools.jwt.claimWrongType", { type: jsonTypeOf(claim.raw) }),
      };
    }
    if (outOfRange(claim.value)) return { key, label, kind: "outOfRange" };
    return {
      key,
      label,
      kind: "datetime",
      absolute: formatDateTime(new Date(claim.value * 1000), settings),
      relative: relativeFromNow(claim.value * 1000),
    };
  });
});

// A registered timestamp claim as a usable epoch, or null when it is absent,
// the wrong type, or out of representable range — drives the live flags.
function claimSeconds(key: "exp" | "nbf"): number | null {
  const claim = rawClaim(key);
  if (claim.kind !== "number" || outOfRange(claim.value)) return null;
  return claim.value;
}

const isExpired = computed(() => {
  const s = claimSeconds("exp");
  return s !== null && s * 1000 < now.value;
});
const isNotYetValid = computed(() => {
  const s = claimSeconds("nbf");
  return s !== null && s * 1000 > now.value;
});
const notYetValidText = computed(() => {
  const s = claimSeconds("nbf");
  return s === null ? "" : t("tools.jwt.notYetValid", { when: relativeFromNow(s * 1000) });
});

// AC15: the largest whole unit, recomputed off the live clock. "just now"
// under ~60 s. Unit words are i18n keys (One/Other, no vue-i18n `|` plural
// syntax so the strings stay literal for locales.spec.ts).
function unitLabel(name: "Year" | "Month" | "Week" | "Day" | "Hour" | "Minute", n: number): string {
  return t(`tools.jwt.relative${name}${n === 1 ? "One" : "Other"}`, { n });
}

function relativeFromNow(targetMs: number): string {
  const diffMs = targetMs - now.value;
  const absSec = Math.abs(diffMs) / 1000;
  if (absSec < 60) return t("tools.jwt.relativeNow");
  const table: [number, "Year" | "Month" | "Week" | "Day" | "Hour" | "Minute"][] = [
    [31_536_000, "Year"],
    [2_592_000, "Month"],
    [604_800, "Week"],
    [86_400, "Day"],
    [3_600, "Hour"],
    [60, "Minute"],
  ];
  for (const [secs, name] of table) {
    const n = Math.floor(absSec / secs);
    if (n >= 1) {
      const value = unitLabel(name, n);
      return diffMs >= 0
        ? t("tools.jwt.relativeFuture", { value })
        : t("tools.jwt.relativePast", { value });
    }
  }
  return t("tools.jwt.relativeNow");
}

// --- Decode ------------------------------------------------------------------

// AC21: clear the always-present polite region, then (next tick) set it to
// `message` so an identical result still re-announces. Pass "" to just clear.
async function announce(message: string) {
  announcement.value = "";
  if (message === "") return;
  await nextTick();
  announcement.value = message;
}

// Bumped at the top of every runDecode. The empty / oversize branches return
// without going through runLatestWins, so they cannot rely on its `superseded`
// flag to fence a slower in-flight decode — this generation check does it for
// every exit path.
let decodeGeneration = 0;

async function runDecode() {
  const generation = ++decodeGeneration;
  error.value = null;
  cancelCopyFeedback();
  const value = token.value;

  if (value.trim() === "") {
    decoded.value = null;
    oversize.value = false;
    void announce("");
    return;
  }

  // AC18: an over-cap paste never reaches IPC — and it is a calm status line,
  // not a red alert. Byte length (TextEncoder), matching umbra-core's guard,
  // so a large non-ASCII paste is caught here too.
  if (new TextEncoder().encode(value).length > MAX_TOKEN_BYTES) {
    decoded.value = null;
    oversize.value = true;
    void announce(t("tools.jwt.oversize"));
    return;
  }
  oversize.value = false;

  try {
    const result = await runLatestWins(() =>
      invoke<JwtDecoded>("jwt_decode", { token: value }),
    );
    if (result.superseded || generation !== decodeGeneration) return;
    decoded.value = result.value;
    void announce(t("tools.jwt.decodedAnnouncement"));
  } catch (err) {
    // runLatestWins swallows a stale rejection as `{ superseded: true }`; the
    // generation check additionally drops a rejection whose run was overtaken
    // by an empty / oversize call (which never touches runLatestWins).
    if (generation !== decodeGeneration) return;
    decoded.value = null;
    error.value = toToolError(err);
    void announce("");
  }
}

const debouncedDecode = debounce(() => void runDecode(), DECODE_DEBOUNCE_MS);

// AC7: a text edit waits out the 200 ms debounce; a discrete non-text change
// re-runs immediately. None exist for this tool today — the else branch is
// kept so a discrete source could be added to the watch without restructuring
// (the Base64View / HashView shape).
watch([token], ([nextToken], [prevToken]) => {
  if (nextToken !== prevToken) {
    debouncedDecode();
  } else {
    debouncedDecode.cancel();
    void runDecode();
  }
});

let clockTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, CLOCK_TICK_MS);
});
onUnmounted(() => {
  if (clockTimer !== undefined) clearInterval(clockTimer);
  debouncedDecode.cancel();
  cancelCopyFeedback();
});

async function onCopyBlock(value: string, key: "header" | "payload") {
  error.value = null;
  try {
    await writeClipboardText(value);
    // Confirm only after the write actually resolves — a failed write has
    // its own error-alert path and must not also flash a false confirmation.
    markCopied(key);
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section class="jwt-view">
    <h1>{{ t('tools.jwt.heading') }}</h1>

    <!-- AC9: a plain one-line honesty caption — no border, no box (the dashed
         box is the app's file-drop signal, and JWT has no drop path). The `?`
         opens the longer explanation. -->
    <div class="tool-desc">
      <span>{{ t('tools.jwt.caption') }}</span>
      <!-- Preferred placement bottom-start (grows rightward); AppPopover flips
           it to bottom-end on a narrow window where the `?` sits near the
           pane's right edge and the panel would otherwise clip. -->
      <AppPopover :label="t('tools.jwt.helpLabel')">
        <template #trigger="{ toggle, triggerProps }">
          <button
            type="button"
            class="help-dot"
            v-bind="triggerProps"
            :aria-label="t('tools.jwt.helpTrigger')"
            @click="toggle"
          >
            ?
          </button>
        </template>
        <h2 class="popover-heading">
          {{ t('tools.jwt.helpHeading') }}
        </h2>
        <p class="popover-body">
          {{ t('tools.jwt.helpBody') }}
        </p>
      </AppPopover>
    </div>

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

    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </p>

    <p
      v-if="error"
      class="alert"
      role="alert"
    >
      {{ toolErrorMessage(error, t) }}
    </p>

    <p
      v-if="oversize"
      class="jwt-status jwt-status-oversize"
      role="status"
    >
      {{ t('tools.jwt.oversize') }}
    </p>

    <div
      v-if="decoded && !oversize"
      class="decoded"
    >
      <!-- AC12: conditional unsigned-alg warning — boxless, destructive
           accent + a small triangle glyph. Only for none / absent / non-string. -->
      <p
        v-if="algWarning"
        class="alg-warning"
      >
        <svg
          class="alg-warning-glyph"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 2.4 15 13.6H1Z"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path
            d="M8 6.5v3.2"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
          <circle
            cx="8"
            cy="11.7"
            r="0.85"
            fill="currentColor"
          />
        </svg>
        {{ t('tools.jwt.unsignedWarning') }}
      </p>

      <div class="block">
        <div class="block-hd">
          <span class="block-label">{{ t('tools.jwt.header') }}</span>
          <button
            type="button"
            class="block-copy"
            :aria-label="isCopied('header') ? t('tools.jwt.copied') : t('common.copyToClipboard')"
            @click="onCopyBlock(prettyHeader, 'header')"
          >
            <PhCheck
              v-if="isCopied('header')"
              class="block-copy-ok"
              aria-hidden="true"
            />
            <PhCopySimple
              v-else
              aria-hidden="true"
            />
          </button>
        </div>
        <pre class="block-pre">{{ prettyHeader }}</pre>
      </div>

      <div class="block">
        <div class="block-hd">
          <span class="block-label">{{ t('tools.jwt.payload') }}</span>
          <button
            type="button"
            class="block-copy"
            :aria-label="isCopied('payload') ? t('tools.jwt.copied') : t('common.copyToClipboard')"
            @click="onCopyBlock(prettyPayload, 'payload')"
          >
            <PhCheck
              v-if="isCopied('payload')"
              class="block-copy-ok"
              aria-hidden="true"
            />
            <PhCopySimple
              v-else
              aria-hidden="true"
            />
          </button>
        </div>
        <pre class="block-pre">{{ prettyPayload }}</pre>
      </div>

      <ul class="claims">
        <li
          v-for="row in claimRows"
          :key="row.key"
        >
          <span class="claim-label">{{ row.label }}</span>
          <span
            v-if="row.kind === 'absent'"
            class="claim-absent"
          >
            {{ t('tools.jwt.claimNotPresent') }}
          </span>
          <template v-else-if="row.kind === 'wrongType'">
            <span class="claim-value">{{ row.raw }}</span>
            <span class="claim-note">{{ row.note }}</span>
          </template>
          <span
            v-else-if="row.kind === 'outOfRange'"
            class="claim-note"
          >
            {{ t('tools.jwt.claimOutOfRange') }}
          </span>
          <template v-else>
            <span class="claim-value">{{ row.absolute }}</span>
            <span class="claim-relative">({{ row.relative }})</span>
          </template>
        </li>
      </ul>

      <!-- AC13 / AC14: live-clock status lines, siblings, after the claims. -->
      <p
        v-if="isExpired"
        class="jwt-status jwt-status-expired"
        role="status"
      >
        {{ t('tools.jwt.expired') }}
      </p>
      <p
        v-if="isNotYetValid"
        class="jwt-status jwt-status-nbf"
        role="status"
      >
        {{ notYetValidText }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.jwt-view h1 {
  font-family: var(--font-heading-family);
  font-size: var(--font-heading-size);
  font-weight: var(--font-heading-weight);
  line-height: var(--font-heading-line-height);
  margin: 0 0 var(--spacing-1);
}

/* AC9: the honesty caption — caption type, secondary colour, no border, no
   box. The dashed box was the drop-zone signal and is gone. */
.tool-desc {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-5);
}

/* The `?` help affordance — WeakHashPopover's `.help-dot`: a 24px hit area
   with a 16px visible ring inset. */
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

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
}

.field label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

/* base.css already gives the bare <textarea> its token border, background and
   focus-visible ring — only the code face is set here (Story 8.2 AC6 /
   8.4 pattern). */
textarea {
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  line-height: var(--font-code-line-height);
}

/* Announce-only live region (AC21) — present at all times, never shown.
   Standard clip pattern (cf. HashView's `.sr-only`). */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.alert {
  color: var(--color-accent-destructive);
  margin: 0 0 var(--spacing-4);
}

/* Calm factual lines — never a filled box, never role="alert"
   (EXPERIENCE.md instrument voice). */
.jwt-status {
  margin: var(--spacing-3) 0 0;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
}

/* AC18: over-cap — sits where output would be, so its own bottom margin. */
.jwt-status-oversize {
  margin: 0 0 var(--spacing-4);
}

/* AC13 / AC14: expiry + not-yet-valid carry the destructive accent on the
   text (the old `p.expired` #b00020 intent), still boxless. */
.jwt-status-expired,
.jwt-status-nbf {
  color: var(--color-accent-destructive);
  font-weight: var(--font-label-weight);
}

/* AC12: the conditional unsigned-alg warning. */
.alg-warning {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  margin: 0 0 var(--spacing-4);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-accent-destructive);
}

.alg-warning-glyph {
  flex: 0 0 auto;
  display: block;
}

.block {
  margin-bottom: var(--spacing-4);
}

.block-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-1);
}

.block-label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

/* AC10: header / payload as a tokenised <pre> — hairline border, default
   radius, wrapped. Not JsonTree.vue (that stays a JSON-tool island). */
.block-pre {
  margin: 0;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  background: var(--color-bg-surface);
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  line-height: var(--font-code-line-height);
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

/* AC10: ~24px ghost icon-button, no text label (the aria-label carries the
   name). JsonTree / Base64View / HashView copy-button pattern. */
.block-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.block-copy svg {
  width: 15px;
  height: 15px;
}

.block-copy:hover {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.block-copy:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.block-copy-ok {
  color: var(--color-accent-signature);
}

.claims {
  list-style: none;
  margin: 0;
  padding: 0;
}

.claims li {
  display: flex;
  align-items: baseline;
  /* Lets the label column wrap onto its own line rather than crowd the value
     — "Valide à partir de (nbf)" runs longer than "Not before (nbf)". */
  flex-wrap: wrap;
  gap: var(--spacing-1) var(--spacing-2);
  padding: var(--spacing-1) 0;
}

.claim-label {
  min-width: 10em;
  font-family: var(--font-label-family);
  font-weight: var(--font-label-weight);
  color: var(--color-text-primary);
}

.claim-value {
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  color: var(--color-text-primary);
}

/* AC15: the relative time — muted, in parentheses, beside the absolute. */
.claim-relative {
  color: var(--color-text-secondary);
}

/* AC15: an absent claim — "not present", distinct tertiary colour. */
.claim-absent {
  color: var(--color-text-tertiary);
}

/* AC17: the wrong-type note — muted, NOT red, visibly distinct from the
   tertiary "not present". */
.claim-note {
  color: var(--color-text-secondary);
}
</style>
