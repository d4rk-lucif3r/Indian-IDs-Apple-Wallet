import { TERMS_VERSION } from "@/lib/terms";
import { audit, consentFromForm, countryOf } from "@/lib/pass/audit";
import { PAN_PATTERN } from "@/lib/pan/parse";
import { buildPanPass } from "@/lib/pass/panPass";
import { BadRequest, errorResponse, passResponse, readStrip, requireTerms, siteUrlFor } from "@/lib/pass/http";

const MAX_QR_BYTES = 8_000;
const MAX_TEXT = 100;

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim().slice(0, MAX_TEXT);
}

// Form POST from the PAN flow; details were read on the device and confirmed by the user.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    requireTerms(form);
    const pan = text(form, "pan").toUpperCase();
    if (!PAN_PATTERN.test(pan)) throw new BadRequest("That doesn't look like a valid PAN.");
    const dob = text(form, "dob");
    if (dob && !/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) throw new BadRequest("Date of birth must be DD/MM/YYYY.");

    const qrB64 = String(form.get("qr") ?? "");
    const qrBytes = qrB64 ? Buffer.from(qrB64, "base64") : null;
    if (qrBytes && (qrBytes.length === 0 || qrBytes.length > MAX_QR_BYTES)) throw new BadRequest("Invalid QR data.");

    const pkpass = buildPanPass(
      { pan, name: text(form, "name"), fatherName: text(form, "fatherName"), dob },
      { stripPng: readStrip(form), qrBytes, siteUrl: siteUrlFor(request) },
    );
    audit({ event: "pass_created", idType: "pan", termsVersion: TERMS_VERSION, ...consentFromForm(form), country: countryOf(request) });
    return passResponse(pkpass, "pan.pkpass", form);
  } catch (err) {
    return errorResponse(err);
  }
}
