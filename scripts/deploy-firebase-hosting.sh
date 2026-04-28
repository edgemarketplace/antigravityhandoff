#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-edge-marketplace-hub}"
EXPECTED_PROJECT="edge-marketplace-hub"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$PROJECT_ID" != "$EXPECTED_PROJECT" ]]; then
  echo "Refusing deploy: PROJECT_ID must be $EXPECTED_PROJECT (got: $PROJECT_ID)"
  exit 1
fi

if [[ ! -f "$ROOT_DIR/.env.local" ]]; then
  echo "Missing $ROOT_DIR/.env.local"
  exit 1
fi

if [[ -x "$ROOT_DIR/node_modules/.bin/firebase" ]]; then
  FIREBASE_BIN="$ROOT_DIR/node_modules/.bin/firebase"
elif [[ -x "/home/creativecapital/.hermes/node/bin/firebase" ]]; then
  FIREBASE_BIN="/home/creativecapital/.hermes/node/bin/firebase"
else
  echo "firebase CLI not found"
  exit 1
fi

echo "Using firebase CLI: $FIREBASE_BIN"
echo "Project: $PROJECT_ID"

cd "$ROOT_DIR"
"$FIREBASE_BIN" use "$PROJECT_ID"
"$FIREBASE_BIN" deploy --only hosting

echo "Deploy complete: https://edge-marketplace-hub.web.app"
