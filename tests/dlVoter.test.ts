import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDlText } from "../src/lib/dl/parse.ts";
import { EMPTY_VOTER, parseVoterText } from "../src/lib/voter/parse.ts";
import { normalizeEpic, parseVoterHindi, parseVoterOcr } from "../src/lib/voter/ocr.ts";

test("parses the DigiLocker driving licence layout", () => {
  const text = [
    "Digitally signed on", "Date: 01-02-2024 10:00:00 IST", "UNION OF INDIA DRIVING LICENSE",
    "Issuing Authority : RTO PUNE", "Authorization to Drive", ":", "LMV,MCWG",
    "Date of Issue", ":", "10-01-2020", "License No.", ":", "DL1 20230012345", "Date of Expiry :", "14-08-2035",
    "Name", ":", "ASHA VERMA", "DOB", ":", "15-08-1995", "Blood Group", ":", "O+", "S/W/D", ":", "RAMESH VERMA",
    "Present Address :", "12A MG ROAD, KOTHRUD", "PUNE, 411038", "Permanent", "Address", ":", "12A MG ROAD, KOTHRUD",
    "PUNE, 411038", "Note:", "1.", "This Driving License Certificate data is accessed using DigiLocker.",
  ].join("\n");
  assert.deepEqual(parseDlText(text), {
    licenceNo: "DL1 20230012345",
    name: "ASHA VERMA",
    dob: "15-08-1995",
    bloodGroup: "O+",
    relation: "RAMESH VERMA",
    presentAddress: "12A MG ROAD, KOTHRUD PUNE, 411038",
    permanentAddress: "12A MG ROAD, KOTHRUD PUNE, 411038",
    classes: "LMV,MCWG",
    issueDate: "10-01-2020",
    expiryDate: "14-08-2035",
    issuingAuthority: "RTO PUNE",
  });
});

test("parses e-EPIC text, skipping interleaved Devanagari fragments", () => {
  const text = [
    "मतदाता पहचान प", "तर्", "/", "Epic no. :", "ABC1234567", "मतदाता", "Serial No. :", "415",
    "2", "6", "-", "मा", "Assembly Constituency No. and Name :", "210-KOTHRUD",
    "Part No. and Name :", "12-KOTHRUD EAST", "Polling Station Address :", "COMMUNITY HALL", "BLOCK B",
    "कृपया नोट करें।",
  ].join("\n");
  assert.deepEqual(parseVoterText(text), {
    ...EMPTY_VOTER,
    epicNo: "ABC1234567", serialNo: "415", constituency: "210-KOTHRUD", part: "12-KOTHRUD EAST", pollingStation: "COMMUNITY HALL BLOCK B",
  });
});

test("falls back to the file name for image-only e-EPICs", () => {
  assert.equal(parseVoterText("", "e-EPIC_ABC1234567 (1).pdf").epicNo, "ABC1234567");
  assert.equal(parseVoterText("", "scan.pdf").epicNo, "");
});

// Shaped like real English-model OCR output: Hindi lines become junk, English lines survive.
const ocr = {
  front: [
    "ELECTION COMMISSION OF INDIA Y%", "ABC1234567 pe EE", "Name: Asha Verma", "Fora 1 A: rR",
    "- Father's Name: Ramesh Verma", "~ fer1/ Gender: T¥9 / Female", "or fof / ang:",
    "Date of Birth / Age: 15-08-1995", "ABC1234567", "e-Electors Photo Identity Card - §- #deTd T&T U3",
  ].join("\n"),
  back: [
    "gar: 12A, MG ROAD 2131 Ree", "faear, afia Torah 8x Reel, 411038", "Address: 12A, MG ROAD, KOTHRUD,",
    "PUNE, MAHARASHTRA,", "411038.", "Fafa fags gafdear, 210 - adgR (s1.51.)",
    "Electoral Registration Officer, 210 - KOTHRUD", "(SC)", "Scan By ECINET App", "ABC1234567 Download Date -: 01-02-2024",
  ].join("\n"),
  info: [
    "HAGA Ugd{ 94 9&1 / Epic no. : ABC1234567", "HAGA HID / Serial No. : 415", "faery faim 82 & d= 9 mM 210-ATéIqR",
    "Assembly Constituency No. and Name : 210-KOTHRUD", "WIT 4&1 9 9H 12-AT&IYqR ial!",
    "Part No. and Name : 12-KOTHRUD EAST", "HAST hg BT Ud :", "Polling Station Address :",
  ].join("\n"),
};

test("parses e-EPIC OCR text", () => {
  assert.deepEqual(parseVoterOcr(ocr), {
    epicNo: "ABC1234567",
    name: "Asha Verma",
    relationLabel: "Father's Name",
    relationName: "Ramesh Verma",
    gender: "Female",
    dob: "15-08-1995",
    address: "12A, MG ROAD, KOTHRUD, PUNE, MAHARASHTRA, 411038",
    ero: "210 - KOTHRUD (SC)",
    serialNo: "415",
    constituency: "210-KOTHRUD",
    part: "12-KOTHRUD EAST",
    pollingStation: "",
  });
});

test("fixes OCR look-alikes in EPIC numbers", () => {
  assert.equal(normalizeEpic("A8C12345G7"), null);
  assert.equal(normalizeEpic("ABC1234S67"), "ABC1234567");
  assert.equal(normalizeEpic("A8C1234567"), "ABC1234567");
  assert.equal(normalizeEpic("ABC123456"), null);
});

test("parses Hindi names from Hindi-model OCR, dropping background-dot junk", () => {
  const t = ["'नाम: आशा वर्मा  ............ .. ... ......", "चिंका&: डी माधव... ..................", "पिता का नाम: रमेश वर्मा . ः ."].join("\n");
  assert.deepEqual(parseVoterHindi(t), { nameHi: "आशा वर्मा", relationNameHi: "रमेश वर्मा" });
});

// Shaped like OCR of a physical DL card (fake data): mixed label styles plus some OCR junk.
import { findLicenceNo, parseDlOcr } from "../src/lib/dl/ocr.ts";

test("parses OCR text from a photo of a driving licence card", () => {
  const text = [
    "INDIAN UNION DRIVING LICENCE",
    "Issued by Government of Maharashtra",
    "DL No. MH12 20200012345",
    "Name : ASHA VERMA",
    "S/D/W of : RAMESH VERMA",
    "DOB : 15-08-1995   Blood Group : O+",
    "Address :",
    "12A MG ROAD, KOTHRUD",
    "PUNE 411038",
    "Date of Issue : 10-01-2020",
    "Validity (NT) : 14-08-2035",
    "COV : LMV, MCWG",
    "~ Holder's Signature rr",
  ].join("\n");
  const d = parseDlOcr(text);
  assert.equal(d.licenceNo, "MH12 20200012345");
  assert.equal(d.name, "ASHA VERMA");
  assert.equal(d.relation, "RAMESH VERMA");
  assert.equal(d.dob, "15-08-1995");
  assert.equal(d.bloodGroup, "O+");
  assert.equal(d.presentAddress, "12A MG ROAD, KOTHRUD PUNE 411038");
  assert.equal(d.issueDate, "10-01-2020");
  assert.equal(d.expiryDate, "14-08-2035");
  assert.equal(d.classes, "LMV,MCWG");
});

test("falls back to date order and next-line values when labels are sparse", () => {
  const d = parseDlOcr(["Name", "ASHA VERMA", "MH-12-2020-0012345", "15/08/1995", "10/01/2020", "14/08/2035"].join("\n"));
  assert.equal(d.name, "ASHA VERMA");
  assert.equal(d.licenceNo, "MH12 20200012345");
  assert.equal(d.dob, "15/08/1995");
  assert.equal(d.expiryDate, "14/08/2035");
});

test("finds DL numbers in common formats", () => {
  assert.equal(findLicenceNo("DL No: DL1 20230012345"), "DL1 20230012345");
  assert.equal(findLicenceNo("KA0120190012345"), "KA01 20190012345");
  assert.equal(findLicenceNo("no licence here 1234"), "");
});
