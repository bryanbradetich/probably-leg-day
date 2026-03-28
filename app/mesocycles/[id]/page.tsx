"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { kgToLbs } from "@/lib/units";
import type { Mesocycle, WorkoutTemplate, WorkoutLog } from "@/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type LogWithMeta = WorkoutLog & {
  exercise_count: number;
  total_volume: number;
};

type TemplateWithMeta = WorkoutTemplate & { exercise_count: number };

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: Mesocycle["status"] }) {
  const styles: Record<string, string> = {
    active: "bg-theme-accent/20 text-theme-accent border-theme-accent/40",
    planned: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    completed: "bg-zinc-600/30 text-theme-text-muted border-zinc-500/40",
  };
  const labels: Record<string, string> = {
    active: "Active",
    planned: "Planned",
    completed: "Completed",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function MesocycleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [templates, setTemplates] = useState<TemplateWithMeta[]>([]);
  const [logs, setLogs] = useState<LogWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<WorkoutTemplate[]>([]);
  const [assigningTemplateId, setAssigningTemplateId] = useState<string | null>(null);
  const [topExercisesVolume, setTopExercisesVolume] = useState<
    { exercise_id: string; name: string; volume: number; trend: "up" | "down" | "same" }[]
  >([]);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const { data: mData, error: mErr } = await supabase
      .from("mesocycles")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (mErr || !mData) {
      router.replace("/mesocycles");
      return;
    }
    setMesocycle(mData as Mesocycle);

    const { data: tRows } = await supabase
      .from("workout_templates")
      .select("*")
      .eq("mesocycle_id", id)
      .order("day_of_week", { ascending: true })
      .order("name");

    const templateList = (tRows ?? []) as WorkoutTemplate[];
    const templateIds = templateList.map((t) => t.id);
    let templateCounts: Record<string, number> = {};
    if (templateIds.length > 0) {
      const { data: teRows } = await supabase
        .from("workout_template_exercises")
        .select("template_id")
        .in("template_id", templateIds);
      templateCounts = (teRows ?? []).reduce(
        (acc: Record<string, number>, r: { template_id: string }) => {
          acc[r.template_id] = (acc[r.template_id] ?? 0) + 1;
          return acc;
        },
        {}
      );
    }
    setTemplates(
      templateList.map((t) => ({
        ...t,
        exercise_count: templateCounts[t.id] ?? 0,
      }))
    );

    const { data: logRows } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("mesocycle_id", id)
      .eq("is_draft", false)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    const logList = (logRows ?? []) as WorkoutLog[];
    const logIds = logList.map((l) => l.id);
    const volumeByLog: Record<string, number> = {};
    const exerciseCountByLog: Record<string, Set<string>> = {};
    logIds.forEach((lid) => {
      volumeByLog[lid] = 0;
      exerciseCountByLog[lid] = new Set();
    });
    if (logIds.length > 0) {
      const { data: setRows } = await supabase
        .from("workout_log_exercises")
        .select("workout_log_id, exercise_id, reps, weight_kg")
        .in("workout_log_id", logIds);
      for (const row of setRows ?? []) {
        const lid = row.workout_log_id as string;
        const eid = row.exercise_id as string;
        exerciseCountByLog[lid]?.add(eid);
        volumeByLog[lid] =
          (volumeByLog[lid] ?? 0) + (row.reps ?? 0) * (row.weight_kg ?? 0);
      }
    }
    setLogs(
      logList.map((l) => ({
        ...l,
        exercise_count: exerciseCountByLog[l.id]?.size ?? 0,
        total_volume: volumeByLog[l.id] ?? 0,
      }))
    );

    // Top 5 exercises by volume in this mesocycle (from workout_log_exercises)
    if (logIds.length > 0) {
      const { data: setRows2 } = await supabase
        .from("workout_log_exercises")
        .select("exercise_id, reps, weight_kg")
        .in("workout_log_id", logIds);
      const volumeByEx: Record<string, number> = {};
      for (const row of setRows2 ?? []) {
        const eid = row.exercise_id as string;
        const vol = (row.reps ?? 0) * (row.weight_kg ?? 0);
        volumeByEx[eid] = (volumeByEx[eid] ?? 0) + vol;
      }
      const sorted = Object.entries(volumeByEx)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const exIds = sorted.map(([eid]) => eid);
      const { data: exRows } = await supabase
        .from("exercises")
        .select("id, name")
        .in("id", exIds);
      const exMap = (exRows ?? []).reduce(
        (acc: Record<string, { id: string; name: string }>, e: { id: string; name: string }) => {
          acc[e.id] = e;
          return acc;
        },
        {}
      );
      // Simple week-over-week trend: compare first half vs second half of logs (by completed_at)
      const sortedLogIds = [...logIds];
      const mid = Math.floor(sortedLogIds.length / 2);
      const firstHalf = sortedLogIds.slice(mid);
      const secondHalf = sortedLogIds.slice(0, mid);
      const getVolumeForLogSet = async (ids: string[]) => {
        if (ids.length === 0) return {};
        const { data } = await supabase
          .from("workout_log_exercises")
          .select("exercise_id, reps, weight_kg")
          .in("workout_log_id", ids);
        const v: Record<string, number> = {};
        for (const row of data ?? []) {
          const eid = row.exercise_id as string;
          v[eid] = (v[eid] ?? 0) + (row.reps ?? 0) * (row.weight_kg ?? 0);
        }
        return v;
      };
      const [volFirst, volSecond] = await Promise.all([
        getVolumeForLogSet(firstHalf),
        getVolumeForLogSet(secondHalf),
      ]);
      const trends: Record<string, "up" | "down" | "same"> = {};
      for (const eid of exIds) {
        const a = volFirst[eid] ?? 0;
        const b = volSecond[eid] ?? 0;
        if (b > a) trends[eid] = "up";
        else if (b < a) trends[eid] = "down";
        else trends[eid] = "same";
      }
      setTopExercisesVolume(
        sorted.map(([eid, volume]) => ({
          exercise_id: eid,
          name: exMap[eid]?.name ?? "Unknown",
          volume,
          trend: trends[eid] ?? "same",
        }))
      );
    } else {
      setTopExercisesVolume([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function loadAvailableTemplates() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("workout_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    setAvailableTemplates((data as WorkoutTemplate[]) ?? []);
  }

  useEffect(() => {
    if (addTemplateOpen) loadAvailableTemplates();
  }, [addTemplateOpen]);

  async function assignTemplate(templateId: string) {
    setAssigningTemplateId(templateId);
    const supabase = createClient();
    await supabase.from("workout_templates").update({ mesocycle_id: id }).eq("id", templateId);
    setAssigningTemplateId(null);
    setAddTemplateOpen(false);
    load();
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("mesocycles").delete().eq("id", id);
    setDeleting(false);
    setDeleteModalOpen(false);
    if (error) {
      console.error("Failed to delete mesocycle", error);
      return;
    }
    router.replace("/mesocycles");
  }

  async function handleActivate() {
    if (!id) return;
    setActivating(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: other } = await supabase
        .from("mesocycles")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .neq("id", id);
      for (const m of other ?? []) {
        await supabase.from("mesocycles").update({ status: "planned" }).eq("id", m.id);
      }
    }
    await supabase.from("mesocycles").update({ status: "active" }).eq("id", id);
    setActivating(false);
    setActivateModalOpen(false);
    load();
  }

  async function handleComplete() {
    if (!mesocycle) return;
    setCompleting(true);
    const supabase = createClient();
    const updates: { status: "completed"; end_date?: string } = { status: "completed" };
    if (!mesocycle.end_date) updates.end_date = new Date().toISOString().slice(0, 10);
    await supabase.from("mesocycles").update(updates).eq("id", id);
    setCompleting(false);
    setCompleteModalOpen(false);
    load();
  }

  const totalWorkouts = logs.length;
  const totalVolume = logs.reduce((s, l) => s + l.total_volume, 0);
  const totalSeconds = logs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0);
  const templatesAlreadyAssigned = new Set(templates.map((t) => t.id));
  const templatesToShow = availableTemplates.filter((t) => !templatesAlreadyAssigned.has(t.id));

  if (loading || !mesocycle) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center text-theme-text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link href="/mesocycles" className="text-theme-text-muted hover:text-theme-text-primary">
            ← Mesocycles
          </Link>
        </div>

        {/* Header */}
        <div
          className={`rounded-xl border p-6 ${
            mesocycle.status === "active"
              ? "border-theme-accent/60 shadow-[0_0_20px_-5px_rgba(249,115,22,0.2)]"
              : "border-theme-border"
          } bg-theme-surface/50`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-theme-text-primary">{mesocycle.name}</h1>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={mesocycle.status ?? "planned"} />
              </div>
              {mesocycle.description && (
                <p className="mt-2 text-theme-text-muted">{mesocycle.description}</p>
              )}
              <p className="mt-2 text-sm text-theme-text-muted">
                {formatDate(mesocycle.start_date)} – {formatDate(mesocycle.end_date)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {mesocycle.status === "planned" && (
                <button
                  type="button"
                  onClick={() => setActivateModalOpen(true)}
                  className="rounded-lg bg-theme-accent/20 px-3 py-1.5 text-sm font-medium text-theme-accent hover:bg-theme-accent/30"
                >
                  Activate
                </button>
              )}
              {mesocycle.status === "active" && (
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(true)}
                  className="rounded-lg bg-zinc-600/30 px-3 py-1.5 text-sm font-medium text-theme-text-muted hover:bg-zinc-600/50"
                >
                  Complete
                </button>
              )}
              <Link
                href={`/mesocycles/${id}/report`}
                className="rounded-lg bg-theme-accent px-3 py-1.5 text-sm font-semibold text-theme-on-accent shadow transition hover:bg-theme-accent-hover focus:outline-none focus:ring-2 focus:ring-theme-accent focus:ring-offset-2 focus:ring-offset-theme-bg"
              >
                View Full Report
              </Link>
              <Link
                href={`/mesocycles/${id}/edit`}
                className="rounded-lg border border-theme-border/80 px-3 py-1.5 text-sm font-medium text-theme-text-muted hover:bg-theme-border/90"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Workout Templates */}
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-theme-text-primary">Workout Templates</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddTemplateOpen(true)}
                className="rounded-lg bg-theme-accent/20 px-3 py-1.5 text-sm font-medium text-theme-accent hover:bg-theme-accent/30"
              >
                Add Template
              </button>
              <Link
                href={`/workouts/templates/new?mesocycle_id=${id}`}
                className="rounded-lg border border-theme-border/80 px-3 py-1.5 text-sm font-medium text-theme-text-muted hover:bg-theme-border/90"
              >
                Create New Template
              </Link>
            </div>
          </div>
          {templates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-theme-border py-6 text-center text-theme-text-muted">
              No templates assigned. Add an existing template or create a new one.
            </p>
          ) : (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-theme-border bg-theme-surface/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/workouts/templates/${t.id}/edit`}
                      className="font-medium text-theme-text-primary hover:text-theme-accent"
                    >
                      {t.name}
                    </Link>
                    {t.day_of_week != null && (
                      <span className="text-xs text-theme-text-muted">{DAYS[t.day_of_week]}</span>
                    )}
                    <span className="text-xs text-theme-text-muted">
                      {t.exercise_count} exercise{t.exercise_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Link
                    href={`/workouts/templates/${t.id}/edit`}
                    className="text-sm text-theme-text-muted hover:text-theme-accent"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Workout Log summary + list */}
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-theme-text-primary">Workout Log</h2>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-theme-border bg-theme-surface/50 p-4">
              <p className="text-2xl font-bold text-theme-text-primary">{totalWorkouts}</p>
              <p className="text-sm text-theme-text-muted">Workouts completed</p>
            </div>
            <div className="rounded-xl border border-theme-border bg-theme-surface/50 p-4">
              <p className="text-2xl font-bold text-theme-text-primary">
                {kgToLbs(totalVolume)?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ??
                  "0"}{" "}
                <span className="text-sm font-normal text-theme-text-muted">lbs</span>
              </p>
              <p className="text-sm text-theme-text-muted">Total volume</p>
            </div>
            <div className="rounded-xl border border-theme-border bg-theme-surface/50 p-4">
              <p className="text-2xl font-bold text-theme-text-primary">{formatDuration(totalSeconds)}</p>
              <p className="text-sm text-theme-text-muted">Total time trained</p>
            </div>
          </div>
          {logs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-theme-border py-6 text-center text-theme-text-muted">
              No workouts logged for this mesocycle yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-theme-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-theme-border bg-theme-surface/50 text-left text-theme-text-muted">
                    <th className="px-4 py-3">Workout</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Volume (lbs)</th>
                    <th className="px-4 py-3">Exercises</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-theme-border/80 transition hover:bg-theme-border/90/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/workouts/history/${log.id}`}
                          className="font-medium text-theme-text-primary hover:text-theme-accent"
                        >
                          {log.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-theme-text-muted">
                        {formatDate(log.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-theme-text-muted">
                        {formatDuration(log.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-theme-text-muted">
                        {kgToLbs(log.total_volume)?.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        }) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-theme-text-muted">{log.exercise_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Progress snapshot: top 5 exercises by volume, mini trend */}
        {topExercisesVolume.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold text-theme-text-primary">Top exercises by volume</h2>
            <div className="space-y-3">
              {topExercisesVolume.map(({ exercise_id, name, volume, trend }) => (
                <div
                  key={exercise_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-theme-border bg-theme-surface/50 px-4 py-3"
                >
                  <span className="font-medium text-theme-text-primary">{name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-theme-text-muted">
                      {kgToLbs(volume)?.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      }) ?? 0}{" "}
                      lbs
                    </span>
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs ${
                        trend === "up"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : trend === "down"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-zinc-600/30 text-theme-text-muted"
                      }`}
                      title={trend === "up" ? "Volume trending up" : trend === "down" ? "Volume trending down" : "Stable"}
                    >
                      {trend === "up" ? "↑" : trend === "down" ? "↓" : "−"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-theme-text-muted">
              Week-over-week volume trend (first vs second half of mesocycle). Full charts in Phase 8.
            </p>
          </section>
        )}
      </div>

      {/* Delete modal */}
      {deleteModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteModalOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-theme-border bg-theme-bg p-6 shadow-xl">
              <h2 className="text-lg font-bold text-theme-text-primary">Delete mesocycle?</h2>
              <p className="mt-2 text-sm text-theme-text-muted">
                &quot;{mesocycle.name}&quot; will be permanently deleted. Templates will be
                unlinked. This cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !deleting && setDeleteModalOpen(false)}
                  disabled={deleting}
                  className="flex-1 rounded-xl border border-theme-border/80 bg-theme-border/90 py-2.5 text-sm font-medium text-theme-text-muted hover:bg-theme-border disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-theme-text-primary hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Activate modal */}
      {activateModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !activating && setActivateModalOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-theme-border bg-theme-bg p-6 shadow-xl">
              <h2 className="text-lg font-bold text-theme-text-primary">Activate this mesocycle?</h2>
              <p className="mt-2 text-sm text-theme-text-muted">
                &quot;{mesocycle.name}&quot; will be set to active. Any other active mesocycle will
                be set to planned.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !activating && setActivateModalOpen(false)}
                  disabled={activating}
                  className="flex-1 rounded-xl border border-theme-border/80 bg-theme-border/90 py-2.5 text-sm font-medium text-theme-text-muted hover:bg-theme-border disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="flex-1 rounded-xl bg-theme-accent py-2.5 text-sm font-semibold text-theme-on-accent hover:bg-theme-accent-hover disabled:opacity-50"
                >
                  {activating ? "Activating…" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Complete modal */}
      {completeModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !completing && setCompleteModalOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-theme-border bg-theme-bg p-6 shadow-xl">
              <h2 className="text-lg font-bold text-theme-text-primary">Complete this mesocycle?</h2>
              <p className="mt-2 text-sm text-theme-text-muted">
                &quot;{mesocycle.name}&quot; will be marked completed.
                {!mesocycle.end_date && " End date will be set to today."}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !completing && setCompleteModalOpen(false)}
                  disabled={completing}
                  className="flex-1 rounded-xl border border-theme-border/80 bg-theme-border/90 py-2.5 text-sm font-medium text-theme-text-muted hover:bg-theme-border disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex-1 rounded-xl bg-theme-accent py-2.5 text-sm font-semibold text-theme-on-accent hover:bg-theme-accent-hover disabled:opacity-50"
                >
                  {completing ? "Completing…" : "Complete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Template picker */}
      {addTemplateOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setAddTemplateOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-theme-border bg-theme-bg p-6 shadow-xl">
              <h2 className="mb-4 text-lg font-bold text-theme-text-primary">Add template to this mesocycle</h2>
              {templatesToShow.length === 0 ? (
                <p className="text-sm text-theme-text-muted">
                  All your templates are already assigned to this mesocycle, or you have no
                  templates. Create a new one instead.
                </p>
              ) : (
                <ul className="space-y-2">
                  {templatesToShow.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => assignTemplate(t.id)}
                        disabled={assigningTemplateId === t.id}
                        className="w-full rounded-lg border border-theme-border bg-theme-surface/50 px-4 py-2.5 text-left text-theme-text-primary hover:bg-theme-border/90 disabled:opacity-50"
                      >
                        {t.name}
                        {assigningTemplateId === t.id ? " …" : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setAddTemplateOpen(false)}
                className="mt-4 w-full rounded-lg border border-theme-border/80 py-2.5 text-sm text-theme-text-muted hover:bg-theme-border/90"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
