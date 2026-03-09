import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workouts | Probably Leg Day",
  description: "Log and view workouts",
};

export default function WorkoutsLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
