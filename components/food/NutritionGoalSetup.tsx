"use client";

import { useMemo, useState } from "react";
import type { NutritionGoal } from "@/types";
import { formatGrams, goalMacroGrams } from "@/lib/food-helpers";

const COLORS = {
  protein: "var(--macro-protein)",
  carbs: "var(--macro-carbs)",
  fat: "var(--macro-fat)",
} as const;

export type NutritionGoalSavePayload = {
  daily_calories: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
};

type Props = {
  goal: NutritionGoal | null;
  saving: boolean;
  onSave: (p: NutritionGoalSavePayload) => void;
  compact?: boolean;
  onEditRequest?: () => void;
  onCancel?: () => void;
};

export function NutritionGoalSetup({
  goal,
  saving,
  onSave,
  compact,
  onEditRequest,
  onCancel,
}: Props) {
  const [calories, setCalories] = useState(() =>
    goal ? String(Math.round(Number(goal.daily_calories))) : "2000"
  );
  const [pPct, setPPct] = useState(() => (goal ? Number(goal.protein_pct) : 30));
  const [cPct, setCPct] = useState(() => (goal ? Number(goal.carbs_pct) : 40));
  const [fPct, setFPct] = useState(() => (goal ? Number(goal.fat_pct) : 30));

  const sum = pPct + cPct + fPct;
  const sumOk = Math.abs(sum - 100) < 0.01;

  const grams = useMemo(() => {
    const c = parseFloat(calories);
    if (!Number.isFinite(c) || c <= 0) return null;
    return goalMacroGrams({
      daily_calories: c,
      protein_pct: pPct,
      carbs_pct: cPct,
      fat_pct: fPct,
    });
  }, [calories, pPct, cPct, fPct]);

  const handleSave = () => {
    const c = parseFloat(calories);
    if (!Number.isFinite(c) || c <= 0) return;
    if (!sumOk) return;
    onSave({
      daily_calories: c,
      protein_pct: pPct,
      carbs_pct: cPct,
      fat_pct: fPct,
    });
  };

  if (compact && goal && onEditRequest) {
    const g = goalMacroGrams(goal);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-theme-border bg-theme-surface/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-theme-text-primary">
          Goal: {Math.round(Number(goal.daily_calories)).toLocaleString()} kcal · P{" "}
          {Number(goal.protein_pct).toFixed(0)}% / C {Number(goal.carbs_pct).toFixed(0)}% / F{" "}
          {Number(goal.fat_pct).toFixed(0)}%
          <span className="ml-2 block text-xs font-medium text-theme-text-muted sm:inline sm:ml-2">
            (~{formatGrams(g.protein_g, 0)}g P · ~{formatGrams(g.carbs_g, 0)}g C · ~{formatGrams(g.fat_g, 0)}g F)
          </span>
        </p>
        <button
          type="button"
          onClick={onEditRequest}
          className="shrink-0 rounded-lg border border-theme-accent/70 bg-theme-accent/10 px-3 py-1.5 text-sm font-medium text-theme-accent-soft hover:bg-theme-accent/20"
        >
          Edit goal
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-theme-accent/40 bg-theme-accent/5 p-5 sm:p-6">
      <h2 className="text-lg font-bold text-theme-text-primary">Set your nutrition goal</h2>
      <p className="mt-1 text-sm text-theme-text-muted">
        Daily calorie target and macro split (percentages must total 100%).
      </p>

      <label className="mt-6 block text-sm font-medium text-theme-text-muted">Daily calorie target</label>
      <input
        type="number"
        min={1}
        step={50}
        value={calories}
        onChange={(e) => setCalories(e.target.value)}
        className="mt-2 h-12 w-full max-w-xs rounded-xl border-2 border-theme-border bg-theme-input-bg px-4 text-lg font-bold tabular-nums text-theme-text-primary outline-none focus:border-theme-accent"
      />

      <div className="mt-8 space-y-6">
        <div>
          <div className="flex justify-between text-sm">
            <span className="font-medium" style={{ color: COLORS.protein }}>
              Protein
            </span>
            <span className="tabular-nums text-theme-text-muted">{pPct.toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pPct}
            onChange={(e) => setPPct(Number(e.target.value))}
            className="mt-2 h-3 w-full accent-[color:var(--macro-protein)]"
          />
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="font-medium" style={{ color: COLORS.carbs }}>
              Carbs
            </span>
            <span className="tabular-nums text-theme-text-muted">{cPct.toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={cPct}
            onChange={(e) => setCPct(Number(e.target.value))}
            className="mt-2 h-3 w-full accent-[color:var(--macro-carbs)]"
          />
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="font-medium" style={{ color: COLORS.fat }}>
              Fat
            </span>
            <span className="tabular-nums text-theme-text-muted">{fPct.toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={fPct}
            onChange={(e) => setFPct(Number(e.target.value))}
            className="mt-2 h-3 w-full accent-[color:var(--macro-fat)]"
          />
        </div>
      </div>

      <p
        className={`mt-4 text-sm font-semibold ${sumOk ? "text-theme-text-muted" : "text-theme-danger"}`}
      >
        Macro total: {sum.toFixed(0)}%{!sumOk && " — must equal 100%"}
      </p>

      {grams && sumOk && (
        <ul className="mt-4 space-y-1 text-sm font-bold text-theme-text-primary">
          <li style={{ color: COLORS.protein }}>
            Protein: {pPct.toFixed(0)}% ≈ {formatGrams(grams.protein_g, 0)}g per day
          </li>
          <li style={{ color: COLORS.carbs }}>
            Carbs: {cPct.toFixed(0)}% ≈ {formatGrams(grams.carbs_g, 0)}g per day
          </li>
          <li style={{ color: COLORS.fat }}>
            Fat: {fPct.toFixed(0)}% ≈ {formatGrams(grams.fat_g, 0)}g per day
          </li>
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {goal && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-theme-border/80 px-6 py-3 text-sm font-semibold text-theme-text-muted"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !sumOk}
          className="rounded-xl bg-theme-accent px-6 py-3 text-sm font-bold text-theme-on-accent disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save goal"}
        </button>
      </div>
    </div>
  );
}
