// Fields printed on the e-Aadhaar PDF that aren't in the Secure QR.

// 16-digit Virtual ID, e.g. "VID : 9134 5678 9012 3456".
export function findVid(text: string): string | null {
  const match = /VID\s*:?\s*((?:\d\s*){16})/.exec(text);
  return match ? group4(match[1]) : null;
}

// Full 12-digit Aadhaar number, only on the regular (non-masked) e-Aadhaar.
// Must end in the QR's last 4 digits, which also rules out stray numbers and the VID. For OCR'd
// text (card photos), `checksum` also requires a valid Verhoeff check digit, as every Aadhaar
// number has, so a misread digit is rejected instead of printed on the card.
export function findAadhaarNumber(text: string, last4: string, { checksum = false } = {}): string | null {
  const withoutVid = text.replace(/VID\s*:?\s*(?:\d\s*){16}/g, " ");
  for (const match of withoutVid.matchAll(/(?<![\d])(\d{4}\s?\d{4}\s?\d{4})(?![\d])/g)) {
    const digits = match[1].replace(/\s/g, "");
    if (digits.endsWith(last4) && (!checksum || verhoeffValid(digits))) return group4(digits);
  }
  return null;
}

const VD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  let c = 0;
  [...digits].reverse().forEach((d, i) => (c = VD[c][VP[i % 8][Number(d)]]));
  return c === 0;
}

function group4(digits: string): string {
  return digits.replace(/\s/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
}
