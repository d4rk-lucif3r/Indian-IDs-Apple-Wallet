"use client";

// Dev-only: renders every card design with sample (fake) data, for iterating on designs and
// producing README screenshots. Returns 404 in production builds.
import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { AadhaarSecureQr } from "@/lib/aadhaar/secureQr";
import type { PanDetails } from "@/lib/pan/parse";
import type { DlDetails } from "@/lib/dl/parse";
import { EMPTY_VOTER, type VoterDetails } from "@/lib/voter/parse";
import { renderCardFront } from "@/lib/client/renderCard";
import { renderPanCard } from "@/lib/client/panCard";
import { renderDlCard } from "@/lib/client/dlCard";
import { renderVoterCard } from "@/lib/client/voterCardArt";

const aadhaar: AadhaarSecureQr = {
  version: "V2",
  referenceId: "123420190101120000000",
  last4: "1234",
  name: "Asha Verma",
  dob: "15-08-1995",
  gender: "F",
  address: {
    careOf: "D/O Ramesh Verma", house: "12A", street: "MG Road", landmark: "Near Temple", location: "Kothrud",
    vtc: "Pune", postOffice: "Kothrud", subDistrict: "Haveli", district: "Pune", state: "Maharashtra", pincode: "411038",
  },
  mobileLast4: "9876",
  hasEmailHash: false,
  hasMobileHash: false,
  photo: new Uint8Array(),
  signedData: new Uint8Array(),
  signature: new Uint8Array(),
};

const pan: PanDetails = { pan: "ABCDE1234F", name: "ASHA VERMA", fatherName: "RAMESH KUMAR VERMA", dob: "15/08/1995" };

const dl: DlDetails = {
  licenceNo: "MH12 20200012345", name: "ASHA VERMA", dob: "15-08-1995", bloodGroup: "O+", relation: "RAMESH VERMA",
  presentAddress: "12A MG ROAD, KOTHRUD, PUNE, MAHARASHTRA 411038", permanentAddress: "12A MG ROAD, KOTHRUD, PUNE 411038",
  classes: "LMV,MCWG", issueDate: "10-01-2020", expiryDate: "14-08-2035", issuingAuthority: "RTO PUNE",
};

const voter: VoterDetails = {
  ...EMPTY_VOTER,
  epicNo: "ABC1234567", name: "Asha Verma", nameHi: "आशा वर्मा", relationLabel: "Father's Name",
  relationName: "Ramesh Verma", relationNameHi: "रमेश वर्मा", gender: "Female", dob: "15-08-1995",
};

// A neutral illustrated avatar, so previews never contain a real person.
function sampleAvatar(): string {
  const c = document.createElement("canvas");
  c.width = 240;
  c.height = 300;
  const ctx = c.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, 300);
  bg.addColorStop(0, "#d6e8fa");
  bg.addColorStop(1, "#bcd4ee");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 240, 300);
  ctx.fillStyle = "#4a3426";
  ctx.beginPath();
  ctx.ellipse(120, 100, 68, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e2b593";
  ctx.beginPath();
  ctx.arc(120, 118, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b5a8c";
  ctx.beginPath();
  ctx.ellipse(120, 300, 105, 95, 0, 0, Math.PI * 2);
  ctx.fill();
  return c.toDataURL("image/png");
}

function sampleSignature(): string {
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 80;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "#1c2e6b";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(12, 58);
  ctx.bezierCurveTo(60, 5, 110, 75, 160, 22);
  ctx.bezierCurveTo(190, 0, 220, 70, 288, 44);
  ctx.stroke();
  return c.toDataURL("image/png");
}

export default function Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  const [cards, setCards] = useState<Record<string, string>>({});
  useEffect(() => {
    const photo = sampleAvatar();
    Promise.all([
      renderCardFront(aadhaar, photo, { vid: "9134 5678 9012 3456", uid: "2345 6789 1234" }),
      renderPanCard(pan, photo, sampleSignature()),
      renderDlCard(dl, photo),
      renderVoterCard(voter, photo),
    ]).then(([a, p, d, v]) => setCards({ aadhaar: a, pan: p, dl: d, voter: v }));
  }, []);
  return (
    <main className="space-y-4 p-6">
      {Object.entries(cards).map(([id, src]) => (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL
        <img key={id} id={id} src={src} alt={id} width={1125} height={432} />
      ))}
    </main>
  );
}
