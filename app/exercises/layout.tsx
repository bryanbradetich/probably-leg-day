import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exercise Library | Probably Leg Day",
  description: "Browse exercises",
};

export default function ExercisesLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
