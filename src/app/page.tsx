import IdPicker from "./IdPicker";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Indian IDs → Apple Wallet</h1>
        <p className="text-sm text-neutral-500">
          Upload your official e-document. It&apos;s read on your phone, the original QR goes onto the pass, and
          nothing is stored.
        </p>
      </header>
      <IdPicker />
      <footer className="mt-auto space-y-3 pt-6 text-xs text-neutral-500">
        <div className="space-y-1 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
          <p className="font-medium text-neutral-700 dark:text-neutral-300">🔒 Your files never leave your device</p>
          <p>
            PDFs and photos are opened and read entirely in your browser — they&apos;re never uploaded. To create the
            pass, only what appears on it (the card image, its details and QR) is sent to be signed, then discarded.
            Nothing is stored.
          </p>
        </div>
        <p>
          Download your e-documents from DigiLocker or the issuing portal. Passes are personal convenience copies, not
          official documents.
        </p>
        <p>
          Made by{" "}
          <a href="https://www.arshanwar.com" target="_blank" rel="noopener noreferrer" className="underline">
            Arsh Anwar
          </a>
        </p>
      </footer>
    </main>
  );
}
