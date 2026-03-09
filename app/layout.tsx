import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Probably Leg Day",
  description: "Workout tracking and program management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0a0a0a] text-zinc-100`}>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
