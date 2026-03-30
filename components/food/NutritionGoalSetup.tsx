"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { NutritionGoal, WeightGoal } from "@/types";
import { formatGrams, formatKcal, goalMacroGrams } from "@/lib/food-helpers";
import {
  calculateDailyDeficit,
  getDynamicCaloricTarget,
  isActiveLossWeightGoal,
  nutritionCalorieMode,
  weeklyLossLbsFromWeightGoal,
} from "@/lib/calories";
import { formatLossDescription } from "@/lib/weight-helpers";

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
  calorie_mode: "static" | "dynamic";
  daily_deficit_surplus: number;
};

export type NutritionCalorieContext = {
  tdee: number | null;
  additionalBurns: number;
  weightGoal: WeightGoal | null;
  currentWeightKg: number | null;
  selectedDate: string;
};

type Props = {
  goal: NutritionGoal | null;
  saving: boolean;
  onSave: (p: NutritionGoalSavePayload) => void;
  compact?: boolean;
  onEditRequest?: () => void;
  onCancel?: () => void;
  /** When set (e.g. on food log), used for dynamic previews and summary copy */
  calorieContext?: NutritionCalorieContext | null;
};

const OFFSET_PRESETS = [-750, -500, -250, 0, 250, 500] as const;

function roundInputCalories(n: number): number {
  return Math.round(Math.max(0, n));
}

export function NutritionGoalSetup({
  goal,
  saving,
  onSave,
  compact,
  onEditRequest,
  onCancel,
  calorieContext,
}: Props) {
  const [calorieMode, setCalorieMode] = useState<"static" | "dynamic">(() =>
    goal ? nutritionCalorieMode(goal) : "dynamic"
  );
  const [calories, setCalories] = useState(() =>
    goal ? String(Math.round(Number(goal.daily_calories))) : "2000"
  );
  const [offset, setOffset] = useState(() => String(Math.round(Number(goal?.daily_deficit_surplus ?? 0))));
  const [pPct, setPPct] = useState(() => (goal ? Number(goal.protein_pct) : 30));
  const [cPct, setCPct] = useState(() => (goal ? Number(goal.carbs_pct) : 40));
  const [fPct, setFPct] = useState(() => (goal ? Number(goal.fat_pct) : 30));

  useEffect(() => {
    if (!goal) return;
    setCalorieMode(nutritionCalorieMode(goal));
    setCalories(String(Math.round(Number(goal.daily_calories))));
    setOffset(String(Math.round(Number(goal.daily_deficit_surplus ?? 0))));
    setPPct(Number(goal.protein_pct));
    setCPct(Number(goal.carbs_pct));
    setFPct(Number(goal.fat_pct));
  }, [goal]);

  const sum = pPct + cPct + fPct;
  const sumOk = Math.abs(sum - 100) < 0.01;

  const activeLossGoal =
    calorieContext?.weightGoal && isActiveLossWeightGoal(calorieContext.weightGoal, calorieContext.currentWeightKg)
      ? calorieContext.weightGoal
      : null;

  const previewCaloriesBase = useMemo(() => {
    const c = parseFloat(calories);
    if (!Number.isFinite(c) || c <= 0) return null;
    return c;
  }, [calories]);

  const syntheticGoalForMacros = useMemo((): Pick<
    NutritionGoal,
    "daily_calories" | "protein_pct" | "carbs_pct" | "fat_pct"
  > | null => {
    if (!previewCaloriesBase || !sumOk) return null;
    if (calorieMode === "static") {
      return {
        daily_calories: previewCaloriesBase,
        protein_pct: pPct,
        carbs_pct: cPct,
        fat_pct: fPct,
      };
    }
    const tdee = calorieContext?.tdee;
    if (tdee == null || !Number.isFinite(tdee) || tdee <= 0) {
      return {
        daily_calories: previewCaloriesBase,
        protein_pct: pPct,
        carbs_pct: cPct,
        fat_pct: fPct,
      };
    }
    const off = parseFloat(offset);
    const safeOff = Number.isFinite(off) ? off : 0;
    const ng: NutritionGoal = {
      id: "",
      user_id: "",
      daily_calories: previewCaloriesBase,
      protein_pct: pPct,
      carbs_pct: cPct,
      fat_pct: fPct,
      calorie_mode: "dynamic",
      daily_deficit_surplus: safeOff,
      created_at: "",
      updated_at: "",
    };
    const dyn = getDynamicCaloricTarget({
      TDEE: tdee,
      additionalBurns: calorieContext?.additionalBurns ?? 0,
      activeWeightGoal: activeLossGoal,
      currentWeightKg: calorieContext?.currentWeightKg ?? null,
      nutritionGoal: ng,
    });
    if (!Number.isFinite(dyn) || dyn <= 0) {
      return {
        daily_calories: previewCaloriesBase,
        protein_pct: pPct,
        carbs_pct: cPct,
        fat_pct: fPct,
      };
    }
    return {
      daily_calories: dyn,
      protein_pct: pPct,
      carbs_pct: cPct,
      fat_pct: fPct,
    };
  }, [
    previewCaloriesBase,
    sumOk,
    calorieMode,
    calorieContext?.tdee,
    calorieContext?.additionalBurns,
    calorieContext?.currentWeightKg,
    activeLossGoal,
    pPct,
    cPct,
    fPct,
    offset,
  ]);

  const grams = syntheticGoalForMacros ? goalMacroGrams(syntheticGoalForMacros) : null;

  const handleSave = () => {
    const c = parseFloat(calories);
    if (!Number.isFinite(c) || c <= 0) return;
    if (!sumOk) return;
    const off = parseFloat(offset);
    const safeOff = calorieMode === "dynamic" && !activeLossGoal ? (Number.isFinite(off) ? off : 0) : 0;
    onSave({
      daily_calories: roundInputCalories(c),
      protein_pct: pPct,
      carbs_pct: cPct,
      fat_pct: fPct,
      calorie_mode: calorieMode,
      daily_deficit_surplus: safeOff,
    });
  };

  const weeklyLbs =
    activeLossGoal && calorieContext
      ? weeklyLossLbsFromWeightGoal(activeLossGoal, calorieContext.currentWeightKg)
      : null;
  const dailyFromGoal =
    activeLossGoal && calorieContext ? calculateDailyDeficit(weeklyLbs ?? 0) : null;

  const previewTarget =
    calorieMode === "dynamic" && calorieContext && previewCaloriesBase
      ? getDynamicCaloricTarget({
          TDEE: calorieContext.tdee ?? 0,
          additionalBurns: calorieContext.additionalBurns,
          activeWeightGoal: activeLossGoal,
          currentWeightKg: calorieContext.currentWeightKg,
          nutritionGoal: {
            daily_calories: previewCaloriesBase,
            protein_pct: pPct,
            carbs_pct: cPct,
            fat_pct: fPct,
            calorie_mode: "dynamic",
            daily_deficit_surplus: parseFloat(offset) || 0,
          },
        })
      : null;

  if (compact && goal && onEditRequest) {
    const mode = nutritionCalorieMode(goal);
    const lossActive =
      calorieContext?.weightGoal &&
      isActiveLossWeightGoal(calorieContext.weightGoal, calorieContext.currentWeightKg);
    let effectiveDaily = Number(goal.daily_calories);
    if (mode === "dynamic" && calorieContext?.tdee != null && calorieContext.tdee > 0) {
      effectiveDaily = getDynamicCaloricTarget({
        TDEE: calorieContext.tdee,
        additionalBurns: calorieContext.additionalBurns,
        activeWeightGoal: lossActive ? calorieContext.weightGoal : null,
        currentWeightKg: calorieContext.currentWeightKg,
        nutritionGoal: goal,
      });
    }
    const g = goalMacroGrams({
      ...goal,
      daily_calories: effectiveDaily,
    });
    const calLabel =
      mode === "dynamic"
        ? "Dynamic macro targets scale with today’s calorie target"
        : `${Math.round(Number(goal.daily_calories)).toLocaleString()} kcal/day (static)`;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-theme-border bg-theme-surface/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-theme-text-primary">
          Goal ({mode === "dynamic" ? "dynamic calories" : "static"}): {calLabel} · P{" "}
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
      <p className="mt-1 text-sm text-theme-text-muted">Macro split (percentages must total 100%) and how your calorie target is set.</p>

      <fieldset className="mt-6 space-y-3">
        <legend className="text-sm font-medium text-theme-text-muted">Calorie target mode</legend>
        <label className="flex cursor-pointer gap-3 rounded-xl border border-theme-border p-4" style={{ backgroundColor: "var(--surface)" }}>
          <input
            type="radio"
            name="calorie_mode"
            className="mt-1"
            checked={calorieMode === "dynamic"}
            onChange={() => setCalorieMode("dynamic")}
          />
          <div>
            <p className="font-bold text-theme-text-primary">Dynamic (recommended)</p>
            <p className="mt-1 text-sm text-theme-text-muted">
              Target adjusts daily based on your burns and weight goal (or a manual offset if you have no weight goal).
            </p>
          </div>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-xl border border-theme-border p-4" style={{ backgroundColor: "var(--surface)" }}>
          <input
            type="radio"
            name="calorie_mode"
            className="mt-1"
            checked={calorieMode === "static"}
            onChange={() => setCalorieMode("static")}
          />
          <div>
            <p className="font-bold text-theme-text-primary">Static</p>
            <p className="mt-1 text-sm text-theme-text-muted">Fixed calorie target regardless of activity.</p>
          </div>
        </label>
      </fieldset>

      {calorieMode === "dynamic" && (
        <div className="mt-6 space-y-4">
          {!calorieContext && (
            <p className="text-sm text-theme-text-muted">
              Open this page while logged in to preview TDEE-based targets using your profile and weight logs.
            </p>
          )}
          {calorieContext && activeLossGoal && weeklyLbs != null && dailyFromGoal != null && (
            <div
              className="space-y-3 rounded-xl border border-theme-border p-4 text-sm"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <p className="font-bold text-theme-text-primary">Your calorie target is calculated from your weight goal</p>
              <p className="text-theme-text-muted">
                Current weight goal:{" "}
                <span className="font-semibold text-theme-text-primary">
                  {formatLossDescription(activeLossGoal)} (~{weeklyLbs.toFixed(2)} lb/week)
                </span>
              </p>
              <p className="text-theme-text-muted">
                Daily deficit:{" "}
                <span
                  className="font-bold tabular-nums"
                  style={{ color: dailyFromGoal < 0 ? "var(--success)" : "var(--warning)" }}
                >
                  {formatKcal(dailyFromGoal)} kcal
                </span>
              </p>
              {calorieContext.tdee != null && calorieContext.tdee > 0 && previewTarget != null && (
                <p className="leading-relaxed text-theme-text-primary">
                  Today&apos;s target = TDEE ({formatKcal(calorieContext.tdee)} kcal) + Extra burns (
                  {formatKcal(calorieContext.additionalBurns)} kcal)
                  {dailyFromGoal < 0 ? (
                    <>
                      {" "}
                      − Deficit ({formatKcal(Math.abs(dailyFromGoal))} kcal)
                    </>
                  ) : (
                    <>
                      {" "}
                      + Surplus ({formatKcal(dailyFromGoal)} kcal)
                    </>
                  )}{" "}
                  = <span className="font-bold tabular-nums">{formatKcal(previewTarget)} kcal</span>
                </p>
              )}
              <Link
                href="/weight"
                className="inline-block text-sm font-semibold text-theme-accent hover:underline"
              >
                Weight goal settings →
              </Link>
            </div>
          )}

          {calorieContext && !activeLossGoal && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-theme-text-muted">
                Daily calorie offset from total burn
              </label>
              <p className="text-xs text-theme-text-muted">
                Applied as TDEE + logged extra burns + offset. e.g. −500 to lose ~1 lb/week, +250 to slowly gain.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  step={50}
                  value={offset}
                  onChange={(e) => setOffset(e.target.value)}
                  className="h-12 max-w-[10rem] rounded-xl border-2 border-theme-border bg-theme-input-bg px-4 text-lg font-bold tabular-nums text-theme-text-primary outline-none focus:border-theme-accent"
                />
                <span className="text-sm text-theme-text-muted">kcal</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {OFFSET_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOffset(String(v))}
                    className="rounded-full border border-theme-border bg-transparent px-3 py-1.5 text-sm font-semibold text-theme-text-primary hover:border-theme-accent/60"
                    style={{ backgroundColor: "var(--bg)" }}
                  >
                    {v === 0 ? "0 (maintain)" : v > 0 ? `+${v}` : `${v}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {calorieMode === "static" && (
        <>
          <label className="mt-6 block text-sm font-medium text-theme-text-muted">Daily calorie target</label>
          <input
            type="number"
            min={1}
            step={50}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="mt-2 h-12 w-full max-w-xs rounded-xl border-2 border-theme-border bg-theme-input-bg px-4 text-lg font-bold tabular-nums text-theme-text-primary outline-none focus:border-theme-accent"
          />
        </>
      )}

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

      <p className={`mt-4 text-sm font-semibold ${sumOk ? "text-theme-text-muted" : "text-theme-danger"}`}>
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
