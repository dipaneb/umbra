---
baseline_commit: 9d22ee4ae20bde909c626881438216fe9731b871
---

# Story 7.3: Grid-home replaces the placeholder empty state

Status: done

## Story

As a privacy-conscious developer,
I want the main pane's default state to show a tile per tool,
so that I can see and launch any tool at a glance instead of finding an empty placeholder.

## Acceptance Criteria

1. Given the app is at the `"/"` route with no tool restored, When the main pane renders, Then it shows one Card per registered tool, sourced solely from the Tool Registry (AD-5) — nothing enumerates tools independently.
2. Given a Card's internal layout, When rendered, Then it matches `DESIGN.md`'s resolved spec: icon-badge (rendered via Story 7.1's icon system, not raw emoji) top-left, bold title, description text below it, stacked left-aligned inside standard card padding — consuming Story 7.1's tokens.
3. Given a Card, When operated, Then clicking anywhere opens the tool; it's focusable in tab order and activates on Enter/Space as well as click; its accessible name equals the tool's name, not just its visual title text (NFR5).
4. Given each registry entry, When a Card renders its description text, Then the Tool Registry gains a `description` field (every existing entry backfilled with one line) — AD-5's registry stays the single source; no separate description list is invented elsewhere.
5. Given the grid layout, When multiple tools are registered, Then cards lay out in a responsive grid using `DESIGN.md`'s `spacing.4` (16px) gutter — this story is the "real screen mock" confirmation `DESIGN.md`'s Layout & Spacing section flags as pending.
6. Given restore-last-tool is enabled and a last tool exists (Story 7.6 sets the default), When the app launches, Then grid-home is skipped and the app opens straight to the last-used tool — same behavior Story 1.10 already ships, just no longer landing on a bare placeholder when it's off.

**Not covered by this story:** `EXPERIENCE.md` Flow 1's first-launch guided highlight tour — a distinct onboarding mechanism, not required for grid-home to function. Left as a candidate for its own future story.

## Tasks / Subtasks

- [x] Task 0: Confirm baseline (AC: all)
  - [x] Branch from `origin/main` at `9d22ee4` (Story 7.2's squash-merge, `#79`) — local `main` and `origin/main` are already identical at this commit, clean tree.

- [x] Task 1: Add a `description` field to the Tool Registry (AC: 4)
  - [x] In `src/stores/registry.ts`, add `description: string` to the `ToolRegistryEntry` interface (required, not optional — every entry must carry one per AC4).
  - [x] Backfill all 7 `TOOLS` entries with this exact one-line text (sourced from the PRD's own FR wording for each tool, not invented copy):
    - `json`: `"Format, validate, and explore JSON as a collapsible tree."`
    - `base64`: `"Encode and decode text or files to and from Base64."`
    - `uuid`: `"Generate UUID v4 or v7 identifiers, single or in bulk."`
    - `hash`: `"Compute SHA-256, SHA-512, MD5, and SHA-1 digests of text or files."`
    - `jwt`: `"Decode a JWT's header and payload, entirely offline."`
    - `cron`: `"Translate between plain English and cron expressions."`
    - `bucket`: `"Extract text from images, and merge, split, or convert PDFs and images."`
  - [x] In `src/stores/registry.spec.ts`, the `entry(id)` test helper (line ~6-15) constructs a `ToolRegistryEntry` literal — add `description: "test"` (or similar) to it, or the file stops compiling once `description` becomes required.
  - [x] Add a test in `registry.spec.ts` asserting every `TOOLS` entry has a non-empty `description` — mirrors the existing "resolves a real icon component for every registry entry's icon" test (AC5, same file) in shape.

- [x] Task 2: Extend AD-5's documented registry shape (AC: 4)
  - [x] `ARCHITECTURE-SPINE.md`'s AD-5 rule (line 73) currently reads: `` `{ id, name, aliases, route, icon, drop declarations, shortcut declarations }` `` — add `description` to that list, as a dated inline amendment citing Story 7.3 (same convention as AD-8's 2026-08-06 amendment and DESIGN.md's own 2026-08-16 Card-section amendment note — don't silently edit the enumeration with no trace).
  - [x] `ARCHITECTURE.md`'s matching prose (line 81, the "tool #20" paragraph) restates the same shape literally — update it identically so the two companion docs don't drift apart.

- [x] Task 3: Build `GridHome.vue` (new file, AC: 1, 2, 5)
  - [x] New `src/shell/GridHome.vue`. Direct template: `AppSidebar.vue`'s existing structure — `const registry = useRegistryStore(); ` then `v-for="tool in registry.tools"` — this codebase inlines its one other repeated-tile pattern (sidebar nav items) directly in the parent rather than extracting a subcomponent (no `NavItem.vue` exists); do the same here, no separate `Card.vue`/`ToolCard.vue` component.
  - [x] Per-card markup, top to bottom: icon-badge (`<component :is="resolveIcon(tool.icon)" aria-hidden="true" />`, same `resolveIcon` import `AppSidebar.vue`/`CommandPalette.vue` already use), bold title (`tool.name`), description (`tool.description`) — stacked, left-aligned, inside the card's own padding. This is literally `DESIGN.md`'s Card spec (`Components` section, `{components.card}` — see Dev Notes for exact token bindings).
  - [x] Grid container: `display: grid`, columns via `repeat(auto-fill, minmax(...))` (or equivalent responsive approach), `gap: var(--spacing-4)` — bind to the literal `--spacing-4` custom property (not `--spacing-gutter`, which happens to hold the same 16px value but isn't the token AC5 cites by name).
  - [x] Card visual tokens (all already defined in `src/styles/tokens.css` by Story 7.1/7.2 — do not invent new ones): `background: var(--color-bg-surface)`, `border: 1px solid var(--color-border-hairline)`, `border-radius: var(--radius-default)`, `padding: var(--spacing-5)`. Title: `var(--font-heading-family/-size/-weight/-line-height)`. Description: `var(--font-body-family/-size/-weight/-line-height)` and `var(--color-text-secondary)` for the de-emphasized description color — the same token already used for real text content elsewhere in this app (e.g. chip/tab labels), not `--color-text-tertiary` (that's the token `DESIGN.md`'s Colors section explicitly licenses for real text use — a different, more de-emphasized tier; don't substitute it here without checking contrast against `--color-bg-surface` first).

- [x] Task 4: Card interactivity and accessibility (AC: 3)
  - [x] Wrap each card in `<RouterLink :to="tool.route" custom v-slot="{ navigate, href }">` and render a real `<a :href="href" @click="navigate">` inside — this makes the *entire* card block-level and clickable, not just the title text, while keeping real link semantics (confirmed against Vue Router's own docs for this exact "make an arbitrary element into a link" pattern).
  - [x] **Real gap to close, not optional polish:** a native `<a>` activates on `Enter` automatically but does **not** activate on `Space` — that's button-only browser behavior. AC3 explicitly requires both. Add a Space handler on the same anchor — but **not** `@keydown.space.prevent="navigate"`: Vue's `.prevent` modifier calls `event.preventDefault()` *before* invoking the handler, and vue-router's `navigate()` internally calls `guardEvent(e)`, which does `if (e.defaultPrevented) return;` — so `navigate` would receive an already-prevented event and silently no-op, Space would do nothing. Use `@keydown.space.prevent="navigate()"` instead (an explicit call with no arguments, so `navigate` runs with no event to check) — or equivalently `@keydown.space="(e) => { e.preventDefault(); navigate(); }"`. Verify manually (Task 8) that both keys actually open the tool, not just Enter — and make sure Task 7's own Space-activation test actually exercises the real handler, since this exact mistake would pass a shallow test that calls `navigate` directly instead of dispatching a real keydown event.
  - [x] **Accessible-name scoping, the other real gap:** the card's `<a>` will visually contain icon + title + description. Left alone, the browser computes its accessible name from *all* of that text content — title and description concatenated, not "the tool's name" AC3 asks for. Set `aria-label="{{ tool.name }}"` directly on the anchor so its accessible name is exactly `tool.name`, while the description stays visually rendered for sighted users (screen-reader users get the name only, matching the AC's literal wording).
  - [x] Native `<a>` is already in the page's tab order — no explicit `tabindex` needed.

- [x] Task 5: Wire `GridHome` into the router, retire `EmptyState` (AC: 1)
  - [x] `src/router/index.ts`: replace the `EmptyState` import and the `"/"` route's `component: EmptyState` with `GridHome`.
  - [x] `src/shell/EmptyState.vue`'s only consumers are `src/router/index.ts` and its own test — confirmed via a direct grep, not assumed. Delete `src/shell/EmptyState.vue` outright (no other file references it).
  - [x] `src/router/index.spec.ts`'s first test, `"resolves / to the empty-state component"` (lines 10-20), imports and asserts against `EmptyState` directly — update both the import and the assertion to `GridHome`, and update the test's own name/description to match. This test is easy to miss since it's failure mode is "still green because nobody touched it" only until you actually run it (it will fail loudly once the route's component changes) — but it needs a deliberate content update, not just a passing run, since it's currently asserting the wrong thing on purpose (there is no `GridHome` component yet at all).

- [x] Task 6: Confirm AC6 needs no new logic (AC: 6)
  - [x] `src/main.ts`'s existing `bootstrap()` already does this: `if (settings.restoreEnabled) { ... if (lastTool && registry.tools.some(...)) { await router.replace({ name: lastTool }); } ... }`, executed *before* `mount()`/`show()`. When that branch fires, the app never renders `"/"` at all — it replaces to the tool's own route first. This is Story 1.10's shipped mechanism, untouched by 7.1/7.2, and needs zero changes here: swapping the `"/"` route's component from `EmptyState` to `GridHome` doesn't interact with this logic in any way. This task is a confirmation to record in Dev Notes, not implementation work — do not add new restore-skip logic inside `GridHome.vue` itself, and do not touch `main.ts`.
  - [x] Note the real, out-of-scope tension so it isn't "fixed" here by accident: `EXPERIENCE.md`'s Information Architecture section documents a *target* behavior where restore-last-tool defaults to **off** (grid-home is the default landing surface), directly contradicting `settings.ts`'s currently-shipped `restoreEnabled = ref(true)`. `epics.md`'s own AC6 text says "Story 7.6 sets the default" — that flip is explicitly out of this story's scope; leave `settings.ts`'s default untouched.

- [x] Task 7: Tests
  - [x] New `src/shell/GridHome.spec.ts`, direct template `AppSidebar.spec.ts`'s mount pattern (`createPinia()` + `createAppRouter(pinia)`, `router.push("/")`, `await router.isReady()`, `mount(GridHome, { global: { plugins: [pinia, router] } })`):
    - Renders exactly `registry.tools.length` cards, each showing the tool's resolved icon component (via `resolveIcon`, not raw text — same assertion shape as `AppSidebar.spec.ts`'s AC5 test), title, and description.
    - Each card's accessible name (its `aria-label`) equals `tool.name` exactly — not the title+description concatenation.
    - Clicking a card navigates to that tool's route (assert `router.currentRoute.value.name`, polled via `vi.waitFor` — a single `flushPromises()` isn't enough for the route's genuine dynamic `import()` to resolve, same gap `CommandPalette.spec.ts` already documents for its own click-to-navigate test).
    - Pressing Space while a card is focused navigates to that tool's route, exercising the real `keydown` handler (the story's single highest-risk gap — see Task 4), also polled via `vi.waitFor`. Pressing Enter is native-`<a>` browser default-action behavior with no application handler behind it at all — confirmed directly that jsdom does not implement that default action (a real `keydown` with key "Enter" produces no navigation in this environment, unlike an actual browser), so it can't be exercised as a click-producing unit test the way Space's explicit handler can; the unit test instead verifies the structural precondition a real browser needs (a real, focusable `<a>` with a resolved `href`), and full behavioral confirmation is deferred to Task 8's manual check, same as every other real-browser-only verification in this story.
  - [x] `src/router/index.spec.ts`: update per Task 5 (import/assert `GridHome`, not `EmptyState`).
  - [x] `src/stores/registry.spec.ts`: update per Task 1 (`entry()` helper + new description-coverage test).

- [x] **Task 8: Manual verification — outside a sandboxed coding session's reach**
  - [x] `pnpm tauri dev`: confirm grid-home renders on launch with restore-last-tool off; confirm every card's icon/title/description look correct in both light and dark (Story 7.2's toggle); confirm keyboard-only navigation — Tab through every card, activate one with Enter, activate a different one with Space, confirm both actually open the tool (the real risk Task 4 flags); confirm restore-last-tool on + a valid last tool still skips grid-home entirely and opens straight to that tool (AC6, unchanged mechanism). **Deferred to the developer** — this sandboxed session has no display server, same limitation as every prior story.

### Review Findings

**Patch:**

- [x] [Review][Patch] Icon renders as a bare 24×24 SVG with no badge container — DESIGN.md's Card spec (line 178, Components section) explicitly calls for "icon-badge (small `{rounded.sm}` tag...)"; confirmed directly against the Screen 01 mockup image, which shows each icon inside a small light-gray rounded chip, not floating unstyled. `GridHome.vue`'s `.icon` class applies no background, no padding, and no radius — AC2's "matches DESIGN.md's resolved spec" for Card internal layout is not met, and no test in `GridHome.spec.ts` checks the icon's container/styling so this ships silently. **Fixed:** icon now wrapped in a `span.icon-badge` styled with `background: var(--color-accent-neutral-chip)`, `border-radius: var(--radius-sm)`, and `padding: 4px` — both tokens already existed in `src/styles/tokens.css` in both light/dark blocks, previously unused. [`src/shell/GridHome.vue:24-30,56-64`]
- [x] [Review][Patch] `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` uses `auto-fill` instead of `auto-fit`. With exactly 7 hardcoded tools (`src/stores/registry.ts`), any viewport wide enough to fit one more 220px column than there are cards leaves an empty implicit track that still claims an equal `1fr` share — every real card renders narrower than intended. **Fixed:** changed to `auto-fit`, which collapses empty tracks so the 7 real cards fill the available width instead. [`src/shell/GridHome.vue:39`]
- [x] [Review][Patch] `GridHome.spec.ts`'s href test only asserted `card.attributes("href")).toBeTruthy()` — it never checked the href actually resolves to the expected tool's route. A bug that pointed every card at the same wrong route would still have passed this test as long as the href were non-empty. **Fixed:** now asserts `card.attributes("href")` equals `registry.tools[index].route` for every card. [`src/shell/GridHome.spec.ts:75-84`]
- [x] [Review][Patch] Click/Space navigation tests picked cards by unlabeled magic index (`cards[2]` for the click test, `cards[1]` for the Space test) with no comment tying the index to the `uuid`/`base64` tool it corresponds to. **Fixed:** both tests now look up their target card via `registry.tools.findIndex((tool) => tool.id === "uuid" / "base64")` instead of a hardcoded index. [`src/shell/GridHome.spec.ts:48-61,86-95`]

**Defer:**

- [x] [Review][Defer] `.card:focus-visible`'s outline color is hardcoded (`#396cd8`) rather than token-driven. [`src/shell/GridHome.vue:78-81`] — deferred, pre-existing: the identical unTokenized value already exists in `src/shell/AppSidebar.vue:53-55` and `src/shell/CommandPalette.vue:185`; this story only reuses the existing convention rather than introducing it. Story 7.2's own code review deferred the same gap for the same reason.
- [x] [Review][Defer] Holding Space down on a focused card fires repeat `keydown` events, each invoking `navigate()` again while the prior navigation (a genuine dynamic `import()`) is still in flight. [`src/shell/GridHome.vue:22`] — deferred: Vue Router's redundant-navigation handling means repeated pushes to the same in-flight/current target don't produce duplicate history entries or a crash, so the practical impact is negligible; a `!$event.repeat` guard would be a cheap hardening but isn't blocking.
- [x] [Review][Defer] No defensive rendering (heading-adjacent empty-state text) if `registry.tools` were ever empty. [`src/shell/GridHome.vue:8-34`] — deferred, pre-existing/unreachable: `TOOLS` is a module-level hardcoded literal guarded by `assertUniqueToolIds` at load time; there is currently no code path that produces an empty registry at runtime. Worth a one-line guard if the registry ever becomes dynamically loaded, not before.
- [x] [Review][Defer] Page-level "Tools" heading and tool-count subtitle from the confirmed screen mock (Screen 01) are entirely absent — `GridHome.vue` renders only the card grid, no heading, no subtitle, no landmark of its own. [`src/shell/GridHome.vue:8-34`] — deferred, developer's call: the page doesn't need a title and subtitle.

## Dev Notes

- **Architecture fit:** Pure frontend, presentation-layer change. AD-5 (`ARCHITECTURE-SPINE.md`) — the Tool Registry stays the single source; this story only adds a `description` field to the same one source, never a second list. AD-6 ("tools are islands") — `GridHome.vue` reads `registry.tools` only, touches no tool-specific code. No `src-tauri/`/Rust changes, no new dependency (reuses `@phosphor-icons/vue` via Story 7.1's `resolveIcon`, and `vue-router`'s existing `RouterLink`/`custom`/`v-slot` API — already the project's router, no version drift to check since nothing new is added).
- **No Card component exists yet — this story is what builds it.** `DESIGN.md`'s own Components section says so explicitly (2026-08-16 amendment on the Card entry): Story 7.1 built the icon *resolver*, but "no Card component exists yet — Story 7.3 is what actually builds the Card and renders one of these Phosphor SVGs in the top-left rounded-sm icon-badge slot."
- **Card keyboard-activation is the single highest-risk part of this story** (same shape as 7.2's dark-mode CSS-specificity risk called out in that story's own Dev Notes): it's easy to make the whole card clickable and stop there, since a plain `<a>` already looks keyboard-accessible (it's focusable, Enter works) — but AC3 explicitly requires Space too, which native anchors don't support without an explicit handler. Verified directly against Vue Router's docs (`custom v-slot="{ navigate }"` is the documented way to make an arbitrary wrapped element act as a link) — the Space gap is this project's own addition on top of that pattern, not something vue-router handles for you. **A second, easy-to-miss trap layered on top of the first:** the obvious `@keydown.space.prevent="navigate"` binding is itself broken — verified directly against the installed `vue-router`/`@vue/runtime-dom` source, `.prevent` calls `event.preventDefault()` before `navigate` runs, and `navigate`'s own internal `guardEvent(e)` bails out on an already-`defaultPrevented` event, so Space would silently do nothing. Task 4 spells out the correct form (`navigate()`, called explicitly with no arguments).
- **Accessible-name scoping is the second real gap, not a nice-to-have.** AC3 says the accessible name must equal the tool's name, "not just its visual title text" — read literally, a card whose `<a>` contains icon + title + description text has neither problem solved by default: an unlabeled anchor's computed accessible name would be *title + description concatenated*, which is neither "just the title" nor "the tool's name" alone. An explicit `aria-label="tool.name"` on the anchor is what actually satisfies the AC as written.
- **Existing code to extend, not replace** (confirmed by direct reads):
  - `src/shell/AppSidebar.vue` — the direct structural template: `useRegistryStore()`, `v-for="tool in registry.tools"`, `resolveIcon(tool.icon)` rendered as `<component :is="..." aria-hidden="true" />`. This codebase does not extract a subcomponent for its one other repeated-tile pattern (sidebar nav items) — follow that precedent, don't introduce a separate `Card.vue`.
  - `src/shell/icons.ts` — `resolveIcon(name: IconName): Component`, already exhaustive over every current registry `icon` value; no changes needed here.
  - `src/styles/tokens.css` — every token this story needs (`--spacing-4`, `--spacing-5`, `--radius-default`, `--color-bg-surface`, `--color-border-hairline`, `--color-text-primary`, `--color-text-secondary`, `--font-heading-*`, `--font-body-*`) already exists from Story 7.1/7.2 in both light (`:root[data-theme="light"]`) and dark (`:root[data-theme="dark"]`) blocks — this story consumes them, adds none.
  - `src/main.ts` — `bootstrap()`'s existing restore-flow (see Task 6) is the actual mechanism behind AC6; read it, don't reimplement it.
  - `src/router/index.ts` / `src/router/index.spec.ts` — the `"/"` route's `component` is the only line this story changes in the router itself; the existing spec file already has a test targeting that exact route that must be updated, not left stale.
- **From Story 7.1/7.2 (done, direct prerequisites):** 7.1 built the icon system and the CSS token layer; 7.2 built the `data-theme` mechanism both light/dark blocks resolve against. Neither touched the main pane's `"/"` route content — `EmptyState.vue` (a one-line placeholder, unchanged since Epic 1) is exactly what this story replaces. 7.2's Dev Notes flag a recurring gotcha class worth repeating here: "a token/selector block defined but never actually applied is a silent no-op" — the manual `pnpm tauri dev` check (Task 8) is what actually proves the grid renders and both keyboard paths work, not just that the code compiles and unit tests pass.
- **Explicitly out of scope:** the sidebar's active-nav state and pinned/recent grouping (Stories 7.4/7.5 — this story touches only the main pane, never `AppSidebar.vue`); the restore-last-tool default flip (Story 7.6's job, see Task 6); `EXPERIENCE.md` Flow 1's guided tour (explicitly named out-of-scope by `epics.md`'s own Story 7.3 text); any Settings UI work.

### Project Structure Notes

- New: `src/shell/GridHome.vue`, `src/shell/GridHome.spec.ts`.
- Deleted: `src/shell/EmptyState.vue` (no test file existed for it to delete alongside it).
- Modified: `src/router/index.ts`, `src/router/index.spec.ts`, `src/stores/registry.ts`, `src/stores/registry.spec.ts`, `ARCHITECTURE-SPINE.md`, `ARCHITECTURE.md`.
- No `src-tauri/`/Rust changes — this is a frontend-only story, same as 7.1/7.2.
- Testing convention (confirmed from existing spec files): co-located `*.spec.ts`; Vitest + `@vue/test-utils`'s `mount()`; `AppSidebar.spec.ts`'s `createPinia()` + `createAppRouter(pinia)` + `router.push(...)` + `await router.isReady()` pattern is the direct template for any test that needs real registry-driven routing (used here for `GridHome.spec.ts`), rather than a shallow/stubbed mount.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7 intro, Story 7.3]
- [Source: _bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md — FR5 (restore-toggle default flip, Story 7.6), FR6-FR8/FR10-FR11/FR13-FR15/FR16-FR18/FR19-FR21/FR23-FR28 (per-tool description source text), NFR5]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md — AD-5, AD-6]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md — "tool #20" paragraph (AD-5's prose companion)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/DESIGN.md — Components section (Card, 2026-08-16 amendment), Layout & Spacing, Colors]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/EXPERIENCE.md — Information Architecture, Component Patterns (Card), State Patterns (Empty/Grid-home), Accessibility Floor, Flow 1]
- [Source: _bmad-output/implementation-artifacts/7-2-dark-mode-switching.md — Dev Notes, File List, Change Log]
- [Source: _bmad-output/implementation-artifacts/7-1-design-tokens-and-icon-system-land-in-the-shell.md — Dev Notes]
- [Source: vue-router official docs (Context7 `/vuejs/router`) — `RouterLink custom v-slot="{ navigate, href }"` pattern for wrapping an arbitrary element as a link]
- [Source: src/shell/AppSidebar.vue, src/shell/CommandPalette.vue, src/shell/icons.ts, src/shell/EmptyState.vue, src/router/index.ts, src/router/index.spec.ts, src/stores/registry.ts, src/stores/registry.spec.ts, src/stores/settings.ts, src/main.ts, src/styles/tokens.css, src/App.vue — read directly for this story]

## Change Log

- 2026-08-17: Implementation complete — Tasks 0-7 done, Task 8's manual `pnpm tauri dev` GUI smoke check deferred to the developer (no display server in this sandboxed session). Status moved to "review".
- 2026-08-17: Code review complete (bmad-code-review, three-layer adversarial pass — Blind Hunter, Edge Case Hunter, Acceptance Auditor). 1 decision-needed item (missing page-level "Tools" heading/subtitle from the confirmed screen mock) resolved by the developer as deferred — the page doesn't need a title and subtitle. 4 patch findings fixed: the icon now renders inside a proper icon-badge (`--color-accent-neutral-chip` + `--radius-sm`, matching DESIGN.md's Card spec and the confirmed mockup), the grid switched from `auto-fill` to `auto-fit` to stop empty tracks narrowing real cards on wide viewports, the href test now asserts against the actual expected route instead of just truthiness, and the click/Space navigation tests now look up their target card by tool id instead of a hardcoded array index. 4 items deferred to `deferred-work.md` (3 pre-existing/low-impact, 1 the developer's explicit scope call). 7 findings dismissed after verification — most notably, the "aria-label swallows the description from screen readers" finding raised independently by two review layers turned out to be exactly what AC3 requires ("accessible name equals the tool's name, not just its visual title text"), not a defect. Full verification green: 268/268 Vue tests, `eslint --max-warnings 0` clean, `vue-tsc --noEmit` clean. Status moved to "done".

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- While TDD-ing `GridHome.spec.ts`'s click/Space navigation tests, a click/keydown-triggered `router.push()` via vue-router's `RouterLink custom v-slot="{ navigate }"` never resolved within a single `flushPromises()` (a lone macrotask flush) — traced with an ad-hoc debug spec (not committed) confirming `navigate()`'s internal `guardEvent()` passed and `router.push()` was actually called, but its promise stayed pending until several more event-loop turns elapsed (the target route's component is a genuine dynamic `import()`, adding extra async hops). `CommandPalette.spec.ts` already documents and works around this exact gap for its own Enter-to-navigate test (`vi.waitFor` polling instead of a single flush) — applied the same fix here rather than inventing a new pattern.
- Separately, an Enter-keydown test written to mirror the Space test never triggered navigation at all: confirmed directly (real `keydown` with `key: "Enter"` dispatched on the anchor) that jsdom does not implement the browser's native "Enter activates a focused `<a>`" default action — that behavior lives in a real rendering engine, not in application JS, and GridHome.vue deliberately has no `keydown.enter` handler (per Task 4's own design: only Space needs one). Rewrote that test to assert the structural precondition a real browser needs for its native default action to fire (a real, focusable `<a>` with a resolved `href`), with full behavioral confirmation deferred to Task 8's manual check.
- `pnpm build`'s `vue-tsc --noEmit` step caught a real gap Task 1 didn't anticipate: two other spec files (`src/shell/dropZone.spec.ts`, `src/shell/paletteSearch.spec.ts`) construct `ToolRegistryEntry` literals directly, independent of `registry.spec.ts`'s own `entry()` helper the story called out. Vitest's esbuild-based transform strips types without checking them, so these didn't fail the plain test run — only the separate typecheck pass caught the now-missing required `description` field. Fixed all 7 literals across both files with `description: "test"`, mirroring `registry.spec.ts`'s own convention.

### Completion Notes List

- AC1 (registry-sourced grid): `GridHome.vue` renders one card per `registry.tools` entry, nothing enumerated independently — confirmed via `GridHome.spec.ts`'s card-count test.
- AC2 (Card layout matching DESIGN.md): icon-badge/title/description stacked left-aligned, all Story 7.1/7.2 tokens consumed (`--spacing-4/-5`, `--radius-default`, `--color-bg-surface`, `--color-border-hairline`, `--color-text-primary/-secondary`, `--font-heading-*/-body-*`) — no new tokens invented.
- AC3 (interactivity/accessibility): whole-card click via `RouterLink custom v-slot`; Space handled explicitly with `@keydown.space.prevent="navigate()"` (the exact non-broken form the story's Dev Notes specify — not the broken `@keydown.space.prevent="navigate"` shorthand); accessible name pinned to `tool.name` via `aria-label` on the anchor, verified against the title+description concatenation trap. Enter relies on native `<a>` browser behavior with no app-level handler; full behavioral confirmation of Enter deferred to Task 8 (jsdom doesn't implement that native default action — see Debug Log).
- AC4 (registry `description` field): added as a required field on `ToolRegistryEntry`, backfilled on all 7 `TOOLS` entries with the story's specified copy, AD-5 amended in both `ARCHITECTURE-SPINE.md` and `ARCHITECTURE.md` with dated inline notes citing this story.
- AC5 (responsive grid, `spacing.4`): `display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--spacing-4);` — the literal `--spacing-4` token, not `--spacing-gutter`.
- AC6 (restore-last-tool skip): confirmed `main.ts`'s existing pre-mount `router.replace()` mechanism (Story 1.10) needs zero changes — verified by reading the source directly, no code touched.
- Real gap found beyond the story's own drafting (see Debug Log): `dropZone.spec.ts`/`paletteSearch.spec.ts` also construct raw `ToolRegistryEntry` literals and needed the same `description` backfill the story only anticipated for `registry.spec.ts`'s helper — caught by `vue-tsc`, not by the plain test run, fixed before finalizing.
- Full verification green: 268/268 Vue tests (262 baseline + 6 net new: 5 in `GridHome.spec.ts`, 1 in `registry.spec.ts`), `eslint --max-warnings 0` clean, `vue-tsc --noEmit && vite build` clean. `git status` confirms zero `src-tauri/` files touched — frontend-only story, as scoped. Task 8's manual `pnpm tauri dev` GUI smoke check (grid-home render, light/dark card appearance, keyboard-only Tab/Enter/Space navigation, restore-last-tool skip) deferred to the developer — no display server in this sandboxed session, same limitation as every prior story.

### File List

- New: `src/shell/GridHome.vue`
- New: `src/shell/GridHome.spec.ts`
- Deleted: `src/shell/EmptyState.vue`
- Modified: `src/router/index.ts`
- Modified: `src/router/index.spec.ts`
- Modified: `src/stores/registry.ts`
- Modified: `src/stores/registry.spec.ts`
- Modified: `src/shell/dropZone.spec.ts`
- Modified: `src/shell/paletteSearch.spec.ts`
- Modified: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md`
- Modified: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md`
