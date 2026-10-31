"use client";

// "Report a reading problem": shows the privacy-safe reading report (layout only, no values) and
// lets the user copy it or open a prefilled GitHub issue. Nothing is sent anywhere automatically.
import { useState } from "react";
import { REPO_URL } from "@/lib/terms";

const MAX_URL_BODY = 6000; // keep the prefilled issue URL within browser/GitHub limits

export default function DiagnosticsPanel({ idType, report }: { idType: string; report: string }) {
  const [copied, setCopied] = useState(false);
  const body = report.length > MAX_URL_BODY ? `${report.slice(0, MAX_URL_BODY)}\n\n_(truncated, paste the full copied report)_` : report;
  const issueUrl = `${REPO_URL}/issues/new?title=${encodeURIComponent(`Reading problem: ${idType}`)}&body=${encodeURIComponent(body)}`;

  return (
    <details className="rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <summary className="cursor-pointer font-medium">Something not read correctly? Report it privately</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-neutral-500">
          This report was generated on your device. It describes only the document&apos;s layout (page size, text
          layer, images, QR length, which fields were found) — no names, numbers, photos or text from it. Review it
          before sharing; nothing is sent unless you choose to.
        </p>
        <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-100 p-3 text-[11px] leading-relaxed whitespace-pre-wrap dark:bg-neutral-900">
          {report}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(report).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700"
          >
            {copied ? "Copied ✓" : "Copy report"}
          </button>
          <a
            href={issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700"
          >
            Open a GitHub issue ↗
          </a>
        </div>
      </div>
    </details>
  );
}
