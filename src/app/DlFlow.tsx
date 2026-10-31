"use client";

import { useEffect, useState } from "react";
import { parseDlText, type DlDetails } from "@/lib/dl/parse";
import { parseDlOcr } from "@/lib/dl/ocr";
import { PasswordRequiredError, scanDocument, scanWithPasswords, type ScannedDocument } from "@/lib/client/scanDocument";
import { fileToCanvas, isPdf, recognize } from "@/lib/client/ocr";
import { renderDlCard } from "@/lib/client/dlCard";
import { makeReport } from "@/lib/client/report";
import FilePicker from "./FilePicker";
import DiagnosticsPanel from "./DiagnosticsPanel";
import AddToWalletButton from "./AddToWalletButton";
import DownloadLinks from "./DownloadLinks";
import ManualPassword from "./ManualPassword";
import PhotoPicker from "./PhotoPicker";

type Source = "pdf" | "photo";

type State =
  | { step: "idle" }
  | { step: "reading"; what: string }
  | { step: "password"; file: File; incorrect: boolean }
  | { step: "ready"; source: Source; photo: string | null; qrText: string | null; report: string }
  | { step: "error"; message: string; report: string | null };

const EMPTY: DlDetails = {
  licenceNo: "", name: "", dob: "", bloodGroup: "", relation: "", presentAddress: "",
  permanentAddress: "", classes: "", issueDate: "", expiryDate: "", issuingAuthority: "",
};

const FIELDS: [keyof DlDetails, string][] = [
  ["licenceNo", "Licence No."],
  ["name", "Name"],
  ["dob", "Date of Birth"],
  ["bloodGroup", "Blood Group"],
  ["relation", "S/W/D of"],
  ["presentAddress", "Address"],
  ["classes", "Authorization to Drive (e.g. LMV,MCWG)"],
  ["issueDate", "Date of Issue"],
  ["expiryDate", "Valid Till"],
  ["issuingAuthority", "Issuing Authority"],
];

const input = "w-full min-w-0 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";

function report(details: DlDetails, scans: ScannedDocument[], source: Source, extra: Record<string, boolean>) {
  const found = { ...Object.fromEntries(FIELDS.map(([k]) => [k, Boolean(details[k])])), ...extra };
  const missing = Object.entries(found).filter(([, ok]) => !ok).map(([f]) => f);
  return makeReport({
    idType: `Driving Licence (${source === "pdf" ? "DigiLocker PDF" : `${scans.length} photo(s)`})`,
    diag: scans[0]?.diagnostics ?? null,
    fields: found,
    outcome: missing.length ? `read with missing fields: ${missing.join(", ")}` : "all fields read",
  });
}

export default function DlFlow() {
  const [state, setState] = useState<State>({ step: "idle" });
  const [details, setDetails] = useState<DlDetails>(EMPTY);
  const [card, setCard] = useState<string | null>(null);

  // Draw the card, and redraw as details or the photo change.
  const ready = state.step === "ready" ? state : null;
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    renderDlCard(details, ready.photo).then((png) => !cancelled && setCard(png));
    return () => {
      cancelled = true;
    };
  }, [details, ready]);

  async function readPdf(file: File, passwords: string[] = []) {
    setState({ step: "reading", what: "Reading…" });
    try {
      // The DigiLocker QR is a short JSON payload; anything readable and non-trivial qualifies.
      const scanned = await scanWithPasswords(file, passwords, (q) => q.text.length >= 20);
      const parsed = parseDlText(scanned.text);
      const r = report(parsed, [scanned], "pdf", { photo: Boolean(scanned.photo), qr: Boolean(scanned.qr) });
      if (!parsed.licenceNo || !parsed.name) {
        setState({
          step: "error",
          message: "Couldn't read this licence. Upload the DigiLocker Driving Licence PDF, or photos of your card.",
          report: r,
        });
        return;
      }
      setDetails(parsed);
      setCard(null);
      setState({ step: "ready", source: "pdf", photo: scanned.photo, qrText: scanned.qr?.text ?? null, report: r });
    } catch (err) {
      if (err instanceof PasswordRequiredError) setState({ step: "password", file, incorrect: err.incorrect });
      else setState({ step: "error", message: err instanceof Error ? err.message : "Something went wrong.", report: null });
    }
  }

  // Photos of the card (front and optionally back): QR from whichever has it, OCR on all of them.
  async function readPhotos(files: File[]) {
    try {
      setState({ step: "reading", what: "Reading your card… (first time downloads ~4 MB of text recognition)" });
      const scans = await Promise.all(files.map((f) => scanDocument(f, { acceptQr: (q) => q.text.length >= 20 })));
      const texts: string[] = [];
      for (const f of files) texts.push((await recognize(await fileToCanvas(f))).text);
      const parsed = parseDlOcr(texts.join("\n"));
      const qrText = scans.find((s) => s.qr)?.qr?.text ?? null;
      setDetails(parsed);
      setCard(null);
      setState({ step: "ready", source: "photo", photo: null, qrText, report: report(parsed, scans, "photo", { qr: Boolean(qrText) }) });
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "Couldn't read these photos.", report: null });
    }
  }

  if (state.step === "password") {
    return <ManualPassword incorrect={state.incorrect} onSubmit={(p) => readPdf(state.file, [p])} />;
  }

  if (state.step === "ready") {
    const { qrText, photo, source } = state;
    const valid = details.licenceNo.trim().length > 0 && details.name.trim().length > 0 && !!card;
    return (
      <div className="space-y-4">
        {card && (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL
          <img src={card} alt={`Driving licence for ${details.name}`} className="w-full rounded-xl shadow-lg" />
        )}
        <p className="text-xs text-neutral-500">
          {source === "pdf"
            ? "Check the details read from your licence."
            : "Read from your photos with on-device text recognition. Check every field against your card."}
          {qrText ? " The original QR will be added to the pass." : " No QR was found, so the pass won't have one."}
        </p>
        <PhotoPicker hasPhoto={!!photo} onPhoto={(p) => setState({ ...state, photo: p })} />
        <div className="space-y-3">
          {FIELDS.map(([key, label]) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs text-neutral-500">{label}</span>
              <input
                className={input}
                value={details[key]}
                onChange={(e) => setDetails({ ...details, [key]: e.target.value.toUpperCase() })}
              />
            </label>
          ))}
        </div>
        {/* A real form POST (not fetch) so iOS Safari opens the .pkpass and offers "Add to Apple Wallet". */}
        <form method="POST" action="/api/pass/dl">
          {Object.entries(details).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="strip" value={card ?? ""} />
          <input type="hidden" name="qr" value={qrText ?? ""} />
          <AddToWalletButton ready={valid} waitingText="Enter the licence number and name to continue" />
        </form>
        <button className="w-full text-sm text-neutral-500 underline" onClick={() => setState({ step: "idle" })}>
          Use a different file
        </button>
        <DiagnosticsPanel idType="Driving Licence" report={state.report} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilePicker
        title="Choose Driving Licence PDF or photos"
        hint="The DigiLocker PDF, or clear photos of your card (front, and back if it has the QR)"
        accept="application/pdf,image/*"
        multiple
        busy={state.step === "reading"}
        error={state.step === "error" ? state.message : undefined}
        onFile={(file, all) => {
          const pdf = all.find(isPdf);
          if (pdf) readPdf(pdf);
          else readPhotos(all.slice(0, 2));
        }}
      />
      {state.step === "reading" && <p className="text-center text-xs text-neutral-500">{state.what}</p>}
      {state.step === "error" && state.report && <DiagnosticsPanel idType="Driving Licence" report={state.report} />}
      <DownloadLinks
        title="Don't have it?"
        description="Open DigiLocker, go to Issued Documents → Driving License (pull it from your state's transport department if it isn't there yet), download the PDF, then come back and upload it. Or upload clear photos of your physical card."
        sources={[{ name: "DigiLocker → Issued Documents", href: "https://www.digilocker.gov.in/" }]}
      />
    </div>
  );
}
