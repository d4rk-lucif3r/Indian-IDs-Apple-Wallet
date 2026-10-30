// Browser-only: draws the driving licence front, following the DigiLocker DL certificate layout:
// grey title band, two bold rows (authorization/licence no. | issue/expiry), a rule, then the
// labelled field grid with the photo on the right.
import type { DlDetails } from "@/lib/dl/parse";
import { LATIN, STRIP_HEIGHT, STRIP_WIDTH, drawCover } from "./canvas";
import { drawPoweredBy } from "./brand";

const INK = "#111111";
const MUTED = "#555555";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
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
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
  }
  return lines;
}

export async function renderDlCard(d: DlDetails, photo: string | null): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = STRIP_WIDTH;
  canvas.height = STRIP_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  ctx.textBaseline = "alphabetic";

  // Title band
  ctx.fillStyle = "#EFEFEF";
  ctx.fillRect(24, 10, STRIP_WIDTH - 48, 86);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 33px ${LATIN}`;
  ctx.fillText("UNION OF INDIA DRIVING LICENSE", STRIP_WIDTH / 2, 50);
  ctx.font = `400 22px ${LATIN}`;
  ctx.fillText(`Issuing Authority : ${d.issuingAuthority}`, STRIP_WIDTH / 2, 82, STRIP_WIDTH - 80);
  ctx.textAlign = "left";

  // Two summary rows: bold labels on the left, issue/expiry on the right (as on the certificate).
  const row = (y: number, left: [string, string], right: [string, string]) => {
    ctx.fillStyle = INK;
    ctx.font = `700 19px ${LATIN}`;
    ctx.fillText(left[0], 32, y);
    ctx.fillText(":", 258, y);
    ctx.fillText(left[1], 274, y, 380);
    ctx.font = `400 21px ${LATIN}`;
    ctx.fillText(right[0], 700, y);
    ctx.fillText(":", 870, y);
    ctx.fillText(right[1], 890, y, 205);
  };
  row(130, ["Authorization to Drive", d.classes], ["Date of Issue", d.issueDate]);
  row(164, ["License No.", d.licenceNo], ["Date of Expiry", d.expiryDate]);
  ctx.fillStyle = MUTED;
  ctx.fillRect(24, 180, STRIP_WIDTH - 48, 2);

  // Field grid
  const lx = 40, cx = 214, vx = 232, vw = 680;
  const field = (y: number, label: string, value: string) => {
    ctx.fillStyle = INK;
    ctx.font = `400 21px ${LATIN}`;
    ctx.fillText(label, lx, y);
    ctx.fillText(":", cx, y);
    ctx.fillText(value, vx, y, vw);
  };
  field(216, "Name", d.name);
  field(248, "DOB", d.dob);
  field(280, "Blood Group", d.bloodGroup);
  field(312, "S/W/D", d.relation);
  ctx.font = `400 21px ${LATIN}`;
  ctx.fillText("Present Address", lx, 344);
  ctx.fillText(":", cx, 344);
  wrap(ctx, d.presentAddress, vw, 2).forEach((line, i) => ctx.fillText(line, vx, 344 + i * 28));

  // Photo, top-right of the field grid
  const pw = 120, ph = 150, px = STRIP_WIDTH - 40 - pw, py = 198;
  if (photo) await drawCover(ctx, photo, px, py, pw, ph);
  else {
    ctx.fillStyle = "#D9D9D9";
    ctx.fillRect(px, py, pw, ph);
  }

  ctx.fillStyle = MUTED;
  ctx.font = `400 16px ${LATIN}`;
  ctx.fillText("Personal copy · not an official document", 40, 416);
  await drawPoweredBy(ctx);
  return canvas.toDataURL("image/png");
}
