import type { NutritionGoal, WeightGoal } from "@/types";

const CALORIES_PER_LB_FAT = 3500;
/** Match lib/units.ts (unexported constant) for % weekly loss → lbs/week. */
const KG_TO_LBS = 2.20462;

export type CalorieMode = "static" | "dynamic";

export type NutritionGoalForCalories = Pick<
  NutritionGoal,
  "daily_calories" | "protein_pct" | "carbs_pct" | "fat_pct"
> & {
  calorie_mode?: CalorieMode | string | null;
  daily_deficit_surplus?: number | string | null;
};

export type GetDynamicCaloricTargetParams = {
  TDEE: number;
  additionalBurns: number;
  activeWeightGoal: WeightGoal | null;
  /** Body weight in kg for percentage-based weekly loss; omit if unknown. */
  currentWeightKg: number | null;
  nutritionGoal: NutritionGoalForCalories;
};

/**
 * Maps desired weekly body-weight change (lb/week) to daily calorie offset.
 * Pass positive lbs/week when losing weight, negative when gaining.
 * Returns negative kcal/day for deficit, positive for surplus.
 */
export function calculateDailyDeficit(weeklyLossLbs: number): number {
  return -(weeklyLossLbs * CALORIES_PER_LB_FAT) / 7;
}

/** Lbs lost (positive) or gained (negative) per week implied by the goal rule. */
export function weeklyLossLbsFromWeightGoal(goal: WeightGoal, currentWeightKg: number | null): number {
  const rate = Number(goal.weekly_loss_value);
  if (!Number.isFinite(rate)) return 0;
  if (goal.weekly_loss_type === "percentage") {
    if (currentWeightKg == null || !Number.isFinite(currentWeightKg) || currentWeightKg <= 0) return 0;
    const lossKgPerWeek = currentWeightKg * (rate / 100);
    return lossKgPerWeek * KG_TO_LBS;
  }
  const kgPerWeek = rate;
  return kgPerWeek * KG_TO_LBS;
}

/** Goal row exists and user is still above goal weight (losing). */
export function isActiveLossWeightGoal(goal: WeightGoal | null, currentWeightKg: number | null): goal is WeightGoal {
  if (!goal) return false;
  if (currentWeightKg == null || !Number.isFinite(currentWeightKg)) return true;
  return currentWeightKg > Number(goal.goal_weight_kg);
}

export function getDynamicCaloricTarget(params: GetDynamicCaloricTargetParams): number {
  const { TDEE, additionalBurns, activeWeightGoal, currentWeightKg, nutritionGoal } = params;
  const mode = (nutritionGoal.calorie_mode as CalorieMode | undefined) ?? "static";
  if (mode === "static") {
    return Number(nutritionGoal.daily_calories);
  }
  const tdee = Number(TDEE);
  const burns = Number(additionalBurns);
  const safeTdee = Number.isFinite(tdee) ? tdee : 0;
  const safeBurns = Number.isFinite(burns) ? burns : 0;

  const goalForCalc = isActiveLossWeightGoal(activeWeightGoal, currentWeightKg) ? activeWeightGoal : null;
  if (goalForCalc) {
    const weeklyLossLbs = weeklyLossLbsFromWeightGoal(goalForCalc, currentWeightKg);
    const dailyDeficit = calculateDailyDeficit(weeklyLossLbs);
    return safeTdee + safeBurns + dailyDeficit;
  }
  const offset = Number(nutritionGoal.daily_deficit_surplus ?? 0);
  const safeOffset = Number.isFinite(offset) ? offset : 0;
  return safeTdee + safeBurns + safeOffset;
}

export function nutritionCalorieMode(goal: NutritionGoalForCalories): CalorieMode {
  const m = goal.calorie_mode;
  return m === "dynamic" ? "dynamic" : "static";
}
