// Browser-only: reads an uploaded ID document (PDF or image) locally — QR, printed text,
// photo and signature. The file never leaves the device.
import { findImagesInPage } from "./pdfImages";

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
}

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
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      // One line per text item: some documents are values-only, and line boundaries carry the meaning.
      text += content.items.map((item) => ("str" in item ? item.str : "")).join("\n") + "\n";
      const images = await findImagesInPage(page, lib.OPS).catch(() => null);
      photo ??= images?.photo ?? null;
      signature ??= images?.signature ?? null;
    }

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
      if (qr) return { qr, text, photo, signature, page: pageCanvas };
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
        if (qr) return { qr, text, photo, signature, page: pageCanvas };
      }
    }
    return { qr: null, text, photo, signature, page: pageCanvas };
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
  return { qr: await findQr(file, acceptQr), text: "", photo: null, signature: null, page: null };
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
