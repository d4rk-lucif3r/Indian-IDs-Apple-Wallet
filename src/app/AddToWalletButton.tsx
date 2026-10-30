// Apple's official "Add to Apple Wallet" badge (US/UK English, from Apple's badge kit), used
// unmodified as Apple's guidelines require: no recolouring, no dimming, clear space of at least
// 10% of its height. When the pass isn't ready yet, a plain status line replaces the badge
// rather than showing a dimmed one.
export default function AddToWalletButton({ ready = true, waitingText }: { ready?: boolean; waitingText?: string }) {
  if (!ready) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 py-3.5 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {waitingText ?? "Fill in the details above to continue"}
      </p>
    );
  }
  return (
    <button type="submit" className="mx-auto block p-[6px]" aria-label="Add to Apple Wallet">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG badge, must render unmodified */}
      <img src="/badges/add-to-apple-wallet.svg" alt="Add to Apple Wallet" className="h-14 w-auto" />
    </button>
  );
}
