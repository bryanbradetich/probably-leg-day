import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          border: "var(--border)",
          accent: "var(--accent)",
          "accent-hover": "var(--accent-hover)",
          "accent-soft": "var(--accent-soft)",
          "text-primary": "var(--text-primary)",
          "text-muted": "var(--text-muted)",
          "on-accent": "var(--on-accent)",
          "input-bg": "var(--input-bg)",
          "macro-protein": "var(--macro-protein)",
          "macro-carbs": "var(--macro-carbs)",
          "macro-fat": "var(--macro-fat)",
          success: "var(--success)",
          danger: "var(--danger)",
          warning: "var(--warning)",
          "chart-secondary": "var(--chart-secondary)",
          "chart-purple": "var(--chart-purple)",
        },
      },
      ringColor: {
        "theme-accent": "var(--accent)",
      },
      ringOffsetColor: {
        "theme-bg": "var(--bg)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
