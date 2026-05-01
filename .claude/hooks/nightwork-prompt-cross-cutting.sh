#!/bin/bash
# Nightwork UserPromptSubmit hook
# Detects cross-cutting language ("everywhere," "all," "make X match Y," "every," etc.)
# and suggests /nightwork-propagate. Non-blocking; additive context only.

set -e

[[ "$NIGHTWORK_HOOKS_DISABLE" == "1" ]] && exit 0

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
case "$(pwd)" in
  *nightwork-platform*) ;;
  *) exit 0 ;;
esac

INPUT=$(cat)
PROMPT=$(node -e "
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try { process.stdout.write(JSON.parse(d).prompt || ''); }
  catch { process.stdout.write(''); }
});
" <<< "$INPUT" 2>/dev/null)

[ -z "$PROMPT" ] && exit 0

# Bail on slash commands — they have their own routing
case "$PROMPT" in
  /*) exit 0 ;;
esac

# Cross-cutting trigger words — case-insensitive
LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

CROSS_CUTTING=0
for pattern in \
  "everywhere" \
  " every page" " every screen" " every component" " every file" " every route" \
  " all pages" " all screens" " all components" " all files" " all routes" " all the " \
  "across the (codebase|app|repo|project)" \
  "cross-cutting" \
  "globally" "repo-wide" "project-wide" "site-wide" \
  "make .* match" "make all " "make every " \
  "sync all" "update all" "rename all" "replace all" "consistent across"; do
  if echo "$LOWER" | grep -qE "$pattern"; then
    CROSS_CUTTING=1
    break
  fi
done

[ "$CROSS_CUTTING" = "0" ] && exit 0

REASON="[nightwork] This sounds cross-cutting. STRONG recommendation: /nightwork-propagate \"<change description>\" — it builds a blast-radius report, plans atomic chunks, runs /nightwork-qa between each, and produces rollback steps. Doing it ad-hoc usually misses pattern dependencies and creates subtle drift."

NW_REASON="$REASON" node -e "
const r = process.env.NW_REASON || '';
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: r }
}));
" 2>/dev/null || echo "$REASON"

exit 0
