// Browser-only: draws the PAN-card-style front used as the pass's strip image.
import type { PanDetails } from "@/lib/pan/parse";
import { DEVANAGARI, LATIN, STRIP_HEIGHT, STRIP_WIDTH, drawContain, drawCover } from "./canvas";
import { drawPoweredBy } from "./brand";

const MAROON = "#7A1F1F";
const NAVY = "#1C2E6B";
const INK = "#111111";
const RED = "#D7262C";
const SERIF = '"Times New Roman", Times, serif';
// Must match the pass backgroundColor (src/lib/pass/panPass.ts) so the strip blends in.
const PASS_BG = "214, 233, 248";

function bilingualLabel(ctx: CanvasRenderingContext2D, hindi: string, english: string, x: number, y: number) {
  ctx.fillStyle = NAVY;
  ctx.font = `500 21px ${DEVANAGARI}`;
  ctx.fillText(hindi, x, y);
  const w = ctx.measureText(hindi).width;
  ctx.font = `500 20px ${LATIN}`;
  ctx.fillText(` / ${english}`, x + w, y);
}

function value(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  ctx.fillStyle = INK;
  ctx.font = `500 30px ${LATIN}`;
  ctx.fillText(text, x, y, maxWidth);
}

export async function renderPanCard(details: PanDetails, photo: string | null, signature: string | null): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = STRIP_WIDTH;
  canvas.height = STRIP_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  await document.fonts?.ready;

  // Lavender-to-sky-blue background with faint guilloche waves, like the printed card.
  const bg = ctx.createLinearGradient(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  bg.addColorStop(0, "#E6DBF1");
  bg.addColorStop(0.45, "#D3E8F8");
  bg.addColorStop(1, "#A9D3F1");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 14; k++) {
    ctx.beginPath();
    for (let x = 0; x <= STRIP_WIDTH; x += 8) {
      const y = 60 + k * 28 + Math.sin(x / 70 + k * 0.6) * 12 + Math.sin(x / 23 + k) * 3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Fade the top and bottom edges into the pass colour so the strip has no hard seams.
  for (const [y0, y1] of [[0, 34], [STRIP_HEIGHT, STRIP_HEIGHT - 34]]) {
    const fade = ctx.createLinearGradient(0, y0, 0, y1);
    fade.addColorStop(0, `rgba(${PASS_BG}, 1)`);
    fade.addColorStop(1, `rgba(${PASS_BG}, 0)`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, Math.min(y0, y1), STRIP_WIDTH, 34);
  }

  // Two columns on a shared row grid: left x=40 (photo, then name/father), right x=720.
  const L = 40;
  const R = 720;
  const ROW1_LABEL = 290, ROW1_VALUE = 322; // Name | Date of Birth
  const ROW2_LABEL = 354, ROW2_VALUE = 386; // Father's Name

  // Header
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MAROON;
  ctx.font = `600 38px ${DEVANAGARI}`;
  ctx.fillText("आयकर विभाग", L, 52);
  ctx.textAlign = "right";
  ctx.fillText("भारत सरकार", STRIP_WIDTH - L, 52);
  ctx.fillStyle = "#2B1B1B";
  ctx.font = `400 25px ${SERIF}`;
  ctx.fillText("GOVT. OF INDIA", STRIP_WIDTH - L, 84);
  ctx.textAlign = "left";
  ctx.fillText("INCOME TAX DEPARTMENT", L, 84);

  // Photo
  const px = L, py = 104, pw = 120, ph = 148;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
  if (photo) {
    await drawCover(ctx, photo, px, py, pw, ph);
  } else {
    ctx.fillStyle = "#C9D3DD";
    ctx.fillRect(px, py, pw, ph);
  }

  // Card title and PAN, beside the photo
  const tx = px + pw + 30;
  ctx.fillStyle = NAVY;
  ctx.font = `600 26px ${DEVANAGARI}`;
  ctx.fillText("स्थायी लेखा संख्या कार्ड", tx, 130);
  ctx.font = `600 23px ${LATIN}`;
  ctx.fillText("Permanent Account Number Card", tx, 160);
  ctx.fillStyle = INK;
  ctx.font = `500 50px ${LATIN}`;
  ctx.letterSpacing = "5px";
  ctx.fillText(details.pan, tx, 222, R - tx - 30);
  ctx.letterSpacing = "0px";

  // Right column: signature, its label, then the personal-copy notice — all above row 1.
  if (signature) await drawContain(ctx, signature, R, 100, 300, 78);
  bilingualLabel(ctx, "हस्ताक्षर", "Signature", R, 200);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(R, 214, STRIP_WIDTH - L - R, 52);
  ctx.fillStyle = INK;
  ctx.font = `600 17px ${LATIN}`;
  ctx.fillText("Personal copy, not an official document.", R + 12, 236, STRIP_WIDTH - L - R - 24);
  ctx.font = `400 17px ${LATIN}`;
  ctx.fillText("Verify the QR with the PAN QR Code Reader.", R + 12, 257, STRIP_WIDTH - L - R - 24);

  // Details on the shared rows
  bilingualLabel(ctx, "नाम", "Name", L, ROW1_LABEL);
  value(ctx, details.name, L, ROW1_VALUE, R - L - 40);
  bilingualLabel(ctx, "जन्म की तारीख", "Date of Birth", R, ROW1_LABEL);
  value(ctx, details.dob, R, ROW1_VALUE, STRIP_WIDTH - L - R);
  bilingualLabel(ctx, "पिता का नाम", "Father's Name", L, ROW2_LABEL);
  value(ctx, details.fatherName, L, ROW2_VALUE, R - L - 40);

  await drawPoweredBy(ctx);
  return canvas.toDataURL("image/png");
}
