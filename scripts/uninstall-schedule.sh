#!/bin/bash
set -euo pipefail
LABEL="com.local.amex-offers.digest"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Removed weekly digest schedule."
