// Terms the user must accept before using the site. Shared by the welcome dialog, the /terms page
// and the pass endpoints (which refuse to sign without the current version). Bump the version
// whenever the terms change, so everyone is asked to accept again.
export const TERMS_VERSION = "2026-10-30.2"; // .2: discloses the anonymous audit log

export const REPO_URL = "https://github.com/d4rk-lucif3r/Indian-IDs-Apple-Wallet";

export const NOT_AFFILIATED =
  "Not affiliated with, endorsed by, or connected to the Government of India, UIDAI, the Income Tax Department, the Ministry of Road Transport & Highways, DigiLocker, the Election Commission of India, any other government body, or Apple Inc.";

// The points the user explicitly agrees to (shown in the dialog; detailed on /terms).
export const TERMS_POINTS = [
  "Passes are personal convenience copies, not official identity documents, and may not be accepted anywhere an original or official digital ID is required.",
  "I will only add my own documents, or those I am authorised to use by their holder.",
  "I will not use this site or its passes to impersonate anyone, mislead, or forge or alter any document.",
  "This independent project is not affiliated with any government entity or Apple, and is provided as-is, without any warranty.",
];
