#!/usr/bin/env bash
# Ross Command Center — dev server launcher
# Properly kills any zombie Next.js processes on Windows before starting.
# Usage: bash scripts/dev.sh

PORT=3000

echo "→ Checking port $PORT..."

# Find and kill ANY process listening on the port (Windows netstat + taskkill)
if command -v netstat &>/dev/null; then
  PIDS=$(netstat -ano 2>/dev/null | grep ":${PORT}.*LISTENING" | awk '{print $5}' | sort -u)
  if [ -n "$PIDS" ]; then
    for PID in $PIDS; do
      echo "  Killing PID $PID on port $PORT"
      taskkill //PID "$PID" //F 2>/dev/null || kill -9 "$PID" 2>/dev/null
    done
    sleep 1
  fi
fi

# Also try pkill as fallback (works on Mac/Linux)
pkill -f "next dev" 2>/dev/null
pkill -f "start-server" 2>/dev/null

echo "→ Starting Next.js dev server..."
npx next dev -p $PORT
