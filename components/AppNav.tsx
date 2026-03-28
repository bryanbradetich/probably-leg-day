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
      { href: "/weight", label: "Weight" },
    ],
  },
  {
    label: "Food",
    subLinks: [
      { href: "/food", label: "Today's Log" },
      { href: "/food/library", label: "Food Library" },
      { href: "/food/templates", label: "Meal Templates" },
      { href: "/food/weekly", label: "Weekly Summary" },
    ],
  },
  { href: "/reports", label: "Reports" },
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
  const [foodOpen, setFoodOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const workoutsActive =
    pathname?.startsWith("/workouts/log") || pathname?.startsWith("/workouts/history");

  const progressActive =
    pathname === "/progress" ||
    pathname?.startsWith("/progress/exercise/") ||
    pathname?.startsWith("/progress/records") ||
    pathname?.startsWith("/progress/measurements") ||
    pathname === "/weight" ||
    pathname?.startsWith("/weight/");

  const foodActive = pathname === "/food" || pathname?.startsWith("/food/");

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
    setFoodOpen(false);
  }, [pathname]);

  const navContent = (
    <>
      {navLinks.map((link) => {
        if (link.subLinks) {
          const isWorkouts = link.label === "Workouts";
          const isFood = link.label === "Food";
          const open = isWorkouts ? workoutsOpen : isFood ? foodOpen : progressOpen;
          const setOpen = isWorkouts ? setWorkoutsOpen : isFood ? setFoodOpen : setProgressOpen;
          const active = isWorkouts ? workoutsActive : isFood ? foodActive : progressActive;
          return (
            <div key={link.label} className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                }`}
              >
                {link.label} ▾
              </button>
              {open && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-zinc-800 bg-[#0a0a0a] py-1 shadow-xl">
                    {link.subLinks.map((sub) => {
                      const subActive = subLinkIsActive(pathname, sub.href);
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setOpen(false)}
                          className={`block px-4 py-2 text-sm ${
                            subActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
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
              isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
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
          className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
        >
          Sign in
        </Link>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-[#0a0a0a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold text-white transition hover:text-zinc-300"
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
              className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm font-medium text-zinc-300"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
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
          <div className="absolute left-0 right-0 top-14 z-50 border-b border-zinc-800 bg-[#0a0a0a] py-4 shadow-xl md:hidden">
            <div className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => {
                if (link.subLinks) {
                  return (
                    <div key={link.label} className="flex flex-col">
                      <span className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {link.label}
                      </span>
                      {link.subLinks.map((sub) => {
                        const isActive = subLinkIsActive(pathname, sub.href);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`rounded-lg px-3 py-2.5 text-sm ${
                              isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50"
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
                      isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50"
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
