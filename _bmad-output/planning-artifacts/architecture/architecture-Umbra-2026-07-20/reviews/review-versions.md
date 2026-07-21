# Reviewer Gate — Version/Reality-Check Lens

**Spine:** ARCHITECTURE-SPINE.md (Umbra, 2026-07-20)
**Lens:** every committed Stack/Structural-Seed decision must be web-verified this run, not asserted from training data.
**Method:** cross-referenced each Stack table row against `.memlog.md` `(version)` entries; where a row had no matching entry, or the memlog itself said "not independently re-verified," spot-checked live via npm registry API (`registry.npmjs.org/<pkg>/latest`) and web search.

## Findings

### 1. Pinia — stale major version claim, CONFIRMED against live npm (HIGH)
Spine states: `Pinia | latest 2.x at lockfile time`. Memlog explicitly logs this as **not independently re-verified this run**. Live check (`registry.npmjs.org/pinia/latest`) returns **4.0.2** — the current latest major is 4.x, not 2.x. This is a real, two-major drift, not a hypothetical. Any lockfile written today under the assumption "latest is 2.x" is wrong on its face; a scaffold done by a human or agent trusting this line would either need to override it or would silently pull a major two versions past what the spine describes, with unknown API-compat implications for the Pinia usage patterns implied by AD-6/AD-10.
**Action:** re-verify Pinia's current major at lockfile time and update the Stack table row (or explicitly note the major-version gap as a risk to check during scaffolding).

### 2. Vue Router — stale major version claim, CONFIRMED against live npm (HIGH)
Spine states: `Vue Router | latest 4.x at lockfile time`. Memlog: not independently re-verified this run. Live check (`registry.npmjs.org/vue-router/latest`) returns **5.2.0** — one major ahead of the spine's claim.
**Action:** same as above — flag and re-verify before/at lockfile time; a "4.x" pin instruction is stale.

### 3. pnpm 11.x — asserted with zero memlog entry, but turns out correct (MEDIUM — process gap)
Spine states `pnpm 11.x (pure ESM; requires Node.js 22+)`. Unlike every other Stack row, this one has **no corresponding `(version)` entry anywhere in the memlog** — not even a "not re-verified" caveat. It reads as asserted from training data. Live check (`registry.npmjs.org/pnpm/latest` → 11.15.1, pnpm 11 requiring Node 22+ per release notes) shows the claim is in fact accurate. Correct outcome, but the process gap is real: nothing in the memlog shows this was checked, so it was fine by luck, not by verification. Flagging per the review's own standard ("Stack table row without a matching memlog version entry is unverified").

### 4. tauri-plugin-dialog / tauri-plugin-clipboard-manager — self-disclosed gap, confirmed low-risk (LOW)
Spine already labels both `2.x (not independently re-verified this run)`, and the memlog has a matching entry admitting the same. This is the one case where the spine is honest about its own gap rather than silently asserting. Live check: `@tauri-apps/plugin-dialog` → 2.7.2, `@tauri-apps/plugin-clipboard-manager` → 2.3.2 — both still land inside the "2.x" claim, so no correction needed. No action required beyond the spine's own "recheck at lockfile time."

### 5. Vue — unverified this run but confirmed accurate (LOW)
Spine: `Vue | 3.x`. Memlog groups this with Vue Router/Pinia as "not independently re-verified this run." Live check: `registry.npmjs.org/vue/latest` → 3.5.40. Still 3.x — claim holds. Lower risk than #1/#2 since no major-version drift exists here, but worth noting it shared the same unverified path and happened to be fine.

## Not flagged (verified, matches memlog)
Tauri crate 2.11.5, `tauri-plugin-store` 2.4.3, `tauri-plugin-updater` 2.10.1, `oar-ocr` 0.2.x (corrected from spine's original erroneous 0.8.x), `croner` (Rust) 3.0.1, `create-tauri-app` ~4.6.2, Rust MSRV 1.77.2 — all have explicit `(version)` memlog entries dated 2026-07-20 and were not independently re-challenged here since the memlog shows real verification work (crates.io/npm checks, not assertion).

## Verdict
Two Stack rows (Pinia, Vue Router) carry a **confirmed factual drift** — not just "unverified," but wrong as written, each one major version behind what npm serves today. One row (pnpm) was asserted with no verification trail at all but checks out. The spine's own "not independently re-verified" caveats on Vue/Router/Pinia/dialog/clipboard-manager were the right instinct — the Reviewer Gate now confirms two of those three deserved to be treated as load-bearing risks, not deferred to "lockfile time" language that reads as settled.
