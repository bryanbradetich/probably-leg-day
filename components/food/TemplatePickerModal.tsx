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
        <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-800 bg-[#0a0a0a] shadow-xl">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-lg font-bold text-white">Choose meal template</h2>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search templates…"
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-zinc-500">No templates yet. Create one under Meal Templates.</li>
            ) : (
              filtered.map((t) => {
                const nuts = sumNutrients(
                  t.meal_template_foods.map((line) =>
                    scaledNutrients(line.foods, Number(line.quantity), line.serving_unit)
                  )
                );
                return (
                  <li key={t.id} className="border-b border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => onPick(t)}
                      className="flex w-full flex-col items-start gap-1 px-5 py-3 text-left hover:bg-zinc-900/80"
                    >
                      <span className="font-bold text-white">{t.name}</span>
                      <span className="text-xs text-zinc-500">
                        {t.meal_template_foods.length} items · {formatKcal(nuts.calories)} kcal · P {nuts.protein_g.toFixed(0)}g
                        · C {nuts.carbs_g.toFixed(0)}g · F {nuts.fat_g.toFixed(0)}g
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-zinc-800 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-zinc-600 py-2.5 text-sm font-semibold text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
