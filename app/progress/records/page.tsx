"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { kgToLbs } from "@/lib/units";
import type { PersonalRecord } from "@/types";

type Row = PersonalRecord & { exercise_name: string };

export default function ProgressRecordsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        setLoading(false);
        return;
      }
      const { data: prs } = await supabase
        .from("personal_records")
        .select("*")
        .eq("user_id", user.id)
        .order("achieved_at", { ascending: false })
        .limit(200);
      const ids = Array.from(new Set((prs ?? []).map((p: PersonalRecord) => p.exercise_id)));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: ex } = await supabase.from("exercises").select("id, name").in("id", ids);
        names = Object.fromEntries((ex ?? []).map((e: { id: string; name: string }) => [e.id, e.name]));
      }
      setRows(
        (prs ?? []).map((p: PersonalRecord) => ({
          ...p,
          exercise_name: names[p.exercise_id] ?? "Exercise",
        }))
      );
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader title="Records" description="Personal records across exercises." />
        <p className="mt-2 text-sm">
          <Link href="/weight" className="text-theme-accent hover:underline">
            Weight tracking →
          </Link>
        </p>
        {rows.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No personal records yet"
              description="Complete workouts and set PRs to see them listed here."
              actionHref="/workouts/log"
              actionLabel="Log workout"
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-theme-border bg-theme-surface/50 px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/progress/exercise/${r.exercise_id}`}
                    className="font-medium text-theme-text-primary hover:text-theme-accent"
                  >
                    {r.exercise_name}
                  </Link>
                  <span className="text-sm text-theme-text-muted">
                    {new Date(r.achieved_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-theme-text-muted">
                  {r.record_type.replace(/_/g, " ")} ·{" "}
                  {r.record_type === "max_weight"
                    ? `${kgToLbs(r.value)?.toFixed(1) ?? r.value} lbs`
                    : r.record_type === "max_duration"
                      ? `${r.value} s`
                      : String(r.value)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
