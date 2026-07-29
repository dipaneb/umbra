---
title: 'JSON parser nesting-depth cap'
type: 'chore'
created: '2026-07-29'
status: 'done'
review_loop_iteration: 0
context: []
route: 'one-shot'
---

## Intent

**Problem:** The Epic 1 retro flagged the JSON parser as missing a nesting-depth cap — F6 capped input *size* but the retro assumed depth was unguarded. Investigation found that premise false: `serde_json::from_str::<Value>` already enforces a 128-level recursion limit by default, verified empirically (a 100,000-deep nested array returns a clean error, not a crash).

**Approach:** Lock in the existing protection instead of writing redundant depth-counting logic: document why it holds, add regression tests proving `parse`/`format`/`minify` cleanly reject deep nesting (and that moderate nesting still succeeds), and correct an inaccurate Story 1.8 deferred-work note that assumed the opposite.

## Suggested Review Order

**Documentation of existing protection**

- Explains why the 128-level limit holds today and what would have to change to reopen it.
  [`json.rs:32`](../../crates/umbra-core/src/json.rs#L32)

**Regression tests**

- Deep nesting is syntactically valid JSON, so an error here is attributable to depth alone — no message-text coupling needed.
  [`json.rs:368`](../../crates/umbra-core/src/json.rs#L368)
  [`json.rs:375`](../../crates/umbra-core/src/json.rs#L375)
  [`json.rs:382`](../../crates/umbra-core/src/json.rs#L382)

- Boundary check on the legitimate side, so a future serde_json release that *lowers* the limit doesn't pass silently.
  [`json.rs:393`](../../crates/umbra-core/src/json.rs#L393)

**Record correction**

- Marks the superseded Story 1.8 claim and appends the corrected finding.
  [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md)
