"use client";

import { useState } from "react";
import { parseDlText, type DlDetails } from "@/lib/dl/parse";
import { PasswordRequiredError, scanWithPasswords } from "@/lib/client/scanDocument";
import { renderDlCard } from "@/lib/client/dlCard";
import FilePicker from "./FilePicker";
import AddToWalletButton from "./AddToWalletButton";
import DownloadLinks from "./DownloadLinks";
import ManualPassword from "./ManualPassword";

type State =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "password"; file: File; incorrect: boolean }
  | { step: "ready"; details: DlDetails; card: string; qrText: string | null }
  | { step: "error"; message: string };

export default function DlFlow() {
  const [state, setState] = useState<State>({ step: "idle" });

  async function read(file: File, passwords: string[] = []) {
    setState({ step: "reading" });
    try {
      // The DigiLocker QR is a short JSON payload; anything readable and non-trivial qualifies.
      const scanned = await scanWithPasswords(file, passwords, (q) => q.text.length >= 20);
      const details = parseDlText(scanned.text);
      if (!details.licenceNo || !details.name) {
        throw new Error("Couldn't read this licence. Upload the Driving Licence PDF downloaded from DigiLocker.");
      }
      const card = await renderDlCard(details, scanned.photo);
      setState({ step: "ready", details, card, qrText: scanned.qr?.text ?? null });
    } catch (err) {
      if (err instanceof PasswordRequiredError) setState({ step: "password", file, incorrect: err.incorrect });
      else setState({ step: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  if (state.step === "password") {
    return <ManualPassword incorrect={state.incorrect} onSubmit={(p) => read(state.file, [p])} />;
  }

  if (state.step === "ready") {
    const { details, card, qrText } = state;
    return (
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
        <img src={card} alt={`Driving licence for ${details.name}`} className="w-full rounded-xl shadow-lg" />
        <p className="text-xs text-neutral-500">
          {qrText ? "The original DigiLocker QR will be added to the pass." : "No QR was found, so the pass won't have one."}
        </p>
        {/* A real form POST (not fetch) so iOS Safari opens the .pkpass and offers "Add to Apple Wallet". */}
        <form method="POST" action="/api/pass/dl">
          {Object.entries(details).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="strip" value={card} />
          <input type="hidden" name="qr" value={qrText ?? ""} />
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
        title="Choose Driving Licence PDF"
        hint="The licence PDF from DigiLocker"
        accept="application/pdf"
        busy={state.step === "reading"}
        error={state.step === "error" ? state.message : undefined}
        onFile={(file) => read(file)}
      />
      <DownloadLinks
        title="Don't have it?"
        description="Open DigiLocker, go to Issued Documents → Driving License (pull it from your state's transport department if it isn't there yet), download the PDF, then come back and upload it."
        sources={[{ name: "DigiLocker → Issued Documents", href: "https://www.digilocker.gov.in/" }]}
      />
    </div>
  );
}
