"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { FoodFormSlideOver } from "@/components/food/FoodFormSlideOver";
import { LogFoodModal } from "@/components/food/LogFoodModal";
import { formatKcal } from "@/lib/food-helpers";
import type { Food } from "@/types";

type Filter = "all" | "mine" | "public";

export default function FoodLibraryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editFood, setEditFood] = useState<Food | null>(null);
  const [logFood, setLogFood] = useState<Food | null>(null);

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
    const { data, error: e } = await supabase.from("foods").select("*").order("name");
    if (e) {
      setError(e.message);
      setLoading(false);
      return;
    }
    setFoods((data ?? []) as Food[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return foods.filter((f) => {
      if (filter === "mine" && f.user_id !== userId) return false;
      if (filter === "public" && !f.is_public) return false;
      if (!t) return true;
      const nm = f.name.toLowerCase();
      const br = (f.brand ?? "").toLowerCase();
      return nm.includes(t) || br.includes(t);
    });
  }, [foods, search, filter, userId]);

  const deleteFood = async (f: Food) => {
    if (f.user_id !== userId || !confirm(`Delete “${f.name}”?`)) return;
    const supabase = createClient();
    const { error: e } = await supabase.from("foods").delete().eq("id", f.id).eq("user_id", userId!);
    if (e) setError(e.message);
    else void load();
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text-primary">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <ErrorState message={error ?? "Session expired."} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <PageHeader title="Food library" description="Search, create, and log foods." />

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/food" className="font-medium text-theme-accent hover:underline">
            Today&apos;s log
          </Link>
          <span className="text-theme-text-muted/80">·</span>
          <Link href="/food/templates" className="font-medium text-theme-accent hover:underline">
            Meal templates
          </Link>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or brand…"
            className="w-full max-w-md rounded-xl border border-theme-border bg-theme-input-bg px-4 py-3 text-sm text-theme-text-primary placeholder:text-theme-text-muted/60 focus:border-theme-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setEditFood(null);
              setSlideOpen(true);
            }}
            className="shrink-0 rounded-xl bg-theme-accent px-5 py-3 text-sm font-bold text-theme-on-accent"
          >
            Add food
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["mine", "My foods"],
              ["public", "Public foods"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                filter === k ? "bg-theme-border/90 text-theme-text-primary" : "text-theme-text-muted hover:bg-theme-surface"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ul className="mt-8 space-y-3">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed border-theme-border py-12 text-center text-sm text-theme-text-muted">
              No foods match your filters.
            </li>
          ) : (
            filtered.map((f) => {
              const isMine = f.user_id === userId;
              return (
                <li
                  key={f.id}
                  className="rounded-xl border border-theme-border bg-theme-surface/40 px-4 py-4 sm:px-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-bold text-theme-text-primary">{f.name}</p>
                      {f.brand && <p className="text-sm text-theme-text-muted">{f.brand}</p>}
                      <p className="mt-2 text-sm font-bold text-theme-text-muted">
                        Serving:{" "}
                        <span className="tabular-nums text-theme-text-primary">
                          {Number(f.serving_size)}
                          {f.serving_unit}
                        </span>
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        <span className="text-theme-text-primary">{formatKcal(Number(f.calories))} kcal</span>
                        <span className="text-theme-text-muted"> · </span>
                        <span className="text-theme-macro-protein">P {Number(f.protein_g).toFixed(1)}g</span>
                        <span className="text-theme-text-muted"> · </span>
                        <span className="text-theme-macro-carbs">C {Number(f.carbs_g).toFixed(1)}g</span>
                        <span className="text-theme-text-muted"> · </span>
                        <span className="text-theme-accent">F {Number(f.fat_g).toFixed(1)}g</span>
                      </p>
                      {f.is_public && (
                        <span className="mt-2 inline-block rounded bg-theme-border/90 px-2 py-0.5 text-xs font-medium text-theme-text-muted">
                          Public
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setLogFood(f)}
                        className="rounded-lg bg-theme-accent px-3 py-2 text-sm font-bold text-theme-on-accent"
                      >
                        Add to today&apos;s log
                      </button>
                      {isMine && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditFood(f);
                              setSlideOpen(true);
                            }}
                            className="rounded-lg border border-theme-border/80 px-3 py-2 text-sm font-semibold text-theme-text-primary/90"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteFood(f)}
                            className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-400"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <FoodFormSlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setEditFood(null);
        }}
        userId={userId}
        editFood={editFood}
        onSaved={() => void load()}
      />

      <LogFoodModal
        open={logFood !== null}
        onClose={() => setLogFood(null)}
        food={logFood}
        userId={userId}
        defaultMealSlot={1}
        onSaved={() => setLogFood(null)}
      />
    </div>
  );
}
