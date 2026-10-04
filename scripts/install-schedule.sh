#!/bin/bash
# Installs a per-user launchd job that runs the digest weekly.
#   ./scripts/install-schedule.sh            # Sundays at 9:00
#   ./scripts/install-schedule.sh 1 8        # Mondays at 8:00 (0=Sun … 6=Sat)
# If the Mac is asleep at that time, launchd runs it when it wakes.
set -euo pipefail

WEEKDAY="${1:-0}"
HOUR="${2:-9}"
LABEL="com.local.amex-offers.digest"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node || true)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGDIR="$HOME/Library/Logs/amex-offers"

if [[ -z "$NODE" ]]; then echo "node not found on PATH" >&2; exit 1; fi
if [[ ! -f "$ROOT/emailer/config.json" ]]; then
  echo "Create emailer/config.json first (copy emailer/config.example.json)." >&2; exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOGDIR"
chmod 600 "$ROOT/emailer/config.json"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$ROOT/emailer/send-digest.js</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>$WEEKDAY</integer>
    <key>Hour</key><integer>$HOUR</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>$LOGDIR/digest.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/digest.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $PLIST (weekday $WEEKDAY at $HOUR:00). Logs: $LOGDIR/digest.log"
echo "Run it now to test:  launchctl kickstart gui/$(id -u)/$LABEL"
