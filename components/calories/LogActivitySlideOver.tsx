"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { localISODate } from "@/lib/weight-helpers";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  defaultActivityName?: string;
  defaultDate?: string;
  onSaved: () => void;
};

export function LogActivitySlideOver({
  open,
  onClose,
  userId,
  defaultActivityName = "",
  defaultDate,
  onSaved,
}: Props) {
  const [activityName, setActivityName] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [notes, setNotes] = useState("");
  const [loggedDate, setLoggedDate] = useState(localISODate());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setActivityName(defaultActivityName);
    setDuration("");
    setCalories("");
    setNotes("");
    setLoggedDate(defaultDate ?? localISODate());
  }, [open, defaultActivityName, defaultDate]);

  if (!open) return null;

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
    const { error: e } = await supabase.from("calorie_burns").insert({
      user_id: userId,
      logged_date: loggedDate,
      activity_name: name,
      calories_burned: cal,
      duration_minutes: dur,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (e) {
      setErr(e.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" aria-hidden onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-theme-border shadow-xl"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="flex items-center justify-between border-b border-theme-border px-4 py-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Log activity
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
          <input
            className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
            style={{ backgroundColor: "var(--input-bg)" }}
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            placeholder="e.g. Morning run"
          />
          <label className="mt-4 block text-sm font-medium text-theme-text-muted">Duration (minutes, optional)</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
            style={{ backgroundColor: "var(--input-bg)" }}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
          />
          <label className="mt-4 block text-sm font-medium text-theme-text-muted">Calories burned</label>
          <input
            type="number"
            min={0}
            step="1"
            className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-theme-text-primary"
            style={{ backgroundColor: "var(--input-bg)" }}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="250"
          />
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
