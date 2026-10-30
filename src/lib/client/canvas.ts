// Shared helpers for drawing card fronts (Wallet storeCard strip images).

// storeCard strip image @3x (375 x 144 pt)
export const STRIP_WIDTH = 1125;
export const STRIP_HEIGHT = 432;

export const DEVANAGARI = '"Kohinoor Devanagari", "Noto Sans Devanagari", "Devanagari Sangam MN", sans-serif';
export const LATIN = '-apple-system, "Helvetica Neue", Arial, sans-serif';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Draws an image to fill the box, cropping the overflow (like CSS object-fit: cover).
export async function drawCover(ctx: CanvasRenderingContext2D, src: string, x: number, y: number, w: number, h: number) {
  const img = await loadImage(src);
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

// Draws an image inside the box without cropping (like CSS object-fit: contain), left-aligned.
export async function drawContain(ctx: CanvasRenderingContext2D, src: string, x: number, y: number, w: number, h: number) {
  const img = await loadImage(src);
  const scale = Math.min(w / img.width, h / img.height);
  ctx.drawImage(img, x, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale);
}
