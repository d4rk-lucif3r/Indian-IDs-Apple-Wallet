import "server-only";
import { PassConfigError } from "./config";

const MAX_STRIP_BYTES = 2_000_000;
const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

export class BadRequest extends Error {}

export function readStrip(form: FormData): Buffer | null {
  const match = PNG_DATA_URL.exec(String(form.get("strip") ?? ""));
  if (!match) return null;
  const png = Buffer.from(match[1], "base64");
  return png.length <= MAX_STRIP_BYTES ? png : null;
}

// Link target for "Show large QR". PUBLIC_URL wins when it's a real URL (e.g. behind a proxy or
// tunnel); otherwise — unset, malformed, or still the .env placeholder — use the request's origin.
export function siteUrlFor(request: Request): string {
  const configured = process.env.PUBLIC_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (/^https?:$/.test(url.protocol) && !/your-domain/i.test(url.hostname)) return url.origin;
    } catch {
      // fall through to the request origin
    }
  }
  return new URL(request.url).origin;
}

// The page can't observe a form-POST download finishing, so it sends a one-time token and
// watches for this cookie to know the pass has arrived (see AddToWalletButton). The value is just
// that random token, so it is readable by the page and works over plain HTTP in development.
export const DOWNLOAD_COOKIE = "passReady";
const TOKEN_PATTERN = /^[a-f0-9-]{36}$/;

export function passResponse(pkpass: Buffer, filename: string, form?: FormData): Response {
  const headers = new Headers({
    "Content-Type": "application/vnd.apple.pkpass",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "no-store",
  });
  const token = String(form?.get("downloadToken") ?? "");
  if (TOKEN_PATTERN.test(token)) {
    headers.append("Set-Cookie", `${DOWNLOAD_COOKIE}=${token}; Path=/; Max-Age=60; SameSite=Lax`);
  }
  return new Response(new Uint8Array(pkpass), { headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof BadRequest) return new Response(err.message, { status: 400 });
  if (err instanceof PassConfigError) {
    console.error(err.message);
    return new Response("Pass signing is not configured on the server.", { status: 500 });
  }
  console.error(err);
  return new Response("Couldn't create the pass.", { status: 500 });
}
