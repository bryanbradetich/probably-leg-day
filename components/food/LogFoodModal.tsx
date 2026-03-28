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
    } else {
      setMealSlot(defaultMealSlot);
      setDate(defaultDate ?? localISODate());
      setQuantity("100");
      setUnit("g");
    }
  }, [open, existingLog, defaultMealSlot, defaultDate]);

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
          className="flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-zinc-800 bg-[#0a0a0a] shadow-xl sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl"
          role="dialog"
          aria-modal
        >
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-lg font-bold text-white">
              {existingLog ? "Edit logged food" : "Add to log"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-zinc-300">{activeFood.name}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {err && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>
            )}
            <label className="block text-sm font-medium text-zinc-400">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-400">
              Meal
              <select
                value={mealSlot}
                onChange={(e) => setMealSlot(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"
              >
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {MEAL_SLOT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-sm font-medium text-zinc-400">Quantity</span>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-lg font-bold tabular-nums text-white"
                />
                <div className="flex rounded-lg border border-zinc-700 p-0.5">
                  {(["g", "oz"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`rounded-md px-3 py-2 text-sm font-bold ${
                        unit === u ? "bg-[#f97316] text-[#0a0a0a]" : "text-zinc-400"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {preview && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
                <p className="text-xs font-semibold uppercase text-zinc-500">Totals for this amount</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-zinc-500">Calories</dt>
                  <dd className="font-bold tabular-nums text-white">{formatKcal(preview.calories)} kcal</dd>
                  <dt className="text-zinc-500">Protein</dt>
                  <dd className="font-bold tabular-nums text-[#3b82f6]">{formatGrams(preview.protein_g, 1)}g</dd>
                  <dt className="text-zinc-500">Carbs</dt>
                  <dd className="font-bold tabular-nums text-[#eab308]">{formatGrams(preview.carbs_g, 1)}g</dd>
                  <dt className="text-zinc-500">Fat</dt>
                  <dd className="font-bold tabular-nums text-[#f97316]">{formatGrams(preview.fat_g, 1)}g</dd>
                </dl>
              </div>
            )}
          </div>
          <div className="flex gap-3 border-t border-zinc-800 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-600 py-3 text-sm font-semibold text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex-1 rounded-xl bg-[#f97316] py-3 text-sm font-bold text-[#0a0a0a] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
