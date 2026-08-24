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

- [ ] **Task 0: Branch setup (AC: all)**
  - [ ] Confirm `baseline_commit` (`b357aff`) is `origin/main`'s real tip: `git fetch origin && git log --oneline -1 origin/main`. Bumped 2026-08-24 from this story's original `0690f83` after PR #104 landed mid-discovery (tokenized `JsonTree.vue`'s focus ring, added `src/styles/base.css` — see Dev Notes); re-confirm at implementation start in case `main` has moved again since.
  - [ ] `git checkout -b feat/story-8-1-reimagine-the-json-formatter-viewer origin/main`.

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
        buttons (`PhCaretUp`/`PhCaretDown`), Enter/Shift+Enter cycle matches without moving
        focus out of the search box (matching a browser's own Ctrl+F), and every match wraps
        around at either end. New `highlightSegments` wraps the matched substring in
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
  - [ ] Add `serde_json_path` to `crates/umbra-core/Cargo.toml`; verify it against the
        RFC 9535 conformance suite it tracks before wiring it into a new query function
        (per this project's standing dependency-verification discipline — Task 2 owns this
        live check, not assumed from Task 1's research).
  - [ ] `crates/umbra-core/src/json.rs`: add `repair`, `query` (JSONPath via
        `serde_json_path`), `diff` (structural, over `JsonTreeValue`), and `to_typescript`
        pure functions per the decision record's AD-1 split — each with its own regression
        tests, sanity-checked against the 10 MB / Story 1.9 performance floor (AC14).
  - [ ] Explorer, next slice: inline editing (add/remove/move/duplicate fields) and
        search/filter by key or value — extends `JsonTree.vue`, keeps its existing
        path-based focus tracking and ARIA tree roles.
  - [ ] Rewrite Validate's error messages, register new `json-*` codes in
        `TRANSLATABLE_CODES` (`src/shell/toolError.ts`), add the "Try Repair" cross-link.
  - [ ] Build Repair's preview-then-confirm UI (per-change description, explicit apply step
        — never silent auto-apply).
  - [ ] Build Query's expression input + result view over the new `query` command.
  - [ ] Build Diff's two-document input + tree-mode highlighted result over the new `diff`
        command.
  - [ ] Build Transform's TypeScript-interface output over the new `to_typescript` command.
  - [ ] Give each new async command its own `createLatestWinsRunner()` scope (AD-16) and
        `spawn_blocking` dispatch (AD-4) — do not share the existing Format/Minify/Paste or
        live-tree-parse runners.
  - [ ] Implement per AC6–14; run the standard verification pass (`pnpm lint`, `pnpm test`,
        `vue-tsc --noEmit`, `pnpm build`, `cargo fmt --check`, `cargo test --workspace`).

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
