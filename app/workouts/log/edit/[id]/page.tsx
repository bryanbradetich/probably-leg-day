"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs, lbsToKg } from "@/lib/units";
import { ExercisePicker } from "@/components/ExercisePicker";
import type {
  Exercise,
  WorkoutLog,
  WorkoutLogExercise,
  RecordType,
} from "@/types";

type SetEntry = {
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  rpe: number | null;
};

type LogExerciseEntry = {
  exercise: Exercise;
  templateTarget?: {
    target_sets: number;
    target_reps: number | null;
    target_duration_seconds: number | null;
    target_rest_seconds: number;
  };
  sets: SetEntry[];
  weightLoggingChoice?: "per_hand" | "total";
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [userId, setUserId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [workoutName, setWorkoutName] = useState("");
  const [logEntries, setLogEntries] = useState<LogExerciseEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restTimer, setRestTimer] = useState<{
    secondsLeft: number;
    label?: string;
  } | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const completedAtRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);

      const { data: logData, error: logError } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("is_draft", false)
        .single();

      if (logError || !logData) {
        router.replace("/workouts/history");
        return;
      }

      const log = logData as WorkoutLog;
      setWorkoutLog(log);
      setWorkoutName(log.name);
      completedAtRef.current = log.completed_at;

      const { data: exList } = await supabase
        .from("exercises")
        .select("*")
        .order("name");
      setExercises((exList as Exercise[]) ?? []);

      const { data: setRows } = await supabase
        .from("workout_log_exercises")
        .select("*")
        .eq("workout_log_id", id)
        .order("order_index")
        .order("set_number");

      const rows = (setRows ?? []) as WorkoutLogExercise[];
      const exerciseIds = Array.from(new Set(rows.map((r) => r.exercise_id)));
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

      // Group by order_index (exercise block), then build sets per exercise
      const byOrder = new Map<number, WorkoutLogExercise[]>();
      for (const row of rows) {
        const oi = row.order_index;
        if (!byOrder.has(oi)) byOrder.set(oi, []);
        byOrder.get(oi)!.push(row);
      }
      const sortedOrders = Array.from(byOrder.keys()).sort((a, b) => a - b);
      const entries: LogExerciseEntry[] = sortedOrders.map((oi) => {
        const group = byOrder.get(oi)!;
        const first = group[0];
        const ex = exMap[first.exercise_id];
        if (!ex) {
          return {
            exercise: {
              id: first.exercise_id,
              name: "Unknown",
              description: null,
              type: "reps_sets",
              muscle_groups: [],
              equipment: null,
              weight_logging: "total",
              is_unilateral: false,
              created_by: null,
              is_public: true,
              created_at: "",
            } as Exercise,
            sets: [],
            weightLoggingChoice: (first.weight_logging_choice as "per_hand" | "total") ?? undefined,
          };
        }
        const sets: SetEntry[] = group.map((r) => ({
          reps: r.reps,
          weight_kg: r.weight_kg,
          duration_seconds: r.duration_seconds,
          rpe: r.rpe,
        }));
        return {
          exercise: ex,
          sets,
          weightLoggingChoice:
            ex.weight_logging === "user_choice"
              ? (first.weight_logging_choice as "per_hand" | "total") ?? "total"
              : undefined,
        };
      });
      setLogEntries(entries);
      setLoading(false);
    })();
  }, [id, router]);

  useEffect(() => {
    if (!restTimer) return;
    restTimerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev || prev.secondsLeft <= 1) return null;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [restTimer?.secondsLeft]);

  function addSet(exerciseIndex: number) {
    setLogEntries((prev) =>
      prev.map((e, i) =>
        i === exerciseIndex
          ? {
              ...e,
              sets: [
                ...e.sets,
                {
                  reps: null,
                  weight_kg: null,
                  duration_seconds: null,
                  rpe: null,
                },
              ],
            }
          : e
      )
    );
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setLogEntries((prev) =>
      prev.map((e, i) =>
        i === exerciseIndex
          ? { ...e, sets: e.sets.filter((_, j) => j !== setIndex) }
          : e
      )
    );
  }

  function removeExercise(exerciseIndex: number) {
    setLogEntries((prev) => prev.filter((_, i) => i !== exerciseIndex));
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    field: keyof SetEntry,
    value: number | null
  ) {
    setLogEntries((prev) =>
      prev.map((e, i) => {
        if (i !== exerciseIndex) return e;
        return {
          ...e,
          sets: e.sets.map((s, j) =>
            j === setIndex ? { ...s, [field]: value } : s
          ),
        };
      })
    );
  }

  function setWeightLoggingChoice(
    exerciseIndex: number,
    choice: "per_hand" | "total"
  ) {
    setLogEntries((prev) =>
      prev.map((e, i) =>
        i === exerciseIndex ? { ...e, weightLoggingChoice: choice } : e
      )
    );
  }

  function startRestTimer(seconds: number, label?: string) {
    setRestTimer({ secondsLeft: seconds, label });
  }

  function addExerciseToWorkout(exercise: Exercise) {
    setLogEntries((prev) => [
      ...prev,
      {
        exercise,
        templateTarget: undefined,
        sets: [],
        weightLoggingChoice:
          exercise.weight_logging === "user_choice" ? "total" : undefined,
      },
    ]);
    setPickerOpen(false);
  }

  async function saveChanges() {
    if (!userId || !id) return;
    setSaving(true);
    const supabase = createClient();

    await supabase
      .from("workout_logs")
      .update({ name: workoutName.trim() || "Workout" })
      .eq("id", id)
      .eq("user_id", userId);

    function toNumNull(v: number | null | undefined | string): number | null {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    function toIntNull(v: number | null | undefined | string): number | null {
      const n = toNumNull(v);
      return n === null ? null : Math.floor(n);
    }
    function toRpe(v: number | null | undefined | string): number | null {
      const n = toNumNull(v);
      if (n === null) return null;
      if (n >= 1 && n <= 10) return n;
      return null;
    }
    function toPositiveInt(value: number, fallback: number): number {
      const n = Math.floor(Number(value));
      return Number.isFinite(n) && n >= 1 ? n : fallback;
    }

    const toInsert: {
      workout_log_id: string;
      exercise_id: string;
      order_index: number;
      set_number: number;
      reps: number | null;
      weight_kg: number | null;
      duration_seconds: number | null;
      rpe: number | null;
      weight_logging_choice: string | null;
    }[] = [];
    let orderIndex = 1;
    for (const entry of logEntries) {
      for (let s = 0; s < entry.sets.length; s++) {
        const set = entry.sets[s];
        toInsert.push({
          workout_log_id: id,
          exercise_id: entry.exercise.id,
          order_index: orderIndex,
          set_number: toPositiveInt(s + 1, 1),
          reps: toIntNull(set.reps),
          weight_kg: toNumNull(set.weight_kg),
          duration_seconds: toIntNull(set.duration_seconds),
          rpe: toRpe(set.rpe),
          weight_logging_choice:
            entry.exercise.weight_logging === "user_choice"
              ? entry.weightLoggingChoice ?? null
              : null,
        });
      }
      orderIndex += 1;
    }

    await supabase
      .from("workout_log_exercises")
      .delete()
      .eq("workout_log_id", id);

    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from("workout_log_exercises")
        .insert(toInsert)
        .select("id, exercise_id, reps, weight_kg, duration_seconds");

      if (error) {
        console.error("Failed to save sets", error);
        setSaving(false);
        return;
      }

      const insertedRows = (inserted ?? []) as (WorkoutLogExercise & {
        id: string;
        exercise_id: string;
        reps: number | null;
        weight_kg: number | null;
        duration_seconds: number | null;
      })[];
      const exerciseById = Object.fromEntries(
        logEntries.map((e) => [e.exercise.id, e.exercise])
      );
      const exerciseIds = Array.from(
        new Set(insertedRows.map((r) => r.exercise_id))
      );
      const achievedAt =
        completedAtRef.current ?? new Date().toISOString();

      const { data: existingPrs } = await supabase
        .from("personal_records")
        .select("exercise_id, record_type, value")
        .eq("user_id", userId)
        .in("exercise_id", exerciseIds);

      const existingByExerciseAndType: Record<
        string,
        Record<string, number>
      > = {};
      for (const r of existingPrs ?? []) {
        const eid = r.exercise_id as string;
        const type = r.record_type as string;
        const val = r.value as number;
        if (!existingByExerciseAndType[eid])
          existingByExerciseAndType[eid] = {};
        existingByExerciseAndType[eid][type] = Math.max(
          existingByExerciseAndType[eid][type] ?? -Infinity,
          val
        );
      }

      const prInserts: {
        user_id: string;
        exercise_id: string;
        record_type: RecordType;
        value: number;
        workout_log_exercise_id: string;
        achieved_at: string;
      }[] = [];
      const markPrSetIds = new Set<string>();

      for (const exerciseId of exerciseIds) {
        const ex = exerciseById[exerciseId];
        if (!ex) continue;
        const existing = existingByExerciseAndType[exerciseId] ?? {};
        const rowsForEx = insertedRows.filter(
          (r) => r.exercise_id === exerciseId
        );

        if (ex.type === "reps_sets") {
          let maxWeight = -Infinity;
          let maxWeightRowId: string | null = null;
          let maxReps = -Infinity;
          let maxRepsRowId: string | null = null;
          let sessionVolume = 0;
          for (const row of rowsForEx) {
            const w = row.weight_kg ?? -Infinity;
            const r = row.reps ?? -Infinity;
            if (w > maxWeight) {
              maxWeight = w;
              maxWeightRowId = row.id;
            }
            if (r > maxReps) {
              maxReps = r;
              maxRepsRowId = row.id;
            }
            sessionVolume += (row.reps ?? 0) * (row.weight_kg ?? 0);
          }
          if (
            maxWeightRowId &&
            maxWeight > (existing["max_weight"] ?? -Infinity)
          ) {
            prInserts.push({
              user_id: userId,
              exercise_id: exerciseId,
              record_type: "max_weight",
              value: maxWeight,
              workout_log_exercise_id: maxWeightRowId,
              achieved_at: achievedAt,
            });
            markPrSetIds.add(maxWeightRowId);
          }
          if (
            maxRepsRowId &&
            maxReps > (existing["max_reps"] ?? -Infinity)
          ) {
            prInserts.push({
              user_id: userId,
              exercise_id: exerciseId,
              record_type: "max_reps",
              value: maxReps,
              workout_log_exercise_id: maxRepsRowId,
              achieved_at: achievedAt,
            });
            markPrSetIds.add(maxRepsRowId);
          }
          if (
            sessionVolume > (existing["max_volume"] ?? -Infinity) &&
            rowsForEx.length > 0
          ) {
            prInserts.push({
              user_id: userId,
              exercise_id: exerciseId,
              record_type: "max_volume",
              value: sessionVolume,
              workout_log_exercise_id: rowsForEx[0].id,
              achieved_at: achievedAt,
            });
            markPrSetIds.add(rowsForEx[0].id);
          }
        }

        if (ex.type === "timed") {
          let maxDur = -Infinity;
          let maxDurRowId: string | null = null;
          for (const row of rowsForEx) {
            const d = row.duration_seconds ?? -Infinity;
            if (d > maxDur) {
              maxDur = d;
              maxDurRowId = row.id;
            }
          }
          if (
            maxDurRowId &&
            maxDur > (existing["max_duration"] ?? -Infinity)
          ) {
            prInserts.push({
              user_id: userId,
              exercise_id: exerciseId,
              record_type: "max_duration",
              value: maxDur,
              workout_log_exercise_id: maxDurRowId,
              achieved_at: achievedAt,
            });
            markPrSetIds.add(maxDurRowId);
          }
        }
      }

      if (prInserts.length > 0) {
        await supabase.from("personal_records").insert(prInserts);
        for (const setId of Array.from(markPrSetIds)) {
          await supabase
            .from("workout_log_exercises")
            .update({ is_personal_record: true })
            .eq("id", setId);
        }
      }
    }

    setSaving(false);
    router.replace(`/workouts/history/${id}`);
  }

  if (userId === null || loading || !workoutLog) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  const durationSeconds =
    workoutLog.duration_seconds ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <Link
              href={`/workouts/history/${id}`}
              className="text-sm text-zinc-400 hover:text-white"
            >
              ← Back to workout
            </Link>
            <input
              type="text"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              className="mt-1 block w-full bg-transparent text-xl font-bold text-white focus:outline-none focus:ring-0"
            />
            <p className="text-2xl font-bold tabular-nums text-[#f97316]">
              {formatDuration(durationSeconds)}
            </p>
          </div>
        </div>

        {restTimer && (
          <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-[#f97316] bg-[#f97316]/10 px-4 py-3">
            <span className="font-semibold text-[#f97316]">
              Rest: {formatDuration(restTimer.secondsLeft)}
              {restTimer.label ? ` — ${restTimer.label}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setRestTimer(null)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-6">
          {logEntries.map((entry, exIndex) => (
            <div
              key={`${entry.exercise.id}-${exIndex}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-white">{entry.exercise.name}</p>
                <button
                  type="button"
                  onClick={() => removeExercise(exIndex)}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-red-400"
                  aria-label="Remove exercise"
                >
                  Remove
                </button>
              </div>
              {entry.templateTarget && (
                <p className="mt-0.5 text-sm text-zinc-500">
                  Target: {entry.templateTarget.target_sets} sets
                  {entry.exercise.type === "reps_sets"
                    ? ` × ${entry.templateTarget.target_reps ?? "?"} reps`
                    : ` × ${entry.templateTarget.target_duration_seconds ?? "?"}s`}
                  {entry.templateTarget.target_rest_seconds
                    ? ` · ${entry.templateTarget.target_rest_seconds}s rest`
                    : ""}
                </p>
              )}
              {entry.exercise.weight_logging === "user_choice" && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWeightLoggingChoice(exIndex, "total")}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      entry.weightLoggingChoice === "total"
                        ? "bg-[#f97316] text-[#0a0a0a]"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    Total weight
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightLoggingChoice(exIndex, "per_hand")}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      entry.weightLoggingChoice === "per_hand"
                        ? "bg-[#f97316] text-[#0a0a0a]"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    Per hand
                  </button>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {entry.sets.map((set, setIndex) => (
                  <div
                    key={setIndex}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-800/50 p-2"
                  >
                    <span className="w-8 text-sm text-zinc-500">
                      Set {setIndex + 1}
                    </span>
                    {entry.exercise.type === "reps_sets" ? (
                      <>
                        <input
                          type="number"
                          placeholder="Reps"
                          value={set.reps ?? ""}
                          onChange={(e) =>
                            updateSet(
                              exIndex,
                              setIndex,
                              "reps",
                              parseInt(e.target.value, 10) || null
                            )
                          }
                          className="h-10 w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-white"
                        />
                        <input
                          type="number"
                          step="0.5"
                          placeholder="Weight"
                          value={kgToLbs(set.weight_kg) ?? ""}
                          onChange={(e) =>
                            updateSet(
                              exIndex,
                              setIndex,
                              "weight_kg",
                              lbsToKg(
                                e.target.value === ""
                                  ? null
                                  : parseFloat(e.target.value)
                              )
                            )
                          }
                          className="h-10 w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-white"
                        />
                        <span className="text-zinc-500">lbs</span>
                      </>
                    ) : (
                      <input
                        type="number"
                        placeholder="Seconds"
                        value={set.duration_seconds ?? ""}
                        onChange={(e) =>
                          updateSet(
                            exIndex,
                            setIndex,
                            "duration_seconds",
                            parseInt(e.target.value, 10) || null
                          )
                        }
                        className="h-10 w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-white"
                      />
                    )}
                    <input
                      type="number"
                      min={1}
                      max={10}
                      placeholder="RPE"
                      value={set.rpe ?? ""}
                      onChange={(e) =>
                        updateSet(
                          exIndex,
                          setIndex,
                          "rpe",
                          parseInt(e.target.value, 10) || null
                        )
                      }
                      className="h-10 w-14 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-white"
                    />
                    {entry.templateTarget?.target_rest_seconds ? (
                      <button
                        type="button"
                        onClick={() =>
                          startRestTimer(
                            entry.templateTarget!.target_rest_seconds,
                            entry.exercise.name
                          )
                        }
                        className="rounded-lg bg-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600"
                      >
                        Rest timer
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeSet(exIndex, setIndex)}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-red-400"
                      aria-label="Remove set"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addSet(exIndex)}
                className="mt-3 w-full rounded-lg border border-dashed border-zinc-600 py-2 text-sm text-zinc-400 hover:border-[#f97316] hover:text-[#f97316]"
              >
                Add set
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-xl border-2 border-dashed border-zinc-600 py-4 text-zinc-400 hover:border-[#f97316] hover:text-[#f97316]"
          >
            + Add exercise
          </button>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={saveChanges}
            disabled={saving}
            className="flex-1 rounded-xl bg-[#f97316] py-4 text-lg font-semibold text-[#0a0a0a] hover:bg-[#ea580c] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setPickerOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-800 bg-[#0a0a0a] p-4 shadow-xl">
              <h2 className="mb-4 text-lg font-bold text-white">
                Add exercise
              </h2>
              <ExercisePicker
                exercises={exercises}
                onSelect={addExerciseToWorkout}
                excludeIds={logEntries.map((e) => e.exercise.id)}
                onClose={() => setPickerOpen(false)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
