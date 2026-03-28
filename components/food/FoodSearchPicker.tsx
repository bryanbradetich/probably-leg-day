"use client";

import { useMemo, useState } from "react";
import type { Food } from "@/types";
import { formatKcal } from "@/lib/food-helpers";

export function FoodSearchPicker({
  foods,
  onSelect,
  excludeIds,
  placeholder = "Search foods…",
  autoFocus,
  /** When true, hide the results list until the user types a non-empty query. */
  resultsOnlyWhenTyping = false,
}: {
  foods: Food[];
  onSelect: (f: Food) => void;
  excludeIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  resultsOnlyWhenTyping?: boolean;
}) {
  const [q, setQ] = useState("");
  const ex = excludeIds ?? [];
  const hasQuery = q.trim().length > 0;

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return foods.filter((f) => {
      if (ex.includes(f.id)) return false;
      if (!t) return !resultsOnlyWhenTyping;
      const name = f.name.toLowerCase();
      const brand = (f.brand ?? "").toLowerCase();
      return name.includes(t) || brand.includes(t);
    });
  }, [foods, q, ex, resultsOnlyWhenTyping]);

  const showList = !resultsOnlyWhenTyping || hasQuery;

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#f97316] focus:outline-none"
      />
      {showList && (
      <ul className="max-h-56 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80">
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">No matches</li>
        ) : (
          filtered.map((f) => (
            <li key={f.id} className="border-b border-zinc-800/80 last:border-0">
              <button
                type="button"
                onClick={() => onSelect(f)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-800/80"
              >
                <span className="font-bold text-white">{f.name}</span>
                <span className="text-xs text-zinc-500">
                  {f.brand ? `${f.brand} · ` : ""}
                  {formatKcal(Number(f.calories))} kcal / {Number(f.serving_size)}
                  {f.serving_unit}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
      )}
    </div>
  );
}
