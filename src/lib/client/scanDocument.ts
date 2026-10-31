// Browser-only: reads an uploaded ID document (PDF or image) locally — QR, printed text,
// photo and signature. The file never leaves the device.
import { findImagesInPage } from "./pdfImages";
import { issuerHints, sanitizeMeta, type DocDiagnostics, type ImageInfo } from "@/lib/diagnostics";

export class PasswordRequiredError extends Error {
  constructor(public incorrect: boolean) {
    super(incorrect ? "Incorrect password" : "Password required");
  }
}

export interface ScannedQr {
  text: string;
  bytes: Uint8Array; // raw payload, for QRs that carry binary data (e.g. PAN)
}

export interface ScannedDocument {
  qr: ScannedQr | null;
  text: string; // printed text from the PDF; empty for images
  photo: string | null; // PNG data URL
  signature: string | null; // PNG data URL
  page: HTMLCanvasElement | null; // page 1 rendered at `pageWidth`, when requested
  diagnostics: DocDiagnostics; // document shape only (no values), for privacy-safe reading reports
}

const qrDiag = (qr: ScannedQr | null): DocDiagnostics["qr"] =>
  qr ? { found: true, chars: qr.text.length, bytes: qr.bytes.length, digitsOnly: /^\d+$/.test(qr.text) } : { found: false };

export type QrFilter = (qr: ScannedQr) => boolean;

let zxingReady: Promise<typeof import("zxing-wasm/reader")> | null = null;
function zxing() {
  zxingReady ??= import("zxing-wasm/reader").then(async (mod) => {
    await mod.prepareZXingModule({
      overrides: {
        locateFile: (file: string, prefix: string) =>
          file.endsWith(".wasm") ? `/vendor/zxing/${file}` : prefix + file,
      },
      fireImmediately: true,
    });
    return mod;
  });
  return zxingReady;
}

async function findQr(image: Blob | ImageData, accept: QrFilter): Promise<ScannedQr | null> {
  const { readBarcodes } = await zxing();
  const results = await readBarcodes(image, { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 4 });
  return results.map((r) => ({ text: r.text, bytes: r.bytes })).find(accept) ?? null;
}

async function pdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  return lib;
}

async function scanPdf(
  file: File,
  password: string | undefined,
  accept: QrFilter,
  pageWidth?: number,
): Promise<ScannedDocument> {
  const lib = await pdfjs();
  const task = lib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password,
    wasmUrl: "/vendor/pdfjs/wasm/",
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err instanceof Error && err.name === "PasswordException") {
      throw new PasswordRequiredError(Boolean(password));
    }
    throw err;
  }

  try {
    let text = "";
    let photo: string | null = null;
    let signature: string | null = null;
    let textItems = 0;
    let textChars = 0;
    const allImages: ImageInfo[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const strings = content.items.map((item) => ("str" in item ? item.str : ""));
      // One line per text item: some documents are values-only, and line boundaries carry the meaning.
      text += strings.join("\n") + "\n";
      textItems += strings.filter((s) => s.trim()).length;
      textChars += strings.reduce((sum, s) => sum + s.trim().length, 0);
      const images = await findImagesInPage(page, lib.OPS).catch(() => null);
      photo ??= images?.photo ?? null;
      signature ??= images?.signature ?? null;
      allImages.push(...(images?.images ?? []));
    }

    // Shape of the document for reading reports — counts, sizes and sanitised software names only.
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as Record<string, unknown>;
    const size = (await doc.getPage(1)).getViewport({ scale: 1 });
    const diag = (qr: ScannedQr | null): DocDiagnostics => ({
      kind: "pdf",
      pages: doc.numPages,
      pageSizePt: [Math.round(size.width), Math.round(size.height)],
      passwordProtected: Boolean(password),
      producer: sanitizeMeta(info.Producer),
      creator: sanitizeMeta(info.Creator),
      textItems,
      textChars,
      images: allImages,
      qr: qrDiag(qr),
      issuerHints: issuerHints(`${text} ${String(info.Producer ?? "")} ${String(info.Creator ?? "")} ${file.name}`),
    });

    // Some documents are used as images (e.g. the e-EPIC card renders): keep page 1 at the
    // requested width, and look for the QR there first.
    let pageCanvas: HTMLCanvasElement | null = null;
    if (pageWidth) {
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: pageWidth / page.getViewport({ scale: 1 }).width });
      pageCanvas = document.createElement("canvas");
      pageCanvas.width = Math.floor(viewport.width);
      pageCanvas.height = Math.floor(viewport.height);
      await page.render({ canvas: pageCanvas, viewport }).promise;
      const ctx = pageCanvas.getContext("2d")!;
      const qr = await findQr(ctx.getImageData(0, 0, pageCanvas.width, pageCanvas.height), accept);
      if (qr) return { qr, text, photo, signature, page: pageCanvas, diagnostics: diag(qr) };
    }

    // Dense QRs (Aadhaar, PAN) need a high render scale; high scales are slow and can exceed
    // iOS Safari's canvas size limit, so step up only when needed.
    for (const scale of [3, 5]) {
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const ctx = canvas.getContext("2d")!;
        const qr = await findQr(ctx.getImageData(0, 0, canvas.width, canvas.height), accept);
        canvas.width = canvas.height = 0; // release memory early on phones
        if (qr) return { qr, text, photo, signature, page: pageCanvas, diagnostics: diag(qr) };
      }
    }
    return { qr: null, text, photo, signature, page: pageCanvas, diagnostics: diag(null) };
  } finally {
    await task.destroy();
  }
}

export interface ScanOptions {
  acceptQr: QrFilter;
  pageWidth?: number;
}

export async function scanDocument(
  file: File,
  { password, acceptQr, pageWidth }: ScanOptions & { password?: string },
): Promise<ScannedDocument> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return scanPdf(file, password, acceptQr, pageWidth);
  }
  const qr = await findQr(file, acceptQr);
  const bitmap = await createImageBitmap(file).catch(() => null);
  const diagnostics: DocDiagnostics = {
    kind: "image",
    imageSizePx: bitmap ? [bitmap.width, bitmap.height] : undefined,
    qr: qrDiag(qr),
    issuerHints: issuerHints(file.name),
  };
  bitmap?.close();
  return { qr, text: "", photo: null, signature: null, page: null, diagnostics };
}

// Tries each candidate password in turn; an empty list means "try without a password".
export async function scanWithPasswords(
  file: File,
  passwords: string[],
  options: QrFilter | ScanOptions,
): Promise<ScannedDocument> {
  const opts = typeof options === "function" ? { acceptQr: options } : options;
  for (const password of passwords.length ? passwords : [undefined]) {
    try {
      return await scanDocument(file, { ...opts, password });
    } catch (err) {
      if (!(err instanceof PasswordRequiredError && err.incorrect)) throw err;
    }
  }
  throw new PasswordRequiredError(true);
}
