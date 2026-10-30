import { test } from "node:test";
import assert from "node:assert/strict";
import { aadhaarPdfPasswords } from "../src/lib/aadhaar/pdfPassword.ts";

test("builds the e-Aadhaar password from name and birth year", () => {
  assert.deepEqual(aadhaarPdfPasswords("Suresh Kumar", "1990"), ["SURE1990"]);
  assert.deepEqual(aadhaarPdfPasswords("sai kumar", "1990"), ["SAIK1990", "SAI 1990"]);
  assert.deepEqual(aadhaarPdfPasswords("P. Kumar", "1990"), ["P.KU1990", "PKUM1990", "P. K1990"]);
  assert.deepEqual(aadhaarPdfPasswords("Ria", "2001"), ["RIA2001"]);
});

test("returns nothing for incomplete input", () => {
  assert.deepEqual(aadhaarPdfPasswords("", "1990"), []);
  assert.deepEqual(aadhaarPdfPasswords("Asha", "95"), []);
});
