"use client";

// Upload area shared by every ID flow. Each upload needs an explicit confirmation that the
// document is the user's own (or they're authorised) and that they accept the terms; the file
// picker stays locked until the box is ticked, and the box resets every time the picker is shown.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { setUploadConfirmed } from "@/lib/client/termsStore";

export default function FilePicker({
  title,
  hint,
  accept,
  busy,
  error,
  onFile,
  children,
}: {
  title: string;
  hint: string;
  accept: string;
  busy: boolean;
  error?: string;
  onFile: (file: File) => void;
  // Extra upload options (e.g. card photo slots), locked by the same confirmation.
  children?: (locked: boolean) => ReactNode;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const locked = busy || !confirmed;

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-300 p-3 text-sm dark:border-neutral-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-black dark:accent-white"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => {
            setConfirmed(e.target.checked);
            setUploadConfirmed(e.target.checked);
          }}
        />
        <span>
          This is my own document (or I&apos;m authorised by its holder), I understand the pass is a personal copy and
          not an official ID, and I agree to the{" "}
          <Link href="/terms" target="_blank" className="underline">
            Terms of Use &amp; Privacy
          </Link>
          .
        </span>
      </label>
      <label
        aria-disabled={locked}
        className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 px-5 py-10 text-center dark:border-neutral-700 ${
          locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
      >
        <span className="font-medium">{busy ? "Reading…" : title}</span>
        <span className="text-xs text-neutral-500">{confirmed || busy ? hint : "Tick the box above to choose a file"}</span>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={locked}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
      {children?.(locked)}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
