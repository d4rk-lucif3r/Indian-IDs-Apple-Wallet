"use client";

// Dev-only: renders the card front with sample data, for iterating on the design.
import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { AadhaarSecureQr } from "@/lib/aadhaar/secureQr";
import { renderCardFront } from "@/lib/client/renderCard";

const sample: AadhaarSecureQr = {
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

export default function Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  const [card, setCard] = useState<string | null>(null);
  useEffect(() => {
    renderCardFront(sample, null).then(setCard);
  }, []);
  return (
    <main className="p-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
      {card && <img id="card" src={card} alt="" width={1125} height={432} />}
    </main>
  );
}
