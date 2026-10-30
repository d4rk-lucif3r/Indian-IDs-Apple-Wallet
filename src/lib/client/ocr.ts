// Browser-only OCR (Tesseract LSTM models), served from /vendor so nothing goes to a CDN.
// The engine (~4 MB) and models (English ~3 MB, Hindi ~1.4 MB) download on first use and are
// cached by the browser. One worker per language, created only when needed.
import type { PSM, Worker } from "tesseract.js";

export type OcrLang = "eng" | "hin";

const workers = new Map<OcrLang, Promise<Worker>>();

function worker(lang: OcrLang): Promise<Worker> {
  if (!workers.has(lang)) {
    workers.set(
      lang,
      import("tesseract.js").then(({ createWorker }) =>
        createWorker(lang, 1, {
          workerPath: "/vendor/tesseract/worker.min.js",
          corePath: "/vendor/tesseract/core",
          langPath: "/vendor/tesseract/lang",
          workerBlobURL: false,
        }),
      ),
    );
  }
  return workers.get(lang)!;
}

// Upscales and binarises: printed ID text is near-black, while the security patterns behind it
// are light and coloured, so a luminance threshold strips most of the background noise.
function prepare(source: HTMLCanvasElement, scale = 2, threshold = 140): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = source.width * scale;
  c.height = source.height * scale;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export type PageSegMode = "3" | "6"; // 3 = automatic layout (cards), 6 = single uniform block

export async function recognize(
  source: HTMLCanvasElement,
  { psm = "3", lang = "eng" }: { psm?: PageSegMode; lang?: OcrLang } = {},
): Promise<string> {
  const w = await worker(lang);
  await w.setParameters({ tessedit_pageseg_mode: psm as PSM });
  const { data } = await w.recognize(prepare(source));
  return data.text;
}
