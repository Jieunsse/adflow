"use client";

// 라이트/다크/시스템 테마 — localStorage (`adflow_theme`) + <html data-theme> 동기화.
// 저장소 read/write/sync 는 useScopedStorage primitive 담당.
// 여기선 (1) raw string 직렬화 + 검증, (2) DOM data-theme 적용, (3) "system" 일 때 OS preference 구독.
// app/layout.tsx 의 FOUC 인라인 스크립트가 같은 키를 raw 로 읽으므로 JSON wrap 금지.

import { useEffect } from "react";
import { useScopedStorage, type ScopedStorageSerde } from "./storage/useScopedStorage";

export type ThemeChoice = "light" | "dark" | "system";

const THEME_KEY = "adflow_theme";

const themeSerde: ScopedStorageSerde<ThemeChoice> = {
  stringify: (value) => value,
  parse: (raw) => (raw === "light" || raw === "dark" || raw === "system" ? raw : "light"),
};

function resolve(t: ThemeChoice): "light" | "dark" {
  if (t !== "system") return t;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyToHtml(t: ThemeChoice) {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", resolve(t));
}

export function useTheme() {
  const [theme, setTheme] = useScopedStorage<ThemeChoice>("local", THEME_KEY, "light", themeSerde);

  useEffect(() => {
    applyToHtml(theme);
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyToHtml("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return [theme, setTheme] as const;
}
