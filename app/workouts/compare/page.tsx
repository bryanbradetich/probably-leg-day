"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs } from "@/lib/units";
import type { WorkoutLogExercise } from "@/types";

type LogOption = { id: string; name: string; completed_at: string | null };
type SetRow = WorkoutLogExercise & { exercise_name: string };

export default function WorkoutComparePage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogOption[]>([]);
  const [log1Id, setLog1Id] = useState("");
  const [log2Id, setLog2Id] = useState("");
  const [sets1, setSets1] = useState<SetRow[]>([]);
  const [sets2, setSets2] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const { data } = await supabase
        .from("workout_logs")
        .select("id, name, completed_at")
        .eq("user_id", user.id)
        .eq("is_draft", false)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      setLogs((data ?? []) as LogOption[]);
      setLoading(false);
    })();
  }, [router]);

  const loadSets = useCallback(async (logId: string) => {
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("workout_log_exercises")
      .select("*")
      .eq("workout_log_id", logId)
      .order("order_index")
      .order("set_number");
    const list = (rows ?? []) as WorkoutLogExercise[];
    const exIds = Array.from(new Set(list.map((r) => r.exercise_id)));
    const exMap: Record<string, string> = {};
    if (exIds.length > 0) {
      const { data: exRows } = await supabase.from("exercises").select("id, name").in("id", exIds);
      for (const e of exRows ?? []) {
        exMap[(e as { id: string; name: string }).id] = (e as { id: string; name: string }).name;
      }
    }
    return list.map((r) => ({ ...r, exercise_name: exMap[r.exercise_id] ?? "Unknown" }));
  }, []);

  useEffect(() => {
    if (!log1Id) {
      setSets1([]);
      return;
    }
    loadSets(log1Id).then(setSets1);
  }, [log1Id, loadSets]);

  useEffect(() => {
    if (!log2Id) {
      setSets2([]);
      return;
    }
    loadSets(log2Id).then(setSets2);
  }, [log2Id, loadSets]);

  const comparison = useMemo(() => {
    const byEx1: Record<string, { sets: string; volumeKg: number }> = {};
    for (const row of sets1) {
      const eid = row.exercise_id;
      if (!byEx1[eid]) byEx1[eid] = { sets: "", volumeKg: 0 };
      const s = `${kgToLbs(row.weight_kg) ?? 0}×${row.reps ?? 0}`;
      byEx1[eid].sets = byEx1[eid].sets ? `${byEx1[eid].sets}, ${s}` : s;
      byEx1[eid].volumeKg += (row.reps ?? 0) * (row.weight_kg ?? 0);
    }
    const byEx2: Record<string, { sets: string; volumeKg: number }> = {};
    for (const row of sets2) {
      const eid = row.exercise_id;
      if (!byEx2[eid]) byEx2[eid] = { sets: "", volumeKg: 0 };
      const s = `${kgToLbs(row.weight_kg) ?? 0}×${row.reps ?? 0}`;
      byEx2[eid].sets = byEx2[eid].sets ? `${byEx2[eid].sets}, ${s}` : s;
      byEx2[eid].volumeKg += (row.reps ?? 0) * (row.weight_kg ?? 0);
    }
    const exerciseIds = Array.from(new Set([...Object.keys(byEx1), ...Object.keys(byEx2)]));
    const nameMap: Record<string, string> = {};
    for (const r of [...sets1, ...sets2]) nameMap[r.exercise_id] = r.exercise_name;
    return exerciseIds.map((eid) => {
      const a = byEx1[eid];
      const b = byEx2[eid];
      const vol1 = a?.volumeKg ?? 0;
      const vol2 = b?.volumeKg ?? 0;
      let diff: "same" | "up" | "down" | "new" = "same";
      if (!a) diff = "new";
      else if (vol2 > vol1) diff = "up";
      else if (vol2 < vol1) diff = "down";
      return {
        exercise_id: eid,
        exerciseName: nameMap[eid] ?? "Unknown",
        w1Sets: a?.sets ?? "—",
        w2Sets: b?.sets ?? "—",
        vol1Lbs: kgToLbs(vol1) ?? 0,
        vol2Lbs: kgToLbs(vol2) ?? 0,
        diff,
      };
    });
  }, [sets1, sets2]);

  const totalVol1 = useMemo(() => sets1.reduce((s, r) => s + (r.reps ?? 0) * (r.weight_kg ?? 0), 0), [sets1]);
  const totalVol2 = useMemo(() => sets2.reduce((s, r) => s + (r.reps ?? 0) * (r.weight_kg ?? 0), 0), [sets2]);

  const log1 = logs.find((l) => l.id === log1Id);
  const log2 = logs.find((l) => l.id === log2Id);

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center text-theme-text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link href="/workouts/history" className="text-theme-text-muted hover:text-theme-text-primary">
            ← History
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-theme-text-primary">Compare Workouts</h1>
        <p className="mt-2 text-theme-text-muted">Select two completed workouts to compare side by side.</p>

        <div className="mt-6 flex flex-wrap gap-4">
          <div className="min-w-[200px]">
            <label className="mb-1 block text-sm text-theme-text-muted">Workout 1</label>
            <select
              value={log1Id}
              onChange={(e) => setLog1Id(e.target.value)}
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
            >
              <option value="">Select…</option>
              {logs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {formatDate(l.completed_at)}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="mb-1 block text-sm text-theme-text-muted">Workout 2</label>
            <select
              value={log2Id}
              onChange={(e) => setLog2Id(e.target.value)}
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
            >
              <option value="">Select…</option>
              {logs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {formatDate(l.completed_at)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {log1Id && log2Id && (
          <>
            <div className="mt-8 overflow-hidden rounded-xl border border-theme-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-theme-border bg-theme-surface/50 text-left text-theme-text-muted">
                    <th className="px-4 py-3">Exercise</th>
                    <th className="px-4 py-3">{log1?.name ?? "Workout 1"}</th>
                    <th className="px-4 py-3">{log2?.name ?? "Workout 2"}</th>
                    <th className="px-4 py-3">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr
                      key={row.exercise_id}
                      className={`border-b border-theme-border/80 ${
                        row.diff === "up" ? "bg-emerald-500/5" : row.diff === "down" ? "bg-red-500/5" : row.diff === "new" ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-theme-text-primary">{row.exerciseName}</td>
                      <td className="px-4 py-3 text-theme-text-muted">{row.w1Sets}</td>
                      <td className="px-4 py-3 text-theme-text-muted">{row.w2Sets}</td>
                      <td className="px-4 py-3">
                        {row.diff === "new" && <span className="text-blue-400">New in workout 2</span>}
                        {row.diff === "up" && (
                          <span className="text-emerald-400">
                            +{(row.vol2Lbs - row.vol1Lbs).toFixed(1)} lbs volume
                          </span>
                        )}
                        {row.diff === "down" && (
                          <span className="text-red-400">
                            {(row.vol2Lbs - row.vol1Lbs).toFixed(1)} lbs volume
                          </span>
                        )}
                        {row.diff === "same" && row.w1Sets !== "—" && <span className="text-theme-text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap gap-6 rounded-xl border border-theme-border bg-theme-surface/50 p-4">
              <div>
                <p className="text-xs text-theme-text-muted">Workout 1 total volume</p>
                <p className="text-xl font-bold text-theme-text-primary">
                  {kgToLbs(totalVol1)?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? 0} lbs
                </p>
              </div>
              <div>
                <p className="text-xs text-theme-text-muted">Workout 2 total volume</p>
                <p className="text-xl font-bold text-theme-text-primary">
                  {kgToLbs(totalVol2)?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? 0} lbs
                </p>
              </div>
              <div>
                <p className="text-xs text-theme-text-muted">Difference</p>
                <p className={`text-xl font-bold ${totalVol2 >= totalVol1 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalVol2 >= totalVol1 ? "+" : ""}
                  {(kgToLbs(totalVol2) ?? 0) - (kgToLbs(totalVol1) ?? 0)} lbs
                </p>
              </div>
            </div>
          </>
        )}

        {logs.length === 0 && (
          <p className="mt-8 rounded-xl border border-dashed border-theme-border py-8 text-center text-theme-text-muted">
            No completed workouts yet.{" "}
            <Link href="/workouts/log" className="text-theme-accent hover:underline">
              Log a workout
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
