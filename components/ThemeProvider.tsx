"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  applyThemeVars,
  getThemeDefinition,
  isThemeId,
  type ThemeId,
  THEME_STORAGE_KEY,
} from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  themeName: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("dark-orange");
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(raw)) {
      setThemeState(raw);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", user.id)
        .maybeSingle();
      const t = profile?.theme;
      if (isThemeId(t)) {
        applyThemeVars(document.documentElement, t);
        localStorage.setItem(THEME_STORAGE_KEY, t);
        setThemeState(t);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const setTheme = useCallback((id: ThemeId) => {
    applyThemeVars(document.documentElement, id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    setThemeState(id);
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      await supabase.from("profiles").update({ theme: id }).eq("id", user.id);
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      themeName: getThemeDefinition(theme).name,
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
