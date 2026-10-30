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
      <footer className="mt-auto space-y-1 text-xs text-neutral-500">
        <p>Download your e-documents from DigiLocker or the issuing portal. Passes are personal convenience copies, not official documents.</p>
      </footer>
    </main>
  );
}
