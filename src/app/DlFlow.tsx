"use client";

import { useEffect, useState } from "react";
import { parseDlText, type DlDetails } from "@/lib/dl/parse";
import { parseDlOcr } from "@/lib/dl/ocr";
import { PasswordRequiredError, scanDocument, scanWithPasswords, type ScannedDocument } from "@/lib/client/scanDocument";
import { fileToCanvas, recognize } from "@/lib/client/ocr";
import { renderDlCard } from "@/lib/client/dlCard";
import { makeReport } from "@/lib/client/report";
import FilePicker from "./FilePicker";
import DiagnosticsPanel from "./DiagnosticsPanel";
import AddToWalletButton from "./AddToWalletButton";
import DownloadLinks from "./DownloadLinks";
import ManualPassword from "./ManualPassword";
import PhotoPicker from "./PhotoPicker";
import CardPhotos, { AddBackPhoto } from "./CardPhotos";

type Source = "pdf" | "photo";
// What was read from card photos, kept so a back photo can be added later.
type PhotoRead = { scans: ScannedDocument[]; texts: string[] };

type State =
  | { step: "idle" }
  | { step: "reading"; what: string }
  | { step: "password"; file: File; incorrect: boolean }
  | { step: "ready"; source: Source; photo: string | null; qrText: string | null; report: string; photoRead?: PhotoRead; addingBack?: boolean }
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

  // One card photo: QR (if it has one) and on-device OCR text.
  async function readPhoto(file: File) {
    const scan = await scanDocument(file, { acceptQr: (q) => q.text.length >= 20 });
    const text = (await recognize(await fileToCanvas(file))).text;
    return { scan, text };
  }

  function fromPhotos(r: PhotoRead) {
    const parsed = parseDlOcr(r.texts.join("\n"));
    const qrText = r.scans.find((s) => s.qr)?.qr?.text ?? null;
    return { parsed, qrText, report: report(parsed, r.scans, "photo", { qr: Boolean(qrText) }) };
  }

  // Photos of the card (front, and optionally back): QR from whichever has it, OCR on all of them.
  async function readPhotos(files: File[]) {
    try {
      setState({ step: "reading", what: "Reading your card… (first time downloads ~4 MB of text recognition)" });
      const read: PhotoRead = { scans: [], texts: [] };
      for (const f of files) {
        const { scan, text } = await readPhoto(f);
        read.scans.push(scan);
        read.texts.push(text);
      }
      const { parsed, qrText, report: r } = fromPhotos(read);
      setDetails(parsed);
      setCard(null);
      setState({ step: "ready", source: "photo", photo: null, qrText, report: r, photoRead: read });
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "Couldn't read these photos.", report: null });
    }
  }

  // Back photo added after a front-only read: take its QR, and fill only fields that are still
  // empty, so nothing the user has already checked or edited is overwritten.
  async function addBack(file: File) {
    if (state.step !== "ready" || !state.photoRead) return;
    const prev = state;
    const prevRead = state.photoRead;
    setState({ ...prev, addingBack: true });
    try {
      const { scan, text } = await readPhoto(file);
      const read: PhotoRead = { scans: [...prevRead.scans, scan], texts: [...prevRead.texts, text] };
      const { parsed, qrText, report: r } = fromPhotos(read);
      setDetails((d) => {
        const out = { ...d };
        for (const [k, v] of Object.entries(parsed) as [keyof DlDetails, string][]) if (v && !out[k]) out[k] = v;
        return out;
      });
      setState({ ...prev, qrText: prev.qrText ?? qrText, report: r, photoRead: read });
    } catch {
      setState(prev);
    }
  }

  if (state.step === "password") {
    return <ManualPassword incorrect={state.incorrect} onSubmit={(p) => readPdf(state.file, [p])} />;
  }

  if (state.step === "ready") {
    const { qrText, photo, source, photoRead, addingBack } = state;
    const valid = !addingBack && details.licenceNo.trim().length > 0 && details.name.trim().length > 0 && !!card;
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
        {addingBack ? (
          <p className="text-center text-sm text-neutral-500">Reading the back of your card…</p>
        ) : (
          photoRead?.scans.length === 1 && <AddBackPhoto hasQr={!!qrText} onFile={addBack} />
        )}
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
        title="Choose Driving Licence PDF"
        hint="The PDF from DigiLocker → Issued Documents"
        accept="application/pdf"
        busy={state.step === "reading"}
        error={state.step === "error" ? state.message : undefined}
        onFile={(file) => readPdf(file)}
      >
        {(locked) => (
          <CardPhotos locked={locked} busy={state.step === "reading"} backSub="Optional · add it if the QR is on the back" onRead={readPhotos} />
        )}
      </FilePicker>
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
