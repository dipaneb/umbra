<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { PhCheck, PhCopySimple, PhX } from "@phosphor-icons/vue";
import { writeClipboardText } from "../../shell/clipboard";
import { debounce } from "../../shell/debounce";
import { toToolError, toolErrorMessage, type ToolError } from "../../shell/toolError";
import { useRegistryStore } from "../../stores/registry";
import { useSettingsStore } from "../../stores/settings";
// Per-row copy confirmation — the JsonTree.vue / Base64View.vue / UuidView.vue
// icon-button pattern (signature-accent check, no separate success colour).
import { useCopyFeedback } from "../json/useCopyFeedback";
import WeakHashPopover from "./WeakHashPopover.vue";
import type { Algorithm, DigestEntry } from "./hashDigests";

const { t } = useI18n();
const settings = useSettingsStore();

// Mirrors umbra-core's MAX_INPUT_BYTES. A pathological paste is caught here on
// the live path before it is shipped over IPC and hashed; umbra-core keeps
// its own identical check (defense in depth, AC19 — the cap holds end to end
// even if this guard is bypassed). `.length` (UTF-16 units) is a cheap
// lower bound on the UTF-8 byte count, enough to stop the pathological case
// without allocating a byte view of a huge string.
const MAX_INPUT_BYTES = 100 * 1024 * 1024;

// Live-hash debounce — same 200ms as Base64View / JsonView.
const HASH_DEBOUNCE_MS = 200;

// Algorithm names (SHA-256, MD5, …) are not translated — they're proper
// nouns/standard identifiers, same reasoning as tool names in the registry.
// `id` is the wire value (umbra-core's `Algorithm` serde rename + the
// `hash.algorithms` setting). Order here is the canonical display order the
// checkbox list and every derived list follow; core re-imposes it too.
// `weak` → the MD5 / SHA-1 "not collision-resistant" qualifier (AC13).
const ALGORITHMS: { id: Algorithm; label: string; weak: boolean }[] = [
  { id: "sha256", label: "SHA-256", weak: false },
  { id: "sha512", label: "SHA-512", weak: false },
  { id: "sha3-256", label: "SHA3-256", weak: false },
  { id: "sha3-512", label: "SHA3-512", weak: false },
  { id: "md5", label: "MD5", weak: true },
  { id: "sha1", label: "SHA-1", weak: true },
];
const ALGO_BY_ID = new Map(ALGORITHMS.map((a) => [a.id, a]));

const input = ref("");
const digests = ref<DigestEntry[]>([]);
const error = ref<ToolError | null>(null);

// AC14: names what the shown digests were computed from — the text box, or a
// dropped file (by name). A successful drop clears the text box and flips
// this to "drop", stashing the file's path so an algorithm-set change can
// re-hash the *file* rather than clear; the next real edit flips it back.
const source = ref<"text" | "drop">("text");
const droppedPath = ref<string | null>(null);
const sourceLabel = computed(() => {
  if (source.value !== "drop") return t("tools.hash.inputLabel");
  const path = droppedPath.value;
  if (!path) return t("tools.hash.sourceFile");
  return path.split(/[/\\]/).pop() || path;
});
// The drop handler clears `input`; that assignment fires the live-hash watch,
// which would hash the now-empty box and wipe the drop's digests. This lets
// exactly that one watcher run through untouched.
const suppressRunOnce = ref(false);

// AC14: an always-present polite live region (a region inserted together with
// its text is not reliably announced) — cleared then re-set on each completed
// hash so an identical update still re-announces. Errors keep `role="alert"`.
const announcement = ref("");

const registry = useRegistryStore();
// AD-16: shared with `DropZone.vue`'s file-drop dispatch for this same
// "hash" tool, so a live in-view hash and an in-flight file drop participate
// in one latest-wins sequence instead of two uncoordinated ones.
const runLatestWins = registry.getLatestWinsRunner("hash");

const { isCopied, markCopied, cancel: cancelCopyFeedback } = useCopyFeedback();

// AC10 (deferred-work fold-in): coalesce while a hash is in flight so a burst
// of edits / checkbox toggles can't stack `spawn_blocking` work server-side
// over an up-to-100 MiB input — `runLatestWins` only drops the stale
// *result*, not the wasted computation. At most one trailing run is queued.
const hashing = ref(false);
let rerunPending = false;

// AC7: the checked set, restored from the persisted `hash.*` setting, in
// canonical order. Drives the checkbox `:checked` bindings, the `hash_compute`
// argument, the dropped-file argument, and (with the results) the rows.
const selectedAlgorithms = computed<Algorithm[]>(() =>
  ALGORITHMS.filter((a) => settings.hashAlgorithms.includes(a.id)).map((a) => a.id),
);

function toggleAlgorithm(id: Algorithm) {
  const next = settings.hashAlgorithms.includes(id)
    ? settings.hashAlgorithms.filter((x) => x !== id)
    : [...settings.hashAlgorithms, id];
  void settings.setHashAlgorithms(next);
}

// AC11: case + encoding are pure view-side transforms on core's canonical
// lowercase hex — no new `invoke` (AD-1). Base64 is the base64 of the raw
// digest bytes; case applies to Hex only (uppercasing a Base64 string would
// corrupt its mixed-case alphabet), but both settings persist independently
// so switching Base64 → Hex restores the chosen case.
function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return btoa(String.fromCharCode(...bytes));
}

function formatDigest(hexLower: string): string {
  if (settings.hashEncoding === "base64") return hexToBase64(hexLower);
  return settings.hashCase === "upper" ? hexLower.toUpperCase() : hexLower;
}

// AC16: the persistent Verify panel. A pasted expected digest is compared —
// view-side, no `invoke`, no new error code — against *every* selected
// algorithm's digest of the current input (hex, case-insensitive, or Base64
// of the raw bytes). A mismatch is a calm factual state, never an alert.
const verifyValue = ref("");
const verifyActive = computed(
  () => verifyValue.value.trim() !== "" && digests.value.length > 0,
);

function matchesExpected(hexLower: string): boolean {
  const expected = verifyValue.value.trim();
  if (expected === "") return false;
  return expected.toLowerCase() === hexLower || expected === hexToBase64(hexLower);
}

const rows = computed(() =>
  digests.value.map((entry) => {
    const def = ALGO_BY_ID.get(entry.algorithm);
    return {
      key: entry.algorithm,
      label: def?.label ?? entry.algorithm,
      weak: def?.weak ?? false,
      value: formatDigest(entry.hex),
      verified: verifyActive.value ? (matchesExpected(entry.hex) ? "match" : "mismatch") : null,
    };
  }),
);

const verifyMatchedLabels = computed(() =>
  rows.value.filter((r) => r.verified === "match").map((r) => r.label),
);

const verifySummary = computed(() => {
  if (!verifyActive.value) return "";
  return verifyMatchedLabels.value.length
    ? t("tools.hash.verifyMatchSummary", { names: verifyMatchedLabels.value.join(", ") })
    : t("tools.hash.verifyNoMatchSummary");
});

// AC17: when the input is *exactly* a bare hex string of a recognised digest
// length, offer to move it into Verify. The offer never acts on its own
// (AD-9) — only the click moves anything.
const HEX_LENGTH_HINTS: Record<number, string> = {
  32: "MD5",
  40: "SHA-1",
  56: "SHA-224 / SHA3-224",
  64: "SHA-256 / SHA3-256",
  96: "SHA-384 / SHA3-384",
  128: "SHA-512 / SHA3-512",
};

// Same offer, for a bare Base64-encoded digest — keyed by decoded *byte*
// length (not the Base64 string length, which varies with padding).
const BASE64_BYTE_LENGTH_HINTS: Record<number, string> = {
  16: "MD5",
  20: "SHA-1",
  28: "SHA-224 / SHA3-224",
  32: "SHA-256 / SHA3-256",
  48: "SHA-384 / SHA3-384",
  64: "SHA-512 / SHA3-512",
};

// Standard-alphabet Base64 only (`A-Za-z0-9+/`, optional `=` padding) — a
// base64url string (`-`/`_`) is never a digest paste offer here, so no
// hex-vs-Base64 charset overlap is possible.
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function detectBase64Digest(value: string): { value: string; hint: string } | null {
  if (!BASE64_RE.test(value)) return null;
  let decoded: string;
  try {
    decoded = atob(value);
  } catch {
    return null;
  }
  const hint = BASE64_BYTE_LENGTH_HINTS[decoded.length];
  return hint ? { value, hint } : null;
}

// The offer is a small "move to Verify" button on the input's label row,
// shown only while the input is exactly a bare digest (Option B). No prose,
// no dismiss — it self-clears the moment the input isn't a bare digest. Hex
// is checked first and wins outright — a hex-charset string at a valid hex
// length (e.g. 64 lowercase hex chars) is also valid Base64 alphabet, but
// must never fall through to a second, ambiguous Base64 offer.
const pasteDetection = computed(() => {
  const value = input.value.trim();
  if (/^[0-9a-f]+$/i.test(value)) {
    const hint = HEX_LENGTH_HINTS[value.length];
    if (hint) return { value, hint };
  }
  return detectBase64Digest(value);
});

// The acknowledgement lives entirely below the Verify field (Option Y), in
// two beats: the orange tint appears with the caption + Undo, the tint
// fades after ~3s, and the caption + Undo linger ~2s more so there's still
// time to click Undo after the tint is gone. Nothing is shown near the
// input. "Move to Verify" is a transfer, so Undo sends the digest back to
// the input and clears Verify.
const verifyTinted = ref(false);
const movedAck = ref(false);
let tintTimer: ReturnType<typeof setTimeout> | undefined;
let ackTimer: ReturnType<typeof setTimeout> | undefined;
let movedFromInput: string | null = null;

function acceptPasteOffer() {
  const detected = pasteDetection.value;
  if (!detected) return;
  movedFromInput = input.value;
  verifyValue.value = detected.value;
  input.value = "";
  verifyTinted.value = true;
  movedAck.value = true;
  clearTimeout(tintTimer);
  clearTimeout(ackTimer);
  tintTimer = setTimeout(() => {
    verifyTinted.value = false;
  }, 3000);
  ackTimer = setTimeout(() => {
    movedAck.value = false;
  }, 5000);
}

function undoMove() {
  if (movedFromInput === null) return;
  verifyValue.value = "";
  input.value = movedFromInput;
  movedFromInput = null;
  verifyTinted.value = false;
  movedAck.value = false;
  clearTimeout(tintTimer);
  clearTimeout(ackTimer);
}

async function announce() {
  announcement.value = "";
  await nextTick();
  if (digests.value.length) {
    announcement.value = t("tools.hash.digestsAnnouncement", { source: sourceLabel.value });
  }
}

// Runs one `invoke` on the shared latest-wins runner, applying the in-flight
// coalesce and the standard result/error handling. `task` is the actual
// command call (`hash_compute` for text, `hash_compute_file` for a drop).
async function runInvoke(task: () => Promise<DigestEntry[]>) {
  if (hashing.value) {
    rerunPending = true;
    return;
  }
  hashing.value = true;
  try {
    const result = await runLatestWins(task);
    if (!result.superseded) {
      digests.value = Array.isArray(result.value) ? result.value : [];
      void announce();
    }
  } catch (err) {
    digests.value = [];
    error.value = toToolError(err);
  } finally {
    hashing.value = false;
    if (rerunPending) {
      rerunPending = false;
      runActive();
    }
  }
}

async function runHash() {
  error.value = null;

  if (input.value === "") {
    digests.value = [];
    return;
  }
  if (input.value.length > MAX_INPUT_BYTES) {
    digests.value = [];
    error.value = {
      code: "hash-input-too-large",
      message: `the text input exceeds the ${MAX_INPUT_BYTES}-byte limit`,
      position: null,
      context: null,
    };
    return;
  }
  const algorithms = selectedAlgorithms.value;
  if (algorithms.length === 0) {
    digests.value = [];
    return;
  }
  const value = input.value;
  await runInvoke(() => invoke<DigestEntry[]>("hash_compute", { input: value, algorithms }));
}

// AC15: an algorithm-set change while a dropped file is the source re-hashes
// *the file* (via the path the shell forwarded on `registry.dropSourcePath`),
// not the empty text box. The view re-invokes `hash_compute_file` for a path
// it already holds — it does not re-listen to or re-dispatch the OS drop
// event, which stays DropZone.vue's sole job (AD-14) — and rides the same
// shared latest-wins runner so it stays ordered with any in-flight drop
// (AD-16).
async function runHashFile() {
  error.value = null;
  const path = droppedPath.value;
  if (!path) {
    void runHash();
    return;
  }
  const algorithms = selectedAlgorithms.value;
  if (algorithms.length === 0) {
    digests.value = [];
    return;
  }
  await runInvoke(() => invoke<DigestEntry[]>("hash_compute_file", { path, algorithms }));
}

function runActive() {
  if (source.value === "drop" && droppedPath.value) {
    void runHashFile();
  } else {
    void runHash();
  }
}

const debouncedRun = debounce(() => void runHash(), HASH_DEBOUNCE_MS);

// AD-14: `DropZone.vue` is the shell's single generic dispatcher and invokes
// `hash_compute_file` itself; this view only supplies the argument the
// dispatcher can't know — the selected algorithm list (AC15) — and consumes
// the outcome via `registry.dropResult`.
function dropArgsProvider() {
  return { algorithms: selectedAlgorithms.value };
}

onMounted(() => registry.setDropArgsProvider("hash", dropArgsProvider));
onUnmounted(() => {
  registry.setDropArgsProvider("hash", null);
  cancelCopyFeedback();
  debouncedRun.cancel();
  clearTimeout(tintTimer);
  clearTimeout(ackTimer);
});

watch(
  () => registry.dropResult,
  (result) => {
    if (!result || result.toolId !== "hash") return;
    registry.dropResult = null; // one-shot signal
    // A keystroke's pending debounce would otherwise fire ~200ms later, hash
    // the text box and wipe the drop's digests (Base64View code review P1).
    debouncedRun.cancel();
    if ("error" in result) {
      // Keep the user's text on a failed drop — nothing was hashed from it.
      digests.value = [];
      error.value = result.error;
    } else {
      error.value = null;
      if (input.value !== "") {
        suppressRunOnce.value = true;
        input.value = "";
      }
      source.value = "drop";
      // The shell forwards the file's path alongside the outcome so an
      // algorithm-set change can re-hash the file (AC15).
      droppedPath.value = registry.dropSourcePath;
      digests.value = result.value as DigestEntry[];
      void announce();
    }
  },
);

// A lingering per-row "copied" check would otherwise sit on a value the user
// never copied once the digest set, the case, or the encoding changes — `rows`
// recomputes for all three.
watch(rows, cancelCopyFeedback);

// AC10: a text edit waits out the debounce; an algorithm-selection change
// re-runs immediately. Case / encoding are not sources here — they're pure
// view-side re-renders (AD-1).
watch([input, selectedAlgorithms], ([nextInput], [prevInput]) => {
  if (suppressRunOnce.value) {
    // The `input` clear the drop handler just made — its digests stand.
    suppressRunOnce.value = false;
    return;
  }
  if (nextInput !== prevInput) {
    // A real text edit — the digests are a function of the text box again.
    source.value = "text";
    droppedPath.value = null;
    debouncedRun();
  } else {
    // Only the algorithm set changed — re-hash whichever source is active
    // (the text box, or the dropped file via its stashed path).
    debouncedRun.cancel();
    runActive();
  }
});

async function onCopyOne(value: string, key: string) {
  error.value = null;
  try {
    await writeClipboardText(value);
    // Confirm only after the write actually succeeds — a failed write has its
    // own error-alert path and must not also flash a false confirmation.
    markCopied(key);
  } catch (err) {
    error.value = toToolError(err);
  }
}
</script>

<template>
  <section class="hash-view">
    <h1>{{ t('tools.hash.heading') }}</h1>
    <p class="tool-desc">
      {{ t('tools.hash.description') }}
    </p>

    <p class="drop-hint">
      {{ t('tools.hash.dropHint') }}
    </p>

    <div class="field">
      <div class="field-hd">
        <label for="hash-input">{{ t('tools.hash.inputLabel') }}</label>
        <!-- AC17: a compact affordance shown only while the input is exactly
             a bare digest; it never moves anything on its own (AD-9). The
             full sentence is the accessible name (no `title` — its native
             hover delay is not tunable and the button text already reads). -->
        <button
          v-if="pasteDetection"
          type="button"
          class="to-verify-btn"
          :aria-label="t('tools.hash.pasteOfferText', { algorithms: pasteDetection.hint })"
          @click="acceptPasteOffer"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 8h9M8.5 4l4 4-4 4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {{ t('tools.hash.pasteOfferAccept') }}
        </button>
      </div>
      <textarea
        id="hash-input"
        v-model="input"
        rows="10"
        spellcheck="false"
        autocorrect="off"
      />
    </div>

    <!-- Algorithm selection + the two composing segmented controls (case,
         encoding — each a persisted hash.* setting) share one wrapping row,
         so on a wide pane they sit on a single line and leave the vertical
         space for input and results. Order: input → controls → results →
         Verify (AC6). -->
    <div class="controls">
      <fieldset class="algo-field">
        <legend>
          <span>{{ t('tools.hash.algorithmsLegend') }}</span>
          <WeakHashPopover />
        </legend>
        <div class="algo-options">
          <label
            v-for="a in ALGORITHMS"
            :key="a.id"
            class="algo-check"
          >
            <input
              type="checkbox"
              :checked="settings.hashAlgorithms.includes(a.id)"
              @change="toggleAlgorithm(a.id)"
            >
            <span class="algo-name">{{ a.label }}</span>
          </label>
        </div>
      </fieldset>

      <!-- Case + Encoding wrap below the algorithm list as one unit, never
           one-then-the-other. -->
      <div class="seg-controls">
        <div class="seg-control">
          <span
            id="hash-case-label"
            class="seg-control-label"
          >{{ t('tools.hash.caseLegend') }}</span>
          <div
            class="segmented"
            role="radiogroup"
            aria-labelledby="hash-case-label"
          >
            <label :class="{ active: settings.hashCase === 'lower' }">
              <input
                type="radio"
                name="hash-case"
                :checked="settings.hashCase === 'lower'"
                :aria-label="t('tools.hash.caseLower')"
                @change="settings.setHashFormat({ case: 'lower' })"
              >
              abc
            </label>
            <label :class="{ active: settings.hashCase === 'upper' }">
              <input
                type="radio"
                name="hash-case"
                :checked="settings.hashCase === 'upper'"
                :aria-label="t('tools.hash.caseUpper')"
                @change="settings.setHashFormat({ case: 'upper' })"
              >
              ABC
            </label>
          </div>
        </div>

        <div class="seg-control">
          <span
            id="hash-encoding-label"
            class="seg-control-label"
          >{{ t('tools.hash.encodingLegend') }}</span>
          <div
            class="segmented"
            role="radiogroup"
            aria-labelledby="hash-encoding-label"
          >
            <label :class="{ active: settings.hashEncoding === 'hex' }">
              <input
                type="radio"
                name="hash-encoding"
                :checked="settings.hashEncoding === 'hex'"
                @change="settings.setHashFormat({ encoding: 'hex' })"
              >
              {{ t('tools.hash.encodingHex') }}
            </label>
            <label :class="{ active: settings.hashEncoding === 'base64' }">
              <input
                type="radio"
                name="hash-encoding"
                :checked="settings.hashEncoding === 'base64'"
                @change="settings.setHashFormat({ encoding: 'base64' })"
              >
              {{ t('tools.hash.encodingBase64') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <p
      v-if="error"
      class="alert"
      role="alert"
    >
      {{ toolErrorMessage(error, t) }}
    </p>

    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </p>

    <div
      v-if="rows.length"
      class="results"
    >
      <p class="results-source">
        {{ sourceLabel }}
      </p>
      <ul class="results-list">
        <li
          v-for="row in rows"
          :key="row.key"
        >
          <span class="row-algo">
            <span class="algo-name">{{ row.label }}</span>
            <WeakHashPopover v-if="row.weak" />
          </span>
          <code>{{ row.value }}</code>
          <span
            v-if="row.verified"
            class="verify-indicator"
            :class="row.verified"
          >
            <PhCheck
              v-if="row.verified === 'match'"
              aria-hidden="true"
            />
            <PhX
              v-else
              aria-hidden="true"
            />
            {{ row.verified === 'match' ? t('tools.hash.verifyMatch') : t('tools.hash.verifyMismatch') }}
          </span>
          <button
            type="button"
            class="row-copy"
            :aria-label="isCopied(row.key) ? t('tools.hash.copied') : t('common.copyToClipboard')"
            :title="isCopied(row.key) ? t('tools.hash.copied') : t('common.copyToClipboard')"
            @click="onCopyOne(row.value, row.key)"
          >
            <PhCheck
              v-if="isCopied(row.key)"
              aria-hidden="true"
              class="row-copy-ok"
            />
            <PhCopySimple
              v-else
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
    </div>

    <!-- AC16: a persistent panel under the results. Empty → inert, the tool
         is a plain calculator. A pasted value is checked against every
         selected algorithm; a mismatch is a flat factual state, never an
         alert or a red box (EXPERIENCE.md instrument voice). -->
    <div
      class="verify-panel"
      :class="{ 'just-moved': verifyTinted }"
    >
      <label for="hash-verify">{{ t('tools.hash.verifyLabel') }}</label>
      <input
        id="hash-verify"
        v-model="verifyValue"
        type="text"
        spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        :placeholder="t('tools.hash.verifyPlaceholder')"
      >
      <!-- AC17 (Option Y): the acknowledgement sits BELOW the field so its
           appearance / disappearance never shifts the input. Two beats — the
           tint fades at ~3s, this caption + Undo linger ~2s more. -->
      <p
        v-if="movedAck"
        class="moved-into"
        role="status"
      >
        <span>{{ t('tools.hash.movedIntoVerify') }}</span>
        <button
          type="button"
          class="offer-action"
          @click="undoMove"
        >
          {{ t('tools.hash.undoMove') }}
        </button>
      </p>
      <p
        v-if="verifySummary"
        class="verify-summary"
        role="status"
      >
        {{ verifySummary }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.hash-view h1 {
  font-family: var(--font-heading-family);
  font-size: var(--font-heading-size);
  font-weight: var(--font-heading-weight);
  line-height: var(--font-heading-line-height);
  margin: 0 0 var(--spacing-1);
}

.tool-desc {
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-5);
}

.drop-hint {
  color: var(--color-text-secondary);
  font-size: var(--font-caption-size);
  border: 1px dashed var(--color-border-hairline);
  border-radius: var(--radius-default);
  padding: var(--spacing-2) var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.field {
  display: flex;
  flex-direction: column;
  /* --spacing-2, not --spacing-1: the textarea's focus-visible ring
     (2px outline + 2px offset) reaches into this gap, and a 4px gap let it
     visually merge with the button on the label row above. */
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
}

/* The input's label row: label on the left, the "move to Verify" affordance
   on the right when a bare digest is detected. */
.field-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
  min-height: 1.4em;
}

/* AC17 (Option B): a compact hairline-bordered action, restrained — no
   accent, no prose. Same restraint as the results-row copy buttons. */
.to-verify-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-0-5) var(--spacing-2);
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  background: var(--color-bg-surface);
  font-family: var(--font-label-family);
  font-size: var(--font-caption-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  white-space: nowrap;
  cursor: pointer;
}

.to-verify-btn svg {
  display: block;
}

/* Same hover as the results-row copy buttons — a neutral chip fill, the
   hairline border unchanged (darkening it to a text colour read as an
   out-of-system black outline). */
.to-verify-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.to-verify-btn:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

/* A plain underlined text action (Undo). Readable via weight + underline,
   not colour. */
.offer-action {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: var(--font-label-weight);
  color: var(--color-text-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.offer-action:hover,
.offer-action:focus-visible {
  text-decoration-thickness: 2px;
}

/* base.css already gives the bare <textarea> its token border, background
   and focus-visible ring — only the code face is overridden here (Story 8.2
   AC6 pattern). */
textarea {
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  line-height: var(--font-code-line-height);
}

.algo-field {
  border: none;
  padding: 0;
  margin: 0;
  /* Takes the row's leftover width and wraps its own checkboxes; the 16rem
     basis lets it drop below the segmented controls before it gets cramped.
     A fieldset defaults to min-inline-size:auto, which refuses to shrink —
     override so flex-wrap works. */
  flex: 1 1 16rem;
  min-inline-size: 0;
}

.algo-field legend,
.seg-control-label {
  padding: 0;
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

/* The legend carries the "Algorithms" label plus the `?` that explains the
   MD5 / SHA-1 flag — one flex row, vertically centred (UuidView's
   `.version-legend` pattern). */
.algo-field legend {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  margin-bottom: var(--spacing-1);
}

.algo-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1) var(--spacing-4);
}

.algo-check {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.algo-check input {
  margin: 0;
}

.controls {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-4) var(--spacing-6);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-5);
}

/* Case + Encoding travel together — one flex item in `.controls`, so on a
   narrow pane the pair drops below the algorithm list as a block rather
   than one control wrapping before the other. */
.seg-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--spacing-4) var(--spacing-6);
  flex: 0 0 auto;
}

.seg-control {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  flex: 0 0 auto;
}

/* A two-option segmented control — a neutral track with the active cell
   raised on the surface colour + a hairline border (DESIGN.md: persistent
   surfaces use a border, not a shadow). Mirrors UuidView's `.case-toggle`.
   The native radios stay in the DOM, visually collapsed (never
   `display: none`, which drops them from the tab order and the a11y tree). */
.segmented {
  display: inline-flex;
  gap: var(--spacing-0-5);
  padding: var(--spacing-0-5);
  background: var(--color-accent-neutral-chip);
  border-radius: var(--radius-default);
}

.segmented label {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-0-5) var(--spacing-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.segmented label.active {
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  border-color: var(--color-border-hairline);
}

.segmented label:focus-within {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.segmented input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.alert {
  color: var(--color-accent-destructive);
  margin: 0 0 var(--spacing-4);
}

/* Announce-only live region (AC14) — present in the DOM at all times, never
   shown. Standard clip pattern (cf. UuidView's `.sr-only`). */
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

/* AC6: a bordered results panel. Persistent surface → hairline border, no
   shadow (DESIGN.md). Mirrors UuidView's `.results`. */
.results {
  border: 1px solid var(--color-border-hairline);
  border-radius: var(--radius-default);
  background: var(--color-bg-surface);
}

/* AC14: names what the digests were computed from — the text box, or a
   dropped file (by name). Sits as a header caption above the rows. */
.results-source {
  margin: 0;
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: 1px solid var(--color-border-hairline);
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
}

.results-list {
  list-style: none;
  margin: 0;
  padding: var(--spacing-1) 0;
}

.results-list li {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
}

/* Zebra striping ties each digest to its Copy button across a wide pane —
   --color-bg-base is one step off the panel's --color-bg-surface, subtle in
   both themes (UuidView pattern). */
.results-list li:nth-child(odd) {
  background: var(--color-bg-base);
}

/* A fixed label column so every digest starts on the same vertical line
   regardless of the label's length in the active language. Holds the
   algorithm name and, for MD5 / SHA-1, the `?` that explains the flag —
   a single line, so the rows stay compact and aligned. */
.row-algo {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-0-5);
  flex: 0 0 8rem;
  font-family: var(--font-label-family);
  font-weight: var(--font-label-weight);
  color: var(--color-text-primary);
}

/* Trim the in-row help-dot so it doesn't out-measure the digest line and
   make the MD5 / SHA-1 rows taller than the rest. */
.row-algo :deep(.help-dot) {
  width: 1.25rem;
  height: 1.25rem;
}

.results-list code {
  flex: 1;
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
  line-height: var(--font-code-line-height);
  color: var(--color-text-primary);
  word-break: break-all;
}

/* AC16: a flat factual per-row verdict — a glyph + a word, never a filled
   box, never role="alert" (EXPERIENCE.md: the instrument reports state, it
   doesn't alarm). Colour is kept to the text + glyph only: --color-accent-
   success for "match", --color-accent-destructive for "does not match". */
.verify-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-0-5);
  flex: 0 0 auto;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  white-space: nowrap;
}

.verify-indicator svg {
  width: 13px;
  height: 13px;
}

.verify-indicator.match {
  color: var(--color-accent-success);
}

.verify-indicator.mismatch {
  color: var(--color-accent-destructive);
}

/* Per-row copy — fixed px (a copy icon's legibility floor doesn't scale with
   the code font), signature-accent confirm, no separate success colour
   (JsonTree.vue / Base64View.vue / UuidView.vue). */
.row-copy {
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

.row-copy svg {
  width: 15px;
  height: 15px;
}

.row-copy:hover {
  color: var(--color-text-primary);
  background: var(--color-accent-neutral-chip);
}

.row-copy:focus-visible {
  outline: 2px solid var(--color-accent-signature);
  outline-offset: 1px;
}

.row-copy-ok {
  color: var(--color-accent-signature);
}

/* AC16: the persistent Verify panel, under the results. A plain labelled
   field — not a card, not a bordered surface — so an empty one reads as
   "available", not "another result panel". */
.verify-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  /* Generous whitespace — no rule — so it reads as its own step below the
     results, not a tail on that panel. */
  margin-top: var(--spacing-8);
  /* AC17: a brief signature tint marks where a moved digest landed. The
     negative inset + padding let the tint bleed slightly past the fields
     without shifting them. */
  margin-inline: calc(-1 * var(--spacing-2));
  padding: var(--spacing-2);
  border-radius: var(--radius-default);
  transition: background-color 400ms ease;
}

.verify-panel.just-moved {
  background: var(--color-accent-signature-tint);
}

@media (prefers-reduced-motion: reduce) {
  .verify-panel {
    transition: none;
  }
}

.verify-panel label {
  font-family: var(--font-label-family);
  font-size: var(--font-label-size);
  font-weight: var(--font-label-weight);
  color: var(--color-text-secondary);
}

/* The acknowledgement caption + Undo — caption weight, muted (the panel's
   tint already carries the "something happened"; the text just explains). */
.moved-into {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-2);
  margin: 0;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
}

.verify-panel input {
  font-family: var(--font-code-family);
  font-size: var(--font-code-size);
}

/* role="status", not role="alert": a "does not match" summary is a calm
   statement of fact. Muted, no box. */
.verify-summary {
  margin: var(--spacing-1) 0 0;
  font-family: var(--font-caption-family);
  font-size: var(--font-caption-size);
  color: var(--color-text-secondary);
}
</style>
