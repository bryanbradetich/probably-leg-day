import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Progress | Probably Leg Day",
  description: "Track exercise progress over time",
};

export default function ProgressLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
