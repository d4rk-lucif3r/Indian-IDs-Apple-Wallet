#!/usr/bin/env bash
# Writes .env.vercel (gitignored) with everything the deployed app needs, certificates base64-encoded.
# Paste or import it in Vercel → Project → Settings → Environment Variables, then delete it.
# Usage: scripts/vercel-env.sh pass.com.yourname.idwallet YOURTEAMID "Your Name" https://your-domain
set -euo pipefail

PASS_TYPE_ID="${1:?Usage: scripts/vercel-env.sh <pass-type-id> <team-id> <organization-name> <public-url>}"
TEAM_ID="${2:?team id required}"
ORG="${3:?organization name required}"
PUBLIC_URL="${4:?public url required, e.g. https://ids.example.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="$ROOT/certs"

for f in signerCert.pem signerKey.pem wwdr.pem; do
  [ -f "$CERTS/$f" ] || { echo "Missing $CERTS/$f — run scripts/setup-certs.sh first." >&2; exit 1; }
done

umask 077
{
  echo "# Contains your pass-signing private key: never commit or share. Delete after importing."
  echo "PASS_TYPE_ID=$PASS_TYPE_ID"
  echo "TEAM_ID=$TEAM_ID"
  echo "ORGANIZATION_NAME=\"$ORG\""
  echo "PUBLIC_URL=$PUBLIC_URL"
  echo "PASS_SIGNER_CERT_B64=$(base64 -i "$CERTS/signerCert.pem" | tr -d '\n')"
  echo "PASS_SIGNER_KEY_B64=$(base64 -i "$CERTS/signerKey.pem" | tr -d '\n')"
  echo "PASS_WWDR_B64=$(base64 -i "$CERTS/wwdr.pem" | tr -d '\n')"
} > "$ROOT/.env.vercel"
echo "Wrote $ROOT/.env.vercel"
