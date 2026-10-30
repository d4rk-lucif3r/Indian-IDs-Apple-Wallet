// Browser-only: remembers which terms version the user accepted (localStorage), as a tiny store
// for useSyncExternalStore so the dialog and the Add to Wallet forms stay in sync.
import { useSyncExternalStore } from "react";
import { TERMS_VERSION } from "@/lib/terms";

const KEY = "termsAccepted";
const listeners = new Set<() => void>();
let memory: string | null = null; // fallback when localStorage is unavailable

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // storage blocked (e.g. some private modes): ask every visit
  }
};

export function acceptTerms() {
  try {
    localStorage.setItem(KEY, TERMS_VERSION);
  } catch {
    // keep going for this visit even if storage is unavailable
  }
  memory = TERMS_VERSION;
  listeners.forEach((l) => l());
}

/** The accepted version, `null` if not accepted, or `undefined` during server rendering. */
export function useAcceptedTerms(): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read() ?? memory,
    () => undefined,
  );
}

export const hasAcceptedCurrentTerms = (accepted: string | null | undefined) => accepted === TERMS_VERSION;
