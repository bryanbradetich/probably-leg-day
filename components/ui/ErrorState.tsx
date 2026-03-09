import Link from "next/link";

type ErrorStateProps = {
  title?: string;
  message: string;
  retry?: () => void;
  backHref?: string;
  backLabel?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message,
  retry,
  backHref,
  backLabel = "Go back",
}: ErrorStateProps) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border-2 border-red-500/50 bg-red-500/5 p-6 text-center">
        <p className="text-lg font-semibold text-red-400">{title}</p>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-[#0a0a0a] hover:bg-[#ea580c]"
            >
              Try again
            </button>
          )}
          {backHref && (
            <Link
              href={backHref}
              className="rounded-lg border border-zinc-600 bg-transparent px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              {backLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
