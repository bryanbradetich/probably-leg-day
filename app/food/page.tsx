"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NutritionGoalSetup, type NutritionGoalSavePayload } from "@/components/food/NutritionGoalSetup";
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
} from "@/lib/food-helpers";
import { addDays, formatShortDate, localISODate } from "@/lib/weight-helpers";
import type { DailyFoodLogWithFood, Food, NutritionGoal } from "@/types";

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    void loadLogsForDate(userId, selectedDate);
  }, [userId, selectedDate, loadLogsForDate]);

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
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error ?? "Session expired."} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Food log"
          description="Today’s meals, macros, and quick adds."
        />

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/food/library" className="font-medium text-[#f97316] hover:underline">
            Food library
          </Link>
          <span className="text-zinc-600">·</span>
          <Link href="/food/templates" className="font-medium text-[#f97316] hover:underline">
            Meal templates
          </Link>
          <span className="text-zinc-600">·</span>
          <Link href="/food/weekly" className="font-medium text-[#f97316] hover:underline">
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
            />
          )}
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold text-white hover:bg-zinc-800"
            >
              ←
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"
            />
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold text-white hover:bg-zinc-800"
            >
              →
            </button>
          </div>
          <p className="text-sm font-semibold text-zinc-400">{formatShortDate(selectedDate)}</p>
        </div>

        {goal && (
          <div className="mt-6">
            <DailyNutritionSummary totals={dayTotals} goal={goal} />
          </div>
        )}

        <section className="mt-10 space-y-4">
          {MEAL_SLOTS.map((slot) => {
            const entries = bySlot[slot] ?? [];
            const slotTotals = perSlotTotals[slot];
            const mealCal = slotTotals?.calories ?? 0;
            const isCollapsed = collapsed[slot];
            const hasItems = entries.length > 0;
            return (
              <div
                key={slot}
                className={`rounded-xl border bg-zinc-900/40 ${
                  hasItems ? "border-zinc-800" : "border-dashed border-zinc-700"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [slot]: !c[slot] }))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
                >
                  <div>
                    <h3 className="text-base font-bold text-white">{MEAL_SLOT_LABELS[slot]}</h3>
                    <p className="text-sm font-bold tabular-nums">
                      <span className="text-[#f97316]">{formatKcal(mealCal)} kcal</span>
                      <span className="font-medium text-zinc-400">
                        {" "}
                        · P {Math.round(slotTotals?.protein_g ?? 0)}g · C {Math.round(slotTotals?.carbs_g ?? 0)}g · F{" "}
                        {Math.round(slotTotals?.fat_g ?? 0)}g
                      </span>
                    </p>
                  </div>
                  <span className="text-zinc-500">{isCollapsed ? "▸" : "▾"}</span>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-zinc-800/80 px-4 pb-4 pt-2 sm:px-5">
                    {!hasItems && (
                      <p className="mb-3 text-sm font-medium text-zinc-500">Add food to this meal.</p>
                    )}
                    <ul className="space-y-2">
                      {entries.map((row) => {
                        const n = scaledNutrients(row.foods, Number(row.quantity), row.serving_unit);
                        return (
                          <li
                            key={row.id}
                            className="flex flex-col gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-bold text-white">{row.foods.name}</p>
                              <p className="text-sm text-zinc-500">
                                {formatGrams(Number(row.quantity), 1)}
                                {row.serving_unit} · {formatKcal(n.calories)} kcal · P {Math.round(n.protein_g)}g · C{" "}
                                {Math.round(n.carbs_g)}g · F {Math.round(n.fat_g)}g
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditLog(row)}
                                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-semibold text-zinc-300"
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
                        className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-bold text-[#0a0a0a]"
                      >
                        Add food
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateLogMealSlot(slot);
                          setTemplatePickerSlot(slot);
                        }}
                        className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200"
                      >
                        Add meal template
                      </button>
                    </div>

                    <div className="mt-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/30 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Quick add</p>
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
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Daily totals</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
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
                  return (
                    <tr key={s} className="border-b border-zinc-800/80 bg-zinc-950/50">
                      <td className="px-3 py-2 font-bold text-white">{MEAL_SLOT_LABELS[s]}</td>
                      <td className="px-3 py-2 font-bold tabular-nums text-white">{formatKcal(t.calories)}</td>
                      <td className="px-3 py-2 font-bold tabular-nums text-[#3b82f6]">{t.protein_g.toFixed(1)}g</td>
                      <td className="px-3 py-2 font-bold tabular-nums text-[#eab308]">{t.carbs_g.toFixed(1)}g</td>
                      <td className="px-3 py-2 font-bold tabular-nums text-[#f97316]">{t.fat_g.toFixed(1)}g</td>
                    </tr>
                  );
                })}
                <tr className="bg-zinc-900/90">
                  <td className="px-3 py-3 font-bold text-white">Total</td>
                  <td className="px-3 py-3 font-bold tabular-nums text-white">{formatKcal(dayTotals.calories)}</td>
                  <td className="px-3 py-3 font-bold tabular-nums text-[#3b82f6]">{dayTotals.protein_g.toFixed(1)}g</td>
                  <td className="px-3 py-3 font-bold tabular-nums text-[#eab308]">{dayTotals.carbs_g.toFixed(1)}g</td>
                  <td className="px-3 py-3 font-bold tabular-nums text-[#f97316]">{dayTotals.fat_g.toFixed(1)}g</td>
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
