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
