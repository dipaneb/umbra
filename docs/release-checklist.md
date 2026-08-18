# Release checklist — proving the privacy promise, every time

This document exists for one reason: Umbra's whole pitch rests on a single testable
claim — "your data never leaves your machine, except a disclosed, user-confirmed update
check" (NFR1). A claim like that isn't worth anything as a slogan; it has to be
*verified*, on the actual thing you're about to ship, every time you ship it. This file
is the procedure that verification follows. Run it before every release, and paste the
result into that release's version-bump PR (AD-12) before merging it.

This is a **manual v1 procedure** — no CI job or PR template enforces it mechanically
yet (see "What this deliberately does not do," below). It works by being written down
and actually followed, not by a bot blocking a merge.

## Before you tag: bump the version

`src-tauri/tauri.conf.json`'s `"version"` field must be bumped to match the tag you're
about to push, **before** you push it. `.github/workflows/release.yml`'s own
"verify tag matches tauri.conf.json's version" step (lines 57–71) already fails the
release job fast if you forget — it compares the pushed tag against
`tauri.conf.json`'s version and exits with an error before any build/sign/notarize work
starts. So a forgotten bump can't silently ship a version-mismatched build; it just
costs you a wasted tag push and a failed CI run. Doing the bump *first* avoids that
round-trip entirely — this paragraph is the human-facing documentation of a discipline
the CI check exists to catch, not new enforcement logic.

## Before you tag: write the release notes

The tag you push **is** the release notes' only source — there's no later editing
window (`release.yml`'s `tauri-action` step runs with `releaseDraft: false`, so the
release publishes immediately) and no automated fallback. Write the annotated tag's
message when you create it, before pushing:

```bash
git tag -a v0.1.4 -m "Short summary of what changed in this release."
git push origin v0.1.4
```

`-m` can be repeated for multiple paragraphs (`-m "para one" -m "para two"`), or
omitted entirely to open `$EDITOR` for a longer message.

**A tag pushed without `-a`/`-m` (a lightweight tag, e.g. plain `git tag v0.1.4`) ships
with empty release notes — deliberate, not a bug.** `release.yml`'s notes-extraction
step only reads a tag's message when the tag is a real annotated tag object
(`%(objecttype)` = `tag`); a lightweight tag has no message of its own to read, and the
step is guarded to leave notes empty rather than fall back to the underlying commit's
message (which could leak internal-facing PR-body text into the end-user-visible update
dialog). `v0.1.1` and `v0.1.2` were both cut as lightweight tags, historically — check
with `git cat-file -t <tag>` if you're unsure whether an existing tag is annotated.

This text becomes `latest.json`'s `notes` field, and from there the app's
`Update.body` (`src/shell/updateCheck.ts`) — rendered directly to end users in
`UpdateDialog.vue` and `SettingsView.vue`. See "Tagging a security release" below for
the one thing to add to this text when the release is security-urgent.

## The tool: `nettop`, scoped to Umbra's own process

Use `nettop`, macOS's built-in network-activity monitor. It's zero new dependency — a
system binary, not a `Cargo.toml`/`package.json` entry — so the "Dependency
version/API drift" convention in `ARCHITECTURE-SPINE.md` doesn't apply to it. It's also
already proven for exactly this purpose: Story 4.3 used it, ad hoc, to confirm the
Bucket's OCR feature makes zero network calls. This checklist generalizes that one-off
check into a repeatable, all-tools procedure.

**One caveat this procedure can't rule out:** it runs on a single machine under
whatever network conditions that machine happens to have (VPN, corporate proxy,
firewall/DNS filtering). Any of those could silently blackhole a connection that
would succeed on an end user's unfiltered network, turning a real leak into a false
"zero connections" pass. A pass here is strong evidence, not an absolute guarantee —
if you have reason to suspect your network is unusually restrictive, corroborate on a
second, more standard network before relying on the result.

**Don't run a bare, unfiltered `nettop`.** A plain `nettop` on a normal Mac shows a lot
of unrelated background traffic — Spotlight, iCloud, browser tabs, and so on — which
makes "zero outbound connections" impossible to state conclusively without filtering.
Scope the capture to Umbra's own process specifically:

1. Find the running process's PID with `pgrep -x umbra` — **lowercase, always**, for
   both a `pnpm tauri dev` session *and* the installed release app. This isn't a
   dev-vs-release distinction: `tauri.conf.json` sets no `mainBinaryName` override, so
   Tauri names the actual executable inside `Umbra.app/Contents/MacOS/` after the Cargo
   binary target (`src-tauri/Cargo.toml`'s `[package] name = "umbra"`) regardless of
   build type. `productName: "Umbra"` only sets the `.app` bundle's Finder/Dock display
   name and `Info.plist` metadata — it is **not** the string `pgrep -x`/`ps` match
   against. `pgrep -x Umbra` (capitalized) matches nothing, for either build.
   Empirically confirmed against a real, installed, signed `v0.1.2` build during this
   procedure's first live run (Story 5.3) — an earlier draft of this document assumed
   the display name and process name diverged by build type, which turned out to be
   wrong on both counts.
2. Since the process doesn't exist yet before you launch (or relaunch) the app, don't
   `pgrep` once and hope — poll for it in a tight loop so `nettop` attaches within
   milliseconds of the process appearing, otherwise you can miss the update check
   entirely (it fires within the app's first moments on screen). Confirm the app is
   already quit before starting the loop — `pgrep -x umbra` matching before you've
   launched anything means a previous instance is still around; quit it first, or the
   loop will instantly grab its (stale) PID instead of waiting for your fresh launch:
   ```bash
   pgrep -x umbra >/dev/null && { echo "Umbra is already running — quit it first"; exit 1; }
   pid=""
   for _ in $(seq 1 300); do
     candidates=$(pgrep -x umbra)
     [ "$(printf '%s\n' "$candidates" | wc -l)" -eq 1 ] && [ -n "$candidates" ] && { pid="$candidates"; break; }
     sleep 0.1
   done
   [ -n "$pid" ] || { echo "Timed out waiting for umbra to launch"; exit 1; }
   echo "Umbra PID: $pid"
   nettop -p "$pid"
   ```
   The loop times out after 30 seconds rather than spinning forever if the app never
   launches, and only accepts a PID once `pgrep` reports exactly one match — if a
   previous instance failed to fully quit, two matches will keep the loop waiting
   (and eventually time out) instead of silently attaching to the wrong process. A
   stale PID from a previous run (e.g. one you quit and relaunched without restarting
   this loop) produces an empty, silent `nettop` session that looks identical to
   "zero connections" but actually means "watching a process that no longer exists"
   — don't mistake one for the other.

## The exercise list

Run `nettop -p <pid>` and, while it's capturing, exercise every tool currently in the
registry. Check `src/stores/registry.ts` before you start — this list matches it as of
Story 5.3, but a tool may have been added since:

- **JSON** — format, minify, validate (including an intentionally invalid document).
- **Base64** — encode/decode text, and encode/decode a file via drag-and-drop.
- **UUID** — generate v4 and v7, single and bulk.
- **Hash** — hash text and a file, across the supported algorithms.
- **JWT** — decode a token, including one with an expired/invalid claim.
- **Cron** — both directions: cron-expression-to-English, and natural-language-to-cron.
- **Bucket** — drag an image in, paste a screenshot, and extract text — **including the
  very first use of the OCR engine in the running session.** First use is the specific
  moment a forgotten bundled-model reference would surface as an actual download,
  rather than as a bug that shows up somewhere else. Also exercise the PDF section
  (Story 6.1): merge 2+ PDFs, extract a page range, and extract text — a brand-new
  dependency (`lopdf`) the first time it's used in the real app, not just assumed
  network-clean from the `cargo tree` check alone. Also exercise the Image section
  (Story 6.2): convert a PNG to JPEG with a quality change, confirming the live size
  estimate updates as the slider moves.

Also open **Settings** and the **⌘K palette** during the capture. Neither makes any
`invoke`/`fetch` call today (confirmed by reading `SettingsView.vue` and
`CommandPalette.vue` — both are pure local state/search), but the tour should
demonstrate that directly rather than assume it. Re-checking costs nothing.

## What "zero outbound connections" actually means — read this carefully

This is the part most likely to be misread, so it's stated precisely:

**Zero outbound connections during all tool exercise above.** That's the bar every tool
in the list must clear.

**Separately**, the app's automatic update check fires **on launch, without any user
action** (`App.vue`'s `onMounted` hook calls `runCheck()` unconditionally — see
`src/shell/updateSignal.ts`, which wraps `checkForUpdate()` in `src/shell/updateCheck.ts`).
This is the one permitted exception the acceptance
criteria refer to as "the user-confirmed update check" — but "user-confirmed" describes
the *install* step specifically (installation proceeds only after the user explicitly
clicks Install in the update dialog), **not** the check call itself, which is disclosed
(in `README.md` and Settings) rather than consent-gated. Don't fail the tour by
expecting the check itself to wait for a click, and don't count its automatic outbound
connection as a violation — it's the one documented, disclosed exception, not a leak.

## Tagging a security release

The update signal (Story 7.7) shows a red dot and "Security update available" instead
of the routine orange one when a release is security-urgent — but Tauri's `latest.json`
has no native severity field, so there's nothing that flags this automatically. It's a
**manual, human judgment call made when cutting the release**. There is no automated
CVE/vulnerability scan wired into this pipeline, and building one is out of scope here.

Whoever cuts the release prefixes the **annotated tag's own message** — the source of
the release notes, per "Before you tag: write the release notes" above, which flow
through to `latest.json`'s `notes` field and from there to the app's `Update.body`
(`src/shell/updateCheck.ts`) — with a leading, case-insensitive `[security]` tag, e.g.:

```bash
git tag -a v0.1.4 -m "[security] Fixes an issue where..."
```

(Earlier drafts of this section said to edit "the GitHub Release's notes" directly —
that's no longer accurate: `release.yml` sources `releaseBody` from the tag message,
and with `releaseDraft: false` there's no post-publish window to edit it anyway. Fix
landed alongside this correction; see the dated note at the bottom of this file.)

The tag must be the very first thing in the notes (`getUpdateSeverity()` only matches
at the start, deliberately, so an incidental mid-sentence mention of "security" can't
falsely escalate a routine release).

**If it's omitted by mistake, the release is treated as routine** — there's no automatic
fallback detection to catch a missed tag. Getting this right is on the person cutting
the release, the same trust model as the rest of this manual checklist.

## Recording the result

Paste the executed result into the description of that release's version-bump PR
(the `chore(release): bump version to X.Y.Z` pattern — the only PR type this
tag-driven pipeline actually produces per release) before merging it. Record:

- Pass or fail.
- Which tools were exercised.
- Any connections observed, described by **host and purpose only** — e.g. "update
  check → GitHub Releases API." **Never** paste raw `nettop` output verbatim: it can
  contain real local usernames and filesystem paths, which this repo's own privacy rule
  (see `README.md`'s Documentation section and `CLAUDE.md`) treats as personally
  identifying information that must not be committed.

**If the result is a fail:** do not tag or merge the release PR. File a story or bug
capturing what connected and to where, fix it, and re-run this entire procedure from
the top before proceeding — a fail is exactly the outcome this checklist exists to
catch, and catching it must actually stop the release, not just get noted in passing.

**Bootstrap note:** this convention started being followed from Story 5.3's own PR
onward. `v0.1.2`'s release PR (#44) and everything before it merged before this
checklist existed, so their absence of a recorded result isn't a violation of this
convention — it predates it.

## What this deliberately does not do (v1 scope)

No `.github/pull_request_template.md` exists in this repo, and this procedure doesn't
add one. A repo-wide PR template would apply to every PR — features, docs, chores — not
just the two-line version-bump PRs this checklist actually gates. No CI job parses PR
bodies to confirm this checklist ran, and the network capture itself isn't automated.
All three would exceed what the architecture spine commits to for v1: "stays a manual
per-release checklist procedure in v1" (`ARCHITECTURE-SPINE.md`, deferred items). "The
release does not ship without it" is a human discipline backed by a written,
discoverable procedure — not a bot-enforced gate — until a future story decides
otherwise.

---

*Generated 2026-08-09 during Story 5.3's implementation (`bmad-dev-story`), as the
durable, repeatable release-gate procedure NFR1 and AD-12 call for — see
`_bmad-output/implementation-artifacts/5-3-the-privacy-promise-proven-at-every-release.md`
for the story that introduced it.*

*The "Tagging a security release" section was added during Story 7.7's implementation
(2026-08-18), which resolved PRD FR31's then-open marker-syntax and documentation-step
questions — see
`_bmad-output/implementation-artifacts/7-7-the-update-signal-becomes-a-passive-escalation-aware-dot.md`.*

*Corrected 2026-08-19: Story 7.7's "Tagging a security release" section assumed
`release.yml` would carry a human-edited release body through to `latest.json`, but the
workflow's `tauri-action` step actually hardcoded `releaseBody` to a fixed generic
sentence on every release — so no release could ever have shipped a `[security]`
marker, or any real notes at all. "Before you tag: write the release notes" is new;
"Tagging a security release" is corrected in place to point at the tag message, the
now-real source. See `_bmad-output/implementation-artifacts/7-7-the-update-signal-becomes-a-passive-escalation-aware-dot.md`'s
own dated addendum for the full account.*
