"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { kgToLbs } from "@/lib/units";
import {
  addDays,
  defaultTrajectoryStart,
  effectiveEndDate,
  linearTargetKg,
  localISODate,
  mondayOfWeek,
  sundayOfWeekFromMonday,
} from "@/lib/weight-helpers";
import type { DailyFoodLogWithFood, DailyWeight, NutritionGoal, ProfileCalorieFields, WeightGoal } from "@/types";
import { DashboardFoodWidget } from "@/components/food/DashboardFoodWidget";
import { DashboardCalorieWidget } from "@/components/calories/DashboardCalorieWidget";
import { scaledNutrients, sumNutrients } from "@/lib/food-helpers";
import { computeBmrTdeeForDate, profileBmrFieldsComplete } from "@/lib/calorie-helpers";
import { useTheme } from "@/components/ThemeProvider";

type WeightWidget = {
  currentLbs: number;
  weekAvgLbs: number | null;
  weekVsLastLbs: number | null;
  goalLbs: number | null;
  lbsRemaining: number | null;
  onTrack: boolean | null;
};

export default function DashboardPage() {
  const { themeName } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedToday, setLoggedToday] = useState(false);
  const [weightWidget, setWeightWidget] = useState<WeightWidget | null>(null);
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal | null>(null);
  const [foodTotalsToday, setFoodTotalsToday] = useState<{
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null>(null);
  const [calorieBalance, setCalorieBalance] = useState<{ in: number; out: number } | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user: u }, error: userError } = await supabase.auth.getUser();
      if (userError) {
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

      const today = new Date().toISOString().slice(0, 10);
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", u.id)
        .eq("is_draft", false)
        .not("completed_at", "is", null)
        .gte("completed_at", `${today}T00:00:00Z`)
        .lt("completed_at", `${today}T23:59:59.999Z`)
        .limit(1);
      setLoggedToday((logs?.length ?? 0) > 0);

      const { data: dwRows, error: dwErr } = await supabase
        .from("daily_weights")
        .select("*")
        .eq("user_id", u.id)
        .order("logged_date", { ascending: false })
        .limit(400);
      const { data: wgRow, error: wgErr } = await supabase
        .from("weight_goals")
        .select("*")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!dwErr && (dwRows?.length ?? 0) > 0) {
        const list = (dwRows ?? []) as DailyWeight[];
        const asc = [...list].sort((a, b) => a.logged_date.localeCompare(b.logged_date));
        const latest = asc[asc.length - 1];
        const curLbs = kgToLbs(Number(latest.weight_kg));
        if (curLbs != null) {
          const byDate: Record<string, DailyWeight> = {};
          for (const r of list) {
            byDate[r.logged_date] = r;
          }
          const today = localISODate();
          const thisMon = mondayOfWeek(today);
          const lastMon = addDays(thisMon, -7);
          const lastSun = sundayOfWeekFromMonday(lastMon);

          const avgForRange = (from: string, to: string) => {
            let s = 0;
            let n = 0;
            for (let d = from; d <= to; d = addDays(d, 1)) {
              const e = byDate[d];
              if (e) {
                s += Number(e.weight_kg);
                n += 1;
              }
            }
            if (n === 0) return null;
            const kg = s / n;
            return kgToLbs(kg);
          };

          const weekAvgLbs = avgForRange(thisMon, today);
          const lastWeekAvgLbs = avgForRange(lastMon, lastSun);
          const weekVsLastLbs =
            weekAvgLbs != null && lastWeekAvgLbs != null ? weekAvgLbs - lastWeekAvgLbs : null;

          let onTrack: boolean | null = null;
          let goalLbs: number | null = null;
          let lbsRemaining: number | null = null;
          const wg = wgErr ? null : (wgRow as WeightGoal | null);
          if (wg) {
            const gL = kgToLbs(wg.goal_weight_kg);
            goalLbs = gL;
            if (gL != null) {
              lbsRemaining = curLbs - gL;
            }
            const first = asc[0];
            const traj = defaultTrajectoryStart(
              first?.logged_date ?? null,
              first ? Number(first.weight_kg) : null,
              wg.created_at,
              Number(latest.weight_kg)
            );
            const endD = effectiveEndDate(wg, traj.startDate, traj.startKg);
            const sun = sundayOfWeekFromMonday(thisMon);
            const tgtKg = linearTargetKg(
              sun,
              traj.startDate,
              traj.startKg,
              endD,
              wg.goal_weight_kg
            );
            let sum = 0;
            let n = 0;
            for (let d = thisMon; d <= today; d = addDays(d, 1)) {
              const e = byDate[d];
              if (e) {
                sum += Number(e.weight_kg);
                n += 1;
              }
            }
            if (n > 0) {
              onTrack = sum / n <= tgtKg;
            }
          }

          setWeightWidget({
            currentLbs: curLbs,
            weekAvgLbs,
            weekVsLastLbs,
            goalLbs,
            lbsRemaining,
            onTrack,
          });
        } else {
          setWeightWidget(null);
        }
      } else {
        setWeightWidget(null);
      }

      const todayFood = localISODate();
      const { data: foodRowsToday } = await supabase
        .from("daily_food_logs")
        .select("*, foods(*)")
        .eq("user_id", u.id)
        .eq("logged_date", todayFood);
      const rowsToday = (foodRowsToday ?? []) as DailyFoodLogWithFood[];
      const foodTotals = sumNutrients(
        rowsToday.map((r) => scaledNutrients(r.foods, Number(r.quantity), r.serving_unit))
      );

      const { data: ng } = await supabase
        .from("nutrition_goals")
        .select("*")
        .eq("user_id", u.id)
        .maybeSingle();
      if (ng) {
        setNutritionGoal(ng as NutritionGoal);
        setFoodTotalsToday(foodTotals);
      } else {
        setNutritionGoal(null);
        setFoodTotalsToday(null);
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("height_cm, date_of_birth, biological_sex, activity_level, custom_activity_multiplier")
        .eq("id", u.id)
        .maybeSingle();
      const pr = prof as Partial<Omit<ProfileCalorieFields, "id">> | null;
      const profileCal: ProfileCalorieFields | null = pr
        ? {
            id: u.id,
            height_cm: pr.height_cm ?? null,
            date_of_birth: pr.date_of_birth ?? null,
            biological_sex: (pr.biological_sex as ProfileCalorieFields["biological_sex"]) ?? null,
            activity_level: (pr.activity_level as ProfileCalorieFields["activity_level"]) ?? "sedentary",
            custom_activity_multiplier: pr.custom_activity_multiplier ?? null,
          }
        : null;

      let calBal: { in: number; out: number } | null = null;
      if (profileCal && profileBmrFieldsComplete(profileCal)) {
        const wList = (dwRows ?? []) as DailyWeight[];
        const energy = computeBmrTdeeForDate(profileCal, wList, todayFood);
        if (energy) {
          const { data: burnToday } = await supabase
            .from("calorie_burns")
            .select("calories_burned")
            .eq("user_id", u.id)
            .eq("logged_date", todayFood);
          const extra = (burnToday ?? []).reduce((s, r) => s + Number((r as { calories_burned: number }).calories_burned), 0);
          calBal = { in: foodTotals.calories, out: energy.tdee + extra };
        }
      }
      setCalorieBalance(calBal);

      setLoading(false);
    })();
  }, [router]);

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

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Dashboard"
          description={`${todayFormatted}${user.email ? ` · ${user.email}` : ""}`}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-theme-border bg-theme-surface/40 px-4 py-3 text-sm">
          <span className="text-theme-text-muted">
            Theme:{" "}
            <span className="font-medium text-theme-text-primary">{themeName}</span>
          </span>
          <Link
            href="/settings/themes"
            className="font-medium text-theme-accent hover:underline"
          >
            Change Theme
          </Link>
        </div>

        {nutritionGoal && foodTotalsToday && (
          <DashboardFoodWidget goal={nutritionGoal} totals={foodTotalsToday} />
        )}

        {calorieBalance && (
          <DashboardCalorieWidget caloriesIn={calorieBalance.in} caloriesOut={calorieBalance.out} />
        )}

        {weightWidget && (
          <Link
            href="/weight"
            className="mt-6 block rounded-xl border border-theme-border bg-theme-surface/50 p-5 transition hover:border-theme-accent/60 hover:bg-theme-surface"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-theme-text-primary">Weight</h2>
                <p className="mt-2 text-3xl font-bold tabular-nums text-theme-text-primary">
                  {weightWidget.currentLbs.toFixed(1)}{" "}
                  <span className="text-lg font-medium text-theme-text-muted">lbs</span>
                </p>
                <p className="mt-1 text-sm text-theme-text-muted">Current (latest log)</p>
              </div>
              {weightWidget.onTrack != null && (
                <span
                  className="text-2xl"
                  title={weightWidget.onTrack ? "On track this week" : "Above weekly target"}
                >
                  {weightWidget.onTrack ? (
                    <span className="text-theme-success">✓</span>
                  ) : (
                    <span className="text-theme-danger">⚠</span>
                  )}
                </span>
              )}
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-theme-text-muted">This week&apos;s average</dt>
                <dd className="font-medium text-theme-text-primary/90">
                  {weightWidget.weekAvgLbs != null ? `${weightWidget.weekAvgLbs.toFixed(1)} lbs` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-theme-text-muted">vs last week</dt>
                <dd
                  className={`font-medium tabular-nums ${
                    weightWidget.weekVsLastLbs == null
                      ? "text-theme-text-muted/80"
                      : weightWidget.weekVsLastLbs < 0
                        ? "text-theme-success"
                        : weightWidget.weekVsLastLbs > 0
                          ? "text-theme-danger"
                          : "text-theme-text-muted"
                  }`}
                >
                  {weightWidget.weekVsLastLbs != null
                    ? `${weightWidget.weekVsLastLbs > 0 ? "+" : ""}${weightWidget.weekVsLastLbs.toFixed(1)} lbs`
                    : "—"}
                </dd>
              </div>
              {weightWidget.goalLbs != null && (
                <>
                  <div>
                    <dt className="text-theme-text-muted">Goal</dt>
                    <dd className="font-medium text-theme-text-primary/90">{weightWidget.goalLbs.toFixed(1)} lbs</dd>
                  </div>
                  <div>
                    <dt className="text-theme-text-muted">Remaining</dt>
                    <dd className="font-medium text-theme-text-primary/90">
                      {weightWidget.lbsRemaining != null
                        ? weightWidget.lbsRemaining > 0
                          ? `${weightWidget.lbsRemaining.toFixed(1)} lbs to go`
                          : weightWidget.lbsRemaining < 0
                            ? `${Math.abs(weightWidget.lbsRemaining).toFixed(1)} lbs below goal`
                            : "At goal"
                        : "—"}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <p className="mt-4 text-sm font-medium text-theme-accent">Open weight page →</p>
          </Link>
        )}

        {!loggedToday && (
          <div className="mt-6 rounded-xl border border-theme-accent/40 bg-theme-accent/10 p-4">
            <p className="font-medium text-theme-accent">No workout logged today yet.</p>
            <p className="mt-1 text-sm text-theme-text-muted">
              Log a session to keep your streak and see progress over time.
            </p>
            <Link
              href="/workouts/log"
              className="mt-3 inline-flex items-center rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-theme-on-accent hover:bg-theme-accent-hover"
            >
              Log Workout
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link
            href="/workouts/log"
            className="rounded-xl border border-theme-border bg-theme-surface/50 p-5 transition hover:border-theme-accent/60 hover:bg-theme-surface"
          >
            <h2 className="text-lg font-semibold text-theme-text-primary">Log Workout</h2>
            <p className="mt-1 text-sm text-theme-text-muted">
              Record a new workout or continue from a template.
            </p>
          </Link>
          <Link
            href="/progress"
            className="rounded-xl border border-theme-border bg-theme-surface/50 p-5 transition hover:border-theme-accent/60 hover:bg-theme-surface"
          >
            <h2 className="text-lg font-semibold text-theme-text-primary">View Progress</h2>
            <p className="mt-1 text-sm text-theme-text-muted">
              See exercise trends and estimated 1RM over time.
            </p>
          </Link>
          <Link
            href="/reports"
            className="rounded-xl border border-theme-border bg-theme-surface/50 p-5 transition hover:border-theme-accent/60 hover:bg-theme-surface"
          >
            <h2 className="text-lg font-semibold text-theme-text-primary">View Reports</h2>
            <p className="mt-1 text-sm text-theme-text-muted">
              Volume, frequency, bodyweight, and PRs over time.
            </p>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/mesocycles"
            className="rounded-xl border border-theme-border bg-theme-surface/50 p-5 transition hover:border-theme-border hover:bg-theme-surface"
          >
            <h2 className="text-lg font-semibold text-theme-text-primary">Mesocycles</h2>
            <p className="mt-1 text-sm text-theme-text-muted">Manage your training blocks and programs.</p>
          </Link>
          <Link
            href="/workouts/history"
            className="rounded-xl border border-theme-border bg-theme-surface/50 p-5 transition hover:border-theme-border hover:bg-theme-surface"
          >
            <h2 className="text-lg font-semibold text-theme-text-primary">Workout History</h2>
            <p className="mt-1 text-sm text-theme-text-muted">Browse and compare past workouts.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
