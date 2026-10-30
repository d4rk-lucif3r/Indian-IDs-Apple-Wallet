import "server-only";
import { formatAddress, maskedAadhaar, type AadhaarSecureQr } from "@/lib/aadhaar/secureQr";
import { addCredit, addLargeQrLink, createStoreCard } from "./base";

const GENDERS: Record<string, string> = { M: "Male", F: "Female", T: "Transgender" };

export function buildAadhaarPass(
  qr: AadhaarSecureQr,
  qrText: string,
  stripPng: Buffer | null,
  {
    vid = null,
    uid = null,
    siteUrl = null,
  }: { vid?: string | null; uid?: string | null; siteUrl?: string | null } = {},
): Buffer {
  const pass = createStoreCard(
    {
      description: "Aadhaar",
      logoText: "आधार",
      backgroundColor: "rgb(253, 243, 224)",
      foregroundColor: "rgb(26, 26, 26)",
      labelColor: "rgb(215, 38, 44)",
    },
    stripPng,
  );

  if (stripPng) {
    // English title on the right of the header, opposite the Hindi logo text.
    pass.headerFields.push({ key: "title", label: "", value: "Aadhaar" });
    // The card front is drawn into the strip; Wallet reserves one field row below it, so use it.
    if (siteUrl) {
      pass.secondaryFields.push({ key: "scanHint", label: "SCAN WITH mAADHAAR", value: "Tap ⓘ → Show large QR" });
    }
    if (qr.mobileLast4) {
      pass.auxiliaryFields.push({
        key: "mobile",
        label: "MOBILE",
        value: `XXXXXX${qr.mobileLast4}`,
        textAlignment: "PKTextAlignmentRight",
      });
    }
  } else {
    pass.headerFields.push({ key: "uid", label: "AADHAAR", value: uid ?? maskedAadhaar(qr.last4) });
    pass.primaryFields.push({ key: "name", label: "NAME", value: qr.name });
    pass.secondaryFields.push(
      { key: "dob", label: "जन्म तिथि / DOB", value: qr.dob.replaceAll("-", "/") },
      { key: "gender", label: "लिंग / GENDER", value: GENDERS[qr.gender] ?? qr.gender },
    );
  }
  if (siteUrl) addLargeQrLink(pass, siteUrl, qrText.trim(), "Scan with mAadhaar");
  pass.backFields.push(
    { key: "backName", label: "Name", value: qr.name },
    { key: "backUid", label: "Aadhaar No.", value: uid ?? maskedAadhaar(qr.last4) },
    ...(vid ? [{ key: "vid", label: "VID", value: vid }] : []),
    { key: "address", label: "पता / Address", value: formatAddress(qr.address) },
    {
      key: "proof",
      label: "आधार पहचान का प्रमाण है, नागरिकता या जन्मतिथि का नहीं",
      value:
        "Aadhaar is proof of identity, not of citizenship or date of birth. It should be used with verification (online authentication, or scanning of QR code / offline XML).",
    },
    {
      key: "verify",
      label: "Verification",
      value: "The QR on this pass is the original UIDAI Secure QR from your e-Aadhaar. Scan it with the mAadhaar app to verify offline.",
    },
  );

  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: qrText.trim(),
    messageEncoding: "iso-8859-1",
  });

  addCredit(pass);
  return pass.getAsBuffer();
}
