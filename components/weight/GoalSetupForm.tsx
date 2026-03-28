"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { kgToLbs, lbsToKg } from "@/lib/units";
import {
  addDays,
  daysBetween,
  formatShortDate,
  projectNextWeekKg,
  suggestedWeeklyLossDisplay,
  weeklyLossKg,
} from "@/lib/weight-helpers";
import type { DailyWeight, WeightGoal, WeeklyLossType } from "@/types";

export type GoalSetupSavePayload = {
  goalWeightKg: number;
  targetDate: string | null;
  weeklyLossType: WeeklyLossType;
  weeklyLossValue: number;
};

type Props = {
  goal: WeightGoal | null;
  latestLog: DailyWeight | null;
  todayIso: string;
  saving: boolean;
  onSave: (data: GoalSetupSavePayload) => void | Promise<void>;
  onCancel?: () => void;
  showCancel: boolean;
};

function roundSmartGoalLbs(n: number): string {
  const r = Math.round(n * 10) / 10;
  return String(r);
}

function weeklyLossStoredValue(lossType: WeeklyLossType, lossDisplayNum: number): number {
  if (lossType === "percentage") return lossDisplayNum;
  return lbsToKg(lossDisplayNum) ?? 0;
}

/** Calendar date when projected weight first reaches goal (week steps from today). */
function projectedReachDateIso(
  todayIso: string,
  currentLbs: number,
  goalLbs: number,
  lossType: WeeklyLossType,
  lossDisplayNum: number
): string | null {
  const startKg = lbsToKg(currentLbs);
  const goalKg = lbsToKg(goalLbs);
  if (startKg == null || goalKg == null) return null;
  if (startKg <= goalKg) return todayIso;
  const wkVal = weeklyLossStoredValue(lossType, lossDisplayNum);
  let w = startKg;
  let week = 0;
  const maxWeeks = 520;
  while (w > goalKg + 1e-6 && week < maxWeeks) {
    w = projectNextWeekKg(w, lossType, wkVal);
    week++;
  }
  return addDays(todayIso, week * 7);
}

/** Total lbs lost if applying the rate from today through `targetIso` (partial final week scaled). */
function lbsLostByTargetDate(
  todayIso: string,
  targetIso: string,
  currentLbs: number,
  lossType: WeeklyLossType,
  lossDisplayNum: number
): number | null {
  const days = daysBetween(todayIso, targetIso);
  if (days <= 0) return null;
  const startKg = lbsToKg(currentLbs);
  if (startKg == null) return null;
  const wkVal = weeklyLossStoredValue(lossType, lossDisplayNum);
  let w = startKg;
  let d = 0;
  while (d + 7 <= days) {
    w = projectNextWeekKg(w, lossType, wkVal);
    d += 7;
  }
  const rem = days - d;
  if (rem > 0) {
    const lossKg = weeklyLossKg(lossType, wkVal, w) * (rem / 7);
    w -= lossKg;
  }
  const endLbs = kgToLbs(w);
  if (endLbs == null) return null;
  return currentLbs - endLbs;
}

export function GoalSetupForm({
  goal,
  latestLog,
  todayIso,
  saving,
  onSave,
  onCancel,
  showCancel,
}: Props) {
  const minTargetDate = addDays(todayIso, 1);

  const [currentWeightLbs, setCurrentWeightLbs] = useState(() => {
    if (!latestLog) return "";
    const lbs = kgToLbs(Number(latestLog.weight_kg));
    return lbs != null ? String(lbs) : "";
  });
  const [goalLbs, setGoalLbs] = useState(() => {
    if (!goal) return "";
    const gl = kgToLbs(goal.goal_weight_kg);
    return gl != null ? String(gl) : "";
  });
  const [lbsToLose, setLbsToLose] = useState(() => {
    if (!goal || !latestLog) return "";
    const cur = kgToLbs(Number(latestLog.weight_kg));
    const gl = kgToLbs(goal.goal_weight_kg);
    if (cur == null || gl == null) return "";
    return roundSmartGoalLbs(cur - gl);
  });
  const [goalDate, setGoalDate] = useState(goal?.target_date ?? "");
  const [lossType, setLossType] = useState<WeeklyLossType>(goal?.weekly_loss_type ?? "percentage");
  const [lossValue, setLossValue] = useState(() => {
    if (!goal) return "";
    if (goal.weekly_loss_type === "percentage") {
      return String(goal.weekly_loss_value);
    }
    const lw = kgToLbs(goal.weekly_loss_value);
    return lw != null ? String(lw) : String(goal.weekly_loss_value);
  });
  /** Existing goals keep stored weekly loss until the user changes date, mode, or clears the override. */
  const [lossUserEdited, setLossUserEdited] = useState(() => !!goal);
  const lastPairRef = useRef<"goal" | "lbs">("goal");

  useEffect(() => {
    if (!latestLog) return;
    setCurrentWeightLbs((prev) => {
      if (prev !== "") return prev;
      const lbs = kgToLbs(Number(latestLog.weight_kg));
      return lbs != null ? String(lbs) : "";
    });
  }, [latestLog]);

  const basedOnDate = latestLog?.logged_date ?? null;

  const currentNum = parseFloat(currentWeightLbs);
  const goalNum = parseFloat(goalLbs);
  const loseNum = parseFloat(lbsToLose);

  const currentFieldError = useMemo(() => {
    if (currentWeightLbs.trim() === "") return null;
    if (!Number.isFinite(currentNum) || currentNum <= 0) return "Enter a valid current weight in lbs.";
    return null;
  }, [currentWeightLbs, currentNum]);

  const pairError = useMemo(() => {
    if (!Number.isFinite(currentNum) || currentNum <= 0) return null;
    if (!Number.isFinite(goalNum) && !Number.isFinite(loseNum)) return null;
    if (Number.isFinite(goalNum)) {
      if (goalNum <= 0) return "Goal weight must be greater than zero.";
      if (goalNum >= currentNum) return "Goal weight must be less than your current weight.";
    }
    if (Number.isFinite(loseNum) && loseNum <= 0) return "Pounds to lose must be greater than zero.";
    return null;
  }, [currentNum, goalNum, loseNum]);

  const dateError = useMemo(() => {
    if (!goalDate.trim()) return null;
    if (daysBetween(todayIso, goalDate.trim()) <= 0) return "Target date must be in the future.";
    return null;
  }, [goalDate, todayIso]);

  const suggestion = useMemo(() => {
    if (!Number.isFinite(currentNum) || !Number.isFinite(goalNum) || !goalDate.trim()) return null;
    return suggestedWeeklyLossDisplay(currentNum, goalNum, todayIso, goalDate.trim(), lossType);
  }, [currentNum, goalNum, goalDate, lossType, todayIso]);

  useEffect(() => {
    if (lossUserEdited) return;
    if (suggestion == null) return;
    setLossValue(lossType === "percentage" ? suggestion.toFixed(2) : suggestion.toFixed(1));
  }, [suggestion, lossType, lossUserEdited]);

  const onGoalLbsChange = (raw: string) => {
    setLossUserEdited(false);
    setGoalLbs(raw);
    lastPairRef.current = "goal";
    const c = parseFloat(currentWeightLbs);
    const g = parseFloat(raw);
    if (Number.isFinite(c) && Number.isFinite(g)) {
      setLbsToLose(roundSmartGoalLbs(c - g));
    }
  };

  const onLbsToLoseChange = (raw: string) => {
    setLossUserEdited(false);
    setLbsToLose(raw);
    lastPairRef.current = "lbs";
    const c = parseFloat(currentWeightLbs);
    const l = parseFloat(raw);
    if (Number.isFinite(c) && Number.isFinite(l)) {
      setGoalLbs(roundSmartGoalLbs(c - l));
    }
  };

  const onCurrentChange = (raw: string) => {
    setLossUserEdited(false);
    setCurrentWeightLbs(raw);
    const c = parseFloat(raw);
    const g = parseFloat(goalLbs);
    const l = parseFloat(lbsToLose);
    if (!Number.isFinite(c)) return;
    if (lastPairRef.current === "goal" && Number.isFinite(g)) {
      setLbsToLose(roundSmartGoalLbs(c - g));
    } else if (lastPairRef.current === "lbs" && Number.isFinite(l)) {
      setGoalLbs(roundSmartGoalLbs(c - l));
    }
  };

  const lossNum = parseFloat(lossValue);
  const lossHelper = useMemo(() => {
    if (!Number.isFinite(currentNum) || currentNum <= 0 || !Number.isFinite(lossNum) || lossNum < 0)
      return null;
    let base: string;
    if (lossType === "percentage") {
      const lbsPerWk = (currentNum * lossNum) / 100;
      base = `At this rate you'll lose ${lbsPerWk.toFixed(2)} lbs per week`;
    } else {
      const pct = (lossNum / currentNum) * 100;
      base = `${pct.toFixed(2)}% of your body weight per week`;
    }
    if (
      !lossUserEdited ||
      !Number.isFinite(goalNum) ||
      goalNum <= 0 ||
      goalNum >= currentNum ||
      !goalDate.trim() ||
      dateError
    ) {
      return base;
    }
    const reach = projectedReachDateIso(todayIso, currentNum, goalNum, lossType, lossNum);
    const lostBy = lbsLostByTargetDate(todayIso, goalDate.trim(), currentNum, lossType, lossNum);
    const extra: string[] = [];
    if (reach) {
      extra.push(`Reach ${goalNum.toFixed(1)} lbs around ${formatShortDate(reach)}.`);
    }
    if (lostBy != null && Number.isFinite(lostBy)) {
      const proj = currentNum - lostBy;
      extra.push(
        `By ${formatShortDate(goalDate.trim())}: about ${lostBy.toFixed(1)} lbs lost (≈${proj.toFixed(1)} lbs).`
      );
    }
    if (extra.length === 0) return base;
    return `${base} ${extra.join(" ")}`;
  }, [
    currentNum,
    lossNum,
    lossType,
    lossUserEdited,
    goalNum,
    goalDate,
    dateError,
    todayIso,
  ]);

  const previewWeeks = useMemo(() => {
    if (!Number.isFinite(currentNum) || currentNum <= 0) return [];
    if (!Number.isFinite(lossNum) || lossNum < 0) return [];
    const startKg = lbsToKg(currentNum);
    if (startKg == null) return [];
    const wkVal = lossType === "percentage" ? lossNum : lbsToKg(lossNum) ?? 0;
    let w = startKg;
    const out: number[] = [];
    for (let i = 0; i < 4; i++) {
      w = projectNextWeekKg(w, lossType, wkVal);
      const lb = kgToLbs(w);
      if (lb == null) break;
      out.push(lb);
    }
    return out;
  }, [currentNum, lossNum, lossType]);

  const summaryLine = useMemo(() => {
    if (!Number.isFinite(currentNum) || !Number.isFinite(goalNum) || !goalDate.trim() || dateError)
      return null;
    if (!Number.isFinite(lossNum) || lossNum < 0) return null;
    if (goalNum >= currentNum) return null;
    const rate =
      lossType === "percentage" ? `${lossNum.toFixed(2)}% of body weight` : `${lossNum.toFixed(1)} lbs`;
    const targetLabel = formatShortDate(goalDate.trim());
    if (!lossUserEdited) {
      return `Starting at ${currentNum.toFixed(1)} lbs, losing ${rate} per week, you'll reach ${goalNum.toFixed(1)} lbs by ${targetLabel}`;
    }
    const reach = projectedReachDateIso(todayIso, currentNum, goalNum, lossType, lossNum);
    const lostBy = lbsLostByTargetDate(todayIso, goalDate.trim(), currentNum, lossType, lossNum);
    const reachPart =
      reach != null
        ? ` At that pace you'll reach ${goalNum.toFixed(1)} lbs around ${formatShortDate(reach)}.`
        : "";
    const byTargetPart =
      lostBy != null && Number.isFinite(lostBy)
        ? ` By ${targetLabel} you'll lose about ${lostBy.toFixed(1)} lbs (≈${(currentNum - lostBy).toFixed(1)} lbs).`
        : "";
    return `Custom weekly rate: ${rate} from ${currentNum.toFixed(1)} lbs.${reachPart}${byTargetPart}`;
  }, [currentNum, goalNum, goalDate, lossNum, lossType, dateError, lossUserEdited, todayIso]);

  const handleSubmit = () => {
    if (!Number.isFinite(currentNum) || currentNum <= 0) return;
    if (!Number.isFinite(goalNum) || goalNum <= 0) return;
    if (goalNum >= currentNum) return;
    if (!goalDate.trim()) return;
    if (dateError) return;
    if (!Number.isFinite(lossNum) || lossNum < 0) return;
    const gkg = lbsToKg(goalNum);
    if (gkg == null) return;
    const wlv = lossType === "percentage" ? lossNum : lbsToKg(lossNum) ?? 0;
    void onSave({
      goalWeightKg: gkg,
      targetDate: goalDate.trim(),
      weeklyLossType: lossType,
      weeklyLossValue: wlv,
    });
  };

  const inputClass =
    "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none transition-colors focus:border-[#f97316]/80";
  const inputErrorClass = "border-red-500/60 focus:border-red-500";

  return (
    <div className="font-sans rounded-xl border border-[#f97316]/50 bg-[#0a0a0a] p-6 shadow-lg shadow-black/20">
      <h2 className="text-lg font-semibold text-white">Set your goal</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Current weight, target date, and a linked goal weight / pounds to lose. Weekly rate updates from your
        timeline—you can override it anytime.
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <label className="block text-sm text-zinc-400">Current weight (lbs)</label>
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={currentWeightLbs}
            onChange={(e) => onCurrentChange(e.target.value)}
            className={`${inputClass} ${currentFieldError ? inputErrorClass : ""}`}
          />
          {currentFieldError && <p className="mt-1 text-xs text-red-400">{currentFieldError}</p>}
          {basedOnDate && (
            <p className="mt-1 text-xs text-zinc-500">
              Based on your last logged weight on {formatShortDate(basedOnDate)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-zinc-400">Target date</label>
          <input
            type="date"
            min={minTargetDate}
            value={goalDate}
            onChange={(e) => {
              setLossUserEdited(false);
              setGoalDate(e.target.value);
            }}
            className={`${inputClass} ${dateError ? inputErrorClass : ""}`}
          />
          {dateError && <p className="mt-1 text-xs text-red-400">{dateError}</p>}
        </div>

        <div>
          <span className="text-sm text-zinc-400">Goal weight & pounds to lose</span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs text-zinc-500">
              Goal weight (lbs)
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={goalLbs}
                onChange={(e) => onGoalLbsChange(e.target.value)}
                className={`${inputClass} text-sm ${pairError ? inputErrorClass : ""}`}
              />
            </label>
            <div
              className="flex shrink-0 items-center justify-center pb-2 text-lg font-semibold text-[#f97316] sm:pb-3"
              aria-hidden
            >
              ⇄
            </div>
            <label className="min-w-0 flex-1 text-xs text-zinc-500">
              Lbs to lose
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={lbsToLose}
                onChange={(e) => onLbsToLoseChange(e.target.value)}
                className={`${inputClass} text-sm ${pairError ? inputErrorClass : ""}`}
              />
            </label>
          </div>
          {pairError && <p className="mt-2 text-xs text-red-400">{pairError}</p>}
        </div>

        <div>
          <span className="text-sm text-zinc-400">Weekly loss method</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setLossUserEdited(false);
                setLossType("percentage");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                lossType === "percentage"
                  ? "bg-[#f97316] text-[#0a0a0a]"
                  : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              % per week
            </button>
            <button
              type="button"
              onClick={() => {
                setLossUserEdited(false);
                setLossType("fixed");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                lossType === "fixed"
                  ? "bg-[#f97316] text-[#0a0a0a]"
                  : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              lbs per week
            </button>
          </div>
          <label className="mt-3 block text-sm text-zinc-400">
            {lossType === "percentage" ? "Percent per week" : "Pounds per week"}
            <input
              type="number"
              step={lossType === "percentage" ? "0.01" : "0.1"}
              inputMode="decimal"
              value={lossValue}
              placeholder={
                suggestion != null
                  ? lossType === "percentage"
                    ? suggestion.toFixed(2)
                    : suggestion.toFixed(1)
                  : undefined
              }
              onChange={(e) => {
                setLossUserEdited(true);
                setLossValue(e.target.value);
              }}
              className={inputClass}
            />
          </label>
          {lossHelper && <p className="mt-1 text-xs text-zinc-500">{lossHelper}</p>}
        </div>
      </div>

      {summaryLine && (
        <div className="mt-6 rounded-xl border-2 border-[#f97316]/70 bg-[#f97316]/[0.07] px-4 py-4">
          <p className="text-sm font-medium leading-relaxed text-zinc-100">{summaryLine}</p>
          {previewWeeks.length > 0 && (
            <div className="mt-3 border-t border-[#f97316]/25 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#f97316]/90">
                First 4 weeks (preview)
              </p>
              <ul className="mt-2 grid gap-1 text-sm tabular-nums text-zinc-300 sm:grid-cols-2">
                {previewWeeks.map((lb, i) => (
                  <li key={i}>
                    Week {i + 1}: <span className="font-medium text-white">{lb.toFixed(1)}</span> lbs
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={
            saving ||
            !!currentFieldError ||
            !!pairError ||
            !!dateError ||
            !Number.isFinite(currentNum) ||
            !Number.isFinite(goalNum) ||
            !goalDate.trim() ||
            !Number.isFinite(lossNum)
          }
          className="rounded-lg bg-[#f97316] px-5 py-2.5 text-sm font-semibold text-[#0a0a0a] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save goal"}
        </button>
        {showCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
