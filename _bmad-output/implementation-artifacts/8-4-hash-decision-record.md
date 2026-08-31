---
story: 8-4-reimagine-the-hash-generator
produced_by: bmad-party-mode (installed roster — Mary, John, Sally, Winston, Amelia, Paige), party_mode session
date: 2026-08-31
status: decided — Task 1 complete, gates Task 2
---

# Decision Record: Hash Generator scope (Story 8.4, Task 1)

Open scope discovery, run per Epic 8's shared story shape — the shipped implementation
(`crates/umbra-core/src/hash.rs`, `src-tauri/src/commands/hash.rs`,
`src/tools/hash/HashView.vue`, `src/tools/hash/hashDigests.ts`, `src/tools/hash/HashView.spec.ts`,
`tools.hash.*` locales, the `hash` registry `drop` entry) was treated as **reference only**, not a
scope to preserve by default. All five source files plus i18n, `src/shell/toolError.ts`, the
registry entry and `src-tauri/src/lib.rs`'s handler registration were re-read in full at the start
of this session, alongside the Epic-7 design-system anchors (`tokens.css`, `base.css`,
`AppButton.vue`, `AppTabs.vue`, `AppPopover.vue`, `App.vue`, `icons.ts`) and both redesign
references (`JsonView.vue` tabbed, `Base64View.vue` single enriched view with a live file/drop
path **and** a save-to-file path — the closest structural precedent for Hash). Grounded in a
competitive sweep of hash tooling (CyberChef's multi-hash recipe + "Analyse hash", GtkHash,
online multi-hash calculators, the platform `sha256sum` / `shasum` / `md5sum` CLIs and their
`-c` / `--check` verify mode, `openssl dgst`, browser `crypto.subtle.digest`, package-manager
checksum-verification UX). `sha2` / `sha1` / `md-5` `0.11` and `sha3` availability re-verified via
Context7 (`/RustCrypto/hashes`) 2026-08-31 — the `0.11` line is current (`digest` 0.11.x),
`sha3` is a clean `Digest`-trait crate, `blake2` likewise, `blake3` is its own non-`Digest` API.
A container-shape design canvas ("Hash Generator Redesign",
`https://claude.ai/code/artifact/c928d06d-a86d-4e32-8ad5-a8764fd3af67`) was published as an
Artifact with four options and their interaction states; the developer picked **Option 1
(enriched single view) plus the smart paste-detection shortcut** and confirmed every open scope
question 2026-08-31.

## Drift found vs. the story's Dev Notes

**None.** Every fact in the story's Task 1 "feed the session" bullet was re-verified against the
live source and matches exactly: `hash.rs` 152 lines / 9 unit tests / `HashDigests { sha256,
sha512, md5, sha1: String }` / `pub const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024` /
`to_hex_lower` / `compute_bytes` as the single implementation / `compute` the thin wrapper;
`commands/hash.rs` 125 lines / 6 command tests / `hash_compute` + `hash_compute_file` /
`check_file_size` before read / `map_join_error` → `hash-internal`; `HashView.vue` 241 lines,
100% pre-Epic-7 (`#666` / `#ccc` / `#b00020` / `border-radius: 6px` / bare `monospace`);
`hashDigests.ts` 7 lines, hand-synced; `HashView.spec.ts` 227 lines / 10 tests; the 9-key
`tools.hash.*` i18n block (`en` + `fr`) with **no** `errors.hash-*` keys; the `hash` registry
entry with `drop: { acceptedMimeTypes: [], handler: "hash_compute_file" }`, **no**
`clipboardMatch`, **no** `shortcut`; both handlers registered in `lib.rs` lines 15 / 63–64;
`Cargo.toml` `sha2 = "0.11"` / `sha1 = "0.11"` / `md-5 = "0.11"`; `Cargo.lock` resolving
`sha2` 0.11.0 (plus a transitive 0.10.9 via tauri/wry — pre-existing, deferred-work-logged),
`sha1` 0.11.0, `md-5` 0.11.0, `digest` 0.11.3; `TRANSLATABLE_CODES` holding `uuid-count-zero`,
every `json-*`, every `base64-*`, **no** `hash-*`.

## Kept — no material change

- **The four classic digests remain available algorithms** — SHA-256, SHA-512, MD5, SHA-1 —
  computed by pure functions in `umbra-core::hash`, one canonical **lowercase-hex** string each
  (AD-1: case is presentation, core emits one canonical output per algorithm). What changes is
  that they are now *user-selected*, not always-all-four (see **Changed** and **Added**).
- **`MAX_INPUT_BYTES = 100 * 1024 * 1024` (100 MiB)** — the CWE-400 memory bound. Enforced in
  `umbra-core` for text and via a metadata `check_file_size` **before the file is read** for
  drops; over-cap → `hash-input-too-large` (`position: None`, byte count in the prose message).
- **The file-drop path via the shell drop service (AD-14)** — `DropZone.vue` is the single
  generic dispatcher; it invokes `hash_compute_file` and publishes `registry.dropResult`; the
  view **consumes** the outcome, it does not re-dispatch. (The dispatch call gains an argument —
  see the AD-1 split — but the ownership boundary is unchanged.)
- **One shared `registry.getLatestWinsRunner("hash")` (AD-16)** across manual hashing, Paste, and
  an in-flight file drop — all three write the same digest/error surface, so they participate in
  one latest-wins sequence. This is **correct as-is and remains the reference implementation** for
  "a drop plus an in-view invoke write the same surface" (cited in Story 8.3's Dev Notes). If
  Task 2 splits Hash into genuinely independent panels, scope one runner per group — but the
  chosen single enriched view does not.
- **The error model** — `hash-input-too-large`, `hash-internal` (join panic), `file-read-error`
  (missing/unreadable dropped file). All `ToolError`, all rendered raw via `toolErrorMessage`,
  **none** in `TRANSLATABLE_CODES`.
- **Per-row one-click Copy of the currently-displayed string** (case- and encoding-respecting).
- **Algorithm names are not translated** — proper nouns / standard identifiers, same reasoning as
  tool names.
- **`spawn_blocking` off the UI thread (AD-4)** — both commands already do this; a redesign must
  not move digest work back onto the UI thread.
- **FR14's bcrypt / argon2 exclusion** — password hashing stays a separate future P3 tool (see
  **Cut** and **FR revision**).

## Changed — interaction / presentation, not capability

None of these is a new transformation; they reshape how the existing capability is presented.

- **Live as-you-type hashing replaces the explicit Compute button.** Hashing runs on every
  (debounced) input edit and immediately on an algorithm / case / encoding change — never on a
  button press. `Base64View.vue` (which went live in Story 8.2) and `JsonView.vue` are the
  references: `src/shell/debounce.ts`'s `debounce(fn, ms)` with `.cancel()`, a
  `watch([...sources], …)` that debounces text edits but re-runs immediately on a discrete
  control change, `debouncedX.cancel()` in `onUnmounted`. Because text can be up to 100 MiB, the
  live path carries **a frontend length ceiling** before the server check (folds in the
  deferred-work "no frontend size guard on the `<textarea>`" item) **and** an **in-flight
  disabled state** (folds in the deferred-work "no loading/disabled state" item — 8.3 fixed its
  Generate equivalent).
- **Enriched single view** — a designed screen (integrated algorithm selection, a proper results
  panel, a persistent Verify field, copy affordances matching the icon style JSON / Base64 /
  UUID use), not a token swap on the current flat vertical stack. `Base64View.vue` is the
  structural precedent: a redesigned single view that keeps a live file/drop path.
- **Per-row Copy restyled** from `<AppButton>` "Copy" → the ~24 px icon-button + `useCopyFeedback`
  pattern (`JsonTree.vue` / `Base64View.vue` / post-8.3 `UuidView.vue`): signature-accent
  "copied" state, **no** separate success colour. Folds in the deferred-work "no Copy feedback"
  item. Clear the feedback on a fresh hash, a new drop, a case/encoding toggle, or an algorithm
  change (8.3's code-review guard).
- **The `lower` / `UPPERCASE` toggle is kept** (view-side `.toUpperCase()`, never a second
  command — AD-1) **and joined by a Hex / Base64 output-encoding toggle** (see **Added** 5).
  The current `<fieldset>` + two radios is replaced by a designed affordance (segmented control
  vs. toggle — a Task 2a / canvas call).
- **Full Epic-7 tokenisation pass** (the tool is 100% pre-Epic-7 — more extensive than 8.3's):
  `#666` / `#ccc` → `--color-text-secondary` / `--color-border-hairline`; `#b00020` →
  `--color-accent-destructive` (matching `JsonView.vue` / `Base64View.vue` / `UuidView.vue`);
  `border-radius: 6px` → `--radius-*`; bare `monospace` → `--font-code-*`; every margin/gap →
  `--spacing-*`; `.drop-hint`'s dashed box → tokens. `src/styles/base.css` already gives a bare
  `<textarea>` its token border, background and focus-visible ring — don't re-style what it
  covers.
- **MD5 / SHA-1 labelling** — the `(legacy)` suffix (`tools.hash.legacySuffix`) is replaced by a
  **"not collision-resistant"** qualifier. `(legacy)` undersells it — MD5 and SHA-1 are broken
  for security use, not merely old. Factual, instrument-voice phrasing (EXPERIENCE.md), no scare
  words, no emoji. Paige drafts the exact `en` / `fr` strings in Task 2a.
- **`role="status"` / `aria-live` on a successful digest render** — folds in the deferred-work
  item (errors already get `role="alert"`, success is silent today).
- **A source label on the results panel** — after a drop, `digests` is overwritten but the
  textarea is untouched with no indication which input the digests belong to (deferred-work
  item). The redesign names the source (typed text vs. dropped filename).

## Added — the redesign's real new scope

1. **Verify / compare mode** *(new)* — a **persistent "Verify against a known hash" field** under
   the results panel (Option 1). Paste an expected digest and each selected result row shows
   **match / does-not-match** against the current input. Evidenced by the sweep: this is the
   `sha256sum -c` job and every "verify your download" box on every release page — today a user
   would compute the hash and eyeball 64 hex characters. **A mismatch is a calm factual result,
   not an error** — `role="status"`, the phrasing "does not match", **not** `role="alert"`,
   **not** the destructive-red treatment (EXPERIENCE.md's precision-instrument voice: the
   instrument reports state, it does not alarm). Resting state (nothing pasted): the field is
   rendered but inert — no chips, no verdict, no colour — the tool is a plain digest calculator.
   **No new error codes** → not in `TRANSLATABLE_CODES` (see the i18n finding).
2. **Smart paste-detection shortcut into Verify** *(new)* — when the text input's content is
   *exactly* a bare hex digest of a recognised length, the tool **offers** (a dismissible
   caption, **never** an automatic mode change — AD-9 honesty bar, the line 8.1 and 8.2 kept
   redrawing) to move it into the Verify field. On accept: the string moves to Verify, the input
   is cleared and relabelled, and **the move is explicitly acknowledged to the user** — a visible
   transition, not a silent swap (the developer's explicit requirement). One "back to hashing"
   affordance reverses it. This is a *front door to the same Verify field*, not a second mode:
   one code path, a detector that pre-fills it.
3. **User-selected algorithm set via checkboxes** *(new)* — SHA-256, SHA-512, SHA3-256, SHA3-512,
   MD5, SHA-1. **Default: SHA-256 + SHA-512 checked**, the rest opt-in. Persisted as `hash.*`
   keys in the `settings` Pinia store (Story 8.3's `uuid.*` pattern — added to the store's
   single-source `DEFAULTS` map so `init()` / `clearAll()` / `resetKey()` cover them
   automatically; immediate `set` + `save` on change, not debounced; surfaced in
   `SettingsView.vue`'s existing reset list with **no new Settings section**). **Only checked
   algorithms are computed** — the command takes the selected list, so a 100 MiB file is not
   hashed six ways for one wanted digest. This is what reshapes the core (see AD-1 split): a
   fixed `HashDigests` struct of named fields no longer fits a user-selected set.
4. **SHA-3 (SHA3-256 + SHA3-512)** *(new)* — via the `sha3` crate (RustCrypto, same `Digest`
   trait and one-shot API as `sha2` — `Sha3_256::digest(bytes)`). New `umbra-core` dependency
   `sha3 = "0.11"`, cross-platform-clean (AD-2 / AD-11). One `Algorithm` enum variant + dispatch
   arm + TS-mirror line per width. SHA3-256 is the NIST-standardised modern option; SHA3-512 the
   wider width — the developer asked for both selectable.
5. **Hex + Base64 output encoding** *(new)* — a Hex / Base64 toggle beside the case toggle. Hex
   (lowercase) stays the universal default; Base64 is the industry-standard second option
   (GtkHash, CyberChef, most online calculators; used by Subresource Integrity `sha384-…`
   headers, some APIs). **Both are view-side transforms** on core's canonical lowercase hex
   (AD-1) — Base64 is hex→bytes→Base64 in JS (`Uint8Array` from hex pairs, then `btoa`), a
   two-step transform, **no new core field**. Byte-grouped hex / `0x` prefix were considered and
   cut (see **Cut**).

### Container shape — enriched single view (Option 1 + smart detection)

- **Chosen — enriched single view**, the Verify field persistent under the results, the
  smart-paste detection (Added 2) as a shortcut into it. `Base64View.vue` is the structural
  precedent (single enriched view that keeps a live drop path). A polished design canvas at the
  **UUID Story 8.3 fidelity** — the wireframe mockups on the exploration canvas are explicitly
  **not** the target quality (developer's requirement) — is produced in Task 2a for the exact
  layout, the encoding/case affordance, and especially the smart-detection acknowledgement UX.
- **Rejected — tabs (`AppTabs.vue`)** *(kept on the canvas's "Also considered" page)*. Story
  8.1's discipline, held in 8.2 and 8.3: no tabs on what is fundamentally one workflow — hash,
  then optionally check. A Verify tab would give Verify its own file + hash pair (the
  `sha256sum -c` model), but at the cost of a tab on a single-job tool.
- **Rejected — Compute ⇄ Verify segmented switch** *(canvas "Also considered")*. Hides half the
  tool behind a mode control for no gain over a persistent field.
- **Rejected — polymorphic input as the whole model**. Kept as the *enhancement* (Added 2), not
  the container: on its own it leans entirely on the user noticing a caption.
- **Rejected — flat re-token only**. The checkbox set + encoding toggle + Verify + live-hashing
  restructure is enough designed surface to warrant a real layout pass.

## Cut — considered, explicitly rejected

**AC3 deviation, logged (Story 8.3 precedent).** The developer explicitly directed (2026-08-31)
that cut ideas are **not** filed as individual `backlog-candidate` GitHub issues on
`dipaneb/umbra` **and not** added to a separately tracked backlog. They are recorded here for
traceability only. This deviates from the story's AC3 default (individual, max-context GitHub
issues linking back to this record) exactly as Story 8.3 did; the deviation is noted here and in
the story file so the ideas remain traceable, not silently dropped.

1. **BLAKE2b / BLAKE3.** BLAKE2b is a clean RustCrypto `Digest` add (IETF RFC 7693 / ISO-IEC
   standardised); BLAKE3 is the fastest option but has its own non-`Digest` API and, as of April
   2026, no NIST or IETF standardisation. *Rejected: SHA-3 covers the "modern standardised hash"
   need; no evidenced demand beyond it, and BLAKE3 specifically carries integration cost. Every
   added algorithm stays a clean `sha2`-shaped `Digest` call.*
2. **Byte-grouped hex / `0x` prefix output.** Niche presentations, not industry-standard; hex +
   Base64 covers the real need. *Rejected: clutter for a rare want.*
3. **HMAC mode.** Needs a key input (text or hex/base64), a genuinely different UI shape, and a
   `hash-*` error for a malformed key. *Rejected: different tool shape, no evidenced need;
   revisit if a concrete recurring need appears.*
4. **Signature sign / verify.** A digital signature signs a hash, but a sign/verify tool needs
   asymmetric keys (RSA / Ed25519), PEM/DER parsing and key management — a different tool with a
   different threat surface and crate set (`ed25519-dalek` / `rsa`). *Rejected: out of scope for
   a hash tool.*
5. **Password hashing (bcrypt / argon2).** Already FR14-excluded. A password KDF is deliberately
   *slow*, salted, parameterised (argon2id memory/iteration/parallelism, bcrypt cost); its
   primary mode is "verify a password against a stored hash"; opposite design goal from a fast
   digest. *Stays its own future P3 tool — not a new cut, a restatement of FR14.*
6. **Digest export to a file** (8.3-style `.txt`). Not added now — Verify is a view-side string
   compare, there is no "list of digests" worth writing and no write side. If Task 2a decides it
   is wanted it is a new `hash_export` command via `fs_helper::write_file_bytes` (AD-15). Listed
   as an open item, not scope.

## FR14 + FR15 revision

Epic 8's preamble makes this revision the story's own output, not a prediction locked in advance.
Final FR numbering / wording in `epics.md` is the PM's call; stated here as the story's actual
scope.

- **FR14** — today: *"Compute SHA-256 and SHA-512 of text input, plus MD5 and SHA-1 labeled as
  legacy, shown simultaneously; hex output with uppercase/lowercase toggle. bcrypt/argon2
  excluded (P3 backlog candidate)."* **Revised & expanded:**
  - The digests are **no longer all shown simultaneously** — the user **selects which algorithms
    to compute** via checkboxes (default SHA-256 + SHA-512).
  - **SHA3-256 and SHA3-512 are added** to the selectable set.
  - MD5 / SHA-1 are labelled **"not collision-resistant"**, not "legacy".
  - Output gains a **Hex / Base64 encoding toggle** alongside the case toggle.
  - Hashing is **live (as-you-type)**, not behind a Compute button.
  - bcrypt / argon2 exclusion **unchanged**.
- **FR15** — today: *"Compute the same digests for a dropped file."* **Kept, extended:**
  - A dropped file is hashed with the **same user-selected algorithm set** (`hash_compute_file`
    now takes the algorithm list; the view registers a `dropArgsProvider`).
  - **Added:** a dropped file, or the current text input, can be **verified against a pasted
    expected hash**.

## AD-1 functional-core split (AC4)

- **`crates/umbra-core/src/hash.rs`:**
  - **`HashDigests { sha256, sha512, md5, sha1: String }` — replaced.** The set is user-selected
    and now includes SHA-3, so a struct of fixed named fields no longer fits. New shape: an
    **`Algorithm` enum** (`Sha256`, `Sha512`, `Sha3_256`, `Sha3_512`, `Md5`, `Sha1`;
    `#[serde(rename_all = "kebab-case")]` or similar — exact naming a Task 2a call) and
    `compute` / `compute_bytes` returning an **ordered `Vec<DigestEntry { algorithm: Algorithm,
    hex: String }>`** (or an ordered map) for the requested subset. Digests stay canonical
    **lowercase hex** — case + Base64 are view-side (AD-1).
  - **Signatures gain the selection:** `compute(input: &str, algorithms: &[Algorithm])` /
    `compute_bytes(bytes: &[u8], algorithms: &[Algorithm])`. `to_hex_lower` survives.
    `pub const MAX_INPUT_BYTES` survives, still `pub` for the command-layer file guard.
  - **New pure work:** SHA-3 digest computation (via `sha3`), the `Algorithm` enum + dispatch.
  - **The 9 unit tests are rewritten** to the new signature (assert per-algorithm entries),
    extended with SHA-3 known vectors and a subset-selection test. Story 8.2's AC14 *Amended*
    discipline applies — the rewrite is recorded in the AC, not silent.
- **`src-tauri/src/commands/hash.rs`:**
  - `hash_compute(input: String, algorithms: Vec<Algorithm>)` and
    `hash_compute_file(path: String, algorithms: Vec<Algorithm>)` — both gain the list.
    `spawn_blocking` (AD-4), `map_join_error` → `hash-internal`, `check_file_size` before read —
    all unchanged in shape.
  - **No new `hash_<verb>` command** — no digest-export was added. If Task 2a adds one it is a
    new `hash_export` via `fs_helper::write_file_bytes` (AD-15, atomic temp-then-rename).
  - `src-tauri/src/lib.rs` handler registration — **unchanged** (same two command names).
  - `src-tauri` still takes **no** direct hash-crate dependency — transformation + types live in
    `umbra-core` only (AD-1).
- **`src/tools/hash/hashDigests.ts`:** the hand-synced `HashDigests` interface — **replaced** by a
  mirror of the new `Algorithm` union + `DigestEntry` shape. Keep the "keep in sync by hand"
  comment.
- **`crates/umbra-core/Cargo.toml`:** hash-crate set — **add `sha3 = "0.11"`**. `sha2 = "0.11"`,
  `sha1 = "0.11"`, `md-5 = "0.11"` **unchanged** (Context7 `/RustCrypto/hashes` re-verified
  2026-08-31: the `0.11` line is current). `blake2` / `blake3` **not** added (see **Cut**).
  `Cargo.lock` already carries a transitive `sha2` 0.10.x via tauri/wry (pre-existing,
  deferred-work-logged); `sha3` resolves its own `digest` 0.11.x alongside — verify cross-platform
  on CI (`cargo test --workspace` on all three OSes, AD-2 / AD-11).
- **`src/stores/registry.ts` — the `hash` entry:** `drop` stays
  `{ acceptedMimeTypes: [], handler: "hash_compute_file" }`, **but the view now registers a
  `dropArgsProvider("hash", …)`** supplying the selected algorithm list (the `Base64View.vue`
  pattern — Hash has none today). **No `clipboardMatch`** — the smart paste-detection reads the
  tool's own textarea in-view, it is not a registry clipboard sniff; adding `clipboardMatch`
  would be a shell concern (AD-6) and is explicitly **not** done. **No `shortcut`.**
  `acceptedMimeTypes: []` stays dead config (pre-existing since Story 2.2, deferred-work-logged)
  — noted, not fixed here.
- **`src/stores/settings.ts` (+ `settings.spec.ts`):** new `hash.*` keys — the selected-algorithm
  set, default case, default encoding — added to the store's single-source `DEFAULTS` map (8.3's
  `uuid.*` pattern). No new Settings section.

## Deferred-work fixes folded into Task 2

Re-read `deferred-work.md` lines 42–51 (Story 2.5 review) and 84–90 (Story 2.4 review) before
Task 2b. Task 2 folds in the Hash-specific ones rather than re-deferring (8.3 precedent):

- **No in-flight / disabled state** on the hash action → the live-hash path disables + debounces.
- **No frontend size guard on the `<textarea>`** before the 100 MiB server check → a length
  ceiling on the live-hash path.
- **Per-row Copy has no feedback** → `useCopyFeedback` icon-button pattern.
- **No `role="status"` / `aria-live`** on a successful digest render → added; errors keep
  `role="alert"`.
- **No indication which input the digests belong to** after a drop → a source label / filename on
  the results panel.
- **`HashView.spec.ts` has no regression test** that `digests` clears when a new failure follows a
  prior success → close the gap in Task 2b.

**NOT folded — cross-tool infrastructure, governance-flagged (AD-6 / CLAUDE.md):**

- The **TOCTOU gap** between `check_file_size`'s metadata check and the later `read_file_bytes`
  read, and the **`check_file_size` duplication** — both shared verbatim with `base64.rs`. Fixing
  only `hash.rs` leaves `base64.rs` equally exposed. A shared bounded-read helper in
  `fs_helper.rs` is cross-tool infrastructure: present it to the developer as options with
  trade-offs (its own follow-up), checked against the project's governance patterns (CI gates,
  the `type(scope): subject` convention) — do **not** patch it quietly inside this story.
- **Multi-file drops silently hash only the first file** (`DropZone.vue` / `routeDrop`) — a shell
  concern, newly more relevant given "verify a batch of downloads." Flag for the developer, don't
  silently fix.

## i18n / AD-13 finding

Hash has no natural-language grammar (unlike NL→cron), so **no AD-13-style disclosed exception is
needed** — French rides the existing `vue-i18n` seam. Algorithm names (SHA-256, SHA3-512, …) stay
untranslated (proper nouns / standard identifiers).

New `tools.hash.*` keys expected (`en` + `fr` each, guarded by `src/locales/locales.spec.ts`
which runs every message through vue-i18n's real compiler — reach for the `{'{'}` / `{'}'}`
escape proactively for any string showing literal braces):

- the "not collision-resistant" qualifier for the MD5 / SHA-1 checkbox labels;
- the Hex / Base64 encoding-toggle labels + a group legend;
- the Verify field label, placeholder, and helper line;
- the **match** and **"does not match"** status strings;
- the successful-digest-render announcement text (`role="status"`);
- the smart-detection **offer** text ("Looks like a … digest — compare it?");
- the **"moved to Verify"** acknowledgement text (the developer's explicit "the user must
  understand their input has been moved" requirement);
- the "back to hashing" affordance label;
- a results-panel **source label** ("Text input" / a dropped filename).

**`src/shell/toolError.ts`'s `TRANSLATABLE_CODES` is NOT extended by this story.** Like Story 8.3,
Story 8.4 adds **no new `umbra-core` error paths**: SHA-3 uses the same `hash-input-too-large` /
`hash-internal` model, the encoding + case transforms cannot fail, and Verify's "does not match"
is a **result state, not a `ToolError`** — an inline `role="status"` phrased via a plain `t()`
call, not an `errors.*` code (the Dev Notes gotcha 1 call: a checksum mismatch is a status, not
an alert). `hash-input-too-large` (embeds a byte count in prose), `hash-internal` and
`file-read-error` all stay out, unchanged.

## Open items Task 2 (2a) still owns — not decided here

- The **exact Verify affordance layout** and, above all, the **smart-detection acknowledgement
  UX** — how the "your input has moved to Verify" transition reads so it is unmistakable (the
  developer's explicit requirement). Resolve on a polished design canvas at **UUID Story 8.3
  fidelity** — the exploration wireframes are not the target quality.
- **Which hex-digest lengths the smart detector recognises** and how it disambiguates — 64 hex
  chars is SHA-256 *or* SHA3-256; the offer either names the candidates or the Verify field
  simply checks the pasted value against every selected algorithm's digest.
- The **encoding + case control affordance** (segmented control vs. toggle vs. dropdown), whether
  they **compose**, and the exact `hash.*` persisted-setting shape.
- The **`Algorithm` enum's** exact variant set and serde naming; whether the core return type is
  a `Vec<DigestEntry>` or an ordered map; the exact `sha3` version to pin.
- Whether a **digest export to file** is wanted (currently **out** — a new `hash_export` command
  if 2a adds it).
- The **results-panel source-label** wording.
- Whether **`useCopyFeedback` hoists** from `src/tools/json/` to `src/shell/` — Hash would be its
  fourth consumer, the tip point its hoist-candidate comment names. Task 2's call.
- The real **Given/When/Then AC6+** for Verify / smart-detection / algorithm checkboxes / SHA-3 /
  encoding toggle / live hashing / the deferred-work fold-ins — that is **Task 2a**, run in the
  same `bmad-party-mode` room, scoped strictly to this record plus the polished canvas picks.
