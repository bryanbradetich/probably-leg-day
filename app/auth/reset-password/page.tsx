"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const APP_NAME = "Probably Leg Day";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/login` }
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-theme-border bg-theme-surface/50 p-8 shadow-xl">
          <h1 className="text-center text-2xl font-bold text-theme-text-primary">
            {APP_NAME}
          </h1>
          <p className="mt-1 text-center text-sm text-theme-text-muted">
            Reset your password
          </p>

          {success ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                Check your email for a link to reset your password. If you don&apos;t see it, check your spam folder.
              </div>
              <Link
                href="/auth/login"
                className="block w-full rounded-lg bg-theme-accent px-4 py-3 text-center font-semibold text-theme-on-accent transition hover:bg-theme-accent-hover"
              >
                Back to log in
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-theme-accent px-4 py-3 font-semibold text-theme-on-accent transition hover:bg-theme-accent-hover disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          {!success && (
            <p className="mt-6 text-center text-sm text-theme-text-muted">
              <Link href="/auth/login" className="font-medium text-theme-accent hover:underline">
                Back to log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
