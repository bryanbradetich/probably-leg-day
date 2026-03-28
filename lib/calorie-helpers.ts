import type { ActivityLevel, BiologicalSex, DailyWeight, ProfileCalorieFields } from "@/types";
import { inchesToCm } from "@/lib/units";
import { addDays, parseISODate } from "@/lib/weight-helpers";

export const ACTIVITY_LEVEL_OPTIONS: {
  id: ActivityLevel;
  label: string;
  description: string;
  multiplier: number;
}[] = [
  { id: "sedentary", label: "Sedentary", description: "Little or no exercise", multiplier: 1.2 },
  { id: "lightly_active", label: "Lightly active", description: "Exercise 1–3 days/week", multiplier: 1.375 },
  { id: "moderately_active", label: "Moderately active", description: "Exercise 3–5 days/week", multiplier: 1.55 },
  { id: "very_active", label: "Very active", description: "Exercise 6–7 days/week", multiplier: 1.725 },
  { id: "custom", label: "Custom", description: "Set your own multiplier", multiplier: 0 },
];

export function activityMultiplier(profile: Pick<ProfileCalorieFields, "activity_level" | "custom_activity_multiplier">): number {
  if (profile.activity_level === "custom") {
    const m = Number(profile.custom_activity_multiplier);
    return Number.isFinite(m) && m > 0 ? m : 1.2;
  }
  const row = ACTIVITY_LEVEL_OPTIONS.find((o) => o.id === profile.activity_level);
  return row?.multiplier ?? 1.2;
}

export function activityLevelLabel(level: ActivityLevel): string {
  return ACTIVITY_LEVEL_OPTIONS.find((o) => o.id === level)?.label ?? level;
}

/** Whole feet + inches (0–11.99…) → cm */
export function heightFtInToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return inchesToCm(totalInches) ?? 0;
}

export function heightCmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round((totalInches - feet * 12) * 100) / 100;
  if (inches >= 12) {
    feet += 1;
    inches -= 12;
  }
  return { feet, inches };
}

/** Age in full years on a calendar date (as-of = end of that local calendar day). */
export function ageOnDate(dateOfBirthIso: string, asOfIso: string): number | null {
  if (!dateOfBirthIso || !asOfIso) return null;
  const birth = parseISODate(dateOfBirthIso);
  const asOf = parseISODate(asOfIso);
  if (birth > asOf) return null;
  let age = asOf.getFullYear() - birth.getFullYear();
  const m = asOf.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function mifflinStJeorBmr(weightKg: number, heightCm: number, age: number, sex: BiologicalSex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function profileBmrFieldsComplete(p: Partial<ProfileCalorieFields> | null | undefined): boolean {
  if (!p) return false;
  const h = Number(p.height_cm);
  if (!p.date_of_birth || !p.biological_sex) return false;
  if (!Number.isFinite(h) || h <= 0) return false;
  if (p.activity_level === "custom") {
    const m = Number(p.custom_activity_multiplier);
    return Number.isFinite(m) && m > 0;
  }
  return !!p.activity_level;
}

/**
 * Latest weight on or before `asOfIso` (inclusive), by logged_date.
 */
export function weightForDate(weights: DailyWeight[], asOfIso: string): { weightKg: number; loggedDate: string } | null {
  const eligible = weights.filter((w) => w.logged_date <= asOfIso);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => b.logged_date.localeCompare(a.logged_date));
  const w = eligible[0];
  return { weightKg: Number(w.weight_kg), loggedDate: w.logged_date };
}

export type BmrTdeeResult = {
  bmr: number;
  tdee: number;
  multiplier: number;
  age: number;
  weightKg: number;
  weightLoggedDate: string;
};

export function computeBmrTdeeForDate(
  profile: ProfileCalorieFields,
  weights: DailyWeight[],
  asOfIso: string
): BmrTdeeResult | null {
  if (!profileBmrFieldsComplete(profile)) return null;
  const w = weightForDate(weights, asOfIso);
  if (!w) return null;
  const age = ageOnDate(profile.date_of_birth!, asOfIso);
  if (age == null || age < 0) return null;
  const h = Number(profile.height_cm);
  const mult = activityMultiplier(profile);
  const bmr = mifflinStJeorBmr(w.weightKg, h, age, profile.biological_sex!);
  return {
    bmr,
    tdee: bmr * mult,
    multiplier: mult,
    age,
    weightKg: w.weightKg,
    weightLoggedDate: w.loggedDate,
  };
}

/** Net surplus tiers vs 0 (kcal in − kcal out). */
export function netCalorieToneClass(net: number): "success" | "warning" | "danger" {
  if (net <= 200) return "success";
  if (net <= 500) return "warning";
  return "danger";
}

export function lastNDatesInclusive(endIso: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(addDays(endIso, -i));
  }
  return out;
}
