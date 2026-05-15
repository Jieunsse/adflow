"use client";

import { useCallback, useEffect, useState } from "react";

export type StorageArea = "local" | "session";

export interface ScopedStorageSerde<T> {
  parse(raw: string): T;
  stringify(value: T): string;
}

function jsonSerde<T>(): ScopedStorageSerde<T> {
  return {
    parse: (raw) => JSON.parse(raw) as T,
    stringify: (value) => JSON.stringify(value),
  };
}

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

export function useScopedStorage<T>(
  area: StorageArea,
  key: string,
  defaultValue: T,
  serde: ScopedStorageSerde<T> = jsonSerde<T>(),
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValueState] = useState<T>(() => {
    const storage = getStorage(area);
    if (!storage) return defaultValue;
    try {
      const raw = storage.getItem(key);
      return raw !== null ? serde.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

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
