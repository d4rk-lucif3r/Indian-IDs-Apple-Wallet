import { TERMS_VERSION } from "@/lib/terms";
import { audit, consentFromForm, countryOf } from "@/lib/pass/audit";
import { EPIC_PATTERN, type VoterDetails } from "@/lib/voter/parse";
import { buildVoterPass } from "@/lib/pass/voterPass";
import { BadRequest, errorResponse, passResponse, readStrip, requireTerms } from "@/lib/pass/http";

const FIELDS: (keyof VoterDetails)[] = [
  "epicNo", "name", "nameHi", "relationLabel", "relationName", "relationNameHi", "gender", "dob", "address", "ero",
  "serialNo", "constituency", "part", "pollingStation",
];
const MAX_QR = 4_000;

// Form POST from the Voter ID flow; the strip is the official card render cropped on the device.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    requireTerms(form);
    const v = Object.fromEntries(
      FIELDS.map((k) => [k, String(form.get(k) ?? "").trim().slice(0, 200)]),
    ) as unknown as VoterDetails;
    v.epicNo = v.epicNo.toUpperCase();
    if (!EPIC_PATTERN.test(v.epicNo)) throw new BadRequest("That doesn't look like a valid EPIC number.");
    const qrText = String(form.get("qr") ?? "");
    if (qrText.length > MAX_QR) throw new BadRequest("Invalid QR data.");
    const pkpass = buildVoterPass(v, { stripPng: readStrip(form), qrText: qrText || null });
    audit({ event: "pass_created", idType: "voter", termsVersion: TERMS_VERSION, ...consentFromForm(form), country: countryOf(request) });
    return passResponse(pkpass, "voter-id.pkpass", form);
  } catch (err) {
    return errorResponse(err);
  }
}
