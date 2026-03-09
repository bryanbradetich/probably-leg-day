"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Mesocycle } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type MesocycleWithCounts = Mesocycle & {
  template_count: number;
  workout_log_count: number;
};

const STATUS_ORDER: Mesocycle["status"][] = ["active", "planned", "completed"];
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  planned: "Planned",
  completed: "Completed",
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: Mesocycle["status"] }) {
  const styles: Record<string, string> = {
    active: "bg-[#f97316]/20 text-[#f97316] border-[#f97316]/40",
    planned: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    completed: "bg-zinc-600/30 text-zinc-400 border-zinc-500/40",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function MesocyclesPage() {
  const router = useRouter();
  const [mesocycles, setMesocycles] = useState<MesocycleWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MesocycleWithCounts | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activateTarget, setActivateTarget] = useState<MesocycleWithCounts | null>(null);
  const [activating, setActivating] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<MesocycleWithCounts | null>(null);
  const [completing, setCompleting] = useState(false);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const { data: rows, error: fetchError } = await supabase
      .from("mesocycles")
      .select("id, user_id, name, description, start_date, end_date, status, created_at, updated_at")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false });

    if (fetchError) {
      setError("Could not load mesocycles. Please try again.");
      setMesocycles([]);
      setLoading(false);
      return;
    }
    setError(null);

    const ids = (rows as Mesocycle[]).map((m) => m.id);
    if (ids.length === 0) {
      setMesocycles(
        (rows as Mesocycle[]).map((m) => ({
          ...m,
          template_count: 0,
          workout_log_count: 0,
        }))
      );
      setLoading(false);
      return;
    }

    const [tRes, lRes] = await Promise.all([
      supabase.from("workout_templates").select("mesocycle_id").in("mesocycle_id", ids),
      supabase.from("workout_logs").select("mesocycle_id").in("mesocycle_id", ids),
    ]);

    const templateCount: Record<string, number> = {};
    const logCount: Record<string, number> = {};
    ids.forEach((id) => {
      templateCount[id] = 0;
      logCount[id] = 0;
    });
    (tRes.data ?? []).forEach((r: { mesocycle_id: string | null }) => {
      if (r.mesocycle_id) templateCount[r.mesocycle_id] = (templateCount[r.mesocycle_id] ?? 0) + 1;
    });
    (lRes.data ?? []).forEach((r: { mesocycle_id: string | null }) => {
      if (r.mesocycle_id) logCount[r.mesocycle_id] = (logCount[r.mesocycle_id] ?? 0) + 1;
    });

    setMesocycles(
      (rows as Mesocycle[]).map((m) => ({
        ...m,
        template_count: templateCount[m.id] ?? 0,
        workout_log_count: logCount[m.id] ?? 0,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [router]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("mesocycles").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) {
      console.error("Failed to delete mesocycle", error);
      return;
    }
    load();
  }

  async function handleActivate() {
    if (!activateTarget) return;
    setActivating(true);
    const supabase = createClient();
    // Ensure only one active: set any other active mesocycle to planned first
    const otherActive = activeMesocycles.filter((m) => m.id !== activateTarget.id);
    for (const m of otherActive) {
      await supabase.from("mesocycles").update({ status: "planned" }).eq("id", m.id);
    }
    const { error } = await supabase
      .from("mesocycles")
      .update({ status: "active" })
      .eq("id", activateTarget.id);
    setActivating(false);
    setActivateTarget(null);
    if (error) {
      console.error("Failed to activate mesocycle", error);
      return;
    }
    load();
  }

  async function handleComplete() {
    if (!completeTarget) return;
    setCompleting(true);
    const supabase = createClient();
    const updates: { status: "completed"; end_date?: string } = { status: "completed" };
    if (!completeTarget.end_date) {
      updates.end_date = new Date().toISOString().slice(0, 10);
    }
    const { error } = await supabase.from("mesocycles").update(updates).eq("id", completeTarget.id);
    setCompleting(false);
    setCompleteTarget(null);
    if (error) {
      console.error("Failed to complete mesocycle", error);
      return;
    }
    load();
  }

  const activeMesocycles = mesocycles.filter((m) => m.status === "active");
  const hasActive = activeMesocycles.length > 0;
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    items: mesocycles.filter((m) => m.status === status),
  }));

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ErrorState message={error} retry={load} backHref="/dashboard" backLabel="Dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Mesocycles"
          description="Training blocks (e.g. 4–6 weeks). Only one mesocycle can be active at a time."
          actions={
            <Link
              href="/mesocycles/new"
              className="inline-flex items-center justify-center rounded-xl bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] shadow transition hover:bg-[#ea580c] focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
            >
              New Mesocycle
            </Link>
          }
        />

        <div className="space-y-10">
          {grouped.map(({ status, label, items }) => (
            <section key={status}>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                {label}
              </h2>
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-700 py-8 text-center text-zinc-500">
                  No {label.toLowerCase()} mesocycles
                </p>
              ) : (
                <div className="space-y-4">
                  {items.map((m) => (
                    <Link
                      key={m.id}
                      href={`/mesocycles/${m.id}`}
                      className={`block rounded-xl border bg-zinc-900/50 p-5 transition ${
                        m.status === "active"
                          ? "border-[#f97316]/60 shadow-[0_0_20px_-5px_rgba(249,115,22,0.2)]"
                          : "border-zinc-800"
                      } hover:border-zinc-700`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold text-white">
                              {m.name}
                            </span>
                            <StatusBadge status={m.status} />
                          </div>
                          {m.description && (
                            <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{m.description}</p>
                          )}
                          <p className="mt-2 text-xs text-zinc-500">
                            {formatDate(m.start_date)} – {formatDate(m.end_date)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {m.template_count} template{m.template_count !== 1 ? "s" : ""} ·{" "}
                            {m.workout_log_count} workout{m.workout_log_count !== 1 ? "s" : ""}{" "}
                            logged
                          </p>
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {m.status === "planned" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActivateTarget(m);
                              }}
                              className="rounded-lg bg-[#f97316]/20 px-3 py-1.5 text-sm font-medium text-[#f97316] hover:bg-[#f97316]/30"
                            >
                              Activate
                            </button>
                          )}
                          {m.status === "active" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCompleteTarget(m);
                              }}
                              className="rounded-lg bg-zinc-600/30 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-600/50"
                            >
                              Complete
                            </button>
                          )}
                          <Link
                            href={`/mesocycles/${m.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteTarget(m);
                            }}
                            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm rounded-xl border border-zinc-800 bg-[#0a0a0a] p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
            >
              <h2 id="delete-dialog-title" className="text-lg font-bold text-white">
                Delete mesocycle?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                &quot;{deleteTarget.name}&quot; will be permanently deleted. Templates linked to it
                will be unlinked. This cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !deleting && setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 rounded-xl border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Activate confirmation modal (warn if another active exists) */}
      {activateTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !activating && setActivateTarget(null)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm rounded-xl border border-zinc-800 bg-[#0a0a0a] p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="activate-dialog-title"
            >
              <h2 id="activate-dialog-title" className="text-lg font-bold text-white">
                Activate mesocycle?
              </h2>
              {hasActive && activeMesocycles[0].id !== activateTarget.id && (
                <p className="mt-2 text-sm text-amber-400">
                  You already have an active mesocycle (&quot;{activeMesocycles[0].name}&quot;). It
                  will remain in your list but only one can be &quot;active&quot; at a time. You may
                  want to complete it first.
                </p>
              )}
              <p className="mt-2 text-sm text-zinc-400">
                &quot;{activateTarget.name}&quot; will be set to active.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !activating && setActivateTarget(null)}
                  disabled={activating}
                  className="flex-1 rounded-xl border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="flex-1 rounded-xl bg-[#f97316] py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ea580c] disabled:opacity-50"
                >
                  {activating ? "Activating…" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Complete confirmation modal */}
      {completeTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !completing && setCompleteTarget(null)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm rounded-xl border border-zinc-800 bg-[#0a0a0a] p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="complete-dialog-title"
            >
              <h2 id="complete-dialog-title" className="text-lg font-bold text-white">
                Complete mesocycle?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                &quot;{completeTarget.name}&quot; will be marked completed.
                {!completeTarget.end_date && " End date will be set to today."}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !completing && setCompleteTarget(null)}
                  disabled={completing}
                  className="flex-1 rounded-xl border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex-1 rounded-xl bg-[#f97316] py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ea580c] disabled:opacity-50"
                >
                  {completing ? "Completing…" : "Complete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
