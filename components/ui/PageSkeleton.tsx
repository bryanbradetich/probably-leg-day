export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] animate-pulse">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="h-8 w-48 rounded-lg bg-zinc-800" />
        <div className="mt-2 h-5 w-72 rounded bg-zinc-800" />
        <div className="mt-8 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 w-20 rounded bg-zinc-800" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-zinc-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-4 flex-1 rounded bg-zinc-800" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse">
      <div className="h-6 w-3/4 rounded bg-zinc-800" />
      <div className="mt-3 h-4 w-full rounded bg-zinc-800" />
      <div className="mt-2 h-4 w-1/2 rounded bg-zinc-800" />
    </div>
  );
}
