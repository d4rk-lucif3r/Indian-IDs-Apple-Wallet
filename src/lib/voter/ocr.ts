// Parses OCR output (English model) from an image-only e-EPIC. Hindi lines come out as junk;
// every field also appears in English, so only the English labels are used.
import { EPIC_PATTERN, type VoterDetails } from "./parse.ts";

export interface VoterOcrText {
  front: string; // card front
  back: string; // card back
  info: string; // details block below the cards
}

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const clean = (v: string) => v.replace(/\s+/g, " ").replace(/^[\s:;.,|-]+|[\s;|!]+$/g, "").trim();
// Address/value continuation lines are printed in capitals; OCR junk from Hindi has lowercase.
const CAPS_LINE = /^[A-Z0-9(][A-Z0-9 ,.\-()/&']*$/;

function after(text: string, label: RegExp): string {
  for (const line of lines(text)) {
    const m = label.exec(line);
    if (m) return clean(m[1] ?? "");
  }
  return "";
}

function withContinuation(text: string, label: RegExp, max = 3, stop = /Electoral|Officer/i): string {
  const ls = lines(text);
  const i = ls.findIndex((l) => label.test(l));
  if (i < 0) return "";
  const parts = [label.exec(ls[i])?.[1] ?? ""];
  for (const next of ls.slice(i + 1, i + 1 + max)) {
    if (stop.test(next) || !CAPS_LINE.test(next)) break;
    parts.push(next);
  }
  return clean(parts.join(" ")).replace(/\.$/, "");
}

// OCR confuses look-alike characters; EPIC numbers are 3 letters then 7 digits.
export function normalizeEpic(token: string): string | null {
  const t = token.toUpperCase().replace(/\s/g, "");
  if (t.length !== 10) return null;
  const letters = t.slice(0, 3).replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S").replace(/8/g, "B");
  const digits = t.slice(3).replace(/[OQD]/g, "0").replace(/[IL|]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2");
  const epic = letters + digits;
  return EPIC_PATTERN.test(epic) ? epic : null;
}

function findEpic(...texts: string[]): string {
  const labelled = after(texts.join("\n"), /Epic no\.?\s*[:;.]?\s*([A-Z0-9]{10})/i);
  for (const candidate of [labelled, ...texts.join(" ").match(/\b[A-Z0-9]{10}\b/g) ?? []]) {
    const epic = candidate && normalizeEpic(candidate);
    if (epic) return epic;
  }
  return "";
}

export function parseVoterOcr({ front, back, info }: VoterOcrText): Partial<VoterDetails> {
  const relation = lines(front)
    .map((l) => /(Father|Husband|Mother|Wife|Guardian)['’`]?s?\s*Name\s*[:;.]\s*(.+)$/i.exec(l))
    .find(Boolean);
  const name = lines(front)
    .filter((l) => !/Father|Husband|Mother|Wife|Guardian/i.test(l))
    .map((l) => /(?:^|[^A-Za-z])Name\s*[:;.]\s*(.+)$/i.exec(l)?.[1])
    .find(Boolean);
  const ero = withContinuation(back, /Electoral Registration Officer\s*,?\s*(.*)$/i, 1, /^$/);

  return {
    epicNo: findEpic(info, front, back),
    name: clean(name ?? ""),
    relationLabel: relation ? `${relation[1][0].toUpperCase()}${relation[1].slice(1).toLowerCase()}'s Name` : "",
    relationName: clean(relation?.[2] ?? ""),
    gender: /Gender[^\n]*?\b(Male|Female|Third Gender|Transgender|Other)\b/i.exec(front)?.[1] ?? "",
    dob:
      /(?:Date of Birth|DOB)[^\n]*?(\d{2}[-/.]\d{2}[-/.]\d{4})/i.exec(front)?.[1] ??
      (/\bAge\s*[:;.]\s*(\d{1,3})\b/i.exec(front)?.[1] ? `Age ${/\bAge\s*[:;.]\s*(\d{1,3})\b/i.exec(front)![1]}` : ""),
    address: withContinuation(back, /Address\s*[:;.]\s*(.*)$/i),
    ero,
    serialNo: after(info, /Serial No\.?\s*[:;.]?\s*(\d+)/i),
    constituency: after(info, /Assembly Constituency No\.? and Name\s*[:;.]?\s*(.+)$/i),
    part: after(info, /Part No\.? and Name\s*[:;.]?\s*(.+)$/i),
    pollingStation: withContinuation(info, /Polling Station Address\s*[:;.]?\s*(.*)$/i, 2),
  };
}

// Hindi-model OCR of the card's name block: "नाम: …" and "पिता का नाम: …" (or पति / माता).
// Background dots come through as trailing punctuation, so keep only the Devanagari words.
export function parseVoterHindi(text: string): Pick<VoterDetails, "nameHi" | "relationNameHi"> {
  const devanagariWords = (v: string) =>
    v.split(/\s+/).filter((w) => /^[\u0900-\u097F]+$/.test(w.replace(/[.,:ः]+$/u, ""))).map((w) => w.replace(/[.,:ः]+$/u, "")).join(" ");
  let nameHi = "";
  let relationNameHi = "";
  for (const line of lines(text)) {
    const relation = /(?:पिता|पति|माता|पत्नी)\s*का\s*नाम\s*[:ः]\s*(.+)$/u.exec(line);
    if (relation) relationNameHi ||= devanagariWords(relation[1]);
    else {
      const name = /नाम\s*[:ः]\s*(.+)$/u.exec(line);
      if (name) nameHi ||= devanagariWords(name[1]);
    }
  }
  return { nameHi, relationNameHi };
}
