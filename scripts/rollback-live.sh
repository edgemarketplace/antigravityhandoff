#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup_channel_name>"
  echo "Example: $0 prelive-20260428-191500"
  exit 1
fi

BACKUP_CHANNEL="$1"
PROJECT_ID="${PROJECT_ID:-edge-marketplace-hub}"
SITE_ID="${SITE_ID:-edge-marketplace-hub}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -x "$ROOT_DIR/node_modules/.bin/firebase" ]]; then
  FIREBASE_BIN="$ROOT_DIR/node_modules/.bin/firebase"
elif [[ -x "/home/creativecapital/.hermes/node/bin/firebase" ]]; then
  FIREBASE_BIN="/home/creativecapital/.hermes/node/bin/firebase"
else
  echo "firebase CLI not found"
  exit 1
fi

cd "$ROOT_DIR"
echo "Rolling back live from backup channel: $BACKUP_CHANNEL"
"$FIREBASE_BIN" hosting:clone "$SITE_ID":"$BACKUP_CHANNEL" "$SITE_ID":live --project "$PROJECT_ID"
echo "Rollback complete"
