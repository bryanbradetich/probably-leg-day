"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyFoodLogWithFood, Food, FoodServingUnit } from "@/types";
import { MEAL_SLOT_LABELS, MEAL_SLOTS, scaledNutrients, formatKcal, formatGrams } from "@/lib/food-helpers";
import { localISODate } from "@/lib/weight-helpers";

type Props = {
  open: boolean;
  onClose: () => void;
  food: Food | null;
  userId: string;
  /** Pre-selected meal slot when adding */
  defaultMealSlot?: number;
  defaultDate?: string;
  /** When set, edit mode */
  existingLog?: DailyFoodLogWithFood | null;
  onSaved: () => void;
};

export function LogFoodModal({
  open,
  onClose,
  food,
  userId,
  defaultMealSlot = 1,
  defaultDate,
  existingLog,
  onSaved,
}: Props) {
  const [mealSlot, setMealSlot] = useState(defaultMealSlot);
  const [date, setDate] = useState(() => defaultDate ?? localISODate());
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<FoodServingUnit>("g");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeFood = existingLog?.foods ?? food;

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (existingLog) {
      setMealSlot(existingLog.meal_slot);
      setDate(existingLog.logged_date);
      setQuantity(String(existingLog.quantity));
      setUnit(existingLog.serving_unit);
      return;
    }
    if (!food) return;

    setMealSlot(defaultMealSlot);
    setDate(defaultDate ?? localISODate());
    setQuantity(String(food.serving_size));
    setUnit(food.serving_unit);

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("daily_food_logs")
        .select("quantity, serving_unit")
        .eq("user_id", userId)
        .eq("food_id", food.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setQuantity(String(data.quantity));
      setUnit(data.serving_unit as FoodServingUnit);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, existingLog?.id, food?.id, defaultMealSlot, defaultDate, userId]);

  const qNum = parseFloat(quantity);
  const preview = useMemo(() => {
    if (!activeFood || !Number.isFinite(qNum) || qNum <= 0) return null;
    return scaledNutrients(activeFood, qNum, unit);
  }, [activeFood, qNum, unit]);

  if (!open || !activeFood) return null;

  const save = async () => {
    if (!Number.isFinite(qNum) || qNum <= 0) {
      setErr("Enter a valid quantity.");
      return;
    }
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    if (existingLog) {
      const { error } = await supabase
        .from("daily_food_logs")
        .update({
          meal_slot: mealSlot,
          logged_date: date,
          quantity: qNum,
          serving_unit: unit,
        })
        .eq("id", existingLog.id)
        .eq("user_id", userId);
      setSaving(false);
      if (error) setErr(error.message);
      else {
        onSaved();
        onClose();
      }
      return;
    }
    if (!food) return;
    const { error } = await supabase.from("daily_food_logs").insert({
      user_id: userId,
      logged_date: date,
      meal_slot: mealSlot,
      food_id: food.id,
      quantity: qNum,
      serving_unit: unit,
    });
    setSaving(false);
    if (error) setErr(error.message);
    else {
      onSaved();
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className="flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-theme-border bg-theme-bg shadow-xl sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl"
          role="dialog"
          aria-modal
        >
          <div className="border-b border-theme-border px-5 py-4">
            <h2 className="text-lg font-bold text-theme-text-primary">
              {existingLog ? "Edit logged food" : "Add to log"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-theme-text-muted">{activeFood.name}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {err && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>
            )}
            <label className="block text-sm font-medium text-theme-text-muted">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-sm font-bold text-theme-text-primary"
              />
            </label>
            <label className="block text-sm font-medium text-theme-text-muted">
              Meal
              <select
                value={mealSlot}
                onChange={(e) => setMealSlot(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-sm font-bold text-theme-text-primary"
              >
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {MEAL_SLOT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-sm font-medium text-theme-text-muted">Quantity</span>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-lg font-bold tabular-nums text-theme-text-primary"
                />
                <div className="flex rounded-lg border border-theme-border p-0.5">
                  {(["g", "oz"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`rounded-md px-3 py-2 text-sm font-bold ${
                        unit === u ? "bg-theme-accent text-theme-on-accent" : "text-theme-text-muted"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {preview && (
              <div className="rounded-xl border border-theme-border bg-theme-surface/80 p-4">
                <p className="text-xs font-semibold uppercase text-theme-text-muted">Totals for this amount</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-theme-text-muted">Calories</dt>
                  <dd className="font-bold tabular-nums text-theme-text-primary">{formatKcal(preview.calories)} kcal</dd>
                  <dt className="text-theme-text-muted">Protein</dt>
                  <dd className="font-bold tabular-nums text-theme-macro-protein">{formatGrams(preview.protein_g, 1)}g</dd>
                  <dt className="text-theme-text-muted">Carbs</dt>
                  <dd className="font-bold tabular-nums text-theme-macro-carbs">{formatGrams(preview.carbs_g, 1)}g</dd>
                  <dt className="text-theme-text-muted">Fat</dt>
                  <dd className="font-bold tabular-nums text-theme-accent">{formatGrams(preview.fat_g, 1)}g</dd>
                </dl>
              </div>
            )}
          </div>
          <div className="flex gap-3 border-t border-theme-border px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-theme-border/80 py-3 text-sm font-semibold text-theme-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex-1 rounded-xl bg-theme-accent py-3 text-sm font-bold text-theme-on-accent disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
