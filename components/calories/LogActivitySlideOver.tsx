"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { localISODate } from "@/lib/weight-helpers";
import { kgToLbs } from "@/lib/units";
import {
  estimateCaloriesFromMet,
  findMetActivityByExactName,
  metForExactActivityName,
  type MetActivity,
} from "@/lib/met-activities";
import type { CalorieBurn } from "@/types";
import { MetActivityCombobox } from "./MetActivityCombobox";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  defaultActivityName?: string;
  defaultDate?: string;
  editBurn?: CalorieBurn | null;
  onSaved: () => void;
  /** Most recent `daily_weights.weight_kg` for MET estimate; null if none logged */
  latestWeightKg: number | null;
};

export function LogActivitySlideOver({
  open,
  onClose,
  userId,
  defaultActivityName = "",
  defaultDate,
  editBurn = null,
  onSaved,
  latestWeightKg,
}: Props) {
  const [activityName, setActivityName] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [notes, setNotes] = useState("");
  const [loggedDate, setLoggedDate] = useState(localISODate());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [calculateErr, setCalculateErr] = useState<string | null>(null);
  const [estimateLine, setEstimateLine] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<
    { name: string; metActivity: MetActivity | null }[]
  >([]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("calorie_burns")
        .select("activity_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled || error) return;
      const seen = new Set<string>();
      const ordered: string[] = [];
      for (const row of data ?? []) {
        const raw = row?.activity_name;
        const n = typeof raw === "string" ? raw.trim() : "";
        if (!n) continue;
        const k = n.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        ordered.push(n);
        if (ordered.length >= 5) break;
      }
      const items = ordered.map((name) => ({
        name,
        metActivity: findMetActivityByExactName(name),
      }));
      if (!cancelled) setRecentActivities(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setCalculateErr(null);
    setEstimateLine(null);
    if (editBurn) {
      setActivityName(editBurn.activity_name ?? "");
      setDuration(editBurn.duration_minutes == null ? "" : String(editBurn.duration_minutes));
      setCalories(editBurn.calories_burned == null ? "" : String(editBurn.calories_burned));
      setNotes(editBurn.notes ?? "");
      setLoggedDate(editBurn.logged_date ?? localISODate());
      return;
    }
    setActivityName(defaultActivityName);
    setDuration("");
    setCalories("");
    setNotes("");
    setLoggedDate(defaultDate ?? localISODate());
  }, [open, defaultActivityName, defaultDate, editBurn]);

  useEffect(() => {
    if (!open) return;
    setCalculateErr(null);
    setEstimateLine(null);
  }, [activityName, duration, open]);

  const resolvedMet = useMemo(
    () => metForExactActivityName(activityName),
    [activityName]
  );

  const durationMinutesParsed = useMemo(() => {
    const t = duration.trim();
    if (t === "") return null;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [duration]);

  const calculateEnabled = resolvedMet != null && durationMinutesParsed != null;

  const calculateTooltip = calculateEnabled
    ? undefined
    : "Select an activity from the list and enter duration to calculate";

  const runCalculate = () => {
    if (resolvedMet == null) return;
    if (durationMinutesParsed == null) {
      setCalculateErr("Duration is required to calculate an estimate.");
      return;
    }
    if (latestWeightKg == null || !Number.isFinite(latestWeightKg)) {
      setCalculateErr(
        "No weight logged — please log your weight first or enter calories manually"
      );
      return;
    }
    setCalculateErr(null);
    const kcal = estimateCaloriesFromMet(
      resolvedMet,
      latestWeightKg,
      durationMinutesParsed
    );
    const rounded = Math.round(kcal);
    setCalories(String(rounded));
    const lbs = kgToLbs(latestWeightKg);
    const lbsStr = lbs != null ? `${lbs} lbs` : "—";
    setEstimateLine(
      `Estimated based on ${activityName.trim()} at MET ${resolvedMet} for ${durationMinutesParsed} min at ${lbsStr}`
    );
  };

  const submit = async () => {
    const name = activityName.trim();
    const cal = parseFloat(calories);
    const dur = duration.trim() === "" ? null : parseInt(duration, 10);
    if (!name) {
      setErr("Enter an activity name.");
      return;
    }
    if (!Number.isFinite(cal) || cal <= 0) {
      setErr("Enter calories burned (positive number).");
      return;
    }
    if (dur != null && (!Number.isFinite(dur) || dur < 0)) {
      setErr("Duration must be a non-negative whole number of minutes.");
      return;
    }
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const payload = {
      logged_date: loggedDate,
      activity_name: name,
      calories_burned: cal,
      duration_minutes: dur,
      notes: notes.trim() || null,
    };
    const { error: e } = editBurn
      ? await supabase.from("calorie_burns").update(payload).eq("id", editBurn.id).eq("user_id", userId)
      : await supabase.from("calorie_burns").insert({ user_id: userId, ...payload });
    setSaving(false);
    if (e) {
      setErr(e.message);
      return;
    }
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg) 25%, black)" }}
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-theme-border shadow-xl"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="flex items-center justify-between border-b border-theme-border px-4 py-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {editBurn ? "Edit Activity" : "Log activity"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-theme-text-muted transition hover:bg-theme-border/60 hover:text-theme-text-primary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {err && (
            <p className="mb-3 rounded-lg border border-theme-border bg-theme-danger/10 px-3 py-2 text-sm text-theme-danger">
              {err}
            </p>
          )}
          <label className="block text-sm font-medium text-theme-text-muted">Activity name</label>
          <MetActivityCombobox
            value={activityName}
            onChange={setActivityName}
            recentItems={recentActivities}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Select from list to enable calorie estimate, or type a custom activity
          </p>
          <label className="mt-4 block text-sm font-medium text-theme-text-muted">
            Duration (minutes)
          </label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
            style={{ backgroundColor: "var(--input-bg)" }}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Required when using Calculate; optional if you enter calories manually
          </p>
          <label className="mt-4 block text-sm font-medium text-theme-text-muted">Calories burned</label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              type="number"
              min={0}
              step="1"
              className="min-w-0 flex-1 rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
              style={{ backgroundColor: "var(--input-bg)" }}
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="250"
            />
            <span title={calculateTooltip} className="shrink-0 sm:self-auto">
              <button
                type="button"
                disabled={!calculateEnabled}
                onClick={runCalculate}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold transition sm:w-auto sm:min-w-[9rem]"
                style={
                  calculateEnabled
                    ? {
                        backgroundColor: "var(--accent)",
                        color: "var(--on-accent)",
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "var(--text-muted)",
                        opacity: 0.5,
                        cursor: "not-allowed",
                      }
                }
              >
                Calculate estimate
              </button>
            </span>
          </div>
          {calculateErr && (
            <p className="mt-2 text-sm text-theme-danger">{calculateErr}</p>
          )}
          {estimateLine && !calculateErr && (
            <p
              className="mt-2 text-sm italic"
              style={{ color: "var(--text-muted)" }}
            >
              {estimateLine}
            </p>
          )}
          <label className="mt-4 block text-sm font-medium text-theme-text-muted">Notes (optional)</label>
          <textarea
            className="mt-1 min-h-[72px] w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
            style={{ backgroundColor: "var(--input-bg)" }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Treadmill, heart rate zone…"
          />
          <label className="mt-4 block text-sm font-medium text-theme-text-muted">Date</label>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
            style={{ backgroundColor: "var(--input-bg)" }}
            value={loggedDate}
            onChange={(e) => setLoggedDate(e.target.value)}
          />
        </div>
        <div className="border-t border-theme-border p-4" style={{ backgroundColor: "var(--bg)" }}>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="w-full rounded-lg bg-theme-accent py-2.5 text-sm font-semibold text-theme-on-accent transition hover:bg-theme-accent-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
