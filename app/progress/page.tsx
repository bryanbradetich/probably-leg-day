"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

type ExerciseWithVolume = { id: string; name: string; volume_kg: number; set_count: number };

export default function ProgressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithVolume[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        setLoading(false);
        return;
      }
      try {
        setError(null);
        const { data: logRows } = await supabase
          .from("workout_logs")
          .select("id")
          .eq("user_id", user.id)
          .not("completed_at", "is", null);
        const logIds = (logRows ?? []).map((r: { id: string }) => r.id);
        if (logIds.length === 0) {
          setExercises([]);
          setLoading(false);
          return;
        }
        const { data: setRows } = await supabase
          .from("workout_log_exercises")
          .select("exercise_id, reps, weight_kg")
          .in("workout_log_id", logIds);
        const volumeByEx: Record<string, number> = {};
        const setCountByEx: Record<string, number> = {};
        for (const row of setRows ?? []) {
          const eid = row.exercise_id as string;
          volumeByEx[eid] = (volumeByEx[eid] ?? 0) + (row.reps ?? 0) * (row.weight_kg ?? 0);
          setCountByEx[eid] = (setCountByEx[eid] ?? 0) + 1;
        }
        const exIds = Object.keys(volumeByEx);
        if (exIds.length === 0) {
          setExercises([]);
          setLoading(false);
          return;
        }
        const { data: exRows } = await supabase
          .from("exercises")
          .select("id, name")
          .in("id", exIds);
        const list: ExerciseWithVolume[] = (exRows ?? []).map((e: { id: string; name: string }) => ({
          id: e.id,
          name: e.name,
          volume_kg: volumeByEx[e.id] ?? 0,
          set_count: setCountByEx[e.id] ?? 0,
        }));
        list.sort((a, b) => b.volume_kg - a.volume_kg);
        setExercises(list);
      } catch (e) {
        console.error("Progress load error", e);
        setError("Could not load progress. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error} retry={() => window.location.reload()} backHref="/dashboard" backLabel="Dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Progress"
          description="Track your progress by exercise. View charts and set history for each."
        />
        <p className="mt-4">
          <Link href="/reports" className="text-[#f97316] hover:underline">
            View Reports →
          </Link>
        </p>
        {exercises.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No progress data yet"
              description="Log completed workouts to see exercise progress and trends here."
              actionHref="/workouts/log"
              actionLabel="Log Workout"
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {exercises.map((ex) => (
              <li key={ex.id}>
                <Link
                  href={`/progress/exercise/${ex.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 transition hover:border-[#f97316]/60 hover:bg-zinc-900 sm:px-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-white">{ex.name}</span>
                    <span className="text-sm text-zinc-500">
                      {ex.set_count} set{ex.set_count !== 1 ? "s" : ""} · {(ex.volume_kg * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs volume
                    </span>
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
