import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePanText, panPdfPassword } from "../src/lib/pan/parse.ts";

const ePan =
  "आयकर विभाग INCOME TAX DEPARTMENT भारत सरकार GOVT. OF INDIA स्थायी लेखा संख्या कार्ड " +
  "Permanent Account Number Card ABCDE1234F नाम / Name ASHA VERMA पिता का नाम / Father's Name " +
  "RAMESH KUMAR VERMA जन्म की तारीख / Date of Birth 01/06/1995 हस्ताक्षर / Signature";

test("parses e-PAN text", () => {
  assert.deepEqual(parsePanText(ePan), {
    pan: "ABCDE1234F",
    name: "ASHA VERMA",
    fatherName: "RAMESH KUMAR VERMA",
    dob: "01/06/1995",
  });
});

test("handles curly apostrophes, initials and missing fields", () => {
  const t = "Name A. K. SHARMA Father’s Name B. SHARMA Date of Birth 31/12/1980 PAN XYZAB9876C";
  assert.deepEqual(parsePanText(t), { pan: "XYZAB9876C", name: "A. K. SHARMA", fatherName: "B. SHARMA", dob: "31/12/1980" });
  assert.deepEqual(parsePanText("nothing useful"), { pan: "", name: "", fatherName: "", dob: "" });
});

test("parses unlabelled e-PAN text (labels baked into the background image)", () => {
  // UTIITSL layout: values only, one per text item, card printed twice.
  const t = ["ABCDE1234F", "ASHA VERMA", "RAMESH VERMA", "01/06/1995", "Female", "ABCDE1234F", "ASHA VERMA"].join("\n");
  assert.deepEqual(parsePanText(t), { pan: "ABCDE1234F", name: "ASHA VERMA", fatherName: "RAMESH VERMA", dob: "01/06/1995" });
});

test("builds the e-PAN password from the date of birth", () => {
  assert.equal(panPdfPassword("1995-06-01"), "01061995");
  assert.equal(panPdfPassword(""), null);
});

test("PAN card photo OCR: labelled (newer) cards with typical OCR noise", async () => {
  const { parsePanOcr } = await import("../src/lib/pan/ocr.ts");
  const ocr = [
    "आयकर विभाग INCOME TAX DEPARTMENT", "भारत सरकार GOVT. OF INDIA",
    "Permanent Account Number Card", "ABCPE1Z34F", // Z misread for 2
    "नाम / Name", "ASHA VERMA |", "पिता का नाम / Father's Name", "~RAMESH KUMAR VERMA",
    "जन्म की तारीख / Date of Birth", "01-06-1995", "Signature",
  ].join("\n");
  assert.deepEqual(parsePanOcr(ocr), { pan: "ABCPE1234F", name: "ASHA VERMA", fatherName: "RAMESH KUMAR VERMA", dob: "01/06/1995" });
});

test("PAN card photo OCR: older unlabelled cards", async () => {
  const { parsePanOcr } = await import("../src/lib/pan/ocr.ts");
  const ocr = ["INCOME TAX DEPARTMENT GOVT. OF INDIA", "ASHA VERMA", "RAMESH VERMA", "01/06/1995", "Permanent Account Number", "ABCPE 1234F", "Signature"].join("\n");
  assert.deepEqual(parsePanOcr(ocr), { pan: "ABCPE1234F", name: "ASHA VERMA", fatherName: "RAMESH VERMA", dob: "01/06/1995" });
});

test("PAN normalisation fixes position-wise confusions and rejects non-PANs", async () => {
  const { normalisePan } = await import("../src/lib/pan/ocr.ts");
  assert.equal(normalisePan("A8CPE12S4F"), "ABCPE1254F");
  assert.equal(normalisePan("ABCPEIO34F"), "ABCPE1034F");
  assert.equal(normalisePan("ABCXE1234F"), null); // 4th char isn't a holder type
  assert.equal(normalisePan("DEPARTMENT"), null);
});
