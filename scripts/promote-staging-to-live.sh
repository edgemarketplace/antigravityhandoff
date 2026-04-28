#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-edge-marketplace-hub}"
SITE_ID="${SITE_ID:-edge-marketplace-hub}"
SOURCE_CHANNEL="${SOURCE_CHANNEL:-staging}"
BACKUP_CHANNEL="prelive-$(date +%Y%m%d-%H%M%S)"
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
echo "Using firebase CLI: $FIREBASE_BIN"
echo "Backing up current live to channel: $BACKUP_CHANNEL"
"$FIREBASE_BIN" hosting:clone "$SITE_ID":live "$SITE_ID":"$BACKUP_CHANNEL" --project "$PROJECT_ID"

echo "Promoting $SOURCE_CHANNEL -> live"
"$FIREBASE_BIN" hosting:clone "$SITE_ID":"$SOURCE_CHANNEL" "$SITE_ID":live --project "$PROJECT_ID"

echo "Promotion complete. Rollback channel: $BACKUP_CHANNEL"
