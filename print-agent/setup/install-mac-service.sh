#!/usr/bin/env bash
# One-time install: run the Yaya print agent in the background at login (no Terminal for staff).
# Usage: ./install-mac-service.sh
# Run as the warehouse staff user (IT logged in as them), from print-agent/setup/

set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/../" && pwd)"
LABEL="com.yaya.print-agent"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_OUT="$HOME/Library/Logs/yaya-print-agent.log"
LOG_ERR="$HOME/Library/Logs/yaya-print-agent.err.log"
GUI_DOMAIN="gui/$(id -u)"

if [[ ! -f "$AGENT_DIR/package.json" ]]; then
  echo "ERROR: print-agent not found at $AGENT_DIR"
  exit 1
fi

NPM_BIN="$(command -v npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  echo "ERROR: npm not found. Install Node.js 22 LTS first: https://nodejs.org/"
  exit 1
fi

echo "Installing print-agent dependencies (first time only)..."
(cd "$AGENT_DIR" && npm install)

if launchctl print "$GUI_DOMAIN/$LABEL" &>/dev/null; then
  echo "Removing previous background service..."
  launchctl bootout "$GUI_DOMAIN" "$PLIST_PATH" 2>/dev/null || true
fi

mkdir -p "$(dirname "$PLIST_PATH")" "$HOME/Library/Logs"

cat >"$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>WorkingDirectory</key>
  <string>${AGENT_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NPM_BIN}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_OUT}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_ERR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

echo "Starting background print agent..."
launchctl bootstrap "$GUI_DOMAIN" "$PLIST_PATH"

sleep 2

if curl -sf "http://127.0.0.1:17863/v1/health" >/dev/null; then
  echo ""
  echo "========================================"
  echo "  Yaya Print Agent — installed"
  echo "========================================"
  echo ""
  echo "The agent runs automatically at login."
  echo "Staff do not need Terminal."
  echo ""
  echo "Agent:    http://127.0.0.1:17863"
  echo "Logs:     $LOG_OUT"
  echo "Errors:   $LOG_ERR"
  echo ""
  echo "Next: open admin → Settings → Printer → set location → test label."
  echo "Give staff WAREHOUSE-STAFF-MAC.txt"
else
  echo ""
  echo "Service installed but health check failed."
  echo "Check: tail -f $LOG_ERR"
  echo "Common fix: edit $AGENT_DIR/print-agent.config.json (usbPrinterName)"
  exit 1
fi
