// Parses OCR text from a photo of a physical PAN card. Newer cards label every field ("Name",
// "Father's Name", "Date of Birth"); older ones print the values in order under the header with no
// labels. Every field stays editable in the UI.
import type { PanDetails } from "./parse.ts";

// The 4th character is the holder type (P = person, C = company, H = HUF, …).
const PAN_TYPES = "PCHFATBLJG";
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B" };
const TO_DIGIT: Record<string, string> = { O: "0", D: "0", Q: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", B: "8", T: "7" };

// Fix the usual OCR confusions by position (5 letters, 4 digits, 1 letter), then validate.
export function normalisePan(token: string): string | null {
  const t = token.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.length !== 10) return null;
  const fixed = [...t].map((c, i) => (i >= 5 && i <= 8 ? (TO_DIGIT[c] ?? c) : (TO_LETTER[c] ?? c))).join("");
  return /^[A-Z]{3}[A-Z][A-Z]\d{4}[A-Z]$/.test(fixed) && PAN_TYPES.includes(fixed[3]) ? fixed : null;
}

const HEADER = /INCOME|TAX|DEPARTMENT|GOVT|GOVERNMENT|INDIA|PERMANENT|ACCOUNT|NUMBER|CARD|SIGNATURE|NAME|BIRTH|FATHER/;
// Strip OCR noise (stray symbols, misread Devanagari) around a value.
const cleanName = (l: string) => l.replace(/[^A-Z .'’]/g, " ").replace(/\s+/g, " ").trim();
const isName = (l: string) => {
  const c = cleanName(l);
  return c.length >= 3 && /^[A-Z][A-Z .'’]+$/.test(c) && !HEADER.test(c) && c.replace(/[^A-Z]/g, "").length >= 3;
};
const DATE = /(\d{2})\s*[/\-.]\s*(\d{2})\s*[/\-.]\s*(\d{4})/;
const toDate = (s: string) => {
  const m = DATE.exec(s);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
};

function findPan(lines: string[]): string {
  for (const l of lines) for (const tok of l.split(/\s+/)) {
    const pan = normalisePan(tok);
    if (pan) return pan;
  }
  // OCR sometimes splits it, e.g. "ABCDE 1234F".
  for (const l of lines) {
    const pan = normalisePan(l.replace(/\s+/g, ""));
    if (pan) return pan;
  }
  return "";
}

// Value after a label: rest of the label's line, or the next name-like line.
function after(lines: string[], label: RegExp, exclude?: RegExp): string {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (exclude?.test(l)) continue;
    const m = label.exec(l);
    if (!m) continue;
    const rest = l.slice(m.index + m[0].length);
    if (isName(rest)) return cleanName(rest);
    for (const next of lines.slice(i + 1, i + 3)) if (isName(next)) return cleanName(next);
  }
  return "";
}

export function parsePanOcr(text: string): PanDetails {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const pan = findPan(lines);
  const dobLine = lines.findIndex((l) => /Birth/i.test(l));
  const dob = (dobLine >= 0 ? toDate(lines.slice(dobLine, dobLine + 2).join(" ")) : "") || toDate(text);

  let name = after(lines, /\bName\b/i, /Father/i);
  let fatherName = after(lines, /Father['’]?s?\s*Name/i);
  if (!name && !fatherName) {
    // Older cards: name, then father's name, under the header and before the date of birth.
    const upTo = lines.findIndex((l) => DATE.test(l));
    const names = lines.slice(0, upTo < 0 ? undefined : upTo).filter(isName).map(cleanName);
    [name = "", fatherName = ""] = names;
  }
  return { pan, name, fatherName, dob };
}
