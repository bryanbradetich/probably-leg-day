"use client";

import type { NutritionGoal } from "@/types";
import { formatKcal, goalMacroGrams } from "@/lib/food-helpers";

type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };

function Bar({
  label,
  consumed,
  goal,
  color,
  unit = "g",
}: {
  label: string;
  consumed: number;
  goal: number;
  color: string;
  unit?: string;
}) {
  const pct = goal > 0 ? (consumed / goal) * 100 : 0;
  const over = consumed > goal + 0.01;
  const width = goal > 0 ? Math.min(100, pct) : 0;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-1 text-sm">
        <span className="font-bold text-white">{label}</span>
        <span className={`font-bold tabular-nums ${over ? "text-[#ef4444]" : "text-zinc-200"}`}>
          {unit === "g" ? consumed.toFixed(0) : formatKcal(consumed)}
          {unit === "g" ? "g" : " kcal"} · {pct.toFixed(0)}% of goal
          {over && <span className="ml-1 text-[#ef4444]">({((consumed / goal) * 100 - 100).toFixed(0)}% over)</span>}
        </span>
      </div>
      <div className="mt-1.5 h-4 w-full overflow-hidden rounded-md bg-zinc-800">
        <div
          className="h-full rounded-md transition-all"
          style={{
            width: `${width}%`,
            backgroundColor: over ? "#ef4444" : color,
            minWidth: consumed > 0 ? "4px" : undefined,
          }}
        />
      </div>
    </div>
  );
}

export function DailyNutritionSummary({
  totals,
  goal,
}: {
  totals: Totals;
  goal: NutritionGoal;
}) {
  const calGoal = Number(goal.daily_calories);
  const g = goalMacroGrams(goal);
  const calOver = totals.calories > calGoal + 0.5;
  const calPct = calGoal > 0 ? Math.min(100, (totals.calories / calGoal) * 100) : 0;
  const remaining = calGoal - totals.calories;

  return (
    <div className="sticky top-14 z-30 space-y-5 rounded-xl border border-zinc-800 bg-[#0a0a0a]/95 p-4 shadow-lg backdrop-blur sm:p-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-zinc-500">Calories</span>
          <span className={`text-lg font-bold tabular-nums sm:text-xl ${calOver ? "text-[#ef4444]" : "text-white"}`}>
            {formatKcal(totals.calories)} / {formatKcal(calGoal)} kcal
            {!calOver && remaining >= 0 && (
              <span className="ml-2 text-base font-bold text-zinc-400">· {formatKcal(remaining)} remaining</span>
            )}
            {calOver && (
              <span className="ml-2 text-base font-bold text-[#ef4444]">
                · {formatKcal(totals.calories - calGoal)} over goal
              </span>
            )}
          </span>
        </div>
        <div className="mt-2 h-5 w-full overflow-hidden rounded-md bg-zinc-800">
          <div
            className="h-full rounded-md transition-all"
            style={{
              width: `${calGoal > 0 ? Math.min(100, (totals.calories / calGoal) * 100) : 0}%`,
              backgroundColor: calOver ? "#ef4444" : "#f97316",
              minWidth: totals.calories > 0 ? "6px" : undefined,
            }}
          />
        </div>
        {!calOver && calPct >= 99 && calPct < 100 && (
          <p className="mt-1 text-xs font-medium text-[#eab308]">Almost at your calorie goal</p>
        )}
      </div>

      <div className="space-y-4">
        <Bar label="Protein" consumed={totals.protein_g} goal={g.protein_g} color="#3b82f6" />
        <Bar label="Carbs" consumed={totals.carbs_g} goal={g.carbs_g} color="#eab308" />
        <Bar label="Fat" consumed={totals.fat_g} goal={g.fat_g} color="#f97316" />
      </div>
    </div>
  );
}
