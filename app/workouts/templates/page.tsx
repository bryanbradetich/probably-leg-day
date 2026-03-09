"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutTemplate } from "@/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkoutTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<(WorkoutTemplate & { mesocycles?: { name: string } | null; exercise_count: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const { data: templateRows, error: tError } = await supabase
      .from("workout_templates")
      .select("*, mesocycles(name)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (tError) {
      console.error("Failed to load templates", tError);
      setTemplates([]);
      setLoading(false);
      return;
    }

    type Row = WorkoutTemplate & { mesocycles?: { name: string } | null };
    const rows = (templateRows ?? []) as Row[];
    const templateIds = rows.map((t) => t.id);
    if (templateIds.length === 0) {
      setTemplates(rows.map((t) => ({ ...t, exercise_count: 0 })));
      setLoading(false);
      return;
    }

    const { data: exerciseRows } = await supabase
      .from("workout_template_exercises")
      .select("template_id")
      .in("template_id", templateIds);

    const countByTemplate: Record<string, number> = {};
    templateIds.forEach((id) => (countByTemplate[id] = 0));
    (exerciseRows ?? []).forEach((r: { template_id: string }) => {
      countByTemplate[r.template_id] = (countByTemplate[r.template_id] ?? 0) + 1;
    });

    setTemplates(
      rows.map((t) => ({ ...t, exercise_count: countByTemplate[t.id] ?? 0 }))
    );
    setLoading(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("workout_templates").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete template", error);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Workout Templates
          </h1>
          <Link
            href="/workouts/templates/new"
            className="inline-flex items-center justify-center rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] shadow transition hover:bg-[#ea580c] focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
          >
            New Template
          </Link>
        </div>

        {loading ? (
          <p className="mt-6 text-zinc-500">Loading templates...</p>
        ) : templates.length === 0 ? (
          <div className="mt-12 rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <p className="text-zinc-400">No templates yet.</p>
            <Link
              href="/workouts/templates/new"
              className="mt-4 inline-block text-[#f97316] hover:underline"
            >
              Create your first template
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-4 sm:px-5"
              >
                <div>
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {t.exercise_count} exercise{t.exercise_count !== 1 ? "s" : ""}
                    {t.mesocycles?.name ? ` · ${t.mesocycles.name}` : ""}
                    {t.day_of_week != null ? ` · ${DAYS[t.day_of_week]}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/workouts/templates/${t.id}/edit`}
                    className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id, t.name)}
                    className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
