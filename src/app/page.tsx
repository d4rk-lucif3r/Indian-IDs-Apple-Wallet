import Link from "next/link";
import { NOT_AFFILIATED, REPO_URL } from "@/lib/terms";
import IdPicker from "./IdPicker";
import WelcomeDialog from "./WelcomeDialog";
import GitHubLink, { GitHubMark } from "./GitHubLink";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <WelcomeDialog />
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Indian IDs → Apple Wallet</h1>
          <GitHubLink label="GitHub" />
        </div>
        <p className="text-sm text-neutral-500">
          Upload your official e-document. It&apos;s read on your phone, the original QR goes onto the pass, and your
          documents are never stored.
        </p>
      </header>
      <IdPicker />
      <footer className="mt-auto space-y-3 pt-6 text-xs text-neutral-500">
        <div className="space-y-1 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
          <p className="font-medium text-neutral-700 dark:text-neutral-300">🔒 Your files never leave your device</p>
          <p>
            PDFs and photos are opened and read entirely in your browser — they&apos;re never uploaded. To create the
            pass, only what appears on it (the card image, its details and QR) is sent to be signed, then discarded. No
            document data is stored.
          </p>
        </div>
        <p>
          Passes are personal convenience copies of your own documents, not official identity documents. Download your
          e-documents from DigiLocker or the issuing portal.
        </p>
        <p>{NOT_AFFILIATED}</p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/terms" className="underline">
            Terms of Use &amp; Privacy
          </Link>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline">
            <GitHubMark className="h-3.5 w-3.5" /> Source on GitHub
          </a>
          <span>
            Made by{" "}
            <a href="https://www.arshanwar.com" target="_blank" rel="noopener noreferrer" className="underline">
              Arsh Anwar
            </a>
          </span>
        </p>
      </footer>
    </main>
  );
}
