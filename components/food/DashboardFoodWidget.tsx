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
      <div className="flex justify-between text-xs font-bold text-theme-text-muted">
        <span>{label}</span>
        <span className={over ? "text-theme-danger" : "text-theme-text-primary/90"}>
          {value.toFixed(0)} / {goal.toFixed(0)}g
        </span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded bg-theme-border/90">
        <div
          className="h-full rounded transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: over ? "var(--danger)" : color,
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
      className="mt-6 block rounded-xl border border-theme-border bg-theme-surface/50 p-5 transition hover:border-theme-accent/60 hover:bg-theme-surface"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-theme-text-primary">Food today</h2>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${calOver ? "text-theme-danger" : "text-theme-text-primary"}`}>
            {formatKcal(totals.calories)}{" "}
            <span className="text-base font-semibold text-theme-text-muted">/ {formatKcal(calGoal)} kcal</span>
          </p>
        </div>
      </div>
      <div className="mt-3 h-4 overflow-hidden rounded-md bg-theme-border/90">
        <div
          className="h-full rounded-md"
          style={{
            width: `${calPct}%`,
            backgroundColor: calOver ? "var(--danger)" : "var(--accent)",
            minWidth: totals.calories > 0 ? "4px" : undefined,
          }}
        />
      </div>
      <div className="mt-4 space-y-3">
        <MiniBar label="Protein" value={totals.protein_g} goal={g.protein_g} color="var(--macro-protein)" />
        <MiniBar label="Carbs" value={totals.carbs_g} goal={g.carbs_g} color="var(--macro-carbs)" />
        <MiniBar label="Fat" value={totals.fat_g} goal={g.fat_g} color="var(--macro-fat)" />
      </div>
      <p className="mt-4 text-sm font-medium text-theme-accent">Log food →</p>
    </Link>
  );
}
