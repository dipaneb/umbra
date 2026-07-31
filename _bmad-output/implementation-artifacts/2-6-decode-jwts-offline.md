---
baseline_commit: 3a6ff61
---

# Story 2.6: Decode JWTs offline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want to decode JWTs entirely offline with humanized claims,
so that I can inspect real tokens without sending them anywhere.

## Acceptance Criteria

1. **Given** a pasted JWT, **when** decoded, **then** header and payload display pretty-printed, with zero network calls — no JWKS fetching exists in the code (FR16, AD-7), **and** decoding lives in `umbra-core::jwt` (AD-1).
2. **Given** registered timestamp claims (`exp`, `iat`, `nbf`), **when** the payload renders, **then** each shows as a human-readable local datetime — core returns epoch values, the view renders locale/timezone (FR17, AD-1), **and** an expired token is visibly flagged (FR17).
3. **Given** a malformed token, **when** decoding fails, **then** the error states which segment failed and why, carried in `ToolError.code`/`context` — never only prose (FR18, AD-3).
4. **Given** the tool's v1 scope, **when** reviewed, **then** no signature verification is present or implied by the UI; the tool states that signatures are not verified (FR18 — verification is P2 at the earliest).

## Tasks / Subtasks

- [x] **Task 1: `umbra-core::jwt` — decode, don't verify (AC: 1, 2, 3)**
  - [x] Create `crates/umbra-core/src/jwt.rs`. **Reuse, don't reinvent Base64URL decoding** — `crate::base64::decode_bytes` (already `pub`, already tolerant of unpadded input via `DecodePaddingMode::Indifferent`, already auto-detects the URL-safe alphabet) is exactly the JWT segment codec per RFC 7519 — JWT segments are always unpadded Base64URL. Do not add a `base64` crate dependency to this module or write a second decoder; `use crate::base64::decode_bytes;`.
  - [x] No new dependency: `serde_json` (already a workspace dep) parses the decoded header/payload bytes into `serde_json::Value` — same pattern as `json.rs::parse`. Do **not** add the `jsonwebtoken` crate or any other JWT library — it exists to *verify* signatures, which FR18 explicitly excludes from v1 scope; pulling it in for decode-only use would be a wrong-library disaster (unused verification surface, extra dependency-license review for no benefit).
  - [x] Define:
    ```rust
    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    pub struct JwtDecoded {
        pub header: serde_json::Value,
        pub payload: serde_json::Value,
        pub exp: Option<i64>,
        pub iat: Option<i64>,
        pub nbf: Option<i64>,
    }
    ```
    `header`/`payload` stay as `serde_json::Value` — pretty-printing them is a presentation concern (AD-1: "core returns machine values... the view renders them"), exactly like `json.rs::parse` returns an unformatted `Value` and lets the caller decide formatting. Do not format/indent JSON in this module.
  - [x] Implement `pub fn decode(token: &str) -> Result<JwtDecoded, ToolError>`:
    ```rust
    pub fn decode(token: &str) -> Result<JwtDecoded, ToolError> {
        let segments: Vec<&str> = token.trim().split('.').collect();
        if segments.len() != 3 {
            return Err(ToolError {
                code: "jwt-malformed".to_string(),
                message: format!(
                    "expected 3 dot-separated segments (header.payload.signature), found {}",
                    segments.len()
                ),
                position: None,
                context: Some("segment: structure".to_string()),
            });
        }

        let header = decode_segment(segments[0], "header", "jwt-invalid-header")?;
        let payload = decode_segment(segments[1], "payload", "jwt-invalid-payload")?;

        Ok(JwtDecoded {
            exp: numeric_claim(&payload, "exp"),
            iat: numeric_claim(&payload, "iat"),
            nbf: numeric_claim(&payload, "nbf"),
            header,
            payload,
        })
    }
    ```
  - [x] Implement the shared segment decoder — **`code` stays a literal string at each call site** (`"jwt-invalid-header"` / `"jwt-invalid-payload"`), matching this codebase's established convention of hardcoded `code` literals everywhere else (`base64.rs`, `hash.rs`, `json.rs` — none of them `format!` a dynamic value into `code`); only `message`/`context` are templated per segment name:
    ```rust
    fn decode_segment(segment: &str, name: &str, code: &str) -> Result<serde_json::Value, ToolError> {
        let bytes = decode_bytes(segment).map_err(|err| ToolError {
            code: code.to_string(),
            message: format!("{name} segment is not valid Base64URL: {}", err.message),
            position: None,
            context: Some(format!("segment: {name}")),
        })?;
        let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|err| ToolError {
            code: code.to_string(),
            message: format!("{name} segment is not valid JSON: {err}"),
            position: None,
            context: Some(format!("segment: {name}")),
        })?;
        // RFC 7519 requires the header and payload to each deserialize to a
        // JSON *object* (§7.2 rule 8) — `serde_json::Value` alone doesn't
        // enforce this, so an input like a bare `"null"` or `[1,2]` segment
        // would otherwise "successfully" decode into a non-object value that
        // breaks every downstream `.get("exp")`-style lookup silently.
        if !value.is_object() {
            return Err(ToolError {
                code: code.to_string(),
                message: format!("{name} segment must decode to a JSON object"),
                position: None,
                context: Some(format!("segment: {name}")),
            });
        }
        Ok(value)
    }
    ```
    **Position is intentionally omitted (`None`) on every branch above** — AC3 requires "which segment failed and why" carried in `code`/`context`; it does not ask for a byte position, and JWT segments have no natural line/column. Do not invent a `Position` encoding for this (e.g. segment index as `ByteOffset`) — that would be scope creep beyond AC3's literal wording.
  - [x] Implement numeric claim extraction, tolerant of both integer and float `NumericDate` (RFC 7519 §2 defines `NumericDate` as a JSON numeric value, which may be non-integer — some real-world JWT libraries emit `"exp": 1735689600.0`; using only `Value::as_i64()` would silently return `None` for those tokens, silently disabling FR17's expiry flag for a subset of real tokens):
    ```rust
    fn numeric_claim(payload: &serde_json::Value, key: &str) -> Option<i64> {
        let value = payload.get(key)?;
        value.as_i64().or_else(|| value.as_f64().map(|f| f as i64))
    }
    ```
  - [x] No new size-guard constant in `jwt.rs` — `decode_segment`'s call into `base64::decode_bytes` already enforces `base64.rs`'s existing 100MB-per-segment cap (that constant is private to `base64.rs`, unlike `hash.rs`'s `pub` one; do not attempt to import it or duplicate its value — just rely on the error it already returns, which `decode_segment` already maps into a `jwt-invalid-{header,payload}` error). A second whole-token guard on top would be redundant, not a missing protection.

- [x] **Task 2: Tauri command `jwt_decode` (AC: 1, 2, 3)**
  - [x] Create `src-tauri/src/commands/jwt.rs`, mirroring `commands/uuid.rs`'s shape exactly (no file I/O, so no `fs_helper` involvement — this is a pure text-in-struct-out command like `hash_compute`'s text path):
    ```rust
    use umbra_core::ToolError;
    use umbra_core::jwt::{JwtDecoded, decode};

    #[tauri::command]
    pub async fn jwt_decode(token: String) -> Result<JwtDecoded, ToolError> {
        tauri::async_runtime::spawn_blocking(move || decode(&token))
            .await
            .map_err(map_join_error)?
    }

    fn map_join_error(err: tauri::Error) -> ToolError {
        ToolError {
            code: "jwt-internal".to_string(),
            message: format!("background task failed: {err}"),
            position: None,
            context: None,
        }
    }
    ```
    Note: `map_join_error` is a near-identical duplicate of the one in `commands/{json,base64,uuid,hash}.rs` (this will be its 5th copy). That duplication is a pre-existing, already-deferred pattern (`deferred-work.md`, "code review of 2-3-generate-uuids": *"`map_join_error` duplicated a third time... never factored into a shared helper"*) — continue the established convention here rather than unilaterally extracting a shared helper into `commands/mod.rs` as part of this story; that's a separate, deliberately-deferred cleanup.
  - [x] `src-tauri/src/commands/mod.rs`: add `pub mod jwt;`.
  - [x] `src-tauri/src/lib.rs`: add `use commands::jwt::jwt_decode;` and add `jwt_decode` to the `generate_handler![...]` list (after `hash_compute_file`).
  - [x] `crates/umbra-core/src/lib.rs`: add `pub mod jwt;`.
  - [x] **No `src-tauri/Cargo.toml`, `crates/umbra-core/Cargo.toml`, or `capabilities/default.json` change** — no new dependency (Task 1), no filesystem access, no network capability needed. Same reasoning as `uuid_generate`'s command (pure computation, zero I/O).

- [x] **Task 3: Tool Registry — register the `jwt` tool (AC: 1)**
  - [x] `src/stores/registry.ts`: add a **new** entry to `TOOLS` (this is a new tool, not an existing-entry extension like Story 2.5's `drop` field — the ripple this creates is scoped in Task 5 below):
    ```ts
    {
      id: "jwt",
      name: "JWT",
      aliases: ["jwt", "token", "decode"],
      route: "/tools/jwt",
      icon: "JWT",
      component: () => import("../tools/jwt/JwtView.vue"),
    },
    ```
  - [x] **No `drop` field.** No FR/AC in this story mentions dropping a JWT as a file — JWTs are pasted text, matching the JSON and UUID tools' registry shape (also drop-less). Do not add drop support speculatively.
  - [x] This is the only registry change; sidebar, ⌘K palette, and route table all regenerate from this one entry (AD-5) — do not hand-edit `src/router/index.ts` or `src/shell/AppSidebar.vue`.

- [x] **Task 4: `src/tools/jwt/JwtView.vue` — paste, decode, render (AC: 1, 2, 3, 4)**
  - [x] Create `src/tools/jwt/jwtDecoded.ts`, mirroring `hashDigests.ts`'s hand-maintained-mirror convention:
    ```ts
    // Mirrors `JwtDecoded` in crates/umbra-core/src/jwt.rs — keep in sync by hand.
    export interface JwtDecoded {
      header: Record<string, unknown>;
      payload: Record<string, unknown>;
      exp: number | null;
      iat: number | null;
      nbf: number | null;
    }
    ```
  - [x] Create `src/tools/jwt/JwtView.vue`, following `HashView.vue`'s/`Base64View.vue`'s established structure (own `createLatestWinsRunner()` — **not** `registry.getLatestWinsRunner("jwt")`, since this tool has no drop handler to coordinate with; a local runner is the correct, simpler choice here, matching `Base64View.vue`'s own local `runLatestWins` before Story 2.5 introduced the shared per-tool variant specifically for drop/manual-invoke coordination):
    - State: `token = ref("")`, `decoded = ref<JwtDecoded | null>(null)`, `error = ref<ToolError | null>(null)`.
    - `onDecode()`: `runLatestWins(() => invoke<JwtDecoded>("jwt_decode", { token: token.value }))`; on success set `decoded.value = result.value` and clear `error`; on failure clear `decoded` and set `error` — same shape as `HashView.vue::onCompute`.
    - `onPaste()`: reuse `readClipboardText()` from `../../shell/clipboard` (FR4/AD-14) to populate `token`, clearing any stale `decoded`/`error` — same shape as every other tool's paste handler.
    - Pretty-print header/payload **in the view**, not core: `JSON.stringify(decoded.value.header, null, 2)` / `JSON.stringify(decoded.value.payload, null, 2)`, rendered in `<pre>` blocks (monospace, preserves whitespace) — this is the AD-1 "view renders machine values for humans" split in practice.
    - Render `exp`/`iat`/`nbf` as human-readable local datetimes via a small computed helper, e.g. `formatClaim(value: number | null) { return value === null ? "not present" : new Date(value * 1000).toLocaleString(); }` — **multiply by 1000**: core's epoch values are unix seconds (per `ARCHITECTURE-SPINE.md`'s Consistency Conventions table, "epoch timestamps are always unix seconds... never milliseconds"), but JS `Date` expects milliseconds.
    - Expired flag (FR17, AC2): `const isExpired = computed(() => decoded.value?.exp != null && decoded.value.exp * 1000 < Date.now());`, rendered as a visible `role="status"` element when true (distinct from the `role="alert"` box, which this codebase reserves for `ToolError` rendering — an expired-but-successfully-decoded token is a status observation about valid output, not a `ToolError`). Only `exp` drives this flag — the AC's wording ("visibly flag expired tokens") is singular to expiry; do not also add an `nbf`-based "not yet valid" flag, which is a reasonable enhancement but outside this story's stated scope.
    - **Permanent, unconditional notice (AC4):** a static paragraph (not tied to decode success/failure) stating something like *"Signatures are not verified — this tool only decodes and displays a token's contents."* This must render regardless of decode state, since AC4 is a standing scope statement about the tool, not a conditional message.
    - Paste-from-clipboard button per FR4; no copy-to-clipboard target is specified by this story's ACs (there's no single "output" string to copy — header, payload, and each claim are separate rendered pieces) — do not invent a whole-result copy button unless it's obviously cheap; if added, copy the raw pasted `token`, not a synthesized combination of header+payload.
  - [x] Keyboard/accessibility (NFR5): label the token `<textarea>` (`<label for="jwt-token-input">`), use native `<button>` elements for Decode/Paste (inherits visible focus for free, same as every other tool's actions) — no new keyboard-handling code is needed here; this tool doesn't register any shortcuts or drop listeners.

- [x] **Task 5: Fix the anticipated registry-count ripple (same pattern as Stories 2.3/2.4)**
  - [x] `src/router/index.spec.ts:55`: `expect(registry.tools).toHaveLength(4)` → `toHaveLength(5)`.
  - [x] `src/shell/CommandPalette.spec.ts:143-147`: the ArrowUp-wrap test's comment ("Default empty query lists all registry entries (JSON, Base64, UUID, Hash)") and its assertion `expect(wrapper.find("li.active").text()).toContain("Hash")` both currently rely on "Hash" being the *last* entry in `TOOLS`. Since `jwt` is appended after `hash`, update the comment to include JWT and change the assertion's expected text to `"JWT"`. This is AD-5's single-registry design working as intended (`deferred-work.md`'s 2-3 entry already flags this test as implicitly ordering-dependent, not a new problem this story introduces).
  - [x] No `dropZone.spec.ts` change — this tool has no `drop` field, so it never participates in drop dispatch tests.

- [x] **Task 6: Tests**
  - [x] `crates/umbra-core/src/jwt.rs`: build fixtures by encoding real JSON through `crate::base64::encode_bytes(bytes, true)` inside the test module itself (mirroring `base64.rs`'s own round-trip test style) rather than hardcoding a pre-made token string off the internet — self-contained and independently verifiable:
    - Happy path: header `{"alg":"HS256","typ":"JWT"}`, payload with `exp`/`iat`/`nbf` as integers plus an arbitrary custom claim; assert `decode()` returns the exact parsed `header`/`payload` and the exact `exp`/`iat`/`nbf` values. Use a placeholder third segment (e.g. `"sig"` or empty) — signature content is never decoded or checked (AC4).
    - `exp` as a JSON float (e.g. `1735689600.0`) still extracts as `Some(1735689600)` — the `NumericDate`-tolerance case from Task 1.
    - A payload with no `exp`/`iat`/`nbf` keys decodes successfully with all three `None` (NFR4 robustness — a valid token missing optional registered claims must not error).
    - Wrong segment count: `"a.b"` and `"a.b.c.d"` both → `jwt-malformed`, with the segment count named in `message`.
    - Header segment with an invalid Base64URL character → `jwt-invalid-header` (context contains `"segment: header"`).
    - Payload segment that decodes to valid Base64URL bytes but invalid JSON (e.g. raw non-JSON bytes) → `jwt-invalid-payload`.
    - Header segment that decodes to valid JSON but a non-object value (e.g. encode `"null"` or `"[1,2]"` as the segment) → `jwt-invalid-header` — the RFC object-shape check from Task 1.
    - Do **not** write a dedicated oversized-segment (100MB+) test here — that boundary is already covered by `base64.rs`'s own `decode_bytes` tests; `jwt.rs`'s job is only to prove it correctly propagates whatever `decode_bytes` returns (already exercised by the invalid-Base64URL test above), not to re-prove the size guard itself.
  - [x] `src-tauri/src/commands/jwt.rs`: a small smoke-test set mirroring `commands/uuid.rs`'s proportions (command tests here are thin wrappers, not exhaustive re-tests of core logic already covered above) — one happy-path decode (reusing the same self-built-fixture approach), one `jwt-malformed` case, one `jwt-invalid-header` case.
  - [x] `src/tools/jwt/JwtView.spec.ts` (new file, mirroring `HashView.spec.ts`'s mount-with-explicit-Pinia convention since nothing here reads `registry.dropResult`, but consistency with sibling tool specs is still worth keeping):
    - Successful decode renders pretty-printed header/payload JSON and humanized `exp`/`iat`/`nbf`.
    - A token with `exp` in the past renders the expired-status element; a token with `exp` in the future (or no `exp`) does not.
    - A decode error renders via the existing `role="alert"` pattern with the backend's `message`.
    - The "signatures are not verified" notice is present both before any decode attempt and after a successful decode (i.e., it's unconditional, not gated on `decoded`/`error` state).
    - Paste populates the token field from a mocked `readClipboardText`.

- [x] **Task 7: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`, `vue-tsc --noEmit`.

- [ ] **Task 8: Manual verification (deferred to the user)**
  - [ ] `pnpm tauri dev`, per this project's established precedent (dev agent cannot visually drive a native Tauri window): paste a real, self-issued JWT (e.g. from jwt.io's debugger, generated offline/locally — do not paste a live production token) and confirm header/payload render pretty-printed and `exp`/`iat`/`nbf` render as local datetimes; paste an expired token and confirm the expired flag shows; paste a malformed token (wrong segment count, garbled header) and confirm a precise inline error; confirm the "signatures not verified" notice is always visible; confirm ⌘K finds the tool via "jwt", "token", and "decode" aliases; confirm the sidebar shows "JWT" alongside the other four tools.

- [ ] **Task 9: Commit and open a PR**
  - [ ] Branch: `feat/story-2-6-<slug>` (e.g. `feat/story-2-6-decode-jwts-offline`), created from an up-to-date `main` (this story's `baseline_commit`, `3a6ff61`, is `origin/main`'s tip as of story creation).
  - [ ] Conventional Commit(s), `feat` type scoped to `jwt`.
  - [ ] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2 (functional core):** `decode` is a pure function in `crates/umbra-core/src/jwt.rs` — zero I/O, zero Tauri dependency, no `#[cfg(target_os)]` branches. Pretty-printing and locale/timezone rendering of the decoded values are explicitly view-owned (`JwtView.vue`'s `JSON.stringify`/`toLocaleString` calls), not core's job. [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (ToolError contract):** three new stable codes — `jwt-malformed` (wrong segment count), `jwt-invalid-header`, `jwt-invalid-payload` (either fails Base64URL decode, fails JSON parse, or decodes to a non-object) — plus the standard `jwt-internal` join-error code at the command layer. All codes are kebab-case literals, matching every sibling module's convention. `context` (not `position`) carries which segment failed, per AC3's literal wording. [Source: `ARCHITECTURE-SPINE.md` AD-3]
- **AD-4 (heavy work off the main thread):** `jwt_decode` wraps in `spawn_blocking` for consistency with every other command in this codebase (`uuid_generate`, `hash_compute`, `json_parse`, etc. all do this uniformly regardless of actual cost) — not because decoding a JWT is expensive (it isn't; typical tokens are a few hundred bytes), but because this project's established pattern is "every command wraps in `spawn_blocking`," not "only genuinely slow ones do." Deviating here (e.g. a plain `async fn` without the wrap) would be an unexplained inconsistency, not a justified optimization. [Source: `ARCHITECTURE-SPINE.md` AD-4; verified directly against `commands/uuid.rs`, `commands/json.rs::json_parse`]
- **AD-5 (one Tool Registry):** one new `TOOLS` entry (`id: "jwt"`); sidebar, palette, and routes all regenerate from it — no hand-edits elsewhere. [Source: `ARCHITECTURE-SPINE.md` AD-5]
- **AD-6 (tools are islands):** `JwtView.vue` reads no other tool's state; its own `createLatestWinsRunner()` instance is local to the component, exactly like `Base64View.vue`'s pre-Story-2.5 pattern (no drop participation means no need for the registry-shared per-tool runner Story 2.5 introduced). [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **AD-7 (zero network surface):** no new dependency, no JWKS fetch, no network capability of any kind — `decode` never resolves `iss`/`jwks_uri` or makes any I/O call. This is the story's core privacy claim (FR16) and needs no new enforcement mechanism beyond "don't write that code." [Source: `ARCHITECTURE-SPINE.md` AD-7]
- **AD-14/AD-15/AD-16 — deliberately not exercised by this story.** No file drop (AD-14's drop half, AD-15) — JWTs are pasted, not dropped, matching JSON/UUID's precedent. AD-16's request-ID/latest-wins pattern is still used (`createLatestWinsRunner`, Task 4) for the manual Decode/Paste actions, exactly as every other tool's non-drop actions already do — but this story does not touch `DropZone.vue` or `registry.dropResult` at all.

### Library/Framework requirements

- **No new dependency, Rust or JS.** `crate::base64::decode_bytes` (already `pub`, already unpadded-tolerant, already URL-safe-detecting) is the JWT segment decoder; `serde_json` (already a workspace dep) parses the decoded bytes. This is the same "pure recombination of already-verified pieces" situation Story 2.5's Dev Notes described for its own file-hashing work — no Context7/library research was needed this session because no new library surface is being introduced (writing this decode logic by hand against RFC 7519 is squarely "writing a script from scratch," which is explicitly outside Context7's scope per this project's global tooling instructions).
- **Explicitly rejected: the `jsonwebtoken` crate** (or any JWT library). Those crates exist primarily to *verify* signatures against a key — FR18 explicitly excludes verification from v1 ("no signature verification is present or implied by the UI"). Pulling in a verification-oriented dependency to use only its decode path would be exactly the "wrong library" anti-pattern this workflow exists to prevent: unused attack surface, an extra dependency-license review (per `ARCHITECTURE-SPINE.md`'s Consistency Conventions table), for zero functional gain over the ~30 lines of hand-written decode logic in Task 1.

### File Structure Requirements

- **New files:**
  - `crates/umbra-core/src/jwt.rs` (`JwtDecoded`, `decode`, `decode_segment`, `numeric_claim`, unit tests)
  - `src-tauri/src/commands/jwt.rs` (`jwt_decode`, `map_join_error`, tests)
  - `src/tools/jwt/JwtView.vue`
  - `src/tools/jwt/jwtDecoded.ts`
  - `src/tools/jwt/JwtView.spec.ts`
- **Modified:**
  - `crates/umbra-core/src/lib.rs` (+`pub mod jwt;`)
  - `src-tauri/src/commands/mod.rs` (+`pub mod jwt;`)
  - `src-tauri/src/lib.rs` (`use` line +1, `generate_handler!` +1 entry)
  - `src/stores/registry.ts` (+1 `TOOLS` entry; no field changes to any existing entry — unlike Story 2.5, this story doesn't touch drop plumbing at all)
  - `src/router/index.spec.ts` (tool count 4 → 5)
  - `src/shell/CommandPalette.spec.ts` (ArrowUp-wrap assertion "Hash" → "JWT")
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions)
  - `Cargo.lock` (no dependency change expected; regenerate if `cargo build`/`cargo test` touches it)
- **Not touched:** `src-tauri/Cargo.toml`, `crates/umbra-core/Cargo.toml`, `package.json` (no new dependency anywhere), `src-tauri/capabilities/default.json` (no new capability), `src/shell/DropZone.vue`, `src/shell/dropZone.spec.ts`, `src/shell/dropZone.ts` (no drop behavior in this story), `src/router/index.ts`, `src/shell/AppSidebar.vue` (both generated from the registry, per AD-5), any Base64/JSON/UUID/Hash tool file (this story adds a new island, it doesn't modify existing ones — contrast Story 2.5, which had to touch `Base64View.vue` as a ripple from a *shared* drop-dispatcher fix; this story has no such shared-infrastructure touch point).

### Testing Requirements

- Rust: `cargo test --workspace` covering the new `jwt.rs` unit tests (malformed/invalid-header/invalid-payload/non-object/float-NumericDate/missing-claims cases) plus `commands/jwt.rs`'s thinner command-layer smoke tests. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`.
- TypeScript: `pnpm test` covering the new `JwtView.spec.ts` (decode success, expired-flag on/off, error rendering, the unconditional not-verified notice, paste) plus the two updated assertions in `router/index.spec.ts` and `CommandPalette.spec.ts`.
- `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all pass locally before the PR.
- Manual: `pnpm tauri dev`, per Task 8 — deferred to the user, same precedent as every story since 1.7.

### Previous Story Intelligence

- **From Story 2.5 (immediate predecessor):** established the precedent that a *new* registry entry (vs. an existing entry gaining a `drop` field) ripples into `src/router/index.spec.ts`'s tool-count assertion and `src/shell/CommandPalette.spec.ts`'s ArrowUp-wrap assertion — Story 2.4 (UUID→Hash, count 3→4) is the closer analogy for *this* story than Story 2.5 itself (Hash's `drop` field addition rippled into `DropZone.vue`/`Base64View.vue` instead, which this story does not touch). Confirmed by reading both stories' actual File Lists this session, not just their summaries.
- **`deferred-work.md`'s running log** (read in full this session) confirms two patterns this story deliberately continues rather than "fixes": (1) `map_join_error` is duplicated per command file with no shared helper — already flagged three times as an accepted, deferred pattern; `jwt.rs` becomes its 5th copy, not a place to unilaterally consolidate. (2) `CommandPalette.spec.ts`'s wrap-around test has always implicitly depended on array order, never contractually documented — this story's Task 5 update continues that same implicit-ordering pattern rather than fixing the underlying documentation gap (out of this story's scope).
- **From Story 2.2 (via Story 2.5's Dev Notes, re-verified this session):** the generic-dispatcher drop model lives in `DropZone.vue`/`registry.ts` — irrelevant to this story directly (no drop), but confirms this story correctly has *zero* reason to touch either file.
- **Cross-cutting:** no prior Epic 2 story has created a genuinely new `umbra-core` module *and* a genuinely new registry entry in the same story since Story 2.4 (Hash, text-only) — Stories 2.1/2.2 extended an existing module across two stories, 2.3/2.5 were single-module efforts with different registry-touch shapes. This story is structurally closest to Story 2.4: new core module, new registry entry, no drop support (drop, if ever wanted for JWTs, would be a separate future story, matching how Hash's drop support landed one story after its text-only introduction).

### Git Intelligence

- `main`'s tip at story-creation time is `3a6ff61` (this story's `baseline_commit`), Story 2.5's squash-merged PR #29. The prior working branch (`feat/story-2-5-hash-files`) was already fully merged and is now stale relative to `origin/main`; this story was drafted from a freshly synced `main`, not that stale branch — start the new feature branch from `main` at `3a6ff61`, not from the old branch.
- No commit since `2febdc0` (Story 2.3) has touched `src/shell/DropZone.vue`'s core dispatch logic beyond Story 2.5's own latest-wins fix — irrelevant here since this story doesn't touch that file at all, but confirms there's no unrelated drift to account for in the registry/router files this story does touch.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.6: Decode JWTs offline; FR16, FR17, FR18, AD-1, AD-3, AD-7; Epic 2 summary]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — F5 (FR16-FR18), INV-1 (no network), NFR4 (robustness on malformed input)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1/AD-2 (functional core), AD-3 (ToolError), AD-4 (async convention), AD-5 (registry), AD-6 (islands), AD-7 (zero network), Consistency Conventions table (epoch timestamps are unix seconds, never milliseconds)]
- Live-verified this session via a direct read-only pass over the actual current code: `crates/umbra-core/src/{base64,hash,error,lib}.rs`, `src-tauri/src/commands/{hash,uuid,json,mod}.rs`, `src-tauri/src/lib.rs`, `src/stores/registry.ts`, `src/tools/hash/{HashView.vue,hashDigests.ts}`, `src/tools/base64/Base64View.vue`, `src/shell/{invoke.ts,toolError.ts,AppSidebar.vue}`, `src/router/index.ts` and `index.spec.ts`, `src/shell/CommandPalette.spec.ts`, `package.json`, both `Cargo.toml` manifests, and `_bmad-output/implementation-artifacts/{2-5-hash-files.md,deferred-work.md}` in full. This confirmed `crate::base64::decode_bytes` is directly reusable for JWT segment decoding (unpadded-tolerant, URL-safe-detecting, already `pub`) — the single biggest implementation shortcut this story has — and located the exact line numbers for both anticipated test ripples (Task 5).

## Change Log

- 2026-07-31: Story drafted via `bmad-create-story`, following Story 2.5's completion and merge (PR #29, squashed as `3a6ff61`). Synced local `main` to `origin/main` before drafting (the prior session's working branch, `feat/story-2-5-hash-files`, was stale post-merge). Exhaustive-analysis pass confirmed `crate::base64::decode_bytes` — already unpadded/URL-safe-tolerant — is directly reusable for JWT's Base64URL segments, avoiding any new dependency; explicitly rejected the `jsonwebtoken` crate as a wrong-library risk given FR18's no-verification v1 scope. Also surfaced a correctness nuance neither the epics nor architecture docs mention: RFC 7519 `NumericDate` permits non-integer values, so naive `as_i64()`-only extraction would silently drop `exp`/`iat`/`nbf` for some real-world tokens — scoped into Task 1 explicitly. Read `deferred-work.md` and Story 2.5 in full to confirm this story's registry-ripple shape (new entry, not a `drop`-field addition) matches Story 2.4's precedent, not Story 2.5's.
- 2026-07-31: Implemented all tasks (1-7) on branch `feat/story-2-6-decode-jwts-offline`. New `umbra-core::jwt` module, `jwt_decode` Tauri command, `jwt` tool registry entry, `JwtView.vue`, and the anticipated registry-count test ripple. Full Rust and TypeScript verification pass green (68 Rust tests, 158 TS tests, lint, build, type-check). Task 8 (manual `pnpm tauri dev` check) deferred to the user. Status moved to "review".

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via the `bmad-dev-story` workflow.

### Debug Log References

None — no failing test cases or unexpected build errors were hit during implementation; `cargo fmt` auto-fixed one import ordering diff in `jwt.rs` (`ToolError` before `base64::decode_bytes`), otherwise every verification command passed on first run.

### Completion Notes List

- Implemented `crates/umbra-core/src/jwt.rs` exactly per the story's specified `decode`/`decode_segment`/`numeric_claim` shape, reusing `base64::decode_bytes` and `serde_json` with no new dependency. 9 unit tests cover the happy path, float `NumericDate` tolerance, missing-claims robustness, both malformed-segment-count cases, invalid-Base64URL header, invalid-JSON payload, and both RFC 7519 object-shape violations (`null`, array).
- Implemented the `jwt_decode` Tauri command in `src-tauri/src/commands/jwt.rs`, wired through `commands/mod.rs`, `lib.rs`'s `use`/`generate_handler!`, and `umbra-core`'s `lib.rs`. 3 command-layer smoke tests pass. No `Cargo.toml` or `capabilities/default.json` change was needed (confirmed via `git status` — no dependency or capability drift).
- Registered the `jwt` tool as a new `TOOLS` entry in `src/stores/registry.ts` (id/aliases/route/icon/component only — no `drop` field, matching JSON/UUID's drop-less precedent).
- Built `JwtView.vue` with a local `createLatestWinsRunner()` (no drop coordination needed), paste/decode handlers, view-side `JSON.stringify(..., null, 2)` pretty-printing, `formatClaim()`'s `* 1000` epoch-seconds-to-milliseconds conversion, an `exp`-only expired flag rendered via `role="status"` (distinct from the `role="alert"` `ToolError` box), and the unconditional "signatures are not verified" notice.
- Fixed the anticipated registry-count ripple: `router/index.spec.ts` tool count 4→5, and `CommandPalette.spec.ts`'s ArrowUp-wrap assertion/comment "Hash"→"JWT".
- Added `src/tools/jwt/JwtView.spec.ts` (8 tests): successful decode renders pretty-printed header/payload and humanized claims; expired flag shows for a past `exp` and not for a future or absent one; a rejected `jwt-malformed` error renders via `role="alert"`; the not-verified notice is present both before and after a successful decode; paste populates the token field from a mocked `readClipboardText`.
- Full verification pass, all green: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` (68 passed), `pnpm lint`, `pnpm test` (158 passed across 20 files), `pnpm build`, `vue-tsc --noEmit`.
- `Cargo.lock` was not touched — confirmed via `git status`, consistent with the story's "no dependency change expected" note.
- Task 8 (manual `pnpm tauri dev` verification) is deferred to the user per this project's established precedent (dev agent cannot visually drive a native Tauri window).

### File List

**New:**
- `crates/umbra-core/src/jwt.rs`
- `src-tauri/src/commands/jwt.rs`
- `src/tools/jwt/JwtView.vue`
- `src/tools/jwt/jwtDecoded.ts`
- `src/tools/jwt/JwtView.spec.ts`

**Modified:**
- `crates/umbra-core/src/lib.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`
- `src/stores/registry.ts`
- `src/router/index.spec.ts`
- `src/shell/CommandPalette.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
