---
title: "Umbra — PRD"
status: final
created: 2026-07-19
updated: 2026-07-19
---

# Umbra — PRD

> The working title was retired after a trademark collision with an existing company — **Umbra** is final. Repo name, bundle identifiers, and landing page all use Umbra.

## 1. Overview

Umbra is a desktop app — macOS-first, kept cross-platform-clean so Windows and Linux builds can follow (NFR3) — that bundles the small utilities developers reach for daily (JSON formatting, encoding, cron expressions, OCR) behind one hard promise: **your data never leaves your machine.** In v1 this is absolute: the app makes no network calls from any tool or AI feature, ever. The local-AI showcase is the Bucket's ONNX OCR; NL→cron ships deterministic in v1 with a local-model/hybrid upgrade planned for v2, and a cloud opt-in path is also deferred to v2.

Built with Rust + Tauri 2 + Vue 3. Public repo from day one, **All Rights Reserved**.

**Positioning.** Umbra does not out-feature DevToys/DevUtils/DevTools-X on classic tools. Its identity is narrower and sharper: _the privacy-first toolbox where even the AI is private_. And it is not an AI wrapper: AI lives inside real tools (OCR in the Bucket, natural-language cron), never as a chat box bolted on.

**Dual purpose, both first-class.** Umbra serves privacy-conscious developers, and it is the developer's vehicle to learn Rust/Tauri/local AI/shipping, producing a portfolio piece for internship applications (season open now; internship March 2027). Requirements below are scoped so the whole thing is _finishable_ on the timeline in §7 and _demoable_ in a 5-minute interview segment.

## 2. Users & demo scenario

1. **Primary: the developer + recruiters/interviewers.** The app, its repo, and its release pipeline are all exhibits.
2. **Secondary: privacy-conscious developers and freelancers** who handle client data they can't paste into random formatter websites. Companies (seats, SSO, MDM) are v2+ — the tools wouldn't change, the surroundings would.

**The 5-minute demo (scope anchor).** Every MVP feature must earn a place in this flow: open Umbra → summon the command palette → format a JSON payload → decode a JWT → type "every Monday at 9am", get `0 9 * * 1` → drag a screenshot of an error dialog into the Bucket, get copyable text — then show Wi-Fi is off the whole time. If a proposed feature doesn't make this demo or a recruiter's repo tour better, it waits.

## 3. Product invariants

These override any individual requirement and any future addition:

- **INV-1 — Local by default, loud when not.** In v1: no tool, AI feature, or background process initiates network traffic. The only permitted exceptions are individually disclosed carve-outs (FR31's update check; at most one more — see NFR1). When a cloud path arrives (v2+), it is opt-in per feature, behind an explicit, visible warning.
- **INV-2 — No app telemetry in v1.** The app sends nothing. Analytics (PostHog) live on the landing page only.
- **INV-3 — User data stays on-device and under user control.** Tool inputs are processed in memory. Convenience persistence is allowed where genuinely useful (e.g. a local history of recent inputs — P3 candidate), but only stored locally, visible in Settings, and clearable in one action. Nothing is ever persisted silently in a way the user can't see and erase.
- **INV-4 — Frozen MVP.** The feature list in §4/FR set below does not grow until the MVP ships. New ideas go to the backlog.

## 4. Features & functional requirements

FR IDs are global and stable. Phases: **MVP** (target ~Aug 8), **P2** (rest of August), **P3** (school-year cadence, Sept→March).

### F1 — App shell (MVP)

- **FR1.** The app presents all tools in a persistent sidebar/launcher; selecting a tool opens it in the main pane.
- **FR2.** A command-palette-style search (global keyboard shortcut `⌘K`) finds tools by name and by aliases/synonyms ("b64" → Base64) and opens them.
- **FR3.** The UI ships light-mode-first; a dark theme is deferred to v2.
- **FR4.** Each tool provides one-action paste-from-clipboard input and copy-to-clipboard output where the tool shape allows it.
- **FR5.** The app restores the last used tool and window geometry on launch, controlled by a toggle in a minimal Settings pane (default on).

### F2 — JSON formatter/viewer (MVP)

- **FR6.** Pretty-print and minify JSON, with configurable indentation (2/4 spaces, tabs).
- **FR7.** Validate JSON and report the first error with line/column position and a human-readable message.
- **FR8.** Display valid JSON as a collapsible tree view alongside the text view.
- **FR9.** Handle documents of at least 10 MB with the UI staying responsive throughout (no beachball; no main-thread block over ~200 ms).

### F3 — Base64 encode/decode (MVP)

- **FR10.** Encode/decode text ↔ Base64, including the URL-safe alphabet, with automatic detection of decode input.
- **FR11.** Encode a dropped file to Base64 and decode Base64 to a downloadable file (data URIs, certificates, binary API payloads are everyday cases).
- **FR12.** Invalid input produces a clear inline error, never a crash or silent empty output.

### F4 — UUID & hash generator (MVP)

- **FR13.** Generate UUIDs v4 and v7, single or in bulk (up to 1000), with one-click copy.
- **FR14.** Compute SHA-256 and SHA-512 digests of text input, plus MD5 and SHA-1 labeled as legacy (still ubiquitous for checksums and interop), shown simultaneously; hex output, uppercase/lowercase toggle. bcrypt/argon2 are deliberately excluded here: they are salted password-hashing functions, a different tool category — a "password hash generate & verify" tool is a P3 backlog candidate (FR35).
- **FR15.** Compute the same digests for a dropped file.

### F5 — JWT decoder (MVP)

- **FR16.** Decode a pasted JWT into header and payload, pretty-printed, without any network call (per INV-1 — no JWKS fetching).
- **FR17.** Render registered timestamp claims (`exp`, `iat`, `nbf`) as human-readable local datetimes and visibly flag expired tokens.
- **FR18.** Malformed tokens produce a precise error (which segment failed, why). Signature _verification_ is P2 at the earliest.

### F6 — Natural language ↔ cron (MVP, AI-flavored)

- **FR19.** Convert a natural-language schedule ("every Monday at 9am") to a standard 5-field cron expression, fully offline (INV-1). **Decided:** v1 uses a deterministic parser (exact, tiny, testable); the small-local-model/hybrid upgrade is v2 (see addendum).
- **FR20.** Convert a cron expression to a plain-English description, including the next 3 upcoming run times.
- **FR21.** When the input can't be confidently converted, the tool says so and shows what it _did_ understand — no silently wrong cron. This is the AI-quality bar: wrong-but-confident output is a bug, not a model limitation. Acceptance basis: the canonical phrase corpus in the addendum (must-convert and must-honestly-fail sets), maintained as an automated test.
- **FR22.** English input only in v1 (French is a P3 candidate, coupled with FR25's rule).

### F7 — The Bucket, v0: local OCR (MVP — flagship demo)

- **FR23.** A drop zone accepts images (PNG, JPEG, WebP, plus pasted screenshots — TIFF dropped as uncommon for this use case) and extracts their text via a **local ONNX OCR model** (INV-1). **Decided:** ONNX over macOS Vision, so the Bucket stays portable to Windows/Linux (NFR3).
- **FR24.** Extracted text is shown editable with one-click copy; extraction of a typical screenshot completes in under ~3 s on Apple Silicon.
- **FR25.** OCR supports English in v1. **Coupling rule:** any future French localization of the app must add French to the OCR and NL→cron tools in the same release — a half-localized privacy tool reads as unfinished.
- **FR26.** Failed or empty extractions state so explicitly (vs. showing a blank result).

### F8 — Bucket growth (P2)

- **FR27.** PDF: merge multiple PDFs, split/extract page ranges, and extract text — all locally.
- **FR28.** Images: convert between common formats (PNG/JPEG/WebP/HEIC) and compress with a quality slider showing estimated output size.

### F9 — Second AI feature (P2 — pick one, backlog the other)

- **FR29.** _Either_ "explain this regex" (regex → structured plain-English breakdown, local inference) _or_ OCR→structured ("photo of a table → JSON"). Choice deliberately deferred to post-MVP, based on what the OCR/NL-cron work reveals about local-inference capacity. FR21's honesty bar applies.

### F10 — Distribution & updates (P2 — shipping is part of "finished")

- **FR30.** macOS release builds are signed with a Developer ID certificate and notarized by Apple; the app opens on a fresh Mac with no Gatekeeper bypass. Windows/Linux packaging arrives with their builds (NFR3), not in P2.
- **FR31.** The app self-updates (Tauri updater or equivalent — architecture decides) with user confirmation before install; the update check is the sole permitted network call and is documented as such (INV-1 carve-out, disclosed in README and app).
- **FR32.** Versioned GitHub releases. Commit history follows Conventional Commits so a `CHANGELOG.md` can be generated later; the changelog itself is deferred to the backlog.

### F11 — Landing page (P2)

- **FR33.** A landing page presents the privacy promise, feature tour, and a download link for the current release. It is treated as a distinct learning unit: SEO basics, copywriting, and analytics are part of the deliverable, not an afterthought.
- **FR34.** PostHog analytics on the landing page only (INV-2).

### F12 — School-year cadence (P3, backlog-driven)

- **FR35.** One small tool or improvement ships per week/fortnight Sept→March, drawn from a maintained public backlog — recruiters read sustained activity as strongly as the code itself. Candidates (not commitments): URL encoder, timestamp converter, color tools, regex tester, password-hash tool (bcrypt/argon2 generate & verify), local input history (per INV-3), Windows/Linux best-effort builds (NFR3), French language support (UI + OCR + NL→cron together, per FR25's coupling rule), JWT signature verification, generated `CHANGELOG.md`, privacy-compatible error tracking (would be another INV-1 carve-out — needs explicit review), browser-mode Playwright smoke e2e (learning unit).

## 5. Non-functional requirements

- **NFR1 — Privacy (testable).** A network monitor observing the v1 app during use of every tool records zero outbound connections, with at most two disclosed exceptions: FR31's update check, and — only if architecture rejects bundling the ONNX OCR model (bundling is preferred; NFR2 tolerates the size) — a one-time first-use model download following the FR31 disclosure pattern. This is a release-blocking test.
- **NFR2 — Performance.** Cold launch < 2 s. Installed size: lightweight as a goal, and exceeding 100 MB is acceptable when justified (e.g. a bundled local-inference model) — reasonable and explained beats artificially small.
- **NFR3 — Platform.** macOS 13+ on Apple Silicon is the primary platform: fully tested, signed, notarized, first to get every release. The codebase stays **cross-platform-clean** — no macOS-only dependency in any core path (the ONNX OCR decision exists for this reason). Windows/Linux builds are a stated goal, shipped best-effort (CI-built, lightly tested — no second machine for frequent testing), targeted for P3. `[ASSUMPTION on P3 timing]`
- **NFR4 — Robustness.** No user input (malformed, huge, binary garbage) crashes the app; errors are always shown in-tool.
- **NFR5 — Keyboard & accessibility.** The demo flow in §2 is fully drivable without the mouse, and the app meets an accessibility baseline from v1: visible focus states, labeled controls (VoiceOver-readable), WCAG AA contrast (4.5:1 for text).
- **NFR6 — Repo as exhibit.** GitHub flow with PRs (self-reviewed), CI on every PR (clippy, eslint, format check, tests), Rust unit tests for tool logic, integration tests over Tauri commands, Dependabot/Renovate. No e2e suite in v1 (macOS `tauri-driver` gap — see brief addendum).
- **NFR7 — License.** Public repo under **All Rights Reserved** from the moment it goes public: source visible to everyone (recruiters included), but no permission granted to use, copy, modify, or distribute it — no conversion to a permissive license.

## 6. Success metrics & counter-metrics

| Goal              | Metric                                                                                                                 | Counter-metric                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Finished**      | Signed, notarized, downloadable app + landing page live by early September                                             | Not at the cost of INV-4: features cut to make the date beat features added late                            |
| **Learned**       | The developer can explain, from experience: the Rust/Tauri bridge, local-inference integration, and the CI/release pipeline | AI-assisted code they can't explain in an interview counts against this, not toward it                        |
| **Told**          | Project on the resume and discussed in ≥1 internship interview by early 2027                                           | Sustained P3 cadence must be real improvements, not commit-graph padding                                    |
| **Used** (modest) | Landing-page visits and download count trending non-zero after P2 launch (via FR34's PostHog)                          | Vanity numbers don't gate anything — the metric exists to honor the secondary audience, not to chase growth |
| **Trusted**       | NFR1 passes on every release; zero privacy-promise exceptions beyond FR31                                              | —                                                                                                           |

## 7. Timeline (from the brief)

- **July 19 → ~Aug 8:** MVP (F1–F7), full-time. Risk guard: this window coincides with first contact with Rust — the MVP's Rust surface is deliberately thin (tool logic + Tauri commands); complexity ramps post-MVP.
- **Aug 8 → early Sept:** P2 (F8–F11).
- **Sept → March:** P3 cadence (F12); internship applications reference the live project.

## 8. Out of scope for v1

Cloud AI opt-in path (v2 — decided in this PRD), NL→cron local-model/hybrid upgrade (v2), dark theme (v2), in-app telemetry (v2, opt-in and anonymous if ever), RAG, accounts/sync, payments/freemium, plugin system, teams/SSO/MDM, e2e test suite. All recorded as _later_, not _never_. Windows/Linux moved from "out of scope" to a P3 best-effort goal (NFR3) — decided in this PRD.

## 9. Resolved questions

All four open questions from the brief were decided on 2026-07-19 during this PRD:

- **Name → Umbra.** The working title was dropped after a trademark collision with an existing company.
- **License → All Rights Reserved.** Revised 2026-07-20 (was FSL): recruiter-readable, but no reuse by anyone — FSL's eventual conversion to a permissive license and interim non-commercial reuse allowance were more than intended.
- **OCR → ONNX model** (Hugging Face export via `ort` or similar). Chosen over macOS Vision specifically to keep the Bucket portable to Windows/Linux (NFR3). Exact model selection is an architecture-phase task.
- **NL→cron → deterministic parser in v1**; small-local-model/hybrid upgrade in v2. FR21's honesty bar applies to both stages.

## 10. Glossary & assumptions

- **The Bucket** — Umbra's drop-zone tool family: drag a file in, get a useful transformation out (OCR in v0; PDF/image operations in P2).
- **Carve-out** — a narrowly scoped, individually disclosed exception to INV-1's no-network rule (FR31's update check; conditionally, the OCR model's first-use download per NFR1).
- **Coupling rule** — FR25's requirement that French localization land in UI, OCR, and NL→cron together.
- **P2 / P3** — delivery phases (rest of August / school-year cadence); see §4 header and §7.

**Assumptions index** (one open): NFR3 — Windows/Linux best-effort builds targeted for P3; timing owned by the developer, revisited when the P3 backlog is first groomed (September).
