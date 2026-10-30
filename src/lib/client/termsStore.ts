// Browser-only: the user's consent record — which terms version they accepted, when, and a random
// consent ID (not linked to who they are) — kept in localStorage and exposed to React via
// useSyncExternalStore so the dialog and the Add to Wallet forms stay in sync. The consent ID and
// timestamps are sent with each pass request as evidence the terms were accepted.
import { useMemo, useSyncExternalStore } from "react";
import { TERMS_VERSION } from "@/lib/terms";

const KEY = "termsConsent";
const listeners = new Set<() => void>();
let memory: string | null = null; // fallback when localStorage is unavailable

export interface Consent {
  version: string;
  id: string;
  at: string; // ISO timestamp of "Agree & continue"
}

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
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory; // storage blocked (e.g. some private modes): ask every visit
  }
};

function parse(raw: string | null): Consent | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Consent;
    return typeof c.version === "string" && typeof c.id === "string" && typeof c.at === "string" ? c : null;
  } catch {
    return null;
  }
}

export function acceptTerms() {
  // Idempotent: a repeat activation never mints a second consent record for the same version.
  if (parse(read())?.version === TERMS_VERSION) return;
  const consent: Consent = { version: TERMS_VERSION, id: crypto.randomUUID(), at: new Date().toISOString() };
  const raw = JSON.stringify(consent);
  memory = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // keep going for this visit even if storage is unavailable
  }
  listeners.forEach((l) => l());
  // Anonymous consent record (no personal data); best effort, never blocks the user.
  fetch("/api/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consentId: consent.id, termsVersion: consent.version, termsAcceptedAt: consent.at }),
    keepalive: true,
  }).catch(() => {});
}

/** The consent record, `null` if not accepted, or `undefined` during server rendering. */
export function useConsent(): Consent | null | undefined {
  const raw = useSyncExternalStore(subscribe, read, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parse(raw)), [raw]);
}

export const hasAcceptedCurrentTerms = (consent: Consent | null | undefined) => consent?.version === TERMS_VERSION;

// When the per-upload confirmation box was last ticked; sent with the next pass request.
let uploadConfirmedAt: string | null = null;
export const setUploadConfirmed = (confirmed: boolean) => {
  uploadConfirmedAt = confirmed ? new Date().toISOString() : null;
};
export const getUploadConfirmedAt = () => uploadConfirmedAt;
