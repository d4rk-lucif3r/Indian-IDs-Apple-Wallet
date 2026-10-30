// Parses the DigiLocker driving licence certificate. Its PDF text comes out one item per line:
// label, ":", value — with addresses spread over several lines.

export interface DlDetails {
  licenceNo: string;
  name: string;
  dob: string; // DD-MM-YYYY, as printed
  bloodGroup: string;
  relation: string; // S/W/D (son/wife/daughter of)
  presentAddress: string;
  permanentAddress: string;
  classes: string; // authorization to drive, e.g. "LMV,MCWG"
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
}

const LABELS: Record<string, keyof DlDetails> = {
  "authorization to drive": "classes",
  "date of issue": "issueDate",
  "license no.": "licenceNo",
  "licence no.": "licenceNo",
  "date of expiry": "expiryDate",
  name: "name",
  dob: "dob",
  "blood group": "bloodGroup",
  "s/w/d": "relation",
  "present address": "presentAddress",
  "permanent address": "permanentAddress",
};

export function parseDlText(text: string): DlDetails {
  const details: DlDetails = {
    licenceNo: "", name: "", dob: "", bloodGroup: "", relation: "", presentAddress: "",
    permanentAddress: "", classes: "", issueDate: "", expiryDate: "", issuingAuthority: "",
  };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let current: keyof DlDetails | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^note\s*:/i.test(line)) break;

    const authority = /^Issuing Authority\s*:\s*(.+)$/i.exec(line);
    if (authority) {
      details.issuingAuthority = authority[1];
      current = null;
      continue;
    }
    // "Permanent" / "Address" arrive as two separate items.
    if (/^permanent$/i.test(line) && /^address\b/i.test(lines[i + 1] ?? "")) {
      line = "Permanent Address";
      i++;
    }
    const key = LABELS[line.replace(/\s*:\s*$/, "").toLowerCase()];
    if (key) {
      current = key;
      continue;
    }
    if (line === ":" || !current) continue;
    const value = line.replace(/^:\s*/, "");
    details[current] = details[current] ? `${details[current]} ${value}` : value;
  }
  return details;
}
