// e-Aadhaar PDF password: first 4 letters of the name in capitals + year of birth (YYYY).
// UIDAI's examples are ambiguous for names with spaces/initials, so we generate every
// plausible reading and try them in turn: "SAI KUMAR" -> SAIK, "P. KUMAR" -> P.KU / PKUM, "RIA" -> RIA.
export function aadhaarPdfPasswords(name: string, birthYear: string): string[] {
  const year = birthYear.trim();
  const upper = name.trim().toUpperCase();
  if (!upper || !/^\d{4}$/.test(year)) return [];

  const prefixes = [
    upper.replace(/\s+/g, "").slice(0, 4),
    upper.replace(/[^A-Z]/g, "").slice(0, 4),
    upper.slice(0, 4),
  ];
  return [...new Set(prefixes.filter(Boolean).map((p) => p + year))];
}
