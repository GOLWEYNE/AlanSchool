"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const THEME_STORAGE_KEY = "ais-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Applies the theme to <html> and persists it. The inline script in
// RootLayout already set the initial class before hydration (to avoid a
// flash of the wrong theme), so this effect only needs to keep the DOM,
// localStorage, and React state in sync after that.
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore write failures (e.g. private browsing storage limits).
  }
}

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  // The inline bootstrap script already applied the right class to <html>
  // before this component ever mounts, so trust it instead of re-deriving
  // from localStorage/matchMedia (which could momentarily disagree).
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

export { THEME_STORAGE_KEY };
