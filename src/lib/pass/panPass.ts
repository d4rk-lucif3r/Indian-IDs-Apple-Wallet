import "server-only";
import type { PanDetails } from "@/lib/pan/parse";
import { addCredit, addLargeQrLink, createStoreCard } from "./base";

export function buildPanPass(
  details: PanDetails,
  { stripPng, qrBytes, siteUrl }: { stripPng: Buffer | null; qrBytes: Buffer | null; siteUrl: string },
): Buffer {
  const pass = createStoreCard(
    {
      description: "PAN Card",
      logoText: "पैन कार्ड",
      backgroundColor: "rgb(214, 233, 248)",
      foregroundColor: "rgb(17, 17, 17)",
      labelColor: "rgb(28, 46, 107)",
    },
    stripPng,
  );

  pass.headerFields.push({ key: "title", label: "", value: "PAN Card" });
  if (stripPng) {
    if (qrBytes) {
      pass.secondaryFields.push({ key: "scanHint", label: "VERIFY WITH PAN QR READER", value: "Tap ⓘ → Show large QR" });
    }
  } else {
    pass.primaryFields.push({ key: "name", label: "NAME", value: details.name });
    pass.secondaryFields.push(
      { key: "pan", label: "PAN", value: details.pan },
      { key: "dob", label: "DATE OF BIRTH", value: details.dob },
    );
  }

  // base64url keeps the binary QR payload intact inside a URL fragment.
  if (qrBytes) addLargeQrLink(pass, siteUrl, `b64.${qrBytes.toString("base64url")}`, "Verify with PAN QR Code Reader");
  pass.backFields.push(
    { key: "backPan", label: "Permanent Account Number", value: details.pan },
    { key: "backName", label: "नाम / Name", value: details.name },
    ...(details.fatherName ? [{ key: "father", label: "पिता का नाम / Father's Name", value: details.fatherName }] : []),
    ...(details.dob ? [{ key: "backDob", label: "जन्म की तारीख / Date of Birth", value: details.dob }] : []),
    {
      key: "lost",
      label: "If this card is lost / someone's lost card is found, please inform / return to",
      value:
        "Income Tax PAN Services Unit, Protean eGov Technologies Limited, 4th Floor, Sapphire Chambers, Baner Road, Baner, Pune - 411045. Tel: 91-20-2721 8080, e-mail: tininfo@proteantech.in",
    },
    {
      key: "verify",
      label: "Verification",
      value: qrBytes
        ? "The QR on this pass is the original QR from your e-PAN. Scan it with the Income Tax Department's PAN QR Code Reader app to verify."
        : "This pass has no QR. Verify PAN details on the Income Tax e-filing portal.",
    },
    { key: "note", label: "Note", value: "This pass is a personal convenience copy, not an official document." },
  );

  if (qrBytes) {
    // ISO-8859-1 maps bytes 0–255 one-to-one, so Wallet re-encodes the exact original QR payload.
    pass.setBarcodes({ format: "PKBarcodeFormatQR", message: qrBytes.toString("latin1"), messageEncoding: "iso-8859-1" });
  }

  addCredit(pass);
  return pass.getAsBuffer();
}
