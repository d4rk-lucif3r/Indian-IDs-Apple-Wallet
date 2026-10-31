import { test } from "node:test";
import assert from "node:assert/strict";
import { browserLabel, buildReport, issuerHints, sanitizeMeta } from "../src/lib/diagnostics.ts";

test("report describes layout and fields without any document values", () => {
  const report = buildReport({
    idType: "PAN",
    outcome: "parsed with missing fields",
    appVersion: "2026-10-30.2",
    browser: "Safari on iOS",
    diag: {
      kind: "pdf",
      pages: 1,
      pageSizePt: [595, 842],
      passwordProtected: true,
      producer: "iText 5.5.13",
      creator: null,
      textItems: 11,
      textChars: 132,
      images: [{ w: 213, h: 213, drawnW: 68, drawnH: 65, role: "photo" }],
      qr: { found: true, chars: 3604, bytes: 3604, digitsOnly: true },
      issuerHints: issuerHints("ABCDE1234F ASHA VERMA UTIITSL"),
    },
    fields: { pan: true, name: true, fatherName: false, dob: true },
  });
  assert.match(report, /595×842 pt/);
  assert.match(report, /\| fatherName \| no \|/);
  assert.match(report, /Issuer hints:\** UTIITSL|Issuer hints: UTIITSL/);
  // The values that were in the source text must never appear.
  for (const value of ["ABCDE1234F", "ASHA", "VERMA"]) assert.ok(!report.includes(value), `leaked ${value}`);
});

test("OCR confidence per field and per region", () => {
  const report = buildReport({
    idType: "Voter ID",
    outcome: "parsed",
    appVersion: "v",
    browser: "b",
    diag: null,
    fields: { name: true, nameHi: false },
    fieldConfidence: { name: 91.4, nameHi: null },
    ocrRegions: [{ name: "name block", lang: "hin", confidence: 62.2 }],
  });
  assert.match(report, /\| name \| yes \| 91% \|/);
  assert.match(report, /\| nameHi \| no \| — \|/);
  assert.match(report, /name block \(Hindi\): 62%/);
});

test("issuer hints come only from the fixed keyword list", () => {
  assert.deepEqual(issuerHints("Income Tax Department · Protean eGov"), ["Protean", "Income Tax Department"]);
  assert.deepEqual(issuerHints("random text with a name"), []);
  // From a file name: the keywords come out, the PAN number in the name never does.
  assert.deepEqual(issuerHints("UTIITSL_ePAN_ABCDE1234F_30102026.pdf"), ["UTIITSL", "ePAN"]);
});

test("PDF metadata is reduced to plain software-name characters", () => {
  assert.equal(sanitizeMeta("iText® 5.5.13 ©2000-2020 iText Group NV"), "iText® 5.5.13 ©2000-2020 iText Group NV");
  assert.equal(sanitizeMeta("<script>x</script>"), "scriptx/script");
  assert.equal(sanitizeMeta(42), null);
  assert.equal(sanitizeMeta("a".repeat(200))?.length, 60);
});

test("browser label is coarse", () => {
  assert.equal(browserLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit Version/26.0 Safari/604.1"), "Safari on iOS");
  assert.equal(browserLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0 Safari/537.36"), "Chrome on macOS");
});
