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

## Deferred from: code review of story-2-5-hash-files (2026-07-31)

- TOCTOU gap between `check_file_size`'s metadata check and the later `read_file_bytes` read — a file that grows between the two calls can be fully read into memory past `MAX_INPUT_BYTES`, defeating the size guard. Copied verbatim from `base64.rs`'s Story 2.2 `check_file_size`; fixing only `hash.rs` would leave `base64.rs` equally exposed. Candidate for a shared bounded-read helper in `fs_helper.rs` fixing both at once. [`src-tauri/src/commands/hash.rs:26-40`]
- `check_file_size` is a near-verbatim duplicate of `commands/base64.rs`'s function of the same name, differing only in error code/cap. Deliberate per the spec's explicit direction to mirror base64's shape; candidate for consolidating into `fs_helper.rs` alongside the TOCTOU fix above. [`src-tauri/src/commands/hash.rs:26-40`]
- `acceptedMimeTypes: []` remains dead configuration — declared and populated on every drop-capable registry entry but never read anywhere. Pre-existing since Story 2.2 (Base64); this story just extends the same inert shape to hash. [`src/stores/registry.ts:14,78`]
- Multi-file drops silently hash only the first file, with no notice the rest were ignored. Pre-existing `DropZone.vue`/`routeDrop` behavior from Story 2.2, not changed by this diff, though newly more relevant given hashing's common "verify a batch of downloads" use case. [`src/shell/DropZone.vue:47`]
- Directory drops surface a raw OS error string (e.g. "Is a directory (os error 21)") instead of a friendly message. Pre-existing `fs_helper::read_file_bytes`/`check_file_size` behavior, not introduced by this diff. [`src-tauri/src/fs_helper.rs:17-19`]
- Test temp files leak on assertion failure — `std::fs::remove_file` cleanup runs as a trailing statement, skipped if an earlier assertion panics. Pre-existing pattern already present in `base64.rs`'s/`fs_helper.rs`'s tests; this story's new tests mirror the same established convention rather than introducing it. [`src-tauri/src/commands/hash.rs` test module]
- No loading/progress feedback while a dropped file is hashing — for a large file taking several seconds, there's no spinner/indicator during the round trip. Pre-existing: `onCompute`'s manual text-hash path has the same gap; this story extends it to file drops rather than introducing it. [`src/tools/hash/HashView.vue`]
- No indication of which input (typed text vs. dropped file) the displayed digests belong to — after a drop, `digests.value` is overwritten but the textarea is left untouched, with no filename/source label distinguishing the two. Compounded by, but distinct from, this story's latest-wins race finding. [`src/tools/hash/HashView.vue`]

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

## Deferred from: code review of 2-4-hash-text (2026-07-31)

- `Cargo.lock` carries two `sha2` versions side by side (0.10.9 pulled transitively via tauri/wry, 0.11.0 direct) since tauri hasn't picked up the 0.11 lockstep release yet. Deferred: accepted tradeoff of pinning the latest verified-stable release; no functional impact, only minor build/binary-size cost. [`Cargo.lock`]
- No loading/disabled state on Compute/Paste while a call is in flight, so rapid re-clicks can stack concurrent `hash_compute` invocations over up to 100MB input. Pre-existing: identical gap already deferred for `UuidView.vue`'s Generate button and `Base64View.vue`'s Encode/Decode in prior story reviews — an app-wide pattern, not specific to this story. [`src/tools/hash/HashView.vue`]
- No frontend size guard on the input `<textarea>` before the 100MB check runs server-side after the IPC round-trip, so a very large paste can jank the webview via Vue reactivity/DOM rendering alone. Pre-existing: identical to `Base64View.vue`'s existing textarea binding, an app-wide pattern. [`src/tools/hash/HashView.vue`]
- Per-row Copy buttons give no success feedback (no "Copied" confirmation, no `aria-live` announcement). Pre-existing: matches `Base64View.vue`/`UuidView.vue`'s existing Copy button convention; no tool in this codebase announces successful actions yet. [`src/tools/hash/HashView.vue`]
- `HashView.spec.ts`'s error-path test mounts fresh and rejects immediately, so there is no explicit regression test proving `digests.value` is cleared when a NEW failure follows a prior success (the behavior itself is correctly implemented in `onCompute`'s catch block). Pre-existing: the same test-coverage gap exists in `Base64View.spec.ts`'s and `UuidView.spec.ts`'s error tests. [`src/tools/hash/HashView.spec.ts`]

## Deferred from: code review of 2-6-decode-jwts-offline (2026-08-02)

- `formatClaim`/`isExpired` can silently render "Invalid Date" for `exp`/`iat`/`nbf` values near the outer edge of `i64` — legal per the Rust type and RFC 7519's `NumericDate`, but `* 1000` exceeds `Number.MAX_SAFE_INTEGER` at that extreme. Degrades gracefully (no crash); only reachable via an adversarial-but-technically-legal claim value, and no other tool in this codebase has a comparable numeric-display bounds check to match. [`src/tools/jwt/JwtView.vue:18-22`]
- Malformed-but-present timestamp claims are indistinguishable from absent claims — `numeric_claim` (`crates/umbra-core/src/jwt.rs:68-71`) returns `None` both when `exp`/`iat`/`nbf` is genuinely missing and when it's present with the wrong JSON type (string, bool, array). The UI renders "not present" identically either way, with no error. Matches the story's literal spec code verbatim — deferred because whether a wrong-type registered claim should error or stay silent is a product/UX call, not one this code review should decide unilaterally.

## Deferred from: code review of 3-1-read-a-cron-expression-in-plain-english (2026-08-03)

- 6-field cron expressions (optional leading seconds, silently accepted by `croner`) produce a description that unconditionally discards the seconds field (`describe()`'s `6 => fields[1..].to_vec()`), while `next_runs` correctly reflects seconds precision — e.g. `"30 0 9 * * 1"` computes `next_runs` at `:30` but describes it as "at 9:00 AM". AC1 explicitly scopes to "5-field" expressions; whether 6-field input should be rejected outright or supported with accurate phrasing is undecided. Deferred reason (user decision): out of scope for 3.1. [`crates/umbra-core/src/cron.rs:95-101`]

## Deferred from: code review of 3-2-type-a-schedule-get-a-cron-expression (2026-08-04)

- `onPasteSchedule`'s catch branch never resets `parseResult`, leaving a stale prior successful conversion displayed alongside a new paste-failure alert. Pre-existing: faithful mirror of Story 3.1's `onPaste`, which has the identical gap on `explanation` — fixing only the new section would create an inconsistency between the two now-mirrored sections; should be fixed for both together in a dedicated follow-up. [`src/tools/cron/CronView.vue:91-101`]
- `runParse`/`runPasteSchedule` are independent latest-wins runners with no cross-invalidation, so a slow Convert call can repopulate `parseResult` with a stale result after a subsequent Paste has already reset state. Pre-existing: identical unaddressed race already present between Story 3.1's `onExplain`/`onPaste` on `explanation` — Story 3.2 faithfully mirrors the same pattern per Task 6's explicit instruction. Given this project's history of recurring async-race bug shapes (epic-1/epic-2 retrospective action items), a good candidate for a cross-cutting follow-up covering both sections rather than a one-off fix. [`src/tools/cron/CronView.vue:22-30, 76-101`]

## Deferred from: code review of 3-3-the-phrase-corpus-as-an-automated-acceptance-gate (2026-08-04)

- The must-honestly-fail corpus's leak-check only matches the literal substring `"* *"`, so a leaked partial cron fragment without two adjacent asterisks (e.g. `"*/90"`, `"9-17"`) inside an error `message`/`context` would pass undetected. Pre-existing convention explicitly reused from Story 3.2's tests per this story's own Task 3 instructions ("`"* *"` is the existing project convention for this check"), not introduced by this diff. [`crates/umbra-core/src/cron.rs:1400-1404`]

## Deferred from: code review of 4-2-paste-a-screenshot-copy-the-text (2026-08-06)

- `result.value as OcrOutcome` unchecked type assertion in `applyBucketResult` — no runtime shape validation of the backend payload. Pre-existing: the pattern predates this story (already used for `dropResult`); this diff adds a second call site (`pasteResult`) following the same established convention rather than introducing a new one. [`src/tools/bucket/BucketView.vue:32`]

## Deferred from: code review of 4-3-the-bucket-never-bluffs (2026-08-07)

- Corrupt-image truncation tests cover only one truncation point (`bytes.len() / 2`) on one fixture. Near-full-length truncation (e.g. missing only the trailing chunk) is a meaningfully different `image`-crate decode path and is untested. [`crates/umbra-core/src/ocr.rs:271-280`, `src-tauri/src/commands/bucket.rs:298-312`]
- New `role="status"` live-region pattern (first instance of this pattern in the codebase) has no manual screen-reader verification. Fold into the user's manual `pnpm tauri dev` check alongside this story's own Task 4/7 network-monitor tour. [`src/tools/bucket/BucketView.vue:84-89`]
- `OcrOutcome.confidence` is plumbed through Rust/IPC/TS but never read by `BucketView.vue`'s template. Pre-existing since Story 4.1/4.2, no functional consequence; this story only extends test fixtures that carry the unused field. [`src/tools/bucket/BucketView.vue`]

## Deferred from: code review of 5-1-a-signed-notarized-umbra-anyone-can-download (2026-08-08)

- No merge-base/ancestor check that a pushed `v*` tag's commit is reachable from `main` before `release.yml` builds, signs, notarizes, and publishes it. Low likelihood (requires a mistaken or deliberate tag push off `main`), high consequence (an unreviewed commit gets signed under the real Apple Developer identity and published as a public GitHub Release). [`.github/workflows/release.yml:36-39`]
- No check that a pushed tag's version agrees with `tauri.conf.json`'s `version` field — a mistagged push could publish a release whose tag and the app's self-reported version disagree. [`.github/workflows/release.yml:36-39`, `src-tauri/tauri.conf.json:4`]
- No automated Gatekeeper/notarization self-check (`spctl --assess`, `codesign --verify --deep --strict`) in CI before publishing. AC2 ("opens with no Gatekeeper bypass") is currently verified entirely by a human downloading the release on a second Mac after the artifact is already public (Task 7), rather than failing fast in CI. [`.github/workflows/release.yml`]
- No `timeout-minutes` set on the `release` job; Apple notarization is known to occasionally stall, and an unbounded job could silently burn CI time. [`.github/workflows/release.yml:44-46`]
- `CERT_ID=$(echo "$CERT_INFO" | awk -F'"' '{print $2}')` has no guard for `security find-identity` returning zero or multiple "Developer ID Application" matches — an empty/wrong `APPLE_SIGNING_IDENTITY` would surface as an opaque failure inside the `tauri-action` step rather than a clear, early error. Matches Tauri's own official GitHub Actions signing example exactly (verified via Context7, `v2.tauri.app/distribute/sign/macos`) — an upstream-shared gap, not a deviation introduced by this story. [`.github/workflows/release.yml:97-99`]
- `sprint-status.yaml`'s free-text `# note:` block keeps growing with no rotation/archival plan. Pre-existing pattern (flagged nowhere before now); this diff continues it by adding two more multi-line entries. Worth a lightweight archival convention (e.g. move notes older than N epics to a separate history file) before the file becomes unwieldy to scan. [`_bmad-output/implementation-artifacts/sprint-status.yaml`]

## Deferred from: code review of 5-2-umbra-updates-itself-with-consent-and-full-disclosure (2026-08-09)

- `tauri.conf.json`'s `version` field bump discipline (must be bumped every release for the updater's semver comparison to detect anything) is unenforced and undocumented. Deferred reason: belongs to the release-checklist territory this story's own boundary notes already assign to Story 5.3, not a fix this diff's code can make unilaterally. [`src-tauri/tauri.conf.json`]

## Deferred from: code review of 5-3-the-privacy-promise-proven-at-every-release (2026-08-09)

- `src-tauri/Cargo.toml`'s `[package] version` (`0.1.0`) has drifted from `src-tauri/tauri.conf.json`'s `version` (`0.1.2`) — pre-existing, not introduced by this story. Functionally inert today since `release.yml`'s tag-vs-version check and `tauri-action` both read only `tauri.conf.json`, never `Cargo.toml`. Worth a fix since `docs/release-checklist.md` itself now cites `Cargo.toml`'s `[package] name` as load-bearing evidence for the process-naming guidance, making the same file's own stale `version` field a visible inconsistency to anyone cross-checking. [`src-tauri/Cargo.toml:3`]

## Deferred from: code review of 5-4-a-landing-page-that-earns-the-download (2026-08-10)

- PostHog's `autocapture: false`/`disable_session_recording: true` only control this one init call — project-level PostHog features (web vitals, rageclick/dead-click detection, exception autocapture) live in the PostHog dashboard, outside this diff's reach. The footer's "page-view analytics only" claim isn't verified against dashboard config the way the app's own privacy claim is (per-release `nettop` check) — a gap in verification rigor, not a code defect introduced by this diff. [umbra-web: `src/layouts/Layout.astro`]
- No `og:image` or Twitter Card meta tags — link shares on social platforms (Slack, X, iMessage) render without a preview image. Not required by AC2's "titles, meta, semantic structure" — polish beyond this story's stated scope. [umbra-web: `src/layouts/Layout.astro`]
- No structured data (JSON-LD, e.g. a `SoftwareApplication` schema) — not required by AC2's stated SEO basics; polish beyond this story's stated scope. [umbra-web: `src/layouts/Layout.astro`]
- Production `site` URL permanently bakes in `-beta` (`umbra-web-beta.vercel.app`, since `umbra-web` itself was already taken on Vercel) — already a documented, accepted tradeoff per this story's own Task 5 (custom domain explicitly deferred). Flagged here only as a reminder: it gets indexed and backlinked, so migrating off it later will cost an SEO hit. [umbra-web: `astro.config.mjs`]
- No automated tests, CI check, Lighthouse/SEO run, or broken-link check exist for this repo — this story's own Dev Notes already state no such convention exists yet for `umbra-web` and frame adding one as "worth considering, not a requirement." [umbra-web: repo-wide]
- Download CTA links to `github.com/dipaneb/umbra/releases/latest` with no fallback if the repo ever has zero published releases — verified a real, current release (`v0.1.2`) exists today per this story's own Task 6. Low-probability future scenario (would require deleting every release), not a current defect. [umbra-web: `src/pages/download.astro`]
- `src/pages/robots.txt.ts` would throw (`new URL(undefined)`) if `Astro.site` were ever unset — verified `site` is explicitly set in the current `astro.config.mjs`, so unreachable today. Worth a defensive guard only if that config line is ever removed. [umbra-web: `src/pages/robots.txt.ts`]
