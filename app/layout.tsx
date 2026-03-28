import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { AppNav } from "@/components/AppNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getThemeBootInlineScript } from "@/lib/themes";
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-theme-bg text-theme-text-primary`}>
        <Script
          id="theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getThemeBootInlineScript() }}
        />
        <ThemeProvider>
          <AppNav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
