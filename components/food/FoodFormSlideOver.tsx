"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Food, FoodServingUnit } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  editFood?: Food | null;
  onSaved: () => void;
};

export function FoodFormSlideOver({ open, onClose, userId, editFood, onSaved }: Props) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingSize, setServingSize] = useState("100");
  const [servingUnit, setServingUnit] = useState<FoodServingUnit>("g");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("0");
  const [carbs, setCarbs] = useState("0");
  const [fat, setFat] = useState("0");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (editFood) {
      setName(editFood.name);
      setBrand(editFood.brand ?? "");
      setServingSize(String(editFood.serving_size));
      setServingUnit(editFood.serving_unit);
      setCalories(String(editFood.calories));
      setProtein(String(editFood.protein_g));
      setCarbs(String(editFood.carbs_g));
      setFat(String(editFood.fat_g));
      setIsPublic(editFood.is_public);
    } else {
      setName("");
      setBrand("");
      setServingSize("100");
      setServingUnit("g");
      setCalories("");
      setProtein("0");
      setCarbs("0");
      setFat("0");
      setIsPublic(false);
    }
  }, [open, editFood]);

  if (!open) return null;

  const submit = async () => {
    const ss = parseFloat(servingSize);
    const cal = parseFloat(calories);
    const p = parseFloat(protein);
    const c = parseFloat(carbs);
    const f = parseFloat(fat);
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }
    if (!Number.isFinite(ss) || ss <= 0) {
      setErr("Serving size must be positive.");
      return;
    }
    if (!Number.isFinite(cal) || cal < 0) {
      setErr("Calories must be a valid number.");
      return;
    }
    if (![p, c, f].every((x) => Number.isFinite(x) && x >= 0)) {
      setErr("Macros must be non-negative numbers.");
      return;
    }
    setSaving(true);
    setErr(null);
    const supabase = createClient();
    const row = {
      user_id: userId,
      name: name.trim(),
      brand: brand.trim() || null,
      serving_size: ss,
      serving_unit: servingUnit,
      calories: cal,
      protein_g: p,
      carbs_g: c,
      fat_g: f,
      is_public: isPublic,
    };
    if (editFood) {
      const { error } = await supabase.from("foods").update(row).eq("id", editFood.id).eq("user_id", userId);
      setSaving(false);
      if (error) setErr(error.message);
      else {
        onSaved();
        onClose();
      }
      return;
    }
    const { error } = await supabase.from("foods").insert(row);
    setSaving(false);
    if (error) setErr(error.message);
    else {
      onSaved();
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-theme-border bg-theme-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-theme-border px-5 py-4">
          <h2 className="text-lg font-bold text-theme-text-primary">{editFood ? "Edit food" : "Add food"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-theme-text-muted hover:bg-theme-border/90 hover:text-theme-text-primary">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {err && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>
          )}
          <label className="block text-sm text-theme-text-muted">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 font-semibold text-theme-text-primary"
            />
          </label>
          <label className="block text-sm text-theme-text-muted">
            Brand (optional)
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-theme-text-primary"
            />
          </label>
          <div>
            <span className="text-sm text-theme-text-muted">Serving size</span>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={0.01}
                step="any"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 font-bold text-theme-text-primary"
              />
              <div className="flex rounded-lg border border-theme-border p-0.5">
                {(["g", "oz"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setServingUnit(u)}
                    className={`rounded-md px-3 py-2 text-sm font-bold ${
                      servingUnit === u ? "bg-theme-accent text-theme-on-accent" : "text-theme-text-muted"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="block text-sm text-theme-text-muted">
            Calories (per serving)
            <input
              type="number"
              min={0}
              step="1"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 text-lg font-bold text-theme-text-primary"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm text-theme-text-muted">
              Protein (g)
              <input
                type="number"
                min={0}
                step="0.1"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-2 py-2 font-bold text-theme-macro-protein"
              />
            </label>
            <label className="text-sm text-theme-text-muted">
              Carbs (g)
              <input
                type="number"
                min={0}
                step="0.1"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-2 py-2 font-bold text-theme-macro-carbs"
              />
            </label>
            <label className="text-sm text-theme-text-muted">
              Fat (g)
              <input
                type="number"
                min={0}
                step="0.1"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-2 py-2 font-bold text-theme-accent"
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-theme-border bg-theme-surface/50 px-4 py-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-theme-border/80"
            />
            <span className="text-sm font-medium text-theme-text-muted">Share publicly (visible in everyone&apos;s library)</span>
          </label>
        </div>
        <div className="border-t border-theme-border px-5 py-4">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="w-full rounded-xl bg-theme-accent py-3 text-sm font-bold text-theme-on-accent disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
