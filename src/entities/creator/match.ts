// 크로스링크(파트너십 카드 → 크리에이터 장부) 매칭. handle 문자열 단순 일치만 — 자동 매칭 아님(ADR-065 §9 기각 항목).

import type { Creator } from "./model";

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

export function findCreatorByHandle(creators: Creator[], handle: string): Creator | undefined {
  const target = normalizeHandle(handle);
  return creators.find((c) => normalizeHandle(c.handle) === target);
}
