---
baseline_commit: fbeaf20
---

# Story 1.10: Settings that remember my session

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a returning Umbra user,
I want the app to reopen where I left off — and to see and clear everything it stores,
so that persistence is convenient and fully transparent.

## Acceptance Criteria

1. **Given** the restore toggle is on (its default), **when** I relaunch the app, **then** the last used tool and window geometry are restored (FR5), **and** geometry is captured frontend-side on debounced move/resize and routed through the `settings` Pinia store (AD-10).
2. **Given** the Settings pane, **when** I open it, **then** it shows the restore toggle and enumerates every persisted key from the `shell.*` / `<tool-id>.*` namespaces, **and** a single action clears all persisted state (INV-3, AD-10).
3. **Given** the app's persistence surface, **when** audited, **then** the only mechanism is `tauri-plugin-store` writing one `settings.json`, whose single writer is the frontend `settings` store — Rust-side code never writes it (AD-10).
4. **Given** the restore toggle is off, **when** I quit and relaunch, **then** no session state is restored and no stale values are written.

## Tasks / Subtasks

- [x] **Task 1: Add `tauri-plugin-store` — the app's first persistence mechanism** (AC: 3)
  - [x] `src-tauri/Cargo.toml`: add `tauri-plugin-store = "2"` (unpinned major, matching this project's existing convention for `tauri-plugin-opener`/`tauri-plugin-clipboard-manager`; architecture spine observed 2.4.x at authoring time — that's a snapshot, not a hard pin).
  - [x] `package.json`: add `@tauri-apps/plugin-store` (runtime `dependencies`, not `devDependencies` — same category as `@tauri-apps/plugin-clipboard-manager`). Run `pnpm install` to update `pnpm-lock.yaml`.
  - [x] `src-tauri/src/lib.rs`: register the plugin alongside the existing two: `.plugin(tauri_plugin_store::Builder::new().build())`.
  - [x] `src-tauri/capabilities/default.json`: add `"store:default"` to the `permissions` array (Context7-verified against `tauri-docs` v2, 2026-07-27: this is the plugin's documented default permission bundle covering `load`/`get`/`set`/`save`/`entries`/`clear` from JS — no finer-grained permission is needed).
  - [x] **Do not write any new `#[tauri::command]`s for settings.** `tauri-plugin-store`'s JS API (`load`, `store.get/set/save/entries/clear`) talks directly to the plugin's own built-in IPC handlers registered by step above — there is no Rust command layer to author here. This is also why AC3 is satisfiable at all: if a hand-rolled Rust command touched `settings.json`, "Rust-side code never writes it" would be false by construction.
  - [x] `crates/umbra-core` is untouched by this story — settings persistence is shell-level state (AD-10), not a tool transformation, so none of AD-1/AD-2's "every transformation is a core function" applies here.

- [x] **Task 2: Build the `settings` Pinia store — the single writer for `settings.json`** (AC: 1, 2, 3, 4)
  - [x] New file `src/stores/settings.ts`. Load the store once via `load('settings.json', { autoSave: false })` from `@tauri-apps/plugin-store` (explicit `autoSave: false` — this store calls `.save()` itself after every mutation, so writes are traceable and testable rather than happening on an implicit timer or at process exit).
  - [x] Keys, namespaced per AD-10's `shell.*` / `<tool-id>.*` rule (no `<tool-id>.*` keys exist yet — no tool has opted into persistence — but the Settings pane in Task 5 must not assume that stays true):
    - `shell.restoreSessionEnabled: boolean` — default `true` when absent (FR5: "controlled by a toggle... default on"). Read as `(await store.get<boolean>("shell.restoreSessionEnabled")) ?? true`.
    - `shell.lastTool: string` — the active tool's registry `id` (route name), written on navigation.
    - `shell.windowGeometry: { x: number; y: number; width: number; height: number }` — physical pixels (see Task 3 for why physical, not logical).
  - [x] Exposed actions, all going through this one store (nothing else in the app ever imports `@tauri-apps/plugin-store` directly):
    - `setRestoreEnabled(value: boolean)`: updates the local ref immediately, then `store.set("shell.restoreSessionEnabled", value)` + `store.save()`. Not debounced — a toggle flip is a single deliberate user action, not a rapid-fire stream like a drag.
    - `recordLastTool(toolId: string)`: **must check `restoreEnabled` first and no-op entirely if it's `false`.** This is the mechanism that makes AC4's "no stale values are written" true — the gate belongs here, once, not duplicated at each call site (Task 4's router hook just calls this unconditionally on every navigation; it doesn't need its own `if (restoreEnabled)` check).
    - `recordWindowGeometry(geometry)`: same `restoreEnabled` gate as above, wrapped in a debounced writer (see Task 3) so a drag doesn't hit disk on every pixel.
    - `entries(): Promise<[string, unknown][]>` — wraps `store.entries()` for Task 5's dynamic enumeration.
    - `clearAll(): Promise<void>` — wraps `store.clear()` + `store.save()`. After clearing, `restoreEnabled`'s local ref must reset to `true` (the default) since the key backing it no longer exists — don't leave the in-memory ref pointing at a stale pre-clear value.
  - [x] **The `restoreEnabled` gate is the crux of this story's most easily-missed correctness requirement.** A wrong-but-plausible implementation gates only the *restore-on-launch* read and still unconditionally records `lastTool`/geometry on every navigation/move regardless of the toggle — that satisfies AC1 but silently fails AC4 ("no stale values are written" while the toggle is off), because flipping the toggle back on later would then restore geometry/tool captured *while it was supposedly off*. Gate the writes, not just the launch-time read.

- [x] **Task 3: Capture window geometry — debounced, frontend-side (AD-10)** (AC: 1, 4)
  - [x] New file `src/shell/windowGeometry.ts` (or a composable colocated with the settings store — either is fine, but keep it out of `App.vue`/`main.ts` bodies so it's unit-testable in isolation). Use `getCurrentWindow()` from `@tauri-apps/api/window`.
  - [x] Wire `getCurrentWindow().onMoved(({ payload: position }) => ...)` and `.onResized(({ payload: size }) => ...)` (both confirmed via Context7 against `tauri.app`'s JS API reference, 2026-07-27: `onMoved` delivers `PhysicalPosition`, `onResized` delivers `PhysicalSize`, both return `Promise<UnlistenFn>`). On each event, call the settings store's debounced geometry writer with the combined `{x, y, width, height}` — reuse `debounce()` from `src/shell/debounce.ts` (already established in Story 1.8 for tree-parse debouncing; do not write a second debounce implementation). ~300ms is a reasonable interval (Story 1.8's tree-parse debounce uses 200ms for a different, latency-sensitive purpose; geometry writes have no such urgency, so slightly longer is fine and cuts disk writes further during a drag).
  - [x] **Store physical units on both sides — capture and restore.** `onMoved`/`onResized` deliver `PhysicalPosition`/`PhysicalSize`; `setPosition` expects an outer position and `setSize` expects an inner size (Context7-verified: `setSize`'s docs explicitly say "new inner size"). Pairing `onResized`'s payload straight into `setSize()` and `onMoved`'s straight into `setPosition()` — both as `Physical*` types, no logical-unit conversion — avoids a scale-factor bug that would otherwise show up only when relaunching on a different-DPI display than the one that captured the geometry. Don't introduce `LogicalPosition`/`LogicalSize` anywhere in this path.
  - [x] These listeners must not be wired until *after* Task 4's restore-on-launch calls (`setPosition`/`setSize`) have already resolved. Wiring them earlier means the act of restoring geometry fires `onMoved`/`onResized` for the restore itself, and if the debounced writer is live at that point it just re-persists the same value (wasteful but harmless) — the actually dangerous ordering is wiring them *before* the settings store has finished its initial `load()`, which would let an early, incidental resize event overwrite good stored geometry with default/transient values before it's ever read back. Sequence: load settings → restore geometry → *then* attach listeners.

- [x] **Task 4: Restore-on-launch sequencing — no flash, no race** (AC: 1, 4)
  - [x] `src-tauri/tauri.conf.json`: set `"visible": false` on the `app.windows[0]` entry. Without this, the window always appears at the configured default (800×600, OS-placed) for a frame or more before JS applies the restored geometry, producing a visible pop-then-jump on every relaunch — a real, avoidable defect for a portfolio-quality app, not cosmetic polish to skip. `getCurrentWindow().show()` must then be called explicitly once (see below) — if this call is ever skipped on some code path, the window never appears at all, so make sure every branch (restore-on, restore-off, no-stored-geometry) reaches it.
  - [x] `src/main.ts`: convert the bootstrap to an async function performing, in order:
    1. Create `pinia` and `router` exactly as today (both stay synchronous — `createAppRouter` doesn't need to change).
    2. `await` the settings store's initialization (its `load()` call) — expose this as an explicit async init function from `src/stores/settings.ts` (e.g. `settings.init()`) rather than relying on import-time side effects, so tests can control timing.
    3. If `settings.restoreEnabled` is `true`:
       - If `settings.lastTool` names a tool that still exists in the registry, `await router.replace({ name: settings.lastTool })`. Guard the "still exists" check — a future registry change removing a tool must fall back silently to `/`, never throw. Because this happens before `app.mount()`, there's no visible navigation flash; Vue hasn't rendered anything yet.
       - If `settings.windowGeometry` is set, `await` both `getCurrentWindow().setPosition(...)` and `.setSize(...)` with the stored physical values (see Task 3's inner/outer pairing).
    4. `createApp(App).use(pinia).use(router).mount("#app")`.
    5. `await getCurrentWindow().show()` — always reached, restore-on or off, with or without stored geometry.
    6. *After* mount, wire: a `router.afterEach` hook calling `settings.recordLastTool(to.name)` on every successful navigation, and Task 3's `onMoved`/`onResized` listeners. Wiring both here — after the restore calls in step 3, not before — is what Task 3's ordering note depends on.
  - [x] **Wrap steps 2–3 (settings init + restore) in `try`/`finally`, not a bare `await` chain.** The window starts invisible (`"visible": false` above); if `settings.init()` throws (corrupted `settings.json`, plugin IPC failure) or any restore call rejects, an unhandled rejection would abort the bootstrap *before* step 5's `show()` ever runs — the app would launch with no visible window and no error surfaced, which is strictly worse than the pop-then-jump this pattern exists to avoid. Structure it so `mount()` + `show()` happen in a `finally` (or equivalent try/catch that falls through to them on error), so a failed restore degrades to "app opens at default geometry/route," never to "app doesn't appear at all."
  - [x] `router.afterEach((to) => settings.recordLastTool(to.name))`: vue-router 5's `to.name` is typed `RouteRecordNameGeneric` (`string | symbol | undefined`), not `string` — under this project's TypeScript `strict` convention, guard with `if (typeof to.name === "string") settings.recordLastTool(to.name);` rather than passing it straight through to `recordLastTool(toolId: string)`.
  - [x] `settings.recordLastTool`/`recordWindowGeometry` are called unconditionally from these hooks (per Task 2, they self-gate on `restoreEnabled`) — don't add a second `if (restoreEnabled)` check in `main.ts` or the router hook; one source of truth for the gate.

- [x] **Task 5: Settings pane — shell-level view, not a tool** (AC: 2)
  - [x] New file `src/shell/SettingsView.vue`, colocated with `AppSidebar.vue`/`CommandPalette.vue` (Structural Seed: `src/shell/` is app chrome; `src/tools/<tool-id>/` is for actual tools). **Do not add Settings to `src/stores/registry.ts`.** AD-5's registry and AD-6's "tools are islands" both scope to actual tool transformations (JSON, Base64, etc.) — Settings isn't one, and registering it there would make it searchable in ⌘K and iterable alongside real tools, which nothing in this story's ACs asks for and would blur AD-6's boundary.
  - [x] Route: add a static entry directly in `src/router/index.ts`'s existing routes array, the same way `"home"` already is — e.g. `{ path: "/settings", name: "settings", component: SettingsView }` — **not** generated from `registry.routes`.
  - [x] Nav entry: add one link in `src/shell/AppSidebar.vue` pointing at `/settings`, written directly in the template (not looped from `registry.tools`) — e.g. placed after the `<ul>` of tools, same labeling/focus conventions as the existing tool links (`aria-label`, visible `:focus-visible` outline — copy the existing pattern in that file, don't invent a new one).
  - [x] Content:
    - A labeled checkbox/switch bound to `settings.restoreEnabled`, calling `setRestoreEnabled` on change.
    - A **dynamically rendered** list from `await settings.entries()` — iterate whatever keys actually exist in the store and render each `key`/value pair (e.g. `JSON.stringify(value)` for readability). Do not hardcode "the 2-3 keys this story happens to introduce": AD-10's own wording is "enumerates every persisted key from the `shell.*` / `<tool-id>.*` namespaces" precisely because future tool stories will add `<tool-id>.*` keys this view must show without a code change. A hardcoded list is the single most likely way this story quietly breaks INV-3's transparency promise two stories from now.
    - A "Clear all" button calling `settings.clearAll()`, then re-fetching `entries()` to refresh the displayed list (don't leave stale entries showing after a successful clear).
  - [x] Accessibility: labeled controls and visible focus states are a project-wide bar from v1 (Consistency Conventions table, NFR5) even though this story's ACs don't restate it as its own line item the way Stories 1.5/1.6/1.8 did — match those stories' existing pattern, don't skip it because it isn't spelled out here.

- [x] **Task 6: Tests**
  - [x] `src/stores/settings.spec.ts`: mock `@tauri-apps/plugin-store`'s `load` with the same module-factory pattern already used for `@tauri-apps/plugin-clipboard-manager` in `src/shell/clipboard.spec.ts` (`vi.mock("@tauri-apps/plugin-store", () => ({ load: () => Promise.resolve(fakeStore) }))`, `fakeStore` exposing `vi.fn()`s for `get`/`set`/`save`/`entries`/`clear`). Cover: `restoreEnabled` defaults to `true` when the key is absent; `recordLastTool`/`recordWindowGeometry` write when enabled and no-op when disabled (the AC4 guardrail from Task 2 — this is the single most important test in this story); `clearAll` calls `clear`+`save` and resets `restoreEnabled` to `true`.
  - [x] Geometry-capture spec (wherever Task 3 lives): mock `@tauri-apps/api/window`'s `getCurrentWindow` returning fake `onMoved`/`onResized`/`setPosition`/`setSize`; use fake timers (already the file-wide pattern in `JsonView.spec.ts`/`debounce.spec.ts`) to assert the write is debounced — multiple rapid move events collapse into one persisted write after the delay, and nothing is written before it elapses.
  - [x] `src/shell/SettingsView.spec.ts`: toggle interaction calls `setRestoreEnabled`; entries render from a fake store's `entries()` (assert the list reflects whatever the fake returns, not a fixed hardcoded set — this is what actually tests the "dynamic enumeration" requirement from Task 5); clicking "Clear all" calls `clearAll` and the list re-renders empty.
  - [x] `src/router/index.spec.ts`: add a case resolving `/settings` to `SettingsView`, and assert `registry.tools` still has length 1 (proving the new route did *not* come from the registry — guards against a future accidental registry entry).
  - [x] Rust: no new command tests are needed (Task 1) — confirm `cargo test --workspace` still passes unchanged; the plugin registration in `lib.rs` adds no testable Rust surface of its own.

- [ ] **Task 7: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`.
  - [ ] Manual `pnpm tauri dev` check (the only way to evidence AC1/AC4's actual restore/non-restore behavior, same precedent as Stories 1.7–1.9): move/resize the window, switch to the JSON tool, quit, relaunch — confirm the same tool and geometry come back. Open Settings, confirm the listed keys match what's actually on disk (macOS: `~/Library/Application Support/com.dipaneb.umbra/settings.json`, per this app's bundle identifier in `tauri.conf.json`). Turn the toggle off, move the window and switch tools, quit, relaunch — confirm nothing restores, and confirm (by inspecting `settings.json` before/after) that `shell.lastTool`/`shell.windowGeometry` did **not** change while the toggle was off. Click "Clear all" — confirm the pane empties and the toggle shows its default-on state.
    - Automated confirmation only: `pnpm tauri dev` was launched (see Dev Agent Record) and compiled/ran without crashing or console errors; the interactive drag/resize/relaunch/settings.json checks require a human at the native window and are **not yet done**.

- [ ] **Task 8: Commit and open a PR**
  - [ ] Branch: `feat/story-1-10-<slug>` (repo convention).
  - [ ] Conventional Commit(s), `feat` type scoped to `settings`/`shell` as size warrants.
  - [ ] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

### Review Findings

- [x] [Review][Patch] Pending debounced `shell.windowGeometry` write is never cancelled when restore is toggled off or "Clear all" runs, so a write scheduled just before either action still lands afterward — violates AC4's "no stale values are written" and INV-3's "one action clears all persisted state" [src/stores/settings.ts:43-48,58-62,73-80] — fixed: `setRestoreEnabled(false)` and `clearAll()` both call `writeGeometry.cancel()` before returning; added regression tests covering both paths.
- [x] [Review][Patch] Visiting the Settings route overwrites `shell.lastTool` with `"settings"`, a non-restorable route id, silently discarding the real last-used tool for the next launch's restore [src/main.ts:47-51] — fixed: `router.afterEach` now only calls `recordLastTool` when `to.name` matches a `registry.tools` id.
- [x] [Review][Patch] `getStore()` throws unguarded on every settings call after a failed `init()` (corrupted `settings.json` / plugin IPC failure) — `router.afterEach`'s `recordLastTool` and `SettingsView`'s `refreshEntries`/toggle/clear all then produce unhandled rejections for the rest of the session, and the Settings pane misleadingly shows "Nothing is currently persisted" [src/stores/settings.ts:23-28; src/main.ts:47-51; src/shell/SettingsView.vue:8-22] — fixed: `init()` now catches a `load()`/`get()` failure and leaves `backingStore` unset; every action (`setRestoreEnabled`, `recordLastTool`, `writeGeometry`, `entries`, `clearAll`) checks `backingStore` and no-ops instead of throwing. `getStore()` removed as dead code. Added a regression test for the degrade-to-defaults path.
- [x] [Review][Patch] Fire-and-forget settings store writes (`writeGeometry`'s `store.set().then(store.save)`, `SettingsView`'s toggle/clear handlers) have no `.catch`, so an IPC/disk rejection fails silently with no user-visible error [src/stores/settings.ts:58-62; src/shell/SettingsView.vue:14-22] — fixed: `writeGeometry` catches and logs; `onToggleRestore` and `onClearAll` in `SettingsView.vue` catch and log.

Post-patch verification: `pnpm lint` and `pnpm test` (86/86 pass, 3 new regression tests) both clean.

## Dev Notes

### Architecture compliance for this story

- **AD-10 (this story's core deliverable):** single persistence mechanism (`tauri-plugin-store` → one `settings.json`), single writer (the frontend `settings` Pinia store — Rust never writes it), `shell.*`/`<tool-id>.*` key namespacing, Settings pane enumerates every persisted key with a one-action clear, geometry captured frontend-side on debounced move/resize. Every clause of AD-10 maps directly onto an AC or a task above. [Source: `ARCHITECTURE-SPINE.md` AD-10]
- **AD-5/AD-6 (Settings is not a tool):** the Tool Registry is scoped to actual tool transformations; Settings is shell-level chrome per the Structural Seed's `src/shell/` directory. Adding it to the registry would make it ⌘K-searchable and registry-iterable, which nothing here calls for and would blur AD-6's "tools are islands" boundary. [Source: `ARCHITECTURE-SPINE.md` AD-5, AD-6]
- **AD-1/AD-2 (unaffected):** `crates/umbra-core` is untouched by this story — there's no "transformation" here, only shell-level state, so the functional-core rule simply doesn't apply. Don't add a settings module to `umbra-core` looking for a place to put this logic; it belongs entirely in the frontend store per AD-10.
- **NFR2 (cold launch < 2s):** Task 4's hide-then-show sequence adds one `load()` await plus two lightweight window calls before `show()` — negligible against the 2s budget, but don't add anything heavier to that critical path (no network, no large computation) since it now gates first paint.
- **INV-3 (visible, one-action-clearable persistence):** the dynamic-enumeration requirement in Task 5 is what keeps this true as an invariant rather than a one-time snapshot — a hardcoded key list in the Settings pane would silently violate INV-3 the moment a future story adds a `<tool-id>.*` key.
- **No `unwrap`/`expect` in command paths, clippy `-D warnings`, TypeScript `strict`** (Consistency Conventions table) — unchanged from prior stories; this story adds no new Rust command paths at all (Task 1), so the surface for this rule to apply to is minimal.

### Previous Story Intelligence

- **From Story 1.8:** `src/shell/debounce.ts`'s `debounce<Args>()` already exists and is exactly the right tool for geometry-write debouncing (Task 3) — it's a generic, already-tested utility (`debounce.spec.ts`), not something to reimplement. Story 1.8 also established the "cancel pending work in `onUnmounted`" pattern (`JsonView.vue`'s `debouncedParse.cancel()`) — the geometry listeners in Task 3 are attached for the app's lifetime rather than a component's, so there's no analogous unmount to cancel on, but keep the reference in mind if geometry capture ever moves into a component.
- **From Story 1.7:** the exact `vi.mock` module-factory pattern for stubbing `@tauri-apps` packages already exists in `src/shell/clipboard.spec.ts` (and `src/shell/invoke.spec.ts`) — Task 6 reuses this pattern verbatim for `@tauri-apps/plugin-store` and `@tauri-apps/api/window`, rather than inventing a different mocking style.
- **From Story 1.9 (most recent):** this story's own git-intelligence context (below) shows every commit since Story 1.6 has touched only JSON-tool files. Story 1.10 is the first to touch `main.ts`, `router/index.ts`, `AppSidebar.vue`, and `tauri.conf.json` since Story 1.6 — i.e., the first real test of whether the shell-level conventions those stories established (registry-driven routes/sidebar, one clipboard service, one invoke helper) hold up when a genuinely new, non-tool feature needs to integrate with them. They do, per this story's design (Task 5's explicit "don't touch the registry" calls), but this is worth double-checking against the actual code before assuming any pattern still fits unchanged.
- **Testing convention to continue:** co-locate `*.spec.ts` next to source; don't mock this project's own code, only platform/third-party boundaries (`@tauri-apps/*` packages) — unchanged from every prior story.

### Git Intelligence

- Last 5 commits (`fbeaf20`, `20df019`, `0c1c4d2`, `05fd420`, `7285cba`) are all Story 1.7–1.9 JSON-tool work, touching only `crates/umbra-core/src/json.rs`, `src-tauri/src/commands/json.rs`, and `src/tools/json/*`. None of them touched `main.ts`, `App.vue`, `router/`, `AppSidebar.vue`, `Cargo.toml`, `lib.rs`, `capabilities/default.json`, or `tauri.conf.json` — this story is the first in several cycles to touch the app's bootstrap/shell/config surface rather than tool-internal logic, and the first to add a new Cargo/npm dependency since Story 1.7 (clipboard-manager) / Story 1.8 (`@tanstack/vue-virtual`).
- Baseline commit for this story: `fbeaf20` (current `main` tip at story creation time).

### Project Structure Notes

- **New:** `src/stores/settings.ts` (+ `.spec.ts`), `src/shell/windowGeometry.ts` (+ `.spec.ts`), `src/shell/SettingsView.vue` (+ `.spec.ts`).
- **Modified:** `src/main.ts` (async bootstrap sequencing — Task 4), `src/router/index.ts` (+`/settings` static route), `src/shell/AppSidebar.vue` (+Settings nav link), `src-tauri/Cargo.toml` (+`tauri-plugin-store`), `src-tauri/src/lib.rs` (+plugin registration), `src-tauri/capabilities/default.json` (+`store:default`), `src-tauri/tauri.conf.json` (+`"visible": false` on the main window), `package.json`/`pnpm-lock.yaml` (+`@tauri-apps/plugin-store`).
- **Not touched:** `crates/umbra-core` (no core logic — see AD-1/AD-2 note above), `src/stores/registry.ts` (Settings is deliberately not a registry entry), `src/tools/json/*` (unrelated to this story).

### Testing Requirements

- TypeScript: `pnpm test` covering the new settings-store, geometry-capture, and `SettingsView` specs (Task 6), plus the extended `router/index.spec.ts`. Reuse existing mocking (`vi.mock` module factories) and fake-timer (debounce) patterns rather than introducing new ones.
- Rust: `cargo test --workspace` must still pass; no new Rust tests are expected since this story adds no custom commands.
- `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `pnpm lint`, `pnpm build` all pass locally before the PR (unchanged from prior stories).
- Manual: `pnpm tauri dev`, per Task 7 — this is the only way to evidence AC1's actual restore behavior and AC4's actual non-restore/no-stale-write behavior end to end.
- Out of scope for this story: any `<tool-id>.*` persisted keys for individual tools (no tool has state worth persisting yet); a `settings.json` schema-migration mechanism across releases (spine's Deferred section already flags this as a pre-Epic-2 concern, not this story's).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.10: Settings that remember my session; FR5, AD-10, INV-3]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — FR5 (restore toggle, default on); INV-3 (visible, one-action-clearable persistence)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-10 (persistence rule, this story's core deliverable); AD-5/AD-6 (why Settings isn't a registry entry); Stack table (`tauri-plugin-store` 2.4.x / `@tauri-apps/plugin-store` 2.4.4 observed); Deferred section (`settings.json` schema-migration note, out of scope here)]
- [Source: `_bmad-output/implementation-artifacts/1-9-stay-responsive-on-10mb-documents.md` — established `debounce()` reuse precedent, `vi.mock` mocking conventions, manual `pnpm tauri dev` verification precedent]
- Live-verified this session by direct file read: `src/App.vue`, `src/main.ts`, `src/router/index.ts`, `src/stores/registry.ts`, `src/shell/AppSidebar.vue`, `src/shell/clipboard.ts`/`clipboard.spec.ts`, `src/shell/debounce.ts`, `src/tools/json/JsonView.vue` (debounce usage precedent), `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, `package.json` — confirmed `tauri-plugin-store`/`@tauri-apps/plugin-store` are not yet a dependency anywhere in the codebase; this story introduces them for the first time.
- Context7 (`/tauri-apps/tauri-docs`, verified this session, 2026-07-27): `tauri-plugin-store` Cargo/npm package names and `Builder::new().build()` registration; `"store:default"` capability permission; JS API shape (`load`, `store.get/set/save`). Context7 (`/websites/tauri_app` JS API reference, verified this session): `getCurrentWindow().onMoved`/`.onResized` deliver `PhysicalPosition`/`PhysicalSize` and return `Promise<UnlistenFn>`; `setPosition` takes an outer position, `setSize` takes an inner size — the exact pairing Task 3's inner/outer note is built around.

## Change Log

- 2026-07-27: Tasks 1–6 implemented on `feat/story-1-10-settings-that-remember-my-session`, branched from the story's `baseline_commit` (`fbeaf20`). Added `tauri-plugin-store` as the app's first persistence mechanism, with the frontend `settings` Pinia store as its sole writer (AD-10). Restore-on-launch sequencing rewritten in `src/main.ts` as an async bootstrap with the window hidden until mount+show, guaranteeing the app always becomes visible even if restore fails. Settings pane added as shell-level chrome (not a registry tool), dynamically enumerating persisted keys per INV-3. `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` (32 tests, unchanged), `pnpm lint`, `pnpm test` (83 tests across 14 files), `pnpm build`, and `vue-tsc --noEmit` all pass. Task 7's manual `pnpm tauri dev` interactive walkthrough (drag/resize/relaunch, settings.json inspection, toggle-off behavior) is still outstanding — flagged for the user.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm tauri dev` launched successfully: Vite dev server up, Rust binary compiled and ran with no console errors; process terminated by a 25s harness timeout, not a crash. Full interactive verification (drag/resize, quit/relaunch, settings.json inspection, toggle-off behavior) still needs a human at the native window — not something this agent can drive (no CDP-equivalent bridge for a Tauri/WKWebView window).

### Completion Notes List

- Added `tauri-plugin-store` (2.4.4) as the app's first persistence mechanism; no new Rust commands were written — the plugin's JS API talks directly to its own IPC handlers, satisfying AC3's "Rust-side code never writes it".
- Built `src/stores/settings.ts` as the single writer for `settings.json`, with the `restoreEnabled` gate applied inside `recordLastTool`/`recordWindowGeometry` themselves (not at call sites), so toggling restore off actually stops writes rather than just skipping the launch-time read (AC4).
- `src/shell/windowGeometry.ts` merges `onMoved`/`onResized` events (both `Physical*`) into a combined `{x,y,width,height}` and forwards to the settings store's already-debounced `recordWindowGeometry` — kept the debounce in one place (the store) rather than duplicating it here.
- Reworked `src/main.ts` into an async bootstrap: settings init → conditional route/geometry restore → `mount()`/`show()` in a `finally` block (window starts hidden via `tauri.conf.json`'s `"visible": false`) → post-mount `router.afterEach` and geometry-listener wiring. A failed restore now degrades to default geometry/route instead of leaving the window invisible.
- Added `src/shell/SettingsView.vue` (shell-level, not registry-registered per AD-5/AD-6) with a restore toggle and a dynamically enumerated, re-fetched-after-clear list of persisted entries — verified with a test asserting entries not hardcoded.
- Updated pre-existing `AppSidebar.spec.ts`, which asserted "one `<a>` per registry tool", to scope that assertion to `ul a` and added a separate case for the new non-registry Settings link.
- All automated gates pass: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --workspace` (32 tests, unchanged), `pnpm lint`, `pnpm test` (83 tests, 14 files), `pnpm build`, `vue-tsc --noEmit`.
- **Outstanding:** Task 7's manual `pnpm tauri dev` walkthrough (drag/resize, quit/relaunch persistence, settings.json inspection, toggle-off no-stale-write check) has not been performed interactively — flagged to the user for hands-on verification before this story is considered evidenced end-to-end.

### File List

- `src-tauri/Cargo.toml` (+`tauri-plugin-store`)
- `Cargo.lock`
- `src-tauri/src/lib.rs` (+plugin registration)
- `src-tauri/capabilities/default.json` (+`store:default`)
- `src-tauri/tauri.conf.json` (+`"visible": false`)
- `package.json` (+`@tauri-apps/plugin-store`)
- `pnpm-lock.yaml`
- `src/stores/settings.ts` (new)
- `src/stores/settings.spec.ts` (new)
- `src/shell/windowGeometry.ts` (new)
- `src/shell/windowGeometry.spec.ts` (new)
- `src/shell/SettingsView.vue` (new)
- `src/shell/SettingsView.spec.ts` (new)
- `src/main.ts` (async bootstrap sequencing)
- `src/router/index.ts` (+`/settings` static route)
- `src/router/index.spec.ts` (+`/settings` route case)
- `src/shell/AppSidebar.vue` (+Settings nav link)
- `src/shell/AppSidebar.spec.ts` (scoped registry-link assertion + new Settings-link case)
