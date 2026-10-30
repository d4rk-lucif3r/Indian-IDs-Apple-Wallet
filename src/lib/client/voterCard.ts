// Browser-only: locates the official card renders on an e-EPIC page and crops what the Voter ID
// flow needs: the holder photo, and regions for OCR. (The card itself is redrawn: voterCardArt.ts.)
// ECI's e-EPIC is a standard A4 layout with the card front and back side by side near the top.

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Positions as fractions of the page, measured on ECI e-EPIC downloads (text and image-only).
const FRONT: Rect = { x: 0.0536, y: 0.1121, w: 0.4133, h: 0.1839 };
const BACK: Rect = { x: 0.5486, y: 0.1121, w: 0.4133, h: 0.1839 };

// Recommended render width for the page; matches the native resolution of image-only e-EPICs.
export const EPIC_PAGE_WIDTH = 2313;

const SEARCH = 10; // px either side of the expected edge
const DARK = 200;

// Fraction of dark pixels along a horizontal (or vertical) segment.
function lineScore(px: ImageData, horizontal: boolean, at: number, from: number, to: number): number {
  let dark = 0;
  for (let t = from; t < to; t++) {
    const [x, y] = horizontal ? [t, at] : [at, t];
    if (x < 0 || y < 0 || x >= px.width || y >= px.height) continue;
    const i = (y * px.width + x) * 4;
    if ((px.data[i] + px.data[i + 1] + px.data[i + 2]) / 3 < DARK) dark++;
  }
  return dark / Math.max(1, to - from);
}

// Snaps an expected edge to the card's border line, if one is found nearby.
function snap(px: ImageData, horizontal: boolean, expected: number, from: number, to: number) {
  let best = { at: expected, score: 0 };
  for (let d = -SEARCH; d <= SEARCH; d++) {
    const score = lineScore(px, horizontal, expected + d, from, to);
    if (score > best.score) best = { at: expected + d, score };
  }
  return { at: best.score >= 0.5 ? best.at : expected, found: best.score >= 0.5 };
}

function locate(px: ImageData, rel: Rect): { rect: Rect; edgesFound: number } {
  const W = px.width, H = px.height;
  let x0 = Math.round(rel.x * W), y0 = Math.round(rel.y * H);
  let x1 = Math.round((rel.x + rel.w) * W), y1 = Math.round((rel.y + rel.h) * H);
  const top = snap(px, true, y0, x0 + 20, x1 - 20);
  const bottom = snap(px, true, y1, x0 + 20, x1 - 20);
  const left = snap(px, false, x0, y0 + 20, y1 - 20);
  const right = snap(px, false, x1, y0 + 20, y1 - 20);
  [y0, y1, x0, x1] = [top.at, bottom.at, left.at, right.at];
  return {
    rect: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    edgesFound: [top, bottom, left, right].filter((e) => e.found).length,
  };
}

function crop(page: HTMLCanvasElement, r: Rect): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = r.w;
  c.height = r.h;
  c.getContext("2d")!.drawImage(page, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return c;
}

export class NotAnEpicError extends Error {}

// Regions on the card front, as fractions of the card: the photo (inside its white frame)
// and the bilingual name block (for Hindi OCR).
const PHOTO: Rect = { x: 0.044, y: 0.387, w: 0.232, h: 0.52 };
const NAMES: Rect = { x: 0.299, y: 0.374, w: 0.523, h: 0.233 };
// Details block below the cards (Epic no., serial, constituency, part, polling station), on the page.
const INFO: Rect = { x: 0.298, y: 0.36, w: 0.692, h: 0.214 };

const scaled = (r: Rect, w: number, h: number): Rect => ({
  x: Math.round(r.x * w), y: Math.round(r.y * h), w: Math.round(r.w * w), h: Math.round(r.h * h),
});

export interface VoterPage {
  front: HTMLCanvasElement; // official card renders, for OCR
  back: HTMLCanvasElement;
  info: HTMLCanvasElement;
  names: HTMLCanvasElement;
  photo: string; // PNG data URL of the holder's photo
}

export function readVoterPage(page: HTMLCanvasElement): VoterPage {
  const px = page.getContext("2d")!.getImageData(0, 0, page.width, page.height);
  const front = locate(px, FRONT);
  const back = locate(px, BACK);
  if (front.edgesFound + back.edgesFound < 5) {
    throw new NotAnEpicError("This doesn't look like an ECI e-EPIC. Download it from voters.eci.gov.in.");
  }
  const card = crop(page, front.rect);
  return {
    front: card,
    back: crop(page, back.rect),
    info: crop(page, scaled(INFO, page.width, page.height)),
    names: crop(card, scaled(NAMES, card.width, card.height)),
    photo: crop(card, scaled(PHOTO, card.width, card.height)).toDataURL("image/png"),
  };
}
