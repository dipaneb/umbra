# Umbra — project instructions

## Safety: git checkpoint before destructive-capable commands

This project was hit by real data loss: `pnpm dlx create-tauri-app@latest . -f`
was run against the repo root (not yet a git repo at the time) to scaffold the
app. Testing the same command in an *empty* scratch directory had made
`--force` look like "overwrite conflicting files," but against a non-empty
directory it actually **emptied the directory first**, destroying `_bmad/`,
`_bmad-output/` (PRD, architecture docs, all story files), and `docs/` before
scaffolding fresh.

A `.claude/hooks/guard-destructive-bash.sh` PreToolUse hook now blocks
pattern-matched destructive commands (force flags on scaffolding CLIs,
`rm -rf`, `git clean -f`, `git reset --hard`, `rsync --delete`, `find -delete`)
unless the working tree is a git repo with no uncommitted changes. But the
hook is a pattern match, not a guarantee — it can miss variants. So as a
standing rule, independent of the hook:

- **Before running any command whose semantics you haven't fully verified
  against a non-empty target — especially generators/scaffolders, and
  especially their force/overwrite flags — commit first.** `git add -A && git
  commit` (or `git init` if this isn't yet a repo) so the operation is a
  `git reset`/`git checkout` away from undone.
- **Testing a command in an empty scratch directory does not prove it is safe
  against a directory with existing content.** Many tools branch on "empty vs.
  non-empty target" (merge in one case, wipe-and-recreate in the other). If a
  command has an overwrite/force flag, assume it may wipe first unless the
  tool's docs say otherwise.
- This applies generally, not just to `create-tauri-app` — the same caution
  covers `degit`, `cargo generate`, `rsync --delete`, `git clean -f`, mass
  `rm`, and any other codegen/scaffolding tool run in this repo.
