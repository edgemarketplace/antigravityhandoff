#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-edge-marketplace-hub}"
SITE_ID="${SITE_ID:-edge-marketplace-hub}"
CHANNEL_ID="${CHANNEL_ID:-staging}"
EXPIRES="${EXPIRES:-7d}"
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
echo "Deploying preview channel: $CHANNEL_ID (expires: $EXPIRES)"
"$FIREBASE_BIN" hosting:channel:deploy "$CHANNEL_ID" --project "$PROJECT_ID" --expires "$EXPIRES"
