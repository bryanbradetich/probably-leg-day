"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const APP_NAME = "Probably Leg Day";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-theme-border bg-theme-surface/50 p-8 shadow-xl">
          <h1 className="text-center text-2xl font-bold text-theme-text-primary">
            {APP_NAME}
          </h1>
          <p className="mt-1 text-center text-sm text-theme-text-muted">
            Welcome back — log in to continue
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-theme-text-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-theme-border bg-theme-input-bg px-4 py-3 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-theme-text-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-theme-border bg-theme-input-bg px-4 py-3 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
                placeholder="••••••••"
              />
              <p className="mt-1.5 text-sm">
                <Link
                  href="/auth/reset-password"
                  className="text-theme-accent hover:underline"
                >
                  Forgot password?
                </Link>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-theme-accent px-4 py-3 font-semibold text-theme-on-accent transition hover:bg-theme-accent-hover disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-theme-text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="font-medium text-theme-accent hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
