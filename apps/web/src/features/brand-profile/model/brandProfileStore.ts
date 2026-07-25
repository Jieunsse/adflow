"use client";

// Brand Profile Synced Store (ADR-046) — 린치핀 엔티티. createSyncedStore(Tier1) 위에
// 도메인 표면(활성 ID·동기 스냅샷·시드 교체·기본값 토글)을 얹는다. useBrandProfileStorage 와
// seed-demo·onboarding 이 공유하므로 store 를 별도 모듈로 분리해 런타임 순환을 끊는다.

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { createSyncedStore, isRealOwner } from "@shared/lib/store";
import type { BrandProfile, BrandProfileEntry } from "./useBrandProfileStorage";

const PROFILES_KEY = "adflow:brand-profiles:v2"; // zustand persist 봉투. 레거시 bare-array 키는 1회 흡수 후 폐기.
const LEGACY_ARRAY_KEY = "adflow:brand-profiles";
const LEGACY_SINGLE_KEY = "adflow:brand-profile";
const ACTIVE_ID_KEY = "adflow:brand-profile:active-id";

export const brandProfiles = createSyncedStore<BrandProfileEntry>({
  name: PROFILES_KEY,
  endpoint: "/api/stores/brand-profiles",
});

const { useStore } = brandProfiles;

function readLegacyProfiles(): BrandProfileEntry[] {
  try {
    const arr = localStorage.getItem(LEGACY_ARRAY_KEY);
    if (arr) return JSON.parse(arr) as BrandProfileEntry[];
    const single = localStorage.getItem(LEGACY_SINGLE_KEY);
    if (single) {
      const bp = JSON.parse(single) as BrandProfile;
      return [{ id: "default", name: "기본 프로필", isDefault: true, ...bp }];
    }
  } catch {}
  return [];
}

// 동기 리더(훅 밖 렌더·핸들러)를 위한 클라이언트 워밍 — persist 가 skipHydration 이라 모듈 로드 시
// 수동 rehydrate 로 getState().items 를 채운다(localStorage=동기). status 는 건드리지 않아
// 훅의 첫 렌더는 여전히 빈 배열 = SSR 안전. 비어 있으면 레거시 bare-array 를 1회 흡수 후 폐기.
if (typeof window !== "undefined") {
  brandProfiles.rehydrate();
  if (useStore.getState().items.length === 0) {
    const legacy = readLegacyProfiles();
    if (legacy.length) {
      useStore.getState().setAll(legacy);
      try {
        localStorage.removeItem(LEGACY_ARRAY_KEY);
        localStorage.removeItem(LEGACY_SINGLE_KEY);
      } catch {}
    }
  }
}

// 세션→하이드레이션 배선(brand_profiles 전용). 팩토리 useSync 를 대체 — 최초 이관 안전판 포함.
export function useSyncBrandProfiles(): void {
  const { data: session } = useSession();
  const owner = session?.user?.email ?? null;
  useEffect(() => {
    void (async () => {
      brandProfiles.rehydrate();
      const before = useStore.getState().items;
      await useStore.getState().hydrate(owner);
      // 최초 이관 안전판: 실유저인데 서버가 비어 있고 로컬엔 프로필이 있으면(과거 table 부재로 미동기화),
      // 로컬을 서버로 1회 업로드한다. merge 아님 — 비어 있는 primary 를 로컬로 시드(데이터 소실 방지).
      if (isRealOwner(owner) && useStore.getState().items.length === 0 && before.length > 0) {
        useStore.getState().setAll(before);
        before.forEach((p) => useStore.getState().upsert(p));
      }
    })();
  }, [owner]);
}

// 동기 스냅샷 — 워밍된 getState().items. 서버에서는 빈 배열.
export function profilesSnapshot(): BrandProfileEntry[] {
  if (typeof window === "undefined") return [];
  return useStore.getState().items;
}

// 시드(seed-demo)가 store 를 거쳐 쓰도록 — 로컬+persist 만(게스트 시드, 서버 미전송).
export function replaceProfiles(next: BrandProfileEntry[]): void {
  useStore.getState().setAll(next);
}

// 비-훅 컨텍스트(onboarding 등)용 뮤테이션 — 실유저면 서버 동기 포함(upsert).
export function upsertProfile(entry: BrandProfileEntry): void {
  useStore.getState().upsert(entry);
}

const PERSONAS_KEY = "adflow:personas";

export function removeProfile(id: string): void {
  const items = useStore.getState().items;
  const removed = items.find((p) => p.id === id);
  useStore.getState().removeById(id);

  if (getActiveId() === id) {
    try {
      localStorage.removeItem(ACTIVE_ID_KEY);
    } catch {}
  }

  if (removed?.isDefault) {
    const remaining = items.filter((p) => p.id !== id);
    if (remaining.length > 0) setDefaultProfile(remaining[0].id);
  }

  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    if (raw) {
      const personas = JSON.parse(raw) as { brandProfileId: string }[];
      const next = personas.filter((p) => p.brandProfileId !== id);
      if (next.length !== personas.length) {
        localStorage.setItem(PERSONAS_KEY, JSON.stringify(next));
      }
    }
  } catch {}
}

export function setDefaultProfile(id: string): void {
  // 값이 바뀌는 행만 서버 동기(보통 ≤2). upsert 라 순서 보존.
  useStore.getState().items.forEach((p) => {
    const want = p.id === id;
    if (!!p.isDefault !== want) useStore.getState().upsert({ ...p, isDefault: want });
  });
  setActiveIdInStorage(id);
}

// 활성 프로필 ID — 기기별 UI 선택 상태(별도 키, 동기화 대상 아님).
export function getActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveIdInStorage(id: string): void {
  try {
    localStorage.setItem(ACTIVE_ID_KEY, id);
  } catch {}
}
