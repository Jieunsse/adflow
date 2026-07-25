"use client";

// Library Entry — STEP 01 Creative 저장. 도메인 어휘는 .document/CONTEXT.md §Library Entry.
// ADR-046: Synced Store(Tier 1)로 이관 — Supabase=source-of-truth(로그인 시 하이드레이션),
// localStorage(persist)=오프라인 캐시, 게스트=로컬만. 동기화·영속은 createSyncedStore 가 담당,
// 여기선 도메인 형태(id 생성·저장 시각)만. (이전: useScopedStorage + 단방향 syncUpsert 미러)

import { useCallback } from "react";
import { createSyncedStore } from "./store";

const LIBRARY_KEY = "adflow_library_v1";

function newLibraryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return "cre_" + crypto.randomUUID();
  }
  return "cre_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

export interface LibraryItem {
  id: string;
  savedAt: number;
  brand: string;
  headline: string;
  primary: string;
  tone: string;
  toneLabel: string;
  ctaId: string;
  ctaLabel: string;
  goal: string;
  target: string;
  gradient: string;
  image?: string;
  tag: string;
}

export type NewLibraryItem = Omit<LibraryItem, "id" | "savedAt">;

const { useStore, useSync } = createSyncedStore<LibraryItem>({
  name: LIBRARY_KEY,
  endpoint: "/api/stores/library",
});

export function useLibrary() {
  useSync();
  const list = useStore((s) => s.items);
  const add = useStore((s) => s.add);
  const removeById = useStore((s) => s.removeById);

  const save = useCallback(
    (item: NewLibraryItem): string => {
      const id = newLibraryId();
      add({ id, savedAt: Date.now(), ...item });
      return id;
    },
    [add],
  );

  const remove = useCallback((id: string) => removeById(id), [removeById]);

  return { list, save, remove };
}
