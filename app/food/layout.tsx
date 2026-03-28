import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Food | Probably Leg Day",
  description: "Daily nutrition log, library, templates, and weekly summary",
};

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return children;
}
