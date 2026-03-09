"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
    >
      Sign out
    </button>
  );
}
