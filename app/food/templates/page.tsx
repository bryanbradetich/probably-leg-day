"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { FoodSearchPicker } from "@/components/food/FoodSearchPicker";
import { TemplateLogModal, type TemplateWithFoods } from "@/components/food/TemplateLogModal";
import { scaledNutrients, sumNutrients, formatKcal } from "@/lib/food-helpers";
import { localISODate } from "@/lib/weight-helpers";
import type { Food, FoodServingUnit } from "@/types";

type Line = { tempId: string; food_id: string; quantity: string; serving_unit: FoodServingUnit; food?: Food };

function newLine(): Line {
  return {
    tempId: crypto.randomUUID(),
    food_id: "",
    quantity: "100",
    serving_unit: "g",
  };
}

export default function MealTemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [templates, setTemplates] = useState<TemplateWithFoods[]>([]);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [templateToLog, setTemplateToLog] = useState<TemplateWithFoods | null>(null);

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
    const { data: fRows, error: fErr } = await supabase.from("foods").select("*").order("name");
    if (fErr) {
      setError(fErr.message);
      setLoading(false);
      return;
    }
    setFoods((fRows ?? []) as Food[]);

    const { data: tRows, error: tErr } = await supabase
      .from("meal_templates")
      .select("*, meal_template_foods(*, foods(*))")
      .eq("user_id", user.id)
      .order("name");
    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      return;
    }
    setTemplates((tRows ?? []) as TemplateWithFoods[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const foodById = useMemo(() => {
    const m: Record<string, Food> = {};
    for (const f of foods) m[f.id] = f;
    return m;
  }, [foods]);

  const startNew = () => {
    setEditId(null);
    setFormName("");
    setLines([newLine()]);
    setCreating(true);
  };

  const startEdit = (t: TemplateWithFoods) => {
    setEditId(t.id);
    setFormName(t.name);
    setLines(
      t.meal_template_foods.map((row) => ({
        tempId: row.id,
        food_id: row.food_id,
        quantity: String(row.quantity),
        serving_unit: row.serving_unit,
        food: row.foods,
      }))
    );
    setCreating(true);
  };

  const saveTemplate = async () => {
    if (!userId || !formName.trim()) {
      setError("Template name is required.");
      return;
    }
    const resolved = lines
      .map((l) => {
        const food = l.food ?? foodById[l.food_id];
        const q = parseFloat(l.quantity);
        return food && Number.isFinite(q) && q > 0
          ? { food_id: food.id, quantity: q, serving_unit: l.serving_unit }
          : null;
      })
      .filter((x): x is { food_id: string; quantity: number; serving_unit: FoodServingUnit } => x != null);
    if (resolved.length === 0) {
      setError("Add at least one food with a valid quantity.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();

    if (editId) {
      const { error: delErr } = await supabase.from("meal_template_foods").delete().eq("template_id", editId);
      if (delErr) {
        setError(delErr.message);
        setSaving(false);
        return;
      }
      const { error: uErr } = await supabase.from("meal_templates").update({ name: formName.trim() }).eq("id", editId);
      if (uErr) {
        setError(uErr.message);
        setSaving(false);
        return;
      }
      const { error: insErr } = await supabase.from("meal_template_foods").insert(
        resolved.map((r) => ({
          template_id: editId,
          food_id: r.food_id,
          quantity: r.quantity,
          serving_unit: r.serving_unit,
        }))
      );
      setSaving(false);
      if (insErr) setError(insErr.message);
      else {
        setCreating(false);
        void load();
      }
      return;
    }

    const { data: insT, error: tErr } = await supabase
      .from("meal_templates")
      .insert({ user_id: userId, name: formName.trim() })
      .select("id")
      .single();
    if (tErr || !insT) {
      setError(tErr?.message ?? "Could not create template.");
      setSaving(false);
      return;
    }
    const tid = insT.id as string;
    const { error: insErr } = await supabase.from("meal_template_foods").insert(
      resolved.map((r) => ({
        template_id: tid,
        food_id: r.food_id,
        quantity: r.quantity,
        serving_unit: r.serving_unit,
      }))
    );
    setSaving(false);
    if (insErr) setError(insErr.message);
    else {
      setCreating(false);
      void load();
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const supabase = createClient();
    const { error: e } = await supabase.from("meal_templates").delete().eq("id", id).eq("user_id", userId!);
    if (e) setError(e.message);
    else void load();
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text-primary">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error ?? "Session expired."} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader title="Meal templates" description="Save combos and log them in one tap." />

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/food" className="font-medium text-theme-accent hover:underline">
            Today&apos;s log
          </Link>
          <span className="text-theme-text-muted/80">·</span>
          <Link href="/food/library" className="font-medium text-theme-accent hover:underline">
            Food library
          </Link>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {!creating ? (
          <>
            <button
              type="button"
              onClick={startNew}
              className="mt-8 rounded-xl bg-theme-accent px-5 py-3 text-sm font-bold text-theme-on-accent"
            >
              New template
            </button>
            <ul className="mt-8 space-y-4">
              {templates.length === 0 ? (
                <li className="rounded-xl border border-dashed border-theme-border py-12 text-center text-theme-text-muted">
                  No templates yet.
                </li>
              ) : (
                templates.map((t) => {
                  const nuts = sumNutrients(
                    t.meal_template_foods.map((row) =>
                      scaledNutrients(row.foods, Number(row.quantity), row.serving_unit)
                    )
                  );
                  return (
                    <li key={t.id} className="rounded-xl border border-theme-border bg-theme-surface/40 px-5 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-theme-text-primary">{t.name}</h3>
                          <p className="mt-1 text-sm font-bold text-theme-text-muted">
                            {t.meal_template_foods.length} food{t.meal_template_foods.length === 1 ? "" : "s"} ·{" "}
                            {formatKcal(nuts.calories)} kcal · P {nuts.protein_g.toFixed(0)}g · C {nuts.carbs_g.toFixed(0)}g ·
                            F {nuts.fat_g.toFixed(0)}g
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setTemplateToLog(t)}
                            className="rounded-lg bg-theme-accent px-3 py-2 text-sm font-bold text-theme-on-accent"
                          >
                            Log template
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            className="rounded-lg border border-theme-border/80 px-3 py-2 text-sm font-semibold text-theme-text-primary/90"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTemplate(t.id)}
                            className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        ) : (
          <div className="mt-8 rounded-xl border border-theme-border bg-theme-surface/40 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-theme-text-primary">{editId ? "Edit template" : "New template"}</h2>
            <label className="mt-4 block text-sm text-theme-text-muted">
              Template name
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-input-bg px-3 py-2 font-semibold text-theme-text-primary"
              />
            </label>
            <div className="mt-6 space-y-6">
              {lines.map((line, idx) => (
                <div key={line.tempId} className="rounded-lg border border-theme-border bg-theme-input-bg/50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-theme-text-muted">Food {idx + 1}</span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((L) => L.filter((x) => x.tempId !== line.tempId))}
                        className="text-sm text-red-400"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <FoodSearchPicker
                    foods={foods}
                    onSelect={(f) => {
                      setLines((L) =>
                        L.map((x) => (x.tempId === line.tempId ? { ...x, food_id: f.id, food: f } : x))
                      );
                    }}
                  />
                  {(line.food || foodById[line.food_id]) && (
                    <p className="mt-2 text-sm font-semibold text-theme-accent">
                      Selected: {(line.food ?? foodById[line.food_id])!.name}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((L) =>
                          L.map((x) => (x.tempId === line.tempId ? { ...x, quantity: e.target.value } : x))
                        )
                      }
                      className="w-28 rounded-lg border border-theme-border bg-theme-input-bg px-2 py-2 font-bold text-theme-text-primary"
                    />
                    <div className="flex rounded-lg border border-theme-border p-0.5">
                      {(["g", "oz"] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() =>
                            setLines((L) =>
                              L.map((x) => (x.tempId === line.tempId ? { ...x, serving_unit: u } : x))
                            )
                          }
                          className={`rounded-md px-3 py-2 text-sm font-bold ${
                            line.serving_unit === u ? "bg-theme-accent text-theme-on-accent" : "text-theme-text-muted"
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLines((L) => [...L, newLine()])}
              className="mt-4 text-sm font-semibold text-theme-accent"
            >
              + Add another food
            </button>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditId(null);
                }}
                className="rounded-xl border border-theme-border/80 px-5 py-3 text-sm font-semibold text-theme-text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveTemplate()}
                disabled={saving}
                className="rounded-xl bg-theme-accent px-5 py-3 text-sm font-bold text-theme-on-accent disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save template"}
              </button>
            </div>
          </div>
        )}
      </div>

      <TemplateLogModal
        open={templateToLog !== null}
        onClose={() => setTemplateToLog(null)}
        template={templateToLog}
        userId={userId}
        defaultMealSlot={1}
        defaultDate={localISODate()}
        onLogged={() => void load()}
      />
    </div>
  );
}
