"use client";

// First-visit dialog: why this exists, the privacy promise, and the terms the user must accept
// before using the site. Shown again whenever TERMS_VERSION changes.
import { useEffect, useState } from "react";
import Link from "next/link";
import { NOT_AFFILIATED, TERMS_POINTS } from "@/lib/terms";
import { acceptTerms, hasAcceptedCurrentTerms, useConsent } from "@/lib/client/termsStore";
import GitHubLink from "./GitHubLink";

export default function WelcomeDialog() {
  const consent = useConsent();
  const [agreed, setAgreed] = useState(false);
  const open = consent !== undefined && !hasAcceptedCurrentTerms(consent);

  // Keep the page behind from scrolling while the dialog is up.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 text-neutral-800 shadow-2xl sm:rounded-3xl dark:bg-neutral-950 dark:text-neutral-200"
      >
        <h2 id="welcome-title" className="text-xl font-semibold tracking-tight">
          Indian IDs → Apple Wallet
        </h2>

        <section className="mt-4 space-y-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          <p className="font-medium text-neutral-800 dark:text-neutral-200">Why this exists</p>
          <p>
            In the US, government IDs can live in Apple Wallet. In India, showing an ID still means digging through
            photos and screenshots, or opening a separate app for each one. Now that Apple Pay has arrived in India,
            this site lets you keep your Aadhaar, PAN, Driving Licence and Voter ID in Wallet too: as passes that look
            like the real card and carry the document&apos;s original, verifiable QR.
          </p>
        </section>

        <section className="mt-4 space-y-1 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
          <p className="font-medium">🔒 Privacy first</p>
          <p className="text-neutral-600 dark:text-neutral-400">
            Your files are read entirely in your browser and never uploaded. Only what appears on the pass is sent to
            be signed, then discarded. No document data is stored; only an anonymous record that the terms were
            accepted and a pass was created.
          </p>
        </section>

        <section className="mt-5 space-y-3">
          <p className="text-sm font-medium">Before you continue, please confirm:</p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
            {TERMS_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-300 p-3 text-sm dark:border-neutral-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-black dark:accent-white"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              I have read and agree to the{" "}
              <Link href="/terms" target="_blank" className="underline">
                Terms of Use &amp; Privacy
              </Link>
              .
            </span>
          </label>
          <button
            disabled={!agreed}
            onClick={acceptTerms}
            className="w-full rounded-xl bg-neutral-900 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            Agree &amp; continue
          </button>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          <GitHubLink label="Open source" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">{NOT_AFFILIATED}</p>
      </div>
    </div>
  );
}
