"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutLog } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

const KG_TO_LBS = 2.20462;

export default function WorkoutHistoryPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<(WorkoutLog & { exercise_count?: number; total_volume?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const { data: logRows, error: logError } = await supabase
      .from("workout_logs")
      .select("id, user_id, mesocycle_id, template_id, name, started_at, completed_at, duration_seconds, notes, created_at")
      .eq("user_id", user.id)
      .eq("is_draft", false)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (logError) {
      console.error("Failed to load workout history", logError);
      setError("Could not load workout history. Please try again.");
      setLogs([]);
      setLoading(false);
      return;
    }
    setError(null);

    const logList = (logRows ?? []) as WorkoutLog[];
    if (logList.length === 0) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const logIds = logList.map((l) => l.id);
    const { data: exRows } = await supabase
      .from("workout_log_exercises")
      .select("workout_log_id, exercise_id, reps, weight_kg")
      .in("workout_log_id", logIds);

    const volumeByLog: Record<string, number> = {};
    const uniqueExercisesByLog: Record<string, Set<string>> = {};
    logIds.forEach((id) => {
      volumeByLog[id] = 0;
      uniqueExercisesByLog[id] = new Set();
    });
    for (const row of exRows ?? []) {
      const lid = row.workout_log_id as string;
      const eid = row.exercise_id as string;
      if (eid) uniqueExercisesByLog[lid]?.add(eid);
      volumeByLog[lid] =
        (volumeByLog[lid] ?? 0) +
        (row.reps ?? 0) * (row.weight_kg ?? 0);
    }

    setLogs(
      logList.map((l) => ({
        ...l,
        exercise_count: uniqueExercisesByLog[l.id]?.size ?? 0,
        total_volume: volumeByLog[l.id] ?? 0,
      }))
    );
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const nameMatch =
        !search.trim() ||
        l.name.toLowerCase().includes(search.trim().toLowerCase());
      const completed = l.completed_at ? new Date(l.completed_at) : null;
      const fromOk = !dateFrom || (completed && completed >= new Date(dateFrom));
      const toOk =
        !dateTo ||
        (completed &&
          completed <= new Date(dateTo + "T23:59:59.999Z"));
      return nameMatch && fromOk && toOk;
    });
  }, [logs, search, dateFrom, dateTo]);

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDuration(seconds: number | null): string {
    if (seconds == null) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error} retry={load} backHref="/workouts/log" backLabel="Back to Log" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Workout History"
          description="Search and filter your completed workouts."
          actions={
            <Link
              href="/workouts/compare"
              className="rounded-lg border border-zinc-600 bg-transparent px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Compare Workouts
            </Link>
          }
        />

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by workout name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
          />
          <span className="self-center text-zinc-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={logs.length === 0 ? "No workouts logged yet" : "No workouts match your filters"}
              description={logs.length === 0 ? "Start your first workout to see it here." : "Try adjusting your search or date range."}
              actionHref="/workouts/log"
              actionLabel="Log Workout"
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {filtered.map((log) => (
              <li key={log.id}>
                <Link
                  href={`/workouts/history/${log.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-4 transition hover:border-zinc-700 hover:bg-zinc-800/30 sm:px-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{log.name}</p>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {formatDate(log.completed_at)} ·{" "}
                        {formatDuration(log.duration_seconds)} ·{" "}
                        {log.exercise_count ?? 0} exercise
                        {(log.exercise_count ?? 0) !== 1 ? "s" : ""} ·{" "}
                        {((log.total_volume ?? 0) * KG_TO_LBS).toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}{" "}
                        lbs volume
                      </p>
                    </div>
                    <span className="text-zinc-500">→</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
