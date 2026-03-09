"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Mesocycle } from "@/types";

type StatusOption = Mesocycle["status"];

const STATUS_OPTIONS: { value: StatusOption; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export default function EditMesocyclePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [userId, setUserId] = useState<string | null>(null);
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<StatusOption>("planned");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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
      const { data, error: fetchError } = await supabase
        .from("mesocycles")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (fetchError || !data) {
        router.replace("/mesocycles");
        return;
      }
      const m = data as Mesocycle;
      setMesocycle(m);
      setName(m.name);
      setDescription(m.description ?? "");
      setStartDate(m.start_date ?? "");
      setEndDate(m.end_date ?? "");
      setStatus((m.status ?? "planned") as StatusOption);
      setLoading(false);
    })();
  }, [id, router]);

  async function handleSave() {
    if (!userId || !mesocycle || !name.trim()) return;
    setError(null);
    if (status === "active") {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("mesocycles")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .neq("id", id)
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
    const { error: updateError } = await supabase
      .from("mesocycles")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
      })
      .eq("id", id)
      .eq("user_id", userId);

    setSaving(false);
    if (updateError) {
      if (updateError.code === "23505") {
        setError(
          "You already have an active mesocycle. Complete or deactivate it before activating a new one."
        );
      } else {
        setError(updateError.message);
      }
      return;
    }
    router.push(`/mesocycles/${id}`);
  }

  if (loading || !mesocycle) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-4">
          <Link href={`/mesocycles/${id}`} className="text-zinc-400 hover:text-white">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-white">Edit Mesocycle</h1>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hypertrophy Block 1"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusOption)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
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
              href={`/mesocycles/${id}`}
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 py-2.5 text-center text-sm font-medium text-zinc-300 hover:bg-zinc-700"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-[#f97316] py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ea580c] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
