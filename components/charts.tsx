"use client";

/** App chart theme: dark bg, orange accent, zinc grid/text */
export const CHART = {
  bg: "transparent",
  grid: "#27272a",
  axis: "#a1a1aa",
  primary: "#f97316",
  secondary: "#71717a",
  tooltipBg: "#18181b",
  tooltipBorder: "#f97316",
} as const;

export const PR_COLORS: Record<string, string> = {
  max_weight: "#f97316",
  max_reps: "#22c55e",
  max_volume: "#3b82f6",
  max_duration: "#a855f7",
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-white sm:text-base">{title}</h3>
      )}
      {empty ? (
        <p className="py-8 text-center text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        children
      )}
    </div>
  );
}

/** Props passed by Recharts Tooltip content + our optional formatters */
type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; dataKey?: string }>;
  label?: unknown;
  labelFormatter?: (label: unknown) => string;
  formatter?: (value: number, name?: string) => string;
};

/** Recharts tooltip: dark background, white text, orange accent border */
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
      className="rounded-lg border px-3 py-2 text-sm shadow-xl"
      style={{
        backgroundColor: CHART.tooltipBg,
        borderColor: CHART.tooltipBorder,
        color: "white",
      }}
    >
      {displayLabel && <p className="mb-1 font-medium text-zinc-200">{displayLabel}</p>}
      {payload.map((entry) => (
        <p key={String(entry.dataKey)}>
          {formatter
            ? formatter(Number(entry.value), entry.name as string)
            : `${entry.name}: ${entry.value}`}
        </p>
      ))}
    </div>
  );
}
