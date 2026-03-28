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
      className="rounded-lg border border-theme-border bg-theme-surface/50 px-4 py-2 text-sm font-medium text-theme-text-muted transition hover:bg-theme-border hover:text-theme-text-primary"
    >
      Sign out
    </button>
  );
}
