import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight">
        Probably Leg Day
      </h1>
      <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl">
        Track your workouts, build your program, and crush your goals.
      </p>
      <Link
        href="/auth"
        className="mt-10 inline-flex items-center justify-center rounded-lg bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-lg transition hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
      >
        Get Started
      </Link>
    </div>
  );
}
