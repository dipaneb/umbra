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

## Deferred from: code review of spec-tool-registry-id-uniqueness-guard (2026-07-29)

- source_spec: `_bmad-output/implementation-artifacts/spec-tool-registry-id-uniqueness-guard.md`
  summary: `assertUniqueToolIds` only checks `id` collisions, not `route` or `shortcut` collisions, which would also silently break routing/keybindings.
  evidence: Pre-existing gap — no guard of any kind existed on any registry field before this change, and the architect's guidance scoped this fix specifically to `id`. Not reachable today (single-entry registry); worth a follow-up once Epic 2 adds enough entries for a real collision risk on `route`/`shortcut`. [`src/stores/registry.ts`]
- source_spec: `_bmad-output/implementation-artifacts/spec-tool-registry-id-uniqueness-guard.md`
  summary: The new tests exercise `assertUniqueToolIds` against synthetic fixtures only — nothing asserts the real module-level call site (`assertUniqueToolIds(TOOLS)`) stays wired in.
  evidence: A future edit that removed or swallowed that call would leave all unit tests green while the actual protection silently regressed. No cheap, non-disproportionate way to test import-time side effects with the current test setup; flagging so a future registry refactor checks for this. [`src/stores/registry.ts`, `src/stores/registry.spec.ts`]

## Deferred from: code review of story-2-1-encode-and-decode-text-base64 (2026-07-29)

- `encode()` has no input-size guard, unlike `decode()` — the `check_input_size`/CWE-400 guard from Task 1 is only wired into `decode`. Verified directly: `encode()` processes 100MB+ input without error, allocating a ~140MB output string with no bound. Deferred reason (user decision): bundle with Story 2.2, since file-size handling is that story's actual scope — revisit the encode-side guard there alongside real file-size limits. [`crates/umbra-core/src/base64.rs:43-49`]
- Error alert shows the byte offset twice — `base64::DecodeError`'s `Display` already embeds the offset (e.g. "Invalid symbol 33, offset 3."), and `Base64View.vue`'s `errorLocation` computed then appends a second, separate "(offset 3)" suffix. Pre-existing pattern inherited verbatim from `JsonView.vue` (the spec explicitly directed reusing `errorLocation` "as-is... don't write a new error-rendering helper") — `serde_json::Error`'s own `Display` already embeds "at line X column Y", so JSON's error alerts carry the identical redundancy today. Not introduced by this story. [`src/tools/base64/Base64View.vue:832-841`, pre-existing in `src/tools/json/JsonView.vue`]
- `errorLocation`'s position-kind matching has no exhaustiveness guard for a future third `Position` variant, and `isToolError` only loosely validates `code`/`message` shape (not `position`/`context`). Both are pre-existing shared code — `errorLocation` reused verbatim from `JsonView.vue`; `isToolError` lives in `src/shell/toolError.ts`, unmodified by this diff. [`src/shell/toolError.ts`, `src/tools/json/JsonView.vue`]

## Deferred from: code review of story-2.2 (2026-07-30)

- `DropZone.vue`'s `onMounted` async listener registration has no try/catch — a rejection would silently disable drop support for the whole session with no indication. Deferred: low practical likelihood (`onDragDropEvent` registration essentially never rejects at mount time in a live Tauri window); worth a follow-up hardening pass, not blocking. [`src/shell/DropZone.vue:23-37`]
- If `DropZone.vue` unmounted before its `onMounted` await resolved, the listener would leak (never released). Deferred: theoretical — `DropZone` is mounted once at the app root and never unmounted during normal operation. [`src/shell/DropZone.vue:23-41`]
- Rust test helpers' `std::fs::remove_file(&path).unwrap()` cleanup is skipped if an earlier assertion in the same test fails, leaking temp files on red CI runs. Deferred: pre-existing test-hygiene pattern shared by prior stories' temp-file tests, no production impact. [`src-tauri/src/fs_helper.rs:40,59`; `src-tauri/src/commands/base64.rs:105,125`]

## Deferred from: code review of 2-3-generate-uuids (2026-07-30)

- `map_join_error` duplicated a third time across command files, differing only in the `code` string (`json-internal`/`base64-internal`/`uuid-internal`). Pre-existing pattern: identical boilerplate already existed in `commands/json.rs` and `commands/base64.rs` before this story; never factored into a shared helper in `commands/mod.rs`. [`src-tauri/src/commands/uuid.rs:11`]
- Alert styling (`p[role="alert"] { color: #b00020; }`) duplicated a third time. Pre-existing: identical block already exists in `JsonView.vue` and `Base64View.vue`. [`src/tools/uuid/UuidView.vue:184`]
- Clipboard failures degrade to raw JS error text via `toToolError`'s `"unknown"` fallback (`{ code: "unknown", message: String(err) }` rendered verbatim in the same `role="alert"` box used for polished backend errors). Pre-existing: `Base64View.vue`'s `onCopy` has the identical gap. [`src/tools/uuid/UuidView.vue:528,537`]
- `CommandPalette.spec.ts`'s wrap-around assertion ("ArrowUp from index 0 lands on UUID") only holds because `uuid` is the last entry appended to `TOOLS`; nothing documents that ordering as a contract. Pre-existing: the test already depended on array order before this story (previously asserted "Base64" as the last of two entries). [`src/shell/CommandPalette.spec.ts:273`]
- No `aria-live`/`role="status"` announcement when a new UUID batch renders — errors get `role="alert"`, successful generation is silent for assistive tech. Pre-existing app-wide gap: no tool in this codebase announces successful results yet. [`src/tools/uuid/UuidView.vue:608`]
- No in-flight/loading state on the Generate button — rapid repeat clicks fire multiple concurrent `spawn_blocking` tasks server-side, papered over only by `runLatestWins`. Pre-existing: `Base64View.vue`'s `onEncode`/`onDecode` have the identical gap; only the file-based `onDecodeToFile` action guards against rapid re-clicks. [`src/tools/uuid/UuidView.vue:584`]
- Concurrent Copy/Copy all clicks aren't wrapped in a latest-wins runner — an earlier click's error/success outcome can overwrite a later click's. Pre-existing: `Base64View.vue`'s `onCopy` has the identical unguarded pattern. [`src/tools/uuid/UuidView.vue:528,537`]
