---
review: reconcile-prd
target: ARCHITECTURE-SPINE.md
source: prd-Umbra-2026-07-19/prd.md
date: 2026-07-20
---

# Reconcile: Architecture Spine vs. PRD

## Method

Read the spine in full (16 ADs, Consistency Conventions, Stack, Structural Seed,
Deferred list) and the PRD in full (INV-1–4, FR1–35, NFR1–7, §2 demo scenario,
§9 Resolved questions). Checked every requirement/invariant/NFR for spine coverage,
scanned for quiet-requirement phrases ("loud when not", "visibly flag", "silent")
that might have been flattened, checked Stack/Structural Seed against §9's
resolved decisions, and walked the §2 five-minute demo step by step against the
spine's structure.

## Overall verdict

The spine covers the PRD well. All four invariants and all seven NFRs have at
least implicit architectural support; the §2 demo flow is structurally
supported end to end (cold launch budget via AD-4's lazy OCR init, ⌘K via
AD-14, JSON/JWT/cron/OCR each map to a documented AD, Wi-Fi-off via AD-7). No
contradictions found between the Stack table / Structural Seed and PRD §9's
resolved questions — the OCR/ONNX and license decisions are consistent, and the
NFR1 "conditional first-use download" carve-out is cleanly resolved by AD-7's
choice to bundle models with auto-download disabled.

Two real gaps found, both in the "quiet requirement dropped" category the task
asked to hunt for.

## Findings

### 1. FR17's "visibly flag expired tokens" has no architectural home (MEDIUM)

FR17: "Render registered timestamp claims (`exp`, `iat`, `nbf`) as
human-readable local datetimes and **visibly flag expired tokens**." AD-3's
`ToolError` shape (`code`, `message`, `position`, `context`) models *hard
errors* only — a JWT that decodes successfully but is expired is not an error,
it's a soft warning state. Nowhere in the spine is there a convention for
this class of state (valid-but-flagged), unlike FR21's honesty bar, which got
its own dedicated mechanism (AD-9: round-trip verification + corpus test).
AD-1's "core returns machine values, view renders" pattern makes FR17
*achievable* (core returns the epoch, view compares against now and flags
it), but the spine never says so — it's left implicit, with no equivalent
enforcement AD-9 gives cron correctness. Worth either an explicit line in
AD-1/AD-3 or accepting this is intentionally left to feature-level UI work.

### 2. NFR5's "fully drivable without the mouse" is only partially covered (MEDIUM)

NFR5: "The demo flow in §2 is fully drivable without the mouse." The spine's
only accessibility convention (Consistency Conventions table) is "Labels,
visible focus states, WCAG AA contrast (4.5:1 text) checked at PR review from
v1." That covers *visibility* of focus, not *keyboard operability* of the
demo's actions themselves (drag-and-drop into the Bucket, copy/paste,
tool-switching) — AD-14 gives ⌘K a capture-phase handler and states "pasted
images dispatch like drops" (paste is keyboard-reachable), but drag-and-drop
itself has no stated keyboard-accessible equivalent, and no AD claims full
demo-flow keyboard traversal as a design constraint. Given "no UX design
contract exists" (Deferred list), this may be intentionally left for the UX
phase — but as written, NFR5's specific "fully drivable without the mouse"
clause is not structurally guaranteed by anything in the spine.

### 3. NFR6's "eslint, format check" not named in CI ADs (LOW)

NFR6: "CI on every PR (clippy, eslint, format check, tests)." AD-11 specifies
"`cargo check` + clippy run on `ubuntu-latest` and `windows-latest`" — Rust
side only. The Consistency Conventions "Code quality" row adds "clippy `-D
warnings`; TypeScript `strict`" but never mentions eslint or a JS/Vue format
check as a CI gate. `.github/workflows/ci.yml` appears in the Structural Seed
but with no content spec. Frontend lint/format enforcement is implied by
NFR6 but not committed to in any AD — likely just needs a line added to
AD-11 or the CI convention row rather than a structural rework.

### 4. INV-2 (no app telemetry) has no dedicated AD, only inherited coverage (LOW)

INV-2: "The app sends nothing. Analytics (PostHog) live on the landing page
only." The spine never states this directly; it's covered only as a subset
of AD-7's broader "zero network surface except the updater." Since telemetry
requires network I/O, AD-7 does structurally satisfy INV-2 — this is not a
gap in practice, just a case where the PRD's invariant isn't traceable to a
named AD the way INV-1/INV-3 are (each got AD-7/AD-10 explicitly binding to
them). Flagging for completeness only; no action likely needed.

### 5. FR9's ~200ms UI-thread budget vs. AD-4's ~100ms offload threshold — not a conflict, just worth a cross-reference (LOW / non-issue)

FR9 requires "no main-thread block over ~200 ms" for 10MB JSON documents;
AD-4 offloads work exceeding "~100ms CPU" to the async thread pool. These are
different measurements (Rust-side compute-offload trigger vs. UI-thread block
budget) and the numbers are compatible (offloading at 100ms leaves margin
under a 200ms UI budget), so this is not a contradiction. Noting only because
a future reader skimming both numbers in isolation could mistake it for one.

## Non-findings worth recording

- INV-1's "loud when not" is well-served: AD-7 explicitly requires the
  updater carve-out be "disclosed in both README and in-app (never just
  one)" — this operationalizes "loud" rather than dropping it.
- §9's OCR/ONNX, license (All Rights Reserved), and NL→cron (deterministic
  parser) resolved decisions are all consistent with the spine's Stack table
  and ADs — no contradictions found.
- The §2 five-minute demo scenario is supported end to end by the spine's
  structure (AD-4, AD-5, AD-7, AD-8, AD-9, AD-14 collectively cover every
  step) — no missing structural support found here.
