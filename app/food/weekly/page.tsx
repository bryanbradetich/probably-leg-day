"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ChartCard, ChartTooltip, CHART } from "@/components/charts";
import { scaledNutrients, sumNutrients, formatKcal, macroCaloriesFromGrams } from "@/lib/food-helpers";
import { addDays, mondayOfWeek, localISODate, formatShortDate, dayOfWeekLabel } from "@/lib/weight-helpers";
import type { DailyFoodLogWithFood, DailyWeight, NutritionGoal, ProfileCalorieFields, WeightGoal } from "@/types";
import {
  computeBmrTdeeForDate,
  profileBmrFieldsComplete,
  weightForDate,
} from "@/lib/calorie-helpers";
import {
  getDynamicCaloricTarget,
  isActiveLossWeightGoal,
  nutritionCalorieMode,
} from "@/lib/calories";

const MACRO_COLORS = {
  protein: "var(--macro-protein)",
  carbs: "var(--macro-carbs)",
  fat: "var(--macro-fat)",
};

export default function FoodWeeklyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [weekMonday, setWeekMonday] = useState(() => mondayOfWeek(localISODate()));
  const [logs, setLogs] = useState<DailyFoodLogWithFood[]>([]);
  const [profileCal, setProfileCal] = useState<ProfileCalorieFields | null>(null);
  const [weights, setWeights] = useState<DailyWeight[]>([]);
  const [weightGoal, setWeightGoal] = useState<WeightGoal | null>(null);
  const [weekBurns, setWeekBurns] = useState<{ logged_date: string; calories_burned: number }[]>([]);

  const weekEnd = useMemo(() => addDays(weekMonday, 6), [weekMonday]);

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

    const [
      { data: g, error: gErr },
      { data, error: e },
      { data: prof, error: pErr },
      { data: dw, error: wErr },
      { data: wg, error: wgErr },
      { data: burns, error: bErr },
    ] = await Promise.all([
      supabase.from("nutrition_goals").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("daily_food_logs")
        .select("*, foods(*)")
        .eq("user_id", user.id)
        .gte("logged_date", weekMonday)
        .lte("logged_date", weekEnd)
        .order("logged_date"),
      supabase
        .from("profiles")
        .select("height_cm, date_of_birth, biological_sex, activity_level, custom_activity_multiplier")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("daily_weights")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_date", { ascending: false })
        .limit(500),
      supabase.from("weight_goals").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("calorie_burns")
        .select("logged_date, calories_burned")
        .eq("user_id", user.id)
        .gte("logged_date", weekMonday)
        .lte("logged_date", weekEnd),
    ]);

    const firstErr = gErr ?? e ?? pErr ?? wErr ?? wgErr ?? bErr;
    if (firstErr) {
      setError(firstErr.message);
      setLoading(false);
      return;
    }

    setGoal(g as NutritionGoal | null);
    setLogs((data ?? []) as DailyFoodLogWithFood[]);
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
    setWeights((dw ?? []) as DailyWeight[]);
    setWeightGoal((wg ?? null) as WeightGoal | null);
    setWeekBurns(
      (burns ?? []).map((r) => ({
        logged_date: (r as { logged_date: string }).logged_date,
        calories_burned: Number((r as { calories_burned: number }).calories_burned),
      }))
    );
    setLoading(false);
  }, [router, weekMonday, weekEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const m: Record<string, DailyFoodLogWithFood[]> = {};
    for (let i = 0; i < 7; i++) {
      m[addDays(weekMonday, i)] = [];
    }
    for (const row of logs) {
      if (!m[row.logged_date]) m[row.logged_date] = [];
      m[row.logged_date].push(row);
    }
    return m;
  }, [logs, weekMonday]);

  const burnsByDate = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of weekBurns) {
      m[r.logged_date] = (m[r.logged_date] ?? 0) + r.calories_burned;
    }
    return m;
  }, [weekBurns]);

  const dayRows = useMemo(() => {
    const profileOk = profileCal && profileBmrFieldsComplete(profileCal);
    const rows: {
      iso: string;
      label: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      calorieTarget: number;
      vsGoal: number;
      over: boolean;
      totalBurn: number | null;
      net: number | null;
      hasFoodLogs: boolean;
    }[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDays(weekMonday, i);
      const dayLogs = byDay[iso] ?? [];
      const hasFoodLogs = dayLogs.length > 0;
      const t = sumNutrients(dayLogs.map((r) => scaledNutrients(r.foods, Number(r.quantity), r.serving_unit)));
      const energy = profileOk ? computeBmrTdeeForDate(profileCal, weights, iso) : null;
      const tdee = energy?.tdee ?? null;
      const extraBurns = burnsByDate[iso] ?? 0;
      const totalBurn =
        tdee != null && Number.isFinite(tdee) ? tdee + extraBurns : null;

      let calorieTarget = 0;
      if (goal) {
        const mode = nutritionCalorieMode(goal);
        const tdeeNum = tdee ?? 0;
        const wKg = weightForDate(weights, iso)?.weightKg ?? null;
        if (mode === "dynamic" && tdeeNum > 0) {
          calorieTarget = getDynamicCaloricTarget({
            TDEE: tdeeNum,
            additionalBurns: extraBurns,
            activeWeightGoal:
              weightGoal && isActiveLossWeightGoal(weightGoal, wKg) ? weightGoal : null,
            currentWeightKg: wKg,
            nutritionGoal: goal,
          });
        } else {
          calorieTarget = Number(goal.daily_calories);
        }
      }

      const vs = goal && calorieTarget > 0 ? t.calories - calorieTarget : 0;
      const over = !!(goal && calorieTarget > 0 && t.calories > calorieTarget + 0.5);
      const net = totalBurn != null ? t.calories - totalBurn : null;

      rows.push({
        iso,
        label: dayOfWeekLabel(iso),
        calories: t.calories,
        protein_g: t.protein_g,
        carbs_g: t.carbs_g,
        fat_g: t.fat_g,
        calorieTarget,
        vsGoal: vs,
        over,
        totalBurn,
        net,
        hasFoodLogs,
      });
    }
    return rows;
  }, [byDay, weekMonday, goal, profileCal, weights, weightGoal, burnsByDate]);

  const weekTotals = useMemo(() => {
    return sumNutrients(
      logs.map((r) => scaledNutrients(r.foods, Number(r.quantity), r.serving_unit))
    );
  }, [logs]);

  const weekAvg = useMemo(() => {
    const n = 7;
    return {
      calories: weekTotals.calories / n,
      protein_g: weekTotals.protein_g / n,
      carbs_g: weekTotals.carbs_g / n,
      fat_g: weekTotals.fat_g / n,
    };
  }, [weekTotals]);

  const weekAvgNet = useMemo(() => {
    const vals: number[] = [];
    for (const r of dayRows) {
      if (!r.hasFoodLogs || r.net == null) continue;
      vals.push(r.net);
    }
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [dayRows]);

  const barData = useMemo(() => {
    return dayRows.map((r) => ({
      name: r.label.slice(0, 3),
      fullDate: r.iso,
      calories: Math.round(r.calories),
      goal: Math.round(r.calorieTarget),
    }));
  }, [dayRows]);

  const pieData = useMemo(() => {
    const { protein_cal, carbs_cal, fat_cal } = macroCaloriesFromGrams(
      weekTotals.protein_g,
      weekTotals.carbs_g,
      weekTotals.fat_g
    );
    const total = protein_cal + carbs_cal + fat_cal;
    if (total <= 0) return [];
    return [
      { name: "Protein", value: protein_cal, color: MACRO_COLORS.protein },
      { name: "Carbs", value: carbs_cal, color: MACRO_COLORS.carbs },
      { name: "Fat", value: fat_cal, color: MACRO_COLORS.fat },
    ];
  }, [weekTotals]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text-primary">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <ErrorState message={error ?? "Session expired."} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Weekly summary"
          description="Macros by day, net calorie balance (intake vs TDEE + logged activity), and intake vs your calorie target."
        />

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/food" className="font-medium text-theme-accent hover:underline">
            Today&apos;s log
          </Link>
          <span className="text-theme-text-muted/80">·</span>
          <Link href="/food/library" className="font-medium text-theme-accent hover:underline">
            Food library
          </Link>
        </div>

        {!goal && (
          <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Set a nutrition goal on the{" "}
            <Link href="/food" className="font-semibold underline">
              food log
            </Link>{" "}
            page to see “vs goal” columns and chart targets.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekMonday((w) => addDays(w, -7))}
              className="rounded-lg border border-theme-border px-3 py-2 text-sm font-bold text-theme-text-primary hover:bg-theme-border/90"
            >
              ← Prev week
            </button>
            <button
              type="button"
              onClick={() => setWeekMonday((w) => addDays(w, 7))}
              className="rounded-lg border border-theme-border px-3 py-2 text-sm font-bold text-theme-text-primary hover:bg-theme-border/90"
            >
              Next week →
            </button>
          </div>
          <p className="text-sm font-bold text-theme-text-muted">
            {formatShortDate(weekMonday)} – {formatShortDate(weekEnd)}
          </p>
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl border border-theme-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-theme-border bg-theme-surface text-theme-text-muted">
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 font-semibold">Calories</th>
                <th className="px-3 py-2 font-semibold">Protein</th>
                <th className="px-3 py-2 font-semibold">Carbs</th>
                <th className="px-3 py-2 font-semibold">Fat</th>
                <th className="px-3 py-2 font-semibold">Net (in − burned)</th>
                {goal && <th className="px-3 py-2 font-semibold">vs goal</th>}
              </tr>
            </thead>
            <tbody>
              {dayRows.map((r) => (
                <tr key={r.iso} className="border-b border-theme-border/80 bg-theme-input-bg/50">
                  <td className="px-3 py-2 font-bold text-theme-text-primary">
                    {r.label} <span className="text-xs font-normal text-theme-text-muted">({formatShortDate(r.iso)})</span>
                  </td>
                  <td
                    className={`px-3 py-2 font-bold tabular-nums ${
                      goal && r.over ? "text-theme-danger" : "text-theme-text-primary"
                    }`}
                  >
                    {formatKcal(r.calories)}
                  </td>
                  <td className="px-3 py-2 font-bold tabular-nums text-theme-macro-protein">{r.protein_g.toFixed(0)}g</td>
                  <td className="px-3 py-2 font-bold tabular-nums text-theme-macro-carbs">{r.carbs_g.toFixed(0)}g</td>
                  <td className="px-3 py-2 font-bold tabular-nums text-theme-accent">{r.fat_g.toFixed(0)}g</td>
                  <td className="px-3 py-2 font-bold tabular-nums">
                    {r.net != null && Math.abs(r.net) >= 0.5 ? (
                      <span className={r.net < 0 ? "text-theme-success" : "text-theme-accent"}>
                        {r.net < 0 ? `-${formatKcal(Math.abs(r.net))}` : `+${formatKcal(r.net)}`}
                      </span>
                    ) : (
                      <span className="text-theme-text-muted">—</span>
                    )}
                  </td>
                  {goal && (
                    <td
                      className={`px-3 py-2 font-bold tabular-nums ${
                        r.over ? "text-theme-danger" : "text-theme-success"
                      }`}
                    >
                      {r.calorieTarget > 0
                        ? r.vsGoal > 0.5
                          ? `+${formatKcal(r.vsGoal)} over`
                          : r.vsGoal < -0.5
                            ? `${formatKcal(Math.abs(r.vsGoal))} under`
                            : "At goal"
                        : "—"}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="bg-theme-surface/90">
                <td className="px-3 py-3 font-bold text-theme-text-primary">Week avg / day</td>
                <td className="px-3 py-3 font-bold tabular-nums text-theme-text-primary">{formatKcal(weekAvg.calories)}</td>
                <td className="px-3 py-3 font-bold tabular-nums text-theme-macro-protein">{weekAvg.protein_g.toFixed(0)}g</td>
                <td className="px-3 py-3 font-bold tabular-nums text-theme-macro-carbs">{weekAvg.carbs_g.toFixed(0)}g</td>
                <td className="px-3 py-3 font-bold tabular-nums text-theme-accent">{weekAvg.fat_g.toFixed(0)}g</td>
                <td className="px-3 py-3 font-bold tabular-nums">
                  {weekAvgNet != null && Math.abs(weekAvgNet) >= 0.5 ? (
                    <span className={weekAvgNet < 0 ? "text-theme-success" : "text-theme-accent"}>
                      {weekAvgNet < 0 ? `-${formatKcal(Math.abs(weekAvgNet))}` : `+${formatKcal(weekAvgNet)}`}
                    </span>
                  ) : (
                    <span className="text-theme-text-muted">—</span>
                  )}
                </td>
                {goal && <td className="px-3 py-3 text-theme-text-muted">—</td>}
              </tr>
              <tr className="bg-theme-surface">
                <td className="px-3 py-3 font-bold text-theme-text-primary">Week totals</td>
                <td className="px-3 py-3 font-bold tabular-nums text-theme-text-primary">{formatKcal(weekTotals.calories)}</td>
                <td className="px-3 py-3 font-bold tabular-nums text-theme-macro-protein">{weekTotals.protein_g.toFixed(0)}g</td>
                <td className="px-3 py-3 font-bold tabular-nums text-theme-macro-carbs">{weekTotals.carbs_g.toFixed(0)}g</td>
                <td className="px-3 py-3 font-bold tabular-nums text-theme-accent">{weekTotals.fat_g.toFixed(0)}g</td>
                <td className="px-3 py-3 text-theme-text-muted">—</td>
                {goal && <td className="px-3 py-3 text-theme-text-muted">—</td>}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Daily calories vs goal" empty={!goal} emptyMessage="Set a nutrition goal to see targets.">
            {goal && (
              <div className="h-72 w-full min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: CHART.axis, fontSize: 12 }} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 12 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        const row = payload?.[0]?.payload as { fullDate?: string } | undefined;
                        return (
                          <ChartTooltip
                            active={active}
                            payload={payload}
                            label={row?.fullDate ? formatShortDate(row.fullDate) : label}
                            formatter={(v, name) =>
                              name === "Goal" ? `${v} kcal goal` : `${v} kcal logged`
                            }
                          />
                        );
                      }}
                    />
                    <Bar dataKey="calories" name="Logged" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    <Bar dataKey="goal" name="Goal" fill="var(--border)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Week macro mix (by calories)"
            empty={pieData.length === 0}
            emptyMessage="Log food this week to see the chart."
          >
            {pieData.length > 0 && (
              <div className="h-72 w-full min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={96}
                      paddingAngle={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="var(--surface)" />
                      ))}
                    </Pie>
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v, name) => {
                            const t = pieData.reduce((a, x) => a + x.value, 0);
                            const pct = t > 0 ? ((v / t) * 100).toFixed(0) : "0";
                            return `${name}: ${Math.round(v)} kcal (${pct}%)`;
                          }}
                        />
                      }
                    />
                    <Legend
                      wrapperStyle={{ color: CHART.axis }}
                      formatter={(value) => <span className="text-theme-text-muted">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
