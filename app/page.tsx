import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-theme-bg px-6 text-center text-theme-text-primary">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
        Probably Leg Day
      </h1>
      <p className="mt-6 max-w-xl text-lg text-theme-text-muted sm:text-xl">
        Track your workouts, build your program, and crush your goals.
      </p>
      <Link
        href="/auth"
        className="mt-10 inline-flex items-center justify-center rounded-lg bg-theme-accent px-8 py-4 text-base font-semibold text-theme-on-accent shadow-lg transition hover:bg-theme-accent-hover focus:outline-none focus:ring-2 focus:ring-theme-accent focus:ring-offset-2 focus:ring-offset-theme-bg"
      >
        Get Started
      </Link>
    </div>
  );
}
