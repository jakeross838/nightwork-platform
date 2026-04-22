#!/usr/bin/env bash
# Ross Command Center — dev server launcher.
# Usage: bash scripts/dev.sh
#
# Refuses to start if port 3000 is already in use. A previous version of this
# script auto-killed the listening PID, which violated R.1 in the Nightwork
# rebuild plan (see docs/nightwork-rebuild-plan.md — R.1 and R.20). That
# auto-kill is gone. Resolve port conflicts manually.

PORT=3000

echo "→ Checking port $PORT..."

if command -v netstat &>/dev/null; then
  PIDS=$(netstat -ano 2>/dev/null | grep ":${PORT}.*LISTENING" | awk '{print $5}' | sort -u)
  if [ -n "$PIDS" ]; then
    echo "ERROR: port $PORT is already in use (PID(s): $PIDS)." >&2
    echo "Refusing to auto-kill — that would violate R.1." >&2
    echo "Resolve manually before re-running:" >&2
    echo "  - Stop the existing dev server from the terminal that owns it." >&2
    echo "  - Or start this one on a different port: npx next dev -p 3001" >&2
    exit 1
  fi
fi

echo "→ Starting Next.js dev server..."
npx next dev -p $PORT
