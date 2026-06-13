#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$ROOT/print-agent"

if [[ ! -f "$AGENT_DIR/package.json" ]]; then
  echo "ERROR: print-agent folder not found next to this script."
  echo "Expected: $AGENT_DIR"
  exit 1
fi

if [[ ! -d "$AGENT_DIR/node_modules" ]]; then
  echo "Installing print-agent dependencies..."
  (cd "$AGENT_DIR" && npm install)
fi

echo
echo "========================================"
echo "  Yaya Print Agent"
echo "========================================"
echo
echo "Keep this terminal open while you print."
echo "Admin settings: your store URL > Admin > Settings > Printer"
echo
echo "Listening on http://127.0.0.1:17863"
echo

cd "$AGENT_DIR"
npm start
