#!/usr/bin/env bash
# Converts your Pass Type ID .p12 (exported from Keychain) into the PEM files the server signs with.
# Usage: scripts/setup-certs.sh ~/certs/pass.p12
set -euo pipefail

P12="${1:?Usage: scripts/setup-certs.sh path/to/pass.p12}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$OUT"

read -rsp "p12 password: " P12_PASS; echo
export P12_PASS

# Keychain exports often use legacy encryption that OpenSSL 3 only reads with -legacy.
pkcs12() { openssl pkcs12 -in "$P12" -passin env:P12_PASS "$@" 2>/dev/null || openssl pkcs12 -legacy -in "$P12" -passin env:P12_PASS "$@"; }

pkcs12 -clcerts -nokeys -out "$OUT/signerCert.pem"
pkcs12 -nocerts -nodes -out "$OUT/signerKey.pem"
chmod 600 "$OUT/signerKey.pem"

if [ ! -f "$OUT/wwdr.pem" ]; then
  curl -sSfL https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer | openssl x509 -inform der -out "$OUT/wwdr.pem"
fi

echo "Wrote certs to $OUT"
openssl x509 -in "$OUT/signerCert.pem" -noout -subject
