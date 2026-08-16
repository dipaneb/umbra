---
name: Umbra
status: final
sources:
  - {planning_artifacts}/prds/prd-Umbra-2026-07-19/prd.md
  - {planning_artifacts}/step-1-1-roundtable-notes.md
updated: 2026-08-16
---

# Umbra — Experience Spine

## Foundation

Desktop, single-surface. Tauri (Rust core) + Vue frontend — one window, one form factor, no responsive-breakpoint or platform-parity question to resolve (macOS-first per NFR3, Windows/Linux best-effort, same UI). `DESIGN.md` is the visual identity reference; this spine is the behavior built on top of it.

## Information Architecture

Three views over one **Tool Registry** (AD-5) — sidebar, grid-home, and the ⌘K palette all read the same array (id, name, aliases, route, icon); nothing enumerates tools independently.

| Surface | Reached from | Purpose |
|---|---|---|
| Sidebar | Always visible (retractable) | Persistent nav — full tool list plus a pinned/recent section. Collapses to icons; state persists via `settings` store (AD-10). Icon-collapsed items retain their full accessible name (a visually-hidden label or equivalent) regardless of collapse state — the Accessibility Floor's screen-reader-label commitment holds at every collapse state, not just the expanded one. |
| Grid-home | Main pane default / logo click | The main pane's empty-state content — a tile per registered tool. Shown on every launch by default (see conflict note below). |
| ⌘K palette | Global shortcut (FR2) | Fuzzy search by name and alias ("b64" → Base64). `Enter` opens the top result. |
| Settings | Sidebar / gear | Sectioned pane: Privacy leads, then General/Appearance, then per-tool sections as they accrue persisted state. |

Structural wireframe: [`wireframes/ia-2026-08-16.excalidraw`](wireframes/ia-2026-08-16.excalidraw) — boxes-and-arrows of this table plus Update-signal/Clipboard-suggestion as cross-cutting affordances anchored to the sidebar.

Screen mock: [`mockups/step4.3-mockups-light.png`](mockups/step4.3-mockups-light.png) / [`-dark.png`](mockups/step4.3-mockups-dark.png), Screen 01. **Illustrative only, not locked IA**: that mock's sidebar splits Pinned/Recent/All Tools into three labeled sections — a real layout option, but the developer chose not to promote it into this table this session, so it stays a possible future refinement of "full tool list plus a pinned/recent section," not a spine requirement.

**Restore-last-tool fork — documented divergence from shipped behavior.** Story 1.10 shipped "restore last tool + window geometry on launch" with toggle default **on**. This EXPERIENCE.md documents the *target* behavior decided in this run: restore-last-tool defaults **off**. Grid-home is what greets the user on every launch unless they explicitly opt in via the Settings toggle — opting in means launch skips grid-home entirely and opens straight to the last tool. **This is a deliberate reversal of the shipped default, not a reconciliation** — flagged per the memlog's `CONFLICT WITH SHIPPED BEHAVIOR` entry as a retrofit item for a future correct-course pass (Step 5.1). A downstream reader (architecture, story-dev) must treat this as the intended target, not silently align it back to what's already in the codebase.

**Settings structure.** Sectioned, not flat (FR5's "minimal" framing is superseded). Privacy leads — surfaces every network carve-out (the update check; the clipboard-suggestion disclosure, on by default) as a trust surface, not buried in a generic list. Every persisted key (AD-10, `shell.*` / `<tool-id>.*` namespaces) is enumerated and individually clearable ("per-item reset"), *in addition to* the existing INV-3 all-clear action. The all-clear action is labeled with explicit erase-data phrasing — see Voice and Tone.

## Voice and Tone

Precision-instrument register, inherited directly from `DESIGN.md`'s Brand & Style ("precision instrument, not an indie utility" — professional, sharp, restrained, the iPhone-orange/Leica-dot reference point). Copy is short, factual, and specific. No exclamation marks, no cheerleading, no "Oops!" — errors and confirmations read like an instrument reporting state, not an app being friendly.

**[ASSUMPTION: this section's specific Do/Don't phrasing was derived from DESIGN.md's locked brand register, not independently tested this session — flagged for review at the Reviewer Gate.]**

| Do | Don't |
|---|---|
| "Clear stored data" | "Reset to default" |
| "JWT signature invalid at segment 2 (payload) — malformed base64." | "Something went wrong." |
| "No text found in this image." | "Oops, nothing here!" |
| "Update available — v1.4.2 (security fix)." | "You're missing out on the latest features! 🎉" |

The Settings "clear everything" action is a worked example of the discipline: the developer's first instinct was "reset to default," and Sally's catch in this run's `.memlog.md` was that "reset to default" reads as *restoring preferences* — a different concept from privacy-erasure. The action was renamed toward explicit erase-data phrasing ("Clear stored data") specifically so the copy doesn't quietly weaken INV-3's privacy claim. The same discipline applies everywhere: name the actual effect, don't reach for a softer generic synonym.

Error-message quality bar (FR12, FR18, FR21, FR26, NFR4) is a voice rule as much as a functional one — a tool that can't confidently convert input says so and shows what it *did* understand, rather than guessing quietly. Mechanics (exactly what "precise" requires) live in State Patterns' Error row; this is a system-wide tone commitment, not a per-tool one.

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Card | Grid-home tiles | Click anywhere opens the tool. Focusable in tab order; activates on Enter/Space as well as click; exposes an accessible name equal to the tool's name, not just its visual title text. Internal layout resolved at Step 4.3: icon-badge, then bold title, then description, stacked left-aligned — see `DESIGN.md` Components for the token-level spec. |
| Nav item (active state) | Sidebar, all states | Active item gets a background tint at `{colors.accent-signature-tint}` (light) / `{colors.accent-signature-tint-dark}` (dark) — referenced by name only, no restated value. Exactly one item active at a time; the active item also exposes its current state to assistive tech (an `aria-current`-style expectation), not just the tint — a screen-reader user tabbing the sidebar needs to know which tool is open too. Hover shows a neutral (non-orange) affordance; orange is reserved for the active state per `DESIGN.md`'s "budget of one" rule. |
| Update-signal | Anchored on the Settings sidebar item (resolved at Step 4.3, closing the earlier "exact anchor TBD") | Reuses `DESIGN.md`'s Notification Dot component as its base mark — **simplified at Step 4.3 from the originally-planned 3-tier escalation to 2 states**, full rationale and state list in State Patterns, flow in Key Flows (Flow 3). Not a toast, not a modal — passive until clicked. Focusable and keyboard-operable in both states, with an accessible name that changes between them ("Update available" / "Security update available"), so urgency is legible to assistive tech, not only visible. Visual treatment: `{colors.accent-signature}` dot (routine) vs. `{colors.accent-destructive}` dot (security-urgent) — see `DESIGN.md` Components and Do's-and-Don'ts for the scoped red exception. |
| Clipboard-suggestion surface | Sidebar, top position | A highlighted/pinned entry appears at the top of the sidebar when clipboard content matches a tool (looks like Base64/JWT/JSON) — full state list in State Patterns. Inert if ignored — no popup, no interrupt. Its appearance is announced via a polite live-region-equivalent cue (example wording in Flow 4) rather than relying on visual placement alone, since a user mid-task elsewhere in the app would otherwise have no way to learn it appeared; it's keyboard-reachable in the same tab sequence as other sidebar items, not left as an inference from the Nav item pattern. Visual treatment resolved at Step 4.3: a bordered/tinted callout labeled "Clipboard match," showing the matched tool's icon, name, and a truncated content preview — see `DESIGN.md` Components. |
| Floating surface — update-consent dialog | Opens from the update-signal (Flow 3) | Reuses `DESIGN.md`'s `{components.floating-surface}` token as-is — no new visual spec needed. Esc-dismissable; keyboard-operable button set ("Not now" / "Install"); focus moves into the dialog on open and returns to the update-signal control on close, per the Accessibility Floor's general commitment. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Empty (default) | Grid-home | The default state of the main pane on every launch (restore-last-tool off) — not a fallback, the actual home. One tile per registered tool. |
| No matches | ⌘K palette | Palette stays open with a plain "No matches" state — no suggested alternatives invented here (not sourced in `.memlog.md`/PRD); the palette never silently shows zero results without feedback. The result count / "No matches" text is exposed to assistive tech as the query changes, not just visually present once typing stops — a screen-reader user typing into the palette needs the same live feedback a sighted user gets. |
| Loading | Any tool, OCR in particular | In-tool progress indicator; never a blank pane. OCR jobs (potentially slow, local ONNX inference) show explicit in-progress state, not a frozen drop zone. Start and completion are exposed to assistive tech as an announced status, not only visually indicated — this is the general rule, not an OCR-only exception. |
| Error | Any tool (FR12/18/21/26, NFR4) | Precise inline error, always in-tool: names the exact failing segment/reason (e.g. "JWT signature invalid at segment 2 (payload)"). Never a crash, regardless of input size or malformedness. Never a silently-wrong result — if the tool can't confidently convert, it says so and shows what it *did* understand rather than guessing. Errors are announced when they appear (a status/alert-equivalent behavior), not just present in the DOM for a user who happens to tab to them. This is a single system-wide rule, not per-tool. |
| Offline | Global | The default state, not an edge case — Umbra is offline-by-default (INV-1). No "you're offline" banner anywhere except around the one network-touching surface: the update-check signal, which is itself the disclosed carve-out. |
| OCR empty/failed (FR26) | Bucket | Explicit state distinguishing "no text found" from a blank/successful-looking result — never renders an empty result as if extraction simply produced nothing to report. Uses the same announcement mechanism as Loading/Error above (an exposed status, not a visual-only cue) — grouped here rather than restated. |
| Update-signal | Settings sidebar item | **Simplified at Step 4.3** from the originally-planned 3-tier escalation (quiet-day-1 → rising-weight days 2-4 → security-urgent) to 2 real states, after the screen mock showed the escalation tiers weren't visually distinguishable from each other in practice: routine (`{colors.accent-signature}` dot, accessible name "Update available" — covers any non-security release, shown at constant weight from the moment it's available, no day-by-day ramp); security-urgent (`{colors.accent-destructive}` dot via the release manifest's `notes` convention, accessible name "Security update available" — a genuinely distinct color, not just added visual weight). Declined-but-persisting still applies to both: state survives "Not now," the dot simply remains visible on subsequent launches rather than resetting or re-nagging with a toast. See Flow 3. |
| Clipboard-suggestion surface | Sidebar, top position | No-match/hidden (nothing rendered, sidebar unchanged); match-shown (entry appears at top, announced via a polite live-region-equivalent cue); replaced-on-next-copy (entry swaps or clears on the next matching clipboard-change event, never stacks). See Flow 4. |
| Settings failure | Settings (any persisted-key write, including "Clear stored data") | NFR4's "no crash, errors always shown in-tool" rule extended explicitly to Settings' own persistence operations, not just tools: a write failure (a per-item reset, the all-clear action, or a toggle) never fails silently — Settings shows a precise inline error naming the failed action, never a crash and never a state that visually looks cleared/changed when it wasn't. |
| Update-check network failure | Update-signal (the disclosed carve-out) | Fails closed and quietly: the signal simply doesn't advance past its last-known state — no error toast, no retry prompt — and the check re-attempts on the next scheduled interval. Consistent with Offline being the unannounced default everywhere except this one disclosed carve-out; a failed check never blocks or degrades any offline tool. |

## Interaction Primitives

- **One-click copy-to-clipboard-as-text (FR4).** The primitive every tool is built around — paste in, act, copy out, as plain text. This is *why* "copy as image" was killed in this run's round-table: an image can't be pasted back out as usable text/data, which directly contradicts the one-click-copy pattern every other tool in the app depends on. Any new tool or export path is checked against this primitive before being added.
- **Drag-and-drop.** Bucket (OCR) and PDF tools accept drag-and-drop of files/screenshots as an alternative to a file picker.
- **⌘K invocation (FR2).** Global shortcut opens the command palette from any surface; fuzzy match on name and alias; `Enter` opens the top result. Focus moves to the palette's search input on open; on close (select, Esc, or click-away) focus returns to whatever element held it before invocation.
- **Clipboard-change event, fire-once-per-copy.** The clipboard-suggestion surface reacts to a clipboard *change* event, not a polling timer. This is deliberate on two fronts named in the memlog: it avoids the wasteful continuous-firing problem of polling while the app sits open unfocused, and it is the privacy-optics argument for why the feature is acceptable at all — a provable "reacts once, on an actual copy" story reads categorically differently from "watches the clipboard continuously," which would sit badly against Umbra's "your data never leaves your machine" pitch even though both are fully local. Cross-platform native availability of this event is a flagged engineering risk, not resolved here.

## Accessibility Floor

Full WCAG 2.1 AA. Behavioral floor — visual contrast math lives in `DESIGN.md`.

- **Every flow is keyboard-drivable, no exceptions.** Grounded directly in PRD NFR5: the 5-minute demo (⌘K → JSON format → JWT decode → NL→cron → drag-drop into Bucket) must be fully drivable without a mouse. If a flow can't be completed by keyboard alone, it isn't done.
- Visible focus indicators on every interactive element, at every tab stop, on every surface (sidebar, grid-home, palette, Settings, in-tool controls).
- Every control has a screen-reader label and role — VoiceOver-readable per NFR5, not just visually labeled.
- Color contrast: reference `DESIGN.md` tokens by name, e.g. `{colors.accent-signature-on-text}` for any orange-on-text pairing, `{colors.text-tertiary}` for de-emphasized text that still needs to read as real content — don't restate ratios here.
- This is the strongest of the accessibility options considered this run (full WCAG 2.1 AA, behavioral) — the developer's explicit choice, set by this project's portfolio/industry-standard stakes (see `.memlog.md`: this build should be defensible practice, not "good enough for one user").

## Inspiration & Anti-patterns

- **Lifted from VS Code's welcome tab / Notion's home tab:** the sidebar-is-persistent-nav / grid-is-main-pane-default relationship — grid-home isn't a rival to the sidebar, it's what the main pane shows when nothing is selected, same relationship those two products use.
- **Lifted from Chrome/Firefox's security-vs-feature update color distinction:** applied one step earlier than Chrome does it — to the *offer*, not the install (install still requires explicit consent per FR31) — a routine dot for ordinary releases, a distinct color for security-flagged ones. (An earlier draft of this flow also lifted Chrome's *escalating* menu-icon weight for unacknowledged updates; dropped at Step 4.3 when the screen mock showed the weight increments weren't visually distinguishable — see State Patterns' Update-signal row.)
- **Rejected — VS Code's undeduped "restart to update" toast:** reappears on every window reload per multiple open GitHub issues, because the app doesn't remember "user already saw this." Umbra's update-signal explicitly tracks already-shown/declined state so it stays visible without ever re-firing an interruptive prompt.
- **Killed — menu-bar-resident app + system-wide global hotkey:** rejected in favor of a deliberate-window stance — the user should consciously open Umbra, not summon an ambient overlay that's always listening in the background. The same deliberate-window principle also killed watch-folder/background automation (idea below) — both were rejected for the same underlying reason.
- **Killed — watch-folder / background automation mode:** conflicts with the same deliberate-window stance — Umbra acts when the user acts on it, not on files appearing in a folder unattended.
- **Killed — "copy as image" export:** an image can't be pasted back out as usable text/data, which directly contradicts FR4's one-click copy-to-clipboard-as-text pattern every tool in the app is built around.

## Key Flows

### Flow 1 — First launch (Amara, privacy-conscious freelance developer, evaluating Umbra before trusting it with client data)

1. Amara downloads and opens Umbra for the first time.
2. Grid-home fills the main pane — a tile per tool, no welcome splash, no privacy-promise screen, no update-preference prompt. (Explicitly out of scope for this first-launch flow — decided directly, not by omission.)
3. A brief guided highlight walks the sidebar (retractable, pinned tools) and the grid, orienting her to the two persistent nav surfaces. The tour moves focus to each highlighted step's content as it plays, is dismissible and advanceable by keyboard throughout (not just via Esc at the end), and exposes its step text to assistive tech as it's presented.
4. She dismisses the tour and clicks a tile — JSON Formatter opens in the main pane, sidebar shows it as active.
5. **Climax:** she opens Settings and finds Privacy leading the list — every network carve-out (update check; clipboard-suggestion) named and toggleable, every persisted key listed with its own clear button. Nothing hidden, nothing to take on faith. She closes Settings convinced this app means what it says about her data.

Failure: if she skips the tour immediately (Esc or click-away), grid-home is still fully usable without it — the tour is orientation, not a gate.

Wireframe: [`wireframes/flow-first-launch-2026-08-16.excalidraw`](wireframes/flow-first-launch-2026-08-16.excalidraw). Screen mock (resolves Card internal layout — see Component Patterns): [`mockups/step4.3-mockups-light.png`](mockups/step4.3-mockups-light.png) / [`-dark.png`](mockups/step4.3-mockups-dark.png), Screen 01.

### Flow 2 — The 5-minute demo (Devon, the developer, demoing Umbra live to a hiring panel of recruiters and interviewers)

1. Wi-Fi is off. Devon opens Umbra — grid-home is already what's on screen from the prior launch (or reachable in one keystroke).
2. `⌘K`, types "json," `Enter` — JSON Formatter opens. Pastes a payload, formats it.
3. `⌘K` again, "jwt" — JWT Inspector opens. Pastes a token; header and payload render pretty-printed, no network call (FR16), and the sidebar's active-nav highlight updates instantly.
4. `⌘K`, "cron" — types "every Monday at 9am," gets `0 9 * * 1` back deterministically.
5. Activates the Bucket drop zone's file-picker button to select a screenshot of an error dialog — the file-picker is the flow's stated canonical, keyboard-operable path (Interaction Primitives); dragging the screenshot onto the drop zone works too, as an alternative to it. Local ONNX OCR extracts the text; Devon copies it out as plain text with one click (FR4).
6. **Climax:** the panel watches the whole sequence run — palette, format, decode, convert, select, extract, copy — without a single mouse click needed anywhere in the sequence, and without the network indicator ever lighting up. The demo's proof point isn't any one tool; it's that nothing here needed the internet, and every step traces back to one registry and one interaction primitive (copy-to-clipboard-as-text).

Failure: if the OCR extraction finds no text (a blank or low-quality screenshot), the Bucket states that explicitly (FR26) rather than the demo appearing to silently fail — Devon narrates the honest-failure state as a feature, not an apology.

Wireframe (palette-switching steps, combined with Flow 4's clipboard-suggestion path as the two tool-discovery/switching surfaces): [`wireframes/flow-tool-discovery-2026-08-16.excalidraw`](wireframes/flow-tool-discovery-2026-08-16.excalidraw).

### Flow 3 — Update signal, over several days (Priya, a returning daily-use developer, Umbra open across weeks of regular work)

1. A new release ships. On next launch, a dot appears on the Settings sidebar item at constant, routine weight — noticeable but not urgent. Its accessible name reads "Update available." (**Simplified at Step 4.3**: earlier drafts of this flow had the dot escalate in visual weight across days 2–4 before Priya acts; the Step 4.3 screen mock showed that ramp wasn't visually distinguishable in practice, so it's dropped — the routine dot stays constant until she acts or a security release supersedes it.)
2. Priya notices it on a later launch, clicks it — the Floating surface — update-consent dialog (Component Patterns) opens, showing version and notes. She clicks "Not now."
3. **Declining does not clear the signal.** No re-nagging toast fires on the next launch (the killed VS Code anti-pattern — an undeduped "restart to update" toast that reappears every reload). Instead, the same passive dot simply remains visible across subsequent launches, exactly as if she'd never opened the dialog — the signal's *state* persisted, the interruption did not repeat.
4. **Climax — a security-flagged release ships.** Instead of the routine dot's color, the signal switches to `{colors.accent-destructive}` (red) — a genuinely distinct color, not the same dot grown larger — signaled via a convention in the release manifest's `notes` field, since Tauri's `latest.json` has no native severity field — and its accessible name updates to "Security update available," so the urgency reads the same way through assistive tech as it does visually. She notices immediately, opens the dialog, and installs.

Failure: if she ignores the signal indefinitely, it simply remains visible rather than giving up, auto-installing, or escalating into an interruption — consent is never bypassed, per FR31.

Wireframe: [`wireframes/flow-update-consent-2026-08-16.excalidraw`](wireframes/flow-update-consent-2026-08-16.excalidraw). Screen mock (resolves Update-signal states + anchor — see State Patterns and Component Patterns): [`mockups/step4.3-mockups-light.png`](mockups/step4.3-mockups-light.png) / [`-dark.png`](mockups/step4.3-mockups-dark.png), Screen 01.

### Flow 4 — Clipboard-suggestion surface in daily use (Amara, mid-task, has copied a JWT from a terminal)

1. Amara copies a JWT string from her terminal into the clipboard, then alt-tabs back to Umbra (already open from earlier).
2. The clipboard-change event fires once, on that copy — Umbra recognizes the shape as a JWT.
3. A highlighted entry appears at the top of the sidebar: the JWT Inspector, surfaced because of the match — not a popup, not an interrupt, just newly visible at the top of nav. Its appearance is announced via a polite live-region-equivalent cue ("JWT Inspector suggested from clipboard") so Amara would learn it appeared even if her focus were elsewhere mid-task, and it's keyboard-reachable in the same tab sequence as other sidebar items.
4. She clicks it. JWT Inspector opens with the clipboard content already available to paste in one action (FR4's paste-in / copy-out primitive).
5. **Climax:** she never had to remember which tool handles JWTs or hunt for it in the grid — the surface met her where her last action left off, and if she'd ignored it entirely, it would have sat there inert with no cost to ignoring it.

Failure: if the clipboard content only superficially resembles a JWT/Base64/JSON shape — a false positive, e.g. a long dot-separated string that isn't actually a valid token — the suggestion still surfaces, since detection is shape-based, not validation-based. Opening it shows the tool's own precise inline-error/no-valid-input state (State Patterns, Error row) rather than crashing or silently mis-suggesting a result that isn't there.

Disclosure: this behavior is on by default, and is named explicitly in Settings → Privacy (same transparency posture as the update-check carve-out) so a privacy-conscious user like Amara can find, understand, and turn it off in one place rather than discovering it by surprise.

Wireframe: see [`wireframes/flow-tool-discovery-2026-08-16.excalidraw`](wireframes/flow-tool-discovery-2026-08-16.excalidraw) (shared with Flow 2, above — both are tool-discovery/switching paths). Screen mock (resolves the Clipboard-suggestion visual treatment — see Component Patterns): [`mockups/step4.3-mockups-light.png`](mockups/step4.3-mockups-light.png) / [`-dark.png`](mockups/step4.3-mockups-dark.png), Screen 01, "Clipboard match" callout.

### Flow 5 — Settings, operated end-to-end (Amara, a few days into using Umbra, tightening her privacy and appearance preferences)

1. Amara opens Settings from the sidebar gear.
2. Appearance: she toggles the dark-mode override to "Dark," overriding the system-follow default (FR3) — the whole app repaints immediately, no reload required.
3. Privacy: she disables the clipboard-suggestion toggle — the same carve-out named plainly in Flow 1's climax — confirming for herself that the control actually turns the feature off, not just discloses it.
4. In the JWT Inspector's per-tool section, she clicks "Clear stored data" next to one persisted key (its last-used-algorithm preference) — a per-item reset, distinct from the all-clear action.
5. **Climax:** only that one key clears. Her dark-mode override and every other tool's persisted state are untouched — the per-item reset does exactly what its label says, nothing swept along silently with it.

Failure: if a persisted-settings write fails — the per-item reset, the toggle, or the "Clear stored data" action itself — Settings shows a precise inline error naming the failed action (State Patterns, Settings failure row) rather than a silent no-op that would leave Amara unsure whether her data was actually cleared.

Wireframe: [`wireframes/flow-settings-2026-08-16.excalidraw`](wireframes/flow-settings-2026-08-16.excalidraw). Screen mock: [`mockups/step4.3-mockups-light.png`](mockups/step4.3-mockups-light.png) / [`-dark.png`](mockups/step4.3-mockups-dark.png), Screen 03. Note: the mock's per-tool example ("Remember last decoded token" for JWT Inspector) is illustrative content only, not a locked product decision — no per-tool persisted state has actually been decided yet, per Open Questions.

---

## Open Questions

Explicitly parked, not designed this pass — none of these are IA-shaping for this spine, so they're flagged here rather than silently dropped or invented:

- **"Send to" tool-chaining** (e.g. Bucket OCR output → JSON formatter without manual copy/paste) — round-table MAYBE, needs its own dedicated session; also sits in tension with AD-6 ("tools are islands").
- **Structural diff/compare mode** (two JSON payloads, two JWTs, two hashes) — round-table MAYBE, leaning keep, unshaped.
- **Native OS notifications** — round-table status is actually KEPT-build-now (low-cost first-party plugin, infra bet on future tools), but no concrete UX trigger exists yet to shape; left unshaped here rather than invented.
- **Batch/folder-level Bucket operations** — also round-table KEPT, but opens a real, unresolved concurrency/memory-limit engineering question (serial vs. bounded worker pool); no UX shape drafted here.
- **CLI companion / MCP server / WASM-compiled browser demo** — all round-table KEPT but explicitly sequenced after v1 (and, for WASM, after a separate landing-page discovery session); no in-app UX surface to design yet.

Full drafting and Reviewer Gate history (self-check fixes, rubric/accessibility findings and their resolutions, editorial passes) is recorded permanently in `.memlog.md` — not restated here.

**Remaining, not fixed (flagged honestly, not blocking):** Settings' per-tool sections beyond Privacy are named structurally but not itemized (no PRD/memlog source enumerates them yet, so nothing to ground); the update-signal's exact chrome anchor (sidebar footer vs. global titlebar) is left as "TBD at screen-mock stage" rather than invented; the update-signal and clipboard-suggestion surface's visual treatments remain unresolved by design, deferred to Step 4.3 alongside Card's internal layout — not a gap, a recorded deferral.
