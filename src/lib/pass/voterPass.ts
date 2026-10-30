import "server-only";
import type { VoterDetails } from "@/lib/voter/parse";
import { addCredit, createStoreCard, setQr } from "./base";

export function buildVoterPass(
  v: VoterDetails,
  { stripPng, qrText }: { stripPng: Buffer | null; qrText: string | null },
): Buffer {
  const pass = createStoreCard(
    {
      description: "Voter ID (e-EPIC)",
      logoText: "मतदाता पहचान पत्र",
      // Warm peach between the card's lavender and orange; the strip fades into it (voterCardArt.ts).
      backgroundColor: "rgb(249, 234, 218)",
      foregroundColor: "rgb(17, 17, 17)",
      labelColor: "rgb(150, 70, 80)",
    },
    stripPng,
  );

  pass.headerFields.push({ key: "title", label: "", value: "Voter ID" });
  if (stripPng) {
    pass.secondaryFields.push({ key: "epic", label: "EPIC NO.", value: v.epicNo });
    pass.auxiliaryFields.push({ key: "copy", label: "NOTE", value: "Personal copy", textAlignment: "PKTextAlignmentRight" });
  } else {
    pass.primaryFields.push({ key: "epic", label: "EPIC NO.", value: v.epicNo });
  }

  const back: [string, string, string][] = [
    ["backEpic", "मतदाता पहचान पत्र संख्या / Epic no.", v.epicNo],
    ["name", "नाम / Name", [v.nameHi, v.name].filter(Boolean).join(" / ")],
    ["relation", v.relationLabel || "Father's / Husband's Name", [v.relationNameHi, v.relationName].filter(Boolean).join(" / ")],
    ["gender", "लिंग / Gender", v.gender],
    ["dob", "जन्म तिथि / Date of Birth / Age", v.dob],
    ["address", "पता / Address", v.address],
    ["ero", "Electoral Registration Officer", v.ero],
    ["serial", "मतदाता क्रमांक / Serial No.", v.serialNo],
    ["backAc", "Assembly Constituency No. and Name", v.constituency],
    ["part", "Part No. and Name", v.part],
    ["polling", "Polling Station Address", v.pollingStation],
  ];
  for (const [key, label, value] of back) if (value) pass.backFields.push({ key, label, value });
  pass.backFields.push(
    {
      key: "verify",
      label: "Verification",
      value: qrText
        ? "The QR on this pass is the original e-EPIC QR. Scan it with the ECINET app to verify."
        : "This pass has no QR. Verify your details at voters.eci.gov.in.",
    },
    {
      key: "eciNote",
      label: "Kindly note that",
      value:
        "e-EPIC is a proof of identity for the purpose of an election. Mere possession of EPIC is no guarantee of name being present in electoral roll; please check your name in the current electoral roll before every election at www.voters.eci.gov.in. Date of birth mentioned in this card shall not be treated as proof of age or date of birth for any purpose other than registration in electoral roll.",
    },
    { key: "note", label: "Note", value: "This pass is a personal convenience copy, not an official document." },
  );

  if (qrText) setQr(pass, qrText);
  addCredit(pass);
  return pass.getAsBuffer();
}
