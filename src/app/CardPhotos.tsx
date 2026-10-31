"use client";

// Front / back photo slots for physical cards. Each slot takes one image (camera or library, the
// browser offers both) and shows a local preview; nothing is read until "Read card" is pressed.
import { useEffect, useMemo, useState } from "react";

function Slot({
  label,
  sub,
  file,
  locked,
  onChange,
}: {
  label: string;
  sub: string;
  file: File | null;
  locked: boolean;
  onChange: (file: File) => void;
}) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  return (
    <label
      aria-disabled={locked}
      className={`relative flex aspect-[1.586] flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 p-2 text-center dark:border-neutral-700 ${
        locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute bottom-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{label} · change</span>
        </>
      ) : (
        <>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-neutral-500">{sub}</span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={locked}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onChange(f);
        }}
      />
    </label>
  );
}

export default function CardPhotos({
  locked,
  busy,
  frontSub = "Tap to take or choose a photo",
  backSub,
  tip = "Flat, well lit, no glare, the whole card in frame. Read on your device.",
  onRead,
}: {
  locked: boolean;
  busy: boolean;
  frontSub?: string;
  backSub?: string; // e.g. "Optional · has the QR"; omit for a single photo (everything on the front)
  tip?: string;
  onRead: (files: File[]) => void;
}) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
        or use {backSub ? "photos" : "a photo"} of your card
        <span className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
      </div>
      {backSub ? (
        <div className="grid grid-cols-2 gap-3">
          <Slot label="Front" sub={frontSub} file={front} locked={locked} onChange={setFront} />
          <Slot label="Back" sub={backSub} file={back} locked={locked} onChange={setBack} />
        </div>
      ) : (
        <div className="mx-auto w-2/3">
          <Slot label="Front" sub={frontSub} file={front} locked={locked} onChange={setFront} />
        </div>
      )}
      <button
        type="button"
        disabled={locked || busy || !(front || back)}
        onClick={() => onRead([front, back].filter((f): f is File => !!f))}
        className="w-full rounded-xl bg-black py-3 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {busy ? "Reading…" : front || back ? "Read card" : "Add a photo to continue"}
      </button>
      <p className="text-xs text-neutral-500">{tip}</p>
    </div>
  );
}

// After a front-only read: add the back to pick up the QR and anything that was missed.
export function AddBackPhoto({ hasQr, onFile }: { hasQr: boolean; onFile: (file: File) => void }) {
  return (
    <label className="block cursor-pointer text-center text-sm text-neutral-500 underline">
      {hasQr ? "Add the back of the card (fills any missing details)" : "Add the back of the card (for the QR and missing details)"}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
