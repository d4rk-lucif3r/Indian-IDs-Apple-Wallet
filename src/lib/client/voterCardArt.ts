// Browser-only: draws the Voter ID front in the style of the ECI e-EPIC card — lavender and
// orange guilloche, bilingual ECI header, EPIC no., photo, bilingual details and the
// "e-Electors Photo Identity Card" footer. Emblem and ECI logo are intentionally left out.
import type { VoterDetails } from "@/lib/voter/parse";
import { DEVANAGARI, LATIN, STRIP_HEIGHT, STRIP_WIDTH, drawCover } from "./canvas";
import { drawPoweredBy } from "./brand";

const INK = "#111111";
const RED = "#D7262C";
// Must match the pass backgroundColor (src/lib/pass/voterPass.ts) so the strip blends in.
const PASS_BG = "249, 234, 218";

const GENDER_HI: Record<string, string> = { male: "पुरुष", female: "महिला", "third gender": "तृतीय लिंग", transgender: "तृतीय लिंग", other: "अन्य" };
const RELATION_HI: Record<string, string> = { father: "पिता का नाम", husband: "पति का नाम", mother: "माता का नाम", wife: "पत्नी का नाम" };

function background(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#FDFBF7";
  ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  const glow = (x: number, y: number, r: number, rgb: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb}, ${a})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  };
  glow(110, 70, 420, "201, 184, 232", 0.55); // lavender, top left
  glow(930, 150, 560, "246, 178, 107", 0.62); // orange, right
  glow(330, 470, 320, "159, 208, 240", 0.45); // sky blue, bottom
  // Guilloche: fine wavy lines — lavender on the left, orange sweeping on the right.
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 26; k++) {
    ctx.strokeStyle = "rgba(150, 120, 200, 0.16)";
    ctx.beginPath();
    for (let x = 0; x <= 520; x += 6) {
      const y = 20 + k * 16 + Math.sin(x / 55 + k * 0.5) * 9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(232, 140, 50, 0.28)";
    ctx.beginPath();
    for (let a = 0; a <= 1; a += 0.02) {
      const x = 480 + a * 700;
      const y = -40 + k * 18 + Math.pow(a, 1.6) * 260 + Math.sin(a * 9 + k * 0.3) * 8;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

async function grayscale(src: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  await drawCover(ctx, src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function renderVoterCard(v: VoterDetails, photo: string | null): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = STRIP_WIDTH;
  canvas.height = STRIP_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  await document.fonts?.ready;
  background(ctx);
  // Fade the top and bottom edges into the pass colour so the card has no hard seams.
  for (const [y0, y1] of [[0, 30], [STRIP_HEIGHT, STRIP_HEIGHT - 30]]) {
    const fade = ctx.createLinearGradient(0, y0, 0, y1);
    fade.addColorStop(0, `rgba(${PASS_BG}, 1)`);
    fade.addColorStop(1, `rgba(${PASS_BG}, 0)`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, Math.min(y0, y1), STRIP_WIDTH, 30);
  }
  ctx.textBaseline = "alphabetic";

  // Header: Hindi title over a rule, English title below (as on the card).
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 34px ${DEVANAGARI}`;
  ctx.fillText("भारत निर्वाचन आयोग", STRIP_WIDTH / 2, 42);
  ctx.fillRect(230, 53, STRIP_WIDTH - 460, 3);
  ctx.font = `700 32px ${LATIN}`;
  ctx.fillText("ELECTION COMMISSION OF INDIA", STRIP_WIDTH / 2, 92);
  ctx.textAlign = "left";

  // EPIC no. and photo
  ctx.font = `700 30px ${LATIN}`;
  ctx.fillText(v.epicNo, 40, 140);
  const px = 40, py = 154, pw = 176, ph = 236;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
  if (photo) await drawCover(ctx, photo, px, py, pw, ph);
  else {
    ctx.fillStyle = "#D9D9D9";
    ctx.fillRect(px, py, pw, ph);
  }

  // Bilingual details. Hindi name lines are drawn only when known.
  const tx = 246, maxW = 560;
  const relKey = (/^(\w+)/.exec(v.relationLabel)?.[1] ?? "father").toLowerCase();
  const relationEn = v.relationLabel || "Father's Name";
  const rows: [string, string][] = [];
  if (v.nameHi) rows.push([`नाम: ${v.nameHi}`, `700 26px ${DEVANAGARI}`]);
  rows.push([`Name: ${v.name}`, `700 26px ${LATIN}`]);
  if (v.relationNameHi) rows.push([`${RELATION_HI[relKey] ?? "पिता का नाम"}: ${v.relationNameHi}`, `700 26px ${DEVANAGARI}`]);
  if (v.relationName) rows.push([`${relationEn}: ${v.relationName}`, `700 26px ${LATIN}`]);
  const genderHi = GENDER_HI[v.gender.toLowerCase()];
  rows.push([`लिंग / Gender: ${genderHi ? `${genderHi} / ` : ""}${v.gender}`, `400 25px ${DEVANAGARI}`]);
  rows.push(["जन्म तिथि / आयु:", `400 23px ${DEVANAGARI}`]);
  rows.push([`Date of Birth / Age: ${v.dob}`, `400 25px ${LATIN}`]);
  const step = Math.min(36, Math.floor((372 - 176) / Math.max(1, rows.length - 1)));
  rows.forEach(([text, font], i) => {
    ctx.font = font;
    ctx.fillStyle = INK;
    ctx.fillText(text, tx, 180 + i * step, maxW);
  });

  // Small greyscale photo with the EPIC no. running vertically beside it (top right).
  if (photo) {
    const sp = await grayscale(photo, 84, 104);
    ctx.drawImage(sp, 968, 120);
  }
  ctx.save();
  ctx.translate(1072, 120);
  ctx.rotate(Math.PI / 2);
  ctx.font = `500 15px ${LATIN}`;
  ctx.fillStyle = INK;
  ctx.fillText(v.epicNo, 4, 0);
  ctx.restore();

  // Personal-copy notice (bottom right) and the card's footer line.
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(840, 300, 246, 56);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `600 16px ${LATIN}`;
  ctx.fillText("Personal copy,", 963, 323);
  ctx.font = `400 16px ${LATIN}`;
  ctx.fillText("not an official document.", 963, 345);
  ctx.font = `400 23px ${DEVANAGARI}`;
  ctx.fillText("e-Electors Photo Identity Card - ई- मतदाता पहचान पत्र", STRIP_WIDTH / 2, 422);
  await drawPoweredBy(ctx);
  return canvas.toDataURL("image/png");
}


