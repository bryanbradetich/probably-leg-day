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
import type { DailyWeight, WeightGoal } from "@/types";

type WeightWidget = {
  currentLbs: number;
  weekAvgLbs: number | null;
  weekVsLastLbs: number | null;
  goalLbs: number | null;
  lbsRemaining: number | null;
  onTrack: boolean | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedToday, setLoggedToday] = useState(false);
  const [weightWidget, setWeightWidget] = useState<WeightWidget | null>(null);

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

      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
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
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Dashboard"
          description={`${todayFormatted}${user.email ? ` · ${user.email}` : ""}`}
        />

        {weightWidget && (
          <Link
            href="/weight"
            className="mt-6 block rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-[#f97316]/60 hover:bg-zinc-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Weight</h2>
                <p className="mt-2 text-3xl font-bold tabular-nums text-white">
                  {weightWidget.currentLbs.toFixed(1)}{" "}
                  <span className="text-lg font-medium text-zinc-500">lbs</span>
                </p>
                <p className="mt-1 text-sm text-zinc-400">Current (latest log)</p>
              </div>
              {weightWidget.onTrack != null && (
                <span
                  className="text-2xl"
                  title={weightWidget.onTrack ? "On track this week" : "Above weekly target"}
                >
                  {weightWidget.onTrack ? (
                    <span className="text-[#22c55e]">✓</span>
                  ) : (
                    <span className="text-[#ef4444]">⚠</span>
                  )}
                </span>
              )}
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">This week&apos;s average</dt>
                <dd className="font-medium text-zinc-200">
                  {weightWidget.weekAvgLbs != null ? `${weightWidget.weekAvgLbs.toFixed(1)} lbs` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">vs last week</dt>
                <dd
                  className={`font-medium tabular-nums ${
                    weightWidget.weekVsLastLbs == null
                      ? "text-zinc-600"
                      : weightWidget.weekVsLastLbs < 0
                        ? "text-[#22c55e]"
                        : weightWidget.weekVsLastLbs > 0
                          ? "text-[#ef4444]"
                          : "text-zinc-400"
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
                    <dt className="text-zinc-500">Goal</dt>
                    <dd className="font-medium text-zinc-200">{weightWidget.goalLbs.toFixed(1)} lbs</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Remaining</dt>
                    <dd className="font-medium text-zinc-200">
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
            <p className="mt-4 text-sm font-medium text-[#f97316]">Open weight page →</p>
          </Link>
        )}

        {!loggedToday && (
          <div className="mt-6 rounded-xl border border-[#f97316]/40 bg-[#f97316]/10 p-4">
            <p className="font-medium text-[#f97316]">No workout logged today yet.</p>
            <p className="mt-1 text-sm text-zinc-400">
              Log a session to keep your streak and see progress over time.
            </p>
            <Link
              href="/workouts/log"
              className="mt-3 inline-flex items-center rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ea580c]"
            >
              Log Workout
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link
            href="/workouts/log"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-[#f97316]/60 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">Log Workout</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Record a new workout or continue from a template.
            </p>
          </Link>
          <Link
            href="/progress"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-[#f97316]/60 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">View Progress</h2>
            <p className="mt-1 text-sm text-zinc-400">
              See exercise trends and estimated 1RM over time.
            </p>
          </Link>
          <Link
            href="/reports"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-[#f97316]/60 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">View Reports</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Volume, frequency, bodyweight, and PRs over time.
            </p>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/mesocycles"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">Mesocycles</h2>
            <p className="mt-1 text-sm text-zinc-400">Manage your training blocks and programs.</p>
          </Link>
          <Link
            href="/workouts/history"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">Workout History</h2>
            <p className="mt-1 text-sm text-zinc-400">Browse and compare past workouts.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
