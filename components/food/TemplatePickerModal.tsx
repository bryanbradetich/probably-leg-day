"use client";

import { useMemo, useState } from "react";
import type { TemplateWithFoods } from "./TemplateLogModal";
import { scaledNutrients, sumNutrients, formatKcal } from "@/lib/food-helpers";

type Props = {
  open: boolean;
  onClose: () => void;
  templates: TemplateWithFoods[];
  onPick: (t: TemplateWithFoods) => void;
};

export function TemplatePickerModal({ open, onClose, templates, onPick }: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return templates;
    return templates.filter((x) => x.name.toLowerCase().includes(t));
  }, [templates, q]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-theme-border bg-theme-bg shadow-xl">
          <div className="border-b border-theme-border px-5 py-4">
            <h2 className="text-lg font-bold text-theme-text-primary">Choose meal template</h2>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search templates…"
              className="mt-3 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-sm text-theme-text-primary"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-theme-text-muted">No templates yet. Create one under Meal Templates.</li>
            ) : (
              filtered.map((t) => {
                const nuts = sumNutrients(
                  t.meal_template_foods.map((line) =>
                    scaledNutrients(line.foods, Number(line.quantity), line.serving_unit)
                  )
                );
                return (
                  <li key={t.id} className="border-b border-theme-border/80">
                    <button
                      type="button"
                      onClick={() => onPick(t)}
                      className="flex w-full flex-col items-start gap-1 px-5 py-3 text-left hover:bg-theme-surface/80"
                    >
                      <span className="font-bold text-theme-text-primary">{t.name}</span>
                      <span className="text-xs text-theme-text-muted">
                        {t.meal_template_foods.length} items · {formatKcal(nuts.calories)} kcal · P {nuts.protein_g.toFixed(0)}g
                        · C {nuts.carbs_g.toFixed(0)}g · F {nuts.fat_g.toFixed(0)}g
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-theme-border px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-theme-border/80 py-2.5 text-sm font-semibold text-theme-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
