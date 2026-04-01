"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import { useEffect, useState } from "react";

const navLinks: { href?: string; label: string; subLinks?: { href: string; label: string }[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  {
    label: "Workouts",
    subLinks: [
      { href: "/workouts/log", label: "Log" },
      { href: "/workouts/history", label: "History" },
    ],
  },
  { href: "/exercises", label: "Exercises" },
  { href: "/mesocycles", label: "Mesocycles" },
  {
    label: "Progress",
    subLinks: [
      { href: "/progress/records", label: "Records" },
      { href: "/progress/measurements", label: "Measurements" },
    ],
  },
  {
    label: "Health",
    subLinks: [
      { href: "/food", label: "Today's Log" },
      { href: "/food/library", label: "Food Library" },
      { href: "/food/templates", label: "Meal Templates" },
      { href: "/food/weekly", label: "Weekly Summary" },
      { href: "/weight", label: "Weight" },
      { href: "/calories", label: "Calories" },
    ],
  },
  {
    label: "Settings",
    subLinks: [{ href: "/settings/themes", label: "Themes" }],
  },
  { href: "/reports", label: "Reports" },
  { href: "/help", label: "Help" },
];

function subLinkIsActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [workoutsOpen, setWorkoutsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const workoutsActive =
    pathname?.startsWith("/workouts/log") || pathname?.startsWith("/workouts/history");

  const progressActive =
    pathname === "/progress" ||
    pathname?.startsWith("/progress/exercise/") ||
    pathname?.startsWith("/progress/records") ||
    pathname?.startsWith("/progress/measurements");

  const healthActive =
    pathname === "/food" ||
    pathname?.startsWith("/food/") ||
    pathname === "/weight" ||
    pathname?.startsWith("/weight/") ||
    pathname === "/calories" ||
    pathname?.startsWith("/calories/");

  const settingsActive = pathname?.startsWith("/settings");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setWorkoutsOpen(false);
    setProgressOpen(false);
    setHealthOpen(false);
    setSettingsOpen(false);
  }, [pathname]);

  const navContent = (
    <>
      {navLinks.map((link) => {
        if (link.subLinks) {
          const isWorkouts = link.label === "Workouts";
          const isHealth = link.label === "Health";
          const isSettings = link.label === "Settings";
          const open = isWorkouts
            ? workoutsOpen
            : isHealth
              ? healthOpen
              : isSettings
                ? settingsOpen
                : progressOpen;
          const setOpen = isWorkouts
            ? setWorkoutsOpen
            : isHealth
              ? setHealthOpen
              : isSettings
                ? setSettingsOpen
                : setProgressOpen;
          const active = isWorkouts
            ? workoutsActive
            : isHealth
              ? healthActive
              : isSettings
                ? settingsActive
                : progressActive;
          return (
            <div key={link.label} className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-theme-border/90 text-theme-text-primary" : "text-theme-text-muted hover:bg-theme-border/40 hover:text-theme-text-primary"
                }`}
              >
                {link.label} ▾
              </button>
              {open && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-theme-border bg-theme-bg py-1 shadow-xl">
                    {link.subLinks.map((sub) => {
                      const subActive = subLinkIsActive(pathname, sub.href);
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setOpen(false)}
                          className={`block px-4 py-2 text-sm ${
                            subActive ? "bg-theme-border/90 text-theme-text-primary" : "text-theme-text-muted hover:bg-theme-border/40 hover:text-theme-text-primary"
                          }`}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        }
        const href = link.href!;
        const isActive = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive ? "bg-theme-border/90 text-theme-text-primary" : "text-theme-text-muted hover:bg-theme-border/40 hover:text-theme-text-primary"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      {user ? (
        <SignOutButton />
      ) : (
        <Link
          href="/auth/login"
          className="rounded-lg border border-theme-border bg-theme-surface/50 px-4 py-2 text-sm font-medium text-theme-text-muted transition hover:bg-theme-border hover:text-theme-text-primary"
        >
          Sign in
        </Link>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-theme-border bg-theme-bg/95 backdrop-blur supports-[backdrop-filter]:bg-theme-bg/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold text-theme-text-primary transition hover:text-theme-text-muted"
        >
          Probably Leg Day
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex md:gap-2">
          {navContent}
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          {user && (
            <SignOutButton />
          )}
          {!user && (
            <Link
              href="/auth/login"
              className="rounded-lg border border-theme-border bg-theme-surface/50 px-3 py-1.5 text-sm font-medium text-theme-text-muted"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg p-2 text-theme-text-muted hover:bg-theme-border/90 hover:text-theme-text-primary"
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 right-0 top-14 z-50 border-b border-theme-border bg-theme-bg py-4 shadow-xl md:hidden">
            <div className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => {
                if (link.subLinks) {
                  return (
                    <div key={link.label} className="flex flex-col">
                      <span className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-theme-text-muted">
                        {link.label}
                      </span>
                      {link.subLinks.map((sub) => {
                        const isActive = subLinkIsActive(pathname, sub.href);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`rounded-lg px-3 py-2.5 text-sm ${
                              isActive ? "bg-theme-border/90 text-theme-text-primary" : "text-theme-text-muted hover:bg-theme-border/40"
                            }`}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                }
                const href = link.href!;
                const isActive = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href + "/"));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`rounded-lg px-3 py-2.5 text-sm ${
                      isActive ? "bg-theme-border/90 text-theme-text-primary" : "text-theme-text-muted hover:bg-theme-border/40"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
