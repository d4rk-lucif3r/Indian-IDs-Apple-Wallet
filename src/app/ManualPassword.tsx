"use client";

import { useState } from "react";

export default function ManualPassword({ incorrect, onSubmit }: { incorrect: boolean; onSubmit: (password: string) => void }) {
  const [password, setPassword] = useState("");
  return (
    <form
      className="space-y-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
      onSubmit={(e) => {
        e.preventDefault();
        if (password.trim()) onSubmit(password.trim());
      }}
    >
      <p className="text-sm font-medium">This PDF is password protected</p>
      <input
        aria-label="PDF password"
        autoFocus
        autoComplete="off"
        className="w-full min-w-0 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="text-xs text-neutral-500">{incorrect ? "That didn't unlock it. " : ""}It stays on this device.</p>
      <button
        disabled={!password.trim()}
        className="w-full rounded-lg bg-neutral-900 py-2.5 text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        Unlock
      </button>
    </form>
  );
}
