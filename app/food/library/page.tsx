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
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <ErrorState message={error ?? "Session expired."} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <PageHeader title="Food library" description="Search, create, and log foods." />

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/food" className="font-medium text-[#f97316] hover:underline">
            Today&apos;s log
          </Link>
          <span className="text-zinc-600">·</span>
          <Link href="/food/templates" className="font-medium text-[#f97316] hover:underline">
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
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#f97316] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setEditFood(null);
              setSlideOpen(true);
            }}
            className="shrink-0 rounded-xl bg-[#f97316] px-5 py-3 text-sm font-bold text-[#0a0a0a]"
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
                filter === k ? "bg-zinc-800 text-white" : "text-zinc-500 hover:bg-zinc-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ul className="mt-8 space-y-3">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-700 py-12 text-center text-sm text-zinc-500">
              No foods match your filters.
            </li>
          ) : (
            filtered.map((f) => {
              const isMine = f.user_id === userId;
              return (
                <li
                  key={f.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4 sm:px-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-bold text-white">{f.name}</p>
                      {f.brand && <p className="text-sm text-zinc-500">{f.brand}</p>}
                      <p className="mt-2 text-sm font-bold text-zinc-300">
                        Serving:{" "}
                        <span className="tabular-nums text-white">
                          {Number(f.serving_size)}
                          {f.serving_unit}
                        </span>
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        <span className="text-white">{formatKcal(Number(f.calories))} kcal</span>
                        <span className="text-zinc-500"> · </span>
                        <span className="text-[#3b82f6]">P {Number(f.protein_g).toFixed(1)}g</span>
                        <span className="text-zinc-500"> · </span>
                        <span className="text-[#eab308]">C {Number(f.carbs_g).toFixed(1)}g</span>
                        <span className="text-zinc-500"> · </span>
                        <span className="text-[#f97316]">F {Number(f.fat_g).toFixed(1)}g</span>
                      </p>
                      {f.is_public && (
                        <span className="mt-2 inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
                          Public
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setLogFood(f)}
                        className="rounded-lg bg-[#f97316] px-3 py-2 text-sm font-bold text-[#0a0a0a]"
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
                            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-semibold text-zinc-200"
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
