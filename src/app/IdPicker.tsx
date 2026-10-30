"use client";

import { useState } from "react";
import AadhaarFlow from "./AadhaarFlow";
import PanFlow from "./PanFlow";
import DlFlow from "./DlFlow";
import VoterFlow from "./VoterFlow";

const IDS = [
  { id: "aadhaar", title: "Aadhaar", subtitle: "आधार · e-Aadhaar PDF", accent: "from-orange-400 to-green-500" },
  { id: "pan", title: "PAN Card", subtitle: "पैन कार्ड · e-PAN PDF", accent: "from-violet-300 to-sky-400" },
  { id: "dl", title: "Driving Licence", subtitle: "ड्राइविंग लाइसेंस · DigiLocker PDF", accent: "from-neutral-200 to-neutral-400" },
  { id: "voter", title: "Voter ID", subtitle: "मतदाता पहचान पत्र · e-EPIC PDF", accent: "from-amber-200 to-rose-300" },
] as const;

const FLOWS = { aadhaar: AadhaarFlow, pan: PanFlow, dl: DlFlow, voter: VoterFlow };

const COMING_SOON = [
  { title: "Passport", subtitle: "पासपोर्ट · photo page" },
  { title: "Vehicle RC", subtitle: "वाहन पंजीकरण · DigiLocker PDF" },
  { title: "ABHA Health Card", subtitle: "आभा · Ayushman Bharat Health Account" },
  { title: "Ayushman Card", subtitle: "आयुष्मान कार्ड · PM-JAY" },
  { title: "e-Shram Card", subtitle: "ई-श्रम कार्ड · Labour ID" },
];

type IdKind = (typeof IDS)[number]["id"];

export default function IdPicker() {
  const [selected, setSelected] = useState<IdKind | null>(null);

  if (selected) {
    const { title } = IDS.find((i) => i.id === selected)!;
    const Flow = FLOWS[selected];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-sm text-neutral-500 underline" onClick={() => setSelected(null)}>
            Choose another ID
          </button>
        </div>
        <Flow />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Which ID do you want to add?</p>
      {IDS.map((id) => (
        <button
          key={id.id}
          onClick={() => setSelected(id.id)}
          className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 p-4 text-left transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
        >
          <span className={`h-10 w-14 shrink-0 rounded-md bg-gradient-to-br ${id.accent}`} />
          <span>
            <span className="block font-medium">{id.title}</span>
            <span className="block text-xs text-neutral-500">{id.subtitle}</span>
          </span>
        </button>
      ))}
      <p className="pt-3 text-sm font-medium text-neutral-500">Coming soon</p>
      {COMING_SOON.map((id) => (
        <div
          key={id.title}
          className="flex items-center gap-4 rounded-2xl border border-dashed border-neutral-200 p-4 text-neutral-400 dark:border-neutral-800"
        >
          <span className="h-10 w-14 shrink-0 rounded-md bg-neutral-100 dark:bg-neutral-900" />
          <span>
            <span className="block font-medium">{id.title}</span>
            <span className="block text-xs">{id.subtitle}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
