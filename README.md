# Umbra

A privacy-first developer toolbox for macOS — your data never leaves your machine.

Built with Rust, Tauri, and Vue.

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
