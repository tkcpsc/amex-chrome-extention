#!/bin/bash
# Stores your SMTP app password in the macOS login Keychain.
# You type the password into macOS's own prompt — it never touches a file,
# your shell history, or this project.
set -euo pipefail

SERVICE="${KEYCHAIN_SERVICE:-amex-offers-smtp}"
ACCOUNT="${1:-}"
if [[ -z "$ACCOUNT" ]]; then
  read -r -p "SMTP username (must match \"smtpUser\" in emailer/config.json): " ACCOUNT
fi
if [[ -z "$ACCOUNT" ]]; then echo "Username required." >&2; exit 1; fi

echo "Enter the app password when prompted (for Gmail: myaccount.google.com/apppasswords)."
# -U updates an existing item; -w as the last flag makes `security` prompt for the value.
/usr/bin/security add-generic-password -U -s "$SERVICE" -a "$ACCOUNT" -l "Amex Offers SMTP" -w

echo "Saved to Keychain as service \"$SERVICE\", account \"$ACCOUNT\"."
echo "Next: npm run digest:check"
