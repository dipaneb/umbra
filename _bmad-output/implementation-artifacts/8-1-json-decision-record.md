---
story: 8-1-reimagine-the-json-formatter-viewer
produced_by: bmad-party-mode (installed roster — Mary, John, Sally, Winston, Amelia, Paige), party_mode session
date: 2026-08-24
status: decided — Task 1 complete, gates Task 2
---

# Decision Record: JSON Formatter/Viewer scope (Story 8.1, Task 1)

Open scope discovery, run per Epic 8's shared story shape — the shipped implementation
(`src/tools/json/*`, `crates/umbra-core/src/json.rs`) was treated as reference only, not a
scope to preserve by default. Grounded in a live competitive sweep (10+ online JSON tools,
JSON Editor Online, JSONCrack, VS Code's JSON language features, Chrome DevTools' Network
panel) cross-checked against an independent second opinion the developer gathered separately,
then reconciled in this session. Developer confirmed all four open questions 2026-08-24.

## Kept — no material change

- Pretty-print/minify with 2-space, 4-space, and tab indentation (FR6).
- Syntax validation surfacing the first error with line/column position (FR7's mechanism —
  see **Revised** below for the message-quality change).
- The 100 MB input cap and reliance on `serde_json`'s 128-level recursion limit — both CWE-400
  defenses, both with existing regression tests. No evidence surfaced tonight that either
  ceiling is wrong; new tabs must be sanity-checked against them, not exempted.
- One-click paste/copy via the shared clipboard service (FR4).
- The `JsonTreeValue` wire type (order-preserving, exact-text numbers) — explicitly called out
  as an asset the new Diff and Query work builds on directly, not a liability to replace.

## Added — the redesign's real scope

Organized as five tabs (see **Container shape** below), each answering one distinct job
identified during discovery — not a feature list bolted onto the existing single-pane layout.

1. **Explorer** — the existing tree view, made real instead of read-only: inline editing of
   values (add/remove/move/duplicate fields), tree search/filter by key or value, and
   click-a-node-to-copy — both the value and its JSONPath (`$.data[3].user.email`), matching
   what nearly every serious competitor (and Chrome DevTools natively) already treats as table
   stakes. *Editability was the very first critique raised tonight (the current tree is
   view-only) and was never contested afterward — folded into Explorer's scope on that basis;
   flagged here explicitly in case that inference needs correcting.*
2. **Validate** — syntax validation, with two real upgrades: (a) error messages rewritten to
   name the actual failure the way the JWT Inspector already does (`"JWT signature invalid at
   segment 2 (payload)..."`) instead of passing `serde_json`'s generic English text through
   unchanged; (b) those rewritten codes added to `src/shell/toolError.ts`'s
   `TRANSLATABLE_CODES` set (currently holding exactly one entry, `uuid-count-zero` — every
   `json-*` code is untranslated today, a real pre-existing gap this redesign should close, not
   just prettify in English). Any error text that embeds a runtime value (a byte count, a
   token) must carry that value in a structured field, never baked into English prose — that
   file's own documented constraint on why a blanket translation isn't safe.
3. **Repair** *(new)* — attempts to fix common malformed-JSON issues (trailing/missing commas,
   single quotes, unquoted keys, JS-style comments, unclosed brackets — the same category
   `jsonrepair` and similar tools handle). **Ships as preview-then-confirm, never silent
   auto-apply** — shows what would change and why before touching the input. This is a direct,
   deliberate application of `AD-9`'s "never a confident-sounding wrong answer" principle and
   `EXPERIENCE.md`'s system-wide honesty bar to a tool that has nothing to do with cron; a
   silently-applied repair (e.g. its "keep only the last value" behavior on a duplicate key) is
   exactly the shape of thing those rules exist to prevent.
4. **Query** *(new)* — extract/filter a subset of a large document via a formal query
   expression (JSONPath or JMESPath — the exact language is Task 2's own live-verification call,
   per this project's standing dependency-verification discipline; not a natural-language
   parser, so no `AD-9`/`AD-13`-style honesty exception applies here the way it does for cron).
5. **Diff** *(new)* — structural compare of two JSON documents, tree-mode highlighting of what
   changed. Confirmed in scope tonight (the developer's "lock it in"), closing a real
   fragmentation gap ("two tabs and your own eyes") the competitive research surfaced directly.
   Builds on `JsonTreeValue`'s existing order/precision guarantees rather than needing a new
   representation.
6. **Transform** *(new)* — JSON → TypeScript interface generation ships first (the one target
   with actual evidenced demand — seven-plus dedicated competing tools found in research). Go,
   Python, YAML, and CSV targets are **explicitly deferred as their own later, separately-costed
   decision** — each is a real serializer with its own idiom questions (Go struct tags, Python
   dataclass vs. `TypedDict` vs. Pydantic, etc.), not a free extension of the TypeScript case.

### Container shape — tabs

The five tabs above (Explorer / Validate / Repair / Query / Diff / Transform — six items, five
conceptual "rooms" since Repair reads as validate-adjacent and may live inside the Validate tab
rather than as a fully separate one; **Task 2's own call**, not resolved further here) replace
the current single flat panel. This composes directly with a component `DESIGN.md` already
specs but no tool currently uses — `{colors.accent-default}` underline or pill, inactive tabs
in `{colors.text-secondary}` — so the redesign is the first real consumer of an already-locked
pattern, not an invented one. Explicit discipline for Task 2: every tab name must answer a job
someone could name (Explorer, Validate, Query, Diff, Transform all pass that test tonight); a
future tab named something vaguer ("Tools", "More") is the bloat this shape exists to prevent.

## Cut — considered, explicitly rejected, backlog candidates (FR35)

- **JSON Schema validation** (VS Code's headline JSON feature). Rejected: assumes the user has
  a schema on hand, which doesn't match this tool's actual job (paste-and-inspect an API
  response or config, not author against a known schema). A different job than the one this
  tool serves — not evidenced as needed by anything found in research.
- **Graph/node visualization** (JSONCrack's signature feature). Rejected: no research finding
  or discussion tonight identified an actual job it serves beyond "looks impressive" — reads as
  a demo feature, not a workflow need, for this tool's user.
- **Full JSONL/ndjson support** (multi-document streaming input — logs, ML datasets). Real,
  evidenced use case, but structurally different from everything else here: `json.rs`'s
  `format`/`minify`/`parse` trio and the 100 MB cap all assume exactly one JSON value in, one
  out. Supporting JSONL properly (streaming, per-line validation/errors) is a core-level fork,
  not a UI addition — deferred to the backlog as its own future story candidate rather than
  bundled into this redesign.
- **Go/Python/YAML/CSV transform targets** — see Transform above; not "cut" permanently, just
  not this story's Task 2 scope.

## FR6–FR9 revision

- **FR6** (pretty-print/minify, configurable indentation) — unchanged, stays accurate.
- **FR7** (validate, first error with line/column + human-readable message) — **revised**: the
  message-quality bar is raised to match the JWT Inspector's precedent, and coverage extends to
  real French translation via `TRANSLATABLE_CODES` (previously zero `json-*` coverage).
- **FR8** (display valid JSON as a collapsible tree view) — **revised/expanded**: the tree
  becomes editable, gains search/filter, and gains copy-value/copy-JSONPath — no longer a
  read-only view, effectively becomes the redesigned Explorer tab.
- **FR9** (10 MB, UI stays responsive) — unchanged as the performance floor; Query/Diff/Repair
  must be sanity-checked against Story 1.9's ~440–540 ms baseline before shipping, not assumed
  free of it.
- New capability areas this story adds (Repair, Query, Diff, Transform) aren't yet numbered
  FRs — final FR numbering in `epics.md` is the PM's call, not this record's; stated here as
  this story's actual scope addition, per Epic 8's own preamble that each story's FR revision
  is its own output.

## AD-1 functional-core split

- **Survives as-is in `crates/umbra-core/src/json.rs`:** `format`, `minify`, `parse`,
  `JsonTreeValue` and its `From<serde_json::Value>` conversion, `MAX_INPUT_BYTES` and the
  nesting-depth reliance on `serde_json`'s built-in limit.
- **New pure functions needed** (exact shapes/signatures are Task 2's design job, not
  pre-decided here):
  - `repair` — takes malformed input, returns a proposed-fix result (original + repaired +
    a description of each change) without applying anything; a separate explicit "apply" step
    is what actually replaces the input, keeping the preview-then-confirm contract honest at
    the core level, not just enforced in the view.
  - A query/filter function over `JsonTreeValue` (or the underlying `serde_json::Value`) for
    whichever query language Task 2 verifies and picks.
  - A diff function returning a machine-readable structural diff (not a string diff) over two
    `JsonTreeValue` trees, for the view to render as tree-mode highlighting.
  - A `to_typescript` transform function; sibling target-language functions deferred per the
    Transform decision above.
  - All new commands must respect `AD-4` (async off the UI thread for any real cost) and
    `AD-16` (latest-wins runner discipline — likely new independent runner scopes per tab, per
    the existing per-independent-state-group rule `JsonView.vue` already follows for
    Format/Minify/Paste vs. live tree-parsing).

## i18n / AD-13 finding

Confirmed: none of the new tabs involve a natural-language grammar the way NL→cron does
(JSONPath/JMESPath are formal expression languages, not English; repair's heuristics are
structural, not linguistic) — so, unlike the cron tool, **no `AD-13`-style disclosed exception
is needed**. French is included by default via the app's existing `vue-i18n` seam, the same way
every other tool handles it. The one real, pre-existing gap found and folded into the Validate
tab's scope: `TRANSLATABLE_CODES` currently covers zero `json-*` error codes.

## Open items Task 2 still owns (not decided here)

- Whether Repair is its own tab or lives inside Validate.
- The exact query language (JSONPath vs. JMESPath) — live-verify per this project's standing
  dependency-verification discipline before committing.
- Exact tab set naming/order, and the real Given/When/Then acceptance criteria for each — Task
  1's whole point was to make Task 2's ACs real instead of fiction; that's next.

**Resolved 2026-08-24** (same `bmad-party-mode` room, AC-writing session — see the story
file's "Acceptance Criteria — Task 2 (Redesign)" section, AC6–14): Repair ships as its own
tab, cross-linked from Validate's error state — the preview-then-confirm interaction model
doesn't fit inside a read-only diagnostic tab. Query speaks JSONPath (RFC 9535) via the
`serde_json_path` crate — standardized, drops directly onto the existing `serde_json::Value`
core type, and stays consistent with Explorer's own copy-JSONPath output (JMESPath was
rejected on exactly that last point). Tab order/naming: Explorer, Validate, Repair, Query,
Diff, Transform.
