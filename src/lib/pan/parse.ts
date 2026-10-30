// Best-effort extraction of PAN details from e-PAN PDF text. The PAN QR is encrypted, so the
// printed text is the only readable source; results pre-fill an editable form.

export interface PanDetails {
  pan: string;
  name: string;
  fatherName: string;
  dob: string; // DD/MM/YYYY
}

export const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;

// A value ends where the next label (Devanagari or English), a digit, or the text ends.
const VALUE = String.raw`([A-Z][A-Z.' ]{0,80}?)(?=\s+(?:[ऀ-ॿ]|Father|Date|Signature|Name|\d)|\s*$)`;

// Some e-PANs (e.g. UTIITSL) bake the labels into a background image, so the PDF text is just
// the values in order: PAN, name, father's name, DOB, gender. Read them positionally.
const NAME_LINE = /^[A-Z][A-Z .'’-]{1,80}$/;
const DATE_LINE = /^\d{2}\/\d{2}\/\d{4}$/;

function parseUnlabelled(text: string): Omit<PanDetails, "pan"> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const start = lines.findIndex((l) => /^[A-Z]{5}\d{4}[A-Z]$/.test(l));
  if (start < 0) return { name: "", fatherName: "", dob: "" };
  const after = lines.slice(start + 1);
  const names = after.filter((l) => NAME_LINE.test(l) && !PAN_PATTERN.test(l));
  return { name: names[0] ?? "", fatherName: names[1] ?? "", dob: after.find((l) => DATE_LINE.test(l)) ?? "" };
}

export function parsePanText(text: string): PanDetails {
  const t = text.replace(/\s+/g, " ");
  const pan = /\b([A-Z]{5}\d{4}[A-Z])\b/.exec(t)?.[1] ?? "";
  const name = new RegExp(String.raw`(?<!Father['’]?s? )\bName\s*:?\s+` + VALUE).exec(t)?.[1] ?? "";
  const fatherName = new RegExp(String.raw`Father['’]?s? Name\s*:?\s+` + VALUE).exec(t)?.[1] ?? "";
  const dob =
    /Date of Birth\s*:?\s*(\d{2}\/\d{2}\/\d{4})/.exec(t)?.[1] ?? /\b(\d{2}\/\d{2}\/\d{4})\b/.exec(t)?.[1] ?? "";
  if (!name && !fatherName) {
    const fallback = parseUnlabelled(text);
    return { pan, ...fallback, dob: dob || fallback.dob };
  }
  return { pan, name: name.trim(), fatherName: fatherName.trim(), dob };
}

// e-PAN PDFs (Income Tax e-filing, Protean/NSDL, UTIITSL) open with the date of birth as DDMMYYYY.
export function panPdfPassword(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return m ? `${m[3]}${m[2]}${m[1]}` : null;
}
