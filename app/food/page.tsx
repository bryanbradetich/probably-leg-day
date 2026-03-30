"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  NutritionGoalSetup,
  type NutritionCalorieContext,
  type NutritionGoalSavePayload,
} from "@/components/food/NutritionGoalSetup";
import { DailyNutritionSummary } from "@/components/food/DailyNutritionSummary";
import { FoodSearchPicker } from "@/components/food/FoodSearchPicker";
import { FoodPickerModal } from "@/components/food/FoodPickerModal";
import { LogFoodModal } from "@/components/food/LogFoodModal";
import { TemplatePickerModal } from "@/components/food/TemplatePickerModal";
import { TemplateLogModal, type TemplateWithFoods } from "@/components/food/TemplateLogModal";
import {
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  scaledNutrients,
  sumNutrients,
  formatKcal,
  formatGrams,
  macroCaloriePercents,
} from "@/lib/food-helpers";
import { addDays, formatShortDate, localISODate } from "@/lib/weight-helpers";
import type { DailyFoodLogWithFood, DailyWeight, Food, NutritionGoal, ProfileCalorieFields, WeightGoal } from "@/types";
import { computeBmrTdeeForDate, profileBmrFieldsComplete } from "@/lib/calorie-helpers";
import { getDynamicCaloricTarget, isActiveLossWeightGoal, nutritionCalorieMode } from "@/lib/calories";

export default function FoodLogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalFormKey, setGoalFormKey] = useState(0);
  const [goalSaving, setGoalSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => localISODate());
  const [logs, setLogs] = useState<DailyFoodLogWithFood[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [templates, setTemplates] = useState<TemplateWithFoods[]>([]);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(MEAL_SLOTS.map((s) => [s, false])) as Record<number, boolean>
  );

  const [foodPickerSlot, setFoodPickerSlot] = useState<number | null>(null);
  const [templatePickerSlot, setTemplatePickerSlot] = useState<number | null>(null);
  const [templateLogMealSlot, setTemplateLogMealSlot] = useState(1);
  const [templateToLog, setTemplateToLog] = useState<TemplateWithFoods | null>(null);
  const [logModalFood, setLogModalFood] = useState<Food | null>(null);
  const [logModalSlot, setLogModalSlot] = useState(1);
  const [editLog, setEditLog] = useState<DailyFoodLogWithFood | null>(null);
  const [profileCal, setProfileCal] = useState<ProfileCalorieFields | null>(null);
  const [weights, setWeights] = useState<DailyWeight[]>([]);
  const [weightGoal, setWeightGoal] = useState<WeightGoal | null>(null);
  const [additionalBurns, setAdditionalBurns] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace("/auth/login");
      return;
    }
    setUserId(user.id);
    setError(null);

    const { data: g, error: gErr } = await supabase
      .from("nutrition_goals")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (gErr) {
      setError(gErr.message);
      setLoading(false);
      return;
    }
    setGoal(g ? (g as NutritionGoal) : null);

    const { data: fRows, error: fErr } = await supabase
      .from("foods")
      .select("*")
      .order("name");
    if (fErr) {
      setError(fErr.message);
      setLoading(false);
      return;
    }
    setFoods((fRows ?? []) as Food[]);

    const { data: tRows, error: tErr } = await supabase
      .from("meal_templates")
      .select("*, meal_template_foods(*, foods(*))")
      .eq("user_id", user.id)
      .order("name");
    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      return;
    }
    setTemplates((tRows ?? []) as TemplateWithFoods[]);

    const { data: prof } = await supabase
      .from("profiles")
      .select("height_cm, date_of_birth, biological_sex, activity_level, custom_activity_multiplier")
      .eq("id", user.id)
      .maybeSingle();
    const pr = prof as Partial<Omit<ProfileCalorieFields, "id">> | null;
    setProfileCal(
      pr
        ? {
            id: user.id,
            height_cm: pr.height_cm ?? null,
            date_of_birth: pr.date_of_birth ?? null,
            biological_sex: (pr.biological_sex as ProfileCalorieFields["biological_sex"]) ?? null,
            activity_level: (pr.activity_level as ProfileCalorieFields["activity_level"]) ?? "sedentary",
            custom_activity_multiplier: pr.custom_activity_multiplier ?? null,
          }
        : null
    );

    const { data: dw } = await supabase
      .from("daily_weights")
      .select("*")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(500);
    setWeights((dw ?? []) as DailyWeight[]);

    const { data: wg } = await supabase.from("weight_goals").select("*").eq("user_id", user.id).maybeSingle();
    setWeightGoal((wg ?? null) as WeightGoal | null);

    setLoading(false);
  }, [router]);

  const loadLogsForDate = useCallback(async (uid: string, date: string) => {
    const supabase = createClient();
    const { data, error: e } = await supabase
      .from("daily_food_logs")
      .select("*, foods(*)")
      .eq("user_id", uid)
      .eq("logged_date", date)
      .order("created_at");
    if (e) {
      setError(e.message);
      return;
    }
    setLogs((data ?? []) as DailyFoodLogWithFood[]);
  }, []);

  const loadBurnsForDate = useCallback(async (uid: string, date: string) => {
    const supabase = createClient();
    const { data, error: e } = await supabase
      .from("calorie_burns")
      .select("calories_burned")
      .eq("user_id", uid)
      .eq("logged_date", date);
    if (e) {
      setError(e.message);
      return;
    }
    const sum = (data ?? []).reduce((s, r) => s + Number((r as { calories_burned: number }).calories_burned), 0);
    setAdditionalBurns(sum);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    void loadLogsForDate(userId, selectedDate);
  }, [userId, selectedDate, loadLogsForDate]);

  useEffect(() => {
    if (!userId) return;
    void loadBurnsForDate(userId, selectedDate);
  }, [userId, selectedDate, loadBurnsForDate]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`food_calorie_burns_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calorie_burns", filter: `user_id=eq.${userId}` },
        () => {
          void loadBurnsForDate(userId, selectedDate);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, selectedDate, loadBurnsForDate]);

  const bySlot = useMemo(() => {
    const m: Record<number, DailyFoodLogWithFood[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const row of logs) {
      if (!m[row.meal_slot]) m[row.meal_slot] = [];
      m[row.meal_slot].push(row);
    }
    return m;
  }, [logs]);

  const dayTotals = useMemo(() => {
    return sumNutrients(logs.map((r) => scaledNutrients(r.foods, Number(r.quantity), r.serving_unit)));
  }, [logs]);

  const energyForSelectedDate = useMemo(() => {
    if (!profileCal || !profileBmrFieldsComplete(profileCal)) return null;
    return computeBmrTdeeForDate(profileCal, weights, selectedDate);
  }, [profileCal, weights, selectedDate]);

  const currentWeightKgForDate = useMemo(() => {
    const eligible = weights.filter((w) => w.logged_date <= selectedDate);
    if (eligible.length === 0) return null;
    eligible.sort((a, b) => b.logged_date.localeCompare(a.logged_date));
    return Number(eligible[0].weight_kg);
  }, [weights, selectedDate]);

  const calorieContext = useMemo((): NutritionCalorieContext | null => {
    if (!userId) return null;
    return {
      tdee: energyForSelectedDate?.tdee ?? null,
      additionalBurns,
      weightGoal,
      currentWeightKg: currentWeightKgForDate,
      selectedDate,
    };
  }, [userId, energyForSelectedDate?.tdee, additionalBurns, weightGoal, currentWeightKgForDate, selectedDate]);

  const effectiveCalorieTarget = useMemo(() => {
    if (!goal) return 0;
    const mode = nutritionCalorieMode(goal);
    const tdee = energyForSelectedDate?.tdee ?? 0;
    if (mode === "dynamic" && tdee > 0) {
      return getDynamicCaloricTarget({
        TDEE: tdee,
        additionalBurns,
        activeWeightGoal:
          weightGoal && isActiveLossWeightGoal(weightGoal, currentWeightKgForDate) ? weightGoal : null,
        currentWeightKg: currentWeightKgForDate,
        nutritionGoal: goal,
      });
    }
    return Number(goal.daily_calories);
  }, [goal, energyForSelectedDate?.tdee, additionalBurns, weightGoal, currentWeightKgForDate]);

  const dynamicSummaryTooltip = useMemo(() => {
    if (!goal || nutritionCalorieMode(goal) !== "dynamic") return null;
    const tdee = energyForSelectedDate?.tdee ?? 0;
    if (tdee <= 0) {
      return "Add a weight entry on or before this date and complete your profile (height, age, sex, activity) to compute TDEE. Until then, your static daily calorie value is used for the bar.";
    }
    const parts = [`TDEE ${formatKcal(tdee)} kcal`, `extra burns ${formatKcal(additionalBurns)} kcal`];
    const lossGoal =
      weightGoal && isActiveLossWeightGoal(weightGoal, currentWeightKgForDate) ? weightGoal : null;
    if (lossGoal && currentWeightKgForDate != null) {
      parts.push(`weight-goal deficit applied (3500 kcal/lb/week rule)`);
    } else {
      parts.push(`manual offset ${formatKcal(Number(goal.daily_deficit_surplus ?? 0))} kcal`);
    }
    return `Today's target = ${parts.join(" + ")} (see Calories page for full breakdown).`;
  }, [
    goal,
    energyForSelectedDate?.tdee,
    additionalBurns,
    weightGoal,
    currentWeightKgForDate,
  ]);

  const dayMacroPct = useMemo(
    () =>
      macroCaloriePercents(
        dayTotals.calories,
        dayTotals.protein_g,
        dayTotals.carbs_g,
        dayTotals.fat_g
      ),
    [dayTotals]
  );

  const perSlotTotals = useMemo(() => {
    const out: Record<number, ReturnType<typeof sumNutrients>> = {
      1: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      2: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      3: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      4: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      5: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      6: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    };
    for (const s of MEAL_SLOTS) {
      const rows = bySlot[s] ?? [];
      out[s] = sumNutrients(rows.map((r) => scaledNutrients(r.foods, Number(r.quantity), r.serving_unit)));
    }
    return out;
  }, [bySlot]);

  const saveGoal = async (payload: NutritionGoalSavePayload) => {
    if (!userId) return;
    setGoalSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("nutrition_goals").upsert(
      {
        user_id: userId,
        daily_calories: payload.daily_calories,
        protein_pct: payload.protein_pct,
        carbs_pct: payload.carbs_pct,
        fat_pct: payload.fat_pct,
        calorie_mode: payload.calorie_mode,
        daily_deficit_surplus: payload.daily_deficit_surplus,
      },
      { onConflict: "user_id" }
    );
    setGoalSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    const { data: g } = await supabase
      .from("nutrition_goals")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setGoal(g as NutritionGoal);
    setGoalEditing(false);
  };

  const deleteLog = async (id: string) => {
    if (!userId || !confirm("Remove this food from the log?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("daily_food_logs").delete().eq("id", id).eq("user_id", userId);
    if (err) setError(err.message);
    else void loadLogsForDate(userId, selectedDate);
  };

  const refreshAll = () => {
    if (userId) void loadLogsForDate(userId, selectedDate);
    void load();
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text-primary">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error ?? "Session expired."} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Food log"
          description="Today’s meals, macros, and quick adds."
        />

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/food/library" className="font-medium text-theme-accent hover:underline">
            Food library
          </Link>
          <span className="text-theme-text-muted/80">·</span>
          <Link href="/food/templates" className="font-medium text-theme-accent hover:underline">
            Meal templates
          </Link>
          <span className="text-theme-text-muted/80">·</span>
          <Link href="/food/weekly" className="font-medium text-theme-accent hover:underline">
            Weekly summary
          </Link>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <section className="mt-8">
          {!goal || goalEditing ? (
            <NutritionGoalSetup
              key={goal ? `edit-${goalFormKey}` : "new-goal"}
              goal={goal}
              saving={goalSaving}
              onSave={(p) => void saveGoal(p)}
              onCancel={goal ? () => setGoalEditing(false) : undefined}
              calorieContext={calorieContext ?? undefined}
            />
          ) : (
            <NutritionGoalSetup
              compact
              goal={goal}
              saving={false}
              onSave={() => {}}
              onEditRequest={() => {
                setGoalFormKey((k) => k + 1);
                setGoalEditing(true);
              }}
              calorieContext={calorieContext ?? undefined}
            />
          )}
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              className="rounded-lg border border-theme-border px-3 py-2 text-sm font-bold text-theme-text-primary hover:bg-theme-border/90"
            >
              ←
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-sm font-bold text-theme-text-primary"
            />
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              className="rounded-lg border border-theme-border px-3 py-2 text-sm font-bold text-theme-text-primary hover:bg-theme-border/90"
            >
              →
            </button>
          </div>
          <p className="text-sm font-semibold text-theme-text-muted">{formatShortDate(selectedDate)}</p>
        </div>

        {goal && (
          <div className="mt-6">
            <DailyNutritionSummary
              totals={dayTotals}
              goal={goal}
              effectiveCalorieTarget={effectiveCalorieTarget}
              dynamicTooltip={dynamicSummaryTooltip}
            />
          </div>
        )}

        <section className="mt-10 space-y-4">
          {MEAL_SLOTS.map((slot) => {
            const entries = bySlot[slot] ?? [];
            const slotTotals = perSlotTotals[slot];
            const mealCal = slotTotals?.calories ?? 0;
            const mealMacroPct = macroCaloriePercents(
              mealCal,
              slotTotals?.protein_g ?? 0,
              slotTotals?.carbs_g ?? 0,
              slotTotals?.fat_g ?? 0
            );
            const pg = Math.round(slotTotals?.protein_g ?? 0);
            const cg = Math.round(slotTotals?.carbs_g ?? 0);
            const fg = Math.round(slotTotals?.fat_g ?? 0);
            const isCollapsed = collapsed[slot];
            const hasItems = entries.length > 0;
            return (
              <div
                key={slot}
                className={`rounded-xl border bg-theme-surface/40 ${
                  hasItems ? "border-theme-border" : "border-dashed border-theme-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [slot]: !c[slot] }))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
                >
                  <div>
                    <h3 className="text-base font-bold text-theme-text-primary">{MEAL_SLOT_LABELS[slot]}</h3>
                    <p className="text-sm font-bold tabular-nums">
                      <span className="text-theme-accent">{formatKcal(mealCal)} kcal</span>
                      <span className="font-medium text-theme-text-muted">
                        {" "}
                        · P {pg}g
                        {mealMacroPct && (
                          <span className="font-medium text-theme-text-muted"> ({mealMacroPct.protein}%)</span>
                        )}
                        {" · C "}
                        {cg}g
                        {mealMacroPct && (
                          <span className="font-medium text-theme-text-muted"> ({mealMacroPct.carbs}%)</span>
                        )}
                        {" · F "}
                        {fg}g
                        {mealMacroPct && (
                          <span className="font-medium text-theme-text-muted"> ({mealMacroPct.fat}%)</span>
                        )}
                      </span>
                    </p>
                  </div>
                  <span className="text-theme-text-muted">{isCollapsed ? "▸" : "▾"}</span>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-theme-border/80 px-4 pb-4 pt-2 sm:px-5">
                    {!hasItems && (
                      <p className="mb-3 text-sm font-medium text-theme-text-muted">Add food to this meal.</p>
                    )}
                    <ul className="space-y-2">
                      {entries.map((row) => {
                        const n = scaledNutrients(row.foods, Number(row.quantity), row.serving_unit);
                        return (
                          <li
                            key={row.id}
                            className="flex flex-col gap-2 rounded-lg border border-theme-border/80 bg-theme-input-bg/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-bold text-theme-text-primary">{row.foods.name}</p>
                              <p className="text-sm text-theme-text-muted">
                                {formatGrams(Number(row.quantity), 1)}
                                {row.serving_unit} · {formatKcal(n.calories)} kcal · P {Math.round(n.protein_g)}g · C{" "}
                                {Math.round(n.carbs_g)}g · F {Math.round(n.fat_g)}g
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditLog(row)}
                                className="rounded-lg border border-theme-border/80 px-3 py-1.5 text-sm font-semibold text-theme-text-muted"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteLog(row.id)}
                                className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-semibold text-red-400"
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLogModalSlot(slot);
                          setFoodPickerSlot(slot);
                        }}
                        className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-bold text-theme-on-accent"
                      >
                        Add food
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateLogMealSlot(slot);
                          setTemplatePickerSlot(slot);
                        }}
                        className="rounded-lg border border-theme-border/80 px-4 py-2 text-sm font-semibold text-theme-text-primary/90"
                      >
                        Add meal template
                      </button>
                    </div>

                    <div className="mt-4 rounded-lg border border-dashed border-theme-border bg-theme-input-bg/30 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-theme-text-muted">Quick add</p>
                      <FoodSearchPicker
                        foods={foods}
                        resultsOnlyWhenTyping
                        placeholder={`Search to add to ${MEAL_SLOT_LABELS[slot]}…`}
                        onSelect={(f) => {
                          setLogModalSlot(slot);
                          setLogModalFood(f);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-theme-text-muted">Daily totals</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-theme-border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-theme-border bg-theme-surface text-theme-text-muted">
                  <th className="px-3 py-2 font-semibold">Meal</th>
                  <th className="px-3 py-2 font-semibold">Calories</th>
                  <th className="px-3 py-2 font-semibold">Protein</th>
                  <th className="px-3 py-2 font-semibold">Carbs</th>
                  <th className="px-3 py-2 font-semibold">Fat</th>
                </tr>
              </thead>
              <tbody>
                {MEAL_SLOTS.map((s) => {
                  const t = perSlotTotals[s];
                  const rowPct = macroCaloriePercents(t.calories, t.protein_g, t.carbs_g, t.fat_g);
                  return (
                    <tr key={s} className="border-b border-theme-border/80 bg-theme-input-bg/50">
                      <td className="px-3 py-2 font-bold text-theme-text-primary">{MEAL_SLOT_LABELS[s]}</td>
                      <td className="px-3 py-2 font-bold tabular-nums text-theme-text-primary">{formatKcal(t.calories)}</td>
                      <td className="px-3 py-2 font-bold tabular-nums text-theme-macro-protein">
                        {t.protein_g.toFixed(1)}g
                        {rowPct && (
                          <span className="font-semibold text-theme-text-muted"> ({rowPct.protein}%)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold tabular-nums text-theme-macro-carbs">
                        {t.carbs_g.toFixed(1)}g
                        {rowPct && (
                          <span className="font-semibold text-theme-text-muted"> ({rowPct.carbs}%)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold tabular-nums text-theme-accent">
                        {t.fat_g.toFixed(1)}g
                        {rowPct && (
                          <span className="font-semibold text-theme-text-muted"> ({rowPct.fat}%)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-theme-surface/90">
                  <td className="px-3 py-3 font-bold text-theme-text-primary">Total</td>
                  <td className="px-3 py-3 font-bold tabular-nums text-theme-text-primary">{formatKcal(dayTotals.calories)}</td>
                  <td className="px-3 py-3 font-bold tabular-nums text-theme-macro-protein">
                    {dayTotals.protein_g.toFixed(1)}g
                    {dayMacroPct && (
                      <span className="font-semibold text-theme-text-muted"> ({dayMacroPct.protein}%)</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-bold tabular-nums text-theme-macro-carbs">
                    {dayTotals.carbs_g.toFixed(1)}g
                    {dayMacroPct && (
                      <span className="font-semibold text-theme-text-muted"> ({dayMacroPct.carbs}%)</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-bold tabular-nums text-theme-accent">
                    {dayTotals.fat_g.toFixed(1)}g
                    {dayMacroPct && (
                      <span className="font-semibold text-theme-text-muted"> ({dayMacroPct.fat}%)</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <FoodPickerModal
        open={foodPickerSlot !== null}
        onClose={() => setFoodPickerSlot(null)}
        foods={foods}
        title="Add food"
        onSelect={(f) => {
          setLogModalSlot(foodPickerSlot ?? 1);
          setLogModalFood(f);
          setFoodPickerSlot(null);
        }}
      />

      <TemplatePickerModal
        open={templatePickerSlot !== null}
        onClose={() => setTemplatePickerSlot(null)}
        templates={templates}
        onPick={(t) => {
          setTemplateToLog(t);
          setTemplatePickerSlot(null);
        }}
      />

      <TemplateLogModal
        open={templateToLog !== null}
        onClose={() => setTemplateToLog(null)}
        template={templateToLog}
        userId={userId}
        defaultMealSlot={templateLogMealSlot}
        defaultDate={selectedDate}
        onLogged={refreshAll}
      />

      <LogFoodModal
        open={logModalFood !== null || editLog !== null}
        onClose={() => {
          setLogModalFood(null);
          setEditLog(null);
        }}
        food={logModalFood}
        userId={userId}
        defaultMealSlot={logModalSlot}
        defaultDate={selectedDate}
        existingLog={editLog}
        onSaved={refreshAll}
      />
    </div>
  );
}
