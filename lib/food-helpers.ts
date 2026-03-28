import type { Food, FoodServingUnit, NutritionGoal } from "@/types";

/** US legal conversion (nutrition labeling–aligned) */
export const GRAMS_PER_OZ = 28.349523125;

export function toGrams(quantity: number, unit: FoodServingUnit): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return unit === "g" ? quantity : quantity * GRAMS_PER_OZ;
}

export function foodServingGrams(food: Pick<Food, "serving_size" | "serving_unit">): number {
  return toGrams(Number(food.serving_size), food.serving_unit);
}

/** Scale factor from logged amount vs food's labeled serving (both converted to grams). */
export function nutritionScaleFactor(
  food: Pick<Food, "serving_size" | "serving_unit">,
  logQuantity: number,
  logUnit: FoodServingUnit
): number {
  const denom = foodServingGrams(food);
  if (denom <= 0) return 0;
  return toGrams(logQuantity, logUnit) / denom;
}

export function scaledNutrients(
  food: Food,
  logQuantity: number,
  logUnit: FoodServingUnit
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  const k = nutritionScaleFactor(food, logQuantity, logUnit);
  return {
    calories: Number(food.calories) * k,
    protein_g: Number(food.protein_g) * k,
    carbs_g: Number(food.carbs_g) * k,
    fat_g: Number(food.fat_g) * k,
  };
}

export function sumNutrients(
  rows: Array<{ calories: number; protein_g: number; carbs_g: number; fat_g: number }>
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  return rows.reduce(
    (a, r) => ({
      calories: a.calories + r.calories,
      protein_g: a.protein_g + r.protein_g,
      carbs_g: a.carbs_g + r.carbs_g,
      fat_g: a.fat_g + r.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

export const MEAL_SLOT_LABELS: Record<number, string> = {
  1: "Meal 1",
  2: "Meal 2",
  3: "Meal 3",
  4: "Meal 4",
  5: "Meal 5",
  6: "Snacks",
};

export const MEAL_SLOTS = [1, 2, 3, 4, 5, 6] as const;

export function formatKcal(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatGrams(n: number, digits = 0): string {
  return n.toFixed(digits);
}

const CAL_PER_G_PROTEIN = 4;
const CAL_PER_G_CARBS = 4;
const CAL_PER_G_FAT = 9;

export function goalMacroGrams(goal: Pick<NutritionGoal, "daily_calories" | "protein_pct" | "carbs_pct" | "fat_pct">): {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} {
  const cal = Number(goal.daily_calories);
  return {
    protein_g: (cal * (Number(goal.protein_pct) / 100)) / CAL_PER_G_PROTEIN,
    carbs_g: (cal * (Number(goal.carbs_pct) / 100)) / CAL_PER_G_CARBS,
    fat_g: (cal * (Number(goal.fat_pct) / 100)) / CAL_PER_G_FAT,
  };
}

export function macroCaloriesFromGrams(protein_g: number, carbs_g: number, fat_g: number): {
  protein_cal: number;
  carbs_cal: number;
  fat_cal: number;
} {
  return {
    protein_cal: protein_g * CAL_PER_G_PROTEIN,
    carbs_cal: carbs_g * CAL_PER_G_CARBS,
    fat_cal: fat_g * CAL_PER_G_FAT,
  };
}

/** % of total calories from each macro (4/4/9 kcal per g). Returns null when totalCalories ≤ 0. */
export function macroCaloriePercents(
  totalCalories: number,
  protein_g: number,
  carbs_g: number,
  fat_g: number
): { protein: number; carbs: number; fat: number } | null {
  if (!Number.isFinite(totalCalories) || totalCalories <= 0) return null;
  const { protein_cal, carbs_cal, fat_cal } = macroCaloriesFromGrams(protein_g, carbs_g, fat_g);
  return {
    protein: Math.round((protein_cal / totalCalories) * 100),
    carbs: Math.round((carbs_cal / totalCalories) * 100),
    fat: Math.round((fat_cal / totalCalories) * 100),
  };
}
