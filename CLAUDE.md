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
- **Concrete examples of what counts as personally-identifying** (this list exists
  because `guard-commit-privacy.sh` can pattern-match a filesystem path but has no way
  to regex-detect "is this string a person's name" — the written rule here is the
  actual front-line defense for everything below except the path case):
  - A real full legal name, in any context — prose, a code comment, a `git config`
    value quoted in a doc, a certificate/identity string (e.g. `"Developer ID
    Application: <Your Name> (<Team ID>)"`).
  - A real email address, personal or work.
  - A real phone number.
  - An exact employer, client, or company name tied to the developer (as opposed to
    a public dependency/vendor name, which is fine).
  - A physical or mailing address.
  - An account ID, customer ID, or subscription ID that could identify a specific
    person or deanonymize them in combination with other public info.
  - A literal home-directory path fragment even without a trailing slash after the
    username (`/Users/<name>` alone, with no further subpath, still reveals a name —
    a confirmed gap in the hook's older regex, fixed in `guard-commit-privacy.sh`
    2026-08-10, but the written rule doesn't depend on the hook catching it).
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

## Process: new shared infrastructure doesn't inherit this project's governance automatically

Story 5.4 stood up a second public repository (`umbra-web`, the landing page) and it
shipped with neither a LICENSE file nor branch protection on `main` — even though
`Umbra` itself has had both since Story 1.1 ("A governed public repository"). The
stack/hosting decision (Astro, a separate repo, Vercel) was reasoned through
carefully, but was presented as already-decided rather than as options weighed
with the developer first. Neither gap was a deliberate scope call; both happened
because nothing re-triggered the check. Flagged at the Epic 5 retrospective
(2026-08-10) — see `_bmad-output/implementation-artifacts/epic-5-retro-2026-08-10.md`.

- **Any story whose scope includes creating new shared infrastructure** — a new
  repository, a new deployment target, a new external service account/project (e.g.
  a hosting platform, an analytics provider) — must do two things before executing,
  not after:
  1. **Present the resulting architecture/tooling choice as options with trade-offs**
     for the developer to weigh in on, even when one option is clearly better. A
     well-reasoned decision made *for* the developer is still a decision they were
     left out of.
  2. **Explicitly check this project's own established governance patterns** —
     branch protection, a LICENSE file, CI gates, the scoped Conventional Commits
     convention (`type(scope): subject`, matching `Umbra`'s own history) — and either
     apply them to the new infrastructure or record a deliberate reason not to.
     "We've solved this before" only helps if something actually re-applies it;
     don't assume a pattern travels with the project by default.
