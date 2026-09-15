#!/usr/bin/env bash
# Pushes the sync service with the secret from ../.dev.vars and moves the web app
# deployment (the URL in .dev.vars) to the new version.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
CLASP="${CLASP:-/tmp/clasp-fresh/node_modules/.bin/clasp}"
if [ ! -e "$CLASP" ]; then
  echo "clasp not found. Install it outside iCloud: npm install --prefix /tmp/clasp-fresh @google/clasp@3.4.1" >&2
  exit 1
fi

SECRET="$(grep '^GOOGLE_SHEETS_SYNC_SECRET=' "$ROOT/.dev.vars" | cut -d= -f2-)"
DEPLOYMENT_ID="$(grep '^GOOGLE_SHEETS_SYNC_URL=' "$ROOT/.dev.vars" | sed -E 's#.*/macros/s/([^/]+)/exec.*#\1#')"

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
sed "s/%%SYNC_SECRET%%/$SECRET/" Code.js > "$BUILD/Code.js"
cp appsscript.json .clasp.json "$BUILD/"

cd "$BUILD"
node "$CLASP" push --force
node "$CLASP" update-deployment "$DEPLOYMENT_ID" --description "Income & Venture Lab sync $(date +%Y-%m-%d)"
echo "Deployed to $DEPLOYMENT_ID"
