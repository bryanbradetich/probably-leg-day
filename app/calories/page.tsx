"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { CHART, ChartTooltip } from "@/components/charts";
import { LogActivitySlideOver } from "@/components/calories/LogActivitySlideOver";
import { kgToLbs } from "@/lib/units";
import { scaledNutrients, sumNutrients, formatKcal } from "@/lib/food-helpers";
import { localISODate, parseISODate } from "@/lib/weight-helpers";
import type { CalorieBurn, DailyFoodLogWithFood, DailyWeight, NutritionGoal, ProfileCalorieFields } from "@/types";
import {
  activityLevelLabel,
  computeBmrTdeeForDate,
  lastNDatesInclusive,
  netCalorieToneClass,
  profileBmrFieldsComplete,
} from "@/lib/calorie-helpers";

const QUICK_ACTIVITIES = ["Walking", "Running", "Cycling", "Swimming", "HIIT"] as const;

export default function CaloriesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => localISODate());

  const [profile, setProfile] = useState<ProfileCalorieFields | null>(null);
  const [weights, setWeights] = useState<DailyWeight[]>([]);
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal | null>(null);
  const [foodRows, setFoodRows] = useState<DailyFoodLogWithFood[]>([]);
  const [burnRows, setBurnRows] = useState<CalorieBurn[]>([]);
  const [weekSeries, setWeekSeries] = useState<
    { date: string; label: string; net: number; targetNet: number | null }[]
  >([]);

  const [logOpen, setLogOpen] = useState(false);
  const [presetActivity, setPresetActivity] = useState("");
  const [presetDate, setPresetDate] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    setError(null);

    const { data: prof } = await supabase
      .from("profiles")
      .select("height_cm, date_of_birth, biological_sex, activity_level, custom_activity_multiplier")
      .eq("id", user.id)
      .maybeSingle();

    const p = prof as Partial<ProfileCalorieFields> | null;
    const fullProfile: ProfileCalorieFields | null =
      p && user
        ? {
            id: user.id,
            height_cm: p.height_cm ?? null,
            date_of_birth: p.date_of_birth ?? null,
            biological_sex: (p.biological_sex as ProfileCalorieFields["biological_sex"]) ?? null,
            activity_level: (p.activity_level as ProfileCalorieFields["activity_level"]) ?? "sedentary",
            custom_activity_multiplier: p.custom_activity_multiplier ?? null,
          }
        : null;
    setProfile(fullProfile);

    const { data: dw } = await supabase
      .from("daily_weights")
      .select("*")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(500);
    const wlist = (dw ?? []) as DailyWeight[];
    setWeights(wlist);

    const { data: ng } = await supabase.from("nutrition_goals").select("*").eq("user_id", user.id).maybeSingle();
    setNutritionGoal(ng as NutritionGoal | null);

    const { data: food } = await supabase
      .from("daily_food_logs")
      .select("*, foods(*)")
      .eq("user_id", user.id)
      .eq("logged_date", selectedDate);
    setFoodRows((food ?? []) as DailyFoodLogWithFood[]);

    const { data: burns } = await supabase
      .from("calorie_burns")
      .select("*")
      .eq("user_id", user.id)
      .eq("logged_date", selectedDate)
      .order("created_at", { ascending: false });
    setBurnRows((burns ?? []) as CalorieBurn[]);

    const range = lastNDatesInclusive(selectedDate, 7);
    const { data: foodWeek } = await supabase
      .from("daily_food_logs")
      .select("*, foods(*)")
      .eq("user_id", user.id)
      .in("logged_date", range);
    const { data: burnsWeek } = await supabase
      .from("calorie_burns")
      .select("*")
      .eq("user_id", user.id)
      .in("logged_date", range);

    const foodByDate: Record<string, DailyFoodLogWithFood[]> = {};
    for (const r of (foodWeek ?? []) as DailyFoodLogWithFood[]) {
      const d = r.logged_date;
      if (!foodByDate[d]) foodByDate[d] = [];
      foodByDate[d].push(r);
    }
    const burnsByDate: Record<string, CalorieBurn[]> = {};
    for (const b of (burnsWeek ?? []) as CalorieBurn[]) {
      const d = b.logged_date;
      if (!burnsByDate[d]) burnsByDate[d] = [];
      burnsByDate[d].push(b);
    }

    const goalCal = ng ? Number((ng as NutritionGoal).daily_calories) : null;
    const series: { date: string; label: string; net: number; targetNet: number | null }[] = [];
    if (fullProfile && profileBmrFieldsComplete(fullProfile)) {
      for (const d of range) {
        const meta = computeBmrTdeeForDate(fullProfile, wlist, d);
        const cin = sumNutrients(
          (foodByDate[d] ?? []).map((row) => scaledNutrients(row.foods, Number(row.quantity), row.serving_unit))
        ).calories;
        const extra = (burnsByDate[d] ?? []).reduce((s, x) => s + Number(x.calories_burned), 0);
        const tdee = meta?.tdee ?? 0;
        const net = meta ? cin - (tdee + extra) : 0;
        const targetNet =
          meta != null && goalCal != null && Number.isFinite(goalCal) ? goalCal - (tdee + extra) : null;
        const dt = parseISODate(d);
        const label = dt.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
        series.push({ date: d, label, net, targetNet });
      }
    }
    setWeekSeries(series);
  }, [user, selectedDate]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user: u }, error: ue } = await supabase.auth.getUser();
      if (ue) {
        setError("Could not load your session.");
        setLoading(false);
        return;
      }
      if (!u) {
        router.replace("/auth/login");
        setLoading(false);
        return;
      }
      setUser(u);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const caloriesIn = useMemo(
    () => sumNutrients(foodRows.map((r) => scaledNutrients(r.foods, Number(r.quantity), r.serving_unit))).calories,
    [foodRows]
  );

  const additionalBurns = useMemo(
    () => burnRows.reduce((s, r) => s + Number(r.calories_burned), 0),
    [burnRows]
  );

  const energy = useMemo(() => {
    if (!profile || !profileBmrFieldsComplete(profile)) return null;
    return computeBmrTdeeForDate(profile, weights, selectedDate);
  }, [profile, weights, selectedDate]);

  const tdee = energy?.tdee ?? 0;
  const totalBurned = tdee + additionalBurns;
  const net = caloriesIn - totalBurned;
  const netTone = netCalorieToneClass(net);
  const netColorClass =
    netTone === "success" ? "text-theme-success" : netTone === "warning" ? "text-theme-warning" : "text-theme-danger";

  const deleteBurn = async (id: string) => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("calorie_burns").delete().eq("id", id).eq("user_id", user.id);
    load();
  };

  const openLog = (name?: string, date?: string) => {
    setPresetActivity(name ?? "");
    setPresetDate(date);
    setLogOpen(true);
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text-primary">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const profileReady = profile && profileBmrFieldsComplete(profile);

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Calorie balance"
          description="Intake, estimated burn (BMR × activity), and logged activity for each day."
        />

        {!profileReady && (
          <div
            className="mt-6 rounded-xl border border-theme-border p-5"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <p className="text-theme-text-primary">
              Complete your height, date of birth, biological sex, and activity level on your{" "}
              <Link href="/profile" className="font-semibold text-theme-accent hover:underline">
                Profile
              </Link>{" "}
              to unlock calorie balance and TDEE.
            </p>
          </div>
        )}

        {profileReady && !energy && (
          <div
            className="mt-6 rounded-xl border border-theme-border p-5"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <p className="text-theme-text-muted">
              Add a weight entry on or before {selectedDate} on the{" "}
              <Link href="/weight" className="font-medium text-theme-accent hover:underline">
                Weight
              </Link>{" "}
              page to estimate BMR and TDEE for this day.
            </p>
          </div>
        )}

        {profileReady && energy && (
          <>
            <section
              className="mt-6 rounded-xl border border-theme-border p-5 sm:p-6"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-theme-text-primary">Daily summary</h2>
                  <label className="mt-2 block text-sm text-theme-text-muted">Date</label>
                  <input
                    type="date"
                    className="mt-1 rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
                    style={{ backgroundColor: "var(--input-bg)" }}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-8 text-center sm:text-left">
                <p className="text-sm font-medium text-theme-text-muted">Net calories</p>
                <p className={`mt-1 text-5xl font-bold tabular-nums ${netColorClass}`}>
                  {net >= 0 ? "+" : ""}
                  {formatKcal(net)} kcal
                </p>
                <p className="mt-2 text-xs text-theme-text-muted">
                  Green: surplus at most 200 kcal · Yellow: 201–500 kcal over · Red: more than 500 kcal over (vs neutral
                  balance).
                </p>
              </div>

              <dl className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-theme-border p-3" style={{ backgroundColor: "var(--bg)" }}>
                  <dt className="text-theme-text-muted">Calories in</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-theme-text-primary">
                    {formatKcal(caloriesIn)} kcal
                  </dd>
                </div>
                <div className="rounded-lg border border-theme-border p-3" style={{ backgroundColor: "var(--bg)" }}>
                  <dt className="text-theme-text-muted">BMR</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-theme-text-primary">
                    {formatKcal(energy.bmr)} kcal
                  </dd>
                </div>
                <div className="rounded-lg border border-theme-border p-3" style={{ backgroundColor: "var(--bg)" }}>
                  <dt className="text-theme-text-muted">TDEE (BMR × activity)</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-theme-text-primary">
                    {formatKcal(tdee)} kcal
                  </dd>
                </div>
                <div className="rounded-lg border border-theme-border p-3" style={{ backgroundColor: "var(--bg)" }}>
                  <dt className="text-theme-text-muted">Additional burns (logged)</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-theme-text-primary">
                    {formatKcal(additionalBurns)} kcal
                  </dd>
                </div>
                <div
                  className="rounded-lg border border-theme-border p-3 sm:col-span-2"
                  style={{ backgroundColor: "var(--bg)" }}
                >
                  <dt className="text-theme-text-muted">Total calories burned (TDEE + additional)</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-theme-text-primary">
                    {formatKcal(totalBurned)} kcal
                  </dd>
                </div>
              </dl>
            </section>

            <section
              className="mt-8 rounded-xl border border-theme-border p-5 sm:p-6"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-theme-text-primary">Calorie burns log</h2>
                <button
                  type="button"
                  onClick={() => openLog("", selectedDate)}
                  className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-theme-on-accent hover:bg-theme-accent-hover"
                >
                  Log activity
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_ACTIVITIES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => openLog(name, selectedDate)}
                    className="rounded-lg border border-theme-border px-3 py-1.5 text-sm text-theme-text-muted transition hover:border-theme-accent/60 hover:text-theme-text-primary"
                    style={{ backgroundColor: "var(--input-bg)" }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {burnRows.length === 0 ? (
                <p className="mt-4 text-sm text-theme-text-muted">No activities logged for this date.</p>
              ) : (
                <ul className="mt-4 divide-y divide-theme-border rounded-lg border border-theme-border">
                  {burnRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"
                      style={{ backgroundColor: "var(--bg)" }}
                    >
                      <div>
                        <p className="font-medium text-theme-text-primary">{row.activity_name}</p>
                        <p className="text-sm text-theme-text-muted">
                          {row.duration_minutes != null ? `${row.duration_minutes} min · ` : ""}
                          {formatKcal(Number(row.calories_burned))} kcal
                          {row.notes ? ` · ${row.notes}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteBurn(row.id)}
                        className="text-sm font-medium text-theme-danger hover:underline"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="mt-8 rounded-xl border border-theme-border p-5 sm:p-6"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <h2 className="text-lg font-semibold text-theme-text-primary">Weekly overview</h2>
              <p className="mt-1 text-sm text-theme-text-muted">
                Net calories for the 7 days ending on the selected date. Bars:{" "}
                <span style={{ color: "var(--accent)" }}>orange</span> = net deficit,{" "}
                <span style={{ color: "var(--danger)" }}>red</span> = net surplus. Gray dashed: 0 kcal (energy balance).
                {nutritionGoal ? (
                  <>
                    {" "}
                    Gray line: net you would have at your{" "}
                    {formatKcal(nutritionGoal.daily_calories)} kcal/day intake goal (same burn per day).
                  </>
                ) : null}
              </p>
              <div className="mt-4 h-64 w-full min-h-[240px]">
                {weekSeries.length === 0 ? (
                  <p className="py-12 text-center text-sm text-theme-text-muted">Not enough data for this week.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weekSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                      <Tooltip
                        content={
                          <ChartTooltip
                            formatter={(v, name) => `${String(name ?? "")}: ${formatKcal(v)} kcal`}
                            labelFormatter={(l) => String(l)}
                          />
                        }
                      />
                      <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                      {nutritionGoal ? (
                        <Line
                          type="monotone"
                          dataKey="targetNet"
                          stroke="var(--chart-secondary)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "var(--chart-secondary)" }}
                          name="Net at intake goal"
                          connectNulls
                        />
                      ) : null}
                      <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Net kcal">
                        {weekSeries.map((entry) => (
                          <Cell
                            key={entry.date}
                            fill={entry.net < 0 ? "var(--accent)" : entry.net > 0 ? "var(--danger)" : "var(--success)"}
                          />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section
              className="mt-8 rounded-xl border border-theme-border p-5 sm:p-6"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <h2 className="text-lg font-semibold text-theme-text-primary">BMR &amp; TDEE breakdown</h2>
              <ul className="mt-4 space-y-3 text-sm text-theme-text-primary">
                <li>
                  Your BMR: <strong className="tabular-nums">{formatKcal(energy.bmr)} kcal</strong> (calories your body
                  burns at rest)
                </li>
                <li>
                  Activity multiplier: <strong>{energy.multiplier}×</strong> ({activityLevelLabel(profile!.activity_level)})
                </li>
                <li>
                  Your TDEE: <strong className="tabular-nums">{formatKcal(energy.tdee)} kcal</strong> (estimated daily
                  burn without extra logged exercise)
                </li>
                <li>
                  Additional burns today: <strong className="tabular-nums">{formatKcal(additionalBurns)} kcal</strong>
                </li>
                <li>
                  Total estimated burn: <strong className="tabular-nums">{formatKcal(totalBurned)} kcal</strong>
                </li>
              </ul>
              <p className="mt-4 text-sm text-theme-text-muted">
                <Link href="/profile" className="font-medium text-theme-accent hover:underline">
                  Update activity level on Profile
                </Link>
              </p>
              <p className="mt-2 text-sm text-theme-text-muted">
                Weight used for calculation:{" "}
                <strong className="text-theme-text-primary">
                  {kgToLbs(energy.weightKg)?.toFixed(1) ?? "—"} lbs
                </strong>{" "}
                (from your weight log on {energy.weightLoggedDate})
              </p>
            </section>
          </>
        )}

        <LogActivitySlideOver
          open={logOpen}
          onClose={() => setLogOpen(false)}
          userId={user.id}
          defaultActivityName={presetActivity}
          defaultDate={presetDate}
          onSaved={load}
        />
      </div>
    </div>
  );
}
