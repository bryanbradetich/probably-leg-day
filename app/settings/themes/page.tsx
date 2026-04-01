"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, type ThemeId } from "@/lib/themes";

export default function ThemesSettingsPage() {
  const { theme: activeId, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <PageHeader
          title="Choose Your Theme"
          description={
            <>
              Pick a look for Probably Leg Day. Your choice syncs to your account.{" "}
              <Link href="/dashboard" className="font-medium text-theme-accent hover:underline">
                Back to dashboard
              </Link>
            </>
          }
        />

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {THEMES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTheme(t.id as ThemeId)}
                className={`w-full rounded-xl border-2 p-4 text-left transition hover:border-theme-accent/60 ${
                  activeId === t.id
                    ? "border-theme-accent"
                    : "border-theme-border bg-theme-surface/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-theme-text-primary">{t.name}</span>
                  {activeId === t.id && (
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-theme-accent text-theme-accent"
                      aria-hidden
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div
                  className="mt-4 flex items-center gap-2 rounded-lg border border-theme-border p-3"
                  style={{ backgroundColor: t.preview.bg }}
                >
                  <div
                    className="h-10 flex-1 rounded-md border"
                    style={{
                      backgroundColor: t.preview.surface,
                      borderColor: t.preview.surfaceBorder ?? "rgb(255 255 255 / 0.1)",
                    }}
                    title="Surface"
                  />
                  <div
                    className="h-10 w-14 shrink-0 rounded-md"
                    style={{ backgroundColor: t.preview.accent }}
                    title="Accent"
                  />
                  <span
                    className="shrink-0 rounded-md px-3 py-1.5 text-xs font-bold"
                    style={{
                      backgroundColor: t.preview.accent,
                      color: t.vars["--on-accent"],
                    }}
                  >
                    Go
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
