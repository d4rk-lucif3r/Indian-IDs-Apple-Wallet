// Privacy-safe "reading report" for documents the app fails to read. Built on the device and only
// shared if the user copies it. It describes the document's SHAPE — page size, text layer, images,
// QR length, which fields were found, OCR confidence — and never any value from it: the builder
// only accepts numbers, booleans and fixed keywords, so names, numbers and text can't leak in.

export interface ImageInfo {
  w: number;
  h: number;
  drawnW?: number; // size as drawn on the page, in PDF points
  drawnH?: number;
  role: "photo" | "signature" | "background" | "other";
}

export interface DocDiagnostics {
  kind: "pdf" | "image";
  pages?: number;
  pageSizePt?: [number, number];
  passwordProtected?: boolean;
  producer?: string | null; // PDF software that made the file (sanitised)
  creator?: string | null;
  textItems?: number;
  textChars?: number;
  images?: ImageInfo[];
  imageSizePx?: [number, number]; // for photo/screenshot uploads
  qr: { found: boolean; chars?: number; bytes?: number; digitsOnly?: boolean };
  issuerHints: string[];
}

export interface OcrRegion {
  name: string;
  lang: "eng" | "hin";
  confidence: number; // 0–100
}

// Fixed keyword list: only these words can ever appear in a report as "issuer hints".
export const ISSUER_KEYWORDS = [
  "UTIITSL", "Protean", "NSDL", "Income Tax Department", "DigiLocker", "Election Commission of India",
  "UIDAI", "Unique Identification Authority", "Parivahan", "Transport Department", "ePAN", "e-EPIC",
];

// Matches against document text and the file name (agencies often name files after themselves,
// e.g. "UTIITSL_ePAN_…"); only the fixed keywords above can ever come out, never the input itself.
export function issuerHints(text: string): string[] {
  const t = text.toLowerCase();
  return ISSUER_KEYWORDS.filter((k) => t.includes(k.toLowerCase()));
}

// PDF producer/creator strings come from the file; keep plain software-name characters only.
export function sanitizeMeta(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[^A-Za-z0-9 .,()/®©:+_-]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return clean || null;
}

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);
const yes = (b: boolean | undefined) => (b ? "yes" : "no");

export interface ReportInput {
  idType: string;
  diag: DocDiagnostics | null;
  fields: Record<string, boolean>;
  fieldConfidence?: Record<string, number | null>;
  ocrRegions?: OcrRegion[];
  outcome: string; // e.g. "parsed with missing fields", "not recognised as an e-EPIC"
  appVersion: string;
  browser: string;
}

export function buildReport(r: ReportInput): string {
  const lines: string[] = [
    `### Reading report: ${r.idType}`,
    "_Generated on-device. Contains no names, numbers, photos or text from the document, only its layout._",
    "",
    `- **Outcome:** ${r.outcome}`,
    `- **App:** terms ${r.appVersion} · ${r.browser}`,
  ];
  const d = r.diag;
  if (d) {
    lines.push("", "**Document**");
    if (d.kind === "pdf") {
      lines.push(
        `- PDF · ${d.pages ?? "?"} page(s) · ${d.pageSizePt ? `${d.pageSizePt[0]}×${d.pageSizePt[1]} pt` : "size ?"} · password-protected: ${yes(d.passwordProtected)}`,
        `- Text layer: ${d.textItems ? `yes (${d.textItems} items, ${d.textChars} chars)` : "none (image-only)"}`,
        `- Producer: ${d.producer ?? "—"} · Creator: ${d.creator ?? "—"}`,
      );
      const imgs = (d.images ?? []).slice(0, 12).map((i) =>
        `${i.w}×${i.h}px${i.drawnW ? ` drawn ${Math.round(i.drawnW)}×${Math.round(i.drawnH ?? 0)}pt` : ""} (${i.role})`);
      lines.push(`- Images: ${imgs.length ? imgs.join(" · ") : "none"}${(d.images?.length ?? 0) > 12 ? " · …" : ""}`);
    } else {
      lines.push(`- Image upload${d.imageSizePx ? ` · ${d.imageSizePx[0]}×${d.imageSizePx[1]} px` : ""}`);
    }
    lines.push(
      `- QR: ${d.qr.found ? `found · ${d.qr.chars} chars · ${d.qr.bytes} bytes · ${d.qr.digitsOnly ? "digits only" : "binary/text"}` : "not found"}`,
      `- Issuer hints: ${d.issuerHints.length ? d.issuerHints.join(", ") : "none"}`,
    );
  }
  const names = Object.keys(r.fields);
  if (names.length) {
    const withConf = r.fieldConfidence && Object.keys(r.fieldConfidence).length > 0;
    lines.push("", "**Fields**", "", withConf ? "| Field | Found | OCR line confidence |" : "| Field | Found |", withConf ? "|---|---|---|" : "|---|---|");
    for (const f of names) {
      lines.push(withConf ? `| ${f} | ${yes(r.fields[f])} | ${pct(r.fieldConfidence?.[f])} |` : `| ${f} | ${yes(r.fields[f])} |`);
    }
  }
  if (r.ocrRegions?.length) {
    lines.push("", "**OCR regions**", ...r.ocrRegions.map((o) => `- ${o.name} (${o.lang === "hin" ? "Hindi" : "English"}): ${pct(o.confidence)}`));
  }
  return lines.join("\n");
}

// Coarse browser label for the report (no version strings or device identifiers).
export function browserLabel(ua: string): string {
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : "other OS";
  const br = /CriOS|Chrome/.test(ua) ? "Chrome" : /FxiOS|Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "other browser";
  return `${br} on ${os}`;
}
