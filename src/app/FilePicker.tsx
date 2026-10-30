"use client";

export default function FilePicker({
  title,
  hint,
  accept,
  busy,
  error,
  onFile,
}: {
  title: string;
  hint: string;
  accept: string;
  busy: boolean;
  error?: string;
  onFile: (file: File) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 px-5 py-10 text-center dark:border-neutral-700">
        <span className="font-medium">{busy ? "Reading…" : title}</span>
        <span className="text-xs text-neutral-500">{hint}</span>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
