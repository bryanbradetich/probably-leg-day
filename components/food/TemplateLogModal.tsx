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
          className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-bg shadow-xl"
          role="dialog"
          aria-modal
        >
          <div className="border-b border-theme-border px-5 py-4">
            <h2 className="text-lg font-bold text-theme-text-primary">Log template</h2>
            <p className="mt-1 text-sm text-theme-text-muted">{template.name}</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            {err && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>
            )}
            <label className="block text-sm text-theme-text-muted">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 font-bold text-theme-text-primary"
              />
            </label>
            <label className="block text-sm text-theme-text-muted">
              Meal slot
              <select
                value={mealSlot}
                onChange={(e) => setMealSlot(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 font-bold text-theme-text-primary"
              >
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {MEAL_SLOT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-theme-text-muted">
              Adds {template.meal_template_foods.length} food{template.meal_template_foods.length === 1 ? "" : "s"} to this
              meal.
            </p>
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
              onClick={() => void logAll()}
              disabled={saving}
              className="flex-1 rounded-xl bg-theme-accent py-3 text-sm font-bold text-theme-on-accent disabled:opacity-50"
            >
              {saving ? "Logging…" : "Log all"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
