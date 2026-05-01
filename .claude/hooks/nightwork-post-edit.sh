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

# Stage 1.5a — T10a (existing token enforcement covers src/components/ui/)
# The path filters above (src/* | */src/*) already include src/components/ui/.
# The .tsx/.ts/.css block (block 1) already applies. T10a is satisfied
# implicitly — no separate code needed; document for clarity.

# Stage 1.5a — T10b: Forbidden-list enforcement (per SPEC A2.1 / D5.1).
# Quantified violation criteria for tokens / motion / shadow / typography
# that are universally banned by SPEC A2.1, regardless of token wrapper.
# Hooks reject .tsx / .ts / .css edits that introduce any of:
#
#   - cubic-bezier with 4th arg >= 1.0   (bouncy easing — overshoot)
#   - cubic-bezier with 2nd arg >= 1.0   (bouncy easing — early-spring)
#   - rounded-{lg,xl,2xl,3xl,full} on non-avatar/dot files (oversized)
#   - box-shadow with blur > 20px AND non-zero spread (dark glow)
#   - HSL hue ∈ [270°, 320°]              (purple/pink — Notion/Slack-adjacent)
if [[ "$FILE_NORM" =~ \.(tsx|ts|css|scss)$ ]]; then
  # 4th arg ≥ 1.0 in cubic-bezier — explicit bounce overshoot
  CB4_HITS=$(grep -nE "cubic-bezier\([^)]*,[^)]*,[^)]*,\s*[1-9]\.[0-9]" "$FILE" | head -3 || true)
  if [ -n "$CB4_HITS" ]; then
    echo "[forbidden-A2.1] Bouncy easing — cubic-bezier 4th arg >= 1.0 (overshoot/elastic forbidden per SPEC A2.1):" >> "$ISSUES_FILE"
    echo "$CB4_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # 2nd arg ≥ 1.0 in cubic-bezier — early-spring overshoot
  CB2_HITS=$(grep -nE "cubic-bezier\([^,]+,\s*[1-9]\.[0-9]" "$FILE" | head -3 || true)
  if [ -n "$CB2_HITS" ]; then
    echo "[forbidden-A2.1] Bouncy easing — cubic-bezier 2nd arg >= 1.0 (forbidden per SPEC A2.1):" >> "$ISSUES_FILE"
    echo "$CB2_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # Oversized rounded — exempt avatar/dot files (filename hints)
  case "$FILE_NORM" in
    *avatar* | *Avatar* | *status-dot* | *StatusDot* | *radius-dot* )
      ;; # avatar/dot exception per SPEC A2.1 (--radius-dot: 999px)
    *)
      ROUNDED_HITS=$(grep -nE "\brounded(-(t|r|b|l|tl|tr|bl|br|ts|te|bs|be|s|e))?-(lg|xl|2xl|3xl|full)\b" "$FILE" | head -3 || true)
      if [ -n "$ROUNDED_HITS" ]; then
        echo "[forbidden-A2.1] Oversized rounded corners — rounded-{,t,r,b,l,…}-{lg,xl,2xl,3xl,full} forbidden on rectangular elements (border-radius > 4px per SPEC A2.1; avatars/dots use --radius-dot: 999px exception):" >> "$ISSUES_FILE"
        echo "$ROUNDED_HITS" >> "$ISSUES_FILE"
        echo "" >> "$ISSUES_FILE"
      fi
      ;;
  esac

  # Dark glow — box-shadow with blur > 20px AND spread > 0
  # Match: box-shadow: <Xoffset> <Yoffset> <blur≥21px> <spread≥1px>
  SHADOW_HITS=$(grep -nE "box-shadow:\s*[^;]*\s+(2[1-9]|[3-9][0-9]|[1-9][0-9]{2,})px\s+[1-9][0-9]*px" "$FILE" | head -3 || true)
  if [ -n "$SHADOW_HITS" ]; then
    echo "[forbidden-A2.1] Dark glow — box-shadow with blur > 20px AND spread > 0 (forbidden per SPEC A2.1):" >> "$ISSUES_FILE"
    echo "$SHADOW_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # Purple/pink — HSL hue ∈ [270°, 320°]
  PURPLE_HITS=$(grep -nE "hsl\(\s*(2[7-9][0-9]|3[01][0-9]|320)\b" "$FILE" | head -3 || true)
  if [ -n "$PURPLE_HITS" ]; then
    echo "[forbidden-A2.1] Purple/pink HSL hue (270°-320° forbidden per SPEC A2.1 — anti-Notion/anti-Slack palette posture):" >> "$ISSUES_FILE"
    echo "$PURPLE_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi
fi

# Stage 1.5a — T10c: Sample-data isolation in /design-system/ (per SPEC C6 / D9).
# Files under src/app/design-system/ MUST NOT import from tenant-scoped
# modules. They may import TYPES from @/lib/supabase/types/* (type-only).
# Per CR2 / R10 mitigation — distinguish path-segment patterns.
#
# Note: grep -P (PCRE lookaheads) is unavailable in some Windows Git Bash
# locales, so we do this in two passes — find all `from '@/lib/(supabase|
# org|auth)…'` imports, then awk-filter out the allowed type-only paths.
if [[ "$FILE_NORM" =~ ^(.*/)?src/app/design-system/.*\.(tsx|ts|jsx|js)$ ]]; then
  # First pass: capture every import-from line that targets supabase/org/auth.
  # Allowed forms (DO NOT REJECT):
  #   from '@/lib/supabase/types'
  #   from '@/lib/supabase/types/<anything>'
  # Forbidden forms (REJECT):
  #   from '@/lib/supabase'                 (bare module — per planner NEW-M3)
  #   from '@/lib/supabase/server'
  #   from '@/lib/supabase/<anything-else>'
  #   from '@/lib/org/<anything>'
  #   from '@/lib/auth/<anything>'
  ALL_IMPORTS=$(grep -nE "from\s+['\"]@/lib/(supabase|org|auth)([/'\"])" "$FILE" 2>/dev/null || true)
  if [ -n "$ALL_IMPORTS" ]; then
    # Filter out allowed type-only paths. Lines that pass through the awk
    # filter are forbidden imports.
    SAMPLE_HITS=$(echo "$ALL_IMPORTS" | awk '
      # Skip if the match is `@/lib/supabase/types`-something. We allow
      # `@/lib/supabase/types` and `@/lib/supabase/types/<rest>`.
      /from[[:space:]]+['\''"]@\/lib\/supabase\/types(['\''"]|\/)/ { next }
      # Anything else that matched the broader regex is forbidden.
      { print }
    ' | head -3)
    if [ -n "$SAMPLE_HITS" ]; then
      echo "[design-system-isolation] Sample data in /design-system/ MUST come from constants in src/app/design-system/_fixtures/ — never tenant-scoped modules. Type-only imports from '@/lib/supabase/types' (and subpaths) are allowed; module imports from '@/lib/supabase/server', '@/lib/supabase' (bare), '@/lib/org/*', '@/lib/auth/*' are forbidden (per SPEC C6 / D9):" >> "$ISSUES_FILE"
      echo "$SAMPLE_HITS" >> "$ISSUES_FILE"
      echo "" >> "$ISSUES_FILE"
    fi
  fi
fi

# Stage 1.5a — T10d: Tenant-blind primitives in src/components/ui/ (per SPEC C8 / A12.1).
# Primitives in src/components/ui/ MUST NOT accept tenant-identifying
# props. Tenant-aware composition lives in src/components/<domain>/ only.
# Per H6 / A12.1.
if [[ "$FILE_NORM" =~ ^(.*/)?src/components/ui/.*\.(tsx|ts|jsx|js)$ ]]; then
  # Match prop-name appearances in TypeScript prop signatures:
  #   org_id?: string
  #   orgId: string
  #   membership: Membership
  #   vendor_id: string
  #   membershipId?: number
  # The shape `WORD\s*[?:]\s*` catches both required and optional props. We
  # also catch destructured prop usage like `{ org_id, ... }` (top of function
  # signature) by allowing comma/{ as left context.
  TENANT_HITS=$(grep -nE "\b(org_id|membership|vendor_id|orgId|membershipId)(\?)?\s*:" "$FILE" | head -3 || true)
  if [ -n "$TENANT_HITS" ]; then
    echo "[tenant-blind-primitives] Primitives in src/components/ui/ MUST be tenant-blind — no org_id/membership/vendor_id/orgId/membershipId props. Tenant-aware composition lives in src/components/<domain>/ only (per SPEC C8 / A12.1):" >> "$ISSUES_FILE"
    echo "$TENANT_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi
fi

# nwrp19 — T-nwrp19a + T-nwrp19b: Wordmark integrity (per BRANDING.md §3, §6).
#
# Best-effort enforcement; false positives are avoided by being conservative.
# Two checks:
#   a) <NwWordmark size={N}> with N outside the documented allow-list
#      {80, 110, 140, 180, 200, 220, 240}.
#   b) <NwWordmark> followed within 200 chars by a hex color override
#      (style={{color:"#..."}} / style={{fill:"#..."}} / className="text-[#...]").
#
# Both checks run on .tsx files only (the wordmark is a React component).
if [[ "$FILE_NORM" =~ \.tsx$ ]]; then
  # (a) Size attribute literal-only match. Pattern: `<NwWordmark` followed
  # within ~80 chars by `size={N}` where N is a numeric literal. Allow-list
  # is exhaustive — anything else rejects. We deliberately skip cases where
  # `size` is a JS expression (e.g., `size={someVar}`) because we can't
  # statically verify those — false negatives acceptable per nwrp19.
  WM_SIZE_HITS=$(grep -nE "<NwWordmark[^>]*\bsize=\{[0-9]+\}" "$FILE" | \
    grep -vE "size=\{(80|110|140|180|200|220|240)\}" | head -3 || true)
  if [ -n "$WM_SIZE_HITS" ]; then
    echo "[branding-nwrp19a] <NwWordmark size={N}> with N outside the documented allow-list {80, 110, 140, 180, 200, 220, 240} (per BRANDING.md §3 sizing system):" >> "$ISSUES_FILE"
    echo "$WM_SIZE_HITS" >> "$ISSUES_FILE"
    echo "" >> "$ISSUES_FILE"
  fi

  # (b) Hex color override on a wordmark instance. Use awk to extract a window
  # following each <NwWordmark line and check for hex color tokens within ~10
  # lines. This is conservative — only flags hex inside style/className that's
  # close to the component instance.
  WM_HEX_HITS=$(awk '
    /<NwWordmark/ {
      win=10; nr=NR
      buf=$0
      next
    }
    win > 0 {
      buf = buf "\n" $0
      win--
      if (win == 0) {
        if (match(buf, /(style=\{\{[^}]*(color|fill)[^}]*#[0-9a-fA-F]{6}|text-\[#[0-9a-fA-F]{6}\]|fill-\[#[0-9a-fA-F]{6}\])/)) {
          print nr ": " substr(buf, RSTART, RLENGTH)
        }
        buf=""
      }
    }
  ' "$FILE" | head -3)
  if [ -n "$WM_HEX_HITS" ]; then
    echo "[branding-nwrp19b] Wordmark color override via hex literal forbidden — use the NwWordmark color prop ('auto' | 'inverse' | 'brand') or token-driven CSS vars (per BRANDING.md §6 Forbidden treatments):" >> "$ISSUES_FILE"
    echo "$WM_HEX_HITS" >> "$ISSUES_FILE"
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
