// Fields printed on the e-Aadhaar PDF that aren't in the Secure QR.

// 16-digit Virtual ID, e.g. "VID : 9134 5678 9012 3456".
export function findVid(text: string): string | null {
  const match = /VID\s*:?\s*((?:\d\s*){16})/.exec(text);
  return match ? group4(match[1]) : null;
}

// Full 12-digit Aadhaar number, only on the regular (non-masked) e-Aadhaar.
// Must end in the QR's last 4 digits, which also rules out stray numbers and the VID.
export function findAadhaarNumber(text: string, last4: string): string | null {
  const withoutVid = text.replace(/VID\s*:?\s*(?:\d\s*){16}/g, " ");
  for (const match of withoutVid.matchAll(/(?<![\d])(\d{4}\s?\d{4}\s?\d{4})(?![\d])/g)) {
    const digits = match[1].replace(/\s/g, "");
    if (digits.endsWith(last4)) return group4(digits);
  }
  return null;
}

function group4(digits: string): string {
  return digits.replace(/\s/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
}
