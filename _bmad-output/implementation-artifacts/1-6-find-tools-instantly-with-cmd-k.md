---
baseline_commit: 4cf8b19
---

# Story 1.6: Find tools instantly with ⌘K

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want a command palette that matches tool names and aliases,
so that I can open any tool without touching the mouse.

## Acceptance Criteria

1. **Given** the app is focused anywhere, **when** I press ⌘K, **then** the command palette opens, handled by the shell's single capture-phase keyboard handler — no tool registers document-level key listeners (FR2, AD-14).
2. **Given** the palette is open, **when** I type a tool name or a registry-declared alias (e.g. "b64" → Base64, once registered), **then** matching tools appear ranked, Enter opens the top result in the main pane, and Esc closes the palette (FR2).
3. **Given** a query matching nothing, **when** results are shown, **then** an explicit empty state is displayed — never a blank panel.
4. **Given** keyboard-only usage, **when** operating the palette, **then** arrow keys navigate results with visible focus and the input is labeled (NFR5).

## Tasks / Subtasks

- [x] Task 1: Implement palette matching as a pure, dependency-free function (AC: 2, 3)
  - [x] Create `src/shell/paletteSearch.ts` exporting `searchTools(tools: ToolRegistryEntry[], query: string): ToolRegistryEntry[]`. No Vue/Pinia imports — a plain function over the `ToolRegistryEntry[]` shape already defined in `src/stores/registry.ts`, independently unit-testable without mounting anything.
  - [x] **No new dependency (e.g. Fuse.js) is added for fuzzy matching.** Neither `ARCHITECTURE.md` nor `ARCHITECTURE-SPINE.md` names a search/ranking library, and the registry will only ever hold a few dozen entries — a small deterministic ranking function is sufficient and keeps the frontend dependency surface exactly where Story 1.5 left it (`vue`, `vue-router`, `pinia` only). This is a considered scope decision made while drafting this story, not an oversight — don't add one.
  - [x] Behavior: empty/whitespace-only query returns `tools` unchanged, in registry order — this lets the palette double as a browsable "all tools" list the instant it opens, before the user types anything.
  - [x] Behavior for a non-empty query: case-insensitive match against `tool.name` and every string in `tool.aliases`. Rank strength, lowest wins ties broken by registry order (`Array.prototype.sort` is spec-stable since ES2019, safe to rely on):
    ```ts
    // 0: name === query            3: some alias startsWith(query)
    // 1: name startsWith(query)    4: name.includes(query)
    // 2: some alias === query      5: some alias.includes(query)
    // no match at any tier -> excluded entirely (this produces AC3's empty result)
    ```
  - [x] Sort matched tools ascending by rank and return the `ToolRegistryEntry[]` (not a wrapper object) — `CommandPalette.vue` needs nothing more than the ordered list.

- [x] Task 2: Build `CommandPalette.vue` — state, template, styling (AC: 1, 2, 3, 4)
  - [x] Create `src/shell/CommandPalette.vue` per the Structural Seed's `src/shell/` (sidebar/palette/drop/clipboard/shortcut dispatch, AD-14) — the same directory `AppSidebar.vue` and `EmptyState.vue` already live in.
  - [x] Local component state only — `isOpen = ref(false)`, `query = ref("")`, `activeIndex = ref(0)`, `inputRef = ref<HTMLInputElement | null>(null)`. **Do not** put palette open/query/selection state in a Pinia store: AD-6 restricts cross-cutting state to the `settings`/`registry` stores for state tools/other components need to share, and nothing outside this component needs palette-open state. Read tools via the existing `useRegistryStore()` (ambient form, matching `AppSidebar.vue`'s pattern — this file only exists inside component `setup()`, which always runs after `app.use(pinia)`, so the router-module ordering hazard from Story 1.5 doesn't apply here).
  - [x] `results = computed(() => searchTools(registry.tools, query.value))` (Task 1's function).
  - [x] Render nothing when closed: `<div v-if="isOpen" class="palette-overlay">…</div>`. Fixed-position overlay covering the viewport (`position: fixed; inset: 0;`), matching the plain-scoped-CSS convention already used by `AppSidebar.vue` — no component/styling framework exists yet (spine Deferred list).
  - [x] `listboxId` is a **literal constant string**, e.g. `const listboxId = "command-palette-listbox";` declared once in `<script setup>` — not a generated/unique id. There is exactly one `CommandPalette` instance in the whole app (Task 4), so a hardcoded id can't collide.
  - [x] `activeOptionId = computed(() => results.value[activeIndex.value] ? \`palette-option-${results.value[activeIndex.value].id}\` : undefined)` — must produce the exact same string as the `:id` given to each `<li>` below, since `aria-activedescendant` only works if the two ids match byte-for-byte.
  - [x] Input: `<input ref="inputRef" v-model="query" aria-label="Search tools" placeholder="Search tools by name or alias…" role="combobox" aria-expanded="true" :aria-controls="listboxId" :aria-activedescendant="activeOptionId" />`. `aria-label` satisfies AC4's "input is labeled" without needing a separate visible `<label>` element (AC4 requires the input *be* labeled, not visibly captioned — unlike the sidebar's link text, which had to be visible per Story 1.5's AC1).
  - [x] Results list: `<ul :id="listboxId" role="listbox"><li v-for="(tool, index) in results" :key="tool.id" :id="\`palette-option-${tool.id}\`" role="option" :aria-selected="index === activeIndex" :class="{ active: index === activeIndex }">…</li></ul>` — each `<li>`'s id must use the same `palette-option-${tool.id}` template as `activeOptionId` above.
  - [x] Empty state (AC3): `<p v-if="results.length === 0" role="status">No tools match "{{ query }}".</p>` rendered in place of the `<ul>` — never leave a blank panel when nothing matches.
  - [x] **Focus-visible pattern, and why DOM focus never leaves the input:** AC4 asks for "arrow keys navigate results with visible focus," but actual keyboard/DOM focus stays on the `<input>` the whole time the palette is open — this is the standard ARIA 1.2 "combobox with `aria-activedescendant`" pattern (the same one VS Code's and GitHub's command palettes use): `activeIndex` drives both `aria-selected` (for assistive tech, via `aria-activedescendant` pointing at the active `<li>`'s id) and a `.active` CSS class with a visible highlight style (for sighted users) on the corresponding `<li>`. Don't try to move real DOM focus onto each `<li>` as arrow keys are pressed — that would fight with typing into the input.

- [x] Task 3: Wire the single capture-phase keyboard handler (AC: 1, 2, 4) — this story's AD-14 deliverable
  - [x] In `CommandPalette.vue`, register **one** listener in `onMounted`: `window.addEventListener("keydown", onKeydown, true)` (the trailing `true` is the capture-phase flag AD-14 requires — "one capture-phase handler at app scope"). Remove it in `onUnmounted`. Because `<CommandPalette />` is mounted exactly once (Task 4), this is the app's only ⌘K listener — satisfying AC1's "no tool registers document-level key listeners" by construction, not by convention.
  - [x] `onKeydown` logic, in order — only `preventDefault()` the keys it actually handles, so ordinary typing still reaches the `v-model`-bound input untouched:
    ```ts
    function onKeydown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        open();
        return;
      }
      if (!isOpen.value) return;
      if (event.key === "Escape") { event.preventDefault(); close(); }
      else if (event.key === "ArrowDown") { event.preventDefault(); moveActive(1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); moveActive(-1); }
      else if (event.key === "Enter") { event.preventDefault(); selectActive(); }
      // anything else (letters, backspace, etc.) falls through to the input's v-model
    }
    ```
  - [x] `event.ctrlKey` is checked alongside `event.metaKey` so the shortcut works as Ctrl+K on the Windows/Linux CI runners and any future non-Mac build (NFR3: "codebase stays cross-platform-clean"), even though NFR3 makes macOS the only *fully tested* target for v1.
  - [x] `open()`: capture `document.activeElement as HTMLElement | null` into a plain (non-reactive) variable so `close()` can restore it later; reset `query.value = ""` and `activeIndex.value = 0`; set `isOpen.value = true`; then `await nextTick()` and call `inputRef.value?.focus()` — the element must exist in the DOM (post `v-if`) before it can be focused.
  - [x] `close()`: set `isOpen.value = false`; call `.focus()` on the element captured by `open()`, if it still exists in the DOM — returning keyboard focus to wherever the user was before ⌘K, rather than dropping it to `<body>`.
  - [x] `moveActive(delta)`: `activeIndex.value = (activeIndex.value + delta + results.value.length) % results.value.length` (guard `results.value.length === 0` to avoid a division/modulo by zero when the empty state is showing).
  - [x] `selectActive()`: if `results.value[activeIndex.value]` exists, `router.push({ name: results.value[activeIndex.value].id })` (route names are `tool.id`, established in Story 1.5's `routes` computed — reuse it, don't hardcode `tool.route` path strings), then `close()`. Get `router` via `useRouter()` from `vue-router` inside `setup()`.
  - [x] Whether to toggle-close on a second ⌘K press while already open was considered and rejected for this story: `open()` is idempotent (re-opening while open just refocuses/resets), and `Escape` is the one documented way to close (AC2). Don't add ⌘K-to-close — it's not in any AC and would be one more behavior to keep consistent with `Escape`.

- [x] Task 4: Mount the palette once, app-wide (AC: 1)
  - [x] In `src/App.vue`, add `<CommandPalette />` as a sibling of `<AppSidebar />`/`<RouterView />` inside `.shell` — always present in the DOM (it renders nothing visible while `isOpen` is `false`, per Task 2's `v-if`). One mount site is what makes Task 3's "one listener" claim true; don't mount it per-route or per-tool.

- [x] Task 5: Tests (AC: 1, 2, 3, 4)
  - [x] `src/shell/paletteSearch.spec.ts` — pure-function tests, no mounting: empty query returns all tools unchanged in registry order; a name match ranks above an alias match; a query matching nothing returns `[]`; matching is case-insensitive; an alias `startsWith` match ranks above a `name.includes` match (exercises the tier ordering, not just "some match exists").
  - [x] `src/shell/CommandPalette.spec.ts` — mount with a real `router` (`createAppRouter(pinia)`) and real `pinia` (`createPinia()`) via `global.plugins`, matching Story 1.5's no-mocking convention. **The live registry only has one entry (JSON)** — to test ranking/multi-result behavior, push a second entry directly onto the real store after mounting, e.g. `useRegistryStore(pinia).tools.push({ id: "b64", name: "Base64", aliases: ["b64"], route: "/tools/b64", icon: "#", component: () => Promise.resolve({ template: "<div />" }) })`, then re-query — this is seeding the real store with test data, not mocking its behavior.
    - Dispatch `window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))` and assert the overlay renders (⌘K opens it — AC1).
    - Set the input's value and assert the rendered result list matches `paletteSearch`'s output for that query (AC2).
    - Dispatch `ArrowDown` then `Enter` (as `window` keydown events, since the handler is window-level, not on the input) and assert `router.currentRoute.value.name` changed to the selected tool's id, and the overlay closed afterward (AC2, AC4).
    - Set the input to a query matching nothing and assert the empty-state message renders instead of the `<ul>` (AC3).
    - Assert the active `<li>` has `aria-selected="true"` (and/or the `.active` class) after an `ArrowDown`, and that it's the input — not the `<li>` — holding real DOM focus (`document.activeElement`) throughout, confirming the `aria-activedescendant` pattern from Task 2 (AC4).
    - Dispatch `Escape` and assert the overlay closes (AC2).
  - [x] Run `pnpm test`, `pnpm lint`, and `pnpm build` locally before considering this task done, per the convention every story since 1.5 has followed.

- [ ] Task 6: Commit and open a PR
  - [ ] Branch: `feat/story-1-6-cmdk-command-palette` (repo convention: `feat/story-1-N-<slug>`, matching `feat/story-1-5-navigate-tools-sidebar`).
  - [ ] Conventional Commit, `feat` type, `shell` scope (matching Story 1.5's `feat(shell): add sidebar navigation via tool registry`) — e.g. `feat(shell): add cmd-k command palette over the tool registry`.
  - [ ] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

## Dev Notes

### Architecture compliance for this story

- **AD-14 (this story's core deliverable):** "`⌘K` is one capture-phase handler at app scope. Tools register no document-level listeners of their own." Story 1.5 explicitly deferred this: *"this story does not touch drop dispatch, the clipboard service, or the ⌘K capture-phase handler. Those land with the stories that actually need them... Story 1.6."* Task 3 is that handler — registered exactly once (Task 4 ensures a single mount), covering open (⌘K/Ctrl+K), close (Escape), and in-palette navigation (arrows, Enter) all through the same `window`-level listener. [Source: `ARCHITECTURE-SPINE.md` AD-14]
- **AD-5:** the Tool Registry (`src/stores/registry.ts`) is "the single source that generates the sidebar, the palette index, and the route table." Story 1.5 built the sidebar and route-table consumers and explicitly left the `aliases` field populated-but-unused for this story: *"do not build alias-search/lookup logic (Story 1.6's ⌘K palette)... Populating the fields is in scope; consuming them is not."* This story is that alias-consuming palette — the third and final AD-5 consumer. No registry schema change is needed; `aliases: string[]` already exists on every entry. [Source: `ARCHITECTURE-SPINE.md` AD-5; `1-5-navigate-tools-via-the-sidebar.md` Task 2]
- **AD-6:** "no tool reads another tool's state; cross-cutting state only in Pinia stores `settings` and `registry`." The palette reads the `registry` store (tool list) but its own open/query/selection state is local component `ref`s, not a new store — this state belongs to nobody but the palette itself. [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **NFR5 (accessibility):** "Labels, visible focus states, WCAG AA contrast... checked at PR review from v1." No ARIA-role or keyboard-navigation pattern is prescribed anywhere in the architecture docs (verified — neither `ARCHITECTURE.md` nor `ARCHITECTURE-SPINE.md` mentions `combobox`/`listbox`/`aria-activedescendant`); Task 2's ARIA combobox pattern is this story's own accessible-implementation choice, made because it's the standard pattern real command palettes use, not because it was mandated. [Source: `ARCHITECTURE-SPINE.md` Consistency Conventions table]
- **No styling/component framework exists yet** (spine Deferred list, unchanged since Story 1.5) — plain scoped CSS again, no new UI dependency.
- **No `umbra-core`/`src-tauri` changes.** `paletteSearch.ts` is frontend-only TypeScript, not a "tool transformation" in the AD-1 sense (it doesn't process user tool data — it filters the in-memory tool list) — it does not belong in the Rust core crate. This story touches `src/` only.

### Previous Story Intelligence (from Story 1.5)

- **Both direct handoffs from 1.5 land in this story:** the `aliases` field (populated, unconsumed) and the AD-14 keyboard handler (explicitly deferred) — see the Architecture compliance bullets above. Nothing else was left pending for 1.6.
- **No keyboard handling exists anywhere in the codebase today** — confirmed by 1.5's Dev Notes and by a direct grep of `src/` (`keydown`/`keyup`/`addEventListener` all return nothing). Task 3 is greenfield, not an extension of existing code.
- **Testing convention to continue:** co-locate `*.spec.ts` next to source; mount with a *real* `router` (`createAppRouter(pinia)`) and *real* `pinia` (`createPinia()`) via `global.plugins` — Story 1.5 deliberately avoided mocking the registry store, and Task 5 above extends that by seeding the real store with a second entry rather than mocking `useRegistryStore`.
- **Route names are `tool.id`** (added in Story 1.5's post-review follow-up, commit `81b51f7`) — `selectActive()` in Task 3 must navigate via `router.push({ name: tool.id })`, matching how `router/index.spec.ts` already resolves routes by name. Don't hardcode `tool.route` path strings for navigation.
- **`registry.tools` is currently a single hardcoded entry** (`{ id: "json", ... }`) — Story 1.5 left `registry.tools` as a plain mutable `ref` (flagged as a deferred hygiene item, not fixed here: "no uniqueness guard on registry `id`," "`registry.tools` exposed as a plain mutable `ref`, not wrapped in `readonly()`"). This story doesn't need to fix either — it only reads `registry.tools`, and Task 5's tests use the existing mutability to seed test data, which is compatible with (not blocked by) that deferred item.
- **Component naming:** `eslint-plugin-vue`'s `vue/multi-word-component-names` rule (from `flat/recommended`) is active — `CommandPalette.vue` already satisfies it (two words), unlike the `Sidebar.vue` → `AppSidebar.vue` rename Story 1.5 had to make.
- **No `eslint-plugin-vuejs-accessibility` or similar a11y-lint plugin is installed** (confirmed by reading `eslint.config.js`) — NFR5 compliance for this story is verified by the tests in Task 5 and by manual keyboard/browser verification, not by a lint rule.

### Git Intelligence

- Recent commits (`4cf8b19`, `81b51f7`, `fb2c758`, `3c99c2c`, `99921c7`) are all Story 1.5 work: registry/router/sidebar implementation, a route-naming follow-up, and a production-build fix for the root route (`EmptyState.vue` replacing an inline `template:` string, because Vue's runtime-only build ships no template compiler). No component in the codebase uses an inline `template:` string today — `CommandPalette.vue` should be a normal compiled `.vue` SFC like every other component, avoiding that entire class of bug.
- Branch naming (`feat/story-1-N-<slug>`) and commit scope (`feat(shell): ...`) have been consistent since Story 1.5; Task 6 follows the same shape.
- `package.json` already has everything this story needs (`vue`, `vue-router`, `pinia`, `@vue/test-utils`, `vitest`, `jsdom`) — no new dependency should be added (reinforces Task 1's "no fuzzy-search library" decision).

### Project Structure Notes

- New files: `src/shell/paletteSearch.ts`, `src/shell/paletteSearch.spec.ts`, `src/shell/CommandPalette.vue`, `src/shell/CommandPalette.spec.ts`.
- Modified: `src/App.vue` (mount `<CommandPalette />`).
- Not touched: `src/stores/registry.ts` (schema already supports this story — `aliases` exists), `crates/umbra-core`, `src-tauri/`.
- Confirms `src/shell/` as the established home for shell-owned, cross-tool UI (now: empty state, sidebar, and command palette) — consistent with the Structural Seed comment already written into `registry.ts`'s AD-5 note ("...and (Story 1.6) the ⌘K command palette are all *generated* from `tools`").

### Testing Requirements

- Two new spec files (Task 5): a pure-function suite for `paletteSearch.ts` (no mounting, fast) and a component suite for `CommandPalette.vue` (real router + real pinia, `window`-level keydown dispatch since the handler lives on `window`, not the component root).
- No Rust tests are added or changed — this story is frontend-only.
- `pnpm test` / `pnpm lint` / `pnpm build` must all pass locally before the PR is opened, per every story's convention since CI went live (Story 1.4).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.6: Find tools instantly with ⌘K]
- [Source: `_bmad-output/planning-artifacts/epics.md` — "Architecture decisions binding story implementation": AD-5, AD-6, AD-14; FR2; NFR5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-5, AD-6, AD-14, Structural Seed (`src/shell/`), Consistency Conventions (NFR5), Deferred list ("Styling/component framework")]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "Islands, not a monolith" (AD-5/AD-6 prose)]
- [Source: `_bmad-output/implementation-artifacts/1-5-navigate-tools-via-the-sidebar.md` — Task 2's `aliases`/AD-14 scope guard (explicit handoff to this story), route-naming follow-up (`name: tool.id`), testing convention (real router/pinia, co-located specs), deferred items (`registry.tools` mutability, no `id` uniqueness guard)]
- Live-verified 2026-07-24: `src/stores/registry.ts`'s `ToolRegistryEntry` interface already includes `aliases: string[]`; `src/shell/AppSidebar.vue`, `src/shell/EmptyState.vue`, `src/router/index.ts`, and `src/App.vue` read exactly as Story 1.5 left them (single JSON registry entry, `createAppRouter(pinia)` factory, no keyboard listeners anywhere in `src/`); `package.json` has no unused/extra dependencies beyond what Story 1.5 added; no `eslint-plugin-vuejs-accessibility` or equivalent a11y-lint plugin is configured.

## Change Log

- 2026-07-24: All 6 tasks implemented on `feat/story-1-6-cmdk-command-palette`, branched from an updated `main` (Story 1.5's PR #7 had merged on GitHub since this branch's `baseline_commit`; local `main` was fast-forwarded before branching). `eslint.config.js` gained a `languageOptions.globals: globals.browser` block — the first story to touch `window`/`document`/`KeyboardEvent` directly, and `globals` was already an unused devDependency provisioned for exactly this, so no new dependency was added. `pnpm test`, `pnpm lint`, and `pnpm build` all pass locally. Live browser verification was attempted but not completed (Chrome extension unresponsive) — see Completion Notes.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm test` — 4 test files, 15 tests, all passing.
- `pnpm lint` — clean, zero warnings (`--max-warnings 0`), after fixing genuine `no-undef` errors (browser globals) and auto-fixing Vue template style warnings.
- `pnpm build` — `vue-tsc --noEmit && vite build` succeeds.

### Completion Notes List

- `searchTools` implemented as decorate-sort-undecorate (map to `{tool, rank}` once, filter nulls with a type-predicate, sort by precomputed rank) rather than a comparator calling `rank()` per comparison — avoids recomputing string ops O(n log n) times.
- `CommandPalette.vue` follows the ARIA 1.2 combobox-with-`aria-activedescendant` pattern exactly as specified: real DOM focus never leaves the `<input>`; `activeIndex` drives `aria-selected` and a `.active` class on the corresponding `<li>`.
- Single capture-phase `window` keydown listener registered in `onMounted`/removed in `onUnmounted`; `<CommandPalette />` mounted exactly once in `App.vue`, satisfying AD-14 by construction.
- `eslint.config.js` updated to add `globals.browser` to `languageOptions.globals` — required because this is the first file in the codebase to reference `window`, `document`, `KeyboardEvent`, `HTMLInputElement`, `HTMLElement` directly; `globals` was already listed in `package.json` devDependencies (likely scaffolded but unused until now), so this is a config fix, not a new dependency.
- Test-writing surfaced two non-obvious real-DOM/router behaviors, both fixed in the tests (not the component): (1) `@vue/test-utils`'s `mount()` doesn't attach to `document.body` by default, so `.focus()` assertions on `document.activeElement` require `attachTo: document.body`; (2) `createAppRouter(pinia)` spreads `registry.routes` into a static array at creation time — pushing a new tool into the store *after* the router is created does not add a matching route, so test setup seeds the registry before calling `createAppRouter`. Neither is a story defect; both are documented here for the next story that writes router-aware tests.
- Live browser verification (dev server + Chrome automation) was attempted to confirm the palette in a real window, but the Chrome extension's `tabs_context_mcp` call did not respond (likely a pending permission prompt) after two attempts. Per guidance not to rabbit-hole on unresponsive browser tooling, this was not pursued further. Confidence instead rests on the automated test suite, which mounts the real component with a real `pinia`/`router` attached to `document.body` and dispatches genuine `KeyboardEvent`s at `window` — the same code path a real browser would exercise for AC1–AC4.

### File List

- `src/shell/paletteSearch.ts` (new)
- `src/shell/paletteSearch.spec.ts` (new)
- `src/shell/CommandPalette.vue` (new)
- `src/shell/CommandPalette.spec.ts` (new)
- `src/App.vue` (modified — mount `<CommandPalette />`)
- `eslint.config.js` (modified — added `globals.browser` to `languageOptions.globals`)
