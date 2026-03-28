"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import { CHART, ChartCard, ChartTooltip } from "@/components/charts";
import { formatMonthDay } from "@/lib/weight-helpers";

export type WeightChartRange = "4w" | "3m" | "all";

const RANGE_LABELS: { key: WeightChartRange; label: string }[] = [
  { key: "4w", label: "Last 4 weeks" },
  { key: "3m", label: "Last 3 months" },
  { key: "all", label: "All time" },
];

export type DailyChartPoint = {
  date: string;
  actualLbs: number | null;
  targetLbs: number | null;
  weekAvgLbs: number | null;
};

export type WeeklyBarPoint = {
  weekKey: string;
  weekLabel: string;
  actualLbs: number;
  targetLbs: number;
  onTrack: boolean;
};

function filterByRange(points: DailyChartPoint[], range: WeightChartRange): DailyChartPoint[] {
  if (range === "all") return points;
  const end = points.length ? parseISOLocal(points[points.length - 1].date) : new Date();
  const start = new Date(end);
  if (range === "4w") start.setDate(start.getDate() - 28);
  else start.setDate(start.getDate() - 90);
  const startIso = toLocalISO(start);
  return points.filter((p) => p.date >= startIso);
}

function parseISOLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeightRangeSelector({
  value,
  onChange,
}: {
  value: WeightChartRange;
  onChange: (r: WeightChartRange) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {RANGE_LABELS.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === r.key
              ? "bg-[#f97316] text-[#0a0a0a]"
              : "border border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function DailyWeightLineChart({
  data,
  range,
  empty,
}: {
  data: DailyChartPoint[];
  range: WeightChartRange;
  empty?: boolean;
}) {
  const filtered = filterByRange(data, range);
  const chartData = filtered.map((p) => ({
    ...p,
    actual: p.actualLbs ?? undefined,
    target: p.targetLbs ?? undefined,
    weekAvg: p.weekAvgLbs ?? undefined,
  }));

  return (
    <ChartCard
      title="Daily weight"
      empty={empty || chartData.length === 0}
      emptyMessage="Log weights to see the chart."
    >
      {chartData.length > 0 && (
        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatMonthDay(String(d))}
                stroke={CHART.axis}
                tick={{ fill: CHART.axis, fontSize: 11 }}
              />
              <YAxis
                stroke={CHART.axis}
                tick={{ fill: CHART.axis, fontSize: 11 }}
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as DailyChartPoint;
                  return (
                    <ChartTooltip
                      active={active}
                      label={label}
                      labelFormatter={(l) =>
                        parseISOLocal(String(l)).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      }
                      payload={[
                        { dataKey: "actual", name: "Actual (lbs)", value: row.actualLbs ?? undefined },
                        { dataKey: "weekAvg", name: "Week avg (lbs)", value: row.weekAvgLbs ?? undefined },
                        { dataKey: "target", name: "Target (lbs)", value: row.targetLbs ?? undefined },
                      ].filter((x) => x.value != null)}
                      formatter={(v) => `${Number(v).toFixed(1)} lbs`}
                    />
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-zinc-300">{v}</span>} />
              <Line
                type="monotone"
                dataKey="target"
                name="Target"
                stroke="#71717a"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="weekAvg"
                name="Weekly avg"
                stroke="#fafafa"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Daily"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316", r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function WeeklyTargetActualChart({
  data,
  empty,
}: {
  data: WeeklyBarPoint[];
  empty?: boolean;
}) {
  const chartData = data;

  return (
    <ChartCard
      title="Weekly average vs target"
      empty={empty || chartData.length === 0}
      emptyMessage="Need goal and logged weights for weekly comparison."
    >
      {chartData.length > 0 && (
        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis
                dataKey="weekLabel"
                stroke={CHART.axis}
                tick={{ fill: CHART.axis, fontSize: 10 }}
              />
              <YAxis
                stroke={CHART.axis}
                tick={{ fill: CHART.axis, fontSize: 11 }}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p0 = payload[0]?.payload as WeeklyBarPoint;
                  return (
                    <ChartTooltip
                      active={active}
                      label={label}
                      labelFormatter={() => `Week of ${p0?.weekLabel ?? label}`}
                      payload={payload.map((e) => ({
                        dataKey: e.dataKey != null ? String(e.dataKey) : undefined,
                        name: String(e.name ?? ""),
                        value: Number(e.value),
                      }))}
                      formatter={(v) => `${Number(v).toFixed(1)} lbs`}
                    />
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-zinc-300">{v}</span>} />
              <Bar dataKey="actualLbs" name="Actual avg" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.onTrack ? "#22c55e" : "#f97316"} />
                ))}
              </Bar>
              <Bar dataKey="targetLbs" name="Target" fill="#71717a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
