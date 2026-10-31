"use client";

import { useEffect, useState } from "react";
import { EMPTY_VOTER, EPIC_PATTERN, parseVoterText, type VoterDetails } from "@/lib/voter/parse";
import { fieldLineConfidence, parseVoterHindi, parseVoterOcr } from "@/lib/voter/ocr";
import { makeReport } from "@/lib/client/report";
import type { DocDiagnostics, OcrRegion } from "@/lib/diagnostics";
import { PasswordRequiredError, scanDocument, scanWithPasswords } from "@/lib/client/scanDocument";
import { EPIC_PAGE_WIDTH, readVoterPage, type VoterPage } from "@/lib/client/voterCard";
import { renderVoterCard } from "@/lib/client/voterCardArt";
import { fileToCanvas, isPdf, recognize, type OcrResult } from "@/lib/client/ocr";
import FilePicker from "./FilePicker";
import AddToWalletButton from "./AddToWalletButton";
import DownloadLinks from "./DownloadLinks";
import ManualPassword from "./ManualPassword";
import DiagnosticsPanel from "./DiagnosticsPanel";
import PhotoPicker from "./PhotoPicker";

type State =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "password"; file: File; incorrect: boolean }
  | {
      step: "ready";
      source: "pdf" | "photo";
      photo: string | null; // from the e-EPIC card render, or added by the user for card photos
      qrText: string | null;
      ocr: "running" | "done" | "failed";
      report: string | null;
    }
  | { step: "error"; message: string; report: string | null };

const FIELDS: [keyof VoterDetails, string][] = [
  ["epicNo", "EPIC No."],
  ["name", "Name"],
  ["nameHi", "नाम (Hindi)"],
  ["relationName", "Father's / Husband's Name"],
  ["relationNameHi", "पिता / पति का नाम (Hindi)"],
  ["gender", "Gender"],
  ["dob", "Date of Birth / Age"],
  ["address", "Address"],
  ["ero", "Electoral Registration Officer"],
  ["constituency", "Assembly Constituency"],
  ["part", "Part No. and Name"],
  ["serialNo", "Serial No."],
  ["pollingStation", "Polling Station Address"],
];

// Text-layer values (exact) win over OCR (best effort); empty values never overwrite.
function merge(base: VoterDetails, extra: Partial<VoterDetails>): VoterDetails {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra) as [keyof VoterDetails, string][]) if (v && !out[k]) out[k] = v;
  return out;
}

async function ocrPage(page: VoterPage) {
  const front = await recognize(page.front);
  const back = await recognize(page.back);
  const info = await recognize(page.info, { psm: "6" });
  const names = await recognize(page.names, { psm: "6", lang: "hin" });
  const details: Partial<VoterDetails> = {
    ...parseVoterOcr({ front: front.text, back: back.text, info: info.text }),
    ...parseVoterHindi(names.text),
  };
  // Confidence only (no text) for reading reports: per region, and per field via its label's line.
  const regions: OcrRegion[] = [
    { name: "card front", lang: "eng", confidence: front.confidence },
    { name: "card back", lang: "eng", confidence: back.confidence },
    { name: "details block", lang: "eng", confidence: info.confidence },
    { name: "name block", lang: "hin", confidence: names.confidence },
  ];
  const fieldConfidence = fieldLineConfidence([...front.lines, ...back.lines, ...info.lines, ...names.lines]);
  return { details, regions, fieldConfidence };
}

function voterReport(
  diag: DocDiagnostics,
  outcome: string,
  details?: VoterDetails,
  ocr?: { regions: OcrRegion[]; fieldConfidence: Record<string, number | null> },
) {
  return makeReport({
    idType: "Voter ID (e-EPIC)",
    diag,
    outcome,
    fields: details ? Object.fromEntries(FIELDS.map(([k]) => [k, Boolean(details[k])])) : {},
    fieldConfidence: ocr?.fieldConfidence,
    ocrRegions: ocr?.regions,
  });
}

export default function VoterFlow() {
  const [state, setState] = useState<State>({ step: "idle" });
  const [details, setDetails] = useState<VoterDetails>(EMPTY_VOTER);
  const [card, setCard] = useState<string | null>(null);

  // Draw the card once details are in, and redraw as they're edited ("" = no photo yet).
  const cardPhoto = state.step === "ready" && state.ocr !== "running" ? (state.photo ?? "") : null;
  useEffect(() => {
    if (cardPhoto === null) return;
    let cancelled = false;
    renderVoterCard(details, cardPhoto || null).then((png) => !cancelled && setCard(png));
    return () => {
      cancelled = true;
    };
  }, [details, cardPhoto]);

  // Photos of a physical voter ID card (front, and optionally back): OCR every photo in English
  // and Hindi, and take the QR from whichever photo has it.
  async function readPhotos(files: File[]) {
    setState({ step: "reading" });
    try {
      const scans = await Promise.all(files.map((f) => scanDocument(f, { acceptQr: (q) => q.text.length >= 20 })));
      const qrText = scans.find((s) => s.qr)?.qr?.text ?? null;
      setDetails(EMPTY_VOTER);
      setCard(null);
      setState({ step: "ready", source: "photo", photo: null, qrText, ocr: "running", report: null });
      try {
        const eng: OcrResult[] = [], hin: OcrResult[] = [];
        for (const f of files) {
          const canvas = await fileToCanvas(f);
          eng.push(await recognize(canvas));
          hin.push(await recognize(canvas, { lang: "hin" }));
        }
        const engText = eng.map((r) => r.text).join("\n");
        const parsed: VoterDetails = {
          ...EMPTY_VOTER,
          ...parseVoterOcr({ front: engText, back: engText, info: engText }),
          ...parseVoterHindi(hin.map((r) => r.text).join("\n")),
        };
        setDetails(parsed);
        const regions: OcrRegion[] = files.flatMap((_, i) => [
          { name: `photo ${i + 1}`, lang: "eng" as const, confidence: eng[i].confidence },
          { name: `photo ${i + 1}`, lang: "hin" as const, confidence: hin[i].confidence },
        ]);
        const fieldConfidence = fieldLineConfidence([...eng, ...hin].flatMap((r) => r.lines));
        const missing = FIELDS.filter(([k]) => !parsed[k]).map(([k]) => k);
        const outcome = `${files.length} card photo(s), OCR; ${missing.length ? `missing: ${missing.join(", ")}` : "all fields read"}`;
        setState({
          step: "ready", source: "photo", photo: null, qrText, ocr: "done",
          report: voterReport(scans[0].diagnostics, outcome, parsed, { regions, fieldConfidence }),
        });
      } catch (err) {
        console.warn("OCR failed", err);
        setState({ step: "ready", source: "photo", photo: null, qrText, ocr: "failed", report: voterReport(scans[0].diagnostics, "OCR failed") });
      }
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "Couldn't read these photos.", report: null });
    }
  }

  async function read(file: File, passwords: string[] = []) {
    setState({ step: "reading" });
    try {
      const scanned = await scanWithPasswords(file, passwords, {
        acceptQr: (q) => q.text.length >= 20,
        pageWidth: EPIC_PAGE_WIDTH,
      });
      if (!scanned.page) throw new Error("Upload the e-EPIC PDF downloaded from voters.eci.gov.in.");
      let page: VoterPage;
      try {
        page = readVoterPage(scanned.page);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Couldn't read this e-EPIC.";
        setState({ step: "error", message, report: voterReport(scanned.diagnostics, "card layout not recognised as an e-EPIC") });
        return;
      }
      const fromText = parseVoterText(scanned.text, file.name);
      setDetails(fromText);
      setCard(null);
      const qrText = scanned.qr?.text ?? null;
      setState({ step: "ready", source: "pdf", photo: page.photo, qrText, ocr: "running", report: null });

      // OCR fills whatever the text layer couldn't (all of it, for image-only e-EPICs).
      try {
        const ocr = await ocrPage(page);
        // Fields are locked while OCR runs, so nothing user-edited is overwritten here. For
        // image-only files a valid OCR'd EPIC beats one guessed from the file name.
        const base = scanned.text.trim() ? fromText : { ...fromText, epicNo: ocr.details.epicNo || fromText.epicNo };
        const merged = merge(base, ocr.details);
        setDetails(merged);
        const missing = FIELDS.filter(([k]) => !merged[k]).map(([k]) => k);
        const outcome = `${scanned.text.trim() ? "text layer + OCR" : "image-only, OCR"}; ${missing.length ? `missing: ${missing.join(", ")}` : "all fields read"}`;
        setState({ step: "ready", source: "pdf", photo: page.photo, qrText, ocr: "done", report: voterReport(scanned.diagnostics, outcome, merged, ocr) });
      } catch (err) {
        console.warn("OCR failed", err);
        setState({ step: "ready", source: "pdf", photo: page.photo, qrText, ocr: "failed", report: voterReport(scanned.diagnostics, "OCR failed", fromText) });
      }
    } catch (err) {
      if (err instanceof PasswordRequiredError) setState({ step: "password", file, incorrect: err.incorrect });
      else setState({ step: "error", message: err instanceof Error ? err.message : "Something went wrong.", report: null });
    }
  }

  if (state.step === "password") {
    return <ManualPassword incorrect={state.incorrect} onSubmit={(p) => read(state.file, [p])} />;
  }

  if (state.step === "ready") {
    const { qrText, ocr, source, photo } = state;
    const valid = EPIC_PATTERN.test(details.epicNo) && ocr !== "running" && !!card;
    return (
      <div className="space-y-4">
        {card ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL
          <img src={card} alt="Voter ID card" className="w-full rounded-xl shadow-lg" />
        ) : (
          <div className="flex aspect-[1125/432] w-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-900">
            Reading your card…
          </div>
        )}
        <p className="text-xs text-neutral-500">
          {qrText ? "The original QR will be added to the pass." : "No QR was found, so the pass won't have one."}
        </p>
        {source === "photo" && ocr !== "running" && (
          <PhotoPicker hasPhoto={!!photo} onPhoto={(p) => setState({ ...state, photo: p })} />
        )}
        <p className="text-xs text-neutral-500">
          {ocr === "running" && "Reading the details on your card… (first time downloads ~7 MB of text-recognition data)"}
          {ocr === "done" &&
            (source === "photo"
              ? "Read from your photos with on-device text recognition — check every field against your card; the card updates as you edit."
              : "Details read from your e-EPIC — check them; the card updates as you edit.")}
          {ocr === "failed" && "Couldn't read the details automatically — fill them in and the card updates as you type."}
        </p>
        <div className="space-y-3">
          {FIELDS.map(([key, label]) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs text-neutral-500">{key === "relationName" && details.relationLabel ? details.relationLabel : label}</span>
              <input
                className="w-full min-w-0 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-neutral-700"
                value={details[key]}
                disabled={ocr === "running"}
                {...(key === "epicNo" ? { maxLength: 10, autoCapitalize: "characters" } : {})}
                onChange={(e) =>
                  setDetails({ ...details, [key]: key === "epicNo" ? e.target.value.toUpperCase() : e.target.value })
                }
              />
            </label>
          ))}
        </div>
        {/* A real form POST (not fetch) so iOS Safari opens the .pkpass and offers "Add to Apple Wallet". */}
        <form method="POST" action="/api/pass/voter">
          {Object.entries(details).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="strip" value={card ?? ""} />
          <input type="hidden" name="qr" value={qrText ?? ""} />
          <AddToWalletButton
            ready={valid}
            waitingText={ocr === "running" ? "Reading details…" : "Enter a valid EPIC No. to continue"}
          />
        </form>
        <button className="w-full text-sm text-neutral-500 underline" onClick={() => setState({ step: "idle" })}>
          Use a different file
        </button>
        {state.report && <DiagnosticsPanel idType="Voter ID (e-EPIC)" report={state.report} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilePicker
        title="Choose e-EPIC PDF or card photos"
        hint="The e-EPIC from the ECI voters portal, or clear photos of your voter ID card (front, and back for the QR)"
        accept="application/pdf,image/*"
        multiple
        busy={state.step === "reading"}
        error={state.step === "error" ? state.message : undefined}
        onFile={(file, all) => {
          const pdf = all.find(isPdf);
          if (pdf) read(pdf);
          else readPhotos(all.slice(0, 2));
        }}
      />
      {state.step === "error" && state.report && <DiagnosticsPanel idType="Voter ID (e-EPIC)" report={state.report} />}
      <DownloadLinks
        title="Don't have your e-EPIC?"
        description="Download it free from the ECI voters portal (log in with your mobile number, then e-EPIC Download), then come back and upload it."
        sources={[{ name: "ECI e-EPIC download", href: "https://voters.eci.gov.in/home/e-epic-download" }]}
      />
    </div>
  );
}
