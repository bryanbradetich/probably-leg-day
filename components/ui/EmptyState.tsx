import Link from "next/link";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
};

const DefaultIcon = () => (
  <svg
    className="mx-auto h-12 w-12 text-theme-text-muted/80"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
    />
  </svg>
);

export function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-theme-border bg-theme-surface/30 px-6 py-12 text-center">
      {icon ?? <DefaultIcon />}
      <p className="mt-4 text-lg font-medium text-theme-text-primary">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm text-theme-text-muted">{description}</p>}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-theme-accent px-4 py-2.5 text-sm font-semibold text-theme-on-accent shadow transition hover:bg-theme-accent-hover focus:outline-none focus:ring-2 focus:ring-theme-accent focus:ring-offset-2 focus:ring-offset-theme-bg"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
