"use client";

// sessionStorage 의 raw string 키 — /create/page.tsx 등에서 동일 키를 sessionStorage.getItem 으로
// 직접 읽기도 하므로 JSON wrap 없이 그대로 저장.

import { useScopedStorage, type ScopedStorageSerde } from "./useScopedStorage";

const rawStringSerde: ScopedStorageSerde<string> = {
  parse: (raw) => raw,
  stringify: (value) => value,
};

export function useSessionStorage(key: string, initialValue: string) {
  const [value, setValue] = useScopedStorage<string>("session", key, initialValue, rawStringSerde);
  return [value, setValue] as const;
}
