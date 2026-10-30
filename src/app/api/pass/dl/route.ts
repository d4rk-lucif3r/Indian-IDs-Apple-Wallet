import type { DlDetails } from "@/lib/dl/parse";
import { TERMS_VERSION } from "@/lib/terms";
import { audit, consentFromForm, countryOf } from "@/lib/pass/audit";
import { buildDlPass } from "@/lib/pass/dlPass";
import { BadRequest, errorResponse, passResponse, readStrip, requireTerms } from "@/lib/pass/http";

const FIELDS: (keyof DlDetails)[] = [
  "licenceNo", "name", "dob", "bloodGroup", "relation", "presentAddress",
  "permanentAddress", "classes", "issueDate", "expiryDate", "issuingAuthority",
];
const MAX_QR = 4_000;

// Form POST from the DL flow; details were read on the device from the DigiLocker certificate.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    requireTerms(form);
    const d = Object.fromEntries(
      FIELDS.map((k) => [k, String(form.get(k) ?? "").trim().slice(0, 200)]),
    ) as unknown as DlDetails;
    if (!d.licenceNo || !d.name) throw new BadRequest("Licence number and name are required.");
    const qrText = String(form.get("qr") ?? "");
    if (qrText.length > MAX_QR) throw new BadRequest("Invalid QR data.");
    const pkpass = buildDlPass(d, { stripPng: readStrip(form), qrText: qrText || null });
    audit({ event: "pass_created", idType: "dl", termsVersion: TERMS_VERSION, ...consentFromForm(form), country: countryOf(request) });
    return passResponse(pkpass, "driving-licence.pkpass", form);
  } catch (err) {
    return errorResponse(err);
  }
}
