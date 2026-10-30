// Parser for the UIDAI Aadhaar Secure QR (the dense numeric QR on e-Aadhaar / PVC cards).
//
// Format, per UIDAI's Secure QR spec:
//   decimal big integer -> big-endian bytes -> gzip -> payload
//   payload = text fields separated by 0xFF, then photo (JPEG 2000),
//             optional SHA-256 hashes of email/mobile (32 bytes each), RSA signature (256 bytes).
//
// This module is runtime-agnostic: decompression is injected so it works in the browser
// (DecompressionStream) and on the server (node:zlib).

const DELIMITER = 0xff;
const SIGNATURE_LENGTH = 256;
const HASH_LENGTH = 32;

export type Decompress = (bytes: Uint8Array) => Promise<Uint8Array>;

export interface AadhaarSecureQr {
  version: string; // "V1" for legacy (unversioned) QRs, otherwise the QR's own tag, e.g. "V2"
  referenceId: string;
  last4: string;
  name: string;
  dob: string;
  gender: string;
  address: {
    careOf: string;
    house: string;
    street: string;
    landmark: string;
    location: string;
    vtc: string;
    postOffice: string;
    subDistrict: string;
    district: string;
    state: string;
    pincode: string;
  };
  mobileLast4: string | null;
  hasEmailHash: boolean;
  hasMobileHash: boolean;
  photo: Uint8Array; // JPEG 2000
  signedData: Uint8Array;
  signature: Uint8Array;
}

export class SecureQrError extends Error {}

export function isSecureQrText(text: string): boolean {
  return /^\d{200,}$/.test(text.trim());
}

export function decimalToBytes(decimal: string): Uint8Array {
  let hex = BigInt(decimal.trim()).toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const latin1 = new TextDecoder("latin1");

export async function parseSecureQr(text: string, decompress: Decompress): Promise<AadhaarSecureQr> {
  if (text.trim().startsWith("<")) {
    throw new SecureQrError(
      "This is an old-style Aadhaar QR. Please download a fresh e-Aadhaar, which has the Secure QR.",
    );
  }
  if (!isSecureQrText(text)) {
    throw new SecureQrError("This doesn't look like an Aadhaar Secure QR.");
  }

  let data: Uint8Array;
  try {
    data = await decompress(decimalToBytes(text));
  } catch {
    throw new SecureQrError("Couldn't decode the QR data. Try a clearer scan or the original PDF.");
  }

  // Only the leading text fields are delimited; the photo can itself contain 0xFF bytes,
  // so we read the first field to learn the version, then take exactly that many delimiters.
  const firstEnd = data.indexOf(DELIMITER);
  if (firstEnd < 0) throw new SecureQrError("Malformed Secure QR payload.");
  const first = latin1.decode(data.subarray(0, firstEnd));
  const versioned = /^V\d+$/.test(first);
  const textFieldCount = versioned ? 18 : 16;

  const fields: string[] = [];
  let start = 0;
  for (let i = 0; i < textFieldCount; i++) {
    const end = data.indexOf(DELIMITER, start);
    if (end < 0) throw new SecureQrError("Malformed Secure QR payload.");
    fields.push(latin1.decode(data.subarray(start, end)));
    start = end + 1;
  }

  const f = versioned ? fields.slice(1) : fields;
  const indicator = Number(f[0]);
  const hasEmailHash = indicator === 1 || indicator === 3;
  const hasMobileHash = indicator === 2 || indicator === 3;
  const hashBytes = (hasEmailHash ? HASH_LENGTH : 0) + (hasMobileHash ? HASH_LENGTH : 0);

  const signatureStart = data.length - SIGNATURE_LENGTH;
  const photoEnd = signatureStart - hashBytes;
  if (photoEnd <= start) throw new SecureQrError("Malformed Secure QR payload.");

  const referenceId = f[1];
  return {
    version: versioned ? first : "V1",
    referenceId,
    last4: referenceId.slice(0, 4),
    name: f[2],
    dob: f[3],
    gender: f[4],
    address: {
      careOf: f[5],
      district: f[6],
      landmark: f[7],
      house: f[8],
      location: f[9],
      pincode: f[10],
      postOffice: f[11],
      state: f[12],
      street: f[13],
      subDistrict: f[14],
      vtc: f[15],
    },
    mobileLast4: versioned ? f[16] || null : null,
    hasEmailHash,
    hasMobileHash,
    photo: data.slice(start, photoEnd),
    signedData: data.slice(0, signatureStart),
    signature: data.slice(signatureStart),
  };
}

export function formatAddress(a: AadhaarSecureQr["address"], { includeCareOf = true } = {}): string {
  const parts = [includeCareOf ? a.careOf : "", a.house, a.street, a.landmark, a.location, a.vtc, a.postOffice, a.subDistrict, a.district, a.state];
  const seen = new Set<string>();
  const line = parts
    .map((p) => p.trim())
    .filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()))
    .join(", ");
  return a.pincode ? `${line} - ${a.pincode}` : line;
}

export function maskedAadhaar(last4: string): string {
  return `XXXX XXXX ${last4}`;
}
