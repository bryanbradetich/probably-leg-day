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
        <p className="mt-2 text-sm text-theme-text-muted">{message}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-theme-on-accent hover:bg-theme-accent-hover"
            >
              Try again
            </button>
          )}
          {backHref && (
            <Link
              href={backHref}
              className="rounded-lg border border-theme-border/80 bg-transparent px-4 py-2 text-sm font-medium text-theme-text-muted hover:bg-theme-border/90 hover:text-theme-text-primary"
            >
              {backLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
