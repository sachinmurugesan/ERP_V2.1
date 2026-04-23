"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => undefined,
});

/**
 * ThemeProvider — manages light/dark theme state.
 *
 * - Persists preference in localStorage under "harvesterp-theme".
 * - Applies/removes `.theme-dark` class on <html> (matching Tailwind darkMode config).
 * - Initializes from localStorage on mount to avoid FOUC.
 *
 * Topbar's `onToggleTheme` callback delegates here via `useTheme()`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // Sync from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("harvesterp-theme");
    if (stored === "dark") {
      setTheme("dark");
      document.documentElement.classList.add("theme-dark");
    }
  }, []);

  const toggleTheme = () => {
    setTheme((current) => {
      const next: Theme = current === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("theme-dark", next === "dark");
      localStorage.setItem("harvesterp-theme", next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Access the current theme and toggle function from any client component. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
