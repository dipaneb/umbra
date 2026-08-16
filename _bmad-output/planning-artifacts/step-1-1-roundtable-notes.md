---
title: "Umbra v2 — Round-table Discovery Notes (Step 1.1)"
status: in-progress
created: 2026-08-15
party: Mary (analyst), John (PM), Sally (UX), Winston (architect, on-call)
mode: session (inline, no subagents)
source: _bmad-output/planning-artifacts/brand-ux-product-discovery-roadmap.md, Step 1.1
---

# Umbra v2 — Round-table Discovery Notes

> Raw material for Phase 2 (formalize into brief/PRD/decisions log). Not a spec — a log of
> every option raised and the developer's live reaction. Existing docs (prd.md, epics.md,
> ARCHITECTURE.md) are reference only throughout; nothing here is binding until Phase 2.

## Topic: Navigation model (sidebar vs. grid-home vs. hybrid)

**Context surfaced:** shipped baseline is a persistent sidebar (Story 1.5) + ⌘K palette
(Story 1.6), both sourced from the single Tool Registry (AD-5). Story 1.10 restores last-used
tool + window geometry on launch (toggle, default on).

**Options raised:**

1. **Status quo — always-visible flat sidebar.** John's opening position (why fix what isn't
   broken). Not seriously defended once Sally's counter landed — kept only as the fallback if
   nothing else earns its complexity.
2. **Grid-home as primary nav, sidebar demoted.** Sally: first launch shows a tile grid (no
   sidebar), selecting a tool opens it and reveals a slim rail of recent/pinned tools. Home
   reachable via logo/shortcut afterward. Mary's caveat: Umbra has ~7 tools vs. DevToys' ~40 —
   a grid this small risks reading as sparse rather than deliberate.
3. **Retractable sidebar with pinned tools.** Raised by the developer directly — a middle path
   between always-on sidebar and full grid-home: sidebar can collapse/expand, and holds
   user-pinned tools rather than (or alongside) the full flat list.
4. **Feasibility (Winston):** rendering off the registry is cheap regardless of which shape
   wins — AD-5 already makes sidebar/palette/grid interchangeable *views* over one array. The
   real new cost is state that doesn't exist yet: a "recent/pinned" list, which would live in
   the `settings` Pinia store (AD-10). Ballparked as one story, not a re-architecture.
5. **Open fork — restore semantics.** If a home/grid screen exists, does Story 1.10's
   "restore last tool on launch" skip home entirely (straight to last tool), or does home only
   ever show on the very first launch? Flagged by John as a real decision, not a nit — not yet
   answered.

**Developer's reaction (round 1):** liking multiple options at once rather than picking one —
wants to keep exploring; explicitly wants the retractable-sidebar-with-pinned-tools *and*
grid-home ideas both still alive, not a forced choice yet.

**Synthesis (round 2) — not a rivalry, a combination:** developer clarified the sidebar stays
(retractable, pinned tools) for ease of use, and separately worried that *skipping* the grid
would leave an empty main pane. Room's read: these aren't competing nav models — sidebar is
persistent, always-visible nav; grid is what the *main pane* shows by default (no tool
selected / on launch), same relationship as VS Code's welcome tab or Notion's home. Not a
"pick one" fork after all.

**Status: leaning KEEP**, as a combination — persistent sidebar (retractable, pinned tools) +
grid as the main pane's default/empty-state content, not a sidebar replacement.

**Still open, unresolved:** restore-semantics fork — does "restore last tool on launch"
(Story 1.10) skip the grid entirely (straight to last tool, grid only reachable via a home
click), or does the grid stay the landing pad on every launch with restore only affecting
what's highlighted/pinned in the sidebar? Needs a decision in Phase 2, not answered here.

## Topic: Clipboard-aware tool suggestion

**Options raised:**

6. **Smart clipboard detection surfaced in the sidebar/grid.** Developer's addition: detect
   clipboard content (e.g. looks like Base64, looks like a JWT, looks like JSON) and surface
   the matching tool as the first/most visible item — either pinned to the top of the sidebar
   or made clearly visible on the grid-home.
7. **Mechanism fork — on-focus check vs. background polling vs. event-driven.** Room initially
   proposed "only check when the window gains focus" (avoids continuous background reads).
   Developer independently raised a sharper concern: checking while the app sits open,
   unfocused, unused for hours would fire the detection uselessly the whole time — an
   efficiency/annoyance objection, not just a privacy one. Winston reframed the real fork as
   **polling-on-a-timer** (has the wasteful-firing problem) vs. **reacting to clipboard
   *change* events** (fires once per actual copy, regardless of focus state) — the
   event-driven approach was noted as solving both the developer's efficiency worry and John's
   earlier privacy-optics worry ("watches everything" reads worse for a timer loop than for a
   provable on-change reaction). Cross-platform availability of a native change-event (vs.
   needing to poll) flagged explicitly as **unverified — needs a real feasibility check**,
   not assumed from the room discussion.
8. **Privacy/brand tension (raised, then largely resolved by #7).** John: any clipboard
   auto-detection risks reading as surveillance for an app whose core pitch is "your data
   never leaves your machine" / INV-1, even though the behavior is fully local. Mary: same
   pattern exists in Raycast/1Password but neither is a privacy-first pitch, so Umbra can't
   borrow their framing for free. Largely defused by the event-driven direction in #7 rather
   than needing a separate toggle, though an explicit Settings disclosure (same pattern as the
   update-check carve-out) remains a live option worth carrying into Phase 2.

**Status: leaning KEEP**, direction = event-driven clipboard-change detection (not
timer-polling), mechanism to be feasibility-checked before Phase 2 locks it. Disclosure
approach (silent vs. named in Settings) still open.

## Topic: Dark mode

_(Context: FR3 shipped light-mode-first, dark theme explicitly deferred to v2 in the existing
PRD. That deferral is reference only, not binding, per this roadmap's rules.)_

**Options raised:**

1. **Whether dark mode belongs at all.** Barely contested — Sally/Mary: near-universal
   expectation for this app's reference class (Raycast/Warp/Linear) and audience (devs report
   strong dark-mode preference). Not seriously opposed.
2. **Sequencing — design vs. implementation timing.** Winston/Sally: the PRD's "deferred to
   v2" read as an implementation-order decision, but got conflated with design timing. Both
   light and dark palettes should be **designed together in Step 3.2 (DESIGN.md)** regardless
   of which ships first, because dark-mode contrast (independently clearing WCAG AA 4.5:1 per
   NFR5) is a design/verification cost, not an engineering one — cheap to fold in now, an
   expensive retrofit if DESIGN.md locks single-mode tokens first.
3. **Mode-selection UX — system-follow vs. manual toggle vs. dark-as-default.** Named as an
   open fork by Mary; **resolved by the developer directly: system-follows-OS by default, with
   a manual override.**

**Status: KEPT, decided.**
- Dark mode ships (timing of *implementation* still open/unranked against other work, but no
  longer "maybe").
- Both light and dark palettes designed together at Step 3.2 (DESIGN.md), not sequentially.
- Mode selection: **follows OS appearance by default; manual override available.** The
  override is a preference, so it needs persistence — falls under AD-10's `settings` store
  (`shell.*` namespace) and must be enumerated in the Settings pane per Story 1.10's
  single-action-clear requirement, same as every other persisted key.

## Topic: Update-flow UX

_(Context: the update **mechanism** is already shipped — Story 5.2, FR31 — app-built
confirmation dialog, explicit user consent required before install, INV-1 carve-out disclosed
in README + in-app. Not up for re-litigation. What's open is the experience around it.)_

**Research pulled in (Mary, live web search, not assumed from training):** Chrome auto-updates
fully silently and signals only via a color-escalating menu icon (green at 2 days available,
yellow at 4, red past 7). VS Code shows a "restart to update" toast that — per open GitHub
issues (#111185, #229422, #298179) — reappears on every window reload rather than being
deduped, a documented user complaint. Slack dropped its machine-wide Windows installer in 2025
in favor of quieter per-user updates.

**Options raised and resolved:**

1. **Presentation model.** Chrome's full silence was ruled out immediately — FR31 already
   requires explicit consent, that's not open. The useful borrow is Chrome's *escalation*
   idea applied one step earlier, to the *offer*, not the install: a quiet, low-attention
   signal (e.g. a dot) that can escalate in visibility over a few days if ignored — **decided:
   yes, quiet-escalating, confirmed by the developer.**
2. **Anti-pattern named and explicitly avoided:** VS Code's repeat-toast-every-reload problem
   — traced to not remembering "user already saw this." Umbra's design must track
   already-shown/declined state to structurally avoid the same bug.
3. **"What does declining mean" (ask-next-launch / ask-after-N-days / skip-this-version) —
   still open**, left as a Phase 2 spec-level detail.
4. **Security-vs-feature update distinction.** Developer's addition: should a security fix be
   surfaced with more urgency than a routine feature release? Mary: real precedent — Chrome
   and Firefox both do this. John's scope check: nothing in the pipeline today (AD-12,
   tag-driven; FR32, Conventional Commits) carries a release *type* signal — has to be added.
   Winston checked the **live Tauri v2 updater docs** directly (`context7`, not assumed): the
   `latest.json` manifest has `version`/`notes`/`pub_date`/`platforms` — no structured
   severity field exists natively. Two honest paths named: (a) hand-roll a convention in the
   free-text `notes` field, or (b) infer from Conventional Commits' `fix:` vs `feat:` split —
   rejected as too noisy, since most fixes aren't security issues.
   **Decided by the developer: build the real distinction now, via path (a)** — a convention
   in the release manifest's `notes` field, cheap enough ("just adding a note in the release")
   to justify building now rather than deferring. Security-flagged releases get a distinct,
   more urgent visual state on the same escalation system from #1.
   **Follow-up flagged (John):** must be documented as a release-process checklist step (same
   pattern as Story 5.3's network-monitor procedure), or the manual convention will silently
   rot. Exact marker syntax left as a Phase 2 spec-writing detail, not decided in this room.

**Status: KEPT, decided** on presentation model, anti-pattern avoidance, and building the
security/feature distinction now. Open items carried to Phase 2: decline-semantics (#3),
exact `notes` marker syntax, and adding the release-checklist documentation step.

## Topic: Settings

**Options raised and resolved (developer, direct):**

1. **Sectioned layout, not flat list** — the pane has organically grown past "minimal" (FR5's
   original framing) just from this session's decisions (dark-mode override, pinned tools,
   clipboard-suggestion disclosure, update-decline state). **Decided: sections, not flat.**
2. **Privacy section leads.** Sally's pitch: don't bury the network-carve-out disclosures
   (update check, clipboard-disclosure route) in a generic list — lead with them as a trust
   surface, not an afterthought. Mary: precedent in trust-forward apps (1Password-adjacent)
   leading with Privacy/Security, not General. **Decided: yes, Privacy first.**
3. **Per-item reset**, in addition to the existing INV-3 all-or-nothing clear action.
   **Decided: yes, both.**
4. **Naming the nuclear clear action.** Developer flagged "clear everything" as weak wording,
   suggested something like "reset to default." Sally's catch: that's actually a *different
   concept* — "reset to default" reads as restoring preferences, while this action is
   specifically INV-3's privacy proof (erase stored data). Renaming toward generic
   reset-language would quietly weaken the claim being made. **Decided: rename toward
   clear/erase-data phrasing** (e.g. "Clear stored data"), not generic reset language — exact
   string left as a copywriting detail.

**Status: KEPT, decided** on all four points.

## Topic: Open brainstorm — beyond what the developer had already considered

_(Explicit redirect from the developer: prior topics only covered ideas already in the
developer's head. This is a first-time solo build with no test users/client/product owner —
the room's job here is to surface genuinely new territory, not just react.)_

**Round 1 — options raised:**

1. **Menu-bar-resident app + true system-wide global hotkey** (not the in-app-only ⌘K that
   exists today), backed by real Tauri first-party plugins confirmed via docs
   (`tauri-plugin-notification`, `TrayIconBuilder`, global-shortcut plugin — all first-party,
   cross-platform). Pitched as a Raycast/Spotlight-shaped reframing of the whole product.
   **Developer's reaction: rejected for now** — deliberate stance, not a lesser one: wants the
   user to consciously open a window, not summon an ambient overlay. **Parked idea raised in
   response:** a distant-future RAG-powered quick-access layer + an always-available shortcut
   to reach a search bar or the app window — shape entirely undefined, explicitly "not for
   now."
2. **Native OS notifications** (`tauri-plugin-notification`, confirmed first-party/cheap).
   **Decided: KEPT — build the plumbing now**, even without an immediate killer use case,
   betting future tools (long Bucket jobs, update-flow escalation) will want it. Room's
   caveat (John): this reasoning is normally a scope-creep trap, but the low cost of a
   first-party plugin (vs. custom-built speculative infra) changes the risk calculus — not a
   general license to build ahead of need elsewhere.
3. **CLI companion**, near-free given `umbra-core`'s existing zero-Tauri/zero-OS-branch
   architecture (AD-1/AD-2). **Decided: KEPT, real, but deliberately sequenced after v1 and
   the landing-page rebuild** — not before.
   **Sub-question raised by developer: does an MCP server make sense for Umbra?** Uncertain
   whether it adds anything over a local agent just using the CLI, and worried cloud-hosted
   agents put data off-device. **Answered (Winston, verified via live web research, not
   assumed):** MCP servers typically run over stdio — a local subprocess of the client, no
   network transport for the tool call itself; same privacy category as the CLI. What
   *would* leave the machine in a cloud-agent scenario is the agent's own model call deciding
   what to relay from the tool's output — analogous to a human pasting output into a chat, not
   Umbra phoning home. Developer's instinct that "an agent can just use the CLI directly" is
   correct for local agents with shell access; MCP's marginal value is for clients that can't
   shell out or want structured tool schemas. **Conclusion: MCP is a near-free optional skin
   on top of the CLI, inherits the CLI's own post-v1 priority — not a separate decision.**
4. **Batch/folder-level operations** for Epic 6's Bucket tools (merge/convert a whole dropped
   folder, not one file at a time). **Decided: KEPT.** Developer's own addition: good vehicle
   for testing real-world performance and figuring out per-user resource limits.
   **New open engineering question raised (Winston):** AD-4 covers one async operation
   off-thread; batch means *N* at once, and "how many run concurrently" is a real fork — plain
   serial (safe, slow) vs. a bounded worker pool (faster, but now concurrency/memory limits
   are a real design decision) — left open for whenever batch is actually built.
5. **Plugin/extension system** — re-surfaced as a reminder that this is already explicitly out
   of scope per PRD §8. **Acknowledged, no change** — confirms the existing decision stands.

**Round 2 — options raised:**

6. **WASM-compiled `umbra-core` for an in-browser landing-page demo.** Enabled by the same
   zero-Tauri/zero-OS-branch property (AD-1/AD-2) that made the CLI idea near-free — the same
   crate could run tool logic directly in a visitor's browser tab, no download required,
   provably local (visitor can open dev tools and watch zero network requests). **Developer's
   reaction: good idea, explicitly postponed to the landing-page redesign** (out of scope for
   this roadmap) — flagged as an architecture fact worth carrying into that future session
   since nobody there would think to ask for it otherwise. **Status: KEPT, deferred to
   landing-page discovery.**
7. **"Send to" tool-chaining** — pipe one tool's output directly into another (e.g. Bucket
   OCR output → JSON formatter) without a manual copy/paste round-trip. Winston flagged real
   cost: tension with AD-6 ("tools are islands," no cross-tool state reads) — resolvable by
   keeping the wiring shell-level rather than letting tools know about each other, but it's
   genuine new plumbing, not a free plugin. John: needs scoping to specific sensible pairs, not
   "every tool to every tool." **Developer's reaction: likes the idea, wants dedicated
   follow-up thinking — not decided here.** **Status: MAYBE, needs its own session (Step 1.3
   candidate).**
8. **Structural diff/compare mode** (two JSON payloads, two JWTs, two hashes — structural, not
   raw-text diff). Mary: common, real pattern in this tool category. **Developer's reaction:
   wasn't aware it was a common need, open to it if real.** **Status: MAYBE, leaning keep.**
9. **"Copy as image"** — export a styled, shareable image of formatted output (e.g. a JSON
   tree) instead of raw text, for pasting into Slack/docs. **Developer's reaction, after a
   clearer explanation: rejected** — the core objection is sharp and specific: an image can't
   be copy-pasted back out as usable text/data, which directly contradicts FR4's one-click
   copy-to-clipboard pattern that every tool in the app is built around. Not "uninteresting,"
   actively wrong-shaped for what this app optimizes for. **Status: KILLED — reason recorded
   so it isn't re-proposed identically; revisit only if a real user asks for it.**
10. **Watch-folder / background automation mode.** Named deliberately, with the tension to
    the developer's own deliberate-window stance (idea #1 this session) flagged up front.
    **Developer's reaction: rejected, consistent with that stance.** **Status: KILLED.**

## Topic: Process for capturing tonight's (and future) ideas

**Developer's own idea**, raised unprompted: track every idea from sessions like this — sure
things and distant-maybe things alike — as **GitHub issues with maximum context**, so that
picking up any idea later is as simple as telling an AI agent "pick up issue #N" and having it
work from full, self-contained context. Directly solves a problem the developer named earlier
in the same session ("I will not remember it at the time").

**Room's engagement:**
- Mary: not a new mechanism — a rigor upgrade to Story 5.5's already-shipped public GitHub
  backlog (seeded with P3 candidates). What's new is the max-context-per-issue discipline and
  the explicit AI-pickup purpose, not the existence of a backlog.
- Winston: well-matched to actual agent tooling — `gh issue view <N>` already pulls full issue
  context in one call; "pick up issue #N" is already the natural shape of briefing an agent.
- Initial proposal (John): pair this with a full brief/PRD rewrite for cross-cutting
  decisions. **Developer pushed back**, proposing GitHub issues alone are sufficient — even
  for decisions with a dependency order, handled by a plain sentence in the blocking issue
  naming the issue number it depends on ("needs #N done first").
- **Refined and settled:** issues-only is right for anything **net-new** (never mentioned in
  the existing PRD/epics). The one exception: a decision that **contradicts already-written
  PRD/epics text** (e.g. dark mode's system-follow-default vs. FR3's current "light-mode-first,
  dark deferred to v2") needs a small inline correction — following the precedent Story 6.2
  already set for the HEIC descope (one dated paragraph bolted onto the existing entry, not a
  rewrite). No full brief/PRD rewrite ceremony either way.
- Dependency ordering between issues: a plain sentence naming the blocking issue number,
  optionally reinforced by GitHub's native issue-linking/"blocked by" relationship (worth a
  two-minute check when issues are actually created, not a requirement).

**Status: KEPT, decided.** This is the process the developer wants used to carry tonight's
(and future) ideas forward — GitHub issues with maximum context as the default; PRD/epics
touched only for small inline corrections where a decision contradicts existing text.

---

## Session summary (status at close)

| Thread | Status |
| --- | --- |
| Nav model (sidebar + grid-home hybrid) | Leaning KEEP — restore-semantics fork still open |
| Clipboard-aware tool suggestion | Leaning KEEP — event-driven direction, mechanism unverified |
| Dark mode (system-follow + override, designed in Step 3.2) | KEPT, decided |
| Update-flow UX (quiet-escalating signal + security/feature distinction) | KEPT, decided |
| Settings (sectioned, Privacy-first, per-item reset, renamed clear action) | KEPT, decided |
| Menu-bar-resident app + global hotkey | KILLED — deliberate-window stance preferred |
| Distant-future RAG + always-available shortcut | Parked, unshaped, explicitly "not for now" |
| Native OS notifications | KEPT, build now (infra-first, low-cost first-party plugin) |
| CLI companion | KEPT, sequenced after v1 + landing-page rebuild |
| MCP server for Umbra | Answered/clarified — near-free optional skin on CLI, inherits its priority |
| Batch/folder operations (Epic 6 Bucket tools) | KEPT — opens a real concurrency/memory-limit question for later |
| Plugin/extension system | Reconfirmed OUT OF SCOPE (already decided pre-session) |
| WASM-compiled core for landing-page demo | KEPT, deferred to landing-page discovery session |
| "Send to" tool-chaining between tools | MAYBE — needs dedicated follow-up thinking |
| Structural diff/compare mode | MAYBE, leaning keep |
| "Copy as image" export | KILLED — conflicts with FR4's copy-as-text pattern |
| Watch-folder automation | KILLED — conflicts with deliberate-window stance |
| Idea-capture process (GitHub issues, max context) | KEPT, decided — governs how all of the above gets carried forward |

**Next step per the roadmap:** Phase 2 — formalize. Given the process decision above, that
means: small inline corrections to `prd.md`/`epics.md` only where a KEPT/decided item
contradicts existing text (dark mode, update-flow, settings sections at minimum), plus
GitHub issues with maximum context for every MAYBE/KEPT-but-not-yet-built item, cross-linked
where one depends on another. No full brief/PRD rewrite.
