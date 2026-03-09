import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mesocycles | Probably Leg Day",
  description: "Training blocks and programs",
};

export default function MesocyclesLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
