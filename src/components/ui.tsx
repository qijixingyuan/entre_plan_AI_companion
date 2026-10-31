export function PageHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-medium">{title}</h1>
        {badge ? (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">
            {badge}
          </span>
        ) : null}
      </div>
      {subtitle ? <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p> : null}
    </header>
  );
}

export function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
      <div className="text-sm text-neutral-600">{label}</div>
      {hint ? <div className="mt-1.5 text-xs text-neutral-400">{hint}</div> : null}
    </div>
  );
}

export function Card({
  title,
  children,
  accent = false,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 ${
        accent ? "border-amber-300" : "border-neutral-200"
      }`}
    >
      <div className={`text-sm font-medium ${accent ? "text-amber-800" : "text-neutral-800"}`}>
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
