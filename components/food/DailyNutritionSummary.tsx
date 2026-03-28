"use client";

import type { NutritionGoal } from "@/types";
import { formatKcal, goalMacroGrams, macroCaloriePercents } from "@/lib/food-helpers";

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
        <span className="font-bold text-theme-text-primary">{label}</span>
        <span className={`font-bold tabular-nums ${over ? "text-theme-danger" : "text-theme-text-primary/90"}`}>
          {unit === "g" ? consumed.toFixed(0) : formatKcal(consumed)}
          {unit === "g" ? "g" : " kcal"} · {pct.toFixed(0)}% of goal
          {over && <span className="ml-1 text-theme-danger">({((consumed / goal) * 100 - 100).toFixed(0)}% over)</span>}
        </span>
      </div>
      <div className="mt-1.5 h-4 w-full overflow-hidden rounded-md bg-theme-border/90">
        <div
          className="h-full rounded-md transition-all"
          style={{
            width: `${width}%`,
            backgroundColor: over ? "var(--danger)" : color,
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
  const actualMacroPct = macroCaloriePercents(
    totals.calories,
    totals.protein_g,
    totals.carbs_g,
    totals.fat_g
  );
  const goalProtPct = Math.round(Number(goal.protein_pct));
  const goalCarbPct = Math.round(Number(goal.carbs_pct));
  const goalFatPct = Math.round(Number(goal.fat_pct));

  return (
    <div className="sticky top-14 z-30 space-y-5 rounded-xl border border-theme-border bg-theme-bg/95 p-4 shadow-lg backdrop-blur sm:p-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-theme-text-muted">Calories</span>
          <span className={`text-lg font-bold tabular-nums sm:text-xl ${calOver ? "text-theme-danger" : "text-theme-text-primary"}`}>
            {formatKcal(totals.calories)} / {formatKcal(calGoal)} kcal
            {!calOver && remaining >= 0 && (
              <span className="ml-2 text-base font-bold text-theme-text-muted">· {formatKcal(remaining)} remaining</span>
            )}
            {calOver && (
              <span className="ml-2 text-base font-bold text-theme-danger">
                · {formatKcal(totals.calories - calGoal)} over goal
              </span>
            )}
          </span>
        </div>
        <div className="mt-2 h-5 w-full overflow-hidden rounded-md bg-theme-border/90">
          <div
            className="h-full rounded-md transition-all"
            style={{
              width: `${calGoal > 0 ? Math.min(100, (totals.calories / calGoal) * 100) : 0}%`,
              backgroundColor: calOver ? "var(--danger)" : "var(--accent)",
              minWidth: totals.calories > 0 ? "6px" : undefined,
            }}
          />
        </div>
        {!calOver && calPct >= 99 && calPct < 100 && (
          <p className="mt-1 text-xs font-medium text-theme-macro-carbs">Almost at your calorie goal</p>
        )}
      </div>

      {actualMacroPct && (
        <p className="text-xs leading-relaxed text-theme-text-muted sm:text-sm">
          <span className="font-bold uppercase tracking-wide text-theme-text-muted">Macro split</span>
          <span className="ml-2">
            <span className="font-bold text-theme-macro-protein">P {actualMacroPct.protein}%</span>
            <span className="font-medium text-theme-text-muted"> (goal {goalProtPct}%)</span>
            <span className="text-theme-text-muted/80"> · </span>
            <span className="font-bold text-theme-macro-carbs">C {actualMacroPct.carbs}%</span>
            <span className="font-medium text-theme-text-muted"> (goal {goalCarbPct}%)</span>
            <span className="text-theme-text-muted/80"> · </span>
            <span className="font-bold text-theme-accent">F {actualMacroPct.fat}%</span>
            <span className="font-medium text-theme-text-muted"> (goal {goalFatPct}%)</span>
          </span>
        </p>
      )}

      <div className="space-y-4">
        <Bar label="Protein" consumed={totals.protein_g} goal={g.protein_g} color="var(--macro-protein)" />
        <Bar label="Carbs" consumed={totals.carbs_g} goal={g.carbs_g} color="var(--macro-carbs)" />
        <Bar label="Fat" consumed={totals.fat_g} goal={g.fat_g} color="var(--macro-fat)" />
      </div>
    </div>
  );
}
