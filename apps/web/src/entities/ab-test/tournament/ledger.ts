"use client";

// PRD 가설 기반 A/B (ADR-044) — Hypothesis Ledger. Brand Profile 단위로 resolved 가설을 영구 누적하는
// 브랜드 지식 자산. 데모=localStorage(브랜드별 키) / 실=Supabase 테이블(후속, ADR-038 어댑터 연장).
// 토너먼트 수명을 넘어 유지된다 — 토너먼트 store(tournament.ts)와 별도 키로 분리.

import { filterByContext, type LedgerContext } from "./hypothesis";
import type { Hypothesis, Tournament } from "./engine";

const KEY_PREFIX = "adflow:browse:ledger:";
const key = (brandProfileId: string) => `${KEY_PREFIX}${brandProfileId}`;

export function readLedger(brandProfileId: string): Hypothesis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(brandProfileId));
    return raw ? (JSON.parse(raw) as Hypothesis[]) : [];
  } catch {
    return [];
  }
}

function write(brandProfileId: string, entries: Hypothesis[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(brandProfileId), JSON.stringify(entries));
  } catch {
    // 용량 초과는 토너먼트 store 가 먼저 표면화하므로 여기선 조용히 무시(지식 누적은 best-effort).
  }
}

// resolved 가설을 멱등 적재 — 같은 id 는 최신본으로 갱신.
export function appendResolved(brandProfileId: string, h: Hypothesis): void {
  if (h.status !== "resolved") return;
  const list = readLedger(brandProfileId);
  const idx = list.findIndex((x) => x.id === h.id);
  if (idx >= 0) list[idx] = h;
  else list.push(h);
  write(brandProfileId, list);
}

// 토너먼트의 resolved 라운드 가설을 Ledger 에 동기화 — settle/cascade 후 호출. 멱등.
export function syncResolvedFromTournament(t: Tournament): void {
  for (const r of t.rounds) {
    const h = r.hypothesis;
    if (h && h.status === "resolved") appendResolved(t.brandProfileId, h);
  }
}

// 현재 토너먼트 맥락에 관련된 Ledger 엔트리만 (생성기·패널 입력).
export function relevantLedger(brandProfileId: string, ctx: LedgerContext): Hypothesis[] {
  return filterByContext(readLedger(brandProfileId), ctx);
}

// Presenter 초기화 — 데모 Ledger 전부 비운다.
export function clearAllLedgers(): void {
  if (typeof window === "undefined") return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) localStorage.removeItem(k);
  }
}
