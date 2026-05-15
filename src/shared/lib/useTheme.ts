"use client";

// Shared light/dark/system theme — persisted in localStorage (`adflow_theme`), applied to <html data-theme>.
// The FOUC-prevention inline script in app/layout.tsx reads the same key on first paint.
// All useTheme() instances stay in sync via a custom event so the sidebar toggle and the settings page agree.
import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const THEME_KEY = "adflow_theme";
const THEME_EVENT = "adflow:theme";

function readStored(): ThemeChoice {
  if (typeof window === "undefined") return "light";
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

function resolve(t: ThemeChoice): "light" | "dark" {
  if (t !== "system") return t;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyToHtml(t: ThemeChoice) {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", resolve(t));
}

export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  // First render matches SSR ("light"); the real value lands after mount (the inline script already painted with it).
  const [theme, setThemeState] = useState<ThemeChoice>("light");

  useEffect(() => {
    setThemeState(readStored());
    const sync = () => setThemeState(readStored());
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Keep <html data-theme> in sync, and re-resolve "system" when the OS preference changes.
  useEffect(() => {
    applyToHtml(theme);
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyToHtml("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* storage unavailable — ignore */
    }
    applyToHtml(t);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return [theme, setTheme];
}
