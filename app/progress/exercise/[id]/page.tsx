"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs } from "@/lib/units";
import { formatWeight } from "@/lib/units";
import { ChartCard, CHART, ChartTooltip } from "@/components/charts";
import type { Exercise, WorkoutLogExercise } from "@/types";

function epley1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || reps < 1) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

type SetRow = WorkoutLogExercise & { completed_at: string | null; log_name: string };

export default function ExerciseProgressPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    const { data: ex, error: exErr } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", id)
      .single();
    if (exErr || !ex) {
      router.replace("/progress");
      return;
    }
    setExercise(ex as Exercise);

    const { data: setRows } = await supabase
      .from("workout_log_exercises")
      .select("*, workout_logs!inner(completed_at, name, is_draft)")
      .eq("exercise_id", id)
      .eq("workout_logs.is_draft", false)
      .not("workout_logs.completed_at", "is", null)
      .order("created_at", { ascending: true });
    const list: SetRow[] = [];
    for (const row of setRows ?? []) {
      const log = (row as { workout_logs: { completed_at: string | null; name: string } | null }).workout_logs;
      list.push({
        ...(row as WorkoutLogExercise),
        completed_at: log?.completed_at ?? null,
        log_name: log?.name ?? "Workout",
      });
    }
    setSets(list);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const bySession = useMemo(() => {
    const map: Record<string, { date: string; dateLabel: string; sets: SetRow[]; volumeKg: number; maxWeightKg: number | null; est1RMKg: number | null }> = {};
    for (const row of sets) {
      const key = row.workout_log_id + (row.completed_at ?? row.created_at);
      if (!map[key]) {
        map[key] = {
          date: (row.completed_at ?? row.created_at).slice(0, 10),
          dateLabel: new Date(row.completed_at ?? row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
          sets: [],
          volumeKg: 0,
          maxWeightKg: null,
          est1RMKg: null,
        };
      }
      const rec = map[key];
      rec.sets.push(row);
      const vol = (row.reps ?? 0) * (row.weight_kg ?? 0);
      rec.volumeKg += vol;
      if (row.weight_kg != null && (rec.maxWeightKg == null || row.weight_kg > rec.maxWeightKg)) rec.maxWeightKg = row.weight_kg;
      const rm = epley1RM(row.weight_kg, row.reps);
      if (rm != null && (rec.est1RMKg == null || rm > rec.est1RMKg)) rec.est1RMKg = rm;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [sets]);

  const chart1RM = useMemo(
    () =>
      bySession
        .filter((s) => s.est1RMKg != null)
        .map((s) => ({
          date: s.date,
          dateLabel: s.dateLabel,
          est1RMLbs: kgToLbs(s.est1RMKg!) ?? 0,
        })),
    [bySession]
  );
  const chartVolume = useMemo(
    () =>
      bySession.map((s) => ({
        date: s.date,
        dateLabel: s.dateLabel,
        volumeLbs: kgToLbs(s.volumeKg) ?? 0,
      })),
    [bySession]
  );
  const chartWeight = useMemo(
    () =>
      bySession
        .filter((s) => s.maxWeightKg != null)
        .map((s) => ({
          date: s.date,
          dateLabel: s.dateLabel,
          maxWeightLbs: kgToLbs(s.maxWeightKg!) ?? 0,
        })),
    [bySession]
  );

  if (loading || !exercise) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center text-theme-text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link href="/progress" className="text-theme-text-muted hover:text-theme-text-primary">
            ← Progress
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-theme-text-primary">{exercise.name}</h1>
        <p className="mt-2 text-theme-text-muted">Progress and set history.</p>

        <div className="mt-8 space-y-8">
          <ChartCard
            title="Estimated 1RM (lbs) over time"
            empty={chart1RM.length === 0}
            emptyMessage="Log sets with weight and reps to see estimated 1RM."
          >
            {chart1RM.length > 0 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart1RM} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="date" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                    <Tooltip content={<ChartTooltip labelFormatter={(l) => new Date(String(l ?? "")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} formatter={(v) => `${v} lbs`} />} />
                    <Line type="monotone" dataKey="est1RMLbs" name="Est. 1RM" stroke={CHART.primary} strokeWidth={2} dot={{ fill: CHART.primary, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Volume per session (lbs)"
            empty={chartVolume.length === 0}
            emptyMessage="No session data."
          >
            {chartVolume.length > 0 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartVolume} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="date" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                    <Tooltip content={<ChartTooltip labelFormatter={(l) => new Date(String(l ?? "")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} formatter={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`} />} />
                    <Bar dataKey="volumeLbs" name="Volume" fill={CHART.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Max weight per session (lbs)"
            empty={chartWeight.length === 0}
            emptyMessage="No weight data."
          >
            {chartWeight.length > 0 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartWeight} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="date" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip labelFormatter={(l) => new Date(String(l ?? "")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} formatter={(v) => `${v} lbs`} />} />
                    <Line type="monotone" dataKey="maxWeightLbs" name="Max weight" stroke={CHART.primary} strokeWidth={2} dot={{ fill: CHART.primary, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-theme-text-primary">Set history</h2>
            {sets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-theme-border py-6 text-center text-theme-text-muted">No sets logged for this exercise.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-theme-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-theme-border bg-theme-surface/50 text-left text-theme-text-muted">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Workout</th>
                      <th className="px-4 py-3">Set</th>
                      <th className="px-4 py-3">Reps</th>
                      <th className="px-4 py-3">Weight</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">RPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((row) => (
                      <tr key={row.id} className="border-b border-theme-border/80 hover:bg-theme-border/90/30">
                        <td className="px-4 py-3 text-theme-text-muted">
                          {row.completed_at ? new Date(row.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/workouts/history/${row.workout_log_id}`} className="text-theme-text-primary hover:text-theme-accent">
                            {row.log_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-theme-text-muted">{row.set_number}</td>
                        <td className="px-4 py-3 text-theme-text-muted">{row.reps ?? "—"}</td>
                        <td className="px-4 py-3 text-theme-text-muted">{formatWeight(row.weight_kg, { inLbs: true })}</td>
                        <td className="px-4 py-3 text-theme-text-muted">{row.duration_seconds != null ? `${row.duration_seconds}s` : "—"}</td>
                        <td className="px-4 py-3 text-theme-text-muted">{row.rpe ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
