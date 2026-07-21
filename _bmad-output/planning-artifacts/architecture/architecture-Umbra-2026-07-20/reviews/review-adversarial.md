# Adversarial Review — Umbra Architecture Spine

**Reviewer lens:** Reviewer Gate / adversarial pair-construction
**Target:** `ARCHITECTURE-SPINE.md` (2026-07-20 reconstruction)
**Method:** For each candidate hole, construct two concrete builders (stories/modules/teams) who each read the cited AD(s) literally, comply fully, and still produce artifacts that do not interoperate. A pair only counts if both sides can honestly claim "I followed the AD."

---

## Finding 1 — Epoch timestamp unit is never pinned (seconds vs. milliseconds)

**Pair:** the JWT story (`crates/umbra-core/src/jwt.rs`, Epic 2) vs. the cron story (`crates/umbra-core/src/cron.rs`, Epic 3, AD-9).

- AD-1 says core returns "machine values (epoch timestamps...)"; the Consistency Conventions table repeats "epoch timestamps" with no unit. Nowhere in the spine — not AD-1, not AD-3, not the Stack, not Deferred — is the unit (seconds vs. milliseconds) fixed.
- The JWT builder decodes `iat`/`exp` claims, which are **seconds**-since-epoch by RFC 7519 spec. Returning them as `epoch: i64` in seconds is not just compliant, it is the only sane choice given the spec the tool implements.
- The cron builder computes "next N runs" via `croner` (which works in `chrono::DateTime`), and converts to an `epoch: i64` machine value for the view to render. The natural, equally spec-compliant choice here is **milliseconds**, since that's the JS/`Date` convention the Vue view will eventually consume and croner's own ergonomics lean toward `timestamp_millis()`.
- Both are "core returns machine values (epoch integers); view renders for humans" per AD-1, to the letter. But a single generic date-rendering helper in the view (which AD-1 implies should exist, since formatting is view-owned and presumably centralized) cannot correctly render both without a unit tag — one tool's dates will land in 1970 or in the far future depending on which convention the helper assumes.
- **Close with:** an explicit unit note on AD-1 or the Consistency Conventions row ("epoch timestamps are milliseconds, i64, UTC" or similar), plus ideally a shared `EpochMillis`/`EpochSeconds` newtype in `error.rs` or a `time.rs` core module so the JSON shape is self-describing.

## Finding 2 — `ToolError.position: Option<LineCol | ByteOffset>` has no concrete Rust type or serde tagging

**Pair:** the JSON story (`json.rs`, Epic 1) vs. the Base64/Hash story (`base64.rs`/`hash.rs`, Epic 2).

- AD-3 defines the field with pseudo-Rust union syntax `LineCol | ByteOffset` — not valid Rust and not resolved anywhere else in the spine into an actual `enum`. There's no field-tag convention stated (internally-tagged `{"type": "line_col", ...}` vs. externally-tagged `{"LineCol": {...}}` vs. untagged vs. two separate `Option` fields).
- The JSON tool builder, needing line/column positions for parse errors, could reasonably define `position: Option<Position>` where `enum Position { LineCol { line: u32, col: u32 }, ByteOffset(usize) }` with serde's default (externally tagged) representation — since JSON tooling conventionally reports `{line, column}`.
- The Base64/Hash tool builder, needing only a byte offset for invalid-character errors, could reasonably define the same conceptual field as `position: Option<usize>` (skipping the union entirely, since their tool only ever produces byte offsets) — equally "one error shape... position: Option<...>" compliant by a narrower reading, since AD-3 doesn't say every implementer must reuse one shared Rust type, only that the *shape name* `ToolError` is singular.
- Because `error.rs` is claimed by AD-3 to be defined "once in `umbra-core`," but two epics build against it in parallel (Epic 1 vs Epic 2 stories), whichever lands second either breaks the first tool's serialized JSON (if they unify the type) or the frontend's generic error-renderer (AD-3: "the view renders errors from `ToolError`'s structure only") ends up needing tool-specific branches on `position`'s shape — precisely what AD-3 exists to prevent.
- **Close with:** pin the exact Rust enum for `position` (variant names, whether it's internally-tagged with a `kind` discriminant, field names `line`/`col` vs `line_no`/`column`) directly in AD-3 or in `error.rs`'s doc comment cited by the spine, before Epic 1 Story 1 lands.

## Finding 3 — Pasted-image dispatch: "like drops" is ambiguous between transport mechanisms

**Pair:** an OCR-drop-accepting tool story (Epic 4, consuming AD-14 + AD-8) vs. an Image-tool paste story (Epic 6, consuming AD-14 + AD-15's clipboard-bytes exception).

- AD-14: "Pasted images dispatch like drops." AD-15: "files cross the IPC bridge as absolute paths... the one sanctioned exception is clipboard-pasted image bytes via the raw IPC body."
- Reading A (literal "dispatch like drops"): the clipboard service, on paste, funnels the image through the *same* registry-declared drop-handler dispatch path a file-drop uses (AD-14: "window-level ... drops dispatch to the active tool's registry-declared handler"). A tool's registered handler is written once to accept "a dropped thing" and expects — per AD-15's general rule — a path. Under this reading, the clipboard service would need to materialize the pasted bytes to a temp path before dispatch, so the handler contract stays uniform.
- Reading B (literal AD-15 exception): the clipboard service bypasses path-based dispatch entirely and invokes the tool's command directly with raw bytes over the raw IPC body, since AD-15 explicitly carves out clipboard-image-bytes as the *only* exception to path-crossing — implying paste never becomes a path at all.
- Both readings cite real AD text. A tool builder who wires their drop handler as `handle(path: string)` (Reading A) and a clipboard-service builder who ships `invoke(cmd, { bytes: Uint8Array })` directly (Reading B) produce a handler signature the shell literally cannot satisfy for both drop and paste with one code path — despite each being defensible under "dispatch like drops."
- **Close with:** one sentence in AD-14 or AD-15 stating explicitly whether paste reuses the registry-drop-handler *dispatch mechanism* with bytes substituted for path (i.e., handler signature is `path: string | bytes: Uint8Array`), or whether paste is command-invoked directly and "like drops" only means "no separate paste-permission model," not "same handler."

## Finding 4 — AD-8's OCR trait shape is underspecified for its second consumer (Epic 6)

**Pair:** the Epic 4 OCR story (`ocr.rs`, trait + `oar-ocr` adapter) vs. the Epic 6 Story 6.3 "second AI feature" story, if FR29 resolves to OCR→structured (per Deferred section, decided "from evidence gathered in Epics 3–4").

- AD-8's rule: "image bytes in, recognized text + confidence out, honest empty/failure states." That's a flat scalar shape: one `String` + one confidence `f32` (or similar) per call.
- The Epic 4 builder implements exactly that: `trait OcrEngine { fn recognize(&self, image: &[u8]) -> Result<Recognition, ToolError>; }` with `Recognition { text: String, confidence: f32 }` — fully AD-8 compliant.
- If Epic 6 Story 6.3 lands on OCR→structured (extracting fields/regions from a document, not just flat text), the builder needs **per-region** text and confidence — e.g., `Vec<{ text, confidence, bbox }>` — to do anything useful. AD-8 never says whether Epic 6 extends the *same* trait (breaking the Epic 4 signature retroactively), defines a *second* trait ("an AD-8-style port," per the review brief), or wraps the Epic 4 trait's flat output in a second, uncited abstraction layer.
- AD-8 also doesn't pin: the trait's method name, whether it's `async fn` (requiring `async-trait` or manual boxing — a real compile-level incompatibility if one story assumes sync and another assumes async, since `oar-ocr`'s session init is explicitly lazy per AD-4/AD-16's `OnceCell`), or whether failures surface as `ToolError` directly or a tool-local error that gets mapped later.
- Both stories can honestly say "I built an OCR-shaped trait behind which the adapter sits, per AD-8" while producing two incompatible trait definitions that cannot share `ocrtrait` in the mermaid diagram's single box.
- **Close with:** either commit now to "Epic 6's second AI feature, if OCR-based, gets its own trait, not a mutation of Epic 4's" (cheapest fix — just a sentence), or pin the exact method signature (name, async-ness, return shape as `Vec<Region>` vs scalar) in AD-8 itself.

## Finding 5 — Tool Registry's "drop declarations" field has no schema, enabling data vs. behavior split

**Pair:** two Epic-1/Epic-2-era tool stories both wiring `dropDeclarations` into their Tool Registry entry (AD-5), e.g. the JSON tool vs. the Hash tool.

- AD-5's entry shape is `{ id, name, aliases, route, icon, drop declarations, shortcut declarations }` — a data record, implying the registry (and by extension the palette index / route table, which AD-5 says are *generated from* it) is serializable/enumerable.
- AD-14 says drops "dispatch to the active tool's registry-declared handler" — the word "handler" suggests something callable, not pure data.
- Builder A (JSON tool) reads AD-5 literally: `dropDeclarations` is declarative data — e.g. `{ accept: ['.json', 'application/json'] }` — and the shell's central drop dispatcher owns all actual handling logic (reading the file, calling the right command), looking up the tool by declared MIME/extension match. This keeps the registry fully serializable, satisfying "one source of tool metadata" (AD-5) and "shell owns OS I/O edges exactly once" (AD-14) cleanly, since even the *logic* of dispatch stays shell-side.
- Builder B (Hash tool), reading the same AD-14 clause ("dispatch to the active tool's registry-declared handler"), registers an actual callback/function reference in the entry — e.g. `dropDeclarations: { onDrop: (path) => hashStore.processFile(path) }` — because "handler" reads as "the thing that handles it," not "the filter that selects it." This is arguably *more* AD-14-compliant on a literal reading (the tool's own declared handler runs), but breaks AD-5's implied serializability: a registry containing live JS closures cannot be the same object trivially used to "generate the sidebar, the palette index, and the route table" as inert data, and cannot be unit-tested or introspected the same way.
- Two tools built this way don't just look inconsistent — the shell's *single* central drop dispatcher (AD-14: "exactly once") cannot be written generically against both shapes without a branch per tool, which is precisely the coupling AD-5/AD-6 exist to prevent.
- **Close with:** one clause fixing whether `drop declarations` is pure filter data (mime/extension list) interpreted by a shell-owned generic dispatcher, or a registered callback — and if callback, whether it's a Pinia-store action reference (string, looked up) or a literal function value (which the current wording doesn't rule out).

---

## Notes on candidates investigated but not escalated

- **Window-geometry debounce timing (AD-10):** AD-10's "frontend-side ... debounced move/resize" is unambiguous on *ownership* (frontend, not `src-tauri`). The undefined debounce interval (ms) is a real gap but produces UX inconsistency, not a build-incompatible pair — no two builders would fail to interoperate over it, so it's a note, not a hole.
- **Structural Seed `ocr.rs` as single file vs. directory module:** flagged `[ASSUMPTION]` correctly by the spine itself already; a builder splitting `ocr.rs` into `ocr/{mod,trait,adapter}.rs` vs. one keeping it flat produces an import-path mismatch (`crate::ocr::OcrEngine` vs. `crate::ocr::traits::OcrEngine`) for anything in `src-tauri/src/commands/` that imports it directly — real, but downstream of Finding 4 (fix the trait shape first; the file layout follows).
