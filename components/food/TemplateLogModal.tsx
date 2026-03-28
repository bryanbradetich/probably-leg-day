"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Food, MealTemplateFood } from "@/types";
import { MEAL_SLOT_LABELS, MEAL_SLOTS } from "@/lib/food-helpers";

export type TemplateWithFoods = {
  id: string;
  name: string;
  meal_template_foods: (MealTemplateFood & { foods: Food })[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  template: TemplateWithFoods | null;
  userId: string;
  defaultMealSlot: number;
  defaultDate: string;
  onLogged: () => void;
};

export function TemplateLogModal({
  open,
  onClose,
  template,
  userId,
  defaultMealSlot,
  defaultDate,
  onLogged,
}: Props) {
  const [mealSlot, setMealSlot] = useState(defaultMealSlot);
  const [date, setDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMealSlot(defaultMealSlot);
    setDate(defaultDate);
    setErr(null);
  }, [open, defaultMealSlot, defaultDate]);

  if (!open || !template) return null;

  const logAll = async () => {
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const rows = template.meal_template_foods.map((line) => ({
      user_id: userId,
      logged_date: date,
      meal_slot: mealSlot,
      food_id: line.food_id,
      quantity: Number(line.quantity),
      serving_unit: line.serving_unit,
    }));
    const { error } = await supabase.from("daily_food_logs").insert(rows);
    setSaving(false);
    if (error) setErr(error.message);
    else {
      onLogged();
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0a0a0a] shadow-xl"
          role="dialog"
          aria-modal
        >
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-lg font-bold text-white">Log template</h2>
            <p className="mt-1 text-sm text-zinc-400">{template.name}</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            {err && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>
            )}
            <label className="block text-sm text-zinc-400">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-bold text-white"
              />
            </label>
            <label className="block text-sm text-zinc-400">
              Meal slot
              <select
                value={mealSlot}
                onChange={(e) => setMealSlot(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-bold text-white"
              >
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {MEAL_SLOT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-zinc-500">
              Adds {template.meal_template_foods.length} food{template.meal_template_foods.length === 1 ? "" : "s"} to this
              meal.
            </p>
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
              onClick={() => void logAll()}
              disabled={saving}
              className="flex-1 rounded-xl bg-[#f97316] py-3 text-sm font-bold text-[#0a0a0a] disabled:opacity-50"
            >
              {saving ? "Logging…" : "Log all"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
