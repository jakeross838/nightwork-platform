#!/bin/bash
# Nightwork PostToolUse hook for Write|Edit|MultiEdit
# Scans the just-edited file for Nightwork anti-patterns. BLOCKS on hard violations.
# Hard rejections — hex colors in components, Tailwind named colors, legacy namespaces,
# CREATE TABLE without RLS, hard DELETE / DROP TABLE in migrations.

set -e

[[ "$NIGHTWORK_HOOKS_DISABLE" == "1" ]] && exit 0

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
case "$(pwd)" in
  *nightwork-platform*) ;;
  *) exit 0 ;;
esac

INPUT=$(cat)
FILE=$(node -e "
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(d);
    process.stdout.write(j.tool_input?.file_path || j.tool_input?.path || '');
  } catch { process.stdout.write(''); }
});
" <<< "$INPUT" 2>/dev/null)

[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# Convert backslash to forward slash for matching on Windows
FILE_NORM=$(echo "$FILE" | sed 's|\\|/|g')

# Skip outside-scope files (match both absolute and relative paths)
case "$FILE_NORM" in
  src/* | */src/* | supabase/migrations/* | */supabase/migrations/* )
    ;;
  *) exit 0 ;;
esac

# Skip globals.css and tailwind config — they DEFINE tokens
case "$FILE_NORM" in
  *globals.css | *tailwind.config.* )
    exit 0 ;;
esac

ISSUES_FILE=$(mktemp)
> "$ISSUES_FILE"

# 1. .tsx / .ts / .css — design token violations
if [[ "$FILE_NORM" =~ \.(tsx|ts|css|scss)$ ]]; then
  # Hex colors used as Tailwind class arbitrary values are OK only via var(); pure hex hardcoded → BLOCK
  # Match e.g. style={{ color: '#1A2830' }} or text-[#1A2830] but allow text-[var(--name)]
  HEX_HITS=$(grep -nE "#[0-9a-fA-F]{6}\b" "$FILE" | grep -vE "(globals\.css|tailwind\.config|//|/\*)" | head -3 || true)
  if [ -n "$HEX_HITS" ]; then
    echo "[design-tokens] Hardcoded hex color (use Slate CSS vars / nw-* utilities):" >> "$ISSUES_FILE"
    echo "$HEX_HITS" | head -3 >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # Tailwind named color utilities (block list — Slate palette only)
  NAMED_HITS=$(grep -nE "\b(bg|text|border|ring|fill|stroke|from|to|via|placeholder|caret|accent|outline|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)\b" "$FILE" | head -3 || true)
  if [ -n "$NAMED_HITS" ]; then
    echo "[design-tokens] Tailwind named color (Phase E removed these — use bracket-value with --bg-card / --text-primary or nw-* utilities):" >> "$ISSUES_FILE"
    echo "$NAMED_HITS" | head -3 >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # Pure bg-white / text-black / bg-black / text-white  — Nightwork uses Slate, never pure
  PURE_HITS=$(grep -nE "\b(bg|text|border)-(white|black)\b" "$FILE" | head -3 || true)
  if [ -n "$PURE_HITS" ]; then
    echo "[design-tokens] Pure white/black (Nightwork uses Slate — bg-nw-page, text-nw-slate-tile):" >> "$ISSUES_FILE"
    echo "$PURE_HITS" | head -3 >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # Legacy namespaces removed in Phase E
  LEGACY_HITS=$(grep -nE "\b(bg|text|border)-(cream|teal-(?!.*nw)|brass|brand|status|nightwork)-" "$FILE" 2>/dev/null | head -3 || true)
  if [ -n "$LEGACY_HITS" ]; then
    echo "[design-tokens] Legacy namespace (cream/teal/brass/brand/status/nightwork removed in Phase E):" >> "$ISSUES_FILE"
    echo "$LEGACY_HITS" | head -3 >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi
fi

# 2. SQL migrations — RLS, soft-delete, drops
if [[ "$FILE_NORM" =~ supabase/migrations/.*\.sql$ ]]; then
  # CREATE TABLE without ENABLE ROW LEVEL SECURITY in the same file
  if grep -iqE "CREATE TABLE\s+(IF NOT EXISTS\s+)?[a-zA-Z_]" "$FILE" && ! grep -iq "ENABLE ROW LEVEL SECURITY" "$FILE"; then
    echo "[rls-auditor] Migration creates a table without ENABLE ROW LEVEL SECURITY. Add ALTER TABLE … ENABLE ROW LEVEL SECURITY + at least one CREATE POLICY in the same migration." >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # Hard DELETE FROM (allow inside comments)
  DELETE_HITS=$(grep -niE "^[^-]*\bDELETE FROM\b" "$FILE" | head -3 || true)
  if [ -n "$DELETE_HITS" ]; then
    echo "[migration-safety] Hard DELETE FROM. Nightwork uses soft-delete: UPDATE … SET deleted_at = now()." >> "$ISSUES_FILE"
    echo "$DELETE_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # DROP TABLE — block by default, allow only with explicit comment
  DROP_HITS=$(grep -niE "^[^-]*\bDROP TABLE\b" "$FILE" | head -3 || true)
  if [ -n "$DROP_HITS" ] && ! grep -iq "-- nightwork: drop-justified" "$FILE"; then
    echo "[migration-safety] DROP TABLE without justification. Add '-- nightwork: drop-justified — <reason>' comment if intentional." >> "$ISSUES_FILE"
    echo "$DROP_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # TRUNCATE
  TRUNC_HITS=$(grep -niE "^[^-]*\bTRUNCATE\b" "$FILE" | head -3 || true)
  if [ -n "$TRUNC_HITS" ]; then
    echo "[migration-safety] TRUNCATE — destroys data, never allowed in tenant tables." >> "$ISSUES_FILE"
    echo "$TRUNC_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi
fi

# 3. Hardcoded ORG_ID outside the seed-template path
if [[ "$FILE_NORM" =~ \.(ts|tsx)$ ]] && [[ ! "$FILE_NORM" =~ cost-codes/template/ ]]; then
  ORG_ID_HITS=$(grep -nE "(const|let|var)\s+ORG_ID\s*=" "$FILE" | head -3 || true)
  if [ -n "$ORG_ID_HITS" ]; then
    echo "[rls-auditor] Hardcoded ORG_ID found. Only TEMPLATE_ORG_ID in cost-codes/template/route.ts is allowed. Use getCurrentMembership().org_id." >> "$ISSUES_FILE"
    echo "$ORG_ID_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi
fi

# Block if any issues were found
if [ -s "$ISSUES_FILE" ]; then
  REASON=$(cat "$ISSUES_FILE")
  rm -f "$ISSUES_FILE"
  NW_REASON="$REASON" node -e "
  const reason = process.env.NW_REASON || '';
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: '[nightwork-post-edit] ' + reason + '\\nFix or justify (legitimate exceptions are rare). Use /nightwork-design-check or /nightwork-qa for full review. Set NIGHTWORK_HOOKS_DISABLE=1 only as a last resort.'
  }));
  " 2>/dev/null
  exit 2
fi

rm -f "$ISSUES_FILE"
exit 0
