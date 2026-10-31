import { test } from "node:test";
import assert from "node:assert/strict";
import { findVid, findAadhaarNumber } from "../src/lib/aadhaar/pdfText.ts";

const text = "Your Aadhaar No. : 2345 6789 1234 VID : 9134 5678 9012 3456 Issue Date: 01/01/2020";

test("finds the VID", () => {
  assert.equal(findVid(text), "9134 5678 9012 3456");
  assert.equal(findVid("VID: 9134567890123456"), "9134 5678 9012 3456");
  assert.equal(findVid("no virtual id here 1234 5678 9012"), null);
});

test("finds the full Aadhaar number only when it matches the QR's last 4", () => {
  assert.equal(findAadhaarNumber(text, "1234"), "2345 6789 1234");
  assert.equal(findAadhaarNumber(text, "9999"), null);
  // VID digits must never be mistaken for the Aadhaar number
  assert.equal(findAadhaarNumber("VID : 9134 5678 9012 3456", "9012"), null);
  // Masked e-Aadhaar
  assert.equal(findAadhaarNumber("Your Aadhaar No. : XXXX XXXX 1234", "1234"), null);
});

test("Verhoeff check digit rejects misread Aadhaar numbers from photos", async () => {
  const { verhoeffValid } = await import("../src/lib/aadhaar/pdfText.ts");
  assert.equal(verhoeffValid("2363"), true); // textbook Verhoeff example: 236 + check digit 3
  assert.equal(verhoeffValid("2364"), false);
  // Build a fake 12-digit number with a valid check digit, then misread one digit.
  const base = "23456789012";
  const check = [..."0123456789"].find((d) => verhoeffValid(base + d))!;
  const good = base + check;
  const last4 = good.slice(-4);
  const spaced = good.replace(/(\d{4})(?=\d)/g, "$1 ");
  assert.equal(findAadhaarNumber(`Aadhaar ${spaced}`, last4, { checksum: true }), spaced);
  const misread = "8" + good.slice(1);
  assert.equal(findAadhaarNumber(`Aadhaar ${misread}`, last4, { checksum: true }), null);
  assert.equal(findAadhaarNumber(`Aadhaar ${misread}`, last4), misread.replace(/(\d{4})(?=\d)/g, "$1 "));
});
