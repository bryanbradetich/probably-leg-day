"use client";

/** Recharts colors follow CSS variables so charts match the active theme. */
export const CHART = {
  bg: "transparent",
  grid: "var(--border)",
  axis: "var(--text-muted)",
  primary: "var(--accent)",
  secondary: "var(--chart-secondary)",
  tooltipBg: "var(--surface)",
  tooltipBorder: "var(--accent)",
} as const;

export const PR_COLORS: Record<string, string> = {
  max_weight: "var(--accent)",
  max_reps: "var(--success)",
  max_volume: "var(--macro-protein)",
  max_duration: "var(--chart-purple)",
};

/** Wrapper for chart sections with optional title and empty state */
export function ChartCard({
  title,
  children,
  empty,
  emptyMessage = "Not enough data yet.",
}: {
  title?: string;
  children: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-xl border border-theme-border bg-theme-surface/50 p-4 sm:p-5">
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-theme-text-primary sm:text-base">{title}</h3>
      )}
      {empty ? (
        <p className="py-8 text-center text-sm text-theme-text-muted">{emptyMessage}</p>
      ) : (
        children
      )}
    </div>
  );
}

/** Props passed by Recharts Tooltip content + our optional formatters */
type ChartTooltipProps = {
  active?: boolean;
  /** Recharts tooltip payload; typed loosely for Recharts v3 compatibility */
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown; dataKey?: unknown }>;
  label?: unknown;
  labelFormatter?: (label: unknown) => string;
  formatter?: (value: number, name?: string) => string;
};

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const displayLabel = label != null && labelFormatter ? labelFormatter(label) : String(label ?? "");
  return (
    <div
      className="rounded-lg border border-theme-accent bg-theme-surface px-3 py-2 text-sm text-theme-text-primary shadow-xl"
    >
      {displayLabel && <p className="mb-1 font-medium text-theme-text-primary/90">{displayLabel}</p>}
      {payload.map((entry, i) => (
        <p key={String(entry.dataKey ?? i)}>
          {formatter
            ? formatter(Number(entry.value), String(entry.name ?? ""))
            : `${String(entry.name ?? "")}: ${entry.value}`}
        </p>
      ))}
    </div>
  );
}
