---
title: 'Tool Registry id-uniqueness guard'
type: 'chore'
created: '2026-07-29'
status: 'done'
review_loop_iteration: 0
context: []
route: 'one-shot'
---

## Intent

**Problem:** The Tool Registry (AD-5) has no guard against two entries sharing an `id`. Epic 1 shipped with a single entry so it never surfaced, but Epic 2 adds 6 entries at once — the retro flagged this as the first real collision risk in the codebase.

**Approach:** Per the architect's guidance, a duplicate `id` should fail loud the moment a developer writes it, not be tolerated behind a soft runtime check. `assertUniqueToolIds()` runs as a module-load side effect against the registry's hardcoded `TOOLS` array, throwing immediately if any two entries collide.

## Suggested Review Order

**Assertion logic**

- Entry point: throws on the first collision it finds, reporting every colliding id (not just the first).
  [`registry.ts:20`](../../src/stores/registry.ts#L20)

- Runs at module evaluation time — before any Pinia store is instantiated, before any user interaction.
  [`registry.ts:43`](../../src/stores/registry.ts#L43)
  [`registry.ts:54`](../../src/stores/registry.ts#L54)

**Shared-reference fix**

- `ref()` wraps arrays by reference, not by value — each store instance now gets its own array copy so `TOOLS` (needed for the module-load assertion) isn't mutated by every consumer.
  [`registry.ts:61`](../../src/stores/registry.ts#L61)

**Tests**

- Unique ids, a single collision, multiple collisions, and the empty-array edge case.
  [`registry.spec.ts:16`](../../src/stores/registry.spec.ts#L16)
