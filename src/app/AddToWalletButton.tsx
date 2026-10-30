"use client";

// Apple's official "Add to Apple Wallet" badge (US/UK English, from Apple's badge kit), used
// unmodified as Apple's guidelines require: no recolouring, no dimming, clear space of at least
// 10% of its height. When the pass isn't ready yet, a plain status line replaces the badge
// rather than showing a dimmed one.
//
// Submitting is a real form POST (so iOS Safari opens the Wallet sheet), which the page can't
// observe finishing. Each tap sends a one-time token; the server echoes it back as a short-lived
// cookie alongside the pass, and the spinner stops when that cookie appears.
import { useEffect, useRef, useState } from "react";
import { useAcceptedTerms } from "@/lib/client/termsStore";

const COOKIE = "passReady"; // keep in sync with DOWNLOAD_COOKIE in src/lib/pass/http.ts
const TIMEOUT_MS = 25_000;

type Phase = "idle" | "creating" | "ready" | "slow";

function hasCookie(token: string) {
  return document.cookie.split("; ").includes(`${COOKIE}=${token}`);
}

export default function AddToWalletButton({ ready = true, waitingText }: { ready?: boolean; waitingText?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const acceptedTerms = useAcceptedTerms(); // sent with the form; the server refuses to sign without it
  const tokenInput = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  function start() {
    const token = crypto.randomUUID();
    tokenInput.current!.value = token; // set before the form submits
    clearTimers();
    // Swap the badge for the spinner on the next tick: unmounting the submit button inside its own
    // click handler can cancel the form submission.
    timers.current.push(window.setTimeout(() => setPhase("creating"), 0));
    const started = Date.now();
    const poll = window.setInterval(() => {
      if (hasCookie(token)) {
        clearTimers();
        document.cookie = `${COOKIE}=; Path=/; Max-Age=0`;
        setPhase("ready");
        timers.current.push(window.setTimeout(() => setPhase("idle"), 4000));
      } else if (Date.now() - started > TIMEOUT_MS) {
        clearTimers();
        setPhase("slow");
      }
    }, 250);
    timers.current.push(poll);
  }

  if (!ready) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 py-3.5 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {waitingText ?? "Fill in the details above to continue"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <input ref={tokenInput} type="hidden" name="downloadToken" />
      <input type="hidden" name="termsVersion" value={acceptedTerms ?? ""} />
      {phase === "creating" ? (
        <div role="status" className="flex h-[68px] items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
          Creating your pass…
        </div>
      ) : phase === "ready" ? (
        <p role="status" className="flex h-[68px] items-center justify-center text-sm font-medium text-green-700 dark:text-green-400">
          ✓ Pass ready — add it from the Wallet sheet
        </p>
      ) : (
        <button type="submit" onClick={start} className="mx-auto block p-[6px]" aria-label="Add to Apple Wallet">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG badge, must render unmodified */}
          <img src="/badges/add-to-apple-wallet.svg" alt="Add to Apple Wallet" className="h-14 w-auto" />
        </button>
      )}
      {phase === "slow" && (
        <p className="text-center text-xs text-neutral-500">Taking longer than usual — check your connection and tap again.</p>
      )}
    </div>
  );
}
