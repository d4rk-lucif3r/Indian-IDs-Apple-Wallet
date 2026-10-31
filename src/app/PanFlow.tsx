"use client";

import { useEffect, useState } from "react";
import { PAN_PATTERN, panPdfPassword, parsePanText, type PanDetails } from "@/lib/pan/parse";
import { PasswordRequiredError, scanDocument, scanWithPasswords } from "@/lib/client/scanDocument";
import { fileToCanvas, recognize } from "@/lib/client/ocr";
import { parsePanOcr } from "@/lib/pan/ocr";
import CardPhotos from "./CardPhotos";
import { renderPanCard } from "@/lib/client/panCard";
import FilePicker from "./FilePicker";
import DiagnosticsPanel from "./DiagnosticsPanel";
import { makeReport } from "@/lib/client/report";
import AddToWalletButton from "./AddToWalletButton";
import DownloadLinks from "./DownloadLinks";

interface Scan {
  photo: string | null;
  signature: string | null;
  qrBase64: string | null; // raw PAN QR payload; it's encrypted, so carried through untouched
  fromImage: boolean; // card photo rather than e-PAN PDF: no text or images to extract
  report: string; // privacy-safe reading report (layout + which fields were found, no values)
}

type State =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "password"; file: File; incorrect: boolean }
  | { step: "review"; scan: Scan }
  | { step: "error"; message: string };

const EPAN_SOURCES = [
  { name: "UTIITSL e-PAN download", href: "https://www.pan.utiitsl.com/PAN_ONLINE/ePANCardHome" },
  { name: "Protean (NSDL) e-PAN download", href: "https://onlineservices.proteantech.in/paam/requestAndDownloadEPAN.html" },
];

const input = "min-w-0 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export default function PanFlow() {
  const [state, setState] = useState<State>({ step: "idle" });
  const [dobIso, setDobIso] = useState("");
  const [password, setPassword] = useState("");
  const [manual, setManual] = useState(false);
  const [details, setDetails] = useState<PanDetails>({ pan: "", name: "", fatherName: "", dob: "" });
  const [card, setCard] = useState<string | null>(null);

  async function read(file: File, passwords: string[] = []) {
    setState({ step: "reading" });
    try {
      const scanned = await scanWithPasswords(file, passwords, (q) => q.bytes.length >= 32);
      const parsed = parsePanText(scanned.text);
      // What the document itself yielded, before any fallback or typing — for the reading report.
      const found = {
        pan: Boolean(parsed.pan), name: Boolean(parsed.name), fatherName: Boolean(parsed.fatherName),
        dob: Boolean(parsed.dob), photo: Boolean(scanned.photo), signature: Boolean(scanned.signature), qr: Boolean(scanned.qr),
      };
      const missing = Object.entries(found).filter(([, ok]) => !ok).map(([f]) => f);
      const report = makeReport({
        idType: "PAN",
        diag: scanned.diagnostics,
        fields: found,
        outcome: missing.length ? `read with missing fields: ${missing.join(", ")}` : "all fields read",
      });
      if (!parsed.dob && dobIso) parsed.dob = dobIso.split("-").reverse().join("/");
      setDetails(parsed);
      setPassword("");
      setState({
        step: "review",
        scan: {
          photo: scanned.photo,
          signature: scanned.signature,
          qrBase64: scanned.qr ? toBase64(scanned.qr.bytes) : null,
          fromImage: !file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf"),
          report,
        },
      });
    } catch (err) {
      if (err instanceof PasswordRequiredError) {
        setState({ step: "password", file, incorrect: err.incorrect });
      } else {
        setState({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      }
    }
  }

  // Photo of a physical PAN card: the QR (carried through untouched, as from the e-PAN) and the
  // printed details via on-device OCR, all editable.
  async function readPhotos(files: File[]) {
    setState({ step: "reading" });
    try {
      const scans = await Promise.all(files.map((f) => scanDocument(f, { acceptQr: (q) => q.bytes.length >= 32 })));
      const qr = scans.find((s) => s.qr)?.qr ?? null;
      let parsed: PanDetails = { pan: "", name: "", fatherName: "", dob: "" };
      try {
        const texts: string[] = [];
        for (const f of files) texts.push((await recognize(await fileToCanvas(f))).text);
        parsed = parsePanOcr(texts.join("\n"));
      } catch (err) {
        console.warn("OCR failed", err);
      }
      const found = {
        pan: Boolean(parsed.pan), name: Boolean(parsed.name), fatherName: Boolean(parsed.fatherName),
        dob: Boolean(parsed.dob), qr: Boolean(qr),
      };
      const missing = Object.entries(found).filter(([, ok]) => !ok).map(([f]) => f);
      const report = makeReport({
        idType: "PAN (card photo)",
        diag: scans[0].diagnostics,
        fields: found,
        outcome: `card photo, OCR; ${missing.length ? `missing: ${missing.join(", ")}` : "all fields read"}`,
      });
      setDetails(parsed);
      setState({
        step: "review",
        scan: { photo: null, signature: null, qrBase64: qr ? toBase64(qr.bytes) : null, fromImage: true, report },
      });
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "Couldn't read this photo." });
    }
  }

  // Redraw the card preview as details are edited.
  const scan = state.step === "review" ? state.scan : null;
  useEffect(() => {
    if (!scan) return;
    let cancelled = false;
    renderPanCard(details, scan.photo, scan.signature).then((png) => !cancelled && setCard(png));
    return () => {
      cancelled = true;
    };
  }, [details, scan]);

  if (state.step === "password") {
    const candidates = manual ? [password.trim()].filter(Boolean) : [panPdfPassword(dobIso)].filter((p) => p !== null);
    return (
      <form
        className="space-y-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (candidates.length) read(state.file, candidates);
        }}
      >
        <p className="text-sm font-medium">Your e-PAN is password protected</p>
        {manual ? (
          <input
            aria-label="PDF password"
            placeholder="e.g. 01061995"
            autoFocus
            autoComplete="off"
            className={`${input} w-full`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : (
          <input
            aria-label="Date of birth"
            type="date"
            autoFocus
            className={`${input} w-full`}
            value={dobIso}
            onChange={(e) => setDobIso(e.target.value)}
          />
        )}
        <p className="text-xs text-neutral-500">
          {state.incorrect ? "That didn't unlock it. " : ""}
          The password is your date of birth as DDMMYYYY
          {!manual && candidates[0] ? <> (trying <span className="font-mono">{candidates[0]}</span>)</> : ""}. It stays
          on this device.
        </p>
        <button
          disabled={!candidates.length}
          className="w-full rounded-lg bg-neutral-900 py-2.5 text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Unlock
        </button>
        <button type="button" className="w-full text-xs text-neutral-500 underline" onClick={() => setManual(!manual)}>
          {manual ? "Use date of birth instead" : "Type the password instead"}
        </button>
      </form>
    );
  }

  if (state.step === "review") {
    const { qrBase64, fromImage } = state.scan;
    const reviewScan = state.scan;
    const valid = PAN_PATTERN.test(details.pan) && details.name.length > 0;
    const field = (key: keyof PanDetails, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
      <label className="block space-y-1">
        <span className="text-xs text-neutral-500">{label}</span>
        <input
          className={`${input} w-full`}
          value={details[key]}
          onChange={(e) => setDetails({ ...details, [key]: key === "dob" ? e.target.value : e.target.value.toUpperCase() })}
          {...extra}
        />
      </label>
    );
    return (
      <div className="space-y-4">
        {card && (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL
          <img src={card} alt={`PAN card for ${details.name}`} className="w-full rounded-xl shadow-lg" />
        )}
        <p className="text-xs text-neutral-500">
          {fromImage
            ? "Read from your photo with on-device text recognition. Check every field against your card."
            : "Check the details read from your e-PAN and correct anything that's off."}
          {qrBase64 ? " The original PAN QR will be added to the pass." : " No QR was found, so the pass won't have one."}
        </p>
        <label className="block cursor-pointer text-center text-sm text-neutral-500 underline">
          {reviewScan.photo ? "Change photo" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setState({ step: "review", scan: { ...reviewScan, photo: String(reader.result) } });
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <div className="space-y-3">
          {field("pan", "PAN", { maxLength: 10, autoCapitalize: "characters" })}
          {field("name", "Name", { autoCapitalize: "characters" })}
          {field("fatherName", "Father's Name", { autoCapitalize: "characters" })}
          {field("dob", "Date of Birth (DD/MM/YYYY)", { inputMode: "numeric", placeholder: "DD/MM/YYYY" })}
        </div>

        {/* A real form POST (not fetch) so iOS Safari opens the .pkpass and offers "Add to Apple Wallet". */}
        <form method="POST" action="/api/pass/pan">
          <input type="hidden" name="pan" value={details.pan} />
          <input type="hidden" name="name" value={details.name} />
          <input type="hidden" name="fatherName" value={details.fatherName} />
          <input type="hidden" name="dob" value={details.dob} />
          <input type="hidden" name="strip" value={card ?? ""} />
          <input type="hidden" name="qr" value={qrBase64 ?? ""} />
          <AddToWalletButton ready={valid && !!card} waitingText="Enter a valid PAN and your name to continue" />
        </form>
        <button className="w-full text-sm text-neutral-500 underline" onClick={() => setState({ step: "idle" })}>
          Use a different file
        </button>
        <DiagnosticsPanel idType="PAN" report={reviewScan.report} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilePicker
        title="Choose e-PAN PDF"
        hint="From UTIITSL, Protean (NSDL) or the e-filing portal"
        accept="application/pdf"
        busy={state.step === "reading"}
        error={state.step === "error" ? state.message : undefined}
        onFile={(file) => read(file)}
      >
        {(locked) => (
          <CardPhotos locked={locked} busy={state.step === "reading"} frontSub="Tap to take or choose a photo of the front" onRead={readPhotos} />
        )}
      </FilePicker>
      <DownloadLinks
        title="Don't have your e-PAN?"
        description="Download it free from the agency that issued your PAN (it's printed on the back of your card), then come back and upload it."
        sources={EPAN_SOURCES}
      />
    </div>
  );
}
