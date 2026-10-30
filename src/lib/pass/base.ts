import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PKPass } from "passkit-generator";
import { loadPassConfig } from "./config";

const MODEL_DIR = path.join(process.cwd(), "pass-model");
const icons = Object.fromEntries(
  ["icon.png", "icon@2x.png", "icon@3x.png"].map((name) => [name, readFileSync(path.join(MODEL_DIR, name))]),
);

interface Style {
  description: string;
  logoText: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
}

// storeCard is the style that shows a full-width strip image; card fronts are drawn into it.
export function createStoreCard(style: Style, stripPng: Buffer | null): PKPass {
  const { certificates, ...ids } = loadPassConfig();
  const pass = new PKPass({ ...icons }, certificates, {
    ...ids,
    ...style,
    formatVersion: 1,
    serialNumber: randomUUID(),
    sharingProhibited: true,
  });
  pass.type = "storeCard";
  if (stripPng) {
    pass.addBuffer("strip.png", stripPng);
    pass.addBuffer("strip@2x.png", stripPng);
    pass.addBuffer("strip@3x.png", stripPng);
  }
  return pass;
}

// Wallet's QR box is too small for dense ID QRs to scan reliably, so the back links to a
// full-screen version. The payload rides in the URL fragment, which never reaches the server.
export function addLargeQrLink(pass: PKPass, siteUrl: string, fragment: string, label: string) {
  pass.backFields.push({
    key: "largeQr",
    label,
    value: "Show large QR",
    attributedValue: `<a href="${siteUrl}/qr#${fragment}">Show large QR</a>`,
  });
}

// Puts a document's original QR payload on the pass. ISO-8859-1 maps characters 0–255 one-to-one;
// anything beyond that needs UTF-8.
export function setQr(pass: PKPass, payload: string) {
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: payload,
    messageEncoding: /[^\u0000-ÿ]/.test(payload) ? "utf-8" : "iso-8859-1",
  });
}

// Credit line at the very end of the pass's back (info) side, with a tappable website link.
export function addCredit(pass: PKPass) {
  pass.backFields.push({
    key: "credit",
    label: "Powered by",
    value: "Arsh Anwar · www.arshanwar.com",
    attributedValue: 'Arsh Anwar · <a href="https://www.arshanwar.com">www.arshanwar.com</a>',
  });
}
