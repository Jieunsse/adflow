"use client";

// A/B Tournament Browse Mode 시연 store (localStorage). 흐름2 — 챔피언-챌린저 체인.
// ADR-038 — 순수 엔진(타입·결정 함수)은 server-safe ./engine 으로 분리. 이 파일은 데모 전용 localStorage
// store + 엔진 re-export(배럴) 만 둔다. 기존 import 경로(@entities/ab-test/tournament/tournament)는 불변.
// 실 유저 영속화는 Supabase(supabase-store.ts, TournamentStore 어댑터) — 데모는 종전대로 localStorage.

export * from "./engine";
import type { Tournament } from "./engine";

/* ─── store (흐름 1 browse/store.ts 패턴 복제) ──────────────── */

const KEY = "adflow:browse:tournaments";
export const TOURNAMENT_CHANGE_EVENT = "adflow:browse:tournaments:change";

function read(): Tournament[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tournament[]) : [];
  } catch {
    return [];
  }
}

function write(list: Tournament[]): void {
  if (typeof window === "undefined") return;
  // 저장 실패(용량 초과 등)를 삼키면 id 는 반환되고 화면은 넘어가는데 데이터는 없는 "유령 토너먼트"가 된다.
  // 표면화해서 호출부(셋업 handleStart)가 사용자에게 알리도록 한다.
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
      throw new Error("브라우저 저장 공간이 가득 찼어요. 둘러보기 데이터를 초기화한 뒤 다시 시도해주세요.");
    }
    throw e;
  }
  window.dispatchEvent(new CustomEvent(TOURNAMENT_CHANGE_EVENT));
}

export function listTournaments(): Tournament[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getTournament(id: string): Tournament | null {
  return read().find((t) => t.id === id) ?? null;
}

export function upsertTournament(t: Tournament): void {
  const list = read();
  const idx = list.findIndex((x) => x.id === t.id);
  if (idx >= 0) list[idx] = t;
  else list.push(t);
  write(list);
}

export function resetTournaments(): void {
  write([]);
}

export function removeTournament(id: string): void {
  write(read().filter((t) => t.id !== id));
}
