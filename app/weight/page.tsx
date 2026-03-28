"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { kgToLbs, lbsToKg } from "@/lib/units";
import type { DailyWeight, WeightGoal } from "@/types";
import {
  addDays,
  dayOfWeekLabel,
  defaultTrajectoryStart,
  effectiveEndDate,
  formatLossDescription,
  formatShortDate,
  linearTargetKg,
  localISODate,
  mondayOfWeek,
  projectNextWeekKg,
  recentWeeklyAverageKg,
  sundayOfWeekFromMonday,
} from "@/lib/weight-helpers";
import {
  DailyWeightLineChart,
  WeeklyTargetActualChart,
  WeightRangeSelector,
  type DailyChartPoint,
  type WeeklyBarPoint,
  type WeightChartRange,
} from "@/components/weight/WeightCharts";
import { GoalSetupForm, type GoalSetupSavePayload } from "@/components/weight/GoalSetupForm";

export default function WeightPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState<WeightGoal | null>(null);
  const [logs, setLogs] = useState<DailyWeight[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [goalEditing, setGoalEditing] = useState(false);
  const [goalFormKey, setGoalFormKey] = useState(0);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalDeleteModalOpen, setGoalDeleteModalOpen] = useState(false);
  const [goalDeleting, setGoalDeleting] = useState(false);

  const [todayLbs, setTodayLbs] = useState("");
  const [todaySaving, setTodaySaving] = useState(false);
  const [todayNotes, setTodayNotes] = useState("");

  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [editLbs, setEditLbs] = useState("");
  const [chartRange, setChartRange] = useState<WeightChartRange>("4w");

  const todayIso = localISODate();

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
    const { data: g, error: gErr } = await supabase
      .from("weight_goals")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (gErr) {
      setError(gErr.message);
      setLoading(false);
      return;
    }
    if (g) setGoal(g as WeightGoal);
    else setGoal(null);

    const { data: w, error: wErr } = await supabase
      .from("daily_weights")
      .select("*")
      .eq("user_id", user.id)
      .order("logged_date", { ascending: false })
      .limit(2000);
    if (wErr) {
      setError(wErr.message);
      setLoading(false);
      return;
    }
    setLogs((w ?? []) as DailyWeight[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => {
    const m: Record<string, DailyWeight> = {};
    for (const r of logs) {
      m[r.logged_date] = r;
    }
    return m;
  }, [logs]);

  const sortedAsc = useMemo(() => [...logs].sort((a, b) => a.logged_date.localeCompare(b.logged_date)), [logs]);

  const firstLog = sortedAsc[0] ?? null;
  const latestLog = sortedAsc.length ? sortedAsc[sortedAsc.length - 1] : null;

  const trajectory = useMemo(() => {
    if (!goal || !latestLog) return null;
    const start = defaultTrajectoryStart(
      firstLog?.logged_date ?? null,
      firstLog ? Number(firstLog.weight_kg) : null,
      goal.created_at,
      Number(latestLog.weight_kg)
    );
    const endD = effectiveEndDate(goal, start.startDate, start.startKg);
    return { ...start, endDate: endD };
  }, [goal, firstLog, latestLog]);

  const todayEntry = byDate[todayIso] ?? null;

  useEffect(() => {
    if (todayEntry) {
      const l = kgToLbs(Number(todayEntry.weight_kg));
      setTodayLbs(l != null ? String(l) : "");
      setTodayNotes(todayEntry.notes ?? "");
    } else {
      setTodayLbs("");
      setTodayNotes("");
    }
  }, [todayEntry]);

  /** Current weight for linear plan: today’s log if present, else latest entry. */
  const planAnchorKg = useMemo(() => {
    if (!latestLog) return null;
    if (todayEntry) return Number(todayEntry.weight_kg);
    return Number(latestLog.weight_kg);
  }, [latestLog, todayEntry]);

  const linearPlanEndDate = useMemo(() => {
    if (!goal || planAnchorKg == null) return null;
    return goal.target_date ?? effectiveEndDate(goal, todayIso, planAnchorKg);
  }, [goal, todayIso, planAnchorKg]);

  const last30Rows = useMemo(() => {
    const rows: string[] = [];
    for (let i = 0; i < 30; i++) {
      rows.push(addDays(todayIso, -i));
    }
    return rows;
  }, [todayIso]);

  const weekAvgByMonday = useMemo(() => {
    const sums: Record<string, { n: number; s: number }> = {};
    for (const r of logs) {
      const m = mondayOfWeek(r.logged_date);
      const k = Number(r.weight_kg);
      if (!sums[m]) sums[m] = { n: 0, s: 0 };
      sums[m].n += 1;
      sums[m].s += k;
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(sums)) {
      if (v.n > 0) out[k] = v.s / v.n;
    }
    return out;
  }, [logs]);

  /** One row per week in the 30-day window: show week avg on the latest date of that week in the window. */
  const showWeekAvgForDate = useMemo(() => {
    const set = new Set<string>();
    const byWeek: Record<string, string[]> = {};
    for (const d of last30Rows) {
      const w = mondayOfWeek(d);
      if (!byWeek[w]) byWeek[w] = [];
      byWeek[w].push(d);
    }
    for (const dates of Object.values(byWeek)) {
      const maxD = dates.reduce((a, b) => (a.localeCompare(b) > 0 ? a : b));
      set.add(maxD);
    }
    return set;
  }, [last30Rows]);

  const weeklySummaryRows = useMemo(() => {
    if (!trajectory || !goal) return [];
    const weekSet = new Set<string>();
    for (const r of logs) {
      weekSet.add(mondayOfWeek(r.logged_date));
    }
    const mondaysAsc = Array.from(weekSet).sort((a, b) => a.localeCompare(b));

    const avgLbsByWeek: Record<string, number | null> = {};
    const rowByWeek: Record<
      string,
      {
        weekMon: string;
        targetLbs: number;
        avgLbs: number | null;
        days: (number | null)[];
        spanDiff: number | null;
        onTrack: boolean | null;
      }
    > = {};

    for (const wm of mondaysAsc) {
      const sun = sundayOfWeekFromMonday(wm);
      const endD = linearPlanEndDate ?? trajectory.endDate;
      const tgt =
        sun < todayIso
          ? linearTargetKg(
              sun,
              trajectory.startDate,
              trajectory.startKg,
              trajectory.endDate,
              goal.goal_weight_kg
            )
          : planAnchorKg != null
            ? linearTargetKg(sun, todayIso, planAnchorKg, endD, goal.goal_weight_kg)
            : linearTargetKg(
                sun,
                trajectory.startDate,
                trajectory.startKg,
                trajectory.endDate,
                goal.goal_weight_kg
              );
      const tgtLbs = kgToLbs(tgt) ?? 0;
      const days: (number | null)[] = Array(7).fill(null);
      for (let i = 0; i < 7; i++) {
        const iso = addDays(wm, i);
        const e = byDate[iso];
        if (e) days[i] = kgToLbs(Number(e.weight_kg));
      }
      const loggedVals = days.filter((x): x is number => x != null);
      const avgLbs = loggedVals.length ? loggedVals.reduce((a, b) => a + b, 0) / loggedVals.length : null;
      avgLbsByWeek[wm] = avgLbs;
      const first = days[0];
      const last = days[6];
      let spanDiff: number | null = null;
      if (first != null && last != null) spanDiff = last - first;
      const avgKg = weekAvgByMonday[wm];
      const onTrack =
        avgKg != null ? avgKg <= tgt : avgLbs != null ? lbsToKg(avgLbs)! <= tgt : null;
      rowByWeek[wm] = {
        weekMon: wm,
        targetLbs: tgtLbs,
        avgLbs,
        days,
        spanDiff,
        onTrack,
      };
    }

    const rows: Array<
      (typeof rowByWeek)[string] & { prevDelta: number | null }
    > = [];
    for (let i = 0; i < mondaysAsc.length; i++) {
      const wm = mondaysAsc[i];
      const prevWm = i > 0 ? mondaysAsc[i - 1] : null;
      const cur = avgLbsByWeek[wm];
      const prev = prevWm ? avgLbsByWeek[prevWm] : null;
      const prevDelta =
        cur != null && prev != null ? cur - prev : null;
      rows.push({ ...rowByWeek[wm], prevDelta });
    }
    return rows.reverse();
  }, [logs, goal, trajectory, byDate, weekAvgByMonday, todayIso, planAnchorKg, linearPlanEndDate]);

  const projectionRows = useMemo(() => {
    if (!goal || !latestLog || !trajectory || planAnchorKg == null || linearPlanEndDate == null) return [];
    const rows: { weekMon: string; projectedLbs: number; targetLbs: number }[] = [];
    const startProjKg = recentWeeklyAverageKg(todayIso, weekAvgByMonday) ?? planAnchorKg;
    let cursor = startProjKg;
    let weekMon = mondayOfWeek(addDays(todayIso, 7));
    const maxRows = 52;
    for (let i = 0; i < maxRows; i++) {
      cursor = projectNextWeekKg(cursor, goal.weekly_loss_type, goal.weekly_loss_value);
      const sun = sundayOfWeekFromMonday(weekMon);
      const tgt = linearTargetKg(sun, todayIso, planAnchorKg, linearPlanEndDate, goal.goal_weight_kg);
      const pLbs = kgToLbs(cursor) ?? 0;
      const tLbs = kgToLbs(tgt) ?? 0;
      rows.push({ weekMon, projectedLbs: pLbs, targetLbs: tLbs });
      if (cursor <= goal.goal_weight_kg) break;
      if (goal.target_date && weekMon > goal.target_date) break;
      if (!goal.target_date && weekMon > linearPlanEndDate) break;
      weekMon = addDays(weekMon, 7);
    }
    return rows;
  }, [goal, latestLog, trajectory, todayIso, planAnchorKg, linearPlanEndDate, weekAvgByMonday]);

  const scheduleMessage = useMemo(() => {
    if (!goal || !trajectory || !latestLog || planAnchorKg == null || linearPlanEndDate == null) return null;
    const mon = mondayOfWeek(todayIso);
    const sun = sundayOfWeekFromMonday(mon);
    const tgt = linearTargetKg(sun, todayIso, planAnchorKg, linearPlanEndDate, goal.goal_weight_kg);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const iso = addDays(mon, i);
      if (iso > todayIso) break;
      const e = byDate[iso];
      if (e) {
        sum += Number(e.weight_kg);
        n += 1;
      }
    }
    if (n === 0) return null;
    const actKg = sum / n;
    const diffLbs = (kgToLbs(tgt) ?? 0) - (kgToLbs(actKg) ?? 0);
    if (Math.abs(diffLbs) < 0.05) return { kind: "neutral" as const, text: "Right on your weekly target." };
    if (diffLbs > 0)
      return {
        kind: "ahead" as const,
        text: `You're ${diffLbs.toFixed(1)} lbs ahead of schedule`,
      };
    return {
      kind: "behind" as const,
      text: `You're ${Math.abs(diffLbs).toFixed(1)} lbs behind — consider adjusting your goal`,
    };
  }, [goal, trajectory, latestLog, todayIso, byDate, planAnchorKg, linearPlanEndDate]);

  const goalSummary = useMemo(() => {
    if (!goal || !latestLog || !trajectory || planAnchorKg == null || linearPlanEndDate == null) return null;
    const gl = kgToLbs(goal.goal_weight_kg);
    const cur = kgToLbs(Number(latestLog.weight_kg));
    if (gl == null || cur == null) return null;
    const toGo = cur - gl;
    const mon = mondayOfWeek(todayIso);
    const sun = sundayOfWeekFromMonday(mon);
    const tgt = linearTargetKg(sun, todayIso, planAnchorKg, linearPlanEndDate, goal.goal_weight_kg);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const iso = addDays(mon, i);
      if (iso > todayIso) break;
      const e = byDate[iso];
      if (e) {
        sum += Number(e.weight_kg);
        n += 1;
      }
    }
    const onTrack = n > 0 ? sum / n <= tgt : null;
    const dateStr = goal.target_date ? formatShortDate(goal.target_date) : "open-ended plan";
    return {
      goalLbs: gl,
      dateStr,
      lossText: formatLossDescription(goal),
      toGo,
      onTrack,
    };
  }, [goal, latestLog, trajectory, todayIso, byDate, planAnchorKg, linearPlanEndDate]);

  const dailyChartPoints: DailyChartPoint[] = useMemo(() => {
    if (!trajectory || !goal) return [];
    if (sortedAsc.length === 0) return [];
    const start = sortedAsc[0].logged_date;
    const end = todayIso;
    const weekSums: Record<string, { n: number; s: number }> = {};
    for (const r of logs) {
      const w = mondayOfWeek(r.logged_date);
      if (!weekSums[w]) weekSums[w] = { n: 0, s: 0 };
      weekSums[w].n += 1;
      weekSums[w].s += Number(r.weight_kg);
    }
    const weekAvgKg: Record<string, number> = {};
    for (const [k, v] of Object.entries(weekSums)) {
      if (v.n) weekAvgKg[k] = v.s / v.n;
    }
    const pts: DailyChartPoint[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const e = byDate[d];
      const tKg = linearTargetKg(
        d,
        trajectory.startDate,
        trajectory.startKg,
        trajectory.endDate,
        goal.goal_weight_kg
      );
      const wm = mondayOfWeek(d);
      const wk = weekAvgKg[wm];
      pts.push({
        date: d,
        actualLbs: e ? kgToLbs(Number(e.weight_kg)) : null,
        targetLbs: kgToLbs(tKg),
        weekAvgLbs: wk != null ? kgToLbs(wk) : null,
      });
    }
    return pts;
  }, [trajectory, goal, sortedAsc, logs, byDate, todayIso]);

  const weeklyBarPoints: WeeklyBarPoint[] = useMemo(() => {
    if (!goal || !trajectory) return [];
    const out: WeeklyBarPoint[] = [];
    for (const row of weeklySummaryRows) {
      if (row.avgLbs == null) continue;
      const onTrack = row.avgLbs <= row.targetLbs + 0.01;
      out.push({
        weekKey: row.weekMon,
        weekLabel: formatShortDate(row.weekMon),
        actualLbs: row.avgLbs,
        targetLbs: row.targetLbs,
        onTrack,
      });
    }
    return out.slice(0, 24).reverse();
  }, [weeklySummaryRows, goal, trajectory]);

  const saveGoal = async (payload: GoalSetupSavePayload) => {
    if (!userId) return;
    setGoalSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("weight_goals").upsert(
      {
        user_id: userId,
        goal_weight_kg: payload.goalWeightKg,
        target_date: payload.targetDate,
        weekly_loss_type: payload.weeklyLossType,
        weekly_loss_value: payload.weeklyLossValue,
      },
      { onConflict: "user_id" }
    );
    setGoalSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
    setGoalEditing(false);
  };

  const confirmDeleteGoal = async () => {
    if (!userId) return;
    setGoalDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("weight_goals").delete().eq("user_id", userId);
    setGoalDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setGoalDeleteModalOpen(false);
    setGoalEditing(false);
    await load();
  };

  const saveToday = async () => {
    if (!userId) return;
    const w = parseFloat(todayLbs);
    if (!Number.isFinite(w) || w <= 0) {
      setError("Enter today's weight in lbs.");
      return;
    }
    const kg = lbsToKg(w);
    if (kg == null) return;
    setTodaySaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("daily_weights").upsert(
      {
        user_id: userId,
        logged_date: todayIso,
        weight_kg: kg,
        notes: todayNotes.trim() || null,
      },
      { onConflict: "user_id,logged_date" }
    );
    setTodaySaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  };

  const saveEditRow = async (id: string) => {
    const w = parseFloat(editLbs);
    if (!Number.isFinite(w) || w <= 0) return;
    const kg = lbsToKg(w);
    if (kg == null || !userId) return;
    const supabase = createClient();
    const { error: err } = await supabase
      .from("daily_weights")
      .update({ weight_kg: kg })
      .eq("id", id)
      .eq("user_id", userId);
    if (err) {
      setError(err.message);
      return;
    }
    setEditRowId(null);
    await load();
  };

  const deleteRow = async (id: string) => {
    if (!userId || !confirm("Delete this weight entry?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("daily_weights").delete().eq("id", id).eq("user_id", userId);
    if (err) setError(err.message);
    else await load();
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text-primary">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <ErrorState message={error ?? "Session expired."} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Weight"
          description="Daily morning weigh-ins, goals, and weekly trends."
        />

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {/* Goal */}
        <section className="mt-8">
          {!goal || goalEditing ? (
            <GoalSetupForm
              key={goal ? `goal-${goalFormKey}` : "new-goal"}
              goal={goal}
              latestLog={latestLog}
              todayIso={todayIso}
              saving={goalSaving}
              onSave={(p) => void saveGoal(p)}
              showCancel={!!goal}
              onCancel={() => setGoalEditing(false)}
            />
          ) : (
            goalSummary && (
              <div className="flex flex-col gap-3 rounded-xl border border-theme-border bg-theme-surface/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-base font-bold text-theme-text-primary sm:text-lg">
                  Goal: {goalSummary.goalLbs} lbs by {goalSummary.dateStr} · {goalSummary.lossText} ·{" "}
                  {goalSummary.toGo > 0
                    ? `${goalSummary.toGo.toFixed(1)} lbs to go`
                    : goalSummary.toGo < 0
                      ? `${Math.abs(goalSummary.toGo).toFixed(1)} lbs below goal`
                      : "At goal weight"}
                  {goalSummary.onTrack != null && (
                    <span className="ml-2">
                      ·{" "}
                      {goalSummary.onTrack ? (
                        <span className="text-theme-success">On track ✓</span>
                      ) : (
                        <span className="text-theme-danger">Behind ✗</span>
                      )}
                    </span>
                  )}
                </p>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGoalFormKey((k) => k + 1);
                      setGoalEditing(true);
                    }}
                    className="rounded-lg border border-theme-accent/70 bg-theme-accent/10 px-3 py-1.5 text-sm font-medium text-theme-accent-soft hover:bg-theme-accent/20"
                  >
                    Edit Goal
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalDeleteModalOpen(true)}
                    className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/20"
                  >
                    Delete Goal
                  </button>
                </div>
              </div>
            )
          )}
        </section>

        {goalDeleteModalOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => !goalDeleting && setGoalDeleteModalOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
              <div
                className="flex h-full w-full flex-col justify-center rounded-none border-0 bg-theme-bg p-6 shadow-xl sm:h-auto sm:max-w-sm sm:rounded-xl sm:border sm:border-theme-border"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-goal-dialog-title"
              >
                <h2 id="delete-goal-dialog-title" className="text-lg font-bold text-theme-text-primary">
                  Delete weight goal?
                </h2>
                <p className="mt-2 text-sm text-theme-text-muted">
                  Are you sure you want to delete your weight goal? This won&apos;t affect your logged
                  weights.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => !goalDeleting && setGoalDeleteModalOpen(false)}
                    disabled={goalDeleting}
                    className="flex-1 rounded-xl border border-theme-border/80 bg-theme-border/90 py-2.5 text-sm font-medium text-theme-text-muted hover:bg-theme-border disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmDeleteGoal()}
                    disabled={goalDeleting}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-theme-text-primary hover:bg-red-700 disabled:opacity-50"
                  >
                    {goalDeleting ? "Deleting…" : "Delete Goal"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Log today */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-text-muted">Daily log</h2>
          <div className="mt-4 rounded-xl border border-theme-border bg-theme-surface/50 p-6">
            {todayEntry && editRowId !== todayEntry.id ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-theme-text-muted">Today ({formatShortDate(todayIso)})</p>
                  <p className="mt-1 text-4xl font-bold tabular-nums text-theme-text-primary">
                    {kgToLbs(Number(todayEntry.weight_kg))?.toFixed(1)} <span className="text-xl text-theme-text-muted">lbs</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditRowId(todayEntry.id);
                      setEditLbs(String(kgToLbs(Number(todayEntry.weight_kg)) ?? ""));
                    }}
                    className="rounded-lg border border-theme-border/80 px-4 py-2 text-sm font-medium text-theme-text-primary"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-theme-text-muted">Log today&apos;s weight (lbs)</label>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="number"
                    step="0.1"
                    value={todayEntry && editRowId === todayEntry.id ? editLbs : todayLbs}
                    onChange={(e) =>
                      todayEntry && editRowId === todayEntry.id
                        ? setEditLbs(e.target.value)
                        : setTodayLbs(e.target.value)
                    }
                    placeholder="0.0"
                    className="h-16 min-w-0 flex-1 rounded-xl border-2 border-theme-accent/60 bg-theme-input-bg px-5 text-3xl font-bold tabular-nums text-theme-text-primary outline-none focus:border-theme-accent"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      todayEntry && editRowId === todayEntry.id
                        ? saveEditRow(todayEntry.id)
                        : saveToday()
                    }
                    disabled={todaySaving}
                    className="h-14 shrink-0 rounded-xl bg-theme-accent px-8 text-base font-semibold text-theme-on-accent disabled:opacity-50"
                  >
                    {todaySaving ? "Saving…" : "Save"}
                  </button>
                </div>
                {todayEntry && editRowId === todayEntry.id && (
                  <button
                    type="button"
                    className="mt-2 text-sm text-theme-text-muted hover:text-theme-text-muted"
                    onClick={() => setEditRowId(null)}
                  >
                    Cancel edit
                  </button>
                )}
                {!todayEntry && (
                  <label className="mt-4 block text-sm text-theme-text-muted">
                    Notes (optional)
                    <input
                      value={todayNotes}
                      onChange={(e) => setTodayNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-sm text-theme-text-primary"
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-theme-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-theme-border bg-theme-surface text-theme-text-muted">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 font-medium">Weight (lbs)</th>
                  <th className="px-3 py-2 font-medium">Δ prev day</th>
                  <th className="px-3 py-2 font-medium">Week avg</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {last30Rows.map((iso, idx) => {
                  const row = byDate[iso];
                  const prevIso = addDays(iso, -1);
                  const prev = byDate[prevIso];
                  const delta =
                    row && prev
                      ? (kgToLbs(Number(row.weight_kg)) ?? 0) - (kgToLbs(Number(prev.weight_kg)) ?? 0)
                      : null;
                  const wm = mondayOfWeek(iso);
                  const wAvgKg = weekAvgByMonday[wm];
                  const wAvgLbs = wAvgKg != null ? kgToLbs(wAvgKg) : null;
                  const showAvg = showWeekAvgForDate.has(iso);
                  const stripe = idx % 2 === 0 ? "bg-theme-surface/80" : "bg-theme-input-bg/80";
                  return (
                    <tr key={iso} className={`border-b border-theme-border/80 ${stripe}`}>
                      <td className="px-3 py-2 text-theme-text-muted">{formatShortDate(iso)}</td>
                      <td className="px-3 py-2 text-theme-text-muted">{dayOfWeekLabel(iso)}</td>
                      <td className="px-3 py-2 font-medium text-theme-text-primary">
                        {row ? (
                          editRowId === row.id ? (
                            <input
                              type="number"
                              step="0.1"
                              value={editLbs}
                              onChange={(e) => setEditLbs(e.target.value)}
                              className="w-24 rounded border border-theme-border/80 bg-theme-input-bg px-2 py-1"
                            />
                          ) : (
                            kgToLbs(Number(row.weight_kg))?.toFixed(1)
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className={`px-3 py-2 tabular-nums ${
                          delta == null
                            ? "text-theme-text-muted/80"
                            : delta < 0
                              ? "text-theme-success"
                              : delta > 0
                                ? "text-theme-danger"
                                : "text-theme-text-muted"
                        }`}
                      >
                        {delta != null ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-theme-text-muted">
                        {showAvg && wAvgLbs != null ? wAvgLbs.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row && (
                          <div className="flex justify-end gap-2">
                            {editRowId === row.id ? (
                              <>
                                <button
                                  type="button"
                                  className="text-theme-accent hover:underline"
                                  onClick={() => saveEditRow(row.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="text-theme-text-muted hover:underline"
                                  onClick={() => setEditRowId(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="text-theme-text-muted hover:text-theme-text-primary"
                                  onClick={() => {
                                    setEditRowId(row.id);
                                    setEditLbs(String(kgToLbs(Number(row.weight_kg)) ?? ""));
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="text-red-400 hover:underline"
                                  onClick={() => deleteRow(row.id)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Weekly summary */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-text-muted">Weekly summary</h2>
          <p className="mt-1 text-sm text-theme-text-muted">Weeks run Monday–Sunday. Target is the linear plan to your goal date.</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-theme-border">
            <table className="w-full min-w-[900px] text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-theme-border bg-theme-surface text-theme-text-muted">
                  <th className="px-2 py-2 font-medium">Week of</th>
                  <th className="px-2 py-2 font-medium">Target</th>
                  <th className="px-2 py-2 font-medium">Avg</th>
                  <th className="px-2 py-2 font-medium">Δ prev wk</th>
                  {["Mo", "Tu", "Wed", "Thu", "Fr", "Sa", "Su"].map((d) => (
                    <th key={d} className="px-1 py-2 font-medium">
                      {d}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium">Su−Mo</th>
                </tr>
              </thead>
              <tbody>
                {weeklySummaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-theme-text-muted">
                      Log weights to see weekly summaries.
                    </td>
                  </tr>
                ) : (
                  weeklySummaryRows.map((row, i) => {
                    const hi =
                      row.onTrack === true
                        ? "bg-theme-success/10"
                        : row.onTrack === false
                          ? "bg-theme-danger/10"
                          : i % 2 === 0
                            ? "bg-theme-surface/80"
                            : "bg-theme-input-bg/80";
                    return (
                      <tr key={row.weekMon} className={`border-b border-theme-border/80 ${hi}`}>
                        <td className="px-2 py-2 text-theme-text-muted">{formatShortDate(row.weekMon)}</td>
                        <td className="px-2 py-2 tabular-nums text-theme-text-muted">{row.targetLbs.toFixed(1)}</td>
                        <td className="px-2 py-2 tabular-nums text-theme-text-primary">
                          {row.avgLbs != null ? row.avgLbs.toFixed(1) : "—"}
                        </td>
                        <td
                          className={`px-2 py-2 tabular-nums ${
                            row.prevDelta == null
                              ? "text-theme-text-muted/80"
                              : row.prevDelta < 0
                                ? "text-theme-success"
                                : row.prevDelta > 0
                                  ? "text-theme-danger"
                                  : "text-theme-text-muted"
                          }`}
                        >
                          {row.prevDelta != null ? `${row.prevDelta > 0 ? "+" : ""}${row.prevDelta.toFixed(1)}` : "—"}
                        </td>
                        {row.days.map((v, j) => (
                          <td key={j} className="px-1 py-2 text-center tabular-nums text-theme-text-muted">
                            {v != null ? v.toFixed(1) : "—"}
                          </td>
                        ))}
                        <td className="px-2 py-2 tabular-nums text-theme-text-muted">
                          {row.spanDiff != null ? `${row.spanDiff > 0 ? "+" : ""}${row.spanDiff.toFixed(1)}` : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Projection */}
        {goal && trajectory && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-text-muted">Running projection</h2>
            {scheduleMessage && (
              <p
                className={`mt-2 text-sm font-medium ${
                  scheduleMessage.kind === "ahead"
                    ? "text-theme-success"
                    : scheduleMessage.kind === "behind"
                      ? "text-theme-danger"
                      : "text-theme-text-muted"
                }`}
              >
                {scheduleMessage.text}
              </p>
            )}
            <div className="mt-4 overflow-x-auto rounded-xl border border-theme-border">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead>
                  <tr className="border-b border-theme-border bg-theme-surface text-theme-text-muted">
                    <th className="px-3 py-2 font-medium">Week of</th>
                    <th className="px-3 py-2 font-medium">Projected (lbs)</th>
                    <th className="px-3 py-2 font-medium">Target (lbs)</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-theme-text-muted">
                        Goal reached or no further weeks to show.
                      </td>
                    </tr>
                  ) : (
                    projectionRows.map((r, idx) => (
                      <tr
                        key={r.weekMon}
                        className={`border-b border-theme-border/80 ${idx % 2 === 0 ? "bg-theme-surface/80" : "bg-theme-input-bg/80"}`}
                      >
                        <td className="px-3 py-2 text-theme-text-muted">{formatShortDate(r.weekMon)}</td>
                        <td className="px-3 py-2 tabular-nums text-theme-accent">{r.projectedLbs.toFixed(1)}</td>
                        <td className="px-3 py-2 tabular-nums text-theme-text-muted">{r.targetLbs.toFixed(1)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Charts */}
        <section className="mt-10 space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-text-muted">Charts</h2>
          <WeightRangeSelector value={chartRange} onChange={setChartRange} />
          <DailyWeightLineChart
            data={dailyChartPoints}
            range={chartRange}
            empty={dailyChartPoints.length === 0}
          />
          <WeeklyTargetActualChart data={weeklyBarPoints} empty={weeklyBarPoints.length === 0} />
        </section>
      </div>
    </div>
  );
}
