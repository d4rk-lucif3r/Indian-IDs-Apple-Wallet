// Parses OCR text from photos of physical driving licence cards. Card layouts differ by state and
// generation, so this reads common printed labels and falls back to patterns; every field stays
// editable in the UI.
import type { DlDetails } from "./parse.ts";

const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
const clean = (v: string) => v.replace(/\s+/g, " ").replace(/^[\s:;.,|-]+|[\s;|!]+$/g, "").trim();
const DATE = String.raw`(\d{2}[-/.]\d{2}[-/.]\d{4})`;
const SEP = String.raw`\s*[:;.\-]?\s*`;
const CAPS_LINE = /^[A-Z0-9(][A-Z0-9 ,.\-()/&']*$/;

function labelled(text: string, label: string, value: string): string {
  const m = new RegExp(`(?:${label})${SEP}${value}`, "i").exec(text);
  return m ? clean(m[m.length - 1]) : "";
}

// Value on the label's own line, or on the next line when the card prints labels above values.
function lineValue(ls: string[], label: RegExp, exclude?: RegExp): string {
  for (let i = 0; i < ls.length; i++) {
    if (exclude?.test(ls[i])) continue;
    const m = label.exec(ls[i]);
    if (!m) continue;
    const rest = clean(ls[i].slice(m.index + m[0].length));
    if (rest) return rest;
    const next = ls[i + 1];
    if (next && CAPS_LINE.test(next)) return clean(next);
  }
  return "";
}

// DL numbers: state code + RTO code + year of issue + 7 digits, e.g. "MH12 20200012345", "DL1 20230012345".
export function findLicenceNo(text: string): string {
  const m = /\b([A-Z]{2})[-\s]?(\d{1,2})[-\s]?((?:19|20)\d{2})[-\s]?(\d{7})\b/.exec(text.toUpperCase());
  return m ? `${m[1]}${m[2]} ${m[3]}${m[4]}` : "";
}

const CLASS_TOKENS = /\b(LMV-NT|LMV-TR|LMV|MCWG|MCWOG|MCEX|MGV|HGMV|HPMV|HMV|TRANS|INVCRG|E-RIKSHAW|ERIK)\b/g;

export function parseDlOcr(text: string): DlDetails {
  const ls = lines(text);
  const t = ls.join("\n");
  const dates = [...t.matchAll(new RegExp(DATE, "g"))].map((m) => m[1]);
  const year = (d: string) => Number(d.slice(-4));

  const dob = labelled(t, String.raw`D\.?O\.?B|Date of Birth`, DATE);
  const issueDate = labelled(t, String.raw`Date of Issue|Issue Date|D\.?O\.?I|Issued(?: on)?`, DATE);
  const expiryDate = labelled(t, String.raw`Valid(?:ity)?(?:\s*\((?:NT|TR)\))?(?:\s*(?:Till|Upto|Up to))?|Date of Expiry|Expiry`, DATE);
  // Without labels: the earliest year is the date of birth, the latest the expiry.
  const sorted = [...dates].sort((a, b) => year(a) - year(b));

  const classes = [...new Set((labelled(t, String.raw`COV|Class(?:es)? of Vehicle|Authori[sz]ation to Drive`, "(.+)") || t).toUpperCase().match(CLASS_TOKENS) ?? [])];

  const address = (() => {
    const i = ls.findIndex((l) => /Address/i.test(l));
    if (i < 0) return "";
    const parts = [ls[i].replace(/^.*Address\s*[:;.\-]?\s*/i, "")];
    for (const next of ls.slice(i + 1, i + 4)) {
      if (!CAPS_LINE.test(next) || /Valid|Issue|Blood|Sign|Holder/i.test(next)) break;
      parts.push(next);
    }
    return clean(parts.join(" "));
  })();

  return {
    licenceNo: findLicenceNo(t),
    name: lineValue(ls, /\bName\b/i, /S\s*\/\s*[DW]|Son|Daughter|Wife|Father|Guardian/i),
    dob: dob || (dates.length >= 2 ? sorted[0] : ""),
    bloodGroup: labelled(t, String.raw`Blood Group|B\.?G\.?`, String.raw`((?:AB|A|B|O)\s?(?:[+-]|\+ve|-ve|POS|NEG))`).replace(/\s/g, "").toUpperCase(),
    relation: lineValue(ls, /S\s*\/\s*[DW]\s*\/\s*[DW]\s*(?:of)?|Son\s*\/\s*Daughter\s*\/\s*Wife of|S\/O|D\/O|W\/O|Father'?s Name|Guardian/i),
    presentAddress: address,
    permanentAddress: "",
    classes: classes.join(","),
    issueDate,
    expiryDate: expiryDate || (dates.length >= 2 ? sorted[sorted.length - 1] : ""),
    issuingAuthority: labelled(t, String.raw`Issuing Authority|Licensing Authority`, "(.+)"),
  };
}
