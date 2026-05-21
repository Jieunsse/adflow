"use client";

import { useCallback, useEffect, useState } from "react";

export type StorageArea = "local" | "session";

export interface ScopedStorageSerde<T> {
  parse(raw: string): T;
  stringify(value: T): string;
}

// 모듈 상수 — render 마다 새 객체를 만들면 setValue identity 가 churn 되어 caller 의 useCallback/useEffect 가 의도와 다르게 동작.
const JSON_SERDE: ScopedStorageSerde<unknown> = {
  parse: (raw) => JSON.parse(raw) as unknown,
  stringify: (value) => JSON.stringify(value),
};

function getStorage(area: StorageArea): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

// Custom event so multiple hook instances on the same page share the same key change.
const SCOPED_STORAGE_EVENT = "scoped-storage:change";

interface ScopedStorageEventDetail {
  area: StorageArea;
  key: string;
}

function emitChange(area: StorageArea, key: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ScopedStorageEventDetail>(SCOPED_STORAGE_EVENT, {
      detail: { area, key },
    }),
  );
}

// hook 바깥에서 storage 를 직접 비우거나 쓴 뒤 같은 페이지 다른 hook 인스턴스를 동기화하고 싶을 때.
export function notifyScopedStorageChange(area: StorageArea, key: string) {
  emitChange(area, key);
}

export function useScopedStorage<T>(
  area: StorageArea,
  key: string,
  defaultValue: T,
  serde: ScopedStorageSerde<T> = JSON_SERDE as ScopedStorageSerde<T>,
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  // SSR 안전 — 첫 렌더는 항상 defaultValue (서버 HTML 과 일치).
  // 실제 storage 값은 mount 후 useEffect 에서 hydrate.
  const [value, setValueState] = useState<T>(defaultValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storage = getStorage(area);
    if (!storage) return;

    const sync = () => {
      try {
        const raw = storage.getItem(key);
        setValueState(raw !== null ? serde.parse(raw) : defaultValue);
      } catch {
        setValueState(defaultValue);
      }
    };

    sync(); // mount 시 1회 hydrate

    const onScopedChange = (e: Event) => {
      const detail = (e as CustomEvent<ScopedStorageEventDetail>).detail;
      if (detail?.area === area && detail?.key === key) sync();
    };
    const onStorage = (e: StorageEvent) => {
      // 'session' storage does not fire cross-tab events per the browser spec; only 'local' does.
      if (area === "local" && e.key === key) sync();
    };

    window.addEventListener(SCOPED_STORAGE_EVENT, onScopedChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SCOPED_STORAGE_EVENT, onScopedChange);
      window.removeEventListener("storage", onStorage);
    };
    // serde and defaultValue are assumed ref-stable (callers must not pass new objects each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        const storage = getStorage(area);
        if (storage) {
          try {
            storage.setItem(key, serde.stringify(resolved));
            emitChange(area, key);
          } catch {
            // quota exceeded etc. — swallow; state update proceeds regardless
          }
        }
        return resolved;
      });
    },
    [area, key, serde],
  );

  const clear = useCallback(() => {
    const storage = getStorage(area);
    if (storage) {
      try {
        storage.removeItem(key);
        emitChange(area, key);
      } catch {
        // swallow
      }
    }
    setValueState(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, key]);

  return [value, setValue, clear];
}
