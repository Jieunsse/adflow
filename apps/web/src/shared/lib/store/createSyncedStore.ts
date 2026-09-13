"use client";

// Synced Store (ADR-046 결정 1·3·4) — Tier 1 공유 팩토리.
// zustand + persist(localStorage 오프라인 캐시) + 로그인 시 API 하이드레이션(서버=source-of-truth) +
// API-backed mutation(POST/DELETE, Next 라우트 경유 service-role 스코핑). 게스트는 API 단락(persist 만 = Tier 3).
// 토너먼트 스토어(ADR-038)가 검증한 primary 모델의 일반 엔티티 일반화.

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { useToastOptional } from "@shared/ui/Toast";
import { GUEST_OWNER, isRealOwner } from "./ownerKey";

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
  let storageOwner = GUEST_OWNER;
  let hydrationRequest = 0;
  const writeChains = new Map<string, Promise<void>>();
  const writeVersions = new Map<string, number>();

  const scopedStorageName = (name: string) => `${name}:${encodeURIComponent(storageOwner)}`;
  const ownerScopedStorage: StateStorage = {
    getItem: (name) => (typeof localStorage === "undefined" ? null : localStorage.getItem(scopedStorageName(name))),
    setItem: (name, value) => {
      if (typeof localStorage !== "undefined") localStorage.setItem(scopedStorageName(name), value);
    },
    removeItem: (name) => {
      if (typeof localStorage !== "undefined") localStorage.removeItem(scopedStorageName(name));
    },
  };

  function setOwner(owner: string | null): void {
    const nextOwner = owner ?? GUEST_OWNER;
    if (storageOwner === nextOwner) return;
    storageOwner = nextOwner;
    hydrationRequest += 1;
    useStore?.setState({ items: [], status: "idle", owner });
  }

  async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    try {
      const response = await fetch(input, init);
      if (response.status < 500 || response.ok) return response;
      await new Promise((resolve) => setTimeout(resolve, 250));
      return await fetch(input, init);
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fetch(input, init).catch(() => { throw error; });
    }
  }

  const useStore = create<SyncedState<T>>()(
    persist(
      (set, get) => {
        const rollback = (id: string, previous: T | undefined) => {
          set((state) => ({
            items: previous
              ? state.items.map((item) => (idOf(item) === id ? previous : item))
              : state.items.filter((item) => idOf(item) !== id),
          }));
        };

        const enqueueWrite = (id: string, task: () => Promise<void>) => {
          const previous = writeChains.get(id);
          const current = previous ? previous.catch(() => undefined).then(task) : task();
          writeChains.set(id, current);
          void current.finally(() => {
            if (writeChains.get(id) === current) writeChains.delete(id);
          });
        };

        const syncItem = (item: T, previous: T | undefined, owner: string | null) => {
          if (!isRealOwner(owner)) return;
          const id = idOf(item);
          const version = (writeVersions.get(id) ?? 0) + 1;
          writeVersions.set(id, version);
          enqueueWrite(id, async () => {
            try {
              const res = await fetchWithRetry(config.endpoint, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ item }),
              });
              if (!res.ok) throw new Error(`저장 (${res.status})`);
              if (get().owner === owner && get().lastError) set({ lastError: null });
            } catch (error) {
              if (get().owner !== owner || writeVersions.get(id) !== version) return;
              rollback(id, previous);
              set({ lastError: `${error instanceof Error ? error.message : "저장"}에 실패했어요. 변경을 되돌렸어요.` });
            }
          });
        };

        const syncDelete = (id: string, previous: T | undefined, owner: string | null) => {
          if (!isRealOwner(owner)) return;
          const version = (writeVersions.get(id) ?? 0) + 1;
          writeVersions.set(id, version);
          enqueueWrite(id, async () => {
            try {
              const res = await fetchWithRetry(`${config.endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
              if (!res.ok) throw new Error(`삭제 (${res.status})`);
              if (get().owner === owner && get().lastError) set({ lastError: null });
            } catch (error) {
              if (get().owner !== owner || writeVersions.get(id) !== version) return;
              rollback(id, previous);
              set({ lastError: `${error instanceof Error ? error.message : "삭제"}에 실패했어요. 변경을 되돌렸어요.` });
            }
          });
        };

        return {
        items: [],
        status: "idle",
        owner: null,
        lastError: null,

        setAll: (items) => set({ items }),

        clearError: () => set({ lastError: null }),

        add: (item) => {
          const previous = get().items.find((x) => idOf(x) === idOf(item));
          set((s) => ({ items: [item, ...s.items.filter((x) => idOf(x) !== idOf(item))] }));
          syncItem(item, previous, get().owner);
        },

        upsert: (item) => {
          const previous = get().items.find((x) => idOf(x) === idOf(item));
          set((s) => {
            const idx = s.items.findIndex((x) => idOf(x) === idOf(item));
            if (idx < 0) return { items: [item, ...s.items] };
            const next = s.items.slice();
            next[idx] = item;
            return { items: next };
          });
          syncItem(item, previous, get().owner);
        },

        removeById: (id) => {
          const previous = get().items.find((x) => idOf(x) === id);
          set((s) => ({ items: s.items.filter((x) => idOf(x) !== id) }));
          syncDelete(id, previous, get().owner);
        },

        hydrate: async (owner) => {
          storageOwner = owner ?? GUEST_OWNER;
          const request = ++hydrationRequest;
          set({ owner });
          // 게스트/미로그인 → 서버 단락, persist(localStorage)만 = Tier 3 동작(ADR-033).
          if (!isRealOwner(owner)) {
            set({ status: "ready" });
            return;
          }
          set({ status: "hydrating" });
          try {
            const res = await fetch(config.endpoint, { headers: { accept: "application/json" } });
            if (request !== hydrationRequest || get().owner !== owner) return;
            if (res.ok) {
              const json = (await res.json()) as { items?: T[] };
              set({ items: json.items ?? [] });
            } else if (res.status === 401 || res.status === 403) {
              set({ items: [] });
            }
            // 5xx 등 서버 오류·네트워크 실패는 오프라인 폴백을 위해 캐시를 유지한다.
          } catch {
            if (request !== hydrationRequest || get().owner !== owner) return;
          } finally {
            if (request === hydrationRequest && get().owner === owner) set({ status: "ready" });
          }
        },
        };
      },
      {
        name: config.name,
        storage: createJSONStorage(() => ownerScopedStorage),
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
      setOwner(owner);
      // 사용자별 persist 캐시 먼저 복원 → 그 위에 서버 하이드레이션.
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
