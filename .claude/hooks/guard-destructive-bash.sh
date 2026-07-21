#!/usr/bin/env bash
# PreToolUse guard for Bash: blocks directory-wiping commands unless a git
# safety net (clean, committed working tree) already exists.
#
# Why this exists: `pnpm dlx create-tauri-app@latest . -f` was run against
# this project's root while it was NOT a git repo. The --force flag emptied
# the entire directory (instead of just overwriting conflicting files, which
# is what a scratch-dir test had suggested) and destroyed irreplaceable
# planning docs. A git commit taken immediately beforehand would have made
# that a non-event. This hook makes that checkpoint mandatory.

set -euo pipefail

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

if [ -z "$command" ]; then
  exit 0
fi

# Destructive-looking patterns: force/overwrite flags on scaffolding
# generators, and direct bulk-delete commands.
destructive_pattern='(create-[a-zA-Z0-9._-]*-app|degit|cargo-generate|cargo generate)[^&|;]*( -f\b|--force\b|-y -f|-f -y)'
bulk_delete_pattern='(rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)|git[[:space:]]+clean[^&|;]*-f|git[[:space:]]+reset[[:space:]]+--hard|rsync[^&|;]*--delete|find[^&|;]*-delete)'

if ! printf '%s' "$command" | grep -qE "$destructive_pattern|$bulk_delete_pattern"; then
  exit 0
fi

# Command looks destructive. Require a git safety net: inside a work tree,
# with no uncommitted changes (so a mistake is one `git reset --hard`/
# `git checkout` away from undone).
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "This command looks destructive (force/overwrite flag on a scaffolding tool, or a bulk-delete) and the current directory is not a git repository, so there is no safety net. Run 'git init && git add -A && git commit -m \"chore: safety checkpoint\"' first, or test the command in an isolated empty scratch directory before running it here."
  }
}
EOF
  exit 0
fi

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "This command looks destructive (force/overwrite flag on a scaffolding tool, or a bulk-delete) and there are uncommitted changes in this repo. Commit or stash first ('git add -A && git commit') so the command is trivially reversible, or test it in an isolated empty scratch directory instead."
  }
}
EOF
  exit 0
fi

exit 0
