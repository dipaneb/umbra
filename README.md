# Umbra

A privacy-first developer toolbox for macOS — your data never leaves your machine.

Built with Rust, Tauri, and Vue.

## Privacy

Umbra makes zero network calls except one, explicitly disclosed: the automatic check
for app updates. Installing an update always requires your explicit confirmation
first — nothing installs silently. There is no telemetry anywhere in the app.

## How this was planned: BMad Method

The `_bmad/`, `_bmad-output/`, and `.claude/` directories in this repo are the
[BMad Method](https://github.com/bmad-code-org/BMAD-METHOD), a structured
workflow for planning software with an AI agent instead of ad hoc prompting.
It breaks the process into distinct phases — product brief, PRD, architecture
spine, epics, and stories — each with its own reviewable output, rather than
one long unstructured chat.

I ran this project's entire planning phase solo through BMad before writing
any application code: `_bmad-output/planning-artifacts/` holds the product
requirements and architecture decisions, and `_bmad-output/implementation-artifacts/`
holds the resulting story files that drive development one at a time.
`.claude/skills/` and `_bmad/` are the BMad Method installation itself —
the actual skills and scripts that produced those documents, included so
the process is reproducible, not just its output.

Development (the code in `src/`, `src-tauri/`, etc.) follows in later commits.

## Documentation

`docs/` holds standalone reference documentation meant to outlive any single story or
PR — for example release/signing setup notes written for future recall, not just
implementation history. It's distinct from `_bmad-output/`, which records the planning
and story-by-story development process itself.

Anything written there must never include real personal information (full names, local
filesystem paths revealing a username, etc.) — this repo is public. Use placeholders
and generic examples instead; see `.claude/hooks/guard-commit-privacy.sh` for the
automated guard against this.

## Backlog

Beyond the epics already shipped, a public backlog of candidate features and
improvements is tracked as
[GitHub Issues labeled `backlog-candidate`](https://github.com/dipaneb/umbra/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog-candidate).
These are candidates, not commitments — the plan is to pick up one small
tool or improvement roughly every week or two from September 2026 through
March 2027.
