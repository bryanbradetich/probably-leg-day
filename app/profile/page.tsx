"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (!u) router.replace("/auth/login");
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="mt-2 text-zinc-400">
          Manage your account and preferences.
        </p>
        <p className="mt-4 text-zinc-400">
          Signed in as {user.email ?? "—"}
        </p>
      </div>
    </div>
  );
}
