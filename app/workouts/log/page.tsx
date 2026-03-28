"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs, lbsToKg } from "@/lib/units";
import { ExercisePicker } from "@/components/ExercisePicker";
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
  WorkoutLog,
  WorkoutLogExercise,
  RecordType,
  Mesocycle,
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

type DraftExerciseRow = {
  workout_log_id: string;
  exercise_id: string;
  order_index: number;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  weight_logging_choice: string | null;
};

function buildDraftExerciseRows(
  workoutLogId: string,
  entries: LogExerciseEntry[]
): DraftExerciseRow[] {
  const toInsert: DraftExerciseRow[] = [];
  let orderIndex = 1;
  for (const entry of entries) {
    const choice =
      entry.exercise.weight_logging === "user_choice"
        ? entry.weightLoggingChoice ?? null
        : null;
    if (entry.sets.length === 0) {
      toInsert.push({
        workout_log_id: workoutLogId,
        exercise_id: entry.exercise.id,
        order_index: orderIndex,
        set_number: 1,
        reps: null,
        weight_kg: null,
        duration_seconds: null,
        rpe: null,
        weight_logging_choice: choice,
      });
    } else {
      for (let s = 0; s < entry.sets.length; s++) {
        const set = entry.sets[s];
        toInsert.push({
          workout_log_id: workoutLogId,
          exercise_id: entry.exercise.id,
          order_index: orderIndex,
          set_number: toPositiveInt(s + 1, 1),
          reps: toIntNull(set.reps),
          weight_kg: toNumNull(set.weight_kg),
          duration_seconds: toIntNull(set.duration_seconds),
          rpe: toRpe(set.rpe),
          weight_logging_choice: choice,
        });
      }
    }
    orderIndex += 1;
  }
  return toInsert;
}

function rowIsPlaceholder(row: {
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  rpe: number | null;
}): boolean {
  return (
    row.reps == null &&
    row.weight_kg == null &&
    row.duration_seconds == null &&
    row.rpe == null
  );
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatHistoryLine(
  exerciseType: "reps_sets" | "timed",
  completedAt: string,
  setRows: {
    reps: number | null;
    weight_kg: number | null;
    duration_seconds: number | null;
  }[]
): string {
  const date = formatSessionDate(completedAt);
  if (exerciseType === "timed") {
    const parts = setRows.map((r) =>
      r.duration_seconds != null ? `${r.duration_seconds}s` : "—"
    );
    const n = setRows.length;
    return `${date}: ${n} set${n === 1 ? "" : "s"} @ ${parts.join(", ")}`;
  }
  const parts = setRows.map((r) => {
    const reps = r.reps ?? "?";
    const lbs = r.weight_kg != null ? kgToLbs(r.weight_kg) : null;
    if (lbs != null) {
      const w =
        lbs % 1 === 0 ? lbs.toFixed(0) : lbs.toFixed(1);
      return `${reps} @ ${w} lbs`;
    }
    return `${reps} reps`;
  });
  return `${date}: ${parts.join(", ")}`;
}

export default function LogWorkoutPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([]);
  const [mesocycleId, setMesocycleId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [phase, setPhase] = useState<"start" | "active" | "summary">("start");
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [workoutName, setWorkoutName] = useState("");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [logEntries, setLogEntries] = useState<LogExerciseEntry[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restTimer, setRestTimer] = useState<{
    secondsLeft: number;
    label?: string;
  } | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Summary
  const [summary, setSummary] = useState<{
    durationSeconds: number;
    exercisesCompleted: number;
    totalSets: number;
    totalVolume: number;
    prs: { exerciseName: string; type: RecordType; value: number }[];
  } | null>(null);
  const [existingDraft, setExistingDraft] = useState<WorkoutLog | null>(null);
  const [draftCheckDone, setDraftCheckDone] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [historyByExercise, setHistoryByExercise] = useState<
    Record<string, string[]>
  >({});
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusClearRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);
      const [tRes, mRes, eRes, draftRes] = await Promise.all([
        supabase
          .from("workout_templates")
          .select("*")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("mesocycles")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["active", "planned"])
          .order("status", { ascending: false })
          .order("start_date", { ascending: false }),
        supabase.from("exercises").select("*").order("name"),
        supabase
          .from("workout_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_draft", true)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setTemplates((tRes.data as WorkoutTemplate[]) ?? []);
      const mesoList = (mRes.data as Mesocycle[]) ?? [];
      setMesocycles(mesoList);
      const active = mesoList.find((m) => m.status === "active");
      setMesocycleId(active?.id ?? null);
      setExercises((eRes.data as Exercise[]) ?? []);
      setExistingDraft((draftRes.data as WorkoutLog | null) ?? null);
      setDraftCheckDone(true);
    })();
  }, [router]);

  const startWorkout = useCallback(
    async (fromTemplateId: string | null, name: string) => {
      if (!userId) return;
      const supabase = createClient();
      const now = new Date().toISOString();
      const { data: log, error } = await supabase
        .from("workout_logs")
        .insert({
          user_id: userId,
          template_id: fromTemplateId,
          mesocycle_id: mesocycleId,
          name: name.trim() || "Workout",
          started_at: now,
          is_draft: true,
        })
        .select()
        .single();

      if (error || !log) {
        console.error("Failed to start workout", error);
        return;
      }

      setWorkoutLogId((log as WorkoutLog).id);
      setWorkoutName(name.trim() || "Workout");
      setTemplateId(fromTemplateId);
      setStartedAt(new Date());
      setElapsedSeconds(0);

      let entries: LogExerciseEntry[] = [];
      if (fromTemplateId) {
        const { data: teRows } = await supabase
          .from("workout_template_exercises")
          .select("*, exercises(*)")
          .eq("template_id", fromTemplateId)
          .order("order_index");
        const rows = (teRows ?? []) as (WorkoutTemplateExercise & {
          exercises: Exercise;
        })[];
        entries = rows.map((row) => ({
          exercise: row.exercises,
          templateTarget: {
            target_sets: row.target_sets,
            target_reps: row.target_reps,
            target_duration_seconds: row.target_duration_seconds,
            target_rest_seconds: row.target_rest_seconds ?? 0,
          },
          sets: [],
          weightLoggingChoice:
            row.exercises.weight_logging === "user_choice"
              ? "total"
              : undefined,
        }));
      }
      setLogEntries(entries);
      setExistingDraft(null);
      setPhase("active");
    },
    [userId, mesocycleId]
  );

  const continueDraft = useCallback(async () => {
    if (!userId || !existingDraft) return;
    const supabase = createClient();
    const draft = existingDraft;

    const { data: setRows } = await supabase
      .from("workout_log_exercises")
      .select("*")
      .eq("workout_log_id", draft.id)
      .order("order_index")
      .order("set_number");

    let templateRows: (WorkoutTemplateExercise & { exercises: Exercise })[] =
      [];
    if (draft.template_id) {
      const { data: teRows } = await supabase
        .from("workout_template_exercises")
        .select("*, exercises(*)")
        .eq("template_id", draft.template_id)
        .order("order_index");
      templateRows = (teRows ?? []) as (WorkoutTemplateExercise & {
        exercises: Exercise;
      })[];
    }

    const exerciseById: Record<string, Exercise> = Object.fromEntries(
      exercises.map((e) => [e.id, e])
    );

    const groups = new Map<number, WorkoutLogExercise[]>();
    for (const row of setRows ?? []) {
      const r = row as WorkoutLogExercise;
      const oi = r.order_index;
      if (!groups.has(oi)) groups.set(oi, []);
      groups.get(oi)!.push(r);
    }
    const sortedOrder = Array.from(groups.keys()).sort((a, b) => a - b);

    const entries: LogExerciseEntry[] = [];
    for (const orderIndex of sortedOrder) {
      const g = groups.get(orderIndex)!;
      const exId = g[0].exercise_id;
      let exercise = exerciseById[exId];
      if (!exercise) {
        const { data: oneEx } = await supabase
          .from("exercises")
          .select("*")
          .eq("id", exId)
          .single();
        if (!oneEx) continue;
        exercise = oneEx as Exercise;
        exerciseById[exId] = exercise;
      }

      const isPh = g.length === 1 && rowIsPlaceholder(g[0]);
      const sets: SetEntry[] = isPh
        ? []
        : g.map((r) => ({
            reps: r.reps,
            weight_kg:
              r.weight_kg != null ? Number(r.weight_kg) : null,
            duration_seconds: r.duration_seconds,
            rpe: r.rpe != null ? Number(r.rpe) : null,
          }));

      const tr = templateRows.find((t) => t.exercise_id === exId);
      const templateTarget = tr
        ? {
            target_sets: tr.target_sets,
            target_reps: tr.target_reps,
            target_duration_seconds: tr.target_duration_seconds,
            target_rest_seconds: tr.target_rest_seconds ?? 0,
          }
        : undefined;

      const wChoice = g.find((x) => x.weight_logging_choice)?.weight_logging_choice;

      entries.push({
        exercise,
        templateTarget,
        sets,
        weightLoggingChoice:
          exercise.weight_logging === "user_choice"
            ? (wChoice as "per_hand" | "total" | undefined) ?? "total"
            : undefined,
      });
    }

    setWorkoutLogId(draft.id);
    setWorkoutName(draft.name);
    setTemplateId(draft.template_id);
    setMesocycleId(draft.mesocycle_id);
    setStartedAt(new Date(draft.started_at));
    setElapsedSeconds(
      Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(draft.started_at).getTime()) / 1000
        )
      )
    );
    setLogEntries(entries);
    setExistingDraft(null);
    setPhase("active");
  }, [userId, existingDraft, exercises]);

  const discardDraft = useCallback(async () => {
    if (!existingDraft) return;
    const supabase = createClient();
    await supabase.from("workout_logs").delete().eq("id", existingDraft.id);
    setExistingDraft(null);
  }, [existingDraft]);

  const logAnotherWorkout = useCallback(async () => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    if (userId) {
      const supabase = createClient();
      await supabase
        .from("workout_logs")
        .delete()
        .eq("user_id", userId)
        .eq("is_draft", true);
    }
    window.location.href = "/workouts/log";
  }, [userId]);

  const historyKey = logEntries.map((e) => e.exercise.id).join(",");

  useEffect(() => {
    if (phase !== "active" || !userId || !workoutLogId || !historyKey) {
      setHistoryByExercise({});
      return;
    }
    const ids = Array.from(new Set(logEntries.map((e) => e.exercise.id)));
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workout_log_exercises")
        .select(
          `
          exercise_id,
          reps,
          weight_kg,
          duration_seconds,
          set_number,
          order_index,
          workout_log_id,
          workout_logs!inner ( completed_at, user_id, is_draft )
        `
        )
        .in("exercise_id", ids)
        .eq("workout_logs.user_id", userId)
        .eq("workout_logs.is_draft", false)
        .not("workout_logs.completed_at", "is", null);

      if (cancelled) return;
      if (error) {
        console.error("Exercise history load failed", error);
        return;
      }

      type HRow = {
        exercise_id: string;
        workout_log_id: string;
        reps: number | null;
        weight_kg: number | null;
        duration_seconds: number | null;
        set_number: number;
        order_index: number;
        workout_logs: { completed_at: string; user_id: string; is_draft: boolean };
      };

      const rows = (data as unknown as HRow[] | null | undefined)?.filter(
        (r) => r.workout_log_id !== workoutLogId
      ) ?? [];

      const byEx: Record<
        string,
        Record<string, { completed_at: string; sets: HRow[] }>
      > = {};
      for (const r of rows) {
        const wid = r.workout_log_id;
        const eid = r.exercise_id;
        if (!byEx[eid]) byEx[eid] = {};
        if (!byEx[eid][wid]) {
          byEx[eid][wid] = {
            completed_at: r.workout_logs.completed_at,
            sets: [],
          };
        }
        byEx[eid][wid].sets.push(r);
      }

      const exTypeById = Object.fromEntries(
        logEntries.map((e) => [e.exercise.id, e.exercise.type])
      );

      const out: Record<string, string[]> = {};
      for (const eid of ids) {
        const sessions = Object.entries(byEx[eid] ?? {})
          .map(([, v]) => v)
          .sort(
            (a, b) =>
              new Date(b.completed_at).getTime() -
              new Date(a.completed_at).getTime()
          )
          .slice(0, 3);

        const exType = exTypeById[eid] ?? "reps_sets";
        const lines: string[] = [];
        for (const s of sessions) {
          const sortedSets = [...s.sets].sort(
            (a, b) =>
              a.order_index - b.order_index || a.set_number - b.set_number
          );
          const realSets = sortedSets.filter(
            (row) =>
              row.reps != null ||
              row.weight_kg != null ||
              row.duration_seconds != null
          );
          if (realSets.length === 0) continue;
          lines.push(formatHistoryLine(exType, s.completed_at, realSets));
        }
        out[eid] = lines;
      }

      if (!cancelled) setHistoryByExercise(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, userId, workoutLogId, historyKey]);

  useEffect(() => {
    if (phase !== "active" || !workoutLogId || !startedAt) return;

    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);

    draftSaveTimerRef.current = setTimeout(async () => {
      const supabase = createClient();
      const startedIso = startedAt.toISOString();
      setSaveStatus("saving");
      try {
        const { error: uErr } = await supabase
          .from("workout_logs")
          .update({
            name: workoutName.trim() || "Workout",
            mesocycle_id: mesocycleId,
            started_at: startedIso,
          })
          .eq("id", workoutLogId)
          .eq("is_draft", true);

        if (uErr) throw uErr;

        await supabase
          .from("workout_log_exercises")
          .delete()
          .eq("workout_log_id", workoutLogId);

        const rows = buildDraftExerciseRows(workoutLogId, logEntries);
        if (rows.length > 0) {
          const { error: iErr } = await supabase
            .from("workout_log_exercises")
            .insert(rows);
          if (iErr) throw iErr;
        }

        setSaveStatus("saved");
        if (saveStatusClearRef.current)
          clearTimeout(saveStatusClearRef.current);
        saveStatusClearRef.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } catch (e) {
        console.error("Draft save failed", e);
        setSaveStatus("error");
      }
    }, 500);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [
    phase,
    workoutLogId,
    workoutName,
    mesocycleId,
    startedAt,
    logEntries,
  ]);

  useEffect(() => {
    if (phase !== "active" || !startedAt) return;
    elapsedRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [phase, startedAt]);

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

  async function finishWorkout() {
    if (!userId || !workoutLogId) return;
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    const supabase = createClient();
    const completedAt = new Date();
    const started = startedAt ?? completedAt;
    const durationSeconds = Math.round(
      (completedAt.getTime() - started.getTime()) / 1000
    );

    await supabase
      .from("workout_log_exercises")
      .delete()
      .eq("workout_log_id", workoutLogId);

    await supabase
      .from("workout_logs")
      .update({
        completed_at: completedAt.toISOString(),
        duration_seconds: durationSeconds,
        mesocycle_id: mesocycleId,
        name: workoutName.trim() || "Workout",
        is_draft: false,
      })
      .eq("id", workoutLogId);

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
        const setNumber = toPositiveInt(s + 1, 1);
        toInsert.push({
          workout_log_id: workoutLogId,
          exercise_id: entry.exercise.id,
          order_index: orderIndex,
          set_number: setNumber,
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

    console.log(
      "[Finish Workout] Sets being saved to workout_log_exercises:",
      JSON.stringify(toInsert, null, 2)
    );

    if (toInsert.length === 0) {
      setSummary({
        durationSeconds,
        exercisesCompleted: 0,
        totalSets: 0,
        totalVolume: 0,
        prs: [],
      });
      setPhase("summary");
      return;
    }

    const { data: inserted, error } = await supabase
      .from("workout_log_exercises")
      .insert(toInsert)
      .select("id, exercise_id, reps, weight_kg, duration_seconds");

    if (error) {
      console.error("Failed to save sets", error);
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

    let totalVolume = 0;
    for (const row of insertedRows) {
      totalVolume += (row.reps ?? 0) * (row.weight_kg ?? 0);
    }

    const exerciseIds = Array.from(
      new Set(insertedRows.map((r) => r.exercise_id))
    );
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
      if (!existingByExerciseAndType[eid]) existingByExerciseAndType[eid] = {};
      existingByExerciseAndType[eid][type] = Math.max(
        existingByExerciseAndType[eid][type] ?? -Infinity,
        val
      );
    }

    const prs: { exerciseName: string; type: RecordType; value: number }[] = [];
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
      const rowsForEx = insertedRows.filter((r) => r.exercise_id === exerciseId);

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
            achieved_at: completedAt.toISOString(),
          });
          markPrSetIds.add(maxWeightRowId);
          prs.push({ exerciseName: ex.name, type: "max_weight", value: maxWeight });
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
            achieved_at: completedAt.toISOString(),
          });
          markPrSetIds.add(maxRepsRowId);
          prs.push({ exerciseName: ex.name, type: "max_reps", value: maxReps });
        }
        if (
          sessionVolume > (existing["max_volume"] ?? -Infinity) &&
          rowsForEx.length > 0
        ) {
          const firstRowId = rowsForEx[0].id;
          prInserts.push({
            user_id: userId,
            exercise_id: exerciseId,
            record_type: "max_volume",
            value: sessionVolume,
            workout_log_exercise_id: firstRowId,
            achieved_at: completedAt.toISOString(),
          });
          markPrSetIds.add(firstRowId);
          prs.push({
            exerciseName: ex.name,
            type: "max_volume",
            value: sessionVolume,
          });
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
            achieved_at: completedAt.toISOString(),
          });
          markPrSetIds.add(maxDurRowId);
          prs.push({
            exerciseName: ex.name,
            type: "max_duration",
            value: maxDur,
          });
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

    const seen = new Set<string>();
    const dedupedPrs = prs.filter((p) => {
      const key = `${p.exerciseName}-${p.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setSummary({
      durationSeconds,
      exercisesCompleted: logEntries.length,
      totalSets: toInsert.length,
      totalVolume,
      prs: dedupedPrs,
    });
    setPhase("summary");
  }

  if (userId === null) return null;

  if (phase === "start") {
    const hasDraft = draftCheckDone && existingDraft;
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Log Workout
          </h1>
          <p className="mt-2 text-zinc-400">
            Start from a template or begin an empty workout.
          </p>

          {hasDraft && (
            <div className="mt-6 rounded-xl border-2 border-[#f97316] bg-[#f97316]/10 p-4 shadow-lg">
              <p className="text-sm font-medium text-zinc-100">
                You have an unfinished workout from{" "}
                {formatTimeAgo(existingDraft.started_at)}. Would you like to
                continue?
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void continueDraft()}
                  className="rounded-xl bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ea580c]"
                >
                  Continue workout
                </button>
                <button
                  type="button"
                  onClick={() => void discardDraft()}
                  className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
                >
                  Start fresh
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Workout name
              </label>
              <input
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="e.g. Push Day"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white placeholder-zinc-500 focus:border-[#f97316] focus:outline-none focus:ring-2 focus:ring-[#f97316]"
              />
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="mb-3 text-sm font-medium text-zinc-300">
                Start from template (optional)
              </p>
              <select
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                value={templateId ?? ""}
                onChange={(e) => {
                  const tid = e.target.value || null;
                  setTemplateId(tid);
                  if (tid) {
                    const t = templates.find((x) => x.id === tid);
                    if (t && !workoutName) setWorkoutName(t.name);
                  }
                }}
              >
                <option value="">No template — empty workout</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {mesocycles.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="mb-3 text-sm font-medium text-zinc-300">
                  Mesocycle (optional)
                </p>
                <select
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                  value={mesocycleId ?? ""}
                  onChange={(e) => setMesocycleId(e.target.value || null)}
                >
                  <option value="">No mesocycle</option>
                  {mesocycles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.status === "active" ? " (active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              disabled={!!hasDraft}
              title={
                hasDraft
                  ? "Continue or discard your draft workout first"
                  : undefined
              }
              onClick={() => startWorkout(templateId, workoutName)}
              className="w-full rounded-xl bg-[#f97316] py-4 text-lg font-semibold text-[#0a0a0a] shadow-lg transition hover:bg-[#ea580c] focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:ring-offset-2 focus:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {templateId ? "Start from template" : "Start empty workout"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "summary" && summary) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-bold text-white">Workout complete</h1>
          <div className="mt-8 space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
            <p className="text-3xl font-bold text-[#f97316]">
              {formatDuration(summary.durationSeconds)}
            </p>
            <p className="text-zinc-400">Duration</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xl font-semibold text-white">
                  {summary.exercisesCompleted}
                </p>
                <p className="text-sm text-zinc-500">Exercises</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-white">
                  {summary.totalSets}
                </p>
                <p className="text-sm text-zinc-500">Sets</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-white">
                  {(summary.totalVolume * 2.20462).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 1 }
                  )}
                </p>
                <p className="text-sm text-zinc-500">Total volume (lbs)</p>
              </div>
            </div>
            {summary.prs.length > 0 && (
              <div className="rounded-lg border-2 border-[#f97316] bg-[#f97316]/10 p-4">
                <p className="mb-2 font-semibold text-[#f97316]">
                  New personal records
                </p>
                <ul className="space-y-1">
                  {summary.prs.map((pr, i) => (
                    <li key={i} className="text-[#f97316]">
                      {pr.exerciseName}: {pr.type.replace("_", " ")} —{" "}
                      {pr.type === "max_weight"
                        ? `${kgToLbs(pr.value)?.toFixed(1) ?? pr.value} lbs`
                        : pr.type === "max_duration"
                          ? `${pr.value} s`
                          : pr.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              className="mt-4 block w-full rounded-xl bg-[#f97316] py-3 text-center font-semibold text-[#0a0a0a] hover:bg-[#ea580c]"
              onClick={() => void logAnotherWorkout()}
            >
              Log another workout
            </button>
            <Link
              href="/workouts/history"
              className="block w-full rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-center font-medium text-zinc-300 hover:bg-zinc-700"
            >
              View history
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              className="w-full bg-transparent text-xl font-bold text-white focus:outline-none focus:ring-0"
            />
            <p className="text-2xl font-bold tabular-nums text-[#f97316]">
              {formatDuration(elapsedSeconds)}
            </p>
          </div>
          <div className="shrink-0 pt-1 text-xs text-zinc-400">
            {saveStatus === "saving" && <span>Saving…</span>}
            {saveStatus === "saved" && <span>Saved</span>}
            {saveStatus === "error" && (
              <span className="text-red-400">Save failed</span>
            )}
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
              <p className="font-semibold text-white">{entry.exercise.name}</p>
              {historyByExercise[entry.exercise.id]?.length ? (
                <div className="mt-1 space-y-0.5 text-[11px] leading-snug text-zinc-500">
                  {historyByExercise[entry.exercise.id].map((line, hi) => (
                    <p key={hi}>{line}</p>
                  ))}
                </div>
              ) : null}
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
                className="mt-3 rounded-lg border border-dashed border-zinc-600 py-2 w-full text-sm text-zinc-400 hover:border-[#f97316] hover:text-[#f97316]"
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
            onClick={finishWorkout}
            className="flex-1 rounded-xl bg-[#f97316] py-4 text-lg font-semibold text-[#0a0a0a] hover:bg-[#ea580c]"
          >
            Finish workout
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
