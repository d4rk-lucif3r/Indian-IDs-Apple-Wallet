import "server-only";
import type { DlDetails } from "@/lib/dl/parse";
import { addCredit, createStoreCard, setQr } from "./base";

export function buildDlPass(d: DlDetails, { stripPng, qrText }: { stripPng: Buffer | null; qrText: string | null }): Buffer {
  const pass = createStoreCard(
    {
      description: "Driving Licence",
      logoText: "ड्राइविंग लाइसेंस",
      backgroundColor: "rgb(255, 255, 255)",
      foregroundColor: "rgb(17, 17, 17)",
      labelColor: "rgb(85, 85, 85)",
    },
    stripPng,
  );

  pass.headerFields.push({ key: "title", label: "", value: "Driving Licence" });
  if (stripPng) {
    pass.secondaryFields.push({ key: "valid", label: "VALID TILL", value: d.expiryDate });
    pass.auxiliaryFields.push({ key: "classes", label: "CLASS", value: d.classes, textAlignment: "PKTextAlignmentRight" });
  } else {
    pass.primaryFields.push({ key: "name", label: "NAME", value: d.name });
    pass.secondaryFields.push(
      { key: "licence", label: "LICENCE NO.", value: d.licenceNo },
      { key: "valid", label: "VALID TILL", value: d.expiryDate },
    );
  }

  const back: [string, string, string][] = [
    ["backLicence", "License No.", d.licenceNo],
    ["backName", "Name", d.name],
    ["dob", "DOB", d.dob],
    ["blood", "Blood Group", d.bloodGroup],
    ["relation", "S/W/D", d.relation],
    ["backClasses", "Authorization to Drive", d.classes],
    ["issue", "Date of Issue", d.issueDate],
    ["backValid", "Date of Expiry", d.expiryDate],
    ["present", "Present Address", d.presentAddress],
    ["permanent", "Permanent Address", d.permanentAddress],
    ["authority", "Issuing Authority", d.issuingAuthority],
  ];
  for (const [key, label, value] of back) if (value) pass.backFields.push({ key, label, value });
  pass.backFields.push(
    {
      key: "verify",
      label: "Verification",
      value: qrText
        ? "The QR on this pass is the original DigiLocker QR. Scan it with the DigiLocker app to verify."
        : "This pass has no QR. Verify the licence in the DigiLocker or mParivahan app.",
    },
    { key: "note", label: "Note", value: "Licence data from DigiLocker. This pass is a personal convenience copy, not an official document." },
  );

  if (qrText) setQr(pass, qrText);
  addCredit(pass);
  return pass.getAsBuffer();
}
