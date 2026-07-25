"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const EXEMPT_PATHS = ["/onboarding", "/setup", "/login", "/install"];

export function onboardedKey(userId: string | null | undefined) {
  return `adflow:onboarded:${userId ?? "guest"}`;
}

function readCache(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeCache(key: string) {
  try {
    localStorage.setItem(key, "true");
  } catch {
    /* storage 사용 불가 — 무시 */
  }
}

export default function OnboardingGuard() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return;

    const key = onboardedKey(session?.user?.email);

    // 구버전 키 마이그레이션
    try {
      const legacy = "adflow:onboarded";
      if (!localStorage.getItem(key) && localStorage.getItem(legacy)) {
        localStorage.setItem(key, "true");
        localStorage.removeItem(legacy);
      }
    } catch {
      /* 무시 */
    }

    if (readCache(key)) return;

    let aborted = false;
    fetch("/api/onboarding/status")
      .then((r) => (r.ok ? r.json() : { onboarded: false, ok: false }))
      .then((data: { onboarded?: boolean; ok?: boolean }) => {
        if (aborted) return;
        if (data.onboarded) {
          writeCache(key);
          return;
        }
        // 네트워크/서버 응답을 못 받았을 땐(=ok:false 명시) redirect 보류 — 가짜 라우팅 방지
        if (data.ok === false) return;
        window.location.replace("/onboarding");
      })
      .catch(() => {
        /* 네트워크 실패 — redirect 안 함 */
      });

    return () => {
      aborted = true;
    };
  }, [pathname, status, session?.user?.email]);

  return null;
}
