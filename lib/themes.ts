/**
 * Theme IDs map to CSS variables applied on document.documentElement.
 * Extra vars (on-accent, input-bg, accent-soft) keep buttons and inputs readable on every palette.
 */

export const THEME_STORAGE_KEY = "pld-theme";

export const THEME_IDS = [
  "dark-orange",
  "dark-blue",
  "dark-purple",
  "light-clean",
  "high-contrast",
  "mets",
  "ducks",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value != null && (THEME_IDS as readonly string[]).includes(value);
}

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  /** For theme picker preview chips */
  preview: { bg: string; surface: string; accent: string };
  vars: Record<string, string>;
};

function v(
  bg: string,
  surface: string,
  border: string,
  accent: string,
  accentHover: string,
  textPrimary: string,
  textMuted: string,
  onAccent: string,
  inputBg: string,
  accentSoft: string,
  colorScheme: "light" | "dark" = "dark"
): Record<string, string> {
  return {
    "--color-scheme": colorScheme,
    "--bg": bg,
    "--surface": surface,
    "--border": border,
    "--accent": accent,
    "--accent-hover": accentHover,
    "--text-primary": textPrimary,
    "--text-muted": textMuted,
    "--on-accent": onAccent,
    "--input-bg": inputBg,
    "--accent-soft": accentSoft,
    "--macro-fat": accent,
  };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "dark-orange",
    name: "Dark & Bold",
    preview: { bg: "#0a0a0a", surface: "#18181b", accent: "#f97316" },
    vars: v(
      "#0a0a0a",
      "#18181b",
      "#27272a",
      "#f97316",
      "#ea6c0a",
      "#ffffff",
      "#a1a1aa",
      "#0a0a0a",
      "#09090b",
      "#fb923c"
    ),
  },
  {
    id: "dark-blue",
    name: "Dark & Cool",
    preview: { bg: "#0a0f1a", surface: "#0f1f38", accent: "#3b82f6" },
    vars: v(
      "#0a0f1a",
      "#0f1f38",
      "#1e3a5f",
      "#3b82f6",
      "#2563eb",
      "#ffffff",
      "#94a3b8",
      "#ffffff",
      "#0a1628",
      "#93c5fd"
    ),
  },
  {
    id: "dark-purple",
    name: "Dark & Purple",
    preview: { bg: "#0d0a1a", surface: "#1a1030", accent: "#a855f7" },
    vars: v(
      "#0d0a1a",
      "#1a1030",
      "#2d1f4e",
      "#a855f7",
      "#9333ea",
      "#ffffff",
      "#c4b5fd",
      "#ffffff",
      "#12081f",
      "#d8b4fe"
    ),
  },
  {
    id: "light-clean",
    name: "Light & Clean",
    preview: { bg: "#f8fafc", surface: "#ffffff", accent: "#f97316" },
    vars: v(
      "#f8fafc",
      "#ffffff",
      "#e2e8f0",
      "#f97316",
      "#ea6c0a",
      "#0f172a",
      "#64748b",
      "#ffffff",
      "#ffffff",
      "#ea580c",
      "light"
    ),
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    preview: { bg: "#000000", surface: "#000000", accent: "#ffffff" },
    vars: v(
      "#000000",
      "#000000",
      "#ffffff",
      "#ffffff",
      "#e5e5e5",
      "#ffffff",
      "#a3a3a3",
      "#000000",
      "#000000",
      "#d4d4d4"
    ),
  },
  {
    id: "mets",
    name: "NY Mets",
    preview: { bg: "#001f5b", surface: "#002D72", accent: "#FF5910" },
    vars: v(
      "#001f5b",
      "#002D72",
      "#003d9e",
      "#FF5910",
      "#e04d0e",
      "#ffffff",
      "#93c5fd",
      "#ffffff",
      "#001847",
      "#fdba74"
    ),
  },
  {
    id: "ducks",
    name: "Oregon Ducks",
    preview: { bg: "#0a1a10", surface: "#154733", accent: "#FEE123" },
    vars: v(
      "#0a1a10",
      "#154733",
      "#1d6347",
      "#FEE123",
      "#e5cb1f",
      "#ffffff",
      "#bbf7d0",
      "#0a1a10",
      "#0f2e1c",
      "#fde047"
    ),
  },
];

const THEME_BY_ID: Record<ThemeId, ThemeDefinition> = Object.fromEntries(
  THEMES.map((t) => [t.id, t])
) as Record<ThemeId, ThemeDefinition>;

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  return THEME_BY_ID[id] ?? THEME_BY_ID["dark-orange"];
}

/** Apply CSS variables to a root element (usually document.documentElement). */
export function applyThemeVars(root: HTMLElement, id: ThemeId): void {
  const def = getThemeDefinition(id);
  for (const [key, value] of Object.entries(def.vars)) {
    root.style.setProperty(key, value);
  }
}

/** Map of theme id → vars for inline boot script (avoids FOUC). */
export function themeVarsByIdForBoot(): Record<ThemeId, Record<string, string>> {
  return Object.fromEntries(THEMES.map((t) => [t.id, t.vars])) as Record<
    ThemeId,
    Record<string, string>
  >;
}

/**
 * Inline script: read localStorage and apply theme vars before React hydrates.
 * Must stay in sync with THEME_STORAGE_KEY and theme IDs.
 */
export function getThemeBootInlineScript(): string {
  const payload = JSON.stringify(themeVarsByIdForBoot());
  return `!function(){try{var T=${payload};var k=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY
  )});var id=k&&T[k]?k:"dark-orange";var v=T[id]||T["dark-orange"];var r=document.documentElement;if(v)for(var x in v)r.style.setProperty(x,v[x]);}catch(e){}}();`;
}
