---
baseline_commit: b357aff
---

# Story 8.1: Reimagine the JSON Formatter/Viewer

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the developer,
I want to reconsider the JSON Formatter/Viewer's feature set through open discovery before redesigning its UI,
so that the redesign reflects a deliberately chosen scope, not a visual reskin of whatever shipped first.

## Acceptance Criteria

**This story ships in two gated tasks (epics.md's own shared Epic 8 shape). Task 1's ACs below are real and testable now. Task 2 (redesign) has no ACs yet — writing them before Task 1's decision record exists would be fiction, per epics.md's explicit instruction — they are added to this story file as a follow-up edit once Task 1 completes, not fabricated here.**

1. **Given** open scope discovery is run for the JSON tool (`bmad-party-mode`, or `bmad-forge-idea` for a narrower pressure-test), framed explicitly as reconsidering the tool's scope from first principles, **when** discovery concludes, **then** a written decision record exists stating what is kept, cut, and added relative to today's shipped implementation (format/minify with 2-space/4-space/tab indentation, syntax validation with line/column error position, a collapsible virtualized tree view, paste/copy), with rationale for each call — the existing implementation is reference only, not a decision to preserve by default.
2. **Given** the decision record, **when** it is produced, **then** it states which of FR6–FR9 remain accurate, which are revised, and which are newly added — Epic 8's own preamble makes this revision each story's own output, not predicted in advance.
3. **Given** any idea considered and cut during discovery, **when** the decision record lands, **then** it is added to the public backlog (FR35) as a candidate — the same disclosure discipline Story 6.3's own AC established for its FR29 decision, not silently dropped.
4. **Given** the chosen scope, **when** the decision record completes, **then** it states which parts of the existing `crates/umbra-core/src/json.rs` functional core survive as-is (AD-1: core owns every transformation) versus which need new pure functions — Task 2 builds directly on this split.
5. **Given** Task 1 has not yet produced its decision record, **when** this story starts, **then** Task 2 (redesign, and its own Given/When/Then acceptance criteria) has not begun — no implementation starts before the decision record exists.

## Acceptance Criteria — Task 2 (Redesign)

Written 2026-08-24 via `bmad-party-mode` (same room as Task 1), scoped strictly to
`8-1-json-decision-record.md`. Two items the decision record left open for this task are
resolved here: **Repair ships as its own tab**, cross-linked from Validate's error state
(not merged into Validate — different interaction model, preview-then-confirm needs its
own real estate); **Query speaks JSONPath (RFC 9535)** via the `serde_json_path` crate,
chosen for spec standardization, direct compatibility with the existing `serde_json::Value`
core type, and consistency with Explorer's own copy-JSONPath output (JMESPath rejected —
would produce a query syntax Explorer's copied paths can't paste into).

6. **Given** the redesign lands, **when** the JSON tool renders, **then** a persistent
   input panel (the paste target, Format, Minify, and an indentation picker) sits above six
   tabs — Explorer, Validate, Repair, Query, Diff, Transform — using `DESIGN.md`'s Tab
   component (`{colors.accent-default}` underline/pill for the active tab,
   `{colors.text-secondary}` for inactive tabs); every tab reads that one shared input
   document (Diff alone also owns a second, tab-local document for the comparison side),
   and each tab name answers a distinct job a user could name. **Behavior change from
   today, resolved in this AC-writing session:** Format/Minify now rewrite the shared input
   in place rather than populating a separate output box — the old two-textarea
   input/output split doesn't compose with six tabs each deriving their own view from one
   document, so it's retired. **Revised again after a design-review pass with the
   developer (2026-08-24, post-implementation):** the toolbar's generic Paste and Copy
   buttons are cut, not kept — a developer audience already reaches for Cmd+V/Cmd+C, Copy
   in particular lost its one clear job once there was no separate output box to copy
   *from*, and each tab will own its own precise copy action instead (Explorer's
   value/path copy already does; Query/Diff/Transform will need their own). Indentation
   drops the three-way radio group (its own full row) for a compact `<select>` inline next
   to the buttons — a pick-once, rarely-revisited setting doesn't earn a whole row, and
   only Format reads it at all (Minify ignores indentation). Neither Format nor Minify
   gets `AppButton`'s `primary` (orange) variant: DESIGN.md reserves that color for one
   true signature action per screen, and a six-job tool no longer has a single action that
   qualifies — both stay `default`, consistent with Hash/UUID's own Compute/Generate
   *not* being the pattern to copy here (those tools genuinely have one signature verb;
   JSON doesn't anymore).
7. **Explorer** — **Given** valid JSON is loaded, **when** the user interacts with the
   Explorer tab's tree, **then** they can inline-edit values (add/remove/move/duplicate
   fields), search/filter the tree by key or value, and click a node to copy either its
   value or its JSONPath (e.g. `$.data[3].user.email`) — extending FR8 from a read-only
   view to an editable one.
8. **Validate** — **Given** malformed JSON is submitted, **when** validation fails, **then**
   the tool surfaces a specific, rewritten failure message (not `serde_json`'s generic text
   passed through unchanged) with line/column position; that message's error code is
   registered in `TRANSLATABLE_CODES` (`src/shell/toolError.ts`, currently zero `json-*`
   coverage) so French renders correctly; any runtime value embedded in the message (byte
   count, token) is carried in a structured field, never baked into the translated string;
   and the error state offers a "Try Repair" action that switches to the Repair tab with the
   same input carried over.
9. **Repair** — **Given** malformed JSON that fixable heuristics can address
   (trailing/missing commas, single quotes, unquoted keys, JS-style comments, unclosed
   brackets), **when** the user opens the Repair tab (directly or via Validate's cross-link),
   **then** the tool shows a preview of the proposed fix with a per-change description before
   anything is applied, and the original input is only modified after an explicit confirm —
   never silently auto-applied (AD-9, `EXPERIENCE.md` honesty bar).
10. **Query** — **Given** valid JSON is loaded, **when** the user enters a JSONPath
    expression (RFC 9535) in the Query tab, **then** the tool evaluates it via
    `serde_json_path` against the parsed document and displays the matching node(s), with an
    invalid expression surfaced as a clear error rather than a silent empty result.
11. **Diff** — **Given** two JSON documents, **when** the user opens the Diff tab, **then**
    the tool computes a structural diff (not a text/string diff) between them and renders it
    as tree-mode highlighting of additions, removals, and changes, reusing `JsonTreeValue`'s
    existing order-preserving, exact-text-number representation for both sides.
12. **Transform** — **Given** valid JSON is loaded, **when** the user opens the Transform
    tab, **then** the tool generates a TypeScript interface reflecting the document's shape;
    no other target language ships in this story (Go/Python/YAML/CSV remain explicitly
    deferred as their own later decision).
13. **Given** the redesigned tool renders, **when** its panels, tabs, and controls are
    styled, **then** they consume Epic 7's token system (`--font-code-*` for
    input/output/tree/query panels per `DESIGN.md`'s `{typography.code}` role;
    `--color-*`/`--radius-*`/`--spacing-*` elsewhere) instead of the tool's remaining
    hardcoded hex values (`#d1d5db`, `#6b7280`, `#b00020` — `#2563eb` already tokenized by
    PR #104).
14. **Given** any new tab performs non-trivial computation (repair, query, diff, transform),
    **when** that command runs, **then** it dispatches via `spawn_blocking` (AD-4) and is
    invoked through its own `createLatestWinsRunner()` scope for its independent state group
    (AD-16) — not sharing the existing Format/Minify/Paste or live-tree-parse runners — and
    its latency against a 10 MB document is sanity-checked against Story 1.9's ~440–540 ms
    baseline before shipping.

## Tasks / Subtasks

- [x] **Task 0: Branch setup (AC: all)** — complete 2026-08-24.
  - [x] Confirmed `baseline_commit` (`b357aff`) is still `origin/main`'s real tip.
  - [x] `git checkout -b feat/story-8-1-reimagine-the-json-formatter-viewer origin/main` — this is the branch every subsequent commit has landed on.

- [x] **Task 1: Discovery — produce the decision record (AC1–4)** — complete 2026-08-24, see `8-1-json-decision-record.md`.
  - [x] Run `bmad-party-mode` (recommended default — a full multi-persona roundtable matches the weight of "reconsider this tool's scope from first principles"; fall back to the narrower `bmad-forge-idea` only if a lighter pressure-test is preferred at execution time) framed explicitly as: *open scope discovery for the JSON Formatter/Viewer — the existing implementation is reference only, not a scope to preserve.*
  - [x] Feed the session the current, real state so it starts from fact, not assumption (all confirmed by direct read this drafting session, see Dev Notes): format/minify with 3 indent modes; syntax validation surfacing `ToolError`'s `LineCol` position; a collapsible, keyboard-navigable, virtualized tree view (`@tanstack/vue-virtual`); a 100 MB input cap plus reliance on `serde_json`'s 128-level recursion limit as CWE-400 guards; paste/copy via the shared clipboard service; zero token-system styling yet (hardcoded hex colors, untouched by any Epic 7 story).
  - [x] Ground the session in what Epic 7 already locked — `DESIGN.md`/`EXPERIENCE.md`'s precision-instrument register, the `{typography.code}` (Geist Mono) role named by `DESIGN.md` as serving exactly this tool's output, and the Card/token system — so the redesign direction composes with what's already committed, not invented independently of it.
  - [x] Produce the written decision record satisfying AC1–3: what's kept/cut/added and why, the FR6–FR9 revision, and a public-backlog entry for anything cut. Saved to `_bmad-output/implementation-artifacts/8-1-json-decision-record.md`.
  - [x] Record the AD-1 functional-core split satisfying AC4: which of `format`/`minify`/`parse`/`JsonTreeValue` survive unchanged versus what new pure functions `crates/umbra-core/src/json.rs` needs. See decision record's "AD-1 functional-core split" section.

- [x] **Task 2a: Redesign ACs — write real Given/When/Then (AC6–14)** — complete 2026-08-24
      via `bmad-party-mode`. Both items the decision record left open are resolved: Repair
      is its own tab (cross-linked from Validate), Query speaks JSONPath (RFC 9535) via
      `serde_json_path`. See "Acceptance Criteria — Task 2 (Redesign)" above.
- [ ] **Task 2b: Redesign — implementation (AC6–14)**
  - [x] Build the six-tab shell (Explorer/Validate/Repair/Query/Diff/Transform) — new
        `src/components/AppTabs.vue` (DESIGN.md's Tab component, first real consumer;
        full WAI-ARIA tablist keyboard pattern), mounted in `JsonView.vue` above six
        `role="tabpanel"`s. Only Explorer renders real content; the other five render an
        honest `tools.json.comingSoon` placeholder (AD-9) until their own slices land.
        Consumes Epic 7's token system throughout (`--color-*`, `--font-code-*` for the
        input textarea, `--radius-*`, `--spacing-*`) — including the three hex values the
        decision record flagged as still-untokenized (`#d1d5db`→`--color-border-hairline`,
        `#6b7280`→`--color-text-secondary` in `JsonTree.vue`, `#b00020`→
        `--color-accent-destructive` in `JsonView.vue`); `#2563eb` was already tokenized
        by PR #104. **Behavior change (AC6):** Format/Minify now rewrite the shared input
        in place; the old separate output textarea is retired.
  - [x] Design-review pass with the developer (2026-08-24, after first seeing the shell
        rendered) — caught three reflexive-copy mistakes worth fixing before they set a
        pattern for the other five tabs: Format/Minify had been given `AppButton`'s
        `primary` (orange) variant by copying Hash/UUID's shape without checking that
        DESIGN.md reserves that color for one true signature action, which a six-job tool
        no longer has (**fixed:** both now `default`). The three-way indent radio group
        (its own full row) became a compact `<select>` inline with the buttons — a
        pick-once setting that only Format even reads didn't earn a whole row, doubly so
        with six tabs competing for vertical space. The generic Paste/Copy buttons are
        **cut**: this audience already uses Cmd+V/Cmd+C, and Copy specifically lost its
        one clear referent once there was no separate output box to copy *from* — each
        tab will own its own precise copy action going forward (Explorer's already does).
        Textarea gained a `min-width`/`max-width` instead of unconstrained full-bleed.
  - [x] Tree visual redesign, same design-review pass, after the developer saw a real
        populated tree (verified via a local IPC-mock injected into the live dev server,
        since the tree can't render without a real `json_parse` backend). The prior look
        had no expand/collapse affordance beyond an ARIA attribute invisible to sighted
        users, no indentation guide lines, "Value"/"Path" text buttons unstyled and pushed
        to the far edge of an unbounded-width panel, and the "{N keys}" collapsed summary
        rendered identically to a real leaf value. Rebuilt: a `PhCaretRight`/`PhCaretDown`
        chevron per expandable row (Phosphor, matching `AppSidebar.vue`'s own existing
        collapse-icon convention — not invented fresh), a fixed-width chevron column so
        leaf and expandable rows still align, per-depth indentation guide lines via a
        `repeating-linear-gradient` background (derived from `--color-text-secondary` at
        25% via `color-mix()` — `--color-border-hairline`'s 7% is real but tuned for a
        *decorative* card edge per DESIGN.md's own documented trade-off, too faint for a
        *functional* wayfinding line), the collapsed summary restyled muted+italic to read
        as metadata rather than content, row hover highlighting, and "Value"/"Path" text
        buttons replaced with compact icon-only buttons (`PhCopySimple`/`PhLink`,
        `aria-label` unchanged) that only need to fit an icon, not a word. The tree panel
        also gained the same `max-width: 70em` as the input textarea, so its far-right
        actions don't drift away from the row's text on a wide screen.
  - [x] Explorer, first slice (AC7, partial) — click-a-node-to-copy: `JsonTree.vue` gained
        per-row copy-value/copy-path icon buttons (new `jsonPathFromSegments` in
        `jsonPath.ts`, RFC 9535 dot/bracket notation matching the Query tab's own future
        expression language; new `jsonTreeValueToText` in `jsonTreeValue.ts` for
        compact-JSON value copy). `flattenJsonTree.ts`'s `JsonTreeRow` now carries `value`
        and `jsonPath` per row. Icon size fixed at 24px button/16px icon (independent of
        the tree's small 13px code font, which made the original em-relative sizing
        illegible) and both buttons carry a native `title` tooltip alongside `aria-label`
        — same pattern `AppSidebar.vue`'s nav items already use, no Tauri-specific API
        needed for a hover tooltip, it's plain HTML.
  - [x] Explorer, second slice (AC7) — search by key or value. **First pass filtered the
        tree down to matches plus their ancestors** (hiding everything else) — developer
        feedback: that reads as a DevTools object-preview filter, not the find-in-page /
        find-in-explorer behavior a search bar is actually expected to have. Rebuilt as a
        real find: new `findMatches` in `flattenJsonTree.ts` walks the *entire* tree in
        document order (regardless of current collapse state) and returns every match with
        its ancestor chain; the tree's own visible shape is never touched by searching, only
        by navigating to a match — `goToMatch` expands whatever ancestors of the target
        aren't already open and scrolls to it, leaving every unrelated row exactly as it
        was. A live "`current` of `total`" count sits next to the input with Previous/Next
        buttons (`PhCaretUp`/`PhCaretDown`), Enter/Shift+Enter *and* ArrowUp/ArrowDown all
        cycle matches without moving focus out of the search box (matching a browser's own
        Ctrl+F), and every match wraps around at either end. New `highlightSegments` wraps
        the matched substring in
        `<mark>` within each row's key/preview text (a display-layer concern, deliberately
        decoupled from `findMatches`'s raw-value matching — a row's preview can be truncated
        or JSON-escaped, so highlighting re-scans whatever text is actually on screen rather
        than mapping raw-value offsets onto it). The current match's own highlighted text
        (not the whole row — reworked after developer feedback) gets a stronger, filled
        treatment distinct from every other match's lighter tint. The visible label above
        the input was dropped too (developer feedback: redundant next to a self-explanatory
        placeholder) —
        the input keeps an `aria-label` for a11y. Query input stays debounced (150ms),
        same class of debounce `JsonView.vue` already uses for live re-parsing. **Still
        open, next Explorer slice:** inline editing (add/remove/move/duplicate fields).
  - [x] Add `serde_json_path` to `crates/umbra-core/Cargo.toml`; verify it against the
        RFC 9535 conformance suite it tracks before wiring it into a new query function
        (per this project's standing dependency-verification discipline — Task 2 owns this
        live check, not assumed from Task 1's research). Done 2026-08-26 — see Completion
        Notes for the live verification method (the crate's own daily-scheduled Compliance
        CI job, not just a documentation claim).
  - [x] `crates/umbra-core/src/json.rs`: add `query` (JSONPath via `serde_json_path`) per
        the decision record's AD-1 split, with its own regression tests, sanity-checked
        against the 10 MB / Story 1.9 performance floor (AC14). `repair` was already done
        (see the 2026-08-25 entry above).
  - [x] `crates/umbra-core/src/json.rs`: add `diff` (structural, over `JsonTreeValue`) per
        the decision record's AD-1 split, with its own regression tests, sanity-checked
        against the 10 MB / Story 1.9 performance floor (AC14).
  - [x] `crates/umbra-core/src/json.rs`: add `to_typescript` pure function per the decision
        record's AD-1 split — its own regression tests, sanity-checked against the 10 MB /
        Story 1.9 performance floor (AC14).
  - [ ] Explorer, next (and last) slice: inline editing (add/remove/move/duplicate
        fields) — extends `JsonTree.vue`, keeps its existing path-based focus tracking
        and ARIA tree roles. (Search/filter — the other item this line originally
        listed — is done, see the "second slice" entry above; this is the one thing
        left before Explorer fully satisfies AC7.)
  - [x] Rewrite Validate's error messages, register new `json-*` codes in
        `TRANSLATABLE_CODES` (`src/shell/toolError.ts`), add the "Try Repair" cross-link.
  - [x] Build Repair's preview-then-confirm UI (per-change description, explicit apply step
        — never silent auto-apply).
  - [x] Build Query's expression input + result view over the new `query` command.
  - [x] Build Diff's two-document input + tree-mode highlighted result over the new `diff`
        command.
  - [x] Build Transform's TypeScript-interface output over the new `to_typescript` command.
  - [x] Give each new async command its own `createLatestWinsRunner()` scope (AD-16) and
        `spawn_blocking` dispatch (AD-4) — do not share the existing Format/Minify/Paste or
        live-tree-parse runners.
  - [ ] Implement per AC6–14; run the standard verification pass (`pnpm lint`, `pnpm test`,
        `vue-tsc --noEmit`, `pnpm build`, `cargo fmt --check`, `cargo test --workspace`).
        (Kept open: Explorer's inline-editing slice, line above, is the one
        remaining piece of AC6–14 — this line is the final "everything's in"
        gate, not a per-slice re-check. Every slice, including this one, has
        already run this exact pipeline clean on its own.)

## Dev Notes

- **This is the first story of Epic 8 — and there is no fully-executed precedent for its own shared pattern.** Epic 8's shared story shape explicitly cites "the same decision-story shape Story 6.3 already established for FR29" — but Story 6.3 (`6-3-choose-the-second-ai-feature`) is itself still `backlog`, never executed. This story is the first real attempt at "Task 1 decision record gates Task 2," not a follower of a proven example. Treat Story 6.3's *written* AC shape (epics.md lines 972–991) as the template, not an artifact to consult.
- **Current implementation, read in full this drafting session** — treat as the discovery session's factual starting point, not as this story's own scope:
  - `src/tools/json/JsonView.vue` (278 lines): input/output textareas, Format/Minify/Paste/Copy actions via `runLatestWins`, a 3-way indent radio group, inline `ToolError` display with `errorLocation` (line/col or byte-offset), a separate `runTreeParse` runner powering live debounced tree parsing.
  - `src/tools/json/JsonTree.vue` (216 lines): `@tanstack/vue-virtual`-backed virtualized tree, full keyboard nav (Enter/Space toggle, arrows expand/collapse/move), `role="tree"`/`role="treeitem"` ARIA, path-based (not index-based) focus tracking so collapse/expand never desyncs focus.
  - `jsonTreeValue.ts`, `flattenJsonTree.ts`, `jsonIndent.ts`: small supporting modules for the tree/indent types.
  - `crates/umbra-core/src/json.rs` (397 lines): `format`/`minify`/`parse`, the `JsonTreeValue` wire type (order-preserving `Object(Vec<(String, JsonTreeValue)>)`, exact-text `Number(String)` to survive Tauri IPC without precision loss), a 100 MB `MAX_INPUT_BYTES` cap, and reliance on `serde_json`'s 128-level recursion limit — both CWE-400 guards with dedicated regression tests including a 10 MB fixture.
- **Styling is mostly pre-Epic-7, with one recent exception — re-verify against the live tree before assuming staleness.** PR #104 (`fix(ui): apply design tokens and AppButton consistently across tool views`, merged after this story was drafted, `baseline_commit` bumped to include it) tokenized `JsonTree.vue`'s focus outline (`#2563eb` → `var(--color-accent-signature)`) and added `src/styles/base.css`, a new global base layer (loaded after `tokens.css`) that gives bare `textarea`/`select`/`input` elements a token-driven border and focus-visible ring by default. Neither `JsonView.vue` nor `crates/umbra-core/src/json.rs` was touched by that PR (confirmed via `git diff` against this story's original baseline). Practical effect for Task 2: `JsonView.vue`'s two `<textarea>`s already inherit a real border and focus ring from `base.css` for free — don't re-style what's already covered. What's still genuinely untokenized: `.tree-panel :deep(.json-tree-scroll)`'s `#d1d5db` border (a `div`, outside `base.css`'s element selectors), the tree's `#6b7280` key color, and `p[role="alert"]`'s `#b00020` error red — these three are Task 2's real remaining work, not the whole stylesheet.
- **AD-1 boundary for Task 1 to scope against:** any newly-considered feature that is a pure transformation (e.g. schema inference, diff, query) belongs in `crates/umbra-core/src/json.rs`, not computed client-side in Vue — core returns machine values, the view renders them.
- **AD-4/AD-16 boundary for Task 2:** any new feature with non-trivial CPU cost must dispatch async via `spawn_blocking` (AD-4), and any new slow command must go through `createLatestWinsRunner()`/`runLatestWins` (AD-16) — `JsonView.vue` already uses two separate runner instances (Format/Minify/Paste vs. live tree-parsing) per AD-16's 2026-08-04 amendment on per-independent-state-group scoping. Don't collapse them, and don't add a third runner without first checking whether it's a genuinely independent state group.
- **Performance ceiling already proven — sanity-check against it, don't re-litigate it.** Story 1.9 profiled `json_format`/`json_minify`/`json_parse` against a 10 MB fixture at ~440–540 ms Rust-side (release build), UI staying responsive throughout. Any Task 1 addition that touches this hot path should be checked against this baseline.
- `DESIGN.md`'s `{typography.code}` role (Geist Mono) is named directly against this tool's structured text output — Task 2 should use `--font-code-*` tokens for the input/output/tree panels, not `--font-body-*`.
- Epic 8's preamble states no ordering dependency exists between 8.1–8.9 — this story runs first because the developer chose to, not because the epic requires it.

### Project Structure Notes

- **Likely touched, contingent on Task 1's decision — confirm during Task 2:** `src/tools/json/JsonView.vue`, `JsonTree.vue`, `jsonTreeValue.ts`, `flattenJsonTree.ts`, `jsonIndent.ts`, and their `.spec.ts` files; `crates/umbra-core/src/json.rs` only if Task 1 decides new core transformations are needed.
- **New:** Task 1's decision-record artifact (suggested `_bmad-output/implementation-artifacts/8-1-json-decision-record.md`; exact path is the implementing session's call).
- **Out of scope regardless of Task 1's outcome:** any other tool's files (AD-6, tools are islands) and any shared `src/shell/`/`src/stores/` file beyond what Epic 7 already generalized (`tokens.css`, `icons.ts`) — unless the decision record explicitly justifies a shared-infrastructure change, in which case this project's CLAUDE.md governance-check discipline applies: present it as options with trade-offs to the developer, don't decide it silently.

### References

- [Source: `_bmad-output/implementation-artifacts/8-1-json-decision-record.md` — Task 1's completed deliverable: kept/cut/added scope, the FR6–FR9 revision, the AD-1 core/UI split, and the i18n/AD-13 finding. Task 2 works from this directly.]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 8 preamble and shared story shape (lines 231–243, 1318–1337); Story 8.1 (1338–1340); Story 6.3, the cited (unexecuted) pattern precedent (972–991); FR6–FR9 (40–45); Epic 1's original JSON stories 1.7–1.9 (402–473)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1 (45–49), AD-3 (57–61), AD-4 (63–67), AD-5 (69–73), AD-6 (75–79), AD-16 + its 2026-08-04 runner-scoping amendment (164–175); Stack table's `@tanstack/vue-virtual` row (211); Structural Seed (218–253); Deferred's "JSON tree IPC transfer strategy" and "JSON single-payload strategy profiled" entries (288–289)]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/DESIGN.md` — full token frontmatter (6–113); Typography's `{typography.code}` rationale (154); Do's-and-Don'ts (187–196)]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/EXPERIENCE.md` — Information Architecture three-views table (16–29); Voice and Tone error-message bar (50); State Patterns Error row (71); Accessibility Floor (86–94)]
- [Source: `_bmad-output/implementation-artifacts/7-1-design-tokens-and-icon-system-land-in-the-shell.md` — the token naming convention (`--color-*`, `--font-<role>-family|size|weight|line-height`, `--radius-*`, `--shadow-floating`) Task 2 must consume, not reinvent]
- [Source: `_bmad-output/implementation-artifacts/1-8-inspect-json-as-a-collapsible-tree.md`, `1-9-stay-responsive-on-10mb-documents.md` — original acceptance criteria and the 10 MB performance profile for the tree view Task 1 must treat as reference, not a decision to preserve]
- Live-read this session: `src/tools/json/JsonView.vue`, `JsonTree.vue`, `jsonTreeValue.ts`, `flattenJsonTree.ts`, `jsonIndent.ts`, `crates/umbra-core/src/json.rs` (full contents — confirms current feature set and existing guards before discovery reconsiders them).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

### Completion Notes List

- 2026-08-24: Task 2b, first Explorer slice. Six-tab shell built (`AppTabs.vue` +
  `JsonView.vue` restructuring); Explorer's click-to-copy (value/JSONPath) implemented and
  tested. Format/Minify now rewrite the shared input in place (AC6 behavior change).
  Verification pass run: `pnpm lint`, `pnpm test` (496/496), `vue-tsc --noEmit`, `pnpm
  build` — all clean. No `crates/` files touched this slice, so `cargo fmt`/`cargo test`
  were not run (nothing to check).
- 2026-08-24: Design-review pass, same slice, after the developer saw it rendered.
  Caught reflexive pattern-copying from Hash/UUID that didn't actually fit a six-job tool:
  Format/Minify's `primary` (orange) variant dropped (DESIGN.md reserves that color for
  one signature action; a six-tab tool doesn't have one), indentation radios replaced with
  an inline `<select>`, generic Paste/Copy buttons cut (Copy lost its referent once the
  output box merged into input; Paste is redundant for this audience). Textarea gained
  `min-width`/`max-width`. Re-verified: `pnpm lint`, `pnpm test` (491/491 — 5 fewer than
  the prior pass, all removed Paste/Copy tests), `vue-tsc --noEmit`, visual confirmation
  against the developer's running dev server.
- 2026-08-24: Tree visual redesign, same design-review pass, prompted by the developer
  seeing a populated tree for the first time (no chevrons, no indentation guides, unstyled
  far-right text buttons, collapsed summary indistinguishable from real content). Verified
  visually via a `window.__TAURI_INTERNALS__.invoke` mock injected into the live dev
  server's browser tab — the real IPC backend isn't reachable outside the native Tauri
  window, so this was the only way to see a populated tree without asking the developer
  for a screenshot. Checked in both light and dark mode. Re-verified: `pnpm lint`, `pnpm
  test` (493/493 — 2 new chevron/summary-styling tests), `vue-tsc --noEmit`, `pnpm build`.
- 2026-08-24: Follow-up polish on the same tree redesign, developer feedback on the
  rendered result. Copy icons were unreadable at their original em-relative size (scaled
  against the row's small 13px code font); switched to fixed px (24px button, 16px icon).
  Added `title` attributes to both copy buttons for a native hover tooltip — the codebase
  already has this exact pattern (`AppSidebar.vue`'s nav `:title`), no Tauri-specific API
  needed, it's plain HTML. Guide-line offset corrected from the indent column's raw edge
  to its center, so each line now sits directly under the ancestor chevron it traces.
  Re-verified: `pnpm lint`, `pnpm test` (49/49 for the JSON tool suite), `vue-tsc
  --noEmit`, visual confirmation (icon legibility, `title`/`aria-label` DOM attributes,
  guide-line alignment) against the mocked-IPC dev server tab.
- 2026-08-24: Explorer's second slice — search by key or value (AC7), first pass: a
  filter (hides non-matching rows). New `findMatchingPaths`/`visiblePaths` restriction on
  `flattenJsonTree`. Re-verified: `pnpm lint`, `pnpm test` (503/503), `vue-tsc --noEmit`,
  `pnpm build`.
- 2026-08-24: Same slice, rebuilt after developer feedback that the filter mechanism was
  wrong — expected a standard find bar (highlight in place, Next/Previous, a count), not a
  DevTools-style filter. `findMatchingPaths`/`visiblePaths` removed; replaced with
  `findMatches` (ordered, full-tree, carries each match's ancestor chain) and
  `highlightSegments` (display-layer `<mark>` splitting). `flattenJsonTree` reverted to its
  original two-argument, never-hides-rows signature — searching no longer touches the
  tree's shape, only navigating to a match does. Added a live match-position count,
  Previous/Next buttons, Enter/Shift+Enter cycling with focus staying in the search input,
  and a current-match row outline. Dropped the visible search label per developer feedback
  (redundant next to the placeholder) — kept as `aria-label` only. Verified visually
  against the mocked-IPC dev server tab: multi-match count/navigation, substring
  highlighting, current-match outline moving on Next, unrelated siblings staying visible
  throughout. Re-verified: `pnpm lint`, `pnpm test` (512/512), `vue-tsc --noEmit`, `pnpm
  build`.
- 2026-08-24: Two developer-reported issues on the same find bar. (1) The match-count
  text sat too close to the search input — the input's own focus ring (base.css: 2px
  outline + 2px offset, 4px total) visually overlapped it the moment the input was
  focused. Fixed with real clearance (`margin-left: 0.75em` on a wrapping status group),
  not just a larger token-sized gap. (2) The whole-row outline marking the current match
  read as too heavy-handed; replaced with a two-tier highlight on the matched text itself
  — `.json-tree-highlight` (any match, `color-mix()`-derived low-opacity signature tint)
  vs. `.json-tree-highlight-current` (the current one, solid signature fill + white text,
  reusing `AppButton`'s own already-documented primary-variant treatment rather than
  inventing new contrast). The row-level outline is gone. Re-verified: `pnpm lint`, `pnpm
  test` (512/512), `vue-tsc --noEmit`, `pnpm build`, visual confirmation (ring clearance
  while focused; current vs. other match colors side by side) against the mocked-IPC dev
  server tab.
- 2026-08-24: ArrowUp/ArrowDown added as a second way to cycle matches from the search
  input, alongside Enter/Shift+Enter and the Previous/Next buttons — same direction
  mapping (Down = next, Up = previous). Edge cases worked through explicitly per the
  developer's own ask: a single-line text input has no native behavior bound to either
  arrow key (unlike ArrowLeft/Right, which move the caret), so claiming them is safe; the
  handler is scoped to the search input's own `@keydown`, which is a different DOM element
  from the tree rows' own separate ArrowUp/Down handler for row-to-row focus, so the two
  keyboard systems can't contend for the same keystroke (verified with a dedicated test);
  `goToMatch` already no-ops on zero matches, same guard Enter relies on; held-key
  auto-repeat can't race the async `nextTick()` inside `goToMatch` since browser repeat
  intervals are far slower than a microtask flush; and `autocomplete="off"` was added to
  the input defensively, so a native suggestion dropdown can never intercept the arrow
  keys, even though nothing about this field (no `name`, no prior submissions) was likely
  to trigger one anyway. Nav button tooltips gained a `(↑)`/`(↓)` hint (new
  `explorerPreviousMatchTitle`/`explorerNextMatchTitle` keys, separate from the
  `aria-label` text so screen readers aren't read a glyph). Verified live: ArrowDown/Up
  each move the match count and current-match highlight exactly like the buttons do.
  Re-verified: `pnpm lint`, `pnpm test` (515/515 — 3 new tests: cycling, no-op on zero
  matches, and non-interference with tree row focus), `vue-tsc --noEmit`, `pnpm build`.
- 2026-08-24: Real bug, developer-found: multiple occurrences of the query on a single
  row (e.g. a value like `"banana banana banana"`) were treated as *one* match — the
  count never advanced past it, and the whole-row "current" highlight lit up every
  occurrence on the row at once, not just the one being navigated to. Root cause:
  `findMatches` recorded one `JsonTreeMatch` per matching *row*, while `highlightSegments`
  rendered one `<mark>` per *occurrence* — two different granularities that were never
  reconciled. `JsonTreeMatch` gained `field: "key" | "value"` and a 0-based
  `occurrenceIndex`; `findMatches` now pushes one entry per real occurrence, counted via
  the exact same `highlightSegments` call that renders the marks (so the count reported
  and the marks rendered can never drift apart again). Value occurrences are counted
  against the *displayed* (possibly truncated) text, with a one-occurrence fallback
  preserved for a match hiding entirely inside a truncated tail — the same edge case the
  original highlighting design already accounted for. The view now tracks the current
  match's exact `field`+`occurrenceIndex`, not just its row `path`, so only the one
  targeted `<mark>` gets the "current" treatment even when several sit on the same line.
  Verified live: three `"banana"`s on one row now read "1 of 3", and Next moves the solid
  highlight from the first occurrence to the second without affecting the third.
  Re-verified: `pnpm lint`, `pnpm test` (521/521 — 7 new tests across both files covering
  multi-occurrence counting in keys, values, and both on one row, plus the
  truncated-match fallback), `vue-tsc --noEmit`, `pnpm build`.
- 2026-08-24: Polish — a brief scale-pulse animation on whichever nav chevron fired
  (Previous/Next click or the matching ArrowUp/ArrowDown key), so navigating a match
  feels like it *did* something beyond the count text updating. One shared keyframe
  (`json-tree-nav-pulse`, scale 1 → 1.35 → 1) serves both chevrons rather than mirrored
  up/down variants, since a scale pulse reads as "this fired" regardless of which icon
  it's on. Gated behind `@media (prefers-reduced-motion: no-preference)`.
  Reliably re-triggering a CSS animation on a repeated same-direction press needed real
  care: toggling a class via a plain ref (null → value) doesn't guarantee a restart,
  since Vue's render flush and the browser's paint aren't synchronized with that toggle
  and a fast repeat can coalesce both mutations into one frame. Used `:key` on each
  chevron instead, bumped on every press — Vue destroys and recreates the icon's DOM
  node each time, and a freshly-mounted element always plays its animation from the
  start, with no reflow-forcing or `animationend` bookkeeping needed. Enter/Shift+Enter
  deliberately don't pulse (scoped to "arrow pressed," matching the actual ask), nor
  does the auto-navigate-to-first-match that fires on a fresh query (not a user-pressed
  action). Verified live in a real browser (not just jsdom): the correct single chevron
  gets the class per direction, and a second same-direction press produces a genuinely
  new DOM node (`sameNode: false`), confirming the animation actually replays rather
  than silently no-op'ing on repeat. Re-verified: `pnpm lint`, `pnpm test` (525/525 — 4
  new tests: correct-chevron-only pulsing, keyboard parity, Enter exclusion, and the
  remount-on-repeat guarantee), `vue-tsc --noEmit`, `pnpm build`.
- 2026-08-25: Validate tab (AC8). `crates/umbra-core/src/json.rs`'s
  `map_parse_error` no longer passes `serde_json`'s generic error text through
  unchanged — a new `classify_syntax_error` matches its `Display` output
  (verified directly against the vendored 1.0.151 source, since `ErrorCode` is
  `pub(crate)` and not otherwise inspectable) into 17 specific `json-*` codes
  (`json-trailing-comma`, `json-unclosed-array`, `json-expected-colon`, etc.),
  each with a rewritten English message that no longer duplicates the
  structured `position` field's "at line X column Y" — a display bug that
  existed before this slice, now fixed as a side effect. Every reachable
  `ErrorCode` variant (confirmed reachable by reading `de.rs`; variants only
  reachable when deserializing into a typed struct or numeric-keyed map are
  excluded, since `parse`/`format`/`minify` only ever target `Value`) has its
  own regression test. All 17 codes are registered in
  `src/shell/toolError.ts`'s `TRANSLATABLE_CODES` with new `errors.json-*`
  entries in both locales — closing the "zero `json-*` coverage" gap the
  decision record flagged. `JsonView.vue` gained a real Validate tab panel: it
  reuses the existing live-parse debounce (no new command or runner — this
  isn't new computation, just a second view over the same parse result, per
  AD-16's "genuinely independent state group" test) to show a neutral prompt
  on empty input, "Valid JSON." on success, or the rewritten error plus a "Try
  Repair" button that switches to the Repair tab (input is one shared ref, so
  "carrying it over" is just switching which tab reads it). Caught one design
  issue via the mocked-IPC dev server tab before calling this done: the Try
  Repair `AppButton` inherited `.tab-panel`'s flex-column `align-items:
  stretch` and rendered full-width instead of sized-to-content like
  Format/Minify — fixed with a scoped `align-self: flex-start`. Verified in
  both light and dark mode. Re-verified: `pnpm lint`, `pnpm test` (530/530 —
  5 new tests plus 2 new `toolErrorMessage` unit tests), `vue-tsc --noEmit`,
  `pnpm build`, `cargo fmt --check --all`, `cargo test --workspace` (158/158,
  including the two existing `src-tauri/src/commands/json.rs` malformed-input
  assertions updated from the old generic `json-syntax` code to the new
  specific one).
- 2026-08-25: Repair tab (AC9). New `repair` pure function in
  `crates/umbra-core/src/json.rs` (AD-1) — a single-pass char-by-char
  heuristic scanner (`RepairScanner`) covering exactly AC9's five named
  categories (trailing/missing commas, single quotes, unquoted keys,
  JS-style comments, unclosed brackets), returning a `RepairResult`
  (`repaired`, `changes: Vec<RepairChange>`, `still_invalid`) that only ever
  *proposes* a fix — nothing mutates the caller's input, keeping the
  preview-then-confirm contract honest at the core level (AD-9), not just
  the view. `still_invalid` (re-parses `repaired` internally) is the honest
  signal for input the heuristics can't fully fix — verified with a
  dedicated regression test (a bare `1, 2` at the top level, outside all
  five categories) rather than assumed. 20 new Rust unit tests, one per
  reachable heuristic path plus a combined-categories case, a no-op-on-
  already-valid case, and the size cap. Two real bugs the tests caught
  before I trusted the algorithm: missing-comma insertion was leaving the
  original whitespace in front of the inserted comma (`"1 ,2"` instead of
  `"1,2"`) since whitespace is passed through by the scanner's main loop
  before the comma-insertion branch ever runs — fixed by trimming trailing
  whitespace off the output buffer first; and an unterminated-string test's
  own expected literal was wrong (missed that the outer object was *also*
  still open, since the malformed input's only `}` got consumed as string
  content, not a structural token, so it needs its own closing brace too).
  New `json_repair` Tauri command (`src-tauri/src/commands/json.rs`,
  registered in `lib.rs`) dispatches via its own `spawn_blocking` call
  (AD-4) — measured at 197ms on the 10MB fixture in a release build, well
  inside Story 1.9's ~440–540ms baseline (AC14). `JsonView.vue` gained a
  Repair tab panel with its own `createLatestWinsRunner()` scope (AD-16,
  not shared with Format/Minify/Paste or live tree-parsing) — computed only
  while Repair is the active tab (a `watch([activeTab, input])`, not an
  always-on background watcher like Explorer/Validate, since nothing else
  on screen reads this state) with a 200ms debounce matching the rest of
  the tool. States: a neutral prompt on empty input; "already valid,
  nothing to repair" when heuristics find no changes and the input already
  parses; "no automatic fixes available" when heuristics find nothing to
  change but the input still doesn't parse; and, when there are changes, a
  bulleted per-change description list, a read-only "Repaired preview"
  textarea (`--font-code-*` tokens, dimmed via `--color-text-secondary` so
  it doesn't visually compete with the shared input above it), an honest
  still-invalid note when repair fixed something but couldn't fully
  validate it, and an "Apply repair" button — the only place `repaired`
  ever replaces the shared input, and only on this explicit click. Reused
  the `.tab-action-button` class (renamed from Validate's
  `.try-repair-button`) for the same flex-column full-width-stretch fix.
  New `src/tools/json/jsonRepair.ts` mirrors `RepairChange`/`RepairResult`
  by hand (snake_case field names, matching this codebase's existing IPC-type
  convention, e.g. `ScheduleParseResult.next_runs`) — no i18n coverage for
  per-change `description` text yet (English only; AC9 doesn't require it,
  unlike AC8's explicit `TRANSLATABLE_CODES` ask for Validate — a deliberate
  scope boundary, not an oversight). Verified visually against the
  mocked-IPC dev server tab (change list, read-only preview, Apply
  replacing the input and the tab immediately re-showing "nothing to
  repair", the still-invalid note) in both light and dark mode. Re-verified:
  `pnpm lint`, `pnpm test` (535/535 — 6 new tests), `vue-tsc --noEmit`,
  `pnpm build`, `cargo fmt --check --all`, `cargo test --workspace`
  (255/255: 177 umbra-core + 77 umbra/src-tauri + 1 integration test).
- 2026-08-25: Developer-reported bug, found live in the real Tauri app: the
  Validate tab became permanently unclickable after validating JSON whose
  error happened to be exactly "missing a comma before `}`". Root cause,
  found via the app's devtools console: three `errors.json-*` messages
  (`json-trailing-comma`, `json-unclosed-object`, `json-expected-object-
  separator`) contain a literal `}` describing JSON syntax — but vue-i18n
  treats `{`/`}` as its own interpolation syntax, so a lone unmatched `}`
  isn't plain text to it, it's a message-*compilation* error, thrown the
  first time that specific key is actually rendered (not at build time —
  `pnpm build`/`vue-tsc` never touch message content, only that the JSON
  parses). Ruled out the Rust core first by running the user's exact
  reported input directly through `parse`/`repair` in a scratch test —
  both handled it cleanly, confirming this was purely an i18n string bug.
  Fixed with this codebase's existing `{'}'}` literal-brace escape
  (already used by `tools.json.treeKeysCountOne`). Added a permanent
  regression test to `locales.spec.ts` that runs every message in both
  locales through vue-i18n's real compiler (not a placeholder-regex
  heuristic) — verified it actually catches this class of bug by
  deliberately reintroducing the broken string and confirming the test
  failed with the same "Unbalanced closing brace" error before restoring
  the fix. Re-verified: `pnpm lint`, `pnpm test` (536/536), `vue-tsc
  --noEmit`, `pnpm build`, `cargo fmt --check --all`, `cargo test
  --workspace` (255/255).
- 2026-08-25: Three more developer-reported tweaks, found while confirming
  the fix above. (1) The error message and its `(line X, column Y)`
  position ran together with no space — same root cause class as the i18n
  bug: they were two adjacent text nodes separated only by incidental
  template whitespace, which Vue's whitespace-condensing silently
  collapsed to nothing. Fixed by making the position its own `<button
  class="position-link">` spaced via real CSS `margin-left`, not template
  whitespace — the same category of fix as the i18n one (stop relying on
  incidental text-layer spacing for something that needs to visually
  separate reliably). (2) "The error shows a line and column but the
  textarea has no line numbers or caret position" — scoped this
  deliberately to a caret-jump, not a full line-number gutter (a
  substantially bigger feature — syncing a gutter to a wrapping plain
  `<textarea>` is its own real UI investment, not a quick tweak): clicking
  the position link now moves the textarea's caret to that exact
  line/column and focuses it, so the native caret becomes visible at the
  error site. Deliberately click-triggered, not automatic on every live-
  validate tick — auto-jumping the caret while the user is still typing
  would fight their own cursor position. Applied consistently to all three
  error surfaces (the top Format/Minify banner, Validate, Repair) since
  they're the same bug pattern. (3) The reported example's Repair preview
  squashed `"theme": "dark"` and `"notifications": true` onto one line —
  `maybe_insert_missing_comma`/`strip_trailing_comma` were using
  `trim_end()` (strips *all* trailing whitespace, including a real
  newline) before `truncate`-ing, destroying the original line break and
  indentation whenever the fix happened to span one. Fixed by switching to
  `String::insert`/`String::remove` at the exact content boundary instead
  of truncate-then-append — this splices the comma in (or removes just the
  comma character) without touching any of the whitespace around it, so
  the document's original formatting survives. Two new dedicated
  regression tests reproduce the user's exact multi-line shape for both
  the missing-comma and trailing-comma cases. Re-verified: `pnpm lint`,
  `pnpm test` (539/539 — 3 new frontend tests), `vue-tsc --noEmit`, `pnpm
  build`, `cargo fmt --check --all`, `cargo test --workspace` (257/257: 179
  umbra-core + 77 umbra/src-tauri + 1 integration test). Browser tooling
  was unavailable for a final live visual pass this round — the developer
  should confirm in their running app.
- 2026-08-26: Query tab (AC10). Added `serde_json_path` to
  `crates/umbra-core/Cargo.toml`, live-verified before adopting per this
  project's standing dependency-verification discipline: rather than trust
  the crate's own README/docs claims, checked the actual GitHub repo (`gh
  api`) for its dedicated daily-scheduled "Compliance" Actions workflow
  (`.github/workflows/cts.yml`), which checks out the official
  `jsonpath-compliance-test-suite` as a submodule, updates it to latest, and
  runs `cargo test` against it — confirmed the last 5 daily runs (through
  2026-08-25) all passed on `main`, and that `v0.7.2` (the version this repo
  now depends on) is a real tagged release matching what crates.io serves.
  New `query` pure function in `crates/umbra-core/src/json.rs` (AD-1) —
  parses the document via the existing `parse` (so a malformed document
  surfaces exactly the same classified `json-*` error Validate already
  shows, no separate failure mode needed), compiles the expression via
  `JsonPath::parse`, and evaluates with `query_located` specifically (not
  `query`) so each match carries its own RFC 9535 normalized path alongside
  its value — matching what Explorer's own copy-JSONPath action already
  established as this tool's convention. Two new defensive constants mirror
  `MAX_INPUT_BYTES`'s existing CWE-400 rationale, applied to the two new
  attacker-influenceable-length surfaces Query adds:
  `MAX_QUERY_EXPRESSION_LEN` (10,000 chars) rejects a pathological
  expression before parsing it, and `MAX_QUERY_MATCHES` (1,000) caps how
  many matches get serialized over IPC — a query like `$..*` over a large
  document could otherwise return an enormous match list. Both cap breaches
  are disclosed, never silent: the expression cap returns a distinct
  `json-query-expression-too-long` error, and the match cap sets
  `truncated: true` plus an honest `total` count rather than quietly
  dropping results. 9 new Rust unit tests, including RFC 9535's own worked
  bookstore-filter example from the spec (section 1.5) checked against its
  documented expected result — not assumed from how the crate "should"
  behave — plus a 10 MB sanity check (AC14). New `json_query` Tauri command
  (`src-tauri/src/commands/json.rs`, registered in `lib.rs`) dispatches via
  its own `spawn_blocking` call (AD-4); a 10 MB timing test confirmed it
  stays well inside Story 1.9's ~440-540ms baseline. `JsonView.vue` gained a
  Query tab panel with its own `createLatestWinsRunner()` scope (AD-16,
  computed only while Query is the active tab, same pattern as Repair) — an
  expression `<input>` (font-code, since JSONPath is structured text per
  AC13) above a live-debounced (200ms) result view: a neutral prompt on
  empty input or empty expression, "no matches" for a valid expression with
  zero results (not an error), a match list (path + compact value + a
  copy-value/copy-path icon pair per row, reusing the existing
  `copyValueAriaLabel`/`copyPathAriaLabel` i18n keys and the same
  clipboard-failure-to-alert convention Explorer's tree already established
  rather than inventing a second one), and a truncation notice when
  `truncated` is set. One real design decision worth flagging: an invalid
  expression's error position (`serde_json_path`'s `ParseError.position()`,
  a 1-indexed char offset *into the expression string*) is carried in
  `ToolError.position` as `ByteOffset` and shown as plain text, but
  deliberately NOT wired through the same clickable jump-to-caret button
  Format/Validate/Repair use for their `LineCol` positions — those locate a
  spot in the shared *document* textarea; reusing that button here would
  have moved the wrong text field's caret. When the document itself is
  malformed (not the expression), Query's error state correctly gets the
  clickable jump link, since `query` surfaces that as a real `LineCol`
  document-position error via the same `map_parse_error` path
  Format/Validate/Repair already use — verified with a dedicated test.
  Neither new error code (`json-query-invalid-expression`,
  `json-query-expression-too-long`) was added to `TRANSLATABLE_CODES`: both
  embed a Rust-side runtime value (the crate's own dynamic parser message;
  the expression's actual length) directly into the message string, the
  same documented reason `json-syntax`/`json-input-too-large` are already
  excluded — noted explicitly in `toolError.ts` so this doesn't read as an
  oversight later. Caught one real i18n bug via the existing
  `locales.spec.ts` real-compiler regression test (the same class of test
  written after the brace-escape bug earlier in this story, but for a
  different special character): the placeholder text
  `$.store.book[?@.price < 10].title` (RFC 9535's own worked example)
  failed to compile in both locales with "Invalid linked format" — vue-i18n
  treats a literal `@` as its own linked-message syntax trigger, not plain
  text, the same class of trap as `{`/`}` but a different character; fixed
  with the same `{'literal'}` escape convention already used for braces
  (`{'@'}`). Re-verified: `pnpm lint`, `pnpm test` (547/547 — 8 new
  frontend tests, including one fixing a since-outdated AC6 placeholder-tab
  test that had hardcoded Query as the "coming soon" example), `vue-tsc
  --noEmit`, `pnpm build`, `cargo fmt --check --all`, `cargo test
  --workspace` (267/267: 189 umbra-core + 77 umbra/src-tauri + 1 integration
  test). Browser tooling was unavailable again this round (the Chrome
  extension reported not connected) — no live visual pass was possible; the
  developer should confirm in their running app before this is treated as
  fully done, same caveat as the previous entry.
- 2026-08-26: Copy-confirmation feedback on Explorer's and Query's
  copy-value/copy-path buttons (developer-reported: no indication a click
  did anything). New `useCopyFeedback.ts` composable — a caller-chosen
  string key (e.g. `${row.path}:value`) so several copy buttons on screen
  at once each confirm independently, marked only after the clipboard
  write actually succeeds. Both `JsonTree.vue` and `JsonView.vue`'s Query
  match rows swap the icon to `PhCheck` and the tooltip/aria-label to a
  "copied" variant for 1.5s. One real bug caught before shipping:
  Explorer's copy buttons only reveal on row hover/focus-within
  (`opacity: 0` otherwise) — clicking naturally moves the cursor off the
  row, which would hide the checkmark the instant it appeared; fixed with
  a `.json-tree-row-actions-visible` class driven by the same `isCopied`
  state, forcing visibility for the confirmation's full duration
  regardless of hover. Re-verified: `pnpm lint`, `pnpm test` (551/551 — 4
  new tests), `vue-tsc --noEmit`, `pnpm build`.
- 2026-08-26: Diff tab (AC11). Design decided first via `/design` (Claude
  Design canvas), not assumed: research surfaced the real convention for a
  single-tree structural diff (jsondiffpatch, Postman — whole-row
  tint + inline old→new for a changed leaf) but that convention needs a
  third (green) hue, which collides directly with DESIGN.md's own
  "two-hue system, not a multi-color brand" rule — tested and explicitly
  rejected once already for a different color. Published three color
  propositions (value-only red, icon-only/no new color, full-row
  red+green) as a live side-by-side comparison canvas; the developer
  explicitly chose full-row red+green over the two-hue-compliant default,
  because it reads instantly at a glance. Recorded as a new, narrowly-
  scoped deliberate exception in `DESIGN.md`'s Do's and Don'ts (matching
  its own existing precedent for the Update-signal's red dot) — a new
  `{colors.diff-added}` token (`#15803D` light / `#34D399` dark) added to
  DESIGN.md's frontmatter token table and mirrored into
  `src/styles/tokens.css`, explicitly scoped to Diff's row states, not a
  general "success" color.
  New `diff` pure function in `crates/umbra-core/src/json.rs` (AD-1) —
  objects compared by key (reordering keys alone is never a change, only
  value differences are), arrays by index (deliberately not LCS-style
  reorder-aware diffing — an honestly-scoped simpler behavior, not
  claimed as more than it is). `DiffNode`/`DiffValue` mirror
  `JsonTreeValue`'s own shape (so the view never needs a second lookup
  structure), with a key design point: a container's `Changed` status
  means "something inside changed" (no `old_value`) while a leaf's
  `Changed` status means an actual value replacement (`old_value: Some`)
  — a type mismatch (e.g. a string replaced by an object) is treated as a
  full replacement via the same "mark every descendant" helper `Added`/
  `Removed` already use, not a doomed field-by-field recursion into
  incompatible shapes. No output-size cap the way `query`'s
  `MAX_QUERY_MATCHES` has: a diff's output is inherently bounded by
  roughly the combined size of the two (already `MAX_INPUT_BYTES`-capped)
  inputs, the same order of magnitude as the single document Explorer's
  tree already holds in full — virtualized rendering, not a cap, is what
  makes that tractable, same as it always has been. Each side is parsed
  independently via the existing `parse`, so a malformed document A or B
  surfaces the exact same rewritten `json-*` error Validate/Query already
  show; `ToolError.context` is stamped `"document-a"`/`"document-b"` (the
  same disambiguation job it already does for JWT's per-segment errors)
  since position alone can't say which textarea a `(line 1, column 6)`
  belongs to. 14 new Rust unit tests. New `json_diff` Tauri command
  (`rename_all = "snake_case"`, matching `base64.rs`'s own precedent for a
  multi-word param name so this isn't the one `json_*` command whose IPC
  arg names don't match their Rust names) dispatches via its own
  `spawn_blocking`; a two-10MB-document timing test confirmed it stays
  well inside Story 1.9's baseline.
  Frontend: new `flattenDiffTree.ts` (mirrors `flattenJsonTree.ts`'s row-
  flattening exactly, plus `defaultExpandedDiffPaths` — unlike Explorer's
  root-only default, a diff view's whole point is showing what's
  different, so every ancestor chain of a real change starts expanded,
  leaving fully-unchanged sibling subtrees collapsed) and a new
  `DiffTree.vue` component — deliberately NOT unified with `JsonTree.vue`
  despite reusing its virtualizer/chevron/indent-guide machinery nearly
  verbatim, since `DiffNode`'s recursive, status-carrying shape is
  different enough from `JsonTreeValue` that a shared component would
  need a confusing dual-mode prop surface for little real gain; no
  search/copy actions on this first cut (not required by AC11, keeps
  scope tight). Diff-state icons (`+`/`-`/pencil/arrow) are hand-drawn
  inline SVGs, not `@phosphor-icons/vue` imports — Phosphor doesn't ship
  this exact foursome, and these reproduce the exact stroke width/viewBox
  the developer already approved in the design canvas mockup rather than
  re-deriving the look from a library glyph. `JsonView.vue` gained a Diff
  tab panel with its own second, tab-local textarea (`diffInputB`, per
  AC6's own already-decided two-document layout) and its own
  `createLatestWinsRunner()` scope (AD-16); `jumpToPosition` was
  generalized to `jumpToPositionIn(position, textarea, text)` so a
  document-b error can jump its own textarea's caret instead of always
  the shared input's — a real bug avoided by design, not caught after the
  fact, since a naive reuse of the existing single-textarea jump function
  would have moved the wrong field's caret. One real lint catch: an
  earlier draft mutated `expanded` as a side effect inside `rows`'s own
  `computed()` (to lazily initialize the default-expanded set) — flagged
  by `vue/no-side-effects-in-computed-properties`; fixed by moving that
  reset into a proper `watch(() => props.root, ..., {immediate: true})`
  instead. 9 new `flattenDiffTree` tests, 7 new `DiffTree.vue` component
  tests, 7 new `JsonView.vue` integration tests (including one fixing the
  now-outdated AC6 placeholder-tab test, which moves to Transform — the
  last remaining "coming soon" tab). Re-verified: `pnpm lint`, `pnpm test`
  (573/573), `vue-tsc --noEmit`, `pnpm build`, `cargo fmt --check --all`,
  `cargo test --workspace` (289/289: 203 umbra-core + 85 umbra/src-tauri +
  1 integration test). Browser tooling was unavailable again this round
  (Chrome extension not connected) — no live visual pass was possible;
  the developer should confirm in their running app, in both light and
  dark mode, before this is treated as fully done.
- 2026-08-26: Diff ordering follow-up. The developer found a real UX bug
  trying the tab live: renaming a key (e.g. `"active"` → `"activ"`) showed
  the new key at the very bottom of the object instead of next to the
  removed one, because `diff_values`'s Object branch walked all of A's keys
  first and only appended B-only keys after — every `Added` row landed at
  the tail regardless of where the edit happened. Discussed feasibility
  first (explicitly asked not to code yet): true rename detection (folding
  the pair into one "renamed" row) is a separate, heavier feature — it
  needs a similarity heuristic (value or name closeness) with no
  objectively correct answer, the same category of judgment call
  `git diff -M`'s content-based file-rename detection makes; even
  jsondiffpatch, the reference JS diff library researched for this tab's
  visual design, doesn't do it for object keys by default. The ordering fix
  (keep the pair adjacent) was scoped as the tractable, worthwhile half.
  Replaced the "walk A, append B's extras" merge with a two-pointer merge
  over `diff_object_entries` in `crates/umbra-core/src/json.rs`: walks A's
  keys, and whenever the next key is common to both sides, first flushes
  any B-only keys sitting earlier in B's order (so an added key surfaces
  right where the edit happened). A full Myers/LCS diff was ruled out —
  O(n·m) time/space is infeasible for a single object with tens of
  thousands of keys, a realistic shape inside a 10MB document (e.g. a
  dictionary keyed by UUID) — but JSON object keys are always unique within
  an object, which is exactly what makes the cheaper O(n + m) two-pointer
  merge correct: every key's status depends only on which side(s) it
  exists on, never on where it lands, so even the fallback case (a genuine
  key-order shuffle unrelated to any add/remove) can't mislabel a status,
  only place that one key less optimally. 4 new regression tests
  (`crates/umbra-core/src/json.rs`) covering the rename-adjacency case, a
  brand-new key landing at its natural position instead of the end, two
  independent renames staying independently adjacent, and a genuine
  key-shuffle case asserting no key is lost or duplicated. All 18
  `diff_*` tests green, including the 10MB timing sanity check (same
  overall linear-in-document-size complexity, unaffected — this only
  changes the per-object merge, not the recursion structure). No wire
  format change (`DiffNode`/`DiffValue` untouched), so no frontend edits
  were needed; `cargo fmt --check --all`, `cargo clippy --workspace
  --all-targets -- -D warnings`, `cargo test --workspace` (207/207), and
  `pnpm test -- --run` (573/573) all re-verified clean.
- 2026-08-26: Transform tab (AC12) — the last of the six tabs, so Task 2b's
  tab shell no longer has any "coming soon" placeholder. New `to_typescript`
  pure function in `crates/umbra-core/src/json.rs` (AD-1): infers a
  TypeScript `interface`/`type` from a parsed document via one recursive
  `infer_type_from_values` call that operates over a *slice* of values
  rather than a single one — the same function handles "the type of one
  field" (one occurrence) and "the type of a field across every element of
  an array" (many occurrences), which is what lets array-of-objects merging
  fall out of the recursion for free instead of needing a second code path.
  Scoped deliberately narrower than a full quicktype-class generator (own
  doc comment in `json.rs` records this in full): an array of objects merges
  into *one* interface (union of keys, a key missing from some elements
  becomes `key?:`, a key whose type varies becomes a union like
  `string | number`) rather than one interface per element, since a merged
  shape is what's actually useful for the realistic case (API responses,
  log dumps); nested objects reached through a merged array (e.g. every
  element's own `address` field) merge the same way, recursively. Explicitly
  not attempted, same category of deliberate boundary as Diff's rename
  detection: discriminated-union inference across structurally different
  shapes at one array position, and deduplicating identical shapes that
  ended up with different interface names. Interface names are
  `pascal_case`d from the originating key (`Root`/`RootItem` for the
  document root and its array elements); a name collision with a
  *different* shape gets a numeric suffix (`Foo`, `Foo2`), a collision with
  an *identical* shape reuses the existing interface rather than emitting a
  duplicate — covered by dedicated tests for both branches. A document root
  that isn't itself an object (a bare array, or a scalar) gets a
  `type Root = ...;` alias instead of an `interface` block, since
  `interface Root = string[]` isn't legal TypeScript. 18 new Rust unit
  tests, one per documented behavior (flat/nested objects, array merging
  with optional/union fields, nested-array-of-arrays, mixed-primitive-array
  parenthesization, empty array/object, non-identifier property-name
  quoting, both collision branches, malformed input) plus a 10 MB sanity
  check (AC14) — the merge algorithm is linear in document size (one pass
  per field per merge level), well inside Story 1.9's baseline. New
  `json_transform` Tauri command (`src-tauri/src/commands/json.rs`,
  registered in `lib.rs`) dispatches via its own `spawn_blocking` call
  (AD-4); a 10 MB timing test confirmed it stays well inside baseline too.
  `JsonView.vue` gained a Transform tab panel with its own
  `createLatestWinsRunner()` scope (AD-16, computed only while Transform is
  the active tab, same pattern as Repair/Query/Diff) — a neutral prompt on
  empty input, the classified `json-*` parse error (with the same
  clickable caret-jump the document-position errors already use, since
  `to_typescript` surfaces a malformed document through the same
  `map_parse_error` path Format/Validate/Repair/Query/Diff all share) on a
  malformed document, and otherwise a read-only preview textarea plus a
  Copy button. One deliberate UI-consistency call: the Copy button is
  plain-text (`AppButton`, toggling its own label between "Copy"/"Copied!"),
  not icon+checkmark like Explorer's/Query's per-row copy buttons — every
  other `AppButton` in this file (Format, Minify, Try Repair, Apply repair)
  is plain text with no icon, and `AppButton` itself has no icon+text layout
  precedent anywhere in the codebase to safely reuse, so this matches the
  established convention for a single full-sized action button rather than
  introducing unverified icon-alignment CSS. Output is a plain `string`, the
  same wire shape as Format/Minify's own command results — unlike
  Repair/Query/Diff there was no richer structure to carry, so no
  `jsonTransform.ts` mirror type was needed. Removed the now-fully-dead
  `tools.json.comingSoon` locale key and its template branch/CSS class
  (`v-else` + `.coming-soon`) from both locale files and `JsonView.vue` —
  with all six tabs now real, `TAB_IDS`' six ids are all explicitly matched,
  so that branch could never be reached again; replaced the one spec test
  that exercised it with 5 new Transform-tab tests (empty prompt, preview
  render, copy-and-confirm-then-revert, no-false-confirmation-on-clipboard-
  failure, error-with-working-caret-jump) mirroring Repair's/Query's own
  test conventions. Browser tooling connected this round (unlike every
  earlier slice this story) — visually confirmed live against the running
  `pnpm dev` server at `/tools/json`, same `window.__TAURI_INTERNALS__.invoke`
  mock convention prior slices used to see a populated tree without the
  real native Tauri window. Checked all three Transform states (empty
  prompt, the classified-error alert with its working caret-jump link, and
  the success preview + Copy button, including the copy-confirmation label
  swap and its revert) in both light and dark mode — all rendered as
  designed, including the default (not primary/orange) Copy button variant
  and the dimmed read-only preview matching Repair's own treatment.
  Re-verified:
  `pnpm lint`, `vue-tsc --noEmit`, `pnpm test -- --run` (577/577 — 5 new,
  1 removed), `pnpm build`, `cargo fmt --check --all`, `cargo clippy
  --workspace --all-targets -- -D warnings`, `cargo test --workspace`
  (314/314: 225 umbra-core + 88 umbra/src-tauri + 1 integration test).
- 2026-08-26: Belated Diff-tab (AC11) visual confirmation. Browser tooling
  connected this session for the first time since Diff shipped, closing the
  gap its own two prior completion-note entries flagged. Confirmed live
  against the running `pnpm dev` server, mocked `json_diff` result covering
  all three non-unchanged statuses at once (a changed scalar with its
  strikethrough-old→new inline display, a removed key, an added key), in
  both light and dark mode — the full-row red/green treatment (the
  deliberate two-hue-system exception recorded in `DESIGN.md`) renders
  legibly in both, and the pencil/minus/plus status icons are visually
  distinct from one another. No code change; confirmation only.

### File List

- `src/components/AppTabs.vue` (new)
- `src/components/AppTabs.spec.ts` (new)
- `src/tools/json/jsonPath.ts` (new)
- `src/tools/json/jsonPath.spec.ts` (new)
- `src/tools/json/jsonTreeValue.spec.ts` (new)
- `src/tools/json/JsonView.vue` (modified)
- `src/tools/json/JsonView.spec.ts` (modified)
- `src/tools/json/JsonTree.vue` (modified)
- `src/tools/json/JsonTree.spec.ts` (modified)
- `src/tools/json/flattenJsonTree.ts` (modified)
- `src/tools/json/flattenJsonTree.spec.ts` (modified)
- `src/tools/json/jsonTreeValue.ts` (modified)
- `src/locales/en.json` (modified)
- `src/locales/fr.json` (modified)
- `crates/umbra-core/src/json.rs` (modified)
- `src-tauri/src/commands/json.rs` (modified)
- `src/shell/toolError.ts` (modified)
- `src/shell/toolError.spec.ts` (modified)
- `src/tools/json/jsonRepair.ts` (new)
- `crates/umbra-core/Cargo.toml` (modified)
- `src-tauri/src/lib.rs` (modified)
- `src/tools/json/jsonQuery.ts` (new)
- `src/tools/json/useCopyFeedback.ts` (new)
- `src/tools/json/jsonDiff.ts` (new)
- `src/tools/json/flattenDiffTree.ts` (new)
- `src/tools/json/flattenDiffTree.spec.ts` (new)
- `src/tools/json/DiffTree.vue` (new)
- `src/tools/json/DiffTree.spec.ts` (new)
- `src/styles/tokens.css` (modified)
- `_bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/DESIGN.md` (modified)
