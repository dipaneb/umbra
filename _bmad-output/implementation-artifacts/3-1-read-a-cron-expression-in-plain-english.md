---
baseline_commit: 0d93b08
---

# Story 3.1: Read a cron expression in plain English

Status: ready-for-dev

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

- [ ] **Task 1: Add and verify the `croner` dependency (AC: 1, 2)**
  - [ ] Add to `crates/umbra-core/Cargo.toml`: `croner = "3"` and `chrono = "0.4"` (croner 3.0.1 itself requires `chrono ^0.4.42` as a normal, non-optional dependency — confirmed directly against the crates.io API this session; `chrono` must also be added as `umbra-core`'s own direct dependency to construct/consume `DateTime<Tz>` values in this crate's own code, not merely rely on croner's internal re-export). Default features are sufficient for both — no `serde` feature needed on either crate for this story (no `Cron`/`DateTime` value crosses `serde` serialization directly; only derived `i64` epoch seconds do, via the existing `ToolError`/struct-serialize pattern every other module already uses).
  - [ ] **Verify the actual API by writing and running one throwaway sanity test before building the full module** — do not trust this story's secondhand API research (below) as gospel. This session confirmed via `crates.io`'s dependency API that `croner` 3.0.1 matches the architecture spine's "3.x, unchanged" pin, and confirmed via `docs.rs` that:
    - `Cron::from_str(s: &str) -> Result<Cron, CronError>` (via `FromStr`) parses cron expressions with an **optional leading seconds field** — a plain 5-field expression like `"0 9 * * 1"` (minute hour day-of-month month day-of-week) parses as a standard cron pattern with seconds omitted, matching AC1's "5-field" wording directly.
    - `Cron::find_next_occurrence<Tz: TimeZone>(&self, start_time: &DateTime<Tz>, inclusive: bool) -> Result<DateTime<Tz>, CronError>` and `Cron::iter_after<Tz: TimeZone>(&self, start_after: DateTime<Tz>) -> CronIterator<Tz>` (where `CronIterator` implements `Iterator<Item = DateTime<Tz>>`) both exist — prefer `iter_after(now).take(3)` over three manual `find_next_occurrence` calls; it's the more idiomatic form the crate's own examples favor for "give me the next N runs."
    - **One piece of this session's research directly contradicted itself and must not be trusted uncritically:** an initial fetch claimed `Cron` has a public `pattern: CronPattern` field exposing structured per-field data, but a follow-up fetch of the crate's full public item index (`docs.rs/croner/3.0.1/croner/all.html`) does **not** list `CronPattern` anywhere, at any module path. Do not build the description templater assuming structured field access exists on `Cron` — verify directly (`cargo doc --open -p croner` or the crate's actual source) before relying on it, and if it turns out not to be cleanly public, fall back to the string-splitting approach in Task 2 below (which does not depend on this either way, and is the safer default to build against first).
    - `CronError` variants observed: `EmptyPattern`, `InvalidDate`, `InvalidTime`, `TimeSearchLimitExceeded`, `InvalidPattern(String)`, `IllegalCharacters(String)`, `ComponentError(String)` — none carry a clean machine-readable field-index enum; the three string variants carry a human-readable `Display` message that may name the offending field/value in prose (e.g. "position X is out of bounds for range Y-Z" was observed for `ComponentError`), but there's no structured `field: CronField` you can match on. Map by variant to a stable `ToolError.code` (Task 2), and use croner's own `Display` text for `message` — do not attempt to fabricate a synthetic `Position` (no natural line/col or byte offset exists for a cron field the way JSON has for text; same reasoning `jwt.rs` already used for "which segment failed" — `context`, not `position`, carries the human-facing detail).
  - [ ] Do **not** add `croner-rs` or any similarly-named crate — `croner` is the correct crate id. Do not confuse it with the unrelated JS npm package of the same name (10.x, by the same author "hexagon" but a different language and implementation) — this exact confusion is called out by name in `ARCHITECTURE-SPINE.md`'s Stack table.

- [ ] **Task 2: `umbra-core::cron` — explain a cron expression (AC: 1, 2)**
  - [ ] Create `crates/umbra-core/src/cron.rs`. Define:
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
  - [ ] Implement `map_cron_error(err: croner::errors::CronError) -> ToolError`, one `code` per variant (all stable kebab-case, following the existing `jwt.rs`/`base64.rs`/`hash.rs` convention of hardcoded string literals — never `format!` a dynamic value into `code`, only into `message`/`context`): e.g. `"cron-empty-pattern"`, `"cron-invalid-date"`, `"cron-invalid-time"`, `"cron-search-limit-exceeded"`, `"cron-invalid-pattern"`, `"cron-illegal-characters"`, `"cron-component-error"`. `message` is croner's own `Display` text (`err.to_string()`); `position: None` on every branch (no natural line/col — see Task 1); `context` may repeat/extract the field-naming detail from the message if trivially available, otherwise `None` — do not over-engineer field-position extraction beyond what AC2's literal wording needs ("explains which field is invalid and why" is satisfied by a clear `message`, since croner's own error text already names the problem in prose).
  - [ ] **Implement `describe(expression: &str) -> String` as a hand-written templater — do not call `croner::Cron::describe()`/`describe_lang()`.** This is the single most important architectural decision in this story, and it's easy to get wrong by reaching for the crate's own built-in description as a shortcut:
    - The epic's AC1 wording is explicit: "description templating in `umbra-core::cron`" is called out separately from "cron parsing/next-occurrence computation uses `croner`" — these are deliberately two different responsibilities assigned to two different places.
    - **Why this matters beyond this story:** Story 3.2 (natural language → cron, not yet built) must round-trip every result through *this story's* cron→English direction before displaying it (AD-9's honesty bar) — the round-trip only proves anything if Story 3.2's NL grammar and this story's `describe()` speak the *same* deterministic vocabulary. `croner`'s built-in `describe()` uses its own internal phrasing (via `croner::describe::lang::english::English`) that this project does not control and cannot guarantee stays stable across croner versions or matches whatever grammar Story 3.2 ends up building. Using it here would silently couple Story 3.2's correctness to an external crate's wording choices — exactly the kind of hidden coupling this workflow exists to prevent.
    - Build `describe()` by parsing the expression's own whitespace-separated fields (5 or 6 depending on whether a leading seconds field is present) directly as strings — independent of whatever `Cron`'s internal representation turns out to be (see Task 1's caveat about `CronPattern`'s uncertain public accessibility). Handle, at minimum, the field syntaxes needed to cover this project's PRD demo phrase and Story 3.3's eventual corpus: `*` (wildcard), a single specific value, a comma-separated list, a `a-b` range, and a `*/n` or `a-b/n` step. Recommended minimal shape: derive a time-of-day clause from the minute+hour fields (e.g. "at 9:00 AM" for fixed values, "every 15 minutes" for a minute step with hour `*`) and a day clause from day-of-month/month/day-of-week (e.g. "every Monday", "every weekday" for a Mon–Fri day-of-week range, "on the 1st" for a fixed day-of-month), then join them (e.g. "Every Monday, at 9:00 AM" for `0 9 * * 1` — deliberately close to the PRD's own demo phrase, "every Monday at 9am", so the round-trip in Story 3.2 has the least distance to cover).
    - **Do not build support for `croner`'s extended non-standard syntax** (`L`, `W`, `#`/nth-weekday, or combined range+step forms beyond the simple cases above) — FR19/FR21/FR22 scope the whole NL↔cron feature to a corpus of common, everyday scheduling phrases (Story 3.3), not exotic cron extensions; supporting them here would be speculative scope beyond what any planned story actually demos or tests.
    - **Record the exact vocabulary and field-syntax coverage you implement in this story's own Completion Notes / Dev Notes before finishing** (see the template's `## Dev Notes` and `## Dev Agent Record` sections) — Story 3.2's own `create-story` pass will read this file as "previous story intelligence" and needs the exact phrasing rules to build a matching grammar, not just this story's stated intent.

- [ ] **Task 3: Tauri command `cron_explain` (AC: 1, 2)**
  - [ ] Create `src-tauri/src/commands/cron.rs`, mirroring `commands/jwt.rs`'s/`commands/uuid.rs`'s shape exactly (pure text-in-struct-out, no file I/O):
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
  - [ ] `src-tauri/src/commands/mod.rs`: add `pub mod cron;`.
  - [ ] `src-tauri/src/lib.rs`: add `use commands::cron::cron_explain;` and add `cron_explain` to the `generate_handler![...]` list (after `jwt_decode`).
  - [ ] `crates/umbra-core/src/lib.rs`: add `pub mod cron;`.
  - [ ] **No `capabilities/default.json` change** — no filesystem access, no network capability needed (pure computation, same reasoning as every prior text-in/text-out command).

- [ ] **Task 4: Tool Registry — register the `cron` tool (AC: 1, 3)**
  - [ ] `src/stores/registry.ts`: add a **new** entry to `TOOLS` (this is a new tool, no existing entry is being extended):
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
  - [ ] **No `drop` field.** Cron expressions are pasted text, not dropped files — same drop-less precedent as JSON/UUID/JWT.
  - [ ] This is the only registry change; sidebar, ⌘K palette, and route table all regenerate from this one entry (AD-5) — do not hand-edit `src/router/index.ts` or `src/shell/AppSidebar.vue`.

- [ ] **Task 5: `src/tools/cron/CronView.vue` — paste, submit, render (AC: 1, 2, 3)**
  - [ ] Create `src/tools/cron/cronExplanation.ts`, mirroring `jwtDecoded.ts`'s hand-maintained-mirror convention:
    ```ts
    // Mirrors `CronExplanation` in crates/umbra-core/src/cron.rs — keep in sync by hand.
    export interface CronExplanation {
      description: string;
      nextRuns: number[]; // epoch seconds — convert to Date via `new Date(seconds * 1000)`
    }
    ```
    Note the Rust struct field is `next_runs` (snake_case); confirm at implementation time whether `serde`'s default (de)serialization on this struct needs `#[serde(rename_all = "camelCase")]` or whether the project's existing structs (e.g. `JwtDecoded`) already rely on Tauri's IPC layer passing snake_case through as-is and the TS side just mirrors `next_runs` verbatim — check `jwtDecoded.ts`'s actual field naming (`exp`/`iat`/`nbf`, not renamed) before deciding; **do not introduce a renaming convention this codebase doesn't already use elsewhere.**
  - [ ] Create `src/tools/cron/CronView.vue`, following `JwtView.vue`'s/`UuidView.vue`'s established structure:
    - **Use a local `createLatestWinsRunner()` instance, not `registry.getLatestWinsRunner("cron")`.** This tool has exactly one write-trigger to its own state (the explicit "Explain" submit action) — no drop handler, no re-firing selector like UUID's version radio. The epic-2 retrospective's Action Item #1 (documenting `registry.getLatestWinsRunner` as required) applies specifically to tools with **more than one** write-trigger to the same state; applying it here would be scope creep for a tool that doesn't have that race condition, exactly the kind of tool JWT already set the precedent for (JWT also uses a local runner, for the same reason).
    - State: `expression = ref("")`, `explanation = ref<CronExplanation | null>(null)`, `error = ref<ToolError | null>(null)`.
    - `onExplain()`: `runLatestWins(() => invoke<CronExplanation>("cron_explain", { expression: expression.value }))`; on success set `explanation.value` and clear `error`; on failure clear `explanation` and set `error` — same shape as `JwtView.vue::onDecode`/`HashView.vue::onCompute`.
    - `onPaste()`: reuse `readClipboardText()` from `../../shell/clipboard` (FR4/AD-14) to populate `expression`, clearing any stale `explanation`/`error` — same shape as every other tool's paste handler.
    - Render `explanation.description` as plain text, and `explanation.nextRuns` as a list of local datetimes: `new Date(epochSeconds * 1000).toLocaleString()` — **multiply by 1000**, same epoch-seconds-to-milliseconds conversion `JwtView.vue::formatClaim` already established (core's epoch values are unix seconds, never milliseconds, per the Consistency Conventions table).
    - A copy-to-clipboard action per FR4 — this tool's natural "output" is the description text (unlike JWT, which has no single output string); copy the `description` via `writeClipboardText`.
  - [ ] Keyboard/accessibility (NFR5): label the expression `<textarea>` or `<input>` (`<label for="cron-expression-input">`), use native `<button>` elements for Explain/Paste/Copy (inherits visible focus for free) — no new keyboard-handling code needed; this tool registers no shortcuts or drop listeners.

- [ ] **Task 6: Fix the anticipated registry-count ripple (same pattern as Stories 2.3/2.4/2.6)**
  - [ ] `src/router/index.spec.ts:55`: `expect(registry.tools).toHaveLength(5)` → `toHaveLength(6)`.
  - [ ] `src/shell/CommandPalette.spec.ts:143-147`: the ArrowUp-wrap test's comment ("Default empty query lists all registry entries (JSON, Base64, UUID, Hash, JWT)") and its assertion `expect(wrapper.find("li.active").text()).toContain("JWT")` both currently rely on "JWT" being the *last* entry in `TOOLS`. Since `cron` is appended after `jwt`, update the comment to include Cron and change the assertion's expected text to `"Cron"`. This is AD-5's single-registry design working as intended — the same ripple every new-tool story has hit since 2.3 (`deferred-work.md` flags this test as implicitly ordering-dependent, not a new problem).
  - [ ] No `dropZone.spec.ts` change — this tool has no `drop` field.

- [ ] **Task 7: Tests**
  - [ ] `crates/umbra-core/src/cron.rs`:
    - Happy path: a fixed-time, fixed-weekday expression (e.g. `"0 9 * * 1"`) returns a non-empty `description` and exactly 3 strictly-increasing `next_runs` epoch values, each actually matching the pattern (assert via `croner`'s own `is_time_matching` on the returned timestamps, or by re-parsing — don't just assert the count).
    - Every-minute (`"* * * * *"`) and every-day-at-midnight (`"0 0 * * *"`) cases, to exercise wildcard handling in the templater.
    - A step expression (e.g. `"*/15 * * * *"`, "every 15 minutes") if your templater implements step support per Task 2.
    - Invalid input cases mapped to each `CronError` variant you can trigger deterministically (e.g. too many/too few fields → whichever variant croner actually returns — confirm empirically, don't assume from this story's research alone; an out-of-range field value; illegal characters) — assert the resulting `ToolError.code` matches the variant-specific code chosen in Task 2, and that `message` is non-empty.
    - Empty/whitespace-only input.
  - [ ] `src-tauri/src/commands/cron.rs`: thin smoke tests mirroring `commands/uuid.rs`'s proportions — one happy-path explain, one invalid-expression case.
  - [ ] `src/tools/cron/CronView.spec.ts` (mirroring `JwtView.spec.ts`'s conventions):
    - Successful explain renders the description and 3 formatted local datetimes.
    - An explain error renders via the existing `role="alert"` pattern with the backend's `message`.
    - Paste populates the expression field from a mocked `readClipboardText`.
    - Copy calls `writeClipboardText` with the description.
    - A stale result from a superseded call is discarded (mirroring the success-then-failure sequence test Story 2.6's review added for `JwtView.spec.ts`) — this tool's local `runLatestWins` needs the same coverage, not just the shared helper's own existing unit tests.

- [ ] **Task 8: Full verification pass**
  - [ ] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [ ] `pnpm lint`, `pnpm test`, `pnpm build`, `vue-tsc --noEmit`.

- [ ] **Task 9: Manual verification (deferred to the user)**
  - [ ] `pnpm tauri dev`, per this project's established precedent (dev agent cannot visually drive a native Tauri window): paste a valid cron expression (e.g. `0 9 * * 1`) and confirm a plain-English description and 3 upcoming local-datetime run times render; paste an invalid expression (e.g. `99 * * * *` or garbage text) and confirm a precise inline error; confirm paste-from-clipboard and copy-to-clipboard both work in one action; confirm ⌘K finds the tool via "cron", "crontab", and "schedule" aliases; confirm the sidebar shows "Cron" alongside the other five tools.

- [ ] **Task 10: Commit and open a PR**
  - [ ] Branch: `feat/story-3-1-<slug>` (e.g. `feat/story-3-1-read-a-cron-expression-in-plain-english`), created from an up-to-date `main` (this story's `baseline_commit`, `0d93b08`, is `origin/main`'s tip as of story creation — this includes the epic-2 retrospective commit, so `main` has no pending Epic 2 work left).
  - [ ] Conventional Commit(s), `feat` type scoped to `cron`.
  - [ ] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

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

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
