import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weight | Probably Leg Day",
  description: "Daily weight, goals, and weekly summaries",
};

export default function WeightLayout({ children }: { children: React.ReactNode }) {
  return children;
}
