---
stepsCompleted:
  [
    "step-01-validate-prerequisites",
    "step-02-design-epics",
    "step-03-create-stories",
    "step-04-final-validation",
  ]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md
  # note: a "PRD addendum" (prd-Umbra-2026-07-19/addendum.md) was listed here originally but
  # never existed on disk -- confirmed absent by repo-wide search in both Story 3.2 and
  # Story 3.3, and removed 2026-08-07 (epic-4 retrospective action item, owner John) once
  # the FR21 phrase corpus it was meant to source was confirmed to live in
  # crates/umbra-core/src/cron.rs (Story 3.3) instead.
---

# Umbra - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Umbra, decomposing the requirements from the PRD and the Architecture spine into implementable stories.

No UX design contract exists; UX constraints are carried by the PRD itself (NFR5 accessibility baseline, §2 demo flow) and the architecture's accessibility conventions. Confirmed with the product owner on 2026-07-20.

## Requirements Inventory

### Functional Requirements

**F1 — App shell (MVP)**

- FR1: All tools presented in a persistent sidebar/launcher; selecting a tool opens it in the main pane.
- FR2: Command-palette search (global `⌘K`) finds tools by name and aliases/synonyms ("b64" → Base64) and opens them.
- FR3: UI ships light-mode-first; dark theme deferred to v2.
- FR4: Each tool provides one-action paste-from-clipboard input and copy-to-clipboard output where the tool shape allows.
- FR5: App restores last used tool and window geometry on launch, controlled by a toggle in a minimal Settings pane (default on).

**F2 — JSON formatter/viewer (MVP)**

- FR6: Pretty-print and minify JSON with configurable indentation (2/4 spaces, tabs).
- FR7: Validate JSON and report the first error with line/column position and a human-readable message.
- FR8: Display valid JSON as a collapsible tree view alongside the text view.
- FR9: Handle documents of at least 10 MB with the UI staying responsive (no main-thread block over ~200 ms).

**F3 — Base64 encode/decode (MVP)**

- FR10: Encode/decode text ↔ Base64 including URL-safe alphabet, with automatic detection of decode input.
- FR11: Encode a dropped file to Base64 and decode Base64 to a downloadable file.
- FR12: Invalid input produces a clear inline error — never a crash or silent empty output.

**F4 — UUID & hash generator (MVP)**

- FR13: Generate UUIDs v4 and v7, single or bulk (up to 1000), with one-click copy.
- FR14: Compute SHA-256 and SHA-512 of text input, plus MD5 and SHA-1 labeled as legacy, shown simultaneously; hex output with uppercase/lowercase toggle. bcrypt/argon2 excluded (P3 backlog candidate).
- FR15: Compute the same digests for a dropped file.

**F5 — JWT decoder (MVP)**

- FR16: Decode a pasted JWT into header and payload, pretty-printed, without any network call (no JWKS fetching).
- FR17: Render `exp`, `iat`, `nbf` claims as human-readable local datetimes; visibly flag expired tokens.
- FR18: Malformed tokens produce a precise error (which segment failed, why). Signature verification is P2 at the earliest.

**F6 — Natural language ↔ cron (MVP, AI-flavored)**

- FR19: Convert a natural-language schedule to a standard 5-field cron expression, fully offline via a deterministic parser (v1 decision; model/hybrid upgrade is v2).
- FR20: Convert a cron expression to a plain-English description, including the next 3 upcoming run times.
- FR21: When input can't be confidently converted, the tool says so and shows what it _did_ understand — no silently wrong cron. Acceptance basis: the canonical phrase corpus in `crates/umbra-core/src/cron.rs` (Story 3.3; must-convert ≥30, must-honestly-fail ≥10), maintained as an automated test.
- FR22: English input only in v1.

**F7 — The Bucket, v0: local OCR (MVP — flagship demo)**

- FR23: Drop zone accepts images (PNG, JPEG, WebP, pasted screenshots) and extracts text via a local ONNX OCR model (ONNX over macOS Vision, for portability).
- FR24: Extracted text shown editable with one-click copy; typical screenshot extraction under ~3 s on Apple Silicon.
- FR25: OCR supports English in v1. Coupling rule: any future French localization must add French to OCR and NL→cron in the same release.
- FR26: Failed or empty extractions state so explicitly (never a blank result).

**F8 — Bucket growth (P2)**

- FR27: PDF: merge multiple PDFs, split/extract page ranges, extract text — all locally.
- FR28: Images: convert between PNG/JPEG/WebP/HEIC and compress with a quality slider showing estimated output size. **Scope update (Story 6.2, 2026-08-10):** HEIC descoped from v1 — every real Rust HEIC crate candidate investigated carries a concrete, unresolved blocker (AGPL/commercial dual license, unpublished/unconfirmed license, or a GPL/LGPL codec-dependency risk to the AD-11 CI compile gate). v1 ships PNG/JPEG/WebP only; see Story 6.2's Task 1 for the full verification trail.

**F9 — Second AI feature (P2 — pick one, backlog the other)**

- FR29: _Either_ "explain this regex" (local inference) _or_ OCR→structured ("photo of a table → JSON"). Choice deferred to post-MVP. FR21's honesty bar applies.

**F10 — Distribution & updates (P2)**

- FR30: macOS release builds signed with a Developer ID certificate and notarized; app opens on a fresh Mac with no Gatekeeper bypass. Windows/Linux packaging arrives with their builds (P3), not P2.
- FR31: App self-updates with user confirmation before install; the update check is the sole permitted network call, disclosed in README and in-app (INV-1 carve-out).
- FR32: Versioned GitHub releases; Conventional Commits from day one (changelog itself deferred to backlog).

**F11 — Landing page (P2)**

- FR33: Landing page presents the privacy promise, feature tour, and a download link for the current release; SEO basics, copywriting, and analytics are part of the deliverable.
- FR34: PostHog analytics on the landing page only.

**F12 — School-year cadence (P3, backlog-driven)**

- FR35: One small tool or improvement ships per week/fortnight Sept→March, drawn from a maintained public backlog (candidates listed in PRD, not commitments).

### NonFunctional Requirements

- NFR1 — Privacy (testable, release-blocking): a network monitor observing the v1 app during use of every tool records zero outbound connections, with the sole disclosed exception of FR31's update check (OCR models are bundled per AD-7 — the conditional second carve-out is resolved away).
- NFR2 — Performance: cold launch < 2 s. Installed size lightweight as a goal; exceeding 100 MB acceptable when justified (bundled model).
- NFR3 — Platform: macOS 13+ on Apple Silicon primary (fully tested, signed, notarized). Codebase stays cross-platform-clean — no macOS-only dependency in any core path. Windows/Linux best-effort builds targeted P3.
- NFR4 — Robustness: no user input (malformed, huge, binary garbage) crashes the app; errors always shown in-tool.
- NFR5 — Keyboard & accessibility: the §2 demo flow fully drivable without the mouse; visible focus states, labeled controls (VoiceOver-readable), WCAG AA contrast (4.5:1 text) from v1.
- NFR6 — Repo as exhibit: GitHub flow with self-reviewed PRs; CI on every PR (fmt, clippy, eslint, tests); Rust unit tests for tool logic; integration tests over Tauri commands; Dependabot/Renovate. No e2e suite in v1.
- NFR7 — License: public repo under All Rights Reserved from the moment it goes public (source visible, no reuse permitted, no conversion to a permissive license).

### Additional Requirements

**Starter template (impacts Epic 1 Stories 1.2–1.3):**

- Scaffold via `create-tauri-app` (Tauri 2.11.x + Vue 3 + Vite + TypeScript + pnpm, latest stable at scaffold time), then restructure to the spine's Structural Seed: `crates/umbra-core` (pure logic workspace crate), `src-tauri` (command shell), `src/` (Vue views).

**Architecture decisions binding story implementation:**

- AD-1/AD-2: every transformation is a function in `umbra-core`; core imports no Tauri and has no `#[cfg(target_os)]` branches; presentation formatting (locale/timezone rendering) is view-owned.
- AD-3: every command is `async` returning `Result<T, ToolError>`; `ToolError { code (stable kebab-case enum), message, position: Option<LineCol|ByteOffset>, context }` defined once in core; commands named `<tool>_<verb>`; Vue renders errors from structure only.
- AD-4: work that can exceed ~100 ms CPU runs async on a blocking thread pool; large result sets render through virtualized views; heavy resources (OCR session) initialize lazily on first use, never at launch.
- AD-5: a single Tool Registry (id, name, aliases, route, icon, drop/shortcut declarations) is the only source for sidebar, palette index, and routes.
- AD-6: tools are islands — no tool reads another tool's state; cross-cutting state only in Pinia stores `settings` and `registry`.
- AD-7: zero network surface except `tauri-plugin-updater`; no network-purpose dependency anywhere; webview capabilities grant no network scope; OCR models bundled as app resources; `oar-ocr` auto-download disabled; updater carve-out disclosed in README **and** in-app.
- AD-8: core-owned OCR trait (image bytes → text + confidence, honest empty/failure); `oar-ocr` 0.8.x is the v1 adapter; callers depend on the trait only.
- AD-9: every NL→cron result round-trips through cron→English before display; the phrase corpus is an automated test in `umbra-core` — corpus regression is a failing build.
- AD-10: only persistence is `tauri-plugin-store` (`settings.json`), single writer (frontend `settings` Pinia store); keys namespaced `shell.*` / `<tool-id>.*`; Settings pane enumerates all persisted state with one-action clear; window geometry captured frontend-side, debounced.
- AD-11: CI runs `cargo check` + clippy on ubuntu and windows runners on every PR as a required check; `ort-sys` ONNX Runtime binaries cached in CI.
- AD-12: releases are tag-driven via `tauri-action`: build → sign → notarize → GitHub Release with `latest.json`; update confirmation dialog is app-built UI; all secrets live only in GitHub Actions; updater private key backed up offline in two places before the first release; NFR1 network-monitor tour recorded in the release PR.
- AD-13: any release adding a UI language adds it to OCR models and the cron grammar + corpus in the same release, or doesn't ship.
- AD-14: the shell owns OS I/O edges once — window-level Tauri-native drops dispatched to the active tool's registry-declared handler; one clipboard service (`navigator.clipboard` forbidden); pasted images dispatched like drops; ⌘K app-scope via one capture-phase handler; tools register no document-level listeners.
- AD-15: files cross the IPC bridge as absolute paths; `src-tauri` owns all file reads/writes via one shared save-dialog-plus-write helper; core never touches the filesystem; byte arrays > ~64 KB never ride JSON IPC (exception: clipboard-pasted image bytes via raw IPC body).
- AD-16: one shared frontend invoke helper for slow commands — request IDs, latest-wins supersession, results for unmounted views discarded; OCR session behind `OnceCell`; no progress events or cancellation in v1.

**Stack (verified 2026-07-19; code owns exact pins at lockfile time):** Rust stable edition 2024; Tauri 2.11.x with plugins `store` 2.4.x, `updater` 2.x, `dialog` 2.x, `clipboard-manager` 2.x; Vue 3 + Vue Router + Pinia; `oar-ocr` 0.8.x (PaddleOCR mobile det+rec English ONNX, bundled); `croner` 3.x; GitHub Actions + `tauri-action` (macos build/sign runner, ubuntu + windows check matrix).

**Conventions binding acceptance criteria:** no `unwrap`/`expect` in command paths; clippy `-D warnings`; TypeScript `strict`; testing layers = core unit tests (`cargo test -p umbra-core`, incl. corpus) + `src-tauri` command integration tests + Vitest; Conventional Commits; every dependency's license checked for compatibility with bundling into an All-Rights-Reserved app (permissive licenses fine; copyleft/GPL needs review); accessibility (labels, focus, contrast) checked at PR review from v1.

**Deferred items relevant to story planning:** styling framework deferred to UX phase (plain scoped CSS until then); exact ONNX model files picked at the first Bucket story; JSON tree default = single payload + virtualized DOM, lazy per-node fetch only via spine amendment if profiling fails FR9; FR29 choice deferred to post-MVP; landing page stack decided at P2 start; Windows/Linux packaging at P3 grooming; NFR1 test manual per release checklist in v1.

### UX Design Requirements

No UX design contract exists for this project (confirmed 2026-07-20). UX constraints are carried by NFR5 (keyboard drivability of the §2 demo flow, visible focus states, labeled controls, WCAG AA contrast), the PRD §2 demo scenario, FR3 (light-mode-first), and the architecture's accessibility conventions (checked at PR review). Styling/component framework and design tokens are deferred to a future UX phase per the spine's Deferred list.

### FR Coverage Map

- FR1: Epic 1 — Sidebar/launcher in the app shell
- FR2: Epic 1 — ⌘K command palette with alias search
- FR3: Epic 1 — Light-mode-first UI
- FR4: Epic 1 — Clipboard paste/copy service (proven in JSON tool; consumed by all tools)
- FR5: Epic 1 — Last-tool + window-geometry restore via Settings pane
- FR6: Epic 1 — JSON pretty-print/minify with indentation options
- FR7: Epic 1 — JSON validation with line/column errors
- FR8: Epic 1 — Collapsible JSON tree view
- FR9: Epic 1 — 10 MB documents, responsive UI
- FR10: Epic 2 — Base64 text encode/decode, URL-safe, auto-detect
- FR11: Epic 2 — File → Base64 and Base64 → file (first use of drop service + save helper)
- FR12: Epic 2 — Inline errors for invalid Base64 input
- FR13: Epic 2 — UUID v4/v7 single + bulk generation
- FR14: Epic 2 — Simultaneous digests of text (SHA-256/512, legacy MD5/SHA-1)
- FR15: Epic 2 — Digests of dropped files
- FR16: Epic 2 — JWT decode, offline
- FR17: Epic 2 — Humanized timestamp claims, expired-token flag
- FR18: Epic 2 — Precise malformed-token errors
- FR19: Epic 3 — NL → cron deterministic parser
- FR20: Epic 3 — Cron → English + next 3 runs
- FR21: Epic 3 — Honest failure + phrase corpus as automated test
- FR22: Epic 3 — English-only v1 scope
- FR23: Epic 4 — Bucket drop zone with local ONNX OCR
- FR24: Epic 4 — Editable result, one-click copy, <~3 s typical
- FR25: Epic 4 — English OCR v1 (French coupling rule recorded)
- FR26: Epic 4 — Explicit empty/failure states
- FR27: Epic 6 — PDF merge/split/extract text
- FR28: Epic 6 — Image convert + compress with quality slider
- FR29: Epic 6 — Second AI feature (decision story + implementation)
- FR30: Epic 5 — Signed + notarized macOS builds
- FR31: Epic 5 — Self-update with consent, disclosed carve-out
- FR32: Epic 5 — Versioned GitHub releases, Conventional Commits
- FR33: Epic 5 — Landing page with download link
- FR34: Epic 5 — PostHog on landing page only
- FR35: Epic 5 — Public P3 backlog established (cadence itself is ongoing process)

## Epic List

### Epic 1: Umbra launches — shell + JSON tool

A user launches Umbra, navigates via the sidebar and ⌘K palette, and formats, validates, and inspects JSON documents up to 10 MB. Includes the project scaffold (create-tauri-app → spine workspace restructure), CI skeleton, `ToolError` contract, Tool Registry, clipboard service, and Settings persistence — all proven through one real tool.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9

### Epic 2: Everyday tools — Base64, UUID & hash, JWT

The daily-driver set: encode/decode text and files, generate UUIDs singly or in bulk, compute digests of text and dropped files, decode JWTs with humanized claims and expiry flagging. First use of the shell's window-level drop service and shared file-save helper (AD-14/AD-15).
**FRs covered:** FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18

### Epic 3: Natural language ↔ cron

Type "every weekday at 8:30", get a correct cron expression — or an honest refusal showing what was understood. Deterministic parser both ways, round-trip validation before display, and the canonical phrase corpus running as an automated test (AD-9). Builds the AI-honesty machinery the v2 model path will reuse.
**FRs covered:** FR19, FR20, FR21, FR22

### Epic 4: The Bucket — local OCR _(MVP complete here)_

Drag a screenshot in, get copyable text, Wi-Fi off. Bundled PaddleOCR ONNX models behind a core-owned trait (AD-8), lazy initialization, honest empty/failure states. After this epic the full 5-minute demo works end-to-end.
**FRs covered:** FR23, FR24, FR25, FR26

### Epic 5: Umbra ships — releases, updates & landing page

Anyone can download a signed, notarized Umbra from the landing page, and installed copies self-update with explicit consent. Tag-driven release pipeline (AD-12), updater carve-out disclosed in README and in-app, NFR1 network-monitor release checklist, landing page with PostHog analytics, and the public P3 backlog established. Sequenced ahead of Epic 6 deliberately: a live download link early beats more features in a private repo (PRD "Finished" metric).
**FRs covered:** FR30, FR31, FR32, FR33, FR34, FR35

### Epic 6: Bucket growth — PDF, images & the second AI feature

The Bucket becomes a real file workbench: PDF merge/split/extract-text, image format conversion and compression — plus the FR29 choice (regex-explain vs OCR→structured) carried as an explicit decision story, then implemented behind an AD-8-style port.
**FRs covered:** FR27, FR28, FR29

## Epic 1: Umbra launches — shell + JSON tool

A user launches Umbra, navigates via the sidebar and ⌘K palette, and formats, validates, and inspects JSON documents up to 10 MB. Includes the project scaffold, CI skeleton, `ToolError` contract, Tool Registry, clipboard service, and Settings persistence — all proven through one real tool.

> **Note on Story 1.1's split (2026-07-22):** the original "First launch —
> scaffolded app opens" bundled repo governance, the app scaffold, the workspace
> restructure + error system, and CI into one story. That proved too large to
> review while learning Tauri/Rust/CI, so it is split into Stories 1.1–1.4 below
> (governance → scaffold → structure + `ToolError` → CI), sequenced so CI in 1.4
> guards the final layout. Former Stories 1.2–1.7 shift to 1.5–1.10. The
> continuous-delivery pipeline (build → sign → notarize → GitHub Release, AD-12)
> is deliberately **not** here — it lives in Epic 5, Story 5.1, so a private repo
> can iterate before publishing signed downloads.

### Story 1.1: A governed, public repository

As the developer (the builder, whose repo is itself an exhibit),
I want the public repository set up with its license, README, commit conventions, and dependency automation,
So that every later story lands in a portfolio-ready, self-governing home before any application code exists.

**Acceptance Criteria:**

**Given** the repository is public,
**When** its root is reviewed,
**Then** an All Rights Reserved license file is present (NFR7),
**And** a README states the privacy promise and how the project is planned.

**Given** the repository's commit history,
**When** inspected,
**Then** it follows Conventional Commits from the first commit, so a changelog can be generated later (FR32 groundwork).

**Given** the dependency surface,
**When** the repo is configured,
**Then** Dependabot or Renovate is active, delivering dependency updates as reviewable pull requests (NFR6).

**Given** the collaboration model,
**When** work proceeds,
**Then** changes land through self-reviewed pull requests against a protected default branch — no direct pushes (NFR6); the CI those PRs must pass is built in Story 1.4.

### Story 1.2: First launch — the scaffolded app opens

As the developer,
I want a Tauri + Vue app scaffolded and launching with a placeholder shell window,
So that there is a real, runnable application to build every tool into.

**Acceptance Criteria:**

**Given** a clean clone of the repo,
**When** `pnpm install` then `pnpm tauri dev` is run,
**Then** a window titled Umbra opens showing a placeholder shell.

**Given** a release build,
**When** it is launched,
**Then** it cold-launches in under 2 seconds (NFR2).

**Given** the scaffold,
**When** inspected,
**Then** it was generated via `create-tauri-app` — Tauri 2.11.x, Vue 3, Vite, TypeScript `strict`, pnpm (latest stable at scaffold time).

**Given** the app's network surface,
**When** its manifests and webview capabilities are audited,
**Then** no dependency whose purpose is network I/O exists in any manifest, and the webview capabilities grant no network scope (AD-7).

### Story 1.3: Workspace structure and the `ToolError` contract

As the developer,
I want the scaffold restructured into the architecture spine's workspace with the shared error type defined,
So that tool logic stays pure and every command speaks one error language.

**Acceptance Criteria:**

**Given** the repository layout,
**When** inspected,
**Then** it matches the spine's Structural Seed — `crates/umbra-core` (pure-logic workspace crate), `src-tauri` (command shell), `src/` (Vue views).

**Given** `umbra-core`,
**When** its manifest and sources are reviewed,
**Then** it imports no Tauri crate and contains no `#[cfg(target_os)]` branches (AD-2).

**Given** the shared error type,
**When** `umbra-core` is built,
**Then** it defines `ToolError { code, message, position, context }` — `code` a stable kebab-case enum, `position` an optional line/column or byte offset — with at least one unit test proving its serialization (AD-3).

### Story 1.4: CI guards every pull request

As the developer (whose repo is an exhibit and whose quality bar needs teeth),
I want CI running the full lint/test/build matrix on every pull request,
So that no change merges without formatting, linting, tests, and a successful build all passing.

**Acceptance Criteria:**

**Given** any pull request,
**When** CI runs,
**Then** `cargo fmt --check`, clippy (`-D warnings`), eslint, `cargo test`, and Vitest all execute (NFR6).

**Given** the frontend,
**When** CI runs,
**Then** `pnpm build` (production `vite build`) runs and must succeed — a broken build fails the check.

**Given** the cross-platform gate,
**When** CI runs,
**Then** `cargo check`, clippy, and `cargo test` run on ubuntu, windows, and macos runners as required checks (AD-11, NFR3),
**And** the `ort-sys` ONNX Runtime binaries are cached so the matrix stays fast (AD-11).

**Given** any of these checks fails,
**When** a PR is open,
**Then** merging is blocked until it passes — the checks are required, not advisory (NFR6).

### Story 1.5: Navigate tools via the sidebar

As a privacy-conscious developer,
I want a persistent sidebar listing all tools,
So that I can open any tool in the main pane at any time.

**Acceptance Criteria:**

**Given** the app is open,
**When** I view the window,
**Then** a persistent sidebar lists all registered tools with name and icon, sourced solely from the Tool Registry (FR1, AD-5),
**And** the UI renders light-mode-first (FR3).

**Given** a tool in the sidebar,
**When** I select it,
**Then** its view opens in the main pane via the registry-generated route table,
**And** the JSON tool is registered with a placeholder view.

**Given** a new tool needs to be added,
**When** it is registered,
**Then** sidebar, palette index, and routes all update from that single registry entry — nothing else enumerates tools (AD-5).

**Given** keyboard-only usage,
**When** navigating the sidebar,
**Then** every control is labeled, shows a visible focus state, and selection works without the mouse (NFR5).

### Story 1.6: Find tools instantly with ⌘K

As a privacy-conscious developer,
I want a command palette that matches tool names and aliases,
So that I can open any tool without touching the mouse.

**Acceptance Criteria:**

**Given** the app is focused anywhere,
**When** I press ⌘K,
**Then** the command palette opens, handled by the shell's single capture-phase keyboard handler — no tool registers document-level key listeners (FR2, AD-14).

**Given** the palette is open,
**When** I type a tool name or a registry-declared alias (e.g. "b64" → Base64, once registered),
**Then** matching tools appear ranked, Enter opens the top result in the main pane, and Esc closes the palette (FR2).

**Given** a query matching nothing,
**When** results are shown,
**Then** an explicit empty state is displayed — never a blank panel.

**Given** keyboard-only usage,
**When** operating the palette,
**Then** arrow keys navigate results with visible focus and the input is labeled (NFR5).

### Story 1.7: Format, minify, and validate JSON

As a privacy-conscious developer,
I want to paste JSON and format or minify it with my preferred indentation, with precise errors,
So that I can clean real payloads without any data leaving my machine.

**Acceptance Criteria:**

**Given** JSON text in the input area,
**When** I choose Format or Minify,
**Then** output is pretty-printed per the selected indentation (2 spaces, 4 spaces, or tabs) or minified to one line (FR6),
**And** the transformation lives in `umbra-core::json`, exposed as async commands `json_format` / `json_minify` returning `Result<T, ToolError>` (AD-1, AD-3).

**Given** invalid JSON (malformed, huge, or binary garbage),
**When** I format or validate it,
**Then** the first error is shown with line/column position and a human-readable message, rendered from the `ToolError` structure — the view never string-matches messages (FR7, AD-3),
**And** the app never crashes or shows silent empty output (NFR4, FR12 pattern).

**Given** the tool is open,
**When** I click paste-from-clipboard or copy-to-clipboard,
**Then** input/output transfers in one action via the shell clipboard service backed by the Tauri clipboard plugin — `navigator.clipboard` is not used (FR4, AD-14).

**Given** any command invocation from this tool,
**When** it executes,
**Then** it goes through the shared invoke helper carrying a request ID with latest-wins supersession — this story establishes the helper (AD-16).

### Story 1.8: Inspect JSON as a collapsible tree

As a privacy-conscious developer,
I want valid JSON displayed as a collapsible tree beside the text view,
So that I can explore a payload's structure without reading raw braces.

**Acceptance Criteria:**

**Given** valid JSON in the tool,
**When** it is parsed,
**Then** a collapsible tree view renders alongside the text view with expand/collapse per node (FR8),
**And** the parsed tree crosses the IPC bridge once as a single payload (spine default; see Story 1.9 for the fallback rule).

**Given** a document with many nodes,
**When** the tree renders,
**Then** only visible nodes exist in the DOM (virtualized rendering — AD-4).

**Given** invalid JSON,
**When** the tree pane is shown,
**Then** it displays an explicit "tree unavailable" state, never a stale or blank tree.

**Given** keyboard-only usage,
**When** navigating the tree,
**Then** nodes are focusable with visible focus states and expandable via keyboard (NFR5).

### Story 1.9: Stay responsive on 10 MB documents

As a privacy-conscious developer,
I want huge JSON documents handled without freezing the app,
So that the tool is trustworthy on real-world payloads.

**Acceptance Criteria:**

**Given** a JSON document of at least 10 MB,
**When** I format, minify, validate, or render it as a tree,
**Then** the UI stays responsive throughout with no main-thread block over ~200 ms (FR9),
**And** parsing/formatting runs inside async commands on the Rust blocking thread pool (AD-4).

**Given** rapid successive edits triggering re-invocations,
**When** results return out of order,
**Then** the latest request wins and older results are dropped on arrival — no stale overwrite (AD-16).

**Given** profiling shows the single-payload tree transfer cannot meet FR9,
**When** a fallback is needed,
**Then** the lazy per-node fetch alternative is raised as a spine amendment (AD-3 contract change) — never implemented as a quiet switch.

### Story 1.10: Settings that remember my session

As a returning Umbra user,
I want the app to reopen where I left off — and to see and clear everything it stores,
So that persistence is convenient and fully transparent.

**Acceptance Criteria:**

**Given** the restore toggle is on (its default),
**When** I relaunch the app,
**Then** the last used tool and window geometry are restored (FR5),
**And** geometry is captured frontend-side on debounced move/resize and routed through the `settings` Pinia store (AD-10).

**Given** the Settings pane,
**When** I open it,
**Then** it shows the restore toggle and enumerates every persisted key from the `shell.*` / `<tool-id>.*` namespaces,
**And** a single action clears all persisted state (INV-3, AD-10).

**Given** the app's persistence surface,
**When** audited,
**Then** the only mechanism is `tauri-plugin-store` writing one `settings.json`, whose single writer is the frontend `settings` store — Rust-side code never writes it (AD-10).

**Given** the restore toggle is off,
**When** I quit and relaunch,
**Then** no session state is restored and no stale values are written.

## Epic 2: Everyday tools — Base64, UUID & hash, JWT

The daily-driver set: encode/decode text and files, generate UUIDs singly or in bulk, compute digests of text and dropped files, decode JWTs with humanized claims and expiry flagging. First use of the shell's window-level drop service and shared file-save helper (AD-14/AD-15).

### Story 2.1: Encode and decode text ↔ Base64

As a privacy-conscious developer,
I want to encode and decode text to and from Base64 without leaving my machine,
So that I can handle tokens, payloads, and data URIs I could never paste into a website.

**Acceptance Criteria:**

**Given** text in the input area,
**When** I choose Encode,
**Then** standard Base64 output is produced, with a URL-safe alphabet option (FR10),
**And** the transformation lives in `umbra-core::base64` behind async commands returning `Result<T, ToolError>` (AD-1, AD-3).

**Given** Base64 text in the input area,
**When** I choose Decode (or rely on auto-detection of decode input),
**Then** the decoded text is shown, with the alphabet (standard/URL-safe) detected automatically (FR10).

**Given** invalid Base64 input,
**When** I decode it,
**Then** a clear inline error explains what is wrong (with byte offset where applicable, per AD-3's position rules) — never a crash or silent empty output (FR12, NFR4).

**Given** the tool is open,
**When** I use paste-from-clipboard or copy-to-clipboard,
**Then** transfer happens in one action via the shell clipboard service (FR4, AD-14).

### Story 2.2: Turn files into Base64 and back

As a privacy-conscious developer,
I want to encode a dropped file to Base64 and decode Base64 back into a saved file,
So that I can produce data URIs and unpack binary API payloads locally.

**Acceptance Criteria:**

**Given** the Base64 tool is active,
**When** I drop a file onto the window,
**Then** the shell's window-level drop service — established by this story — dispatches the file _path_ to the tool's registry-declared drop handler (AD-14),
**And** `src-tauri` reads the file and returns its Base64 encoding; raw bytes never ride the JSON IPC bridge above ~64 KB (FR11, AD-15).

**Given** valid Base64 content in the tool,
**When** I choose "decode to file",
**Then** the shared save-dialog-plus-write helper in `src-tauri` — established by this story — writes the decoded bytes to my chosen location (FR11, AD-15).

**Given** a tool that declares no drop support is active,
**When** a file is dropped,
**Then** a visible no-op indication is shown — the drop is never silently swallowed (AD-14).

**Given** a dropped file that cannot be read (permissions, deleted mid-flight),
**When** encoding is attempted,
**Then** a structured `ToolError` is rendered inline (NFR4).

### Story 2.3: Generate UUIDs

As a privacy-conscious developer,
I want to generate UUIDs v4 and v7, singly or in bulk,
So that I can fill fixtures and IDs without an online generator.

**Acceptance Criteria:**

**Given** the UUID tool,
**When** I generate a single UUID (v4 or v7),
**Then** it appears with one-click copy (FR13).

**Given** a bulk count up to 1000,
**When** I generate,
**Then** that many UUIDs render as a copyable list, and the UI stays responsive (FR13, AD-4),
**And** a count above 1000 is rejected with an inline message, not clamped silently.

**Given** version selection,
**When** I switch v4/v7,
**Then** output matches the selected version (v7 outputs are time-ordered).

### Story 2.4: Hash text

As a privacy-conscious developer,
I want simultaneous digests of my text input,
So that I can produce checksums without pasting content into a website.

**Acceptance Criteria:**

**Given** text input,
**When** digests are computed,
**Then** SHA-256, SHA-512, MD5, and SHA-1 all display simultaneously, computed in `umbra-core::hash` (FR14, AD-1),
**And** MD5 and SHA-1 are visibly labeled as legacy.

**Given** hex output,
**When** I toggle uppercase/lowercase,
**Then** all displayed digests re-render in the chosen case, each with one-click copy (FR14).

**Given** the tool's scope,
**When** reviewed,
**Then** no bcrypt/argon2 options are present — password hashing is a separate P3 backlog tool, not this one (FR14).

### Story 2.5: Hash files

As a privacy-conscious developer,
I want the same digests for a dropped file,
So that I can verify downloads and artifacts locally.

**Acceptance Criteria:**

**Given** the hash tool is active,
**When** I drop a file,
**Then** the drop service delivers its path, `src-tauri` reads the bytes, and all four digests display as in Story 2.4 (FR15, AD-14/AD-15).

**Given** a large file,
**When** hashing runs,
**Then** it executes async on the blocking thread pool with the UI responsive throughout (AD-4),
**And** a newer drop supersedes an in-flight computation, latest-wins (AD-16).

**Given** an unreadable file,
**When** hashing is attempted,
**Then** a structured inline error is shown (NFR4).

### Story 2.6: Decode JWTs offline

As a privacy-conscious developer,
I want to decode JWTs entirely offline with humanized claims,
So that I can inspect real tokens without sending them anywhere.

**Acceptance Criteria:**

**Given** a pasted JWT,
**When** decoded,
**Then** header and payload display pretty-printed, with zero network calls — no JWKS fetching exists in the code (FR16, AD-7),
**And** decoding lives in `umbra-core::jwt` (AD-1).

**Given** registered timestamp claims (`exp`, `iat`, `nbf`),
**When** the payload renders,
**Then** each shows as a human-readable local datetime — core returns epoch values, the view renders locale/timezone (FR17, AD-1),
**And** an expired token is visibly flagged (FR17).

**Given** a malformed token,
**When** decoding fails,
**Then** the error states which segment failed and why, carried in `ToolError.code`/`context` — never only prose (FR18, AD-3).

**Given** the tool's v1 scope,
**When** reviewed,
**Then** no signature verification is present or implied by the UI; the tool states that signatures are not verified (FR18 — verification is P2 at the earliest).

## Epic 3: Natural language ↔ cron

Type "every weekday at 8:30", get a correct cron expression — or an honest refusal showing what was understood. Deterministic parser both ways, round-trip validation before display, and the canonical phrase corpus running as an automated test (AD-9). Built in dependency order: the cron→English direction first, because AD-9 makes it the validation layer for NL→cron.

### Story 3.1: Read a cron expression in plain English

As a privacy-conscious developer,
I want to paste a cron expression and read what it means and when it runs next,
So that I can verify schedules without a cron cheat-sheet website.

**Acceptance Criteria:**

**Given** a valid 5-field cron expression,
**When** I submit it,
**Then** a plain-English description displays along with the next 3 upcoming run times (FR20),
**And** cron parsing/next-occurrence computation uses `croner`, with description templating in `umbra-core::cron` (AD-1),
**And** core returns run times as epoch values which the view renders as local datetimes (AD-1).

**Given** an invalid cron expression,
**When** I submit it,
**Then** a structured inline error explains which field is invalid and why (`ToolError` with position/context, AD-3, NFR4).

**Given** the tool is open,
**When** I use paste/copy actions,
**Then** they work in one action via the shell clipboard service (FR4).

### Story 3.2: Type a schedule, get a cron expression

As a privacy-conscious developer,
I want to type a schedule in natural language and get a correct cron expression — or an honest refusal,
So that I never deploy a silently wrong schedule.

**Acceptance Criteria:**

**Given** a supported English phrase (e.g. "every weekday at 8:30"),
**When** I submit it,
**Then** the correct 5-field cron expression is produced by the deterministic grammar parser in `umbra-core::cron`, fully offline (FR19, INV-1),
**And** before display, the result is round-tripped through Story 3.1's cron→English direction; only a consistent round-trip is shown (AD-9).

**Given** a phrase the parser cannot confidently convert (including ambiguity like "at 9" with no am/pm rule),
**When** I submit it,
**Then** the tool states it could not convert, shows what it _did_ understand, and produces no cron expression (FR21) — wrong-but-confident output is treated as a bug, not a limitation.

**Given** the round-trip validation disagrees with the parsed intent,
**When** the result would display,
**Then** it is suppressed and surfaced as an honest failure instead (AD-9).

**Given** non-English input,
**When** submitted,
**Then** the tool states that v1 supports English input only (FR22).

### Story 3.3: The phrase corpus as an automated acceptance gate

As the developer (whose repo is the exhibit and whose honesty bar needs teeth),
I want the canonical phrase corpus running as a test suite that fails the build on regression,
So that FR21 is enforced by CI, not by good intentions.

**Acceptance Criteria:**

**Given** the corpus test suite in `umbra-core` (part of `cargo test -p umbra-core`),
**When** it runs,
**Then** at least 30 must-convert phrases from the corpus in `crates/umbra-core/src/cron.rs` assert their exact expected cron expressions (FR21, AD-9).

**Given** the must-honestly-fail set,
**When** the suite runs,
**Then** at least 10 inexpressible or ambiguous phrases (e.g. "every third Friday of the month", "every 90 seconds") assert an honest failure — silent approximations like `0 0 15-21 * 5` explicitly fail the test (FR21).

**Given** the reverse direction,
**When** the suite runs,
**Then** every must-convert expression round-trips cron→English→cron unchanged (FR20 contract).

**Given** any corpus regression,
**When** CI runs on a PR,
**Then** the build fails (AD-9) — and the corpus grows with every phrasing bug report as a stated maintenance rule.

## Epic 4: The Bucket — local OCR _(MVP complete here)_

Drag a screenshot in, get copyable text, Wi-Fi off. Bundled PaddleOCR ONNX models behind a core-owned trait (AD-8), lazy initialization, honest empty/failure states. After this epic the full 5-minute demo works end-to-end.

### Story 4.1: Drag an image in, get its text

As a privacy-conscious developer,
I want to drop an image into the Bucket and get its text extracted entirely on-device,
So that screenshots of errors and documents become copyable text without touching any cloud OCR.

**Acceptance Criteria:**

**Given** the Bucket tool is active,
**When** I drop a PNG, JPEG, or WebP image,
**Then** its text is extracted by the local ONNX OCR engine and displayed (FR23),
**And** the file arrives as a path via the shell drop service; `src-tauri` reads the bytes and hands them to core (AD-14, AD-15).

**Given** the OCR implementation,
**When** inspected,
**Then** `umbra-core` defines the OCR trait (image bytes in → recognized text + confidence out) and `oar-ocr` 0.8.x is the adapter behind it — callers, commands, and UI depend on the trait only (AD-8),
**And** the PaddleOCR mobile det+rec English ONNX models are bundled as app resources with `oar-ocr`'s auto-download feature explicitly disabled (AD-7),
**And** the exact model files are chosen and documented in this story, closing the spine's deferred item.

**Given** a cold app launch,
**When** launch completes,
**Then** the OCR engine has not initialized — it initializes lazily behind a `OnceCell` on first use, and cold launch stays under 2 seconds (AD-4, AD-16, NFR2).

**Given** OCR inference is running,
**When** the UI is used,
**Then** inference executes async on the blocking thread pool and the UI stays responsive (AD-4).

### Story 4.2: Paste a screenshot, copy the text

As a privacy-conscious developer,
I want to paste a screenshot and copy out its text in seconds,
So that the everyday "error dialog → search/share as text" flow is instant and offline.

**Acceptance Criteria:**

**Given** an image on the clipboard,
**When** I paste (⌘V) with the Bucket active,
**Then** the image is dispatched like a drop to the Bucket's registry-declared handler, crossing the bridge via Tauri's raw IPC body — the sanctioned AD-15 exception for clipboard image bytes (FR23, AD-14).

**Given** a completed extraction,
**When** the result displays,
**Then** the text is editable in place and copyable with one click via the shell clipboard service (FR24, FR4).

**Given** a typical error-dialog screenshot on Apple Silicon,
**When** extraction runs (after first-use initialization),
**Then** it completes in under ~3 seconds, verified by measurement in the story (FR24).

**Given** a new drop or paste while an extraction is in flight,
**When** results return,
**Then** the newest request wins and the superseded result is dropped on arrival (AD-16).

### Story 4.3: The Bucket never bluffs

As a privacy-conscious developer,
I want the Bucket to state failures and empty results explicitly — and to provably never phone home,
So that I can trust both its answers and its privacy promise.

**Acceptance Criteria:**

**Given** an image in which the engine finds no text,
**When** extraction completes,
**Then** the tool explicitly states that no text was found — never a blank result pane (FR26).

**Given** a corrupt or unreadable image,
**When** extraction is attempted,
**Then** a structured `ToolError` displays inline explaining the failure (FR26, NFR4, AD-3).

**Given** two extraction requests racing on first use,
**When** both trigger engine initialization,
**Then** the `OnceCell`-guarded initialization runs exactly once and both requests share it (AD-16).

**Given** a network monitor observing the app,
**When** the Bucket is exercised — including the very first use,
**Then** zero network activity occurs; the bundled-models promise is verified, not assumed (AD-7, NFR1).

**Given** the v1 scope,
**When** reviewed,
**Then** OCR supports English only, and the French coupling rule (French lands in UI + OCR + NL→cron together, or not at all) is recorded for any future localization (FR25, AD-13).

## Epic 5: Umbra ships — releases, updates & landing page

Anyone can download a signed, notarized Umbra from the landing page, and installed copies self-update with explicit consent. Tag-driven release pipeline (AD-12), updater carve-out disclosed in README and in-app, NFR1 network-monitor release checklist, landing page with PostHog analytics, and the public P3 backlog established. macOS-only packaging by PRD decision (FR30/NFR3): Windows/Linux packaging is P3, with AD-11's CI matrix keeping the code ready meanwhile.

### Story 5.1: A signed, notarized Umbra anyone can download

As a privacy-conscious developer (and the recruiters auditing the pipeline),
I want every release built, signed, and notarized by a tag-driven pipeline and published on GitHub,
So that a fresh Mac opens Umbra with zero warnings and no hand-built artifact ever circulates.

**Acceptance Criteria:**

**Given** a version tag is pushed,
**When** the release workflow runs,
**Then** `tauri-action` builds, signs with the Developer ID certificate, notarizes with Apple, and publishes a versioned GitHub Release (FR30, FR32, AD-12),
**And** the release includes `latest.json` for the updater.

**Given** the published artifact,
**When** downloaded and opened on a fresh Mac (macOS 13+, Apple Silicon),
**Then** the app opens with no Gatekeeper bypass required (FR30).

**Given** the pipeline's secrets,
**When** audited,
**Then** the signing certificate, notarization credentials, and updater keypair exist only in GitHub Actions secrets — never in the repo (AD-12),
**And** the updater private key is backed up offline in two places before the first release ships (AD-12).

**Given** the repo's history,
**When** reviewed,
**Then** releases are tag-driven only, and Conventional Commits are in effect so a changelog can be generated later (FR32).

### Story 5.2: Umbra updates itself — with consent and full disclosure

As a privacy-conscious developer,
I want the app to offer updates that install only after my explicit confirmation, with the network exception disclosed loudly,
So that staying current never compromises the local-only promise silently.

**Acceptance Criteria:**

**Given** a newer release exists,
**When** the app checks the update feed,
**Then** an app-built confirmation dialog presents the update, and installation proceeds only after explicit user confirmation (FR31, AD-12 — the v2 updater plugin ships no dialog of its own).

**Given** the INV-1 carve-out,
**When** the README and the app's Settings/about surface are reviewed,
**Then** both disclose the update check as the sole permitted network call — shipping with only one of the two disclosures violates AD-7 (FR31).

**Given** the app's dependency tree and capabilities,
**When** audited,
**Then** `tauri-plugin-updater` is the only network-capable component and the webview still grants no network scope (AD-7).

**Given** the user declines an update,
**When** the dialog is dismissed,
**Then** no installation occurs and the app continues normally.

### Story 5.3: The privacy promise, proven at every release

As the developer (whose "Trusted" success metric depends on it),
I want a written, executed network-monitor procedure gating every release,
So that NFR1 is a verified fact on every version, not a slogan.

**Acceptance Criteria:**

**Given** a written release-checklist procedure,
**When** followed,
**Then** a network monitor observes the app while every tool is exercised, and the only permitted connection is the user-confirmed update check (NFR1).

**Given** a release PR,
**When** it is prepared,
**Then** the executed checklist result is recorded in the PR, and the release does not ship without it (AD-12).

**Given** the current release,
**When** this story completes,
**Then** the procedure has been executed against it at least once with a passing result.

### Story 5.4: A landing page that earns the download

As a privacy-conscious developer discovering Umbra,
I want a landing page stating the privacy promise, touring the features, and linking the current release,
So that I can evaluate and download Umbra in one visit.

**Acceptance Criteria:**

**Given** the landing page,
**When** visited,
**Then** it presents the privacy promise, a feature tour, and a download link resolving to the current GitHub Release (FR33),
**And** the stack/hosting decision is made and documented in this story, outside the app spine (spine deferred item closed).

**Given** the page is a learning unit,
**When** delivered,
**Then** SEO basics (titles, meta, semantic structure), deliberate copywriting, and analytics are part of the deliverable — not afterthoughts (FR33).

**Given** analytics,
**When** the page and app are audited,
**Then** PostHog runs on the landing page only; the app itself sends nothing (FR34, INV-2).

### Story 5.5: The public backlog opens

As the developer (whose recruiters read sustained activity),
I want a maintained public backlog seeded with the P3 candidates,
So that the school-year cadence has a visible, honest source of work.

**Acceptance Criteria:**

**Given** the public backlog (GitHub Issues/Projects),
**When** reviewed,
**Then** it is seeded with the PRD's P3 candidates — URL encoder, timestamp converter, color tools, regex tester, password-hash tool, local input history, Windows/Linux best-effort builds, French language support (with the AD-13 coupling rule noted), JWT signature verification, generated changelog, privacy-compatible error tracking (flagged as needing INV-1 review), browser-mode Playwright smoke e2e (FR35),
**And** items are labeled as candidates, not commitments.

**Given** the README,
**When** read,
**Then** it points to the backlog and states the intended week/fortnight cadence for Sept→March (FR35).

## Epic 6: Bucket growth — PDF, images & the second AI feature

The Bucket becomes a real file workbench: PDF merge/split/extract-text, image format conversion and compression — plus the FR29 choice carried as an explicit decision story, then implemented behind an AD-8-style port.

### Story 6.1: Work PDFs locally — merge, split, extract

As a privacy-conscious developer,
I want to merge, split, and extract text from PDFs entirely on-device,
So that client documents never touch an online PDF service.

**Acceptance Criteria:**

**Given** multiple PDFs dropped into the Bucket,
**When** I choose Merge,
**Then** a single merged PDF is produced in my chosen order and saved via the shared save helper (FR27, AD-15).

**Given** a dropped PDF,
**When** I specify a page range to split or extract,
**Then** a new PDF containing exactly those pages is produced (FR27),
**And** an out-of-bounds range yields a structured inline error.

**Given** a dropped PDF with extractable text,
**When** I choose Extract text,
**Then** the text displays editable with one-click copy (FR27, FR4).

**Given** the implementation,
**When** inspected,
**Then** PDF operations live in a new `umbra-core` module behind async commands (AD-1, AD-3), the crate choice (candidate: `lopdf`) is verified current at story start and license-checked for compatibility with an All-Rights-Reserved app, and it compiles on all three platforms (AD-11).

**Given** a corrupt or encrypted PDF,
**When** an operation is attempted,
**Then** a structured `ToolError` explains the failure — never a crash (NFR4).

### Story 6.2: Convert and compress images

As a privacy-conscious developer,
I want to convert images between formats and compress them with a quality preview,
So that I can prepare assets without an online converter.

**Acceptance Criteria:**

**Given** a dropped image,
**When** I choose a target format among PNG/JPEG/WebP/HEIC (**HEIC descoped from v1, see FR28 above and this story's own Task 1/3rd AC below**),
**Then** the converted file is produced and saved via the shared save helper (FR28, AD-15).

**Given** a lossy target format,
**When** I adjust the quality slider,
**Then** an estimated output size displays before saving, updating with the slider (FR28),
**And** the estimate is computed off the UI thread with latest-wins on rapid changes (AD-4, AD-16).

**Given** HEIC support,
**When** the crate route is evaluated in this story,
**Then** decode/encode support is verified against AD-11's three-platform compile gate,
**And** if HEIC cannot clear that bar, the limitation is surfaced as an explicit scope decision — never silently dropped (NFR3).

**Given** an unreadable or unsupported image,
**When** conversion is attempted,
**Then** a structured `ToolError` displays inline (NFR4).

### Story 6.3: Choose the second AI feature

As the developer (owner of the deferred FR29 decision),
I want to decide between regex-explain and OCR→structured using evidence from the MVP's AI work,
So that the second AI feature is chosen deliberately, not by drift.

**Acceptance Criteria:**

**Given** the OCR and NL→cron experience from Epics 3–4,
**When** the decision is made,
**Then** a written record states the choice, the rationale (local-inference capacity, latency, learning value), and the evidence consulted (FR29).

**Given** the option not chosen,
**When** the decision lands,
**Then** it is added to the public backlog as a candidate (FR35's backlog, INV-4 respected).

**Given** the chosen feature,
**When** the decision record completes,
**Then** it includes a sketch of the core-owned port interface it will sit behind (AD-8 pattern).

### Story 6.4: Ship the chosen AI feature

As a privacy-conscious developer,
I want the second AI feature working entirely on-device with honest limits,
So that Umbra's AI stays useful and trustworthy without the cloud.

**Acceptance Criteria:**

**Given** the feature chosen in Story 6.3,
**When** implemented,
**Then** its inference/logic sits behind a core-owned port with the UI and commands depending on the trait only (AD-8),
**And** it is registered as one more island in the Tool Registry (AD-5, AD-6).

**Given** input the feature cannot confidently handle,
**When** a result would display,
**Then** it degrades to an honest statement of what was understood — confident-wrong output is treated as a bug (FR21 bar via AD-9's principle, FR29).

**Given** the app with the new feature,
**When** the network monitor tour runs,
**Then** the feature triggers zero network activity (INV-1, NFR1).

**Given** keyboard-only usage,
**When** operating the feature,
**Then** controls are labeled, focus is visible, and the flow is mouse-free (NFR5).
