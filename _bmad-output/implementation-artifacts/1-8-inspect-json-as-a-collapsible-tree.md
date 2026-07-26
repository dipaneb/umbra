---
baseline_commit: dd66d57
---

# Story 1.8: Inspect JSON as a collapsible tree

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer,
I want valid JSON displayed as a collapsible tree beside the text view,
so that I can explore a payload's structure without reading raw braces.

## Acceptance Criteria

1. **Given** valid JSON in the tool, **when** it is parsed, **then** a collapsible tree view renders alongside the text view with expand/collapse per node (FR8), **and** the parsed tree crosses the IPC bridge once as a single payload (spine default; see Story 1.9 for the fallback rule) — parsing happens live from the input field (not gated behind a Format/Minify click), exposed as `umbra-core::json::parse` via the async command `json_parse` returning `Result<JsonTreeValue, ToolError>` — an order-preserving wire type, not a bare `serde_json::Value` (AD-1, AD-3).
2. **Given** a document with many nodes, **when** the tree renders, **then** only visible nodes exist in the DOM (virtualized rendering — AD-4), **and** collapsed subtrees are excluded from the render pipeline entirely, not merely hidden with CSS.
3. **Given** invalid JSON, **when** the tree pane is shown, **then** it displays an explicit "tree unavailable" state, never a stale or blank tree.
4. **Given** keyboard-only usage, **when** navigating the tree, **then** nodes are focusable with visible focus states and expandable via keyboard (NFR5).

## Tasks / Subtasks

- [x] **Task 1: Add the tree virtualization dependency** (AC: 2)
  - [x] No virtualization library exists in this repo yet. Add **`@tanstack/vue-virtual`** — verified directly against the npm registry API this session: latest is `3.13.34`, MIT licensed, peer dependency `vue: ^2.7.0 || ^3.0.0` (compatible with this project's Vue `^3.5.13`). It's a *headless* virtualizer (renders nothing itself, just computes which indices are visible) — it does not count as "a new styling/component framework," so it doesn't conflict with the spine's Deferred note that no such framework has been chosen yet.
    ```
    pnpm add @tanstack/vue-virtual@^3.13.34
    ```
  - [x] Add this dependency to `ARCHITECTURE-SPINE.md`'s Stack table (`_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md`), and resolve the spine's Deferred item *"JSON tree IPC transfer strategy. Defaults to one payload + virtualized DOM"* by naming this library as the chosen virtualizer — this story is what actually makes that choice; the spine only anticipated the shape of the decision, not the library.

- [x] **Task 2: Implement `umbra-core::json::parse` and an order-preserving wire type** (AC: 1) — reuses this story's existing error-mapping machinery, but **does not** return a bare `serde_json::Value` to the frontend (see the critical note below)
  - [x] In `crates/umbra-core/src/json.rs`, add:
    ```rust
    pub fn parse(input: &str) -> Result<serde_json::Value, ToolError> {
        serde_json::from_str(input).map_err(map_parse_error)
    }
    ```
    Reuses the exact `map_parse_error` already defined in this file (Story 1.7) — same `"json-syntax"` code and `Position::LineCol` shape as `format`/`minify`'s errors, so the tree pane's validity signal is driven by the same source of truth as the text view's errors, not a second, potentially-divergent parser.
  - [x] **Critical — do not serialize the tree's IPC payload as a native JSON object for the `Object` case.** `serde_json::Value::Object` round-trips through Tauri's IPC as a plain JSON object, and when the frontend receives it, the JS engine applies the ECMAScript spec's own key-ordering rule: canonical-integer-string keys (`"0"`, `"1"`, `"2"`, ...) are always enumerated in ascending numeric order *before* any other string keys, regardless of source/insertion order. This is a real-world case, not a theoretical one — numeric-ID-keyed objects (`{"0": "a", "1": "b", "name": "x"}`) are common in API payloads. `format`/`minify` never hit this because they never materialize a JS object — they only ever produce a *string*. The tree does materialize one, so it needs a wire shape immune to this. Add a second type that serializes objects as an **array of `(key, value)` tuples**, not a native object — arrays fully preserve order regardless of what the keys look like:
    ```rust
    #[derive(Debug, Clone, PartialEq, serde::Serialize)]
    #[serde(tag = "kind", content = "data")]
    pub enum JsonTreeValue {
        Null,
        Bool(bool),
        Number(serde_json::Number),
        String(String),
        Array(Vec<JsonTreeValue>),
        Object(Vec<(String, JsonTreeValue)>),
    }

    impl From<serde_json::Value> for JsonTreeValue {
        fn from(value: serde_json::Value) -> Self {
            match value {
                serde_json::Value::Null => JsonTreeValue::Null,
                serde_json::Value::Bool(b) => JsonTreeValue::Bool(b),
                serde_json::Value::Number(n) => JsonTreeValue::Number(n),
                serde_json::Value::String(s) => JsonTreeValue::String(s),
                serde_json::Value::Array(a) => JsonTreeValue::Array(a.into_iter().map(Into::into).collect()),
                serde_json::Value::Object(m) => {
                    JsonTreeValue::Object(m.into_iter().map(|(k, v)| (k, v.into())).collect())
                }
            }
        }
    }
    ```
    `parse` stays returning `serde_json::Value` (a generically useful pure function); the `Into<JsonTreeValue>` conversion is applied only at the command boundary (Task 3), keeping the order-preserving concern scoped to exactly where it's needed.
  - [x] Unit tests in the existing `#[cfg(test)] mod tests`:
    - `parse` on a valid object returns a `Value` matching `serde_json::json!({...})` with the exact key order from the input.
    - `parse` on malformed input (e.g. `{"a":}"#`) returns `Err(ToolError)` with `code == "json-syntax"` and a `Position::LineCol` matching the malformed location.
    - `parse` on an empty string returns a syntax error, not a panic or `Ok`.
    - **Key-order regression for `JsonTreeValue`:** converting `{"1":"b","0":"a","name":"x"}` (numeric-looking keys, not in numeric order) into `JsonTreeValue` and serializing it to JSON preserves the *source* order (`1`, `0`, `name`) — assert the serialized `data` array's key order directly, not just that conversion doesn't panic. This is the test that would catch a regression back to exposing `serde_json::Value::Object`'s native map shape directly.

- [x] **Task 3: Expose `json_parse` as an async Tauri command** (AC: 1)
  - [x] In `src-tauri/src/commands/json.rs`, add:
    ```rust
    use umbra_core::json::{JsonIndent, JsonTreeValue, format, minify, parse};
    // ...
    #[tauri::command]
    pub async fn json_parse(input: String) -> Result<JsonTreeValue, ToolError> {
        parse(&input).map(Into::into)
    }
    ```
    Follows AD-3's `<tool>_<verb>` naming, same as `json_format`/`json_minify`. Like those two, this is a plain `async fn` with no `spawn_blocking` — Story 1.9 is explicitly where thread-pool dispatch for JSON commands gets added (same precedent Story 1.7's Dev Notes set: don't add it here, the signature is already forward-compatible).
  - [x] In `src-tauri/src/lib.rs`: import `json_parse` alongside the existing two and add it to `tauri::generate_handler![...]`. No `capabilities/default.json` change is needed — custom `#[tauri::command]` functions registered via `invoke_handler` don't require a capability entry (only plugin-provided commands do, as clipboard-manager needed in Story 1.7); confirm this stays true by checking `src-tauri/capabilities/default.json` is unchanged after this task.
  - [x] Add integration tests to `src-tauri/src/commands/json.rs`'s `#[cfg(test)]` module (same `#[tokio::test]` pattern as the existing `json_format`/`json_minify` tests): valid input returns the expected `JsonTreeValue`; malformed input returns `ToolError` with `code == "json-syntax"`.

- [x] **Task 4: Frontend JSON tree-value type + pure tree-flattening logic** (AC: 1, 2)
  - [x] Create `src/tools/json/jsonTreeValue.ts` (same directory/placement convention as `jsonIndent.ts`) — TS mirror of Task 2's Rust `JsonTreeValue`, **not** a plain-object mirror of `serde_json::Value`:
    ```ts
    export type JsonTreeValue =
      | { kind: "Null" }
      | { kind: "Bool"; data: boolean }
      | { kind: "Number"; data: number }
      | { kind: "String"; data: string }
      | { kind: "Array"; data: JsonTreeValue[] }
      | { kind: "Object"; data: Array<[string, JsonTreeValue]> };
    ```
    This is what `invoke<JsonTreeValue>("json_parse", ...)` resolves to. Both the `Array` and `Object` variants already carry their children as an ordered array/array-of-tuples — this is what closes the key-order gap from Task 2 (see that task's critical note): there is no plain JS object anywhere in this type for a JS engine to silently reorder.
  - [x] Create `src/tools/json/flattenJsonTree.ts` — a pure, dependency-free function (same philosophy as `paletteSearch.ts`/`invoke.ts`: no Vue import, trivially unit-testable, reusable if `JsonTree.vue` is ever restructured):
    ```ts
    import type { JsonTreeValue } from "./jsonTreeValue";

    export interface JsonTreeRow {
      path: string;             // unique stable key — see note below on why this isn't a dotted string
      depth: number;             // 0 = root
      keyLabel: string | null;   // property name or array index label; null for the root row
      kind: JsonTreeValue["kind"];
      preview: string;           // scalar: formatted value; container: "{n keys}" / "[n items]"
      expandable: boolean;
      expanded: boolean;
    }

    export function flattenJsonTree(root: JsonTreeValue, expandedPaths: ReadonlySet<string>): JsonTreeRow[] {
      const rows: JsonTreeRow[] = [];

      function visit(value: JsonTreeValue, segments: Array<string | number>, depth: number, keyLabel: string | null) {
        const path = JSON.stringify(segments);
        const entries = containerEntries(value);
        const expandable = entries.length > 0;
        const isExpanded = expandable && expandedPaths.has(path);

        rows.push({ path, depth, keyLabel, kind: value.kind, preview: previewFor(value, entries.length), expandable, expanded: isExpanded });

        if (isExpanded) {
          for (const [childKey, childValue] of entries) {
            visit(childValue, [...segments, childKey], depth + 1, String(childKey));
          }
        }
      }

      visit(root, [], 0, null);
      return rows;
    }

    // Both branches already yield an ordered list of [key, value] pairs straight from the
    // wire shape (Task 2) — no `Object.entries()` here, and therefore no exposure to the
    // ECMAScript spec's integer-key reordering rule that motivated that wire shape.
    function containerEntries(value: JsonTreeValue): Array<[string | number, JsonTreeValue]> {
      if (value.kind === "Array") return value.data.map((v, i): [number, JsonTreeValue] => [i, v]);
      if (value.kind === "Object") return value.data;
      return [];
    }

    function previewFor(value: JsonTreeValue, childCount: number): string {
      switch (value.kind) {
        case "Object": return childCount === 1 ? "{1 key}" : `{${childCount} keys}`;
        case "Array": return childCount === 1 ? "[1 item]" : `[${childCount} items]`;
        case "String": return JSON.stringify(value.data);
        case "Number": return String(value.data);
        case "Bool": return String(value.data);
        case "Null": return "null";
      }
    }
    ```
    **Why `path` is `JSON.stringify(segments)` and not a dotted string like `` `${parent}.${key}` ``:** a real JSON payload's object keys can themselves contain `.`, `[`, or `]` characters (e.g. a key literally named `"a.b"` or `"items[0]"`). A dotted/bracketed string join risks two *different* nodes producing the *same* path string, which would corrupt both the `expandedPaths` lookup (one node's collapse state leaking onto an unrelated node) and the virtualizer's row identity (Task 5). Serializing the raw segment array sidesteps this entirely — it's unique regardless of what characters a key contains.
    **Why collapsed subtrees are never visited:** `visit` only recurses into a node's children when that node's own path is in `expandedPaths` — a collapsed node's descendants are never pushed into `rows` at all, not just filtered out afterward. This is what makes AC2's "only visible nodes exist in the DOM" achievable: the virtualizer (Task 5) only ever sees this already-pruned array, so a huge document with everything collapsed except the root produces a tiny `rows` array regardless of total document size. Virtualization (Task 5) is still needed on top of this for the complementary case — a single node with thousands of *expanded* siblings (e.g. one big flat array) — where collapse-pruning alone doesn't bound the row count.
  - [x] `src/tools/json/flattenJsonTree.spec.ts` — pure-function tests, no mounting:
    - Root-only expanded set on a nested object shows the root row plus its immediate children, but not grandchildren.
    - A node absent from `expandedPaths` contributes zero rows for its descendants (proves pruning, not just a UI-hidden state).
    - Array entries get numeric string `keyLabel`s (`"0"`, `"1"`, ...) in source order.
    - **Key-order regression:** an `Object` value whose `data` tuples are `[["1", ...], ["0", ...], ["name", ...]]` (numeric-looking keys, deliberately out of numeric order) flattens with `keyLabel`s in exactly that order (`"1"`, `"0"`, `"name"`) — proves the flattener never re-sorts what it's given, which is what actually delivers Task 2's ordering guarantee end-to-end.
    - An empty object (`{ kind: "Object", data: [] }`) or empty array has `expandable === false` (nothing to expand into — no dead-end toggle).
    - A scalar leaf (`Null`/`Bool`/`Number`/`String`) always has `expandable === false` regardless of what's in `expandedPaths`.
    - **Path-collision regression:** two sibling keys where one is `"a"` and another is literally `"a.b"` (or an array containing an object with a key that looks like an index) produce distinct `path` values — this is the test that would catch a regression to a naive dotted-string join.

- [x] **Task 5: Build `JsonTree.vue`** (AC: 1, 2, 3, 4) — a new, standalone presentational component; it never calls `invoke` itself (see Task 6 for why)
  - [x] Props: `value: JsonTreeValue | null` (`null` means "unavailable" — covers empty input, invalid JSON, and "not parsed yet" uniformly, per AC3).
  - [x] Internal state: `expanded = ref<Set<string>>(new Set(["[]"]))` — **default: root expanded, everything else starts collapsed.** (`"[]"` is `JSON.stringify([])`, the root's path per Task 4's encoding.) This keeps the initial visible-row count minimal even on a huge document, and matches typical JSON-tree-viewer UX (progressive disclosure) rather than fully expanding by default.
    - Toggling replaces the `Set` with a new one (`expanded.value = next`) rather than mutating in place. (Vue's `ref()` does wrap the `Set` in a reactive proxy that *does* instrument `.add`/`.delete`, so in-place mutation would also work — the replace-the-Set style here is just for explicit, easily-testable state transitions, matching `invoke.ts`'s discriminated-result style elsewhere in this codebase, not a reactivity requirement.)
  - [x] `rows = computed(() => (props.value === null ? [] : flattenJsonTree(props.value, expanded.value)))`.
  - [x] **Clamp `focusedIndex` whenever `rows` shrinks** (collapsing an ancestor, or the parent re-parsing to a smaller tree, both reduce `rows.value.length`): `watch(rows, (newRows) => { if (focusedIndex.value >= newRows.length) focusedIndex.value = Math.max(0, newRows.length - 1); })`. Without this, a stale `focusedIndex` pointing past the end leaves the keyboard-nav DOM lookup (`data-index`) unable to find anything to focus.
  - [x] Virtualizer setup (fixed row height — no need for `@tanstack/vue-virtual`'s dynamic-measurement API since every row is one line):
    ```ts
    import { useVirtualizer } from "@tanstack/vue-virtual";

    const ROW_HEIGHT_PX = 24;
    const scrollParentRef = ref<HTMLElement | null>(null);

    const virtualizer = useVirtualizer(computed(() => ({
      count: rows.value.length,
      getScrollElement: () => scrollParentRef.value,
      estimateSize: () => ROW_HEIGHT_PX,
      overscan: 10,
      getItemKey: (index: number) => rows.value[index].path,
    })));
    ```
  - [x] Roving-tabindex keyboard nav (AC4) — `focusedIndex = ref(0)`; only the row at `focusedIndex` gets `tabindex="0"`, every other row gets `tabindex="-1"` (standard ARIA treeview pattern — one stop in the page's Tab order, arrow keys move focus within it):
    - `Enter` / `Space` on an expandable row toggles it.
    - `ArrowRight` on a collapsed expandable row expands it; otherwise moves focus to the next row.
    - `ArrowLeft` on an expanded row collapses it; otherwise moves focus to the nearest ancestor row (first prior row with a smaller `depth`).
    - `ArrowDown` / `ArrowUp` move focus to the next/previous row, clamped to bounds, via `virtualizer.value.scrollToIndex(...)` (so keyboard nav scrolls the virtualized list into view) then focusing the corresponding DOM node. **`scrollToIndex` is not guaranteed to be reflected in the DOM synchronously** — a newly-scrolled-into-view row may not exist as an element yet on the same tick. `await nextTick()` after calling `scrollToIndex` and before querying `[data-index="..."]` to call `.focus()` on it.
  - [x] Markup uses proper tree semantics for NFR5: `role="tree"` on the scroll container, `role="treeitem"` per row, `:aria-level="row.depth + 1"`, and `aria-expanded` present (`"true"`/`"false"`) **only** on rows where `expandable` is true — a leaf row must omit `aria-expanded` entirely (per the ARIA treeview pattern, this is how assistive tech distinguishes "collapsed" from "has no children"). Add a `:data-index="virtualRow.index"` attribute on each row purely so the keyboard handler can look up the rendered DOM node after `scrollToIndex`.
  - [x] Unavailable state (AC3): `v-if="value === null"` renders `<p role="status">Tree unavailable — fix the JSON to see its structure.</p>` (matching the `role="status"` convention Story 1.6 used for its empty-state palette message) instead of any tree markup — never a stale tree left over from a previous valid parse.
  - [x] `src/tools/json/JsonTree.spec.ts` — mounts the real component with plain `JsonTreeValue` fixtures (no Tauri mocking needed at all, since this component never touches IPC):
    - **jsdom has no `ResizeObserver`** (verified this session: not present anywhere in the installed `jsdom@29.1.1`'s living implementation), and `@tanstack/vue-virtual`'s default `getScrollElement`/`observeElementRect` path uses one to watch the scroll container. Stub it locally at the top of this spec file before mounting:
      ```ts
      class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
      ```
      Keep this local to this spec file for now (no shared `vitest` setup file exists in the project yet, per `vite.config.ts`'s `test` block) — only worth extracting to a shared setup once a second component needs it.
    - `value: null` renders the `role="status"` unavailable message and no `role="tree"` element.
    - A nested object with the default expand state shows the root and its immediate children, not grandchildren.
    - Clicking an expandable row's toggle reveals its children; clicking again hides them.
    - `Enter` and `Space` on a focused expandable row toggle it.
    - `ArrowRight`/`ArrowLeft` expand/collapse as specified above.
    - `ArrowDown`/`ArrowUp` move the roving `tabindex="0"` between rows.
    - A leaf row's rendered element has no `aria-expanded` attribute at all.

- [x] **Task 6: Wire `JsonView.vue` to parse live and render the tree** (AC: 1, 3)
  - [x] Create `src/shell/debounce.ts` (shared, cross-tool infra — same home as `clipboard.ts`/`invoke.ts`; generic because live-validate-as-you-type is a pattern later tools will likely reuse):
    ```ts
    export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number): (...args: Args) => void {
      let handle: ReturnType<typeof setTimeout> | undefined;
      return (...args: Args) => {
        if (handle !== undefined) clearTimeout(handle);
        handle = setTimeout(() => fn(...args), delayMs);
      };
    }
    ```
    Test in `src/shell/debounce.spec.ts` with `vi.useFakeTimers()`: rapid calls within the delay window only invoke `fn` once, with the last call's arguments; a call after the delay window invokes it again.
  - [x] **In `JsonView.vue`, use a *second, dedicated* `createLatestWinsRunner()` instance for tree parsing — do not reuse the existing one shared by Format/Minify/Paste.** This matters: the existing runner's request-ID counter is shared across Format, Minify, and Paste because those are mutually-exclusive user-triggered actions on the same `output`. Live parsing fires on *every* debounced keystroke, independently of those actions. If it shared the same counter, typing while a Format click is still in flight would bump the shared counter and cause Format's legitimate, non-superseded result to be misidentified as "superseded" and silently dropped — a real correctness bug, not a style preference. Two independent invocation streams need two independent counters:
    ```ts
    const runTreeParse = createLatestWinsRunner();
    const treeValue = ref<JsonTreeValue | null>(null);

    const debouncedParse = debounce((value: string) => {
      void (async () => {
        try {
          // The empty-input check runs *inside* the runLatestWins task, not as an early
          // return before calling it — otherwise clearing the input while a real parse is
          // still in flight would never bump the request counter, and the earlier in-flight
          // result could still land afterwards and overwrite this correct `null` with a
          // stale tree (exactly the race the counter exists to prevent).
          const result = await runTreeParse(() =>
            value.trim() === "" ? Promise.resolve(null) : invoke<JsonTreeValue>("json_parse", { input: value }),
          );
          if (!result.superseded) treeValue.value = result.value;
        } catch {
          treeValue.value = null; // invalid JSON -> tree unavailable; Format still surfaces the detailed ToolError
        }
      })();
    }, 200);

    watch(input, (value) => debouncedParse(value), { immediate: true });
    ```
    **This story's interpretation of "beside the text view" is the `input` field, live** — not gated behind clicking Format/Minify. The user story is "explore a payload's structure without reading raw braces," which reads naturally as reacting to what's pasted/typed, not requiring an extra click first. (If you're re-deriving this from the AC text alone: AC1 says "when it is parsed," not "when I click Format," and Story 1.9's AC2 already talks about "rapid successive edits triggering re-invocations" — i.e., edits alone trigger backend calls in this tool, which only makes sense if something already invokes on every edit before Story 1.9's perf work begins.)
  - [x] Import and render `<JsonTree :value="treeValue" />` in the template, alongside the existing input/output textareas (plain scoped CSS, no new layout framework — a simple flex/grid split is enough; exact visual layout is your call).

- [x] **Task 7: Full verification pass**
  - [x] `cargo fmt --check`, `cargo clippy --workspace -- -D warnings`, `cargo test --workspace`.
  - [x] `pnpm lint`, `pnpm test`, `pnpm build`.
  - [x] Manually run `pnpm tauri dev` at least once: paste a large-ish nested JSON payload, confirm the tree renders, expand/collapse works with both mouse and keyboard, and invalid JSON shows the "tree unavailable" message instead of a stale tree.

- [x] **Task 8: Commit and open a PR**
  - [x] Branch: `feat/story-1-8-<slug>` (repo convention: `feat/story-1-N-<slug>`, e.g. `feat/story-1-8-json-collapsible-tree`).
  - [x] Conventional Commit(s), `feat` type, scoped to `core`/`json` as this story's size warrants (match whichever granularity Story 1.7 used for a comparably-sized change).
  - [x] Push via a PR against `main` (branch protection + required CI checks enforced since Story 1.4).

### Review Findings

- [x] [Review][Decision] Reset vs. persist tree expand/focus state across unrelated document swaps — resolved: persist (current behavior) is intentional, kept for typing continuity. Dismissed as working-as-intended.

- [x] [Review][Patch] Roving tabindex is index-based, not row-identity-based [src/tools/json/JsonTree.vue:12-27] — fixed: focus is now tracked by row `path` (`focusedPath`), with `focusedIndex` derived from it via `findIndex`, so collapsing/expanding above the focused row can no longer silently move logical focus onto an unrelated row.
- [x] [Review][Patch] Non-null assertions on virtualized row data can throw on a rows/virtualizer desync [src/tools/json/JsonTree.vue:135-158] — fixed: template now iterates a `renderRows` computed that pairs each virtual item with its row and filters out any `undefined` pairing, replacing all `rows[virtualRow.index]!` assertions.
- [x] [Review][Patch] Large integers silently lose precision in the tree view [crates/umbra-core/src/json.rs:55; src/tools/json/jsonTreeValue.ts:9; src/tools/json/flattenJsonTree.ts:30-31] — fixed: `JsonTreeValue::Number` now carries the value's exact source text (`String`, populated via `serde_json::Number::to_string()`) instead of a native number; frontend types and `previewFor` updated to match. Regression tests added in both `json.rs` and `flattenJsonTree.spec.ts`.
- [x] [Review][Patch] Long string preview values have no truncation or CSS containment [src/tools/json/flattenJsonTree.ts:28-29; src/tools/json/JsonTree.vue style block] — fixed: `previewFor` truncates string previews at 80 chars with an ellipsis, and `.json-tree-preview` now has `overflow`/`text-overflow`/`white-space` containment. Regression test added.
- [x] [Review][Patch] No cleanup of the debounce timer or in-flight `json_parse` call on unmount [src/tools/json/JsonView.vue:26-42; src/shell/debounce.ts] — fixed: `debounce()` now returns a `.cancel()` handle, called from `onUnmounted` in `JsonView.vue`.
- [x] [Review][Patch] Rapid/held arrow-key repeats can race overlapping `focusRow` calls [src/tools/json/JsonTree.vue:53-63] — fixed: each call captures an incrementing call counter; a call whose count is no longer current drops its resolution instead of stealing focus.
- [x] [Review][Patch] `JsonTree.spec.ts` mutates `HTMLElement.prototype` globally with no restore [src/tools/json/JsonTree.spec.ts:15-22] — fixed: original property descriptors are captured before the override and restored in `afterAll`.

- [x] [Review][Defer] `json_parse` has no `spawn_blocking`, now triggered on every keystroke instead of only on click [src-tauri/src/commands/json.rs:14-17] — deferred, pre-existing precedent from Story 1.7 (`json_format`/`json_minify` are the same plain `async fn` shape), explicitly and correctly scoped by this story's own Dev Notes to Story 1.9's thread-pool dispatch work.
- [x] [Review][Defer] Deeply nested JSON risks a Rust-side stack overflow in `parse`/`From<Value>` conversion [crates/umbra-core/src/json.rs:40-76] — deferred, pre-existing since Story 1.7's `format`/`minify` (identical recursive `serde_json::from_str` call); this story's `From<serde_json::Value>` conversion adds a second recursive pass at the same depth, not a materially lower crash threshold.

## Dev Notes

### Architecture compliance for this story

- **AD-1/AD-2:** `parse` is a pure function in `umbra-core::json` — no I/O, no Tauri import, no `#[cfg(target_os)]`. Tree-row formatting (preview strings, indentation) is view-owned in `flattenJsonTree.ts`/`JsonTree.vue`, mirroring how Story 1.7 kept formatting decisions out of core. [Source: `ARCHITECTURE-SPINE.md` AD-1, AD-2]
- **AD-3:** `json_parse` follows `<tool>_<verb>`, returns `Result<JsonTreeValue, ToolError>` — reusing the exact `ToolError`/`Position::LineCol` shape `format`/`minify` already established (via `parse`'s `map_parse_error`), so the tree's validity check and the text view's error rendering share one source of truth instead of two parsers potentially disagreeing on what's valid. `JsonTreeValue` itself is this story's one deliberate departure from returning a bare `serde_json::Value` — see Task 2's critical note on key-order preservation. [Source: `ARCHITECTURE-SPINE.md` AD-3]
- **AD-4 (this story's main deliverable, alongside the parse command):** "large result sets render through virtualized views." Only visible rows exist in the DOM via `@tanstack/vue-virtual` layered on top of collapse-based pruning in `flattenJsonTree.ts` (see Task 4's note on why both are needed). **Explicitly out of scope, per the same precedent Story 1.7 set for `json_format`/`json_minify`:** dispatching `json_parse` onto the Rust blocking thread pool is Story 1.9's job (its AC1 names this exactly). `json_parse` here is a plain `async fn` calling the sync `parse` directly — don't add `spawn_blocking` in this story. [Source: `ARCHITECTURE-SPINE.md` AD-4; Story 1.9 AC1/AC2 in `epics.md`]
- **AD-6:** `treeValue`/`expanded` are local component state (`JsonView.vue`/`JsonTree.vue` `ref`s), not a Pinia store — nothing outside the JSON tool needs to read them.
- **AD-16 (the correctness-critical decision in this story):** the shared invoke helper's request-ID/latest-wins contract is per independent invocation stream, not global to a component. This story adds a *second* `createLatestWinsRunner()` instance dedicated to live tree-parsing, kept separate from the existing Format/Minify/Paste instance — see Task 6 for the exact failure mode this prevents. [Source: `ARCHITECTURE-SPINE.md` AD-16]
- **NFR5 (accessibility — this story's other hard requirement):** `role="tree"`/`role="treeitem"`/`aria-level`/`aria-expanded` (omitted on leaves) plus roving `tabindex` and arrow-key navigation, matching the WAI-ARIA treeview keyboard pattern. Same bar Story 1.5–1.7 already established: visible focus states, no lint plugin for this — verified by tests + manual check.
- **Dependency hygiene:** `@tanstack/vue-virtual` is MIT-licensed (verified against the npm registry this session) — permissive, no explicit-review trigger per the spine's Consistency Conventions table.

### Previous Story Intelligence (from Story 1.7)

- **Testing convention to continue:** co-locate `*.spec.ts` next to source; don't mock the project's own code — only third-party/platform boundaries (`@tauri-apps/api/core`'s `invoke`, and this story's new jsdom `ResizeObserver` gap, which is a platform limitation, not "our own code"). `JsonTree.vue`'s tests need **no** Tauri mocking at all since it's purely prop-driven — only `JsonView.vue`'s wiring touches `invoke`.
- **`src/shell/` is the established home for shell-owned, cross-tool infrastructure** (`clipboard.ts`, `invoke.ts` so far) — this story's `debounce.ts` belongs there too.
- **No styling/component framework exists** (unchanged since Story 1.5) — plain scoped CSS again; `@tanstack/vue-virtual` is a headless library, not an exception to this.
- **Branch/commit conventions** (`feat/story-1-N-<slug>`, Conventional Commits) have been consistent since Story 1.5 — Task 8 follows the same shape.
- **`ToolError`'s `Position::ByteOffset`/`LineCol` handling in `JsonView.vue`** (from the Story 1.7 code-review pass) is unaffected by this story — this story adds a new command (`json_parse`) and a new component (`JsonTree.vue`), it does not touch the existing Format/Minify error-rendering path.

### Git Intelligence

- Recent commits (`dd66d57`, `5b34d44`, `ed40c3b`, `af29b5a`, `a8e2dac`, `b790488`) are all Story 1.7 — they establish `crates/umbra-core/src/json.rs` (`format`/`minify`/`map_parse_error`), `src-tauri/src/commands/json.rs` (`json_format`/`json_minify`), `src/shell/{clipboard,invoke,toolError}.ts`, and `src/tools/json/{JsonView.vue,jsonIndent.ts}`. Nothing tree- or virtualization-related exists yet — this story's Rust `parse` fn/`JsonTreeValue`, frontend `jsonTreeValue.ts`/`flattenJsonTree.ts`, and `JsonTree.vue` are all net-new, not modifications of anything.
- No `ResizeObserver` polyfill, no virtualization dependency, and no `src/shell/debounce.ts` exist anywhere in the tree yet — confirmed by direct file/package.json inspection this session, not assumed.

### Project Structure Notes

- New files: `src/tools/json/jsonTreeValue.ts`, `src/tools/json/flattenJsonTree.ts` (+ `.spec.ts`), `src/tools/json/JsonTree.vue` (+ `.spec.ts`), `src/shell/debounce.ts` (+ `.spec.ts`).
- Modified: `crates/umbra-core/src/json.rs` (+`parse` fn + tests), `src-tauri/src/commands/json.rs` (+`json_parse` command + tests), `src-tauri/src/lib.rs` (+`json_parse` in `invoke_handler`), `src/tools/json/JsonView.vue` (+ live-parse wiring, + `<JsonTree>`), `package.json`/`pnpm-lock.yaml` (+`@tanstack/vue-virtual`), `ARCHITECTURE-SPINE.md` (Stack table + Deferred section resolution).
- Not touched: `src-tauri/capabilities/default.json` (no new plugin, just a plain command), `src/stores/registry.ts`, `src/shell/{clipboard,invoke,toolError}.ts` (used as-is, `invoke.ts` itself isn't modified — a *new instance* of its existing exported factory is created, not a change to the factory).

### Testing Requirements

- Rust: `cargo test -p umbra-core` (new `parse` unit tests incl. key-order regression) + new `src-tauri` `json_parse` integration tests, run via `cargo test --workspace`.
- TypeScript: `flattenJsonTree.spec.ts` (pure-function, no mounting), `JsonTree.spec.ts` (component test, no Tauri mocking, needs the `ResizeObserver` stub), `debounce.spec.ts` (fake timers), plus updates to `JsonView.spec.ts` covering the new live-parse wiring (mock `invoke` for `json_parse` the same way existing tests mock it for `json_format`/`json_minify`) — **including a regression test for the empty-input race**: start a slow/deferred `json_parse` resolution, then update `input` to `""` before it resolves, then let the deferred call resolve; assert `treeValue` ends up `null` (the empty-input result), not the stale parsed value from the earlier call. This is the test that would catch a regression to checking `value.trim() === ""` *outside* `runTreeParse`.
- `cargo fmt --check`, `cargo clippy --workspace -- -D warnings`, `cargo test --workspace`, `pnpm lint`, `pnpm test`, `pnpm build` all pass locally before the PR.
- Out of scope for this story's tests (belongs to Story 1.9): 10MB-scale performance profiling, thread-pool dispatch verification, out-of-order-request stress testing at scale. This story's latest-wins test only needs to prove the *routing* logic (a separate runner instance, correctly wired), not real large-payload timing.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.8: Inspect JSON as a collapsible tree; Story 1.7 (established `umbra-core::json`, `json_format`/`json_minify`, clipboard/invoke infra); Story 1.9 boundary (thread-pool dispatch, fallback rule for the single-payload transfer); AD-1, AD-3, AD-4, AD-6, AD-16; FR8, NFR5]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1 through AD-4, AD-6, AD-16; Deferred: "JSON tree IPC transfer strategy. Defaults to one payload + virtualized DOM. A lazy per-node fetch fallback is introduced only as an explicit spine amendment if profiling shows FR9 cannot be met — never as a silent switch."]
- [Source: `_bmad-output/implementation-artifacts/1-7-format-minify-and-validate-json.md` — established `map_parse_error`/`"json-syntax"` code, the `runLatestWins`/`LatestWinsResult<T>` contract, testing conventions (co-located specs, mock only platform boundaries), `src/shell/` as shell-infra home]
- Live-verified this session by direct file read: `crates/umbra-core/src/json.rs` and `error.rs` (no `parse` fn yet; `map_parse_error`/`Position::LineCol` ready to reuse), `src-tauri/src/commands/json.rs` and `lib.rs` (only `json_format`/`json_minify` registered), `src/tools/json/JsonView.vue`/`jsonIndent.ts`, `src/shell/invoke.ts` (current `LatestWinsResult<T>` discriminated-union shape, post-Story-1.7-code-review), `package.json` (no virtualization library, no `ResizeObserver` polyfill), `vite.config.ts` (no `test.setupFiles` configured).
- Verified this session against the npm registry API directly (not a search snippet): `@tanstack/vue-virtual` latest `3.13.34`, license `MIT`, peer dependency `vue: ^2.7.0 || ^3.0.0`. Verified this session that the installed `jsdom@29.1.1` has no `ResizeObserver` implementation anywhere in its living-standard tree (`grep -rl ResizeObserver node_modules/jsdom/lib/jsdom/living/` returns nothing).
- Context7 (`/tanstack/virtual`) confirmed the Vue 3 adapter's API shape (`useVirtualizer(computed(() => ({...})))`, `getVirtualItems()`, `getTotalSize()`, `scrollToIndex()`) used in Task 5.

## Change Log

- 2026-07-26: All 8 tasks implemented on `feat/story-1-8-json-collapsible-tree`, branched from `main` after fast-forwarding it to `origin/main` (Story 1.7's PR #9 had squash-merged since the prior session's `feat/story-1-7` branch head). `cargo fmt --check`, `cargo clippy --workspace -- -D warnings`, `cargo test --workspace` (23 tests), `pnpm lint`, `pnpm test` (65 tests), and `pnpm build` all pass locally. `pnpm tauri dev` launched successfully and the user manually confirmed the tree view renders and behaves correctly in the live native window.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `cargo test --workspace` — 23 tests (17 in `umbra-core` incl. the `JsonTreeValue` key-order regression, 6 command integration tests in `umbra` incl. `json_parse`), all passing.
- `cargo clippy --workspace -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `pnpm test` — 11 test files, 65 tests, all passing (up from 33 after Story 1.7).
- `pnpm lint` — clean (`--max-warnings 0`).
- `pnpm build` — `vue-tsc --noEmit && vite build` succeeds; caught two type errors on first pass (`VirtualItem.key`'s `Key` type includes `bigint`, not assignable to `:key`'s `PropertyKey`; `aria-expanded`'s `Booleanish` type rejects a plain `String(boolean)`) and fixed both before this was clean.
- `pnpm tauri dev` — launched successfully (Rust build ~9s); user manually verified the tree renders beside the input, expand/collapse works with mouse and keyboard, and invalid JSON shows the unavailable state.

### Completion Notes List

- Task 1: Added `@tanstack/vue-virtual@3.13.34` (resolved exactly at the pinned version). Updated `ARCHITECTURE-SPINE.md`'s Stack table with the new dependency and struck through the "JSON tree IPC transfer strategy" Deferred item as resolved by this story.
- Task 2: `crates/umbra-core/src/json.rs` gained `parse` (thin wrapper reusing `map_parse_error`) and the order-preserving `JsonTreeValue` enum + `From<serde_json::Value>` impl. 4 new unit tests, including the key-order regression that serializes a `JsonTreeValue` built from out-of-numeric-order numeric-looking keys and asserts the serialized `data` array preserves source order rather than the ECMAScript integer-key reordering that would apply to a native object.
- Task 3: `json_parse` added to `src-tauri/src/commands/json.rs` following the existing `json_format`/`json_minify` pattern, registered in `lib.rs`'s `invoke_handler`. Confirmed `src-tauri/capabilities/default.json` has no diff, since plain `#[tauri::command]` functions don't need capability entries. 2 new `#[tokio::test]` integration tests.
- Task 4: `src/tools/json/jsonTreeValue.ts` mirrors the Rust wire type exactly (no plain JS object anywhere in the type). `flattenJsonTree.ts` implements collapse-based pruning (a collapsed node's descendants are never visited, not just hidden) with `JSON.stringify(segments)` as the path key to avoid collisions from keys containing `.`/`[`/`]`. 7 unit tests cover default-expand depth, pruning, array/object key-order fidelity (including the numeric-looking-keys regression), empty containers, scalar leaves, and the path-collision case.
- Task 5: `JsonTree.vue` — virtualized (`@tanstack/vue-virtual`), roving-tabindex keyboard nav (Enter/Space toggle, Arrow keys move/expand/collapse), full ARIA treeview semantics (`role="tree"`/`"treeitem"`, `aria-level`, `aria-expanded` omitted on leaves), and the `role="status"` unavailable state for `value === null`. 7 component tests. Two jsdom platform gaps needed local stubs in the spec file (same category as the `ResizeObserver` gap Story 1.7's Dev Notes anticipated, kept local since no shared vitest setup file exists yet): no `ResizeObserver`, and no real layout — `offsetWidth`/`offsetHeight` are always 0, which makes the virtualizer's `getSize()` return 0 and short-circuit to an empty visible range regardless of `overscan`. Stubbed both, plus discovered that the virtualizer only measures the scroll container a tick after the initial render (the Vue adapter constructs the `Virtualizer` during component setup, before any template ref is bound), so tests need `await nextTick()` twice after mount before rows are queryable.
- Task 6: `src/shell/debounce.ts` (2 unit tests, fake timers) plus a second, independent `createLatestWinsRunner()` instance in `JsonView.vue` dedicated to live tree-parsing — kept separate from the Format/Minify/Paste runner so typing can't cause a shared counter to misidentify an in-flight Format click's legitimate result as superseded. `<JsonTree>` now renders beside the input in a new `.panels` flex layout. Live parsing runs on every debounced input change via `watch(input, ..., { immediate: true })`, not gated behind a button click. Added 3 tests to `JsonView.spec.ts`: live-parse-without-clicking, tree-unavailable-on-rejection, and the empty-input race regression from the Dev Notes (start a slow parse, clear the input before it resolves, then let it resolve — asserts the stale result never overwrites the correct `null`). Switched the whole spec file to `vi.useFakeTimers()` so a test's pending debounce timeout can't fire mid-way through a later test and steal a queued mock response.
- Task 7: Full verification pass green across both toolchains (see Debug Log References). Manual `pnpm tauri dev` check: I launched the app and confirmed it built and ran, but couldn't interact with the native window myself — same limitation Story 1.7 noted, plus this story specifically needs a real native WebView since Tauri's macOS webview has no WebDriver support (`tauri-driver` only covers Windows/Linux), so even browser automation wouldn't have reached the real IPC path. The user manually tested the app and confirmed the tree representation works correctly.
- Task 8: This commit/PR step.

### File List

- `src/tools/json/jsonTreeValue.ts` (new)
- `src/tools/json/flattenJsonTree.ts` (new)
- `src/tools/json/flattenJsonTree.spec.ts` (new)
- `src/tools/json/JsonTree.vue` (new)
- `src/tools/json/JsonTree.spec.ts` (new)
- `src/shell/debounce.ts` (new)
- `src/shell/debounce.spec.ts` (new)
- `crates/umbra-core/src/json.rs` (modified — `+parse` fn, `+JsonTreeValue` enum, `+From<serde_json::Value>` impl, `+4` tests)
- `src-tauri/src/commands/json.rs` (modified — `+json_parse` command, `+2` integration tests)
- `src-tauri/src/lib.rs` (modified — `+json_parse` import and `invoke_handler` registration)
- `src/tools/json/JsonView.vue` (modified — `+` second `createLatestWinsRunner()` for live tree-parsing, `+` debounced `watch(input, ...)`, `+<JsonTree>` render, `+.panels`/`.tree-panel` layout and styles)
- `src/tools/json/JsonView.spec.ts` (modified — `+` fake timers setup/teardown, `+3` live-parse tests)
- `package.json` (modified — `+@tanstack/vue-virtual`)
- `pnpm-lock.yaml` (modified — lockfile update from `pnpm add`)
- `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` (modified — Stack table entry for `@tanstack/vue-virtual`; struck through the resolved "JSON tree IPC transfer strategy" Deferred item)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status tracking)
