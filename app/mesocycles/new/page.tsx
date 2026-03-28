"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Mesocycle } from "@/types";

type StatusOption = Mesocycle["status"];

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export default function NewMesocyclePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<StatusOption>("planned");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);
    })();
  }, [router]);

  async function handleSave() {
    if (!userId || !name.trim()) return;
    setError(null);
    if (status === "active") {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("mesocycles")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (existing) {
        setError(
          "You already have an active mesocycle. Complete or deactivate it before activating a new one."
        );
        return;
      }
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("mesocycles")
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
      })
      .select()
      .single();

    setSaving(false);
    if (insertError) {
      if (insertError.code === "23505") {
        setError(
          "You already have an active mesocycle. Complete or deactivate it before activating a new one."
        );
      } else {
        setError(insertError.message);
      }
      return;
    }
    router.push(`/mesocycles/${(data as Mesocycle).id}`);
  }

  if (userId === null) return null;

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/mesocycles" className="text-theme-text-muted hover:text-theme-text-primary">
            ← Mesocycles
          </Link>
          <h1 className="text-2xl font-bold text-theme-text-primary">New Mesocycle</h1>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-text-muted">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hypertrophy Block 1"
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-text-muted">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional"
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-theme-text-muted">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-theme-text-muted">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-text-muted">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusOption)}
              className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <Link
              href="/mesocycles"
              className="flex-1 rounded-lg border border-theme-border/80 bg-theme-border/90 py-2.5 text-center text-sm font-medium text-theme-text-muted hover:bg-theme-border"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-theme-accent py-2.5 text-sm font-semibold text-theme-on-accent hover:bg-theme-accent-hover disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create mesocycle"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
