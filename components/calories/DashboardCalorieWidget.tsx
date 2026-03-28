"use client";

import Link from "next/link";
import { formatKcal } from "@/lib/food-helpers";
import { netCalorieToneClass } from "@/lib/calorie-helpers";

type Props = {
  caloriesIn: number;
  caloriesOut: number;
};

export function DashboardCalorieWidget({ caloriesIn, caloriesOut }: Props) {
  const net = caloriesIn - caloriesOut;
  const tone = netCalorieToneClass(net);
  const colorClass =
    tone === "success" ? "text-theme-success" : tone === "warning" ? "text-theme-warning" : "text-theme-danger";

  return (
    <Link
      href="/calories"
      className="mt-6 block rounded-xl border border-theme-border bg-theme-surface/50 p-5 transition hover:border-theme-accent/60 hover:bg-theme-surface"
    >
      <h2 className="text-lg font-semibold text-theme-text-primary">Calorie balance</h2>
      <p className="mt-1 text-sm text-theme-text-muted">Today · intake vs total burn (TDEE + logged activity)</p>
      <p className={`mt-4 text-4xl font-bold tabular-nums ${colorClass}`}>{net >= 0 ? "+" : ""}
        {formatKcal(net)} kcal
      </p>
      <p className="mt-1 text-xs text-theme-text-muted">Net calories</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-theme-text-muted">Calories in</dt>
          <dd className="font-medium tabular-nums text-theme-text-primary">{formatKcal(caloriesIn)} kcal</dd>
        </div>
        <div>
          <dt className="text-theme-text-muted">Calories out</dt>
          <dd className="font-medium tabular-nums text-theme-text-primary">{formatKcal(caloriesOut)} kcal</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm font-medium text-theme-accent">Open calorie balance →</p>
    </Link>
  );
}
