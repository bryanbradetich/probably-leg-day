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
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/mesocycles" className="text-zinc-400 hover:text-white">
            ← Mesocycles
          </Link>
          <h1 className="text-2xl font-bold text-white">New Mesocycle</h1>
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
              href="/mesocycles"
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
              {saving ? "Saving…" : "Create mesocycle"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
