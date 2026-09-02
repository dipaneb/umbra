# Story 8.5 — JWT Inspector: Task 1 Decision Record

**Date:** 2026-09-02
**Method:** `bmad-party-mode` (installed roster — Mary/Business Analyst, John/PM, Sally/UX, Winston/Architect, Amelia/Senior Engineer, Paige/Tech Writer; `session` mode; party memory resumed from the Epic 8 history, Stories 8.1–8.4).
**Status:** scope decisions confirmed by the developer 2026-09-02. Task 2a (real AC6+) written into `8-5-reimagine-the-jwt-inspector.md` in the same session.
**Design canvas:** *JWT Inspector Redesign* — `claude.ai/code/artifact/9ab4c58a-8f60-4cdd-9e71-8bdf32139529` (4 artboards: Resting / Decoded–healthy / Decoded–flags-firing / Edge-states; light theme; dark parity owed at build time).

This record satisfies Story 8.5 AC1–AC5. It reconsiders the JWT Inspector's scope from first principles. The shipped implementation (`crates/umbra-core/src/jwt.rs`, `src-tauri/src/commands/jwt.rs`, `src/tools/jwt/JwtView.vue`, `src/tools/jwt/jwtDecoded.ts`, the `tools.jwt.*` i18n, the `jwt` registry entry) was read in full at session start and confirmed to match the story's Dev Notes with no drift.

---

## Framing — the JTBD answer that shaped everything (AC1)

The developer does **not** manipulate JWTs by hand in real life. They use JWTs as web-auth access tokens but never hand-edit or verify them. The job the tool actually serves:

> *Decode a token I was handed. Read its claims. Tell me if it's expired or not yet valid. Help me see why my auth is failing.*

Signature work — raw display or verification — is **not** in that job. The whole redesign budget goes to making the decode excellent.

---

## Kept (unchanged, and deliberately so)

| Item | Rationale |
| --- | --- |
| `umbra-core::jwt` — `JwtDecoded` struct, `decode`, `decode_segment`, `numeric_claim`, **all 11 unit tests** | The decode is correct, RFC-7519-object-checked, float-`NumericDate`-tolerant. Nothing about it needs to change. |
| `src-tauri/src/commands/jwt.rs` — the single `jwt_decode` command, `spawn_blocking` (AD-4), `map_join_error` → `jwt-internal` | Decode is microseconds; the blocking-pool hop is AD-4 consistency, not need, and stays. No new command. |
| `src-tauri/src/lib.rs` — `use commands::jwt::jwt_decode;` + the `generate_handler!` entry | Command surface is unchanged, so registration is unchanged. |
| `src/tools/jwt/jwtDecoded.ts` — the hand-synced TS mirror | **No struct field is added** (see AD-1 split below), so the mirror does not change. |
| `src/stores/registry.ts` `jwt` entry — `aliases`, `route`, `icon: "jwt"`, **`clipboardMatch: { test: matchesJwt, specificity: 3 }`**; **no `drop`, no `shortcut`** | The clipboard hook is load-bearing for EXPERIENCE.md Flow 4 (JWT is that flow's worked example) and has worked since Story 7.8. Not reopened. |
| `src/shell/clipboardMatch.ts` — `matchesJwt` / `isJwtShaped` (exactly 3 non-empty base64url `.`-segments) | Left exactly as-is. Tightening it is an AD-6 **shell** concern and a backlog candidate (see Cut list), not an in-story tweak. |
| 3-segment split; header/payload base64url-decode + JSON-**object** check; `exp`/`iat`/`nbf` extracted as `i64` **unix seconds** across IPC (Consistency Conventions) | Correct and unchanged. |
| The persistent "signatures are not verified" honesty guarantee (Story 2.6 AC4 — "no verification present or implied by the UI") | **Reworded and relocated, never removed.** See Changed. |
| `src/tools/jwt/JwtView.spec.ts` intent (decode renders, expired flag on/off/absent, error via `role="alert"`, notice always present, stale-output cleared on later failure) | Behaviours preserved; the specs are rewritten to the new structure in Task 2b, not discarded. |

---

## Changed (interaction)

| Change | Detail | Rationale |
| --- | --- | --- |
| **Live decode** | `watch(token, …)` debounced 200 ms (`src/shell/debounce.ts`, `.cancel()` in `onUnmounted`) replaces the explicit **Decode** button. | Matches the 8.2 / 8.3 / 8.4 direction. Decode is trivially fast; a button was ceremony. |
| **Paste button removed** | The **Paste from clipboard** button is cut entirely. | Native `Cmd/Ctrl+V` into the textarea works, and `clipboardMatch` already surfaces the tool when a JWT is on the clipboard. Developer's explicit call ("hell no" to keeping it). 8.2 precedent. |
| **Zero action buttons** | The tool is now **one textarea + read-only output**. Nothing claims `AppButton variant="primary"` (the app's budget-of-one orange). | Deliberate and recorded — "budget of one" is a ceiling, not a quota (Base64/UUID spend none either). |
| **Header/payload stay `<pre>`** | `JSON.stringify(v, null, 2)` in a tokenised `<pre>` — **not** `JsonTree.vue`. | Developer's call ("for now let's keep it with pre"). Closes the AD-6 cross-island-component question cleanly — `JsonTree.vue` stays a JSON-tool island; reuse is a backlog candidate. |
| **Epic-7 tokenisation pass** | `JwtView.vue` is 100 % pre-Epic-7. `#666` / `#ccc` / `#b00020` / `border-radius: 6px` / bare `monospace` → `--color-text-secondary` / `--color-border-hairline` / `--color-accent-destructive` / `--radius-*` / `--font-code-*`. `base.css` already styles the bare `<textarea>` — don't re-style what it covers. | Comparable scope to 8.4's tokenisation pass. First slice of Task 2b. |
| **Per-block Copy** | Header and Payload each get a ~24 px ghost icon-button (outline copy glyph, no label) via `useCopyFeedback` (`src/tools/json/useCopyFeedback.ts`, cross-tool import with its existing hoist-candidate comment — hoist still **not** done). `markCopied` only after the write resolves; `cancelCopyFeedback()` in `onUnmounted` **and** on a fresh decode. | The tool has **no** copy control today. Standard pattern across JsonTree/Base64/UUID/Hash. |
| **"Not verified" notice → description caption + `?` popover** | The dashed-box `.notice` is removed. In its place: a **plain one-line description caption** under the `h1` (`--color-text-secondary`, caption size, **no border, no box**) — *"Decodes and displays a token's contents. It does not verify signatures."* — plus a **`?` `AppPopover`** (the `WeakHashPopover` pattern from 8.4) whose panel carries the longer explanation (the three parts of a JWT; this tool reads two of them; it cannot tell you a token is genuine). | Developer rejected the dashed box outright: *"why use the dotted box used for dropping a file?"* — the dashed border is the app's drop-zone signal (`HashView`'s `.drop-hint`), and JWT has no drop path. The always-visible one-liner keeps the Story 2.6 AC4 honesty guarantee; the `?` is progressive disclosure for the detail. |
| **Live-clock expiry** | `isExpired` and a new `isNotYetValid` become computeds off a `now` ref reticked by a `setInterval` (cleared in `onUnmounted`). | Today `isExpired` snapshots `Date.now()` once at decode — absurd for a live-decoding tool that can sit open past a token's `exp`. |
| **`nbf` "not valid yet" flag** | A `role="status"` line — *"Not valid yet — starts in {relative}"* — sibling to the expired line, shown when `nbf` is in the future. | Today an `nbf`-in-the-future token looks identical to a healthy one. |
| **Claims: relative time** | Each `exp`/`iat`/`nbf` row shows the absolute local datetime **and** a muted relative time in parens (`(in 59 minutes)` / `(3 days ago)`), recomputed off the live clock. | jwt.io-style affordance; the single most useful thing when triaging "is this expired". View-side string formatting (AD-1). |
| **Claims: out-of-range bounds check** (`deferred-work.md` fold-in #1) | `formatClaim` bounds-checks before `new Date(value * 1000)`; an `i64` whose `* 1000` exceeds `Number.MAX_SAFE_INTEGER` renders an honest *"timestamp out of representable range"* instead of "Invalid Date". | Legal per the Rust type and RFC 7519 `NumericDate`; degrades gracefully today but silently. |
| **Claims: wrong-type vs absent** (`deferred-work.md` fold-in #2) | A registered claim present with the wrong JSON type (string/bool/array) currently renders identically to "not present" (`numeric_claim` returns `None` for both). The view now reads the **raw `payload` `Value`** for `exp`/`iat`/`nbf` and, when the key exists but isn't a number, renders the raw value plus a factual note — *"present, but not a number (string)"*. Muted, not red. **No core change** — the view already holds the full `payload`. | The 2026-08-02 deferral said "whether a wrong-type registered claim should error or stay silent is a UX call." This is that call: show it, factually, not as an error. |

---

## Added

| Addition | Detail | Rationale |
| --- | --- | --- |
| **`MAX_INPUT_BYTES` in `umbra-core::jwt`** | A `const` (1 MB) + a length guard at the top of `decode` returning a new **`jwt-input-too-large`** `ToolError`, plus ~3 unit tests. Mirrored by a frontend length ceiling that stops the IPC round-trip on the live path (defense-in-depth, the Hash 8.4 `AC19` pattern — "the cap holds end to end even if the guard is bypassed"). | JWT is the **only** one of `json` / `base64` / `hash` / `jwt` with **no** size cap. Live-on-keystroke decode makes a pathological paste a real cost. A JWT is a credential in an HTTP header — definitionally small; 1 MB is ~250× the fattest realistic token. Over-cap renders as a calm `role="status"` line ("larger than any real token — nothing was decoded"), **not** a red error. **This is the only Rust change in the story.** |
| **Conditional unsigned-`alg` warning** | Fires **only** when the header `alg` is `"none"`, absent, or not a string. A boxless inline statement: `--color-accent-destructive` text + a small triangle glyph — *"This token is unsigned (`alg: none`) — anyone can create or alter it."* **No permanent "Algorithm:" line.** | Developer's open question — *"do we really need to say 'algorithm: …' when the first line of the decoded header is the algorithm?"* — answered: no. For a normal `alg` (HS256/RS256/ES256…) a dedicated line just re-prints header line 2 (the "100 UUIDs = 200 lines" redundancy that killed the extended claims table). The callout earns its place **only** as a warning anchor for the dangerous cases, so it's conditional, boxless, and always visible when it applies (never a hidden `?`). |

---

## Cut → backlog (AC3)

Filed as `backlog-candidate` GitHub issues on `dipaneb/umbra` (the developer confirmed GitHub issues this story, unlike 8.3/8.4's personal-backlog route), each linking back to this record. Issue #55 ("JWT signature verification") already exists — a comment was added rather than a duplicate.

| # | Idea | Why cut | Issue |
| --- | --- | --- | --- |
| 1 | **Offline signature verification** (HS*/RS*/ES*/EdDSA against a pasted secret / PEM / JWK) | Developer doesn't verify tokens by hand; the job doesn't need it. It is a real second job (crypto crate, `verify` primitive, `AppTabs.vue` Decode/Verify, a hard AD-7 network-free audit — **never** a JWKS-by-`kid` fetch). Out of scope for this tool; stays the P3 backlog item it already was. | [#55](https://github.com/dipaneb/umbra/issues/55) (comment added) |
| 2 | **Surface the raw signature segment** (display-only, zero crypto) | 40-odd opaque base64 characters a non-expert can't act on is noise, not information. Winston argued against it even though it *would* be a `umbra-core` change he'd otherwise want. | [#120](https://github.com/dipaneb/umbra/issues/120) |
| 3 | **Signature-segment validation** ("signature segment is not valid base64url") | A real gap — a token with a mangled 3rd segment decodes fine today and looks healthy — but showing raw bytes doesn't fix it and a full validation is its own scope. | [#121](https://github.com/dipaneb/umbra/issues/121) |
| 4 | **Extended named-claims table** (`iss` / `aud` / `sub` / `jti` with human labels) | Redundant with the `<pre>` payload we're keeping. The three timestamp rows exist because they need *transformation* (epoch → datetime); `iss`/`aud`/`sub` are already human-readable strings in the payload. | [#122](https://github.com/dipaneb/umbra/issues/122) |
| 5 | **Two-token diff / compare mode** | EXPERIENCE.md lists "structural diff/compare mode … two JWTs" as a MAYBE. A distinct job; not this redesign. | [#123](https://github.com/dipaneb/umbra/issues/123) |
| 6 | **`JsonTree.vue` for header/payload rendering** | Developer kept `<pre>` for now. Reuse would mean either a cross-island import or a hoist to shared — an AD-6 / governance decision to make deliberately, not as a side effect. | [#124](https://github.com/dipaneb/umbra/issues/124) |
| 7 | **Tighten `isJwtShaped`** | `x.y.z` matches today. Options: (A) require segment 1 to start `eyJ` (base64url of `{"`) — effectively free; (B) base64url-decode + `JSON.parse` segment 1 and require an object with a string `alg`. AD-6 **shell** file — present-as-options, and it's worked since 7.8, so backlog rather than reopen it now. | [#125](https://github.com/dipaneb/umbra/issues/125) |

---

## Container shape

**Single enriched view. No tabs.** `AppTabs.vue` stays unused. JWT is a single-job tool (decode). Tabs would be justified **only** if verification were added as a genuine second job (Decode / Verify) — and verification is cut. This holds the 8.1–8.4 discipline (8.1 JSON earned tabs on genuine multi-job; 8.2/8.3/8.4 stayed single enriched views). No design-canvas comparison of container shapes was needed; the canvas instead documents the redesigned states.

---

## FR revision (AC2)

Epic 8's preamble makes the FR16/FR17 revision this story's own output.

- **FR16** (was: "Decode a pasted JWT into header and payload, pretty-printed, without any network call (no JWKS fetching)")
  → **revised/expanded:** decode is **live / as-you-type** (no explicit action); the header **`alg` is surfaced** with an unsigned-token warning when it is `none` / absent / non-string; **signature verification is explicitly out of scope for this tool** — not merely "no JWKS fetch". Still zero network (AD-7).
- **FR17** (was: "Render `exp`, `iat`, `nbf` claims as human-readable local datetimes; visibly flag expired tokens")
  → **revised/expanded:** claims render as an absolute local datetime **plus a relative time**; **both expired and not-yet-valid (`nbf`)** are visibly flagged; the flags **re-evaluate on a live clock** (not a decode-time snapshot); a registered timestamp claim **present with the wrong JSON type** is shown as such rather than rendering identically to "not present"; an **out-of-range** timestamp degrades to an honest message, not "Invalid Date".
- **FR18** ("verification is P2 at the earliest") **and Story 2.6 AC4** → **revised:** signature verification is **explicitly out of scope for the JWT Inspector**; it remains a **P3 backlog candidate** (issue #55).

---

## AD-1 functional-core split (AC4)

The cleanest split in Epic 8.

### Survives as-is in `crates/umbra-core/src/jwt.rs`
`JwtDecoded` struct · `decode` · `decode_segment` · `numeric_claim` · all 11 unit tests.

### New core work (the entire Rust diff for this story)
- `const MAX_INPUT_BYTES` (1 MB) + a byte-length guard at the top of `decode`.
- A new `jwt-input-too-large` `ToolError` code (fixed prose that embeds the byte count → **stays out of `TRANSLATABLE_CODES`**, matching `hash-input-too-large` / `json-input-too-large`).
- ~3 unit tests (at cap, over cap, and that a normal token is unaffected).

### Explicitly NOT new core work
- **No `verify` primitive.** No `verify(token, key, expected_alg) -> Result<VerificationOutcome, ToolError>`. The signature segment stays discarded.
- **No crypto crate.** `crates/umbra-core/Cargo.toml` gains nothing. No `jsonwebtoken`, no `ring`, no RustCrypto `hmac`/`rsa`/`p256`/`ecdsa`/`ed25519-dalek`. The AD-7 `cargo tree -i reqwest` audit is therefore N/A this story — no new dependency enters the tree.
- **No command-surface change.** `jwt_decode` is the only command; no `jwt_verify`; `map_join_error` unchanged; `src-tauri/src/lib.rs` registration unchanged.
- **No `jwtDecoded.ts` change.** No new struct field (`signature`, `alg`, a `VerificationOutcome`), so the hand-synced mirror is untouched.
- **No registry / `clipboardMatch` / `isJwtShaped` change** (all Kept above).

### View-owned (AD-1 presentation — never core)
Live debounced decode + the frontend length ceiling; `alg` extraction from `decoded.header` and the conditional unsigned warning; live-clock `isExpired` / `isNotYetValid` computeds; relative-time strings; `formatClaim` bounds check; wrong-type-claim detection (reads the raw `payload` `Value` the view already holds); per-block Copy via `useCopyFeedback`; the Epic-7 tokenisation; the description caption + `?` popover; removal of both buttons; the collapse of `onDecode`/`onPaste` into one debounced `watch`.

### AD-16 (latest-wins scoping)
One **local** `createLatestWinsRunner()` still backs the single write-surface (`decoded`), now driven by the debounced watcher instead of two click handlers. **Not** `registry.getLatestWinsRunner("jwt")` — JWT has no `DropZone.vue` path (confirmed). The view's existing comment explaining why a local runner suffices stays true.

---

## i18n / `TRANSLATABLE_CODES` finding

- **No `jwt-*` code becomes translatable.** Every existing `jwt-*` code (`jwt-malformed`, `jwt-invalid-header`, `jwt-invalid-payload`, `jwt-internal`) embeds a runtime value in its `message` prose and continues to render raw via `toolErrorMessage`. The new `jwt-input-too-large` embeds a byte count → also stays **out**, matching `hash-input-too-large` / `json-input-too-large`. `src/shell/toolError.ts`'s `TRANSLATABLE_CODES` is **not** extended by this story.
- **New locale keys** (`src/locales/{en,fr}.json`, `tools.jwt.*`): the description caption, the `?`-popover body, the unsigned-`alg` warning, the wrong-type-claim note, the not-valid-yet line, the relative-time unit strings, and the over-cap `role="status"` line. `src/locales/locales.spec.ts` compiles every message.
- **vue-i18n `{` / `}` trap:** any new string that carries literal braces or `{placeholder}`-looking text (a JSON snippet in the `?`-popover explainer, `alg: none` shown inline) needs the `{'{'}` / `{'}'}` escape. Reach for it proactively — `locales.spec.ts` guards it but it's cheaper to write correctly.
- **AD-13:** no disclosed exception needed — JWT has no natural-language grammar. `alg` identifiers (`HS256`, `EdDSA`, …) and claim names (`iss`, `aud`, …) are standard identifiers, **not** translated (same rule as tool names and hash algorithm names).

---

## `JsonTree.vue` reuse decision

**Not reused this story.** Header and payload stay a tokenised `<pre>` (`JSON.stringify`). `src/tools/json/JsonTree.vue` remains a JSON-tool island under `src/tools/json/`. Whether to reuse it (cross-island import) or hoist it to a shared location is a deliberate AD-6 / CLAUDE.md shared-component governance decision — filed as backlog issue #6, not made silently here.

---

## Open items Task 2a owns

1. The exact 1 MB cap value and the exact over-cap copy.
2. Relative-time thresholds and wording ("in 59 minutes" vs. "in about an hour"; "just now"; when to fall back to the absolute only).
3. `?`-popover placement (`AppPopover` `placement` prop) and the **light + dark `--shadow-floating` render-review** owed on this new (second app-wide) `AppPopover` consumer — `--shadow-floating`'s dark value is still `[ASSUMPTION]` in DESIGN.md.
4. Whether the wrong-type-claim note also covers a non-integer *number* (float that isn't a whole `NumericDate`) or a negative epoch.
5. Whether a successful decode gets a `role="status"` announcement on the output (today only the expired sub-line announces) — accessibility fold-in candidate.
6. Exact spec rewrite of `JwtView.spec.ts` to the new structure (Task 2b, but the AC set should name the behaviours that must stay covered).
