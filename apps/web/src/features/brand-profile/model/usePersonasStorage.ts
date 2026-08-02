"use client";

import { useCallback, useMemo } from "react";
import { createSyncedStore } from "@shared/lib/store";

export interface PersonaEntry {
  id: string;
  brandProfileId: string;
  name: string;
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  location?: string[];
  interests?: string[];
  customerDescription?: string;
}

const LEGACY_KEY = "adflow:personas";
const PERSONAS_KEY = "adflow:personas:v2"; // zustand persist 봉투

/** 레거시 bare-array 키를 1회 흡수하고 지운다. 남기면 다음 로그인에서 다시 올라온다. */
export function absorbLegacyPersonas(): PersonaEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersonaEntry[];
    localStorage.removeItem(LEGACY_KEY);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const personas = createSyncedStore<PersonaEntry>({
  name: PERSONAS_KEY,
  endpoint: "/api/stores/personas",
  migrate: absorbLegacyPersonas,
});

const { useStore } = personas;

// 모듈 로드 시 워밍 — readPersonas 가 훅 밖 동기 리더라 items 가 채워져 있어야 한다.
if (typeof window !== "undefined") personas.rehydrate();

/** 동기 리더. 렌더 중 직접 호출되므로 시그니처를 바꾸지 않는다. */
export function readPersonas(): PersonaEntry[] {
  return personas.snapshot();
}

/** 프로필 삭제 시 딸린 페르소나 정리. 이전에는 brandProfileStore 가 localStorage 를 직접 만졌다. */
export function removePersonasForProfile(brandProfileId: string): void {
  for (const p of readPersonas().filter((p) => p.brandProfileId === brandProfileId)) {
    useStore.getState().removeById(p.id);
  }
}

export function usePersonasStorage() {
  personas.useSync();
  const list = useStore((s) => s.items);
  const upsert = useStore((s) => s.upsert);
  const removeById = useStore((s) => s.removeById);

  const savePersona = useCallback((entry: PersonaEntry): void => upsert(entry), [upsert]);
  const deletePersona = useCallback((id: string): void => removeById(id), [removeById]);

  return { personas: list, savePersona, deletePersona };
}

export function usePersonasForProfile(brandProfileId: string) {
  personas.useSync();
  // 전체 목록에서 걸러 낸다 — 이전 구현이 "필터된 뷰"와 "전체"를 각각 들고 있어
  // 두 상태가 어긋나던 문제를 store 하나로 없앤다.
  // 필터는 selector 밖에서 — selector 가 매번 새 배열을 돌려주면 useSyncExternalStore 가
  // 스냅샷이 바뀐 걸로 보고 무한 렌더에 빠진다.
  const all = useStore((s) => s.items);
  const list = useMemo(
    () => all.filter((p) => p.brandProfileId === brandProfileId),
    [all, brandProfileId],
  );
  const upsert = useStore((s) => s.upsert);
  const removeById = useStore((s) => s.removeById);

  const savePersona = useCallback((entry: PersonaEntry): void => upsert(entry), [upsert]);
  const deletePersona = useCallback((id: string): void => removeById(id), [removeById]);

  return { personas: list, savePersona, deletePersona };
}
