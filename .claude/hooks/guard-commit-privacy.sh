#!/usr/bin/env bash
# PreToolUse guard for Bash: blocks `git commit` when the staged diff
# contains a personal home-directory path or a likely secret/credential.
#
# Why this exists: the user's real home-directory absolute path
# (/Users/<name>/...) leaked into a tracked markdown file during BMad
# planning work, ahead of this repo going public as a portfolio piece.
# This hook scans staged changes before every commit so that class of leak,
# and common credential leaks, get caught automatically instead of relying
# on manual review.

set -euo pipefail

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

if [ -z "$command" ]; then
  exit 0
fi

# Only act on git commit invocations (a subcommand, not just a substring
# match, so e.g. `echo "please git commit this"` does not trip it).
if ! printf '%s' "$command" | grep -qE '(^|[;&|]|[[:space:]])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

staged="$(git diff --cached 2>/dev/null || true)"
if [ -z "$staged" ]; then
  exit 0
fi

deny() {
  local reason="$1"
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "$reason"
  }
}
EOF
  exit 0
}

affected_files() {
  printf '%s' "$staged" | grep -E '^\+\+\+ ' | sed 's/^+++ b\///' | sort -u | tr '\n' ' '
}

# 1. This machine's real home-directory path, derived from $HOME (not
#    hardcoded, so the hook stays correct on a different machine/user).
home_escaped="$(printf '%s' "$HOME" | sed 's/[.[\*^$/]/\\&/g')"
if [ -n "$HOME" ] && printf '%s' "$staged" | grep -qE "$home_escaped"; then
  deny "Staged changes contain this machine's home-directory absolute path — that is personal information (reveals a name). Affected file(s): $(affected_files). Remove the absolute path (use a relative path, or drop it) and re-stage before committing."
fi

# 2. Generic macOS/Linux personal-home-path fallback, in case a differently
#    shaped path shows up (e.g. this repo used from another machine/user).
if printf '%s' "$staged" | grep -qE '(^|[^A-Za-z0-9_])(/Users/[A-Za-z0-9_.-]+/|/home/[A-Za-z0-9_.-]+/)'; then
  deny "Staged changes contain what looks like a personal home-directory path. Affected file(s): $(affected_files). Review and remove it before committing."
fi

# 3. Common secret/credential patterns. Best-effort — some false positives
#    are acceptable since this only blocks, it never silently proceeds.
secret_pattern='AKIA[0-9A-Z]{16}|-----BEGIN[A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{36,}|(api[_-]?key|apikey|secret|password|token)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9_/+=]{12,}'
if printf '%s' "$staged" | grep -qiE "$secret_pattern"; then
  deny "Staged changes contain what looks like a secret or credential (API key, private key, or token pattern). Affected file(s): $(affected_files). Remove it — and rotate the credential if it is real — before committing."
fi

exit 0
