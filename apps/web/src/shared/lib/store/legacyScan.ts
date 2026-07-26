// 인덱스 키가 없는 레거시 저장 방식(키 하나당 항목 하나)에서 데이터를 건져 올린다.
// 스캔 뒤 해당 키를 지운다 — 남기면 다음 하이드레이션에서 같은 데이터가 다시 올라온다.

export function scanLegacyKeys<T>(prefix: string): T[] {
  if (typeof window === "undefined") return [];

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }

  const items: T[] = [];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) items.push(JSON.parse(raw) as T);
    } catch {
      // 깨진 항목은 버린다. 키는 아래에서 지워지므로 다시 시도하지 않는다.
    }
    try {
      localStorage.removeItem(k);
    } catch {}
  }
  return items;
}
