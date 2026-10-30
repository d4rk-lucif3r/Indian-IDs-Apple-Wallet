"use client";

// Full-screen ID QR, opened from the "Show large QR" link on the back of a pass.
// The payload lives in the URL fragment (#...), which browsers never send to the server:
//   #<digits>          Aadhaar Secure QR
//   #b64.<base64url>   raw binary QR payload (e.g. PAN)
import { useEffect, useState } from "react";
import { isSecureQrText } from "@/lib/aadhaar/secureQr";

type State = { status: "loading" } | { status: "ready"; svg: string } | { status: "invalid" };

function payloadFromHash(hash: string): string | Uint8Array | null {
  const fragment = decodeURIComponent(hash.replace(/^#/, ""));
  if (isSecureQrText(fragment)) return fragment;
  if (fragment.startsWith("b64.")) {
    const b64 = fragment.slice(4).replace(/-/g, "+").replace(/_/g, "/");
    try {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return bytes.length ? bytes : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function renderSvg(payload: string | Uint8Array): Promise<string> {
  const { prepareZXingModule, writeBarcode } = await import("zxing-wasm/writer");
  await prepareZXingModule({
    overrides: {
      locateFile: (file: string, prefix: string) => (file.endsWith(".wasm") ? `/vendor/zxing/${file}` : prefix + file),
    },
    fireImmediately: true,
  });
  // Lowest error correction = fewest, largest modules; a clean screen doesn't need more redundancy.
  const result = await writeBarcode(payload, { format: "QRCode", options: "ecLevel=L", scale: 1 });
  if (result.error) throw new Error(result.error);

  // The encoder emits a fixed-size SVG with no viewBox; add one so it scales to the screen crisply.
  const svg = new DOMParser().parseFromString(result.svg, "image/svg+xml").documentElement;
  const size = svg.getAttribute("width");
  svg.setAttribute("viewBox", `0 0 ${size} ${svg.getAttribute("height")}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("shape-rendering", "crispEdges");
  return svg.outerHTML;
}

export default function LargeQr() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const payload = payloadFromHash(window.location.hash);
    (payload ? renderSvg(payload) : Promise.reject())
      .then((svg) => setState({ status: "ready", svg }))
      .catch(() => setState({ status: "invalid" }));
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white p-3 text-neutral-600">
      {state.status === "ready" && (
        <div
          className="aspect-square w-full max-w-[min(100vw,100vh)] [&>svg]:h-full [&>svg]:w-full"
          // SVG is generated locally by our QR encoder (plain rects), never taken from the URL.
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      )}
      {state.status === "loading" && <p>Preparing QR…</p>}
      {state.status === "invalid" && <p>This link doesn&apos;t contain a valid QR.</p>}
      {state.status === "ready" && <p className="text-center text-sm">Turn brightness up and scan with the ID&apos;s verifier app</p>}
    </main>
  );
}
