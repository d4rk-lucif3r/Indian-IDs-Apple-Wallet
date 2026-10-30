import "server-only";
import { after } from "next/server";

// Anonymous audit log + counters, kept as evidence that passes were only created after the
// terms were accepted. Records contain NO document data: no names, numbers, photos, QR
// contents, card images or IP addresses — only what kind of event happened, when, the terms
// version, a random consent ID created in the user's browser, and the country.
//
// Storage is Upstash Redis over its REST API (Vercel → Storage → Upstash adds the env vars).
// Without it configured, logging is skipped; logging never blocks or fails a pass.

const RETENTION_SECONDS = 3 * 365 * 24 * 60 * 60; // 3 years
const ID_TYPES = ["aadhaar", "pan", "dl", "voter"] as const;
export type IdType = (typeof ID_TYPES)[number];

const UUID = /^[a-f0-9-]{36}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

// Vercel's Upstash integration names these KV_REST_API_URL/TOKEN, optionally with a custom prefix
// (e.g. STORAGE_KV_REST_API_URL); Upstash's own docs use UPSTASH_REDIS_REST_URL/TOKEN.
function env(suffix: string): string | undefined {
  const key = Object.keys(process.env).find((k) => k === suffix || k.endsWith(`_${suffix}`));
  return key ? process.env[key] : undefined;
}

function redis() {
  const url = env("KV_REST_API_URL") ?? env("UPSTASH_REDIS_REST_URL");
  const token = env("KV_REST_API_TOKEN") ?? env("UPSTASH_REDIS_REST_TOKEN");
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

/** Which storage settings are visible to the server (names only, for the stats endpoint). */
export function storageDiagnostics() {
  const names = Object.keys(process.env).filter((k) => /KV_|UPSTASH|REDIS/.test(k)).sort();
  return { configured: redis() !== null, envNames: names };
}

export async function redisPipeline(commands: (string | number)[][]): Promise<unknown[] | null> {
  const r = redis();
  if (!r) return null;
  const res = await fetch(`${r.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${r.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return ((await res.json()) as { result: unknown }[]).map((x) => x.result);
}

export interface AuditEvent {
  event: "terms_accepted" | "pass_created";
  idType?: IdType;
  termsVersion: string;
  consentId: string | null; // random UUID generated in the browser when the terms were accepted
  termsAcceptedAt: string | null; // when the user clicked "Agree & continue"
  uploadConfirmedAt?: string | null; // when the per-upload checkbox was ticked
  country: string | null; // from the hosting platform's geo header; never the IP address
}

export function consentFromForm(form: FormData) {
  const consentId = String(form.get("consentId") ?? "");
  const acceptedAt = String(form.get("termsAcceptedAt") ?? "");
  const uploadAt = String(form.get("uploadConfirmedAt") ?? "");
  return {
    consentId: UUID.test(consentId) ? consentId : null,
    termsAcceptedAt: ISO.test(acceptedAt) ? acceptedAt : null,
    uploadConfirmedAt: ISO.test(uploadAt) ? uploadAt : null,
  };
}

export const countryOf = (request: Request) => {
  const c = request.headers.get("x-vercel-ip-country");
  return c && /^[A-Z]{2}$/.test(c) ? c : null;
};

async function write(e: AuditEvent) {
  const at = new Date().toISOString();
  const day = at.slice(0, 10);
  const record = JSON.stringify({ at, ...e });
  const commands: (string | number)[][] = [
    ["LPUSH", `audit:${day}`, record],
    ["EXPIRE", `audit:${day}`, RETENTION_SECONDS],
    ["INCR", `count:${e.event}:total`],
    ["INCR", `count:${e.event}:${day}`],
    ["EXPIRE", `count:${e.event}:${day}`, RETENTION_SECONDS],
  ];
  if (e.idType) {
    commands.push(
      ["INCR", `count:pass:${e.idType}:total`],
      ["INCR", `count:pass:${e.idType}:${day}`],
      ["EXPIRE", `count:pass:${e.idType}:${day}`, RETENTION_SECONDS],
    );
  }
  await redisPipeline(commands);
}

/** Records the event after the response is sent. Never throws into the request. */
export function audit(e: AuditEvent) {
  after(async () => {
    try {
      await write(e);
    } catch (err) {
      console.error("audit log failed", err instanceof Error ? err.message : err);
    }
  });
}

export { ID_TYPES };
