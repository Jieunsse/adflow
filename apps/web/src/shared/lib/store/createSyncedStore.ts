"use client";

// Synced Store (ADR-046 결정 1·3·4) — Tier 1 공유 팩토리.
// zustand + persist(localStorage 오프라인 캐시) + 로그인 시 API 하이드레이션(Supabase=source-of-truth) +
// API-backed mutation(POST/DELETE, Next 라우트 경유 service-role 스코핑). 게스트는 API 단락(persist 만 = Tier 3).
// 토너먼트 supabaseTournamentStore(ADR-038)가 검증한 primary 모델의 일반 엔티티 일반화.

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useToastOptional } from "@shared/ui/Toast";
import { isRealOwner } from "./ownerKey";

// idOf 로 식별자를 뽑을 수 있으면 되므로 id 필드를 강제하지 않는다.
// 기본값이 (i) => i.id 라 기존 store 4개는 그대로 동작한다.
// Record<string, unknown> 이 아니라 object 인 이유 — interface 로 선언된 도메인 타입은
// 암묵적 인덱스 시그니처가 없어 Record 제약을 만족하지 못한다(Sop·PersonaEntry).
export type SyncedItem = object;

export type SyncStatus = "idle" | "hydrating" | "ready";

export interface SyncedState<T extends SyncedItem> {
  items: T[];
  status: SyncStatus;
  owner: string | null;
  // 마지막 서버 쓰기의 실패 사유. 성공하면 null 로 돌아간다.
  lastError: string | null;
  add: (item: T) => void;
  upsert: (item: T) => void;
  removeById: (id: string) => void;
  setAll: (items: T[]) => void;
  clearError: () => void;
  hydrate: (owner: string | null) => Promise<void>;
}

export interface SyncedStoreConfig<T = unknown> {
  // persist 키(localStorage). 도메인 store 의 기존 키를 유지하면 오프라인 캐시 승계.
  name: string;
  // per-entity API 라우트. GET→{items}, POST {item}, DELETE ?id=.
  endpoint: string;
  // 식별자 추출. campaignId 처럼 id 가 아닌 키를 쓰는 도메인 타입을 위해 위임받는다.
  idOf?: (item: T) => string;
  // persist 캐시가 비었을 때 1회 호출. 레거시 localStorage 키에서 데이터를 건져 올린다.
  migrate?: () => T[];
}

export interface SyncedStore<T extends SyncedItem> {
  useStore: UseBoundStore<StoreApi<SyncedState<T>>>;
  // 세션→하이드레이션 배선. 도메인 훅에서 1회 호출.
  useSync: () => void;
  // persist 캐시 수동 복원(skipHydration) + 최초 1회 레거시 흡수. 동기 리더 워밍용.
  rehydrate: () => void;
  // 훅 밖 동기 리더용. 워밍된 items 를 그대로 준다. 서버에서는 빈 배열.
  snapshot: () => T[];
}

export function createSyncedStore<T extends SyncedItem>(
  config: SyncedStoreConfig<T>,
): SyncedStore<T> {
  const idOf = config.idOf ?? ((item: T) => (item as { id: string }).id);

  const useStore = create<SyncedState<T>>()(
    persist(
      (set, get) => {
        // 서버 확정. 실패를 삼키지 않는다 — supabase-sync 의 .then(()=>{},()=>{}) 가
        // persona 미러 실패를 몇 달간 숨긴 전례가 있다(설계 §5).
        const settle = (res: Response | null, action: string) => {
          if (res && res.ok) {
            if (get().lastError) set({ lastError: null });
            return;
          }
          const detail = res ? ` (${res.status})` : "";
          set({ lastError: `${action}이 서버에 닿지 않았어요${detail}. 잠시 뒤 다시 시도해 주세요.` });
        };

        // 게스트/미로그인은 단락 — 로컬·persist 캐시만.
        const postItem = (item: T) => {
          if (!isRealOwner(get().owner)) return;
          void fetch(config.endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ item }),
          }).then(
            (res) => settle(res, "저장"),
            () => settle(null, "저장"),
          );
        };

        return {
        items: [],
        status: "idle",
        owner: null,
        lastError: null,

        setAll: (items) => set({ items }),

        clearError: () => set({ lastError: null }),

        add: (item) => {
          // optimistic — 로컬 즉시 반영(id 중복 제거 후 prepend) 뒤 서버 확정.
          set((s) => ({ items: [item, ...s.items.filter((x) => idOf(x) !== idOf(item))] }));
          postItem(item);
        },

        upsert: (item) => {
          // add 와 달리 기존 위치 보존(편집·플래그 토글용) — id 있으면 제자리 교체, 없으면 prepend.
          set((s) => {
            const idx = s.items.findIndex((x) => idOf(x) === idOf(item));
            if (idx < 0) return { items: [item, ...s.items] };
            const next = s.items.slice();
            next[idx] = item;
            return { items: next };
          });
          postItem(item);
        },

        removeById: (id) => {
          set((s) => ({ items: s.items.filter((x) => idOf(x) !== id) }));
          if (isRealOwner(get().owner)) {
            void fetch(`${config.endpoint}?id=${encodeURIComponent(id)}`, {
              method: "DELETE",
            }).then(
              (res) => settle(res, "삭제"),
              () => settle(null, "삭제"),
            );
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
      // persist 캐시 먼저 복원(+ 레거시 흡수) → 그 위에 서버 하이드레이션.
      rehydrate();
      void useStore.getState().hydrate(owner);
    }, [owner]);
    useSyncErrorToast(useStore);
  }

  // persist 캐시 복원 + 최초 1회 레거시 흡수. 캐시가 이미 차 있으면 흡수하지 않는다.
  function rehydrate(): void {
    void useStore.persist.rehydrate();
    if (!config.migrate) return;
    if (useStore.getState().items.length > 0) return;
    const legacy = config.migrate();
    if (legacy.length > 0) useStore.getState().setAll(legacy);
  }

  return {
    useStore,
    useSync,
    rehydrate,
    snapshot: () => (typeof window === "undefined" ? [] : useStore.getState().items),
  };
}

// 쓰기 실패를 화면으로 흘린다. 훅이라 도메인 store 가 자체 useSync 를 쓰더라도 재사용된다.
export function useSyncErrorToast<T extends SyncedItem>(
  useStore: UseBoundStore<StoreApi<SyncedState<T>>>,
): void {
  const showToast = useToastOptional();
  const lastError = useStore((s) => s.lastError);
  useEffect(() => {
    if (!lastError) return;
    if (showToast) showToast(lastError);
    else console.error("[synced-store]", lastError);
    useStore.getState().clearError();
  }, [lastError, showToast, useStore]);
}
