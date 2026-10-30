// e-EPIC (Voter ID) details. Some e-EPIC PDFs carry text; newer downloads are a single image,
// so the EPIC number may only be recoverable from the file name (e-EPIC_ABC1234567.pdf).

export interface VoterDetails {
  epicNo: string;
  name: string;
  nameHi: string; // Hindi name as printed (नाम)
  relationLabel: string; // e.g. "Father's Name", as printed
  relationName: string;
  relationNameHi: string;
  gender: string;
  dob: string;
  address: string;
  ero: string; // Electoral Registration Officer (constituency)
  serialNo: string;
  constituency: string; // Assembly Constituency No. and Name
  part: string; // Part No. and Name
  pollingStation: string;
}

export const EPIC_PATTERN = /^[A-Z]{3}\d{7}$/;

export const EMPTY_VOTER: VoterDetails = {
  epicNo: "", name: "", nameHi: "", relationLabel: "", relationName: "", relationNameHi: "", gender: "", dob: "", address: "", ero: "",
  serialNo: "", constituency: "", part: "", pollingStation: "",
};

const DEVANAGARI = /[ऀ-ॿ]/;

// Value is the next line that isn't a Devanagari fragment or another label. With `wrap`, a long
// value continues onto following all-caps lines (e.g. the polling station address).
function valueAfter(lines: string[], label: RegExp, wrap = false): string {
  const i = lines.findIndex((l) => label.test(l));
  if (i < 0) return "";
  const rest = lines.slice(i + 1, i + 8);
  const start = rest.findIndex((l) => !DEVANAGARI.test(l) && !l.endsWith(":"));
  if (start < 0) return "";
  const parts = [rest[start]];
  if (wrap) {
    for (const next of rest.slice(start + 1, start + 3)) {
      if (!/^[A-Z][A-Z0-9 ,.()/&-]*$/.test(next)) break;
      parts.push(next);
    }
  }
  return parts.join(" ");
}

export function parseVoterText(text: string, fileName = ""): VoterDetails {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const epicFromText = valueAfter(lines, /Epic no\.?\s*:?$/i);
  const epicFromName = /([A-Z]{3}\d{7})/.exec(fileName.toUpperCase())?.[1] ?? "";
  return {
    ...EMPTY_VOTER,
    epicNo: EPIC_PATTERN.test(epicFromText) ? epicFromText : epicFromName,
    serialNo: valueAfter(lines, /Serial No\.?\s*:?$/i),
    constituency: valueAfter(lines, /Assembly Constituency No\. and Name\s*:?$/i),
    part: valueAfter(lines, /Part No\. and Name\s*:?$/i),
    pollingStation: valueAfter(lines, /Polling Station Address\s*:?$/i, true),
  };
}
