export default function DownloadLinks({
  title,
  description,
  sources,
}: {
  title: string;
  description: string;
  sources: { name: string; href: string }[];
}) {
  return (
    <div className="space-y-2 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
      <p className="font-medium">{title}</p>
      <p className="text-xs text-neutral-500">{description}</p>
      {sources.map((source) => (
        <a
          key={source.href}
          href={source.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700"
        >
          <span>{source.name}</span>
          <span className="text-neutral-500">↗</span>
        </a>
      ))}
    </div>
  );
}
