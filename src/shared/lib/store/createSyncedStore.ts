"use client";

// Synced Store (ADR-046 결정 1·3·4) — Tier 1 공유 팩토리.
// zustand + persist(localStorage 오프라인 캐시) + 로그인 시 API 하이드레이션(Supabase=source-of-truth) +
// API-backed mutation(POST/DELETE, Next 라우트 경유 service-role 스코핑). 게스트는 API 단락(persist 만 = Tier 3).
// 토너먼트 supabaseTournamentStore(ADR-038)가 검증한 primary 모델의 일반 엔티티 일반화.

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { isRealOwner } from "./ownerKey";

export interface SyncedItem {
  id: string;
}

export type SyncStatus = "idle" | "hydrating" | "ready";

export interface SyncedState<T extends SyncedItem> {
  items: T[];
  status: SyncStatus;
  owner: string | null;
  add: (item: T) => void;
  upsert: (item: T) => void;
  removeById: (id: string) => void;
  setAll: (items: T[]) => void;
  hydrate: (owner: string | null) => Promise<void>;
}

export interface SyncedStoreConfig {
  // persist 키(localStorage). 도메인 store 의 기존 키를 유지하면 오프라인 캐시 승계.
  name: string;
  // per-entity API 라우트. GET→{items}, POST {item}, DELETE ?id=.
  endpoint: string;
}

export interface SyncedStore<T extends SyncedItem> {
  useStore: UseBoundStore<StoreApi<SyncedState<T>>>;
  // 세션→하이드레이션 배선. 도메인 훅에서 1회 호출.
  useSync: () => void;
  // persist 캐시 수동 복원(skipHydration). 동기 리더 워밍용 — persist 미들웨어 증강이 export 타입엔 없어 헬퍼로 노출.
  rehydrate: () => void;
}

export function createSyncedStore<T extends SyncedItem>(
  config: SyncedStoreConfig,
): SyncedStore<T> {
  const useStore = create<SyncedState<T>>()(
    persist(
      (set, get) => {
        // best-effort 서버 확정(V1, 롤백·재시도 없음). 게스트/미로그인은 단락 — 로컬·persist 캐시만.
        const postItem = (item: T) => {
          if (!isRealOwner(get().owner)) return;
          void fetch(config.endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ item }),
          }).catch(() => {});
        };

        return {
        items: [],
        status: "idle",
        owner: null,

        setAll: (items) => set({ items }),

        add: (item) => {
          // optimistic — 로컬 즉시 반영(id 중복 제거 후 prepend) 뒤 서버 확정.
          set((s) => ({ items: [item, ...s.items.filter((x) => x.id !== item.id)] }));
          postItem(item);
        },

        upsert: (item) => {
          // add 와 달리 기존 위치 보존(편집·플래그 토글용) — id 있으면 제자리 교체, 없으면 prepend.
          set((s) => {
            const idx = s.items.findIndex((x) => x.id === item.id);
            if (idx < 0) return { items: [item, ...s.items] };
            const next = s.items.slice();
            next[idx] = item;
            return { items: next };
          });
          postItem(item);
        },

        removeById: (id) => {
          set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
          if (isRealOwner(get().owner)) {
            void fetch(`${config.endpoint}?id=${encodeURIComponent(id)}`, {
              method: "DELETE",
            }).catch(() => {});
          }
        },

        hydrate: async (owner) => {
          set({ owner });
          // 게스트/미로그인 → Supabase 단락, persist(localStorage)만 = Tier 3 동작(ADR-033).
          if (!isRealOwner(owner)) {
            set({ status: "ready" });
            return;
          }
          set({ status: "hydrating" });
          try {
            const res = await fetch(config.endpoint, { headers: { accept: "application/json" } });
            if (res.ok) {
              const json = (await res.json()) as { items?: T[] };
              set({ items: json.items ?? [] });
            }
            // 비-OK(401 등) → persist 캐시 유지(오프라인 폴백).
          } catch {
            // 네트워크 실패 → persist 캐시 유지(best-effort).
          } finally {
            set({ status: "ready" });
          }
        },
        };
      },
      {
        name: config.name,
        storage: createJSONStorage(() => localStorage),
        // SSR 가드: 첫 렌더 = default(서버 HTML 일치), mount 후 useSync 가 rehydrate(useScopedStorage 패턴 계승).
        skipHydration: true,
        // status·owner 는 런타임 상태 — 캐시 대상은 items 만.
        partialize: (s) => ({ items: s.items }),
      },
    ),
  );

  function useSync() {
    const { data: session } = useSession();
    const owner = session?.user?.email ?? null;
    useEffect(() => {
      // persist 캐시 먼저 복원(오프라인 폴백) → 그 위에 Supabase 하이드레이션.
      void useStore.persist.rehydrate();
      void useStore.getState().hydrate(owner);
    }, [owner]);
  }

  return {
    useStore,
    useSync,
    rehydrate: () => {
      void useStore.persist.rehydrate();
    },
  };
}
