// Browser-only: draws the Aadhaar-style card front used as the pass's strip image.
// Drawn client-side so Devanagari text is shaped by the device's own fonts.
import { formatAddress, maskedAadhaar, type AadhaarSecureQr } from "@/lib/aadhaar/secureQr";
import { DEVANAGARI, LATIN, STRIP_HEIGHT, STRIP_WIDTH, drawCover } from "./canvas";
import { drawPoweredBy } from "./brand";


const SAFFRON = "#F07F13";
const GREEN = "#1FA64A";
const RED = "#D7262C";
const SUN = "#F5B820";
const INK = "#1A1A1A";

const GENDER: Record<string, string> = {
  M: "पुरुष/ MALE",
  F: "महिला/ FEMALE",
  T: "ट्रांसजेंडर/ TRANSGENDER",
};

// Deterministic jitter so brush strokes look hand-painted but render identically every time.
function jitter(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function brushStroke(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h * 0.15);
  for (let i = 0; i <= 20; i++) ctx.lineTo(x + (w * i) / 20, y + jitter(seed + i) * h * 0.18);
  ctx.lineTo(x + w + 30, y + h * 0.35);
  ctx.lineTo(x + w - 10, y + h * 0.6);
  for (let i = 20; i >= 0; i--) ctx.lineTo(x + (w * i) / 20, y + h - jitter(seed + 40 + i) * h * 0.18);
  ctx.quadraticCurveTo(x - 12, y + h * 0.5, x + 10, y + h * 0.15);
  ctx.fill();

  // Dry-brush flecks trailing off the right end
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 10; i++) {
    const fx = x + w + 20 + jitter(seed + 80 + i) * 110;
    const fy = y + h * (0.25 + jitter(seed + 90 + i) * 0.5);
    ctx.beginPath();
    ctx.ellipse(fx, fy, 4 + jitter(seed + 100 + i) * 12, 1.5 + jitter(seed + 110 + i) * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Sun-and-fingerprint mark in the style of the Aadhaar logo.
function aadhaarMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = SUN;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (Math.PI * i) / 8;
    const tip = r * 1.35;
    const spread = 0.13;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * tip, cy + Math.sin(a) * tip);
    ctx.lineTo(cx + Math.cos(a - spread) * r * 1.02, cy + Math.sin(a - spread) * r * 1.02);
    ctx.lineTo(cx + Math.cos(a + spread) * r * 1.02, cy + Math.sin(a + spread) * r * 1.02);
    ctx.fill();
  }

  ctx.strokeStyle = RED;
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.09;
  for (let i = 0; i < 5; i++) {
    const rr = r * (0.92 - i * 0.18);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, Math.PI * (1.08 + i * 0.03), Math.PI * (1.95 - i * 0.04));
    ctx.stroke();
  }

  ctx.fillStyle = RED;
  ctx.font = `700 ${r * 0.62}px ${DEVANAGARI}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("आधार", cx, cy + r * 0.08);
  ctx.textAlign = "left";
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Full address in the right column, shrinking the font until it fits the box.
function drawAddress(ctx: CanvasRenderingContext2D, address: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = RED;
  ctx.font = `600 26px ${DEVANAGARI}`;
  ctx.fillText("पता/ Address:", x, y + 26);

  const top = y + 44;
  for (let size = 28; size >= 18; size -= 1) {
    ctx.font = `400 ${size}px ${LATIN}`;
    const lineHeight = size * 1.25;
    const lines = wrapLines(ctx, address, w);
    if (lines.length * lineHeight <= h - 44 || size === 18) {
      ctx.fillStyle = INK;
      lines.forEach((l, i) => ctx.fillText(l, x, top + size + i * lineHeight, w));
      return;
    }
  }
}

// Red-bordered notice, echoing the one on the physical card.
function drawNotice(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = INK;
  ctx.font = `600 19px ${LATIN}`;
  ctx.fillText("Personal copy, not an official document.", x + 12, y + 27, w - 24);
  ctx.font = `400 19px ${LATIN}`;
  ctx.fillText("Verify by scanning the QR with mAadhaar.", x + 12, y + 51, w - 24);
}


// Relation prefix as printed on the card; the QR's care-of field is often just the name.
function relationLine(careOf: string): string {
  return /^[SDWC]\s*\/\s*O\b/i.test(careOf) ? careOf : `C/O: ${careOf}`;
}

export async function renderCardFront(
  qr: AadhaarSecureQr,
  photo: string | null,
  { vid = null, uid = null }: { vid?: string | null; uid?: string | null } = {},
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = STRIP_WIDTH;
  canvas.height = STRIP_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  await document.fonts?.ready;

  const bg = ctx.createLinearGradient(0, 0, 0, STRIP_HEIGHT);
  // Starts and ends on the pass background colour so the strip blends into the pass.
  bg.addColorStop(0, "#FDF3E0");
  bg.addColorStop(0.55, "#F7F2E2");
  bg.addColorStop(0.85, "#E6F1DC");
  bg.addColorStop(1, "#FDF3E0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);

  // Header: tricolour brush strokes with bilingual title
  brushStroke(ctx, 40, 14, 560, 46, SAFFRON, 1);
  brushStroke(ctx, 40, 66, 640, 46, GREEN, 2);
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.font = `600 34px ${DEVANAGARI}`;
  ctx.fillText("भारत सरकार", 215, 38);
  ctx.font = `500 32px ${LATIN}`;
  ctx.fillText("Government of India", 190, 90);

  aadhaarMark(ctx, 1020, 86, 56);

  // Photo
  const px = 46, py = 134, pw = 148, ph = 184;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(px - 5, py - 5, pw + 10, ph + 10);
  if (photo) {
    await drawCover(ctx, photo, px, py, pw, ph);
  } else {
    ctx.fillStyle = "#D9D9D9";
    ctx.fillRect(px, py, pw, ph);
  }

  // Details. The relation line (S/O, D/O, W/O, C/O …) only appears when the QR has one.
  const tx = 222;
  const maxW = 450;
  const careOf = qr.address.careOf.trim();
  const dob = `जन्म तिथि/DOB: ${qr.dob.replaceAll("-", "/")}`;
  const gender = GENDER[qr.gender] ?? qr.gender;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `600 40px ${LATIN}`;
  ctx.fillText(qr.name.toUpperCase(), tx, careOf ? 166 : 172, maxW);
  ctx.font = `400 29px ${DEVANAGARI}`;
  const lines = careOf ? [relationLine(careOf), dob, gender] : [dob, gender];
  lines.forEach((line, i) => ctx.fillText(line, tx, (careOf ? 202 : 216) + i * (careOf ? 35 : 42), maxW));
  ctx.font = `700 42px ${LATIN}`;
  ctx.fillText(uid ?? maskedAadhaar(qr.last4), tx, vid ? 314 : 330, maxW);
  if (vid) {
    ctx.font = `500 24px ${LATIN}`;
    ctx.fillText(`VID : ${vid}`, tx, 342, maxW);
  }

  drawAddress(ctx, formatAddress(qr.address, { includeCareOf: false }), 700, 124, 390, 140);
  drawNotice(ctx, 696, 280, 404, 58);

  // Footer: red rule and centred bilingual tagline, as on the physical card ("आधार" in red).
  ctx.fillStyle = RED;
  ctx.fillRect(40, 350, STRIP_WIDTH - 80, 3);
  const parts: [string, string, string][] = [
    ["मेरा ", INK, `600 38px ${DEVANAGARI}`],
    ["आधार", RED, `600 38px ${DEVANAGARI}`],
    [", मेरी पहचान", INK, `600 38px ${DEVANAGARI}`],
    ["   ·   ", INK, `400 28px ${LATIN}`],
    ["My ", INK, `500 28px ${LATIN}`],
    ["Aadhaar", RED, `600 28px ${LATIN}`],
    [", My Identity", INK, `500 28px ${LATIN}`],
  ];
  const width = parts.reduce((w, [text, , font]) => ((ctx.font = font), w + ctx.measureText(text).width), 0);
  // Centred in the space left of the "Powered by" mark (bottom-right, ~200px).
  let x = Math.max(40, (STRIP_WIDTH - 220 - width) / 2 + 10);
  for (const [text, color, font] of parts) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, x, 404);
    x += ctx.measureText(text).width;
  }

  await drawPoweredBy(ctx);
  return canvas.toDataURL("image/png");
}
