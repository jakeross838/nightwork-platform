#!/bin/bash
# Nightwork SessionStart hook — anti-drift edition.
# Loads the full plan + standing rules + current state into every session as additionalContext.
# Fail-graceful: any missing input is skipped silently rather than erroring.
# Pairs with .planning/MASTER-PLAN.md and the nightwork-anti-drift skill.

set +e  # never fail the session start over a missing optional input

[[ "$NIGHTWORK_HOOKS_DISABLE" == "1" ]] && exit 0

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# Identity guard — only fire in nightwork-platform
case "$(pwd)" in
  *nightwork-platform*) ;;
  *) exit 0 ;;
esac

# ---- Section helpers ----------------------------------------------------

emit_section() {
  # $1 = header, $2 = body. Writes nothing if body is empty.
  local header="$1"
  local body="$2"
  [ -z "$body" ] && return 0
  printf '\n## %s\n\n%s\n' "$header" "$body"
}

read_file_safe() {
  # Reads a file if it exists; otherwise emits empty string.
  local path="$1"
  [ -f "$path" ] && cat "$path" 2>/dev/null
}

extract_claude_md_standing_rules() {
  # Pull the "Nightwork standing rules" section from CLAUDE.md (start to end-of-file or next H1/H2 break).
  [ -f CLAUDE.md ] || return 0
  awk '
    /^## Nightwork standing rules$/ { capture=1 }
    capture && /^## / && !/^## Nightwork standing rules$/ {
      # Stop at the next top-level H2 that is not the section we are capturing.
      if (lines > 0) { exit }
    }
    capture { print; lines++ }
  ' CLAUDE.md 2>/dev/null
}

latest_verdict() {
  # $1 = directory under .planning/, $2 = label.
  # Picks the most recent file in that dir, greps for "Overall verdict" and emits the line below it.
  local dir="$1"
  local label="$2"
  local latest
  latest=$(ls -t ".planning/${dir}"/*.md 2>/dev/null | head -1)
  [ -z "$latest" ] && return 0
  local verdict
  verdict=$(grep -A 2 -iE "^## Overall verdict|^## Verdict" "$latest" 2>/dev/null | grep -vE "^--$|verdict$" | tail -1 | sed 's/[*_]//g' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  [ -z "$verdict" ] && verdict="(verdict line not parsed)"
  local age
  local mtime
  mtime=$(stat -c %Y "$latest" 2>/dev/null || stat -f %m "$latest" 2>/dev/null || echo 0)
  age=$(( ( $(date +%s) - mtime ) / 3600 ))
  printf '%s — %s (%dh ago, %s)' "$label" "$verdict" "$age" "$(basename "$latest")"
}

# ---- Build sections -----------------------------------------------------

HEADER="NIGHTWORK SESSION CONTEXT — ALWAYS READ"

MASTER_PLAN=$(read_file_safe ".planning/MASTER-PLAN.md")
STANDING_RULES=$(extract_claude_md_standing_rules)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
LAST_COMMITS=$(git log --oneline -3 2>/dev/null)
UNCOMMITTED=$(git status --short 2>/dev/null)
[ -z "$UNCOMMITTED" ] && UNCOMMITTED="(working tree clean)"

QA_VERDICT=$(latest_verdict "qa-runs" "Last QA")
PLAN_REVIEW_VERDICT=$(latest_verdict "plan-reviews" "Last plan review")
E2E_VERDICT=$(latest_verdict "e2e-runs" "Last E2E test")

FOOTER="If any of the above is missing or stale, ask the user before proceeding with significant work."

# ---- Compose payload ----------------------------------------------------

# Build into a temp file because additionalContext can be large.
PAYLOAD=$(
  printf '# %s\n' "$HEADER"
  emit_section "MASTER PLAN" "$MASTER_PLAN"
  emit_section "STANDING RULES (from CLAUDE.md)" "$STANDING_RULES"
  emit_section "BRANCH" "$GIT_BRANCH"
  emit_section "LAST 3 COMMITS" "$LAST_COMMITS"
  emit_section "UNCOMMITTED CHANGES" "$UNCOMMITTED"

  # Verdicts: combine into one section so the structure is consistent even when individual files are missing.
  VERDICTS=""
  [ -n "$QA_VERDICT" ] && VERDICTS+="$QA_VERDICT"$'\n'
  [ -n "$PLAN_REVIEW_VERDICT" ] && VERDICTS+="$PLAN_REVIEW_VERDICT"$'\n'
  [ -n "$E2E_VERDICT" ] && VERDICTS+="$E2E_VERDICT"$'\n'
  [ -z "$VERDICTS" ] && VERDICTS="(no QA / plan-review / E2E artifacts found yet)"
  emit_section "RECENT VERDICTS" "$VERDICTS"

  printf '\n---\n\n%s\n' "$FOOTER"
)

# ---- Emit as SessionStart additionalContext via JSON -------------------

NW_CTX="$PAYLOAD" node -e "
const ctx = process.env.NW_CTX || '';
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx }
}));
" 2>/dev/null

# If node is unavailable for any reason, fall back to plain text on stdout
# (Claude Code accepts either JSON or text from SessionStart hooks).
if [ $? -ne 0 ]; then
  printf '%s\n' "$PAYLOAD"
fi

exit 0
