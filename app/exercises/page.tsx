"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, EquipmentType, ExerciseType } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

const EQUIPMENT_OPTIONS: { value: "" | EquipmentType; label: string }[] = [
  { value: "", label: "All" },
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "smith_machine", label: "Smith Machine" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "resistance_band", label: "Resistance Band" },
  { value: "kettlebell", label: "Kettlebell" },
];

const MUSCLE_GROUP_OPTIONS = [
  { value: "", label: "All" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "quadriceps", label: "Quadriceps" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "glutes", label: "Glutes" },
  { value: "core", label: "Core" },
  { value: "calves", label: "Calves" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "reps_sets", label: "Strength (reps/sets)" },
  { value: "timed", label: "Timed" },
];

const EQUIPMENT_BADGE_STYLES: Record<EquipmentType, string> = {
  barbell: "bg-red-500/15 text-red-300 border border-red-500/40",
  dumbbell: "bg-blue-500/15 text-blue-300 border border-blue-500/40",
  cable: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/40",
  machine: "bg-purple-500/15 text-purple-300 border border-purple-500/40",
  smith_machine: "bg-pink-500/15 text-pink-300 border border-pink-500/40",
  bodyweight: "bg-green-500/15 text-green-300 border border-green-500/40",
  resistance_band: "bg-orange-500/15 text-orange-300 border border-orange-500/40",
  kettlebell: "bg-teal-500/15 text-teal-300 border border-teal-500/40",
};

const TYPE_BADGE_STYLES: Record<ExerciseType, string> = {
  reps_sets: "bg-blue-500/15 text-blue-300 border border-blue-500/40",
  timed: "bg-orange-500/15 text-orange-300 border border-orange-500/40",
};

export default function ExercisesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<"" | EquipmentType>("");
  const [muscleGroupFilter, setMuscleGroupFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ExerciseType>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      supabase
        .from("exercises")
        .select("id, name, description, type, muscle_groups, equipment, weight_logging, is_unilateral, is_public, created_by, created_at")
        .order("name")
        .then(({ data, error: err }) => {
          if (err) {
            setError("Could not load exercises. Please try again.");
            setExercises([]);
          } else {
            setError(null);
            setExercises(data ?? []);
          }
          setLoading(false);
        });
    });
  }, [router]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const nameMatch =
        !search.trim() ||
        ex.name.toLowerCase().includes(search.trim().toLowerCase());
      const equipmentMatch = !equipmentFilter || ex.equipment === equipmentFilter;
      const muscleMatch =
        !muscleGroupFilter ||
        ex.muscle_groups?.some(
          (mg) => mg.toLowerCase() === muscleGroupFilter.toLowerCase()
        );
      const typeMatch = !typeFilter || ex.type === typeFilter;
      return nameMatch && equipmentMatch && muscleMatch && typeMatch;
    });
  }, [exercises, search, equipmentFilter, muscleGroupFilter, typeFilter]);

  const selectedExercise = selectedExerciseId
    ? exercises.find((ex) => ex.id === selectedExerciseId) ?? null
    : null;

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text-primary">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error} retry={() => window.location.reload()} backHref="/dashboard" backLabel="Dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
        <>
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
            <PageHeader title="Exercise Library" description="Browse the exercise library." />

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
              />
              <select
                value={equipmentFilter}
                onChange={(e) =>
                  setEquipmentFilter((e.target.value || "") as "" | EquipmentType)
                }
                className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
              >
                {EQUIPMENT_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={muscleGroupFilter}
                onChange={(e) => setMuscleGroupFilter(e.target.value)}
                className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
              >
                {MUSCLE_GROUP_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter((e.target.value || "") as "" | ExerciseType)
                }
                className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
          </select>
            </div>

            <p className="mt-4 text-xs text-theme-text-muted">
              Showing{" "}
              <span className="font-medium text-theme-text-primary/90">
                {filtered.length}
              </span>{" "}
              {filtered.length === 1 ? "exercise" : "exercises"}
            </p>

            <ul className="mt-3 space-y-2">
              {filtered.map((ex) => (
                <li
                  key={ex.id}
                  className="flex items-center gap-3 rounded-lg border border-theme-border bg-theme-surface/50 px-4 py-3 transition hover:border-theme-accent/60 hover:bg-theme-surface"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedExerciseId(ex.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-theme-text-primary">
                          {ex.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {ex.equipment && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium capitalize ${
                                EQUIPMENT_BADGE_STYLES[ex.equipment]
                              }`}
                            >
                              {ex.equipment.replace("_", " ")}
                            </span>
                          )}
                          {ex.muscle_groups?.map((mg) => (
                            <span
                              key={mg}
                              className="inline-flex items-center rounded-full bg-theme-border/90 px-2 py-0.5 font-medium text-theme-text-primary/90"
                            >
                              <span className="capitalize">{mg}</span>
                            </span>
                          ))}
                          {ex.type && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                                TYPE_BADGE_STYLES[ex.type]
                              }`}
                            >
                              {ex.type === "timed" ? "Timed" : "Reps/Sets"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedExerciseId(ex.id)}
                    className="rounded bg-theme-accent px-3 py-1.5 text-sm font-medium text-theme-on-accent transition hover:bg-theme-accent-hover"
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
            {exercises.length === 0 && (
              <div className="mt-8">
                <EmptyState
                  title="No exercises in the library"
                  description="Exercises will appear here once added."
                  actionHref="/dashboard"
                  actionLabel="Back to Dashboard"
                />
              </div>
            )}
            {exercises.length > 0 && filtered.length === 0 && (
              <div className="mt-8 rounded-xl border border-dashed border-theme-border py-8 text-center text-theme-text-muted">
                No exercises match your filters. Try different search or filters.
              </div>
            )}
          </div>

          {/* Exercise detail panel */}
          {selectedExercise && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/60"
                aria-hidden
                onClick={() => setSelectedExerciseId(null)}
              />
              <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="exercise-detail-title"
                className="fixed inset-0 z-50 h-full w-full border-l border-theme-border bg-theme-bg shadow-xl sm:inset-[auto_0_0_0_auto] sm:left-auto sm:max-w-md"
              >
                <div className="flex h-full flex-col p-6">
                  <div className="flex items-center justify-between border-b border-theme-border pb-4">
                    <h2 id="exercise-detail-title" className="text-xl font-bold text-theme-text-primary">
                      {selectedExercise.name}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSelectedExerciseId(null)}
                      className="rounded p-2 text-theme-text-muted transition hover:bg-theme-border/90 hover:text-theme-text-primary"
                      aria-label="Close panel"
                    >
                      <span className="text-xl leading-none">×</span>
                    </button>
                  </div>
                  <div className="mt-4 flex-1 space-y-4 overflow-y-auto text-theme-text-muted">
                    {selectedExercise.description && (
                      <div>
                        <h3 className="text-sm font-medium text-theme-text-muted">Description</h3>
                        <p className="mt-1">{selectedExercise.description}</p>
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-medium text-theme-text-muted">Type</h3>
                      <p className="mt-1 capitalize">
                        {selectedExercise.type?.replace("_", " ") ?? "—"}
                      </p>
                    </div>
                    {selectedExercise.equipment && (
                      <div>
                        <h3 className="text-sm font-medium text-theme-text-muted">Equipment</h3>
                        <p className="mt-1 capitalize">
                          {selectedExercise.equipment.replace("_", " ")}
                        </p>
                      </div>
                    )}
                    {selectedExercise.muscle_groups?.length ? (
                      <div>
                        <h3 className="text-sm font-medium text-theme-text-muted">Muscle groups</h3>
                        <p className="mt-1 capitalize">
                          {selectedExercise.muscle_groups.join(", ")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>
            </>
          )}
        </>
    </div>
  );
}
