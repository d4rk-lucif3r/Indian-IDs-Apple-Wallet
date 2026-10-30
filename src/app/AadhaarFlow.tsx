"use client";

import { useState } from "react";
import { isSecureQrText, parseSecureQr, type AadhaarSecureQr } from "@/lib/aadhaar/secureQr";
import { PasswordRequiredError, scanWithPasswords } from "@/lib/client/scanDocument";
import { jp2ToPngDataUrl } from "@/lib/client/decodePhoto";
import { renderCardFront } from "@/lib/client/renderCard";
import FilePicker from "./FilePicker";
import AddToWalletButton from "./AddToWalletButton";
import DownloadLinks from "./DownloadLinks";

const EAADHAAR_SOURCES = [
  { name: "myAadhaar (UIDAI) download", href: "https://myaadhaar.uidai.gov.in/genricDownloadAadhaar" },
  { name: "DigiLocker → Issued Documents", href: "https://www.digilocker.gov.in/" },
];
import { aadhaarPdfPasswords } from "@/lib/aadhaar/pdfPassword";
import { findAadhaarNumber, findVid } from "@/lib/aadhaar/pdfText";

type State =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "password"; file: File; incorrect: boolean }
  | { step: "ready"; qrText: string; vid: string | null; uid: string | null; qr: AadhaarSecureQr; card: string }
  | { step: "error"; message: string };

async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  const format = bytes[0] === 0x1f && bytes[1] === 0x8b ? "gzip" : "deflate";
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export default function AadhaarFlow() {
  const [state, setState] = useState<State>({ step: "idle" });
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [password, setPassword] = useState("");
  const [manual, setManual] = useState(false);

  async function read(file: File, passwords: string[] = []) {
    setState({ step: "reading" });
    try {
      const scanned = await scanWithPasswords(file, passwords, (q) => isSecureQrText(q.text));
      if (!scanned.qr) {
        throw new Error(
          "Couldn't find the Aadhaar Secure QR. Use the e-Aadhaar PDF, or a sharp, well-lit photo of just the QR.",
        );
      }
      const qrText = scanned.qr.text;
      const qr = await parseSecureQr(qrText, decompress);
      const vid = findVid(scanned.text);
      const uid = findAadhaarNumber(scanned.text, qr.last4);
      const photo = scanned.photo ?? (await jp2ToPngDataUrl(qr.photo));
      const card = await renderCardFront(qr, photo, { vid, uid });
      setName("");
      setBirthYear("");
      setPassword("");
      setState({ step: "ready", qrText, vid, uid, qr, card });
    } catch (err) {
      if (err instanceof PasswordRequiredError) {
        setState({ step: "password", file, incorrect: err.incorrect });
      } else {
        setState({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      }
    }
  }

  if (state.step === "password") {
    const input = "min-w-0 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";
    const candidates = manual ? [password.trim()].filter(Boolean) : aadhaarPdfPasswords(name, birthYear);
    return (
      <form
        className="space-y-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (candidates.length) read(state.file, candidates);
        }}
      >
        <p className="text-sm font-medium">Your e-Aadhaar is password protected</p>
        {manual ? (
          <input
            aria-label="PDF password"
            placeholder="e.g. ASHA1995"
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            className={`${input} w-full`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : (
          <div className="flex gap-2">
            <input
              aria-label="Name as on Aadhaar"
              placeholder="Name as on Aadhaar"
              autoFocus
              autoComplete="off"
              className={`${input} flex-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              aria-label="Year of birth"
              placeholder="YYYY"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              className={`${input} w-24 shrink-0 text-center`}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        )}
        <p className="text-xs text-neutral-500">
          {state.incorrect ? "That didn't unlock it. Check the spelling matches your Aadhaar. " : ""}
          The password is the first 4 letters of your name in capitals + year of birth
          {!manual && candidates[0] ? <> (trying <span className="font-mono">{candidates[0]}</span>)</> : ""}. It
          stays on this device.
        </p>
        <button
          disabled={!candidates.length}
          className="w-full rounded-lg bg-neutral-900 py-2.5 text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Unlock
        </button>
        <button type="button" className="w-full text-xs text-neutral-500 underline" onClick={() => setManual(!manual)}>
          {manual ? "Use name and birth year instead" : "Type the password instead"}
        </button>
      </form>
    );
  }

  if (state.step === "ready") {
    const { qr, qrText, vid, uid, card } = state;
    return (
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
        <img src={card} alt={`Aadhaar card for ${qr.name}`} className="w-full rounded-xl shadow-lg" />

        {/* A real form POST (not fetch) so iOS Safari opens the .pkpass and offers "Add to Apple Wallet". */}
        <form method="POST" action="/api/pass/aadhaar">
          <input type="hidden" name="qr" value={qrText} />
          <input type="hidden" name="strip" value={card} />
          <input type="hidden" name="vid" value={vid ?? ""} />
          <input type="hidden" name="uid" value={uid ?? ""} />
          <AddToWalletButton />
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
        title="Choose e-Aadhaar PDF"
        hint="or a clear photo/screenshot of the Aadhaar QR"
        accept="application/pdf,image/*"
        busy={state.step === "reading"}
        error={state.step === "error" ? state.message : undefined}
        onFile={(file) => read(file)}
      />
      <DownloadLinks
        title="Don't have your e-Aadhaar?"
        description="Download it free with an OTP on your registered mobile (choose the regular, non-masked version to show your full number), then come back and upload it."
        sources={EAADHAAR_SOURCES}
      />
    </div>
  );
}
