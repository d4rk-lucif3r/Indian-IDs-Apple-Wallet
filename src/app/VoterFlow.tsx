"use client";

import { useEffect, useState } from "react";
import { EMPTY_VOTER, EPIC_PATTERN, parseVoterText, type VoterDetails } from "@/lib/voter/parse";
import { parseVoterHindi, parseVoterOcr } from "@/lib/voter/ocr";
import { PasswordRequiredError, scanWithPasswords } from "@/lib/client/scanDocument";
import { EPIC_PAGE_WIDTH, readVoterPage, type VoterPage } from "@/lib/client/voterCard";
import { renderVoterCard } from "@/lib/client/voterCardArt";
import { recognize } from "@/lib/client/ocr";
import FilePicker from "./FilePicker";
import AddToWalletButton from "./AddToWalletButton";
import DownloadLinks from "./DownloadLinks";
import ManualPassword from "./ManualPassword";

type State =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "password"; file: File; incorrect: boolean }
  | { step: "ready"; photo: string; qrText: string | null; ocr: "running" | "done" | "failed" }
  | { step: "error"; message: string };

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

async function ocrPage(page: VoterPage): Promise<Partial<VoterDetails>> {
  const front = await recognize(page.front);
  const back = await recognize(page.back);
  const info = await recognize(page.info, { psm: "6" });
  const names = await recognize(page.names, { psm: "6", lang: "hin" });
  return { ...parseVoterOcr({ front, back, info }), ...parseVoterHindi(names) };
}

export default function VoterFlow() {
  const [state, setState] = useState<State>({ step: "idle" });
  const [details, setDetails] = useState<VoterDetails>(EMPTY_VOTER);
  const [card, setCard] = useState<string | null>(null);

  // Draw the card once details are in, and redraw as they're edited.
  const photo = state.step === "ready" && state.ocr !== "running" ? state.photo : null;
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    renderVoterCard(details, photo).then((png) => !cancelled && setCard(png));
    return () => {
      cancelled = true;
    };
  }, [details, photo]);

  async function read(file: File, passwords: string[] = []) {
    setState({ step: "reading" });
    try {
      const scanned = await scanWithPasswords(file, passwords, {
        acceptQr: (q) => q.text.length >= 20,
        pageWidth: EPIC_PAGE_WIDTH,
      });
      if (!scanned.page) throw new Error("Upload the e-EPIC PDF downloaded from voters.eci.gov.in.");
      const page = readVoterPage(scanned.page);
      const fromText = parseVoterText(scanned.text, file.name);
      setDetails(fromText);
      setCard(null);
      const qrText = scanned.qr?.text ?? null;
      setState({ step: "ready", photo: page.photo, qrText, ocr: "running" });

      // OCR fills whatever the text layer couldn't (all of it, for image-only e-EPICs).
      try {
        const fromOcr = await ocrPage(page);
        // Fields are locked while OCR runs, so nothing user-edited is overwritten here. For
        // image-only files a valid OCR'd EPIC beats one guessed from the file name.
        const base = scanned.text.trim() ? fromText : { ...fromText, epicNo: fromOcr.epicNo || fromText.epicNo };
        setDetails(merge(base, fromOcr));
        setState({ step: "ready", photo: page.photo, qrText, ocr: "done" });
      } catch (err) {
        console.warn("OCR failed", err);
        setState({ step: "ready", photo: page.photo, qrText, ocr: "failed" });
      }
    } catch (err) {
      if (err instanceof PasswordRequiredError) setState({ step: "password", file, incorrect: err.incorrect });
      else setState({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  if (state.step === "password") {
    return <ManualPassword incorrect={state.incorrect} onSubmit={(p) => read(state.file, [p])} />;
  }

  if (state.step === "ready") {
    const { qrText, ocr } = state;
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
          {qrText ? "The original e-EPIC QR will be added to the pass." : "No QR was found, so the pass won't have one."}
        </p>
        <p className="text-xs text-neutral-500">
          {ocr === "running" && "Reading the details on your card… (first time downloads ~7 MB of text-recognition data)"}
          {ocr === "done" && "Details read from your e-EPIC — check them; the card updates as you edit."}
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilePicker
        title="Choose e-EPIC PDF"
        hint="The e-EPIC downloaded from the ECI voters portal"
        accept="application/pdf"
        busy={state.step === "reading"}
        error={state.step === "error" ? state.message : undefined}
        onFile={(file) => read(file)}
      />
      <DownloadLinks
        title="Don't have your e-EPIC?"
        description="Download it free from the ECI voters portal (log in with your mobile number, then e-EPIC Download), then come back and upload it."
        sources={[{ name: "ECI e-EPIC download", href: "https://voters.eci.gov.in/home/e-epic-download" }]}
      />
    </div>
  );
}
