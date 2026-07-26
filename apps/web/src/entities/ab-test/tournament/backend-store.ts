// 실 유저 토너먼트의 진실의 원천 — 단계 5 에서 Supabase 에서 Spring 으로 넘어왔다(설계 §9).
// server-side only. 단계 2~4 의 Synced Store 와 같은 처방이다: 쓰기 경로를 통째로 넘기고 옛 행은
// 단계 7 ETL 이 옮긴다. 양쪽에 쓰면 갈라지므로 이중 기록은 하지 않는다.
//
// JWT 경로(/stores/tournaments)가 아니라 내부 시크릿 경로(/internal/tournaments)를 쓴다 —
// cron 폴러는 세션 없이 돌아 JWT 를 실을 수 없고, API 라우트는 이미 자기 세션을 검증한 뒤
// ownerKey 를 명시적으로 넘긴다. 통로가 하나라 폴러와 UI 가 같은 행을 본다.
//
// ADR-054 의 manual-n → auto 흡수는 Spring 이 한다(Tournament.getMode). 여기 normalize 는 없다.

import { backendBaseUrl, internalSecret } from "@shared/lib/backend/client";
import type { Tournament, TourRound } from "./engine";
import type { TournamentStore } from "./adapters";

const PATH = "/internal/tournaments";

async function call(path: string, init?: { method?: string; body?: string }): Promise<Response> {
  const base = backendBaseUrl();
  const secret = internalSecret();
  if (!base || !secret) {
    throw new Error("백엔드가 설정되지 않았어요 — 토너먼트는 영속이 필요해요.");
  }

  const res = await fetch(`${base}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "X-Internal-Secret": secret,
      ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(init?.body === undefined ? {} : { body: init.body }),
  });
  if (!res.ok) {
    throw new Error(`토너먼트 백엔드 호출 실패 (${res.status}) ${await res.text()}`);
  }
  return res;
}

async function items(query: string): Promise<Tournament[]> {
  const res = await call(`${PATH}${query}`);
  const body = (await res.json()) as { items?: Tournament[] };
  return body.items ?? [];
}

export const backendTournamentStore: TournamentStore = {
  // cron 전역 스캔. 폴러는 running 만 진행하므로 서버에서 좁혀 받는다.
  list() {
    return items("?status=running");
  },

  listByOwner(ownerKey) {
    return items(`?ownerKey=${encodeURIComponent(ownerKey)}`);
  },

  // ADR-047 — Ledger 투영 입력. 소유 유저의 같은 Brand Profile 토너먼트만.
  listByBrandOwner(brandProfileId, ownerKey) {
    return items(
      `?ownerKey=${encodeURIComponent(ownerKey)}&brandProfileId=${encodeURIComponent(brandProfileId)}`,
    );
  },

  async get(id) {
    const base = backendBaseUrl();
    const secret = internalSecret();
    if (!base || !secret) throw new Error("백엔드가 설정되지 않았어요 — 토너먼트는 영속이 필요해요.");

    // 없는 id 는 404 다 — call() 의 throw 를 타면 "아직 없음"과 "고장"을 구분 못 한다.
    const res = await fetch(`${base}${PATH}/${encodeURIComponent(id)}`, {
      headers: { "X-Internal-Secret": secret },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`토너먼트 조회 실패 (${res.status}) ${await res.text()}`);
    return (await res.json()) as Tournament;
  },

  async upsert(t) {
    // 소유 매칭 키는 생성 시 delivery 에 박아둔 ownerKey 다 (tournaments POST 라우트의 ownerKeyFrom).
    const ownerKey = t.delivery?.ownerEmail;
    if (!ownerKey) throw new Error("소유자를 알 수 없는 토너먼트는 저장할 수 없어요.");
    await call(`${PATH}?ownerKey=${encodeURIComponent(ownerKey)}`, {
      method: "POST",
      body: JSON.stringify({ item: t }),
    });
  },

  async remove(id) {
    await call(`${PATH}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

// 라운드 판정은 Java 가 한다. 단계 6 부터 Meta 게재·KPI 조회도 Java 라 왕복이 없다.
export type BackendSettleResult =
  | { status: "no-active" }
  | { status: "insufficient" }
  | {
      status: "settled";
      round: TourRound;
      winnerIsB: boolean;
      badge: "winner" | "inconclusive";
      completed: boolean;
    };

export async function settleRoundOnBackend(id: string): Promise<BackendSettleResult> {
  const res = await call(`${PATH}/${encodeURIComponent(id)}/settle`, { method: "POST" });
  return (await res.json()) as BackendSettleResult;
}

// 화면의 수동 액션도 폴러와 **같은 함수**를 탄다. 레버 선택과 실 게재를 TS 에도 두면 사람이 누른
// 라운드와 폴러가 띄운 라운드가 다른 규칙으로 만들어진다 — 진짜 광고가 만들어지는 경로라 특히 위험하다.
export async function advanceOnBackend(id: string, step: "propose" | "launch"): Promise<Tournament> {
  const res = await call(`${PATH}/${encodeURIComponent(id)}/advance?step=${step}`, { method: "POST" });
  return (await res.json()) as Tournament;
}
