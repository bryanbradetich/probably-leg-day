"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ExercisePicker } from "@/components/ExercisePicker";
import type { Exercise, WorkoutTemplate } from "@/types";

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
  exercise: Exercise;
  target_sets: number;
  target_reps: number | null;
  target_duration_seconds: number | null;
  target_rest_seconds: number;
  notes: string;
};

function NewTemplatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mesocycleIdFromQuery = searchParams.get("mesocycle_id");
  const [userId, setUserId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [entries, setEntries] = useState<TemplateExerciseEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
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
      const { data } = await supabase.from("exercises").select("*").order("name");
      setExercises((data as Exercise[]) ?? []);
    })();
  }, [router]);

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
    const { data: template, error: tErr } = await supabase
      .from("workout_templates")
      .insert({
        user_id: userId,
        mesocycle_id: mesocycleIdFromQuery || null,
        name: name.trim(),
        description: description.trim() || null,
        day_of_week: dayOfWeek,
      })
      .select()
      .single();

    if (tErr || !template) {
      console.error("Failed to create template", tErr);
      setSaving(false);
      return;
    }

    if (entries.length > 0) {
      const rows = entries.map((e, i) => ({
        template_id: (template as WorkoutTemplate).id,
        exercise_id: e.exercise.id,
        order_index: i,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        target_duration_seconds: e.target_duration_seconds,
        target_rest_seconds: e.target_rest_seconds,
        notes: e.notes.trim() || null,
      }));
      const { error: eErr } = await supabase
        .from("workout_template_exercises")
        .insert(rows);
      if (eErr) {
        console.error("Failed to add template exercises", eErr);
      }
    }
    setSaving(false);
    if (mesocycleIdFromQuery) {
      router.push(`/mesocycles/${mesocycleIdFromQuery}`);
    } else {
      router.push("/workouts/templates");
    }
  }

  if (userId === null) return null;

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href={mesocycleIdFromQuery ? `/mesocycles/${mesocycleIdFromQuery}` : "/workouts/templates"}
            className="text-theme-text-muted hover:text-theme-text-primary"
          >
            ← {mesocycleIdFromQuery ? "Mesocycle" : "Templates"}
          </Link>
          <h1 className="text-2xl font-bold text-theme-text-primary">New Template</h1>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-text-muted">
              Template name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day"
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-text-muted">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional"
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-text-muted">
              Day of week
            </label>
            <select
              value={dayOfWeek ?? ""}
              onChange={(e) =>
                setDayOfWeek(e.target.value === "" ? null : Number(e.target.value))
              }
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
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
              <label className="text-sm font-medium text-theme-text-muted">
                Exercises (drag to reorder)
              </label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-lg bg-theme-accent/20 px-3 py-1.5 text-sm font-medium text-theme-accent hover:bg-theme-accent/30"
              >
                Add exercise
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-theme-border py-8 text-center text-theme-text-muted">
                No exercises yet. Click “Add exercise” to pick from the library.
              </p>
            ) : (
              <ul className="space-y-3">
                {entries.map((entry, index) => (
                  <li
                    key={`${entry.exercise.id}-${index}`}
                    draggable
                    onDragStart={() => setDraggedIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex === null) return;
                      if (draggedIndex !== index) moveEntry(draggedIndex, index);
                    }}
                    onDragEnd={() => setDraggedIndex(null)}
                    className={`cursor-grab rounded-xl border border-theme-border bg-theme-surface/50 p-4 active:cursor-grabbing ${
                      draggedIndex === index ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-theme-text-muted">⋮⋮</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-theme-text-primary">
                          {entry.exercise.name}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="text-xs text-theme-text-muted">
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
                              className="mt-0.5 w-full rounded border border-theme-border bg-theme-surface px-2 py-1.5 text-sm text-theme-text-primary"
                            />
                          </div>
                          {entry.exercise.type === "reps_sets" ? (
                            <div>
                              <label className="text-xs text-theme-text-muted">
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
                                className="mt-0.5 w-full rounded border border-theme-border bg-theme-surface px-2 py-1.5 text-sm text-theme-text-primary"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="text-xs text-theme-text-muted">
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
                                className="mt-0.5 w-full rounded border border-theme-border bg-theme-surface px-2 py-1.5 text-sm text-theme-text-primary"
                              />
                            </div>
                          )}
                          <div>
                            <label className="text-xs text-theme-text-muted">
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
                              className="mt-0.5 w-full rounded border border-theme-border bg-theme-surface px-2 py-1.5 text-sm text-theme-text-primary"
                            />
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="text-xs text-theme-text-muted">Notes</label>
                          <input
                            type="text"
                            value={entry.notes}
                            onChange={(e) =>
                              updateEntry(index, "notes", e.target.value)
                            }
                            placeholder="Optional"
                            className="mt-0.5 w-full rounded border border-theme-border bg-theme-surface px-2 py-1.5 text-sm text-theme-text-primary"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEntry(index)}
                        className="rounded p-1 text-theme-text-muted hover:bg-theme-border/90 hover:text-red-400"
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
              href={mesocycleIdFromQuery ? `/mesocycles/${mesocycleIdFromQuery}` : "/workouts/templates"}
              className="flex-1 rounded-lg border border-theme-border/80 bg-theme-border/90 py-2.5 text-center text-sm font-medium text-theme-text-muted hover:bg-theme-border"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-theme-accent py-2.5 text-sm font-semibold text-theme-on-accent hover:bg-theme-accent-hover disabled:opacity-50"
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
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-theme-border bg-theme-bg p-4 shadow-xl">
              <h2 className="mb-4 text-lg font-bold text-theme-text-primary">
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

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-theme-bg flex items-center justify-center text-theme-text-muted">Loading…</div>}>
      <NewTemplatePageContent />
    </Suspense>
  );
}
