import { TERMS_VERSION } from "@/lib/terms";
import { audit, countryOf } from "@/lib/pass/audit";

const UUID = /^[a-f0-9-]{36}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

// Records that a browser accepted the current terms (random consent ID, version, time, country).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const consentId = String(body?.consentId ?? "");
  const acceptedAt = String(body?.termsAcceptedAt ?? "");
  if (!UUID.test(consentId) || body?.termsVersion !== TERMS_VERSION || !ISO.test(acceptedAt)) {
    return new Response("Invalid consent record.", { status: 400 });
  }
  audit({ event: "terms_accepted", termsVersion: TERMS_VERSION, consentId, termsAcceptedAt: acceptedAt, country: countryOf(request) });
  return new Response(null, { status: 204 });
}
