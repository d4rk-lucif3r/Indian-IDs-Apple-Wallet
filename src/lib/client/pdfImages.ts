// Browser-only: picks the holder's photo and signature out of a PDF's embedded images.
import type { PDFPageProxy } from "pdfjs-dist";

interface PdfImage {
  width: number;
  height: number;
  bitmap?: ImageBitmap;
  data?: Uint8ClampedArray;
  kind?: number;
}

const RGB_24BPP = 2;
const RGBA_32BPP = 3;

function toCanvas(img: PdfImage): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
    return canvas;
  }
  if (!img.data || (img.kind !== RGB_24BPP && img.kind !== RGBA_32BPP)) return null;
  const count = img.width * img.height;
  const channels = img.kind === RGBA_32BPP ? 4 : 3;
  const rgba = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    rgba[i * 4] = img.data[i * channels];
    rgba[i * 4 + 1] = img.data[i * channels + 1];
    rgba[i * 4 + 2] = img.data[i * channels + 2];
    rgba[i * 4 + 3] = channels === 4 ? img.data[i * 4 + 3] : 255;
  }
  ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
  return canvas;
}

// Metrics on a downsampled copy, composited over white (signatures are often transparent PNGs):
// - colourfulness (Hasler–Süsstrunk): photos score high; emblems, ink and line art score low.
// - variety: share of distinct colours; photos have many, logos/text/QRs/signatures few.
// - whiteness / darkness / transparency: paper, ink and empty canvas.
function measure(source: HTMLCanvasElement) {
  const s = document.createElement("canvas");
  s.width = 48;
  s.height = 60;
  const ctx = s.getContext("2d")!;
  ctx.drawImage(source, 0, 0, s.width, s.height);
  const { data } = ctx.getImageData(0, 0, s.width, s.height);
  const rg: number[] = [];
  const yb: number[] = [];
  const colours = new Set<number>();
  let white = 0;
  let dark = 0;
  let transparent = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.1) transparent++;
    const r = data[i] * a + 255 * (1 - a);
    const g = data[i + 1] * a + 255 * (1 - a);
    const b = data[i + 2] * a + 255 * (1 - a);
    rg.push(r - g);
    yb.push((r + g) / 2 - b);
    colours.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    if (r > 225 && g > 225 && b > 225) white++;
    if (r + g + b < 300) dark++;
  }
  const stats = (v: number[]) => {
    const mean = v.reduce((x, y) => x + y, 0) / v.length;
    return { mean, sd: Math.sqrt(v.reduce((x, y) => x + (y - mean) ** 2, 0) / v.length) };
  };
  const ca = stats(rg);
  const cb = stats(yb);
  const pixels = data.length / 4;
  return {
    colourfulness: Math.hypot(ca.sd, cb.sd) + 0.3 * Math.hypot(ca.mean, cb.mean),
    variety: colours.size / pixels,
    whiteness: white / pixels,
    darkness: dark / pixels,
    transparency: transparent / pixels,
  };
}

function onWhite(source: HTMLCanvasElement): string {
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0);
  return c.toDataURL("image/png");
}

// Crops transparent/white margins so a signature on a big empty canvas is judged by its ink.
function trimToInk(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const { width, height } = source;
  const { data } = source.getContext("2d")!.getImageData(0, 0, width, height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 25 && data[i] + data[i + 1] + data[i + 2] < 600) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  const x = Math.max(0, minX - pad), y = Math.max(0, minY - pad);
  const w = Math.min(width, maxX + pad + 1) - x, h = Math.min(height, maxY + pad + 1) - y;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(source, x, y, w, h, 0, 0, w, h);
  return out;
}

export interface PageImages {
  photo: string | null;
  signature: string | null; // PNG data URL, transparency preserved
}

const MAX_SIDE = 2000; // larger images are page backgrounds/scans, never the photo or signature

// Resamples an image to the aspect ratio it's actually drawn at; PDFs sometimes stretch
// images (e.g. a 3:4 signature canvas squeezed into a wide box).
function toDrawnAspect(source: HTMLCanvasElement, drawnRatio: number): HTMLCanvasElement {
  const height = Math.max(1, Math.round(source.width * drawnRatio));
  if (Math.abs(height - source.height) < 2) return source;
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = height;
  out.getContext("2d")!.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

type Matrix = [number, number, number, number, number, number];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export interface PdfOps {
  paintImageXObject: number;
  save: number;
  restore: number;
  transform: number;
}

export async function findImagesInPage(page: PDFPageProxy, OPS: PdfOps): Promise<PageImages> {
  const ops = await page.getOperatorList();
  const [, , pageW, pageH] = page.view;
  let photo: { canvas: HTMLCanvasElement; area: number } | null = null;
  let signature: { canvas: HTMLCanvasElement; area: number } | null = null;
  const seen = new Set<string>();

  // Track the transform matrix so we know each image's drawn size on the page.
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiply(ctm, ops.argsArray[i] as Matrix);
    if (fn !== OPS.paintImageXObject) continue;

    const id = ops.argsArray[i][0] as string;
    if (seen.has(id)) continue; // e-documents often paint the same image twice
    seen.add(id);
    const drawnW = Math.hypot(ctm[0], ctm[1]);
    const drawnH = Math.hypot(ctm[2], ctm[3]);
    if (drawnW * drawnH > 0.3 * pageW * pageH) continue; // page background, not a card element

    const store = id.startsWith("g_") ? page.commonObjs : page.objs;
    const img: PdfImage | null = await new Promise((resolve) => store.get(id, resolve));
    if (!img || img.width < 60 || Math.max(img.width, img.height) > MAX_SIDE) continue;

    const raw = toCanvas(img);
    if (!raw) continue;
    const canvas = drawnW > 0 && drawnH > 0 ? toDrawnAspect(raw, drawnH / drawnW) : raw;
    const m = measure(canvas);
    const ratio = canvas.height / canvas.width;
    const area = canvas.width * canvas.height;

    // Photo: square to passport-portrait, colourful and varied. A white studio background is
    // fine as long as the image is varied; flat graphics and text images are not.
    const photoShape = ratio >= 0.9 && ratio <= 1.6;
    const isPhoto =
      photoShape && m.colourfulness >= 15 && ((m.whiteness <= 0.3 && m.variety >= 0.05) || (m.whiteness <= 0.6 && m.variety >= 0.12));
    if (isPhoto) {
      if (!photo || area > photo.area) photo = { canvas, area };
      continue;
    }

    // Signature: sparse ink on paper or a transparent canvas, wide once margins are trimmed.
    // Blue ink scores moderately "colourful", so the colour cap only rules out pictures.
    if ((m.whiteness > 0.5 || m.transparency > 0.5) && m.variety < 0.1 && m.colourfulness < 60) {
      const ink = trimToInk(canvas);
      if (!ink) continue;
      const inkRatio = ink.height / ink.width;
      const inkArea = ink.width * ink.height;
      if (inkRatio >= 0.08 && inkRatio <= 0.8 && ink.width >= 60) {
        if (!signature || inkArea > signature.area) signature = { canvas: ink, area: inkArea };
      }
    }
  }
  return {
    photo: photo ? onWhite(photo.canvas) : null,
    signature: signature ? signature.canvas.toDataURL("image/png") : null,
  };
}
