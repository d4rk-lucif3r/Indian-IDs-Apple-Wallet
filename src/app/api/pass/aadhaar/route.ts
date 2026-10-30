import { gunzipSync, inflateSync } from "node:zlib";
import { parseSecureQr, SecureQrError } from "@/lib/aadhaar/secureQr";
import { buildAadhaarPass } from "@/lib/pass/aadhaarPass";
import { BadRequest, errorResponse, passResponse, readStrip, siteUrlFor } from "@/lib/pass/http";

const MAX_QR_LENGTH = 20_000;

const decompress = async (bytes: Uint8Array) => {
  const buf = Buffer.from(bytes);
  return new Uint8Array(buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : inflateSync(buf));
};

// Submitted as a regular form POST so iOS Safari navigates to the response and shows "Add to Apple Wallet".
// Nothing is persisted: the QR is parsed, the pass is signed and streamed back, and the request ends.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const qrText = String(form.get("qr") ?? "");
    const vidDigits = String(form.get("vid") ?? "").replace(/\s/g, "");
    const vid = /^\d{16}$/.test(vidDigits) ? vidDigits.replace(/(\d{4})(?=\d)/g, "$1 ") : null;
    const uidDigits = String(form.get("uid") ?? "").replace(/\s/g, "");
    if (!qrText || qrText.length > MAX_QR_LENGTH) throw new BadRequest("Missing or invalid QR data.");

    const qr = await parseSecureQr(qrText, decompress).catch((err) => {
      throw err instanceof SecureQrError ? new BadRequest(err.message) : err;
    });
    // Only accept a full number that agrees with the signed QR's last 4 digits.
    const uid = /^\d{12}$/.test(uidDigits) && uidDigits.endsWith(qr.last4)
      ? uidDigits.replace(/(\d{4})(?=\d)/g, "$1 ")
      : null;
    const pkpass = buildAadhaarPass(qr, qrText, readStrip(form), { vid, uid, siteUrl: siteUrlFor(request) });
    return passResponse(pkpass, "aadhaar.pkpass");
  } catch (err) {
    return errorResponse(err);
  }
}
