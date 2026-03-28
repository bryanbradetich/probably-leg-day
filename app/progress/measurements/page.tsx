"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cmToInches, formatWeight } from "@/lib/units";
import type { BodyMeasurement } from "@/types";

export default function ProgressMeasurementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BodyMeasurement[]>([]);

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
      const { data } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", user.id)
        .order("measured_at", { ascending: false })
        .limit(100);
      setRows((data ?? []) as BodyMeasurement[]);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader title="Measurements" description="Body measurements history." />
        <p className="mt-2 text-sm">
          <Link href="/weight" className="text-theme-accent hover:underline">
            Daily weight tracking →
          </Link>
        </p>
        {rows.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No measurements yet"
              description="Log measurements from your profile or reports workflow when available."
              actionHref="/dashboard"
              actionLabel="Dashboard"
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {rows.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-theme-border bg-theme-surface/50 px-4 py-3 sm:px-5"
              >
                <p className="text-sm text-theme-text-muted">
                  {new Date(m.measured_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {m.weight_kg != null && (
                    <div>
                      <dt className="text-theme-text-muted">Weight</dt>
                      <dd className="text-theme-text-primary">{formatWeight(m.weight_kg, { inLbs: true })}</dd>
                    </div>
                  )}
                  {m.body_fat_percentage != null && (
                    <div>
                      <dt className="text-theme-text-muted">Body fat</dt>
                      <dd className="text-theme-text-primary">{m.body_fat_percentage}%</dd>
                    </div>
                  )}
                  {m.chest_cm != null && (
                    <div>
                      <dt className="text-theme-text-muted">Chest</dt>
                      <dd className="text-theme-text-primary">{cmToInches(m.chest_cm)} in</dd>
                    </div>
                  )}
                  {m.waist_cm != null && (
                    <div>
                      <dt className="text-theme-text-muted">Waist</dt>
                      <dd className="text-theme-text-primary">{cmToInches(m.waist_cm)} in</dd>
                    </div>
                  )}
                </dl>
                {m.notes && <p className="mt-2 text-xs text-theme-text-muted">{m.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
