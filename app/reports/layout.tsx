import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports | Probably Leg Day",
  description: "Volume, frequency, and PRs over time",
};

export default function ReportsLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
