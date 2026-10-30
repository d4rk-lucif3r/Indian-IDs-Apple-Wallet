import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync, gunzipSync } from "node:zlib";
import { parseSecureQr, formatAddress, SecureQrError } from "../src/lib/aadhaar/secureQr.ts";

const decompress = async (b: Uint8Array) => new Uint8Array(gunzipSync(b));

// Builds a synthetic Secure QR string in UIDAI's format.
function buildQr(fields: string[], photo: Uint8Array, hashCount: number): string {
  const enc = new TextEncoder();
  const parts: number[] = [];
  for (const f of fields) parts.push(...enc.encode(f), 0xff);
  parts.push(...photo);
  parts.push(...new Uint8Array(32 * hashCount).fill(0xab));
  parts.push(...new Uint8Array(256).fill(0xcd));
  const gz = gzipSync(Uint8Array.from(parts));
  return BigInt("0x" + Buffer.from(gz).toString("hex")).toString(10);
}

// Photo deliberately contains 0xFF bytes, like real JPEG 2000 data.
const photo = Uint8Array.from([0xff, 0x4f, 0xff, 0x51, 1, 2, 3, 0xff, 0xd9]);
const v2Fields = [
  "V2", "3", "123420190101120000000", "Asha Verma", "15-08-1995", "F",
  "D/O Ramesh Verma", "Pune", "Near Temple", "12A", "Kothrud", "411038",
  "Kothrud", "Maharashtra", "MG Road", "Haveli", "Pune", "9876",
];

test("parses a V2 QR with both hashes", async () => {
  const qr = await parseSecureQr(buildQr(v2Fields, photo, 2), decompress);
  assert.equal(qr.version, "V2");
  assert.equal(qr.name, "Asha Verma");
  assert.equal(qr.dob, "15-08-1995");
  assert.equal(qr.gender, "F");
  assert.equal(qr.last4, "1234");
  assert.equal(qr.mobileLast4, "9876");
  assert.equal(qr.address.pincode, "411038");
  assert.equal(qr.address.state, "Maharashtra");
  assert.deepEqual(qr.photo, photo);
  assert.equal(qr.signature.length, 256);
  assert.ok(qr.hasEmailHash && qr.hasMobileHash);
  assert.equal(
    formatAddress(qr.address),
    "D/O Ramesh Verma, 12A, MG Road, Near Temple, Kothrud, Pune, Haveli, Maharashtra - 411038",
  );
});

test("parses a legacy unversioned QR with no hashes", async () => {
  const v1 = v2Fields.slice(1, 17).map((f, i) => (i === 0 ? "0" : f));
  const qr = await parseSecureQr(buildQr(v1, photo, 0), decompress);
  assert.equal(qr.version, "V1");
  assert.equal(qr.name, "Asha Verma");
  assert.equal(qr.mobileLast4, null);
  assert.deepEqual(qr.photo, photo);
});

test("rejects old XML QR and garbage", async () => {
  await assert.rejects(parseSecureQr('<?xml version="1.0"?><PrintLetterBarcodeData/>', decompress), SecureQrError);
  await assert.rejects(parseSecureQr("hello", decompress), SecureQrError);
  await assert.rejects(parseSecureQr("9".repeat(400), decompress), SecureQrError);
});
