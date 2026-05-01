#!/bin/bash
# Nightwork PreToolUse hook for Bash (git commit detection)
# Block git commit unless a fresh /nightwork-qa report exists with non-BLOCKING verdict.
# --no-verify bypasses (per Claude Code Bash hook conventions, surfaces user intent).
# Set NIGHTWORK_PRECOMMIT_DISABLE=1 to disable entirely.

set -e

[[ "$NIGHTWORK_HOOKS_DISABLE" == "1" ]] && exit 0
[[ "$NIGHTWORK_PRECOMMIT_DISABLE" == "1" ]] && exit 0

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
case "$(pwd)" in
  *nightwork-platform*) ;;
  *) exit 0 ;;
esac

INPUT=$(cat)
CMD=$(node -e "
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try { process.stdout.write(JSON.parse(d).tool_input?.command || ''); }
  catch { process.stdout.write(''); }
});
" <<< "$INPUT" 2>/dev/null)

# Only check git commit
if [[ ! "$CMD" =~ ^(git[[:space:]]+commit) ]]; then
  exit 0
fi

# Allow --no-verify (user explicitly bypassed)
if [[ "$CMD" =~ --no-verify ]]; then
  exit 0
fi

# Allow merge commits (no QA expected on merges)
if [[ "$CMD" =~ \ -m\ .*Merge ]] || [[ "$CMD" =~ \ -m\ .*merge ]]; then
  exit 0
fi

# Allow .planning/-only and docs/-only commits (no source change → no QA needed)
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if [ -n "$STAGED" ]; then
  NON_PLANNING=$(echo "$STAGED" | grep -vE "^(\.planning/|docs/|README|CHANGELOG|\.gitignore)" || true)
  if [ -z "$NON_PLANNING" ]; then
    exit 0
  fi
fi

# Find latest QA report
LATEST_QA=$(ls -t .planning/qa-runs/*-qa-report.md 2>/dev/null | head -1 || true)

if [ -z "$LATEST_QA" ]; then
  REASON="[nightwork-pre-commit] No /nightwork-qa report found in .planning/qa-runs/.

The repo is configured to require QA review before commits to source files.

Options:
  • Run /nightwork-qa first, then re-commit
  • Pass --no-verify to bypass (use sparingly)
  • Set NIGHTWORK_PRECOMMIT_DISABLE=1 to disable this hook"
  NW_REASON="$REASON" node -e "
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: process.env.NW_REASON || ''
  }));
  " 2>/dev/null
  exit 2
fi

# Check freshness — within 60 minutes
NOW=$(date +%s)
QA_TIME=$(stat -c %Y "$LATEST_QA" 2>/dev/null || stat -f %m "$LATEST_QA" 2>/dev/null || echo "$NOW")
AGE=$((NOW - QA_TIME))

if [ "$AGE" -gt 3600 ]; then
  AGE_MIN=$((AGE / 60))
  REASON="[nightwork-pre-commit] Latest /nightwork-qa report is ${AGE_MIN} minutes old (>60). Recent code may not be covered.

  • Run /nightwork-qa to refresh
  • Or pass --no-verify if you've manually verified the latest changes"
  NW_REASON="$REASON" node -e "
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: process.env.NW_REASON || ''
  }));
  " 2>/dev/null
  exit 2
fi

# Check verdict — extract just the leading verdict token, not prose.
# Reports look like:
#   ## Overall verdict
#
#   **WARNING (down from WARNING with HIGH)** — no BLOCKING / CRITICAL / HIGH findings remain.
# Older format also accepted: a single bolded token ("**BLOCKING**").
# We only match BLOCKING when it is the leading **TOKEN** (or a bare leading
# token), never when it appears in surrounding prose.
VERDICT_LINE=$(awk '/^## Overall verdict/{flag=1;next} flag && NF{print;exit}' "$LATEST_QA" 2>/dev/null || true)
# Pull leading **TOKEN** (bolded) or first ALL-CAPS word.
LEADING_VERDICT=$(echo "$VERDICT_LINE" | sed -nE 's/^[[:space:]]*\*\*([A-Z]+).*/\1/p')
if [ -z "$LEADING_VERDICT" ]; then
  LEADING_VERDICT=$(echo "$VERDICT_LINE" | sed -nE 's/^[[:space:]]*([A-Z]+).*/\1/p')
fi

if [ "$LEADING_VERDICT" = "BLOCKING" ]; then
  REASON="[nightwork-pre-commit] Latest /nightwork-qa verdict is BLOCKING.

Report: $LATEST_QA

Address the blocking findings, re-run /nightwork-qa, then re-commit. Pass --no-verify only if you've verified the blockers no longer apply."
  NW_REASON="$REASON" node -e "
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: process.env.NW_REASON || ''
  }));
  " 2>/dev/null
  exit 2
fi

exit 0
