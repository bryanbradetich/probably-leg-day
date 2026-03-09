"use client";

import { useMemo, useState } from "react";
import type { Exercise, EquipmentType, ExerciseType } from "@/types";

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

function formatEquipment(e: EquipmentType | null): string {
  if (!e) return "—";
  return e.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface ExercisePickerProps {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  excludeIds?: string[];
  onClose?: () => void;
}

export function ExercisePicker({
  exercises,
  onSelect,
  excludeIds = [],
  onClose,
}: ExercisePickerProps) {
  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<"" | EquipmentType>("");
  const [muscleGroupFilter, setMuscleGroupFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ExerciseType>("");

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      if (excludeIds.includes(ex.id)) return false;
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
  }, [exercises, search, equipmentFilter, muscleGroupFilter, typeFilter, excludeIds]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
        />
        <select
          value={equipmentFilter}
          onChange={(e) =>
            setEquipmentFilter((e.target.value || "") as "" | EquipmentType)
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
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
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
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
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-zinc-500">
        {filtered.length} exercise{filtered.length !== 1 ? "s" : ""} — click to add
      </p>
      <ul className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50">
        {filtered.length === 0 ? (
          <li className="px-4 py-6 text-center text-zinc-500">
            No exercises match. Try different filters.
          </li>
        ) : (
          filtered.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => onSelect(ex)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-zinc-800/80"
              >
                <span className="font-medium text-white">{ex.name}</span>
                <span className="text-zinc-500">
                  {ex.equipment ? formatEquipment(ex.equipment) : "—"} ·{" "}
                  {ex.type === "reps_sets" ? "Reps/sets" : "Timed"}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
        >
          Close
        </button>
      )}
    </div>
  );
}
