# Deferred Work

## Deferred from: code review of 1-2-first-launch-the-scaffolded-app-opens (2026-07-22)

- Architecture spine pairs `edition = "2024"` with "MSRV ≥1.77.2" — internally contradictory, since edition 2024 actually requires rustc ≥1.85. Pre-existing planning-artifact defect, not introduced by Story 1.2. [`_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md:160`]
- `bundle.targets: "all"` plus the full Windows/Store icon set (`Square*.png`, `StoreLogo.png`) ship even though macOS is the sole near-term target per NFR3 — stock `create-tauri-app` scaffold default, revisit when Story 5.1 sets up the real release pipeline. [`src-tauri/tauri.conf.json:26`]
- AD-7 network-surface audit method (Story 1.2, Task 4) checked `Cargo.toml`'s direct dependencies only; `cargo tree -i reqwest --target all` shows `reqwest`/`hyper` transitively present via `tauri`/`tauri-plugin-opener` (confirmed absent from the actual `aarch64-apple-darwin` build target, so currently benign). Future AD-7 audits — especially Epic 5's `tauri-plugin-updater` work, which legitimately needs network I/O — should check `cargo tree` scoped to the real build target, not just `Cargo.toml`'s direct deps.

## Deferred from: code review of 1-3-workspace-structure-and-the-toolerror-contract (2026-07-23)

- `resolver = "3"` (set in the new root `Cargo.toml`) has no accompanying `rust-toolchain.toml` pin, so a cargo/rustc toolchain older than ~1.84 would fail to parse the workspace manifest. Pre-existing project-wide toolchain-reproducibility gap (no `rust-toolchain.toml` existed before this story either, and `src-tauri` already required `rust-version = "1.85"` unpinned by a toolchain file) — not introduced or worsened by Story 1.3 specifically. [`Cargo.toml:3`]

## Deferred from: code review of story-1-5-navigate-tools-via-the-sidebar (2026-07-24)

- No catch-all/404 route for unmatched paths — renders a blank `RouterView` with no feedback. Currently unreachable (no address bar or deep-linking exists yet); revisit once Story 1.6's palette or future deep-linking lands. [`src/router/index.ts:10-17`]
- No uniqueness guard on registry `id`/route values — the router hardcodes a reserved `"home"` route name that a future tool entry could collide with. Not reachable with today's single-entry registry; add a lightweight assert when the second tool is registered.
- No visual indicator of the currently active tool in the sidebar (no `.router-link-active`/`.router-link-exact-active` styling). Real usability gap, but not required by any of Story 1.5's ACs. [`src/shell/AppSidebar.vue:34-46`]
- `registry.tools` is exposed as a plain mutable `ref`, not wrapped in `readonly()` — nothing in the current code mutates it externally, but the AD-5 "single source of truth" convention isn't structurally enforced. [`src/stores/registry.ts:16`]
- `createWebHistory()`'s hard-reload-404 risk is documented only in Story 1.5's Dev Notes prose, not as an in-code comment. Already an explicitly accepted risk per the spec; optional hygiene to point future readers here from the code itself. [`src/router/index.ts:9`]
- Inconsistent Pinia access pattern between `src/router/index.ts` (explicit `useRegistryStore(pinia)`, to dodge a Pinia active-instance ordering hazard) and `src/shell/AppSidebar.vue` (ambient `useRegistryStore()`). Both work today only because component `setup()` always runs after `app.use(pinia)`; undocumented asymmetry could bite a future navigation guard or bootstrap-time composable.
- No error handling for a dynamic tool-component import failure (no `router.onError`). Low reachability since all assets are bundled locally in this desktop app rather than fetched over a network.

## Deferred from: code review of 1-6-find-tools-instantly-with-cmd-k (2026-07-25)

- Duplicate `tool.id` across registry entries would collide in `aria-activedescendant`/DOM ids and Vue's keyed diffing. Pre-existing: registry `id` uniqueness has no guard, already flagged in Story 1.5's deferred-work entry above; `CommandPalette.vue` is just a new consumer of `tool.id` as a DOM id, not the source of the gap. [`src/shell/CommandPalette.vue:111`]
- No `event.isComposing` guard on Enter/Escape handling — an IME composition-confirm keystroke would misfire `selectActive()`/`close()` instead of confirming text. No IME/CJK input support exists anywhere in the app yet; no AC/NFR covers it for v1. [`src/shell/CommandPalette.vue:64-76`]
- Palette CSS is hardcoded light-only (`#fff`/`#666`/etc.), no `prefers-color-scheme` or theming variables. `AppSidebar.vue` has the identical gap; no styling/theming system exists yet anywhere in the shell (spine Deferred list). [`src/shell/CommandPalette.vue:131-184`]

## Deferred from: code review of 1-8-inspect-json-as-a-collapsible-tree (2026-07-26)

- **[Superseded 2026-07-29 — see the "spec-json-nesting-depth-cap" entry below]** Deeply nested JSON risks a Rust-side stack overflow in `parse`/`From<Value>` conversion. Pre-existing since Story 1.7's `format`/`minify` (identical recursive `serde_json::from_str` call); Story 1.8's `From<serde_json::Value>` conversion adds a second recursive pass at the same depth, not a materially lower crash threshold. [`crates/umbra-core/src/json.rs:40-76`]

## Deferred from: code review of 1-9-stay-responsive-on-10mb-documents (2026-07-27)

- Superseded `spawn_blocking` jobs are never cancelled — a stale Format/Minify/live-parse call still runs its CPU work to completion on the blocking thread pool even after the UI has already discarded its result via latest-wins. Pre-existing: the debounce + `createLatestWinsRunner` design was established in Stories 1.7-1.8; this story's own Dev Notes scope AD-16 work to "verify, don't rebuild," not add cancellation. [`src/tools/json/JsonView.vue`, `src-tauri/src/commands/json.rs`]
- AC1's own wording lists "format, minify, validate, or render it as a tree" as the operations that must stay responsive, but no `json_validate` command exists anywhere in the codebase (confirmed by search). Inherited unchanged from the epics/Story 1.7 phrasing; out of scope for Story 1.9's actual diff.

## Deferred from: code review of spec-json-nesting-depth-cap (2026-07-29)

- **Correction to the Story 1.8 entry above** ("Deeply nested JSON risks a Rust-side stack overflow"): empirically retested as part of the Epic 1 retro's nesting-depth-cap action item. `serde_json::from_str::<Value>` already enforces a 128-level recursion limit by default (confirmed: a 100,000-deep nested array is rejected with a clean `Err`, not a stack overflow), and `crates/umbra-core/Cargo.toml` does not enable the `unbounded_depth` feature that would disable it. `parse`/`format`/`minify` all build their `Value` tree through this guarded call before `From<Value>` ever runs, so the conversion only ever walks an already-bounded tree. The Story 1.8 entry's premise no longer holds; regression tests now lock this in (`crates/umbra-core/src/json.rs`, `*_rejects_deeply_nested_input` tests) so a future dependency change that reopens it fails CI immediately. [`crates/umbra-core/src/json.rs`]
- source_spec: `_bmad-output/implementation-artifacts/spec-json-nesting-depth-cap.md`
  summary: A depth-rejected document surfaces as the generic `json-syntax` error code with serde_json's internal wording, indistinguishable from an actual syntax typo, even though the input was well-formed JSON that only failed on depth.
  evidence: `serde_json::Error::classify()` maps `RecursionLimitExceeded` to `Category::Syntax` with no more specific public variant, so distinguishing it from a real syntax error would require either message-text sniffing (fragile — couples behavior to a third-party library's exact wording) or reimplementing our own pre-parse depth count purely for error-message quality. This session's explicit decision was to lock in serde_json's existing protection rather than add Umbra-owned depth-counting logic; revisit only if this UX gap is actually reported as confusing. [`crates/umbra-core/src/json.rs`]
