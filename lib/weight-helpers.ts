import { kgToLbs, lbsToKg } from "@/lib/units";
import type { WeightGoal, WeeklyLossType } from "@/types";

/** Local calendar date YYYY-MM-DD */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, delta: number): string {
  const x = parseISODate(iso);
  x.setDate(x.getDate() + delta);
  return localISODate(x);
}

/** Monday (ISO week) of the calendar week containing `iso`, as YYYY-MM-DD */
export function mondayOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localISODate(d);
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = parseISODate(aIso).getTime();
  const b = parseISODate(bIso).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Linear schedule implied weekly loss for the goal form: %/week (2 dp) or lbs/week (1 dp).
 * `todayIso` → `targetDateIso` must be strictly future; goal must be below current (lbs).
 */
export function suggestedWeeklyLossDisplay(
  currentLbs: number,
  goalLbs: number,
  todayIso: string,
  targetDateIso: string,
  mode: WeeklyLossType
): number | null {
  if (!Number.isFinite(currentLbs) || !Number.isFinite(goalLbs) || currentLbs <= 0) return null;
  if (goalLbs >= currentLbs) return null;
  const days = daysBetween(todayIso, targetDateIso);
  if (days <= 0) return null;
  const weeks = days / 7;
  if (weeks <= 0) return null;
  const totalToLose = currentLbs - goalLbs;
  if (totalToLose <= 0) return null;
  if (mode === "percentage") {
    return Math.round((totalToLose / currentLbs / weeks) * 100 * 100) / 100;
  }
  return Math.round((totalToLose / weeks) * 10) / 10;
}

/** Sunday of the week that starts on `mondayIso` */
export function sundayOfWeekFromMonday(mondayIso: string): string {
  return addDays(mondayIso, 6);
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthDay(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function dayOfWeekLabel(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: "short" });
}

/** Weight loss per week in kg from goal rule (uses current body weight for %). */
export function weeklyLossKg(
  type: WeeklyLossType,
  value: number,
  currentWeightKg: number
): number {
  if (type === "percentage") {
    return currentWeightKg * (value / 100);
  }
  return Math.max(0, value);
}

/** End date for linear target: explicit `target_date` or derived from weekly loss. */
export function effectiveEndDate(
  goal: WeightGoal,
  startDate: string,
  startKg: number
): string {
  if (goal.target_date) return goal.target_date;
  const loss = weeklyLossKg(goal.weekly_loss_type, goal.weekly_loss_value, startKg);
  if (loss <= 0.001) return addDays(startDate, 365);
  const weeks = Math.max(1, Math.ceil((startKg - goal.goal_weight_kg) / loss));
  return addDays(startDate, weeks * 7);
}

/** Interpolated target weight (kg) on `dateIso` from start→goal by target date (linear). */
export function linearTargetKg(
  dateIso: string,
  startDateIso: string,
  startKg: number,
  endDateIso: string,
  endKg: number
): number {
  const total = daysBetween(startDateIso, endDateIso);
  if (total <= 0) return endKg;
  const t = daysBetween(startDateIso, dateIso);
  const u = Math.min(1, Math.max(0, t / total));
  return startKg + (endKg - startKg) * u;
}

/** Start of linear goal line: first logged day + that weight, else goal created date + latest weight. */
export function defaultTrajectoryStart(
  firstLogDate: string | null,
  firstLogKg: number | null,
  goalCreatedIso: string,
  latestKg: number
): { startDate: string; startKg: number } {
  if (firstLogDate != null && firstLogKg != null) {
    return { startDate: firstLogDate, startKg: firstLogKg };
  }
  return { startDate: goalCreatedIso.slice(0, 10), startKg: latestKg };
}

/** Project weight week-over-week from `fromKg` using loss rule (recalculate % each step). */
export function projectNextWeekKg(
  fromKg: number,
  type: WeeklyLossType,
  value: number
): number {
  const loss = weeklyLossKg(type, value, fromKg);
  return fromKg - loss;
}

/** Current week first, then walk back until a week has a logged average (kg). */
export function recentWeeklyAverageKg(
  todayIso: string,
  weekAvgByMonday: Record<string, number>
): number | null {
  let mon = mondayOfWeek(todayIso);
  if (weekAvgByMonday[mon] != null) return weekAvgByMonday[mon];
  for (let i = 0; i < 104; i++) {
    mon = addDays(mon, -7);
    const v = weekAvgByMonday[mon];
    if (v != null) return v;
  }
  return null;
}

export function formatLossDescription(goal: WeightGoal): string {
  if (goal.weekly_loss_type === "percentage") {
    return `Losing ${goal.weekly_loss_value}% of body weight per week`;
  }
  const lbs = kgToLbs(goal.weekly_loss_value);
  return `Losing ${lbs != null ? lbs : goal.weekly_loss_value} lbs per week`;
}

export { lbsToKg, kgToLbs };
