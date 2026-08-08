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

## Safety: this repo is public — never commit real personal information

This project was hit by a second, different kind of incident: a session wrote a
document containing the developer's real full legal name and a literal local
filesystem path (`/Users/<real-username>/...`, which is itself a form of PII —
it reveals a real name/username) into tracked files, then committed and pushed
both to the public remote **without asking first**, in the same turn the files
were written. `.claude/hooks/guard-commit-privacy.sh` (a `PreToolUse` hook on
`git commit`) exists specifically to catch this — but a hook is a backstop, not
a substitute for not making the mistake in the first place, the same relationship
the destructive-command hook above has to the standing rule around it.

- **Never write a real full name, a literal `/Users/<name>/...` or `/home/<name>/...`
  path, or any other personally-identifying detail into a file this session is about
  to commit.** Use placeholders (`<Your Name>`, `~/wherever-you-keep-it/`, `<Team ID>`)
  instead — this applies to documentation, code comments, commit messages, and story
  files alike, not just obviously-public-facing content. This repo is a public
  portfolio piece; assume anything committed will be read by a stranger.
- **Committing and pushing are separate authorizations.** A prior approval to push
  one specific commit does not carry forward to the next one — confirm again before
  every `git push`, and separately confirm before creating any *new* file under
  version control that the user hasn't explicitly asked to have committed, even if
  it's clearly useful. "Write this for me" is not "commit this," and "commit this"
  is not "push this."
- If personal information does make it into a commit, fixing the current file
  content is necessary but not sufficient — the original values remain in git
  history until that history is rewritten, which requires a force-push. Flag this
  explicitly rather than letting a forward-fix read as if the leak were fully
  undone; do not force-push without the user's explicit, specific request to do so.
