"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const APP_NAME = "Probably Leg Day";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Email is required.";
    if (!password) next.password = "Password is required.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    if (password !== confirmPassword) next.confirmPassword = "Passwords do not match.";
    if (!fullName.trim()) next.fullName = "Full name is required.";
    const un = username.trim().toLowerCase();
    if (!un) next.username = "Username is required.";
    if (un && !/^[a-z0-9_-]+$/.test(un)) next.username = "Username can only use letters, numbers, underscores, and hyphens.";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { data: available } = await supabase.rpc("check_username_available", {
        check_username: un,
      });
      if (available === false) {
        setErrors({ username: "Username is already taken." });
        setLoading(false);
        return;
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (signUpError) {
        setErrors({ form: signUpError.message });
        setLoading(false);
        return;
      }

      if (authData.user) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ username: un })
          .eq("id", authData.user.id);

        if (updateError) {
          setErrors({ form: "Account created but username could not be set. Please update it in your profile." });
          setLoading(false);
          return;
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-theme-border bg-theme-surface/50 p-8 shadow-xl">
          <h1 className="text-center text-2xl font-bold text-theme-text-primary">
            {APP_NAME}
          </h1>
          <p className="mt-1 text-center text-sm text-theme-text-muted">
            Create your account
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {errors.form && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {errors.form}
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
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-theme-text-muted">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-theme-border bg-theme-input-bg px-4 py-3 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
                placeholder="Jane Doe"
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-400">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-theme-text-muted">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-theme-border bg-theme-input-bg px-4 py-3 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
                placeholder="janedoe"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-400">{errors.username}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-theme-text-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-theme-border bg-theme-input-bg px-4 py-3 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-theme-text-muted">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-theme-border bg-theme-input-bg px-4 py-3 text-theme-text-primary placeholder:text-theme-text-muted/70 focus:border-theme-accent focus:outline-none focus:ring-1 focus:ring-theme-accent"
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-theme-accent px-4 py-3 font-semibold text-theme-on-accent transition hover:bg-theme-accent-hover disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-theme-text-muted">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-theme-accent hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
