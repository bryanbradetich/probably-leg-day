"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ExercisePicker } from "@/components/ExercisePicker";
import type { Exercise, WorkoutTemplate, WorkoutTemplateExercise } from "@/types";

const DAYS = [
  { value: null as number | null, label: "No day" },
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type TemplateExerciseEntry = {
  id?: string;
  exercise: Exercise;
  target_sets: number;
  target_reps: number | null;
  target_duration_seconds: number | null;
  target_rest_seconds: number;
  notes: string;
};

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [userId, setUserId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [entries, setEntries] = useState<TemplateExerciseEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);

      const [exRes, tRes] = await Promise.all([
        supabase.from("exercises").select("*").order("name"),
        supabase
          .from("workout_templates")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .single(),
      ]);

      const template = tRes.data as WorkoutTemplate | null;
      if (!template || tRes.error) {
        router.replace("/workouts/templates");
        return;
      }

      setName(template.name);
      setDescription(template.description ?? "");
      setDayOfWeek(template.day_of_week ?? null);
      setExercises((exRes.data as Exercise[]) ?? []);

      const { data: teRows } = await supabase
        .from("workout_template_exercises")
        .select("*, exercises(*)")
        .eq("template_id", id)
        .order("order_index");

      const list = (teRows ?? []).map((row: WorkoutTemplateExercise & { exercises: Exercise }) => ({
        id: row.id,
        exercise: row.exercises,
        target_sets: row.target_sets,
        target_reps: row.target_reps,
        target_duration_seconds: row.target_duration_seconds,
        target_rest_seconds: row.target_rest_seconds ?? 0,
        notes: row.notes ?? "",
      }));
      setEntries(list);
      setLoading(false);
    })();
  }, [id, router]);

  function addExercise(exercise: Exercise) {
    setEntries((prev) => [
      ...prev,
      {
        exercise,
        target_sets: 3,
        target_reps: exercise.type === "reps_sets" ? 10 : null,
        target_duration_seconds: exercise.type === "timed" ? 60 : null,
        target_rest_seconds: 90,
        notes: "",
      },
    ]);
    setPickerOpen(false);
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEntry<K extends keyof TemplateExerciseEntry>(
    index: number,
    field: K,
    value: TemplateExerciseEntry[K]
  ) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  }

  function moveEntry(from: number, to: number) {
    if (to < 0 || to >= entries.length) return;
    setEntries((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
    setDraggedIndex(null);
  }

  async function handleSave() {
    if (!userId || !name.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const { error: tErr } = await supabase
      .from("workout_templates")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        day_of_week: dayOfWeek,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (tErr) {
      console.error("Failed to update template", tErr);
      setSaving(false);
      return;
    }

    await supabase
      .from("workout_template_exercises")
      .delete()
      .eq("template_id", id);

    if (entries.length > 0) {
      const rows = entries.map((e, i) => ({
        template_id: id,
        exercise_id: e.exercise.id,
        order_index: i,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        target_duration_seconds: e.target_duration_seconds,
        target_rest_seconds: e.target_rest_seconds,
        notes: e.notes.trim() || null,
      }));
      await supabase.from("workout_template_exercises").insert(rows);
    }
    setSaving(false);
    router.push("/workouts/templates");
  }

  if (loading || userId === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/workouts/templates"
            className="text-zinc-400 hover:text-white"
          >
            ← Templates
          </Link>
          <h1 className="text-2xl font-bold text-white">Edit Template</h1>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Template name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              Day of week
            </label>
            <select
              value={dayOfWeek ?? ""}
              onChange={(e) =>
                setDayOfWeek(e.target.value === "" ? null : Number(e.target.value))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            >
              {DAYS.map((d) => (
                <option key={d.value ?? "none"} value={d.value ?? ""}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">
                Exercises (drag to reorder)
              </label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-lg bg-[#f97316]/20 px-3 py-1.5 text-sm font-medium text-[#f97316] hover:bg-[#f97316]/30"
              >
                Add exercise
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-700 py-8 text-center text-zinc-500">
                No exercises yet. Click “Add exercise” to pick from the library.
              </p>
            ) : (
              <ul className="space-y-3">
                {entries.map((entry, index) => (
                  <li
                    key={entry.id ?? `${entry.exercise.id}-${index}`}
                    draggable
                    onDragStart={() => setDraggedIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex === null) return;
                      if (draggedIndex !== index) moveEntry(draggedIndex, index);
                    }}
                    onDragEnd={() => setDraggedIndex(null)}
                    className={`cursor-grab rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 active:cursor-grabbing ${
                      draggedIndex === index ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-zinc-500">⋮⋮</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">
                          {entry.exercise.name}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="text-xs text-zinc-500">
                              Target sets
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={entry.target_sets}
                              onChange={(e) =>
                                updateEntry(
                                  index,
                                  "target_sets",
                                  Math.max(1, parseInt(e.target.value, 10) || 1)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                            />
                          </div>
                          {entry.exercise.type === "reps_sets" ? (
                            <div>
                              <label className="text-xs text-zinc-500">
                                Target reps
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={entry.target_reps ?? ""}
                                onChange={(e) =>
                                  updateEntry(
                                    index,
                                    "target_reps",
                                    parseInt(e.target.value, 10) || null
                                  )
                                }
                                className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="text-xs text-zinc-500">
                                Target duration (sec)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={entry.target_duration_seconds ?? ""}
                                onChange={(e) =>
                                  updateEntry(
                                    index,
                                    "target_duration_seconds",
                                    parseInt(e.target.value, 10) || null
                                  )
                                }
                                className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                              />
                            </div>
                          )}
                          <div>
                            <label className="text-xs text-zinc-500">
                              Rest (sec)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={entry.target_rest_seconds}
                              onChange={(e) =>
                                updateEntry(
                                  index,
                                  "target_rest_seconds",
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                            />
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="text-xs text-zinc-500">Notes</label>
                          <input
                            type="text"
                            value={entry.notes}
                            onChange={(e) =>
                              updateEntry(index, "notes", e.target.value)
                            }
                            placeholder="Optional"
                            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEntry(index)}
                        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-3">
            <Link
              href="/workouts/templates"
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 py-2.5 text-center text-sm font-medium text-zinc-300 hover:bg-zinc-700"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-[#f97316] py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ea580c] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save template"}
            </button>
          </div>
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
                onSelect={addExercise}
                excludeIds={entries.map((e) => e.exercise.id)}
                onClose={() => setPickerOpen(false)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
