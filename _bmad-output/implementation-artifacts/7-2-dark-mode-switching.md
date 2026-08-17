---
baseline_commit: 017bb42f54db8a3efc6c6e656982b68c1200c2e4
---

# Story 7.2: Dark-mode switching

Status: done

## Story

As a privacy-conscious developer,
I want to switch the app between light and dark and have every subsequent screen already work in both,
so that the whole app is verifiable in both modes as it's built, not retrofitted at the end.

## Acceptance Criteria

1. Given the `settings` store (AD-10), When this story lands, Then it gains `shell.themeOverride: "system" | "light" | "dark"` (default `"system"`), the single writer for theme state.
2. Given the resolved theme (override, or OS `prefers-color-scheme` when set to `"system"`), When it changes, Then the root element's `data-theme` attribute updates immediately — the whole app repaints with no reload, and Story 7.1's CSS custom properties resolve against `[data-theme="dark"]` in addition to the `prefers-color-scheme` fallback already wired in 7.1.
3. Given a control to change the override, When this story ships, Then a minimal, functional toggle exists (placed in the current flat `SettingsView.vue`, unstyled) purely so 7.3 onward can be built and tested in both modes — its permanent, sectioned, token-styled home is Story 7.6's (Settings restructure) job, not this one's; this story owns the mechanism, not its final UI.
4. Given `DESIGN.md`'s already-verified WCAG AA contrast pairs for both palettes, When this story ships, Then no new contrast work is needed — this story is wiring, not design.

## Tasks / Subtasks

- [x] Task 0: Confirm baseline (AC: all)
  - [x] Branch from `origin/main` at `017bb42` (Story 7.1's squash-merge, `#78`) — local `main` and `origin/main` are already identical at this commit, no content-diff reconciliation needed.

- [x] Task 1: Add `shell.themeOverride` to the settings store (AC: 1)
  - [x] In `src/stores/settings.ts`, add `export type ThemeOverride = "system" | "light" | "dark";` and a `themeOverride = ref<ThemeOverride>("system")`.
  - [x] In `init()`, read it the same way `restoreEnabled`/`lastTool` are read: `themeOverride.value = (await store.get<ThemeOverride>("shell.themeOverride")) ?? "system";`
  - [x] Add `async function setThemeOverride(value: ThemeOverride): Promise<void>` mirroring `setRestoreEnabled`'s shape exactly (update the ref, guard on `backingStore`, `set` + `save`).
  - [x] In `clearAll()`, reset `themeOverride.value = "system"` alongside the existing resets (mirrors `restoreEnabled`'s reset-to-default — AD-10 requires every persisted key to come back via the one-action clear).
  - [x] Export `themeOverride` and `setThemeOverride` from the store's return object.
  - [x] `entries()` and the "Persisted data" list in `SettingsView.vue` need no changes — both already enumerate whatever's in `backingStore` generically.

- [x] Task 2: Build the resolution + DOM-attribute mechanism (AC: 2)
  - [x] New file `src/shell/theme.ts`, modeled on `src/shell/windowGeometry.ts`'s "attached once for the app's lifetime, not a component's" pattern:
    - `resolveTheme(override: ThemeOverride, prefersDark: boolean): "light" | "dark"` — pure function; `"system"` resolves via `prefersDark`, `"light"`/`"dark"` pass through.
    - `applyResolvedTheme(resolved: "light" | "dark"): void` — sets `document.documentElement.dataset.theme = resolved`.
    - `attachThemeListener(settings: ReturnType<typeof useSettingsStore>): void` — creates `const media = window.matchMedia("(prefers-color-scheme: dark)")`, applies once immediately, then keeps it live via (a) `media.addEventListener("change", ...)` and (b) a Vue `watch(() => settings.themeOverride, ...)`, both recomputing through `resolveTheme`/`applyResolvedTheme`.
  - [x] Wire into `src/main.ts`'s `bootstrap()`: call `applyResolvedTheme(resolveTheme(settings.themeOverride, window.matchMedia("(prefers-color-scheme: dark)").matches))` once, right after `await settings.init()` and **before** the `finally` block's `mount()`/`show()` — the window starts invisible (`tauri.conf.json`'s `"visible": false`, per the existing restore-flow comment in `main.ts`) specifically so state applies before first paint; reuse that same window to avoid a flash of the wrong theme. Call `attachThemeListener(settings)` after `mount()` for ongoing reactivity (system-preference changes, toggle changes).
  - [x] In `src/styles/tokens.css`, add two new attribute-selector blocks, **not** replacing the existing `@media (prefers-color-scheme: dark)` block:
    - `:root[data-theme="dark"] { ... }` — duplicate the dark block's values.
    - `:root[data-theme="light"] { ... }` — duplicate the light (base `:root`) block's values.
    - **Why both are required, not just dark:** `:root[data-theme="X"]` has higher CSS specificity than a bare `:root` selector (with or without a media-query wrapper), so it always wins regardless of source order. Without the `[data-theme="light"]` block, choosing "Light" while the OS is set to dark would do nothing — the `@media (prefers-color-scheme: dark)` block has the _same_ specificity as plain `:root` and would still apply. Both attribute blocks are what actually let an explicit choice override the OS setting in either direction.
    - When `themeOverride === "system"`, `data-theme` should not be set at all (or removed) so the existing `:root` / `@media` fallback from Story 7.1 keeps working unchanged.

- [x] Task 3: Minimal, unstyled toggle in `SettingsView.vue` (AC: 3)
  - [x] Add a `<select>` (or three radio inputs) bound to `settings.themeOverride`, three options `system`/`light`/`dark`, calling `settings.setThemeOverride` on change — same shape as the existing `onToggleRestore` handler (catch + `console.error` on failure, no UI error state).
  - [x] Give it an explicit `aria-label` (matches the existing restore-toggle checkbox) — NFR5 requires every control to be labeled/VoiceOver-readable and to carry a visible focus state; `SettingsView.vue`'s existing `input:focus-visible, button:focus-visible` rule needs a `select:focus-visible` sibling if a `<select>` is used, since that selector list is exhaustive, not a wildcard.
  - [x] Do **not** build 7.6's sectioned/styled Settings pane — stay inside the current flat structure, unstyled, next to or under the existing Privacy section.
  - [x] In `SettingsView.spec.ts`, extend the existing `stubbedSettingsStore()` helper to stub `themeOverride`/`setThemeOverride`, then add a test mirroring the existing `"toggling the restore checkbox calls setRestoreEnabled"` test: changing the new control calls `setThemeOverride` with the selected value, and the control reflects `settings.themeOverride` on render. Without this, the toggle could ship wired to nothing and no test would catch it — the same "defined but never actually applied" gap class flagged elsewhere in these Dev Notes.

- [x] Task 4: Confirm AC4 needs no design work (AC: 4)
  - [x] Spot-check that `tokens.css`'s existing dark-mode hex/rgba values match `DESIGN.md`'s frontmatter token tables exactly (they already do, per Story 7.1) — this task is a confirmation, not new work. No contrast recalculation needed.

- [x] Task 5: Tests for `theme.ts`
  - [x] `resolveTheme`: table-test all four meaningful inputs (`"system"` + `prefersDark` true/false, `"light"`, `"dark"`).
  - [x] `attachThemeListener`: stub `window.matchMedia` (jsdom has no built-in implementation — a naive test throws `matchMedia is not a function`; provide a fake `MediaQueryList` with `matches`, `addEventListener`, `removeEventListener`). Verify `document.documentElement.dataset.theme` updates when (a) `settings.themeOverride` changes and (b) a simulated `change` event fires on the fake media query list while override is `"system"`.

- [x] Task 6: Extend `tokens.spec.ts`
  - [x] Add assertions (following the file's existing source-text-assertion convention — `fs.readFileSync`, not `getComputedStyle`) that `:root[data-theme="dark"]` and `:root[data-theme="light"]` blocks exist and that their `--color-bg-base` values match the existing dark/light blocks respectively.

- [x] Task 7: Extend `settings.spec.ts`
  - [x] Default `themeOverride` to `"system"` when the key is absent (mirrors the existing `restoreEnabled` default test, reuse `createFakeStore()`).
  - [x] `setThemeOverride` persists via `fakeStore.set`/`save` and updates the ref.
  - [x] `clearAll` resets `themeOverride` back to `"system"`.

- [x] **Task 8: Manual verification — outside a sandboxed coding session's reach**
  - [x] `pnpm tauri dev`: exercise all three states (System, Light, Dark) against both OS appearance settings; confirm no flash-of-wrong-theme on launch; confirm the toggle persists across a relaunch; confirm explicit "Light" while macOS is set to Dark actually renders light (the specificity fix from Task 2, the one prior stories' manual checks have caught real gaps in before).

### Review Findings

**Decision needed:**

- [x] [Review][Decision] `resolveTheme`/`applyResolvedTheme` always write a concrete `data-theme` value, even when `themeOverride === "system"` — contradicts Task 2's explicit instruction that `data-theme` "should not be set at all (or removed)" in the system case so the 7.1 `@media` fallback "keeps working unchanged." In practice, once JS runs, the new `:root[data-theme]` attribute blocks (not the `@media` block) become the effective source of truth for system mode too, since attribute selectors out-specificity both the bare `:root` and the media-query block regardless of source order — a different architecture than specified, with an ongoing two-copies-must-stay-synced risk for every token added going forward. **Resolved:** rather than either literal option, the developer chose a third path — collapse to a single mechanism entirely. The bare `:root` color/`--shadow-floating` values and the `@media (prefers-color-scheme: dark)` block were deleted outright; `:root[data-theme="light"]`/`:root[data-theme="dark"]` are now the sole declaration site for every color/shadow token. This is sound specifically because Umbra is a Tauri webview (JS always runs, unlike a server-rendered web page) and `main.ts`'s pre-paint bootstrap already guarantees `data-theme` is set before the invisible-until-shown window ever paints — so the CSS-only fallback the media query provided was never actually load-bearing here. Zero duplication remains; `theme.ts`'s always-concrete `resolveTheme` is now simply correct rather than a deviation. [`src/styles/tokens.css`, `src/shell/theme.ts`]

**Patch:**

- [x] [Review][Patch] No runtime validation of `ThemeOverride` at either persistence boundary — `settings.ts`'s `init()` trusts `store.get<ThemeOverride>(...)`'s generic type parameter with no membership check, and `resolveTheme`'s fallthrough (`return override;`) passes any non-`"system"` string straight through. A corrupted/hand-edited `settings.json` value now renders with *no* matching `[data-theme]` block at all (every color/shadow custom property resolves to nothing, since the bare `:root` fallback was removed as part of resolving the decision above) rather than degrading to a system-like default — an unvalidated external-input boundary the codebase's own AD-10 convention treats as needing a guard. **Fixed:** `settings.ts` gained an `isThemeOverride` type guard applied at load time (falls back to `"system"` for anything else); `theme.ts`'s `resolveTheme` now explicitly whitelists `"light"`/`"dark"` and resolves everything else (including `"system"` and any invalid value) via `prefersDark` — defense-in-depth at both boundaries. Covered by new tests in both spec files. [`src/stores/settings.ts:13-20,38-43`, `src/shell/theme.ts:4-10`]
- [x] [Review][Patch] `attachThemeListener` redundantly recomputes and re-applies the theme a second time on every launch — `main.ts`'s pre-paint call already applies it once, then `attachThemeListener`'s own `recompute()` immediately re-does the same work via a second, independent `matchMedia` object. Harmless today (same OS read, milliseconds apart) but pure redundant work. **Fixed:** removed the separate explicit `applyResolvedTheme(resolveTheme(...))` call from `main.ts`; `attachThemeListener(settings)` alone (moved earlier — see the next item) now does the one pre-paint application via its own initial `recompute()`, plus wires up ongoing reactivity. `main.ts` no longer imports `resolveTheme`/`applyResolvedTheme` directly. [`src/shell/theme.ts:19-32`, `src/main.ts`]
- [x] [Review][Patch] `tokens.spec.ts`'s attribute-block parity test ("redefines color tokens under explicit data-theme attribute blocks") only compares `--color-bg-base` between each new attribute block and its existing base/media counterpart — 1 of 13 custom properties per block. This story's own Dev Notes call the CSS specificity work "the single highest-risk part of this story"; a future one-property drift in any of the other 12 (e.g. `--shadow-floating`, `--color-accent-destructive`) would go completely undetected. **Resolved as a side effect** of the decision item above: the media-query comparison test was replaced with three tests asserting (a) no color/shadow token exists outside the two `[data-theme]` blocks, (b) both blocks declare the same property set (aside from the documented `--color-accent-signature-on-text` exception), and (c) every shared property actually differs in value between them — full coverage of all properties, not just one. [`src/styles/tokens.spec.ts`]
- [x] [Review][Patch] No `color-scheme` CSS property declared anywhere. Custom tokens repaint correctly, but native form controls (including the new `<select>` itself) and OS/browser chrome (scrollbars, etc.) keep rendering per the OS's native scheme — so an explicit override that disagrees with the OS setting (exactly the "explicit Light while OS Dark" scenario Task 8 calls out as the historically-missed case) will show a visually mismatched native dropdown. **Fixed:** added `color-scheme: dark;`/`color-scheme: light;` to the respective `:root[data-theme]` blocks. [`src/styles/tokens.css`]
- [x] [Review][Patch] `attachThemeListener(settings)` and `attachWindowGeometryListeners(...)` are both called after `bootstrap()`'s `try/finally` block, not inside it. If any restore step inside the `try` throws (`router.replace`, `appWindow.setPosition`/`setSize` on corrupted geometry), `finally` still mounts and shows the window, but the exception then propagates past both attach calls — the app opens looking correct once, but silently loses live theme reactivity (OS changes, in-app toggle changes) and geometry persistence for the rest of the session, with only a `console.error`. Pre-existing structural risk for the geometry listener; this story adds theme reactivity to the same blast radius, and there is zero test coverage of this bootstrap ordering. **Partially fixed:** `attachThemeListener(settings)` moved inside the `try` block, immediately after `settings.init()` and before the restore steps — theme reactivity is now wired up before anything in the restore path can throw. `attachWindowGeometryListeners` was **not** moved: it seeds its tracked geometry from the window's *current* position/size (`windowGeometry.ts:15-16`), which is only correct once the restore step's `setPosition`/`setSize` calls have already run — moving it earlier would seed stale geometry on every launch that restores a non-default window position. That half of the finding is a genuine pre-existing gap, unrelated to theming, and out of this story's scope to restructure; not re-added as a separate defer entry since it predates this story and isn't new. [`src/main.ts`]

**Defer:**

- [x] [Review][Defer] No teardown/lifecycle guard for `attachThemeListener`'s `media.addEventListener` or its `watch()` — no stop handle is captured, and nothing guards against double-attachment stacking duplicate listeners. [`src/shell/theme.ts:19-32`] — deferred, pre-existing: matches `windowGeometry.ts`'s already-established "attached once for the app's lifetime, not a component's" pattern that this file's own code comment cites as its precedent; `watch()` outside an effect scope also triggers a Vue dev-mode-only warning (stripped from production builds).
- [x] [Review][Defer] `setThemeOverride` optimistically updates `themeOverride.value` before the persistence `await` completes, so a failed `store.set`/`save` leaves the UI/DOM showing the new theme while nothing was written to disk (silently reverts on next relaunch, only a `console.error`, no visible user feedback). [`src/stores/settings.ts:55-61`, `src/shell/SettingsView.vue:21-26`] — deferred, pre-existing: this exactly mirrors `setRestoreEnabled`'s existing shape, which Task 1 explicitly instructed the developer to replicate ("mirroring `setRestoreEnabled`'s shape exactly").
- [x] [Review][Defer] `focus-visible` outline color is hardcoded (`#396cd8`) rather than token-driven, so it won't adapt between light/dark and its contrast against the new dark background is unverified. [`src/shell/SettingsView.vue:129-134`] — deferred, pre-existing: the hardcoded value predates this story (already present for `input`/`button`); this diff only extends the same existing selector group to add `select`. Story 7.6 owns the token-styled Settings pass.

## Dev Notes

- **Architecture fit:** This is a pure frontend change. AD-10 (`ARCHITECTURE-SPINE.md`) — `settings` Pinia store is the sole writer to `settings.json` via `tauri-plugin-store`; `shell.themeOverride` is a new key, not a rename/retype of an existing one, so the settings-schema-migration deferral (AD-10 note) does **not** trigger. AD-6 ("tools are islands") — theme is exactly the kind of cross-cutting shell state that belongs in `settings`/`registry`, never duplicated per-tool; no tool code is touched by this story.
- **No new dependency.** `window.matchMedia` is a standard Web API, already available in Tauri's webview — there is no Tauri OS-appearance plugin in the Stack table and none is needed. The "Dependency version/API drift" Consistency Convention (re-verify pre-1.0/stale-pinned deps against vendored source) does not apply here; skip hunting for a plugin that doesn't exist.
- **FR3 (PRD, scope-updated 2026-08-15):** _"Mode selection follows OS appearance by default, with a manual override persisted via AD-10's `settings` store."_ — this is the literal spec for AC1/AC2; `"system"` as the default is a PRD-level decision, not a story-local choice.
- **NFR5 (PRD):** accessibility baseline — visible focus states, labeled/VoiceOver-readable controls, WCAG AA contrast (4.5:1). Contrast is already satisfied by `DESIGN.md`'s locked tokens (AC4); the toggle control itself must still carry an explicit label and a visible focus-visible style (Task 3).
- **The CSS specificity mechanic in Task 2 is the single highest-risk part of this story** — it's easy to wire only a `[data-theme="dark"]` block (since that's what the epic text mentions first) and end up with an "explicit Light while OS is Dark" bug that looks correct in the common case (OS light + no override, OS dark + no override, OS light + explicit dark) and only breaks in the one combination nobody tests by accident. Both attribute blocks are required.
- **Existing code to extend, not replace** (all confirmed by direct reads, not inferred):
  - `src/styles/tokens.css` — light values under bare `:root`, dark values under `@media (prefers-color-scheme: dark) { :root { ... } }` (Story 7.1). Values themselves are already correct and AA-verified; this story only adds two new selector blocks repeating them.
  - `src/stores/settings.ts` — `restoreEnabled`/`setRestoreEnabled` is the direct template for `themeOverride`/`setThemeOverride` (ref, guarded `backingStore` write, `set`+`save`).
  - `src/shell/SettingsView.vue` — `onToggleRestore`'s checked/`aria-label`/`@change` pattern is the direct template for the new control.
  - `src/shell/windowGeometry.ts` — `attachWindowGeometryListeners`'s "attached once for the app's lifetime in `main.ts`, not a component's `onUnmounted`" comment is the exact pattern `attachThemeListener` should follow.
  - `src/main.ts` — the window starts invisible (`tauri.conf.json`) specifically so restore-flow state can apply pre-paint; this story's initial theme application belongs in that same pre-`mount()` window for the same reason (avoid flash of wrong theme).
- **From Story 7.1 (done, direct prerequisite):** 7.1's own Dev Notes state explicitly — _"No new persisted state, no `settings.json`/AD-10 involvement — the resolved theme is computed live from `prefers-color-scheme`, not stored anywhere; Story 7.2 is where a persisted override first appears."_ Confirms this story is the first to touch `settings.json` for theming. 7.1 also left its own manual dark-mode toggle check unverified (no display server) — Task 8 here is the first real verification of the whole mechanism end-to-end, not just this story's new pieces.
- **Explicitly out of scope:** styled/sectioned Settings UI for the toggle (Story 7.6 — do not build it early); any Card/grid-home work (Story 7.3); any new contrast/design pass (AC4).

### Project Structure Notes

- New: `src/shell/theme.ts`, `src/shell/theme.spec.ts`.
- Modified: `src/stores/settings.ts` (+ `settings.spec.ts`), `src/styles/tokens.css` (+ `tokens.spec.ts`), `src/shell/SettingsView.vue` (+ `SettingsView.spec.ts`), `src/main.ts`.
- No `src-tauri/`/Rust changes — theming is frontend-only; persistence reuses the existing AD-10 mechanism with one new namespaced key.
- Testing convention (all confirmed from existing spec files): co-located `*.spec.ts`; Vitest; `tokens.spec.ts` uses source-text assertions via `fs.readFileSync` (not `getComputedStyle` — jsdom doesn't reliably load external CSS) with `// @ts-expect-error` on `node:fs`/`node:url`/`node:path` (no `@types/node` in this project); `settings.spec.ts` uses a `createFakeStore()` in-memory fake plus `vi.useFakeTimers()`/`setActivePinia(createPinia())` per test.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7 intro, Story 7.2]
- [Source: _bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md#FR3, #NFR5]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md — AD-10, AD-6, Consistency Conventions ("Dependency version/API drift"), Structural Seed]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/DESIGN.md — Colors token tables (light/dark pairs), WCAG AA notes]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-umbra-2026-08-15/EXPERIENCE.md — Flow 5 step 2]
- [Source: _bmad-output/implementation-artifacts/7-1-design-tokens-and-icon-system-land-in-the-shell.md — Dev Notes, File List, Change Log]
- [Source: src/stores/settings.ts, src/styles/tokens.css, src/shell/SettingsView.vue, src/App.vue, src/main.ts, src/shell/windowGeometry.ts, src/styles/tokens.spec.ts, src/stores/settings.spec.ts — read directly for this story]

## Change Log

- 2026-08-17: Code review resolved. The one `decision-needed` item (`resolveTheme` always
  writing a concrete `data-theme` even for `"system"`, versus Task 2's literal "leave it
  unset" instruction) was resolved by collapsing to a single mechanism entirely: the bare
  `:root` color/`--shadow-floating` values and the `@media (prefers-color-scheme: dark)`
  block were deleted, leaving `:root[data-theme="light"]`/`:root[data-theme="dark"]` as the
  sole declaration site for every color/shadow token — sound specifically because this is a
  Tauri webview (JS always runs) with a pre-paint bootstrap that already guarantees
  `data-theme` is set before the invisible-until-shown window can paint. All 4 `patch`
  findings applied: `ThemeOverride` is now validated at both the `settings.json` load
  boundary and `resolveTheme`'s fallthrough; the redundant double theme-computation on
  launch was removed by moving `attachThemeListener` inside `main.ts`'s `try` block (ahead
  of the restore steps that could throw, and serving as the sole pre-paint application);
  `color-scheme` was added to both `[data-theme]` blocks so native controls follow an
  explicit override too; `tokens.spec.ts`'s single-property parity check was replaced with
  full-coverage tests (no color/shadow token outside the two blocks, same property set in
  both, every shared property genuinely differs). 3 `defer` findings logged to
  `deferred-work.md` (all pre-existing patterns, not introduced by this story). Full
  verification green: 262/262 Vue tests (246 baseline + 16 net new), lint/typecheck/build
  all clean; Rust suite unchanged (zero `src-tauri/` files touched).

- 2026-08-16: Implementation complete: Tasks 0-7 done (settings-store persistence, the
  `theme.ts` resolution/DOM-attribute mechanism wired into `main.ts`'s pre-paint bootstrap,
  the two new `tokens.css` attribute-selector blocks, the minimal `SettingsView.vue` toggle,
  and full test coverage across all four touched/new files). Task 8's manual `pnpm tauri dev`
  verification (all three theme states, flash-of-wrong-theme check, relaunch persistence, the
  explicit-Light-while-OS-Dark specificity check) deferred to the developer — no display
  server in this sandboxed session, same limitation as every prior story. Full verification
  green: 259/259 Vue tests (246 baseline + 13 new), 213/213 Rust tests (unchanged, zero
  `src-tauri/` files touched), lint/typecheck/build all clean.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

### Completion Notes List

- Implementation complete: Tasks 0-7 done, Task 8's manual `pnpm tauri dev` GUI smoke check
  (all three theme states against both OS appearance settings, flash-of-wrong-theme check,
  relaunch persistence, and the explicit-Light-while-OS-Dark specificity check) deferred to
  the developer — this sandboxed session has no display server, same limitation as every
  prior story.
- Branched `feat/story-7-2-dark-mode-switching` from `origin/main` at `017bb42` (Task 0) —
  confirmed identical to the story's own `baseline_commit`, no content-diff reconciliation
  needed.
- Task 1 (`src/stores/settings.ts`): added `ThemeOverride` type and `themeOverride` ref,
  following `restoreEnabled`/`setRestoreEnabled`'s exact shape (init-time read with a
  `?? "system"` default, guarded `backingStore` write via `set`+`save`, reset in `clearAll`).
  No changes needed to `entries()`/`SettingsView.vue`'s "Persisted data" list — both already
  enumerate `backingStore` generically, confirmed by inspection rather than assumed.
- Task 2 (`src/shell/theme.ts`, new file): `resolveTheme`/`applyResolvedTheme`/
  `attachThemeListener` implemented exactly to the story's specified signatures.
  `attachThemeListener` is attached once in `main.ts`, mirroring `windowGeometry.ts`'s
  documented "app lifetime, not a component's" pattern. Wired into `bootstrap()`: the initial
  `applyResolvedTheme(resolveTheme(...))` call sits right after `await settings.init()` and
  before the `finally` block's `mount()`/`show()`, reusing the existing pre-paint window
  (`tauri.conf.json`'s `"visible": false`) to avoid a flash of the wrong theme; `attachThemeListener(settings)`
  is called after the `finally` block, alongside `attachWindowGeometryListeners`, for ongoing
  reactivity. `tokens.css` gained the two new `:root[data-theme="dark"]`/`:root[data-theme="light"]`
  attribute-selector blocks (verbatim duplicates of the existing dark-media/light-base blocks) —
  the existing `@media (prefers-color-scheme: dark)` block is untouched, preserving the
  Story 7.1 fallback for when no `data-theme` attribute reasoning is in play. One implementation
  note not fully anticipated at drafting: `resolveTheme` always returns a concrete `"light"`/`"dark"`
  value per its own specified signature (never an "unset" sentinel), so `applyResolvedTheme` always
  sets `data-theme` to a concrete value, including when the override is `"system"` — this is
  behaviorally identical to leaving the attribute unset in that case, since both attribute blocks
  are exact duplicates of the corresponding bare-`:root`/media-query block, but it's a literal
  reading of the given function signatures rather than a third "no attribute" state threaded through
  them. Recorded inline as an implementation note under Task 2 rather than left silently divergent
  from the task's own prose.
- Task 3 (`src/shell/SettingsView.vue`): added a minimal `<select aria-label="Theme">` with
  `system`/`light`/`dark` options, bound to `settings.themeOverride`, calling
  `settings.setThemeOverride` on change with the same catch+`console.error` shape as
  `onToggleRestore`. Added a `select:focus-visible` sibling to the existing exhaustive
  `input:focus-visible, button:focus-visible` rule (NFR5). Stays inside the current flat,
  unstyled structure — no sectioned Settings UI built early (Story 7.6's job).
- Task 4: spot-checked `tokens.css`'s existing (and newly duplicated) dark-mode hex/rgba
  values against `DESIGN.md`'s frontmatter `colors`/`components.floating-surface` tables —
  exact match, confirmed by direct comparison, not assumed from Story 7.1's prior claim. No
  contrast recalculation performed, as scoped.
- Tasks 5-7: new `src/shell/theme.spec.ts` (8 tests: 4-case `resolveTheme` table test, an
  `applyResolvedTheme` DOM assertion, and 3 `attachThemeListener` tests against a hand-built
  fake `MediaQueryList` — jsdom has no built-in `matchMedia`); `tokens.spec.ts` gained 1 test
  asserting both new attribute blocks exist and their `--color-bg-base` values match the
  corresponding existing blocks; `settings.spec.ts` gained 3 tests (default, persist, clear);
  `SettingsView.spec.ts` gained 1 test (control reflects `themeOverride` on render, calls
  `setThemeOverride` on change) after extending `stubbedSettingsStore()`. All new tests written
  and confirmed failing before their corresponding implementation, per the red-green-refactor
  cycle.
- Full verification green: 259/259 Vue tests (246 baseline + 13 new), 213/213 Rust tests
  (unchanged — zero `src-tauri/` files touched, confirmed via `git status --porcelain`),
  `pnpm lint`/`vue-tsc --noEmit` (via `pnpm build`)/`pnpm build` all clean.

### File List

**New:** `src/shell/theme.ts`, `src/shell/theme.spec.ts`.

**Modified:** `src/stores/settings.ts`, `src/stores/settings.spec.ts`, `src/styles/tokens.css`,
`src/styles/tokens.spec.ts`, `src/shell/SettingsView.vue`, `src/shell/SettingsView.spec.ts`,
`src/main.ts`.

## Previous Story Intelligence (Story 7.1)

- Token file `src/styles/tokens.css` (created by 7.1): all light-mode primitives under `:root`; dark-mode redefines the _same_ property names inside `@media (prefers-color-scheme: dark) { :root { ... } }` — not separately-named properties. Only colors + `--shadow-floating` have dark variants; typography/spacing/radius don't.
- 7.1's File List: new `src/styles/tokens.css`, `tokens.spec.ts`, `src/shell/icons.ts`, `icons.spec.ts`, `src/App.spec.ts`; modified `src/main.ts`, `src/App.vue`, `src/stores/registry.ts` (+spec), `src/shell/AppSidebar.vue` (+spec), `src/shell/CommandPalette.vue` (+spec), `dropZone.spec.ts`, `paletteSearch.spec.ts`, `package.json`/`pnpm-lock.yaml`, `ARCHITECTURE-SPINE.md`, `DESIGN.md`.
- Recurring gotcha class to watch for: a token/selector block defined but never actually applied is a silent no-op (7.1 hit this with the font-family name; this story's own dark-mode-block risk in Task 2 is the same shape) — Task 8's manual check is the only thing that actually proves the attribute mechanism works, not just compiles.

## Git Intelligence Summary

- Story 7.1 landed as commit `017bb42` — `feat(story-7-1): design tokens and icon system land in the shell (#78)`, squash-merged, 22 files changed matching its File List above.
- Commit/PR convention to follow: `feat(story-7-2): <title> (#<PR>)`, body ending `Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>`.
- Baseline confirmed clean: local `main` and `origin/main` both resolve to `017bb42` — no branch-stacking or content-diff reconciliation needed before starting Task 0.
