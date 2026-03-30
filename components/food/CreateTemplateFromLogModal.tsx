"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyFoodLogWithFood } from "@/types";
import { MEAL_SLOT_LABELS, MEAL_SLOTS, scaledNutrients, sumNutrients, formatKcal } from "@/lib/food-helpers";
import { addDays, formatMonthDay, localISODate } from "@/lib/weight-helpers";

type SlotOption = {
  slot: number;
  rows: DailyFoodLogWithFood[];
  foodCount: number;
  totalCalories: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSaved: () => void;
};

export function CreateTemplateFromLogModal({ open, onClose, userId, onSaved }: Props) {
  const [pickedDate, setPickedDate] = useState(() => addDays(localISODate(), -1));
  const [slotOptions, setSlotOptions] = useState<SlotOption[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buildOptions = useCallback((rows: DailyFoodLogWithFood[]): SlotOption[] => {
    const bySlot: Record<number, DailyFoodLogWithFood[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const row of rows) {
      const s = row.meal_slot;
      if (s >= 1 && s <= 6) bySlot[s].push(row);
    }
    return MEAL_SLOTS.filter((s) => bySlot[s].length > 0).map((s) => {
      const r = bySlot[s];
      const nuts = sumNutrients(r.map((x) => scaledNutrients(x.foods, Number(x.quantity), x.serving_unit)));
      return { slot: s, rows: r, foodCount: r.length, totalCalories: nuts.calories };
    });
  }, []);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      setFetchLoading(true);
      setErr(null);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("daily_food_logs")
        .select("*, foods(*)")
        .eq("user_id", userId)
        .eq("logged_date", pickedDate)
        .order("created_at");
      if (cancelled) return;
      setFetchLoading(false);
      if (error) {
        setErr(error.message);
        setSlotOptions([]);
        return;
      }
      const rows = (data ?? []) as DailyFoodLogWithFood[];
      setSlotOptions(buildOptions(rows));
      setSelectedSlot(null);
      setTemplateName("");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, pickedDate, buildOptions]);

  const selectSlot = (slot: number) => {
    setSelectedSlot(slot);
    setTemplateName(`${MEAL_SLOT_LABELS[slot]} - ${formatMonthDay(pickedDate)}`);
  };

  const save = async () => {
    if (!templateName.trim()) {
      setErr("Template name is required.");
      return;
    }
    if (selectedSlot == null) {
      setErr("Select a meal slot.");
      return;
    }
    const opt = slotOptions.find((o) => o.slot === selectedSlot);
    if (!opt?.rows.length) {
      setErr("No foods for this selection.");
      return;
    }
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const { data: insT, error: tErr } = await supabase
      .from("meal_templates")
      .insert({ user_id: userId, name: templateName.trim() })
      .select("id")
      .single();
    if (tErr || !insT) {
      setSaving(false);
      setErr(tErr?.message ?? "Could not create template.");
      return;
    }
    const tid = insT.id as string;
    const { error: insErr } = await supabase.from("meal_template_foods").insert(
      opt.rows.map((r) => ({
        template_id: tid,
        food_id: r.food_id,
        quantity: Number(r.quantity),
        serving_unit: r.serving_unit,
      }))
    );
    setSaving(false);
    if (insErr) {
      setErr(insErr.message);
      return;
    }
    onSaved();
    onClose();
  };

  if (!open) return null;

  const noFoodForDay =
    !fetchLoading && !err && slotOptions.length === 0 && pickedDate;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className="flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-theme-border bg-theme-bg shadow-xl sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl"
          role="dialog"
          aria-modal
          aria-labelledby="create-template-from-log-title"
        >
          <div className="border-b border-theme-border px-5 py-4">
            <h2 id="create-template-from-log-title" className="text-lg font-bold text-theme-text-primary">
              Create template from log
            </h2>
            <p className="mt-1 text-sm text-theme-text-muted">Copy a logged meal into a reusable template.</p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {err && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>
            )}
            <label className="block text-sm font-medium text-theme-text-muted">
              Date
              <input
                type="date"
                value={pickedDate}
                onChange={(e) => setPickedDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-sm font-bold text-theme-text-primary"
              />
            </label>

            {fetchLoading && <p className="text-sm text-theme-text-muted">Loading…</p>}

            {noFoodForDay && <p className="text-sm font-medium text-theme-text-muted">No food logged for this date.</p>}

            {!fetchLoading && slotOptions.length > 0 && (
              <div>
                <span className="text-sm font-medium text-theme-text-muted">Meal slot</span>
                <ul className="mt-2 space-y-2">
                  {slotOptions.map((o) => (
                    <li key={o.slot}>
                      <button
                        type="button"
                        onClick={() => selectSlot(o.slot)}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors ${
                          selectedSlot === o.slot
                            ? "border-theme-accent bg-theme-surface/80"
                            : "border-theme-border bg-theme-input-bg/40 hover:bg-theme-surface/60"
                        }`}
                      >
                        <span className="font-bold text-theme-text-primary">{MEAL_SLOT_LABELS[o.slot]}</span>
                        <span className="text-xs text-theme-text-muted">
                          {o.foodCount} food{o.foodCount === 1 ? "" : "s"} · {formatKcal(o.totalCalories)} kcal
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedSlot != null && slotOptions.some((o) => o.slot === selectedSlot) && (
              <>
                <label className="block text-sm font-medium text-theme-text-muted">
                  Template name
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-sm font-bold text-theme-text-primary"
                  />
                </label>
              </>
            )}
          </div>
          <div className="flex gap-3 border-t border-theme-border px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-theme-border/80 py-3 text-sm font-semibold text-theme-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || selectedSlot == null || !templateName.trim()}
              className="flex-1 rounded-xl bg-theme-accent py-3 text-sm font-bold text-theme-on-accent disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save as template"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
