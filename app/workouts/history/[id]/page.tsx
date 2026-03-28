"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatWeight, kgToLbs } from "@/lib/units";
import type {
  WorkoutLog,
  WorkoutLogExercise,
  Exercise,
  PersonalRecord,
} from "@/types";

type SetRow = WorkoutLogExercise & { exercise?: Exercise };

export default function WorkoutHistoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: logData, error: logError } = await supabase
        .from("workout_logs")
        .select(
          "id, user_id, mesocycle_id, template_id, name, started_at, completed_at, duration_seconds, notes, created_at"
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("is_draft", false)
        .single();

      if (logError || !logData) {
        router.replace("/workouts/history");
        return;
      }

      setLog(logData as WorkoutLog);

      const { data: setRows } = await supabase
        .from("workout_log_exercises")
        .select("*")
        .eq("workout_log_id", id)
        .order("order_index")
        .order("set_number");

      const exerciseIds = Array.from(
        new Set((setRows ?? []).map((r: WorkoutLogExercise) => r.exercise_id))
      );
      const { data: exData } = await supabase
        .from("exercises")
        .select("*")
        .in("id", exerciseIds);
      const exMap = (exData ?? []).reduce(
        (acc: Record<string, Exercise>, e: Exercise) => {
          acc[e.id] = e;
          return acc;
        },
        {}
      );
      setExercises(exMap);

      const setRowsWithEx = (setRows ?? []).map((r: WorkoutLogExercise) => ({
        ...r,
        exercise: exMap[r.exercise_id],
      }));
      setSets(setRowsWithEx);

      const setIds = (setRows ?? []).map((r: { id: string }) => r.id);
      const { data: prRows } =
        setIds.length > 0
          ? await supabase
              .from("personal_records")
              .select("*")
              .in("workout_log_exercise_id", setIds)
          : { data: [] };
      setPrs((prRows as PersonalRecord[]) ?? []);

      setLoading(false);
    })();
  }, [id, router]);

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
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

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("workout_logs")
      .delete()
      .eq("id", id);
    setDeleting(false);
    setDeleteModalOpen(false);
    if (error) {
      console.error("Failed to delete workout", error);
      return;
    }
    router.replace("/workouts/history");
  }

  const prSetIds = new Set(prs.map((p) => p.workout_log_exercise_id).filter(Boolean));
  const setsByExercise = sets.reduce((acc, row) => {
    const eid = row.exercise_id;
    if (!acc[eid]) acc[eid] = [];
    acc[eid].push(row);
    return acc;
  }, {} as Record<string, SetRow[]>);

  if (loading || !log) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center text-theme-text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            href="/workouts/history"
            className="text-theme-text-muted hover:text-theme-text-primary"
          >
            ← History
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-theme-text-primary">{log.name}</h1>
        <p className="mt-2 text-theme-text-muted">
          {formatDate(log.completed_at)} · {formatDuration(log.duration_seconds)}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/workouts/log/edit/${id}`}
            className="inline-flex items-center justify-center rounded-xl bg-theme-accent px-4 py-2.5 text-sm font-semibold text-theme-on-accent shadow transition hover:bg-theme-accent-hover focus:outline-none focus:ring-2 focus:ring-theme-accent focus:ring-offset-2 focus:ring-offset-theme-bg"
          >
            Edit Workout
          </Link>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-theme-bg"
          >
            Delete Workout
          </button>
        </div>

        {prs.length > 0 && (
          <div className="mt-6 rounded-xl border-2 border-theme-accent bg-theme-accent/10 p-4">
            <p className="mb-2 font-semibold text-theme-accent">
              Personal records achieved
            </p>
            <ul className="space-y-1 text-theme-accent">
              {prs.map((pr) => (
                <li key={pr.id}>
                  {exercises[pr.exercise_id]?.name ?? "Exercise"}:{" "}
                  {pr.record_type.replace("_", " ")} —{" "}
                  {pr.record_type === "max_weight"
                    ? `${kgToLbs(pr.value)?.toFixed(1) ?? pr.value} lbs`
                    : pr.record_type === "max_duration"
                      ? `${pr.value} s`
                      : pr.value}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 space-y-8">
          {Object.entries(setsByExercise).map(([eid, rows]) => {
            const ex = exercises[eid];
            const name = ex?.name ?? "Unknown exercise";
            return (
              <div
                key={eid}
                className="rounded-xl border border-theme-border bg-theme-surface/30 p-4"
              >
                <h2 className="font-semibold text-theme-text-primary">{name}</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-theme-border text-left text-theme-text-muted">
                        <th className="pb-2 pr-4">Set</th>
                        <th className="pb-2 pr-4">Reps</th>
                        <th className="pb-2 pr-4">Weight</th>
                        <th className="pb-2 pr-4">Duration</th>
                        <th className="pb-2 pr-4">RPE</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-b border-theme-border/80 ${
                            prSetIds.has(row.id)
                              ? "bg-theme-accent/10 text-theme-accent"
                              : ""
                          }`}
                        >
                          <td className="py-2 pr-4">{row.set_number}</td>
                          <td className="py-2 pr-4">{row.reps ?? "—"}</td>
                          <td className="py-2 pr-4">{formatWeight(row.weight_kg)}</td>
                          <td className="py-2 pr-4">
                            {row.duration_seconds != null
                              ? `${row.duration_seconds}s`
                              : "—"}
                          </td>
                          <td className="py-2 pr-4">{row.rpe ?? "—"}</td>
                          <td className="py-2">
                            {prSetIds.has(row.id) && (
                              <span className="rounded bg-theme-accent px-2 py-0.5 text-xs font-medium text-theme-on-accent">
                                PR
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteModalOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <div
              className="flex h-full w-full flex-col justify-center rounded-none border-0 bg-theme-bg p-6 shadow-xl sm:h-auto sm:max-w-sm sm:rounded-xl sm:border sm:border-theme-border"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
            >
              <h2
                id="delete-dialog-title"
                className="text-lg font-bold text-theme-text-primary"
              >
                Delete workout?
              </h2>
              <p className="mt-2 text-sm text-theme-text-muted">
                This will permanently delete &quot;{log.name}&quot; and all its
                sets. This cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !deleting && setDeleteModalOpen(false)}
                  disabled={deleting}
                  className="flex-1 rounded-xl border border-theme-border/80 bg-theme-border/90 py-2.5 text-sm font-medium text-theme-text-muted hover:bg-theme-border disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-theme-text-primary hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
