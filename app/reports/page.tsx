"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs } from "@/lib/units";
import { ChartCard, CHART, ChartTooltip, PR_COLORS } from "@/components/charts";
import type { BodyMeasurement, PersonalRecord, WorkoutLog, WorkoutLogExercise } from "@/types";

type TimeRangeKey = "4w" | "3m" | "6m" | "all";

const TIME_RANGES: { key: TimeRangeKey; label: string; days: number | null }[] = [
  { key: "4w", label: "Last 4 weeks", days: 28 },
  { key: "3m", label: "Last 3 months", days: 90 },
  { key: "6m", label: "Last 6 months", days: 180 },
  { key: "all", label: "All time", days: null },
];

function getFromDate(range: TimeRangeKey): Date | null {
  const r = TIME_RANGES.find((x) => x.key === range);
  if (!r?.days) return null;
  const d = new Date();
  d.setDate(d.getDate() - r.days);
  return d;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatWeekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ReportsPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("4w");
  const [logs, setLogs] = useState<(WorkoutLog & { total_volume_kg: number })[]>([]);
  const [sets, setSets] = useState<WorkoutLogExercise[]>([]);
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>([]);
  const [prs, setPrs] = useState<(PersonalRecord & { exercise_name: string })[]>([]);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromDate = useMemo(() => getFromDate(timeRange), [timeRange]);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setError(null);
      const from = fromDate?.toISOString() ?? null;

      const logsQuery = supabase
      .from("workout_logs")
      .select("id, user_id, name, completed_at, duration_seconds, template_id, mesocycle_id, started_at")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true });
      if (from) logsQuery.gte("completed_at", from);
      const { data: logRows } = await logsQuery;
      const logList = (logRows ?? []) as WorkoutLog[];

      const logIds = logList.map((l) => l.id);
      let setRows: WorkoutLogExercise[] = [];
      if (logIds.length > 0) {
        const { data } = await supabase
          .from("workout_log_exercises")
          .select("id, workout_log_id, exercise_id, set_number, reps, weight_kg, duration_seconds, rpe, created_at")
          .in("workout_log_id", logIds);
        setRows = (data ?? []) as WorkoutLogExercise[];
      }

      const volumeByLog: Record<string, number> = {};
      logIds.forEach((id) => (volumeByLog[id] = 0));
      for (const row of setRows) {
        const vol = (row.reps ?? 0) * (row.weight_kg ?? 0);
        volumeByLog[row.workout_log_id] = (volumeByLog[row.workout_log_id] ?? 0) + vol;
      }
      setLogs(
        logList.map((l) => ({
          ...l,
          total_volume_kg: volumeByLog[l.id] ?? 0,
        }))
      );
      setSets(setRows);

      let prQuery = supabase
        .from("personal_records")
        .select("id, user_id, exercise_id, record_type, value, achieved_at, workout_log_exercise_id")
        .eq("user_id", user.id)
        .order("achieved_at", { ascending: true });
      if (from) prQuery = prQuery.gte("achieved_at", from);
      const { data: prRows } = await prQuery;
      const prList = (prRows ?? []) as PersonalRecord[];

      let bmQuery = supabase
        .from("body_measurements")
        .select("id, user_id, measured_at, weight_kg")
        .eq("user_id", user.id)
        .order("measured_at", { ascending: true });
      if (from) bmQuery = bmQuery.gte("measured_at", from);
      const { data: bmRows } = await bmQuery;
      setBodyMeasurements((bmRows ?? []) as BodyMeasurement[]);

      const exIds = Array.from(
        new Set([...setRows.map((s) => s.exercise_id), ...prList.map((p) => p.exercise_id)])
      );
      const exMap: Record<string, string> = {};
      if (exIds.length > 0) {
        const { data: exRows } = await supabase
          .from("exercises")
          .select("id, name")
          .in("id", exIds);
        for (const e of exRows ?? []) {
          exMap[(e as { id: string; name: string }).id] = (e as { id: string; name: string }).name;
        }
      }
    setExerciseNames(exMap);
      setPrs(
        prList.map((p) => ({
          ...p,
          exercise_name: exMap[p.exercise_id] ?? "Unknown",
        }))
      );
    } catch (e) {
      console.error("Reports load error", e);
      setError("Could not load reports. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, router]);

  useEffect(() => {
    load();
  }, [load]);

  const volumeByWeek = useMemo(() => {
    const byWeek: Record<string, number> = {};
    for (const log of logs) {
      const at = log.completed_at ? new Date(log.completed_at) : null;
      if (!at) continue;
      const weekStart = startOfWeek(at);
      const key = weekStart.toISOString().slice(0, 10);
      byWeek[key] = (byWeek[key] ?? 0) + (log.total_volume_kg ?? 0);
    }
    return Object.entries(byWeek)
      .map(([week, volumeKg]) => ({
        week,
        volumeLbs: kgToLbs(volumeKg) ?? 0,
        volumeKg,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [logs]);

  const workoutsPerWeek = useMemo(() => {
    const byWeek: Record<string, number> = {};
    for (const log of logs) {
      const at = log.completed_at ? new Date(log.completed_at) : null;
      if (!at) continue;
      const weekStart = startOfWeek(at);
      const key = weekStart.toISOString().slice(0, 10);
      byWeek[key] = (byWeek[key] ?? 0) + 1;
    }
    return Object.entries(byWeek)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [logs]);

  const bodyweightData = useMemo(() => {
    const points = bodyMeasurements
      .filter((m) => m.weight_kg != null)
      .map((m) => ({
        date: m.measured_at.slice(0, 10),
        weightLbs: kgToLbs(m.weight_kg!) ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length < 2) return points;
    const first = points[0];
    const last = points[points.length - 1];
    const t0 = new Date(first.date).getTime();
    const t1 = new Date(last.date).getTime();
    const slope = (last.weightLbs - first.weightLbs) / (t1 - t0);
    return points.map((p) => ({
      ...p,
      trendLbs: first.weightLbs + slope * (new Date(p.date).getTime() - t0),
    }));
  }, [bodyMeasurements]);

  const top5ByVolume = useMemo(() => {
    const byEx: Record<string, number> = {};
    for (const row of sets) {
      const vol = (row.reps ?? 0) * (row.weight_kg ?? 0);
      byEx[row.exercise_id] = (byEx[row.exercise_id] ?? 0) + vol;
    }
    return Object.entries(byEx)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([exercise_id, volumeKg]) => ({
        exercise_id,
        name: exerciseNames[exercise_id] ?? "Unknown",
        volumeLbs: kgToLbs(volumeKg) ?? 0,
      }))
      .reverse();
  }, [sets, exerciseNames]);

  const prTimelineData = useMemo(() => {
    return prs.map((p) => ({
      date: p.achieved_at.slice(0, 10),
      dateTime: new Date(p.achieved_at).getTime(),
      name: p.exercise_name,
      type: p.record_type,
      value: p.value,
      valueLabel:
        p.record_type === "max_weight"
          ? `${kgToLbs(p.value)?.toFixed(1) ?? p.value} lbs`
          : p.record_type === "max_duration"
            ? `${p.value} s`
            : String(p.value),
    }));
  }, [prs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] animate-pulse">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="h-8 w-48 rounded-lg bg-zinc-800" />
          <div className="mt-2 h-5 w-72 rounded bg-zinc-800" />
          <div className="mt-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-zinc-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="w-full max-w-md rounded-xl border-2 border-red-500/50 bg-red-500/5 p-6 text-center">
              <p className="font-semibold text-red-400">Something went wrong</p>
              <p className="mt-2 text-sm text-zinc-400">{error}</p>
              <button
                type="button"
                onClick={() => load()}
                className="mt-6 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-[#0a0a0a]"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Reports</h1>
            <p className="mt-2 text-zinc-400">Volume, frequency, bodyweight, and PRs over time.</p>
          </div>
        </div>

        {/* Time range selector — sticky */}
        <div className="sticky top-14 z-10 -mx-4 flex flex-wrap gap-2 border-b border-zinc-800 bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setTimeRange(r.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                timeRange === r.key
                  ? "bg-[#f97316] text-[#0a0a0a]"
                  : "border border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-8">
          {/* Overall Volume */}
          <ChartCard
            title="Overall volume (lbs per week)"
            empty={volumeByWeek.length === 0}
            emptyMessage="Log some completed workouts to see volume over time."
          >
            {volumeByWeek.length > 0 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeByWeek} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="week"
                      tickFormatter={formatWeekLabel}
                      stroke={CHART.axis}
                      tick={{ fill: CHART.axis, fontSize: 12 }}
                    />
                    <YAxis
                      stroke={CHART.axis}
                      tick={{ fill: CHART.axis, fontSize: 12 }}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          labelFormatter={(l) => formatWeekLabel(String(l ?? ""))}
                          formatter={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="volumeLbs"
                      name="Volume"
                      stroke={CHART.primary}
                      strokeWidth={2}
                      dot={{ fill: CHART.primary, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Workout frequency */}
          <ChartCard
            title="Workouts per week"
            empty={workoutsPerWeek.length === 0}
            emptyMessage="No workouts in this range."
          >
            {workoutsPerWeek.length > 0 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workoutsPerWeek} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="week"
                      tickFormatter={formatWeekLabel}
                      stroke={CHART.axis}
                      tick={{ fill: CHART.axis, fontSize: 12 }}
                    />
                    <YAxis
                      stroke={CHART.axis}
                      tick={{ fill: CHART.axis, fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          labelFormatter={(l) => formatWeekLabel(String(l ?? ""))}
                          formatter={(v) => `${v} workout${v !== 1 ? "s" : ""}`}
                        />
                      }
                    />
                    <Bar dataKey="count" name="Workouts" fill={CHART.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Bodyweight */}
          <ChartCard
            title="Bodyweight (lbs)"
            empty={bodyweightData.length < 2}
            emptyMessage="Add at least 2 body measurements to see your trend."
          >
            {bodyweightData.length >= 2 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bodyweightData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="date"
                      stroke={CHART.axis}
                      tick={{ fill: CHART.axis, fontSize: 12 }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    />
                    <YAxis
                      stroke={CHART.axis}
                      tick={{ fill: CHART.axis, fontSize: 12 }}
                      domain={["dataMin - 2", "dataMax + 2"]}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v) => `${v} lbs`}
                          labelFormatter={(l) => new Date(String(l ?? "")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="weightLbs"
                      name="Weight"
                      stroke={CHART.primary}
                      strokeWidth={2}
                      dot={{ fill: CHART.primary, r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="trendLbs"
                      name="Trend"
                      stroke={CHART.secondary}
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Top 5 exercises by volume */}
          <ChartCard
            title="Top 5 exercises by volume (lbs)"
            empty={top5ByVolume.length === 0}
            emptyMessage="No exercise data in this range."
          >
            {top5ByVolume.length > 0 && (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={top5ByVolume}
                    layout="vertical"
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
                    <XAxis type="number" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                    <YAxis type="category" dataKey="name" width={120} stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 11 }} />
                    <Tooltip
                      content={
                        <ChartTooltip formatter={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`} />
                      }
                    />
                    <Bar
                      dataKey="volumeLbs"
                      name="Volume"
                      fill={CHART.primary}
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(data: { payload?: { exercise_id: string } }) => {
                        if (data?.payload?.exercise_id) router.push(`/progress/exercise/${data.payload.exercise_id}`);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* PR timeline — scatter: X date, Y exercise name */}
          <ChartCard
            title="Personal records timeline"
            empty={prTimelineData.length === 0}
            emptyMessage="No PRs in this range."
          >
            {prTimelineData.length > 0 && (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="date"
                      type="category"
                      stroke={CHART.axis}
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke={CHART.axis}
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const p = payload[0].payload as (typeof prTimelineData)[0];
                        return (
                          <div
                            className="rounded-lg border px-3 py-2 text-sm shadow-xl"
                            style={{
                              backgroundColor: CHART.tooltipBg,
                              borderColor: CHART.tooltipBorder,
                              color: "white",
                            }}
                          >
                            <p className="font-medium">{p.name}</p>
                            <p className="text-zinc-300">{p.type.replace("_", " ")}</p>
                            <p>{p.valueLabel}</p>
                            <p className="text-zinc-400">{new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={prTimelineData} fill={CHART.primary}>
                      {prTimelineData.map((entry, i) => (
                        <Cell key={i} fill={PR_COLORS[entry.type] ?? CHART.primary} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
