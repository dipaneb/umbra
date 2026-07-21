# Reconcile check — ARCHITECTURE-SPINE.md vs epics.md

Scope: line-by-line comparison of spine AD-1..AD-16 against epics.md's
"Architecture decisions binding story implementation" section (the ground
truth for the destroyed original spine), plus Structural Seed vs. cited
module names, plus FR Coverage Map plausibility. PRD and the standalone story
file were explicitly out of scope for this pass.

## Verdict

**PASS.** All 16 ADs match epics.md's restatement clause-for-clause — no
dropped/weakened/contradicted clauses, no AD-number mismatch, no missing
threshold (~100ms in AD-4, ~64KB in AD-15, both preserved verbatim). Module
names cited in story ACs are correctly reflected, unmarked, in the Structural
Seed. FR Coverage Map is plausibly supported epic-by-epic. Two minor
observations below, neither a spine defect.

## AD-by-AD check (AD-1 → AD-16)

Every AD's Rule text in the spine reproduces (often with added precision) the
corresponding bullet in epics.md's AD summary:
- AD-1/AD-2 (core purity, no Tauri/no cfg(target_os)): match.
- AD-3 (ToolError shape, naming): match verbatim, including field list and
  `<tool>_<verb>` naming.
- AD-4 (~100ms threshold, virtualization, lazy OCR init): match verbatim.
- AD-5 (single Tool Registry): match.
- AD-6 (tools are islands, Pinia settings/registry): match.
- AD-7 (zero network except updater, oar-ocr auto-download disabled,
  dual disclosure): match.
- AD-8 (OCR trait, oar-ocr adapter): Rule text matches; spine deliberately
  omits a version number here (see observation 1 below).
- AD-9 (round-trip validation, corpus as automated test): match. AD number
  confirmed consistent — epics.md's "AD-9" for the corpus test is the same
  AD-9 in the spine.
- AD-10 (single persistence writer, `shell.*`/`<tool-id>.*` namespacing):
  match.
- AD-11 (CI on ubuntu+windows, ort-sys caching): match.
- AD-12 (tag-driven signed/notarized release, secrets, key backup,
  NFR1 tour recorded in PR): match.
- AD-13 (localization ships as one unit): match.
- AD-14 (shell owns OS I/O edges once, navigator.clipboard forbidden): match.
- AD-15 (paths over IPC, ~64KB ceiling, clipboard-image exception): match
  verbatim, including the ~64KB threshold and the raw-IPC-body exception.
- AD-16 (request-ID + latest-wins, OnceCell OCR init, no progress/cancel
  in v1): match.

## Module names (umbra-core::json / ::base64 / ::hash / ::jwt / ::cron)

All five are cited directly in epics.md story ACs (1.4, 2.1, 2.4, 2.6, 3.1)
and all five appear unmarked (no `[ASSUMPTION]` tag) in the spine's
Structural Seed (`src/json.rs`, `src/base64.rs, hash.rs, jwt.rs`,
`src/cron.rs`) — correct treatment, since epics.md states these directly
rather than the spine inferring them.

`src/ocr.rs` and `src/pdf.rs, image.rs` remain correctly marked
`[ASSUMPTION: module name(s)]` — epics.md never cites an exact filename for
OCR (Story 4.1 only says "`umbra-core` defines the OCR trait"), PDF (Story
6.1 says "a new `umbra-core` module"), or image ops (Story 6.2, no module
named). The spine's assumption-marking is accurate, not over- or
under-claimed.

## FR Coverage Map plausibility (epic by epic)

- Epic 1 (FR1-FR9): sidebar/palette/JSON — supported by
  `src/tools/`, `shell/`, `stores/`, `src/json.rs`.
- Epic 2 (FR10-FR18): Base64/UUID/hash/JWT — supported by
  `base64.rs`/`hash.rs`/`jwt.rs`; see observation 2 re: UUID.
- Epic 3 (FR19-FR22): NL↔cron — supported by `cron.rs`, AD-9.
- Epic 4 (FR23-FR26): OCR — supported by `ocr.rs`, `resources/models/`,
  AD-8/AD-7.
- Epic 5 (FR30-FR35): releases/updates/landing — supported by
  `.github/workflows/ci.yml`, AD-12; landing page correctly left as a
  Deferred item ("outside this app spine's boundary"), consistent with
  epics.md deferring the landing stack/hosting decision to Story 5.4.
- Epic 6 (FR27-FR29): PDF/image/2nd AI feature — supported by `pdf.rs`,
  `image.rs`, and the AD-8-pattern port deferred to Story 6.3/6.4.

No FR is orphaned; no epic's coverage claim is architecturally unsupported.

## Observations (not spine defects)

1. **oar-ocr version — epics.md itself is stale, spine already corrected it.**
   Epics.md's AD-8 restatement and Story 4.1's acceptance criteria both still
   say "`oar-ocr` 0.8.x is the v1 adapter" (lines 123, 631), and the epics.md
   Stack line also says `oar-ocr` 0.8.x. The spine's Stack table flags this as
   a version that never existed for the crate and corrects it to 0.2.x,
   verified 2026-07-20. The spine's AD-8 Rule text wisely avoids restating
   any version number, deferring to the Stack table's correction. This is
   the spine behaving correctly — but it means epics.md now contains a
   stale/wrong version pin in three places that no one has gone back to fix.
   Not this reviewer's file to edit, flagging for awareness only.

2. **No `umbra-core` module named for UUID generation (FR13).** Story 2.3
   ("Generate UUIDs") has no `umbra-core::<module>` citation in its
   acceptance criteria — unlike Base64/hash/JWT, epics.md never names a
   UUID module. The spine's Structural Seed correspondingly lists no
   `uuid.rs` (or similar) under `crates/umbra-core/src/`, not even as an
   `[ASSUMPTION]`. This is a consistent omission between the two documents
   (not a contradiction), but per AD-1 UUID generation logic must still live
   in `umbra-core` as a pure function — the Structural Seed has a genuine
   gap here that neither source document surfaces. Worth a spine addendum
   (e.g. `src/uuid.rs # Epic 2 [ASSUMPTION: module name]`) even though it's
   not a reconciliation error.
