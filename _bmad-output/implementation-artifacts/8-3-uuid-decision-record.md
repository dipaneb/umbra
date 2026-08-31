---
story: 8-3-reimagine-the-uuid-generator
produced_by: bmad-party-mode (installed roster — Mary, John, Sally, Winston, Amelia, Paige), party_mode session
date: 2026-08-30
status: decided — Task 1 complete, gates Task 2
---

# Decision Record: UUID Generator scope (Story 8.3, Task 1)

Open scope discovery, run per Epic 8's shared story shape — the shipped implementation
(`crates/umbra-core/src/uuid.rs`, `src-tauri/src/commands/uuid.rs`,
`src/tools/uuid/UuidView.vue`, `src/tools/uuid/uuidVersion.ts`, `tools.uuid.*` locales) was
treated as reference only, not a scope to preserve by default. All source files were re-read in
full at the start of this session, plus the Epic-7 design-system anchors (`tokens.css`,
`base.css`, `AppButton.vue`, `AppTabs.vue`, `App.vue`, `icons.ts`) and both redesign references
(`JsonView.vue` tabbed, `Base64View.vue` single enriched view). Grounded in a competitive sweep
of the UUID tool landscape (uuidtools.com, uuidgenerator.net incl. its v7 page, guidgenerator.com,
toolslab.dev, CyberChef's "Generate UUID", Postman's `$guid` / `$randomUUID`, the platform
`uuidgen` CLI, browser `crypto.randomUUID()`). Developer confirmed the container choice and every
open scope question 2026-08-30.

**Amendment (2026-08-30, same session):** the developer directed that the shared `Popover`
component + the `?` version explainer — initially recorded as a separate future story — be
**folded into Story 8.3's scope** as a **general reusable component**. Reflected in **Added**
item 3, the AD-1 split, the i18n finding, and the open-items list below; the "Separate story"
section was removed and its drafted issue withdrawn.

## Drift found vs. the story's Dev Notes (not behavioural)

- **The per-row Copy control is already `<AppButton>`, not a bare `<button>`.** The story's Dev
  Notes describe it as a "bare `<button>`" in three places (the Task 1 "feed the session" bullet,
  the "Copy affordance" bullet, the "Styling status" bullet) and frame *"restyle the bare per-row
  Copy `<button>`"* as Task 2 work. It was converted to `AppButton` in **PR #104**
  (`b357aff`, 2026-08-24, "apply design tokens and AppButton consistently across tool views") —
  which predates Epic 8. The Task 2 restyle target is therefore a **component → icon-button**
  change for consistency in the enriched view, not "wrap an unstyled element."
- **Test counts:** `crates/umbra-core/src/uuid.rs` has **8** unit tests (Dev Notes say 9);
  `UuidView.spec.ts` has **10** tests (Dev Notes say 11; 199 lines is correct);
  `UuidView.vue` is **206** lines (Dev Notes say ~230). No behavioural drift — the
  `UuidVersion { V4, V7 }` enum, `MAX_COUNT: u32 = 1000`, the two error codes, the shared
  `ContextV7` batch, the client `MAX_COUNT = 4294967295` input-shape guard, `watch(version)`
  clearing stale results, `TRANSLATABLE_CODES` carrying only `uuid-count-zero`, the registry
  entry with no `drop`/`clipboardMatch`/`shortcut`, and `uuid` crate `1.24` with
  `["v4","v7","std"]` all match the Dev Notes exactly.

## Kept — no material change

- **v4 and v7 only.** v4 = `Uuid::new_v4()` per element; v7 = one shared `ContextV7` for the
  whole batch (strictly increasing within a `generate()` call; no cross-call ordering guarantee —
  documented in the fn's doc comment). No other versions (see **Cut**).
- **Single or bulk, 1000 cap kept as-is, with the full per-row result list.** Generation itself
  is microseconds per UUID and `count` is a `u32` (serialisation ceiling ~4.29 billion) — neither
  is the binding constraint. The binding constraint is the DOM: the view renders every result as
  a row with its own copy button, and ~1000 rows is the honest ceiling for that without adding
  list virtualisation (`@tanstack/vue-virtual`, already a dependency for the JSON tree) or
  collapsing the list to a summary past ~50 rows. Both were considered and **deliberately not
  done** — no evidenced need for a GUI to emit more than 1000, and nobody reads UUID number 782.
- **Per-row Copy + Copy-all** (newline-joined, shown only when `results.length > 1`).
- **Version radio clears a stale result on switch** (`watch(version, …)` — Story 2.3's original
  AC3): a list generated under the previous version no longer matches the selected version until
  the next Generate.
- **Client-side input-shape guard** (`MAX_COUNT = 4294967295` = `u32::MAX`): rejects
  non-integer / negative / `> u32::MAX` before `invoke` via `t("tools.uuid.countOutOfRange")`.
  `0` and `1..=u32::MAX` pass through to the server. This is deliberately **distinct** from the
  server's `MAX_COUNT: u32 = 1000` business cap — the client rejects only what can't round-trip
  cleanly; the server owns the real limit.
- **Server-side rejections** `uuid-count-zero` (count 0) and `uuid-count-too-large` (count >
  1000), both `position: None`.
- **v7 batch monotonicity** via the shared `ContextV7`.
- **8 core unit tests + 5 command tests + 10 `UuidView.spec.ts` tests** — re-verified and
  extended by Task 2, not replaced (or knowingly rewritten only where a later AC forces it, and
  that recorded in the AC, per Story 8.2's AC14 precedent).
- **The `uuid` registry entry** (`src/stores/registry.ts` ~line 106) — no `drop`, no
  `clipboardMatch`, no `shortcut`; `icon: "uuid"` → `PhFingerprint`. Untouched. Adding a
  `clipboardMatch` for Story 7.8's clipboard-suggestion surface remains a **shell concern**
  (AD-6), explicitly out of this story's scope.

## Changed — interaction / presentation, not capability

None of these is a new transformation; they reshape how the existing capability is presented.

- **Enriched single view.** A designed screen — integrated format control, a proper results
  panel, copy affordances matching the icon style JSON and Base64 use — not just a token swap on
  the current flat vertical stack. Lighter than Base64's enrichment (which was earned on
  *capability* — two alphabets, data URIs, blob previews); UUID's is earned on *presentation* —
  the format-toggle set, the download action, the restyled results panel.
- **`AppTabs.vue` is deliberately NOT used.** Story 8.1's own discipline, held in 8.2: don't add
  tabs to a single-job tool. UUID has one job (generate). An inspector *would* have been the
  second job that justifies tabs — it was cut (see **Cut**).
- **Per-row Copy restyled** from `<AppButton>` → the ~24 px icon-button + `useCopyFeedback`
  pattern (`JsonTree.vue` / `Base64View.vue`): signature-accent "copied" state, no separate
  success colour. (The Dev Notes' "bare `<button>`" premise is stale — see **Drift**.)
- **Full Epic-7 tokenisation pass** (the tool is 100% pre-Epic-7): `p[role="alert"]`'s hardcoded
  `#b00020` → `--color-accent-destructive` (matching `JsonView.vue` / `Base64View.vue`);
  `--font-code-*` for the result `<code>`; `--radius-*` / `--spacing-*` for all layout margins
  and gaps. `src/styles/base.css` already gives the bare number-input its token border and
  focus-visible ring — don't re-style what it covers.
- **Inline version taglines** — `v4 · random`, `v7 · time-ordered` — rendered beside / under
  each radio label, **no hover**. Every competitor's radios (and ours today) are labelled just
  "v4"/"v7", which explains nothing to a user who doesn't already know. The deeper "when do I
  pick which one" explainer is delivered by the new `Popover` component — see **Added** item 3
  (folded into this story 2026-08-30 at the developer's direction; was previously scoped as a
  separate story).

## Added — the redesign's real new scope

1. **Output format toggles** *(new)* — `lowercase` / `UPPERCASE` / `{braces}` / `no-hyphens`,
   composing where sensible (braces + uppercase, hyphenless + uppercase). **All are view-side
   string transforms** on core's canonical lowercase-hyphenated output — AD-1: presentation
   formatting is view-owned, never a core function. Evidenced by the sweep: guidgenerator.com
   centres its whole UI on exactly this set, and "No hyphens → compact 32-char hex" is a common
   option. The **affordance** (segmented control vs. a case toggle + a `{}`/`-` pair vs. a
   dropdown) and whether it is a **persisted `uuid.*` setting** (AD-10) are design-canvas
   questions — the developer flagged "the UI and the UX better be good."
2. **Download bulk output to a file** *(new)* — a "Download" action on the results panel writing
   the generated list (newline-joined `.txt`; `.csv` / `.json` optional, a design-canvas call)
   via `@tauri-apps/plugin-dialog`'s `save` (already a dependency — Base64 uses it) plus either
   a thin new `uuid_<verb>` command or a generic fs-write helper (AD-15 — `umbra-core` never
   touches the filesystem). Evidenced: uuidtools.com and others offer "download the list."
   **No `umbra-core` change** — the list is already `Vec<String>`.
3. **A shared `Popover.vue` component + a `?` version explainer** *(new — folded in 2026-08-30
   at the developer's direction; previously scoped as a separate story)*:
   - **`src/components/Popover.vue`** — a **general reusable** floating surface (developer's
     explicit choice over a UUID-local affordance), sitting alongside `AppButton.vue` /
     `AppTabs.vue`. It is the **first floating surface in the app**: `Esc` and click-outside
     dismissal, focus returns to the trigger on close, positioned relative to its trigger,
     styled with DESIGN.md's `floating-surface` tokens (currently flagged `[ASSUMPTION]` /
     "never independently tested on an actual modal/popover mock" — building this *is* that
     test; the slice-1 render review gets an explicit light **and** dark check on the surface,
     since the dark token is a rim-glow, not a drop-shadow).
   - **A `?` trigger on the version selector** opening that Popover with the "when do I pick v4
     vs v7" comparison. The AD-9 honesty-bar objection to a `?` (raised earlier in discovery —
     "a `?` that opens nothing is dishonest") is resolved because it now opens real content.
     Story 8.3 ships **inline taglines *and* a working `?`**.
   - **Governance (`CLAUDE.md` — shared UI doesn't inherit patterns automatically):** the
     component's **public API and interaction contract are presented as options with
     trade-offs** in Task 2a before implementation, and checked against the project's patterns
     (the component lives in the existing repo under existing CI and the `type(scope): subject`
     convention — this is a "new shared component" check, lighter than the Story 5.4 "new repo /
     new deploy target" case, but still explicit, not assumed).
   - First consumer wired in this story = the version `?`. Other tools (Hash algorithm picker,
     Base64 alphabet toggle, cron mode switch) adopt it in their own later work.
   - **No `umbra-core` change** — Vue + CSS only.

### Container shape — enriched single view

- **Chosen — enriched single view.** A design canvas of 2–3 layout options (format-control
  placement, results-panel treatment, the download action) will be published as an Artifact for
  the developer to pick, per the Story 8.2 precedent.
- **Rejected — tabs (`AppTabs.vue`).** One job. The 8.1/8.2 rule: no tabs on a single-job tool.
- **Rejected — flat re-token only.** The format-toggle set + download + restyled results panel
  are enough designed surface to warrant a real layout pass, not just swapping hardcoded values
  for tokens.

## Cut — considered, explicitly rejected, backlog candidates (FR35)

**The developer is filing these issues themselves** (2026-08-30) — the drafted bodies below were
handed over in the dev-story session. Filed as individual, max-context GitHub issues on
`dipaneb/umbra`, `backlog-candidate` label (the project's idea-capture convention — cf. issues
#113–#116), each linking back to this record. Issue numbers to be backfilled here once created.

1. **v1 / v6 UUIDs (time-based, sortable).** `uuid` 1.24 supports both behind Cargo features.
   Need a `ContextV1` and a node-id decision (random vs. fixed). A small config surface and real
   work, with near-zero evidenced demand for this app's audience. *Rejected: cost without a
   demonstrated need.*
2. **v3 / v5 UUIDs (namespace + name, deterministic hashes).** A genuinely different UI shape —
   two text inputs (namespace + name) plus a namespace picker (`DNS` / `URL` / `OID` / `X500` /
   custom UUID). Not "another radio," a distinct mode. *Rejected: different tool shape, no
   evidenced need.*
3. **UUID inspector / paste-a-UUID + version / variant / timestamp decode.** Pitched in the room
   as "teaching by doing" — generate a v7, see its decoded timestamp underneath. Cut because
   (a) per-row it is 2×N lines at bulk (200 lines for 100 UUIDs, 2000 at the cap), (b) "only when
   count == 1" is a forgettable special case, (c) the developer does not reach for UUID
   inspection in real life. A dedicated inspector (paste field + decode panel) is a separate
   tool/story if evidenced demand appears. *Rejected: clutter at bulk, no personal-use signal.*
4. **Adjacent ID formats — ULID / nanoid / CUID.** Not UUIDs; outside FR13. A "modern IDs" tool
   is its own thing. *Rejected: out of scope for a UUID tool.*

### Drafted issue bodies (for `gh issue create` on approval)

> **Title:** Backlog candidate: UUID v1 / v6 (time-based, sortable)
> **Body:** Surfaced and cut during Story 8.3's UUID Generator scope discovery (see
> `_bmad-output/implementation-artifacts/8-3-uuid-decision-record.md`). Idea: add UUID v1
> and/or v6 generation. The `uuid` crate (1.24, already a dependency) supports both behind
> `v1` / `v6` Cargo features. Needs a `ContextV1` and a node-id decision (random vs. a fixed
> configured value) — a small config surface, plus a `UuidVersion` enum arm and the
> `src/tools/uuid/uuidVersion.ts` hand-synced mirror per added version. Cut from the 8.3
> redesign: real work, near-zero evidenced demand for this app's audience (v4 covers "just
> need an ID", v7 covers "sortable"). Revisit only if a concrete recurring need appears. FR35.

> **Title:** Backlog candidate: UUID v3 / v5 (namespace + name)
> **Body:** Surfaced and cut during Story 8.3's UUID Generator scope discovery (see
> `8-3-uuid-decision-record.md`). Idea: deterministic namespace-and-name UUIDs (v3 = MD5,
> v5 = SHA-1). Unlike v4/v7 this is a different UI shape — two text inputs (namespace + name)
> and a namespace picker (`NAMESPACE_DNS` / `URL` / `OID` / `X500`, or a custom UUID) — not
> another radio option. Behind the `uuid` crate's `v3` / `v5` features. Cut from the 8.3
> redesign: distinct mode, no evidenced need. If it lands it is its own panel/mode, designed
> for the namespace+name flow. FR35.

> **Title:** Backlog candidate: UUID inspector (paste a UUID → version / variant / timestamp)
> **Body:** Surfaced and cut during Story 8.3's UUID Generator scope discovery (see
> `8-3-uuid-decision-record.md`). Idea: a paste field that decodes an existing UUID — its
> version and variant, and for v1/v6/v7 the embedded timestamp rendered in plain language
> ("created 2026-08-30 14:23:07 UTC"). Deterministic parsing, no AD-13-style "guess" exception
> needed. Cut from the 8.3 redesign: an inline per-result reading is 2×N lines at bulk (2000
> at the 1000 cap), a "only when count == 1" special case is forgettable, and the developer
> does not inspect UUIDs in real life. A standalone inspector tool (own paste input, own
> decode panel, possibly its own registry entry) is the right home if evidenced demand
> appears. FR35.

> **Title:** Backlog candidate: adjacent ID formats (ULID / nanoid / CUID)
> **Body:** Surfaced and cut during Story 8.3's UUID Generator scope discovery (see
> `8-3-uuid-decision-record.md`). Idea: generate ULID / nanoid / CUID alongside UUIDs — the
> sweep found several online generators bundling them. Cut: these are not UUIDs and fall
> outside FR13; a "modern IDs" tool is a separate concept with its own dependencies and its
> own registry entry. FR35.

## FR13 revision

Epic 8's preamble makes this revision the story's own output, not a prediction locked in
advance.

- **FR13** — "Generate UUIDs v4 and v7, single or in bulk (up to 1000), with one-click copy."
  **Kept accurate, expanded.** v4/v7, bulk ≤ 1000, and one-click copy are all unchanged. Expand
  the wording to cover: **output format options** (case, braces, hyphens), **bulk download to a
  file**, and **inline version guidance** (the inline taglines plus a `?` explainer backed by
  the new shared `Popover` component — all in this story's scope). Final FR numbering / wording
  in `epics.md` is the PM's call, not this record's — stated here as the story's actual scope
  addition, per Epic 8's own preamble.

## AD-1 functional-core split

**The cleanest split in Epic 8: `umbra-core` is untouched** — the new `Popover.vue` shared
component does not change that (Vue + CSS in `src/components/`, no Rust, no command).

- **Survives as-is in `crates/umbra-core/src/uuid.rs`:** `enum UuidVersion { V4, V7 }`
  (`#[serde(rename_all = "snake_case")]`), `const MAX_COUNT: u32 = 1000`,
  `generate(version, count) -> Result<Vec<String>, ToolError>`, the `uuid-count-zero` /
  `uuid-count-too-large` errors, the v4 per-element `Uuid::new_v4()`, the v7 shared-`ContextV7`
  batch, all 8 unit tests. **No new pure functions.**
- **`src/tools/uuid/uuidVersion.ts`** (the hand-synced `"v4" | "v7"` mirror) — **unchanged**;
  the version set is unchanged.
- **`crates/umbra-core/Cargo.toml`** `uuid` features (`["v4", "v7", "std"]`) — **unchanged**.
- **`src-tauri/src/commands/uuid.rs`** (`uuid_generate`, `spawn_blocking`, `map_join_error` →
  `uuid-internal`) — **unchanged**, unless the bulk-download write is placed here. If so it is a
  new `uuid_<verb>` command (`spawn_blocking`, `Result<T, ToolError>`, AD-3 / AD-4) that writes
  the already-generated list to a path via the fs helper (AD-15 — `umbra-core` never touches the
  filesystem); the alternative is `@tauri-apps/plugin-dialog` + a generic fs-write from the
  view. **Task 2's call** (see open items).
- **Every format toggle is a view-side `String` transform** on core's canonical
  lowercase-hyphenated output — uppercase, `{braces}`, hyphenless, and any `urn:uuid:`-style
  prefix if ever added are all `UuidView.vue` string ops, never core functions. Core returns the
  canonical form; the view formats it. Only genuinely new *generation* logic (more versions,
  namespace hashing) or a *parser* would be new core work — and both are cut.
- **Net:** the story is `src/tools/uuid/UuidView.vue` + `src/tools/uuid/UuidView.spec.ts` +
  `src/locales/{en,fr}.json` + the three deferred-work fixes + **a new
  `src/components/Popover.vue` (+ its spec)** wired to the version `?`, plus at most one thin
  new command for the download.

## Deferred-work fixes folded into Task 2

Logged from Story 2.3's code review (`_bmad-output/implementation-artifacts/deferred-work.md`
lines 74–82). Task 2 folds in the UUID-specific ones rather than re-deferring — re-read that
file's UUID block before Task 2b.

- **`role="status"` / `aria-live="polite"` on the results list** so a successful batch render is
  announced to a screen reader (errors already get `role="alert"`).
- **Disable the Generate button while a batch is in flight** so rapid clicks don't stack
  `spawn_blocking` tasks.
- **The hardcoded `#b00020` alert colour → `--color-accent-destructive`** — already covered by
  the tokenisation pass.
- The other `deferred-work.md` UUID items (unguarded concurrent Copy / Copy-all) — assess and
  fold in during Task 2 rather than re-deferring.

## i18n / AD-13 finding

UUID has no natural-language grammar (unlike NL→cron), so **no AD-13-style disclosed exception
is needed** — French rides the existing `vue-i18n` seam like every other tool. New strings are
ordinary `tools.uuid.*` keys with `en` + `fr` entries (guarded by `src/locales/locales.spec.ts`,
which runs every message through vue-i18n's real compiler — reach for the `{'{'}` / `{'}'}`
escape proactively for any string showing literal `{braces}` UUID syntax).

New keys expected: the two version taglines, the format-toggle labels + a group legend, the
download button/label, the results-list announcement text, the `?` trigger's accessible label,
and the **v4-vs-v7 comparison copy shown inside the Popover** (a short "when do I pick which"
explanation — Paige drafts it; any literal `{braces}` in it needs the escape).

**`src/shell/toolError.ts`'s `TRANSLATABLE_CODES` is not extended by this story.** Unlike
Stories 8.1 (`json-*`) and 8.2 (`base64-*`), Story 8.3 adds **no new `umbra-core` error paths** —
format transforms cannot fail, and a download failure surfaces as a generic filesystem error or
`uuid-internal`. `uuid-count-zero` stays the lone `uuid-*` entry (its historical first entry);
`uuid-count-too-large` stays out (it embeds the runtime count in prose); `uuid-internal` stays
out. The pre-existing `tools.uuid.countOutOfRange` client guard is a plain `t()` call, correctly
**not** a `ToolError` code — unchanged.

## Open items Task 2 still owns (not decided here)

- The **`Popover.vue` public API and interaction contract** — presented as options with
  trade-offs in Task 2a per `CLAUDE.md`'s shared-UI governance rule (trigger model:
  click vs. click-or-hover; content: slot vs. text prop; positioning: fixed side vs. auto-flip;
  whether it also covers a future modal/tooltip or stays popover-only). Plus: validate DESIGN.md's
  `floating-surface` light **and** dark tokens on the real surface during the slice-1 render
  review (they are flagged `[ASSUMPTION]`).
- The **`?` trigger placement** on the version selector (per-radio vs. one on the fieldset
  legend — leaning one on the legend, since the question is comparative).
- The **format-control affordance** (segmented control vs. case toggle + `{}`/`-` pair vs.
  dropdown), whether the toggles **compose** or are **mutually-exclusive presets** (leaning
  compose), and whether format is a **persisted `uuid.*` setting** (AD-10) or a per-session
  control. Resolve via the design canvas.
- The **download format(s)** — `.txt` only, or `.csv` / `.json` too — and whether the write goes
  through a new `uuid_<verb>` command or `@tauri-apps/plugin-dialog` + a generic fs-write
  (AD-15).
- The **enriched view's exact layout** — published as an Artifact design canvas for the
  developer to pick (Story 8.2 precedent).
- Whether the **per-row Copy → icon-button restyle** also hoists `useCopyFeedback` from
  `src/tools/json/` up to `src/shell/` (Base64 imports it cross-tool with a hoist-candidate
  comment — not done speculatively; Task 2's call if a third consumer tips it).
- The real **Given/When/Then acceptance criteria** for taglines / format toggles / download /
  the three deferred fixes — that is **Task 2a**, run in the same `bmad-party-mode` room, scoped
  strictly to this record.
