import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Probably Leg Day",
  description: "Your workout home",
};

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
