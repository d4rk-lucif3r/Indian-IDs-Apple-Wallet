// Browser-only: the small "Powered by Arsh Anwar" mark drawn in the bottom-right corner of every
// card front — fine-print sized, so it reads as a signature rather than an advert.
import { LATIN, STRIP_HEIGHT, STRIP_WIDTH, loadImage } from "./canvas";

const LOGO_HEIGHT = 40;
const MARGIN_RIGHT = 36;
const MARGIN_BOTTOM = 12;

export async function drawPoweredBy(ctx: CanvasRenderingContext2D) {
  const logo = await loadImage("/brand/arsh-logo.svg");
  const lw = Math.round((LOGO_HEIGHT * logo.width) / logo.height);
  const lx = STRIP_WIDTH - MARGIN_RIGHT - lw;
  const ly = STRIP_HEIGHT - MARGIN_BOTTOM - LOGO_HEIGHT;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.drawImage(logo, lx, ly, lw, LOGO_HEIGHT);
  ctx.fillStyle = "#555555";
  ctx.font = `500 15px ${LATIN}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Powered by", lx - 8, ly + LOGO_HEIGHT * 0.62);
  ctx.restore();
}
