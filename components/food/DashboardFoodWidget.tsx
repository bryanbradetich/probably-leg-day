"use client";

import Link from "next/link";
import type { NutritionGoal } from "@/types";
import { formatKcal, goalMacroGrams } from "@/lib/food-helpers";

type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };

function MiniBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const over = value > goal + 0.5;
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-zinc-400">
        <span>{label}</span>
        <span className={over ? "text-[#ef4444]" : "text-zinc-200"}>
          {value.toFixed(0)} / {goal.toFixed(0)}g
        </span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded bg-zinc-800">
        <div
          className="h-full rounded transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: over ? "#ef4444" : color,
            minWidth: value > 0 ? "3px" : undefined,
          }}
        />
      </div>
    </div>
  );
}

export function DashboardFoodWidget({
  goal,
  totals,
}: {
  goal: NutritionGoal;
  totals: Totals;
}) {
  const calGoal = Number(goal.daily_calories);
  const g = goalMacroGrams(goal);
  const calOver = totals.calories > calGoal + 0.5;
  const calPct = calGoal > 0 ? Math.min(100, (totals.calories / calGoal) * 100) : 0;

  return (
    <Link
      href="/food"
      className="mt-6 block rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-[#f97316]/60 hover:bg-zinc-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Food today</h2>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${calOver ? "text-[#ef4444]" : "text-white"}`}>
            {formatKcal(totals.calories)}{" "}
            <span className="text-base font-semibold text-zinc-500">/ {formatKcal(calGoal)} kcal</span>
          </p>
        </div>
      </div>
      <div className="mt-3 h-4 overflow-hidden rounded-md bg-zinc-800">
        <div
          className="h-full rounded-md"
          style={{
            width: `${calPct}%`,
            backgroundColor: calOver ? "#ef4444" : "#f97316",
            minWidth: totals.calories > 0 ? "4px" : undefined,
          }}
        />
      </div>
      <div className="mt-4 space-y-3">
        <MiniBar label="Protein" value={totals.protein_g} goal={g.protein_g} color="#3b82f6" />
        <MiniBar label="Carbs" value={totals.carbs_g} goal={g.carbs_g} color="#eab308" />
        <MiniBar label="Fat" value={totals.fat_g} goal={g.fat_g} color="#f97316" />
      </div>
      <p className="mt-4 text-sm font-medium text-[#f97316]">Log food →</p>
    </Link>
  );
}
