---
story: 8-2-reimagine-base64-encode-decode
produced_by: bmad-party-mode (installed roster — Mary, John, Sally, Winston, Amelia, Paige), party_mode session
date: 2026-08-29
status: decided — Task 1 complete, gates Task 2
---

# Decision Record: Base64 Encode/Decode scope (Story 8.2, Task 1)

Open scope discovery, run per Epic 8's shared story shape — the shipped implementation
(`crates/umbra-core/src/base64.rs`, `src-tauri/src/commands/base64.rs`,
`src/tools/base64/Base64View.vue`, `tools.base64.*` locales) was treated as reference only,
not a scope to preserve by default. All three source files were re-read in full at the start
of this session and matched the story's Dev Notes exactly — no drift since drafting. Grounded
in a competitive sweep of the Base64 tool landscape (the quick converters — base64decode.org,
base64encode.org; the toolkits — CyberChef; the "Base64 to Image" cottage industry; browser
devtools; the platform `base64` CLI). Developer confirmed the container choice and all three
open scope questions 2026-08-29.

## Kept — no material change

- **Text ↔ Base64**, standard **and** URL-safe alphabets, alphabet **auto-detected on decode**
  by the presence of `-`/`_` (FR10's mechanism).
- **Whitespace- and line-wrap-tolerant decode** — PEM/MIME wrapping and trailing newlines are
  stripped before decoding, not rejected.
- **File → Base64** via the shell's window-drop dispatcher (AD-14) and **Base64 → file** via the
  save dialog + `base64_decode_to_file` (FR11's mechanism).
- **Two distinct decode errors** — `base64-not-utf8` vs `base64-invalid` — each carrying a
  **byte-offset `Position`** where one is meaningful (FR12's mechanism — see **Revised** below
  for the classification/translation change).
- **The 100 MB input cap** (`MAX_INPUT_BYTES`, `crates/umbra-core/src/base64.rs`) and the
  **10 MB dropped-file cap** (`MAX_FILE_BYTES`, `src-tauri/src/commands/base64.rs`, deliberately
  smaller because an encoded file's *output* grows with its input and has to render in a
  `<textarea>`). Both are CWE-400 defenses with existing regression tests. No evidence surfaced
  that either ceiling is wrong; new capabilities must be sanity-checked against them, not
  exempted.
- **All 20 core regression tests** and the existing `Base64View.spec.ts` component tests —
  re-verified and extended by Task 2, not replaced.
- **The registry-dispatched drop** (AD-14 — view supplies only `url_safe`), the **decode-to-file
  save flow**, and **latest-wins** on the shared output surface (AD-16 — one
  `createLatestWinsRunner()` is correct as-is because encode/decode/paste all write the one
  `output` ref).
- **The `base64` registry entry's `clipboardMatch`** (Story 7.8's clipboard-suggestion surface)
  — untouched. Changing its shape is a shell concern, explicitly out of this story's scope.

## Changed — interaction, not capability

The redesign's UI/interaction changes. None of these is a new transformation; they reshape how
the existing capability is presented.

- **Live conversion.** The **Encode / Decode buttons are removed**; conversion runs
  **as-you-type** (debounced, same pattern as `JsonView.vue`'s live tree-parse). This is the
  single biggest behavioural shift and the reason several other button decisions fall out below.
- **Direction is a small segmented switch** (Encode ⇄ Decode), not two buttons in an action row.
- **The Paste button is cut.** `cmd+V` works in any textarea; a dedicated button earned its
  place in JSON's pipeline-style flow but not here — Base64 is a *lookup* ("what does this
  decode to"), not a multi-stage pipeline. *This is a deliberate divergence from Story 8.1,
  which kept explicit Paste/Copy (its FR4); recorded here rather than left implicit.*
- **Copy survives as a small icon** on the output panel (24px, `--font`-sized floor per
  `JsonTree.vue`'s copy buttons), not a full-width button in a row — a large decoded output is
  miserable to select-all-drag, so the affordance stays, downsized.
- **One contextual slot** directly under the output, **priority-ordered and never stacked**:
  an *error* outranks a *detection result* outranks a *data-URI offer*. If several are true at
  once, the user sees the most important one; the rest are one interaction away. This is the
  concrete answer to the developer's "make it feel less cluttered even though a lot is going
  on" — the screen is only ever as complex as the input given to it. Detection and offers
  render as a **caption line**, not a tinted card.
- **Full tokenization pass** (the tool is 100% pre-Epic-7): replace hardcoded `#666`/`#ccc`
  (`.drop-hint`) and `#b00020` (`p[role="alert"]`) with `--color-*` tokens; adopt
  `--font-code-*` for the in/out panels; `--radius-*` / `--spacing-*` for layout; bare
  `<button>`s → `AppButton`. `src/styles/base.css` already covers a bare `<textarea>`'s border
  and focus ring — don't re-style what it covers.

## Added — the redesign's real new scope

1. **Data URI support** *(new)* — two directions:
   - **Build** — pick a MIME type (prefilled from a dropped file's extension when one is
     dragged in), get `data:<mime>;base64,<payload>`.
     - **Decode** — paste a `data:[<mime>][;base64],<payload>` string; the tool parses the
       prefix off, and when the MIME is an image it renders an **inline preview** before any
       save, with **Save as file** writing the decoded bytes. This is the highest-demand
       "added" candidate from the sweep and the one the developer explicitly wanted (while
       noting they didn't know how it worked — it's `<img src="data:…">`, no file needed for
       the preview; save is decode-to-bytes + write).
2. **Blob detection — "looks like X"** *(new)* — paste an opaque blob, the tool sniffs it and
   emits **one quiet caption line** under the output: three Base64URL segments whose first
   segment decodes to a JOSE header → *"Looks like a JWT · [Read as JWT]"*; decoded bytes
   starting `1F 8B` → gzip, `89 50 4E 47` → PNG, `25 50 44 46` → PDF, `50 4B 03 04` → zip;
   decodes to clean UTF-8 → it's text; doesn't decode as Base64 at all → *"Not valid Base64 —
   first invalid character at offset N"*. **Honest-by-construction**: it is never asserted as
   fact, it is always confirmable, and it must be able to answer **"unknown"**. This is a
   direct application of **AD-9** ("never a confident-sounding wrong answer") and
   `EXPERIENCE.md`'s honesty bar to a **security-adjacent** tool where people paste auth
   tokens — a confident-but-wrong "this is a JWT" is worse than silence. Same preview-then-
   confirm contract as JSON's Repair tab and the cron tool's disclosed guess.
3. **Line-wrap on encode** *(new)* — a small `none / 64-col / 76-col` selector near the output.
   The tool *tolerates* wrapped input on decode today but can only *emit* one unbroken line;
   real use (a cert body pasted into a config, an email header) wants PEM/MIME wrapping out.
   `encode_bytes` gains a `wrap: Option<LineWrap>` parameter.

### Container shape — single enriched view (Option A)

Decided against a comparison canvas of three containers (published as an Artifact for the
developer, 2026-08-29):

- **Option A — single enriched view** *(chosen)*: input, direction switch, output; everything
  else summoned by the content into the one contextual slot. Honest to the tool's real size,
  no mode-declaration before you can work, composes with live conversion.
- **Option B — tabbed** (JSON's pattern) *(rejected)*: four tabs read as ceremony for a tool
  that's mostly one in→out flow; Encode/Decode as separate tabs fights live conversion (you'd
  re-paste on switch); forces per-tab latest-wins runner scopes (the `CronView.vue` cautionary
  case) for no real gain.
- **Option C — two-pane + mode strip** *(rejected)*: side-by-side panes halve the vertical
  space, and Base64 blobs are tall; two axes of control (mode strip + direction) to learn.

**`AppTabs.vue` is deliberately NOT used** — Story 8.1's own discipline: don't add tabs to a
single-view tool. If the tool later grows enough distinct jobs to warrant it, the layout can
change then; that is not this story.

## Cut — considered, explicitly rejected, backlog candidates (FR35)

Filed with the developer's go-ahead 2026-08-29 as individual, max-context GitHub issues on
`dipaneb/umbra`, `backlog-candidate` label (the project's idea-capture convention — cf. issue
#47 "Backlog candidate: URL encoder"):

1. **Base64 → hex / other-radix views of the decoded bytes** — [#113](https://github.com/dipaneb/umbra/issues/113).
   CyberChef territory. The "looks like a PNG" detection covers the real need ("is this binary,
   roughly what is it"); a byte/hex inspector is a different tool. *Rejected: makes it a
   different tool.*
2. **"Decode as gzip / inflate / decompress"** — [#114](https://github.com/dipaneb/umbra/issues/114).
   A compression tool wearing a Base64 hat. Detection can *say* "looks gzip-compressed";
   actually inflating it is its own story with its own core dependency and its own size-guard
   questions. *Rejected: makes it a different tool.*
3. **Chained / recursive decode** ("decode, then decode the result again, repeat") —
   [#115](https://github.com/dipaneb/umbra/issues/115). Near-zero evidenced demand, and it
   fights the live single-input conversion model. *Rejected: power-user catnip, fights the
   interaction model.*

### Drafted issue bodies (for `gh issue create` on approval)

> **Title:** Backlog candidate: hex / byte-inspector view of decoded Base64
> **Body:** Surfaced and cut during Story 8.2's Base64 scope discovery (see
> `_bmad-output/implementation-artifacts/8-2-base64-decision-record.md`). Idea: after decoding,
> offer a hex / configurable-radix view of the raw decoded bytes (offset gutter, ASCII column).
> Cut from the 8.2 redesign because the "looks like a PNG/PDF/gzip" detection already answers
> the real question ("is this binary, roughly what") and a full byte inspector is a distinct
> tool, not a Base64 feature. Revisit only if a concrete recurring need appears. FR35.

> **Title:** Backlog candidate: "decode as gzip / inflate" for Base64 blobs
> **Body:** Surfaced and cut during Story 8.2's Base64 scope discovery. Idea: when a decoded
> blob starts with the gzip magic bytes (`1F 8B`), offer to inflate it in place. Cut because
> it pulls a compression dependency and its own size-guard/streaming questions into a tool
> whose job is Base64; the 8.2 detection line will *name* "looks gzip-compressed" without
> acting on it. A proper decompress tool (or a JSON-style tab) is the right home. FR35.

> **Title:** Backlog candidate: recursive / chained Base64 decode
> **Body:** Surfaced and cut during Story 8.2's Base64 scope discovery. Idea: iteratively
> decode a doubly/triply-encoded blob until it stops being valid Base64. Cut: near-zero
> evidenced demand, and it fights 8.2's live single-input conversion model (what would "the
> input" even be on step 3?). If it ever lands, it's an explicit multi-step mode, not a
> default. FR35.

## FR10–FR12 revision

Epic 8's preamble makes this revision each story's own output, not a prediction locked in
advance.

- **FR10** (text ↔ Base64 including URL-safe alphabet, auto-detected on decode) — **kept
  accurate, expanded**: the same "text ↔ Base64" capability now also covers **live
  as-you-type conversion** and **line-wrap-on-encode** (`none / 64 / 76`). Alphabet
  auto-detection on decode is unchanged.
- **FR11** (file → Base64, and Base64 → downloadable file) — **revised / expanded**: **data
  URI becomes a first-class form of "file ↔ Base64"** — build a `data:` URI with a chosen MIME
  type, and decode a `data:` URI with an **inline image preview** before the existing
  save-to-file flow. The window-drop and save-dialog mechanisms are unchanged.
- **FR12** (invalid input → a clear inline error, never a crash or silent empty output) —
  **kept, expanded**: the same honesty bar now also governs **blob detection** — a "looks
  like X" identification is never asserted as fact, is always confirmable, and can answer
  "unknown" (AD-9). Distinct `base64-not-utf8` vs `base64-invalid` errors with byte offsets
  are unchanged in mechanism; see the i18n finding below for the classification/translation
  change.
- New capability areas this story adds (**data URI**, **blob detection**, **line-wrap on
  encode**) are not yet numbered FRs — final FR numbering in `epics.md` is the PM's call, not
  this record's; stated here as this story's actual scope addition, per Epic 8's own preamble.

## AD-1 functional-core split

- **Survives as-is in `crates/umbra-core/src/base64.rs`:** `encode` / `encode_bytes` /
  `decode` / `decode_bytes`, the custom `DecodePaddingMode::Indifferent` decode engines
  (`STANDARD_DECODER` / `URL_SAFE_DECODER`), whitespace-strip-before-decode, alphabet
  auto-detection, the UTF-8 layer with byte-offset `Position` in `decode`, `map_decode_error`,
  `MAX_INPUT_BYTES` (100 MB) and `check_size`. All 20 regression tests stay.
- **New pure functions needed** (exact signatures are Task 2's design job, not pre-decided
  here):
  - `parse_data_uri(input: &str) -> Result<DataUri, ToolError>` — splits
    `data:[<mediatype>][;base64],<payload>` into MIME + raw payload; a malformed prefix returns
    a new classified code (e.g. `base64-data-uri-malformed`). No I/O.
  - `sniff(bytes: &[u8], original_input: &str) -> Sniff` — returns an **enum of candidate
    identifications** (`Jwt`, `Png`, `Pdf`, `Gzip`, `Zip`, `Utf8Text`, `Unknown`,
    `NotBase64 { offset }`), carrying ambiguity/confidence rather than collapsing to one
    confident answer. Pure, no I/O.
  - `encode_bytes` gains a `wrap: Option<LineWrap>` parameter (`LineWrap::Mime64` /
    `LineWrap::Mime76` / `None`); `encode` forwards it. Line-wrapping the output string happens
    **in core**, not in Vue.
- **`src-tauri/src/commands/base64.rs` changes — yes, additively:**
  - `base64_encode` and `base64_encode_file` gain the `wrap` argument (still `spawn_blocking`,
    AD-4; still `Result<T, ToolError>`, AD-3).
  - New commands `base64_parse_data_uri` and `base64_sniff` — both `spawn_blocking`, both
    `Result<T, ToolError>`, both named `base64_<verb>` (AD-3 / AD-4). **AD-16:** `sniff` and
    live decode both write the *same* output/contextual surface, so they share the view's one
    latest-wins runner — no new independent state group. "Build a data URI" *might* be a
    genuinely independent group needing its own runner scope — **Task 2's call** (see open
    items).
  - `MAX_FILE_BYTES` (10 MB), `check_file_size`, `base64_decode_to_file`, `map_join_error`
    unchanged. A data-URI-decoded image save reuses `base64_decode_to_file` / `fs_helper`
    (AD-15 — `umbra-core` never touches the filesystem).

## i18n / AD-13 finding

Base64 has no natural-language grammar (unlike NL→cron), so **no AD-13-style disclosed
exception is needed** — French rides the existing `vue-i18n` seam like every other tool, and
the new detection/data-URI strings are ordinary `tools.base64.*` keys with `en` + `fr` entries
(guarded by `src/locales/locales.spec.ts`, which runs every message through vue-i18n's real
compiler — reach for the `{'{'}` / `{'}'}` escape proactively for any string showing literal
`data:` / alphabet / brace syntax).

**Real pre-existing gap found, folded into Task 2's scope** (the same shape as Story 8.1's
`json-*` finding): **`src/shell/toolError.ts`'s `TRANSLATABLE_CODES` set has zero `base64-*`
coverage.** `base64-invalid` and `base64-not-utf8` currently pass the raw `base64`-crate /
`FromUtf8Error` message text straight through — English, and sometimes with an offset baked
into the prose. Task 2 should introduce **classified `base64-*` codes** (e.g.
`base64-invalid-char`, `base64-invalid-length`, `base64-invalid-padding`, `base64-not-utf8`)
that carry the byte offset only as the structured `position` field and no baked-in English,
then add those classification codes to `TRANSLATABLE_CODES`. Codes that must embed a runtime
value in prose (a byte count in `base64-input-too-large`) stay out of the set, exactly as
`json-input-too-large` does — that file's own documented constraint.

## Open items Task 2 still owns (not decided here)

- Whether **"build a data URI"** is a genuinely independent state group needing its own
  latest-wins runner scope (AD-16), or folds into the one shared output surface.
- The **detection candidate set and priority order** *within* the detection category (error >
  detection > data-URI offer is settled; ordering among JWT / PNG / PDF / gzip / zip / text is
  Task 2's).
- The **line-wrap control's affordance** (inline selector vs. a persisted setting) and its
  **default** (`None` vs `76`).
- Whether an **inline image preview needs a CSP change** for `data:` image sources in the Tauri
  webview — verify during Task 2.
- The **exact classified `base64-*` code set** and their `TRANSLATABLE_CODES` membership.
- The real **Given/When/Then acceptance criteria** for each added capability — Task 1's whole
  point was to make Task 2's ACs real instead of fiction; that is Task 2a, run in the same
  `bmad-party-mode` room, scoped strictly to this record.
