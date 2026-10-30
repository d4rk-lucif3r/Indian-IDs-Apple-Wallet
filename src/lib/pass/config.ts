import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

export class PassConfigError extends Error {}

function pem(b64Var: string, file: string): string {
  const b64 = process.env[b64Var];
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  try {
    return readFileSync(path.join(process.cwd(), "certs", file), "utf8");
  } catch {
    throw new PassConfigError(`Missing ${file}: run scripts/setup-certs.sh or set ${b64Var}.`);
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new PassConfigError(`Missing ${name} in .env.local`);
  return value;
}

export function loadPassConfig() {
  return {
    passTypeIdentifier: required("PASS_TYPE_ID"),
    teamIdentifier: required("TEAM_ID"),
    organizationName: process.env.ORGANIZATION_NAME || "Aadhaar",
    certificates: {
      signerCert: pem("PASS_SIGNER_CERT_B64", "signerCert.pem"),
      signerKey: pem("PASS_SIGNER_KEY_B64", "signerKey.pem"),
      wwdr: pem("PASS_WWDR_B64", "wwdr.pem"),
    },
  };
}
