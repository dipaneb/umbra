---
baseline_commit: 0d93b08
---

# Story 3.1: Read a cron expression in plain English

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want to paste a cron expression and read what it means and when it runs next,
so that I can verify schedules without a cron cheat-sheet website.

## Acceptance Criteria

1. **Given** a valid 5-field cron expression, **when** I submit it, **then** a plain-English description displays along with the next 3 upcoming run times (FR20), **and** cron parsing/next-occurrence computation uses `croner`, with description templating written by hand in `umbra-core::cron` (AD-1 — not `croner`'s own `describe()`/`describe_lang()`; see Dev Notes), **and** core returns run times as epoch values (unix seconds, `i64`) which the view renders as local datetimes (AD-1, matching the Consistency Conventions table's epoch-timestamp rule already used by `jwt.rs`).
2. **Given** an invalid cron expression, **when** I submit it, **then** a structured inline error explains which field is invalid and why (`ToolError` with position/context, AD-3, NFR4).
3. **Given** the tool is open, **when** I use paste/copy actions, **then** they work in one action via the shell clipboard service (FR4).

## Tasks / Subtasks

- [x] **Task 1: Add and verify the `croner` dependency (AC: 1, 2)**
  - [x] Add to `crates/umbra-core/Cargo.toml`: `croner = "3"` and `chrono = "0.4"` (croner 3.0.1 itself requires `chrono ^0.4.42` as a normal, non-optional dependency — confirmed directly against the crates.io API this session; `chrono` must also be added as `umbra-core`'s own direct dependency to construct/consume `DateTime<Tz>` values in this crate's own code, not merely rely on croner's internal re-export). Default features are sufficient for both — no `serde` feature needed on either crate for this story (no `Cron`/`DateTime` value crosses `serde` serialization directly; only derived `i64` epoch seconds do, via the existing `ToolError`/struct-serialize pattern every other module already uses).
  - [x] **Verify the actual API by writing and running one throwaway sanity test before building the full module** — do not trust this story's secondhand API research (below) as gospel. This session confirmed via `crates.io`'s dependency API that `croner` 3.0.1 matches the architecture spine's "3.x, unchanged" pin, and confirmed via `docs.rs` that:
    - `Cron::from_str(s: &str) -> Result<Cron, CronError>` (via `FromStr`) parses cron expressions with an **optional leading seconds field** — a plain 5-field expression like `"0 9 * * 1"` (minute hour day-of-month month day-of-week) parses as a standard cron pattern with seconds omitted, matching AC1's "5-field" wording directly.
    - `Cron::find_next_occurrence<Tz: TimeZone>(&self, start_time: &DateTime<Tz>, inclusive: bool) -> Result<DateTime<Tz>, CronError>` and `Cron::iter_after<Tz: TimeZone>(&self, start_after: DateTime<Tz>) -> CronIterator<Tz>` (where `CronIterator` implements `Iterator<Item = DateTime<Tz>>`) both exist — prefer `iter_after(now).take(3)` over three manual `find_next_occurrence` calls; it's the more idiomatic form the crate's own examples favor for "give me the next N runs."
    - **One piece of this session's research directly contradicted itself and must not be trusted uncritically:** an initial fetch claimed `Cron` has a public `pattern: CronPattern` field exposing structured per-field data, but a follow-up fetch of the crate's full public item index (`docs.rs/croner/3.0.1/croner/all.html`) does **not** list `CronPattern` anywhere, at any module path. Do not build the description templater assuming structured field access exists on `Cron` — verify directly (`cargo doc --open -p croner` or the crate's actual source) before relying on it, and if it turns out not to be cleanly public, fall back to the string-splitting approach in Task 2 below (which does not depend on this either way, and is the safer default to build against first).
    - `CronError` variants observed: `EmptyPattern`, `InvalidDate`, `InvalidTime`, `TimeSearchLimitExceeded`, `InvalidPattern(String)`, `IllegalCharacters(String)`, `ComponentError(String)` — none carry a clean machine-readable field-index enum; the three string variants carry a human-readable `Display` message that may name the offending field/value in prose (e.g. "position X is out of bounds for range Y-Z" was observed for `ComponentError`), but there's no structured `field: CronField` you can match on. Map by variant to a stable `ToolError.code` (Task 2), and use croner's own `Display` text for `message` — do not attempt to fabricate a synthetic `Position` (no natural line/col or byte offset exists for a cron field the way JSON has for text; same reasoning `jwt.rs` already used for "which segment failed" — `context`, not `position`, carries the human-facing detail).
  - [x] Do **not** add `croner-rs` or any similarly-named crate — `croner` is the correct crate id. Do not confuse it with the unrelated JS npm package of the same name (10.x, by the same author "hexagon" but a different language and implementation) — this exact confusion is called out by name in `ARCHITECTURE-SPINE.md`'s Stack table.

- [x] **Task 2: `umbra-core::cron` — explain a cron expression (AC: 1, 2)**
  - [x] Create `crates/umbra-core/src/cron.rs`. Define:
    ```rust
    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    pub struct CronExplanation {
        pub description: String,
        pub next_runs: Vec<i64>, // epoch seconds (unix, i64) — view converts to local datetimes, per AD-1
    }

    pub fn explain(expression: &str) -> Result<CronExplanation, ToolError> {
        let cron = croner::Cron::from_str(expression.trim()).map_err(map_cron_error)?;
        let now = chrono::Local::now();
        let next_runs: Vec<i64> = cron.iter_after(now).take(3).map(|dt| dt.timestamp()).collect();
        let description = describe(expression.trim());
        Ok(CronExplanation { description, next_runs })
    }
    ```
    (Exact signatures are illustrative, not gospel — validate against the real crate per Task 1's sanity test; adjust if `iter_after`'s bound or `Cron::from_str`'s exact `Self`/error type differ from this session's research.)
  - [x] Implement `map_cron_error(err: croner::errors::CronError) -> ToolError`, one `code` per variant (all stable kebab-case, following the existing `jwt.rs`/`base64.rs`/`hash.rs` convention of hardcoded string literals — never `format!` a dynamic value into `code`, only into `message`/`context`): e.g. `"cron-empty-pattern"`, `"cron-invalid-date"`, `"cron-invalid-time"`, `"cron-search-limit-exceeded"`, `"cron-invalid-pattern"`, `"cron-illegal-characters"`, `"cron-component-error"`. `message` is croner's own `Display` text (`err.to_string()`); `position: None` on every branch (no natural line/col — see Task 1); `context` may repeat/extract the field-naming detail from the message if trivially available, otherwise `None` — do not over-engineer field-position extraction beyond what AC2's literal wording needs ("explains which field is invalid and why" is satisfied by a clear `message`, since croner's own error text already names the problem in prose).
  - [x] **Implement `describe(expression: &str) -> String` as a hand-written templater — do not call `croner::Cron::describe()`/`describe_lang()`.** This is the single most important architectural decision in this story, and it's easy to get wrong by reaching for the crate's own built-in description as a shortcut:
    - The epic's AC1 wording is explicit: "description templating in `umbra-core::cron`" is called out separately from "cron parsing/next-occurrence computation uses `croner`" — these are deliberately two different responsibilities assigned to two different places.
    - **Why this matters beyond this story:** Story 3.2 (natural language → cron, not yet built) must round-trip every result through *this story's* cron→English direction before displaying it (AD-9's honesty bar) — the round-trip only proves anything if Story 3.2's NL grammar and this story's `describe()` speak the *same* deterministic vocabulary. `croner`'s built-in `describe()` uses its own internal phrasing (via `croner::describe::lang::english::English`) that this project does not control and cannot guarantee stays stable across croner versions or matches whatever grammar Story 3.2 ends up building. Using it here would silently couple Story 3.2's correctness to an external crate's wording choices — exactly the kind of hidden coupling this workflow exists to prevent.
    - Build `describe()` by parsing the expression's own whitespace-separated fields (5 or 6 depending on whether a leading seconds field is present) directly as strings — independent of whatever `Cron`'s internal representation turns out to be (see Task 1's caveat about `CronPattern`'s uncertain public accessibility). Handle, at minimum, the field syntaxes needed to cover this project's PRD demo phrase and Story 3.3's eventual corpus: `*` (wildcard), a single specific value, a comma-separated list, a `a-b` range, and a `*/n` or `a-b/n` step. Recommended minimal shape: derive a time-of-day clause from the minute+hour fields (e.g. "at 9:00 AM" for fixed values, "every 15 minutes" for a minute step with hour `*`) and a day clause from day-of-month/month/day-of-week (e.g. "every Monday", "every weekday" for a Mon–Fri day-of-week range, "on the 1st" for a fixed day-of-month), then join them (e.g. "Every Monday, at 9:00 AM" for `0 9 * * 1` — deliberately close to the PRD's own demo phrase, "every Monday at 9am", so the round-trip in Story 3.2 has the least distance to cover).
    - **Do not build support for `croner`'s extended non-standard syntax** (`L`, `W`, `#`/nth-weekday, or combined range+step forms beyond the simple cases above) — FR19/FR21/FR22 scope the whole NL↔cron feature to a corpus of common, everyday scheduling phrases (Story 3.3), not exotic cron extensions; supporting them here would be speculative scope beyond what any planned story actually demos or tests.
    - **Record the exact vocabulary and field-syntax coverage you implement in this story's own Completion Notes / Dev Notes before finishing** (see the template's `## Dev Notes` and `## Dev Agent Record` sections) — Story 3.2's own `create-story` pass will read this file as "previous story intelligence" and needs the exact phrasing rules to build a matching grammar, not just this story's stated intent.

- [x] **Task 3: Tauri command `cron_explain` (AC: 1, 2)**
  - [x] Create `src-tauri/src/commands/cron.rs`, mirroring `commands/jwt.rs`'s/`commands/uuid.rs`'s shape exactly (pure text-in-struct-out, no file I/O):
    ```rust
    use umbra_core::ToolError;
    use umbra_core::cron::{CronExplanation, explain};

    #[tauri::command]
    pub async fn cron_explain(expression: String) -> Result<CronExplanation, ToolError> {
        tauri::async_runtime::spawn_blocking(move || explain(&expression))
            .await
            .map_err(map_join_error)?
    }

    fn map_join_error(err: tauri::Error) -> ToolError {
        ToolError {
            code: "cron-internal".to_string(),
            message: format!("background task failed: {err}"),
            position: None,
            context: None,
        }
    }
    ```
    Note: `map_join_error` is a near-identical duplicate of the one in every other `commands/*.rs` file (this will be its 6th copy) — this is a pre-existing, already-deferred pattern (`deferred-work.md`; flagged again explicitly in Story 2.6's Dev Notes), continue it rather than unilaterally extracting a shared helper as part of this story.
  - [x] `src-tauri/src/commands/mod.rs`: add `pub mod cron;`.
  - [x] `src-tauri/src/lib.rs`: add `use commands::cron::cron_explain;` and add `cron_explain` to the `generate_handler![...]` list (after `jwt_decode`).
  - [x] `crates/umbra-core/src/lib.rs`: add `pub mod cron;`.
  - [x] **No `capabilities/default.json` change** — no filesystem access, no network capability needed (pure computation, same reasoning as every prior text-in/text-out command).

- [x] **Task 4: Tool Registry — register the `cron` tool (AC: 1, 3)**
  - [x] `src/stores/registry.ts`: add a **new** entry to `TOOLS` (this is a new tool, no existing entry is being extended):
    ```ts
    {
      id: "cron",
      name: "Cron",
      aliases: ["cron", "crontab", "schedule"],
      route: "/tools/cron",
      icon: "CRON",
      component: () => import("../tools/cron/CronView.vue"),
    },
    ```
    `"schedule"` is included deliberately even though this story only builds the cron→English half — Epic 3's overview and Story 3.2's acceptance criteria describe this as **one tool covering both directions**, built across two stories against the same registry entry and (per Task 5 below) the same view file. Do not create a second registry entry when Story 3.2 lands; that story extends this one.
  - [x] **No `drop` field.** Cron expressions are pasted text, not dropped files — same drop-less precedent as JSON/UUID/JWT.
  - [x] This is the only registry change; sidebar, ⌘K palette, and route table all regenerate from this one entry (AD-5) — do not hand-edit `src/router/index.ts` or `src/shell/AppSidebar.vue`.

- [x] **Task 5: `src/tools/cron/CronView.vue` — paste, submit, render (AC: 1, 2, 3)**
  - [x] Create `src/tools/cron/cronExplanation.ts`, mirroring `jwtDecoded.ts`'s hand-maintained-mirror convention:
    ```ts
    // Mirrors `CronExplanation` in crates/umbra-core/src/cron.rs — keep in sync by hand.
    export interface CronExplanation {
      description: string;
      nextRuns: number[]; // epoch seconds — convert to Date via `new Date(seconds * 1000)`
    }
    ```
    Note the Rust struct field is `next_runs` (snake_case); confirm at implementation time whether `serde`'s default (de)serialization on this struct needs `#[serde(rename_all = "camelCase")]` or whether the project's existing structs (e.g. `JwtDecoded`) already rely on Tauri's IPC layer passing snake_case through as-is and the TS side just mirrors `next_runs` verbatim — check `jwtDecoded.ts`'s actual field naming (`exp`/`iat`/`nbf`, not renamed) before deciding; **do not introduce a renaming convention this codebase doesn't already use elsewhere.**
  - [x] Create `src/tools/cron/CronView.vue`, following `JwtView.vue`'s/`UuidView.vue`'s established structure:
    - **Use a local `createLatestWinsRunner()` instance, not `registry.getLatestWinsRunner("cron")`.** This tool has exactly one write-trigger to its own state (the explicit "Explain" submit action) — no drop handler, no re-firing selector like UUID's version radio. The epic-2 retrospective's Action Item #1 (documenting `registry.getLatestWinsRunner` as required) applies specifically to tools with **more than one** write-trigger to the same state; applying it here would be scope creep for a tool that doesn't have that race condition, exactly the kind of tool JWT already set the precedent for (JWT also uses a local runner, for the same reason).
    - State: `expression = ref("")`, `explanation = ref<CronExplanation | null>(null)`, `error = ref<ToolError | null>(null)`.
    - `onExplain()`: `runLatestWins(() => invoke<CronExplanation>("cron_explain", { expression: expression.value }))`; on success set `explanation.value` and clear `error`; on failure clear `explanation` and set `error` — same shape as `JwtView.vue::onDecode`/`HashView.vue::onCompute`.
    - `onPaste()`: reuse `readClipboardText()` from `../../shell/clipboard` (FR4/AD-14) to populate `expression`, clearing any stale `explanation`/`error` — same shape as every other tool's paste handler.
    - Render `explanation.description` as plain text, and `explanation.nextRuns` as a list of local datetimes: `new Date(epochSeconds * 1000).toLocaleString()` — **multiply by 1000**, same epoch-seconds-to-milliseconds conversion `JwtView.vue::formatClaim` already established (core's epoch values are unix seconds, never milliseconds, per the Consistency Conventions table).
    - A copy-to-clipboard action per FR4 — this tool's natural "output" is the description text (unlike JWT, which has no single output string); copy the `description` via `writeClipboardText`.
  - [x] Keyboard/accessibility (NFR5): label the expression `<textarea>` or `<input>` (`<label for="cron-expression-input">`), use native `<button>` elements for Explain/Paste/Copy (inherits visible focus for free) — no new keyboard-handling code needed; this tool registers no shortcuts or drop listeners.

- [x] **Task 6: Fix the anticipated registry-count ripple (same pattern as Stories 2.3/2.4/2.6)**
  - [x] `src/router/index.spec.ts:55`: `expect(registry.tools).toHaveLength(5)` → `toHaveLength(6)`.
  - [x] `src/shell/CommandPalette.spec.ts:143-147`: the ArrowUp-wrap test's comment ("Default empty query lists all registry entries (JSON, Base64, UUID, Hash, JWT)") and its assertion `expect(wrapper.find("li.active").text()).toContain("JWT")` both currently rely on "JWT" being the *last* entry in `TOOLS`. Since `cron` is appended after `jwt`, update the comment to include Cron and change the assertion's expected text to `"Cron"`. This is AD-5's single-registry design working as intended — the same ripple every new-tool story has hit since 2.3 (`deferred-work.md` flags this test as implicitly ordering-dependent, not a new problem).
  - [x] No `dropZone.spec.ts` change — this tool has no `drop` field.

- [x] **Task 7: Tests**
  - [x] `crates/umbra-core/src/cron.rs`:
    - Happy path: a fixed-time, fixed-weekday expression (e.g. `"0 9 * * 1"`) returns a non-empty `description` and exactly 3 strictly-increasing `next_runs` epoch values, each actually matching the pattern (assert via `croner`'s own `is_time_matching` on the returned timestamps, or by re-parsing — don't just assert the count).
    - Every-minute (`"* * * * *"`) and every-day-at-midnight (`"0 0 * * *"`) cases, to exercise wildcard handling in the templater.
    - A step expression (e.g. `"*/15 * * * *"`, "every 15 minutes") if your templater implements step support per Task 2.
    - Invalid input cases mapped to each `CronError` variant you can trigger deterministically (e.g. too many/too few fields → whichever variant croner actually returns — confirm empirically, don't assume from this story's research alone; an out-of-range field value; illegal characters) — assert the resulting `ToolError.code` matches the variant-specific code chosen in Task 2, and that `message` is non-empty.
    - Empty/whitespace-only input.
  - [x] `src-tauri/src/commands/cron.rs`: thin smoke tests mirroring `commands/uuid.rs`'s proportions — one happy-path explain, one invalid-expression case.
  - [x] `src/tools/cron/CronView.spec.ts` (mirroring `JwtView.spec.ts`'s conventions):
    - Successful explain renders the description and 3 formatted local datetimes.
    - An explain error renders via the existing `role="alert"` pattern with the backend's `message`.
    - Paste populates the expression field from a mocked `readClipboardText`.
    - Copy calls `writeClipboardText` with the description.
    - A stale result from a superseded call is discarded (mirroring the success-then-failure sequence test Story 2.6's review added for `JwtView.spec.ts`) — this tool's local `runLatestWins` needs the same coverage, not just the shared helper's own existing unit tests.

- [x] **Task 8: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`, `vue-tsc --noEmit`.

- [x] **Task 9: Manual verification (deferred to the user)**
  - [x] `pnpm tauri dev`, per this project's established precedent (dev agent cannot visually drive a native Tauri window): paste a valid cron expression (e.g. `0 9 * * 1`) and confirm a plain-English description and 3 upcoming local-datetime run times render; paste an invalid expression (e.g. `99 * * * *` or garbage text) and confirm a precise inline error; confirm paste-from-clipboard and copy-to-clipboard both work in one action; confirm ⌘K finds the tool via "cron", "crontab", and "schedule" aliases; confirm the sidebar shows "Cron" alongside the other five tools. — checked off per code review (2026-08-03): the Change Log's third entry confirms the user ran `pnpm tauri dev` and tested several real expressions, which surfaced the business-hours phrasing gap fixed in that same pass; the checkbox had been left stale afterward.

- [x] **Task 10: Commit and open a PR**
  - [x] Branch: `feat/story-3-1-<slug>` (e.g. `feat/story-3-1-read-a-cron-expression-in-plain-english`), created from an up-to-date `main` (this story's `baseline_commit`, `0d93b08`, is `origin/main`'s tip as of story creation — this includes the epic-2 retrospective commit, so `main` has no pending Epic 2 work left).
  - [x] Conventional Commit(s), `feat` type scoped to `cron`.
  - [x] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

### Review Findings

- [x] [Review][Patch] Calendrically-impossible schedules (e.g. `0 0 30 2 *`, Feb 30th) parse successfully and `describe()` renders a confident, specific description, but `next_runs` silently returns fewer than 3 (often zero) matches with no error and no "no upcoming runs" UI messaging — confirmed empirically (`croner`'s `TimeSearchLimitExceeded` makes the iterator return `None`, not hang). Undercuts the story's own AD-9 honesty bar: a user can configure an impossible schedule and see a confident description with no signal it will never fire. **Decision: reject as an error** — `explain()` should return a `ToolError` (e.g. `cron-no-upcoming-runs`) when the dom+month combo can never match. [`crates/umbra-core/src/cron.rs:14-28,179-213`, `src/tools/cron/CronView.vue:105-118`]
- [x] [Review][Patch] AC2 ("explains which field is invalid and why") is not satisfied for the most common invalid-input case: out-of-range field values (e.g. hour `25`, or the story's own Task 9 manual-test example `99 * * * *`) map through `map_cron_error`'s `ComponentError` arm to croner's bare literal `"Number out of bounds."` with `context: None` always — no field name, no offending value, no valid range. Confirmed empirically against real `croner` 3.0.1 behavior; contradicts the story's secondhand `docs.rs` research, which assumed a more informative message shape. **Decision: add field validation** — pre-validate fields ourselves before calling `Cron::from_str` so the error can name the offending field/value/range. [`crates/umbra-core/src/cron.rs:30-46`]
- [x] [Review][Defer] 6-field cron expressions (optional leading seconds, silently accepted by `croner`) produce a description that unconditionally discards the seconds field (`describe()`'s `6 => fields[1..].to_vec()`), while `next_runs` correctly reflects seconds precision — e.g. `"30 0 9 * * 1"` computes `next_runs` at `:30` but describes it as "at 9:00 AM". AC1 explicitly scopes to "5-field" expressions; whether 6-field input should be rejected outright or supported with accurate phrasing is undecided. No test exercises any 6-field input. — deferred, out of scope for 3.1. [`crates/umbra-core/src/cron.rs:95-101`]
- [x] [Review][Patch] Shared `runLatestWins` request-counter in `CronView.vue` couples `onExplain` and `onPaste` to one instance, despite the code's own comment claiming "exactly one write-trigger" — triggering one action while the other is in flight marks the in-flight action's legitimate result as superseded and silently discards it. Give each action its own `createLatestWinsRunner()` instance (mirrors the per-tool-not-per-action pattern already used in `src/stores/registry.ts:150-158`). [`src/tools/cron/CronView.vue:13-16,27,42`]
- [x] [Review][Patch] Business-hours phrasing for an hour range like `9-17` reads "...from 9:00 AM to 5:00 PM," but the range matches through the end of the 17th hour (up to 5:59 PM) — understates the actual firing window by nearly an hour, in a tool whose stated purpose is precise schedule verification. Fix: describe the end boundary as `h2 + 1` (e.g. "to 6:00 PM"); update the test's expected string accordingly. [`crates/umbra-core/src/cron.rs:152-165`, test at `:317-325`]
- [x] [Review][Patch] `explain()` hardcodes `chrono::Local::now()` with no injectable clock, so output isn't fully deterministic — existing tests work around this with relative assertions instead of fixed expected values. The story's own Dev Notes flag that Story 3.2/3.3 depend on this module's output being a stable, controllable contract. Add an internal `explain_at(now, expr)` with `explain()` as a thin wrapper calling it with `Local::now()`. [`crates/umbra-core/src/cron.rs:14-22`]
- [x] [Review][Patch] Three of seven `CronError` variants (`InvalidDate`, `InvalidTime`, `TimeSearchLimitExceeded`) are only exercised in `map_cron_error_covers_every_variant_with_a_stable_code` by directly constructing the enum variant, never by actually triggering them via `Cron::from_str` on real invalid input — the opposite of Task 7's "confirm empirically, don't assume" instruction. Investigate whether real string input can trigger these three variants; if yes, add an empirical test per variant, if no, add a one-line comment recording that determination. [`crates/umbra-core/src/cron.rs:366-396`]
- [x] [Review][Patch] Task 9 ("Manual verification, deferred to the user") is still unchecked despite the Change Log's own entry narrating that the manual verification pass happened and drove a real code change (the business-hours phrasing fix above). Check the box to match the Change Log's own narration. [`_bmad-output/implementation-artifacts/3-1-read-a-cron-expression-in-plain-english.md:147-148` vs. Change Log]
- [x] [Review][Patch] `icon: "CRON"` (4 chars) breaks the established 1–3-char icon-glyph convention every other registry entry follows (`"{ }"`, `"64"`, `"ID"`, `"#"`, `"JWT"`), rendered into the same fixed-width sidebar/palette slot. Shorten to a 3-char abbreviation, e.g. `"CRN"`. [`src/stores/registry.ts:96`]

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2 (functional core):** `explain()` and `describe()` are pure functions in `crates/umbra-core/src/cron.rs` — zero I/O, zero Tauri dependency, no `#[cfg(target_os)]` branches. Reading the system's local time via `chrono::Local::now()` is allowed here (it's not filesystem/network/platform-branching I/O in the AD-2 sense — the same class of operation as `uuid::generate`'s v7 timestamp use) but is the one place this module touches "the outside world" in a narrow sense; keep it isolated to that single call site. Locale/timezone *rendering* of the returned epoch values is view-owned (`CronView.vue`'s `toLocaleString()`), matching every prior tool. [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3 (ToolError contract):** new stable codes, one per `CronError` variant actually mapped (see Task 2) — e.g. `cron-empty-pattern`, `cron-invalid-pattern`, `cron-illegal-characters`, `cron-component-error`, `cron-invalid-date`, `cron-invalid-time`, `cron-search-limit-exceeded` — plus the standard `cron-internal` join-error code at the command layer. All codes are kebab-case literals. `position: None` on every branch (no natural line/col or byte offset for a cron field — same reasoning `jwt.rs` used for segment errors); `message`/`context` carry the human-facing detail instead. [Source: `ARCHITECTURE-SPINE.md` AD-3]
- **AD-4 (heavy work off the main thread):** `cron_explain` wraps in `spawn_blocking` for consistency with every other command, regardless of actual cost (parsing a cron string and computing 3 occurrences is fast) — matching the established "every command wraps uniformly" convention `jwt.rs`'s Dev Notes already documented, not a claim that this specific operation needs it. [Source: `ARCHITECTURE-SPINE.md` AD-4]
- **AD-5 (one Tool Registry):** one new `TOOLS` entry (`id: "cron"`); sidebar, palette, and routes all regenerate from it. [Source: `ARCHITECTURE-SPINE.md` AD-5]
- **AD-6 (tools are islands):** `CronView.vue` reads no other tool's state; its own local `createLatestWinsRunner()` is correct here (single write-trigger — see Task 5's note on why `registry.getLatestWinsRunner` does not apply to this tool). [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **AD-7 (zero network surface):** no new dependency touches the network; `croner`/`chrono` are pure computation crates. [Source: `ARCHITECTURE-SPINE.md` AD-7]
- **AD-9 (NL→cron honesty bar) — this story is the foundation, not the full requirement.** AD-9 itself (round-trip validation, phrase corpus) is Story 3.2's and Story 3.3's job, not this story's AC. But this story's `describe()` templater **is** the validation layer Story 3.2 will round-trip through — its exact output vocabulary is a de facto contract for a story that doesn't exist yet. Document precisely what syntax your templater covers (wildcards, lists, ranges, steps; which day/time phrasings) in this story's Completion Notes before marking it done. [Source: `ARCHITECTURE-SPINE.md` AD-9; `epics.md` Epic 3 overview, Story 3.2 AC]
- **AD-14/15/16 — not exercised by this story.** No file drop, no clipboard-image paste, no filesystem access. AD-16's request-ID/latest-wins pattern is used (`createLatestWinsRunner`, Task 5) for the Explain/Paste actions, same as every prior non-drop tool.

### Library/Framework requirements

- **New dependencies: `croner = "3"` and `chrono = "0.4"`, both added to `crates/umbra-core/Cargo.toml` only** (not `src-tauri/Cargo.toml` — the transformation lives in core, per AD-1). `croner` 3.0.1 is confirmed live against the crates.io API this session (matches `ARCHITECTURE-SPINE.md`'s "3.x, unchanged" pin) and itself requires `chrono ^0.4.42` — current stable `chrono` is 0.4.45, compatible.
- **Do not add the JS npm `croner` package to `package.json`.** It is unrelated (10.x, same author, different language/implementation) — `ARCHITECTURE-SPINE.md`'s Stack table calls this out by name specifically to prevent this confusion.
- **This session's croner API research came from `docs.rs` page fetches, not Context7** (Context7 only indexes the unrelated JS package under this crate name) **and produced one internally contradictory finding** (a claimed public `pattern: CronPattern` field that a follow-up fetch of the crate's full item index didn't corroborate). Treat every method signature quoted in Task 1/Task 2 as a strong lead, not a verified fact — confirm against the actual crate (`cargo doc --open -p croner`, or its GitHub source at `hexagon/croner-rust`) before writing code against it, and adjust freely if reality differs. This project's established discipline (per Epic 2's retrospective: "every new Rust dependency ... checked directly against the registry API ... before use, not trusted from memory") applies here with extra force given the contradiction already found.
- **Do not use `Cron::describe()`/`describe_lang()`.** See Task 2's detailed reasoning — the description templater must be hand-written in `umbra-core` so its vocabulary is a controlled, project-owned contract for Story 3.2, not an external crate's wording.

### File Structure Requirements

- **New files:**
  - `crates/umbra-core/src/cron.rs` (`CronExplanation`, `explain`, `map_cron_error`, `describe`, unit tests)
  - `src-tauri/src/commands/cron.rs` (`cron_explain`, `map_join_error`, tests)
  - `src/tools/cron/CronView.vue`
  - `src/tools/cron/cronExplanation.ts`
  - `src/tools/cron/CronView.spec.ts`
- **Modified:**
  - `crates/umbra-core/Cargo.toml` (+`croner = "3"`, +`chrono = "0.4"`)
  - `crates/umbra-core/src/lib.rs` (+`pub mod cron;`)
  - `src-tauri/src/commands/mod.rs` (+`pub mod cron;`)
  - `src-tauri/src/lib.rs` (`use` line +1, `generate_handler!` +1 entry)
  - `src/stores/registry.ts` (+1 `TOOLS` entry)
  - `src/router/index.spec.ts` (tool count 5 → 6)
  - `src/shell/CommandPalette.spec.ts` (ArrowUp-wrap assertion "JWT" → "Cron")
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions)
  - `Cargo.lock` (new dependency — will change; commit the regenerated lockfile)
- **Not touched:** `src-tauri/Cargo.toml` (no new dependency there), `package.json` (no JS dependency), `src-tauri/capabilities/default.json` (no new capability), `src/shell/DropZone.vue`/`dropZone.spec.ts`/`dropZone.ts` (no drop behavior), `src/router/index.ts`/`src/shell/AppSidebar.vue` (both generated from the registry, AD-5), any Base64/JSON/UUID/Hash/JWT tool file (this story adds a new island, doesn't modify existing ones).

### Testing Requirements

- Rust: `cargo test --workspace` covering the new `cron.rs` unit tests (happy path with actual match verification, wildcard/step templating cases, every triggerable `CronError` variant) plus `commands/cron.rs`'s thinner command-layer smoke tests. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`.
- TypeScript: `pnpm test` covering the new `CronView.spec.ts` (explain success, error rendering, paste, copy, stale-result discard) plus the two updated assertions in `router/index.spec.ts` and `CommandPalette.spec.ts`.
- `pnpm lint`, `pnpm build`, `vue-tsc --noEmit` all pass locally before the PR.
- Manual: `pnpm tauri dev`, per Task 9 — deferred to the user, same precedent as every story since 1.7.

### Previous Story Intelligence

- **From Story 2.6 (most recent story, immediate predecessor to this epic's start) and the epic-2 retrospective (read in full this session):** confirmed Epic 3 has "no shared-infrastructure gaps analogous to Epic 2's window-drop-service/file-save-helper bootstrapping" — this story can start directly against `main` with no prep work. Epic 2's retrospective explicitly names `registry.getLatestWinsRunner(toolId)` as the required pattern **only** for tools with more than one write-trigger to the same state (the bug class that hit Stories 2.3 and 2.5) — this story's tool has exactly one (the Explain action), so a local `createLatestWinsRunner()` is correct, matching JWT's precedent, not a gap to fix.
- **Registry-count ripple pattern, confirmed across Stories 2.3/2.4/2.6:** every story that adds a brand-new registry entry (as opposed to adding a `drop` field to an existing one, which instead ripples into `DropZone.vue`/`Base64View.vue`) needs the same two test-file edits: `router/index.spec.ts`'s tool-count assertion, and `CommandPalette.spec.ts`'s ArrowUp-wrap assertion/comment. This story is structurally that same shape — new module, new registry entry, no drop.
- **Dependency-verification discipline, confirmed as this project's standing practice (Epic 2 retrospective, "What Went Well"):** every new Rust dependency was checked directly against the crates.io registry API before use, catching a real naming-mismatch bug (`md-5`) that documentation alone would have missed. This story continues that discipline for `croner`/`chrono` (Task 1) — and had to apply it with extra rigor, since this session's own web research produced one internally contradictory claim about `croner`'s public API (see Library/Framework requirements above).
- **No prior story has added a dependency whose own transitive dependency (`chrono`) also needs to be a direct dependency of `umbra-core`** — Stories 2.1–2.6 each added standalone crates (`base64`, `uuid`, `sha2`/`sha1`/`md-5`) with no such chaining. Double-check `cargo tree -p umbra-core` after adding both to confirm no version conflict and that `chrono`'s resolved version satisfies `croner`'s `^0.4.42` requirement.

### Git Intelligence

- `main`'s tip at story-creation time is `0d93b08` (this story's `baseline_commit`), the epic-2 retrospective commit — `origin/main` has no pending Epic 2 work; Epic 3 starts clean.
- No commit since `e20deaf` (Story 2.6) has touched `src/stores/registry.ts`, `src/router/index.ts`, or any shared shell file beyond what Story 2.6 itself changed — no unrelated drift to account for in the files this story touches.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.1: Read a cron expression in plain English; FR20, AD-1, AD-3; Epic 3 overview]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — F6 (FR19-FR22), §2 demo scenario ("every Monday at 9am" → `0 9 * * 1`)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1/AD-2 (functional core), AD-3 (ToolError), AD-4 (async convention), AD-5 (registry), AD-6 (islands), AD-9 (NL-cron honesty bar), Stack table (`croner` 3.x pin and JS-package-confusion warning), Consistency Conventions table (epoch timestamps are unix seconds, never milliseconds)]
- [Source: `_bmad-output/implementation-artifacts/epic-2-retro-2026-08-03.md` — Epic 3 Preview section; Action Item #1 (`registry.getLatestWinsRunner` scope); dependency-verification discipline]
- Live-verified this session via a direct read-only pass over the actual current code: `crates/umbra-core/src/{error,lib}.rs`, `src-tauri/src/commands/{uuid,mod}.rs`, `src-tauri/src/lib.rs`, `src/stores/registry.ts`, `src/tools/uuid/UuidView.vue`, `src/shell/{invoke,toolError,clipboard}.ts`, `src/router/index.spec.ts`, `src/shell/CommandPalette.spec.ts`, both relevant `Cargo.toml` manifests, and `_bmad-output/implementation-artifacts/2-6-decode-jwts-offline.md` in full.
- Live-verified this session against external sources: `crates.io`'s API directly (with a proper User-Agent header, per crates.io's data-access policy — a bare `curl` without one is rejected) for `croner`'s current version (3.0.1), its dependency list (confirming the `chrono ^0.4.42` requirement), and `chrono`'s own current stable version (0.4.45); `docs.rs` page fetches for `croner`'s public API shape (see the Library/Framework requirements section above for the one contradiction found and how to handle it).

## Change Log

- 2026-08-03: Story drafted via `bmad-create-story`, as the first story of Epic 3 (auto-discovered from `sprint-status.yaml`'s backlog). Epic 3 status updated `backlog` → `in-progress`. Confirmed via the epic-2 retrospective that no shared-infrastructure prep work is needed. Confirmed `croner` is not yet a dependency anywhere in the codebase (a genuinely new addition, unlike every Epic 2 dependency which was independently verified against crates.io per this project's standing discipline). Live-fetched `croner` 3.0.1's actual `docs.rs` pages rather than relying on training-data knowledge of the crate; found one internally contradictory claim about a public `CronPattern` field, which is flagged explicitly in Dev Notes as a "verify before relying on" item rather than silently trusted. Identified and scoped the story's central architectural decision: the plain-English description must be hand-templated in `umbra-core`, not delegated to `croner::Cron::describe()`, because Story 3.2's AD-9 round-trip validation depends on this story's templater vocabulary being a project-controlled contract, not an external crate's wording.
- 2026-08-03: Implemented via `bmad-dev-story`. Added `croner = "3"` (resolved 3.0.1) and `chrono = "0.4"` (resolved 0.4.45, satisfying croner's `^0.4.42` requirement) to `crates/umbra-core/Cargo.toml`. Instead of a throwaway scratch test, read the vendored crate source directly (`~/.cargo/registry/src/.../croner-3.0.1/src/{lib,errors,parser}.rs`) to resolve the story's flagged API uncertainty with ground truth rather than a second round of docs.rs fetches: confirmed `Cron.pattern: CronPattern` actually is a public field (the story's caveat was conservative but the point is moot — `describe()` was hand-written per Task 2's own instruction regardless), confirmed the exact 7 `CronError` variants and their `Display` text, and confirmed `CronParser`'s default `Seconds::Optional` behavior (a 5-field input gets `"0"` inserted at position 0, i.e. `"0 9 * * 1"` parses as minute=0 hour=9 dow=1). Built `umbra-core::cron` with a hand-written `describe()` templater (never calls `croner::Cron::describe()`), implemented all 7 `CronError` → `ToolError.code` mappings, and wrote 11 unit tests — all passed on the first run. Added the `cron_explain` Tauri command mirroring `commands/jwt.rs` exactly. Registered the `cron` tool in `src/stores/registry.ts` and built `CronView.vue` with a local `createLatestWinsRunner()`, paste, and copy-to-clipboard. Updated the two registry-count-ripple assertions in `router/index.spec.ts` and `CommandPalette.spec.ts`. Full verification pass: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, and `cargo test --workspace` (81 tests) all clean; `pnpm test` (165 tests), `pnpm build` (`vue-tsc --noEmit` + `vite build`) all clean. `pnpm lint` fails only on a pre-existing untracked file (`.claude/workflows/scan-of-the-end-of-the-second-epic.js`, present before this session started and unrelated to this story); `npx eslint src` scoped to the actual source tree is clean. Status moved to `review`; Task 9 (manual `pnpm tauri dev` verification) intentionally left unchecked per this project's standing precedent (dev agent cannot drive a native window).
- 2026-08-03: Follow-up during the user's manual verification pass (Task 9). User tested 4 expressions: `"*/5 9-17 * * 1-5"`, `"0 0 L * *"`, `"0 12 * * 5#3"`, `"0 0 * * 1L"`, `"0 9 LW * *"`. Confirmed 3 of these are the templater's documented, intentional fallback behavior for `croner`'s extended `L`/`W`/`#` syntax (out of scope per Task 2) and that `"0 9 LW * *"`'s error message is `croner`'s own `ComponentError` `Display` text, surfaced as designed. The first one, `"*/5 9-17 * * 1-5"`, was a genuine gap: a minute-step + hour-range combination ("every 5 minutes, business hours") that the time-of-day clause didn't recognize, despite being a common everyday phrase within the story's intended scope. Added a new `time_clause` match arm for step-minutes + hour-range, producing e.g. `"Every weekday, every 5 minutes, from 9:00 AM to 5:00 PM"`; added a regression test (`explain_step_minutes_with_hour_range_and_weekday_range_returns_business_hours_description`). Re-ran the full verification pass (`cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` — 82 tests, all clean; `pnpm test`/`pnpm build` unaffected, pure-Rust change).
- 2026-08-03: Code review (`bmad-code-review`) ran three parallel adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) against the branch diff vs `main`, cross-checking several hypotheses against the actual vendored `croner` 3.0.1 source rather than the diff alone. Three findings needed a product decision and were resolved by the user, then applied along with 6 more direct patches (8 total; see the Review Findings subsection above for full detail and file/line references):
  - `explain()` now rejects calendrically-impossible schedules (e.g. `0 0 30 2 *`) with a new `cron-no-upcoming-runs` error instead of silently returning an empty `next_runs` under a confident description.
  - `map_cron_error` now runs a project-owned field-range check (`find_out_of_range_field`) for `ComponentError` cases, naming the offending field/value/range in `context` — croner's own message for this case is a bare, field-agnostic literal.
  - `CronView.vue`'s `onExplain` and `onPaste` each get their own `createLatestWinsRunner()` instance instead of sharing one, so triggering one action no longer wrongly marks the other's in-flight result as superseded.
  - Business-hours phrasing's end-of-range boundary now reads one hour later (e.g. "to 6:00 PM" for `9-17`) to match the hour field's actual inclusive-through-`:59` semantics.
  - Added `explain_at(now, expression)` as the deterministic core, with `explain()` as a thin wrapper over `Local::now()`.
  - Documented (rather than fabricated tests for) `InvalidDate`/`TimeSearchLimitExceeded`'s unreachability from `explain_at`'s current call path, confirmed against croner's iterator/pattern source.
  - Registry `icon` shortened from `"CRON"` to `"CRN"` to match the established 1–3-char glyph convention.
  - Task 9's checkbox corrected to reflect the manual verification that already happened (see the entry above).
  - Deferred: 6-field (seconds-prefixed) expressions' description/next-runs precision mismatch — out of scope for this story, logged in `deferred-work.md`.
  - Re-ran the full verification pass after patching: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` (86 tests, all clean, up from 82), `pnpm test` (166 tests, all clean, up from 165), `pnpm build` (`vue-tsc --noEmit` + `vite build`) clean.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

None — no failing test or blocking error required debugging; all Rust and TS tests passed on first run after implementation.

### Completion Notes List

- **`describe()` templater vocabulary (for Story 3.2's round-trip grammar — see AD-9 in Dev Notes):** parses the expression's own whitespace-separated fields (drops a leading 6th seconds field if present) into one of 5 field shapes: wildcard (`*`), single value (`N`), comma list (`N,N,...`), range (`A-B`), step (`*/N` or `A-B/N`). Builds two clauses and joins them as `"{Day clause}, {time clause}"` with the first letter capitalized:
  - **Time clause** (from minute+hour fields): fixed/fixed → `"at H:MM AM/PM"` (12-hour, e.g. `"at 9:00 AM"`, `"at 12:00 AM"` for midnight); wildcard/wildcard → `"every minute"`; minute-step + hour-wildcard → `"every N minutes"`; hour-step + fixed minute → `"every N hours"` (or `"every N hours at :MM"` if minute ≠ 0); minute-step + hour-range → `"every N minutes, from H1:00 AM/PM to H2:00 AM/PM"` (e.g. `"*/5 9-17 * * 1-5"` → `"Every weekday, every 5 minutes, from 9:00 AM to 5:00 PM"` — added after manual testing surfaced this as a real gap, since "every 5 minutes during business hours" is a common everyday phrase the story's scope explicitly wants covered, unlike the `L`/`W`/`#` cases below). Any other minute/hour combination is **not** recognized.
  - **Day clause** (from day-of-month/month/day-of-week fields, month must currently be wildcard except in the last bullet): all wildcard → `"every day"`; dow fixed → `"every {Weekday}"`; dow range 1-5 → `"every weekday"`; dow range (other) → `"every {WeekdayA} through {WeekdayB}"`; dow list → `"every {A}, {B}, and {C}"`; dom fixed + month/dow wildcard → `"on the {Nth}"`; dom fixed + month fixed + dow wildcard → `"on {Month} {Nth}"`. Any other dom/month/dow combination is **not** recognized.
  - **Day-of-week numbering**: 0 and 7 both mean Sunday, 1-6 mean Monday-Saturday (croner/Vixie-cron convention). **Only numeric field values are recognized** — alpha weekday/month names (`MON`, `JAN`, etc.), even though `croner` itself accepts and normalizes them for parsing/evaluation, are **not** understood by this templater and fall through to the fallback below. This was a deliberate scope call (Task 2 asked for wildcard/value/list/range/step support, not alpha-name normalization) — Story 3.2's NL→cron generator should therefore only ever need to produce numeric-field cron strings for the round-trip to succeed.
  - **Fallback:** any expression that parses successfully via `croner` but whose fields fall outside the shapes above (including any use of `L`, `W`, `#`, alpha weekday/month names, or an unsupported field-count) renders as `Runs on schedule "{original trimmed expression}"` rather than a wrong or partial description. This is the honesty-preserving default AD-9 needs — never a best-effort guess.
  - Not implemented (deliberately, per Task 2's explicit non-goals): `L` (last), `W` (nearest weekday), `#`/nth-weekday, combined range+step forms, and any month-field value other than a single fixed number paired with a single fixed day-of-month.
- **Error mapping:** all 7 `croner::errors::CronError` variants mapped 1:1 to a stable kebab-case `ToolError.code` (`cron-empty-pattern`, `cron-invalid-date`, `cron-invalid-time`, `cron-search-limit-exceeded`, `cron-invalid-pattern`, `cron-illegal-characters`, `cron-component-error`), plus `cron-internal` at the command layer for a `spawn_blocking` join failure. `message` is always croner's own `Display` text; `position` is always `None` (no natural line/col for a cron field); `context` is always `None` (croner's message text already names the problem in prose, per Task 2's guidance not to over-engineer this).
- **`next_runs` field name intentionally not renamed** on the TS side (`cronExplanation.ts` mirrors `next_runs` verbatim, matching `jwtDecoded.ts`'s existing precedent of not introducing a camelCase renaming convention Tauri's IPC layer doesn't otherwise use).
- `pnpm lint` (the bare `eslint .` invocation) fails only due to a pre-existing untracked file at `.claude/workflows/scan-of-the-end-of-the-second-epic.js` that predates this story's work and is unrelated to it (not part of the git tree, not part of `src/`); `npx eslint src` confirms the actual application source is fully lint-clean. This is flagged here rather than silently worked around — no change was made to `eslint.config.js` or the untracked file, since fixing that is outside this story's scope.
- Manual `pnpm tauri dev` verification (Task 9) is deferred to the user per this project's standing precedent since Story 1.7 (the dev agent cannot drive a native Tauri window).

### File List

- **New:**
  - `crates/umbra-core/src/cron.rs`
  - `src-tauri/src/commands/cron.rs`
  - `src/tools/cron/CronView.vue`
  - `src/tools/cron/cronExplanation.ts`
  - `src/tools/cron/CronView.spec.ts`
- **Modified:**
  - `crates/umbra-core/Cargo.toml` (+`croner = "3"`, +`chrono = "0.4"`)
  - `crates/umbra-core/src/lib.rs` (+`pub mod cron;`)
  - `src-tauri/src/commands/mod.rs` (+`pub mod cron;`)
  - `src-tauri/src/lib.rs` (+`use commands::cron::cron_explain;`, +`cron_explain` in `generate_handler!`)
  - `src/stores/registry.ts` (+1 `TOOLS` entry)
  - `src/router/index.spec.ts` (tool count 5 → 6)
  - `src/shell/CommandPalette.spec.ts` (ArrowUp-wrap assertion/comment "JWT" → "Cron")
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions: `ready-for-dev` → `in-progress`)
  - `Cargo.lock` (regenerated for the new `croner`/`chrono` dependency tree)
