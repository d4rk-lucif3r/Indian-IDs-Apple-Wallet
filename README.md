# Aadhaar → Apple Wallet

Upload an e-Aadhaar PDF (or a photo of its QR), get an Apple Wallet pass carrying the original UIDAI Secure QR.

- **Browser:** pdf.js unlocks/renders the PDF, zxing-wasm finds the Secure QR, pdf.js's OpenJPEG decodes the photo. The file never leaves the device.
- **Server (`POST /api/pass/aadhaar`):** receives only the QR text + photo PNG, re-parses the QR, signs a `.pkpass`, streams it back. Nothing is stored.

## Setup

1. Create a Pass Type ID and its certificate on developer.apple.com, export it from Keychain as a `.p12`.
2. Convert it to PEMs (written to `./certs`, gitignored):
   ```sh
   scripts/setup-certs.sh ~/certs/pass.p12
   ```
3. `cp .env.example .env.local` and fill in `PASS_TYPE_ID` and `TEAM_ID`.
4. ```sh
   npm install
   npm run dev
   ```

Testing on iPhone: the easiest route is an HTTPS tunnel to your Mac (e.g. `cloudflared tunnel --url http://localhost:3000`) or deploy.

## Deploying (Vercel)

Set `PASS_TYPE_ID`, `TEAM_ID`, and `PASS_SIGNER_CERT_B64` / `PASS_SIGNER_KEY_B64` / `PASS_WWDR_B64` (`base64 -i certs/x.pem`).

## Layout

- `src/lib/aadhaar/secureQr.ts` — Secure QR parser (shared by browser and server)
- `src/lib/client/` — PDF/image QR extraction and JPEG 2000 photo decoding
- `src/lib/pass/` — certificate loading and pass layout
- `pass-model/` — pass icons (Arsh Anwar logo); `public/brand/` — logo used for the "Powered by" mark
- `npm test` — parser tests
