#!/bin/bash
# Nightwork Stop hook
# Before signaling "done," ensure: typecheck passes, lint passes, no console.log in changed
# files, all changed files committed or staged. BLOCK if any fail.
# Lightweight when nothing changed; expensive otherwise (typecheck + lint).

set -e

[[ "$NIGHTWORK_HOOKS_DISABLE" == "1" ]] && exit 0
[[ "$NIGHTWORK_STOP_HOOK_DISABLE" == "1" ]] && exit 0

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
case "$(pwd)" in
  *nightwork-platform*) ;;
  *) exit 0 ;;
esac

# If nothing changed in src/ or supabase/, exit fast
CHANGED=$(git diff --name-only HEAD 2>/dev/null | grep -E "^(src/|supabase/migrations/)" || true)
if [ -z "$CHANGED" ]; then
  exit 0
fi

ISSUES_FILE=$(mktemp)
> "$ISSUES_FILE"

# 1. Typecheck — only if .ts/.tsx changed
if echo "$CHANGED" | grep -qE "\.(ts|tsx)$"; then
  if ! TC_OUT=$(npx tsc --noEmit 2>&1); then
    echo "[typecheck] FAILED" >> "$ISSUES_FILE"
    echo "$TC_OUT" | tail -10 >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi
fi

# 2. Lint — only if .ts/.tsx changed
if echo "$CHANGED" | grep -qE "\.(ts|tsx)$"; then
  if ! LINT_OUT=$(npm run lint 2>&1); then
    echo "[lint] FAILED" >> "$ISSUES_FILE"
    echo "$LINT_OUT" | tail -10 >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi
fi

# 3. console.log / console.debug in changed .ts/.tsx files
for f in $CHANGED; do
  if [[ "$f" =~ \.(ts|tsx)$ ]] && [ -f "$f" ]; then
    HITS=$(grep -nE "console\.(log|debug|info)" "$f" 2>/dev/null | grep -vE "// (allow-console|nightwork: console-allowed)" | head -3 || true)
    if [ -n "$HITS" ]; then
      echo "[no-console] $f contains console.log/debug/info:" >> "$ISSUES_FILE"
      echo "$HITS" >> "$ISSUES_FILE"
      echo "(add '// nightwork: console-allowed — <reason>' to justify, or remove)" >> "$ISSUES_FILE"
      echo "" >> "$ISSUES_FILE"
    fi
  fi
done

# 4. All changed files committed or staged
UNCOMMITTED=$(git status --short 2>/dev/null | grep -E "^( M|MM|\?\?)" | grep -E " (src/|supabase/migrations/)" | head -5 || true)
if [ -n "$UNCOMMITTED" ]; then
  echo "[dirty-tree] Uncommitted/unstaged changes in src/ or supabase/migrations/:" >> "$ISSUES_FILE"
  echo "$UNCOMMITTED" >> "$ISSUES_FILE"
  echo "(stage or commit before signaling done; or pass NIGHTWORK_STOP_HOOK_DISABLE=1)" >> "$ISSUES_FILE"
  echo "" >> "$ISSUES_FILE"
fi

# Block if any issues
if [ -s "$ISSUES_FILE" ]; then
  REASON=$(cat "$ISSUES_FILE")
  rm -f "$ISSUES_FILE"
  NW_REASON="$REASON" node -e "
  const reason = process.env.NW_REASON || '';
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: '[nightwork-stop] Cannot signal done — issues remain:\\n' + reason
  }));
  " 2>/dev/null
  exit 2
fi

rm -f "$ISSUES_FILE"
exit 0
