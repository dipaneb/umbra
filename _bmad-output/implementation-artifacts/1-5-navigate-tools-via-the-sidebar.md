---
baseline_commit: 960a774
---

# Story 1.5: Navigate tools via the sidebar

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want a persistent sidebar listing all tools,
so that I can open any tool in the main pane at any time.

## Acceptance Criteria

1. **Given** the app is open, **when** I view the window, **then** a persistent sidebar lists all registered tools with name and icon, sourced solely from the Tool Registry (FR1, AD-5), **and** the UI renders light-mode-first (FR3).
2. **Given** a tool in the sidebar, **when** I select it, **then** its view opens in the main pane via the registry-generated route table, **and** the JSON tool is registered with a placeholder view.
3. **Given** a new tool needs to be added, **when** it is registered, **then** sidebar, palette index, and routes all update from that single registry entry — nothing else enumerates tools (AD-5).
4. **Given** keyboard-only usage, **when** navigating the sidebar, **then** every control is labeled, shows a visible focus state, and selection works without the mouse (NFR5).

## Tasks / Subtasks

- [x] Task 1: Add Vue Router and Pinia, wire Pinia into the app (AC: 1, 2, 3)
  - [x] `pnpm add vue-router pinia` — no version pin, per this repo's established convention ("code owns exact pins at lockfile time," spine Stack table). Spine's verified stack (2026-07-20) lists Vue Router 5.x / Pinia 4.x as the target line; the installed version will resolve to whatever's current at install time.
  - [x] `pnpm add -D @vue/test-utils` — this is the first story with real Vue components to test; Vitest alone (added Story 1.4) can't mount components. Same no-pin convention.
  - [x] In `src/main.ts`, create the Pinia instance and install it: `const pinia = createPinia(); createApp(App).use(pinia).use(router).mount("#app")` (router from Task 3).

- [x] Task 2: Define the Tool Registry as a Pinia store (AC: 1, 2, 3) — AD-5, AD-6
  - [x] Create `src/stores/registry.ts` (Structural Seed: Pinia stores `settings.ts`/`registry.ts` are the only place cross-cutting state may live, AD-6). Use the setup-store syntax (`defineStore('registry', () => { ... })`) — matches this project's TypeScript-first style and is Pinia's current recommended pattern (verified via Context7, `/vuejs/pinia`).
  - [x] Define the full AD-5 entry shape now, even though this story only *uses* a subset of it — so a later story never has to reshape the registry:
    ```ts
    interface ToolRegistryEntry {
      id: string
      name: string
      aliases: string[]
      route: string
      icon: string
      component: () => Promise<Component>
      drop?: { acceptedMimeTypes: string[]; handler: string }
      shortcut?: string
    }
    ```
  - [x] `component` is a lazy route-component loader (e.g. `() => import("../tools/json/JsonView.vue")`) — Vue Router natively accepts this shape for lazy-loaded routes (no `defineAsyncComponent` wrapper needed). This is what makes AC3 literally true: the router (Task 3) reads `component` straight off each registry entry, so there is no second file mapping tool IDs to components.
  - [x] `tools` is a single hardcoded `ref<ToolRegistryEntry[]>([...])` array with exactly one entry — the JSON tool: `{ id: "json", name: "JSON", aliases: ["json", "formatter"], route: "/tools/json", icon: "{ }", component: () => import("../tools/json/JsonView.vue") }`. No dynamic/plugin-based tool loading exists at this stage.
  - [x] Expose a `computed` `routes: RouteRecordRaw[]` derived from `tools` for Task 3 to consume directly.
  - [x] **Scope guard:** `aliases` and `drop`/`shortcut` are declared now (data shape only) because AD-5 fixes the full entry shape once — but do **not** build alias-search/lookup logic (Story 1.6's ⌘K palette) or drop-event dispatch (Epic 2's first file-accepting tool) in this story. Populating the fields is in scope; consuming them is not.

- [x] Task 3: Wire the router from the registry (AC: 2, 3)
  - [x] Create `src/router/index.ts`: `createRouter({ history: createWebHistory(), routes })`, where `routes` comes from the registry store's `routes` getter (Task 2) plus one extra root entry (next bullet). This one file has zero tool-specific knowledge — every tool route it serves is generated, never hand-added.
  - [x] Use `createWebHistory()`, not `createWebHashHistory()` — confirmed with the user 2026-07-24 as a deliberate, informed choice, not a default. In production, `frontendDist` (the built `dist/` folder) is served through Tauri's `tauri://localhost` protocol by literal file path, with no automatic SPA fallback to `index.html` for unmatched paths (Tauri's own SvelteKit integration needs an explicit `fallback: 'index.html'` adapter setting for exactly this reason — confirmed via Context7, `tauri-apps/tauri-docs`). This means a hard reload while sitting on a route like `/tools/json` would 404 inside the webview, since nothing configures that fallback for this Vite-built (non-framework-adapter) frontend. **Accepted risk**, not mitigated in this story: nothing in Epic 1 forces a hard reload on a non-root route (no user-visible address bar, no multi-window deep-linking yet), so the failure mode is currently dormant. If a future story introduces something that could trigger a hard reload mid-route (e.g. multi-window support, or a Tauri-side reload-on-crash path), revisit then — either wire a `tauri://localhost` fallback response for unmatched paths, or switch to `createWebHashHistory()` at that point.
  - [x] Add a root route `path: "/"` with a minimal inline empty-state component (e.g. `{ template: '<p>Select a tool from the sidebar.</p>' }` defined directly in `router/index.ts` — not worth a separate `.vue` file for one sentence). **Do not** auto-redirect `/` to the JSON tool or restore a "last used tool" — that behavior belongs to Story 1.10 (Settings that remember my session); building it early would quietly implement a later story's AC.
  - [x] Install the router in `src/main.ts` (Task 1's `.use(router)`).

- [x] Task 4: Build the JSON placeholder view (AC: 2)
  - [x] Create `src/tools/json/JsonView.vue` per the architecture spine's Structural Seed (`src/tools/<tool-id>/` — tool views as islands, AD-6).
  - [x] Placeholder only: a heading (`JSON`) and one sentence noting the formatter isn't implemented yet. No JSON parsing/formatting logic — that's Story 1.7. The goal here is proving the registry → router → view wiring works end-to-end, nothing more.

- [x] Task 5: Build the sidebar component (AC: 1, 4)
  - [x] Create `src/shell/AppSidebar.vue` per the Structural Seed's `src/shell/` (sidebar/palette/drop/clipboard/shortcut dispatch, AD-14 — this story adds only the sidebar piece; palette and OS-edge dispatch land in Stories 1.6+).
  - [x] **Name it `AppSidebar.vue`, not `Sidebar.vue`.** `eslint-plugin-vue`'s `flat/recommended` config (already active from Story 1.4) enforces `vue/multi-word-component-names` — a single-word component name fails `pnpm lint`.
  - [x] Iterate the registry store's `tools` and render one `<RouterLink :to="tool.route">` per entry. `RouterLink` renders a real `<a>` element — natively focusable, natively activates on Enter, and its text content is its accessible name automatically. This satisfies AC4 (labeled, keyboard-operable, visible focus) without hand-rolled ARIA roles or a custom keydown handler. (AD-14's "one capture-phase keyboard handler" rule governs the ⌘K *shortcut* landing in Story 1.6 — it has no bearing on ordinary Tab-order link navigation here.)
  - [x] Render the icon as `<span aria-hidden="true">{{ tool.icon }}</span>` before the visible name text — the icon is decorative (a placeholder glyph, see Task 2; no icon library or design system exists yet, per the spine's Deferred "Styling/component framework" item), so hide it from assistive tech to avoid a screen reader announcing raw glyph text before the real (name) label.
  - [x] Add an explicit `:focus-visible` style in scoped CSS. Don't rely solely on the webview's default outline — different platform webviews (WebKit/WebView2) render default focus rings inconsistently, and NFR5 requires a *visible* focus state, not just a technically-present one.

- [x] Task 6: Rebuild `App.vue` as the real shell layout (AC: 1, 2)
  - [x] Replace `App.vue`'s scaffold content (Tauri/Vite/Vue logo links, the `greet` invoke demo form) entirely with a two-column layout: `<AppSidebar />` beside `<RouterView />` in the main pane. FR1 requires the sidebar to actually open tools in the main pane — the placeholder demo has no remaining purpose once this exists.
  - [x] Remove the now-unused `greet()` call and its template markup from `App.vue`. Leave the `greet` Tauri command itself in `src-tauri/src/lib.rs` untouched — it's registered via `tauri::generate_handler![greet]`, so it isn't dead code from clippy's point of view (still reachable via IPC) and isn't part of this story's frontend-only scope. Note it as noticed-but-out-of-scope if it comes up in review, not something to silently fix here.
  - [x] Remove the scaffold's `@media (prefers-color-scheme: dark)` block from `App.vue`'s global styles. FR3 ships light-mode-first with dark theme explicitly deferred to v2 — leaving a partial, unmaintained dark-mode media query in place would give a dark-OS user a half-themed shell, which is worse than no dark mode at all. This is a deliberate removal, not an oversight; revisit when v2 builds a real dark theme.

- [x] Task 7: Tests (AC: 1, 2, 3, 4)
  - [x] Co-locate spec files next to source (e.g. `src/shell/AppSidebar.spec.ts`) — Vitest's default `include` glob picks up `*.spec.ts` anywhere under the project without extra config; `vite.config.ts`'s `test` block currently sets nothing but `passWithNoTests`, so no config change is needed for discovery.
  - [x] `AppSidebar.spec.ts`: mount with a real `router` (`createRouter` + `router.push('/')` + `await router.isReady()`, per Vue Test Utils' documented router-testing pattern) and a real `pinia` (`createPinia()` — this store is simple enough that mocking it would test less than using it) passed via `global.plugins: [router, pinia]`. Assert: one link is rendered per registry entry, its text contains the tool's name, and it is a real `<a>` (`RouterLink` renders one) — asserting the semantic element type is the standard way to prove native keyboard-operability in a unit test, since simulating actual Tab-key traversal in jsdom is unreliable.
  - [x] Router test: with the registry's single JSON entry, the generated route table resolves `/tools/json` to `JsonView`.
  - [x] Remove `vite.config.ts`'s `passWithNoTests: true`. Story 1.4's Dev Notes flagged this explicitly: *"Whichever story adds the first real component test (1.5+) should reconsider removing this flag."* This is that story — keeping it once real tests exist risks CI silently passing if a future change accidentally deletes all spec files.
  - [x] Run `pnpm test`, `pnpm lint`, and `pnpm build` (`vue-tsc --noEmit && vite build`) locally before considering this task done. This story is the first to add frontend dependencies and new component files since CI (Story 1.4) went live — catching a lint/type error locally is cheaper than finding it on the CI matrix.

- [x] Task 8: Commit and open a PR
  - [x] Branch: `feat/story-1-5-navigate-tools-sidebar` (repo convention: `feat/story-1-N-<slug>`, matching Stories 1.2–1.4).
  - [x] Conventional Commit, `feat` type: e.g. `feat(shell): add sidebar navigation via tool registry`.
  - [x] Push via a PR against `main` (branch protection requires it, verified Story 1.1; enforced by required status checks since Story 1.4).

### Review Findings

- [x] [Review][Patch] Root route (`/`) fails to render in production — object-literal component uses a `template:` string but Vue's runtime-only bundler build (the default `vue` package export Vite resolves to) ships no template compiler; the built bundle contains the literal string but zero compiler functions, confirmed by building and grepping `dist/assets/index-*.js`. Vitest doesn't catch this because it resolves `vue`'s Node export condition to the full compiler-included build, so the same code renders under test and fails to render in the shipped app — this is the first screen every user sees before selecting a tool. Fixed: replaced with a real `src/shell/EmptyState.vue` SFC (compiled ahead-of-time by `@vitejs/plugin-vue`, sidestepping the runtime-compiler requirement entirely), chosen over an inline render function since this view is expected to grow (pinned favorites, animation). Added a regression test asserting `/` resolves to `EmptyState`. [src/router/index.ts:14]
- [x] [Review][Patch] Dev Agent Record overclaims AC1/AC4 verification — Completion Notes state "All 4 ACs verified via the automated test suite," but `AppSidebar.spec.ts` never asserts the `:focus-visible` CSS rule or light-mode color rendering, and the same notes admit the manual browser check that would have covered these was never completed. Fixed: rescoped the claim to what the automated suite actually covers, and recorded that light-mode rendering and keyboard focus/navigation were confirmed via a manual browser session (2026-07-24). [_bmad-output/implementation-artifacts/1-5-navigate-tools-via-the-sidebar.md:156]
- [x] [Review][Patch] Debug Log References / Testing Requirements understate test count — said "2 tests," but a later Change Log entry added a third router test; count was never updated. Fixed: corrected to the actual current count (4 tests, after the Patch 1 regression test was added). [_bmad-output/implementation-artifacts/1-5-navigate-tools-via-the-sidebar.md:147]
- [x] [Review][Defer] No catch-all/404 route for unmatched paths — renders a blank `RouterView` with no feedback; currently unreachable (no address bar or deep-linking exists yet), revisit once Story 1.6's palette or future deep-linking lands. [src/router/index.ts:10-17] — deferred, pre-existing
- [x] [Review][Defer] No uniqueness guard on registry `id`/route values — router hardcodes a reserved `"home"` route name a future tool entry could collide with; not reachable with today's single-entry registry. [src/stores/registry.ts:16] — deferred, pre-existing
- [x] [Review][Defer] No visual indicator of the currently active tool in the sidebar (no `.router-link-active` styling) — real usability gap, but not required by any of this story's ACs. [src/shell/AppSidebar.vue:34-46] — deferred, pre-existing
- [x] [Review][Defer] `registry.tools` exposed as a plain mutable `ref`, not wrapped in `readonly()` — nothing in this diff mutates it externally, but the AD-5 "single source of truth" comment isn't structurally enforced. [src/stores/registry.ts:16] — deferred, pre-existing
- [x] [Review][Defer] `createWebHistory()`'s hard-reload-404 risk is documented only in this story's Dev Notes prose, not as an in-code comment — already an explicitly accepted risk per the spec, optional hygiene to point future readers here. [src/router/index.ts:9] — deferred, pre-existing
- [x] [Review][Defer] Inconsistent Pinia access pattern — `router/index.ts` takes an explicit `pinia` instance to dodge an ordering hazard, while `AppSidebar.vue` uses the ambient `useRegistryStore()`; both work today only because component `setup()` always runs after `app.use(pinia)`. [src/router/index.ts:6 vs src/shell/AppSidebar.vue:4] — deferred, pre-existing
- [x] [Review][Defer] No error handling for a dynamic tool-component import failure (no `router.onError`) — low reachability since all assets are bundled locally in this desktop app rather than fetched over a network. [src/router/index.ts] — deferred, pre-existing

## Dev Notes

### Architecture compliance for this story

- **AD-5 (this story's core deliverable):** one Tool Registry entry — `{ id, name, aliases, route, icon, drop declarations, shortcut declarations }` — is the only source generating the sidebar, the palette index, and the route table. This story builds the registry and wires two of those three consumers (sidebar, routes); the palette index is Story 1.6's job, consuming the same store. [Source: `ARCHITECTURE-SPINE.md` AD-5]
- **AD-6:** tools are islands; no tool reads another tool's state; cross-cutting state lives only in Pinia `settings`/`registry` stores. This story creates `registry.ts`; `settings.ts` doesn't exist yet and isn't needed until Story 1.10. [Source: `ARCHITECTURE-SPINE.md` AD-6]
- **AD-14:** the shell owns OS I/O edges exactly once — sidebar is part of `src/shell/`, but this story does **not** touch drop dispatch, the clipboard service, or the ⌘K capture-phase handler. Those land with the stories that actually need them (Epic 2's first drop-accepting tool; Story 1.6). Don't pre-build them here.
- **FR3 / light-mode-first:** no dark theme exists in v1. Task 6 removes the scaffold's dark-mode media query rather than leaving it half-applied to the new shell.
- **NFR5 (accessibility):** every sidebar control must be labeled, keyboard-operable, and show visible focus. Task 5 achieves this through native `<RouterLink>` semantics plus an explicit `:focus-visible` style — no custom ARIA roles or roving-tabindex keyboard handler is required by this story's AC4, which asks only that "selection works without the mouse," not arrow-key roving navigation (that pattern, if needed, belongs to Story 1.6's palette, which explicitly calls for arrow-key result navigation).
- **No styling/component framework exists yet** (spine Deferred list, confirmed 2026-07-20 — no UX design contract). This story therefore uses plain scoped CSS and a placeholder text/emoji "icon" rather than adopting an icon library — don't introduce one speculatively.

### Previous Story Intelligence (from Story 1.4)

- **`passWithNoTests: true` was deliberately temporary.** Story 1.4's own Dev Notes named this story as the one to revisit it: *"no Vue component has been built (that starts Story 1.5)... Whichever story adds the first real component test (1.5+) should reconsider removing this flag."* Task 7 closes that loop.
- **`eslint.config.js` already has a per-file override** for `src/vite-env.d.ts` (disables two `@typescript-eslint` rules for that one generated shim). Don't touch it — unrelated to this story's files.
- **CI is live and required** (Story 1.4): `cargo fmt/clippy/test/check` × 3 OSes, plus `eslint`/`vitest`/`build` once on `ubuntu-latest`, all required status checks blocking merge. This story adds no Rust code, so only the ubuntu-only frontend leg (`pnpm lint`, `pnpm test`, `pnpm build`) is actually exercised by these changes — but the 3-OS Rust legs still run (they're required checks on every PR regardless of what changed) and will pass unmodified since `crates/umbra-core` and `src-tauri` aren't touched.
- **Unpinned dependency convention holds:** Story 1.4 added `eslint`/`vitest`/etc. with no version pins, letting the lockfile own exact versions. Task 1 follows the same pattern for `vue-router`/`pinia`/`@vue/test-utils`.
- **Local main was stale before this story was drafted** — PR #5 (Story 1.4) was squash-merged as `960a774` on GitHub, but the local checkout of `feat/story-1-4-ci-guards-every-pr` still carried the pre-squash commits and local `main` hadn't fetched the merge. Resolved by fetching and fast-forwarding `main` before drafting this story. **Start Story 1.5's branch from the now-current `main` (`960a774`), not from the old `feat/story-1-4-...` branch.**

### Git Intelligence

- Branch naming has stayed `feat/story-1-N-<slug>` across every story so far (1.2, 1.3, 1.4); Story 1.5 follows the same shape (Task 8).
- Commit types used so far: `chore`, `feat`, `docs`, `ci` (Story 1.4 was the first `ci`). This story's primary commit is a new frontend feature, so `feat` is correct — first use of a `feat(shell)` scope.
- No prior commit has touched `src/` beyond the untouched scaffold (`App.vue`, `main.ts`, `vite-env.d.ts`) — this story is the first real frontend implementation work in the repo.

### Project Structure Notes

- New files: `src/router/index.ts`, `src/stores/registry.ts`, `src/shell/AppSidebar.vue`, `src/shell/AppSidebar.spec.ts`, `src/tools/json/JsonView.vue`.
- Modified: `src/main.ts` (installs router + pinia), `src/App.vue` (scaffold removed, real shell layout), `package.json` (new deps: `vue-router`, `pinia`; new devDep: `@vue/test-utils`), `pnpm-lock.yaml`, `vite.config.ts` (`passWithNoTests` removed).
- Not touched: anything under `crates/umbra-core` or `src-tauri/` — this story is frontend-only. `src-tauri/src/lib.rs`'s `greet` command is left in place (see Task 6).
- Confirms the spine's Structural Seed `[ASSUMPTION]`-tagged paths (`src/tools/<tool-id>/`, `src/shell/`, `src/stores/`) — this is the first story to actually create them, so it establishes the real convention future stories will follow without further guesswork.

### Testing Requirements

- Component test for `AppSidebar.vue` (registry-driven rendering, real `<a>` elements) and a router test (registry entry → resolved route → correct component) are the two tests this story adds — see Task 7 for the exact mounting pattern (real `router` + real `pinia`, not mocks).
- No Rust tests are added or changed — no `crates/umbra-core` or `src-tauri` code changes in this story.
- `pnpm test`/`pnpm lint`/`pnpm build` must all pass locally before the PR is opened (Task 7's last bullet) — this is the first story to add both new dependencies and new component files since CI went live, so local verification catches issues before burning a CI cycle on the 3-OS matrix.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.5: Navigate tools via the sidebar]
- [Source: `_bmad-output/planning-artifacts/epics.md` — "Additional Requirements" §"Architecture decisions binding story implementation", AD-5, AD-6, AD-14; FR1, FR3; NFR5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-5, AD-6, AD-14, Structural Seed (`src/tools/<tool-id>/`, `src/shell/`, `src/stores/`), Deferred list ("Styling/component framework")]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "Islands, not a monolith" (AD-5/AD-6 prose)]
- [Source: `_bmad-output/implementation-artifacts/1-4-ci-guards-every-pull-request.md` — Dev Notes on `passWithNoTests: true` being provisional; unpinned-dependency convention; CI required-checks shape]
- Context7-verified 2026-07-24: Pinia setup-store syntax (`/vuejs/pinia`, v4 docs); Vue Router `createRouter`/`createWebHistory` and lazy route-component loading (`/vuejs/router`); Vue Test Utils router + Pinia mounting patterns (`/vuejs/test-utils`); Tauri's `frontendDist`/asset-protocol serving behavior and the SvelteKit adapter's explicit `fallback: 'index.html'` requirement, used to assess (and accept) `createWebHistory`'s hard-reload risk (`tauri-apps/tauri-docs`).
- Live-verified 2026-07-24: local `main` was 1 commit behind `origin/main` (Story 1.4's squash-merge, `960a774`) — fetched and fast-forwarded before this story was drafted. `package.json` currently has no `vue-router`, `pinia`, or `@vue/test-utils` dependency; no `src/router/`, `src/stores/`, `src/shell/`, or `src/tools/` directories exist yet.

## Change Log

- 2026-07-24: Story drafted from epics.md Story 1.5. Local `main` was found stale (Story 1.4's PR had merged on GitHub but not been fetched locally) and synced before drafting. Key design decisions made during drafting: `component` loader included directly in the Tool Registry entry shape (not a separate lookup) to make AC3 literally enforced by construction; `createWebHistory` chosen over hash routing per Tauri's own documented guidance; root `/` route deliberately left as a plain empty state rather than redirecting to a tool, to avoid quietly implementing Story 1.10's last-used-tool restore early; `vite.config.ts`'s `passWithNoTests: true` flagged by Story 1.4 for removal here, now scheduled as an explicit task.
- 2026-07-24: All 8 tasks implemented. `src/router/index.ts` restructured as a `createAppRouter(pinia)` factory (instead of a plain exported router instance) to avoid a Pinia "no active instance" failure caused by ES module import ordering — see Completion Notes for the Context7-verified rationale. Added `jsdom` + `test.environment: "jsdom"` to `vite.config.ts` as a prerequisite for Task 7's component/router tests. `pnpm test`, `pnpm lint`, and `pnpm build` all pass locally. Live browser verification was attempted but not completed (Chrome extension unresponsive) — see Completion Notes.
- 2026-07-24: Post-review follow-up (requested in chat, before formal code-review): routes generated from the registry now carry `name: tool.id` (previously path-only), plus a `name: "home"` on the root route; a new router test asserts `router.resolve({ name: "json" })` resolves to `/tools/json`. Added a source-of-truth comment above `useRegistryStore` explaining AD-5 (sidebar/router/palette are all generated from `tools`, nothing else hand-lists tools) — an intentional exception to this codebase's no-comments default, since the invariant isn't obvious from the code shape alone. `pnpm test`/`lint`/`build` re-verified.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm test` — 2 test files, 4 tests, all passing.
- `pnpm lint` — clean, zero warnings (`--max-warnings 0`).
- `pnpm build` (`vue-tsc --noEmit && vite build`) — type-checks clean; production build emits `JsonView` as its own lazy-loaded chunk (`dist/assets/JsonView-*.js`), confirming the registry → router → view wiring code-splits correctly end-to-end.

### Completion Notes List

- **Deviation from the story's literal `main.ts` snippet, with justification:** the story's Task 1 pseudocode (`const pinia = createPinia(); createApp(App).use(pinia).use(router).mount(...)`) implies importing a ready-built `router` object into `main.ts`. Because ES modules evaluate all static imports before any code in the importing file runs, a plain `import router from "./router"` would execute `router/index.ts` — and any `useRegistryStore()` call inside it — *before* `main.ts`'s own `createPinia()` line ever runs, throwing Pinia's "no active Pinia" error. This is documented explicitly in Pinia's own docs (verified via Context7, `/vuejs/pinia`, "Accessing stores outside of setup"), which show this exact failure mode and its fix: pass the `pinia` instance explicitly into the store getter instead of relying on the ambient "active pinia". Implemented as `src/router/index.ts` exporting `createAppRouter(pinia: Pinia): Router`, called from `main.ts` as `const router = createAppRouter(pinia)` right after `const pinia = createPinia()` — functionally identical to the story's intent, just restructured to be import-order-safe.
- **Added `jsdom` + `test.environment: "jsdom"`, not called out in the story's task list:** Task 7 requires mounting real Vue components (`AppSidebar.spec.ts`) and exercising `createWebHistory()` in the router test, both of which need real DOM/`window.history` APIs. Vitest defaults to a `node` environment with no DOM; this was a necessary prerequisite for Task 7's own explicit requirements, verified against Vitest's current docs (Context7, `/vitest-dev/vitest`).
- Router test resolves `/tools/json` via an actual `router.push()` + `router.isReady()` (not `router.resolve()`), because Vue Router only replaces a route's lazy-loader with the resolved component during real navigation guards (`extractComponentsGuards`), confirmed via Context7 (`/vuejs/router`) — `router.resolve()` alone would leave `components.default` as the still-unresolved loader function.
- AC2/AC3 verified via the automated test suite: `router/index.spec.ts` confirms the registry entry resolves to a route rendering `JsonView`, with no second file enumerating tools. AC4's keyboard-operability (real `<a>` elements, one per tool, labeled with the tool name) is verified by `AppSidebar.spec.ts`. AC4's visible-focus-state and keyboard-only navigation, and AC1's light-mode-first rendering, are not asserted by any automated test but were manually verified in a browser session (2026-07-24, post-review) — both work as implemented.
- **UI verification limitation (resolved post-review):** the dev server was started (`pnpm dev`, confirmed serving `200` at `localhost:1420`) intending to visually confirm sidebar navigation in a browser, but the Chrome browser-automation extension did not respond during the original implementation session, so a live visual check wasn't completed at that time. A manual browser pass was completed afterward (2026-07-24), confirming light-mode rendering and keyboard-only focus/navigation both work correctly.

### File List

- `package.json` — added `vue-router`, `pinia` (dependencies); `@vue/test-utils`, `jsdom` (devDependencies)
- `pnpm-lock.yaml` — updated
- `src/main.ts` — modified: installs Pinia and the router via `createAppRouter(pinia)`
- `src/App.vue` — modified: scaffold removed, replaced with `AppSidebar` + `RouterView` two-column shell; dark-mode media query removed
- `src/stores/registry.ts` — new: Pinia setup-store, `ToolRegistryEntry` interface, single JSON tool entry, `routes` computed
- `src/router/index.ts` — new: `createAppRouter(pinia)` factory, root empty-state route + registry-generated routes
- `src/router/index.spec.ts` — new: router resolves `/tools/json` to `JsonView`
- `src/shell/AppSidebar.vue` — new: registry-driven `RouterLink` list, accessible icon, focus-visible style
- `src/shell/AppSidebar.spec.ts` — new: renders one real `<a>` per registry entry, labeled with the tool name
- `src/tools/json/JsonView.vue` — new: placeholder view
- `vite.config.ts` — modified: `test.environment: "jsdom"` added, `passWithNoTests: true` removed
