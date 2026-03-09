"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedToday, setLoggedToday] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user: u }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setError("Could not load your session.");
        setLoading(false);
        return;
      }
      if (!u) {
        router.replace("/auth/login");
        setLoading(false);
        return;
      }
      setUser(u);

      const today = new Date().toISOString().slice(0, 10);
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", u.id)
        .not("completed_at", "is", null)
        .gte("completed_at", `${today}T00:00:00Z`)
        .lt("completed_at", `${today}T23:59:59.999Z`)
        .limit(1);
      setLoggedToday((logs?.length ?? 0) > 0);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error} backHref="/auth/login" backLabel="Sign in" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Dashboard"
          description={`${todayFormatted}${user.email ? ` · ${user.email}` : ""}`}
        />

        {!loggedToday && (
          <div className="mt-6 rounded-xl border border-[#f97316]/40 bg-[#f97316]/10 p-4">
            <p className="font-medium text-[#f97316]">No workout logged today yet.</p>
            <p className="mt-1 text-sm text-zinc-400">
              Log a session to keep your streak and see progress over time.
            </p>
            <Link
              href="/workouts/log"
              className="mt-3 inline-flex items-center rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ea580c]"
            >
              Log Workout
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link
            href="/workouts/log"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-[#f97316]/60 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">Log Workout</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Record a new workout or continue from a template.
            </p>
          </Link>
          <Link
            href="/progress"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-[#f97316]/60 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">View Progress</h2>
            <p className="mt-1 text-sm text-zinc-400">
              See exercise trends and estimated 1RM over time.
            </p>
          </Link>
          <Link
            href="/reports"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-[#f97316]/60 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">View Reports</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Volume, frequency, bodyweight, and PRs over time.
            </p>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/mesocycles"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">Mesocycles</h2>
            <p className="mt-1 text-sm text-zinc-400">Manage your training blocks and programs.</p>
          </Link>
          <Link
            href="/workouts/history"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold text-white">Workout History</h2>
            <p className="mt-1 text-sm text-zinc-400">Browse and compare past workouts.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
