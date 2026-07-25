"use client";

// Creator Synced Store (ADR-046 Tier1, ADR-065 §9) — brand_profiles/library 선례와 동형.
// createSyncedStore 가 동기화 담당, 여기선 도메인 훅 표면만 노출.

import { createSyncedStore } from "@shared/lib/store";
import type { Creator } from "./model";

const CREATORS_KEY = "adflow:creators:v1";

export const creators = createSyncedStore<Creator>({
  name: CREATORS_KEY,
  endpoint: "/api/stores/creators",
});

const { useStore, useSync } = creators;

export function useCreators() {
  useSync();
  const list = useStore((s) => s.items);
  const add = useStore((s) => s.add);
  const upsert = useStore((s) => s.upsert);
  const removeById = useStore((s) => s.removeById);
  const status = useStore((s) => s.status);

  return { list, add, upsert, removeById, status };
}

// 동기 스냅샷(훅 밖 — 랭킹 계산 등) — 워밍된 getState().items. 서버에서는 빈 배열.
export function creatorsSnapshot(): Creator[] {
  if (typeof window === "undefined") return [];
  return useStore.getState().items;
}

// 시드(browse)가 store 를 거쳐 쓰도록 — 로컬+persist 만(서버 미전송, 게스트 단락은 add/upsert 내부에서 처리).
export function upsertCreator(item: Creator): void {
  useStore.getState().upsert(item);
}

export function removeCreator(id: string): void {
  useStore.getState().removeById(id);
}
