import type { Metadata } from "next";
import Link from "next/link";
import { NOT_AFFILIATED, REPO_URL, TERMS_POINTS, TERMS_VERSION } from "@/lib/terms";

export const metadata: Metadata = {
  title: "Terms of Use & Privacy — Indian IDs → Apple Wallet",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-5 py-10 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
      <header className="space-y-2">
        <Link href="/" className="text-neutral-500 underline">
          ← Back to the app
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Terms of Use &amp; Privacy
        </h1>
        <p className="text-neutral-500">Version {TERMS_VERSION}</p>
      </header>

      <p>
        Indian IDs → Apple Wallet (&quot;the site&quot;) is an independent, open-source project that turns official
        Indian e-documents you already have into Apple Wallet passes for your own convenience. By using the site you
        agree to these terms. If you don&apos;t agree, please don&apos;t use it.
      </p>

      <Section title="In short, you agree that">
        <ul className="list-disc space-y-1 pl-5">
          {TERMS_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Section>

      <Section title="1. No affiliation">
        <p>{NOT_AFFILIATED}</p>
        <p>
          References to government documents, departments and verification apps (such as mAadhaar, DigiLocker, PAN QR
          Code Reader and ECINET) only describe what each document is and how its original QR can be verified. Card
          designs are illustrative, deliberately omit the State Emblem of India, and do not represent official artwork.
        </p>
      </Section>

      <Section title="2. Personal copies, not official documents">
        <p>
          A pass created here is a personal convenience copy of a document issued to you. It is not issued, verified or
          endorsed by any authority, and is not a substitute for the original document or for official digital
          versions (for example in DigiLocker or mAadhaar). Whether a pass is accepted anywhere is entirely up to the
          person or organisation checking it; many places require the original or an officially issued digital copy.
        </p>
        <p>
          Where a pass carries the document&apos;s original QR, that QR is copied unchanged from your document so it can
          be checked with the issuer&apos;s own app. The site does not verify the authenticity of any document.
        </p>
      </Section>

      <Section title="3. Your documents only">
        <p>
          Only use the site with documents issued to you, or that you are authorised by their holder to use. Do not
          upload or create passes from anyone else&apos;s documents without their permission.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>You must not use the site or any pass to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>impersonate anyone or misrepresent your identity, age, address or any other detail;</li>
          <li>create, alter or forge any document, or present a pass as an official document;</li>
          <li>do anything unlawful, fraudulent or harmful.</li>
        </ul>
        <p>
          Editable fields are provided only to correct reading errors. Changing your details to something that is not
          on your document is not permitted. Misusing identity documents can be a criminal offence.
        </p>
      </Section>

      <Section title="5. Privacy">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Your files never leave your device.</strong> PDFs and photos are opened, unlocked and read in your
            browser. PDF passwords are never sent anywhere.
          </li>
          <li>
            <strong>Only the pass contents are sent to be signed:</strong> the card image, the details shown on it and
            its QR. Apple Wallet passes must be cryptographically signed with a certificate that can&apos;t be kept in a
            browser, so this happens on the server, which builds and signs the pass, returns it to you and keeps
            nothing: there is no database, no file storage and no logging of pass contents.
          </li>
          <li>
            Text-recognition (OCR) data and other tools are served from this site; no third-party content is loaded
            while you use it.
          </li>
          <li>
            Your agreement to these terms is remembered in your browser&apos;s local storage. One short-lived cookie
            containing a random token is used to show when your pass is ready. There are no analytics or advertising
            cookies.
          </li>
          <li>
            The site is hosted on Vercel, whose infrastructure may record standard technical request information (such
            as IP address, time and requested URL) for security and operations, under Vercel&apos;s own privacy policy.
          </li>
        </ul>
      </Section>

      <Section title="6. Trademarks">
        <p>
          Apple, Apple Wallet and Apple Pay are trademarks of Apple Inc. The &quot;Add to Apple Wallet&quot; badge is used
          according to Apple&apos;s guidelines. Other names belong to their respective owners and are used only to
          describe compatibility. No endorsement is implied.
        </p>
      </Section>

      <Section title="7. No warranty and limitation of liability">
        <p>
          The site is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind. Information
          read from documents (including by OCR) may be inaccurate; check every pass before relying on it. To the
          fullest extent permitted by law, the author is not liable for any loss or damage arising from use of the site
          or any pass, including refusal of a pass, errors in its contents, or misuse by anyone.
        </p>
      </Section>

      <Section title="8. Changes">
        <p>
          These terms may be updated. When they change, the site will ask you to review and accept the new version
          before continuing.
        </p>
      </Section>

      <Section title="9. Open source and contact">
        <p>
          The source code is public on{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline">
            GitHub
          </a>
          , so you can see exactly how your data is handled. Questions or concerns can be raised there as an issue, or
          via{" "}
          <a href="https://www.arshanwar.com" target="_blank" rel="noopener noreferrer" className="underline">
            arshanwar.com
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
