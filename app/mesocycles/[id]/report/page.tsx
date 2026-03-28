"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs } from "@/lib/units";
import { ChartCard, CHART, ChartTooltip } from "@/components/charts";
import type { Mesocycle, WorkoutLog, WorkoutLogExercise, WorkoutTemplate, PersonalRecord, Exercise } from "@/types";

function epley1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || reps < 1) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: Mesocycle["status"] }) {
  const styles: Record<string, string> = {
    active: "bg-[#f97316]/20 text-[#f97316] border-[#f97316]/40",
    planned: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    completed: "bg-zinc-600/30 text-zinc-400 border-zinc-500/40",
  };
  const labels: Record<string, string> = { active: "Active", planned: "Planned", completed: "Completed" };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function startOfWeek(d: Date): string {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export default function MesocycleReportPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [logs, setLogs] = useState<(WorkoutLog & { total_volume_kg: number })[]>([]);
  const [sets, setSets] = useState<WorkoutLogExercise[]>([]);
  const [prs, setPrs] = useState<(PersonalRecord & { exercise_name: string })[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    const { data: mData, error: mErr } = await supabase
      .from("mesocycles")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (mErr || !mData) {
      router.replace("/mesocycles");
      return;
    }
    setMesocycle(mData as Mesocycle);

    const { data: tRows } = await supabase
      .from("workout_templates")
      .select("*")
      .eq("mesocycle_id", id)
      .order("day_of_week", { ascending: true });
    setTemplates((tRows ?? []) as WorkoutTemplate[]);

    const { data: logRows } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("mesocycle_id", id)
      .eq("is_draft", false)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true });
    const logList = (logRows ?? []) as WorkoutLog[];
    const logIds = logList.map((l) => l.id);

    let setRows: WorkoutLogExercise[] = [];
    if (logIds.length > 0) {
      const { data } = await supabase
        .from("workout_log_exercises")
        .select("*")
        .in("workout_log_id", logIds)
        .order("created_at", { ascending: true });
      setRows = (data ?? []) as WorkoutLogExercise[];
    }

    const volumeByLog: Record<string, number> = {};
    logIds.forEach((lid) => (volumeByLog[lid] = 0));
    for (const row of setRows) {
      const vol = (row.reps ?? 0) * (row.weight_kg ?? 0);
      volumeByLog[row.workout_log_id] = (volumeByLog[row.workout_log_id] ?? 0) + vol;
    }
    setLogs(logList.map((l) => ({ ...l, total_volume_kg: volumeByLog[l.id] ?? 0 })));
    setSets(setRows);

    const start = mData.start_date ? new Date(mData.start_date + "T00:00:00Z").toISOString() : null;
    const end = mData.end_date ? new Date(mData.end_date + "T23:59:59.999Z").toISOString() : null;
    let prQuery = supabase.from("personal_records").select("*").eq("user_id", user.id);
    if (start) prQuery = prQuery.gte("achieved_at", start);
    if (end) prQuery = prQuery.lte("achieved_at", end);
    const { data: prRows } = await prQuery.order("achieved_at", { ascending: true });
    const prList = (prRows ?? []) as PersonalRecord[];

    const exIds = Array.from(new Set([...setRows.map((s) => s.exercise_id), ...prList.map((p) => p.exercise_id)]));
    const exMap: Record<string, Exercise> = {};
    if (exIds.length > 0) {
      const { data: exData } = await supabase.from("exercises").select("*").in("id", exIds);
      for (const e of exData ?? []) {
        exMap[(e as Exercise).id] = e as Exercise;
      }
    }
    setExercises(exMap);
    setPrs(prList.map((p) => ({ ...p, exercise_name: exMap[p.exercise_id]?.name ?? "Unknown" })));
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const durationWeeks = useMemo(() => {
    if (!mesocycle?.start_date || !mesocycle?.end_date) return null;
    const a = new Date(mesocycle.start_date).getTime();
    const b = new Date(mesocycle.end_date).getTime();
    return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000));
  }, [mesocycle]);

  const volumeByWeek = useMemo(() => {
    const byWeek: Record<string, number> = {};
    for (const log of logs) {
      const at = log.completed_at ? new Date(log.completed_at) : null;
      if (!at) continue;
      const key = startOfWeek(at);
      byWeek[key] = (byWeek[key] ?? 0) + (log.total_volume_kg ?? 0);
    }
    return Object.entries(byWeek)
      .map(([week, volumeKg]) => ({ week, volumeLbs: kgToLbs(volumeKg) ?? 0 }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [logs]);

  const totalWorkouts = logs.length;
  const totalVolumeKg = logs.reduce((s, l) => s + l.total_volume_kg, 0);
  const totalSeconds = logs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0);

  const exercisesWithSessions = useMemo(() => {
    const byEx: Record<string, { sets: WorkoutLogExercise[]; exercise: Exercise }> = {};
    for (const row of sets) {
      const ex = exercises[row.exercise_id];
      if (!ex) continue;
      if (!byEx[row.exercise_id]) byEx[row.exercise_id] = { sets: [], exercise: ex };
      byEx[row.exercise_id].sets.push(row);
    }
    return Object.values(byEx).filter((x) => x.sets.length >= 3);
  }, [sets, exercises]);

  const perExerciseSeries = useMemo(() => {
    return exercisesWithSessions.map(({ exercise, sets }) => {
      const bySession: Record<string, { date: string; est1RM: number | null; maxDuration: number | null }> = {};
      for (const row of sets) {
        const log = logs.find((l) => l.id === row.workout_log_id);
        const completed = log?.completed_at ?? row.created_at;
        const key = completed.slice(0, 10);
        if (!bySession[key]) bySession[key] = { date: key, est1RM: null, maxDuration: null };
        const rec = bySession[key];
        if (exercise.type === "reps_sets") {
          const rm = epley1RM(row.weight_kg, row.reps);
          if (rm != null && (rec.est1RM == null || rm > rec.est1RM)) rec.est1RM = rm;
        } else {
          const dur = row.duration_seconds ?? 0;
          if (dur > 0 && (rec.maxDuration == null || dur > rec.maxDuration)) rec.maxDuration = dur;
        }
      }
      const points = Object.values(bySession)
        .filter((p) => p.est1RM != null || p.maxDuration != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({
          date: p.date,
          value: exercise.type === "reps_sets" ? (kgToLbs(p.est1RM!) ?? 0) : (p.maxDuration ?? 0),
          label: exercise.type === "reps_sets" ? "Est. 1RM (lbs)" : "Max duration (s)",
        }));
      return { exercise, points };
    });
  }, [exercisesWithSessions, logs]);

  const firstLastByTemplate = useMemo(() => {
    const byTemplate: Record<string, WorkoutLog[]> = {};
    for (const log of logs) {
      const tid = log.template_id ?? "none";
      if (!byTemplate[tid]) byTemplate[tid] = [];
      byTemplate[tid].push(log);
    }
    const rows: { templateName: string; exerciseName: string; first: string; last: string; changePct: number | null; improved: boolean }[] = [];
    for (const [tid, templateLogs] of Object.entries(byTemplate)) {
      if (templateLogs.length < 2) continue;
      const firstLog = templateLogs[0];
      const lastLog = templateLogs[templateLogs.length - 1];
      const templateName = templates.find((t) => t.id === tid)?.name ?? "Workout";
      const firstSets = sets.filter((s) => s.workout_log_id === firstLog.id);
      const lastSets = sets.filter((s) => s.workout_log_id === lastLog.id);
      const exerciseIds = Array.from(new Set([...firstSets.map((s) => s.exercise_id), ...lastSets.map((s) => s.exercise_id)]));
      for (const eid of exerciseIds) {
        const ex = exercises[eid]?.name ?? "Unknown";
        const f = firstSets.filter((s) => s.exercise_id === eid);
        const l = lastSets.filter((s) => s.exercise_id === eid);
        const fVol = f.reduce((s, r) => s + (r.reps ?? 0) * (r.weight_kg ?? 0), 0);
        const lVol = l.reduce((s, r) => s + (r.reps ?? 0) * (r.weight_kg ?? 0), 0);
        const fStr = f.map((r) => `${kgToLbs(r.weight_kg) ?? 0}×${r.reps ?? 0}`).join(", ") || "—";
        const lStr = l.map((r) => `${kgToLbs(r.weight_kg) ?? 0}×${r.reps ?? 0}`).join(", ") || "—";
        let changePct: number | null = null;
        if (fVol > 0) changePct = ((lVol - fVol) / fVol) * 100;
        rows.push({
          templateName,
          exerciseName: ex,
          first: fStr,
          last: lStr,
          changePct,
          improved: changePct != null && changePct > 0,
        });
      }
    }
    return rows;
  }, [logs, sets, templates, exercises]);

  if (loading || !mesocycle) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link href={`/mesocycles/${id}`} className="text-zinc-400 hover:text-white">
            ← Mesocycle
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{mesocycle.name}</h1>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={mesocycle.status ?? "planned"} />
                {durationWeeks != null && (
                  <span className="text-sm text-zinc-500">{durationWeeks} weeks</span>
                )}
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {formatDate(mesocycle.start_date)} – {formatDate(mesocycle.end_date)}
              </p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xl font-bold text-white">{totalWorkouts}</p>
              <p className="text-xs text-zinc-500">Workouts</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xl font-bold text-white">
                {kgToLbs(totalVolumeKg)?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? 0} <span className="text-sm font-normal text-zinc-500">lbs</span>
              </p>
              <p className="text-xs text-zinc-500">Total volume</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xl font-bold text-white">{formatDuration(totalSeconds)}</p>
              <p className="text-xs text-zinc-500">Time trained</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xl font-bold text-white">{prs.length}</p>
              <p className="text-xs text-zinc-500">PRs achieved</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <ChartCard title="Volume progression (lbs per week)" empty={volumeByWeek.length === 0} emptyMessage="No workout data in this mesocycle.">
            {volumeByWeek.length > 0 && (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeByWeek} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="week" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
                    <Tooltip content={<ChartTooltip labelFormatter={(l) => new Date(String(l ?? "")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} formatter={(v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`} />} />
                    <Line type="monotone" dataKey="volumeLbs" name="Volume" stroke={CHART.primary} strokeWidth={2} dot={{ fill: CHART.primary, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {perExerciseSeries.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Per-exercise progression</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {perExerciseSeries.map(({ exercise, points }) => (
                  <ChartCard key={exercise.id} title={exercise.name} empty={points.length === 0}>
                    {points.length > 0 && (
                      <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="2 2" stroke={CHART.grid} />
                            <XAxis dataKey="date" hide />
                            <YAxis width={32} stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 10 }} />
                            <Tooltip content={<ChartTooltip formatter={(v) => (exercise.type === "reps_sets" ? `${v} lbs` : `${v} s`)} />} />
                            <Line type="monotone" dataKey="value" stroke={CHART.primary} strokeWidth={1.5} dot={{ r: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartCard>
                ))}
              </div>
            </section>
          )}

          {firstLastByTemplate.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">First vs last workout (by template)</h2>
              <div className="overflow-hidden rounded-xl border border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-zinc-500">
                      <th className="px-4 py-3">Template</th>
                      <th className="px-4 py-3">Exercise</th>
                      <th className="px-4 py-3">First session</th>
                      <th className="px-4 py-3">Last session</th>
                      <th className="px-4 py-3">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firstLastByTemplate.map((row, i) => (
                      <tr key={i} className="border-b border-zinc-800/80">
                        <td className="px-4 py-3 text-zinc-400">{row.templateName}</td>
                        <td className="px-4 py-3 text-white">{row.exerciseName}</td>
                        <td className="px-4 py-3 text-zinc-400">{row.first}</td>
                        <td className="px-4 py-3 text-zinc-400">{row.last}</td>
                        <td className="px-4 py-3">
                          {row.changePct != null ? (
                            <span className={row.improved ? "text-emerald-400" : "text-red-400"}>
                              {row.improved ? "+" : ""}{row.changePct.toFixed(1)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {prs.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">PRs achieved during this mesocycle</h2>
              <ul className="space-y-2">
                {prs.map((pr) => (
                  <li key={pr.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2">
                    <span className="font-medium text-white">{pr.exercise_name}</span>
                    <span className="text-zinc-400">{pr.record_type.replace("_", " ")}</span>
                    <span className="text-[#f97316]">
                      {pr.record_type === "max_weight" ? `${kgToLbs(pr.value)?.toFixed(1) ?? pr.value} lbs` : pr.record_type === "max_duration" ? `${pr.value} s` : pr.value}
                    </span>
                    <span className="text-zinc-500 text-xs">{formatDate(pr.achieved_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
